/**
 * Layer 2, the executable half — the data tools.
 *
 * ./data.ts defines what a bundle *is*; this file is what fills one. Every tool is
 * a pure function from arguments to domain data plus provenance, over the same
 * mock book prototype 1 used (`../dynamic-ui/clientBook`), so the two prototypes
 * are answering questions about the same client and can be compared directly.
 *
 * The thing to notice is what is *not* here: no component names, no spans, no
 * ordering intent, no formatting decisions beyond the ones the book itself already
 * makes. A tool returns what is true. That is the entire job.
 *
 * And the thing this replaces: prototype 1 had no data layer at all. `clientBook()`
 * was string-concatenated into every prompt, including the one that structured the
 * report, so the shaping pass could re-derive figures rather than translate them —
 * and nothing downstream could tell the difference. Here the model sees the book
 * once, at planning time, as a *catalogue of tools* rather than as facts; the facts
 * it later reasons over are exactly the ones a tool returned, and every one of them
 * is addressable by key. That is what makes §9 checkable instead of hoped for.
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
} from "../dynamic-ui/clientBook";
import { emptyBundle, type DataBundle } from "./data";
import type { IntentPlan } from "./intent";

/**
 * One timestamp for the whole book, as a constant.
 *
 * Not `new Date()`: an "as of" that moves between the server render and the client
 * render is a hydration mismatch, and an "as of" that moves between two runs of
 * the same query makes the pipeline untestable. Mock data has a fixed vintage and
 * saying so is more honest than stamping it with now.
 */
export const AS_OF = "2026-09-30T17:00:00+08:00";

export type ToolResult = {
  value: unknown;
  /** In the advisor's words, not table names. Feeds SourceList and the grounding pill. */
  sources: string[];
};

export type ToolDef = {
  name: string;
  /** Read by the planner. This is the tool's prompt as much as its documentation. */
  description: string;
  /** Argument shape in one line, for the catalogue. */
  args?: string;
  run: (args: Record<string, unknown>) => ToolResult;
};

/* ------------------------------------------------------------------ helpers */

const num = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/** Months paired with a series, so a component never has to align two arrays. */
const dated = (values: readonly number[]): { label: string; value: number }[] =>
  values.map((value, index) => ({ label: MONTHS[index] ?? `T${index + 1}`, value }));

/* -------------------------------------------------------------------- tools */

