/**
 * The client book — the facts the model is allowed to reason over.
 *
 * The point of this prototype is that the *ask is open-ended*: "compare the two
 * biggest holdings", "how much FX risk is there", "what did we agree in the last
 * meeting", "restructure that report around liquidity". None of those can be
 * pre-scripted, so instead of scripting answers we give the model a book of
 * facts and let it decide which of them constitute findings.
 *
 * Mock data, but shaped like the real thing: every number a chart might want has
 * a series, because a model can only report a trend if the history is there to
 * report. Twelve monthly points throughout, so series are directly comparable.
 */

export const MONTHS = [
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep",
];

export const CLIENT = {
  name: "Prashanth Kumar",
  segment: "Family office",
  location: "Singapore",
  taxResidency: "Singapore",
  clientSince: 2016,
  riskProfile: "Growth",
  family: [
    { name: "Prashanth Kumar", role: "Principal", age: 54 },
    { name: "Lakshmi Kumar", role: "Spouse", age: 51 },
    { name: "Arjun Kumar", role: "Son", age: 24, note: "Starting a company in Bengaluru" },
    { name: "Divya Kumar", role: "Daughter", age: 19, note: "University, US, 2 years remaining" },
  ],
  relationship: {
    manager: "Nithya Rao",
    lastReview: "2026-06-18",
    nextReview: "2026-10-02",
    contactCadence: "Quarterly, plus ad hoc on market moves",
  },
} as const;

export const PORTFOLIO = {
  currency: "SGD",
  totalValue: 33.3,
  totalValueDisplay: "S$33.3m",
  valueSeries: [28.9, 29.4, 30.1, 29.7, 30.6, 31.2, 31.6, 31.4, 32.2, 32.6, 33.0, 33.3],
  quarterChangePct: 3.8,
  yearChangePct: 12.4,
  benchmarkYearChangePct: 8.9,
  liquidAssets: 6.1,
  liquidAssetsDisplay: "S$6.1m",
  liquidChangeM: -0.4,
  loanToValuePct: 18,
  loanToValuePrevPct: 18,
  feesYtdDisplay: "S$212k",
  incomeYieldPct: 2.1,
  assetClasses: [
    { label: "Public equities", share: 0.52, prevShare: 0.49 },
    { label: "Fixed income", share: 0.23, prevShare: 0.25 },
    { label: "Private markets", share: 0.17, prevShare: 0.17 },
    { label: "Cash", share: 0.08, prevShare: 0.09 },
  ],
  sectors: [
    { label: "Technology", sharePct: 29, prevSharePct: 21 },
    { label: "Financials", sharePct: 18, prevSharePct: 19 },
    { label: "Healthcare", sharePct: 15, prevSharePct: 15 },
    { label: "Industrials", sharePct: 12, prevSharePct: 13 },
    { label: "Consumer", sharePct: 11, prevSharePct: 12 },
    { label: "Energy", sharePct: 8, prevSharePct: 11 },
    { label: "Other", sharePct: 7, prevSharePct: 9 },
  ],
  geographies: [
    { label: "United States", sharePct: 46 },
    { label: "Singapore", sharePct: 19 },
    { label: "India", sharePct: 14 },
    { label: "Europe", sharePct: 12 },
    { label: "Rest of Asia", sharePct: 9 },
  ],
  currencies: [
    { label: "USD", sharePct: 54, hedgedPct: 30 },
    { label: "SGD", sharePct: 27, hedgedPct: 100 },
    { label: "INR", sharePct: 11, hedgedPct: 0 },
    { label: "EUR", sharePct: 8, hedgedPct: 45 },
  ],
} as const;

