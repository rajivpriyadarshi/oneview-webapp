# Schema-driven generative UI — architecture review and migration plan

Written before any implementation. Covers: what exists today, where it diverges from
the target pipeline, what survives the move, the phases, the contracts, and three
worked examples end to end.

Files inspected: `app/lab/dynamic-ui/*` (the whole prototype, 13 modules + 7 test
files + its own `DESIGN.md`), `app/api/lab/dynamic-ui/route.ts`, and the production
artifact path (`app/types/artifactTypes.ts`, `app/components/artifact/*`,
`app/components/ArtifactMessage.tsx`, `app/contexts/ArtifactContext.tsx`,
`app/utils/aiChatParts.ts`).

---

## 1. What exists today

There are **two** report paths in the repo, and they are unrelated to each other.

### Path A — production (`app/chat`, `app/client`)

```
backend LLM
  └─ SSE UIMessage stream
       ├─ text part ──────────────────────────► chat bubble
       └─ data-artifact part
            → aiChatParts.ts (normalise envelope)
            → ArtifactData { artifact_type, artifact_version, name, payload }
            → ArtifactContext.autoOpenArtifact()
            → ArtifactPopup  (right-hand overlay)  +  ArtifactMessage (chat card)
            → ArtifactRenderer  ── registry, 1 entry ──►  PortfolioReviewContent
                                └─ unknown type ───────►  <pre>JSON</pre>
```

`WealthFamilySnapshotPayload` is a fixed record of named optional fields —
`nearTermFocus?`, `performanceSummary?`, `changes?`, `followUps?`, `priorities?`.
It renders *that* report and no other. This is the "map section types to predefined
frontend components" stage, frozen at exactly one section set.

### Path B — the lab prototype (`/lab/dynamic-ui`)

This is the flow the brief describes, and it is further along than "structure the
answer into JSON section types". Actual end-to-end:

```
prompt
  │
  │  ── client (live.ts) ─────────────────────────────────────────────────────
  ├─► intentOf(prompt)                    interpret.ts   regex          (veto only)
  │
  ├─► POST /api/lab/dynamic-ui {stage:"answer"}
  │      ANSWER_SYSTEM, no tools, whole clientBook() in the prompt
  │   ◄── prose answer                                   LLM call 1
  │
  ├─► decide(prompt, prose)               decide.ts      regex over the PROSE
  │      counts figures / percentages / list lines / paragraphs
  │      → { wants: "reply" | "report", categories: Category[], evidence }
  │      13 CategoryIds, each hardcoded to one FindingKind
  │
  ├─ wants === "reply" ─────────────────────────────────► chat bubble. done.
  │
  ├─► POST {stage:"structure", answer, categories}
  │      STRUCTURE_SYSTEM + forced tool `structure_report`
  │      (clientBook() sent AGAIN here)                   LLM call 2
  │   ◄── { reply, title, findings: Finding[] }
  │
  ├─► coerceFinding() × n                 live.ts        per-finding validation
  │      drops unusable, downgrades trend→narrative, rescales parts >1
  │
  ├─► composeReport(findings)             compose.ts     DETERMINISTIC
  │      1. group by finding.subject (string equality)
  │      2. sort sections + blocks by emphasis
  │      3. selectRenderer(finding) per finding  ──► select.ts, 19 descriptors,
  │         scored fit / preferredSpan / reason / runnersUp
  │      4. greedy pack spans into rows of 12, promote orphan
  │      → ReportDoc { sections[].blocks[], findings: Record<id, Finding>, unrendered[] }
  │
  ├─► critique(doc)                       critique.ts    DETERMINISTIC, page-level
  │      6 rules → ReportOp[]: drop duplicate fingerprints, force a headline,
  │      demote competing headlines, raise a buried critical flag, don't open on
  │      prose, break 3 identical charts in a row
  │
  ├─► applyOps(doc, ops)                  patch.ts       pure reducer
  │
  └─► ReportView + RENDERER_COMPONENTS    renderers.tsx  19 leaf renderers,
         12-col grid, blocks revealed one per 1150ms, 3-beat build animation

follow-ups:  ask()      → one LLM call → patch_report ops → applyOps
one card:    askBlock() → one LLM call scoped to a block → replaceBlock op
no key:      heuristics.ts (950 lines) answers the same asks from the same book
```

Stage reporting: `Stage`/`OnStage` in `live.ts` → `ThinkingPanel.tsx`, four ids
(`answering`, `deciding`, `structuring`, `patching`), throttled to ≥700ms apart.

---

## 2. Where this differs from the target

Ordered by how much of the current code the gap invalidates.

### 2.1 Structurally wrong — must change shape, not gain features

**(a) `selectRenderer(finding) → RendererId` is per-finding, and there is no
container vocabulary.** This one signature is load-bearing for the whole
prototype, and it cannot express the target IA. A function that sees exactly one
finding and returns exactly one leaf renderer id can never decide "these two
belong in tabs", "these ten securities are one table, not ten cards", "this goes
behind disclosure", or "contributors + detractors are one *Performance drivers*
area". `RENDERER_COMPONENTS` is `Record<RendererId, (props: {finding}) => ReactNode>`
— every component takes one finding and nothing else. There is no `Tabs`, `Grid`,
`Stack`, `SplitPane` or `Disclosure`, and none can be added to that map because it
has no notion of children or props.

Consequence: 10 findings always produce 10 cards. The brief's "avoid card soup" is
not a tuning problem here; it is the data model.

**(b) `Finding.subject: string` is the only grouping mechanism, and sections are
derived from string equality on it.** `composeReport` buckets by exact-match
subject. So the model's free-text choice of the word "Liquidity" versus "Liquidity
and funding" silently produces one section or two. That is not an information
architecture, and nothing downstream can group, nest, or relate sections.

**(c) `critique.ts` does IA work in the wrong place.** It is the only layer that
can see the whole page, and its six rules are genuinely good IA rules — but it runs
*after* composition and repairs an already-built document with a five-op vocabulary.
It can demote a heading; it cannot create a container. IA decisions belong before
composition. Keep the rules, move them: the page-level *checks* become the
validator, the page-level *choices* become the IA composer.

