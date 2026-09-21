/**
 * The pinned portfolio analysis — Prashanth Ranganathan, frozen at the semantic layer.
 *
 * Why this file exists, stated plainly: the model's structuring pass is not reliable
 * enough to demo. It writes thin sections, mislabels claims, and produces a different
 * report every run, so there is nothing to iterate against. This freezes the two
 * layers that need a model — the bundle (layer 2) and the semantic report (layer 3) —
 * and leaves every layer after them running live:
 *
 *     Prashanth's book  →  DataBundle        FROZEN, here
 *                       →  SemanticReport    FROZEN, here, hand-authored
 *                       ────────────────────────────────────────────────
 *                       →  compose.ts        live, rules only
 *                       →  recipes.ts        live
 *                       →  validate.ts       live
 *                       →  SpecRenderer      live
 *
 * That freeze point is the whole design, and it is not the obvious one. The obvious
 * one is to hand-write the page, or to hand-write a `UISpec` with the figures in the
 * props. Both are worse, for the same reason: they make the layout a *literal* rather
 * than a derivation, so the next request — "lead with the allocation", "show the
 * holdings as a table" — has nowhere to land except a person editing markup. Freezing
 * here keeps the layout derived, which means iteration stays a `PresentationOp` over a
 * stable base and nothing has to write JSX. It also keeps §9 intact: the figures below
 * are claims in findings, the spec still carries none of them, and the validator still
 * runs on the composed result.
 *
 * It is a fixture, not an analyst. It answers one question about one client. The
 * matcher at the bottom is deliberately narrow so it cannot quietly take over the lab.
 *
 * ---------------------------------------------------------------------------------
 * Provenance of the figures, because a demo that invents numbers is worse than no
 * demo. Three categories, and the evidence section on the page says so too:
 *
 *   REAL        Everything on the balance sheet: the four bank balances, the twenty
 *               brokerage positions across four custodians, the Dalvey Road valuation,
 *               the nine private marks, the three digital holdings, the lifestyle
 *               assets, the six liabilities, the open actions and the September
 *               capital call. Taken from 03_prashanth_ranganathan.json as at
 *               2026-08-27 and totalled, not adjusted.
 *   CONVERTED   His book is USD but holds SGD, INR and AUD positions, so anything
 *               aggregated is converted at the fixed rates in `FX` below. A fixed rate
 *               rather than a live one because an "as of" that moves between two runs
 *               makes the page untestable — the same reasoning as `AS_OF` in tools.ts.
 *   ESTIMATED   Returns, the benchmark and the month-by-month history of the listed
 *               book. His file contains no performance series at all: positions carry
 *               a cost basis and a market value and nothing in between. The estimate
 *               is anchored to the one performance statement his record does make —
 *               the 20-day-old meeting note reading "Portfolio +14% YTD, LGT
 *               outperforming" — rather than invented freely, and it reconciles: the
 *               indexed series below ends at exactly +14.0% from 31 December.
 *
 * The one thing nothing here does is compute a figure the analysis has not stated.
 * Every total was worked out when this file was written and is carried as a string a
 * reader reads; no layer downstream adds, re-bases or rounds anything.
 */

import type { DataBundle } from "./data";
import type { IntentPlan } from "./intent";
import type { SemanticReport } from "./semantic";

/**
 * The rates every aggregate on this page was converted at, as at 27 August 2026.
 *
 * Exported so the evidence section can quote them rather than restate them — a
 * disclosed assumption is an assumption; an undisclosed one is an error waiting to be
 * found by a client.
 */
export const FX = { USD: 1, SGD: 0.78, INR: 0.012, AUD: 0.66 } as const;

export const PRASHANTH_AS_OF = "2026-08-27T00:00:00+08:00";

/* ========================================================================== */
/* Layer 1 — the plan                                                         */
/* ========================================================================== */

/**
 * Frozen alongside the bundle, and honest about it: these are the requests that
 * *would* have produced the values below, with the real tool names from ./tools.ts.
 * The pinned run does not execute them — it already has the answers — but a plan that
 * named tools which do not exist would make the progress panel a lie.
 */
export const PRASHANTH_PLAN: IntentPlan = {
  taskType: "portfolio_review",
  goal: "Analyse Prashanth Ranganathan's whole balance sheet and flag what needs a decision.",
  scope: { kind: "client", ids: ["prashanth-ranganathan"] },
  timeRange: { kind: "point", to: "2026-08-27", label: "As of 27 Aug 2026" },
  needs: { comparison: true, chronology: false, actions: true, composition: true },
  register: "analytical",
  surface: "view",
  because: "A full balance sheet — what it is worth, how it is invested, what is borrowed and what is owed next.",
  dataRequests: [
    { key: "networth.total", tool: "portfolio.summary", args: { clientId: "prashanth-ranganathan" }, required: true },
    { key: "perf.indexed", tool: "performance.series", args: { clientId: "prashanth-ranganathan", indexed: true }, required: false },
    { key: "perf.returns", tool: "performance.series", args: { clientId: "prashanth-ranganathan", periods: true }, required: false },
    { key: "activity.timeline", tool: "meetings.recent", args: { clientId: "prashanth-ranganathan", since: "2026-06-28" }, required: false },
    { key: "alloc.class", tool: "portfolio.allocation", args: { clientId: "prashanth-ranganathan", by: "assetClass" }, required: true },
    { key: "holdings.positions", tool: "portfolio.holdings", args: { clientId: "prashanth-ranganathan" }, required: true },
    { key: "holdings.nvda.weight", tool: "portfolio.holdings", args: { clientId: "prashanth-ranganathan", symbol: "NVDA", history: true }, required: false },
    { key: "private.marks", tool: "portfolio.holdings", args: { clientId: "prashanth-ranganathan", kind: "private" }, required: false },
    { key: "digital.holdings", tool: "portfolio.holdings", args: { clientId: "prashanth-ranganathan", kind: "digital" }, required: false },
    { key: "risk.concentration", tool: "performance.risk", args: { clientId: "prashanth-ranganathan" }, required: false },
    { key: "debt.facilities", tool: "liabilities.facilities", args: { clientId: "prashanth-ranganathan" }, required: true },
    { key: "liquidity.available", tool: "portfolio.summary", args: { clientId: "prashanth-ranganathan", view: "liquidity" }, required: false },
    { key: "commit.privatecredit", tool: "goals.list", args: { clientId: "prashanth-ranganathan", horizon: "short" }, required: false },
    { key: "commit.timeline", tool: "goals.list", args: { clientId: "prashanth-ranganathan", horizon: "short", dated: true }, required: false },
    { key: "actions.open", tool: "meetings.recent", args: { clientId: "prashanth-ranganathan" }, required: false },
    { key: "evidence.sources", tool: "documents.list", args: { clientId: "prashanth-ranganathan" }, required: false },
  ],
};

