/**
 * The second pinned client — Eleanor Whitfield, and the reason there are two.
 *
 * ./prashanth.ts explains the freeze point: layers 2 and 3 are hand-authored, layers 4
 * onwards run live. This file exists to make that freeze *say something*. One fixture
 * proves the pipeline can render a good report. Two fixtures of different shapes prove
 * the report is a function of the client, which is the claim the architecture actually
 * makes and the one a demo has to be able to show.
 *
 * What differs, and why the page differs with it:
 *
 *   - **No listed benchmark and no borrowing.** Prashanth's book is 42% listed with a
 *     stated +14% year to date, so his report leads with performance and carries a
 *     leverage section. Hers is 65% real estate and private assets with no facility on
 *     file; there is no return to lead with and nothing to refinance. Her headline
 *     figures are a total, a cash balance, a commitment total and an asset count — the
 *     same `headlineFigures` rule, four different figures, because the analysis marked
 *     different metrics primary.
 *   - **Funding, not leverage, is the pressure.** S$6.95m of capital calls and payments
 *     fall due over two years against S$11.0m of cash and a S$7.0m preferred reserve, so
 *     the page carries a liquidity section built around a gap rather than a loan.
 *   - **Valuation visibility is a finding in its own right.** A quarter of the private
 *     book is carried at marks older than nine months. On a listed portfolio that
 *     section would have nothing to say.
 *   - **A different recipe.** `reportType: "property_review"` selects `PropertyReport`
 *     (./recipes.ts), whose slot order is readout → what changed → what it looks like →
 *     liquidity → valuations → attention → what's coming → decisions. Nothing in this
 *     file names a component or a slot.
 *
 * Provenance of every figure, so nobody has to guess which are real:
 *
 *   REAL       Everything on the balance sheet, as at 27 August 2026: the S$68.4m total,
 *              the 28 assets and their split, the six asset-class weights, the six
 *              regional weights, the five largest positions with their values, weights
 *              and valuation dates, the S$11.0m of cash, the S$7.0m preferred reserve
 *              the file records, the four dated commitments, the four developments since
 *              the last review and the four open decisions. All of it in SGD already —
 *              this is a SGD book, so unlike Prashanth's there is nothing to convert and
 *              no FX assumption to disclose.
 *   DERIVED    Totals and shares, and nothing else: S$6.95m is the four commitments
 *              added up, S$4.0m is cash less the reserve, S$2.95m is the commitments
 *              less that, 16% is cash over the total, and the four freshness buckets are
 *              the private positions grouped by the age of their marks.
 *   ESTIMATED  Two things, both labelled as such on the page. The +6% since January is
 *              anchored to the January review note rather than to a series — the file
 *              holds one valuation per asset and no history. And the S$1.65m family
 *              office setup cost in Q4 2027 is a planning number, recorded in the file
 *              as an estimate and marked `confidence: "medium"` in the calendar.
 *
 * Where this deviates from the reference layout, and why:
 *
 *   - The reference's six allocation percentages sum to 108 and its four commitments sum
 *     to S$6.3m against a S$6.95m total stated three times. A donut that is not a whole
 *     and a ledger whose rows do not make its total are not stylistic choices, so the
 *     two smallest weights and the estimated setup cost are reconciled here. Every
 *     figure that appears more than once now agrees with itself.
 *   - The key-holdings table drops the reference's Type and Notes columns. A comparison
 *     finding holds entities on a *measure* (./findings.ts), so a column of prose would
 *     have to be smuggled in as a fake number. The note that mattered — one position is
 *     carried at a December 2024 mark — is a column in its own right instead.
 *   - No "View all 28 assets" link. The fixture holds five positions, so the control
 *     would not work; the count is stated in the section's own line instead.
 */

import type { DataBundle } from "./data";
import type { IntentPlan } from "./intent";
import type { SemanticReport } from "./semantic";

/** As at, and stated on the page. Every valuation age below is measured from this. */
export const ELEANOR_AS_OF = "2026-08-27T00:00:00+08:00";

const CUSTODY = ["Custody statements", "Bank statements"];
const FAMILY_OFFICE = ["Whitfield family office records"];
const VALUATIONS = ["Property valuations"];
const FUNDS = ["Fund manager reports"];

