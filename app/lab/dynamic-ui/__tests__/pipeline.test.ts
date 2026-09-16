/**
 * End-to-end over the real fixture — the worked example from DESIGN.md.
 *
 * The layer tests prove each rule in isolation; this proves the two scenarios the
 * prototype is *for* actually work on the data it will ship with. It is the test
 * that would catch a fixture whose findings are individually valid but which
 * composes into a report that looks wrong.
 */

import { describe, expect, it } from "vitest";
import { blockCount, composeReport, orderedBlocks } from "../compose";
import { applyOps } from "../patch";
import { PORTFOLIO_FINDINGS, SCRIPTED_SOURCE, TOP_TWO_HOLDINGS } from "../source";

const build = () =>
  composeReport(PORTFOLIO_FINDINGS, {
    id: "portfolio-review",
    title: "Portfolio analysis",
    subject: "Prashanth Ranganathan",
  });

describe("the portfolio report", () => {
  it("renders every finding in the fixture", () => {
    // A fixture finding that no renderer accepts is a fixture bug, and would
    // otherwise show up only as a silently shorter report.
    const doc = build();
    expect(doc.unrendered).toEqual([]);
    expect(blockCount(doc)).toBe(PORTFOLIO_FINDINGS.length);
  });

  it("opens on the headline number", () => {
    // Decision 3: blocks land one at a time, so the first block is the first
    // thing read. It had better be the portfolio value.
    const doc = build();
    const first = orderedBlocks(doc)[0];
    expect(first.findingId).toBe("aum");
    expect(first.rendererId).toBe("HeroMetric");
  });

  it("leads with the sections carrying primary findings", () => {
    const doc = build();
    expect(doc.sections[0].heading).toBe("Overview");
    // Every section here has a primary finding, so model order is preserved.
    expect(doc.sections.map((s) => s.heading)).toEqual([
      "Overview",
      "Performance",
      "Concentration",
      "Near-term focus",
    ]);
  });

  it("picks the charts the design intends", () => {
    // Spot-check the interesting selections rather than all of them: these are
    // the ones where the shape of the data drove the choice.
    const doc = build();
    const byFinding = Object.fromEntries(
      orderedBlocks(doc).map((b) => [b.findingId, b.rendererId]),
    );
    expect(byFinding).toMatchObject({
      aum: "HeroMetric",
      liquid: "StatTile",
      "perf-summary": "NarrativeWithChips",
      allocation: "DonutChart",
      "tech-exposure": "TransitionCard",
      "sector-mix": "BarChart",
      "liquidity-need": "RequirementCard",
      "rebalance-rec": "RecommendationCard",
      "concentration-flag": "FlagCallout",
    });
  });

  it("never packs a row past 12 columns", () => {
    const doc = build();
    for (const section of doc.sections) {
      let used = 0;
      for (const block of section.blocks) {
        if (used + block.span > 12) used = 0;
        used += block.span;
        expect(used, `${section.heading} overflowed`).toBeLessThanOrEqual(12);
      }
    }
  });

  it("gives every block a reason to show", () => {
    // Decision 4 puts these on screen, so an empty one is a visible bug.
    for (const block of orderedBlocks(build())) {
      expect(block.selection.reason, block.findingId).not.toBe("");
    }
  });
});

describe("the scripted source", () => {
  it("returns the report for a portfolio prompt", async () => {
    const findings = await SCRIPTED_SOURCE.analyse(
      "Give me the portfolio analysis report for Prashanth",
      "Prashanth",
    );
    expect(findings).toHaveLength(PORTFOLIO_FINDINGS.length);
  });

  it("returns nothing for an unrelated prompt", async () => {
    expect(
      await SCRIPTED_SOURCE.analyse("What is the weather", "Prashanth"),
    ).toEqual([]);
  });

  it("emits an op — never a component name — for the follow-up", async () => {
    const ops = await SCRIPTED_SOURCE.amend(
      "add a comparison graph between the client's top 2 holdings",
      build(),
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe("addFinding");
    expect(JSON.stringify(ops[0])).not.toContain("Chart");
  });
});

describe("the follow-up, end to end", () => {
  it("adds a dual line chart beside the concentration story", async () => {
    const doc = build();
    const ops = await SCRIPTED_SOURCE.amend(
      "add a comparison graph between the client's top 2 holdings",
      doc,
    );
    const { doc: patched, addedBlockIds, rejected } = applyOps(doc, ops);

    expect(rejected).toEqual([]);
    expect(addedBlockIds).toEqual(["block-top-two"]);

    const concentration = patched.sections.find(
      (s) => s.heading === "Concentration",
    );
    const ids = concentration?.blocks.map((b) => b.findingId);
    // Anchored directly after the transition it explains.
    expect(ids).toEqual([
      "tech-exposure",
      "top-two",
      "concentration-flag",
      "sector-mix",
    ]);

    const added = concentration?.blocks.find((b) => b.findingId === "top-two");
    expect(added?.rendererId).toBe("DualLineChart");
    expect(added?.span).toBe(12);
  });

  it("leaves every pre-existing block's identity intact", async () => {
    const doc = build();
    const before = orderedBlocks(doc).map((b) => b.id);
    const ops = await SCRIPTED_SOURCE.amend("compare top 2 holdings", doc);
    const { doc: patched } = applyOps(doc, ops);
    const after = orderedBlocks(patched).map((b) => b.id);
    expect(after.filter((id) => id !== "block-top-two")).toEqual(before);
  });

  it("keeps the reveal sequence gapless after insertion", async () => {
    const doc = build();
    const ops = await SCRIPTED_SOURCE.amend("compare top 2 holdings", doc);
    const { doc: patched } = applyOps(doc, ops);
    expect(orderedBlocks(patched).map((b) => b.order)).toEqual(
      Array.from({ length: PORTFOLIO_FINDINGS.length + 1 }, (_, i) => i),
    );
  });

  it("carries the new finding so the renderer has data to draw", async () => {
    const doc = build();
    const ops = await SCRIPTED_SOURCE.amend("compare top 2 holdings", doc);
    const { doc: patched } = applyOps(doc, ops);
    expect(patched.findings["top-two"]).toEqual(TOP_TWO_HOLDINGS);
  });
});
