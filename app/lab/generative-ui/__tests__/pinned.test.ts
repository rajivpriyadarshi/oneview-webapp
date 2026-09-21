/**
 * The registry, and the one mistake it must never make.
 *
 * Two pinned clients means the matcher now has two ways to be wrong, and they are not
 * equally bad. Declining a question it should have answered sends the run to the live
 * pipeline, which is visible and harmless. Answering about the wrong client is not: every
 * figure on Prashanth's page is a real, internally consistent figure, so a report served
 * under Eleanor's name would look entirely correct and be entirely false. Hence the rule
 * this file pins down — a name in the question outranks the simulator's selection.
 */

import { describe, expect, it } from "vitest";
import { PINNED_CLIENTS, pinnedRun } from "../pinned";

describe("the matcher stays narrow", () => {
  it("answers on a name or on an unmistakable request for the report", () => {
    for (const query of [
      "how is Prashanth's portfolio doing?",
      "Give me a portfolio analysis",
      "what is the net worth breakdown",
      "what is in Eleanor's property book?",
    ]) {
      expect(pinnedRun(query), query).not.toBeNull();
    }
  });

  it("declines anything else, so the lab still exercises the live pipeline", () => {
    for (const query of ["who covers the Tan family?", "draft a meeting agenda", "what happened in markets today"]) {
      expect(pinnedRun(query), query).toBeNull();
    }
  });
});

describe("the selector chooses whose book, and only that", () => {
  it("serves the selected client for an unnamed request", () => {
    expect(pinnedRun("give me the portfolio report", "eleanor")?.report.reportType).toBe("property_review");
    expect(pinnedRun("give me the portfolio report", "prashanth")?.report.reportType).toBe("portfolio_review");
  });

  it("lets a name in the question override the selection", () => {
    const run = pinnedRun("how is Prashanth's portfolio doing?", "eleanor");
    expect(run?.report.title).toContain("Prashanth");
    expect(run?.note).toContain("Prashanth");
  });

  it("does not turn the selection into an answer for everything", () => {
    expect(pinnedRun("draft a meeting agenda", "eleanor")).toBeNull();
  });

  it("gives every client a distinct name, pattern and distinction for the control", () => {
    expect(PINNED_CLIENTS.length).toBeGreaterThan(1);
    for (const client of PINNED_CLIENTS) {
      expect(client.distinction.length, client.id).toBeGreaterThan(12);
      expect(client.pattern.test(client.name.toLowerCase()), client.id).toBe(true);
    }
  });
});
