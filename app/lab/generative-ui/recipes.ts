/**
 * Layer 5 — layout recipes.
 *
 * A recipe is a higher-order constraint on the *whole* view: which slots exist, in
 * what order, what kind of content each will accept, and how many areas each may
 * hold. The IA composer decides how information groups; the recipe decides where
 * those groups land on the page.
 *
 * Why this is a separate layer rather than more rules in ./ia.ts: without it, page
 * order is a function of the content that happened to arrive, which is exactly the
 * failure the brief names — sequential components because the model emitted things
 * sequentially. The old pipeline had no notion of a page shape at all. `compose.ts`
 * sorted sections by emphasis and packed rows greedily, so a portfolio review and a
 * comparison and a meeting prep were all "whatever came back, biggest first". Three
 * different jobs, one layout.
 *
 * A recipe is *data*, deliberately. Adding one is adding an entry to this file —
 * not a branch in a composer — which keeps the set of page shapes reviewable as a
 * design artifact rather than discoverable only by reading code.
 *
 * Two rules hold for every recipe:
 *
 *   1. **A slot may be empty.** If no section fits `whatChanged`, the slot does not
 *      render — it does not get filled with something else to look complete. The
 *      old design dropped empty sections (`compose.ts:202`) and that instinct was
 *      right; here it is a property of the shape rather than a cleanup pass.
 *   2. **Order is the recipe's, not importance's.** A primary recommendation still
 *      renders in the `actions` slot at the end of an AnalyticalReport. Importance
 *      drives emphasis within a slot, never position between slots.
 */

import { z } from "zod";
import { ArrangementSchema } from "./ia";
import { SemanticTypeSchema, type SemanticType } from "./semantic";
import { TaskTypeSchema, type TaskType } from "./intent";

export const RecipeIdSchema = z.enum([
  "AnalyticalReport",
  "PropertyReport",
  "ComparisonReport",
  "TimelineReport",
  "EntityOverview",
  "ActionPlan",
]);
export type RecipeId = z.infer<typeof RecipeIdSchema>;

export const RecipeSlotSchema = z.object({
  id: z.string().min(1),
  /** Reader-facing heading when the composer has no better one from the sections. */
  defaultHeading: z.string().min(1).optional(),
  /**
   * Semantic types this slot will take. `"*"` accepts anything and exists for the
   * one honest catch-all case — an overview whose content is not known in advance.
   */
  accepts: z.union([z.literal("*"), z.array(SemanticTypeSchema).min(1)]),
  /**
   * A required slot with nothing to put in it aborts the view to the text path.
   *
   * Used sparingly and only where the recipe would be a lie without it: a
   * ComparisonReport with nothing to compare is not a comparison with a missing
   * section, it is the wrong recipe.
   */
  required: z.boolean(),
  /** The arrangement this slot imposes, when it imposes one. */
  arrangement: ArrangementSchema.optional(),
  /** How many IA areas may land here. One, usually. */
  maxAreas: z.number().int().min(1).max(4),
  /** Default disclosure for areas in this slot. Provenance opens collapsed. */
  disclosure: z.enum(["open", "collapsed"]).optional(),
});
export type RecipeSlot = z.infer<typeof RecipeSlotSchema>;

export const ViewRecipeSchema = z.object({
  id: RecipeIdSchema,
  description: z.string().min(1),
  /** Task types this recipe serves. Selection is a lookup, not a judgement. */
  serves: z.array(TaskTypeSchema).min(1),
  /** Slots in page order. */
  slots: z.array(RecipeSlotSchema).min(1),
  /**
   * Ceiling on areas across the whole view.
   *
   * The brief's "fewer, stronger sections" as a number. A cap is a blunt way to
   * express a taste, but it is the only way to express it that survives a model
   * having a productive afternoon.
   */
  maxAreas: z.number().int().min(2).max(10),
});
export type ViewRecipe = z.infer<typeof ViewRecipeSchema>;

/* ----------------------------------------------------------------- the shapes */

/**
 * Headline → what changed → why → risks → what to watch.
 *
 * The default for analytical work, and the shape a portfolio review already wants:
 * lead with the conclusion, then the movement, then the attribution, then the
 * exposure, then the forward look. Attribution after movement rather than beside
 * it, because "why" only means something once "what" has landed.
 */
