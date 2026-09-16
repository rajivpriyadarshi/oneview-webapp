/**
 * One card, revised.
 *
 * The advisor selects a block, types a sentence at it, and the card rethinks
 * itself. The thing that makes this more than a settings panel: the sentence goes
 * through the *same* two layers a fresh ask does — interpretation reads it into a
 * shape, and the mapping layer decides what draws that shape. So "show six of
 * them" can legitimately turn two overlaid lines into a bar chart, because six
 * lines is not what six things want to be.
 *
 * What the advisor never has to do is name a component. They may — "make this a
 * table" — and then it's an override, and overrides win (see `selectFamily`).
 * But the default path is to say what they want to *know*, not what they want to
 * see.
 *
 * Everything here comes out as ops, never as a regenerated document: the rest of
 * the report must not move because one card changed.
 */

import { interpretRevision, type Revision } from "./interpret";
import { reviseFinding } from "./heuristics";
import type { ReportOp } from "./patch";
import { orderedBlocks, type ReportDoc } from "./compose";
import type { Finding } from "./findings";

export type BlockRevision = {
  ops: ReportOp[];
  /** What to say in the chat about what just happened, or didn't. */
  reply: string;
};

/** A sentence describing the card, for when the comment was a question. */
function describe(finding: Finding, rendererId: string, reason: string): string {
  const shape =
    finding.kind === "comparison"
      ? `${finding.entities.length} things measured on ${finding.measure.toLowerCase()}`
      : finding.kind === "composition"
        ? `${finding.parts.length} parts of a whole`
        : `a ${finding.kind}`;
  const sources = finding.sources.length > 0 ? ` Drawn from ${finding.sources.join(", ").toLowerCase()}.` : "";
  return `That card is ${shape}, drawn as a ${rendererId}. ${reason}.${sources}`;
}

/** Plain-language account of what a revision changed, so the chat isn't vague. */
function changeNotes(revision: Revision): string[] {
  const notes: string[] = [];
  if (revision.count !== undefined) notes.push(`${revision.count} of them`);
  if (revision.measure) {
    notes.push(
      revision.measure === "value"
        ? "measured on size"
        : revision.measure === "cost"
          ? "measured on unrealised gain"
          : "measured on return",
    );
  }
  if (revision.overTime === true) notes.push("with the history in");
  if (revision.overTime === false) notes.push("current levels only");
  if (revision.worst === true) notes.push("from the bottom of the ranking");
  if (revision.worst === false) notes.push("from the top of the ranking");
  if (revision.singleNames === true) notes.push("single names only");
  if (revision.singleNames === false) notes.push("pooled sleeves included");
  return notes;
}

/**
 * Read a comment aimed at one block and turn it into ops.
 *
 * The no-key path, and also the fallback whenever the model's attempt at the
 * same thing comes back unusable.
 */
export function reviseLocally(doc: ReportDoc, blockId: string, prompt: string): BlockRevision {
  const block = orderedBlocks(doc).find((candidate) => candidate.id === blockId);
  if (!block) return { ops: [], reply: "That card isn't in the report any more." };

  const finding = doc.findings[block.findingId];
  if (!finding) return { ops: [], reply: "That card has no finding behind it — nothing to rethink." };

  const revision = interpretRevision(prompt);

  if (revision.drop) {
    return { ops: [{ op: "removeBlock", blockId }], reply: "Taken out of the report." };
  }

  // Nothing about the card's shape was stated, so it's a question about the card
  // rather than an instruction to it. Answering beats guessing at an edit.
  if (revision.empty) {
    return { ops: [], reply: describe(finding, block.rendererId, block.selection.reason) };
  }

  const ops: ReportOp[] = [];
  const said: string[] = [];

  const restated = reviseFinding(finding, revision);
  if (restated && restated.id !== finding.id) {
    ops.push({ op: "replaceBlock", blockId, finding: restated });
    said.push(...changeNotes(revision));
  } else if (revision.emphasis) {
    // Emphasis alone still goes back through selection inside applyOps, so a
    // promoted metric becomes a hero rather than just a bigger tile.
    ops.push({ op: "setEmphasis", blockId, emphasis: revision.emphasis });
    said.push(revision.emphasis === "primary" ? "promoted to the headline" : "moved to supporting");
  }

  // An explicit family request applies on top of the restatement — and against
  // whichever block id the restatement produced, since replaceBlock may have
  // changed it.
  if (revision.draw) {
    const target = restated && restated.id !== finding.id ? `block-${restated.id}` : blockId;
    ops.push({ op: "setRenderer", blockId: target, family: revision.draw });
    said.push(`drawn as ${revision.draw === "donut" ? "a pie" : revision.draw}`);
  }

  if (ops.length === 0) {
    const shapeWords = changeNotes(revision);
    return {
      ops: [],
      reply: shapeWords.length > 0
        ? `That card can't be restated ${shapeWords.join(", ")} — it isn't built from a ranking the book can re-cut.`
        : describe(finding, block.rendererId, block.selection.reason),
    };
  }

  return {
    ops,
    reply: said.length > 0 ? `Rethought that card: ${said.join(", ")}.` : "Rethought that card.",
  };
}

export default reviseLocally;
