/**
 * The driver — the nine layers in the order the brief lays them out, and nothing
 * else. This is the file to read to see whether the architecture is real.
 *
 *   1  intent            model, or ./standin.ts        → IntentPlan
 *   2  data              ./tools.ts, in this process   → DataBundle
 *   3  semantic report   model, or ./standin.ts        → SemanticReport
 *   4  IA composition    ./compose.ts, deterministic   ┐
 *   5  recipe selection  ./recipes.ts, deterministic   ├ no model involved
 *   7  UI spec           ./compose.ts, deterministic   ┘
 *   8  validation        ./validate.ts                 → render | fallback
 *
 * Four things are load-bearing and easy to lose in a refactor:
 *
 *   - **Layer 2 runs on the client, not in the route.** The route never touches the
 *     book; it is handed the values a pass is entitled to see. That is what makes
 *     "the model can only use the facts it was given" a property of the wiring
 *     rather than a promise in a prompt.
 *   - **The text/view decision is layer 1's**, taken before any data is fetched and
 *     before anything has been laid out (§10). A "text" plan never reaches the
 *     composer at all.
 *   - **The answer is written before the structure**, and the structure never gets to
 *     revise it. Every return value carries the answer, whatever else happened (§14).
 *   - **Every stage is announced as it starts.** The loading states are the real
 *     pipeline, not a timed animation over one request (§13).
 *
 * Compared with `../dynamic-ui/live.ts`, which this replaces: that file made one
 * request that returned a finished document, so it had one loading state, no
 * separation between deciding and rendering, and no point at which a bad page could
 * be rejected. The structure here is the deliverable; the extra round trips are the
 * cost of having somewhere to put the rules.
 */

import { composeView } from "./compose";
import { emptyBundle, type DataBundle } from "./data";
import { applySpecOps } from "./ops";
import type { IAPlan } from "./ia";
import type { IntentPlan } from "./intent";
import type { RecipeId } from "./recipes";
import type { SemanticReport } from "./semantic";
import { standInAnswer, standInPlan, standInReport } from "./standin";
import type { UISpec } from "./spec";
import { executePlan, satisfied } from "./tools";
import { outcomeOf, validate, type ValidationIssue } from "./validate";

/* -------------------------------------------------------------------- stages */

export type Stage = {
  /** Stable across runs, so the panel can animate a list rather than a spinner. */
  id: string;
  label: string;
  /** What this stage actually did, once it knows. Keys fetched, recipe chosen. */
  detail?: string;
};

export type Turn = { role: "user" | "assistant"; text: string };

/** Where the content came from. Shown in the UI: nobody should have to guess. */
export type Via = "model" | "local";

type Common = {
  via: Via;
  answer: string;
  plan: IntentPlan;
  bundle: DataBundle;
  stages: Stage[];
  /** Anything that went wrong but did not stop the run. */
  notes: string[];
};

export type RunResult =
  | ({ kind: "text" } & Common)
  | ({ kind: "view" } & Common & {
        spec: UISpec;
        report: SemanticReport;
        ia: IAPlan;
        recipeId: RecipeId;
        issues: ValidationIssue[];
        unplaced: string[];
      })
  /** The answer, on its own, because the view could not be trusted. */
  | ({ kind: "fallback" } & Common & {
        report?: SemanticReport;
        spec?: UISpec;
        issues: ValidationIssue[];
        reason: string;
      });

/* ---------------------------------------------------------------- transport */

type Post = { stage: "plan" | "answer" | "structure"; [key: string]: unknown };

type Reply =
  | { ok: true; body: Record<string, unknown> }
  /** `noKey` is a configuration state, not an error: it selects the stand-in. */
  | { ok: false; noKey: boolean; detail: string };

