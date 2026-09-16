/**
 * Tests for layer 6 — DESIGN.md §6.
 *
 * The headline test is "the follow-up case", which is the scenario this whole
 * prototype exists to serve: asking for a comparison chart after the report is
 * already on screen must insert one block and leave every existing block's
 * identity untouched.
 *
 * Everything else here guards the properties that make that safe — purity (so
 * undo works), gapless reveal order (so the animation doesn't stall), and honest
 * rejection (so an impossible op doesn't silently do nothing).
 */

import { describe, expect, it } from "vitest";
import { composeReport, orderedBlocks, type ReportDoc } from "../compose";
import { applyOps, type ReportOp } from "../patch";
import type { ComparisonFinding, Finding, FindingMeta, Series } from "../findings";

const meta = (o: Partial<FindingMeta> = {}): FindingMeta => ({
  id: "f1",
  emphasis: "secondary",
  confidence: 0.9,
  sources: ["Custody"],
  subject: "Portfolio",
  ...o,
});

const series = (name: string): Series => ({
  name,
  points: Array.from({ length: 6 }, (_, i) => ({ label: `M${i}`, value: i * 3 })),
});

const prose = (id: string, subject = "Portfolio"): Finding => ({
  ...meta({ id, subject }),
  kind: "narrative",
  text: `Note ${id}`,
});

/** The follow-up: "compare his top 2 holdings". */
const topTwoComparison: ComparisonFinding = {
  ...meta({ id: "top2", subject: "Holdings", emphasis: "primary" }),
  kind: "comparison",
  label: "Top 2 holdings",
  measure: "Total return",
  entities: [
    { name: "NVDA", value: 32.1, series: series("NVDA") },
    { name: "MSFT", value: 18.4, series: series("MSFT") },
  ],
};

const baseDoc = (): ReportDoc =>
  composeReport(
    [
      { ...meta({ id: "aum", subject: "Overview", emphasis: "primary" }), kind: "metric", label: "AUM", value: "S$25.4m" },
      prose("focus", "Overview"),
      prose("perf", "Performance"),
    ],
    { id: "doc1", title: "Portfolio review", subject: "Prashanth" },
  );

describe("the follow-up case", () => {
  it("inserts a dual line chart chosen by the same rules", () => {
    // The model emitted a finding, not a component name — and selection landed
    // on DualLineChart because there are two entities with history.
    const { doc, addedBlockIds } = applyOps(baseDoc(), [
      { op: "addFinding", finding: topTwoComparison },
    ]);
    expect(addedBlockIds).toEqual(["block-top2"]);
    const added = orderedBlocks(doc).find((b) => b.id === "block-top2");
    expect(added?.rendererId).toBe("DualLineChart");
    expect(added?.selection.reason).toContain("Two entities with history");
  });

  it("does not disturb the identity of blocks already on screen", () => {
    // The whole reason patches exist instead of regeneration.
    const before = baseDoc();
    const idsBefore = orderedBlocks(before).map((b) => b.id);
    const { doc } = applyOps(before, [
      { op: "addFinding", finding: topTwoComparison },
    ]);
    const idsAfter = orderedBlocks(doc).map((b) => b.id);
    expect(idsAfter).toEqual([...idsBefore, "block-top2"]);
  });

  it("creates a section for a subject the report did not have", () => {
    const { doc } = applyOps(baseDoc(), [
      { op: "addFinding", finding: topTwoComparison },
    ]);
    expect(doc.sections.map((s) => s.heading)).toContain("Holdings");
  });

  it("adds into an existing section when the subject matches", () => {
    const finding = { ...topTwoComparison, subject: "Performance" };
    const { doc } = applyOps(baseDoc(), [{ op: "addFinding", finding }]);
    const performance = doc.sections.find((s) => s.heading === "Performance");
    expect(performance?.blocks.map((b) => b.id)).toEqual([
      "block-perf",
      "block-top2",
    ]);
  });

  it("carries the new finding into the document's finding map", () => {
    // Renderers read the finding from the doc, so an added block with no finding
    // would render blank.
    const { doc } = applyOps(baseDoc(), [
      { op: "addFinding", finding: topTwoComparison },
    ]);
    expect(doc.findings["top2"]).toEqual(topTwoComparison);
  });
});

