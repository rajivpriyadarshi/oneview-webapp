/**
 * Layer 4 — composition. DESIGN.md §5 and §11.
 *
 * Findings in, `ReportDoc` out. Pure and deterministic: same findings, same
 * document, every time.
 *
 * Three jobs, in order:
 *
 *   1. group findings into sections by subject
 *   2. sort sections and blocks by emphasis
 *   3. pack blocks into a 12-column grid
 *
 * And one that follows from DESIGN.md §10 decision 3: the block list is in
 * **reveal order**, because blocks land one at a time. That makes ordering a
 * design decision rather than an artifact of iteration order — the first block
 * to appear is the first thing the reader sees, so it had better be the headline.
 */

import {
  EMPHASIS_ORDER,
  type Emphasis,
  type Finding,
} from "./findings";
import { selectRenderer, type RendererId, type Span, type SelectionTrace } from "./select";

export type Block = {
  id: string;
  findingId: string;
  rendererId: RendererId;
  span: Span;
  /** Why this renderer. Surfaced in the UI per decision 4. */
  selection: SelectionTrace;
  /**
   * Position in the reveal sequence, across the whole document rather than
   * within a section — the animation doesn't restart per section.
   */
  order: number;
};

/**
 * Blocks in one section that answer the same *shape* of question, folded behind
 * tabs so one is read at a time.
 *
 * Named by block id rather than holding the blocks, because `section.blocks` stays
 * the complete list: reveal order, `blockCount`, `orderedBlocks` and every op in
 * `patch.ts` keep working on a flat list, and grouping is a statement about how
 * that list is *read* rather than a second copy of it.
 */
export type TabGroup = {
  id: string;
  /** What all of these are: the finding kind they share. */
  kind: Finding["kind"];
  /** In reveal order. The label is the tab; the block is its panel. */
  tabs: { blockId: string; label: string }[];
  /** Why these were folded together. Shown in the thinking panel. */
  because: string;
};

export type Section = {
  id: string;
  heading: string;
  blocks: Block[];
  /** Sibling blocks read one at a time. Blocks not named here sit in the grid. */
  groups?: TabGroup[];
};

export type ReportDoc = {
  id: string;
  title: string;
  /** The client. */
  subject: string;
  sections: Section[];
  /**
   * Every finding the document renders, by id.
   *
   * The document carries its own data rather than blocks holding a bare id and
   * the page keeping a parallel list. Two reasons: a renderer needs the finding
   * to draw anything, and `patch.ts` needs it to re-run selection when a block's
   * emphasis changes. Both would otherwise thread a second argument through
   * every call, and the two could drift out of sync.
   */
  findings: Record<string, Finding>;
  /**
   * Findings that no renderer would take. Kept rather than dropped silently:
   * an unrenderable finding is a gap in the renderer table, and the lab should
   * be able to show it instead of quietly producing a shorter report.
   */
  unrendered: { findingId: string; kind: Finding["kind"]; reason: string }[];
};

/** Total blocks, for driving the reveal animation. */
export const blockCount = (doc: ReportDoc): number =>
  doc.sections.reduce((total, section) => total + section.blocks.length, 0);

/** All blocks in reveal order, flattened across sections. */
export const orderedBlocks = (doc: ReportDoc): Block[] =>
  doc.sections.flatMap((section) => section.blocks).sort((a, b) => a.order - b.order);

/**
 * The strongest emphasis present in a section, which is what the section sorts
 * on — a section containing the headline metric leads the report even if its
 * other findings are supporting.
 */
function sectionEmphasis(findings: Finding[]): Emphasis {
  return findings.reduce<Emphasis>((strongest, finding) => {
    return EMPHASIS_ORDER[finding.emphasis] < EMPHASIS_ORDER[strongest]
      ? finding.emphasis
      : strongest;
  }, "supporting");
}

/** `Asset allocation` → `asset-allocation`, for a stable section id. */
const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";

/**
 * Pack spans into rows of 12 and promote orphans.
 *
 * A single 4-span block alone on its row looks like a mistake rather than a
 * choice, so a block that ends a section with more than half the row empty gets
 * widened to fill it. Mutates the spans it is given, having been handed a list
 * this function owns.
 */
