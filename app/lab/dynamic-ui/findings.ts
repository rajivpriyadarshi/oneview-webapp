/**
 * The finding vocabulary — layer 2 of the Dynamic UI system. See DESIGN.md §3.
 *
 * A finding is a *claim about the data plus the shape of the evidence*. It is
 * never a visual instruction: nothing here names a component, a colour, a size
 * or a chart type. That separation is the whole design. The model says what it
 * found; `select.ts` decides how to draw it.
 *
 * Which means the rule when extending this file is: if a field would only ever
 * be read by one renderer, it probably belongs in that renderer's own defaults
 * rather than here.
 *
 * These types are the contract between a model (or, in the lab, a scripted
 * source) and the deterministic layers below it, so they are deliberately
 * narrow — every optional field is a decision the selection layer can branch on.
 */

/* ------------------------------------------------------------------ shared */

export type Emphasis = "primary" | "secondary" | "supporting";

/**
 * Direction of a change, as the *model* reads it — not as a chart colours it.
 *
 * Deliberately not a raw sign. A shrinking liability is good news and a growing
 * concentration risk is bad news, and only the model knows which it is looking
 * at. `neutral` exists so a renderer can decline to colour something rather
 * than being forced into green or red.
 */
export type Sentiment = "positive" | "negative" | "neutral";

/** One point in a series. `label` is the axis tick; `value` is unformatted. */
export type SeriesPoint = {
  label: string;
  value: number;
};

export type Series = {
  /** Legend name. Required — an unlabelled series can't be put in a legend. */
  name: string;
  points: SeriesPoint[];
};

/**
 * A signed change. Kept separate from the value it describes so a renderer can
 * show one, the other, or both.
 */
export type Delta = {
  /** Pre-formatted for display: "+12.4%", "-S$180k". The model owns wording. */
  label: string;
  /** Machine-readable, for sorting and for choosing a direction glyph. */
  value: number;
  sentiment: Sentiment;
};

/**
 * Carried by every finding.
 *
 * `sources` reuses prototype 1's grounding vocabulary on purpose: it lets the
 * grounding pill and Inspect panel already built for Chat transparency attach to
 * an individual block of this report. The two prototypes should share that
 * vocabulary rather than each invent one.
 */
export type FindingMeta = {
  id: string;
  emphasis: Emphasis;
  /** 0–1. Low confidence is a reason to render smaller, not to hide. */
  confidence: number;
  sources: string[];
  /**
   * Groups findings into sections at layer 4. Findings sharing a subject stay
   * together, so this is the model's only influence over layout — and it is
   * expressed as meaning ("Asset allocation"), never as position.
   */
  subject: string;
};

/* ------------------------------------------------------------------- kinds */

export type FindingKind =
  | "metric"
  | "trend"
  | "comparison"
  | "composition"
  | "transition"
  | "requirement"
  | "narrative"
  | "recommendation"
  | "flag"
  | "checklist";

/** One number that matters. `series` is what earns it a sparkline. */
export type MetricFinding = FindingMeta & {
  kind: "metric";
  label: string;
  /** Pre-formatted: "S$25.4m". Currency and precision are the model's call. */
  value: string;
  delta?: Delta;
  series?: Series;
};

/** One thing over time. Point count decides sparkline vs axed line chart. */
export type TrendFinding = FindingMeta & {
  kind: "trend";
  label: string;
  series: Series;
  delta?: Delta;
};

/**
 * N entities on one measure.
 *
 * `series` present means each entity has a history, which is what turns a
 * two-entity comparison into the dual-line chart rather than paired bars — the
 * follow-up case in DESIGN.md §6.
 */
export type ComparisonFinding = FindingMeta & {
  kind: "comparison";
  label: string;
  /** What is being compared, e.g. "Total return". */
  measure: string;
  entities: {
    name: string;
    value: number;
    /** Pre-formatted value, when the raw number shouldn't be shown bare. */
    display?: string;
    series?: Series;
  }[];
};

/**
 * Parts of a whole. Part count decides donut vs stacked bar vs table.
 *
 * `value`s are shares of the whole, not percentages — 0.52, not 52. They are
 * not required to sum to exactly 1 (rounding, and "other" buckets), so a
 * renderer must normalise rather than trust them.
 */
export type CompositionFinding = FindingMeta & {
  kind: "composition";
  label: string;
  parts: {
    label: string;
    value: number;
    delta?: Delta;
  }[];
};

/** It moved from A to B. The "Technology exposure 21% → 29%" card. */
export type TransitionFinding = FindingMeta & {
  kind: "transition";
  subjectLabel: string;
  from: string;
  to: string;
  sentiment: Sentiment;
  note?: string;
};

/** An amount needed by a date. */
export type RequirementFinding = FindingMeta & {
  kind: "requirement";
  /** Pre-formatted: "~S$3m". */
  amount: string;
  purpose: string;
  /** Human phrasing — "next month", "by Q1" — not a parsed date. */
  deadline?: string;
  note?: string;
};

/**
 * A prose claim. `text` is markdown, rendered by the same MarkdownContent the
 * rest of the app uses, so bold and lists behave identically.
 *
 * `deltas` present is what promotes this from plain prose to prose-with-chips.
 */
export type NarrativeFinding = FindingMeta & {
  kind: "narrative";
  heading?: string;
  text: string;
  deltas?: Delta[];
};

/** Do this, because. */
export type RecommendationFinding = FindingMeta & {
  kind: "recommendation";
  title: string;
  rationale: string;
  action?: string;
};

/**
 * Things that have to be done.
 *
 * A category in its own right rather than a narrative with bullets, because a
 * list of open items is the one shape where the reader's question is "what is
 * left?" — and that question wants tick boxes and owners, not prose. Nothing here
 * says "checklist component": it says these are items with a state.
 */
export type ChecklistFinding = FindingMeta & {
  kind: "checklist";
  label: string;
  items: {
    text: string;
    /** Open unless the book says otherwise. */
    state?: "todo" | "doing" | "done";
    /** Human phrasing — "before the review", "within 3 months". */
    due?: string;
    owner?: string;
  }[];
};

/** Something is wrong. */
export type FlagFinding = FindingMeta & {
  kind: "flag";
  severity: "info" | "warn" | "critical";
  subjectLabel: string;
  detail: string;
};

export type Finding =
  | MetricFinding
  | TrendFinding
  | ComparisonFinding
  | CompositionFinding
  | TransitionFinding
  | RequirementFinding
  | NarrativeFinding
  | RecommendationFinding
  | FlagFinding
  | ChecklistFinding;

/**
 * Maps each kind to its finding type, so a renderer can declare the kinds it
 * accepts and get those narrowed in its props without a cast.
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
 * Shape questions the selection layer asks, kept here beside the types they
 * interrogate so the answers can't drift between renderers.
 *
 * They exist because "has a series" is genuinely ambiguous: an empty array, a
 * one-point array and a missing field all mean "can't draw a line", and having
 * each renderer decide that for itself is how inconsistencies start.
 */

/** A series is plottable only with at least two points to draw between. */
export const isPlottable = (series: Series | undefined): boolean =>
  (series?.points.length ?? 0) >= 2;

/** True when *every* entity has its own plottable history. */
export const hasEntitySeries = (finding: ComparisonFinding): boolean =>
  finding.entities.length > 0 &&
  finding.entities.every((entity) => isPlottable(entity.series));

export const EMPHASIS_ORDER: Record<Emphasis, number> = {
  primary: 0,
  secondary: 1,
  supporting: 2,
};
