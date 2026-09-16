/**
 * Layer 7 — the review pass. Read the assembled page and fix its architecture.
 *
 * Every layer before this one judges a finding *on its own*: is this a
 * comparison, how many things, does it have history, what draws that. None of
 * them can see the page. And most of what makes generated UI feel wrong is only
 * visible on the page — two cards saying the same thing, no headline at all,
 * three identical charts in a row, a critical flag sitting eleventh, a paragraph
 * where the answer should be.
 *
 * So this runs *after* composition, over the whole document, and emits ops. It is
 * allowed to change a component, because "this block should be drawn differently
 * given what surrounds it" is not a fact about the block — it's a fact about the
 * page, and there is nowhere else in the pipeline that knows one.
 *
 * Two rules it holds itself to:
 *
 *   - it never invents findings. It can promote, demote, reorder, redraw and
 *     remove, and that's all. Anything that would need new evidence belongs to
 *     the analyst, not the reviewer.
 *   - every change carries a note in the advisor's language. A layout that
 *     silently rearranges itself is worse than one that reads badly, because the
 *     reader can't tell what they're looking at any more.
 */

import { orderedBlocks, type Block, type ReportDoc } from "./compose";
import type { Finding } from "./findings";
import { familyOf, type RendererId } from "./select";
import type { ReportOp } from "./patch";

export type Critique = {
  ops: ReportOp[];
  /** One line per change, in reading order. */
  notes: string[];
};

/** Renderers that put a number or a shape in front of the reader immediately. */
const LEADS: RendererId[] = [
  "HeroMetric", "LineChart", "DualLineChart", "MultiLineChart",
  "BarChart", "PairedBars", "DonutChart", "StackedBar", "FlagCallout",
];

const PROSE: RendererId[] = ["ProseBlock", "NarrativeWithChips", "FallbackList"];

/** What a comparison is *about*, for spotting two cards making the same point. */
function fingerprint(finding: Finding): string | null {
  if (finding.kind === "comparison") {
    const names = finding.entities.map((entity) => entity.name).sort().join("|");
    return `comparison:${finding.measure.toLowerCase()}:${names}`;
  }
  if (finding.kind === "composition") {
    return `composition:${finding.parts.map((part) => part.label).sort().join("|")}`;
  }
  if (finding.kind === "metric") return `metric:${finding.label.toLowerCase()}`;
  return null;
}

