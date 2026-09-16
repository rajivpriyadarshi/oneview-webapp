/**
 * Layers 1, 2 and 6 behind one interface — DESIGN.md §7.
 *
 * `FindingSource` is the seam between the model and the deterministic layers.
 * The lab ships `SCRIPTED_SOURCE`: canned findings keyed by intent, pure data,
 * no network, replays identically. Swapping in a real model means implementing
 * the same two methods against the backend's `data-artifact` stream — layers 3–5
 * don't change, and they hold all the logic.
 *
 * The fixture below is the worked example from DESIGN.md: a portfolio analysis
 * report for Prashanth, then the follow-up asking for a comparison of his top
 * two holdings. It is written as *findings only* — deliberately containing no
 * component name, colour or size, so it exercises the real contract rather than
 * a shortcut.
 */

import type { ComparisonFinding, Finding, Series } from "./findings";
import type { ReportDoc } from "./compose";
import type { ReportOp } from "./patch";

export type FindingSource = {
  analyse(prompt: string, subject: string): Promise<Finding[]>;
  amend(prompt: string, doc: ReportDoc): Promise<ReportOp[]>;
};

/* ------------------------------------------------------------------ helpers */

const points = (values: number[], labels: string[]): Series["points"] =>
  values.map((value, i) => ({ label: labels[i] ?? `${i}`, value }));

const QUARTERS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

/* ------------------------------------------------------- the initial report */

/**
 * The findings behind "give me the portfolio analysis report for Prashanth".
 *
 * Subjects are chosen to produce four sections, and emphasis is set so the
 * headline metric leads — which is what makes the reveal animation open on the
 * number rather than on a paragraph.
 */
export const PORTFOLIO_FINDINGS: Finding[] = [
  {
    id: "aum",
    kind: "metric",
    subject: "Overview",
    emphasis: "primary",
    confidence: 0.98,
    sources: ["Custody positions", "Valuations"],
    label: "Total portfolio value",
    value: "S$25.4m",
    delta: { label: "+4.8% QoQ", value: 4.8, sentiment: "positive" },
    series: {
      name: "Portfolio value",
      points: points([21.2, 21.8, 22.4, 22.1, 23.0, 23.4, 23.9, 24.1, 24.6, 24.9, 25.1, 25.4], QUARTERS),
    },
  },
  {
    id: "liquid",
    kind: "metric",
    subject: "Overview",
    emphasis: "secondary",
    confidence: 0.94,
    sources: ["Custody positions"],
    label: "Liquid assets",
    value: "S$6.1m",
    delta: { label: "-S$0.4m", value: -0.4, sentiment: "negative" },
  },
  {
    id: "leverage",
    kind: "metric",
    subject: "Overview",
    emphasis: "secondary",
    confidence: 0.91,
    sources: ["Lending book"],
    label: "Loan-to-value",
    value: "18%",
    delta: { label: "flat", value: 0, sentiment: "neutral" },
  },

  {
    id: "perf-summary",
    kind: "narrative",
    subject: "Performance",
    emphasis: "primary",
    confidence: 0.88,
    sources: ["Valuations", "Benchmarks"],
    heading: "Performance summary",
    text:
      "The portfolio outperformed its blended benchmark over the quarter, driven almost entirely by US technology holdings. Fixed income was flat, and the private markets sleeve is still marked at last round.",
    deltas: [
      { label: "Portfolio +4.8%", value: 4.8, sentiment: "positive" },
      { label: "Benchmark +3.1%", value: 3.1, sentiment: "neutral" },
      { label: "Tech sleeve +11.2%", value: 11.2, sentiment: "positive" },
    ],
  },
  {
    id: "allocation",
    kind: "composition",
    subject: "Performance",
    emphasis: "secondary",
    confidence: 0.96,
    sources: ["Custody positions"],
    label: "Allocation by asset class",
    parts: [
      { label: "Public equities", value: 0.52, delta: { label: "+3pp", value: 3, sentiment: "neutral" } },
      { label: "Fixed income", value: 0.23, delta: { label: "-2pp", value: -2, sentiment: "neutral" } },
      { label: "Private markets", value: 0.17 },
      { label: "Cash", value: 0.08, delta: { label: "-1pp", value: -1, sentiment: "negative" } },
    ],
  },

  {
    id: "tech-exposure",
    kind: "transition",
    subject: "Concentration",
    emphasis: "primary",
    confidence: 0.93,
    sources: ["Custody positions"],
    subjectLabel: "Technology exposure",
    from: "21%",
    to: "29%",
    sentiment: "negative",
    note: "Driven by price appreciation rather than new purchases.",
  },
  {
    id: "concentration-flag",
    kind: "flag",
    subject: "Concentration",
    emphasis: "primary",
    confidence: 0.9,
    sources: ["Custody positions", "Risk policy"],
    severity: "warn",
    subjectLabel: "Single-name concentration",
    detail:
      "The top two holdings are 19% of the portfolio, above the 15% guideline in the client's own investment policy.",
  },
  {
    id: "sector-mix",
    kind: "comparison",
    subject: "Concentration",
    emphasis: "secondary",
    confidence: 0.92,
    sources: ["Custody positions"],
    label: "Equity exposure by sector",
    measure: "Share of equity sleeve",
    entities: [
      { name: "Technology", value: 29, display: "29%" },
      { name: "Financials", value: 18, display: "18%" },
      { name: "Healthcare", value: 15, display: "15%" },
      { name: "Industrials", value: 12, display: "12%" },
      { name: "Consumer", value: 11, display: "11%" },
    ],
  },

  {
    id: "liquidity-need",
    kind: "requirement",
    subject: "Near-term focus",
    emphasis: "primary",
    confidence: 0.85,
    sources: ["Meeting notes", "Lending book"],
    amount: "~S$3m",
    purpose: "Singapore property purchase",
    deadline: "within 3 months",
    note: "No final funding decision has been made.",
  },
  {
    id: "bond-maturity",
    kind: "requirement",
    subject: "Near-term focus",
    emphasis: "secondary",
    confidence: 0.97,
    sources: ["Custody positions"],
    amount: "S$800k",
    purpose: "Bond maturity to reinvest",
    deadline: "next month",
  },
  {
    id: "rebalance-rec",
    kind: "recommendation",
    subject: "Near-term focus",
    emphasis: "secondary",
    confidence: 0.79,
    sources: ["Risk policy", "Valuations"],
    title: "Trim technology and US equity concentration",
    rationale:
      "Reducing the top two positions to the 15% policy guideline would release roughly S$1m toward the property requirement without touching the private markets sleeve.",
    action: "Model a 4% trim across the top two holdings",
  },
];

