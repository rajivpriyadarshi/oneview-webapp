# Dynamic UI — system design

Prototype 2 in the lab. A report that assembles itself from what the model found,
and then accepts changes in conversation.

Worked example, end to end:

1. *"Give me the portfolio analysis report for Prashanth"* → a report appears,
   composed on the fly.
2. *"Add a comparison graph between his top 2 holdings"* → that chart is chosen,
   built, and inserted into the existing report. The report is not regenerated.

This document covers the system and its primitives. No implementation yet.

---

## 1. The central decision

There are two ways to build this, and the choice determines everything else.

### Option A — the model picks components

The LLM returns something like:

```json
{ "component": "DonutChart", "props": { "data": [...], "colors": ["#8FE3B0"] } }
```

This is the obvious approach and I think it's the wrong one:

- **It hallucinates.** `DonutChart` vs `PieChart` vs `Donut` — the model will
  invent component names and prop shapes that don't exist, and you find out at
  render time.
- **It puts layout and colour in the model's hands.** Every regeneration is a
  chance for the design system to drift. Ask the same question twice and get two
  different-looking reports.
- **It can't be reasoned about.** There is no answer to "why a donut here?"
  because the reason lived inside a token stream.
- **It can't be tested.** You can only assert on the output of a
  non-deterministic call.

### Option B — the model reports findings, the system picks components

The LLM returns *semantic facts* with intent, and never names a component:

```json
{
  "kind": "composition",
  "subject": "Portfolio by asset class",
  "emphasis": "primary",
  "parts": [
    { "label": "Public equities", "value": 0.52 },
    { "label": "Fixed income", "value": 0.23 },
    { "label": "Private markets", "value": 0.25 }
  ]
}
```

A deterministic **selection layer** then decides that a 3-part composition at
primary emphasis is best shown as a donut, and that the same finding with 14
parts is a table instead.

**This is the recommendation.** The model does what it's good at — reading the
book of client facts and deciding what matters. The design system keeps control
of how things look. The mapping is pure, so it's unit-testable, and every choice
has a stated reason you can print in the UI.

It also means the interesting part of this prototype — the logic layer — is real
code rather than a prompt, which is what you asked for.

Everything below assumes Option B.

---

## 2. Layers

```
    prompt
      │
  ┌───▼──────────────────────────────────────────┐
  │ 1  Intent          "what is being asked for" │  LLM, structured
  └───┬──────────────────────────────────────────┘
  ┌───▼──────────────────────────────────────────┐
  │ 2  Findings        typed semantic facts      │  LLM, structured
  └───┬──────────────────────────────────────────┘
  ┌───▼──────────────────────────────────────────┐
  │ 3  Selection       finding → renderer        │  deterministic ← the core
  └───┬──────────────────────────────────────────┘
  ┌───▼──────────────────────────────────────────┐
  │ 4  Composition     renderers → sections/grid │  deterministic
  └───┬──────────────────────────────────────────┘
  ┌───▼──────────────────────────────────────────┐
  │ 5  Render          registry → React          │  presentation only
  └───┬──────────────────────────────────────────┘
  ┌───▼──────────────────────────────────────────┐
  │ 6  Patch           follow-ups mutate the doc │  LLM emits ops
  └──────────────────────────────────────────────┘
```

Only layers 1, 2 and 6 involve a model. Layers 3–5 are pure functions, which is
where the testability comes from.

---

## 3. Layer 2 — the finding vocabulary

The whole system rests on this list. A finding is a *claim about the data plus
the shape of the evidence*, never a visual instruction.

| kind | means | payload |
|---|---|---|
| `metric` | one number that matters | value, unit, delta?, series? |
| `trend` | one thing over time | series of points |
| `comparison` | N entities on one measure | entities[], measure, series? |
| `composition` | parts of a whole | parts[] (must sum) |
| `transition` | it moved from A to B | from, to, subject |
| `requirement` | an amount needed by a date | amount, deadline, purpose |
| `narrative` | a prose claim | text, supporting deltas? |
| `recommendation` | do this, because | title, rationale, action |
| `flag` | something is wrong | severity, subject, detail |