const ANALYTICAL_REPORT: ViewRecipe = {
  id: "AnalyticalReport",
  description: "Headline, what changed, why it changed, risks, what to watch.",
  serves: ["portfolio_review", "risk_review", "explanation"],
  slots: [
    {
      id: "headline",
      accepts: ["summary", "performance", "identity"],
      required: true,
      arrangement: "single",
      maxAreas: 1,
    },
    {
      id: "whatChanged",
      defaultHeading: "What changed",
      accepts: ["performance", "allocation", "activity", "comparison"],
      required: false,
      // Three, not two: movement, benchmark and composition are all "what changed",
      // and at two the third one — usually composition — was being squeezed out of a
      // portfolio review by a benchmark chart. The page budget still binds.
      maxAreas: 3,
    },
    {
      id: "why",
      defaultHeading: "Performance drivers",
      accepts: ["drivers", "market_context"],
      required: false,
      maxAreas: 2,
    },
    {
      id: "risks",
      defaultHeading: "Risk changes",
      accepts: ["risk", "liquidity", "commitments"],
      required: false,
      maxAreas: 2,
    },
    {
      id: "actions",
      defaultHeading: "What to watch",
      accepts: ["recommendations", "actions"],
      required: false,
      maxAreas: 1,
    },
    {
      id: "provenance",
      defaultHeading: "Sources and method",
      accepts: ["evidence"],
      required: false,
      maxAreas: 1,
      disclosure: "collapsed",
    },
  ],
  // Eight, not seven. Seven was tuned on a quarterly performance review, where the
  // whole report is one side of the balance sheet. A full analysis has both sides —
  // what it is worth, how it is invested, what is borrowed, what is owed next — and at
  // seven the area that lost was `provenance`, because it sits last in slot order and
  // placement is first-fit. Dropping the sources and the currency assumptions off a
  // financial document to save a row is the wrong trade. The slot caps still bind, so
  // this buys one more area, not a longer page.
  maxAreas: 8,
};

/**
 * The assets, then who holds them, then what they need — the shape for a balance
 * sheet whose weight is in things that do not trade.
 *
 * Worth having as its own recipe rather than as an AnalyticalReport with different
 * content, because the analytical shape's argument is movement: headline, what changed,
 * why it changed. A book that is 41% property, 76% illiquid and carries no benchmark
 * has no movement to lead with — four valuations, three of them months old, do not make
 * a performance story, and putting them in a "what changed" slot would claim they do.
 * The questions this shape answers in order are: what is it worth, what is in the book,
 * who owns it, what has to be paid and when, and what is the exposure.
 *
 * `structure` is the slot the analytical shape has no equivalent of. Where assets sit in
 * a trust, a holding company and a personal name, ownership is not a footnote — it
 * decides who can sell, who is taxed and what succession means — and a recipe that had
 * nowhere to put it would push it into a generic detail slot behind the numbers.
 */
const PROPERTY_REPORT: ViewRecipe = {
  id: "PropertyReport",
  description: "What it is worth, what is in the book, who holds it, what it needs.",
  serves: ["property_review"],
  slots: [
    {
      id: "headline",
      accepts: ["summary", "identity"],
      required: true,
      arrangement: "single",
      maxAreas: 1,
    },
    {
      id: "book",
      defaultHeading: "The book",
      accepts: ["allocation", "comparison", "performance"],
      required: true,
      maxAreas: 2,
    },
    {
      id: "structure",
      defaultHeading: "How it is held",
      accepts: ["identity", "activity", "drivers", "market_context"],
      required: false,
      maxAreas: 2,
    },
    {
      id: "funding",
      defaultHeading: "What it needs",
      accepts: ["commitments", "liquidity"],
      required: false,
      maxAreas: 2,
    },
    {
      id: "risks",
      defaultHeading: "Exposure",
      accepts: ["risk"],
      required: false,
      maxAreas: 1,
    },
    {
      id: "actions",
      defaultHeading: "What to do next",
      accepts: ["recommendations", "actions"],
      required: false,
      maxAreas: 1,
    },
    {
      id: "provenance",
      defaultHeading: "Valuations and sources",
      accepts: ["evidence"],
      required: false,
      maxAreas: 1,
      disclosure: "collapsed",
    },
  ],
  // Nine, and the highest ceiling of any recipe here, because this shape carries two
  // things the others fold away: an ownership structure and a dated funding calendar.
  // The slot caps still add to ten, so this is not a licence for a longer page — it is
  // the difference between nine areas placed and the last one, the sources, dropped.
  maxAreas: 9,
};

