/**
 * The second pinned client — the same contracts as ./prashanth.test.ts, plus the one
 * claim that only a second client can make.
 *
 * That claim is the reason this fixture exists: the same question put to a different
 * balance sheet comes back as a differently *shaped* page, not the same page with other
 * numbers in it. Nothing in ELEANOR_REPORT names a component or a slot — it says
 * `taskType: "property_review"`, recipe selection is a lookup on that, and the rest
 * follows. So the test that matters is that the recipe differs while the fixture stays
 * innocent of layout.
 *
 * The two findings the page is really for are pinned too: S$36.0m carried at marks eight
 * to seventeen months old, and S$6.95m of commitments against a stated S$7m liquidity
 * floor. Those are the claims the analysis was written to deliver; a layout that loses
 * them has failed even if it validates.
 */

import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { composeView, planIA } from "../compose";
import { SpecRenderer } from "../SpecRenderer";
import { DataBundleSchema } from "../data";
import { ELEANOR_ANSWER, ELEANOR_BUNDLE, ELEANOR_PLAN, ELEANOR_REPORT } from "../eleanor";
import { IntentPlanSchema } from "../intent";
import { PRASHANTH_PLAN, PRASHANTH_REPORT } from "../prashanth";
import { RECIPES } from "../recipes";
import { headlineFigures, referencedKeys, SemanticReportSchema } from "../semantic";
import { validate } from "../validate";

const composed = () => {
  const result = composeView(ELEANOR_REPORT, ELEANOR_PLAN, ELEANOR_BUNDLE);
  if (!result.spec) throw new Error("the pinned property report composed no spec");
  return result;
};

describe("the property fixture satisfies its own contracts", () => {
  it("parses as a plan, a bundle and a semantic report", () => {
    expect(() => IntentPlanSchema.parse(ELEANOR_PLAN)).not.toThrow();
    expect(() => DataBundleSchema.parse(ELEANOR_BUNDLE)).not.toThrow();
    expect(() => SemanticReportSchema.parse(ELEANOR_REPORT)).not.toThrow();
  });

  it("stands on keys that are actually in the bundle, and has provenance for each", () => {
    for (const key of referencedKeys(ELEANOR_REPORT)) {
      expect(ELEANOR_BUNDLE.values, key).toHaveProperty(key);
      expect(ELEANOR_BUNDLE.provenance, key).toHaveProperty(key);
    }
  });

  it("names exactly one primary section, so the page has one entry point", () => {
    const primary = ELEANOR_REPORT.sections.filter((section) => section.importance === "primary");
    expect(primary.map((section) => section.id)).toEqual(["s.networth"]);
  });

  it("carries the written answer verbatim, which is the §14 fallback", () => {
    expect(ELEANOR_REPORT.narrative).toBe(ELEANOR_ANSWER);
  });
});

describe("a different book produces a differently shaped page", () => {
  it("routes to the property recipe rather than the analytical one", () => {
    expect(composed().recipeId).toBe("PropertyReport");
    expect(composeView(PRASHANTH_REPORT, PRASHANTH_PLAN, ELEANOR_BUNDLE).recipeId).toBe("AnalyticalReport");
  });

  it("gets there without the fixture naming a recipe, a slot or a component", () => {
    // The shape is a consequence of the task type, not an instruction in the data. If
    // this ever fails, the freeze point has leaked downstream into the layout layers.
    const serialised = JSON.stringify(ELEANOR_REPORT);
    for (const word of ["PropertyReport", "slot", "MetricCard", "Grid", "Stack", "recipe"]) {
      expect(serialised, word).not.toContain(word);
    }
  });

  it("places every section inside the recipe's area budget", () => {
    const { unplaced } = composeView(ELEANOR_REPORT, ELEANOR_PLAN, ELEANOR_BUNDLE);
    expect(unplaced).toEqual([]);
    const { plan } = planIA(ELEANOR_REPORT, ELEANOR_PLAN);
    expect(plan.areas.length).toBeLessThanOrEqual(RECIPES.PropertyReport.maxAreas);
  });

  it("makes the two views of the property book one tabbed area rather than two", () => {
    const { plan } = planIA(ELEANOR_REPORT, ELEANOR_PLAN);
    const shared = plan.areas.find((area) => area.sectionIds.includes("s.property"));
    expect(shared?.sectionIds).toEqual(["s.property", "s.geography"]);
  });
});

describe("the frozen analysis does not weaken the guarantees", () => {
  it("validates with no errors", () => {
    const { spec } = composed();
    const errors = validate(spec, ELEANOR_BUNDLE).issues.filter((issue) => issue.severity === "error");
    expect(errors).toEqual([]);
  });

  it("keeps every figure out of the spec, the same as any composed view", () => {
    const { spec } = composed();
    const serialised = JSON.stringify(spec.root);
    for (const figure of ["113.3", "116.0", "48.0", "36.0", "6.95", "41.4"]) {
      expect(serialised, figure).not.toContain(figure);
    }
    expect(serialised).not.toContain(ELEANOR_REPORT.summary);
  });

  it("lifts the figures the analysis marked primary, in document order", () => {
    expect(headlineFigures(ELEANOR_REPORT).map((figure) => figure.label)).toEqual([
      "Net worth",
      "Property",
      "Illiquid assets",
      "Cash",
    ]);
  });
});

describe("the report renders the analysis it was written from", () => {
  it("prints the headline figures once each and both claims the page is for", () => {
    const { spec } = composed();
    const { container } = render(
      React.createElement(SpecRenderer, { spec, report: ELEANOR_REPORT, bundle: ELEANOR_BUNDLE }),
    );
    const text = container.textContent ?? "";

    const drawn = (figure: string): number =>
      [...container.querySelectorAll("*")].filter(
        (element) => element.children.length === 0 && element.textContent?.trim() === figure,
      ).length;

    for (const figure of ["S$113.3m", "S$48.0m", "S$11.0m"]) {
      expect(text, figure).toContain(figure);
      expect(drawn(figure), figure).toBe(1);
    }

    /* The stale marks and the liquidity floor: the two findings the analysis leads to. */
    expect(text).toContain("S$36.0m");
    expect(text).toMatch(/S\$7(\.0)?m/);
    expect(text).toContain("12 October");
  });
});
