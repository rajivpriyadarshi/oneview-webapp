/**
 * Tests for layer 4 — DESIGN.md §5 and §11.
 *
 * The properties worth protecting here are the ones that break the *animation*
 * rather than the layout, because those are invisible in a screenshot: reveal
 * order must be total and gapless, and block ids must be stable across
 * recomposition or React remounts a block mid-flight and it flickers.
 */

import { describe, expect, it } from "vitest";
import { blockCount, composeReport, orderedBlocks } from "../compose";
import type { Emphasis, Finding, FindingMeta } from "../findings";

const meta = (o: Partial<FindingMeta> = {}): FindingMeta => ({
  id: "f1",
  emphasis: "secondary",
  confidence: 0.9,
  sources: ["Custody"],
  subject: "Portfolio",
  ...o,
});

const prose = (id: string, subject: string, emphasis: Emphasis): Finding => ({
  ...meta({ id, subject, emphasis }),
  kind: "narrative",
  text: `Note ${id}`,
});

const tile = (id: string, subject: string): Finding => ({
  ...meta({ id, subject, emphasis: "secondary" }),
  kind: "metric",
  label: "Metric",
  value: "S$1m",
});

const opts = { id: "doc1", title: "Portfolio review", subject: "Prashanth" };

describe("grouping", () => {
  it("groups findings by subject into sections", () => {
    const doc = composeReport(
      [
        prose("a", "Allocation", "secondary"),
        prose("b", "Performance", "secondary"),
        prose("c", "Allocation", "secondary"),
      ],
      opts,
    );
    expect(doc.sections.map((s) => s.heading)).toEqual([
      "Allocation",
      "Performance",
    ]);
    expect(doc.sections[0].blocks).toHaveLength(2);
  });

  it("derives a stable slug id for each section", () => {
    const doc = composeReport([prose("a", "Asset allocation", "primary")], opts);
    expect(doc.sections[0].id).toBe("section-asset-allocation");
  });
});

