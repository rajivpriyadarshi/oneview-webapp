# Generative UI — how it works

An explainer for talking to other people about `/lab/generative-ui`. The full spec is
`GENERATIVE-UI-ARCHITECTURE.md`; this is the version you can say out loud.

---

## The one-sentence version

The model decides **what is true and what it means**. Code decides **what it looks
like**. Those two decisions happen in different places, on different data, and the
second one can be rejected.

## The problem we started from

The first prototype (`/lab/dynamic-ui`) asked one model call for a finished report and
drew whatever came back. That has four failure modes and no defence against any of
them:

1. **The model designs.** It picks components, headings, order and emphasis by taste.
   Ask the same question twice and you get two differently-shaped pages.
2. **Facts get restated.** The model writes `"$33.3m"` into a heading. Now there are
   two copies of a number and no way to know which one is stale.
3. **Nothing can say no.** Eight KPI cards in a row, a table with two rows, a page with
   three competing headlines — all valid output. There is no layer whose job is to
   reject a bad page.
4. **Everything needs a page.** "Who is his RM?" got a report.

The old route also concatenated the entire client book into every prompt, including the
one that was only supposed to be re-shaping an answer it had already been given. So the
shaping call could quietly re-derive figures, and nothing downstream could tell.

## The pipeline

Nine layers. Each one has one job and sees only what that job needs.

```
  query
    │
 1. Intent plan ──── model ──── "what job is this, and does it even need a page?"
    │                           sees: the question + the tool catalogue. No data.
    │
 2. Data ─────────── code ───── runs the tools it asked for → a keyed bundle
    │                           app/lab/generative-ui/tools.ts
    │
 3a. Answer ──────── model ──── the prose answer. THIS IS THE AUTHORITATIVE ANSWER.
    │                           sees: the data that came back. Nothing else.
    │
    ├── if layer 1 said "text" → stop here. No page is built.
    │
 3b. Semantic report ─ model ── what the answer MEANS, as sections and findings.
    │                           sees: the answer + the data. Never a component name.
    │
 4. Information architecture ── rules ── grouping, emphasis, disclosure, arrangement
 5. Recipe selection ────────── lookup ─ one of five page shapes
 7. UI spec ─────────────────── rules ── which approved component draws what
    │                           all three: app/lab/generative-ui/compose.ts — NO MODEL
    │
 8. Validation ───────────────── code ── structural + UX checks → render, or fall back
    │                           app/lab/generative-ui/validate.ts
    │
  page (or the answer, on its own)
```

The driver that sequences this is `app/lab/generative-ui/pipeline.ts`. Read that one
file and you can see the whole architecture.

## What each layer is and is not allowed to do

**Layer 1 — the planner.** Decides the task type, what data to fetch, and one thing
that matters more than the rest: `surface: "text" | "view"`. It has never been shown a
figure, a name or a date, so it cannot state one. It also cannot name a component —
the component vocabulary is not in its prompt.

**Layer 2 — the data.** Fifteen tools over the mock client book. It runs in the browser,
not in the API route, which is the point: the route never touches the book, it is
*handed* the values a given pass is entitled to see. A tool that fails lands in
`bundle.failed` with a reason rather than throwing.

**Layer 3a — the answer.** Prose, conclusion first, no headings, no markdown. This is
the product. Everything after it is presentation.

**Layer 3b — the semantic report.** Sections, each answering one reader-facing
question, each holding *findings* of a known kind: `metric`, `trend`, `comparison`,
`composition`, `transition`, `requirement`, `flag`, `recommendation`, `checklist`,
`narrative`. It is explicitly told: you are describing meaning, you are not choosing
layout, components, charts, colours, sizes, order or emphasis — and none of those are
available to you.

**Layers 4, 5, 7 — composition.** No model at all. Rules, in code:

- Tabs only for 2–5 sibling views of the *same* question.
- A table when there are more than ~12 repeated records; below 3, say it in a sentence.
- Charts when the shape matters more than the exact values.
- Provenance and methodology behind disclosure, collapsed.
- Contributors and detractors are two sections that answer one question, so they
  become one area headed "Performance drivers" — not two sections stacked.
- Exactly one thing on the page carries the headline.
- Five page shapes: `AnalyticalReport`, `ComparisonReport`, `TimelineReport`,
  `EntityOverview`, `ActionPlan`. Selection is a lookup on the task type, not a
  judgement, because the same question should not produce a differently-shaped page on
  a Tuesday.

