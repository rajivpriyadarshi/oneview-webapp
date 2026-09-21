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
 *   - **No listed benchmark.** Prashanth's book is 42% listed securities with a stated
 *     +14% year to date, so his report leads with performance. Eleanor holds four funds
 *     and no equity line she is measured against; there is no return to lead with, and
 *     inventing one would be inventing the analysis. Her headline figures are a net
 *     worth, a property total, an illiquid share and a cash balance — the same
 *     `headlineFigures` rule, four different figures, because the analysis marked
 *     different metrics primary.
 *   - **No borrowing at all.** His report has a leverage-and-liquidity section built
 *     around a mortgage, a margin line and a guarantee. Hers has a funding calendar
 *     built around capital calls, because that is what her balance sheet owes.
 *   - **Assets in three names.** A discretionary trust holds two funds, a holding
 *     company holds the business stake, and everything else is personal. Prashanth has
 *     one trust holding one house. Ownership is a section here and a footnote there.
 *   - **A different recipe.** `taskType: "property_review"` selects `PropertyReport`
 *     (./recipes.ts), so the page order is headline → the book → how it is held → what
 *     it needs → exposure. Nothing in this file names a component or a slot.
 *
 * Provenance of every figure, so nobody has to guess which are real:
 *
 *   REAL       Everything on the balance sheet. Three bank balances, four listed
 *              positions with cost, four properties with their valuation dates, four
 *              private funds with unfunded commitments and call dates, the 12% stake in
 *              Whitfield Manufacturing, two liabilities, five dated cash flows, the
 *              trust and holding-company asset lists, the three children, the four
 *              interactions and their action items. All of it in SGD already — the file
 *              is a SGD book, so unlike Prashanth's there is nothing to convert and no
 *              FX assumption to disclose. The one GBP account is recorded in the source
 *              as a SGD equivalent and is carried as such.
 *   DERIVED    Totals, shares, and the age of each valuation as at 15 September 2026.
 *              Arithmetic over the above, nothing more. The S$6.95m of commitments and
 *              the S$7m liquidity floor are not derived — both are stated in the file.
 *   ESTIMATED  The three-point net worth history (S$108.2m → S$110.9m → S$113.3m). The
 *              file holds one valuation per asset and no history at all, so a series
 *              cannot be recovered from it. It ends on the real figure and is labelled
 *              an estimate in the report's own evidence section. Nothing else is dummy:
 *              there are no returns here, invented or otherwise, which is itself the
 *              honest answer for this client.
 */

import type { DataBundle } from "./data";
import type { IntentPlan } from "./intent";
import type { SemanticReport } from "./semantic";

/** As at, and stated on the page. Every valuation age below is measured from this. */
export const ELEANOR_AS_OF = "2026-09-15T00:00:00+08:00";

const CUSTODY = ["UBS statement", "Bank statements"];
const FAMILY_OFFICE = ["Whitfield family office records"];
const VALUATIONS = ["Property valuations"];

/* ========================================================================== */
/* Layer 1 — the plan                                                         */
/* ========================================================================== */