async function post(body: Post): Promise<Reply> {
  try {
    const response = await fetch("/api/lab/generative-ui", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return { ok: true, body: parsed };
    return {
      ok: false,
      noKey: response.status === 501,
      detail: String(parsed.detail ?? parsed.error ?? response.status),
    };
  } catch (error) {
    return { ok: false, noKey: false, detail: error instanceof Error ? error.message : "network" };
  }
}

/* ------------------------------------------------------------------- driver */

/**
 * Progress, as it happens.
 *
 * `surface` is undefined until layer 1 has decided, and that matters to the caller:
 * until the plan comes back nobody knows whether there will be a page at all, so a
 * shell that opens a panel on send is claiming a view before the decision exists.
 * The wait belongs in the chat until this says "view".
 */
export type OnStage = (stages: Stage[], surface?: "text" | "view") => void;

/**
 * One question in, one result out.
 *
 * Never throws. Every failure has a defined landing place — the stand-in for a
 * missing model, the narrative for a view that will not validate — because a
 * pipeline whose last layer is `catch` has no fallback contract at all.
 */
export async function run(query: string, history: Turn[], onStage: OnStage): Promise<RunResult> {
  const stages: Stage[] = [];
  const notes: string[] = [];
  let via: Via = "model";

  /** Undefined until layer 1 has decided. Reported with every later stage. */
  let surface: "text" | "view" | undefined;

  const begin = (id: string, label: string): void => {
    stages.push({ id, label });
    onStage([...stages], surface);
  };
  const finish = (id: string, detail: string): void => {
    const stage = stages.find((entry) => entry.id === id);
    if (stage) stage.detail = detail;
    onStage([...stages], surface);
  };

  /* ---------------------------------------------------- 1. what is being asked */

  begin("plan", "Reading the question");

  let plan: IntentPlan;
  const planned = await post({ stage: "plan", query, history });
  if (planned.ok && planned.body.plan) {
    plan = planned.body.plan as IntentPlan;
  } else {
    via = "local";
    plan = standInPlan(query);
    notes.push(
      planned.ok
        ? "The planning pass returned nothing usable; answered locally."
        : planned.noKey
          ? "No model key configured; answered locally."
          : `Planning pass failed (${planned.detail}); answered locally.`,
    );
  }
  surface = plan.surface;
  finish("plan", `${plan.taskType.replace(/_/g, " ")} · ${plan.surface === "text" ? "a sentence" : "a view"}`);

  /* -------------------------------------------------------------- 2. the data */

  begin("data", "Gathering data");
  const bundle = plan.dataRequests.length > 0 ? executePlan(plan) : emptyBundle();
  const keys = Object.keys(bundle.values);
  finish(
    "data",
    keys.length > 0
      ? `${keys.join(", ")}${bundle.failed.length > 0 ? ` · ${bundle.failed.length} unavailable` : ""}`
      : "nothing came back",
  );
  for (const failure of bundle.failed) notes.push(`${failure.key}: ${failure.reason}`);
  if (!satisfied(plan, bundle)) {
    notes.push("Some data the answer needs is missing; the answer says what it is working from.");
  }

  /* ------------------------------------------------------------ 3a. the answer */

  begin("answer", "Writing the answer");
  let answer = "";
  if (via === "model") {
    const written = await post({ stage: "answer", query, history, plan, values: bundle.values });
    if (written.ok && typeof written.body.answer === "string") {
      answer = written.body.answer;
    } else {
      via = "local";
      notes.push(written.ok ? "The answering pass returned nothing." : `Answering pass failed (${written.detail}).`);
    }
  }
  if (!answer) answer = standInAnswer(plan, bundle);
  finish("answer", `${answer.split(/\s+/).length} words`);

  const common: Common = { via, answer, plan, bundle, stages, notes };

  /*
   * §10, and the only early return in the file.
   *
   * "Who is his RM?" is a sentence. Deciding that here rather than after a report has
   * been structured and a layout chosen is the difference between not building a page
   * and building one nobody wanted.
   */
  if (plan.surface === "text") {
    finish("answer", `${answer.split(/\s+/).length} words · no layout needed`);
    return { kind: "text", ...common };
  }

  /* --------------------------------------------------------- 3b. what it means */

  begin("structure", "Structuring the findings");
  let report: SemanticReport | null = null;
  if (via === "model") {
    const structured = await post({ stage: "structure", query, plan, values: bundle.values, answer });
    if (structured.ok && structured.body.report) {
      report = structured.body.report as SemanticReport;
      for (const drop of (structured.body.dropped as string[] | undefined) ?? []) {
        notes.push(`Dropped: ${drop}`);
      }
    } else {
      notes.push(
        structured.ok ? "The structuring pass returned nothing." : `Structuring pass failed (${structured.detail}).`,
      );
    }
  }
  if (!report) report = standInReport(plan, bundle, answer);
  finish("structure", `${report.sections.length} sections · ${report.sections.flatMap((s) => s.findings).length} findings`);

  /* --------------------------------------------- 4, 5, 7. the page, decided here */

  begin("compose", "Choosing the layout");
  const composed = composeView(report, plan, bundle);
  finish(
    "compose",
    `${composed.recipeId} · ${composed.ia.areas.length} areas${
      composed.unplaced.length > 0 ? ` · ${composed.unplaced.length} not placed` : ""
    }`,
  );
  for (const id of composed.unplaced) notes.push(`Section "${id}" had no place in this recipe.`);

  /* --------------------------------------------------------- 8. is it any good */

  begin("check", "Checking it");
  let spec = composed.spec;
  let result = validate(spec, bundle);

  /*
   * One repair pass, then re-check.
   *
   * The validator does not merely reject: every issue it raises carries the
   * `PresentationOp` that would fix it. Applying those is the difference between "your
   * page had eight cards in a row so here is prose instead" and "your page has a table
   * where it needed one" — the remedy was always in hand.
   *
   * Two guards make this safe to run unconditionally. The op type is `PresentationOp`,
   * so a repair cannot touch a figure or a claim (§9). And the repaired spec is only
   * kept if it validates *better*; a repair that fixes nothing, or trades one error for
   * two, is discarded and the run falls back exactly as it did before. One pass only —
   * a loop that keeps repairing is a composer with a second opinion, which is the thing
   * the deterministic layers exist to avoid.
   */
  let repaired = false;
  const errorCount = (r: typeof result): number => r.issues.filter((issue) => issue.severity === "error").length;

  if (outcomeOf(result, false) === "repair") {
    const patch = applySpecOps(spec, result.repairs);
    const rechecked = validate(patch.value, bundle);
    if (errorCount(rechecked) < errorCount(result)) {
      spec = patch.value;
      result = rechecked;
      repaired = true;
    } else {
      notes.push("A repair was proposed but did not improve the view, so it was discarded.");
    }
    for (const reject of patch.rejected) notes.push(`Repair not applied (${reject.op.op}): ${reject.reason}`);
  }

  const outcome = outcomeOf(result, true);
  const errors = result.issues.filter((issue) => issue.severity === "error");
  const fixed = repaired ? "repaired · " : "";
  finish(
    "check",
    outcome === "render"
      ? result.issues.length > 0
        ? `${fixed}passed · ${result.issues.length} warning${result.issues.length === 1 ? "" : "s"}`
        : `${fixed}passed`
      : `${fixed}${errors.length} problem${errors.length === 1 ? "" : "s"} · showing the answer`,
  );

  if (outcome !== "render") {
    return {
      kind: "fallback",
      ...common,
      report,
      spec,
      issues: result.issues,
      reason: errors[0]?.message ?? "The composed view did not validate.",
    };
  }

  return {
    kind: "view",
    ...common,
    spec,
    report,
    ia: composed.ia,
    recipeId: composed.recipeId,
    issues: result.issues,
    unplaced: composed.unplaced,
  };
}
