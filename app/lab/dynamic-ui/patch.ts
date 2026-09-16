/**
 * Layer 6 — follow-ups as patches. DESIGN.md §6.
 *
 * *"Add a comparison graph between the client's top 2 holdings"* must not
 * regenerate the report. Regeneration reshuffles everything the reader has
 * already read, and that is the failure mode that makes generative UI feel
 * unusable — the page you were halfway through rewrites itself underneath you.
 *
 * So a follow-up produces **ops against the existing document**, and this module
 * applies them. Two properties fall out of that, and both are the point:
 *
 *   - the model still never names a component. `addFinding` routes through the
 *     same `selectRenderer`, so an inserted block is chosen by the same rules as
 *     an original one — `DualLineChart` whether it arrived first or fifth.
 *   - `(doc, ops) => doc` is pure and non-mutating, so undo is just keeping the
 *     previous document, and the new block ids are known, which is what makes
 *     the insertion animatable.
 */

import type { Emphasis, Finding } from "./findings";
import { selectFamily, selectRenderer } from "./select";
import type { DrawRequest } from "./interpret";
import type { Block, ReportDoc, Section } from "./compose";

export type ReportOp =
  | { op: "addFinding"; finding: Finding; after?: string; sectionId?: string }
  | { op: "removeBlock"; blockId: string }
  | { op: "replaceBlock"; blockId: string; finding: Finding }
  | { op: "setEmphasis"; blockId: string; emphasis: Emphasis }
  | { op: "reorder"; blockId: string; after: string }
  /**
   * Draw an existing block as a different family of visual.
   *
   * The one op that bypasses the scoring pass, and it exists for exactly two
   * callers: an advisor pointing at a card and naming what they want, and the
   * review layer deciding the assembled page reads badly. Neither is a heuristic
   * the selection table could have encoded — the first is a human overriding it,
   * the second is a judgement about a block *in the context of its neighbours*,
   * which a per-finding rule cannot see.
   */
  | { op: "setRenderer"; blockId: string; family: DrawRequest; note?: string };

/**
 * What an op actually did. Returned alongside the document because the UI needs
 * to know *which* blocks are new in order to animate only those, and because an
 * op that quietly did nothing is a bug worth surfacing rather than hiding.
 */
export type PatchResult = {
  doc: ReportDoc;
  /** Blocks that did not exist before. Drives the insertion animation. */
  addedBlockIds: string[];
  removedBlockIds: string[];
  /** Ops that could not be applied, with why. */
  rejected: { op: ReportOp; reason: string }[];
};

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";

/**
 * Renumber `order` across the document so the reveal sequence stays gapless
 * after an insertion or removal.
 *
 * Section-then-position order, which is the reading order — so a block inserted
 * mid-document pushes the ones after it later in the sequence rather than being
 * appended to the end of the animation.
 */
function renumber(sections: Section[]): Section[] {
  let order = 0;
  return sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({ ...block, order: order++ })),
  }));
}

/** Build a block from a finding, or explain why it can't be rendered. */
function buildBlock(finding: Finding): Block | string {
  const selection = selectRenderer(finding);
  if (!selection) return `No renderer accepted a ${finding.kind} of this shape`;
  return {
    id: `block-${finding.id}`,
    findingId: finding.id,
    rendererId: selection.rendererId,
    span: selection.span,
    selection,
    // Overwritten by renumber(); set here only so the type is satisfied.
    order: 0,
  };
}

const findBlock = (
  sections: Section[],
  blockId: string,
): { section: Section; index: number } | null => {
  for (const section of sections) {
    const index = section.blocks.findIndex((block) => block.id === blockId);
    if (index !== -1) return { section, index };
  }
  return null;
};

/**
 * Apply ops in sequence. Each op sees the result of the previous one, so
 * `addFinding` followed by `reorder` on the same block works.
 *
 * A rejected op does not abort the batch — the rest still apply, and the
 * rejection is reported. Partial application is the right call for a
 * conversational surface: one impossible instruction shouldn't discard the
 * others the user gave in the same breath.
 */
