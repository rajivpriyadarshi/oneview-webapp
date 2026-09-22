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

import { readKey } from "../apiKey";
import { composeView } from "./compose";
import { emptyBundle, type DataBundle } from "./data";
import { runStage } from "./model";
import { applySpecOps } from "./ops";
import type { IAPlan } from "./ia";
import type { IntentPlan } from "./intent";
import type { RecipeId } from "./recipes";
import type { SemanticReport } from "./semantic";
import { pinnedRun, type PinnedClientId } from "./pinned";
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

/**
 * Where the content came from. Shown in the UI: nobody should have to guess.
 *
 * `pinned` is the demo path — a hand-authored bundle and semantic report per client
 * (./pinned.ts), with layers 4 onwards running live over them. It is named
 * separately from `local` because they are different claims: `local` means the
 * stand-in wrote the analysis, `pinned` means a person did.
 */
export type Via = "model" | "local" | "pinned";

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

/* ------------------------------------------------------------------- pacing */

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * How long each stage is held open when nothing is actually being computed.
 *
 * Stated plainly because it is a lie, and a lie in a demo has to be legible in the source.
 * On the pinned path layers 1 to 3 are hand-authored and layers 4 to 8 are a few
 * milliseconds of pure function, so all six stages complete inside one frame and the panel
 * flashes its whole list at once. A reader learns nothing from that: the *point* of the
 * staged panel is that the architecture has six separable steps, and a step nobody sees
 * cannot make that point.
 *
 * So the pinned run is paced, and the numbers are shaped like the work would be — which
 * means *unevenly*. The first version gave every stage roughly a second and a half, and a
 * reader watching four phases tick at a metronome's pace correctly concludes that nothing
 * is being timed: real work has a rhythm, and the rhythm is the tell. Where the time
 * actually goes, if these layers ran for real:
 *
 *   plan       A short model call on one sentence. Fast, and it should feel instant-ish.
 *   data       Tool calls, in parallel but bounded by the slowest. Around a second.
 *   answer     Four hundred words out of a model, token by token. The long one, by far,
 *              and the one the reader should be able to feel taking its time.
 *   structure  A second model call, turning that answer into findings. Long, but shorter
 *              than writing the prose was.
 *   compose    Pure functions over a dozen sections. Hundreds of milliseconds at most.
 *   check      Walking a tree against a schema. Faster still, and it lands with a snap.
 *
 * `before` is the wait while a stage is open and `after` is the beat on its result, so a
 * cheap stage gets a short beat and the two expensive ones are allowed to sit.
 *
 * Nothing else changes: the model path is not delayed by a millisecond, because there the
 * stages take however long they take and inventing more would be padding a real number.
 * And this cannot touch the report — it sleeps between stages, it does not participate in
 * any of them.
 */
const PACE: Record<string, { before: number; after: number }> = {
  plan: { before: 380, after: 200 },
  data: { before: 1150, after: 180 },
  answer: { before: 2700, after: 260 },
  structure: { before: 1750, after: 220 },
  compose: { before: 520, after: 140 },
  check: { before: 300, after: 120 },
};

/* ---------------------------------------------------------------- transport */

type Post = { stage: "plan" | "answer" | "structure"; [key: string]: unknown };

type Reply =
  | { ok: true; body: Record<string, unknown> }
  /** `noKey` is a configuration state, not an error: it selects the stand-in. */
  | { ok: false; noKey: boolean; detail: string };

/**
 * Whether there is a route behind this page at all.
 *
 * Undefined until the first attempt, then remembered. A static deployment has no
 * `/api/lab/generative-ui` — the request comes back 404 or 405 from whatever is serving
 * the files — and three passes per question is three pointless round trips if that answer
 * is re-learned every time. One wasted request per page load is the price of not having
 * to configure which deployment this is.
 */
let routeExists: boolean | undefined;

