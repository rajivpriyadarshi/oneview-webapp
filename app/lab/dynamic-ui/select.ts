/**
 * Layer 3 — the selection layer. DESIGN.md §4. This is the core of the system.
 *
 * Given a finding, decide which renderer draws it. Deterministic and pure, so
 * the same finding always produces the same choice, and the whole table below is
 * unit-testable without a model or a browser.
 *
 * Not an if-chain. Each renderer *declares* what it accepts and scores its own
 * fit, and selection is a scoring pass. The difference matters for two reasons:
 * adding a renderer is a local change rather than an edit to a growing
 * conditional, and every choice carries a reason, which DESIGN.md §10 decision 4
 * puts on screen.
 *
 * Descriptors live here, apart from the React components that render them. A
 * descriptor is pure data about *suitability* — it has no JSX and imports no
 * component — which is why this layer can be built and reviewed before a single
 * renderer exists.
 */

import {
  hasEntitySeries,
  isPlottable,
  type Finding,
  type FindingKind,
} from "./findings";
import type { DrawRequest } from "./interpret";

/** 12-column report grid. Blocks may span 4, 6, 8 or 12. */
export type Span = 4 | 6 | 8 | 12;

export type RendererId =
  | "HeroMetric"
  | "StatTile"
  | "Sparkline"
  | "LineChart"
  | "DualLineChart"
  | "MultiLineChart"
  | "PairedBars"
  | "BarChart"
  | "DonutChart"
  | "StackedBar"
  | "DataTable"
  | "TransitionCard"
  | "RequirementCard"
  | "NarrativeWithChips"
  | "ProseBlock"
  | "RecommendationCard"
  | "FlagCallout"
  | "Checklist"
  | "FallbackList";

export type RendererDescriptor = {
  id: RendererId;
  /** Kinds this renderer will even be asked about. */
  accepts: FindingKind[];
  /**
   * 0 means "cannot render this" and excludes the renderer outright. Otherwise
   * 0–1 for how well it fits. Only ever called with an accepted kind.
   */
  fit: (finding: Finding) => number;
  /** Grid width it wants. */
  preferredSpan: (finding: Finding) => Span;
  /** Why, in the words the UI will show. Written for a reader, not a log. */
  reason: (finding: Finding) => string;
};

/* --------------------------------------------------------------- descriptors */

/**
 * The rules. This table *is* the design decision — it encodes what shape of
 * evidence deserves what shape of chart, and it's the thing to argue with.
 *
 * Order is the tie-break: on an exact score tie, the earlier entry wins. So the
 * list is roughly most-specific first, and reordering it can change output.
 */
