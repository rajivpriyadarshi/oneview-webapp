/**
 * The stand-in analyst, for when there is no model key.
 *
 * It is *not* the design — the design is a model reading the book and deciding
 * what it found (see ../../api/lab/dynamic-ui/route.ts). This exists so the
 * prototype still demonstrates open-ended asks and the assembly animation on a
 * machine with no key, and so a demo can't die on a network error.
 *
 * How it stays open-ended without a model: it doesn't match prompts to answers,
 * it matches prompts to *topics of the book*, and every topic knows how to state
 * itself as findings. An ask it has never seen still gets the topics it touches,
 * and an ask that touches nothing gets a portfolio overview plus a narrative
 * saying what it could and couldn't cover. It never refuses.
 */

import {
  CASHFLOW,
  CLIENT,
  DOCUMENTS,
  GOALS,
  HOLDINGS,
  LIABILITIES,
  MEETINGS,
  MONTHS,
  PERFORMANCE,
  PORTFOLIO,
  RISKS,
} from "./clientBook";
import type { Finding, Series } from "./findings";
import { interpret, type Ask, type RankKey, type Revision } from "./interpret";

const series = (name: string, values: readonly number[]): Series => ({
  name,
  points: values.map((value, i) => ({ label: MONTHS[i] ?? `${i}`, value })),
});

const pct = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

const sentimentOf = (value: number) =>
  value > 0.05 ? ("positive" as const) : value < -0.05 ? ("negative" as const) : ("neutral" as const);

/** Listed single names, biggest share first. Used wherever "single-name" means it. */
const LISTED = HOLDINGS.filter((holding) => holding.assetClass === "Public equity")
  .slice()
  .sort((a, b) => b.sharePct - a.sharePct);

/* --------------------------------------------------------- the one comparison
 *
 * Extracted from the topic because a *revision* of a holdings card has to go
 * through exactly the same builder as the original ask did. Two code paths for
 * "state N holdings as a comparison" would drift the moment one of them changed.
 */

export type Holding = (typeof HOLDINGS)[number];

/** The shape a holdings comparison can be stated at. Straight out of an `Ask`. */
export type HoldingsShape = Pick<Ask, "count" | "rank" | "measure" | "overTime" | "worst" | "singleNames"> & {
  /** Only used for wording: whether the advisor said "stocks" out loud. */
  raw?: string;
};

export function holdingsComparison(shape: HoldingsShape): Finding {
  // The shape decides the universe, the ordering and the width. Nothing here
  // knows how many things it is about to describe until it reads the shape, and
  // nothing here knows what the result will be drawn as.
  const universe = shape.singleNames ? LISTED : HOLDINGS;

  const rankValue = (holding: Holding) =>
    shape.rank === "return"
      ? holding.returnYtdPct
      : shape.rank === "cost"
        ? holding.valueM - holding.costBasisM
        : holding.valueM;

  const ranked = [...universe].sort((a, b) =>
    shape.worst ? rankValue(a) - rankValue(b) : rankValue(b) - rankValue(a),
  );

  // No number stated: three is enough to be a comparison and few enough to still
  // read. A stated number wins, clamped to what actually exists.
  const count = Math.max(2, Math.min(shape.count ?? 3, ranked.length));
  const picked = ranked.slice(0, count);

  const measured = (holding: Holding) =>
    shape.measure === "return"
      ? { value: holding.returnYtdPct, display: pct(holding.returnYtdPct) }
      : shape.measure === "cost"
        ? {
            value: holding.valueM - holding.costBasisM,
            display: `S$${(holding.valueM - holding.costBasisM).toFixed(1)}m`,
          }
        : { value: holding.sharePct, display: `${holding.sharePct}% · S$${holding.valueM}m` };

  const measureLabel =
    shape.measure === "return"
      ? shape.overTime
        ? "Indexed total return"
        : "Total return, year to date"
      : shape.measure === "cost"
        ? "Unrealised gain"
        : "Share of portfolio";

  const rankLabel = shape.rank === "return" ? "return" : shape.rank === "cost" ? "unrealised gain" : "value";
  // Say "single names" only when the advisor did; the filtering above can be a
  // like-for-like decision they never asked for out loud.
  const noun = /stock|equit|single|name|listed/i.test(shape.raw ?? "") ? "single names" : "holdings";
  const end = shape.worst ? "weakest" : "largest";

  return {
    // The id carries the shape, so re-asking at a different width adds a second
    // comparison rather than being deduped as already on screen.
    id: `holdings-${end}-${count}-by-${shape.measure}${shape.overTime ? "-over-time" : ""}`,
    kind: "comparison",
    subject: "Concentration",
    emphasis: "primary",
    confidence: 0.95,
    sources: ["Custody positions", "Valuations"],
    // Two names is a pair; more is a ranking. Same sentence either way.
    label:
      count === 2
        ? `${picked[0].name} against ${picked[1].name}`
        : `${end === "weakest" ? "Weakest" : "Top"} ${count} ${noun} by ${rankLabel}`,
    measure: measureLabel,
    entities: picked.map((holding) => ({
      name: holding.name,
      ...measured(holding),
      // History goes in only when the question is about movement. Handing the
      // mapping layer a series it doesn't need is how you end up with a line
      // chart answering a question about size.
      series: shape.overTime ? series(holding.name, holding.indexed) : undefined,
    })),
  };
}