/* ========================================================================== */
/* Layer 1 — the plan                                                         */
/* ========================================================================== */

export const ELEANOR_PLAN: IntentPlan = {
  taskType: "property_review",
  goal: "Review Eleanor Whitfield's portfolio, her liquidity and the commitments ahead of her.",
  scope: { kind: "client", ids: ["eleanor-whitfield"] },
  timeRange: { kind: "point", to: "2026-08-27", label: "As of 27 Aug 2026" },
  needs: {
    comparison: true,
    /*
     * False, and deliberately, even though there is a two-year funding calendar.
     *
     * `chronology` means order in time is the argument — it routes to TimelineReport,
     * which opens on the schedule. The question here is what the portfolio is and what
     * it owes; the calendar is two sections of the answer, not the answer. Setting the
     * flag because dates appear somewhere would give every review a timeline for a page.
     */
    chronology: false,
    actions: true,
    composition: true,
  },
  register: "analytical",
  surface: "view",
  because: "Twenty-eight assets, six regions and four dated commitments do not read as a paragraph.",
  dataRequests: [
    { key: "portfolio.total", tool: "portfolio.summary", args: { clientId: "eleanor-whitfield" }, required: true },
    { key: "activity.recent", tool: "meetings.recent", args: { clientId: "eleanor-whitfield", since: "2026-05-01" }, required: false },
    { key: "alloc.class", tool: "portfolio.allocation", args: { clientId: "eleanor-whitfield", by: "assetClass" }, required: true },
    { key: "geo.exposure", tool: "portfolio.allocation", args: { clientId: "eleanor-whitfield", by: "region" }, required: false },
    { key: "holdings.key", tool: "portfolio.holdings", args: { clientId: "eleanor-whitfield", limit: 5 }, required: true },
    { key: "liquidity.position", tool: "portfolio.summary", args: { clientId: "eleanor-whitfield", view: "liquidity" }, required: true },
    { key: "commit.calendar", tool: "goals.list", args: { clientId: "eleanor-whitfield", horizon: "medium" }, required: true },
    { key: "valuation.freshness", tool: "documents.list", args: { clientId: "eleanor-whitfield", kind: "valuation" }, required: false },
    { key: "actions.open", tool: "meetings.recent", args: { clientId: "eleanor-whitfield" }, required: false },
    { key: "evidence.sources", tool: "documents.list", args: { clientId: "eleanor-whitfield" }, required: false },
  ],
};

/* ========================================================================== */
/* Layer 2 — the bundle                                                       */
/* ========================================================================== */