function packRow(blocks: Block[]): void {
  let row: Block[] = [];
  let used = 0;

  const flush = (isLast: boolean) => {
    if (row.length === 0) return;
    // Only widen a trailing partial row, and only when it's a lone block —
    // two 4-spans leaving a 4-gap is a legitimate layout, one 4-span is not.
    if (isLast && row.length === 1 && used < 12) {
      row[0].span = 12;
    }
    row = [];
    used = 0;
  };

  for (const block of blocks) {
    if (used + block.span > 12) flush(false);
    row.push(block);
    used += block.span;
  }
  flush(true);
}

/**
 * What this claim is called.
 *
 * An exhaustive switch, not a `"label" in finding` sniff, and the difference is the
 * whole bug it replaces: `subject` is what sections are *grouped by*, so it is
 * identical for every finding in a group by construction. Falling back to it gave
 * three tabs all reading "What's committed" — the one string guaranteed to tell the
 * reader nothing, on the one control whose entire job is to distinguish.
 *
 * Every kind carries a field that names itself, because the analysis already wrote
 * one: a requirement's `purpose` is "Private fund capital call", a flag's
 * `subjectLabel` is what is wrong. The names exist; they were just not being read.
 */
function nameOf(finding: Finding): string {
  switch (finding.kind) {
    case "metric":
    case "trend":
    case "comparison":
    case "composition":
    case "checklist":
      return finding.label;
    case "transition":
    case "flag":
      return finding.subjectLabel;
    case "requirement":
      return finding.purpose;
    case "recommendation":
      return finding.title;
    case "narrative":
      // First sentence. A heading if the model wrote one, which it often doesn't.
      return finding.heading ?? finding.text.split(/(?<=[.:!?])\s/)[0];
  }
}

/**
 * A second field, for when two siblings genuinely share a name.
 *
 * "Capital call · next month" beats two tabs reading "Capital call", and beats
 * "Capital call (2)" — a qualifier that means something is always better than an
 * index, because the reader is choosing between these, not counting them.
 */
function qualifierOf(finding: Finding): string | undefined {
  switch (finding.kind) {
    case "requirement":
      return finding.deadline;
    case "transition":
      return finding.to;
    case "metric":
      return finding.value;
    case "comparison":
      return finding.measure;
    case "flag":
      return finding.severity;
    default:
      return undefined;
  }
}

/** A tab is read sideways, so its name has to be short and has to be a noun. */
const clipTab = (raw: string): string => (raw.length > 26 ? `${raw.slice(0, 25).trimEnd()}…` : raw);

/** Name a bucket's tabs, qualifying only the ones that would otherwise collide. */
function labelTabs(bucket: Block[], findings: Record<string, Finding>): TabGroup["tabs"] {
  const names = bucket.map((block, index) => nameOf(findings[block.findingId]).trim() || `View ${index + 1}`);
  const collides = new Set(names.filter((name, index) => names.indexOf(name) !== index));

  return bucket.map((block, index) => {
    const qualifier = collides.has(names[index]) ? qualifierOf(findings[block.findingId]) : undefined;
    return {
      blockId: block.id,
      label: clipTab(qualifier ? `${names[index]} · ${qualifier}` : names[index]),
    };
  });
}

/** Below three, a row of cards is a row of cards. At three it is a texture. */
const TAB_MIN = 3;

/**
 * Fold a section's sibling blocks into tabs.
 *
 * Six cards of the same shape in a grid is not information architecture, it is a
 * dump: they all look alike, so the page reads as one texture and the reader has to
 * work through the small print of each heading to find anything. Three or more
 * findings of the same *kind* in one section are answers to the same shape of
 * question over different data — exactly the case where one at a time, chosen by the
 * reader, beats all of them at once chosen by nobody.
 *
 * Grouping on the finding kind rather than on the renderer is the load-bearing part.
 * Five comparisons can draw as three `PairedBars` and two `ComparisonTable` — same
 * question, different entity counts — and bucketing by renderer would split the very
 * group this rule exists to find.
 *
 * A `primary` finding is never tabbed. It is the answer to what was asked, and
 * hiding the answer behind a tab is worse than repeating a shape; it stays in the
 * grid, and the rest still fold if enough of them remain.
 */