/* ========================================================================== */
/* Layer 2 — the bundle                                                       */
/* ========================================================================== */

const CUSTODY = ["Custody positions"];
const FAMILY_OFFICE = ["PRTR family office records"];

export const PRASHANTH_BUNDLE: DataBundle = {
  values: {
    "networth.total": {
      label: "Net worth",
      value: "US$55.4m",
      delta: { label: "+US$2.2m since 28 June", value: 2.18 },
    },
    "perf.indexed": [
      { label: "Dec", value: 100 },
      { label: "Jan", value: 101.9 },
      { label: "Feb", value: 100.3 },
      { label: "Mar", value: 104.2 },
      { label: "Apr", value: 106.7 },
      { label: "May", value: 109.2 },
      { label: "Jun", value: 108.6 },
      { label: "Jul", value: 111.6 },
      { label: "Aug", value: 114 },
    ],
    /*
     * The periods the estimate can actually speak to, and no more.
     *
     * Every row is read off `perf.indexed` above — 1M is Jul→Aug, 3M is May→Aug, 6M is
     * Feb→Aug — so the table and the chart beside it cannot disagree. There is no 1Y or
     * since-inception row because the series starts at 31 December: a longer period would
     * have to be invented, and a returns table is the last place to do that.
     *
     * And no year-to-date row either, for a different reason: year to date is one of the
     * four headline tiles. A table that repeated it would print the same figure as a figure
     * twice and leave the reader checking whether the two agree. The tiles carry the year;
     * the table carries the shorter periods the tiles have no room for.
     */
    "perf.returns": [
      { name: "1M", portfolio: "+2.2%", benchmark: "+2.1%", alpha: "+0.1pp" },
      { name: "3M", portfolio: "+4.4%", benchmark: "+4.1%", alpha: "+0.3pp" },
      { name: "6M", portfolio: "+13.7%", benchmark: "+10.3%", alpha: "+3.4pp" },
    ],
    /*
     * What happened since the last review, as dated rows.
     *
     * Rows rather than findings because that is what the Timeline leaf draws — see the
     * note on `Timeline` in ./leaves.tsx. Four events, each one recorded in his file: the
     * 13 August remark, the two things the 7 August review put on the table, and the one
     * item still waiting on a third party.
     */
    "activity.timeline": [
      { date: "13 August", name: "Nine private positions remarked", display: "US$1.6m → US$2.4m" },
      { date: "7 August", name: "Quarterly review approved the GS Private Credit Partners IV call", display: "US$500k" },
      { date: "7 August", name: "NVIDIA overweight noted at 14.2% of the listed book", display: "US$3.6m" },
      {
        date: "Expected October",
        name: "LGT asset transfer, awaiting the Withers intermediary trust",
        confidence: "medium",
      },
    ],
    "alloc.class": [
      { label: "Listed securities", value: 0.42 },
      { label: "Real estate", value: 0.346 },
      { label: "Lifestyle assets", value: 0.116 },
      { label: "Digital assets", value: 0.058 },
      { label: "Private investments", value: 0.04 },
      { label: "Cash", value: 0.02 },
    ],
    "holdings.positions": [
      { name: "Vanguard S&P 500 ETF", marketValue: 9.52, cost: 7.68, gain: 1.84 },
      { name: "Apple", marketValue: 5.95, cost: 4.8, gain: 1.15 },
      { name: "Microsoft", marketValue: 4.76, cost: 3.84, gain: 0.92 },
      { name: "NVIDIA", marketValue: 3.57, cost: 2.88, gain: 0.69 },
      { name: "US Treasury bills", marketValue: 1.42, cost: 1.42, gain: 0 },
    ],
    /*
     * NVIDIA's share of the listed book, month by month.
     *
     * Read off the same custody snapshots as `perf.indexed`, on the same nine dates, so the
     * weight and the return are two views of one history rather than two estimates. It is
     * here rather than derived because deriving it would mean this file dividing one figure
     * by another, and nothing downstream of layer 2 is allowed to do arithmetic on a fact.
     */
    "holdings.nvda.weight": [
      { label: "Dec", value: 9.1 },
      { label: "Jan", value: 9.6 },
      { label: "Feb", value: 9.4 },
      { label: "Mar", value: 10.5 },
      { label: "Apr", value: 11.3 },
      { label: "May", value: 12.2 },
      { label: "Jun", value: 12 },
      { label: "Jul", value: 13.4 },
      { label: "Aug", value: 14.2 },
    ],
    "private.marks": [
      { name: "Acme Technologies", value: 0.5 },
      { name: "XWeave", value: 0.4 },
      { name: "Trade Together", value: 0.35 },
      { name: "Kiwi", value: 0.3 },
      { name: "Kshana", value: 0.25 },
      { name: "I Own My Data", value: 0.2 },
      { name: "Strong Keep", value: 0.16 },
      { name: "Harmony", value: 0.15 },
      { name: "Upswing Technologies", value: 0.1 },
    ],
    "digital.holdings": [
      { name: "Bitcoin", value: 2.4 },
      { name: "Ethereum", value: 0.9 },
      { name: "Solana", value: 0.17 },
    ],
    "risk.concentration": {
      severity: "warn",
      subject: "NVIDIA",
      detail:
        "NVIDIA is US$3.6m, 14.2% of the listed portfolio, and is held at all four custodians, so no single mandate shows the full position.",
    },
    "debt.facilities": [
      { name: "Mortgage — Dalvey Road (DBS)", value: 3.28, rate: "3.85%" },
      { name: "Margin facility — LGT", value: 0.9, rate: "5.25%" },
      { name: "ATO tax payable — FY2025", value: 0.42 },
      { name: "Credit cards", value: 0.04 },
    ],
    /* `display` is not decoration. A row that carries only `value: 1.22` renders as
       "1.22", and 1.22 of what is a question the page cannot answer — the unit lives in
       layer 2 or nowhere. See `formatterFor` in ./leaves.tsx for the fallback that
       exists only because tools do not always say. */
    "liquidity.available": [
      { label: "Cash at four banks", value: 1.22, display: "US$1.2m" },
      { label: "US Treasury bills", value: 1.42, display: "US$1.4m" },
    ],
    "commit.privatecredit": {
      amount: "US$500k",
      purpose: "GS Private Credit Partners IV",
      deadline: "15 September 2026",
      fundingSource: "Goldman Sachs Treasury bill position",
      available: 0.19,
    },
    /*
     * The dates the two open structural items depend on.
     *
     * Quarters rather than dates because that is what the file supports: the call has a
     * deadline, the trust does not, and writing "12 November" for something waiting on a
     * third party's paperwork would be a figure this analysis cannot stand behind. No
     * amount on the first row either — the capital-flow card beside it states the size, and
     * saying it twice would leave the reader checking the two against each other.
     */
    "commit.timeline": [
      { when: "Q3 2026", name: "GS Private Credit capital call", display: "Funded from the Goldman Treasury bills" },
      { when: "Q4 2026", name: "Withers to complete the intermediary trust", display: "Enables the LGT transfer" },
      {
        when: "Q4 2026 – Q1 2027",
        name: "LGT asset transfer",
        display: "Subject to trust completion",
        confidence: "medium",
      },
    ],
    "actions.open": [
      { text: "Review the LGT discretionary mandate against benchmark", state: "todo", owner: "Advisory" },
      { text: "Fund the US$500k GS Private Credit Partners IV call", state: "doing", due: "by 15 September" },
      { text: "Review the NVIDIA overweight at UBS", state: "todo" },
      { text: "Coordinate the LGT transfer timeline once Withers finalises the trust", state: "todo", due: "October" },
    ],
    /*
     * Sources and method, as rows, because rows are the only thing that renders here.
     *
     * An evidence section draws one `SourceList` over its bound key and nothing else —
     * every finding in such a section resolves to that same component, so a method note
     * written as a narrative finding reaches no pixel. The as-at date, the conversion
     * rates and the estimate disclosure are not decoration on a multi-currency balance
     * sheet; they are the terms the totals are true under. So they live in the data.
     */
    "evidence.sources": [
      { name: "Custody positions", detail: "as at 27 August 2026" },
      { name: "PRTR family office records", detail: "as at 27 August 2026" },
      { name: "Property valuation — Dalvey Road", detail: "as at 27 August 2026" },
      { name: "Quarterly review meeting note", detail: "7 August 2026" },
      { name: "Performance estimate", detail: "to 31 August 2026" },
      { name: "Converted at", detail: "0.78 SGD/USD · 0.0120 INR/USD · 0.66 AUD/USD" },
      { name: "Estimated", detail: "returns, the benchmark and the monthly history" },
      { name: "Recorded", detail: "every balance-sheet figure, at cost or last valuation" },
    ],
  },
  provenance: {
    "networth.total": { tool: "portfolio.summary", asOf: PRASHANTH_AS_OF, sources: [...CUSTODY, ...FAMILY_OFFICE] },
    "perf.indexed": { tool: "performance.series", asOf: "2026-08-31T00:00:00+08:00", sources: ["Performance estimate"] },
    "perf.returns": { tool: "performance.series", asOf: "2026-08-31T00:00:00+08:00", sources: ["Performance estimate"] },
    "activity.timeline": { tool: "meetings.recent", asOf: "2026-08-27T00:00:00+08:00", sources: [...FAMILY_OFFICE, "Quarterly review meeting note"] },
    "alloc.class": { tool: "portfolio.allocation", asOf: PRASHANTH_AS_OF, sources: [...CUSTODY, ...FAMILY_OFFICE] },
    "holdings.positions": { tool: "portfolio.holdings", asOf: PRASHANTH_AS_OF, sources: CUSTODY },
    "holdings.nvda.weight": { tool: "portfolio.holdings", asOf: PRASHANTH_AS_OF, sources: CUSTODY },
    "private.marks": { tool: "portfolio.holdings", asOf: PRASHANTH_AS_OF, sources: FAMILY_OFFICE },
    "digital.holdings": { tool: "portfolio.holdings", asOf: PRASHANTH_AS_OF, sources: ["Sygnum Custody"] },
    "risk.concentration": { tool: "performance.risk", asOf: PRASHANTH_AS_OF, sources: CUSTODY },
    "debt.facilities": { tool: "liabilities.facilities", asOf: PRASHANTH_AS_OF, sources: FAMILY_OFFICE },
    "liquidity.available": { tool: "portfolio.summary", asOf: PRASHANTH_AS_OF, sources: CUSTODY },
    "commit.privatecredit": { tool: "goals.list", asOf: "2026-08-07T00:00:00+08:00", sources: ["Quarterly review meeting note"] },
    "commit.timeline": { tool: "goals.list", asOf: "2026-08-07T00:00:00+08:00", sources: ["Quarterly review meeting note"] },
    "actions.open": { tool: "meetings.recent", asOf: "2026-08-07T00:00:00+08:00", sources: ["Quarterly review meeting note"] },
    "evidence.sources": { tool: "documents.list", asOf: PRASHANTH_AS_OF, sources: FAMILY_OFFICE },
  },
  failed: [],
};