export const ELEANOR_PLAN: IntentPlan = {
  taskType: "property_review",
  goal: "Review Eleanor Whitfield's balance sheet, which is mostly property and private holdings.",
  scope: { kind: "client", ids: ["eleanor-whitfield"] },
  timeRange: { kind: "point", to: "2026-09-15", label: "As of 15 Sep 2026" },
  needs: {
    comparison: true,
    /*
     * False, and deliberately, even though there is a four-month funding calendar.
     *
     * `chronology` means order in time is the argument — it routes to TimelineReport,
     * which opens on the schedule. The question here is what the balance sheet is and
     * what it is exposed to; the calendar is one section of the answer, not the answer.
     * Setting the flag because dates appear somewhere would give every property review a
     * timeline for a page.
     */
    chronology: false,
    actions: true,
    composition: true,
  },
  register: "analytical",
  surface: "view",
  because: "A balance sheet across four properties, four funds and three owners does not read as a paragraph.",
  dataRequests: [
    { key: "networth.total", tool: "portfolio.summary", args: { clientId: "eleanor-whitfield" }, required: true },
    { key: "networth.series", tool: "performance.series", args: { clientId: "eleanor-whitfield" }, required: false },
    { key: "alloc.class", tool: "portfolio.allocation", args: { clientId: "eleanor-whitfield", by: "assetClass" }, required: true },
    { key: "property.schedule", tool: "portfolio.holdings", args: { clientId: "eleanor-whitfield", kind: "realEstate" }, required: true },
    { key: "property.geography", tool: "portfolio.allocation", args: { clientId: "eleanor-whitfield", by: "country" }, required: false },
    { key: "entities.ownership", tool: "portfolio.allocation", args: { clientId: "eleanor-whitfield", by: "legalOwner" }, required: true },
    { key: "private.funds", tool: "portfolio.holdings", args: { clientId: "eleanor-whitfield", kind: "private" }, required: false },
    { key: "commit.calendar", tool: "goals.list", args: { clientId: "eleanor-whitfield", horizon: "short" }, required: true },
    { key: "liquidity.available", tool: "portfolio.summary", args: { clientId: "eleanor-whitfield", view: "liquidity" }, required: true },
    { key: "valuation.ages", tool: "documents.list", args: { clientId: "eleanor-whitfield", kind: "valuation" }, required: false },
    { key: "risk.jurisdiction", tool: "performance.risk", args: { clientId: "eleanor-whitfield", by: "jurisdiction" }, required: false },
    { key: "actions.open", tool: "meetings.recent", args: { clientId: "eleanor-whitfield" }, required: false },
    { key: "evidence.sources", tool: "documents.list", args: { clientId: "eleanor-whitfield" }, required: false },
  ],
};

/* ========================================================================== */
/* Layer 2 — the bundle                                                       */
/* ========================================================================== */