/* ------------------------------------------------------- revising one finding
 *
 * The advisor points at a card and says "show six of them", "by value instead",
 * "just the current numbers". That is a *restatement of the same finding at a
 * different shape* — never a component instruction. Which component then draws
 * it is still the mapping layer's decision, so "show six" can legitimately turn
 * a pair of lines into a bar chart.
 */

/** Which end of the book the current entity list came from. */
function inferRank(names: string[], universe: readonly Holding[]): RankKey {
  const topBy = (key: (h: Holding) => number) =>
    [...universe].sort((a, b) => key(b) - key(a)).slice(0, names.length).map((h) => h.name);
  const same = (list: string[]) => list.length === names.length && list.every((n) => names.includes(n));

  if (same(topBy((h) => h.valueM))) return "value";
  if (same(topBy((h) => h.returnYtdPct))) return "return";
  if (same(topBy((h) => h.valueM - h.costBasisM))) return "cost";
  return "value";
}

/**
 * Restate a finding under a revision, or null if the revision says nothing this
 * finding can act on.
 *
 * Null matters: it's the difference between "I changed it" and a card that
 * silently ignored the instruction.
 */
export function reviseFinding(finding: Finding, revision: Revision): Finding | null {
  if (finding.kind === "comparison") {
    const names = finding.entities.map((entity) => entity.name);
    const backed = names.every((name) => HOLDINGS.some((holding) => holding.name === name));

    // A holdings comparison can be restated from the book at any shape, so it
    // goes back through the same builder the original ask used.
    if (backed) {
      const wasSingleNames = names.every((name) => LISTED.some((listed) => listed.name === name));
      const wasOverTime = finding.entities.every((entity) => !!entity.series);
      const wasMeasure: RankKey = /share of/i.test(finding.measure)
        ? "value"
        : /unrealised/i.test(finding.measure)
          ? "cost"
          : "return";

      // The stated number wins over a filter nobody asked for out loud. If the
      // card was showing single names only — a like-for-like decision this code
      // made, not the advisor — and they ask for more than there are, widen the
      // universe rather than quietly handing back fewer than the number they said.
      const asked = revision.count;
      const singleNames =
        revision.singleNames ??
        (wasSingleNames && asked !== undefined && asked > LISTED.length && asked <= HOLDINGS.length
          ? false
          : wasSingleNames);
      const measure = revision.measure ?? wasMeasure;
      const next = holdingsComparison({
        count: revision.count ?? finding.entities.length,
        // Re-rank only if the advisor changed the dimension or the end; otherwise
        // keep the ordering the card already had, so "show six" extends the same
        // list rather than swapping it for a different one.
        rank:
          revision.measure ?? inferRank(names, singleNames ? LISTED : HOLDINGS),
        measure,
        overTime: revision.overTime ?? (measure === wasMeasure ? wasOverTime : measure === "return"),
        worst: revision.worst ?? false,
        singleNames,
        raw: revision.raw,
      });
      return { ...next, subject: finding.subject, emphasis: revision.emphasis ?? finding.emphasis };
    }

    // Any other comparison — sector mix, attribution — can still be narrowed and
    // can still have its history dropped, both without inventing data.
    let entities = finding.entities;
    if (revision.count !== undefined && revision.count >= 2) {
      entities = [...entities]
        .sort((a, b) => (revision.worst ? a.value - b.value : b.value - a.value))
        .slice(0, revision.count);
    } else if (revision.worst) {
      entities = [...entities].sort((a, b) => a.value - b.value);
    }
    if (revision.overTime === false) {
      entities = entities.map((entity) => ({ ...entity, series: undefined }));
    }
    if (entities === finding.entities) return null;
    return { ...finding, id: `${finding.id}-r${entities.length}`, entities };
  }

  if (finding.kind === "composition" && revision.count !== undefined && revision.count >= 2) {
    // Narrowing a whole means the remainder still has to be shown, or the parts
    // stop summing to the thing they are parts of.
    const sorted = [...finding.parts].sort((a, b) => b.value - a.value);
    const kept = sorted.slice(0, revision.count);
    const rest = sorted.slice(revision.count).reduce((sum, part) => sum + part.value, 0);
    return {
      ...finding,
      id: `${finding.id}-top${revision.count}`,
      parts: rest > 0.001 ? [...kept, { label: "Everything else", value: rest }] : kept,
    };
  }

  return null;
}