**(d) `decide.ts` decides by counting dollar signs in prose.** Regexes over the
answer text: how many currency figures, how many percentages, how many list lines,
how many paragraphs. It produces a binary `reply | report` plus a flat list of up to
6 categories. The brief wants the decision made on *task complexity*, and wants a
task type, scope, time range, and comparison/chronology/action flags. None of that
is derivable from figure counts. Replace it; do not extend it.

**(e) `heuristics.ts` is a 950-line second analyst.** It exists so the demo runs
with no API key, and it does that job well. But it is a parallel implementation of
the analysis layer, keyed to one hardcoded `clientBook`. Once a real data/tool layer
exists it becomes a permanent second source of truth for what the answer is. Do not
port it forward — degrade to the prose answer instead (§2.2h).

### 2.2 Missing layers

| Target layer | Today | Gap |
|---|---|---|
| **1. Intent / task planner** | `intentOf()` regex (3 outcomes: answer/report/amend), used only as a veto inside `decide` | No task type, no scope, no time range, no comparison/chronology/action-expected flags, no analytical/operational/explanatory axis. Nothing exists to select a recipe with, or to plan data with. |
| **2. Data / tool execution** | Not a stage. `clientBook()` is string-concatenated into every prompt; "data" is whatever the model retyped into findings | No clean domain-data boundary. Findings *are* both the data and the semantic model, so there is no artifact to re-run for a saved view, and no way to enforce that pass 2 didn't change a number. |
| **3. Semantic report model** | `Finding[]` — flat, per-claim, free-text `subject` | Closest thing that exists, and the right vocabulary at the *leaf* level. But there is no report-level envelope (`reportType`, `summary`), no section level (`semanticType`, `importance`, `groups`), and no relations between sections. Flat list → two-level model. |
| **4. IA composer** | Does not exist. `compose.ts` is a grid packer | All of it: primary/secondary, ordering, grouping, repetition, collapsing, tabs, table-vs-cards, chart-worthiness, disclosure. |
| **5. Layout recipes** | Do not exist. Every report is emphasis-sort + greedy 12-col pack | A liquidity question and a portfolio review produce the same page skeleton. No header/summary/primary/secondary/insights/actions frame. |
| **6. Approved component registry** | `RENDERER_COMPONENTS`, flat id → `(finding) => ReactNode` | No prop schemas, no semantic descriptions, no variants, no sizes, no use-when rules, no children/nesting constraints. Half of what the registry needs to be. |
| **7. UI spec** | `ReportDoc` — a composition *result*, not a declarative spec | `Block = {rendererId, span, selection}` with no props and no children. One thing is already right: `doc.findings` is a `Record<id, Finding>` and blocks hold a `findingId`, so **data-key indirection already exists** — that pattern ports directly. |
| **8. Validator** | `coerceFinding` (per-finding, in `live.ts`) + `selectRenderer` returning null + 2 guards in `critique` | No document-level schema check, no registry-membership check, no prop validation, no depth/count caps, no duplicate/empty-section checks, no UX heuristics, no repair pass. |
| **9. Two-pass separation** | **Partly there, and it is the best idea in the codebase.** `stage:"answer"` (prose, no tools) then `stage:"structure"` (forced tool, translation only) | The boundary leaks: `route.ts:533` sends the full `clientBook()` into the *structure* stage too, so pass 2 can re-derive rather than translate; and `coerceFinding` silently rewrites values (`value > 1 ? value / 100 : value`). "The composer may not change the facts" is currently a prompt instruction, not an enforced property. |
| **10. Text vs rich UI decider** | Exists, runs after the answer call, decides on figure density | Wants to be earlier and based on task shape. Note the current placement is not wrong for *cost* — a lookup never pays for the structure call — it is wrong for *signal*. |
| **11. Conversational editing** | **Strongest existing asset.** `ReportOp` + `applyOps` pure reducer + stable `block-${findingId}` ids + per-block `askBlock`/`reviseLocally` + revision counters folded into React keys | Ops act on the *composed doc*, not on the semantic report. So "focus more on risk" can only reorder and re-emphasise blocks — it cannot change what the report is about. Ops must split into semantic ops and presentation ops. |
| **12. Persistent views** | None. Everything is `useState` in `page.tsx` | No `ViewDefinition`, no scope, no dataSources, no refresh. |
| **13. Loading / progress** | `Stage`/`OnStage`/`ThinkingPanel`, 4 ids, ≥700ms throttle, `REVEAL_MS` block cadence, 3-beat per-card build | Reusable nearly as-is; needs the 5 real stage names. One thing to fix: the panel currently prints decision internals ("11 figures across 3 subjects", the `evidence` counts). That is closer to exposing the machine's reasoning than the brief allows. |
| **14. Failure behaviour** | Good instincts, many fallbacks: `localAnswer`, `FallbackList` (accepts every kind at fit 0.02), `doc.unrendered[]`, ops that reject individually without aborting the batch | The chain is spread across `live.ts` and `page.tsx` with no single fallback contract, and one leg of it is the 950-line `heuristics.ts`. |
| **15. Design quality** | `palette.ts` is exactly right — one categorical scale, one sequential, one sentiment pair, all colour funnelled through it. One card recipe as a constant | But per-finding cards packed into a 12-col grid *is* card soup by construction. The discipline lives in the leaves and is absent at the page level. |

---

## 3. What to reuse

Ranked by value. Roughly 60% of the prototype's lines survive; the pipeline's
*wiring* is what changes.

**Keep near-verbatim**

1. `palette.ts` (158 lines) — the whole point of "the design system controls how
   good UI looks". **Promote out of the lab** to a shared module. Copying it a third
   time is how the repo got 253 hardcoded hexes.
2. The 19 leaf visuals in `renderers.tsx` (~700 lines of hand-rolled SVG charts,
   cards, tables) — these become the registry's component *implementations*. They
   need prop-schema wrappers: `({ finding }) => ...` becomes explicit named props,
   so the registry can validate them and so a component stops being coupled to the
   finding vocabulary.