describe("purity", () => {
  it("does not mutate the document it was given", () => {
    // Undo is "keep the previous doc", which only works if this holds.
    const before = baseDoc();
    const snapshot = JSON.stringify(before);
    applyOps(before, [
      { op: "addFinding", finding: topTwoComparison },
      { op: "removeBlock", blockId: "block-perf" },
    ]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("is deterministic", () => {
    const ops: ReportOp[] = [{ op: "addFinding", finding: topTwoComparison }];
    expect(applyOps(baseDoc(), ops)).toEqual(applyOps(baseDoc(), ops));
  });
});

describe("placement", () => {
  it("honours an explicit anchor over the finding's subject", () => {
    const { doc } = applyOps(baseDoc(), [
      { op: "addFinding", finding: topTwoComparison, after: "block-aum" },
    ]);
    const overview = doc.sections.find((s) => s.heading === "Overview");
    expect(overview?.blocks.map((b) => b.id)).toEqual([
      "block-aum",
      "block-top2",
      "block-focus",
    ]);
  });

  it("pushes later blocks down the reveal sequence rather than appending", () => {
    // A block inserted mid-report must animate in its reading position.
    const { doc } = applyOps(baseDoc(), [
      { op: "addFinding", finding: topTwoComparison, after: "block-aum" },
    ]);
    const ordered = orderedBlocks(doc);
    expect(ordered.map((b) => b.id)).toEqual([
      "block-aum",
      "block-top2",
      "block-focus",
      "block-perf",
    ]);
    expect(ordered.map((b) => b.order)).toEqual([0, 1, 2, 3]);
  });
});

describe("removeBlock", () => {
  it("removes the block and its finding", () => {
    const { doc, removedBlockIds } = applyOps(baseDoc(), [
      { op: "removeBlock", blockId: "block-perf" },
    ]);
    expect(removedBlockIds).toEqual(["block-perf"]);
    expect(doc.findings["perf"]).toBeUndefined();
  });

  it("drops a section left with no blocks", () => {
    const { doc } = applyOps(baseDoc(), [
      { op: "removeBlock", blockId: "block-perf" },
    ]);
    expect(doc.sections.map((s) => s.heading)).toEqual(["Overview"]);
  });

  it("leaves reveal order gapless", () => {
    const { doc } = applyOps(baseDoc(), [
      { op: "removeBlock", blockId: "block-focus" },
    ]);
    expect(orderedBlocks(doc).map((b) => b.order)).toEqual([0, 1]);
  });
});

describe("replaceBlock", () => {
  it("swaps the finding and re-runs selection", () => {
    const { doc } = applyOps(baseDoc(), [
      { op: "replaceBlock", blockId: "block-perf", finding: topTwoComparison },
    ]);
    const performance = doc.sections.find((s) => s.heading === "Performance");
    expect(performance?.blocks[0].rendererId).toBe("DualLineChart");
    expect(doc.findings["perf"]).toBeUndefined();
  });
});

describe("setEmphasis", () => {
  it("re-selects the renderer, because emphasis changes meaning", () => {
    // A secondary metric is a StatTile; promoted to primary it becomes the hero.
    const doc = composeReport(
      [{ ...meta({ id: "aum", subject: "Overview" }), kind: "metric", label: "AUM", value: "S$25.4m" }],
      { id: "d", title: "t", subject: "s" },
    );
    expect(doc.sections[0].blocks[0].rendererId).toBe("StatTile");

    const patched = applyOps(doc, [
      { op: "setEmphasis", blockId: "block-aum", emphasis: "primary" },
    ]);
    expect(patched.doc.sections[0].blocks[0].rendererId).toBe("HeroMetric");
    expect(patched.doc.findings["aum"].emphasis).toBe("primary");
  });
});

describe("reorder", () => {
  it("moves a block after another, across sections", () => {
    const { doc } = applyOps(baseDoc(), [
      { op: "reorder", blockId: "block-perf", after: "block-aum" },
    ]);
    expect(orderedBlocks(doc).map((b) => b.id)).toEqual([
      "block-aum",
      "block-perf",
      "block-focus",
    ]);
  });
});

describe("rejection", () => {
  it("reports an unknown block instead of doing nothing quietly", () => {
    const { rejected } = applyOps(baseDoc(), [
      { op: "removeBlock", blockId: "block-nope" },
    ]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain("Unknown block");
  });

  it("inserts a finding no chart wants as text rather than rejecting it", () => {
    const degenerate: Finding = {
      ...meta({ id: "bad", subject: "Broken" }),
      kind: "composition",
      label: "One part",
      parts: [{ label: "Only", value: 1 }],
    };
    const { rejected, doc, addedBlockIds } = applyOps(baseDoc(), [
      { op: "addFinding", finding: degenerate },
    ]);
    expect(rejected).toEqual([]);
    expect(addedBlockIds).toEqual(["block-bad"]);
    expect(doc.sections.map((s) => s.heading)).toContain("Broken");
  });

  it("rejects a duplicate rather than rendering the same block twice", () => {
    const { rejected } = applyOps(baseDoc(), [
      { op: "addFinding", finding: prose("perf", "Performance") },
    ]);
    expect(rejected[0].reason).toContain("already exists");
  });

  it("does not lose a block when its reorder anchor is unknown", () => {
    // The splice-then-reinsert path: a bad anchor must not delete the block.
    const { doc, rejected } = applyOps(baseDoc(), [
      { op: "reorder", blockId: "block-perf", after: "block-nope" },
    ]);
    expect(rejected).toHaveLength(1);
    expect(orderedBlocks(doc).map((b) => b.id)).toContain("block-perf");
  });

  it("applies the rest of the batch when one op fails", () => {
    // One impossible instruction shouldn't discard the others.
    const { doc, rejected, addedBlockIds } = applyOps(baseDoc(), [
      { op: "removeBlock", blockId: "block-nope" },
      { op: "addFinding", finding: topTwoComparison },
    ]);
    expect(rejected).toHaveLength(1);
    expect(addedBlockIds).toEqual(["block-top2"]);
    expect(doc.sections.map((s) => s.heading)).toContain("Holdings");
  });
});

describe("sequencing", () => {
  it("lets a later op act on a block an earlier op created", () => {
    const { doc, rejected } = applyOps(baseDoc(), [
      { op: "addFinding", finding: topTwoComparison },
      { op: "reorder", blockId: "block-top2", after: "block-aum" },
    ]);
    expect(rejected).toEqual([]);
    expect(orderedBlocks(doc)[1].id).toBe("block-top2");
  });
});