export const RENDERERS: RendererDescriptor[] = [
  /* ------------------------------------------------------------- metric */
  {
    id: "HeroMetric",
    accepts: ["metric"],
    // The headline number earns a sparkline. Primary emphasis only: every
    // metric looking like the headline means none of them does.
    fit: (f) =>
      f.kind === "metric" && f.emphasis === "primary"
        ? isPlottable(f.series)
          ? 1
          : 0.75
        : 0,
    preferredSpan: () => 12,
    reason: (f) =>
      f.kind === "metric" && isPlottable(f.series)
        ? "Headline metric with history, so it carries a sparkline"
        : "Headline metric — the report's primary number",
  },
  {
    id: "StatTile",
    accepts: ["metric"],
    // Context, not headline. Deliberately no chart even when a series exists.
    fit: (f) => (f.kind === "metric" ? (f.emphasis === "primary" ? 0.4 : 0.9) : 0),
    preferredSpan: () => 4,
    reason: () => "Supporting metric — shown as a compact figure, no chart",
  },

  /* -------------------------------------------------------------- trend */
  {
    id: "Sparkline",
    accepts: ["trend"],
    // Too few points to justify axes; axes on 5 points is chart junk.
    fit: (f) => {
      if (f.kind !== "trend" || !isPlottable(f.series)) return 0;
      return f.series.points.length <= 8 ? 0.9 : 0.3;
    },
    preferredSpan: () => 4,
    reason: (f) =>
      f.kind === "trend"
        ? `${f.series.points.length} points — too few to justify axes`
        : "",
  },
  {
    id: "LineChart",
    accepts: ["trend"],
    fit: (f) => {
      if (f.kind !== "trend" || !isPlottable(f.series)) return 0;
      return f.series.points.length > 8 ? 1 : 0.5;
    },
    preferredSpan: (f) => (f.emphasis === "primary" ? 12 : 6),
    reason: (f) =>
      f.kind === "trend"
        ? `${f.series.points.length} points over time — enough to warrant axes`
        : "",
  },

  /* --------------------------------------------------------- comparison */
  {
    id: "DualLineChart",
    accepts: ["comparison"],
    // The follow-up case from DESIGN.md §6: "compare his top 2 holdings".
    // Two entities that each have a history is the one shape where overlaying
    // lines beats putting bars side by side.
    fit: (f) =>
      f.kind === "comparison" && f.entities.length === 2 && hasEntitySeries(f)
        ? 1
        : 0,
    preferredSpan: () => 12,
    reason: (f) =>
      f.kind === "comparison"
        ? `Two entities with history — overlaid lines compare ${f.measure} directly`
        : "",
  },
  {
    id: "MultiLineChart",
    accepts: ["comparison"],
    // Three or more entities that each carry a history. Bars would throw the
    // history away, and a table would make the reader do the comparing — so this
    // sits above BarChart, but only when the series are actually there.
    fit: (f) => {
      if (f.kind !== "comparison" || !hasEntitySeries(f)) return 0;
      const n = f.entities.length;
      return n >= 3 && n <= 6 ? 0.96 : 0;
    },
    preferredSpan: () => 12,
    reason: (f) =>
      f.kind === "comparison"
        ? `${f.entities.length} entities with history — overlaid lines on one scale`
        : "",
  },
  {
    id: "PairedBars",
    accepts: ["comparison"],
    fit: (f) => {
      if (f.kind !== "comparison" || f.entities.length !== 2) return 0;
      // Loses to DualLineChart when there is history to draw.
      return hasEntitySeries(f) ? 0.5 : 0.95;
    },
    preferredSpan: () => 6,
    reason: () => "Two entities, single values — paired bars read fastest",
  },
  {
    id: "BarChart",
    accepts: ["comparison"],
    // Horizontal bars in a list, so the ceiling is how many rows stay readable
    // stacked, not how many fit across an axis — around a dozen. A ranking of
    // eight holdings is a bar chart; making it a table hands the reader numbers
    // and asks them to do the comparing themselves.
    fit: (f) => {
      if (f.kind !== "comparison") return 0;
      const n = f.entities.length;
      return n >= 3 && n <= 12 ? 0.9 : 0;
    },
    // Past six rows the labels need the room.
    preferredSpan: (f) => (f.kind === "comparison" && f.entities.length > 6 ? 12 : 6),
    reason: (f) =>
      f.kind === "comparison"
        ? `${f.entities.length} entities — still readable as bars`
        : "",
  },

  /* -------------------------------------------------------- composition */
  {
    id: "DonutChart",
    accepts: ["composition"],
    fit: (f) => {
      if (f.kind !== "composition" || f.parts.length < 2) return 0;
      return f.parts.length <= 6 ? 0.95 : 0;
    },
    preferredSpan: (f) => (f.emphasis === "primary" ? 6 : 4),
    reason: (f) =>
      f.kind === "composition"
        ? `${f.parts.length} parts of a whole — few enough for readable segments`
        : "",
  },
  {
    id: "StackedBar",
    accepts: ["composition"],
    fit: (f) => {
      if (f.kind !== "composition" || f.parts.length < 2) return 0;
      // Above ~6 the donut's thin slices stop being comparable; above 12 even a
      // stacked bar is worse than a table, so hand over to DataTable.
      return f.parts.length > 6 && f.parts.length <= 12 ? 0.9 : 0.2;
    },
    preferredSpan: () => 12,
    reason: (f) =>
      f.kind === "composition"
        ? `${f.parts.length} parts — donut segments would be too thin`
        : "",
  },

  /* ----------------------------------------------------------- fallback */
  {
    id: "DataTable",
    accepts: ["comparison", "composition"],
    // The honest answer when there are too many rows to draw. Scores low but
    // non-zero everywhere it applies, so it is the floor rather than a choice —
    // and it wins outright once the charts have excluded themselves.
    //
    // The floor still needs a lower bound. Without one it also catches
    // *degenerate* findings — a composition with a single part is not a table
    // with too many rows to chart, it's a finding with nothing to compare, and
    // rendering it as a one-row table captioned "past the point where a chart is
    // readable" is worse than declining. Below two rows, nothing renders and
    // compose.ts drops the block.
    fit: (f) => {
      if (f.kind === "comparison") {
        if (f.entities.length < 2) return 0;
        return f.entities.length > 12 ? 0.95 : 0.15;
      }
      if (f.kind === "composition") {
        if (f.parts.length < 2) return 0;
        return f.parts.length > 12 ? 0.95 : 0.1;
      }
      return 0;
    },
    preferredSpan: () => 12,
    reason: (f) => {
      const n =
        f.kind === "comparison"
          ? f.entities.length
          : f.kind === "composition"
            ? f.parts.length
            : 0;
      return `${n} rows — past the point where a chart is readable`;
    },
  },

  /* --------------------------------------------------------- one-to-one */
  {
    id: "TransitionCard",
    accepts: ["transition"],
    fit: () => 1,
    preferredSpan: () => 6,
    reason: () => "A from/to movement — shown as a transition card",
  },
  {
    id: "RequirementCard",
    accepts: ["requirement"],
    fit: () => 1,
    preferredSpan: () => 6,
    reason: () => "An amount needed by a date",
  },
  {
    id: "NarrativeWithChips",
    accepts: ["narrative"],
    fit: (f) => (f.kind === "narrative" && (f.deltas?.length ?? 0) > 0 ? 1 : 0),
    preferredSpan: () => 12,
    reason: (f) =>
      f.kind === "narrative"
        ? `Prose with ${f.deltas?.length ?? 0} supporting figures`
        : "",
  },
  {
    id: "ProseBlock",
    accepts: ["narrative"],
    fit: (f) => (f.kind === "narrative" ? 0.8 : 0),
    preferredSpan: () => 12,
    reason: () => "Prose with no figures to pull out",
  },
  {
    id: "RecommendationCard",
    accepts: ["recommendation"],
    fit: () => 1,
    preferredSpan: () => 12,
    reason: () => "An action with a rationale",
  },
  {
    id: "FlagCallout",
    accepts: ["flag"],
    fit: () => 1,
    preferredSpan: (f) => (f.kind === "flag" && f.severity === "critical" ? 12 : 6),
    reason: (f) =>
      f.kind === "flag" ? `A ${f.severity} flag needing attention` : "",
  },

  {
    id: "Checklist",
    accepts: ["checklist"],
    // A single item is not a list; it is a sentence, and FallbackList states it
    // as one rather than drawing one lonely tick box.
    fit: (f) => (f.kind === "checklist" && f.items.length >= 2 ? 1 : 0),
    // Half width unless it is long enough that wrapped items would look ragged.
    preferredSpan: (f) => (f.kind === "checklist" && f.items.length > 4 ? 12 : 6),
    reason: (f) =>
      f.kind === "checklist"
        ? `${f.items.length} open items — a list to work through, not prose`
        : "",
  },

  /* ------------------------------------------------------- the last resort */
  /**
   * Accepts everything, at a score below every real renderer, and renders as a
   * heading plus pointers.
   *
   * The reason it exists: the ask is open-ended, so the model will eventually
   * report something whose shape no chart wants — a one-part composition, a
   * comparison of one thing, a metric with no number. The alternative to a
   * fallback is dropping the finding, and a report that silently omits what it
   * found is worse than one that states it plainly as text.
   */
  {
    id: "FallbackList",
    accepts: [
      "metric", "trend", "comparison", "composition", "transition",
      "requirement", "narrative", "recommendation", "flag", "checklist",
    ],
    fit: () => 0.02,
    preferredSpan: (f) => (f.emphasis === "supporting" ? 6 : 12),
    reason: () => "No chart suits this shape, so it's stated as text",
  },
];