3. `coerceFinding` (`live.ts:84–223`) — the forgiving-envelope/strict-required
   discipline is exactly what a validator needs. Retarget it at `SemanticReport`.
4. `applyOps` (`patch.ts`) — pure `(doc, ops) => {doc, addedBlockIds, removedBlockIds, rejected}`,
   partial application, non-mutating. This is the conversational-editing engine
   already built. Retarget at `SemanticReport` + `UISpec`.
5. `Stage`/`OnStage` + `ThinkingPanel` + the `REVEAL_MS` / `visibleCount` reveal
   machinery + `ReportView`'s 3-beat build with stable keys.
6. The provider abstraction in `route.ts` (`Ask`/`ModelReply`, one contract written
   in Anthropic shape, translated for OpenAI, `force` for single-outcome stages).
   Every new pipeline stage is another `Ask`.
7. The two-pass route split itself — prose answer with **no tools**, then a forced
   structuring tool. Keep, and tighten the boundary.
8. Production envelope: `ArtifactData`, `ArtifactRenderer`'s registry dispatch,
   `ArtifactPopup` / `ArtifactMessage` / `ArtifactContext` (note `closeArtifact`
   keeps the artifact in state, so reopen-from-widget already works). The generated
   view lands as a new `artifact_type` — `wealth.generated_view@1` — beside
   `wealth.family_snapshot@1`. No existing frontend plumbing changes.

**Keep the knowledge, change the call site**

9. `select.ts`'s descriptor pattern — `accepts` / `fit` / `preferredSpan` /
   `reason` / `runnersUp`, scoring rather than an if-chain, every choice carrying a
   printable reason. This becomes *component fitness* consulted by the IA composer,
   not a top-level per-finding dispatcher.
10. The thresholds inside those descriptors are real, earned knowledge and should be
    ported line for line: 2 entities **with** series → overlaid lines, 3–6 with
    series → multi-line, 3–12 without → bars, ≤6 parts → donut, 7–12 → stacked bar,
    >12 → table, ≤8 points → sparkline not axes, single-item checklist → sentence.
11. `critique.ts`'s six rules — split them. Duplicate-fingerprint detection, empty
    sections and buried-critical become **validator** checks. Headline selection,
    competing-headline demotion and chart-monotony become **IA composer** decisions.
12. `findings.ts`'s ten kinds (`metric`, `trend`, `comparison`, `composition`,
    `transition`, `requirement`, `narrative`, `recommendation`, `flag`, `checklist`)
    plus `Series`, `Delta`, `Sentiment`, `isPlottable`, `hasEntitySeries`. These
    describe *data shapes*, not visuals — correct by the brief's own rule. They
    become the leaf vocabulary inside `SemanticReport`.
13. Tests: `select.test.ts`, `compose.test.ts`, `patch.test.ts` port with edits.
    `decide.test.ts` and `interpret.test.ts` die with their modules.

**Retire**

14. `decide.ts` — replaced by the intent planner (§2.1d).
15. `interpret.ts`'s `intentOf` and the `Ask` regex parsing — replaced by the intent
    planner. `interpretRevision`'s `DrawRequest` override path survives as-is: a
    human pointing at a card and saying "make this a table" is an override, and
    overrides should still win.
16. `heuristics.ts` — do not port (§2.1e).
17. `compose.ts`'s grid packing survives only as an implementation detail *inside*
    the `Grid` component. It stops being the layout layer.

---

## 4. Migration plan

Principle: the contracts and the renderer registry come first and are reviewable
without a model in the loop; the model-facing stages come last. That is the same
ordering `DESIGN.md §9` used and the reason its layers 3–5 are the tested part.

Recommended home: a new `app/lab/generative-ui/` for the pipeline, plus a shared
`app/design/` for palette and leaf components imported by *both* labs and
eventually production. The lab's existing "copy, don't import" rule was right for
page chrome; it is wrong for the design system.

**Phase 1 — Contracts only.** The seven types in §5, as TypeScript plus runtime
schemas. Promote `zod` to a declared dependency (it is already present
transitively via the AI SDK, declared nowhere, used nowhere in `app/`) so one
schema definition serves validation *and* generates the model-facing tool JSON
Schema. Today `route.ts` hand-writes a 100-line JSON Schema that duplicates
`findings.ts` and can drift from it silently. Deliverable: types, schemas,
`ComponentRegistry` manifest with prop schemas, and a validator with unit tests
over hand-written fixtures. No behaviour change anywhere.

**Phase 2 — Registry and renderer refactor.** Wrap the existing leaf visuals in
explicit-prop components. Build the missing containers: `PageHeader`, `Section`,
`Grid`, `Stack`, `Tabs`, `SplitPane`, `Disclosure`. Build `SpecRenderer` — one
recursive walker that resolves `dataKey` references against the data bundle,
enforces registry membership, and wraps each node in an error boundary so a single
crashing component degrades to a skipped node rather than a blank page. Deliverable:
three hand-authored `UISpec` fixtures rendering correctly with no model involved.
**This is the design review gate** — it is where the "does this feel like one
product" judgement gets made, and it happens before any generation exists.

**Phase 3 — Intent planner + semantic report.** Replace `decide.ts`/`intentOf` with
a structured `IntentPlan` call. Keep the prose-answer pass exactly as it is. Change
the structuring pass to emit `SemanticReport` instead of `Finding[]`, and **stop
sending the client book into it** — pass 2 receives the prose answer and the data
bundle keys, nothing else. Retarget `coerceFinding` as the `SemanticReport`
validator. Deliverable: intent + semantic report visible in the thinking panel,
still rendering through the old `compose.ts` path so nothing regresses.

**Phase 4 — IA composer + recipes.** The deterministic core. Port `select.ts`'s
thresholds and `critique.ts`'s choice-rules into IA rules that emit an `IAPlan`;
add the brief's tabs/table/cards/charts/disclosure/grouping rules. Then
`IAPlan × ViewRecipe → UISpec`. Delete `compose.ts` as a pipeline stage. Deliverable:
the five recipes, and a rules test suite — the same "argue with the table" property
`select.ts` has today.

