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
 *   - **An estate, not an account.** His report is about a portfolio; hers is about a
 *     family that owns one. The value is held three ways — a discretionary trust with
 *     S$41.0m, a holding company with S$18.7m, S$8.7m in her own name — and that is an
 *     `identity` section, a semantic type his analysis never produces. It is also why the
 *     page can carry labelled facts at all: a trustee, a governing law, a vesting year are
 *     not figures, and nothing on a performance report has that shape.
 *   - **Six buildings with attributes, not six rows of a holdings table.** A property has
 *     a yield, a tenancy, a lease that ends on a date and a valuation with an age. Five
 *     measures over six names is a schedule, and the row is the argument; the same six
 *     inside a top-five table would be one large number. Three of the four leases end
 *     within eighteen months, which is a finding only this shape can state.
 *   - **No listed benchmark and no borrowing.** Prashanth's book is 42% listed with a
 *     stated +14% year to date, so his report leads with performance and carries a
 *     leverage section. Hers is 65% real estate and private assets, and there is no
 *     facility on file against any asset — so there is nothing to refinance, and the
 *     market section below is context for named buildings rather than a yardstick. Her
 *     headline figures are a total, a cash balance, a commitment total and an asset count
 *     — the same `headlineFigures` rule, four different figures, because the analysis
 *     marked different metrics primary.
 *   - **Funding, not leverage, is the pressure.** S$6.95m of capital calls and payments
 *     fall due over two years against S$11.0m of cash and a S$7.0m preferred reserve, so
 *     the page carries a liquidity section built around a gap rather than a loan.
 *   - **Valuation visibility is a finding in its own right.** A quarter of the private
 *     book is carried at marks older than nine months. On a listed portfolio that
 *     section would have nothing to say.
 *   - **A different recipe.** `reportType: "property_review"` selects `PropertyReport`
 *     (./recipes.ts), whose slot order is readout → what changed → how it is held → the
 *     property book → what it looks like now → liquidity → the market → valuations →
 *     attention → what's coming → decisions. Nothing in this file names a component or a
 *     slot; four of those eleven bands exist because of the two types above.
 *
 * Provenance of every figure, so nobody has to guess which are real:
 *
 *   REAL       Everything on the balance sheet, as at 27 August 2026: the S$68.4m total,
 *              the 28 assets and their split, the six asset-class weights, the six
 *              regional weights, the three holding entities and what each holds, the
 *              trust's own terms, the six properties with their values, yields, tenancies,
 *              lease expiries and valuation dates, the S$11.0m of cash, the S$7.0m
 *              preferred reserve the file records, the four dated commitments, the four
 *              developments since the last review and the four open decisions. All of it
 *              in SGD already — this is a SGD book, so unlike Prashanth's there is nothing
 *              to convert and no FX assumption to disclose. The three market items are
 *              published third-party data and the only content not drawn from her file.
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
 *   - The property schedule's prose columns — status, lease expiry, last valued — are
 *     carried as a comparison's `display` over a sortable `value`, because a comparison
 *     finding holds entities on a *measure* (./findings.ts) and a column of bare strings
 *     has nothing to order by. The two owner-occupied properties show "—" for yield rather
 *     than 0.0%: a building nobody pays rent on has no yield, and a zero would be a claim
 *     that it earns nothing.
 *   - The key-holdings table is gone. It said the five largest positions were half the
 *     book, which the entity split and the property schedule now say more precisely and in
 *     the places a reader would look for it. One table of the same five names in between
 *     was a third view of a question already answered twice.
 *   - No "View all 28 assets" link. The fixture holds six properties and three entities,
 *     so the control would not work; the counts are stated in the sections' own lines.
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
const TRUST = ["Trust deed and letter of wishes"];
const TENANCY = ["Tenancy agreements"];
const MARKET = ["Property market data"];

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
    { key: "estate.structure", tool: "documents.list", args: { clientId: "eleanor-whitfield", kind: "structure" }, required: true },
    { key: "estate.byentity", tool: "portfolio.allocation", args: { clientId: "eleanor-whitfield", by: "entity" }, required: true },
    { key: "property.schedule", tool: "portfolio.holdings", args: { clientId: "eleanor-whitfield", assetClass: "realEstate" }, required: true },
    { key: "market.context", tool: "news.search", args: { topics: ["sg-property", "uk-rates", "apac-offices"] }, required: false },
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
    /* Facts, not figures, which is why they are pairs rather than a chart: the reader comes
       to this block for one line of it and needs to find that line without reading the
       others. */
    "estate.structure": [
      { label: "Structure", value: "Discretionary trust and a holding company" },
      { label: "Trustee", value: "Zinc Trustees (Singapore) Pte Ltd" },
      { label: "Protector", value: "E. Whitfield, as settlor" },
      { label: "Governing law", value: "Singapore" },
      { label: "Beneficiaries", value: "Three children and one grandchild" },
      { label: "Vesting", value: "2041, or earlier at trustee discretion" },
      { label: "Letter of wishes", value: "Last updated January 2024" },
      { label: "Borrowing", value: "None — no facility on file against any asset" },
    ],
    "estate.byentity": [
      { label: "Whitfield Family Trust", value: 41.0, display: "S$41.0m" },
      { label: "Whitfield Holdings Pte Ltd", value: 18.7, display: "S$18.7m" },
      { label: "Held personally", value: 8.7, display: "S$8.7m" },
    ],
    /*
     * Six buildings, five measures each, and the two owner-occupied ones carry a zero with
     * a word for a display: a property nobody pays rent on has no yield, and `0.0%` would
     * be a claim that it earns nothing rather than that the question does not apply.
     */
    "property.schedule": [
      { name: "London Residence, Kensington", value: 8.2, yield: 0, occupancy: "Owner-occupied", lease: "—", valued: "12 Aug 2026" },
      { name: "Singapore Shophouse, Tanjong Pagar", value: 6.5, yield: 3.2, occupancy: "Let", lease: "Q2 2028", valued: "30 Jun 2026" },
      { name: "Sydney Apartment, Potts Point", value: 4.1, yield: 3.8, occupancy: "Let", lease: "Q4 2026", valued: "15 May 2026" },
      { name: "Kuala Lumpur Office Unit", value: 3.2, yield: 5.1, occupancy: "Let", lease: "Q3 2027", valued: "28 Feb 2026" },
      { name: "Tokyo Residential, Minato", value: 2.4, yield: 3.4, occupancy: "Let", lease: "Q1 2027", valued: "30 Nov 2025" },
      { name: "Provence Farmhouse", value: 1.6, yield: 0, occupancy: "Owner-occupied", lease: "—", valued: "31 Dec 2023" },
    ],
    /*
     * Three published items, and the only content on the page not drawn from her file.
     *
     * `kind` is the recorded category the renderer looks a glyph up from. `topic`, `date`,
     * `source` and `url` are the article's own attribution — a market claim that does not
     * say who published it and when is not context, it is hearsay, and the card shows all
     * four. `image` is a path under /public/market; the renderer tolerates a missing file
     * and draws the tinted plate instead, so an article with no art still reads as a card.
     * `takeaway` is the one line that matters to *this* book, which is the difference
     * between a news feed and market context: the item is external, the takeaway is hers.
     */
    "market.context": [
      {
        kind: "prices",
        topic: "Singapore residential",
        headline: "Singapore private residential prices rose 2.1% in the first half of 2026",
        impact:
          "Supports the June valuation on the Tanjong Pagar shophouse, the second largest property in the book. Its lease runs to Q2 2028, so the move is a valuation effect rather than an income one.",
        takeaway: "Tanjong Pagar valuation supported by continued strength in Singapore residential prices.",
        date: "15 Aug 2026",
        source: "The Straits Times",
        url: "#",
        image: "/market/singapore-residential.jpg",
      },
      {
        kind: "rates",
        topic: "Interest rates",
        headline: "The Bank of England held the base rate at 4.0% in August",
        impact:
          "Prime central London values have been flat for three quarters. The Kensington residence is owner-occupied and unencumbered, so this bears on what it is worth, not on what it costs to hold.",
        takeaway: "Kensington value more sensitive to market demand than to holding costs.",
        date: "3 Aug 2026",
        source: "Financial Times",
        url: "#",
        image: "/market/bank-of-england.jpg",
      },
      {
        kind: "supply",
        topic: "Office market",
        headline: "Kuala Lumpur office vacancy reached a five-year high in Q2 2026",
        impact:
          "The KL unit carries the highest yield in the book at 5.1% and the least certain renewal, in Q3 2027. A re-let at market would reduce income rather than value.",
        takeaway: "KL office income at risk if re-let at current market levels.",
        date: "28 Jul 2026",
        source: "Bloomberg",
        url: "#",
        image: "/market/kuala-lumpur-office.jpg",
      },
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
      { text: "Agree a position on the Provence farmhouse: revalue and hold, or realise", state: "todo", due: "before Q1 2027" },
      { text: "Confirm the capital call schedule with both fund managers", state: "doing" },
    ],
    "evidence.sources": [
      { name: "Bank statements", detail: "as at 27 August 2026" },
      { name: "Custody statements", detail: "as at 27 August 2026" },
      { name: "Property valuations", detail: "12 Aug 2026 to 31 Dec 2024" },
      { name: "Fund manager reports", detail: "30 Jun 2026 to 31 Dec 2024" },
      { name: "Whitfield family office records", detail: "as at 27 August 2026" },
      { name: "Trust deed and letter of wishes", detail: "deed 2009, wishes January 2024" },
      { name: "Tenancy agreements", detail: "four let properties, expiries to Q2 2028" },
      { name: "Property market data", detail: "Singapore, UK and Malaysia, to Q2 2026" },
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
    "estate.structure": { tool: "documents.list", asOf: ELEANOR_AS_OF, sources: [...TRUST, ...FAMILY_OFFICE] },
    "estate.byentity": { tool: "portfolio.allocation", asOf: ELEANOR_AS_OF, sources: [...TRUST, ...FAMILY_OFFICE, ...CUSTODY] },
    "property.schedule": { tool: "portfolio.holdings", asOf: ELEANOR_AS_OF, sources: [...VALUATIONS, ...TENANCY] },
    "market.context": { tool: "news.search", asOf: ELEANOR_AS_OF, sources: MARKET },
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

It is held three ways, and that matters more than it looks. The Whitfield Family Trust holds S$41.0m at trustee discretion, Whitfield Holdings Pte Ltd holds S$18.7m and S$8.7m is held personally. Nothing is borrowed against any of it, so there is no facility to refinance and no covenant to breach — but 60% of the value sits where the trustee decides, on the letter of wishes last updated in January 2024, so a decision to sell in order to meet a call is not hers alone to take.

The property book is S$26.0m across six buildings: the S$8.2m Kensington residence bought in August, a S$6.5m Tanjong Pagar shophouse let to Q2 2028, a S$4.1m Potts Point apartment whose lease ends in Q4 2026, a S$3.2m Kuala Lumpur office unit on 5.1% to Q3 2027, a S$2.4m Minato residential unit to Q1 2027 and the S$1.6m Provence farmhouse. Four are let and yield between 3.2% and 5.1%; Kensington and Provence are used by the family and earn nothing, which is a choice rather than a problem. Three of the four leases end within eighteen months.

By region it is 28% Singapore, 24% the United States, 18% the United Kingdom, 12% Europe outside the UK, 10% the rest of Asia and 8% elsewhere.

Liquidity is the live question. S$6.95m falls due over the next two years — S$1.0m to Asia Growth Fund IV in Q4 2026, S$2.5m to the Private Credit Fund in Q1 2027, S$1.8m as the final London property payment in Q3 2027 and an estimated S$1.65m for the family office in Q4 2027. Against S$11.0m of cash and the S$7.0m reserve on file, S$4.0m is available, which leaves S$2.95m of the commitments unfunded unless the reserve is drawn down or something is sold.

Valuation visibility is the second issue. 45% of the private book is carried at marks under three months old and 30% at three to nine months, but 25% is older than nine months and 10% of it older than eighteen — including the family business, the largest single position, at a December 2024 mark. The S$68.4m total is exactly as current as those valuations and no more.

Four decisions follow: how the 2027 calls get funded, updated valuations for the family business and the older funds, a settled position on the Provence farmhouse — revalue and hold, or realise it and close most of the gap — and confirmation of the call timing with both managers.`;

/* ========================================================================== */
/* Layer 3b — the semantic report                                             */
/* ========================================================================== */

export const ELEANOR_REPORT: SemanticReport = {
  reportType: "property_review",
  title: "Eleanor Whitfield",
  summary:
    "**A resilient estate with long-term foundations, but near-term liquidity planning is important.** Held through a trust and a holding company with nothing borrowed against any of it, the book is well spread across six properties, private assets and liquid investments. With S$11.0m of cash against S$6.95m of commitments over two years, holding the S$7.0m preferred reserve leaves S$2.95m to plan for — and a quarter of the private book is carried at marks older than nine months.",
  narrative: ELEANOR_ANSWER,
  relations: [
    /* What the portfolio is made of and where it sits are two readings of one question,
       so they share an area and are read side by side rather than one after the other. */
    { kind: "answers_same_question", sectionIds: ["s.allocation", "s.geography"] },
    /* The structure and the split of value across it: one question about ownership, asked
       twice — in words on the left, in figures on the right. */
    { kind: "answers_same_question", sectionIds: ["s.estate", "s.ownership"] },
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
    /* --------------------------------------------- 3. how the estate is held */
    {
      id: "s.estate",
      semanticType: "identity",
      question: "How is the estate held?",
      importance: "secondary",
      takeaway: "A discretionary trust and a holding company, with nothing borrowed against any of it.",
      groups: ["The structure"],
      dataKeys: ["estate.structure"],
      /*
       * One narrative, and the block beside it is bound data rather than findings.
       *
       * The attributes of a trust are facts the file records, not claims the analysis made,
       * so they belong in the bundle where a figure would. What the analysis contributes is
       * the sentence about them — that the structure is settled and the exposure is who
       * decides, not what is owed — and that is the finding.
       */
      findings: [
        {
          kind: "narrative",
          id: "f.estate",
          emphasis: "primary",
          confidence: 1,
          sources: [...TRUST, ...FAMILY_OFFICE],
          subject: "The structure",
          text: "The structure has been settled since 2009 and nothing in it has changed this year beyond the governance work in May. Two things follow from it that a single-account view would not show. Nothing is borrowed against any asset, so there is no facility to refinance and no covenant to breach — the funding question is entirely about what is liquid. And the trust holds 60% of the value at trustee discretion, so decisions about selling to meet a call are the trustee\u2019s to take, on the settlor\u2019s letter of wishes, rather than hers alone.",
        },
      ],
    },
    {
      id: "s.ownership",
      /*
       * `allocation`, though the question is an ownership one, and the reason is worth
       * writing down because it looks like a mislabel.
       *
       * A section's type does two jobs: it picks the slot, and it picks the form. The slot
       * is decided by the *group's* first section, which is `s.estate` — so this section's
       * type only decides its own form. Marked `identity` it inherited the estate's
       * `key_value` form, and the only component that implements `key_value` and accepts a
       * comparison is `DataTable`, which would have tabulated the bound rows: a Label
       * column, a Value column, and a third for the pre-formatted twin of the second. This
       * is a split of one total across three holders, which is what `allocation` means, and
       * it is also exactly what the plan asked the tool for.
       */
      semanticType: "allocation",
      question: "Who holds what?",
      importance: "secondary",
      takeaway: "Three entities, and the trust holds 60% of the value.",
      groups: ["By entity"],
      dataKeys: ["estate.byentity"],
      findings: [
        {
          kind: "comparison",
          id: "f.byentity",
          emphasis: "secondary",
          confidence: 1,
          sources: [...TRUST, ...FAMILY_OFFICE, ...CUSTODY],
          subject: "Entities",
          label: "Entity",
          measure: "Value held",
          entities: [
            /* `nature` is a classification, not a picture: the renderer looks the glyph up
               from a closed enum (../findings.ts), so the analysis says what each entity is
               and the presentation layer decides how to show it. */
            { name: "Whitfield Family Trust", value: 41.0, display: "S$41.0m", nature: "trust" },
            { name: "Whitfield Holdings Pte Ltd", value: 18.7, display: "S$18.7m", nature: "company" },
            { name: "Held personally", value: 8.7, display: "S$8.7m", nature: "individual" },
          ],
        },
      ],
    },

    /* ------------------------------------------------- 4. the property book */
    {
      id: "s.properties",
      semanticType: "comparison",
      question: "What is in the property book?",
      importance: "secondary",
      /*
       * Five measures over six names, which is what makes this a schedule rather than a
       * ranking. A property is worth something, earns something, is occupied or not, comes
       * up for renewal on a date and was last valued on another — and the argument of the
       * section is the row, not any one column. `formFor` turns two or more comparisons
       * over the same entities into a table for exactly this case.
       */
      takeaway:
        "Six properties, S$26.0m, and the two the family uses earn nothing — which is a choice, not a problem.",
      dataKeys: ["property.schedule"],
      findings: [
        {
          kind: "comparison",
          id: "f.pvalue",
          emphasis: "primary",
          confidence: 1,
          sources: VALUATIONS,
          subject: "Property",
          label: "Property",
          measure: "Value",
          entities: [
            { name: "London Residence, Kensington", value: 8.2, display: "S$8.2m" },
            { name: "Singapore Shophouse, Tanjong Pagar", value: 6.5, display: "S$6.5m" },
            { name: "Sydney Apartment, Potts Point", value: 4.1, display: "S$4.1m" },
            { name: "Kuala Lumpur Office Unit", value: 3.2, display: "S$3.2m" },
            { name: "Tokyo Residential, Minato", value: 2.4, display: "S$2.4m" },
            { name: "Provence Farmhouse", value: 1.6, display: "S$1.6m" },
          ],
        },
        {
          kind: "comparison",
          id: "f.pyield",
          emphasis: "secondary",
          confidence: 0.95,
          sources: TENANCY,
          subject: "Property",
          label: "Property",
          measure: "Net yield",
          entities: [
            { name: "London Residence, Kensington", value: 0, display: "\u2014" },
            { name: "Singapore Shophouse, Tanjong Pagar", value: 3.2, display: "3.2%" },
            { name: "Sydney Apartment, Potts Point", value: 3.8, display: "3.8%" },
            { name: "Kuala Lumpur Office Unit", value: 5.1, display: "5.1%" },
            { name: "Tokyo Residential, Minato", value: 3.4, display: "3.4%" },
            { name: "Provence Farmhouse", value: 0, display: "\u2014" },
          ],
        },
        {
          kind: "comparison",
          id: "f.poccupancy",
          emphasis: "secondary",
          confidence: 1,
          sources: TENANCY,
          subject: "Property",
          label: "Property",
          measure: "Status",
          entities: [
            { name: "London Residence, Kensington", value: 0, display: "Owner-occupied" },
            { name: "Singapore Shophouse, Tanjong Pagar", value: 1, display: "Let" },
            { name: "Sydney Apartment, Potts Point", value: 1, display: "Let" },
            { name: "Kuala Lumpur Office Unit", value: 1, display: "Let" },
            { name: "Tokyo Residential, Minato", value: 1, display: "Let" },
            { name: "Provence Farmhouse", value: 0, display: "Owner-occupied" },
          ],
        },
        {
          kind: "comparison",
          id: "f.please",
          emphasis: "secondary",
          confidence: 1,
          sources: TENANCY,
          subject: "Property",
          label: "Property",
          measure: "Lease to",
          entities: [
            { name: "London Residence, Kensington", value: 0, display: "\u2014" },
            { name: "Singapore Shophouse, Tanjong Pagar", value: 7, display: "Q2 2028" },
            { name: "Sydney Apartment, Potts Point", value: 1, display: "Q4 2026" },
            { name: "Kuala Lumpur Office Unit", value: 4, display: "Q3 2027" },
            { name: "Tokyo Residential, Minato", value: 2, display: "Q1 2027" },
            { name: "Provence Farmhouse", value: 0, display: "\u2014" },
          ],
        },
        {
          kind: "comparison",
          id: "f.pvalued",
          emphasis: "secondary",
          confidence: 1,
          sources: VALUATIONS,
          subject: "Property",
          label: "Property",
          measure: "Last valued",
          entities: [
            { name: "London Residence, Kensington", value: 1, display: "12 Aug 2026" },
            { name: "Singapore Shophouse, Tanjong Pagar", value: 2, display: "30 Jun 2026" },
            { name: "Sydney Apartment, Potts Point", value: 3, display: "15 May 2026" },
            { name: "Kuala Lumpur Office Unit", value: 6, display: "28 Feb 2026" },
            { name: "Tokyo Residential, Minato", value: 9, display: "30 Nov 2025" },
            { name: "Provence Farmhouse", value: 32, display: "31 Dec 2023" },
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

    /* ------------------------------------------- 7. the property market */
    {
      id: "s.market",
      semanticType: "market_context",
      question: "What is the market doing to these assets?",
      importance: "supporting",
      takeaway: "Three external moves, each bearing on one named property rather than on the book as a whole.",
      dataKeys: ["market.context"],
      /*
       * Supporting, and worded as effects rather than as news.
       *
       * The rows in the bundle each pair an event with the asset it bears on, which is the
       * only form market context earns a place in a report like this: a book of six
       * buildings has no benchmark, so a headline that is not attached to one of them is
       * not analysis, it is a feed. What the section adds is which way each one cuts —
       * valuation or income — because those are different problems with different answers.
       */
      findings: [
        {
          kind: "narrative",
          id: "f.market",
          emphasis: "secondary",
          confidence: 0.8,
          sources: [...MARKET, ...TENANCY],
          subject: "The property market",
          text: "Two of the three moves bear on what the properties are worth and one bears on what they earn, and the distinction matters here: a valuation effect changes the S$68.4m total, an income effect changes what has to be sold to meet a call.",
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
      dataKeys: ["commit.calendar", "valuation.freshness", "property.schedule"],
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
          id: "f.att.leases",
          emphasis: "secondary",
          confidence: 1,
          sources: [...TENANCY, ...MARKET],
          subject: "Property",
          severity: "warn",
          subjectLabel: "Three leases expire within eighteen months",
          detail:
            "Sydney in Q4 2026, Tokyo in Q1 2027 and Kuala Lumpur in Q3 2027 — S$9.7m of property and about two thirds of the rental income. **Why it matters:** the KL renewal is the least certain of the three and it falls in the same year as S$4.3m of commitments, so a vacancy and a capital call could land in the same quarter.",
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
          id: "r.provence",
          emphasis: "secondary",
          confidence: 0.8,
          sources: [...VALUATIONS, ...TRUST],
          subject: "Property",
          title: "Decide the position on the Provence farmhouse",
          rationale:
            "It is the smallest property, earns nothing, and is carried at a valuation from December 2023 — the oldest mark in the file. Either commission a current valuation and keep it as a family asset, or realise it and close most of the funding gap without touching the reserve. Both are defensible; drifting is the one option that is not, because the trustee needs the answer before the Q1 2027 call.",
          action: "Put both options to the trustee this quarter",
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
          text: "Every asset figure is recorded rather than estimated: bank and custody statements for the cash and the public positions, property valuations with their dates, tenancy agreements for the yields and lease expiries, fund manager reports for the private book, and the trust deed and family office records for the structure. This is a SGD book, so no conversion has been applied. Two figures are estimates and both are labelled where they appear — the +6% since January is anchored to the January review note rather than to a series, and the Q4 2027 family office cost is a planning number. Capital calls are not counted as liabilities, because a call exchanges cash for fund value rather than reducing the total; they appear in the calendar instead. The market items are published third-party data, dated to the second quarter, and are the only content here that is not about her own assets.",
        },
      ],
    },
  ],
  outlook: {
    text: "**A strong foundation for what's next.** With careful liquidity management and better visibility on the private valuations, the portfolio is well placed to meet the next two years of commitments without selling anything under pressure.",
    signature: "Zinc Wealth Management",
  },
};
