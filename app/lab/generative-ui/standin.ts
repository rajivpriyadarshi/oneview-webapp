/**
 * The stand-in analyst — the pipeline with no model behind it.
 *
 * When no API key is configured the layers that need a model cannot run, and there
 * are two honest options: show the lab dead, or produce the same artifacts
 * deterministically from the same data. This is the second. It writes an intent
 * plan, a prose answer and a semantic report, from the bundle only, and everything
 * downstream — composition, recipe selection, validation, rendering — runs
 * identically. The chat says "local" so nobody mistakes it for the model.
 *
 * It is also the cheapest test of the architecture that exists: if the composer
 * needs a model to produce a good page, the composer is wrong. These reports are
 * plain and the pages they produce are not, which is the claim the whole design
 * rests on.
 *
 * Scope, stated plainly: this covers the five shapes the lab demonstrates. It is a
 * fixture with a keyword matcher on the front, not an analyst. Real coverage comes
 * from the model.
 */

import { CLIENT } from "../dynamic-ui/clientBook";
import type { DataBundle } from "./data";
import type { Delta, Finding, Series } from "./findings";
import type { IntentPlan, TaskType } from "./intent";
import type { SemanticReport, SemanticSection } from "./semantic";

/* ------------------------------------------------------------------ helpers */

type Row = Record<string, unknown>;

const get = <T>(bundle: DataBundle, key: string): T | undefined =>
  key in bundle.values ? (bundle.values[key] as T) : undefined;

const pct = (value: number): string => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const money = (millions: number): string =>
  Math.abs(millions) >= 1 ? `S$${Math.abs(millions).toFixed(1)}m` : `S$${Math.round(Math.abs(millions) * 1000)}k`;

const delta = (value: number, label: string, good: boolean): Delta => ({
  label,
  value,
  sentiment: good ? "positive" : "negative",
});

let ordinal = 0;
/** Stable within a report because it is reset on entry, not because it is global. */
const fid = (prefix: string): string => {
  ordinal += 1;
  return `${prefix}_${ordinal}`;
};

const section = (
  id: string,
  semanticType: SemanticSection["semanticType"],
  question: string,
  importance: SemanticSection["importance"],
  dataKeys: string[],
  findings: Finding[],
  groups?: string[],
): SemanticSection => ({ id, semanticType, question, importance, dataKeys, findings, ...(groups ? { groups } : {}) });

/* --------------------------------------------------------------- layer 1 */

type Shape = {
  taskType: TaskType;
  goal: string;
  because: string;
  surface: "text" | "view";
  needs: IntentPlan["needs"];
  requests: [string, string, Record<string, unknown>?][];
};

const REQUESTS = {
  summary: ["pf.summary", "portfolio.summary"] as [string, string],
  series: ["perf.series", "performance.series"] as [string, string],
  sectors: ["alloc.sector", "portfolio.allocation", { dimension: "sector" }] as [string, string, Row],
  classes: ["alloc.class", "portfolio.allocation", { dimension: "asset_class" }] as [string, string, Row],
  attribution: ["perf.attribution", "performance.attribution"] as [string, string],
  risks: ["risk.open", "risks.list"] as [string, string],
  cash: ["cash.schedule", "cashflow.schedule"] as [string, string],
  goals: ["goals.open", "goals.list"] as [string, string],
  debt: ["debt.facilities", "liabilities.facilities"] as [string, string],
  holdings: ["holdings.top", "portfolio.holdings", { limit: 5, sortBy: "value" }] as [string, string, Row],
  who: ["client.who", "client.profile"] as [string, string],
  meetings: ["notes.recent", "meetings.recent", { limit: 2 }] as [string, string, Row],
};

const NEEDS = (over: Partial<IntentPlan["needs"]> = {}): IntentPlan["needs"] => ({
  comparison: false,
  chronology: false,
  actions: false,
  composition: false,
  ...over,
});