**Phase 5 — Validation, repair, fallback.** Wire the validator between composition
and render. One repair pass on failure, then fall back to the prose answer. Single
explicit fallback contract replacing the chain currently spread across `live.ts`
and `page.tsx`. Retire `heuristics.ts`. Deliverable: an adversarial fixture set —
unknown component, 8 KPIs in a row, 1-item tabs, duplicated fact, empty section,
depth 12 — each with an asserted outcome.

**Phase 6 — Conversational editing.** Split ops: `SemanticOp` (add/remove/re-scope a
section, change importance) versus `PresentationOp` (regroup, retab, collapse,
reorder). A semantic op re-runs IA for the affected subtree only; a presentation op
skips the model entirely. Port `applyOps`.

**Phase 7 — Persistence.** `ViewDefinition` + refresh. Store intent, scope, data
sources, `semanticConfig` and `layoutSpec`; never rendered output. Refresh re-runs
data and the semantic pass, and reuses the stored `layoutSpec` unless validation
against the new semantic report fails.

**Phase 8 — Production landing.** `wealth.generated_view@1` in `ArtifactRenderer`.
Architectural recommendation: **the backend emits `IntentPlan` + `SemanticReport` +
data bundle; the frontend runs IA, recipe, spec and validation.** The registry, prop
schemas and design system live in the frontend and version with it, so shipping
semantics over the wire means a saved `ViewDefinition` survives a design-system
change and a component rename cannot break a persisted view.

---

## 5. Proposed contracts

Sketches, not final. Each is a `zod` schema in practice; shown as TypeScript for
readability.

### 5.1 IntentPlan — layer 1

```ts
export type TaskType =
  | "portfolio_review" | "comparison" | "meeting_prep" | "liquidity_planning"
  | "activity_review" | "risk_review" | "action_plan" | "entity_overview"
  | "explanation" | "lookup";

export type IntentPlan = {
  taskType: TaskType;
  /** One sentence, the advisor's words. Feeds the thinking panel. */
  goal: string;
  scope: {
    kind: "client" | "clients" | "account" | "book" | "instrument" | "none";
    ids: string[];
    /** Free text when ids can't be resolved yet, e.g. "his two biggest holdings". */
    unresolved?: string;
  };
  timeRange: { kind: "point" | "range" | "rolling" | "none"; from?: string; to?: string; label?: string };
  needs: {
    comparison: boolean;
    chronology: boolean;
    /** Actions or recommendations are expected in the answer. */
    actions: boolean;
    /** Parts-of-a-whole is central, not incidental. */
    composition: boolean;
    /** The ask named a count — "top 4". Load-bearing; must not be rounded off. */
    count?: number;
  };
  register: "analytical" | "operational" | "explanatory" | "factual";
  /** The rich-UI decider, moved here. */
  surface: "text" | "view";
  /** Why this surface, for the panel. Never chain-of-thought. */
  because: string;
  /** Data the planner believes it needs. Drives layer 2. */
  dataRequests: DataRequest[];
};

export type DataRequest = {
  /** Namespaced key the answer and the UI spec will reference. */
  key: string;
  tool: string;
  args: Record<string, unknown>;
  /** A missing required request aborts to the text path. */
  required: boolean;
};
```

### 5.2 DataBundle — layer 2

The boundary that makes "the composer cannot change the facts" enforceable rather
than merely instructed.

```ts
export type DataBundle = {
  /** Domain data and analysis, keyed by DataRequest.key. Never UI. */
  values: Record<string, unknown>;
  provenance: Record<string, { tool: string; asOf: string; sources: string[] }>;
  failed: { key: string; reason: string }[];
};
```

### 5.3 SemanticReport — layer 3

Two levels, where today there is one. The leaf `Finding` vocabulary is the existing
one.

```ts
export type SemanticType =
  | "performance" | "drivers" | "allocation" | "risk" | "liquidity"
  | "market_context" | "activity" | "commitments" | "recommendations"
  | "actions" | "comparison" | "identity" | "evidence" | "summary";

export type SemanticReport = {
  reportType: TaskType;
  title: string;
  /** The answer in one or two sentences. Also the text fallback's headline. */
  summary: string;
  sections: SemanticSection[];
  /** Cross-section relations the IA composer may act on. */
  relations?: { kind: "answers_same_question" | "supports" | "contrasts"; sectionIds: string[] }[];
  /** Pass-1 prose, kept whole. The fallback per §14 of the brief. */
  narrative: string;
};

export type SemanticSection = {
  id: string;
  semanticType: SemanticType;
  /** The reader-facing question this section answers. */
  question: string;
  importance: "primary" | "secondary" | "supporting";
  /** Sibling views of one thing — ["contributors","detractors"], ["1M","YTD"]. */
  groups?: string[];
  /** Leaf claims. Uses the existing Finding union, unchanged. */
  findings: Finding[];
  /** DataBundle keys this section stands on. Validator checks they exist. */
  dataKeys: string[];
  /** Methodology, provenance, raw calc — disclosure candidates by default. */
  detail?: Finding[];
};
```

### 5.4 IAPlan — layer 4

Deterministic output. Component-agnostic on purpose: it says *table*, not
`DataTable`.

```ts
export type IAPlan = {
  areas: IAArea[];
  /** Every rule that fired, with its reason. Printable, testable. */
  trace: { rule: string; because: string; targets: string[] }[];
};

export type IAArea = {
  id: string;
  heading: string;
  /** Sections that answer the same question, grouped. */
  sectionIds: string[];
  rank: number;
  importance: "primary" | "secondary" | "supporting";
  /** How the area's contents relate structurally. */
  arrangement: "single" | "stack" | "grid" | "tabs" | "split" | "table" | "list";
  /** Per-section presentation intent, still not a component name. */
  presentation: Record<string, {
    form: "metric" | "metric_strip" | "table" | "ranked_list" | "chart" | "timeline"
        | "callout" | "checklist" | "comparison" | "prose" | "key_value";
    chartOf?: "trend" | "distribution" | "composition" | "magnitude" | "relationship";
    emphasis: "hero" | "normal" | "quiet";
    disclosure: "open" | "collapsed";
    because: string;
  }>;
};
```