/** The route, or a statement that there isn't one. Never throws. */
async function viaRoute(body: Post): Promise<Reply | { absent: true; detail: string }> {
  try {
    const response = await fetch("/api/lab/generative-ui", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    /* 404/405 is "nothing is listening here", which is different from "it answered
       badly" — the first sends us to the browser key, the second is a real failure. */
    if (response.status === 404 || response.status === 405) {
      routeExists = false;
      return { absent: true, detail: `no route (${response.status})` };
    }
    routeExists = true;
    const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return { ok: true, body: parsed };
    /* 501 is the route saying the *server* has no key, which is also a reason to try the
       one in the browser rather than to give up on the model. */
    if (response.status === 501) return { absent: true, detail: "no key on the server" };
    return { ok: false, noKey: false, detail: String(parsed.detail ?? parsed.error ?? response.status) };
  } catch (error) {
    routeExists = false;
    return { absent: true, detail: error instanceof Error ? error.message : "network" };
  }
}

/**
 * One pass, wherever the key is.
 *
 * The route first, always, because a key held on a server is a key the page never sees.
 * The key the user typed into the lab's own settings is the fallback, and it is what makes
 * the static deployment work at all — there the first branch has nothing to talk to. See
 * ../apiKey.ts for what that trade costs.
 *
 * `noKey` comes back only when *neither* is available, because that is the one case the
 * caller can do something about: it selects ./standin.ts and says so on screen.
 */
async function post(body: Post): Promise<Reply> {
  if (routeExists !== false) {
    const routed = await viaRoute(body);
    if (!("absent" in routed)) return routed;
  }

  const stored = readKey();
  if (!stored) return { ok: false, noKey: true, detail: "no model key, on the server or in this browser" };

  const outcome = await runStage(body as never, {
    provider: stored.provider,
    key: stored.key,
    fromBrowser: true,
  });
  if (outcome.ok) return { ok: true, body: outcome.body };
  return {
    ok: false,
    noKey: outcome.error === "no-key",
    detail: outcome.detail ?? outcome.error,
  };
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
export async function run(
  query: string,
  history: Turn[],
  onStage: OnStage,
  /**
   * Whose book the simulator has open (./pinned.ts).
   *
   * Prototype scaffolding, and named as such. In a real deployment the client is
   * resolved from the session and the question, not chosen from a dropdown; this exists
   * so a demo can show the same question producing two differently-shaped reports,
   * which is the claim the architecture makes and otherwise has to be taken on trust.
   */
  client?: PinnedClientId,
): Promise<RunResult> {
  const stages: Stage[] = [];
  const notes: string[] = [];
  let via: Via = "model";

  /** Undefined until layer 1 has decided. Reported with every later stage. */
  let surface: "text" | "view" | undefined;

  /*
   * The pinned path (./pinned.ts).
   *
   * Checked first and checked once: if this query is the demo report, layers 1, 2 and 3
   * are already written and the run starts at composition. Everything downstream is
   * untouched — the composer still chooses the layout, the validator still gets to
   * reject it, and a pinned report that composed badly would fall back to prose exactly
   * like any other. That is the point of freezing here rather than at the spec.
   *
   * Resolved before the first stage is announced only because it is a pure lookup and
   * `PACE` needs to know whether this run has any real latency in it to show.
   */
  const pinned = pinnedRun(query, client);

  /** Whether the stages are being paced rather than timed. See `PACE`. */
  const faked = Boolean(pinned);
  const hold = (id: string, when: "before" | "after"): Promise<void> =>
    faked ? sleep(PACE[id]?.[when] ?? 0) : Promise.resolve();

  const begin = async (id: string, label: string): Promise<void> => {
    stages.push({ id, label });
    onStage([...stages], surface);
    await hold(id, "before");
  };
  const finish = async (id: string, detail: string): Promise<void> => {
    const stage = stages.find((entry) => entry.id === id);
    if (stage) stage.detail = detail;
    onStage([...stages], surface);
    await hold(id, "after");
  };

  /* ---------------------------------------------------- 1. what is being asked */

  await begin("plan", "Understanding the question");

  let plan: IntentPlan;
  if (pinned) {
    via = "pinned";
    plan = pinned.plan;
    notes.push(pinned.note);
  } else {
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
  }
  surface = plan.surface;
  await finish("plan", `${plan.taskType.replace(/_/g, " ")} · ${plan.surface === "text" ? "a sentence" : "a view"}`);

  /* -------------------------------------------------------------- 2. the data */

  await begin("data", "Gathering the data");
  const bundle = pinned ? pinned.bundle : plan.dataRequests.length > 0 ? executePlan(plan) : emptyBundle();
  const keys = Object.keys(bundle.values);
  await finish(
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

  await begin("answer", "Writing the answer");
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
  if (!answer) answer = pinned ? pinned.answer : standInAnswer(plan, bundle);
  await finish("answer", `${answer.split(/\s+/).length} words`);

  const common: Common = { via, answer, plan, bundle, stages, notes };

  /*
   * §10, and the only early return in the file.
   *
   * "Who is his RM?" is a sentence. Deciding that here rather than after a report has
   * been structured and a layout chosen is the difference between not building a page
   * and building one nobody wanted.
   */
  if (plan.surface === "text") {
    await finish("answer", `${answer.split(/\s+/).length} words · no layout needed`);
    return { kind: "text", ...common };
  }

  /* --------------------------------------------------------- 3b. what it means */

  await begin("structure", "Sorting out what it says");
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
  if (!report) report = pinned ? pinned.report : standInReport(plan, bundle, answer);
  await finish("structure", `${report.sections.length} sections · ${report.sections.flatMap((s) => s.findings).length} findings`);

  /* --------------------------------------------- 4, 5, 7. the page, decided here */

  await begin("compose", "Choosing how to show each part");
  const composed = composeView(report, plan, bundle);
  await finish(
    "compose",
    `${composed.recipeId} · ${composed.ia.areas.length} areas${
      composed.unplaced.length > 0 ? ` · ${composed.unplaced.length} not placed` : ""
    }`,
  );
  for (const id of composed.unplaced) notes.push(`Section "${id}" had no place in this recipe.`);

  /* --------------------------------------------------------- 8. is it any good */

  await begin("check", "Checking it holds up");
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
  await finish(
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