export const ELEANOR_BUNDLE: DataBundle = {
  values: {
    "portfolio.total": {
      label: "Total portfolio value",
      value: "S$68.4m",
      delta: { label: "+6% since Jan 2026", value: 6 },
    },
    /* Four developments, newest first, each with the kind of event it was — the mark on
       the rail is read from this field and never inferred from the words. */
    "activity.recent": [
      {
        date: "Aug 2026",
        name: "Property acquisition completed",
        detail: "Completed the purchase of a residential property in London at S$8.2m.",
        kind: "valuation",
      },
      {
        date: "Jul 2026",
        name: "New private fund commitment",
        detail: "Committed S$3.0m to Asia Growth Fund IV, of which S$1.0m is called in Q4 2026.",
        kind: "commitment",
      },
      {
        date: "Jun 2026",
        name: "Distribution received",
        detail: "S$2.5m distributed from existing private investments, held as cash.",
        kind: "valuation",
      },
      {
        date: "May 2026",
        name: "Family office structure progress",
        detail: "Entity restructuring and the governance framework updated with counsel.",
        kind: "structure",
      },
    ],
    "alloc.class": [
      { label: "Real estate", value: 0.38, display: "38%" },
      { label: "Private equity & VC", value: 0.27, display: "27%" },
      { label: "Cash & equivalents", value: 0.16, display: "16%" },
      { label: "Public equities", value: 0.1, display: "10%" },
      { label: "Fixed income", value: 0.06, display: "6%" },
      { label: "Others", value: 0.03, display: "3%" },
    ],
    "geo.exposure": [
      { label: "Singapore", value: 0.28, display: "28%" },
      { label: "United States", value: 0.24, display: "24%" },
      { label: "United Kingdom", value: 0.18, display: "18%" },
      { label: "Europe ex-UK", value: 0.12, display: "12%" },
      { label: "Asia ex-Singapore", value: 0.1, display: "10%" },
      { label: "Others", value: 0.08, display: "8%" },
    ],
    "holdings.key": [
      { name: "Family Business", type: "Private equity", value: 12.5, weight: 0.183, valued: "31 Dec 2024" },
      { name: "London Residence", type: "Real estate", value: 8.2, weight: 0.12, valued: "12 Aug 2026" },
      { name: "US Equity Portfolio", type: "Public equities", value: 6.8, weight: 0.099, valued: "27 Aug 2026" },
      { name: "Singapore Bonds", type: "Fixed income", value: 4.1, weight: 0.06, valued: "27 Aug 2026" },
      { name: "Asia Growth Fund IV", type: "Private equity", value: 3.0, weight: 0.044, valued: "30 Jun 2026" },
    ],
    "liquidity.position": [
      { label: "Cash & equivalents", value: 11.0, display: "S$11.0m" },
      { label: "Preferred reserve", value: 7.0, display: "S$7.0m" },
      { label: "Net available", value: 4.0, display: "S$4.0m" },
    ],
    "commit.calendar": [
      {
        date: "Q4 2026",
        name: "Asia Growth Fund IV",
        detail: "Capital call — S$1.0m",
        value: 1.0,
        display: "S$1.0m",
        kind: "commitment",
        confidence: "high",
      },
      {
        date: "Q1 2027",
        name: "Private Credit Fund",
        detail: "Capital call — S$2.5m",
        value: 2.5,
        display: "S$2.5m",
        kind: "commitment",
        confidence: "high",
      },
      {
        date: "Q3 2027",
        name: "London property",
        detail: "Final payment — S$1.8m",
        value: 1.8,
        display: "S$1.8m",
        kind: "commitment",
        confidence: "high",
      },
      {
        date: "Q4 2027",
        name: "Family office setup",
        detail: "Estimated cost — S$1.65m",
        value: 1.65,
        display: "S$1.65m",
        kind: "structure",
        confidence: "medium",
      },
    ],
    "valuation.freshness": [
      { label: "Current, under 3 months", value: 0.45, display: "45%" },
      { label: "3 to 9 months", value: 0.3, display: "30%" },
      { label: "9 to 18 months", value: 0.15, display: "15%" },
      { label: "Over 18 months", value: 0.1, display: "10%" },
    ],
    "actions.open": [
      { text: "Review the liquidity strategy for the 2027 calls", state: "todo", owner: "Advisory" },
      { text: "Commission updated valuations for the family business and the older fund positions", state: "todo" },
      { text: "Open refinancing discussions on the London property", state: "todo", due: "ahead of 2027" },
      { text: "Confirm the capital call schedule with both fund managers", state: "doing" },
    ],
    "evidence.sources": [
      { name: "Bank statements", detail: "as at 27 August 2026" },
      { name: "Custody statements", detail: "as at 27 August 2026" },
      { name: "Property valuations", detail: "12 Aug 2026 to 31 Dec 2024" },
      { name: "Fund manager reports", detail: "30 Jun 2026 to 31 Dec 2024" },
      { name: "Whitfield family office records", detail: "as at 27 August 2026" },
      { name: "Meeting notes", detail: "January, May, June, July and August 2026" },
      { name: "Currency", detail: "a SGD book — no conversion applied" },
      { name: "Estimated", detail: "the +6% since January, and the Q4 2027 setup cost" },
    ],
  },
  provenance: {
    "portfolio.total": { tool: "portfolio.summary", asOf: ELEANOR_AS_OF, sources: [...CUSTODY, ...FAMILY_OFFICE] },
    "activity.recent": { tool: "meetings.recent", asOf: ELEANOR_AS_OF, sources: [...FAMILY_OFFICE, "Meeting notes"] },
    "alloc.class": { tool: "portfolio.allocation", asOf: ELEANOR_AS_OF, sources: [...CUSTODY, ...FAMILY_OFFICE] },
    "geo.exposure": { tool: "portfolio.allocation", asOf: ELEANOR_AS_OF, sources: [...CUSTODY, ...FAMILY_OFFICE] },
    "holdings.key": { tool: "portfolio.holdings", asOf: ELEANOR_AS_OF, sources: [...CUSTODY, ...VALUATIONS, ...FUNDS] },
    "liquidity.position": { tool: "portfolio.summary", asOf: ELEANOR_AS_OF, sources: CUSTODY },
    "commit.calendar": { tool: "goals.list", asOf: ELEANOR_AS_OF, sources: [...FUNDS, ...FAMILY_OFFICE] },
    "valuation.freshness": { tool: "documents.list", asOf: ELEANOR_AS_OF, sources: [...VALUATIONS, ...FUNDS] },
    "actions.open": { tool: "meetings.recent", asOf: ELEANOR_AS_OF, sources: ["Meeting notes"] },
    "evidence.sources": { tool: "documents.list", asOf: ELEANOR_AS_OF, sources: FAMILY_OFFICE },
  },
  failed: [],
};