Rules to encode, from the brief plus the ported `select.ts` thresholds:

- **tabs** — 2–5 sibling views, same visual structure, one at a time; never for
  merely-adjacent sections; never with one item
- **table/list** — >4 repeated records sharing attributes, or cross-row comparison
  matters; never for 2 simple records
- **cards** — independent items, differing content types, standalone emphasis
- **chart** — trend / distribution / composition / magnitude / relationship beats
  exact values; port the point-count and entity-count thresholds
- **disclosure** — provenance, methodology, raw calculation, `SemanticSection.detail`
- **grouping** — `contributors + detractors → "Performance drivers"`;
  `concentration + currency + allocation shift → "Risk changes"`; anything joined by
  an `answers_same_question` relation
- **headline** — exactly one primary per view (ported from `critique` rules 2 and 3)
- **monotony** — no three structurally identical presentations in a row (rule 6)

### 5.5 ViewRecipe — layer 5

```ts
export type RecipeId =
  | "AnalyticalReport" | "ComparisonReport" | "TimelineReport"
  | "EntityOverview" | "ActionPlan";

export type ViewRecipe = {
  id: RecipeId;
  /** Which task types this recipe serves. Selection is a lookup, not a model call. */
  serves: TaskType[];
  slots: RecipeSlot[];
};

export type RecipeSlot = {
  id: string;                       // "headline", "primary_analysis", "actions"
  /** Semantic types eligible for this slot. */
  accepts: SemanticType[];
  required: boolean;
  /** Container the slot's contents are wrapped in. Registry component id. */
  container: ComponentId;
  maxAreas: number;
  /** Slot-level presentation ceiling, e.g. no charts in the header. */
  allow?: IAArea["arrangement"][];
};
```

`AnalyticalReport`: header, headline metrics, primary analysis, secondary
breakdown, insights/risks, what-to-watch/actions.
`ComparisonReport`: header, comparison summary, side-by-side metrics, detailed
differences, trade-offs, recommendation.
`TimelineReport`: header, status summary, chronology, unresolved, next actions.
`EntityOverview`: header, identity, key metrics, relationships, recent activity,
documents/evidence.
`ActionPlan`: summary, priorities, checklist, sequencing, owners/status.

Unfilled non-required slots collapse. A required slot with nothing to put in it is
a validation failure, not an empty heading — the mistake `compose.ts:202` already
guards against for sections.

### 5.6 UISpec — layer 7

Declarative tree. Data lives in the bundle; nodes reference it. The rule that makes
§9 of the brief enforceable: **a node's props may contain labels and presentation
options, never facts.** The validator rejects numeric or currency literals in props.

```ts
export type UISpec = {
  version: 1;
  recipe: RecipeId;
  title: string;
  /** Which DataBundle this spec is bound to. */
  dataVersion: string;
  slots: { slotId: string; children: UINode[] }[];
  /** Every choice, with its reason. Ported from SelectionTrace. */
  trace: { nodeId: string; because: string; runnersUp?: ComponentId[] }[];
};

export type UINode = {
  id: string;                                    // stable across recomposition
  component: ComponentId;
  props?: Record<string, JsonValue>;             // presentation only
  /** Bundle keys, resolved by SpecRenderer. Never inlined data. */
  dataKey?: string;
  dataKeys?: Record<string, string>;             // named slots → keys
  variant?: string;
  size?: "sm" | "md" | "lg";
  children?: UINode[];
  /** Named child regions, for Tabs / SplitPane. */
  slots?: Record<string, UINode[]>;
  /** Semantic section this node came from — the editing anchor. */
  sourceSectionId?: string;
};
```

### 5.7 ComponentRegistry — layer 6

```ts
export type ComponentId =
  // layout
  | "PageHeader" | "Section" | "Grid" | "Stack" | "Tabs" | "SplitPane" | "Disclosure"
  // data
  | "Metric" | "MetricStrip" | "DataTable" | "RankedList" | "Timeline" | "KeyValueList"
  // visualisation
  | "LineChart" | "BarChart" | "AllocationDonut" | "ExposureHeatmap"
  // intelligence
  | "InsightCard" | "RiskAlert" | "Recommendation" | "NewsImpact" | "WhatToWatch"
  | "Checklist" | "Comparison"
  // entity
  | "ClientCard" | "HoldingCard" | "AssetCard" | "DocumentReference" | "SourceList";

export type ComponentSpec = {
  id: ComponentId;
  /** What it means, for the composer's rules and for review. */
  description: string;
  category: "layout" | "data" | "visualisation" | "intelligence" | "entity";
  /** Runtime-validated. Generated from the same zod schema the model sees. */
  propsSchema: ZodTypeAny;
  /** Finding kinds / data shapes it can bind to. */
  accepts: FindingKind[];
  /** IA forms this component implements. The composer picks a form; this maps back. */
  implements: IAArea["presentation"][string]["form"][];
  variants: string[];
  sizes: ("sm" | "md" | "lg")[];
  /** Prose rule, shown in review and in the composer prompt. */
  useWhen: string;
  useInsteadWhen?: { condition: string; prefer: ComponentId }[];
  children: {
    allowed: ComponentId[] | "none";
    named?: Record<string, ComponentId[]>;
    min?: number;
    max?: number;
  };
  /** Nesting ceiling for this component specifically. */
  maxDepth?: number;
  /** Ported from select.ts. Consulted by the IA composer, never by the model. */
  fit?: (finding: Finding, context: { count: number; siblings: number }) => number;
};

export type ComponentRegistry = Record<ComponentId, ComponentSpec>;
```

### 5.8 ViewDefinition — layer 12

