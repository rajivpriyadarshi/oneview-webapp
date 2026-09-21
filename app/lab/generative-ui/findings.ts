/**
 * The leaf vocabulary — a claim about the data plus the shape of the evidence.
 *
 * Carried over from /lab/dynamic-ui's `findings.ts` with one change: the schema is
 * now the source of truth and the TypeScript types are inferred from it. The old
 * arrangement had the types here and a hand-written 100-line JSON Schema in
 * `api/lab/dynamic-ui/route.ts` describing the same thing, which is two
 * definitions that can drift apart in the one place where drift is invisible
 * until the output is wrong.
 *
 * What has *not* changed is the rule that makes the whole system work: nothing
 * here names a component, a colour, a size or a chart type. A finding says what
 * was found. The IA composer decides how it is presented.
 *
 * These sit *inside* a `SemanticSection` now rather than in a flat list — see
 * ./semantic.ts. A finding is the smallest claim; a section is what a group of
 * them means together. The old model had only the former, which is why sections
 * had to be recovered from string equality on a free-text field.
 *
 * A note on the discriminated union: the model-facing tool schema stays flat,
 * with the kind-specific fields optional and described. That is deliberate and
 * was learned the hard way — a tool schema is a prompt as much as a validator,
 * and one flat shape gets better compliance than ten branches. The flattening
 * happens at the model boundary in Phase 3; validation on this side stays strict.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ shared */

export const EmphasisSchema = z.enum(["primary", "secondary", "supporting"]);
export type Emphasis = z.infer<typeof EmphasisSchema>;

/**
 * Direction of a change as the *model* reads it, not as a chart colours it.
 *
 * Deliberately not a raw sign. A shrinking liability is good news and a growing
 * concentration is bad news, and only the analysis knows which it is looking at.
 * `neutral` exists so a component can decline to colour something rather than
 * being forced into green or red.
 */
export const SentimentSchema = z.enum(["positive", "negative", "neutral"]);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const SeriesPointSchema = z.object({
  /** The axis tick. */
  label: z.string(),
  /** Unformatted — components format, findings don't. */
  value: z.number(),
});
export type SeriesPoint = z.infer<typeof SeriesPointSchema>;

export const SeriesSchema = z.object({
  /** Legend name. Required: an unlabelled series can't go in a legend. */
  name: z.string().min(1),
  points: z.array(SeriesPointSchema),
});
export type Series = z.infer<typeof SeriesSchema>;

/**
 * A signed change, kept separate from the value it describes so a component can
 * show one, the other, or both.
 */
export const DeltaSchema = z.object({
  /** Pre-formatted for display: "+12.4%", "-S$180k". The analysis owns wording. */
  label: z.string().min(1),
  /** Machine-readable, for sorting and for choosing a direction glyph. */
  value: z.number(),
  sentiment: SentimentSchema,
});
export type Delta = z.infer<typeof DeltaSchema>;

/* -------------------------------------------------------------------- meta */

/**
 * Carried by every finding.
 *
 * `subject` survives from the old model but is demoted: it is now a label, not
 * the grouping mechanism. Sections are declared in ./semantic.ts, so a finding
 * no longer has to encode its own placement in a free-text string that has to
 * match another finding's exactly.
 */
export const FindingMetaSchema = z.object({
  id: z.string().min(1),
  emphasis: EmphasisSchema,
  /** 0–1. Low confidence is a reason to render smaller, not to hide. */
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
  /** Human-readable topic label. Not load-bearing for layout any more. */
  subject: z.string().min(1),
});
export type FindingMeta = z.infer<typeof FindingMetaSchema>;

/* ------------------------------------------------------------------- kinds */

export const FindingKindSchema = z.enum([
  "metric",
  "trend",
  "comparison",
  "composition",
  "transition",
  "requirement",
  "narrative",
  "recommendation",
  "flag",
  "checklist",
]);
export type FindingKind = z.infer<typeof FindingKindSchema>;