export function critique(doc: ReportDoc): Critique {
  const blocks = orderedBlocks(doc);
  if (blocks.length < 2) return { ops: [], notes: [] };

  const ops: ReportOp[] = [];
  const notes: string[] = [];
  const findingOf = (block: Block): Finding | undefined => doc.findings[block.findingId];
  // Blocks don't carry their section, and two of these rules are about what a
  // section contains rather than what the page does.
  const sectionOf = new Map<string, string>();
  for (const section of doc.sections) {
    for (const block of section.blocks) sectionOf.set(block.id, section.id);
  }

  /* 1 — two cards making the same point. The later one goes; the reader has
     already been told. Done first so nothing below spends effort on a block that
     is about to be removed. */
  const seen = new Map<string, string>();
  const dropped = new Set<string>();
  for (const block of blocks) {
    const finding = findingOf(block);
    const print = finding ? fingerprint(finding) : null;
    if (!print) continue;
    const earlier = seen.get(print);
    if (earlier) {
      ops.push({ op: "removeBlock", blockId: block.id });
      dropped.add(block.id);
      notes.push(`Dropped a second card making the same point as “${earlier}”.`);
    } else {
      seen.set(print, finding && "label" in finding ? finding.label : block.rendererId);
    }
  }

  const live = blocks.filter((block) => !dropped.has(block.id));

  /* 2 — no headline. A page where everything is the same weight has no entry
     point, so the most confident thing in the opening section becomes one. */
  const primaries = live.filter((block) => findingOf(block)?.emphasis === "primary");
  if (primaries.length === 0) {
    const openingSection = sectionOf.get(live[0].id);
    const opening = live.filter((block) => sectionOf.get(block.id) === openingSection);
    const lead = [...opening].sort(
      (a, b) => (findingOf(b)?.confidence ?? 0) - (findingOf(a)?.confidence ?? 0),
    )[0];
    if (lead) {
      ops.push({ op: "setEmphasis", blockId: lead.id, emphasis: "primary" });
      notes.push("Nothing was leading the report, so the strongest finding now does.");
    }
  }

  /* 3 — competing headlines inside one section. Two things shouting is one thing
     less than one thing shouting. */
  const bySection = new Map<string, Block[]>();
  for (const block of live) {
    if (findingOf(block)?.emphasis !== "primary") continue;
    const sectionId = sectionOf.get(block.id) ?? "";
    bySection.set(sectionId, [...(bySection.get(sectionId) ?? []), block]);
  }
  for (const [, group] of bySection) {
    if (group.length < 2) continue;
    const ranked = [...group].sort(
      (a, b) => (findingOf(b)?.confidence ?? 0) - (findingOf(a)?.confidence ?? 0),
    );
    for (const block of ranked.slice(1)) {
      ops.push({ op: "setEmphasis", blockId: block.id, emphasis: "secondary" });
    }
    notes.push(
      `Two cards were both claiming to be the headline of one section — kept “${
        (findingOf(ranked[0]) as { label?: string } | undefined)?.label ?? "the stronger one"
      }”.`,
    );
  }

  /* 4 — a critical flag buried. If something needs a decision, it cannot be
     eleventh. */
  const critical = live.find((block) => {
    const finding = findingOf(block);
    return finding?.kind === "flag" && finding.severity === "critical";
  });
  if (critical && live.indexOf(critical) > 2) {
    ops.push({ op: "reorder", blockId: critical.id, after: live[0].id });
    notes.push("Moved the critical flag up — it was below several things that can wait.");
  }

  /* 5 — the report opens with a paragraph. Prose is the right renderer for a
     narrative and the wrong thing to open with when there's a figure right
     behind it. */
  const first = live[0];
  if (first && PROSE.includes(first.rendererId)) {
    const figure = live.slice(1).find(
      (block) => sectionOf.get(block.id) === sectionOf.get(first.id) && LEADS.includes(block.rendererId),
    );
    if (figure) {
      ops.push({ op: "reorder", blockId: first.id, after: figure.id });
      notes.push("Led with the figure instead of the paragraph that was explaining it.");
    }
  }

  /* 6 — three of the same *chart* in a row. Three identical charts blur into one
     and the reader stops reading the middle one, so it gets redrawn in whatever
     family was the runner-up. This is the rule only a reviewer can apply: nothing
     is wrong with the block, it is wrong next to its neighbours.

     Two guards, both learned the hard way. It applies to charts only — three
     flags or three requirements in a row are three distinct things the advisor
     needs to see stated the same way, and varying them is decoration. And it
     never redraws into text, because that is a downgrade dressed as variety: the
     point is to change the *shape* of the comparison, not to stop drawing it. */
  for (let i = 1; i < live.length - 1; i += 1) {
    const [before, middle, after] = [live[i - 1], live[i], live[i + 1]];
    if (before.rendererId !== middle.rendererId || middle.rendererId !== after.rendererId) continue;
    if (ops.some((op) => "blockId" in op && op.blockId === middle.id)) continue;

    const current = familyOf(middle.rendererId);
    if (current === null || current === "text") continue;

    const alternative = middle.selection.runnersUp
      .map((runner) => familyOf(runner.rendererId))
      .find((family) => family !== null && family !== "text" && family !== current);
    if (!alternative) continue;

    ops.push({
      op: "setRenderer",
      blockId: middle.id,
      family: alternative,
      note: "Redrawn by the review pass — three of the same chart in a row read as one",
    });
    notes.push(`Three ${middle.rendererId} cards ran together, so the middle one is now ${alternative}.`);
    i += 1; // Don't restate the same run twice.
  }

  return { ops, notes };
}

export default critique;
