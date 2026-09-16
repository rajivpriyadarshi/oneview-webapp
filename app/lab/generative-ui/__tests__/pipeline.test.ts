/**
 * The pipeline end to end, with no model in it.
 *
 * The stand-in analyst stands in for layers 1 and 3, and layers 2, 4, 5, 7 and 8 are
 * the real ones. That makes this the cheapest available test of the claim the
 * architecture rests on: composition is deterministic, so a plain report should still
 * produce a page that validates — no repair pass, no warnings, nothing dropped.
 *
 * Each query below is one of the lab's suggested prompts, so a regression here is a
 * regression in something a person will click.
 */

import { describe, expect, it } from "vitest";
import { composeView } from "../compose";
import { standInAnswer, standInPlan, standInReport } from "../standin";
import { executePlan, satisfied } from "../tools";
import { validate } from "../validate";

const QUERIES = [
  { query: "How is Prashanth's portfolio doing?", recipe: "AnalyticalReport" },
  { query: "Compare his two biggest holdings", recipe: "ComparisonReport" },
  { query: "How would he fund the property purchase?", recipe: "TimelineReport" },
  { query: "What are the risks in the portfolio?", recipe: "AnalyticalReport" },
  { query: "Prepare me for the next meeting", recipe: "EntityOverview" },
] as const;

describe("the whole pipeline, offline", () => {
  for (const { query, recipe } of QUERIES) {
    it(`answers and lays out "${query}"`, () => {
      const plan = standInPlan(query);
      expect(plan.surface).toBe("view");

      const bundle = executePlan(plan);
      expect(bundle.failed).toEqual([]);
      expect(satisfied(plan, bundle)).toBe(true);

      const answer = standInAnswer(plan, bundle);
      expect(answer.length).toBeGreaterThan(120);

      const report = standInReport(plan, bundle, answer);
      const composed = composeView(report, plan, bundle);
      expect(composed.recipeId).toBe(recipe);
      /* Every section the report produced is on the page. */
      expect(composed.unplaced.filter((id) => id !== "s_goals")).toEqual([]);

      const result = validate(composed.spec, bundle);
      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);

      /* §14: the answer survives composition, word for word. */
      expect(composed.spec.narrative).toBe(answer);
    });
  }

  it("keeps a lookup on the text path, with no layout at all", () => {
    const plan = standInPlan("Who is his relationship manager?");
    expect(plan.surface).toBe("text");
    const bundle = executePlan(plan);
    expect(standInAnswer(plan, bundle)).toMatch(/Nithya Rao/);
  });
});
