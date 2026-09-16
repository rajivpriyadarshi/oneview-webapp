/**
 * Layer 4 — the information architecture plan.
 *
 * The contract only; the rules that produce it land in Phase 4.
 *
 * This layer did not exist before, and its absence is the central structural
 * problem with the old pipeline. There, the deterministic core was
 * `selectRenderer(finding) → RendererId`: a function of exactly one finding,
 * returning exactly one leaf component. Every decision the brief asks for is a
 * function of *sets* — these two belong in tabs, these ten securities are one
 * table rather than ten cards, this belongs behind disclosure, this area answers
 * the same question as that one. None of them is expressible in that signature,
 * which is why ten findings always produced ten cards.
 *
 * `critique.ts` was the old design reaching for this and not getting there. Its
 * six rules are genuine page-level intelligence, but it ran *after* composition
 * and repaired a finished document with a five-op vocabulary — so it could demote
 * a heading and could not create a container. The rules survive; they move here,
 * before composition, where they can decide rather than repair.
 *
 * The deliberate constraint on this file: an IAPlan names no components. It says
 * "table", not `DataTable`; "tabs", not `Tabs`. The mapping from a presentation
 * form to an approved component is the registry's (./registry.ts), and keeping
 * the two apart is what lets the component vocabulary change without rewriting
 * the architecture rules.
 */

import { z } from "zod";

/**
 * How an area's contents relate structurally.
 *
 * Chosen by rules over the section set, not by taste. The brief's conditions, in
 * the form they'll be encoded in Phase 4:
 *
 *   tabs   — 2–5 sibling views, same visual structure, only one needed at once.
 *            Never because sections merely happen to be adjacent; never with one
 *            item. The "only one at once" clause does real work: three
 *            comparisons a decision depends on fail it, and become `split`.
 *   table  — more than about four records sharing the same attributes, or
 *            cross-row comparison is the point. Never for two simple records.
 *   grid   — independent items, differing content types, standalone emphasis.
 *            This is the cards case, bounded so it can't become card soup.
 *   split  — two things that must be read against each other simultaneously.
 *   stack  — related sections read in order, one after another.
 *   single — one section, one presentation.
 */
export const ArrangementSchema = z.enum([
  "single",
  "stack",
  "grid",
  "tabs",
  "split",
  "table",
  "list",
]);
export type Arrangement = z.infer<typeof ArrangementSchema>;

/**
 * What a section should become, semantically-but-visually.
 *
 * The seam between architecture and components: the IA composer picks a form, the
 * registry declares which approved components `implement` that form, and the
 * ported `select.ts` fitness scores break the tie.
 */
export const PresentationFormSchema = z.enum([
  "metric",
  "metric_strip",
  "table",
  "ranked_list",
  "chart",
  "timeline",
  "callout",
  "checklist",
  "comparison",
  "prose",
  "key_value",
]);
export type PresentationForm = z.infer<typeof PresentationFormSchema>;

/**
 * Why a chart, when it is a chart.
 *
 * The brief's rule is that a chart is right when trend / distribution /
 * composition / magnitude / relationship matters more than reading exact
 * individual values. Recording *which* of those is the reason is what lets the
 * registry pick between a line, bars, a donut and a heatmap without re-deriving
 * it from the finding shape — and it makes the choice reviewable, since a chart
 * whose stated reason is "magnitude" but which draws a donut is visibly wrong.
 */
export const ChartIntentSchema = z.enum([
  "trend",
  "distribution",
  "composition",
  "magnitude",
  "relationship",
]);
export type ChartIntent = z.infer<typeof ChartIntentSchema>;

export const SectionPresentationSchema = z.object({
  form: PresentationFormSchema,
  chartOf: ChartIntentSchema.optional(),
  /**
   * Visual weight. Distinct from `SemanticSection.importance`: importance is a
   * claim about the information, emphasis is what the layout does about it. They
   * usually agree, and the recipe is allowed to override — a primary
   * recommendation in a ComparisonReport still belongs last.
   */
  emphasis: z.enum(["hero", "normal", "quiet"]),
  disclosure: z.enum(["open", "collapsed"]),
  /** In the advisor's language. Surfaced per the old design's decision 4. */
  because: z.string().min(1),
});
export type SectionPresentation = z.infer<typeof SectionPresentationSchema>;

export const IAAreaSchema = z.object({
  id: z.string().min(1),
  /**
   * The area's heading, derived from the shared question of its sections —
   * "Performance drivers" for contributors + detractors.
   */
  heading: z.string().min(1),
  /** Sections grouped into this area, in reading order. */
  sectionIds: z.array(z.string()).min(1),
  /** Position among areas. Lower reads first. */
  rank: z.number().int().min(0),
  importance: z.enum(["primary", "secondary", "supporting"]),
  arrangement: ArrangementSchema,
  /** Per-section presentation, keyed by section id. */
  presentation: z.record(z.string(), SectionPresentationSchema),
});
export type IAArea = z.infer<typeof IAAreaSchema>;

export const IAPlanSchema = z.object({
  areas: z.array(IAAreaSchema),
  /**
   * Every rule that fired, with its reason and what it touched.
   *
   * Not a log. This is the testable surface of the layer — the same property that
   * made `select.ts`'s table arguable in review, applied to architecture instead
   * of to single charts. A rule that can't say what it did and why doesn't belong
   * in here.
   */
  trace: z.array(
    z.object({
      rule: z.string().min(1),
      because: z.string().min(1),
      targets: z.array(z.string()),
    }),
  ),
});
export type IAPlan = z.infer<typeof IAPlanSchema>;

/* ------------------------------------------------------------------ helpers */

/** Areas in reading order. */
export const orderedAreas = (plan: IAPlan): IAArea[] =>
  [...plan.areas].sort((a, b) => a.rank - b.rank);

/**
 * The one area carrying the view's headline, if any.
 *
 * Exactly one is the target state — "a page where everything is the same weight
 * has no entry point" was `critique.ts` rule 2, and rule 3 was the converse. Both
 * become IA decisions, and the validator asserts the outcome.
 */
export const headlineArea = (plan: IAPlan): IAArea | undefined =>
  orderedAreas(plan).find((area) =>
    Object.values(area.presentation).some((entry) => entry.emphasis === "hero"),
  );

/** Every section id the plan places, for checking against the semantic report. */
export const placedSectionIds = (plan: IAPlan): string[] =>
  plan.areas.flatMap((area) => area.sectionIds);
