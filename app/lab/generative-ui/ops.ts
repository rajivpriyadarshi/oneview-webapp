/**
 * Patch operations — the vocabulary for changing a view without regenerating it.
 *
 * Two unions, and the split between them is the point. §9 of the brief says the
 * composer may group, rank, label, choose presentation, choose disclosure and choose
 * hierarchy — and may not touch the facts, the recommendations, the calculations or
 * the analysis. Splitting the ops by which of those they change makes that
 * checkable: a validator repair and a UI-composer retry may only ever emit
 * `PresentationOp`s, so there is no code path by which either can alter a figure.
 *
 * The old `ReportOp` union (`patch.ts`) mixed both. `addFinding` changed the facts
 * and `setRenderer` changed the presentation, and they went through the same
 * reducer, which meant `critique.ts` — a layout critic — held a loaded gun. It never
 * fired it, but nothing structural stopped it.
 *
 * The reducer semantics carry over from `applyOps` unchanged, because they were
 * right: pure, non-mutating, partial application, unknown targets rejected rather
 * than thrown. A patch that half-applies and says which half it dropped is more
 * useful than one that fails whole.
 */

import { z } from "zod";
import { FindingSchema } from "./findings";
import { SemanticSectionSchema } from "./semantic";
import { ArrangementSchema, PresentationFormSchema, SectionPresentationSchema } from "./ia";
import { ComponentIdSchema } from "./registry";
import type { UINode, UISpec } from "./spec";

/**
 * Changes to what is true. Only the analysis pass may emit these.
 *
 * "Compare against last quarter" and "focus more on risk" reach this union: the
 * first needs data that was never fetched, the second needs analysis that was never
 * asked for. Both are re-analysis of a bounded part of the report — hence
 * `replaceSection` rather than a full re-run.
 */
export const SemanticOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("addSection"), section: SemanticSectionSchema, after: z.string().optional() }),
  z.object({ op: z.literal("replaceSection"), sectionId: z.string(), section: SemanticSectionSchema }),
  z.object({ op: z.literal("removeSection"), sectionId: z.string() }),
  z.object({ op: z.literal("addFinding"), sectionId: z.string(), finding: FindingSchema }),
  z.object({ op: z.literal("removeFinding"), sectionId: z.string(), findingId: z.string() }),
  /**
   * Moves a finding between the section's `findings` and `detail`.
   *
   * Semantic rather than presentational: "this is not needed for the first scan" is
   * a claim about the information. Whether the detail then renders collapsed is
   * `setDisclosure`'s business.
   */
  z.object({
    op: z.literal("setDetail"),
    sectionId: z.string(),
    findingId: z.string(),
    detail: z.boolean(),
  }),
  z.object({
    op: z.literal("setImportance"),
    sectionId: z.string(),
    importance: SemanticSectionSchema.shape.importance,
  }),
]);
export type SemanticOp = z.infer<typeof SemanticOpSchema>;

/**
 * Changes to how it looks. Safe for the composer, the critic and the repair pass.
 *
 * Note what is absent: nothing here can introduce a number, a finding, or a claim.
 * "Hide individual holdings" is `setDisclosure`; "break currency exposure into its
 * own tab" is `moveSection` plus `setArrangement`. Both are real user requests from
 * the brief, and neither needs the analysis to run again.
 */
export const PresentationOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("setArrangement"), areaId: z.string(), arrangement: ArrangementSchema }),
  z.object({
    op: z.literal("setPresentation"),
    areaId: z.string(),
    sectionId: z.string(),
    presentation: SectionPresentationSchema.partial().extend({ because: z.string().min(1) }),
  }),
  z.object({ op: z.literal("setForm"), areaId: z.string(), sectionId: z.string(), form: PresentationFormSchema }),
  z.object({
    op: z.literal("setDisclosure"),
    areaId: z.string(),
    sectionId: z.string(),
    disclosure: z.enum(["open", "collapsed"]),
  }),
  z.object({
    op: z.literal("setEmphasis"),
    areaId: z.string(),
    sectionId: z.string(),
    emphasis: z.enum(["hero", "normal", "quiet"]),
  }),
  z.object({ op: z.literal("reorderAreas"), areaIds: z.array(z.string()).min(2) }),
  /** Split a section out of one area into a new one, or into an existing one. */
  z.object({
    op: z.literal("moveSection"),
    sectionId: z.string(),
    toAreaId: z.string(),
    heading: z.string().min(1).optional(),
  }),
  z.object({ op: z.literal("setHeading"), areaId: z.string(), heading: z.string().min(1) }),
  z.object({ op: z.literal("removeArea"), areaId: z.string() }),
  /**
   * Swap one node's component for another implementing the same form.
   *
   * The narrowest op in either union, and the one the repair pass reaches for most:
   * three identical charts in a row becomes two charts and a table without anything
   * else about the page changing. This is `critique.ts`'s `setRenderer`, kept.
   */
  z.object({ op: z.literal("setComponent"), nodeId: z.string(), component: ComponentIdSchema }),
]);
export type PresentationOp = z.infer<typeof PresentationOpSchema>;

export const PatchOpSchema = z.union([SemanticOpSchema, PresentationOpSchema]);
export type PatchOp = z.infer<typeof PatchOpSchema>;

/**
 * The result of applying a patch. Shape carried over from `PatchResult`.
 *
 * `added` and `removed` exist for the animation: the shell needs to know which ids
 * are new so it can reveal only those, and which left so it can retire them. Without
 * it a follow-up re-animates the whole page, which reads as a regeneration even when
 * nothing else changed.
 */