```ts
export type ViewDefinition = {
  id: string;
  name: string;
  scope: IntentPlan["scope"];
  intent: IntentPlan;
  recipe: RecipeId;
  dataRequests: DataRequest[];
  /** Stable presentation preferences accumulated from conversational edits. */
  semanticConfig: {
    include: SemanticType[];
    exclude: SemanticType[];
    emphasise: SemanticType[];
    collapsed: string[];
  };
  /** The last good UISpec. Reused on refresh if it still validates. */
  layoutSpec: UISpec;
  refresh: { type: "manual" | "daily" | "weekly" | "on_open"; at?: string };
  createdAt: string;
  updatedAt: string;
};
```

### 5.9 Validation result

```ts
export type ValidationIssue = {
  code:
    | "schema" | "unknown_component" | "invalid_props" | "illegal_nesting"
    | "max_depth" | "max_components" | "unknown_data_key" | "literal_data_in_props"
    | "empty_section" | "duplicate_content" | "tabs_single_item"
    | "table_too_small" | "kpi_row_overflow" | "identical_cards"
    | "required_slot_empty" | "no_headline";
  severity: "error" | "warning";
  nodeId?: string;
  message: string;
  /** What a repair pass should try. */
  repair?: { op: PresentationOp };
};

export type ValidationResult =
  | { ok: true; warnings: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[]; repairable: boolean };
```

Caps to start with: depth ≤ 6, nodes ≤ 60, KPIs per row ≤ 4, tabs 2–5, table rows
≥ 3, identical sibling cards ≤ 3, one primary headline per view.

---

## 6. Three worked examples

### 6.1 Simple text query — "Who is the relationship manager on this account?"

Terminates at layer 1. One model call total.

```jsonc
// IntentPlan
{
  "taskType": "lookup",
  "goal": "Find out who covers the account.",
  "scope": { "kind": "account", "ids": ["acc_88213"] },
  "timeRange": { "kind": "none" },
  "needs": { "comparison": false, "chronology": false, "actions": false, "composition": false },
  "register": "factual",
  "surface": "text",
  "because": "One attribute of one account — the answer is a name.",
  "dataRequests": [
    { "key": "account.coverage", "tool": "crm.account", "args": { "id": "acc_88213" }, "required": true }
  ]
}
```

Layer 2 runs `crm.account`. Pass 1 answers in prose: *"Priya Raghunathan has covered
the account since March 2024, with Marcus Lim as the backup."* `surface: "text"`, so
the semantic pass, IA composer, recipe and validator are never invoked. No artifact,
no popup, no reveal animation.

Stages shown: **Understanding request → Gathering data**. Then the answer.

This is the case the current pipeline also gets right, but for the wrong reason — it
would answer in prose, then count the figures in that prose (2 names, 0 figures → `weight < 3`)
and conclude "reply". Here the decision is made from the shape of the *task*, before
any data is fetched, and it is auditable.

### 6.2 Portfolio review — "Give me the August portfolio review for Prashanth"

**Layer 1 — IntentPlan**

```jsonc
{
  "taskType": "portfolio_review",
  "goal": "Review how the portfolio did in August and what changed.",
  "scope": { "kind": "client", "ids": ["cl_prashanth"] },
  "timeRange": { "kind": "range", "from": "2026-08-01", "to": "2026-08-31", "label": "August" },
  "needs": { "comparison": true, "chronology": false, "actions": true, "composition": true },
  "register": "analytical",
  "surface": "view",
  "because": "A month's performance, what drove it, and what changed — several things that have to be read together.",
  "dataRequests": [
    { "key": "perf.monthly",       "tool": "portfolio.performance", "args": { "period": "1M" },  "required": true },
    { "key": "perf.benchmark",     "tool": "portfolio.benchmark",   "args": { "period": "1M" },  "required": true },
    { "key": "perf.series12m",     "tool": "portfolio.performance", "args": { "period": "12M" }, "required": false },
    { "key": "drivers.contributors","tool": "portfolio.attribution", "args": { "side": "top" },   "required": true },
    { "key": "drivers.detractors", "tool": "portfolio.attribution", "args": { "side": "bottom" },"required": true },
    { "key": "alloc.current",      "tool": "portfolio.allocation",  "args": {},                  "required": true },
    { "key": "alloc.shift",        "tool": "portfolio.allocation",  "args": { "vs": "prior" },   "required": false },
    { "key": "risk.concentration", "tool": "risk.concentration",    "args": {},                  "required": true },
    { "key": "risk.currency",      "tool": "risk.currency",         "args": {},                  "required": false },
    { "key": "context.news",       "tool": "news.holdings",         "args": { "period": "1M" },  "required": false }
  ]
}
```

**Layer 2** populates the bundle. `context.news` fails (provider timeout) and lands
in `failed[]` — the view simply has no market-context area. A failed *optional*
request is not a pipeline failure.

**Layer 3 — SemanticReport** (abridged; `findings` use the existing `Finding` union)