/* -------------------------------------------------------------------- topics */

type Topic = {
  id: string;
  /** Words that mean this topic is being asked about. */
  terms: string[];
  /** Included in a bare "give me the analysis" report. */
  inOverview: boolean;
  /**
   * Stated as findings, shaped by the interpreted ask. Most topics don't need it
   * — a topic only reads the Ask when the question can be asked at different
   * widths or from different ends ("top 4", "worst two", "by return").
   */
  findings: (ask: Ask) => Finding[];
};

const TOPICS: Topic[] = [
  {
    id: "value",
    terms: ["value", "aum", "total", "worth", "size", "overview", "summary", "snapshot", "position", "portfolio", "analysis", "analyse", "analyze"],
    inOverview: true,
    findings: () => [
      {
        id: "aum",
        kind: "metric",
        subject: "Overview",
        emphasis: "primary",
        confidence: 0.98,
        sources: ["Custody positions", "Valuations"],
        label: "Total portfolio value",
        value: PORTFOLIO.totalValueDisplay,
        delta: {
          label: `${pct(PORTFOLIO.quarterChangePct)} QoQ`,
          value: PORTFOLIO.quarterChangePct,
          sentiment: "positive",
        },
        series: series("Portfolio value", PORTFOLIO.valueSeries),
      },
      {
        id: "liquid",
        kind: "metric",
        subject: "Overview",
        emphasis: "secondary",
        confidence: 0.94,
        sources: ["Custody positions"],
        label: "Liquid assets",
        value: PORTFOLIO.liquidAssetsDisplay,
        delta: {
          label: `S$${PORTFOLIO.liquidChangeM}m`,
          value: PORTFOLIO.liquidChangeM,
          sentiment: "negative",
        },
      },
      {
        id: "ltv",
        kind: "metric",
        subject: "Overview",
        emphasis: "secondary",
        confidence: 0.91,
        sources: ["Lending book"],
        label: "Loan-to-value",
        value: `${PORTFOLIO.loanToValuePct}%`,
        delta: { label: "flat", value: 0, sentiment: "neutral" },
      },
    ],
  },

  {
    id: "performance",
    terms: ["performance", "return", "returns", "benchmark", "outperform", "gain", "loss", "attribution", "yield", "volatility", "risk-adjusted", "sharpe", "drawdown"],
    inOverview: true,
    findings: () => [
      {
        id: "perf-summary",
        kind: "narrative",
        subject: "Performance",
        emphasis: "primary",
        confidence: 0.88,
        sources: ["Valuations", "Benchmarks"],
        heading: "Performance summary",
        text: `The portfolio is ahead of its ${PERFORMANCE.benchmarkName} over the last twelve months, almost entirely on US technology. Fixed income was flat and the private sleeve is carried at a Q1 mark.`,
        deltas: [
          { label: `Portfolio ${pct(PORTFOLIO.yearChangePct)}`, value: PORTFOLIO.yearChangePct, sentiment: "positive" },
          { label: `Benchmark ${pct(PORTFOLIO.benchmarkYearChangePct)}`, value: PORTFOLIO.benchmarkYearChangePct, sentiment: "neutral" },
          { label: `Volatility ${PERFORMANCE.volatilityPct}%`, value: PERFORMANCE.volatilityPct, sentiment: "neutral" },
        ],
      },
      {
        id: "perf-vs-benchmark",
        kind: "comparison",
        subject: "Performance",
        emphasis: "primary",
        confidence: 0.93,
        sources: ["Valuations", "Benchmarks"],
        label: "Portfolio against benchmark",
        measure: "Indexed total return",
        entities: [
          { name: "Portfolio", value: PORTFOLIO.yearChangePct, display: pct(PORTFOLIO.yearChangePct), series: series("Portfolio", PERFORMANCE.portfolioIndexed) },
          { name: PERFORMANCE.benchmarkName, value: PORTFOLIO.benchmarkYearChangePct, display: pct(PORTFOLIO.benchmarkYearChangePct), series: series("Benchmark", PERFORMANCE.benchmarkIndexed) },
        ],
      },
      {
        id: "attribution",
        kind: "comparison",
        subject: "Performance",
        emphasis: "secondary",
        confidence: 0.86,
        sources: ["Valuations"],
        label: "Contribution to return",
        measure: "Percentage points",
        entities: PERFORMANCE.attribution.map((row) => ({
          name: row.label,
          value: row.contributionPct,
          display: `${row.contributionPct > 0 ? "+" : ""}${row.contributionPct}pp`,
        })),
      },
    ],
  },

  {
    id: "allocation",
    terms: ["allocation", "asset class", "mix", "split", "breakdown", "composition", "diversif", "spread"],
    inOverview: true,
    findings: () => [
      {
        id: "allocation",
        kind: "composition",
        subject: "Allocation",
        emphasis: "primary",
        confidence: 0.96,
        sources: ["Custody positions"],
        label: "Allocation by asset class",
        parts: PORTFOLIO.assetClasses.map((row) => {
          const move = Math.round((row.share - row.prevShare) * 100);
          return {
            label: row.label,
            value: row.share,
            delta: move === 0 ? undefined : { label: `${move > 0 ? "+" : ""}${move}pp`, value: move, sentiment: "neutral" as const },
          };
        }),
      },
    ],
  },

  {
    id: "sectors",
    terms: ["sector", "technology", "tech", "financials", "healthcare", "industry", "industrials", "energy"],
    inOverview: true,
    findings: () => [
      {
        id: "tech-exposure",
        kind: "transition",
        subject: "Concentration",
        emphasis: "primary",
        confidence: 0.93,
        sources: ["Custody positions"],
        subjectLabel: "Technology exposure",
        from: `${PORTFOLIO.sectors[0].prevSharePct}%`,
        to: `${PORTFOLIO.sectors[0].sharePct}%`,
        sentiment: "negative",
        note: "Driven by price appreciation rather than new purchases.",
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
        entities: PORTFOLIO.sectors.map((row) => ({
          name: row.label,
          value: row.sharePct,
          display: `${row.sharePct}%`,
        })),
      },
    ],
  },

  {
    id: "holdings",
    terms: ["holding", "holdings", "stock", "stocks", "position", "positions", "biggest", "largest", "top", "concentration", "single-name", "nvidia", "microsoft", "compare", "comparison"],
    inOverview: true,
    findings: (ask) => [
      holdingsComparison(ask),
      {
        id: "concentration-flag",
        kind: "flag",
        subject: "Concentration",
        emphasis: "primary",
        confidence: 0.9,
        sources: ["Custody positions", "Investment policy statement"],
        severity: "warn",
        subjectLabel: "Single-name concentration",
        // The single-name guideline is about listed names, so the arithmetic has
        // to be over listed names whatever the ask narrowed to — otherwise the
        // sentence and the number disagree.
        detail: `${LISTED[0].name} and ${LISTED[1].name} are ${(LISTED[0].sharePct + LISTED[1].sharePct).toFixed(1)}% of the portfolio, above the 15% guideline in the client's own policy statement.`,
      },
      {
        id: "holdings-table",
        kind: "comparison",
        subject: "Concentration",
        emphasis: "supporting",
        confidence: 0.97,
        sources: ["Custody positions"],
        label: "Holdings by value",
        measure: "Share of portfolio",
        // The full book, whatever the ask narrowed to — context for the pick.
        entities: [...HOLDINGS].sort((a, b) => b.valueM - a.valueM).map((holding) => ({
          name: holding.name,
          value: holding.sharePct,
          display: `${holding.sharePct}% · S$${holding.valueM}m`,
        })),
      },
    ],
  },

  {
    id: "currency",
    terms: ["currency", "fx", "hedge", "hedged", "usd", "inr", "eur", "sgd", "exchange"],
    inOverview: false,
    findings: () => [
      {
        id: "fx-mix",
        kind: "composition",
        subject: "Currency",
        emphasis: "primary",
        confidence: 0.94,
        sources: ["Custody positions"],
        label: "Exposure by currency",
        parts: PORTFOLIO.currencies.map((row) => ({ label: row.label, value: row.sharePct / 100 })),
      },
      {
        id: "fx-unhedged",
        kind: "flag",
        subject: "Currency",
        emphasis: "secondary",
        confidence: 0.88,
        sources: ["Custody positions", "Hedging book"],
        severity: "info",
        subjectLabel: "Unhedged INR exposure",
        detail: "11% of the portfolio is INR-denominated and entirely unhedged, against a 30%-hedged USD book.",
      },
    ],
  },

  {
    id: "geography",
    terms: ["geography", "geographic", "region", "country", "us", "india", "europe", "asia"],
    inOverview: false,
    findings: () => [
      {
        id: "geo-mix",
        kind: "composition",
        subject: "Geography",
        emphasis: "primary",
        confidence: 0.93,
        sources: ["Custody positions"],
        label: "Exposure by region",
        parts: PORTFOLIO.geographies.map((row) => ({ label: row.label, value: row.sharePct / 100 })),
      },
    ],
  },

  {
    id: "liquidity",
    terms: ["liquidity", "liquid", "cash", "cashflow", "cash flow", "funding", "fund", "raise", "withdraw", "capital call"],
    inOverview: true,
    findings: () => [
      {
        id: "liquidity-need",
        kind: "requirement",
        subject: "Liquidity",
        emphasis: "primary",
        confidence: 0.85,
        sources: ["Meeting notes", "Lending book"],
        amount: GOALS[0].amountDisplay,
        purpose: GOALS[0].label,
        deadline: GOALS[0].horizon,
        note: GOALS[0].status,
      },
      {
        id: "cash-trend",
        kind: "trend",
        subject: "Liquidity",
        emphasis: "secondary",
        confidence: 0.9,
        sources: ["Custody positions"],
        label: "Net monthly cash flow",
        series: series("Net cash flow (S$m)", CASHFLOW.monthlyNetM),
        delta: {
          label: `Net contributions S$${CASHFLOW.netContributionsM}m`,
          value: CASHFLOW.netContributionsM,
          sentiment: "positive",
        },
      },
      {
        id: "upcoming-flows",
        kind: "comparison",
        subject: "Liquidity",
        emphasis: "secondary",
        confidence: 0.87,
        sources: ["Custody positions", "Fund administrator"],
        label: "Known flows ahead",
        measure: "S$m",
        entities: CASHFLOW.upcoming.map((row) => ({
          name: `${row.label} (${row.when})`,
          value: row.amountM,
          display: `${row.amountM > 0 ? "+" : ""}S$${Math.abs(row.amountM)}m`,
        })),
      },
    ],
  },

  {
    id: "liabilities",
    terms: ["debt", "loan", "borrow", "leverage", "lombard", "mortgage", "liabilit", "ltv", "facility", "rate"],
    inOverview: false,
    findings: () => [
      {
        id: "debt-total",
        kind: "metric",
        subject: "Borrowing",
        emphasis: "primary",
        confidence: 0.96,
        sources: ["Lending book"],
        label: "Total borrowing",
        value: `S$${LIABILITIES.totalM}m`,
        delta: {
          label: `LTV ${LIABILITIES.loanToValuePct}% of ${LIABILITIES.policyLimitPct}% limit`,
          value: 0,
          sentiment: "neutral",
        },
      },
      {
        id: "facilities",
        kind: "comparison",
        subject: "Borrowing",
        emphasis: "secondary",
        confidence: 0.95,
        sources: ["Lending book"],
        label: "Facilities outstanding",
        measure: "S$m",
        entities: LIABILITIES.facilities.map((row) => ({
          name: `${row.label} @ ${row.ratePct}%`,
          value: row.outstandingM,
          display: `S$${row.outstandingM}m`,
        })),
      },
      {
        id: "rate-note",
        kind: "narrative",
        subject: "Borrowing",
        emphasis: "secondary",
        confidence: 0.8,
        sources: ["Meeting notes", "Lending book"],
        heading: "The client's own position on borrowing",
        text: "At the June review the client said he is uncomfortable borrowing against the portfolio while rates are above 4%. The Lombard facility resets in November 2026.",
      },
    ],
  },

  {
    id: "goals",
    terms: ["goal", "goals", "plan", "objective", "property", "education", "philanthropy", "venture", "son", "daughter", "family"],
    inOverview: false,
    findings: () => [
      ...GOALS.map((goal, i): Finding => ({
        id: `goal-${i}`,
        kind: "requirement",
        subject: "Goals",
        emphasis: i === 0 ? "primary" : "secondary",
        confidence: 0.84,
        sources: ["Meeting notes", "Financial plan"],
        amount: goal.amountDisplay,
        purpose: goal.label,
        deadline: goal.horizon,
        note: goal.status,
      })),
      {
        id: "goal-funding",
        kind: "comparison",
        subject: "Goals",
        emphasis: "supporting",
        confidence: 0.8,
        sources: ["Financial plan"],
        label: "How funded each goal is",
        measure: "Share funded",
        entities: GOALS.map((goal) => ({
          name: goal.label,
          value: Math.round(goal.fundedPct * 100),
          display: `${Math.round(goal.fundedPct * 100)}%`,
        })),
      },
    ],
  },

  {
    id: "risks",
    terms: ["risk", "risks", "exposure", "concern", "issue", "problem", "breach", "policy", "watch"],
    inOverview: true,
    findings: () =>
      RISKS.map((risk, i): Finding => ({
        id: `risk-${i}`,
        kind: "flag",
        subject: "Risks",
        emphasis: i === 0 ? "primary" : "secondary",
        confidence: 0.87,
        sources: ["Risk policy", "Custody positions"],
        severity: risk.severity as "info" | "warn" | "critical",
        subjectLabel: risk.label,
        detail: risk.detail,
      })),
  },

  {
    id: "meetings",
    terms: ["meeting", "meetings", "notes", "said", "discussed", "agreed", "last time", "conversation", "call", "review"],
    inOverview: false,
    findings: () =>
      MEETINGS.map((meeting, i): Finding => ({
        id: `meeting-${i}`,
        kind: "narrative",
        subject: "What was discussed",
        emphasis: i === 0 ? "primary" : "supporting",
        confidence: 0.95,
        sources: ["Meeting notes"],
        heading: `${meeting.kind} — ${meeting.date}`,
        text: meeting.notes.map((note) => `- ${note}`).join("\n"),
      })),
  },

  {
    id: "actions",
    terms: ["recommend", "recommendation", "action", "should", "advice", "next step", "suggest", "rebalance", "trim", "what do i do"],
    inOverview: true,
    findings: () => [
      {
        id: "rebalance-rec",
        kind: "recommendation",
        subject: "What to do next",
        emphasis: "primary",
        confidence: 0.79,
        sources: ["Risk policy", "Valuations"],
        title: "Trim the top two holdings toward the policy guideline",
        rationale:
          "Bringing the top two positions back to the 15% guideline releases roughly S$1.2m toward the property requirement without touching the private markets sleeve or drawing on the Lombard facility the client is uneasy about.",
        action: "Model a 4% trim across NVIDIA and Microsoft",
      },
      {
        id: "maturity-rec",
        kind: "recommendation",
        subject: "What to do next",
        emphasis: "secondary",
        confidence: 0.83,
        sources: ["Custody positions"],
        title: "Hold next month's bond maturity in cash",
        rationale:
          "S$800k matures next month and a S$0.6m capital call lands within six weeks. Holding it rather than reinvesting covers the call without selling equity.",
        action: "Flag the maturity as uninvested",
      },
    ],
  },

  /**
   * The open loop. Everything in the book that is *waiting on someone* — a goal
   * whose funding route is still undecided, a risk that has been flagged and not
   * yet acted on — collected into one list.
   *
   * It is deliberately a distinct kind rather than ten recommendation cards: the
   * advisor's question here is "what is outstanding", and the answer to that is a
   * list you work down, not ten paragraphs of rationale. A recommendation argues
   * for a course of action; a to-do just needs ticking.
   */
  {
    id: "todos",
    terms: ["to do", "todo", "to-do", "outstanding", "open", "pending", "follow up", "follow-up", "checklist", "tick", "action list", "loose ends", "chase", "waiting"],
    inOverview: true,
    findings: () => {
      const items = [
        // "Discussed, not committed" and "Funding route undecided" are the book's
        // way of saying a decision is owed. Anything already settled is not a task.
        ...GOALS.filter((goal) => /undecided|not committed|pending|awaiting|to be/i.test(goal.status)).map(
          (goal) => ({
            text: `Settle how ${goal.label.toLowerCase()} gets funded (${goal.amountDisplay}, ${goal.horizon})`,
            state: "todo" as const,
            due: goal.horizon,
          }),
        ),
        ...RISKS.filter((risk) => risk.severity === "warn").map((risk) => ({
          text: `Bring ${risk.label.toLowerCase()} back inside policy`,
          state: "doing" as const,
        })),
        {
          text: "Confirm the mandate and fee schedule at the next review",
          state: "todo" as const,
        },
      ];

      return [
        {
          id: "open-items",
          kind: "checklist",
          subject: "What's outstanding",
          emphasis: "primary",
          confidence: 0.82,
          sources: ["Meeting notes", "Financial plan", "Risk policy"],
          label: "Open items",
          items,
        },
      ];
    },
  },
];