export const ELEANOR_BUNDLE: DataBundle = {
  values: {
    "networth.total": {
      label: "Net worth",
      value: "S$113.3m",
      delta: { label: "+S$2.4m since June", value: 2.4 },
    },
    "networth.series": [
      { label: "31 Mar", value: 108.2 },
      { label: "30 Jun", value: 110.9 },
      { label: "15 Sep", value: 113.3 },
    ],
    "alloc.class": [
      { label: "Real estate", value: 0.414, display: "41.4%" },
      { label: "Private investments", value: 0.186, display: "18.6%" },
      { label: "Family business", value: 0.164, display: "16.4%" },
      { label: "Listed securities", value: 0.141, display: "14.1%" },
      { label: "Cash", value: 0.095, display: "9.5%" },
    ],
    "property.schedule": [
      { name: "Singapore Residence", place: "Nassim Road, Singapore", use: "Residential", value: 16.0, display: "S$16.0m", valued: "30 Jun 2026", months: 3 },
      { name: "UK Commercial Property", place: "Manchester, United Kingdom", use: "Commercial", value: 14.0, display: "S$14.0m", valued: "1 Oct 2025", months: 11 },
      { name: "London Townhouse", place: "Kensington, London", use: "Residential", value: 12.0, display: "S$12.0m", valued: "15 Apr 2026", months: 5 },
      { name: "Provence Holiday Home", place: "Provence, France", use: "Residential", value: 6.0, display: "S$6.0m", valued: "20 May 2026", months: 4 },
    ],
    "property.geography": [
      { label: "United Kingdom", value: 0.542, display: "54.2%" },
      { label: "Singapore", value: 0.333, display: "33.3%" },
      { label: "France", value: 0.125, display: "12.5%" },
    ],
    "entities.ownership": [
      { name: "Eleanor personally", value: 86.8, display: "S$86.8m" },
      { name: "Whitfield Holdings Pte. Ltd.", value: 19.0, display: "S$19.0m" },
      { name: "Whitfield Family Trust", value: 10.2, display: "S$10.2m" },
    ],
    "private.funds": [
      { name: "Northstar PE Fund IV", value: 8.4, display: "S$8.4m", unfunded: "S$2.4m", call: "12 Oct 2026", valued: "31 Mar 2026" },
      { name: "Asia Growth Partners II", value: 5.7, display: "S$5.7m", unfunded: "S$1.1m", call: "4 Nov 2026", valued: "30 Jun 2026" },
      { name: "Meridian Infrastructure Fund", value: 4.5, display: "S$4.5m", unfunded: "S$2.5m", call: "not scheduled", valued: "30 Jun 2026" },
      { name: "Whitfield Ventures", value: 3.0, display: "S$3.0m", unfunded: "—", call: "—", valued: "31 Mar 2025" },
    ],
    "commit.calendar": [
      { name: "Northstar PE Fund IV call", value: 2.4, display: "S$2.4m", date: "12 Oct 2026", confidence: "high" },
      { name: "Asia Growth Partners II call", value: 1.1, display: "S$1.1m", date: "4 Nov 2026", confidence: "high" },
      { name: "UK property refurbishment", value: 1.8, display: "S$1.8m", date: "15 Dec 2026", confidence: "medium" },
      { name: "Annual family distributions", value: 0.75, display: "S$0.75m", date: "20 Dec 2026", confidence: "high" },
      { name: "Estimated tax payment", value: 0.9, display: "S$0.9m", date: "31 Jan 2027", confidence: "medium" },
    ],
    "liquidity.available": [
      { name: "Cash at three banks", value: 11.0, display: "S$11.0m" },
      { name: "Investment grade bonds", value: 6.8, display: "S$6.8m" },
      { name: "Short duration bonds", value: 2.3, display: "S$2.3m" },
    ],
    "valuation.ages": [
      { name: "Whitfield Ventures", value: 3.0, display: "S$3.0m", age: "17 months", flagged: "stale in source" },
      { name: "UK Commercial Property", value: 14.0, display: "S$14.0m", age: "11 months" },
      { name: "Whitfield Manufacturing Ltd. (12%)", value: 19.0, display: "S$19.0m", age: "8 months" },
    ],
    "risk.jurisdiction": [
      { label: "United Kingdom", value: 0.435, display: "43.5%" },
      { label: "Singapore", value: 0.371, display: "37.1%" },
      { label: "United States", value: 0.072, display: "7.2%" },
      { label: "France", value: 0.052, display: "5.2%" },
    ],
    "actions.open": [
      { text: "Review the revised trust documents — successor trustees and distribution powers", state: "todo", due: "received 2 September" },
      { text: "Prepare options for a family investment committee structure", state: "doing", owner: "Advisory" },
      { text: "Obtain an updated Whitfield Ventures valuation", state: "todo" },
      { text: "Decide which pocket funds the October and November calls", state: "todo", due: "by 12 October" },
      { text: "Arrange an introductory philanthropy session with Sophie", state: "todo" },
    ],
    "evidence.sources": [
      { name: "Bank statements", detail: "as at 15 September 2026" },
      { name: "UBS statement", detail: "as at 15 September 2026" },
      { name: "Property valuations", detail: "30 Jun 2026 to 1 Oct 2025" },
      { name: "Fund manager reports", detail: "31 Mar 2026 to 31 Mar 2025" },
      { name: "Whitfield family office records", detail: "as at 15 September 2026" },
      { name: "Meeting notes", detail: "18 June, 3 August, 21 August, 2 September 2026" },
      { name: "Currency", detail: "a SGD book — no conversion applied" },
      { name: "Estimated", detail: "the net worth history only; every asset figure is recorded" },
    ],
  },
  provenance: {
    "networth.total": { tool: "portfolio.summary", asOf: ELEANOR_AS_OF, sources: [...CUSTODY, ...FAMILY_OFFICE] },
    "networth.series": { tool: "performance.series", asOf: ELEANOR_AS_OF, sources: ["Estimate"] },
    "alloc.class": { tool: "portfolio.allocation", asOf: ELEANOR_AS_OF, sources: [...CUSTODY, ...FAMILY_OFFICE] },
    "property.schedule": { tool: "portfolio.holdings", asOf: "2026-06-30T00:00:00+08:00", sources: VALUATIONS },
    "property.geography": { tool: "portfolio.allocation", asOf: "2026-06-30T00:00:00+08:00", sources: VALUATIONS },
    "entities.ownership": { tool: "portfolio.allocation", asOf: ELEANOR_AS_OF, sources: FAMILY_OFFICE },
    "private.funds": { tool: "portfolio.holdings", asOf: "2026-06-30T00:00:00+08:00", sources: ["Fund manager reports"] },
    "commit.calendar": { tool: "goals.list", asOf: ELEANOR_AS_OF, sources: [...FAMILY_OFFICE, "Fund manager reports"] },
    "liquidity.available": { tool: "portfolio.summary", asOf: ELEANOR_AS_OF, sources: CUSTODY },
    "valuation.ages": { tool: "documents.list", asOf: ELEANOR_AS_OF, sources: [...VALUATIONS, "Fund manager reports"] },
    "risk.jurisdiction": { tool: "performance.risk", asOf: ELEANOR_AS_OF, sources: [...CUSTODY, ...FAMILY_OFFICE] },
    "actions.open": { tool: "meetings.recent", asOf: "2026-09-02T00:00:00+08:00", sources: ["Meeting notes"] },
    "evidence.sources": { tool: "documents.list", asOf: ELEANOR_AS_OF, sources: FAMILY_OFFICE },
  },
  failed: [],
};