/** Indexed to 100 at the start of the window, so any two are comparable. */
export const HOLDINGS = [
  {
    name: "NVIDIA", ticker: "NVDA", assetClass: "Public equity", sector: "Technology",
    valueM: 3.6, sharePct: 10.8, returnYtdPct: 32.1, costBasisM: 1.9,
    indexed: [100, 104, 112, 109, 118, 124, 131, 128, 136, 141, 148, 132],
  },
  {
    name: "Microsoft", ticker: "MSFT", assetClass: "Public equity", sector: "Technology",
    valueM: 2.7, sharePct: 8.1, returnYtdPct: 18.4, costBasisM: 1.6,
    indexed: [100, 102, 105, 107, 106, 110, 113, 115, 114, 117, 119, 118],
  },
  {
    name: "DBS Group", ticker: "D05", assetClass: "Public equity", sector: "Financials",
    valueM: 2.1, sharePct: 6.3, returnYtdPct: 9.7, costBasisM: 1.7,
    indexed: [100, 101, 103, 104, 103, 105, 107, 108, 108, 109, 110, 110],
  },
  {
    name: "HDFC Bank", ticker: "HDFCBANK", assetClass: "Public equity", sector: "Financials",
    valueM: 1.5, sharePct: 4.5, returnYtdPct: 6.2, costBasisM: 1.3,
    indexed: [100, 99, 101, 103, 102, 104, 103, 105, 106, 105, 107, 106],
  },
  {
    name: "Novo Nordisk", ticker: "NOVO-B", assetClass: "Public equity", sector: "Healthcare",
    valueM: 1.4, sharePct: 4.2, returnYtdPct: -7.4, costBasisM: 1.6,
    indexed: [100, 103, 106, 104, 101, 99, 97, 95, 96, 94, 93, 93],
  },
  {
    name: "Sequoia India Fund IV", assetClass: "Private markets", sector: "Diversified",
    valueM: 2.4, sharePct: 7.2, returnYtdPct: 0, costBasisM: 2.0,
    note: "Marked at last round, Q1. Two portfolio companies raised since.",
    indexed: [100, 100, 100, 100, 118, 118, 118, 118, 118, 118, 118, 118],
  },
  {
    name: "SGS 10Y", assetClass: "Fixed income", sector: "Government",
    valueM: 2.2, sharePct: 6.6, returnYtdPct: 3.1, costBasisM: 2.2,
    indexed: [100, 100, 101, 101, 102, 102, 102, 103, 103, 103, 103, 103],
  },
  {
    name: "Corporate bond ladder", assetClass: "Fixed income", sector: "Credit",
    valueM: 5.4, sharePct: 16.2, returnYtdPct: 2.6, costBasisM: 5.3,
    note: "S$800k tranche matures next month.",
    indexed: [100, 100, 100, 101, 101, 101, 102, 102, 102, 102, 103, 103],
  },
] as const;

export const PERFORMANCE = {
  portfolioIndexed: [100, 101, 104, 103, 106, 108, 109, 109, 111, 112, 112, 112],
  benchmarkIndexed: [100, 101, 102, 102, 104, 105, 105, 106, 107, 107, 108, 109],
  benchmarkName: "Blended 60/40 benchmark",
  attribution: [
    { label: "US technology", contributionPct: 6.8 },
    { label: "Financials", contributionPct: 1.9 },
    { label: "Fixed income", contributionPct: 0.6 },
    { label: "Healthcare", contributionPct: -0.9 },
    { label: "FX", contributionPct: -0.4 },
  ],
  volatilityPct: 11.4,
  benchmarkVolatilityPct: 9.2,
  maxDrawdownPct: -8.7,
  sharpe: 1.12,
} as const;

export const CASHFLOW = {
  netContributionsM: 1.2,
  incomeM: 0.7,
  drawdownsM: -0.5,
  monthlyNetM: [0.1, 0.2, -0.1, 0.3, 0.1, 0.0, 0.2, -0.2, 0.1, 0.3, 0.1, 0.1],
  upcoming: [
    { label: "Bond tranche maturity", amountM: 0.8, when: "next month" },
    { label: "Private fund capital call", amountM: -0.6, when: "within 6 weeks" },
    { label: "Dividend season", amountM: 0.35, when: "next quarter" },
  ],
} as const;