const DEFS: ToolDef[] = [
  {
    name: "client.profile",
    description: "Who the client is: segment, residency, risk profile, coverage team, review dates.",
    run: () => ({
      value: {
        name: CLIENT.name,
        segment: CLIENT.segment,
        location: CLIENT.location,
        taxResidency: CLIENT.taxResidency,
        clientSince: CLIENT.clientSince,
        riskProfile: CLIENT.riskProfile,
        relationshipManager: CLIENT.relationship.manager,
        lastReview: CLIENT.relationship.lastReview,
        nextReview: CLIENT.relationship.nextReview,
        contactCadence: CLIENT.relationship.contactCadence,
      },
      sources: ["Client master"],
    }),
  },
  {
    name: "client.family",
    description: "Family members, ages, roles and anything noted about them.",
    run: () => ({ value: CLIENT.family.map((member) => ({ ...member })), sources: ["Client master"] }),
  },
  {
    name: "portfolio.summary",
    description:
      "Headline portfolio figures: total value and its history, quarter and year change, benchmark, liquidity, loan-to-value, yield, fees.",
    run: () => ({
      value: {
        currency: PORTFOLIO.currency,
        totalValue: PORTFOLIO.totalValueDisplay,
        totalValueM: PORTFOLIO.totalValue,
        valueSeries: dated(PORTFOLIO.valueSeries),
        quarterChangePct: PORTFOLIO.quarterChangePct,
        yearChangePct: PORTFOLIO.yearChangePct,
        benchmarkYearChangePct: PORTFOLIO.benchmarkYearChangePct,
        liquidAssets: PORTFOLIO.liquidAssetsDisplay,
        liquidAssetsM: PORTFOLIO.liquidAssets,
        liquidChangeM: PORTFOLIO.liquidChangeM,
        loanToValuePct: PORTFOLIO.loanToValuePct,
        incomeYieldPct: PORTFOLIO.incomeYieldPct,
        feesYtd: PORTFOLIO.feesYtdDisplay,
      },
      sources: ["Custody positions", "Performance engine"],
    }),
  },
  {
    name: "portfolio.allocation",
    description:
      "Composition of the portfolio along one dimension, with the previous weight where the book has it.",
    args: 'dimension: "asset_class" | "sector" | "geography" | "currency"',
    run: (args) => {
      const dimension = str(args.dimension) ?? "asset_class";
      if (dimension === "sector") {
        return {
          value: PORTFOLIO.sectors.map((entry) => ({
            label: entry.label,
            sharePct: entry.sharePct,
            prevSharePct: entry.prevSharePct,
          })),
          sources: ["Custody positions", "Instrument reference"],
        };
      }
      if (dimension === "geography") {
        return {
          value: PORTFOLIO.geographies.map((entry) => ({ label: entry.label, sharePct: entry.sharePct })),
          sources: ["Custody positions", "Instrument reference"],
        };
      }
      if (dimension === "currency") {
        return {
          value: PORTFOLIO.currencies.map((entry) => ({
            label: entry.label,
            sharePct: entry.sharePct,
            hedgedPct: entry.hedgedPct,
          })),
          sources: ["Custody positions", "Treasury"],
        };
      }
      return {
        value: PORTFOLIO.assetClasses.map((entry) => ({
          label: entry.label,
          sharePct: Math.round(entry.share * 1000) / 10,
          prevSharePct: Math.round(entry.prevShare * 1000) / 10,
        })),
        sources: ["Custody positions"],
      };
    },
  },
  {
    name: "portfolio.holdings",
    description:
      "Individual positions with value, weight, year-to-date return, cost basis and an indexed history each.",
    args: 'limit?: number, sortBy?: "value" | "return" | "weight"',
    run: (args) => {
      const sortBy = str(args.sortBy) ?? "value";
      const ranked = [...HOLDINGS].sort((a, b) =>
        sortBy === "return"
          ? b.returnYtdPct - a.returnYtdPct
          : sortBy === "weight"
            ? b.sharePct - a.sharePct
            : b.valueM - a.valueM,
      );
      const limit = Math.max(1, Math.min(num(args.limit, ranked.length), ranked.length));
      return {
        value: ranked.slice(0, limit).map((holding) => ({
          name: holding.name,
          assetClass: holding.assetClass,
          sector: holding.sector,
          valueM: holding.valueM,
          sharePct: holding.sharePct,
          returnYtdPct: holding.returnYtdPct,
          costBasisM: holding.costBasisM,
          note: "note" in holding ? holding.note : undefined,
          indexed: dated(holding.indexed),
        })),
        sources: ["Custody positions", "Instrument reference"],
      };
    },
  },
  {
    name: "performance.series",
    description: "The portfolio indexed against its benchmark over twelve months.",
    run: () => ({
      value: {
        benchmarkName: PERFORMANCE.benchmarkName,
        portfolio: dated(PERFORMANCE.portfolioIndexed),
        benchmark: dated(PERFORMANCE.benchmarkIndexed),
      },
      sources: ["Performance engine"],
    }),
  },
  {
    name: "performance.attribution",
    description: "What contributed to and detracted from return, by sleeve.",
    run: () => ({
      value: PERFORMANCE.attribution.map((entry) => ({ ...entry })),
      sources: ["Performance engine"],
    }),
  },
  {
    name: "performance.risk",
    description: "Realised volatility against the benchmark, maximum drawdown and Sharpe.",
    run: () => ({
      value: {
        volatilityPct: PERFORMANCE.volatilityPct,
        benchmarkVolatilityPct: PERFORMANCE.benchmarkVolatilityPct,
        maxDrawdownPct: PERFORMANCE.maxDrawdownPct,
        sharpe: PERFORMANCE.sharpe,
      },
      sources: ["Performance engine", "Risk engine"],
    }),
  },
  {
    name: "cashflow.schedule",
    description: "Money moving in and out: what is coming, when, and the monthly net history.",
    run: () => ({
      value: {
        upcoming: CASHFLOW.upcoming.map((entry) => ({ ...entry })),
        monthlyNet: dated(CASHFLOW.monthlyNetM),
        netContributionsM: CASHFLOW.netContributionsM,
        incomeM: CASHFLOW.incomeM,
        drawdownsM: CASHFLOW.drawdownsM,
      },
      sources: ["Cash ledger", "Fund administrator"],
    }),
  },
  {
    name: "liabilities.facilities",
    description: "Borrowing: facilities, rates, reset dates, loan-to-value against the policy limit.",
    run: () => ({
      value: {
        totalM: LIABILITIES.totalM,
        loanToValuePct: LIABILITIES.loanToValuePct,
        policyLimitPct: LIABILITIES.policyLimitPct,
        facilities: LIABILITIES.facilities.map((entry) => ({ ...entry })),
      },
      sources: ["Credit system"],
    }),
  },
  {
    name: "goals.list",
    description: "Stated objectives with amounts, horizons, funding status.",
    run: () => ({ value: GOALS.map((goal) => ({ ...goal })), sources: ["Planning record"] }),
  },
  {
    name: "risks.list",
    description: "Open risk observations with severity and detail, including policy breaches.",
    run: () => ({ value: RISKS.map((risk) => ({ ...risk })), sources: ["Risk engine", "Investment policy statement"] }),
  },
  {
    name: "meetings.recent",
    description: "Recent meetings and calls with what was said and agreed.",
    args: "limit?: number",
    run: (args) => ({
      value: MEETINGS.slice(0, Math.max(1, Math.min(num(args.limit, MEETINGS.length), MEETINGS.length))).map(
        (meeting) => ({ ...meeting, notes: [...meeting.notes] }),
      ),
      sources: ["Meeting notes"],
    }),
  },
  {
    name: "documents.list",
    description: "Documents on file with their last-updated date.",
    run: () => ({ value: DOCUMENTS.map((entry) => ({ ...entry })), sources: ["Document store"] }),
  },
];

