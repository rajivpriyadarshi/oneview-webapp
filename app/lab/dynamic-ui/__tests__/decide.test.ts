/**
 * Tests for the decider — the layer that reads the *answer* and says whether it
 * wants a page, and what sections that page has.
 *
 * The two failures worth guarding: a one-fact answer that gets twenty cards built
 * in front of it, and an answer full of things to do that comes back as prose.
 */

import { describe, expect, it } from "vitest";
import { decide } from "../decide";
import { localAnalyse } from "../heuristics";
import { composeReport, orderedBlocks } from "../compose";

const FACT = "His relationship manager is Wei Ling Tan, based in Singapore.";

const ANALYSIS = `The portfolio stands at S$33.3m, up 4.8% over the quarter.

Public equities are 52% of the book, and the top two positions — NVIDIA at S$4.2m and Microsoft at S$3.1m — together make up 22%, against a 15% single-name guideline. That is the main risk: concentration in two correlated names.

He should decide how the property purchase gets funded before the March review, and confirm whether the Lombard facility is acceptable to him. The bond maturity of S$800k next month needs to be held in cash rather than reinvested, because a S$0.6m capital call lands within six weeks.`;

describe("the decider", () => {
  it("leaves a one-fact answer alone", () => {
    const decision = decide("who is his relationship manager?", FACT);
    expect(decision.wants).toBe("reply");
    expect(decision.categories).toHaveLength(0);
  });

  it("does not build a page out of a paragraph with one number in it", () => {
    const decision = decide("how much cash does he hold?", "He is holding S$2.1m in cash across two accounts.");
    expect(decision.wants).toBe("reply");
  });

  it("asks for a page when the answer has several things standing in relation", () => {
    const decision = decide("give me a portfolio analysis", ANALYSIS);
    expect(decision.wants).toBe("report");
    expect(decision.evidence.figures).toBeGreaterThan(2);
  });

  it("names the sections it saw, and what each one is made of", () => {
    const { categories } = decide("give me a portfolio analysis", ANALYSIS);
    const ids = categories.map((category) => category.id);

    // The to-do is the one this whole layer was added for: "he should decide…",
    // "confirm…" is a list to work through, and it must not come back as prose.
    expect(ids).toContain("todo");
    expect(categories.find((category) => category.id === "todo")?.produces).toBe("checklist");
    expect(ids).toContain("risk");
    expect(ids).toContain("allocation");
    // Every category carries its own justification — that string is what the
    // thinking panel shows while the page is still blank.
    expect(categories.every((category) => category.because.length > 0)).toBe(true);
  });

  it("keeps the page to a readable number of sections", () => {
    const { categories } = decide("everything", `${ANALYSIS}\n\nFirst, trim the two names. Then hold the maturity. Pros and cons: the upside is liquidity, the drawback is tax. In short, the real question is timing. Next quarter the capital call lands.`);
    expect(categories.length).toBeLessThanOrEqual(6);
    // An ordered sequence and a bag of tasks are one section, not two.
    const ids = categories.map((category) => category.id);
    expect(ids.includes("todo") && ids.includes("steps")).toBe(false);
  });

  it("still asks for a page when nothing matched but there is substance", () => {
    const decision = decide(
      "tell me about the book",
      "S$33.3m sits across four sleeves.\n\n- S$12m equities\n- S$8m bonds\n- S$4m private markets\n- S$2.1m cash",
    );
    expect(decision.wants).toBe("report");
    expect(decision.categories.length).toBeGreaterThan(0);
  });
});

describe("the checklist that a to-do earns", () => {
  it("reaches a Checklist component, not a paragraph", () => {
    const { title, findings } = localAnalyse("what's outstanding on this client?");
    const doc = composeReport(findings, { id: "d", title, subject: "P" });
    const checklist = orderedBlocks(doc).find(
      (block) => doc.findings[block.findingId].kind === "checklist",
    );
    expect(checklist?.rendererId).toBe("Checklist");
  });
});