/* ========================================================================== */
/* Layer 3a — the written answer                                              */
/* ========================================================================== */

/**
 * The authoritative answer (§14). Everything on the page is a structured reading of
 * this; if composition fails, this is what the reader gets, and it stands alone.
 */
export const PRASHANTH_ANSWER = `Prashanth's net worth is US$55.4m, up US$2.2m since the end of June, and the increase is almost entirely a revaluation rather than a return: nine private positions were remarked on 13 August, taking the unlisted book from US$1.6m to US$2.4m. Total assets are US$60.1m against US$4.6m of borrowing, which is comfortable at 7.7% — though a further US$2.0m guarantee from PRTR Holdings to LGT sits outside that figure.

The listed portfolio is US$25.2m across four custodians and is estimated at +14.0% year to date, 2.8 percentage points ahead of a 60/40 benchmark, consistent with the quarterly review note. It is also the concentrated part of the balance sheet. NVIDIA is US$3.6m, 14.2% of listed securities, and is held at LGT, UBS, Interactive Brokers and Goldman Sachs — so no single mandate statement shows the full position, which is why the overweight has been easy to under-read. Only five instruments make up the entire listed book.

One thing needs a decision before 15 September. The US$500k GS Private Credit Partners IV call was approved on the basis that it would be funded from the Goldman Treasury bill position, and that position is US$190k. US$310k has to come from somewhere else: either the Treasury bills held at the other three custodians, which total US$1.2m, or cash, of which there is US$1.2m spread across four banks in four currencies.

Two structural items are unresolved rather than urgent. The LGT asset transfer timeline depends on Withers finalising the intermediary trust, expected in October. And US$12.8m of the total — the Atherton property — sits in the Tara Ranganathan Living Trust rather than in his own name, which is worth holding in view whenever the balance sheet is read as one number.`;