**Layer 8 — the validator.** Two kinds of check. *Structural*: does every component
exist, are the props legal, is every data binding real, is the nesting allowed, is the
tree within budget. *Heuristic*: eight cards in a row, tabs with one item, a table over
two records, the same fact in three places, no headline, three headlines. Errors block
the page. Warnings do not.

## The three mechanisms that make this more than good intentions

**1. Data-key indirection.** A node in the UI spec looks like this:

```json
{ "id": "n4", "component": "Metric", "props": { "label": "Liquid assets", "showDelta": true },
  "dataKey": "pf.summary" }
```

It carries a *reference* to data and presentation flags. It does not carry the value.
The composer physically cannot alter a figure, because no figure passes through it.

**2. A figure regex, enforced both ways.** One regex — currency-with-digits, a
percentage, a decimal, a thousands-grouped number — lives in `validate.ts`. The
validator **errors** on any prop containing a figure. The composer imports the *same*
regex and refuses to write such a string in the first place. So "the composer cannot
restate a number" is mechanical, not careful.

**3. An approved registry.** 28 components, each with a strict zod props schema, the
finding kinds it accepts, its legal children, its variants and sizes. The model never
sees this file. Anything outside it is an `unknown_component` error. There is no path
by which a model emits JSX, HTML or CSS — the output vocabulary is a fixed enum.

## When things go wrong

This is the part worth stressing, because it is the part that makes the whole thing
shippable:

- **The answer always survives.** It is written before any structure exists, it is
  copied onto the spec verbatim, and there is an Answer / View toggle on every result.
  Rich UI is an enhancement, never the source of truth.
- **A page that fails validation is not shown.** You get the answer, plus the reason.
- **No API key?** A local stand-in analyst writes the plan, the answer and the report
  from the same data, and layers 2, 4, 5, 7 and 8 run identically. The badge says
  "local" instead of "live model" so nobody is guessing. This is also our cheapest test
  of the central claim: if a good page needed a good model, the composer would be
  wrong. The stand-in's reports are plain and the pages are not.
- **A section with nowhere to go is reported, not dropped silently** — it shows up in
  Inspect and in the notes.

## What the loading states are

They are the pipeline reporting itself, not an animation on a timer. Each line fills in
with what that layer actually did:

```
Reading the question · portfolio review · a view
Gathering data · pf.summary, perf.series, perf.attribution, alloc.sector, risk.open
Writing the answer · 214 words
Structuring the findings · 8 sections · 12 findings
Choosing the layout · AnalyticalReport · 7 areas
Checking it · passed
```

And because layer 1 decides text-vs-view before anything is fetched, a one-line
question never opens a panel at all. The wait stays in the chat until there is
genuinely a page coming.

## One query, end to end

**"How is Prashanth's portfolio doing?"**

1. Planner: `portfolio_review`, `surface: "view"`, five data requests.
2. Tools return five keyed values with provenance and an as-of date.
3. The answer is written — four paragraphs, figures quoted exactly as the data gave
   them.
4. The report comes back as eight sections. Two of them — contributors and detractors —
   declare the same question.
5. Recipe: `AnalyticalReport` (headline → what changed → why → risks → what to watch →
   sources).
6. Composition produces seven areas: the summary leads and takes the hero variant; the
   three portfolio figures become a `Grid` of `Metric`s; benchmark and sector weights
   sit under "what changed"; contributors and detractors become **one** area headed
   "Performance drivers", arranged as tabs; risks follow; sources go in collapsed.
7. Validation: passes, no warnings, nothing unplaced.

Same query on the local stand-in, same seven areas, same recipe. That is the result to
point at.

## The honest limits, today

- Editing by conversation ("make that a table") is designed (`ops.ts`) but not wired.
- The validator's one **repair** pass is modelled but nothing applies the ops yet, so
  today it is check-then-fall-back rather than check-repair-check.
- Views are not persisted yet, so nothing can be reopened or refreshed.
- The stand-in analyst covers five question shapes. It is a fixture with a keyword
  matcher in front of it, not an analyst.
- It lives in `/lab`. Landing it in the product means one more artifact type in the
  existing renderer.

## The line to close on

Nobody asks a model to design the page, so nobody has to trust that it designed it
well. The model is asked what is true and what it means; the rules decide how that
reads; the validator gets the last word; and the written answer is always there
underneath. That is what makes generated UI safe enough to put in front of an adviser.