/* -------------------------------------------------------------------- facts
 *
 * The other half of the logic layer's decision. A question with a one-sentence
 * answer gets a sentence: no cards, no assembly animation, no report. Twenty-two
 * blocks in answer to "what is the client's name?" is the failure mode this
 * table exists to prevent.
 */

type Fact = { terms: RegExp; answer: () => string };

const FACTS: Fact[] = [
  {
    terms: /\b(name|who is|who's|called)\b/,
    answer: () =>
      `${CLIENT.name} — a ${CLIENT.segment.toLowerCase()} client in ${CLIENT.location}, with us since ${CLIENT.clientSince}.`,
  },
  {
    terms: /\b(relationship manager|rm|who covers|who looks after|adviser|advisor)\b/,
    answer: () => `${CLIENT.relationship.manager} covers the relationship, on a ${CLIENT.relationship.contactCadence.toLowerCase()} cadence.`,
  },
  {
    terms: /\b(family|spouse|wife|husband|children|kids|son|daughter)\b/,
    answer: () =>
      `${CLIENT.family.map((member) => `${member.name} (${member.role.toLowerCase()}, ${member.age})`).join("; ")}.`,
  },
  {
    terms: /\b(risk profile|mandate|risk appetite)\b/,
    answer: () => `${CLIENT.riskProfile}, reconfirmed at the February 2026 planning meeting.`,
  },
  {
    terms: /\b(next (?:review|meeting)|when (?:do we|are we) meet)\b/,
    answer: () => `Next review is ${CLIENT.relationship.nextReview}; the last one was ${CLIENT.relationship.lastReview}.`,
  },
  {
    terms: /\b(last (?:meeting|review|call)|when did we (?:meet|speak))\b/,
    answer: () => `${MEETINGS[0].kind} on ${MEETINGS[0].date} with ${MEETINGS[0].with}.`,
  },
  {
    terms: /\b(aum|total value|portfolio value|how much (?:is|does).*(?:worth|have)|net worth|how big)\b/,
    answer: () =>
      `${PORTFOLIO.totalValueDisplay}, up ${PORTFOLIO.quarterChangePct}% on the quarter and ${PORTFOLIO.yearChangePct}% on the year.`,
  },
  {
    terms: /\b(liquid|cash|dry powder)\b/,
    answer: () =>
      `${PORTFOLIO.liquidAssetsDisplay} liquid, down S$${Math.abs(PORTFOLIO.liquidChangeM)}m on the quarter — S$0.6m of it already committed to a capital call.`,
  },
  {
    terms: /\b(ltv|loan.to.value|leverage|borrow|debt|owe)\b/,
    answer: () =>
      `${PORTFOLIO.loanToValuePct}% loan-to-value — S$${LIABILITIES.totalM}m drawn against a ${LIABILITIES.policyLimitPct}% policy limit.`,
  },
  {
    terms: /\b(biggest|largest) (?:holding|position)\b/,
    answer: () => {
      const [top] = [...HOLDINGS].sort((a, b) => b.valueM - a.valueM);
      return `${top.name}, S$${top.valueM}m — ${top.sharePct}% of the portfolio.`;
    },
  },
  {
    terms: /\b(fee|fees|charged)\b/,
    answer: () => `${PORTFOLIO.feesYtdDisplay} year to date, against a ${PORTFOLIO.incomeYieldPct}% income yield.`,
  },
  {
    terms: /\b(benchmark|beating|ahead of)\b/,
    answer: () =>
      `Up ${PORTFOLIO.yearChangePct}% against ${PORTFOLIO.benchmarkYearChangePct}% for the ${PERFORMANCE.benchmarkName.toLowerCase()} — ${(PORTFOLIO.yearChangePct - PORTFOLIO.benchmarkYearChangePct).toFixed(1)}pp ahead.`,
  },
  {
    terms: /\b(volatilit|sharpe|drawdown|risk.adjusted)\b/,
    answer: () =>
      `${PERFORMANCE.volatilityPct}% volatility against ${PERFORMANCE.benchmarkVolatilityPct}% for the benchmark, Sharpe ${PERFORMANCE.sharpe}, worst drawdown ${PERFORMANCE.maxDrawdownPct}%.`,
  },
  {
    terms: /\b(tax|residenc)\b/,
    answer: () => `Tax resident in ${CLIENT.taxResidency}, confirmed at the February 2026 planning meeting.`,
  },
  {
    terms: /\b(hedge|hedged|unhedged|fx|currency)\b/,
    answer: () =>
      PORTFOLIO.currencies
        .map((row) => `${row.label} ${row.sharePct}% (${row.hedgedPct}% hedged)`)
        .join(", ") + ".",
  },
  {
    terms: /\b(goal|goals|objective|planning for|saving for)\b/,
    answer: () =>
      GOALS.map((goal) => `${goal.label} ${goal.amountDisplay}, ${goal.horizon}`).join("; ") + ".",
  },
  {
    terms: /\b(document|policy statement|deed|paperwork)\b/,
    answer: () => DOCUMENTS.map((doc) => `${doc.label} (${doc.updated})`).join(", ") + ".",
  },
];

/**
 * Answer a lookup from the book, or null if the book doesn't hold it.
 *
 * Null is a real answer here — "that isn't in the file" is more useful than a
 * report the advisor didn't ask for.
 */
export function localFact(prompt: string): string | null {
  const p = ` ${prompt.toLowerCase()} `;
  for (const fact of FACTS) {
    if (fact.terms.test(p)) return fact.answer();
  }
  return null;
}

/* ------------------------------------------------------------------ matching */

const scoreTopic = (topic: Topic, prompt: string): number => {
  const lower = ` ${prompt.toLowerCase()} `;
  return topic.terms.reduce((score, term) => (lower.includes(term) ? score + 1 : score), 0);
};

const dedupe = (findings: Finding[]): Finding[] => {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) return false;
    seen.add(finding.id);
    return true;
  });
};

