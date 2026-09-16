/**
 * Layer 1 — the intent / task planner.
 *
 * The first reasoning layer. It works out what job the advisor is trying to do,
 * and it does that *before* any data is fetched and before anything is drawn.
 * It chooses no components; it does not even know they exist.
 *
 * This replaces two things from the old pipeline, and the replacement is not an
 * extension of either:
 *
 *   - `interpret.ts:intentOf` guessed answer / report / amend from regexes over
 *     the typed sentence, before anyone knew what the answer contained.
 *   - `decide.ts` made the real decision *after* the prose answer came back, by
 *     counting currency symbols, percentages, list lines and paragraphs in it.
 *
 * Counting figures is a proxy for "does this have a shape", and it is wrong in
 * both directions: "how is he doing?" is four words and wants a page, while a
 * chatty answer to "who is his RM?" wants a sentence. More importantly, a figure
 * count cannot produce a task type, a scope, a time range, or the flags a layout
 * recipe needs — so under the old design there was nothing to select a recipe
 * with, and nothing to plan data with either.
 *
 * The rich-UI decider lives here now, as `surface`. That is the brief's "move it
 * earlier": the decision is made from the shape of the task rather than from the
 * length or formatting of an answer that has not been written yet.
 */

import { z } from "zod";

/**
 * The job being done. This is the primary key of the whole pipeline: it selects
 * the layout recipe (./recipes.ts) and it shapes what the semantic pass is asked
 * to produce.
 *
 * Kept small on purpose. A task type earns its place by changing the *structure*
 * of the answer — if two types would produce the same recipe and the same
 * sections, they are one type with two phrasings.
 */
export const TaskTypeSchema = z.enum([
  "portfolio_review",
  "comparison",
  "meeting_prep",
  "liquidity_planning",
  "activity_review",
  "risk_review",
  "action_plan",
  "entity_overview",
  "explanation",
  /** A fact with a one-sentence answer. Always `surface: "text"`. */
  "lookup",
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const ScopeSchema = z.object({
  kind: z.enum(["client", "clients", "account", "book", "instrument", "none"]),
  ids: z.array(z.string()),
  /**
   * Free text when the scope is real but the ids can't be resolved yet — "his two
   * biggest holdings", "the ones we flagged last quarter". Layer 2 resolves it;
   * carrying it explicitly is better than silently scoping to everything.
   */
  unresolved: z.string().optional(),
});
export type Scope = z.infer<typeof ScopeSchema>;

export const TimeRangeSchema = z.object({
  kind: z.enum(["point", "range", "rolling", "none"]),
  /** ISO dates. Absent on "rolling" and "none". */
  from: z.string().optional(),
  to: z.string().optional(),
  /** How a person would say it: "August", "the last six months". */
  label: z.string().optional(),
});
export type TimeRange = z.infer<typeof TimeRangeSchema>;

/**
 * What the task structurally requires. These are the flags the IA composer and
 * the recipe selector read; none of them says anything about a component.
 */
export const IntentNeedsSchema = z.object({
  /** Things must be put next to each other. Implies a comparison recipe. */
  comparison: z.boolean(),
  /** Order in time is load-bearing, not incidental. */
  chronology: z.boolean(),
  /** Actions or recommendations are expected in the answer. */
  actions: z.boolean(),
  /** Parts-of-a-whole is central to the question, not a passing mention. */
  composition: z.boolean(),
  /**
   * The ask named a number of things — "the top 4", "his two biggest".
   *
   * Load-bearing and must not be rounded off. This was the one thing the old
   * `interpret.ts` got right and it is worth keeping explicit: a comparison that
   * silently returns three entities when four were asked for is a wrong answer,
   * not a layout preference.
   */
  count: z.number().int().min(1).max(24).optional(),
});
export type IntentNeeds = z.infer<typeof IntentNeedsSchema>;

/**
 * One thing to go and get. The key is a namespace the prose answer, the semantic
 * report and eventually the UI spec all reference — so the same figure is named
 * the same thing at every layer, and the validator can check that a component is
 * bound to data that actually arrived.
 */
export const DataRequestSchema = z.object({
  /** Dotted namespace: "perf.monthly", "risk.concentration". */
  key: z
    .string()
    .regex(/^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/, "dotted lower-case namespace, e.g. perf.monthly"),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  /**
   * A failed *required* request aborts to the text path. A failed optional one
   * just means the view has one fewer area — which is the correct behaviour and
   * not a pipeline failure.
   */
  required: z.boolean(),
});
export type DataRequest = z.infer<typeof DataRequestSchema>;

export const IntentPlanSchema = z.object({
  taskType: TaskTypeSchema,
  /** One sentence in the advisor's words. Feeds the progress panel. */
  goal: z.string().min(1),
  scope: ScopeSchema,
  timeRange: TimeRangeSchema,
  needs: IntentNeedsSchema,
  /** What kind of work this mostly is. Affects tone and recipe, not components. */
  register: z.enum(["analytical", "operational", "explanatory", "factual"]),
  /**
   * Text answer or generated view. The decider, moved to the front.
   *
   * "text" is the cheap outcome and the one this layer exists to reach: it skips
   * the semantic pass, the IA composer, the recipe, the spec and the validator
   * entirely. A lookup never pays for any of them.
   */
  surface: z.enum(["text", "view"]),
  /**
   * Why this surface, in the advisor's language.
   *
   * Shown in the panel. Note the constraint from the brief: this is a stated
   * conclusion, not the reasoning that produced it. "One attribute of one
   * account — the answer is a name" is fine; a transcript of the deliberation
   * is not.
   */
  because: z.string().min(1),
  dataRequests: z.array(DataRequestSchema),
});
export type IntentPlan = z.infer<typeof IntentPlanSchema>;

/**
 * A lookup can never want a generated view, whatever else the planner said.
 *
 * Enforced here rather than trusted from the model, because building cards in
 * front of a one-line answer is the single most visible way this pipeline can
 * embarrass itself, and one line of code is cheaper than hoping.
 */
export const normaliseIntent = (plan: IntentPlan): IntentPlan =>
  plan.taskType === "lookup" ? { ...plan, surface: "text" } : plan;

/** Requests whose absence means the view cannot be built at all. */
export const requiredKeys = (plan: IntentPlan): string[] =>
  plan.dataRequests.filter((request) => request.required).map((request) => request.key);