/** Keyword matching, and it does not pretend to be anything else. */
function shapeOf(query: string): Shape {
  const q = query.toLowerCase();

  /*
   * Stems, not whole words. `\bcompare\b` does not match "comparison" or "comparing",
   * which is how "add comparison for top 5 holdings" fell through to the default
   * review shape and came back word-for-word identical to the question before it.
   * A keyword matcher that silently agrees with the previous turn is worse than one
   * that misses, so the patterns here match the stem and stop.
   */
  if (/\b(compar|versus|vs\.?|against each other|two biggest|side by side|top \d+ holdings)/.test(q)) {
    const asked = Number(/\btop (\d+)\b/.exec(q)?.[1] ?? 0);
    return {
      taskType: "comparison",
      goal: "Weigh the largest positions against each other.",
      because: "Several things have to be read side by side, which is a layout, not a sentence.",
      surface: "view",
      // How many are being compared changes the presentation downstream — two is a
      // pair of cards, five is a table — so the count comes off the question.
      needs: NEEDS({ comparison: true, count: asked > 1 ? Math.min(asked, 10) : 2 }),
      requests: [REQUESTS.holdings, REQUESTS.series, REQUESTS.summary],
    };
  }

  if (/\b(fund|funding|liquidity|cash|property|afford|raise)\b/.test(q)) {
    return {
      taskType: "liquidity_planning",
      goal: "Work out how the near-term commitments get funded.",
      because: "Amounts tied to dates, so the calendar is the argument.",
      surface: "view",
      needs: NEEDS({ chronology: true, actions: true }),
      requests: [REQUESTS.summary, REQUESTS.cash, REQUESTS.goals, REQUESTS.debt, REQUESTS.risks],
    };
  }

  if (/\b(risk|concentration|exposure|hedge|breach|policy)\b/.test(q)) {
    return {
      taskType: "risk_review",
      goal: "Review where the portfolio is exposed.",
      because: "Several exposures to weigh against the policy, not one figure.",
      surface: "view",
      needs: NEEDS({ composition: true, actions: true }),
      requests: [REQUESTS.risks, REQUESTS.sectors, REQUESTS.summary],
    };
  }

  if (/\b(meeting|prep|prepare|talking points|agenda)\b/.test(q)) {
    return {
      taskType: "meeting_prep",
      goal: "Prepare for the next conversation with this client.",
      because: "Identity first, then the position, then what to raise.",
      surface: "view",
      needs: NEEDS({ actions: true }),
      requests: [REQUESTS.who, REQUESTS.summary, REQUESTS.goals, REQUESTS.risks],
    };
  }

  if (/^(who|when|what is|what's|which|how much is|is )\b/.test(q) && q.length < 60) {
    return {
      taskType: "lookup",
      goal: "Answer a single factual question.",
      because: "One attribute of one client — the answer is a sentence.",
      surface: "text",
      needs: NEEDS(),
      requests: [REQUESTS.who, REQUESTS.summary],
    };
  }

  return {
    taskType: "portfolio_review",
    goal: "Review how the portfolio is doing and what changed.",
    because: "Several figures, an attribution and a set of risks — that has a shape.",
    surface: "view",
    needs: NEEDS({ composition: true }),
    requests: [
      REQUESTS.summary,
      REQUESTS.series,
      REQUESTS.attribution,
      REQUESTS.sectors,
      REQUESTS.risks,
      REQUESTS.goals,
    ],
  };
}

export function standInPlan(query: string): IntentPlan {
  const shape = shapeOf(query);
  return {
    taskType: shape.taskType,
    goal: shape.goal,
    scope: { kind: "client", ids: ["prashanth-kumar"] },
    timeRange: { kind: "rolling", label: "Twelve months" },
    needs: shape.needs,
    register: shape.taskType === "lookup" ? "factual" : "analytical",
    surface: shape.surface,
    because: shape.because,
    dataRequests: shape.requests.map(([key, tool, args], index) => ({
      key,
      tool,
      args: args ?? {},
      required: index === 0,
    })),
  };
}

/* --------------------------------------------------------------- layer 2.5 */

type Summary = {
  totalValue: string;
  yearChangePct: number;
  quarterChangePct: number;
  benchmarkYearChangePct: number;
  liquidAssets: string;
  liquidChangeM: number;
  loanToValuePct: number;
  valueSeries: { label: string; value: number }[];
};
type Attribution = { label: string; contributionPct: number };
type Sector = { label: string; sharePct: number; prevSharePct?: number };
type Risk = { label: string; severity: string; detail: string };
type Upcoming = { label: string; amountM: number; when: string };
type Goal = { label: string; amountDisplay: string; horizon: string; status: string };
type Holding = { name: string; sharePct: number; returnYtdPct: number; valueM: number; indexed: { label: string; value: number }[] };
type Who = { name: string; segment: string; riskProfile: string; relationshipManager: string; nextReview: string };

/**
 * The prose answer, assembled from whichever data arrived.
 *
 * Written as the fallback it is: complete sentences, conclusion first, and it has to
 * stand alone because §14 says the answer always remains available.
 */
export function standInAnswer(plan: IntentPlan, bundle: DataBundle): string {
  const summary = get<Summary>(bundle, "pf.summary");
  const risks = get<Risk[]>(bundle, "risk.open") ?? [];
  const cash = get<{ upcoming: Upcoming[] }>(bundle, "cash.schedule");
  const holdings = get<Holding[]>(bundle, "holdings.top") ?? [];
  const who = get<Who>(bundle, "client.who");
  const attribution = get<Attribution[]>(bundle, "perf.attribution") ?? [];

  const paragraphs: string[] = [];

  if (plan.taskType === "lookup" && who) {
    return `${who.name} is a ${who.segment.toLowerCase()} client on a ${who.riskProfile.toLowerCase()} risk profile, covered by ${who.relationshipManager}. The next review is booked for ${who.nextReview}.`;
  }

  if (summary) {
    paragraphs.push(
      `The portfolio is at ${summary.totalValue}, ${pct(summary.yearChangePct)} over twelve months against ${pct(summary.benchmarkYearChangePct)} for the benchmark, and ${pct(summary.quarterChangePct)} over the quarter. Liquid assets stand at ${summary.liquidAssets}, ${summary.liquidChangeM < 0 ? "down" : "up"} ${money(summary.liquidChangeM)} on the period, with loan-to-value at ${summary.loanToValuePct}% against a 35% policy limit.`,
    );
  }

  if (holdings.length >= 2) {
    const [first, second] = holdings;
    paragraphs.push(
      `${first.name} is the larger position at ${first.sharePct}% of the portfolio and has returned ${pct(first.returnYtdPct)} this year; ${second.name} is ${second.sharePct}% and has returned ${pct(second.returnYtdPct)}. Together they are ${(first.sharePct + second.sharePct).toFixed(1)}% of the book, which is above the 15% single-name guideline in the client's own investment policy statement.`,
    );
  }

  if (attribution.length > 0) {
    const best = attribution[0];
    const worst = [...attribution].sort((a, b) => a.contributionPct - b.contributionPct)[0];
    paragraphs.push(
      `The return came mostly from ${best.label.toLowerCase()}, at ${pct(best.contributionPct)}, while ${worst.label.toLowerCase()} cost ${pct(worst.contributionPct)}. The concentration that produced the gain is the same concentration that now needs a decision.`,
    );
  }

  if (cash && cash.upcoming.length > 0) {
    paragraphs.push(
      `On the calendar: ${cash.upcoming
        .map((entry) => `${entry.label.toLowerCase()} of ${money(entry.amountM)} ${entry.when}`)
        .join(", ")}. Netting those against liquid assets is what determines whether the property purchase needs the facility drawn.`,
    );
  }

  if (risks.length > 0) {
    paragraphs.push(
      `Two things need attention: ${risks
        .slice(0, 2)
        .map((risk) => risk.detail.replace(/\s+$/, ""))
        .join(" ")}`,
    );
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
      "None of the data needed to answer this came back, so there is nothing here I can stand behind.",
    );
  }

  return paragraphs.join("\n\n");
}

