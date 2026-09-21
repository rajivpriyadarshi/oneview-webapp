/**
 * The pinned report — the promises that make freezing at the semantic layer safe.
 *
 * A fixture is only worth having if it cannot rot, and there are four ways this one
 * could. It could stop satisfying its own schemas. It could outgrow the recipe's area
 * budget and start silently dropping sections — the failure this file exists to catch,
 * because an unplaced section looks exactly like a section with nothing to say. It
 * could start carrying figures in the spec, which would make the demo the one place
 * §9 does not hold. Or the report and the bundle could drift apart, leaving sections
 * standing on keys that are not there.
 *
 * None of these are hypothetical: the eight-area report was built against a
 * seven-area recipe and lost its sources until the ceiling was raised, and nothing
 * but a test would have said so.
 */

import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { composeView, planIA } from "../compose";
import { SpecRenderer } from "../SpecRenderer";
import { DataBundleSchema } from "../data";
import { IntentPlanSchema } from "../intent";
import { PRASHANTH_ANSWER, PRASHANTH_BUNDLE, PRASHANTH_PLAN, PRASHANTH_REPORT } from "../prashanth";
import { RECIPES } from "../recipes";
import { headlineFigures, referencedKeys, SemanticReportSchema } from "../semantic";
import { validate } from "../validate";

const composed = () => {
  const result = composeView(PRASHANTH_REPORT, PRASHANTH_PLAN, PRASHANTH_BUNDLE);
  if (!result.spec) throw new Error("the pinned report composed no spec");
  return result;
};

describe("the pinned report satisfies its own contracts", () => {
  it("parses as a plan, a bundle and a semantic report", () => {
    expect(() => IntentPlanSchema.parse(PRASHANTH_PLAN)).not.toThrow();
    expect(() => DataBundleSchema.parse(PRASHANTH_BUNDLE)).not.toThrow();
    expect(() => SemanticReportSchema.parse(PRASHANTH_REPORT)).not.toThrow();
  });

  it("stands on keys that are actually in the bundle, and has provenance for each", () => {
    for (const key of referencedKeys(PRASHANTH_REPORT)) {
      expect(PRASHANTH_BUNDLE.values, key).toHaveProperty(key);
      expect(PRASHANTH_BUNDLE.provenance, key).toHaveProperty(key);
    }
  });

  it("names exactly one primary section, so the page has one entry point", () => {
    const primary = PRASHANTH_REPORT.sections.filter((section) => section.importance === "primary");
    expect(primary.map((section) => section.id)).toEqual(["s.networth"]);
  });

  it("carries the written answer verbatim, which is the §14 fallback", () => {
    expect(PRASHANTH_REPORT.narrative).toBe(PRASHANTH_ANSWER);
  });
});

describe("every section reaches the page", () => {
  it("places all nine sections inside the recipe's area budget", () => {
    // The regression: eight areas against a seven-area recipe, where placement is
    // first-fit in slot order, so the loser is whatever sits in the last slot — the
    // sources. Silent, and invisible on screen.
    const { unplaced } = composeView(PRASHANTH_REPORT, PRASHANTH_PLAN, PRASHANTH_BUNDLE);
    expect(unplaced).toEqual([]);
  });

  it("uses eight of the eight areas available, so there is no slack to rely on", () => {
    const { plan } = planIA(PRASHANTH_REPORT, PRASHANTH_PLAN);
    expect(plan.areas).toHaveLength(8);
    expect(plan.areas.length).toBeLessThanOrEqual(RECIPES.AnalyticalReport.maxAreas);
  });

  it("makes the two views of the listed book one area rather than two tables", () => {
    const { plan } = planIA(PRASHANTH_REPORT, PRASHANTH_PLAN);
    const shared = plan.areas.find((area) => area.sectionIds.includes("s.holdings"));
    expect(shared?.sectionIds).toEqual(["s.holdings", "s.custody"]);
  });
});

describe("the frozen analysis does not weaken the guarantees", () => {
  it("validates with no errors", () => {
    const { spec } = composed();
    const errors = validate(spec, PRASHANTH_BUNDLE).issues.filter((issue) => issue.severity === "error");
    expect(errors).toEqual([]);
  });

  it("keeps every figure out of the spec, the same as any composed view", () => {
    const { spec } = composed();
    const serialised = JSON.stringify(spec.root);
    for (const figure of ["55.4", "60.1", "25.2", "14.0", "3.6", "500k", "310k"]) {
      expect(serialised, figure).not.toContain(figure);
    }
    expect(serialised).not.toContain(PRASHANTH_REPORT.summary);
  });

  it("lifts the four figures the analysis marked primary, in document order", () => {
    expect(headlineFigures(PRASHANTH_REPORT).map((figure) => figure.label)).toEqual([
      "Net worth",
      "Return year to date",
      "Liquid assets",
      "Total borrowing",
    ]);
  });
});

describe("the report renders the analysis it was written from", () => {
  it("prints the headline figures, the concentration and the funding gap once each", () => {
    const { spec } = composed();
    const { container } = render(
      React.createElement(SpecRenderer, { spec, report: PRASHANTH_REPORT, bundle: PRASHANTH_BUNDLE }),
    );
    const text = container.textContent ?? "";

    /*
     * Counted as figures, not as occurrences of a string.
     *
     * The prose is allowed to say "US$4.6m" — the summary leads with the conclusion and
     * the guarantee note exists precisely to say what the US$4.6m excludes. Forbidding
     * that would be forbidding the analysis from referring to its own numbers. The
     * duplication that matters is the same figure drawn as a *figure* twice: once in the
     * headline strip and again as a card below it, leaving the reader to work out whether
     * the two are the same number. A rendered figure is a leaf element whose whole text
     * is the value, so that is what gets counted.
     */
    const drawn = (figure: string): number =>
      [...container.querySelectorAll("*")].filter(
        (element) => element.children.length === 0 && element.textContent?.trim() === figure,
      ).length;

    for (const figure of ["US$55.4m", "US$2.6m", "US$4.6m", "+14.0%"]) {
      expect(text, figure).toContain(figure);
      expect(drawn(figure), figure).toBe(1);
    }
    // The two claims the page exists to surface.
    expect(text).toContain("NVIDIA");
    expect(text).toContain("US$310k");
  });

  it("holds the currency and estimation disclosures, one click away", () => {
    /*
     * Behind the disclosure, not absent from it. Sources and method open collapsed by
     * design, so the toggle has to be worked for this — which is the point of asserting
     * it: the FX rates a converted balance sheet was built on reached nothing at all
     * until the composer stopped skipping an evidence section's own narratives.
     */
    const { spec } = composed();
    const { container, getByRole } = render(
      React.createElement(SpecRenderer, { spec, report: PRASHANTH_REPORT, bundle: PRASHANTH_BUNDLE }),
    );
    fireEvent.click(getByRole("button", { name: /show|sources|figures/i }));

    const opened = container.textContent ?? "";
    expect(opened).toMatch(/0\.78|SGD/);
    expect(opened).toContain("estimate");
  });
});
