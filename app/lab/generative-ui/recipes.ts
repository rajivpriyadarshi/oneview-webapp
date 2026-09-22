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
  /** Reader-facing heading for the first area that lands here. */
  defaultHeading: z.string().min(1).optional(),
  /**
   * Names for the second and later areas in a slot that takes more than one.
   *
   * A slot with `maxAreas: 3` used to give its first area the structural name and let the
   * rest fall back to the section's own question, which put two registers of heading on one
   * page — "2. What changed" above "3. Where is the listed portfolio, and what is in it".
   * The second is a sentence, it is generated, and it moves between clients. These are the
   * names for the shapes a slot predictably holds in order: movement, then the positions,
   * then the mix. Where the list runs out the question is still the fallback, because
   * inventing a name for content the recipe did not anticipate would be a worse lie than
   * printing the analysis's own words.
   */
  moreHeadings: z.array(z.string().min(1)).optional(),
  /**
   * This slot continues the one before it: its areas get no heading and no number.
   *
   * For the case where a section is a second look at the previous one rather than a new
   * topic — the concentration a rally created belongs *inside* "what drove the change",
   * and giving it its own numbered heading would tell the reader there is one more thing
   * to read than there is. The section's own takeaway carries the link, so nothing is
   * unlabelled; what is dropped is the claim that a new subject has started.
   */
  continuation: z.boolean().optional(),
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
  /* Reader-facing, because the masthead prints it as the document's subtitle. It used to
     name the slots — "Headline, what changed, why it changed, risks" — which described the
     recipe to whoever wrote it rather than the document to whoever is reading it. */
  description:
    "A consolidated view of the portfolio, with what changed, what drove it and what to decide.",
  serves: ["portfolio_review", "risk_review", "explanation"],
  slots: [
    {
      id: "headline",
      /*
       * "The readout" — the reference's name for the first section, and a better one than
       * the question it used to take. A generated heading like "What is the portfolio
       * worth" is the *analysis's* question, and printing it as section 1 makes the page
       * read as a transcript of the pipeline rather than as a document. The section names
       * are structural: every report of this shape has the same six, in the same order, so
       * a reader who has seen one knows where to look in the next.
       */
      defaultHeading: "The readout",
      accepts: ["summary", "performance", "identity"],
      required: true,
      arrangement: "single",
      maxAreas: 1,
    },
    {
      id: "whatChanged",
      defaultHeading: "What changed",
      moreHeadings: ["How it is performing"],
      accepts: ["activity", "performance"],
      required: false,
      maxAreas: 2,
    },
    {
      id: "why",
      defaultHeading: "What drove the change",
      moreHeadings: ["Market context"],
      accepts: ["drivers", "market_context"],
      required: false,
      maxAreas: 2,
    },
    /*
     * What the drivers did to the shape of the book, read as a row.
     *
     * The same rally that earns the return is usually the thing that concentrates the
     * portfolio, and the reference puts those two facts under one number for that reason:
     * the position, its weight over time and the warning are three readings of a single
     * claim. Hence `continuation` — no heading of its own — and `grid`, so the three land
     * side by side instead of as three stacked blocks that each look like news.
     */
    {
      id: "whyDetail",
      accepts: ["risk"],
      required: false,
      maxAreas: 1,
      continuation: true,
      arrangement: "grid",
    },
    /*
     * Where things stand, after why they moved.
     *
     * This slot is new and it is the fix for an ordering problem, not a cosmetic addition.
     * The allocation and the holdings used to share the `whatChanged` slot, which put them
     * *before* the attribution — so the page said what the book is invested in, and only
     * then why it moved. Slot order is page order, so the only way to read "movement →
     * attribution → position" is to give the position its own slot after `why`.
     */
    {
      id: "state",
      defaultHeading: "Current portfolio state",
      moreHeadings: ["How it is invested", "What is in the book"],
      accepts: ["allocation", "comparison", "identity"],
      required: false,
      maxAreas: 2,
      /*
       * Side by side, not one after the other.
       *
       * How the money is spread and what it is actually in are the same question asked at
       * two resolutions, and the reader moves between them — "14% cash" means one thing
       * next to a list led by a single stock and another thing next to a list of bond
       * funds. Stacked, that comparison costs a scroll; tabbed, it costs a click and the
       * reader has to remember the other half.
       */
      arrangement: "split",
    },
    {
      id: "risks",
      defaultHeading: "What needs attention",
      moreHeadings: ["Other exposures"],
      accepts: ["risk"],
      required: false,
      maxAreas: 2,
    },
    /*
     * What is owed, and when.
     *
     * Split out of `risks`, which used to take liquidity and commitments as well. Bundling
     * them cost the distinction the reader most needs at this point in the page: an
     * exposure is a judgement about the shape of the book, and a capital call is a date.
     * Putting a dated obligation under "what needs attention" also lost the reference's
     * own sixth section, which asks a different question — not "is this risky" but "what
     * is coming".
     */
    {
      id: "coming",
      defaultHeading: "What's coming",
      accepts: ["liquidity", "commitments"],
      required: false,
      maxAreas: 2,
      /* A transfer and the dates around it are one statement in two halves: what has to
         move, and when the things it waits on happen. */
      arrangement: "grid",
    },
    {
      id: "actions",
      defaultHeading: "Decisions & next steps",
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
  // Ten. It was eight, tuned when this recipe had five content slots; it now has seven,
  // because attribution, position and the forward calendar each got their own — so eight
  // meant the page filled before the sources and the closing actions were placed, and
  // placement is first-fit. Dropping the sources and the currency assumptions off a
  // financial document to save a row is the wrong trade. The slot caps still bind and
  // still add up to more than this, so the ceiling is doing its job: it buys the shape
  // room to be complete, not licence to be long.
  maxAreas: 10,
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
  description: "A clear view of your wealth, liquidity, and upcoming commitments.",
  serves: ["property_review"],
  slots: [
    {
      id: "headline",
      defaultHeading: "The readout",
      /*
       * Summary only. The other recipes let an `identity` section open the page, and doing
       * that here cost the report its readout: page order is taken from each group's first
       * candidate slot, so with `identity` listed the ownership sections sorted to position
       * one, filled a slot with room for one area, and left the summary — the only section
       * marked primary, the one the headline figures are lifted from — unplaced. It failed
       * loudly in the test that asserts nothing is dropped, which is why that test exists.
       */
      accepts: ["summary"],
      required: true,
      arrangement: "single",
      maxAreas: 1,
    },
    {
      id: "movement",
      defaultHeading: "What changed",
      moreHeadings: ["Since the last review"],
      accepts: ["activity", "drivers"],
      required: false,
      maxAreas: 1,
    },
    {
      /*
       * Who owns it, before what it is worth.
       *
       * The slot the other recipes have no use for: an estate held through a trust and a
       * holding company is a different subject from an account, and the reader's first
       * question about it is not performance but control — who is the trustee, who the
       * beneficiaries are, when it vests. `identity` is the type the analysis marks that
       * with, and the position is the argument: a figure means something different once
       * you know which entity it sits in.
       */
      id: "structure",
      defaultHeading: "How the estate is held",
      moreHeadings: ["The family and succession"],
      accepts: ["identity"],
      required: false,
      arrangement: "split",
      maxAreas: 2,
    },
    {
      /*
       * The real assets in their own right, and not as rows of the holdings table.
       *
       * A property has attributes a listed position does not — a yield, a tenancy, a lease
       * that ends on a date, a valuation with an age — and a book that is 38% property is
       * one where those attributes are the analysis rather than detail beneath it. Six
       * properties measured five ways is a schedule; the same six as a line of a holdings
       * table is a number that happens to be large.
       */
      id: "property",
      defaultHeading: "The property book",
      moreHeadings: ["The assets behind it"],
      accepts: ["comparison"],
      required: false,
      maxAreas: 1,
    },
    {
      id: "book",
      defaultHeading: "What the portfolio looks like now",
      moreHeadings: ["How it is invested"],
      accepts: ["allocation", "performance"],
      required: true,
      arrangement: "split",
      maxAreas: 1,
    },
    {
      /*
       * One area, not two, and that is the point: what there is to spend and what has to
       * be spent are the two halves of a subtraction. A reader who has to scroll between
       * them is holding one of the numbers in their head. The report pairs the sections
       * with `answers_same_question`; this slot is what leaves room for the pair.
       */
      id: "funding",
      defaultHeading: "Liquidity & commitments",
      moreHeadings: ["What it needs"],
      /*
       * Liquidity only, though the area holds a commitments section too.
       *
       * Slot candidacy is read from the group's *first* section, and page order is read
       * from each group's first candidate slot — so a slot that accepted `commitments`
       * would pull a standalone calendar up to here and print "What's coming" ahead of
       * "What needs attention". The pair still lands together, because the report grouped
       * them and the group leads with the liquidity section.
       */
      accepts: ["liquidity"],
      required: false,
      arrangement: "split",
      maxAreas: 1,
    },
    {
      /*
       * What the market did, and only where the analysis brought it.
       *
       * Below the portfolio rather than above it, which is the opposite of where a
       * benchmarked report would put it. On a listed book the market is the yardstick and
       * belongs beside the return; on a book of buildings it is context for a handful of
       * specific assets — a rate decision that bears on one valuation, a vacancy rate that
       * bears on one renewal — and context read before the thing it contextualises is just
       * news.
       */
      id: "context",
      defaultHeading: "The property market",
      moreHeadings: ["Market context"],
      accepts: ["market_context"],
      required: false,
      maxAreas: 1,
    },
    {
      id: "risks",
      defaultHeading: "Private assets & valuations",
      moreHeadings: ["What needs attention"],
      accepts: ["risk"],
      required: false,
      maxAreas: 2,
    },
    {
      id: "coming",
      defaultHeading: "What's coming",
      accepts: ["commitments", "activity"],
      required: false,
      maxAreas: 1,
    },
    {
      id: "actions",
      defaultHeading: "Decisions & next steps",
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
  // Twelve, and the highest ceiling of any recipe here, because this shape carries four
  // things the others fold away: an ownership structure, a property schedule, a dated
  // funding calendar and a valuation-quality finding. The slot caps add to thirteen, so
  // the ceiling still binds — which is the point. It is the difference between twelve
  // areas placed and the last one, the sources, silently dropped.
  maxAreas: 12,
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