/* ========================================================================== */
/* Layer 3a — the answer, which is the fallback and the source of truth        */
/* ========================================================================== */

export const ELEANOR_ANSWER = `The portfolio is S$68.4m across 28 assets — six properties, nine private positions, eight public ones and five others — up 6% since January, and the shape of it is the thing to understand first. Real estate is 38% and private equity another 27%, so about two thirds of the value cannot be sold quickly or marked reliably. Cash and equivalents are S$11.0m, 16% of the total, and that is the only part of the book that can meet a call.

By region it is 28% Singapore, 24% the United States, 18% the United Kingdom, 12% Europe outside the UK, 10% the rest of Asia and 8% elsewhere. The five largest positions are S$34.6m between them: the S$12.5m family business stake, the S$8.2m London residence bought in August, S$6.8m of US equities, S$4.1m of Singapore bonds and the S$3.0m Asia Growth Fund IV commitment.

Liquidity is the live question. S$6.95m falls due over the next two years — S$1.0m to Asia Growth Fund IV in Q4 2026, S$2.5m to the Private Credit Fund in Q1 2027, S$1.8m as the final London property payment in Q3 2027 and an estimated S$1.65m for the family office in Q4 2027. Against S$11.0m of cash and the S$7.0m reserve on file, S$4.0m is available, which leaves S$2.95m of the commitments unfunded unless the reserve is drawn down or something is sold.

Valuation visibility is the second issue. 45% of the private book is carried at marks under three months old and 30% at three to nine months, but 25% is older than nine months and 10% of it older than eighteen — including the family business, the largest single position, at a December 2024 mark. The S$68.4m total is exactly as current as those valuations and no more.

Four decisions follow: how the 2027 calls get funded, updated valuations for the family business and the older funds, refinancing options on the London property before its 2027 maturity, and confirmation of the call timing with both managers.`;

/* ========================================================================== */
/* Layer 3b — the semantic report                                             */
/* ========================================================================== */