/* --------------------------------------------------------- the follow-up */

/**
 * "Add a comparison graph between the client's top 2 holdings."
 *
 * Two entities, each with a series — which is the shape that resolves to
 * `DualLineChart` in `select.ts`. The source doesn't know that and doesn't say
 * it; that's the separation working.
 */
export const TOP_TWO_HOLDINGS: ComparisonFinding = {
  id: "top-two",
  kind: "comparison",
  subject: "Concentration",
  emphasis: "primary",
  confidence: 0.95,
  sources: ["Custody positions", "Valuations"],
  label: "Top 2 holdings compared",
  measure: "Indexed total return",
  entities: [
    {
      name: "NVIDIA",
      value: 32.1,
      display: "+32.1%",
      series: {
        name: "NVIDIA",
        points: points([100, 104, 112, 109, 118, 124, 131, 128, 136, 141, 148, 132], QUARTERS),
      },
    },
    {
      name: "Microsoft",
      value: 18.4,
      display: "+18.4%",
      series: {
        name: "Microsoft",
        points: points([100, 102, 105, 107, 106, 110, 113, 115, 114, 117, 119, 118], QUARTERS),
      },
    },
  ],
};

/* ------------------------------------------------------------------ source */

/** Matches a prompt loosely — enough for a lab, honest about being a fixture. */
const mentions = (prompt: string, ...terms: string[]): boolean => {
  const lower = prompt.toLowerCase();
  return terms.some((term) => lower.includes(term));
};

/**
 * The scripted implementation.
 *
 * Async to match the real interface, but resolves immediately — the *pacing* of
 * the reveal belongs to the page's frame driver, not here, so that the animation
 * stays scrubbable rather than being at the mercy of a fake latency.
 */
export const SCRIPTED_SOURCE: FindingSource = {
  async analyse(prompt) {
    if (mentions(prompt, "portfolio", "analysis", "report", "review")) {
      return PORTFOLIO_FINDINGS;
    }
    return [];
  },

  async amend(prompt, doc) {
    if (mentions(prompt, "top 2", "top two", "comparison", "compare")) {
      // Anchored after the transition card so it lands beside the
      // concentration story it belongs to, rather than at the end.
      const anchor = doc.sections
        .flatMap((section) => section.blocks)
        .find((block) => block.findingId === "tech-exposure");
      return [
        {
          op: "addFinding",
          finding: TOP_TWO_HOLDINGS,
          after: anchor?.id,
        },
      ];
    }
    return [];
  },
};