function groupSiblings(
  blocks: Block[],
  findings: Record<string, Finding>,
  sectionId: string,
): { groups: TabGroup[]; loose: Block[] } {
  const byKind = new Map<Finding["kind"], Block[]>();
  for (const block of blocks) {
    const finding = findings[block.findingId];
    if (!finding || finding.emphasis === "primary") continue;
    const bucket = byKind.get(finding.kind);
    if (bucket) bucket.push(block);
    else byKind.set(finding.kind, [block]);
  }

  const groups: TabGroup[] = [];
  const tabbed = new Set<string>();
  for (const [kind, bucket] of byKind) {
    if (bucket.length < TAB_MIN) continue;
    for (const block of bucket) {
      tabbed.add(block.id);
      // A tab panel is the full width of the section: the block no longer shares a
      // row with anything, so the span it was given for the grid no longer applies.
      block.span = 12;
    }
    groups.push({
      id: `${sectionId}-tabs-${kind}`,
      kind,
      tabs: labelTabs(bucket, findings),
      because: `${bucket.length} answers of the same shape over different data, so one is read at a time.`,
    });
  }

  return { groups, loose: blocks.filter((block) => !tabbed.has(block.id)) };
}

/**
 * Build a report from findings.
 *
 * Section order comes from emphasis, then from first appearance — so within one
 * emphasis level the model's ordering is preserved. That is deliberate: the model
 * knows which of two equally-important subjects it wants read first, and layer 4
 * has no better information.
 */
export function composeReport(
  findings: Finding[],
  { id, title, subject }: { id: string; title: string; subject: string },
): ReportDoc {
  const unrendered: ReportDoc["unrendered"] = [];

  // Group by subject, preserving first-seen order.
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const existing = groups.get(finding.subject);
    if (existing) existing.push(finding);
    else groups.set(finding.subject, [finding]);
  }

  const ranked = [...groups.entries()]
    .map(([heading, group], index) => ({ heading, group, index }))
    .sort((a, b) => {
      const byEmphasis =
        EMPHASIS_ORDER[sectionEmphasis(a.group)] -
        EMPHASIS_ORDER[sectionEmphasis(b.group)];
      return byEmphasis !== 0 ? byEmphasis : a.index - b.index;
    });

  let order = 0;
  const sections: Section[] = [];
  const rendered: Record<string, Finding> = {};

  for (const { heading, group } of ranked) {
    // Within a section, emphasis decides reveal order; ties keep model order.
    const sorted = [...group]
      .map((finding, index) => ({ finding, index }))
      .sort((a, b) => {
        const byEmphasis =
          EMPHASIS_ORDER[a.finding.emphasis] - EMPHASIS_ORDER[b.finding.emphasis];
        return byEmphasis !== 0 ? byEmphasis : a.index - b.index;
      })
      .map((entry) => entry.finding);

    const blocks: Block[] = [];
    for (const finding of sorted) {
      const selection = selectRenderer(finding);
      if (!selection) {
        unrendered.push({
          findingId: finding.id,
          kind: finding.kind,
          reason: `No renderer accepted a ${finding.kind} of this shape`,
        });
        continue;
      }
      blocks.push({
        // Derived from the finding, not from a counter, so it is stable across
        // recomposition — which is what lets §6 patches animate a single block
        // instead of remounting the report.
        id: `block-${finding.id}`,
        findingId: finding.id,
        rendererId: selection.rendererId,
        span: selection.span,
        selection,
        order: order++,
      });
      rendered[finding.id] = finding;
    }

    // A section whose every finding was unrenderable must not leave an empty
    // heading behind.
    if (blocks.length === 0) continue;

    const sectionId = `section-${slug(heading)}`;
    // Tabs first, then packing: the grid only has to pack what is left loose in it,
    // and a tabbed block's span is decided by the panel rather than by the row.
    const { groups, loose } = groupSiblings(blocks, rendered, sectionId);
    packRow(loose);
    sections.push({ id: sectionId, heading, blocks, ...(groups.length > 0 ? { groups } : {}) });
  }

  return { id, title, subject, sections, findings: rendered, unrendered };
}