/* ========================================================================== */
/* Layer 3a — the answer, which is the fallback and the source of truth        */
/* ========================================================================== */

export const ELEANOR_ANSWER = `Net worth is S$113.3m: S$116.0m of assets against S$2.7m of liabilities, and no borrowing anywhere on the balance sheet. The weight is in things that do not trade — S$48.0m of property, S$21.6m of private funds and a S$19.0m stake in Whitfield Manufacturing are 76% of assets between them, against S$11.0m of cash and S$16.4m of listed funds and bonds.

The property book is four assets. Nassim Road is the largest at S$16.0m, then Manchester at S$14.0m, Kensington at S$12.0m and Provence at S$6.0m. By value it is 54% in the United Kingdom, 33% in Singapore and 13% in France, and counting the business stake, Whitfield Ventures and the HSBC balance, S$50.5m — 43.5% of the balance sheet — sits in the UK. That is the single largest exposure here and it is a jurisdiction exposure, not a market one.

Three figures are carried at marks that are months old: Manchester at 11 months, the 12% Whitfield Manufacturing stake at 8 months, and Whitfield Ventures at 17 months, which the file itself marks stale. Together they are S$36.0m, 31% of assets, so the net worth figure is as current as those valuations and no more.

S$6.95m falls due between 12 October and 31 January — two capital calls, the Manchester refurbishment, the family distributions and the tax payment. Cash alone would leave S$4.05m afterwards, below the S$7m accessible-liquidity floor on file; including the two bond portfolios it leaves S$13.15m, comfortably above it. The decision is which pocket funds the calls, and it is due before 12 October. A further S$2.5m is committed to Meridian with no call date scheduled.

Assets sit in three names: S$86.8m personally, S$19.0m through Whitfield Holdings and S$10.2m in the Whitfield Family Trust. Revised trust documents arrived on 2 September changing successor trustees, distribution powers and investment committee authority, and are unreviewed.`;