export const TOOLS: Record<string, ToolDef> = Object.fromEntries(DEFS.map((def) => [def.name, def]));

export const TOOL_NAMES = DEFS.map((def) => def.name);

/**
 * The catalogue the planner is given instead of the book.
 *
 * This is the boundary in one line: the planner learns what it *could* ask for,
 * not what the answer is. It cannot report a figure it has never seen.
 */
export const CATALOGUE = DEFS.map(
  (def) => `- ${def.name}${def.args ? ` (${def.args})` : ""} — ${def.description}`,
).join("\n");

/* ----------------------------------------------------------------- execution */

/**
 * Run a plan's data requests. Deterministic, and never throws.
 *
 * A tool that fails or returns nothing lands in `bundle.failed` rather than
 * silently missing, because a view that quietly omits an area looks like a view
 * with nothing to say there. Whether a failure is fatal is the caller's call and
 * `DataRequest.required` is how the plan states it.
 */
export function executePlan(plan: IntentPlan): DataBundle {
  const bundle = emptyBundle();

  for (const request of plan.dataRequests) {
    const tool = TOOLS[request.tool];
    if (!tool) {
      bundle.failed.push({ key: request.key, reason: `No tool named "${request.tool}".` });
      continue;
    }

    try {
      const result = tool.run(request.args ?? {});
      const empty =
        result.value === undefined ||
        result.value === null ||
        (Array.isArray(result.value) && result.value.length === 0);
      if (empty) {
        bundle.failed.push({ key: request.key, reason: `${request.tool} returned nothing.` });
        continue;
      }
      bundle.values[request.key] = result.value;
      bundle.provenance[request.key] = { tool: request.tool, asOf: AS_OF, sources: result.sources };
    } catch (error) {
      bundle.failed.push({
        key: request.key,
        reason: error instanceof Error ? error.message : `${request.tool} failed.`,
      });
    }
  }

  return bundle;
}

/** Whether every request the plan called required actually arrived. */
export const satisfied = (plan: IntentPlan, bundle: DataBundle): boolean =>
  plan.dataRequests
    .filter((request) => request.required)
    .every((request) => request.key in bundle.values);