export const LIABILITIES = {
  totalM: 6.0,
  facilities: [
    { label: "Lombard facility", outstandingM: 4.2, ratePct: 4.6, resets: "Nov 2026" },
    { label: "Property mortgage", outstandingM: 1.8, ratePct: 3.2, resets: "fixed to 2029" },
  ],
  loanToValuePct: 18,
  policyLimitPct: 35,
} as const;

export const GOALS = [
  {
    label: "Singapore property purchase",
    amountDisplay: "~S$3m",
    horizon: "within 3 months",
    status: "Funding route undecided",
    fundedPct: 0.35,
  },
  {
    label: "Daughter's US education",
    amountDisplay: "S$900k",
    horizon: "2 years",
    status: "Ring-fenced in the bond ladder",
    fundedPct: 0.8,
  },
  {
    label: "Son's venture — seed support",
    amountDisplay: "S$500k",
    horizon: "12 months",
    status: "Discussed, not committed",
    fundedPct: 0.1,
  },
  {
    label: "Philanthropy vehicle",
    amountDisplay: "S$2m",
    horizon: "3–5 years",
    status: "Exploring a Singapore trust structure",
    fundedPct: 0,
  },
] as const;

export const RISKS = [
  {
    label: "Single-name concentration",
    severity: "warn",
    detail:
      "The top two holdings are 18.9% of the portfolio, above the 15% guideline in the client's own investment policy statement.",
  },
  {
    label: "Unhedged INR exposure",
    severity: "info",
    detail: "11% of the portfolio is INR-denominated and entirely unhedged.",
  },
  {
    label: "Private mark staleness",
    severity: "info",
    detail: "The private markets sleeve is carried at a Q1 mark; two underlying companies have raised since.",
  },
  {
    label: "Liquidity vs near-term need",
    severity: "warn",
    detail:
      "A ~S$3m property need in 3 months against S$6.1m of liquid assets, S$0.6m of which is already committed to a capital call.",
  },
] as const;

export const MEETINGS = [
  {
    date: "2026-06-18",
    kind: "Portfolio review",
    with: "Prashanth, Lakshmi",
    notes: [
      "Wants to keep the technology position — views it as a long-term conviction, not a trade.",
      "Property purchase is likely but not decided; asked what funding it from the Lombard facility would cost.",
      "Uncomfortable with the idea of borrowing against the portfolio while rates are above 4%.",
      "Asked for education funding to be kept visibly separate from everything else.",
    ],
  },
  {
    date: "2026-04-02",
    kind: "Call",
    with: "Prashanth",
    notes: [
      "Raised the son's venture; wants to support it without touching the long-term book.",
      "Agreed to revisit the philanthropy structure after the property decision.",
    ],
  },
  {
    date: "2026-02-11",
    kind: "Annual planning",
    with: "Prashanth, Lakshmi, tax adviser",
    notes: [
      "Confirmed Singapore tax residency and reviewed the trust structure.",
      "Agreed to hold the growth risk profile for another year.",
    ],
  },
] as const;

export const DOCUMENTS = [
  { label: "Investment policy statement", updated: "2025-11-04", note: "15% single-name guideline" },
  { label: "Trust deed — Kumar Family Trust", updated: "2024-08-19" },
  { label: "Lombard facility agreement", updated: "2025-02-27" },
  { label: "Q2 2026 valuation pack", updated: "2026-07-05" },
] as const;

/**
 * The book as the model receives it.
 *
 * One JSON blob rather than a hand-written summary: a summary is a set of
 * decisions about what matters, and deciding what matters is the model's job
 * here — that is the whole thing being prototyped.
 */
export function clientBook(): string {
  return JSON.stringify(
    {
      months: MONTHS,
      client: CLIENT,
      portfolio: PORTFOLIO,
      holdings: HOLDINGS,
      performance: PERFORMANCE,
      cashflow: CASHFLOW,
      liabilities: LIABILITIES,
      goals: GOALS,
      risks: RISKS,
      meetings: MEETINGS,
      documents: DOCUMENTS,
    },
    null,
    1,
  );
}