const titleFor = (matched: Topic[], prompt: string): string => {
  if (matched.length === 0) return "Portfolio overview";
  if (matched.length > 3) return `${CLIENT.name.split(" ")[0]} — portfolio analysis`;

  const words = prompt.trim().replace(/[?.!]+$/, "");
  return words.length > 4 && words.length < 60
    ? words[0].toUpperCase() + words.slice(1)
    : matched.map((topic) => topic.id).join(" · ");
};

/** What the local analyst produces for an arbitrary ask. */
export type LocalAnswer = {
  reply: string;
  title: string;
  findings: Finding[];
};

export function localAnalyse(prompt: string): LocalAnswer {
  const scored = TOPICS.map((topic) => ({ topic, score: scoreTopic(topic, prompt) })).filter(
    (entry) => entry.score > 0,
  );
  scored.sort((a, b) => b.score - a.score);

  // "Give me a portfolio analysis", "how are things looking", "prepare for the
  // review" — a request for the whole picture rather than for one topic. This is
  // checked *independently* of the term scores: an ask for everything doesn't
  // have to name a single topic to be a legitimate, fully answerable ask.
  const asksForEverything =
    /\b(analys|analyz|report|review|everything|full|overall|briefing|brief me|prepare|portfolio|how (?:is|are)|state of|where (?:do|does|things)|summar)/i.test(
      prompt,
    );

  const matched = asksForEverything
    ? [...new Set([...scored.map((entry) => entry.topic), ...TOPICS.filter((topic) => topic.inOverview)])]
    : scored.length > 0
      ? scored.slice(0, 3).map((entry) => entry.topic)
      : TOPICS.filter((topic) => topic.inOverview);

  // The only case that warrants a caveat: the ask named something, none of it was
  // in the book, and it wasn't a request for the whole picture either.
  const nothingMatched = scored.length === 0 && !asksForEverything;

  const ask = interpret(prompt);
  const findings = dedupe(matched.flatMap((topic) => topic.findings(ask)));

  // Nothing matched at all: still answer, and be explicit about the edge of what
  // the book covers rather than pretending the overview was the question.
  if (nothingMatched) {
    findings.unshift({
      id: "scope-note",
      kind: "narrative",
      subject: "Overview",
      emphasis: "supporting",
      confidence: 0.5,
      sources: ["Client book"],
      heading: "On the ask",
      text: `Nothing in ${CLIENT.name}'s file speaks directly to that, so this is the portfolio as it stands. The file covers valuations, holdings, allocation, currency, borrowing, cash flow, goals, risks and meeting notes.`,
    });
  }

  return {
    reply: nothingMatched
      ? "I couldn't find that in the file, so here's where the portfolio stands — say which part you want to go deeper on."
      : asksForEverything
        ? `Read ${CLIENT.name.split(" ")[0]}'s file end to end and built the analysis around what stood out — valuation, performance, allocation, concentration and what needs a decision.`
        : `Pulled the ${matched.map((topic) => topic.id).join(", ")} together and built a report from what stood out.`,
    title: titleFor(matched, prompt),
    findings,
  };
}
