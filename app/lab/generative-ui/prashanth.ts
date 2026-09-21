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
    { key: "networth.series", tool: "performance.series", args: { clientId: "prashanth-ranganathan" }, required: false },
    { key: "perf.indexed", tool: "performance.series", args: { clientId: "prashanth-ranganathan", indexed: true }, required: false },
    { key: "alloc.class", tool: "portfolio.allocation", args: { clientId: "prashanth-ranganathan", by: "assetClass" }, required: true },
    { key: "holdings.positions", tool: "portfolio.holdings", args: { clientId: "prashanth-ranganathan" }, required: true },
    { key: "custody.securities", tool: "portfolio.holdings", args: { clientId: "prashanth-ranganathan", by: "custodian" }, required: false },
    { key: "private.marks", tool: "portfolio.holdings", args: { clientId: "prashanth-ranganathan", kind: "private" }, required: false },
    { key: "digital.holdings", tool: "portfolio.holdings", args: { clientId: "prashanth-ranganathan", kind: "digital" }, required: false },
    { key: "risk.concentration", tool: "performance.risk", args: { clientId: "prashanth-ranganathan" }, required: false },
    { key: "debt.facilities", tool: "liabilities.facilities", args: { clientId: "prashanth-ranganathan" }, required: true },
    { key: "liquidity.available", tool: "portfolio.summary", args: { clientId: "prashanth-ranganathan", view: "liquidity" }, required: false },
    { key: "commit.privatecredit", tool: "goals.list", args: { clientId: "prashanth-ranganathan", horizon: "short" }, required: false },
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
    "networth.series": [
      { label: "28 Jun", value: 53.25 },
      { label: "28 Jul", value: 53.99 },
      { label: "27 Aug", value: 55.43 },
    ],
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
    "custody.securities": [
      { name: "LGT Bank", value: 8.96 },
      { name: "UBS", value: 6.62 },
      { name: "Interactive Brokers", value: 5.95 },
      { name: "Goldman Sachs", value: 3.69 },
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
    "networth.series": { tool: "performance.series", asOf: PRASHANTH_AS_OF, sources: [...FAMILY_OFFICE, "Performance estimate"] },
    "perf.indexed": { tool: "performance.series", asOf: "2026-08-31T00:00:00+08:00", sources: ["Performance estimate"] },
    "alloc.class": { tool: "portfolio.allocation", asOf: PRASHANTH_AS_OF, sources: [...CUSTODY, ...FAMILY_OFFICE] },
    "holdings.positions": { tool: "portfolio.holdings", asOf: PRASHANTH_AS_OF, sources: CUSTODY },
    "custody.securities": { tool: "portfolio.holdings", asOf: PRASHANTH_AS_OF, sources: CUSTODY },
    "private.marks": { tool: "portfolio.holdings", asOf: PRASHANTH_AS_OF, sources: FAMILY_OFFICE },
    "digital.holdings": { tool: "portfolio.holdings", asOf: PRASHANTH_AS_OF, sources: ["Sygnum Custody"] },
    "risk.concentration": { tool: "performance.risk", asOf: PRASHANTH_AS_OF, sources: CUSTODY },
    "debt.facilities": { tool: "liabilities.facilities", asOf: PRASHANTH_AS_OF, sources: FAMILY_OFFICE },
    "liquidity.available": { tool: "portfolio.summary", asOf: PRASHANTH_AS_OF, sources: CUSTODY },
    "commit.privatecredit": { tool: "goals.list", asOf: "2026-08-07T00:00:00+08:00", sources: ["Quarterly review meeting note"] },
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
 * Nine sections, which the composer groups into eight areas: `s.holdings` and
 * `s.custody` ask the same question and carry sibling `groups`, so they arrive as one
 * area read one view at a time rather than as two tables of the same portfolio.
 *
 * Eight is the AnalyticalReport budget, deliberately. Designing this report is what
 * showed the recipe's old ceiling of seven could not hold a balance-sheet analysis and
 * its sources at the same time — see the note on `maxAreas` in ./recipes.ts. Sections
 * were not thinned to fit a number; the number was wrong by one for this shape.
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
  relations: [{ kind: "answers_same_question", sectionIds: ["s.holdings", "s.custody"] }],
  sections: [
    /* ------------------------------------------------------------ 1. headline */
    {
      id: "s.networth",
      semanticType: "summary",
      question: "What is the balance sheet worth?",
      importance: "primary",
      takeaway: "Up on the quarter, but the rise is a revaluation rather than a return.",
      dataKeys: ["networth.total", "networth.series"],
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
          basis: "assets less borrowing, at 27 August",
          delta: { label: "+US$2.2m since 28 June", value: 2.18, sentiment: "positive" },
        },
        {
          kind: "metric",
          id: "f.assets",
          emphasis: "secondary",
          confidence: 0.97,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Net worth",
          label: "Total assets",
          value: "US$60.1m",
          basis: "including US$12.8m in the Tara Ranganathan Living Trust",
        },
        {
          kind: "trend",
          id: "f.networth.series",
          emphasis: "secondary",
          confidence: 0.9,
          sources: [...FAMILY_OFFICE, "Performance estimate"],
          subject: "Net worth",
          label: "Net worth, US$m",
          series: {
            name: "Net worth",
            points: [
              { label: "28 Jun", value: 53.25 },
              { label: "28 Jul", value: 53.99 },
              { label: "27 Aug", value: 55.43 },
            ],
          },
        },
      ],
    },

    /* --------------------------------------------------------- 2. performance */
    {
      id: "s.performance",
      semanticType: "performance",
      question: "How is the listed portfolio performing?",
      importance: "secondary",
      takeaway: "Ahead of the benchmark, on figures that are estimated rather than recorded.",
      dataKeys: ["perf.indexed"],
      findings: [
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
        {
          kind: "comparison",
          id: "f.indexed",
          emphasis: "secondary",
          confidence: 0.72,
          sources: ["Performance estimate"],
          subject: "Performance",
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
          subject: "Performance",
          text: "The LGT mandate is the largest at US$9.0m and the quarterly review recorded it as outperforming, but the file holds no mandate-level return series, so that has not been verified against benchmark. It remains an open action.",
        },
      ],
    },

    /* ---------------------------------------------------------- 3. allocation */
    {
      id: "s.allocation",
      semanticType: "allocation",
      question: "How is the balance sheet made up?",
      importance: "secondary",
      takeaway: "Six asset classes, and the unlisted book drove most of the quarter's gain.",
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
        {
          kind: "transition",
          id: "f.privatemark",
          emphasis: "secondary",
          confidence: 0.93,
          sources: FAMILY_OFFICE,
          subject: "Private investments",
          subjectLabel: "Unlisted book",
          from: "US$1.6m",
          to: "US$2.4m",
          sentiment: "positive",
          note: "Nine positions remarked on 13 August. This revaluation, not a return, is most of the US$2.2m rise in net worth.",
        },
        {
          kind: "metric",
          id: "f.digital",
          emphasis: "secondary",
          confidence: 0.94,
          sources: ["Sygnum Custody"],
          subject: "Digital assets",
          label: "Digital assets",
          value: "US$3.5m",
          basis: "on a US$0.7m cost basis, in Sygnum custody",
        },
      ],
    },

    /* ------------------------------------------ 4 & 5. the listed book, two views */
    {
      id: "s.holdings",
      semanticType: "comparison",
      question: "Where is the listed portfolio, and what is in it?",
      importance: "secondary",
      takeaway: "Five instruments hold the entire listed book.",
      groups: ["By position"],
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
    {
      id: "s.custody",
      semanticType: "comparison",
      question: "Where is the listed portfolio, and what is in it?",
      importance: "secondary",
      takeaway: "The same five instruments at four banks — one portfolio in four places.",
      groups: ["By custodian"],
      dataKeys: ["custody.securities"],
      findings: [
        {
          kind: "comparison",
          id: "f.custody",
          emphasis: "secondary",
          confidence: 0.98,
          sources: CUSTODY,
          subject: "Custodians",
          label: "Listed securities by custodian",
          measure: "Market value",
          entities: [
            { name: "LGT Bank", value: 8.96, display: "US$9.0m" },
            { name: "UBS", value: 6.62, display: "US$6.6m" },
            { name: "Interactive Brokers", value: 5.95, display: "US$6.0m" },
            { name: "Goldman Sachs", value: 3.69, display: "US$3.7m" },
          ],
        },
        {
          kind: "narrative",
          id: "f.mirrored",
          emphasis: "secondary",
          confidence: 0.9,
          sources: CUSTODY,
          subject: "Custodians",
          text: "All four custodians hold the same five instruments in roughly the same proportions, so the four mandates are one portfolio in four places rather than four strategies. Diversification across custodians is not diversification of risk.",
        },
      ],
    },

    /* ------------------------------------------------------- 6. concentration */
    {
      id: "s.concentration",
      semanticType: "risk",
      question: "Where is the portfolio concentrated?",
      importance: "secondary",
      takeaway: "Three names dominate the listed book, and one of them is held four times over.",
      dataKeys: ["risk.concentration", "holdings.positions"],
      findings: [
        {
          kind: "flag",
          id: "f.nvda",
          emphasis: "primary",
          confidence: 0.95,
          sources: CUSTODY,
          subject: "Concentration",
          severity: "warn",
          subjectLabel: "NVIDIA, held four times over",
          detail:
            "US$3.6m and 14.2% of listed securities, split across LGT, UBS, Interactive Brokers and Goldman Sachs. No single custodian statement shows the whole position, which is why the overweight has been easy to under-read. Prashanth has raised it himself.",
        },
        {
          kind: "metric",
          id: "f.fiveinstruments",
          emphasis: "secondary",
          confidence: 0.98,
          sources: CUSTODY,
          subject: "Concentration",
          label: "Instruments in the listed book",
          value: "5",
          basis: "across US$25.2m and four custodians",
        },
        {
          kind: "narrative",
          id: "f.singlename",
          emphasis: "secondary",
          confidence: 0.92,
          sources: CUSTODY,
          subject: "Concentration",
          text: "Apple, Microsoft and NVIDIA together are US$14.3m, 57% of the listed book, and the Vanguard S&P 500 holding adds to the same three names again. On a look-through basis the single-name exposure is higher than the position list suggests.",
        },
      ],
    },

    /* --------------------------------------------------- 7. funding and debt */
    {
      id: "s.funding",
      semanticType: "liquidity",
      question: "What is borrowed, and can the September call be funded?",
      importance: "secondary",
      takeaway: "Borrowing is modest; the September call is not covered by cash alone.",
      dataKeys: ["liquidity.available", "debt.facilities", "commit.privatecredit"],
      findings: [
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
          value: "US$4.6m",
          basis: "7.7% of assets, excluding the PRTR guarantee",
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
            "The US$500k GS Private Credit Partners IV call was approved on the basis of funding from the Goldman Treasury bill position, which is US$190k. US$310k has to come from the Treasury bills at the other three custodians, which total US$1.2m, or from cash.",
        },
        {
          kind: "requirement",
          id: "f.call",
          emphasis: "secondary",
          confidence: 0.96,
          sources: ["Quarterly review meeting note"],
          subject: "Commitments",
          amount: "US$500k",
          purpose: "GS Private Credit Partners IV",
          deadline: "by 15 September 2026",
          note: "Approved. Low flexibility on the date.",
        },
        {
          kind: "metric",
          id: "f.mortgage",
          emphasis: "secondary",
          confidence: 0.97,
          sources: FAMILY_OFFICE,
          subject: "Borrowing",
          label: "Mortgage",
          value: "US$3.3m",
          basis: "41% of the Dalvey Road valuation, at 3.85%",
        },
        {
          kind: "metric",
          id: "f.margin",
          emphasis: "secondary",
          confidence: 0.97,
          sources: FAMILY_OFFICE,
          subject: "Borrowing",
          label: "Margin facility",
          value: "US$0.9m",
          basis: "3.6% of listed securities, at 5.25%",
        },
        {
          kind: "flag",
          id: "f.guarantee",
          emphasis: "secondary",
          confidence: 0.95,
          sources: FAMILY_OFFICE,
          subject: "Borrowing",
          severity: "info",
          subjectLabel: "US$2.0m guarantee outside the borrowing total",
          detail:
            "PRTR Holdings has guaranteed US$2.0m to LGT. It is not drawn and not in the US$4.6m, but it is a claim on the balance sheet and belongs in any leverage discussion.",
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