/* ---------------------------------------------------------------- selection */

export type SelectionTrace = {
  rendererId: RendererId;
  fit: number;
  reason: string;
  span: Span;
  /** Everything else that could have rendered it, best first. */
  runnersUp: { rendererId: RendererId; fit: number }[];
};

/**
 * Pick a renderer for one finding.
 *
 * Returns null only when nothing accepts the kind at all — which means a kind
 * was added to `findings.ts` without a renderer, and is a bug rather than a
 * runtime condition. Callers should surface it, not silently drop the block.
 */
export function selectRenderer(finding: Finding): SelectionTrace | null {
  const scored = RENDERERS.filter((r) => r.accepts.includes(finding.kind))
    .map((r) => ({ renderer: r, fit: r.fit(finding) }))
    .filter((entry) => entry.fit > 0)
    // Stable: sort() preserves declaration order on ties in every modern engine,
    // so RENDERERS order is the documented tie-break.
    .sort((a, b) => b.fit - a.fit);

  const best = scored[0];
  if (!best) return null;

  return {
    rendererId: best.renderer.id,
    fit: best.fit,
    reason: best.renderer.reason(finding),
    span: best.renderer.preferredSpan(finding),
    runnersUp: scored
      .slice(1)
      .map((entry) => ({ rendererId: entry.renderer.id, fit: entry.fit })),
  };
}