Every finding also carries:

```ts
type FindingMeta = {
  id: string;
  emphasis: "primary" | "secondary" | "supporting";
  confidence: number;        // 0–1
  sources: string[];         // reuses the grounding work from prototype 1
};
```

`sources` is deliberate: it lets the grounding marker and the Inspect panel
already built for Chat transparency work on individual blocks of this report.
The two prototypes should share that vocabulary rather than each invent one.

### Coverage check against the Figma reference

Walking the reference top to bottom, every block maps to a finding kind — good
sign the vocabulary is the right size:

| In the design | Finding |
|---|---|
| `S$25.4m` + delta + sparkline | `metric` with series, primary |
| "Near-term focus" paragraph | `narrative` |
| "Performance summary" + the ±% chips | `narrative` with supporting deltas |
| "Technology exposure 21% → 29%" | `transition` |
| "~S$3m required" | `requirement` |
| "Bond maturity S$800k next month" | `requirement` |
| "Review technology and US equity concentration" | `recommendation` |

---

## 4. Layer 3 — the selection layer

The part worth building carefully.

Not an if-chain. Each renderer **declares what it can accept and how well it
fits**, and selection is a scoring pass — the same shape as the candidate-model
scoring already in the Reasoning Router step, which gives the two prototypes a
consistent idea of how the system makes choices.

```ts
type Renderer = {
  id: string;
  accepts: FindingKind[];
  /** Returns 0 for "cannot render this", else 0–1 for how well it fits. */
  fit(finding: Finding): number;
  /** Grid width it wants, in a 12-column report grid. */
  preferredSpan: (finding: Finding) => number;
};
```

Illustrative rules — these are the decisions the layer encodes, and they are the
thing to argue about in review:

| Finding | Shape | Chosen renderer | Why |
|---|---|---|---|
| `metric` | primary + series | `HeroMetric` | the headline number earns a sparkline |
| `metric` | secondary | `StatTile` | no chart; it's context |
| `trend` | ≤ 8 points | `Sparkline` | too few points to justify axes |
| `trend` | > 8 points | `LineChart` | |
| `comparison` | 2 entities, no series | `PairedBars` | |
| **`comparison`** | **2 entities, with series** | **`DualLineChart`** | **the follow-up case** |
| `comparison` | 3–6 entities | `BarChart` | |
| `comparison` | > 6 entities | `DataTable` | bars stop being readable |
| `composition` | ≤ 6 parts | `DonutChart` | |
| `composition` | > 6 parts | `StackedBar` | donut segments get too thin |
| `transition` | any | `TransitionCard` | the `21% → 29%` card |
| `requirement` | any | `RequirementCard` | |
| `narrative` | with deltas | `NarrativeWithChips` | |
| `narrative` | plain | `ProseBlock` | |
| `recommendation` | any | `RecommendationCard` | |
| `flag` | any | `FlagCallout` | |

Two consequences worth stating:

- **The same finding renders differently as its data changes.** 6 holdings is a
  bar chart; the 7th makes it a table. That's the layer earning its keep.
- **Every selection can explain itself.** `selectRenderer` returns
  `{ renderer, fit, reason, runnersUp }`. That is directly inspectable in the UI
  — the same "show your work" idea as prototype 1, applied to layout.

---

## 5. Layer 4 — composition

Deterministic grouping:

1. Bucket findings into sections by `subject` affinity, keeping the model's order
   within a section.
2. Sort sections: primary emphasis first.
3. Pack each section's blocks into a 12-column grid by `preferredSpan`,
   greedy, no orphans (a lone 4-span block gets promoted to 12).

Output is a `ReportDoc`:

```ts
type ReportDoc = {
  id: string;
  title: string;
  subject: string;                 // the client
  sections: { id: string; heading?: string; blocks: Block[] }[];
};

type Block = {
  id: string;
  findingId: string;
  rendererId: string;
  span: number;
  selection: SelectionTrace;       // why this renderer
};
```

`ReportDoc` is the durable artefact. Layer 6 patches it.

---

## 6. Layer 6 — follow-ups as patches

*"Add a comparison graph between the client's top 2 holdings"* must not
regenerate the report. Regeneration would reshuffle everything the user has
already read, and that's the failure mode that makes generative UI feel unusable.

So the follow-up produces **ops against the existing doc**:

```ts
type ReportOp =
  | { op: "addFinding"; finding: Finding; after?: string; sectionId?: string }
  | { op: "removeBlock"; blockId: string }
  | { op: "replaceBlock"; blockId: string; finding: Finding }
  | { op: "setEmphasis"; blockId: string; emphasis: Emphasis }
  | { op: "reorder"; blockId: string; after: string };
```

The model emits ops and findings. It still never names a component — `addFinding`
routes through the same selection layer, so an inserted block is chosen by the
same rules as an original one. "Comparison of 2 entities with a time series"
resolves to `DualLineChart` whether it arrived in the first pass or the fifth.

The reducer is pure: `(doc, ops) => doc`. Undo is free, and the insertion can be
animated because we know exactly which block ids are new.

---

## 7. On the LLM, and on CopilotKit

### What already exists (this matters)

The repo is further along than a lab prototype would suggest, and in a direction
that fits this design well:

- `app/chat/page.tsx` and `app/client/page.tsx` run **real** LLM chat —
  `useChat` from `@ai-sdk/react` over an `AssistantChatTransport` pointed at a
  backend (`oneview/chats/`), consuming an SSE `UIMessage` stream.
- **Structured output already arrives as a versioned artifact**, out of band from
  the text stream, as a `data-artifact` part. `app/utils/aiChatParts.ts`
  normalises it; `ArtifactData` is `{ artifact_type, artifact_version, name,
  payload }`.
- `app/components/artifact/ArtifactRenderer.tsx` is **already a registry** —
  its own comment says "Registry pattern for extensibility" — dispatching
  `wealth.family_snapshot@1` to `PortfolioReviewContent.tsx`, with a JSON dump as
  the unknown-type fallback.
- `PortfolioReviewContent.tsx` **is the Figma reference, already built**: subject
  header with value and change, near-term focus, performance summary, grouped
  changes, timeline cards, follow-ups.
- All generation is server-side. There is no client-side `generateObject`,
  `streamObject` or `zod` usage anywhere.

So the correction to §1 is worth stating plainly: **the existing artifact path is
Option B already, but frozen at one report shape.** `WealthFamilySnapshotPayload`
is a fixed record of named optional fields — `nearTermFocus?`,
`performanceSummary?`, `changes?`, `priorities?`. It can render *that* report and
no other. Ask for a comparison of two holdings and there is nowhere to put it.

That is precisely the gap this prototype fills: replace one fixed payload shape
with a **composable list of findings**, and one hand-written renderer with a
selection layer. The envelope, the registry and the transport all stay.

Concretely, Dynamic UI becomes `wealth.dynamic_report@1` — a new
`artifact_type` alongside the existing one, dispatched from the same
`ArtifactRenderer`. Nothing existing changes, and the real integration is a
backend prompt change rather than new frontend plumbing.

### CopilotKit

**Recommendation: don't add it.** Two reasons, and the second is the stronger:

1. The structured-output contract this needs is a schema plus a pure reducer, not
   an agent framework.
2. CopilotKit wants to own an agent runtime. **This project already has one**, on
   the backend, with auth, CSRF, sessions and an artifact streaming convention
   built around it. Adding CopilotKit means a second, parallel path to the model,
   and the orchestration it would manage is the part this design deliberately
   makes deterministic (layer 3).

### For the simulation

Layers 1, 2 and 6 sit behind one interface:

```ts
type FindingSource = {
  analyse(prompt: string, subject: string): Promise<Finding[]>;
  amend(prompt: string, doc: ReportDoc): Promise<ReportOp[]>;
};
```

Ships with `ScriptedFindingSource` — canned findings keyed by intent, in the lab
style: pure data, no network, replays identically. The real implementation is a
backend prompt that emits findings into the existing `data-artifact` part, read
through the same two methods. Layers 3–5 don't change, and they hold all the logic.

One dependency note: a real model call wants a runtime schema. `zod` v4 is already
installed transitively via the AI SDK but isn't a declared dependency and is used
nowhere in `app/` — so if validation ever lands client-side it needs promoting to
`package.json`, not installing. The scripted source doesn't need it, and if
validation stays server-side, nothing needs it.

---

## 8. Renderers — what already exists

No new charting library. `chart.js` + `react-chartjs-2` and
`@tanstack/react-table` are already declared dependencies and cover the set —
plus `chartjs-plugin-datalabels` and `chartjs-chart-sankey`, the latter hinting
that a `flow` finding kind may eventually be wanted (see §10).

More usefully, the repo already has most of the primitives, though none of them
are shaped for this yet:

| Renderer needed | Closest existing | Gap |
|---|---|---|
| `LineChart`, `DualLineChart` | `PortfolioChart` (`components/PortfolioChart.tsx:24`) | **Best-shaped primitive in the repo** — pure props, gradient line, already supports a second series. Near drop-in. |
| `DonutChart` | `LabeledDonut`, `SectorDonutChart` (`components/PortfolioExposure.tsx:155,302`) | Both pure and prop-driven, but **module-private**. Need exporting. |
| `Sparkline` | `Sparkline` (`dashboard/page.tsx:943`) | Hand-rolled SVG, `{ points, color }`. Page-private, trivially liftable. |
| `BarChart` | `AssetAllocationChart` (`client/page.tsx:2504`) | Page-private, own 13-colour palette inlined. |
| `StatTile` | `MetricCard` (`client/page.tsx:2720`) | Page-private, all-string props, has a built-in "Ask AI" button to strip. |
| `ProseBlock` | `MarkdownContent` | Exported and already reused by the Chat transparency lab. Use as-is. |
| `DataTable` | `HoldingsTable`, `DocumentsTable` | **Both hardcode columns for a fixed row type. No generic table exists.** The one substantial build. |
| `RecommendationCard` | `InsightCard` | **Has zero props** — copy is hardcoded and it's styled by global CSS classes. Shape is right, so treat as a visual reference, not a base. |
| `HeroMetric`, `TransitionCard`, `RequirementCard`, `PairedBars`, `StackedBar`, `NarrativeWithChips`, `FlagCallout` | — | New. |

Three consequences:

- **A generic `DataTable` is the real work.** Everything else is lifting or
  adapting; this needs columns derived from a finding payload rather than written
  by hand.
- **Most of what we'd lift is already dead code.** `PortfolioChart`,
  `PortfolioExposure`, `HoldingsTable`, `DocumentsTable`, `InsightCard` and their
  parents are **imported by no route** — an orphaned library from an earlier
  client-facing surface. Useful to know: the risk in lifting from them is zero.
- **Copy into the lab regardless.** Even for the orphaned components, per the
  scope boundary in §10 — the lab owns its copies, so a renderer can change props,
  sizing and formatting freely. `MetricCard`, `Sparkline` and
  `AssetAllocationChart` are private to *live* pages (`client/page.tsx`,
  `dashboard/page.tsx`), where this matters most.

Renderers stay dumb: typed payload in, pixels out. No selection logic, no data
fetching, so they remain reviewable as design work.

### Two precedents worth following

`ThoughtChain.tsx` already does a small version of this: a `ThoughtDetail`
discriminated union dispatched by a switch (`DetailLine` → `ModelSelectBlock` /
`RouteBlock` / `MaskBlock`). Finding vocabulary plus renderer registry, one level
smaller — and it works.