export const ELEANOR_REPORT: SemanticReport = {
  reportType: "property_review",
  title: "Eleanor Whitfield",
  summary:
    "**A resilient portfolio with long-term foundations, but near-term liquidity planning is important.** The book is well spread across real estate, private assets and liquid investments. With S$11.0m of cash against S$6.95m of commitments over two years, holding the S$7.0m preferred reserve leaves S$2.95m to plan for — and a quarter of the private book is carried at marks older than nine months.",
  narrative: ELEANOR_ANSWER,
  relations: [
    /* What the portfolio is made of and where it sits are two readings of one question,
       so they share an area and are read side by side rather than one after the other. */
    { kind: "answers_same_question", sectionIds: ["s.allocation", "s.geography"] },
    /* What there is to spend and what has to be spent belong in one glance: the gap is
       the difference between them, and a reader who has to scroll between the two halves
       is doing the subtraction from memory. */
    { kind: "answers_same_question", sectionIds: ["s.liquidity", "s.commitments"] },
  ],
  sections: [
    /* ------------------------------------------------------------ 1. readout */
    {
      id: "s.readout",
      semanticType: "summary",
      question: "What is the portfolio worth, and what needs planning?",
      importance: "primary",
      takeaway:
        "Strong foundations, but plan for the upcoming commitments and improve valuation visibility across the private assets.",
      dataKeys: ["portfolio.total"],
      /*
       * Four figures, all marked primary, and all of them here rather than spread across
       * the sections they belong to. `headlineFigures` (./semantic.ts) lifts the first four
       * primary metrics in document order into the strip at the top of the page, so this is
       * the one place their *order* can be stated — value, cash, commitments, count — which
       * is the order the reader needs them in. Each one is also claimed, so no section
       * below prints it a second time.
       */
      findings: [
        {
          kind: "metric",
          id: "f.total",
          emphasis: "primary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Portfolio",
          label: "Total portfolio value",
          value: "S$68.4m",
          basis: "across 28 assets in six regions",
          delta: { label: "+6% since Jan 2026", value: 6, sentiment: "positive" },
        },
        {
          kind: "metric",
          id: "f.cash",
          emphasis: "primary",
          confidence: 1,
          sources: CUSTODY,
          subject: "Portfolio",
          label: "Cash & equivalents",
          value: "S$11.0m",
          basis: "16% of the portfolio",
        },
        {
          kind: "metric",
          id: "f.commitments",
          emphasis: "primary",
          confidence: 1,
          sources: [...FUNDS, ...FAMILY_OFFICE],
          subject: "Portfolio",
          label: "Upcoming commitments",
          value: "S$6.95m",
          basis: "over the next 24 months",
        },
        {
          kind: "metric",
          id: "f.count",
          emphasis: "primary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Portfolio",
          label: "Total assets",
          value: "28",
          basis: "6 properties, 9 private, 8 public, 5 other",
        },
      ],
    },

    /* ------------------------------------------------------- 2. what changed */
    {
      id: "s.changed",
      semanticType: "activity",
      question: "What changed?",
      importance: "secondary",
      takeaway: "Four developments since the last review.",
      dataKeys: ["activity.recent"],
      findings: [
        {
          kind: "narrative",
          id: "f.since",
          emphasis: "primary",
          confidence: 0.95,
          sources: [...FAMILY_OFFICE, "Meeting notes"],
          subject: "Since the last review",
          text: "Three of the four are cash movements in one direction or the other: S$8.2m out for the London property, S$3.0m committed to a new fund, S$2.5m in from distributions. The family office work is the only item that changes how the assets are held rather than what they are.",
        },
      ],
    },

    /* --------------------------------------------- 3. what it looks like now */
    {
      id: "s.allocation",
      semanticType: "allocation",
      question: "What does the portfolio look like now?",
      importance: "secondary",
      takeaway:
        "Two thirds of the value is in real estate and private assets; the S$11.0m of cash is the part that can move.",
      groups: ["Asset allocation"],
      dataKeys: ["alloc.class"],
      findings: [
        {
          kind: "composition",
          id: "f.alloc",
          emphasis: "secondary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Allocation",
          label: "By asset class",
          parts: [
            { label: "Real estate", value: 0.38 },
            { label: "Private equity & VC", value: 0.27 },
            { label: "Cash & equivalents", value: 0.16 },
            { label: "Public equities", value: 0.1 },
            { label: "Fixed income", value: 0.06 },
            { label: "Others", value: 0.03 },
          ],
        },
      ],
    },
    {
      id: "s.geography",
      semanticType: "allocation",
      question: "Where in the world is it?",
      importance: "secondary",
      takeaway: "Six regions, and no single one is more than 28%.",
      groups: ["Geographic exposure"],
      dataKeys: ["geo.exposure"],
      /*
       * Written as a comparison on one measure rather than as a composition, and the
       * difference is not cosmetic: a composition of six parts resolves to a donut, and
       * the page already has one directly beside this. Six regions ranked on their share
       * is what the analysis is actually saying here — the order is the point — and bars
       * keep the full region names where a donut's segments could not.
       */
      findings: [
        {
          kind: "comparison",
          id: "f.geo",
          emphasis: "secondary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Regions",
          label: "Region",
          measure: "Share of portfolio",
          entities: [
            { name: "Singapore", value: 28, display: "28%" },
            { name: "United States", value: 24, display: "24%" },
            { name: "United Kingdom", value: 18, display: "18%" },
            { name: "Europe ex-UK", value: 12, display: "12%" },
            { name: "Asia ex-Singapore", value: 10, display: "10%" },
            { name: "Others", value: 8, display: "8%" },
          ],
        },
      ],
    },
    {
      id: "s.holdings",
      semanticType: "comparison",
      question: "What are the largest positions?",
      importance: "secondary",
      takeaway: "The five largest of 28 assets are S$34.6m between them, half the portfolio.",
      groups: ["Key holdings"],
      dataKeys: ["holdings.key"],
      findings: [
        {
          kind: "comparison",
          id: "f.hvalue",
          emphasis: "secondary",
          confidence: 1,
          sources: [...CUSTODY, ...VALUATIONS, ...FUNDS],
          subject: "Key holdings",
          label: "Asset",
          measure: "Value",
          entities: [
            { name: "Family Business", value: 12.5, display: "S$12.5m" },
            { name: "London Residence", value: 8.2, display: "S$8.2m" },
            { name: "US Equity Portfolio", value: 6.8, display: "S$6.8m" },
            { name: "Singapore Bonds", value: 4.1, display: "S$4.1m" },
            { name: "Asia Growth Fund IV", value: 3.0, display: "S$3.0m" },
          ],
        },
        {
          kind: "comparison",
          id: "f.hweight",
          emphasis: "secondary",
          confidence: 1,
          sources: [...CUSTODY, ...VALUATIONS, ...FUNDS],
          subject: "Key holdings",
          label: "Asset",
          measure: "Weight",
          entities: [
            { name: "Family Business", value: 18.3, display: "18%" },
            { name: "London Residence", value: 12.0, display: "12%" },
            { name: "US Equity Portfolio", value: 9.9, display: "10%" },
            { name: "Singapore Bonds", value: 6.0, display: "6%" },
            { name: "Asia Growth Fund IV", value: 4.4, display: "4%" },
          ],
        },
        {
          kind: "comparison",
          id: "f.hvalued",
          emphasis: "secondary",
          confidence: 1,
          sources: [...VALUATIONS, ...FUNDS],
          subject: "Key holdings",
          label: "Asset",
          measure: "Last valued",
          entities: [
            { name: "Family Business", value: 20, display: "31 Dec 2024" },
            { name: "London Residence", value: 1, display: "12 Aug 2026" },
            { name: "US Equity Portfolio", value: 0, display: "27 Aug 2026" },
            { name: "Singapore Bonds", value: 0, display: "27 Aug 2026" },
            { name: "Asia Growth Fund IV", value: 2, display: "30 Jun 2026" },
          ],
        },
      ],
    },

    /* ------------------------------------------- 4. liquidity & commitments */
    {
      id: "s.liquidity",
      semanticType: "liquidity",
      question: "Is there enough to fund what is coming?",
      importance: "secondary",
      takeaway: "S$4.0m is available once the preferred reserve is held back, against S$6.95m due.",
      groups: ["Liquidity position"],
      dataKeys: ["liquidity.position"],
      findings: [
        {
          kind: "comparison",
          id: "f.liquidity",
          emphasis: "secondary",
          confidence: 1,
          sources: CUSTODY,
          subject: "Liquidity",
          label: "Position",
          measure: "Amount",
          entities: [
            { name: "Cash & equivalents", value: 11.0, display: "S$11.0m" },
            { name: "Preferred reserve", value: 7.0, display: "S$7.0m" },
            { name: "Net available", value: 4.0, display: "S$4.0m" },
          ],
        },
        {
          kind: "flag",
          id: "f.gap",
          emphasis: "primary",
          confidence: 1,
          sources: [...CUSTODY, ...FUNDS, ...FAMILY_OFFICE],
          subject: "Funding gap",
          severity: "critical",
          subjectLabel: "S$2.95m of the commitments is unfunded after maintaining the preferred reserve",
          detail:
            "S$11.0m of cash less the S$7.0m reserve the file records leaves S$4.0m available, against S$6.95m due by the end of 2027. **Why it matters:** the shortfall is not immediate — the first call is S$1.0m in Q4 2026 — but it cannot be met from cash alone without drawing the reserve down, so the source has to be decided while there is still time to sell into a good market.",
        },
      ],
    },
    {
      id: "s.commitments",
      semanticType: "commitments",
      question: "What has to be paid, and when?",
      importance: "secondary",
      takeaway: "Four payments across two years, S$6.95m in total.",
      groups: ["Upcoming commitments"],
      dataKeys: ["commit.calendar"],
      findings: [
        {
          kind: "requirement",
          id: "f.firstcall",
          emphasis: "secondary",
          confidence: 1,
          sources: FUNDS,
          subject: "Upcoming commitments",
          amount: "S$1.0m",
          purpose: "Asia Growth Fund IV capital call",
          deadline: "Q4 2026",
          note: "The first of the four, and the only one due inside twelve months.",
        },
      ],
    },

    /* --------------------------------------- 5. private assets & valuations */
    {
      id: "s.valuations",
      semanticType: "risk",
      question: "How current are the private valuations?",
      importance: "secondary",
      takeaway: "Three quarters of the private book is marked within nine months. The rest is the problem.",
      dataKeys: ["valuation.freshness"],
      findings: [
        {
          kind: "comparison",
          id: "f.freshness",
          emphasis: "secondary",
          confidence: 1,
          sources: [...VALUATIONS, ...FUNDS],
          subject: "Valuation freshness",
          label: "Age of mark",
          measure: "Share of private assets",
          entities: [
            { name: "Current, under 3 months", value: 45, display: "45%" },
            { name: "3 to 9 months", value: 30, display: "30%" },
            { name: "9 to 18 months", value: 15, display: "15%" },
            { name: "Over 18 months", value: 10, display: "10%" },
          ],
        },
        {
          kind: "flag",
          id: "f.stale",
          emphasis: "primary",
          confidence: 1,
          sources: [...VALUATIONS, ...FUNDS],
          subject: "Valuation freshness",
          severity: "warn",
          subjectLabel: "25% of the private assets are carried at valuations older than nine months",
          detail:
            "Ten per cent of the private book is older than eighteen months, and it includes the family business — the largest single position at S$12.5m, last marked on 31 December 2024. **Why it matters:** the S$68.4m total is exactly as current as those marks, so updated valuations for the family business and the older fund positions would change the number the whole page stands on.",
        },
      ],
    },

    /* ---------------------------------------------- 6. what needs attention */
    {
      id: "s.attention",
      semanticType: "risk",
      question: "What needs attention?",
      importance: "secondary",
      takeaway: "Three items, one of them dated.",
      dataKeys: ["commit.calendar", "valuation.freshness", "holdings.key"],
      findings: [
        {
          kind: "flag",
          id: "f.att.liquidity",
          emphasis: "primary",
          confidence: 1,
          sources: [...CUSTODY, ...FUNDS],
          subject: "Liquidity",
          severity: "critical",
          subjectLabel: "Upcoming liquidity requirements",
          detail:
            "S$6.95m of commitments will need active planning to maintain the preferred reserve. **Why it matters:** the available S$4.0m covers the first two calls and no more, so the funding source for 2027 is a decision rather than a balance.",
        },
        {
          kind: "flag",
          id: "f.att.valuation",
          emphasis: "secondary",
          confidence: 1,
          sources: [...VALUATIONS, ...FUNDS],
          subject: "Valuations",
          severity: "warn",
          subjectLabel: "Valuation visibility",
          detail:
            "A quarter of the private assets are carried at marks older than nine months, the oldest of them the family business at December 2024. **Why it matters:** it is the largest position in the book, so the uncertainty is concentrated in the same place as the value.",
        },
        {
          kind: "flag",
          id: "f.att.refinance",
          emphasis: "secondary",
          confidence: 0.9,
          sources: [...VALUATIONS, ...FAMILY_OFFICE],
          subject: "Property",
          severity: "warn",
          subjectLabel: "Property refinancing in 2027",
          detail:
            "Refinancing options for the London property should be reviewed ahead of maturity, in the same year as the S$1.8m final payment and the S$2.5m private credit call. **Why it matters:** three obligations on one asset class in one year, and the terms are set by whoever is asked first.",
        },
      ],
    },

    /* --------------------------------------------------- 7. what's coming */
    {
      id: "s.coming",
      semanticType: "commitments",
      question: "What is coming over the next two years?",
      importance: "secondary",
      takeaway: "Four dated events, and the amounts rise before they fall.",
      dataKeys: ["commit.calendar"],
      findings: [
        {
          kind: "requirement",
          id: "f.schedule",
          emphasis: "secondary",
          confidence: 0.95,
          sources: [...FUNDS, ...FAMILY_OFFICE],
          subject: "Key timeline",
          amount: "S$6.95m",
          purpose: "four commitments to Q4 2027",
          deadline: "Q4 2026 to Q4 2027",
          note: "The Q4 2027 family office cost is an estimate; the three before it are confirmed with the managers and the vendor.",
        },
      ],
    },

    /* --------------------------------------------- 8. decisions & next steps */
    {
      id: "s.recommend",
      semanticType: "recommendations",
      question: "What should be decided?",
      importance: "secondary",
      takeaway: "Four decisions, in the order they bind.",
      dataKeys: ["actions.open"],
      findings: [
        {
          kind: "recommendation",
          id: "r.liquidity",
          emphasis: "primary",
          confidence: 0.9,
          sources: [...CUSTODY, ...FUNDS],
          subject: "Liquidity",
          title: "Review the liquidity strategy",
          rationale:
            "Decide how the 2027 calls are funded while the preferred reserve is held: from distributions, from the public book, or by drawing the reserve down deliberately rather than by default.",
          action: "Model the three sources against the Q1 2027 call",
        },
        {
          kind: "recommendation",
          id: "r.valuations",
          emphasis: "primary",
          confidence: 0.95,
          sources: [...VALUATIONS, ...FUNDS],
          subject: "Valuations",
          title: "Obtain updated valuations",
          rationale:
            "Prioritise the family business and the fund positions older than nine months. A quarter of the private book, and the largest single holding, currently rests on marks the file itself flags as old.",
          action: "Commission the family business valuation first",
        },
        {
          kind: "recommendation",
          id: "r.refinance",
          emphasis: "secondary",
          confidence: 0.85,
          sources: [...VALUATIONS, ...FAMILY_OFFICE],
          subject: "Property",
          title: "Review property refinancing options",
          rationale:
            "Begin discussions with lenders ahead of the 2027 maturity, while the August valuation is current and before the final payment falls due in the same year.",
          action: "Approach two lenders this quarter",
        },
        {
          kind: "recommendation",
          id: "r.calls",
          emphasis: "secondary",
          confidence: 0.9,
          sources: FUNDS,
          subject: "Commitments",
          title: "Confirm the capital call schedule",
          rationale:
            "Coordinate with both fund managers on expected timing and amounts. The Q4 2026 and Q1 2027 dates are the managers' guidance rather than fixed obligations, and a shift in either changes what has to be liquid and when.",
          action: "Written confirmation from both managers",
        },
      ],
    },

    /* ----------------------------------------------------------- 9. evidence */
    {
      id: "s.evidence",
      semanticType: "evidence",
      question: "Where do these figures come from?",
      importance: "supporting",
      takeaway: "Balance-sheet figures are recorded; two figures are estimates and are named.",
      dataKeys: ["evidence.sources"],
      findings: [
        {
          kind: "narrative",
          id: "f.asof",
          emphasis: "supporting",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE, ...VALUATIONS, ...FUNDS],
          subject: "Sources",
          heading: "As at 27 August 2026",
          text: "Every asset figure is recorded rather than estimated: bank and custody statements for the cash and the public positions, property valuations with their dates, fund manager reports for the private book, and family office records for the structure. This is a SGD book, so no conversion has been applied. Two figures are estimates and both are labelled where they appear — the +6% since January is anchored to the January review note rather than to a series, and the Q4 2027 family office cost is a planning number. Capital calls are not counted as liabilities, because a call exchanges cash for fund value rather than reducing the total; they appear in the calendar instead.",
        },
      ],
    },
  ],
  outlook: {
    text: "**A strong foundation for what's next.** With careful liquidity management and better visibility on the private valuations, the portfolio is well placed to meet the next two years of commitments without selling anything under pressure.",
    signature: "Zinc Wealth Management",
  },
};
