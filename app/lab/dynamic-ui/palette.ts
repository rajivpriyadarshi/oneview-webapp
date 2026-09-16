/**
 * The canonical chart palette — DESIGN.md §10 decision 5.
 *
 * This exists because a report composed at runtime has no one looking at it
 * before it ships. Hand-built screens get a designer eyeballing the blocks
 * together; blocks chosen by `select.ts` from findings the model happened to
 * return do not. So colour has to be decided once, here, rather than per
 * renderer — which is exactly how the app ended up with 253 distinct hardcoded
 * hex literals and three mutually inconsistent chart palettes.
 *
 * Promoted from CHART_COLORS + shadeHex in app/components/PortfolioExposure.tsx,
 * which was the best of the three. Copied rather than imported, per the lab
 * scope boundary — the lab owns this and cannot regress a production screen.
 *
 * Three scales, and the distinction between them is load-bearing:
 *
 *   CATEGORICAL   unordered things — holdings, sectors, asset classes.
 *                 Adjacent colours must be tellable apart.
 *   SEQUENTIAL    one ordered thing — a single series, or ranked bars.
 *                 Adjacent colours must read as the same family.
 *   SENTIMENT     good/bad/neither. Never used for categories.
 *
 * The shape of this file — one table, deliberate, per-state — follows
 * GROUNDING_TONE from prototype 1.
 */

/* ------------------------------------------------------------------ shared */

/**
 * Lighten (positive) or darken (negative) a hex colour by a percentage.
 *
 * Lifted verbatim in behaviour from PortfolioExposure.tsx so promoted colours
 * shade identically to the originals. Naive RGB arithmetic, not perceptual —
 * fine for extending a hand-picked palette, wrong for generating one.
 */
export function shadeHex(hex: string, percent: number): string {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;
  const num = parseInt(full, 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (value: number) => Math.min(255, Math.max(0, value));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0x00ff) + amt);
  const b = clamp((num & 0x0000ff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Hex plus alpha, for fills under a line and for chip backgrounds. */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------- categorical */

/**
 * 24 muted earth tones, ordered so neighbours are distinguishable.
 *
 * The order matters and is not alphabetical or by hue: a 3-part composition uses
 * the first three, so those three have to work together. Reordering this array
 * silently restyles every small chart in the report.
 */
export const CATEGORICAL = [
  "#7F4E0B", "#CE8016", "#A29076", "#444341", "#CAC0B2",
  "#59886B", "#B5603A", "#7D8840", "#A87C70", "#486878",
  "#508040", "#7A8898", "#C8A020", "#6B4060", "#4868A0",
  "#4A7050", "#508878", "#8878A0", "#785090", "#384870",
  "#8A5A48", "#904868", "#A0888C", "#6A7858",
] as const;

/**
 * Colour for the nth category, cycling with a lighten/darken shift so a chart
 * with more than 24 parts doesn't repeat itself exactly.
 *
 * Past 24 the colours stop being reliably distinguishable whatever we do — which
 * is the real argument for `select.ts` routing large sets to a table instead of
 * a chart, rather than for a bigger palette.
 */
export function categorical(index: number): string {
  const base = CATEGORICAL[index % CATEGORICAL.length];
  const cycle = Math.floor(index / CATEGORICAL.length);
  if (cycle === 0) return base;
  return shadeHex(base, cycle % 2 === 1 ? 20 * cycle : -20 * cycle);
}

/** The first `count` categorical colours. */
export const categoricalSet = (count: number): string[] =>
  Array.from({ length: Math.max(0, count) }, (_, i) => categorical(i));

/* -------------------------------------------------------------- sequential */

/**
 * One ordered measure. Darkest = highest, so ranked bars read as a ramp.
 *
 * Built from the palette's anchor brown rather than being a separate hue, so a
 * sequential block and a categorical block in the same report look related.
 */
export const SEQUENTIAL_BASE = "#7F4E0B";

/**
 * `steps` shades from the base, dark to light.
 *
 * Caps the lightening at +55% because beyond that the top of the ramp goes
 * near-white and disappears against the card, which is `bg-white/65`.
 */
export function sequential(steps: number): string[] {
  if (steps <= 0) return [];
  if (steps === 1) return [SEQUENTIAL_BASE];
  const max = 55;
  return Array.from({ length: steps }, (_, i) =>
    shadeHex(SEQUENTIAL_BASE, (i / (steps - 1)) * max),
  );
}

/** The single accent for a lone series — a sparkline, or one line chart. */
export const ACCENT = "#7F4E0B";

/* ---------------------------------------------------------------- sentiment */

/**
 * Good, bad, neither.
 *
 * Reuses prototype 1's greens and ambers so a delta chip in a report matches a
 * grounding pill in the chat beside it. Kept apart from CATEGORICAL on purpose:
 * a category that happens to land on the green would falsely read as "good".
 */
export const SENTIMENT = {
  positive: { fg: "#2FBB6B", bg: "#E7FAEF", strong: "#C9FAC5" },
  negative: { fg: "#BB4D2F", bg: "#FAEDE7", strong: "#F7D8CB" },
  neutral: { fg: "#535353", bg: "#EFEFEF", strong: "#E4E4E4" },
} as const;

export type SentimentTone = keyof typeof SENTIMENT;

/* -------------------------------------------------------------- chart trim */

/**
 * Axes, gridlines and labels. Alpha-based rather than solid greys so charts
 * survive being moved onto the translucent card background unchanged.
 */
export const CHART_TRIM = {
  grid: "rgba(0, 0, 0, 0.06)",
  axis: "rgba(0, 0, 0, 0.28)",
  label: "rgba(0, 0, 0, 0.45)",
  /** Alpha for the gradient fill under a line, top to bottom. */
  areaFrom: 0.18,
  areaTo: 0.0,
} as const;