`PortfolioReviewContent.tsx` establishes the **layout recipe** to keep: sections
as `<section className="mb-[24px]">` with a bold 16px heading, and cards as
`rounded-[12px] border border-black/10 bg-white/65 p-[14px]`. Layer 4 should emit
that, so a generated report is visually continuous with the one that already ships.

### The thing to be careful about

There is **no design-token source worth the name**, and it's worse than it looks.
`tailwind.config.js` exists but its `theme.extend` holds only fonts, keyframes and
animations — no colours. `globals.css` defines 7 colour custom properties. Beyond
that: **253 distinct hardcoded hex literals** across `app/`, as Tailwind arbitrary
values, with `#171615` alone appearing 60 times.

Chart palettes are worse still — at least three, mutually inconsistent:
`CHART_COLORS` (24 muted earth tones, plus a `getChartColor` cycle-shader and
`shadeHex`) in `PortfolioExposure.tsx:24`, a clashing 13-colour saturated
`allocationColors` in `client/page.tsx:2510`, and `FALLBACK_ICON_COLORS` in
`HoldingsTable.tsx:83`.

This is exactly where a runtime-composed report breaks. Hand-built screens get a
human eyeballing the blocks together; a report assembled from findings chosen at
runtime does not. **So a palette module is a prerequisite, not a polish step** —
one sequential scale, one positive/negative pair, one categorical scale.
`CHART_COLORS` + `shadeHex` is the best starting point. The precedent for the
shape is `GROUNDING_TONE` from prototype 1: one table, deliberate, per-state.

---

## 9. Build order

1. `findings.ts` — the vocabulary and its types. Settled by decision 1.
2. `palette.ts` — the canonical chart palette, before any renderer picks a colour
   (decision 5). One sequential scale, one positive/negative pair, one
   categorical scale, promoted from `CHART_COLORS` + `shadeHex`. First because
   every renderer consumes it, and retrofitting colour is how the 253-hex mess
   in §8 happened.
3. `renderers/` — the primitives, each with a static fixture. **Reviewable as
   design work before any orchestration exists.** The generic `DataTable` is the
   real build here; most of the rest is lifting per §8.
4. `select.ts` — the scoring layer, with unit tests over the table in §4,
   returning the `reason` that decision 4 puts on screen.
5. `compose.ts` — findings → `ReportDoc`, blocks in reveal order (§11).
6. `ScriptedFindingSource` + the portfolio-report fixture.
7. `/lab/dynamic-ui` — chat frame plus the widget/overlay shell copied per §11,
   and the frame driver that lands blocks one at a time.
8. `patch.ts` — ops reducer, then the "add a comparison graph" follow-up,
   animating the inserted block by its stable id.
9. The selection trace surfaced in the UI.

Steps 1–5 are the system you asked to set up first. Step 3 is where you'll have
the most to say, so it comes early and standalone. Step 2 moved ahead of the
renderers as a consequence of decision 5.

---

## 10. Decisions

All resolved in review. Recorded here because several of them constrain the
build order above.

1. **The finding vocabulary in §3 stands as-is** for the prototype. Missing kinds
   get added after implementation, when there's something concrete to argue with.
   So §3 is settled and the renderers can be written against it.
2. **The report is a right-hand overlay, reusing the existing artifact pattern**
   — widget in the chat on the left, overlay over the client panel on the right.
   Auto-opens; if closed, reopens from the widget. Detail in §11.
3. **Blocks land one at a time, animated**, so the report visibly builds rather
   than appearing complete. This is the reason layer 4 emits an ordered block
   list rather than a finished tree — see §11.
4. **The selection trace is visible.** Layer 3's `reason` is surfaced in the UI,
   not just returned.
5. **Build the palette.** A single canonical chart palette, promoted from
   `CHART_COLORS`, is a step in the build order rather than a cleanup afterwards.
6. **Ignore the amber underline.** Closed, carried over from prototype 1 and not
   pursued.