/* -------------------------------------------------------------- an override */

/**
 * Which renderers count as which *family* of visual.
 *
 * A family, not a renderer id, because "make this bars" doesn't say whether two
 * entities want paired bars or eight want a ranked list — that is still a
 * decision this layer is better placed to make than the person asking.
 */
const FAMILIES: Record<DrawRequest, RendererId[]> = {
  table: ["DataTable"],
  bars: ["PairedBars", "BarChart", "StackedBar"],
  lines: ["DualLineChart", "MultiLineChart", "LineChart", "Sparkline"],
  donut: ["DonutChart"],
  checklist: ["Checklist"],
  text: ["NarrativeWithChips", "ProseBlock", "FallbackList"],
};

/** Which family a chosen renderer belongs to, if any. */
export function familyOf(rendererId: RendererId): DrawRequest | null {
  for (const [family, ids] of Object.entries(FAMILIES) as [DrawRequest, RendererId[]][]) {
    if (ids.includes(rendererId)) return family;
  }
  return null;
}

/**
 * Draw this finding as the named family — the advisor pointed at the card and
 * said so.
 *
 * Null when no renderer in the family can honestly draw it: asking for a pie of
 * eight separate holdings is asking for slices of a whole that isn't one, and
 * saying so beats drawing something misleading because it was requested.
 */
export function selectFamily(finding: Finding, family: DrawRequest): SelectionTrace | null {
  const ids = FAMILIES[family];
  const scored = RENDERERS.filter((r) => ids.includes(r.id) && r.accepts.includes(finding.kind))
    .map((r) => ({ renderer: r, fit: r.fit(finding) }))
    .filter((entry) => entry.fit > 0)
    .sort((a, b) => b.fit - a.fit);

  const best = scored[0];
  if (!best) return null;

  return {
    rendererId: best.renderer.id,
    fit: best.fit,
    // The reason has to say it was asked for. Otherwise the trace claims the
    // rules chose this, and the one thing the rules didn't do here is choose.
    reason: `You asked for this as ${family === "donut" ? "a pie" : family} — ${best.renderer.reason(finding)}`,
    span: best.renderer.preferredSpan(finding),
    runnersUp: scored.slice(1).map((entry) => ({ rendererId: entry.renderer.id, fit: entry.fit })),
  };
}