export function applyOps(doc: ReportDoc, ops: ReportOp[]): PatchResult {
  let sections: Section[] = doc.sections.map((section) => ({
    ...section,
    blocks: [...section.blocks],
  }));
  // Copied, not mutated in place: applyOps must not alter the document it was
  // given, or undo stops working.
  const findings: Record<string, Finding> = { ...doc.findings };
  const addedBlockIds: string[] = [];
  const removedBlockIds: string[] = [];
  const rejected: PatchResult["rejected"] = [];

  for (const op of ops) {
    switch (op.op) {
      case "addFinding": {
        const built = buildBlock(op.finding);
        if (typeof built === "string") {
          rejected.push({ op, reason: built });
          break;
        }
        if (findBlock(sections, built.id)) {
          rejected.push({ op, reason: `Block ${built.id} already exists` });
          break;
        }

        // Where it goes, most specific instruction first: after a named block,
        // else into a named section, else into the section matching the
        // finding's own subject, else a new section for that subject.
        const anchor = op.after ? findBlock(sections, op.after) : null;
        if (op.after && !anchor) {
          rejected.push({ op, reason: `Unknown anchor block ${op.after}` });
          break;
        }

        if (anchor) {
          anchor.section.blocks.splice(anchor.index + 1, 0, built);
        } else {
          const targetId = op.sectionId ?? `section-${slug(op.finding.subject)}`;
          const target = sections.find((section) => section.id === targetId);
          if (target) {
            target.blocks.push(built);
          } else if (op.sectionId) {
            rejected.push({ op, reason: `Unknown section ${op.sectionId}` });
            break;
          } else {
            sections.push({
              id: targetId,
              heading: op.finding.subject,
              blocks: [built],
            });
          }
        }
        findings[op.finding.id] = op.finding;
        addedBlockIds.push(built.id);
        break;
      }

      case "removeBlock": {
        const found = findBlock(sections, op.blockId);
        if (!found) {
          rejected.push({ op, reason: `Unknown block ${op.blockId}` });
          break;
        }
        delete findings[found.section.blocks[found.index].findingId];
        found.section.blocks.splice(found.index, 1);
        removedBlockIds.push(op.blockId);
        // Removing the last block of a section removes the heading with it.
        sections = sections.filter((section) => section.blocks.length > 0);
        break;
      }

      case "replaceBlock": {
        const found = findBlock(sections, op.blockId);
        if (!found) {
          rejected.push({ op, reason: `Unknown block ${op.blockId}` });
          break;
        }
        const built = buildBlock(op.finding);
        if (typeof built === "string") {
          rejected.push({ op, reason: built });
          break;
        }
        delete findings[found.section.blocks[found.index].findingId];
        findings[op.finding.id] = op.finding;
        found.section.blocks.splice(found.index, 1, built);
        removedBlockIds.push(op.blockId);
        // A replacement is new even when it lands in the same slot, so it
        // animates rather than snapping in place.
        if (built.id !== op.blockId) addedBlockIds.push(built.id);
        break;
      }

      case "setEmphasis": {
        const found = findBlock(sections, op.blockId);
        if (!found) {
          rejected.push({ op, reason: `Unknown block ${op.blockId}` });
          break;
        }
        const current = found.section.blocks[found.index];
        const finding = findings[current.findingId];
        if (!finding) {
          rejected.push({ op, reason: `No finding for block ${op.blockId}` });
          break;
        }
        // Emphasis changes what a finding *means*, so it goes back through
        // selection rather than just restyling: a metric promoted to primary
        // becomes a HeroMetric. Re-running the rules is the only way to get that
        // without duplicating them here.
        const updated = { ...finding, emphasis: op.emphasis } as Finding;
        const reselected = selectRenderer(updated);
        if (!reselected) {
          rejected.push({ op, reason: "Emphasis change left it unrenderable" });
          break;
        }
        findings[updated.id] = updated;
        found.section.blocks[found.index] = {
          ...current,
          span: reselected.span,
          rendererId: reselected.rendererId,
          selection: reselected,
        };
        break;
      }

      case "setRenderer": {
        const found = findBlock(sections, op.blockId);
        if (!found) {
          rejected.push({ op, reason: `Unknown block ${op.blockId}` });
          break;
        }
        const current = found.section.blocks[found.index];
        const finding = findings[current.findingId];
        if (!finding) {
          rejected.push({ op, reason: `No finding for block ${op.blockId}` });
          break;
        }
        const pinned = selectFamily(finding, op.family);
        if (!pinned) {
          rejected.push({
            op,
            reason: `A ${finding.kind} of this shape can't be drawn as ${op.family}`,
          });
          break;
        }
        found.section.blocks[found.index] = {
          ...current,
          span: pinned.span,
          rendererId: pinned.rendererId,
          selection: op.note ? { ...pinned, reason: op.note } : pinned,
        };
        break;
      }

      case "reorder": {
        const found = findBlock(sections, op.blockId);
        if (!found) {
          rejected.push({ op, reason: `Unknown block ${op.blockId}` });
          break;
        }
        const [moved] = found.section.blocks.splice(found.index, 1);
        const anchor = findBlock(sections, op.after);
        if (!anchor) {
          // Put it back rather than losing it.
          found.section.blocks.splice(found.index, 0, moved);
          rejected.push({ op, reason: `Unknown anchor block ${op.after}` });
          break;
        }
        anchor.section.blocks.splice(anchor.index + 1, 0, moved);
        break;
      }
    }
  }

  return {
    doc: { ...doc, sections: renumber(sections), findings },
    addedBlockIds,
    removedBlockIds,
    rejected,
  };
}