/**
 * Options side by side, then the measures, then the recommendation.
 *
 * The recommendation is last and it is a required slot. A comparison that lays out
 * three funding options and stops is a table, not advice — the advisor asked which
 * one, and the shape should not let the answer decline to say.
 */
const COMPARISON_REPORT: ViewRecipe = {
  id: "ComparisonReport",
  description: "The options, the measures they differ on, then the call.",
  serves: ["comparison", "liquidity_planning"],
  slots: [
    {
      id: "question",
      accepts: ["summary", "identity"],
      required: true,
      arrangement: "single",
      maxAreas: 1,
    },
    {
      id: "options",
      defaultHeading: "Options",
      accepts: ["comparison"],
      required: true,
      maxAreas: 1,
    },
    {
      id: "measures",
      defaultHeading: "How they differ",
      accepts: [
        "performance",
        "liquidity",
        "risk",
        "commitments",
        "allocation",
        "drivers",
        "market_context",
        "activity",
      ],
      required: false,
      maxAreas: 3,
    },
    {
      id: "call",
      defaultHeading: "Recommendation",
      accepts: ["recommendations", "actions"],
      required: true,
      arrangement: "single",
      maxAreas: 1,
    },
    {
      id: "provenance",
      defaultHeading: "Assumptions",
      accepts: ["evidence"],
      required: false,
      maxAreas: 1,
      disclosure: "collapsed",
    },
  ],
  maxAreas: 6,
};

/**
 * Chronology first, because in this shape the calendar *is* the argument.
 *
 * Used when `needs.chronology` is set — cash flow schedules, capital calls,
 * account activity, anything where "when" is the reader's actual question.
 */
const TIMELINE_REPORT: ViewRecipe = {
  id: "TimelineReport",
  description: "What is coming, in order, with the amounts and the consequences.",
  serves: ["liquidity_planning", "activity_review"],
  slots: [
    {
      id: "headline",
      accepts: ["summary", "liquidity", "identity"],
      required: true,
      arrangement: "single",
      maxAreas: 1,
    },
    {
      id: "sequence",
      defaultHeading: "Schedule",
      accepts: ["commitments", "activity", "liquidity"],
      required: true,
      arrangement: "stack",
      maxAreas: 1,
    },
    {
      id: "implications",
      defaultHeading: "What this means",
      accepts: ["risk", "market_context", "performance", "allocation", "drivers", "comparison"],
      required: false,
      maxAreas: 2,
    },
    {
      id: "actions",
      defaultHeading: "Next steps",
      accepts: ["recommendations", "actions"],
      required: false,
      maxAreas: 1,
    },
    {
      id: "provenance",
      accepts: ["evidence"],
      required: false,
      maxAreas: 1,
      disclosure: "collapsed",
    },
  ],
  maxAreas: 6,
};

/**
 * Who this is, then the position, then the detail.
 *
 * The shape for meeting prep and "tell me about this client": identity establishes
 * the frame before any figure means anything. This is the only recipe with a `"*"`
 * slot, because what belongs in an overview genuinely depends on the client.
 */
const ENTITY_OVERVIEW: ViewRecipe = {
  id: "EntityOverview",
  description: "Identity, headline position, then the supporting detail.",
  serves: ["entity_overview", "meeting_prep"],
  slots: [
    {
      id: "identity",
      accepts: ["identity", "summary"],
      required: true,
      arrangement: "single",
      maxAreas: 1,
    },
    {
      id: "position",
      defaultHeading: "Where things stand",
      accepts: ["performance", "allocation", "liquidity"],
      required: false,
      maxAreas: 2,
    },
    {
      id: "detail",
      accepts: "*",
      required: false,
      maxAreas: 3,
    },
    {
      id: "actions",
      defaultHeading: "Talking points",
      accepts: ["recommendations", "actions"],
      required: false,
      maxAreas: 1,
    },
    {
      id: "provenance",
      accepts: ["evidence"],
      required: false,
      maxAreas: 1,
      disclosure: "collapsed",
    },
  ],
  maxAreas: 8,
};

