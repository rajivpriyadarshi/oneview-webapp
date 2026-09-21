/**
 * Layer 7 — the UI spec.
 *
 * A declarative tree of approved components. This is the only thing the renderer
 * consumes, and it is the last artifact before pixels.
 *
 * The one rule that shapes this whole file: **a node references data, it does not
 * carry data.** `dataKey` points into the bundle (./data.ts); `props` hold labels,
 * headings, column counts, variants. Nothing else.
 *
 * That indirection is the mechanism behind §9 of the brief. The composer physically
 * cannot restate a figure, because there is no field for a figure to live in — so
 * "the UI composer must not change the underlying facts" stops being an instruction
 * in a prompt and becomes a property the validator checks by walking the tree.
 *
 * It is also the difference from the old design. There, a block was
 * `{ id, findingId, renderer, span }` and the component read the finding directly —
 * which was safe for the same reason, but only because the vocabulary was one leaf
 * per finding with no props at all. The moment components take props, the boundary
 * has to be stated rather than implied. `coerceFinding`'s `value / 100` is what the
 * implied version costs.
 *
 * Presentation stays separate from the report: the spec holds no `Finding`, only
 * ids and keys, so the same `SemanticReport` can be re-composed into a different
 * spec without the facts being touched — which is what makes conversational editing
 * (Phase 6) and saved views (Phase 7) tractable rather than a re-run.
 */

import { z } from "zod";
import { ComponentIdSchema, type ComponentId } from "./registry";
import { RecipeIdSchema } from "./recipes";

/**
 * A node in the tree.
 *
 * `id` is stable across re-composition of the same semantic content. That is not a
 * detail: stable ids are what let React keep DOM across a patch, what let the
 * reveal animation not restart, and what let a follow-up replace one area instead
 * of the page. The old `applyOps` reducer already depended on this and it carries
 * over unchanged.
 */
export type UINode = {
  id: string;
  component: ComponentId;
  props: Record<string, unknown>;
  /** Primary binding. Required for any component whose spec says `requiresData`. */
  dataKey?: string;
  /**
   * Additional bindings, for components reading more than one key — a chart with a
   * benchmark overlay, a comparison across three measures.
   */
  dataKeys?: string[];
  /** Grid columns out of 12. Absent means the container decides. */
  span?: number;
  /** The semantic section this node came from. The audit trail back to layer 3. */
  sectionId?: string;
  /** Why this component, in the advisor's language. For the audit trail, not the page. */
  because?: string;
  /** Flat children, for containers that take a list. */
  children?: UINode[];
  /**
   * Named regions, for containers that take them — Tabs' labels, SplitPane's two
   * sides. Kept distinct from `children` rather than encoded as a convention,
   * because the validator needs to check region names against the registry.
   */
  slots?: Record<string, UINode[]>;
};

export const UINodeSchema: z.ZodType<UINode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    component: ComponentIdSchema,
    props: z.record(z.string(), z.unknown()),
    dataKey: z.string().min(1).optional(),
    dataKeys: z.array(z.string().min(1)).optional(),
    span: z.number().int().min(1).max(12).optional(),
    sectionId: z.string().min(1).optional(),
    because: z.string().min(1).optional(),
    children: z.array(UINodeSchema).optional(),
    slots: z.record(z.string(), z.array(UINodeSchema)).optional(),
  }),
);

export const UISpecSchema = z.object({
  /** Stable across patches. Identifies the view, not the composition. */
  id: z.string().min(1),
  recipe: RecipeIdSchema,
  /**
   * Page order. Flat by design: the recipe's slots are already the page's shape, so
   * wrapping them in another container would put the same information in two places
   * and let them disagree.
   */
  root: z.array(UINodeSchema).min(1),
  /**
   * The prose answer, carried through unmodified from the semantic report.
   *
   * Present on the spec and not merely reachable from the report, because the
   * fallback has to work when the thing that failed is the spec. A renderer holding
   * a spec always holds something correct to show instead of it. This is §14, and it
   * is why the field is required rather than optional.
   */
  narrative: z.string().min(1),
  /** Traceability. Carried on the spec, never rendered. */
  meta: z.object({
    reportId: z.string().min(1),
    /** Which rules fired, carried from the IA plan for debugging. */
    trace: z.array(z.object({ rule: z.string(), because: z.string(), targets: z.array(z.string()) })),
    /** Sections the composer could not place. The honest version of dropping them. */
    unplacedSectionIds: z.array(z.string()),
  }),
});
export type UISpec = z.infer<typeof UISpecSchema>;

/* ------------------------------------------------------------------ helpers */

/** Every child of a node, flat children and named regions alike. */
export const childrenOf = (node: UINode): UINode[] => [
  ...(node.children ?? []),
  ...Object.values(node.slots ?? {}).flat(),
];

/** Depth-first walk over the whole spec, parents before children. */
export function* walk(
  spec: UISpec,
): Generator<{ node: UINode; parent: UINode | null; depth: number }> {
  const stack: { node: UINode; parent: UINode | null; depth: number }[] = spec.root
    .map((node) => ({ node, parent: null as UINode | null, depth: 1 }))
    .reverse();

  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) break;
    yield entry;
    const kids = childrenOf(entry.node);
    for (let index = kids.length - 1; index >= 0; index -= 1) {
      stack.push({ node: kids[index], parent: entry.node, depth: entry.depth + 1 });
    }
  }
}

export const allNodes = (spec: UISpec): UINode[] => [...walk(spec)].map((entry) => entry.node);

export const nodeCount = (spec: UISpec): number => allNodes(spec).length;

export const maxDepth = (spec: UISpec): number =>
  [...walk(spec)].reduce((deepest, entry) => Math.max(deepest, entry.depth), 0);

export const findNode = (spec: UISpec, id: string): UINode | undefined =>
  allNodes(spec).find((node) => node.id === id);

/** Every bundle key the spec binds to, for checking against what arrived. */
export const boundKeys = (spec: UISpec): string[] => [
  ...new Set(
    allNodes(spec).flatMap((node) => [
      ...(node.dataKey ? [node.dataKey] : []),
      ...(node.dataKeys ?? []),
    ]),
  ),
];

/** Components used, for a registry-coverage assertion in tests. */
export const usedComponents = (spec: UISpec): ComponentId[] => [
  ...new Set(allNodes(spec).map((node) => node.component)),
];