/** One number that matters. `series` is what earns it a sparkline. */
export const MetricFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("metric"),
  label: z.string().min(1),
  /** Pre-formatted: "S$25.4m". Currency and precision are the analysis's call. */
  value: z.string().min(1),
  /**
   * What the figure is measured against, in the analysis's own words: "of total
   * portfolio", "vs. your 35–45% range", "in the last 12 months".
   *
   * A claim, not a caption. A figure with no basis is ambiguous in a way a reader
   * cannot resolve — 62% of what, against what — and the presentation layer must not
   * be the thing that supplies the answer, because it would be guessing. So the field
   * belongs to the finding and the strip renders it where the reference document puts
   * it: under the figure it qualifies.
   */
  basis: z.string().optional(),
  delta: DeltaSchema.optional(),
  series: SeriesSchema.optional(),
});
export type MetricFinding = z.infer<typeof MetricFindingSchema>;

/** One thing over time. Point count decides sparkline vs axed chart. */
export const TrendFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("trend"),
  label: z.string().min(1),
  series: SeriesSchema,
  delta: DeltaSchema.optional(),
});
export type TrendFinding = z.infer<typeof TrendFindingSchema>;

/**
 * N entities on one measure.
 *
 * Per-entity `series` present means each has a history, which is what turns a
 * two-entity comparison into overlaid lines rather than paired bars.
 */
export const ComparisonFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("comparison"),
  label: z.string().min(1),
  /** What is being compared, e.g. "Total return". */
  measure: z.string().min(1),
  entities: z.array(
    z.object({
      name: z.string().min(1),
      value: z.number(),
      /** Pre-formatted, when the raw number shouldn't be shown bare. */
      display: z.string().optional(),
      series: SeriesSchema.optional(),
    }),
  ),
});
export type ComparisonFinding = z.infer<typeof ComparisonFindingSchema>;

/**
 * Parts of a whole.
 *
 * `value`s are shares, not percentages — 0.52, not 52. They are not required to
 * sum to exactly 1 (rounding, and "other" buckets), so a component must
 * normalise rather than trust them.
 */
export const CompositionFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("composition"),
  label: z.string().min(1),
  parts: z.array(
    z.object({
      label: z.string().min(1),
      value: z.number(),
      delta: DeltaSchema.optional(),
    }),
  ),
});
export type CompositionFinding = z.infer<typeof CompositionFindingSchema>;

/** It moved from A to B. The "Technology exposure 21% → 29%" claim. */
export const TransitionFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("transition"),
  subjectLabel: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  sentiment: SentimentSchema,
  note: z.string().optional(),
  /**
   * The size of the move and where it stands, for the case where the transition is a
   * *transfer* rather than a revaluation: money leaving one position for another.
   *
   * Both optional because most transitions have neither — "21% → 29%" is the whole claim
   * and an amount would be an invention. Where the analysis does know them, they are what
   * turns two labels and an arrow into something a reader can act on, and they are
   * pre-formatted for the same reason every other figure here is: wording is the
   * analysis's call, not a component's.
   */
  amount: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
});
export type TransitionFinding = z.infer<typeof TransitionFindingSchema>;

/** An amount needed by a date. */
export const RequirementFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("requirement"),
  /** Pre-formatted: "~S$3m". */
  amount: z.string().min(1),
  purpose: z.string().min(1),
  /** Human phrasing — "next month", "by Q1" — not a parsed date. */
  deadline: z.string().optional(),
  note: z.string().optional(),
});
export type RequirementFinding = z.infer<typeof RequirementFindingSchema>;

/**
 * A prose claim. `text` is markdown.
 *
 * `deltas` present is what promotes this from plain prose to prose-with-chips.
 */
export const NarrativeFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("narrative"),
  heading: z.string().optional(),
  text: z.string().min(1),
  deltas: z.array(DeltaSchema).optional(),
});
export type NarrativeFinding = z.infer<typeof NarrativeFindingSchema>;

/** Do this, because. */
export const RecommendationFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("recommendation"),
  title: z.string().min(1),
  rationale: z.string(),
  action: z.string().optional(),
});
export type RecommendationFinding = z.infer<typeof RecommendationFindingSchema>;

/**
 * Things that have to be done.
 *
 * A kind in its own right rather than a narrative with bullets, because a list of
 * open items is the one shape where the reader's question is "what is left?" —
 * and that question wants tick boxes and owners, not prose.
 */
