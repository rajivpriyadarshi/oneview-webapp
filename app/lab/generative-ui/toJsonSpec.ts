/**
 * `UISpec` → json-render `Spec`.
 *
 * Our spec is a nested tree keyed by component id; json-render's is a flat
 * `{ root, elements, state }` map keyed by element id. The shapes carry the same
 * information, so this is a translation and not a redesign — which is the point of
 * doing it as an adapter rather than rewriting ./compose.ts to emit the other shape.
 * The composer keeps producing the artifact the validator and the recipes understand,
 * and json-render becomes the thing that renders it.
 *
 * Two decisions worth stating:
 *
 *   1. **`dataKey` becomes `{ "$state": "/<key>" }`, not a resolved value.** Baking
 *      the value in would put figures in props, which is the one thing the whole
 *      data-key indirection exists to prevent. The bundle goes into `state`, keyed by
 *      the literal dotted key, and json-render resolves the pointer at render time.
 *      Dots are not special in JSON Pointer (RFC 6901), so `perf.series` is one token.
 *   2. **Element ids are our node ids, unchanged.** `nestedToFlat` would mint
 *      `el-0`, `el-1`, … and throw ours away, and stable ids are what let a patch
 *      animate one card instead of remounting the page. So the flattening is done
 *      here, keeping `node.id`, rather than delegated.
 *
 * `span`, `sectionId` and `because` are ours and have no json-render equivalent.
 * They ride along under `meta` on the element, where the renderer can read them and
 * `validateSpec` ignores them.
 */

import type { UINode, UISpec } from "./spec";

/** One element in json-render's flat map. */
export type JsonElement = {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  slots?: Record<string, string[]>;
  /** Ours, not json-render's: grid span and the audit trail back to layer 3. */
  meta?: { span?: number; sectionId?: string; because?: string };
};

export type JsonSpec = {
  root: string;
  elements: Record<string, JsonElement>;
  state: Record<string, unknown>;
};

/** The pointer form of a bundle key. */
export const pointerFor = (key: string): string => `/${key}`;

/** A `$state` expression, which is what json-render resolves before calling props. */
const bind = (key: string) => ({ $state: pointerFor(key) });

/**
 * The synthetic root.
 *
 * `UISpec.root` is a flat list of top-level nodes because the recipe already decided
 * the page's shape, but json-render requires exactly one root element. A `Stack` is
 * the honest wrapper: it is already in the catalogue, it is what the page visually
 * is, and it means the conversion adds no component that the registry has not
 * approved.
 */
const ROOT_ID = "root";

export function toJsonSpec(spec: UISpec, bundle: Record<string, unknown> = {}): JsonSpec {
  const elements: Record<string, JsonElement> = {};

  const visit = (node: UINode): string => {
    const element: JsonElement = {
      type: node.component,
      props: {
        ...node.props,
        ...(node.dataKey ? { data: bind(node.dataKey) } : {}),
        // A component reading several keys gets them in declaration order, so a
        // chart's benchmark overlay stays the overlay rather than becoming the series.
        ...(node.dataKeys?.length ? { dataSet: node.dataKeys.map(bind) } : {}),
      },
    };

    if (node.children?.length) element.children = node.children.map(visit);
    if (node.slots) {
      element.slots = Object.fromEntries(
        Object.entries(node.slots).map(([region, kids]) => [region, kids.map(visit)]),
      );
    }

    const meta = {
      ...(node.span != null ? { span: node.span } : {}),
      ...(node.sectionId ? { sectionId: node.sectionId } : {}),
      ...(node.because ? { because: node.because } : {}),
    };
    if (Object.keys(meta).length > 0) element.meta = meta;

    elements[node.id] = element;
    return node.id;
  };

  const top = spec.root.map(visit);

  elements[ROOT_ID] = {
    type: "Stack",
    props: { gap: "normal" },
    children: top,
  };

  return {
    root: ROOT_ID,
    elements,
    /**
     * The bundle, plus the prose answer.
     *
     * `narrative` is in state rather than left on the side because §14 requires the
     * authoritative answer to be reachable from whatever the renderer is holding. A
     * spec that renders at all can always show the answer it came from.
     */
    state: { ...bundle, narrative: spec.narrative },
  };
}

/** Every `$state` key the converted spec reads, for checking against the bundle. */
export const boundPointers = (spec: JsonSpec): string[] => {
  const found = new Set<string>();
  const scan = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(scan);
    if (value && typeof value === "object") {
      const pointer = (value as { $state?: unknown }).$state;
      if (typeof pointer === "string") found.add(pointer);
      else Object.values(value).forEach(scan);
    }
  };
  Object.values(spec.elements).forEach((element) => scan(element.props));
  return [...found];
};