describe("ordering", () => {
  it("leads with the section holding the strongest finding", () => {
    // "Performance" appears second but contains the primary finding, so it wins.
    const doc = composeReport(
      [
        prose("a", "Allocation", "supporting"),
        prose("b", "Performance", "primary"),
      ],
      opts,
    );
    expect(doc.sections[0].heading).toBe("Performance");
  });

  it("keeps the model's order between sections of equal emphasis", () => {
    const doc = composeReport(
      [
        prose("a", "First", "secondary"),
        prose("b", "Second", "secondary"),
        prose("c", "Third", "secondary"),
      ],
      opts,
    );
    expect(doc.sections.map((s) => s.heading)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("sorts blocks within a section by emphasis", () => {
    const doc = composeReport(
      [
        prose("a", "S", "supporting"),
        prose("b", "S", "primary"),
        prose("c", "S", "secondary"),
      ],
      opts,
    );
    expect(doc.sections[0].blocks.map((b) => b.findingId)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("reveal order", () => {
  it("is gapless and sequential across the whole document", () => {
    // Blocks land one at a time driven by this number, so a gap or a duplicate
    // stalls or double-fires the animation.
    const doc = composeReport(
      [
        prose("a", "One", "primary"),
        prose("b", "Two", "secondary"),
        prose("c", "One", "secondary"),
        prose("d", "Three", "supporting"),
      ],
      opts,
    );
    const orders = orderedBlocks(doc).map((b) => b.order);
    expect(orders).toEqual([0, 1, 2, 3]);
    expect(orders).toHaveLength(blockCount(doc));
  });

  it("does not restart numbering per section", () => {
    const doc = composeReport(
      [prose("a", "One", "primary"), prose("b", "Two", "secondary")],
      opts,
    );
    expect(doc.sections[1].blocks[0].order).toBe(1);
  });
});

describe("block ids", () => {
  it("are derived from the finding, not from a counter", () => {
    const doc = composeReport([prose("aum", "S", "primary")], opts);
    expect(doc.sections[0].blocks[0].id).toBe("block-aum");
  });

  it("stay stable when other findings are added around them", () => {
    // The property that makes §6 patch insertion animatable: adding a block must
    // not change the identity of the blocks already on screen.
    const before = composeReport([prose("a", "S", "primary")], opts);
    const after = composeReport(
      [prose("a", "S", "primary"), prose("b", "S", "secondary")],
      opts,
    );
    expect(after.sections[0].blocks[0].id).toBe(before.sections[0].blocks[0].id);
  });
});

describe("grid packing", () => {
  it("promotes a lone trailing block to full width", () => {
    // One 4-span metric alone on its row reads as a mistake.
    const doc = composeReport([tile("a", "S")], opts);
    expect(doc.sections[0].blocks[0].span).toBe(12);
  });

  it("leaves a legitimate partial row alone", () => {
    // Two 4-spans leaving a 4-column gap is a real layout, not an orphan.
    const doc = composeReport([tile("a", "S"), tile("b", "S")], opts);
    expect(doc.sections[0].blocks.map((b) => b.span)).toEqual([4, 4]);
  });

  it("never lets a row exceed 12 columns", () => {
    const doc = composeReport(
      ["a", "b", "c", "d", "e"].map((id) => tile(id, "S")),
      opts,
    );
    let used = 0;
    for (const block of doc.sections[0].blocks) {
      if (used + block.span > 12) used = 0;
      used += block.span;
      expect(used).toBeLessThanOrEqual(12);
    }
  });
});

describe("findings no chart wants", () => {
  // A composition of one part: nothing to compare, so every chart declines it.
  // The ask is open-ended, so this arrives in practice rather than in theory —
  // and dropping it would mean the report silently omits something the model
  // found. It renders as text instead.
  const degenerate: Finding = {
    ...meta({ id: "bad", subject: "Broken" }),
    kind: "composition",
    label: "One part",
    parts: [{ label: "Only", value: 1 }],
  };

  it("still render, as text rather than as a chart", () => {
    const doc = composeReport([prose("a", "Fine", "primary"), degenerate], opts);
    expect(doc.unrendered).toEqual([]);
    const block = orderedBlocks(doc).find((b) => b.findingId === "bad");
    expect(block?.rendererId).toBe("FallbackList");
  });

  it("keep their own section", () => {
    const doc = composeReport([prose("a", "Fine", "primary"), degenerate], opts);
    expect(doc.sections.map((s) => s.heading)).toEqual(["Fine", "Broken"]);
  });

  it("do not create gaps in the reveal order", () => {
    const doc = composeReport(
      [prose("a", "Fine", "primary"), degenerate, prose("c", "Fine", "secondary")],
      opts,
    );
    expect(orderedBlocks(doc).map((b) => b.order)).toEqual([0, 1, 2]);
  });
});

describe("determinism", () => {
  it("produces an identical document for identical input", () => {
    const findings = [
      prose("a", "One", "primary"),
      tile("b", "Two"),
      prose("c", "One", "supporting"),
    ];
    expect(composeReport(findings, opts)).toEqual(composeReport(findings, opts));
  });

  it("handles an empty finding list without inventing a section", () => {
    const doc = composeReport([], opts);
    expect(doc.sections).toEqual([]);
    expect(blockCount(doc)).toBe(0);
  });
});

/**
 * Tabs for sibling blocks — the rule that stops a section becoming a texture.
 *
 * Grouping is on the finding *kind*, not the renderer, and that is the property
 * worth protecting: five comparisons legitimately draw as a mix of paired bars and
 * tables depending on how many entities each holds, and bucketing by renderer would
 * split the very group this rule exists to find.
 */
describe("sibling tabs", () => {
  const versus = (id: string, measure: string, entities: number, emphasis: Emphasis = "secondary"): Finding => ({
    ...meta({ id, subject: "Side by side", emphasis }),
    kind: "comparison",
    label: `${measure} vs benchmark`,
    measure,
    entities: Array.from({ length: entities }, (_, i) => ({ name: `E${i}`, value: i + 1 })),
  });

  it("folds three or more siblings of one kind into a tab group", () => {
    const doc = composeReport(
      [versus("a", "Return", 2), versus("b", "Volatility", 5), versus("c", "Share", 2)],
      opts,
    );
    const section = doc.sections[0];
    expect(section.groups).toHaveLength(1);
    expect(section.groups?.[0].tabs.map((tab) => tab.label)).toEqual([
      "Return vs benchmark",
      "Volatility vs benchmark",
      "Share vs benchmark",
    ]);
    // Different renderers, one group: the mix is the point.
    const renderers = new Set(section.blocks.map((block) => block.rendererId));
    expect(renderers.size).toBeGreaterThan(1);
  });

  it("leaves two siblings side by side", () => {
    const doc = composeReport([versus("a", "Return", 2), versus("b", "Volatility", 2)], opts);
    expect(doc.sections[0].groups).toBeUndefined();
  });

  it("never tabs the primary finding, and still tabs the rest", () => {
    const doc = composeReport(
      [
        versus("lead", "Return", 2, "primary"),
        versus("b", "Volatility", 2),
        versus("c", "Share", 2),
        versus("d", "Yield", 2),
      ],
      opts,
    );
    const section = doc.sections[0];
    const tabbed = section.groups?.[0].tabs.map((tab) => tab.blockId) ?? [];
    expect(tabbed).not.toContain("block-lead");
    expect(tabbed).toHaveLength(3);
  });

  it("keeps every block in section.blocks, so reveal order stays gapless", () => {
    const doc = composeReport(
      [versus("a", "Return", 2), versus("b", "Volatility", 2), versus("c", "Share", 2), tile("d", "Side by side")],
      opts,
    );
    expect(blockCount(doc)).toBe(4);
    expect(orderedBlocks(doc).map((block) => block.order)).toEqual([0, 1, 2, 3]);
    // The metric is a different kind, so it stays loose in the grid.
    expect(doc.sections[0].groups?.[0].tabs).toHaveLength(3);
  });
});

/**
 * Tab names. The regression this guards is specific and was live: every finding in a
 * group shares `subject` *by construction* — that is what sections are grouped by —
 * so `subject` can never be a tab label. Three tabs reading "What's committed" is
 * the failure mode, and it is invisible to every other test in this file.
 */
describe("tab names", () => {
  const commitment = (id: string, purpose: string, deadline: string): Finding => ({
    ...meta({ id, subject: "What's committed", emphasis: "secondary" }),
    kind: "requirement",
    amount: "S$0.6m",
    purpose,
    deadline,
  });

  it("names a requirement tab by its purpose, not the section subject", () => {
    const doc = composeReport(
      [
        commitment("a", "Private fund capital call", "within 6 weeks"),
        commitment("b", "Bond tranche maturity", "next month"),
        commitment("c", "Dividend season inflows", "next quarter"),
      ],
      opts,
    );
    expect(doc.sections[0].groups?.[0].tabs.map((tab) => tab.label)).toEqual([
      "Private fund capital call",
      "Bond tranche maturity",
      "Dividend season inflows",
    ]);
  });

  it("qualifies genuine collisions with a second field rather than a number", () => {
    const doc = composeReport(
      [
        commitment("a", "Capital call", "next month"),
        commitment("b", "Capital call", "next quarter"),
        commitment("c", "Bond maturity", "within 6 weeks"),
      ],
      opts,
    );
    expect(doc.sections[0].groups?.[0].tabs.map((tab) => tab.label)).toEqual([
      "Capital call · next month",
      "Capital call · next quart…",
      "Bond maturity",
    ]);
  });
});
