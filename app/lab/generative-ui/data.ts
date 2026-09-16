/**
 * Layer 2 — the data boundary.
 *
 * Clean domain data and analysis, keyed by `DataRequest.key`. Never UI: no spans,
 * no component names, no colours, no ordering intent.
 *
 * This module is small and load-bearing out of proportion to its size, because it
 * is what makes §9 of the brief — "the UI composer must not change the underlying
 * facts" — an *enforceable property* rather than a line in a system prompt.
 *
 * The mechanism: a `UINode` may carry `dataKey` references but not data. The
 * validator then checks two things it could not check under the old design —
 * that every referenced key exists in the bundle, and that no prop contains a
 * figure. Composition physically cannot restate a number it is not allowed to
 * hold.
 *
 * Worth being explicit about what this fixes. The old pipeline had no data layer:
 * `clientBook()` was string-concatenated into every prompt, including the
 * structuring prompt, so the shaping pass could re-derive rather than translate.
 * And `coerceFinding` quietly rewrote values on the way through —
 * `value > 1 ? value / 100 : value` — which is a presentation layer changing a
 * number. Both are the same bug: no boundary, so no rule to break.
 */

import { z } from "zod";

export const ProvenanceSchema = z.object({
  tool: z.string().min(1),
  /** ISO timestamp. What "as of" means for every figure derived from this key. */
  asOf: z.string().min(1),
  /**
   * Where it came from, in the advisor's words — "Custody positions", not a table
   * name. Reuses prototype 1's grounding vocabulary so the existing grounding
   * pill and Inspect panel attach to a generated view's areas unchanged.
   */
  sources: z.array(z.string()),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const DataBundleSchema = z.object({
  /**
   * Domain data and analysis. `unknown` on purpose: the shape is the tool's
   * business, and this layer's job is to be a keyed store rather than a second
   * schema for every instrument in the book. Components declare what they need
   * through their own prop schemas (./registry.ts), and binding is checked there.
   */
  values: z.record(z.string(), z.unknown()),
  provenance: z.record(z.string(), ProvenanceSchema),
  /**
   * Requests that didn't come back, and why.
   *
   * Kept rather than dropped silently, for the same reason `ReportDoc.unrendered`
   * was kept in the old model: a view that quietly omits an area looks like a
   * view with nothing to say there. A failed optional request is a legitimate
   * outcome that the panel should be able to state.
   */
  failed: z.array(z.object({ key: z.string(), reason: z.string() })),
});
export type DataBundle = z.infer<typeof DataBundleSchema>;

export const emptyBundle = (): DataBundle => ({ values: {}, provenance: {}, failed: [] });

/**
 * Resolve a dotted key against the bundle.
 *
 * Keys address into nested values — `risk.concentration.method` reads `method`
 * out of whatever `risk.concentration` returned — so a component can bind to part
 * of a tool's result without the tool having to publish every leaf as its own
 * request. Longest registered prefix wins, so an exact key always beats a path.
 */
export function resolveKey(bundle: DataBundle, key: string): unknown {
  if (key in bundle.values) return bundle.values[key];

  const parts = key.split(".");
  for (let cut = parts.length - 1; cut > 0; cut -= 1) {
    const prefix = parts.slice(0, cut).join(".");
    if (!(prefix in bundle.values)) continue;

    let current: unknown = bundle.values[prefix];
    for (const step of parts.slice(cut)) {
      if (current === null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[step];
    }
    return current;
  }
  return undefined;
}

/** True when a key resolves to something a component could actually draw. */
export const hasKey = (bundle: DataBundle, key: string): boolean => {
  const value = resolveKey(bundle, key);
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/** Provenance for a key, walking up to the owning request. */
export function provenanceOf(bundle: DataBundle, key: string): Provenance | undefined {
  const parts = key.split(".");
  for (let cut = parts.length; cut > 0; cut -= 1) {
    const prefix = parts.slice(0, cut).join(".");
    const found = bundle.provenance[prefix];
    if (found) return found;
  }
  return undefined;
}

/** Every source named anywhere in the bundle, deduped, for a SourceList. */
export const allSources = (bundle: DataBundle): string[] => [
  ...new Set(Object.values(bundle.provenance).flatMap((entry) => entry.sources)),
];
