/**
 * Tests for layer 1 — the interpretation layer.
 *
 * The bug these exist to prevent: an ask that says a number, answered with a
 * pair. "Compare top 4 holdings" showing two lines is the whole reason this
 * layer was pulled out of the analyst.
 */

import { describe, expect, it } from "vitest";
import { interpret } from "../interpret";
import { localAnalyse } from "../heuristics";
import { composeReport, orderedBlocks } from "../compose";

const comparisonIn = (prompt: string) => {
  const { title, findings } = localAnalyse(prompt);
  const doc = composeReport(findings, { id: "d", title, subject: "P" });
  const block = orderedBlocks(doc).find((b) => {
    const finding = doc.findings[b.findingId];
    return finding.kind === "comparison" && finding.emphasis === "primary";
  });
  const finding = block ? doc.findings[block.findingId] : undefined;
  return {
    rendererId: block?.rendererId,
    entities: finding?.kind === "comparison" ? finding.entities : [],
  };
};

describe("counting", () => {
  it("reads a digit next to a superlative", () => {
    expect(interpret("compare top 4 holdings").count).toBe(4);
  });

  it("reads a spelled-out number either side of the superlative", () => {
    expect(interpret("his two biggest holdings").count).toBe(2);
    expect(interpret("worst three positions").count).toBe(3);
  });

  it("ignores a number that is part of an instrument or a horizon", () => {
    // "SGS 10Y" and "last 3 months" are not requests for ten or three things.
    expect(interpret("how did SGS 10Y do").count).toBeUndefined();
    expect(interpret("performance over the last 3 months").count).toBeUndefined();
  });

  it("treats two named things as a count of two", () => {
    expect(interpret("NVIDIA versus Microsoft").count).toBe(2);
  });
});

describe("dimension", () => {
  it("does not mistake a ranking word for a measure", () => {
    // "top" says how to order the list, not what to plot.
    const ask = interpret("compare top 4 holdings");
    expect(ask.rank).toBe("value");
    expect(ask.measure).toBe("return");
    expect(ask.overTime).toBe(true);
  });

  it("drops time when the question is about size", () => {
    const ask = interpret("biggest holdings by value");
    expect(ask.measure).toBe("value");
    expect(ask.overTime).toBe(false);
  });

  it("ranks from the bottom when asked for the worst", () => {
    expect(interpret("which are his worst stocks").worst).toBe(true);
  });
});

describe("what the mapping layer then chooses", () => {
  it("gives four entities four lines, not two", () => {
    const { rendererId, entities } = comparisonIn("compare top 4 holdings");
    expect(entities).toHaveLength(4);
    expect(rendererId).toBe("MultiLineChart");
  });

  it("still uses the pair chart when the ask is a pair", () => {
    const { rendererId, entities } = comparisonIn("compare his two biggest holdings");
    expect(entities).toHaveLength(2);
    expect(rendererId).toBe("DualLineChart");
  });

  it("draws bars, not lines, when no history was asked for", () => {
    const { rendererId } = comparisonIn("biggest holdings by value");
    expect(rendererId).toBe("BarChart");
  });

  it("clamps a count to what the book actually holds", () => {
    const { entities } = comparisonIn("compare top 40 holdings");
    expect(entities.length).toBeGreaterThan(1);
    expect(entities.length).toBeLessThanOrEqual(12);
  });
});