```jsonc
{
  "reportType": "portfolio_review",
  "title": "August Portfolio Review",
  "summary": "Strong month, but technology concentration increased materially.",
  "narrative": "The portfolio returned 2.4% in August against 1.6% for the benchmark…",
  "sections": [
    { "id": "perf", "semanticType": "performance", "question": "How did it do?",
      "importance": "primary", "dataKeys": ["perf.monthly","perf.benchmark","perf.series12m"],
      "findings": [
        { "kind": "metric", "id": "aug-return", "label": "August return", "value": "+2.4%",
          "emphasis": "primary", "subject": "Performance", "confidence": 0.95,
          "sources": ["Custody positions"], "delta": { "label": "+0.8% vs benchmark", "value": 0.8, "sentiment": "positive" } },
        { "kind": "trend", "id": "return-12m", "label": "Rolling 12-month return", "series": { "name": "Portfolio", "points": [] },
          "emphasis": "secondary", "subject": "Performance", "confidence": 0.9, "sources": ["Custody positions"] }
      ] },
    { "id": "contrib", "semanticType": "drivers", "question": "What drove it?",
      "importance": "primary", "groups": ["contributors"], "dataKeys": ["drivers.contributors"], "findings": [ /* comparison, 5 entities */ ] },
    { "id": "detract", "semanticType": "drivers", "question": "What drove it?",
      "importance": "primary", "groups": ["detractors"], "dataKeys": ["drivers.detractors"], "findings": [ /* comparison, 5 entities */ ] },
    { "id": "alloc", "semanticType": "allocation", "question": "How is it split?",
      "importance": "secondary", "dataKeys": ["alloc.current"], "findings": [ /* composition, 5 parts */ ] },
    { "id": "conc", "semanticType": "risk", "question": "What changed for the worse?",
      "importance": "primary", "dataKeys": ["risk.concentration"], "findings": [ /* flag, warn + transition 21%→29% */ ],
      "detail": [ /* narrative: how concentration is measured */ ] },
    { "id": "fx", "semanticType": "risk", "question": "What changed for the worse?",
      "importance": "supporting", "dataKeys": ["risk.currency"], "findings": [ /* composition, 4 parts */ ] },
    { "id": "shift", "semanticType": "allocation", "question": "What changed for the worse?",
      "importance": "secondary", "dataKeys": ["alloc.shift"], "findings": [ /* transition */ ] },
    { "id": "actions", "semanticType": "actions", "question": "What should happen next?",
      "importance": "secondary", "dataKeys": ["risk.concentration"], "findings": [ /* checklist, 3 items */ ] }
  ],
  "relations": [
    { "kind": "answers_same_question", "sectionIds": ["contrib","detract"] },
    { "kind": "answers_same_question", "sectionIds": ["conc","fx","shift"] }
  ]
}
```

**Layer 4 — IAPlan** (deterministic)

| Area | Sections | Arrangement | Rule fired |
|---|---|---|---|
| Performance | `perf` | single, hero metric + chart | one primary headline; 12 points > 8 → axes not sparkline |
| Performance drivers | `contrib`, `detract` | **tabs** | `answers_same_question` + 2 siblings + identical structure |
| Portfolio mix | `alloc` | single, chart | composition, 5 parts ≤ 6 → donut |
| Risk changes | `conc`, `fx`, `shift` | stack | `answers_same_question` grouping |
| What to watch | `actions` | list | 3 checklist items |

`conc.detail` → `disclosure: "collapsed"`. Note what the current pipeline would
produce from the same eight sections: eight separate string-keyed sections and ten
independent cards packed into a 12-column grid, with contributors and detractors as
two unrelated bar charts.

**Layer 5** — `taskType: "portfolio_review"` → `AnalyticalReport`.

**Layer 7 — UISpec** (abridged)

```jsonc
{
  "version": 1, "recipe": "AnalyticalReport", "title": "August Portfolio Review",
  "dataVersion": "bundle_8f21",
  "slots": [
    { "slotId": "header", "children": [
      { "id": "n1", "component": "PageHeader",
        "props": { "eyebrow": "Portfolio review", "subtitle": "Prashanth Menon · August 2026" },
        "dataKeys": { "summary": "report.summary" } } ] },

    { "slotId": "headline", "children": [
      { "id": "n2", "component": "MetricStrip", "size": "lg",
        "props": { "columns": 3 }, "dataKeys": { "items": "perf.monthly" }, "sourceSectionId": "perf" } ] },

    { "slotId": "primary_analysis", "children": [
      { "id": "n3", "component": "LineChart", "variant": "benchmarked",
        "props": { "label": "Rolling 12-month return", "compareLabel": "Benchmark" },
        "dataKeys": { "series": "perf.series12m", "compare": "perf.benchmark" }, "sourceSectionId": "perf" },
      { "id": "n4", "component": "Tabs", "props": { "label": "Performance drivers" },
        "slots": {
          "Contributors": [ { "id": "n5", "component": "RankedList", "dataKey": "drivers.contributors", "sourceSectionId": "contrib" } ],
          "Detractors":   [ { "id": "n6", "component": "RankedList", "dataKey": "drivers.detractors",  "sourceSectionId": "detract" } ]
        } } ] },

    { "slotId": "secondary_breakdown", "children": [
      { "id": "n7", "component": "Grid", "props": { "columns": 2 }, "children": [
        { "id": "n8", "component": "AllocationDonut", "props": { "label": "Asset allocation" }, "dataKey": "alloc.current", "sourceSectionId": "alloc" },
        { "id": "n9", "component": "DataTable", "props": { "label": "Currency exposure", "compact": true }, "dataKey": "risk.currency", "sourceSectionId": "fx" } ] } ] },

    { "slotId": "insights", "children": [
      { "id": "n10", "component": "Section", "props": { "heading": "Risk changes" }, "children": [
        { "id": "n11", "component": "RiskAlert", "variant": "warn", "dataKey": "risk.concentration", "sourceSectionId": "conc" },
        { "id": "n12", "component": "Disclosure", "props": { "label": "How concentration is measured" },
          "children": [ { "id": "n13", "component": "KeyValueList", "dataKey": "risk.concentration.method" } ] } ] } ] },

    { "slotId": "actions", "children": [
      { "id": "n14", "component": "WhatToWatch", "props": { "heading": "What to watch" }, "children": [
        { "id": "n15", "component": "Checklist", "dataKey": "actions.items", "sourceSectionId": "actions" } ] } ] }
  ],
  "trace": [
    { "nodeId": "n4", "because": "Contributors and detractors answer the same question and share a structure — tabs, so only one is read at a time." },
    { "nodeId": "n8", "because": "Five parts of one whole — few enough for readable segments." },
    { "nodeId": "n9", "because": "Four repeated records with the same attributes; the exact figures matter more than the shape." }
  ]
}
```

**Layer 8** — 15 nodes, depth 4, one headline, no duplicate `dataKey` bindings, all
keys present in the bundle, no numeric literals in props. `ok: true`.

Stages: **Understanding request → Gathering data → Building report → Organising
information → Preparing view**. Areas reveal in slot order, and only once a slot's
subtree has validated — so nothing reflows after it lands.

### 6.3 Comparison — "Compare the two funding options for the property purchase"

**Layer 1**