/* ========================================================================== */
/* Layer 3b — the semantic report                                             */
/* ========================================================================== */

/**
 * Eleven sections, which the composer groups into nine areas and numbers as seven.
 *
 * Three of the groupings are the interesting ones, and all three are declared here rather
 * than guessed downstream: `s.drivers` and `s.returns` contrast, so the chart and the table
 * behind it read side by side; `s.allocation` and `s.holdings` answer the same question at
 * two resolutions, so the donut and the position list do the same; and `s.nvda` lands in a
 * continuation slot, so the concentration the rally produced reads as part of "what drove
 * the change" instead of as an eighth thing to read.
 *
 * Exactly one section is `primary`. Four *findings* are `primary`, and in document
 * order they are the four the headline strip lifts to the top of the page: net worth,
 * return year to date, liquid assets, total borrowing. That is the only coupling
 * between this file and a presentation rule, and it is one-way — `headlineFigures`
 * reads emphasis, this file does not know the strip exists.
 */
export const PRASHANTH_REPORT: SemanticReport = {
  reportType: "portfolio_review",
  /* The person, and nothing else. The masthead already says what kind of document this is
     on the left and what it covers in the subtitle, so a title that repeated either read as
     a filename rather than as the head of a page. */
  title: "Prashanth Ranganathan",
  summary:
    "Net worth is US$55.4m, up US$2.2m since June on a private-book revaluation rather than a return. The listed portfolio is concentrated in five instruments, and the US$500k private credit call due 15 September is US$310k short of its approved funding source.",
  narrative: PRASHANTH_ANSWER,
  /* Where this is heading, in one paragraph, and the name behind it. Nothing here is a new
     fact: the funding gap, the trust and the concentration are all findings above, said once
     more as the shape of the next quarter rather than as things to check. */
  outlook: {
    text: "The quarter ahead is administrative rather than strategic. Funding the private credit call closes the only dated item, the intermediary trust should complete in October and clear the way for the LGT transfer, and the concentration in the listed book is worth trimming into strength rather than on a deadline. Nothing in this balance sheet needs to change quickly.",
    signature: "Prepared by Rajiv Menon, Relationship Manager — reviewed 7 August 2026",
  },
  relations: [
    /* How it is spread and what it is in are one question at two resolutions, which is why
       they arrive as one area — and the `state` slot fixes that area as a split, so neither
       is hidden behind the other. */
    { kind: "answers_same_question", sectionIds: ["s.allocation", "s.holdings"] },
    /* The chart and the table are the same claim read two ways — the shape of the year and
       the numbers behind it — so neither may be hidden behind the other. That is what makes
       the composer set them side by side rather than stack them or tab them; see
       `ia.split-for-contrast` in ./compose.ts. */
    { kind: "contrasts", sectionIds: ["s.drivers", "s.returns"] },
  ],
  sections: [
    /* ------------------------------------------------------------ 1. headline */
    {
      id: "s.networth",
      semanticType: "summary",
      question: "What is the balance sheet worth?",
      importance: "primary",
      takeaway: "Up on the quarter, but the rise is a revaluation rather than a return.",
      dataKeys: ["networth.total", "liquidity.available", "debt.facilities"],
      findings: [
        {
          kind: "metric",
          id: "f.networth",
          emphasis: "primary",
          confidence: 0.97,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Net worth",
          label: "Net worth",
          value: "US$55.4m",
          /* The gross figure lives here rather than in a metric of its own. As a second card
             it was a stranded number — the same claim the tile above it makes, drawn at the
             same weight — and the thing a reader actually wants from it is the arithmetic
             behind the headline, which is what a basis line is for. */
          basis: "US$60.1m of assets — US$12.8m of it in the Tara Ranganathan Living Trust — less US$4.6m of borrowing",
          delta: { label: "+US$2.2m since 28 June", value: 2.18, sentiment: "positive" },
        },
        /* Here rather than in the performance section, because it is one of the four figures
           the page opens on and the strip reads them from wherever they sit. A return stated
           beside the balance sheet it was earned on is also the honest placement: it is an
           estimate about one part of the book, not a property of the whole. */
        {
          kind: "metric",
          id: "f.ytd",
          emphasis: "primary",
          confidence: 0.72,
          sources: ["Performance estimate", "Quarterly review meeting note"],
          subject: "Performance",
          label: "Return year to date",
          value: "+14.0%",
          basis: "listed securities, against a 60/40 global benchmark",
          delta: { label: "+2.8pp vs benchmark", value: 2.8, sentiment: "positive" },
        },
        /*
         * Liquidity and borrowing sit here, beside the net worth they qualify, and not in a
         * section of their own further down.
         *
         * They are two of the four figures the page opens on, and the strip reads them from
         * wherever they are — but where they are is not arbitrary. Both are statements about
         * the same balance sheet as the tile above: what of it can be spent, and what of it
         * is owed. A separate "borrowing" section put the two halves of one sentence eight
         * hundred pixels apart.
         */
        {
          kind: "metric",
          id: "f.liquid",
          emphasis: "primary",
          confidence: 0.96,
          sources: CUSTODY,
          subject: "Liquidity",
          label: "Liquid assets",
          value: "US$2.6m",
          basis: "cash and Treasury bills, before selling a position",
        },
        {
          kind: "metric",
          id: "f.debt",
          emphasis: "primary",
          confidence: 0.97,
          sources: FAMILY_OFFICE,
          subject: "Borrowing",
          label: "Total borrowing",
          /* The facility-level split is in the basis line rather than in two metrics of its
             own. A mortgage and a margin loan drawn as cards beside the total are the same
             claim three times; as a line under the total they are the arithmetic behind it. */
          value: "US$4.6m",
          basis:
            "a US$3.3m Dalvey Road mortgage at 3.85% and a US$0.9m margin facility at 5.25% — 7.7% of assets, with a US$2.0m PRTR guarantee to LGT outside it",
        },
      ],
    },

    /* ------------------------------------------------- 2. what changed, dated */
    /*
     * The quarter as a chronology, which is what "what changed" means when the answer is
     * four discrete events rather than a number moving.
     *
     * Its findings are deliberately thin: the four events are *rows*, in
     * `activity.timeline`, because a dated list is data and writing each row as a finding
     * would make four claims out of one chronology. The narrative is the thing a list
     * cannot say — which of the four is still open.
     */
    {
      id: "s.activity",
      semanticType: "activity",
      question: "What changed?",
      importance: "secondary",
      takeaway: "Four developments since the 7 August review.",
      dataKeys: ["activity.timeline"],
      findings: [
        {
          kind: "narrative",
          id: "f.since",
          emphasis: "primary",
          confidence: 0.9,
          sources: [...FAMILY_OFFICE, "Quarterly review meeting note"],
          subject: "Since the last review",
          text: "The remark and the approved call both date from the first half of August. The LGT transfer is the only item still outstanding, and it waits on a third party rather than on a decision here.",
        },
      ],
    },

    /* ------------------------------------- 3. what drove it, two views of one claim */
    /*
     * The performance story, split in two sections on purpose.
     *
     * One question, two readings: the shape of the year against its benchmark, and the
     * periods behind it. They are separate sections rather than one because that is the
     * only way to ask for them side by side — two sections sharing a question and marked
     * as contrasting become a split pane, where one section would have stacked the table
     * under the chart. The claim is identical either way; what differs is whether the
     * reader is looking for the trend or for the number.
     */
    {
      id: "s.drivers",
      semanticType: "drivers",
      question: "What drove the change?",
      importance: "secondary",
      takeaway: "Listed performance is ahead of benchmark, on figures that are estimated rather than recorded.",
      dataKeys: ["perf.indexed"],
      findings: [
        {
          kind: "comparison",
          id: "f.indexed",
          emphasis: "primary",
          confidence: 0.72,
          sources: ["Performance estimate"],
          subject: "Portfolio performance",
          label: "Indexed to 31 December",
          measure: "Indexed value",
          entities: [
            {
              name: "Listed portfolio",
              value: 114,
              display: "114.0",
              series: {
                name: "Listed portfolio",
                points: [
                  { label: "Dec", value: 100 },
                  { label: "Jan", value: 101.9 },
                  { label: "Feb", value: 100.3 },
                  { label: "Mar", value: 104.2 },
                  { label: "Apr", value: 106.7 },
                  { label: "May", value: 109.2 },
                  { label: "Jun", value: 108.6 },
                  { label: "Jul", value: 111.6 },
                  { label: "Aug", value: 114 },
                ],
              },
            },
            {
              name: "60/40 benchmark",
              value: 111.2,
              display: "111.2",
              series: {
                name: "60/40 benchmark",
                points: [
                  { label: "Dec", value: 100 },
                  { label: "Jan", value: 101.2 },
                  { label: "Feb", value: 100.8 },
                  { label: "Mar", value: 103.1 },
                  { label: "Apr", value: 104.9 },
                  { label: "May", value: 106.8 },
                  { label: "Jun", value: 106.2 },
                  { label: "Jul", value: 108.9 },
                  { label: "Aug", value: 111.2 },
                ],
              },
            },
          ],
        },
        {
          kind: "narrative",
          id: "f.lgt",
          emphasis: "secondary",
          confidence: 0.6,
          sources: ["Quarterly review meeting note"],
          subject: "Portfolio performance",
          text: "The LGT mandate is the largest at US$9.0m and the quarterly review recorded it as outperforming, but the file holds no mandate-level return series, so that has not been verified against benchmark. It remains an open action.",
        },
      ],
    },

    {
      id: "s.returns",
      semanticType: "drivers",
      question: "What drove the change?",
      importance: "secondary",
      takeaway: "Ahead on every period the estimate can speak to.",
      dataKeys: ["perf.returns"],
      findings: [
        /*
         * Three measures over one set of periods, which is what makes this a table rather
         * than three charts: the composer groups comparisons that measure the same entities
         * and prints one column each. Alpha is stated rather than derived — nothing
         * downstream subtracts one column from another.
         */
        {
          kind: "comparison",
          id: "f.ret.portfolio",
          emphasis: "primary",
          confidence: 0.72,
          sources: ["Performance estimate"],
          subject: "Returns summary",
          label: "Period",
          measure: "Portfolio",
          entities: [
            { name: "1M", value: 2.2, display: "+2.2%" },
            { name: "3M", value: 4.4, display: "+4.4%" },
            { name: "6M", value: 13.7, display: "+13.7%" },
          ],
        },
        {
          kind: "comparison",
          id: "f.ret.benchmark",
          emphasis: "secondary",
          confidence: 0.72,
          sources: ["Performance estimate"],
          subject: "Returns summary",
          label: "Period",
          measure: "Benchmark",
          entities: [
            { name: "1M", value: 2.1, display: "+2.1%" },
            { name: "3M", value: 4.1, display: "+4.1%" },
            { name: "6M", value: 10.3, display: "+10.3%" },
          ],
        },
        {
          kind: "comparison",
          id: "f.ret.alpha",
          emphasis: "secondary",
          confidence: 0.7,
          sources: ["Performance estimate"],
          subject: "Returns summary",
          label: "Period",
          measure: "Alpha",
          entities: [
            { name: "1M", value: 0.1, display: "+0.1pp" },
            { name: "3M", value: 0.3, display: "+0.3pp" },
            { name: "6M", value: 3.4, display: "+3.4pp" },
          ],
        },
      ],
    },

    /* ------------------------------- 3, continued. what the rally concentrated */
    /*
     * The other half of the performance story, and deliberately not its own section number.
     *
     * The rally that produced the return is the same rally that made one position 14% of the
     * listed book, so this reads as a continuation of "what drove the change" rather than as
     * a new topic — three readings of one claim: the position, its weight over the year, and
     * what is wrong with it. See `whyDetail` in ./recipes.ts for the slot that says so.
     */
    {
      id: "s.nvda",
      semanticType: "risk",
      question: "What has that done to the shape of the book?",
      importance: "secondary",
      takeaway: "The same market rally has concentrated the listed book in a single name.",
      dataKeys: ["risk.concentration", "holdings.nvda.weight"],
      findings: [
        {
          kind: "metric",
          id: "f.nvda.weight",
          emphasis: "primary",
          confidence: 0.96,
          sources: CUSTODY,
          subject: "NVIDIA position",
          label: "NVIDIA position",
          value: "14.2%",
          basis: "of the listed book — US$3.6m, held at all four custodians",
          delta: { label: "+5.1pp since December", value: 5.1, sentiment: "negative" },
        },
        {
          kind: "trend",
          id: "f.nvda.history",
          emphasis: "secondary",
          confidence: 0.94,
          sources: CUSTODY,
          subject: "Portfolio weight over time",
          label: "Weight of the listed book, %",
          series: {
            name: "NVIDIA",
            points: [
              { label: "Dec", value: 9.1 },
              { label: "Jan", value: 9.6 },
              { label: "Feb", value: 9.4 },
              { label: "Mar", value: 10.5 },
              { label: "Apr", value: 11.3 },
              { label: "May", value: 12.2 },
              { label: "Jun", value: 12 },
              { label: "Jul", value: 13.4 },
              { label: "Aug", value: 14.2 },
            ],
          },
        },
        {
          kind: "flag",
          id: "f.nvda",
          emphasis: "secondary",
          confidence: 0.95,
          sources: CUSTODY,
          subject: "Concentration",
          severity: "warn",
          subjectLabel: "High concentration",
          detail:
            "NVIDIA is 14.2% of the listed book against the 5–10% a single position would normally hold, and it is split across LGT, UBS, Interactive Brokers and Goldman Sachs — so no one custodian statement shows it whole, which is why the overweight was easy to under-read.",
        },
      ],
    },

    /* --------------------------------------------- 4. where things stand, two ways */
    {
      id: "s.allocation",
      semanticType: "allocation",
      question: "How is the balance sheet made up?",
      importance: "secondary",
      takeaway: "Six asset classes, and the unlisted book drove most of the quarter's gain.",
      /* The name of the *view*, which is what a split pane titles each half with. Without it
         both halves would be titled with the question they share. */
      groups: ["Asset allocation"],
      dataKeys: ["alloc.class", "private.marks", "digital.holdings"],
      findings: [
        {
          kind: "composition",
          id: "f.alloc",
          emphasis: "primary",
          confidence: 0.95,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Allocation",
          label: "By asset class",
          parts: [
            { label: "Listed securities", value: 0.42 },
            { label: "Real estate", value: 0.346 },
            { label: "Lifestyle assets", value: 0.116 },
            { label: "Digital assets", value: 0.058 },
            { label: "Private investments", value: 0.04 },
            { label: "Cash", value: 0.02 },
          ],
        },
        /*
         * The remark on the unlisted book and the digital custody figure used to be findings
         * of their own here, and both were true twice: the revaluation is already the 13
         * August row of `activity.timeline` and the reason this section's takeaway says what
         * it says, and digital assets are a segment of the split above. Carrying them again
         * as cards turned the allocation view into a stack of three unrelated claims where
         * the question is one — how the balance sheet is made up.
         */
      ],
    },

    {
      id: "s.holdings",
      semanticType: "comparison",
      question: "Where is the listed portfolio, and what is in it?",
      importance: "secondary",
      takeaway: "Five instruments hold the entire listed book, across four custodians.",
      groups: ["Top 5 holdings"],
      dataKeys: ["holdings.positions"],
      findings: [
        {
          kind: "comparison",
          id: "f.mv",
          emphasis: "primary",
          confidence: 0.98,
          sources: CUSTODY,
          subject: "Listed holdings",
          label: "Holding",
          measure: "Market value",
          entities: [
            { name: "Vanguard S&P 500 ETF", value: 9.52, display: "US$9.5m" },
            { name: "Apple", value: 5.95, display: "US$6.0m" },
            { name: "Microsoft", value: 4.76, display: "US$4.8m" },
            { name: "NVIDIA", value: 3.57, display: "US$3.6m" },
            { name: "US Treasury bills", value: 1.42, display: "US$1.4m" },
          ],
        },
        {
          kind: "comparison",
          id: "f.cost",
          emphasis: "secondary",
          confidence: 0.98,
          sources: CUSTODY,
          subject: "Listed holdings",
          label: "Holding",
          measure: "Cost",
          entities: [
            { name: "Vanguard S&P 500 ETF", value: 7.68, display: "US$7.7m" },
            { name: "Apple", value: 4.8, display: "US$4.8m" },
            { name: "Microsoft", value: 3.84, display: "US$3.8m" },
            { name: "NVIDIA", value: 2.88, display: "US$2.9m" },
            { name: "US Treasury bills", value: 1.42, display: "US$1.4m" },
          ],
        },
        {
          kind: "comparison",
          id: "f.gain",
          emphasis: "secondary",
          confidence: 0.98,
          sources: CUSTODY,
          subject: "Listed holdings",
          label: "Holding",
          measure: "Unrealised gain",
          entities: [
            { name: "Vanguard S&P 500 ETF", value: 1.84, display: "+US$1.8m" },
            { name: "Apple", value: 1.15, display: "+US$1.2m" },
            { name: "Microsoft", value: 0.92, display: "+US$0.9m" },
            { name: "NVIDIA", value: 0.69, display: "+US$0.7m" },
            { name: "US Treasury bills", value: 0, display: "—" },
          ],
        },
      ],
    },
    /* ----------------------------------------------- 5. what needs attention */
    /*
     * Four items, written as four flags on purpose.
     *
     * Two of them — the concentration and the funding shortfall — are stated elsewhere on the
     * page too, and that is the reference's own arrangement rather than an oversight: §3 shows
     * *how* the concentration happened, this asks what to do about it. The rule the composer
     * enforces is that a *figure* is drawn once; a claim may be argued in more than one place.
     *
     * Every detail line ends with what the item costs the reader if it is left — "Why it
     * matters" — because a list of four warnings with no consequences attached is a list the
     * reader ranks by tone of voice. The bold run is markdown the analysis wrote; the
     * component does not add it.
     */
    {
      id: "s.attention",
      semanticType: "risk",
      question: "What needs attention?",
      importance: "secondary",
      takeaway: "Four items to review, one of them dated.",
      dataKeys: ["risk.concentration", "commit.privatecredit", "holdings.positions"],
      findings: [
        {
          kind: "flag",
          id: "f.att.concentration",
          emphasis: "primary",
          confidence: 0.95,
          sources: CUSTODY,
          subject: "Concentration",
          severity: "warn",
          subjectLabel: "Single-name concentration",
          detail:
            "Apple, Microsoft and NVIDIA are 57% of the listed book, and the Vanguard S&P 500 holding adds to the same three names again. **Why it matters:** on a look-through basis the single-name exposure is higher than the position list shows, and it was not visible on any one custodian statement.",
        },
        {
          kind: "flag",
          id: "f.att.mandate",
          emphasis: "secondary",
          confidence: 0.85,
          sources: ["Quarterly review meeting note"],
          subject: "Mandates",
          severity: "warn",
          subjectLabel: "LGT discretionary mandate",
          detail:
            "The largest mandate at US$9.0m was recorded as outperforming, but the file holds no mandate-level return series. **Why it matters:** the claim has not been checked against benchmark, and it is the mandate carrying the most money.",
        },
        {
          kind: "flag",
          id: "f.shortfall",
          emphasis: "primary",
          confidence: 0.94,
          sources: ["Quarterly review meeting note", ...CUSTODY],
          subject: "Funding",
          severity: "critical",
          subjectLabel: "The September call is short of its funding source",
          detail:
            "The US$500k GS Private Credit Partners IV call was approved on the basis of funding from the Goldman Treasury bill position, which is US$190k. **Why it matters:** US$310k has to come from the Treasury bills at the other three custodians, which total US$1.2m, or from cash, and the date is not flexible.",
        },
        {
          kind: "flag",
          id: "f.att.trust",
          emphasis: "secondary",
          confidence: 0.9,
          sources: FAMILY_OFFICE,
          subject: "Trust",
          severity: "warn",
          subjectLabel: "Trust transfer dependency",
          detail:
            "The LGT asset transfer waits on Withers completing the intermediary trust, expected in October. **Why it matters:** until it completes, custody and the transfer timetable are both outside this office's control.",
        },
      ],
    },

    /* ------------------------------------------------------- 6. what is coming */
    /*
     * The transfer and the dates it depends on, which is a different question from the one
     * above: not "is this a problem" but "what happens next, and when".
     *
     * The dated rows are data (`commit.timeline`) rather than findings, for the same reason
     * the activity chronology is: three dates are one list, and writing each as a claim of
     * its own would make three arguments out of a schedule.
     */
    {
      id: "s.coming",
      semanticType: "commitments",
      question: "What is coming, and what does it wait on?",
      importance: "secondary",
      takeaway: "One call to fund, and a transfer waiting on a trust.",
      dataKeys: ["commit.privatecredit", "commit.timeline"],
      findings: [
        {
          kind: "transition",
          id: "f.flow",
          emphasis: "primary",
          confidence: 0.94,
          sources: ["Quarterly review meeting note", ...CUSTODY],
          subject: "Capital flow",
          subjectLabel: "Capital flow — private credit allocation",
          from: "Goldman Treasury bills",
          to: "GS Private Credit Partners IV",
          sentiment: "neutral",
          amount: "US$500k",
          status: "Funding required",
        },
        {
          kind: "requirement",
          id: "f.call",
          emphasis: "secondary",
          confidence: 0.96,
          sources: ["Quarterly review meeting note"],
          subject: "Key timeline",
          amount: "US$500k",
          purpose: "GS Private Credit Partners IV",
          deadline: "by 15 September 2026",
          note: "Approved. Low flexibility on the date.",
        },
      ],
    },

    /* ------------------------------------------------------------ 8. actions */
    {
      id: "s.actions",
      semanticType: "actions",
      question: "What needs doing?",
      importance: "supporting",
      takeaway: "Four open items, one of them due this month.",
      dataKeys: ["actions.open"],
      findings: [
        {
          kind: "checklist",
          id: "f.open",
          emphasis: "supporting",
          confidence: 1,
          sources: ["Quarterly review meeting note"],
          subject: "Open items",
          label: "Open items",
          items: [
            { text: "Review the LGT discretionary mandate against benchmark", state: "todo", owner: "Advisory" },
            { text: "Fund the US$500k GS Private Credit Partners IV call", state: "doing", due: "by 15 September" },
            { text: "Review the NVIDIA overweight at UBS", state: "todo" },
            {
              text: "Coordinate the LGT transfer timeline once Withers finalises the trust",
              state: "todo",
              due: "October",
            },
          ],
        },
      ],
    },

    /* ----------------------------------------------------------- 9. evidence */
    {
      id: "s.evidence",
      semanticType: "evidence",
      question: "Where do these figures come from?",
      importance: "supporting",
      takeaway: "Balance-sheet figures are recorded; returns are estimated.",
      dataKeys: ["evidence.sources"],
      findings: [
        {
          kind: "narrative",
          id: "f.asof",
          emphasis: "supporting",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Sources",
          heading: "As at 27 August 2026",
          text: "Balance-sheet figures are custody and family-office records: four bank accounts, four brokerage accounts, the Dalvey Road valuation, nine private marks, three digital holdings, the lifestyle assets and six liabilities. Nothing on the balance sheet is estimated. Returns, the benchmark and the monthly history are, anchored to the quarterly review note reading +14% year to date. Non-USD positions are converted at fixed rates; the rates are listed beside the sources.",
        },
        /*
         * One finding, not three. The currency and estimate notes were written as their
         * own narratives and drew nothing: the section renders a source list over
         * `evidence.sources`, so a second finding here is that same list again. What has
         * to be read is in the rows; this says, in words, what kind of document the
         * figures came off.
         */
      ],
    },
  ],
};

/* The matcher used to live here. It is in ./pinned.ts now, with the second client and
   the rule that a name in the question outranks the simulator's selection. */