/**
 * The actions, the reasoning behind them, and what they depend on.
 *
 * Inverted relative to the analytical shape: here the actions lead and the
 * evidence supports, because the advisor has already accepted the analysis and is
 * asking what to do. Same facts, different job, different page.
 */
const ACTION_PLAN: ViewRecipe = {
  id: "ActionPlan",
  description: "What to do, why, and what it rests on.",
  serves: ["action_plan", "meeting_prep"],
  slots: [
    {
      id: "headline",
      accepts: ["summary", "identity"],
      required: true,
      arrangement: "single",
      maxAreas: 1,
    },
    {
      id: "actions",
      defaultHeading: "Actions",
      accepts: ["actions", "recommendations"],
      required: true,
      arrangement: "stack",
      maxAreas: 2,
    },
    {
      id: "rationale",
      defaultHeading: "Why",
      accepts: [
        "drivers",
        "risk",
        "performance",
        "market_context",
        "liquidity",
        "allocation",
        "commitments",
        "activity",
        "comparison",
      ],
      required: false,
      maxAreas: 2,
    },
    {
      id: "provenance",
      defaultHeading: "Basis",
      accepts: ["evidence"],
      required: false,
      maxAreas: 1,
      disclosure: "collapsed",
    },
  ],
  maxAreas: 5,
};

export const RECIPES: Record<RecipeId, ViewRecipe> = {
  AnalyticalReport: ANALYTICAL_REPORT,
  PropertyReport: PROPERTY_REPORT,
  ComparisonReport: COMPARISON_REPORT,
  TimelineReport: TIMELINE_REPORT,
  EntityOverview: ENTITY_OVERVIEW,
  ActionPlan: ACTION_PLAN,
};

/* ------------------------------------------------------------------ helpers */

export const recipeOf = (id: RecipeId): ViewRecipe => RECIPES[id];

export const slotOf = (recipe: ViewRecipe, slotId: string): RecipeSlot | undefined =>
  recipe.slots.find((slot) => slot.id === slotId);

/** Whether a slot will take a section of this semantic type. */
export const slotAccepts = (slot: RecipeSlot, type: SemanticType): boolean =>
  slot.accepts === "*" || slot.accepts.includes(type);

/**
 * The recipe for a task, with the two overrides that outrank the task type.
 *
 * Chronology first: a liquidity question where the calendar is the argument wants
 * the timeline shape even though `liquidity_planning` also serves the comparison
 * shape.
 *
 * `needs.comparison` deliberately does *not* override. It used to, and it was wrong:
 * a portfolio review that weighs the portfolio against its benchmark sets the flag,
 * and the review was landing on ComparisonReport — a recipe whose options and call
 * slots are required, so the page either lost its structure or aborted to text.
 * Needing a comparison is not the same as being one, and every recipe already has a
 * slot that takes one. `taskType === "comparison"` is how the shape gets chosen.
 *
 * Deliberately a lookup rather than a scoring pass. Recipe selection is the one
 * decision in this pipeline where a stable, boring answer is worth more than a
 * clever one — the same question should not produce a differently-shaped page on
 * Tuesday.
 */
export function selectRecipe(
  taskType: TaskType,
  needs: { comparison: boolean; chronology: boolean; actions: boolean },
): RecipeId {
  if (needs.chronology && taskType !== "comparison") return "TimelineReport";

  const match = (Object.keys(RECIPES) as RecipeId[]).find((id) =>
    RECIPES[id].serves.includes(taskType),
  );
  return match ?? "AnalyticalReport";
}

/**
 * Slots a semantic type could land in, in page order.
 *
 * First match wins during composition; returning all of them lets the composer
 * fall through when an earlier slot is full, and lets a test assert that every
 * semantic type has somewhere to go in every recipe.
 */
export const candidateSlots = (recipe: ViewRecipe, type: SemanticType): RecipeSlot[] =>
  recipe.slots.filter((slot) => slotAccepts(slot, type));