```jsonc
{
  "taskType": "comparison",
  "goal": "Decide which of the two funding routes to use for the property.",
  "scope": { "kind": "client", "ids": ["cl_prashanth"] },
  "timeRange": { "kind": "rolling", "label": "next 12 months" },
  "needs": { "comparison": true, "chronology": false, "actions": true, "composition": false, "count": 2 },
  "register": "analytical",
  "surface": "view",
  "because": "Two options weighed on the same measures, ending in a recommendation.",
  "dataRequests": [
    { "key": "need.amount",     "tool": "goals.get",        "args": { "id": "goal_property" }, "required": true },
    { "key": "opt.lombard",     "tool": "credit.quote",     "args": { "product": "lombard" },  "required": true },
    { "key": "opt.liquidate",   "tool": "portfolio.liquidation", "args": { "target": "need.amount" }, "required": true },
    { "key": "opt.tradeoffs",   "tool": "analysis.tradeoffs", "args": { "options": ["lombard","liquidate"] }, "required": true }
  ]
}
```

**Layer 3** — sections: `requirement` (semanticType `commitments`, primary),
`compare_cost` / `compare_risk` / `compare_timing` (all `comparison`, each a
2-entity `comparison` finding, joined by an `answers_same_question` relation),
`tradeoffs` (`risk`), `recommend` (`recommendations`, primary).

**Layer 4** — the interesting divergence from the portfolio case, all from the same
rule table:

- three 2-entity comparisons on different measures, same two entities → **one
  `Comparison` component in a `split` arrangement**, not three charts and not tabs.
  Tabs would hide half of a decision the reader has to make in one glance; the tabs
  rule requires "only one needs to be viewed at once", and here it doesn't hold.
- `requirement` → a single hero `Metric`, not a strip: one number, `count: 1`.
- `tradeoffs` → `InsightCard`s, because the items are independent and their content
  types differ — the brief's cards rule, and the reason this isn't a table.
- `recommend` at primary importance lands in the recipe's terminal slot rather than
  leading: `ComparisonReport` puts the recommendation last, and the recipe
  constrains position even though importance is primary. **This is the recipe
  earning its keep** — importance drives emphasis, the recipe drives position.

**Layer 5** — `ComparisonReport`.

**Layer 7 — UISpec** (abridged)

```jsonc
{
  "version": 1, "recipe": "ComparisonReport", "title": "Funding the property purchase",
  "dataVersion": "bundle_c40a",
  "slots": [
    { "slotId": "header",   "children": [ { "id": "m1", "component": "PageHeader", "props": { "eyebrow": "Comparison" } } ] },
    { "slotId": "summary",  "children": [ { "id": "m2", "component": "Metric", "size": "lg",
                                            "props": { "label": "Required", "caption": "by March" }, "dataKey": "need.amount" } ] },
    { "slotId": "side_by_side", "children": [
      { "id": "m3", "component": "Comparison", "variant": "columns",
        "props": { "entities": ["Lombard facility", "Partial liquidation"], "measures": ["Cost", "Risk", "Timing"] },
        "dataKeys": { "cost": "opt.cost", "risk": "opt.risk", "timing": "opt.timing" } } ] },
    { "slotId": "differences", "children": [
      { "id": "m4", "component": "DataTable", "props": { "label": "Line-by-line" }, "dataKey": "opt.detail" } ] },
    { "slotId": "tradeoffs", "children": [
      { "id": "m5", "component": "Grid", "props": { "columns": 2 }, "children": [
        { "id": "m6", "component": "InsightCard", "dataKey": "opt.tradeoffs.0" },
        { "id": "m7", "component": "InsightCard", "dataKey": "opt.tradeoffs.1" } ] } ] },
    { "slotId": "recommendation", "children": [
      { "id": "m8", "component": "Recommendation", "variant": "primary", "dataKey": "opt.recommendation" } ] }
  ],
  "trace": [
    { "nodeId": "m3", "because": "Two options measured three ways — shown side by side, because the decision needs all of it visible at once.", "runnersUp": ["Tabs", "DataTable"] }
  ]
}
```

**Layer 8** — 8 nodes, depth 3. One warning: `m6`/`m7` are two structurally
identical sibling cards, under the ≤3 cap. `ok: true` with a warning.

**Then a conversational edit** — *"Break the timing out into its own section."*
One `PresentationOp` against the existing spec, no model call to the analysis layer,
no data refetch, no recomposition of the other five slots:

```jsonc
{ "op": "extractMeasure", "nodeId": "m3", "measure": "timing", "into": { "slotId": "differences", "after": "m4" } }
```

`m3` re-renders with two measures, a new `Comparison` node appears in the
`differences` slot, the recommendation does not move, and the change is recorded in
the `ViewDefinition.semanticConfig` so a refresh keeps it.

---

## 7. Summary of the position

The prototype is not built on the wrong *idea* — its central decision, recorded in
`app/lab/dynamic-ui/DESIGN.md §1`, is the same one the brief asks for: the model
reports semantics, deterministic code picks the visuals. That was the right call and
it is why so much of the code survives.

What is wrong is the **granularity**. Every deterministic layer is a function of one
finding: `selectRenderer(finding)`, `RENDERER_COMPONENTS[id]({finding})`,
`packRow(blocks)`. The target's decisions are all functions of *sets* — these two
belong in tabs, these ten are a table, this belongs behind disclosure, this area
answers the same question as that one. No amount of rule-adding inside
`select.ts` reaches that, and `critique.ts` is what layering more hacks on top looks
like already: page-level intelligence, retrofitted as a repair pass over an
already-composed document, limited to the ops the reducer happened to support.

So the smallest sensible migration is not incremental. It is: **keep the leaves,
keep the ops engine, keep the two-pass split, keep the palette, and replace the
middle** — one flat `Finding[]` with a two-level `SemanticReport`, one per-finding
selector with an IA composer over sets, one grid packer with recipes plus a
declarative spec, and one coercion helper with a real validator.

Phases 1 and 2 deliver that with no model in the loop and nothing in production
touched, which is where the design review should happen.