/* ========================================================================== */
/* Layer 3b — the semantic report                                             */
/* ========================================================================== */

export const ELEANOR_REPORT: SemanticReport = {
  reportType: "property_review",
  title: "Eleanor Whitfield",
  summary:
    "Net worth is S$113.3m with no borrowing, but 76% of assets do not trade and S$36.0m of them are carried at valuations 8 to 17 months old. S$6.95m falls due by the end of January, and which pocket funds it has to be settled before 12 October.",
  narrative: ELEANOR_ANSWER,
  relations: [
    /* The property book by asset and by country are two views of one question, so they
       become tabs in a single area rather than two charts arguing for the same space. */
    { kind: "answers_same_question", sectionIds: ["s.property", "s.geography"] },
  ],
  sections: [
    {
      id: "s.networth",
      semanticType: "summary",
      question: "What is the balance sheet worth?",
      importance: "primary",
      takeaway: "Up on the quarter, with no borrowing against it.",
      dataKeys: ["networth.total", "networth.series"],
      findings: [
        {
          kind: "metric",
          id: "f.networth",
          emphasis: "primary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Net worth",
          label: "Net worth",
          value: "S$113.3m",
          basis: "assets less liabilities, at 15 September",
          delta: { label: "+S$2.4m since 30 June", value: 2.4, sentiment: "positive" },
        },
        {
          kind: "metric",
          id: "f.assets",
          emphasis: "secondary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Net worth",
          label: "Total assets",
          value: "S$116.0m",
          basis: "against S$2.7m of liabilities and no borrowing",
        },
        {
          kind: "trend",
          id: "f.nwseries",
          emphasis: "secondary",
          confidence: 0.6,
          sources: ["Estimate"],
          subject: "Net worth",
          label: "Net worth, S$m",
          series: {
            name: "Net worth",
            points: [
              { label: "31 Mar", value: 108.2 },
              { label: "30 Jun", value: 110.9 },
              { label: "15 Sep", value: 113.3 },
            ],
          },
        },
      ],
    },
    {
      id: "s.property",
      semanticType: "allocation",
      question: "What is in the property book?",
      importance: "secondary",
      takeaway: "Four properties, and one of them is carrying a refurbishment commitment.",
      groups: ["By property"],
      dataKeys: ["property.schedule"],
      findings: [
        {
          kind: "metric",
          id: "f.property",
          emphasis: "primary",
          confidence: 1,
          sources: VALUATIONS,
          subject: "Property",
          label: "Property",
          value: "S$48.0m",
          basis: "41.4% of assets, across four properties in three countries",
        },
        /*
         * Three measures over the same four properties. Written as three comparison
         * findings because that is what they are — and because the composer collects a
         * measure group into one table rather than three charts, so the reader gets the
         * schedule an advisor would actually ask for: what it is worth, what share of
         * the book, and how old the number is.
         */
        {
          kind: "comparison",
          id: "f.propvalue",
          emphasis: "secondary",
          confidence: 1,
          sources: VALUATIONS,
          subject: "Property",
          label: "Property",
          measure: "Valuation",
          entities: [
            { name: "Singapore Residence", value: 16.0, display: "S$16.0m" },
            { name: "UK Commercial Property", value: 14.0, display: "S$14.0m" },
            { name: "London Townhouse", value: 12.0, display: "S$12.0m" },
            { name: "Provence Holiday Home", value: 6.0, display: "S$6.0m" },
          ],
        },
        {
          kind: "comparison",
          id: "f.propshare",
          emphasis: "secondary",
          confidence: 1,
          sources: VALUATIONS,
          subject: "Property",
          label: "Property",
          measure: "Share of property",
          entities: [
            { name: "Singapore Residence", value: 33.3, display: "33.3%" },
            { name: "UK Commercial Property", value: 29.2, display: "29.2%" },
            { name: "London Townhouse", value: 25.0, display: "25.0%" },
            { name: "Provence Holiday Home", value: 12.5, display: "12.5%" },
          ],
        },
        {
          kind: "comparison",
          id: "f.propage",
          emphasis: "secondary",
          confidence: 1,
          sources: VALUATIONS,
          subject: "Property",
          label: "Property",
          measure: "Valued",
          entities: [
            { name: "Singapore Residence", value: 3, display: "30 Jun 2026" },
            { name: "UK Commercial Property", value: 11, display: "1 Oct 2025" },
            { name: "London Townhouse", value: 5, display: "15 Apr 2026" },
            { name: "Provence Holiday Home", value: 4, display: "20 May 2026" },
          ],
        },
      ],
    },
    {
      id: "s.geography",
      semanticType: "allocation",
      question: "What is in the property book?",
      importance: "secondary",
      takeaway: "Three countries, and the UK is more than half the book.",
      groups: ["By country"],
      dataKeys: ["property.geography"],
      findings: [
        {
          kind: "composition",
          id: "f.geo",
          emphasis: "secondary",
          confidence: 1,
          sources: VALUATIONS,
          subject: "Property",
          label: "Property by country",
          parts: [
            { label: "United Kingdom", value: 0.542 },
            { label: "Singapore", value: 0.333 },
            { label: "France", value: 0.125 },
          ],
        },
        {
          kind: "narrative",
          id: "f.use",
          emphasis: "supporting",
          confidence: 1,
          sources: VALUATIONS,
          subject: "Property",
          heading: "Residential and commercial",
          text: "Three of the four are residential and two of those are in use as homes, so S$34.0m of the book is not held for yield. Manchester at S$14.0m is the only commercial asset, and it is also the one carrying the S$1.8m refurbishment commitment due in December.",
        },
      ],
    },
    {
      id: "s.mix",
      semanticType: "allocation",
      question: "How is the balance sheet made up?",
      importance: "secondary",
      takeaway: "Most of the balance sheet cannot be sold quickly.",
      dataKeys: ["alloc.class", "liquidity.available"],
      findings: [
        {
          kind: "metric",
          id: "f.illiquid",
          emphasis: "primary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Composition",
          label: "Illiquid assets",
          value: "76%",
          basis: "property, private funds and the business stake, S$88.6m",
        },
        {
          kind: "composition",
          id: "f.alloc",
          emphasis: "secondary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Composition",
          label: "By asset class",
          parts: [
            { label: "Real estate", value: 0.414 },
            { label: "Private investments", value: 0.186 },
            { label: "Family business", value: 0.164 },
            { label: "Listed securities", value: 0.141 },
            { label: "Cash", value: 0.095 },
          ],
        },
        {
          kind: "flag",
          id: "f.nodebt",
          emphasis: "secondary",
          confidence: 1,
          sources: FAMILY_OFFICE,
          subject: "Composition",
          severity: "info",
          subjectLabel: "No borrowing against any of it",
          detail:
            "There is no mortgage on any of the four properties and no margin or credit facility on file. The S$2.7m of liabilities are a refurbishment commitment and a tax payment. It means there is nothing to refinance and no facility to draw on, which matters when the funding question below is about which asset to sell rather than what to borrow.",
        },
      ],
    },
    {
      id: "s.entities",
      semanticType: "identity",
      question: "Who holds what?",
      importance: "secondary",
      takeaway: "Three owners, and the trust documents governing one of them are unreviewed.",
      dataKeys: ["entities.ownership"],
      findings: [
        {
          kind: "comparison",
          id: "f.owners",
          emphasis: "secondary",
          confidence: 1,
          sources: FAMILY_OFFICE,
          subject: "Ownership",
          label: "Assets by legal owner",
          measure: "Assets held",
          entities: [
            { name: "Eleanor personally", value: 86.8, display: "S$86.8m" },
            { name: "Whitfield Holdings Pte. Ltd.", value: 19.0, display: "S$19.0m" },
            { name: "Whitfield Family Trust", value: 10.2, display: "S$10.2m" },
          ],
        },
        {
          kind: "flag",
          id: "f.trustdocs",
          emphasis: "primary",
          confidence: 1,
          sources: ["Meeting notes"],
          subject: "Ownership",
          severity: "warn",
          subjectLabel: "Revised trust documents are unreviewed",
          detail:
            "Documents received on 2 September change successor trustees, distribution powers and investment committee authority over the S$10.2m in the Whitfield Family Trust. They have not been reviewed with counsel, and the June meeting recorded that no asset transfers are to be initiated until the governance discussion concludes.",
        },
        {
          kind: "narrative",
          id: "f.succession",
          emphasis: "supporting",
          confidence: 0.9,
          sources: ["Meeting notes"],
          subject: "Ownership",
          heading: "Three children, three different roles",
          text: "James has asked for a formal role in investment decisions, Sophie is exploring an education foundation with S$2–3m of initial funding, and Daniel has limited involvement. The stated intention is differentiated roles and a family investment committee before any further trust changes, not an equal split of responsibility.",
        },
      ],
    },
    {
      id: "s.commitments",
      semanticType: "commitments",
      question: "What has to be paid, and when?",
      importance: "secondary",
      takeaway: "Five payments fall due across the next four months.",
      dataKeys: ["commit.calendar", "private.funds"],
      /*
       * No `f.calendar` comparison here, and its absence is the point.
       *
       * It listed the same five commitments the `commit.calendar` timeline lists, with the
       * same five amounts, as horizontal bars — so the section stated every figure twice,
       * once as a schedule and once as a chart, and a reader comparing them had to work out
       * that there was nothing to compare. A bar chart of five dated amounts is also the
       * wrong chart: it ranks them by size when the thing that matters is the order they
       * arrive in, which is what the timeline already shows.
       */
      findings: [
        {
          kind: "requirement",
          id: "f.next",
          emphasis: "primary",
          confidence: 1,
          sources: ["Fund manager reports"],
          subject: "Commitments",
          amount: "S$2.4m",
          purpose: "Northstar PE Fund IV capital call",
          deadline: "12 October 2026",
          note: "The first of the five, and the date the funding decision has to be made by.",
        },
        {
          kind: "flag",
          id: "f.meridian",
          emphasis: "secondary",
          confidence: 1,
          sources: ["Fund manager reports"],
          subject: "Commitments",
          severity: "warn",
          subjectLabel: "S$2.5m committed to Meridian with no call date",
          detail:
            "Unfunded commitments total S$6.0m, of which S$3.5m has dates. The Meridian Infrastructure balance could be called at any time and is not in the S$6.95m calendar, so the four-month figure is a floor rather than a forecast.",
        },
      ],
    },
    {
      id: "s.liquidity",
      semanticType: "liquidity",
      question: "Is there enough to fund it?",
      importance: "secondary",
      takeaway: "Whether the floor holds depends on how the bonds are counted.",
      dataKeys: ["liquidity.available"],
      findings: [
        {
          kind: "metric",
          id: "f.cash",
          emphasis: "primary",
          confidence: 1,
          sources: CUSTODY,
          subject: "Liquidity",
          label: "Cash",
          value: "S$11.0m",
          basis: "at DBS, UBS and HSBC UK, before any sale",
        },
        {
          kind: "flag",
          id: "f.floor",
          emphasis: "primary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Liquidity",
          severity: "critical",
          subjectLabel: "Cash alone ends S$3.0m below the stated liquidity floor",
          detail:
            "The file records a requirement to keep at least S$7m accessible after known commitments. S$11.0m of cash less S$6.95m of commitments leaves S$4.05m. Including the S$9.1m of bond portfolios it leaves S$13.15m and the floor holds comfortably. Both are true; which one applies depends on whether the bonds are treated as accessible, and that has not been decided.",
        },
        {
          kind: "metric",
          id: "f.bonds",
          emphasis: "secondary",
          confidence: 1,
          sources: CUSTODY,
          subject: "Liquidity",
          label: "Bond portfolios",
          value: "S$9.1m",
          basis: "investment grade and short duration, saleable within days",
        },
      ],
    },
    {
      id: "s.exposure",
      semanticType: "risk",
      question: "Where is the exposure?",
      importance: "secondary",
      takeaway: "Four jurisdictions, and some valuations are old enough to matter.",
      dataKeys: ["risk.jurisdiction", "valuation.ages"],
      findings: [
        {
          kind: "flag",
          id: "f.stale",
          emphasis: "primary",
          confidence: 1,
          sources: [...VALUATIONS, "Fund manager reports"],
          subject: "Exposure",
          severity: "warn",
          subjectLabel: "S$36.0m is carried at marks 8 to 17 months old",
          detail:
            "Manchester was last valued on 1 October 2025, the 12% Whitfield Manufacturing stake on 31 December 2025, and Whitfield Ventures on 31 March 2025 — which the source itself marks stale. That is 31% of assets, so the net worth figure above is exactly as current as those three valuations and no more.",
        },
        {
          kind: "metric",
          id: "f.uk",
          emphasis: "secondary",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Exposure",
          label: "United Kingdom",
          value: "43.5%",
          basis: "S$50.5m of assets, for a Singapore tax resident",
        },
        {
          kind: "narrative",
          id: "f.ukdetail",
          emphasis: "supporting",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE],
          subject: "Exposure",
          heading: "What the UK exposure is made of",
          text: "Two properties at S$26.0m, the S$19.0m manufacturing stake, S$3.0m in Whitfield Ventures and S$2.5m at HSBC UK. It is concentrated in a jurisdiction rather than a market, so the risks that travel with it are tax, estate and currency rather than price — and the estate question interacts with the trust documents above.",
        },
      ],
    },
    {
      id: "s.actions",
      semanticType: "actions",
      question: "What needs doing?",
      importance: "supporting",
      takeaway: "Five open items, the first due in October.",
      dataKeys: ["actions.open"],
      findings: [
        {
          kind: "checklist",
          id: "f.open",
          emphasis: "secondary",
          confidence: 1,
          sources: ["Meeting notes"],
          subject: "Open items",
          label: "Open items",
          items: [
            { text: "Decide which pocket funds the October and November calls", state: "todo", due: "by 12 October" },
            { text: "Review the revised trust documents with counsel", state: "todo", due: "received 2 September" },
            { text: "Prepare options for a family investment committee", state: "doing", owner: "Advisory" },
            { text: "Obtain an updated Whitfield Ventures valuation", state: "todo" },
            { text: "Arrange an introductory philanthropy session with Sophie", state: "todo" },
          ],
        },
      ],
    },
    {
      id: "s.evidence",
      semanticType: "evidence",
      question: "Where do these figures come from?",
      importance: "supporting",
      takeaway: "Balance-sheet figures are recorded; the monthly history is estimated.",
      dataKeys: ["evidence.sources"],
      findings: [
        {
          kind: "narrative",
          id: "f.asof",
          emphasis: "supporting",
          confidence: 1,
          sources: [...CUSTODY, ...FAMILY_OFFICE, ...VALUATIONS],
          subject: "Sources",
          heading: "As at 15 September 2026",
          text: "Every asset figure is recorded, not estimated: three bank balances, four listed positions, four property valuations with their dates, four fund reports, the 12% business stake and two liabilities. This is a SGD book, so no conversion has been applied. Only the net worth history is an estimate — the file holds one valuation per asset and no series. The capital calls are not counted as liabilities, because a call exchanges cash for fund value rather than reducing net worth; they appear in the calendar instead.",
        },
      ],
    },
  ],
};
