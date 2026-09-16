/**
 * Tests for the two decisions that don't belong to any single finding: what an
 * ask *wants*, and what one card should become when the advisor comments on it.
 *
 * The bugs these exist to prevent, both seen on screen:
 *   - "what is the client's name?" assembling a twenty-two card report
 *   - a card that visibly ignores what was typed at it
 */

import { describe, expect, it } from "vitest";
import { intentOf, interpretRevision } from "../interpret";
import { localAnalyse, localFact } from "../heuristics";
import { composeReport, orderedBlocks, type ReportDoc } from "../compose";
import { applyOps } from "../patch";
import { reviseLocally } from "../revise";
import { critique } from "../critique";
import type { Finding } from "../findings";

const docFor = (prompt: string): ReportDoc => {
  const { title, findings } = localAnalyse(prompt);
  return composeReport(findings, { id: "d", title, subject: "P" });
};

/** The primary holdings comparison, which is what a card comment aims at. */
const comparisonBlock = (doc: ReportDoc) =>
  orderedBlocks(doc).find((block) => {
    const finding = doc.findings[block.findingId];
    return finding.kind === "comparison" && finding.emphasis === "primary";
  })!;

describe("intent — report or reply", () => {
  it("treats a one-fact lookup as a reply", () => {
    expect(intentOf("what is the client's name?", false)).toBe("answer");
    expect(intentOf("who is his relationship manager", false)).toBe("answer");
    expect(intentOf("when is the next review", true)).toBe("answer");
  });

  it("treats an analysis as something to build", () => {
    expect(intentOf("Give me a portfolio analysis for Prashanth", false)).toBe("report");
    expect(intentOf("how would he fund the property purchase?", false)).toBe("report");
  });

  it("answers a lookup from the book, and admits when it can't", () => {
    expect(localFact("what is the client's name?")).toMatch(/Prashanth/i);
    expect(localFact("what did he think of the football")).toBeNull();
  });
});

describe("revising one card", () => {
  it("restates a pair as six, and lets the mapping layer redraw it", () => {
    const doc = docFor("compare his two biggest holdings");
    const block = comparisonBlock(doc);
    expect(block.rendererId).toBe("DualLineChart");

    const { ops } = reviseLocally(doc, block.id, "show six of them");
    const next = applyOps(doc, ops);
    const revised = comparisonBlock(next.doc);
    const finding = next.doc.findings[revised.findingId] as Extract<Finding, { kind: "comparison" }>;

    expect(finding.entities).toHaveLength(6);
    // The advisor said six and never said what to draw, so the mapping layer
    // re-picked: six overlaid lines is the top of what one scale carries, and
    // past that it would have handed over to bars.
    expect(revised.rendererId).toBe("MultiLineChart");
  });

  it("gives way to bars once there are more lines than a scale carries", () => {
    const doc = docFor("compare his two biggest holdings");
    const { ops } = reviseLocally(doc, comparisonBlock(doc).id, "show eight of them");
    const next = applyOps(doc, ops);
    const revised = comparisonBlock(next.doc);
    expect(
      (next.doc.findings[revised.findingId] as Extract<Finding, { kind: "comparison" }>).entities,
    ).toHaveLength(8);
    expect(revised.rendererId).toBe("BarChart");
  });

  it("keeps the same names when only the count grows", () => {
    const doc = docFor("compare his two biggest holdings");
    const block = comparisonBlock(doc);
    const was = (doc.findings[block.findingId] as Extract<Finding, { kind: "comparison" }>).entities
      .map((entity) => entity.name);

    const { ops } = reviseLocally(doc, block.id, "make it four");
    const next = applyOps(doc, ops);
    const finding = next.doc.findings[comparisonBlock(next.doc).findingId] as Extract<
      Finding,
      { kind: "comparison" }
    >;
    expect(finding.entities.map((entity) => entity.name).slice(0, 2)).toEqual(was);
  });

  it("honours a component the advisor names outright", () => {
    const doc = docFor("compare his two biggest holdings");
    const block = comparisonBlock(doc);

    const { ops } = reviseLocally(doc, block.id, "make this a table");
    const next = applyOps(doc, ops);
    expect(comparisonBlock(next.doc).rendererId).toBe("DataTable");
  });

  it("declines a visual the data can't honestly support", () => {
    const doc = docFor("compare his two biggest holdings");
    const block = comparisonBlock(doc);

    const { ops } = reviseLocally(doc, block.id, "show this as a pie chart");
    const result = applyOps(doc, ops);
    // Two separate holdings are not slices of a whole, so the op is rejected with
    // a reason rather than drawn misleadingly.
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toMatch(/can't be drawn as donut/);
  });

  it("answers a question about the card instead of guessing at an edit", () => {
    const doc = docFor("compare his two biggest holdings");
    const block = comparisonBlock(doc);
    const { ops, reply } = reviseLocally(doc, block.id, "why is this here?");
    expect(ops).toHaveLength(0);
    expect(reply).toMatch(/DualLineChart/);
  });

  it("takes a card out when asked", () => {
    const doc = docFor("compare his two biggest holdings");
    const block = comparisonBlock(doc);
    const { ops } = reviseLocally(doc, block.id, "remove this");
    expect(ops).toEqual([{ op: "removeBlock", blockId: block.id }]);
  });

  it("only sets what the comment actually said", () => {
    const revision = interpretRevision("just three");
    expect(revision.count).toBe(3);
    expect(revision.measure).toBeUndefined();
    expect(revision.overTime).toBeUndefined();
    expect(revision.empty).toBe(false);
  });
});

describe("the review pass", () => {
  const finding = (over: Partial<Finding> & { id: string }): Finding =>
    ({
      kind: "comparison",
      subject: "Concentration",
      emphasis: "secondary",
      confidence: 0.8,
      sources: [],
      label: "Two holdings",
      measure: "Share of portfolio",
      entities: [
        { name: "NVIDIA", value: 9 },
        { name: "DBS", value: 7 },
      ],
      ...over,
    }) as Finding;

  it("drops a second card making the same point", () => {
    const doc = composeReport(
      [finding({ id: "a" }), finding({ id: "b", label: "The same two holdings" })],
      { id: "d", title: "T", subject: "P" },
    );
    const { ops, notes } = critique(doc);
    expect(ops).toContainEqual({ op: "removeBlock", blockId: "block-b" });
    expect(notes.join(" ")).toMatch(/same point/);
  });

  it("gives a report with no headline one", () => {
    const doc = composeReport([finding({ id: "a" }), finding({ id: "b", label: "Other", entities: [
      { name: "SGS 10Y", value: 4 },
      { name: "Cash", value: 3 },
    ] })], { id: "d", title: "T", subject: "P" });
    const { ops } = critique(doc);
    expect(ops.some((op) => op.op === "setEmphasis" && op.emphasis === "primary")).toBe(true);
  });

  it("leaves a well-built report alone", () => {
    const doc = docFor("compare his two biggest holdings");
    const { ops } = critique(doc);
    const second = critique(applyOps(doc, ops).doc);
    // Whatever it changed the first time, it must be stable — a reviewer that
    // keeps finding new problems in its own output would never settle.
    expect(second.ops.filter((op) => op.op !== "setEmphasis")).toHaveLength(0);
  });
});