/* ----------------------------------------------------------------- layer 3 */

/**
 * The semantic report, from the bundle.
 *
 * Note the two sections built from one attribution list: contributors and
 * detractors, sharing an identical `question` and each naming its own `groups`. That
 * is the exact input the tabs rule looks for, and it is here because it is the shape
 * the real data has — not to exercise the rule.
 */
export function standInReport(plan: IntentPlan, bundle: DataBundle, narrative: string): SemanticReport {
  ordinal = 0;

  const summary = get<Summary>(bundle, "pf.summary");
  const series = get<{ benchmarkName: string; portfolio: Series["points"]; benchmark: Series["points"] }>(
    bundle,
    "perf.series",
  );
  const sectors = get<Sector[]>(bundle, "alloc.sector");
  const attribution = get<Attribution[]>(bundle, "perf.attribution");
  const risks = get<Risk[]>(bundle, "risk.open");
  const cash = get<{ upcoming: Upcoming[] }>(bundle, "cash.schedule");
  const goals = get<Goal[]>(bundle, "goals.open");
  const holdings = get<Holding[]>(bundle, "holdings.top");
  const who = get<Who>(bundle, "client.who");
  const debt = get<{ loanToValuePct: number; policyLimitPct: number }>(bundle, "debt.facilities");

  const meta = { emphasis: "secondary" as const, confidence: 0.9, sources: [] as string[] };
  const sections: SemanticSection[] = [];

  /* The lead: what the answer says, in one claim. */
  sections.push(
    section("s_summary", "summary", "Where does this stand?", "primary", summary ? ["pf.summary"] : [], [
      {
        ...meta,
        kind: "narrative",
        id: fid("f"),
        emphasis: "primary",
        subject: "Summary",
        text: narrative.split("\n\n")[0] ?? narrative,
        ...(summary
          ? {
              deltas: [
                delta(summary.yearChangePct, `${pct(summary.yearChangePct)} 12m`, summary.yearChangePct > 0),
                delta(
                  summary.yearChangePct - summary.benchmarkYearChangePct,
                  `${pct(summary.yearChangePct - summary.benchmarkYearChangePct)} vs benchmark`,
                  summary.yearChangePct > summary.benchmarkYearChangePct,
                ),
              ],
            }
          : {}),
      },
    ]),
  );

  if (summary) {
    sections.push(
      section("s_performance", "performance", "How is the portfolio doing?", "primary", ["pf.summary", "perf.series"], [
        {
          ...meta,
          kind: "metric",
          id: fid("f"),
          emphasis: "primary",
          subject: "Portfolio value",
          label: "Portfolio value",
          value: summary.totalValue,
          // `basis` is what the figure is held against, in the analysis's words. The
          // stand-in writes it for the same reason the prompt asks the model for it: a
          // figure with no basis leaves the reader asking "of what?".
          basis: "across all custody accounts",
          delta: delta(summary.yearChangePct, pct(summary.yearChangePct), summary.yearChangePct > 0),
          series: { name: "Portfolio value", points: summary.valueSeries },
        },
        {
          ...meta,
          kind: "metric",
          id: fid("f"),
          subject: "Liquid assets",
          label: "Liquid assets",
          value: summary.liquidAssets,
          basis: "available without selling a position",
          delta: delta(summary.liquidChangeM, `${money(summary.liquidChangeM)} on the period`, summary.liquidChangeM > 0),
        },
        {
          ...meta,
          kind: "metric",
          id: fid("f"),
          subject: "Loan to value",
          label: "Loan to value",
          value: `${summary.loanToValuePct}%`,
          basis: "against pledged assets",
        },
      ]),
    );
  }

  if (series) {
    sections.push(
      section("s_vs_benchmark", "performance", "How does that compare with the benchmark?", "secondary", ["perf.series"], [
        {
          ...meta,
          kind: "comparison",
          id: fid("f"),
          subject: "Against the benchmark",
          label: "Against the benchmark",
          measure: "Indexed return",
          entities: [
            { name: "Portfolio", value: series.portfolio.at(-1)?.value ?? 100, series: { name: "Portfolio", points: series.portfolio } },
            { name: series.benchmarkName, value: series.benchmark.at(-1)?.value ?? 100, series: { name: series.benchmarkName, points: series.benchmark } },
          ],
        },
      ]),
    );
  }

  if (attribution && attribution.length > 0) {
    const up = attribution.filter((entry) => entry.contributionPct > 0);
    const down = attribution.filter((entry) => entry.contributionPct <= 0);
    const question = "What drove the return?";

    if (up.length > 0) {
      sections.push(
        section("s_contributors", "drivers", question, "secondary", ["perf.attribution"], [
          {
            ...meta,
            kind: "comparison",
            id: fid("f"),
            subject: "Contributors",
            label: "Contributors",
            measure: "Contribution to return",
            entities: up.map((entry) => ({ name: entry.label, value: entry.contributionPct, display: pct(entry.contributionPct) })),
          },
        ], ["Contributors"]),
      );
    }
    if (down.length > 0) {
      sections.push(
        section("s_detractors", "drivers", question, "secondary", ["perf.attribution"], [
          {
            ...meta,
            kind: "comparison",
            id: fid("f"),
            subject: "Detractors",
            label: "Detractors",
            measure: "Contribution to return",
            entities: down.map((entry) => ({ name: entry.label, value: entry.contributionPct, display: pct(entry.contributionPct) })),
          },
        ], ["Detractors"]),
      );
    }
  }

  if (sectors && sectors.length > 0) {
    const moved = [...sectors]
      .filter((entry) => entry.prevSharePct !== undefined)
      .sort((a, b) => Math.abs(b.sharePct - (b.prevSharePct ?? 0)) - Math.abs(a.sharePct - (a.prevSharePct ?? 0)))[0];
    sections.push(
      section("s_allocation", "allocation", "How is the portfolio made up?", "secondary", ["alloc.sector"], [
        {
          ...meta,
          kind: "composition",
          id: fid("f"),
          subject: "Sector weights",
          label: "Sector weights",
          parts: sectors.map((entry) => ({ label: entry.label, value: entry.sharePct / 100 })),
        },
        ...(moved
          ? [
              {
                ...meta,
                kind: "transition" as const,
                id: fid("f"),
                subject: moved.label,
                subjectLabel: `${moved.label} weight`,
                from: `${moved.prevSharePct}%`,
                to: `${moved.sharePct}%`,
                sentiment: "negative" as const,
                note: "Drift from performance rather than from a decision.",
              },
            ]
          : []),
      ]),
    );
  }

  if (holdings && holdings.length >= 2) {
    /*
     * Two positions is a pair held against each other; four or five is a book, and a
     * book is read by measure. So above three the fixture states the claim the way the
     * semantic layer is told to state it — one comparison finding per measure over the
     * same entities — which is the shape the presentation layer turns into a table.
     * Below that it stays a single measure with a history each, which is overlaid lines.
     */
    const wanted = Math.max(2, Math.min(plan.needs.count ?? 2, holdings.length));
    const compared = holdings.slice(0, wanted);
    const measures: { measure: string; of: (holding: Holding) => number; display: (holding: Holding) => string }[] =
      wanted > 3
        ? [
            { measure: "Weight", of: (h) => h.sharePct, display: (h) => `${h.sharePct.toFixed(1)}%` },
            { measure: "Return YTD", of: (h) => h.returnYtdPct, display: (h) => pct(h.returnYtdPct) },
            { measure: "Market value", of: (h) => h.valueM, display: (h) => money(h.valueM) },
          ]
        : [{ measure: "Indexed return", of: (h) => h.returnYtdPct, display: (h) => pct(h.returnYtdPct) }];

    sections.push(
      section("s_holdings", "comparison", "How do the largest positions compare?", "primary", ["holdings.top"], [
        ...measures.map((entry, index) => ({
          ...meta,
          kind: "comparison" as const,
          id: fid("f"),
          emphasis: index === 0 ? ("primary" as const) : ("secondary" as const),
          subject: "Largest positions",
          label: "Holding",
          measure: entry.measure,
          entities: compared.map((holding) => ({
            name: holding.name,
            value: entry.of(holding),
            display: entry.display(holding),
            // Only the single-measure case draws lines, and only there does carrying a
            // history per entity mean anything. In a table it is weight nobody reads.
            ...(measures.length === 1 ? { series: { name: holding.name, points: holding.indexed } } : {}),
          })),
        })),
      ]),
    );
  }

  if (who) {
    sections.push(
      section("s_identity", "identity", "Who is this?", "primary", ["client.who"], [
        {
          ...meta,
          kind: "narrative",
          id: fid("f"),
          emphasis: "primary",
          subject: who.name,
          heading: who.name,
          text: `${who.segment} client on a ${who.riskProfile.toLowerCase()} risk profile, covered by ${who.relationshipManager}. Next review ${who.nextReview}.`,
        },
      ]),
    );
  }

  if (cash && cash.upcoming.length > 0) {
    sections.push(
      section("s_commitments", "commitments", "What is coming up?", "primary", ["cash.schedule"], [
        ...cash.upcoming.map((entry) => ({
          ...meta,
          kind: "requirement" as const,
          id: fid("f"),
          subject: entry.label,
          amount: money(entry.amountM),
          purpose: entry.label,
          deadline: entry.when,
          note: entry.amountM < 0 ? "Money out." : "Money in.",
        })),
      ]),
    );
  }

  /*
   * Objectives, but only where they are the point.
   *
   * A performance review that also lists the client's goals is a review with one
   * section too many, and the page budget then cuts something that mattered more. An
   * editorial call, taken here in the report rather than left to the composer to
   * arbitrate by slot order.
   */
  if (goals && goals.length > 0 && (plan.needs.actions || plan.needs.chronology)) {
    sections.push(
      section("s_goals", "commitments", "What has the client committed to?", "secondary", ["goals.open"], [
        {
          ...meta,
          kind: "checklist",
          id: fid("f"),
          subject: "Objectives",
          label: "Objectives",
          items: goals.map((goal) => ({
            text: `${goal.label} — ${goal.amountDisplay}`,
            due: goal.horizon,
            state: goal.status.toLowerCase().includes("undecided") ? ("todo" as const) : ("doing" as const),
          })),
        },
      ]),
    );
  }

  if (risks && risks.length > 0) {
    sections.push(
      section("s_risk", "risk", "What needs attention?", "secondary", ["risk.open", ...(debt ? ["debt.facilities"] : [])], [
        ...risks.slice(0, 3).map((risk) => ({
          ...meta,
          kind: "flag" as const,
          id: fid("f"),
          subject: risk.label,
          severity: risk.severity === "warn" ? ("warn" as const) : ("info" as const),
          subjectLabel: risk.label,
          detail: risk.detail,
        })),
      ]),
    );
  }

  /* A recipe that promises a recommendation has to carry one. */
  if (plan.needs.actions || plan.needs.comparison) {
    const lead = risks?.[0];
    sections.push(
      /*
       * Bound to the risk it answers, not to the portfolio summary. Binding every
       * loose section to `pf.summary` is how one figure ends up rendered in three
       * places, which the validator is right to complain about.
       */
      section("s_recommendation", "recommendations", "What should we do?", "secondary", risks ? ["risk.open"] : holdings ? ["holdings.top"] : summary ? ["pf.summary"] : [], [
        {
          ...meta,
          kind: "recommendation",
          id: fid("f"),
          subject: "Recommendation",
          title: lead ? `Address ${lead.label.toLowerCase()} before the next review` : "Take the decision to the client",
          rationale:
            lead?.detail ??
            "The position is sound but the concentration behind it is now a decision rather than a drift.",
          action: "Put it on the agenda for the October review with a costed option either way.",
        },
      ]),
    );
  }

  /* Provenance, which the composer will put behind disclosure. */
  const keys = Object.keys(bundle.values);
  if (keys.length > 0) {
    sections.push(
      section("s_evidence", "evidence", "Where does this come from?", "supporting", keys, [
        {
          ...meta,
          kind: "narrative",
          id: fid("f"),
          emphasis: "supporting",
          confidence: 1,
          sources: [...new Set(Object.values(bundle.provenance).flatMap((entry) => entry.sources))],
          subject: "Sources",
          text: "Figures as held, at the stated valuation date. Private marks are carried at the last round.",
        },
      ]),
    );
  }

  /*
   * The title names the document, not the question. A report headed with the query
   * that produced it reads like a search result: it tells the reader what they typed,
   * which they know, instead of what they are holding. So: subject, then the kind of
   * report. The model is held to the same rule in STRUCTURE_SYSTEM.
   */
  const firstName = CLIENT.name.split(" ")[0];
  const TITLES: Partial<Record<TaskType, string>> = {
    portfolio_review: `${firstName}'s portfolio review`,
    comparison: `${firstName}'s largest positions compared`,
    liquidity_planning: `Funding ${firstName}'s near-term commitments`,
    risk_review: `${firstName}'s risk review`,
    meeting_prep: `Meeting preparation — ${firstName}`,
  };

  return {
    reportType: plan.taskType,
    title: TITLES[plan.taskType] ?? `${firstName}'s report`,
    summary: narrative.split("\n\n")[0] ?? narrative,
    sections,
    relations: [{ kind: "answers_same_question", sectionIds: ["s_contributors", "s_detractors"] }],
    narrative,
  };
}