### Scope boundary

Dynamic UI lives entirely under `/lab/dynamic-ui`. It changes **nothing** in the
Chat transparency prototype, and nothing in production.

That decides the reuse question §8 left open, and reverses its advice: **copy the
pattern, don't modify the components.** `ArtifactPopup`, `ArtifactMessage`,
`ArtifactContext`, `artifactFormatters` and both production pages stay untouched
— a new `artifact_type` would otherwise mean editing a live registry and a live
label switch. Prototype 1 already follows this rule by copying `app/client/page.tsx`'s
`TW` map instead of importing it, precisely so the lab can't regress a real screen.

The `wealth.dynamic_report@1` proposal in §7 therefore describes **how this would
land in production later**, not what the prototype does. It stays in the document
as the integration story, and none of it is built now.

---

## 11. The shell — widget, overlay, and progressive assembly

### The pattern already exists, and it is the one we want

Verified in the repo. `app/client/page.tsx` already does exactly the behaviour
described in decision 2:

| Piece | Where | What it does |
|---|---|---|
| `ArtifactPopupProvider` | `client/page.tsx:772` | `autoOpenEnabled={true} positioning="client-panel"` |
| `ArtifactMessage` | `components/ArtifactMessage.tsx` | the gradient card **in the chat, on the left** — label + title + arrow, click or Enter/Space to open |
| `ArtifactPopup` | rendered at `client/page.tsx:1245` | `absolute inset-0` as the **last child of the client-overview `<section>`** — so it fills the right-hand panel |
| auto-open | `client/page.tsx:3098` | `autoOpenArtifact(messageArtifact)` fires when the last message carries an artifact |

Two details in `ArtifactContext.tsx` are worth calling out, because they're what
makes "reopen from the widget" work rather than needing to be built:

- `closeArtifact` sets `isOpen = false` but **deliberately keeps `artifact` in
  state**. So closing is not discarding — the widget can reopen the same report.
- `autoOpenArtifact` is a separate method from `openArtifact`, gated on a
  provider-level flag. Automatic opening and manual opening are already distinct.

On "it should auto-open when the user asks for something with potential for this
kind of output": that judgement doesn't need a heuristic in the shell. **The
presence of a report is the signal** — layer 2 only produces findings worth
composing when there are some, so auto-open on arrival is the correct rule and
the existing code already expresses it.

The visual recipe to copy from the `client-panel` variant: a `/artifact-backdrop.jpg`
wash at `opacity-[0.82]` with `backdrop-blur-[2px]`, a `rounded-[28px]` white card
at `max-w-[900px]`, a 40px circular close button top-right, backdrop click to
close, Escape to close, and `prefers-reduced-motion` collapsing the animation to
1ms. That last one is not optional and is easy to lose when copying.

### What progressive assembly changes

Nothing about the shell — but it does constrain layer 4. `ArtifactRenderer` today
receives a finished payload and renders it in one pass. Blocks landing one at a
time means the lab needs to reveal `doc.sections[].blocks[]` incrementally.

This is the frame driver from prototype 1, applied to a report instead of a
thought chain: `buildFrames()` produces explicit snapshots, each with a
`visibleBlockCount`, and the page walks them on a `setTimeout` chain. Same
consequence, which is the reason it's worth reusing — **the assembly is
scrubbable**, so the animation can be reviewed at any point without re-running.

Two requirements this puts on the layers above:

- **Layer 4 must emit blocks in reveal order**, and that order is a design
  decision, not an accident of iteration. Primary emphasis first, matching the
  section sort in §5.
- **Each block animates in independently**, so `Block.id` has to be stable
  across frames — otherwise React remounts a block mid-animation and it flickers.
  Stable ids are also what makes the §6 patch insertion animatable.

One thing to get right: a report that grows block by block **changes height as it
builds**, inside a scroll container. Landing a block must not shift what's
already been read, so growth has to be downward-only, with the container not
auto-scrolling unless the user is already at the bottom.