export type PatchOutcome<T> = {
  value: T;
  added: string[];
  removed: string[];
  /** Ops that could not apply, with why. Never thrown. */
  rejected: { op: PatchOp; reason: string }[];
};

export const isSemanticOp = (op: PatchOp): op is SemanticOp =>
  SemanticOpSchema.safeParse(op).success;

export const isPresentationOp = (op: PatchOp): op is PresentationOp =>
  PresentationOpSchema.safeParse(op).success;

/* ------------------------------------------------------------------- reducer */

/**
 * Apply presentation ops to a spec.
 *
 * This is what turns the validator from a gate into a corrector. It already computes
 * the fix for every problem it reports — "this row of eight cards should be a table"
 * carries `{op: "setComponent", component: "DataTable"}` — and until this function
 * existed the pipeline threw the page away with the remedy in its hand.
 *
 * Three properties, all deliberate:
 *
 *   - **Pure.** Nodes are rebuilt on the path to a change and shared everywhere else,
 *     so untouched subtrees keep their identity and the renderer does not re-animate
 *     a page because one card changed component.
 *   - **Partial.** An op that cannot find its target is rejected with a reason and the
 *     rest still apply. A patch that half-applies and says which half it dropped is
 *     more useful than one that fails whole.
 *   - **Presentation only.** The parameter type is `PresentationOp`, so there is no
 *     call by which this can add a finding, change a figure or rewrite a
 *     recommendation. The repair pass is structurally incapable of it, rather than
 *     merely not doing it.
 *
 * Ops that need the IA plan rather than the spec — arrangement, disclosure, moving a
 * section between areas — are rejected here by name. They are not unimplementable;
 * they belong to conversational editing, which patches the plan and re-composes, and
 * pretending to apply them against a flat spec would silently do the wrong thing.
 */
export function applySpecOps(spec: UISpec, ops: PresentationOp[]): PatchOutcome<UISpec> {
  const rejected: { op: PatchOp; reason: string }[] = [];
  let root = spec.root;

  /** Rebuild the path down to whichever nodes `change` touches; share the rest. */
  const rewrite = (nodes: UINode[], change: (node: UINode) => UINode | null): { nodes: UINode[]; hit: boolean } => {
    let hit = false;
    const next = nodes.map((node) => {
      const changed = change(node);
      if (changed) {
        hit = true;
        return changed;
      }
      const kids = node.children ? rewrite(node.children, change) : undefined;
      const slots = node.slots
        ? Object.entries(node.slots).map(([name, region]) => [name, rewrite(region, change)] as const)
        : undefined;
      const slotHit = (slots ?? []).some(([, region]) => region.hit);
      if (!kids?.hit && !slotHit) return node;
      hit = true;
      return {
        ...node,
        ...(kids?.hit ? { children: kids.nodes } : {}),
        ...(slotHit && slots ? { slots: Object.fromEntries(slots.map(([name, r]) => [name, r.nodes])) } : {}),
      };
    });
    return { nodes: next, hit };
  };

  for (const op of ops) {
    switch (op.op) {
      case "setComponent": {
        const applied = rewrite(root, (node) =>
          node.id === op.nodeId ? { ...node, component: op.component } : null,
        );
        if (!applied.hit) rejected.push({ op, reason: `no node "${op.nodeId}"` });
        root = applied.nodes;
        break;
      }

      /*
       * Emphasis on a spec is the `variant` prop, because that is where a recipe's
       * "this one is the headline" ends up. Dropping the prop rather than writing
       * "normal" leaves the component on its own default.
       */
      case "setEmphasis": {
        const variant = op.emphasis === "hero" ? "hero" : op.emphasis === "quiet" ? "quiet" : undefined;
        const applied = rewrite(root, (node) => {
          if (node.sectionId !== op.sectionId && node.id !== op.sectionId) return null;
          const { variant: was, ...rest } = node.props;
          if (was === variant) return null;
          return { ...node, props: variant ? { ...rest, variant } : rest };
        });
        if (!applied.hit) rejected.push({ op, reason: `no node for section "${op.sectionId}"` });
        root = applied.nodes;
        break;
      }

      case "setHeading": {
        const applied = rewrite(root, (node) =>
          node.id === op.areaId || node.sectionId === op.areaId
            ? { ...node, props: { ...node.props, heading: op.heading } }
            : null,
        );
        if (!applied.hit) rejected.push({ op, reason: `no area "${op.areaId}"` });
        root = applied.nodes;
        break;
      }

      case "removeArea": {
        const kept = root.filter((node) => node.id !== op.areaId && node.sectionId !== op.areaId);
        if (kept.length === root.length) rejected.push({ op, reason: `no area "${op.areaId}"` });
        // A view with no areas left is not a repair, it is a fallback. Refuse it here
        // rather than letting the renderer decide what an empty page looks like.
        else if (kept.length === 0) rejected.push({ op, reason: "would empty the view" });
        else root = kept;
        break;
      }

      case "reorderAreas": {
        const rank = new Map(op.areaIds.map((id, index) => [id, index]));
        const known = root.filter((node) => rank.has(node.id));
        if (known.length < 2) {
          rejected.push({ op, reason: "fewer than two of those areas are in this view" });
          break;
        }
        // Areas not named keep their place relative to the ones that were.
        root = [...root].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
        break;
      }

      default:
        rejected.push({ op, reason: `"${op.op}" patches the IA plan, not the spec` });
    }
  }

  return {
    value: { ...spec, root },
    // No op here creates or destroys a node except `removeArea`, so `added` stays
    // empty and the shell has nothing new to reveal.
    added: [],
    removed: spec.root.filter((was) => !root.includes(was)).map((node) => node.id),
    rejected,
  };
}