export const ChecklistFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("checklist"),
  label: z.string().min(1),
  items: z.array(
    z.object({
      text: z.string().min(1),
      state: z.enum(["todo", "doing", "done"]).optional(),
      /** Human phrasing — "before the review", "within 3 months". */
      due: z.string().optional(),
      owner: z.string().optional(),
    }),
  ),
});
export type ChecklistFinding = z.infer<typeof ChecklistFindingSchema>;

/** Something is wrong. */
export const FlagFindingSchema = FindingMetaSchema.extend({
  kind: z.literal("flag"),
  severity: z.enum(["info", "warn", "critical"]),
  subjectLabel: z.string().min(1),
  detail: z.string(),
});
export type FlagFinding = z.infer<typeof FlagFindingSchema>;

export const FindingSchema = z.discriminatedUnion("kind", [
  MetricFindingSchema,
  TrendFindingSchema,
  ComparisonFindingSchema,
  CompositionFindingSchema,
  TransitionFindingSchema,
  RequirementFindingSchema,
  NarrativeFindingSchema,
  RecommendationFindingSchema,
  FlagFindingSchema,
  ChecklistFindingSchema,
]);
export type Finding = z.infer<typeof FindingSchema>;

/**
 * Maps each kind to its type, so a component or rule can declare the kinds it
 * accepts and get those narrowed without a cast.
 */
export type FindingByKind = {
  metric: MetricFinding;
  trend: TrendFinding;
  comparison: ComparisonFinding;
  composition: CompositionFinding;
  transition: TransitionFinding;
  requirement: RequirementFinding;
  narrative: NarrativeFinding;
  recommendation: RecommendationFinding;
  flag: FlagFinding;
  checklist: ChecklistFinding;
};

/* ------------------------------------------------------------- predicates */

/**
 * Shape questions the IA composer asks, kept beside the types they interrogate
 * so the answers can't drift between rules.
 *
 * They exist because "has a series" is genuinely ambiguous: a missing field, an
 * empty array and a one-point array all mean "can't draw a line", and having
 * each rule decide that for itself is how inconsistencies start.
 */

/** A series is plottable only with at least two points to draw between. */
export const isPlottable = (series: Series | undefined): boolean =>
  (series?.points.length ?? 0) >= 2;

/** True when *every* entity has its own plottable history. */
export const hasEntitySeries = (finding: ComparisonFinding): boolean =>
  finding.entities.length > 0 &&
  finding.entities.every((entity) => isPlottable(entity.series));

/**
 * The same things, measured several ways.
 *
 * A comparison finding holds N entities on *one* measure — that is the schema's rule
 * and the semantic layer is instructed in those terms: five holdings on three measures
 * is three findings over the same five entities. Which leaves a shape the presentation
 * layer has to recognise, because it is the one case where the right answer is a table.
 * A chart can only draw one of the measures and a set of cards repeats the entity names
 * three times; a table puts the entities down the side and the measures across the top,
 * which is what the claim looked like before it was split up.
 *
 * Exported rather than inlined because two places need it and they must agree: the
 * composer decides a table on it, and the renderer collects the columns with it. If
 * they disagreed the table would be built from a different set of findings than the one
 * it was chosen for.
 */
export const measureGroup = (findings: Finding[], of: Finding): ComparisonFinding[] => {
  if (of.kind !== "comparison" || of.entities.length < 2) return [];
  const key = (finding: ComparisonFinding): string => finding.entities.map((entity) => entity.name).join(" ");
  const wanted = key(of);
  return findings.filter(
    (finding): finding is ComparisonFinding => finding.kind === "comparison" && key(finding) === wanted,
  );
};

/** How many things a finding puts in front of the reader. Drives the IA rules. */
export const cardinalityOf = (finding: Finding): number => {
  switch (finding.kind) {
    case "comparison":
      return finding.entities.length;
    case "composition":
      return finding.parts.length;
    case "checklist":
      return finding.items.length;
    case "trend":
      return finding.series.points.length;
    default:
      return 1;
  }
};

export const EMPHASIS_ORDER: Record<Emphasis, number> = {
  primary: 0,
  secondary: 1,
  supporting: 2,
};
