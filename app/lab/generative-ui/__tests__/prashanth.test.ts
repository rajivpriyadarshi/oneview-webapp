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
  it("leaves nothing unplaced", () => {
    // The regression: more areas than the recipe has slots, where placement is first-fit
    // in slot order, so the loser is whatever sits in the last slot — the sources.
    // Silent, and invisible on screen.
    const { unplaced } = composeView(PRASHANTH_REPORT, PRASHANTH_PLAN, PRASHANTH_BUNDLE);
    expect(unplaced).toEqual([]);
  });

  it("places every section, and stays inside the recipe's ceiling while doing it", () => {
    /* Nine areas against a ceiling of ten. The count is asserted because the failure it
       guards is silent: a section that does not fit a slot is dropped, and a dropped
       section looks exactly like a section the analysis never wrote. */
    const { plan } = planIA(PRASHANTH_REPORT, PRASHANTH_PLAN);
    expect(plan.areas).toHaveLength(9);
    expect(plan.areas.length).toBeLessThanOrEqual(RECIPES.AnalyticalReport.maxAreas);
  });

  it("reads the split and the holdings behind it as one area, side by side", () => {
    /* Two sections the report marked as answering the same question — what the book is
       made of, and what is in it — so they belong in one area rather than as two
       consecutive tables with a heading each. */
    const { plan } = planIA(PRASHANTH_REPORT, PRASHANTH_PLAN);
    const shared = plan.areas.find((area) => area.sectionIds.includes("s.holdings"));
    expect(shared?.sectionIds).toEqual(["s.allocation", "s.holdings"]);
    expect(shared?.arrangement).toBe("split");
  });
});

describe("the page has the shape the report was designed to have", () => {
  const areas = () => {
    const { spec } = composed();
    return spec.root.filter(
      (node) => node.component === "Section" || node.component === "WhatToWatch",
    );
  };

  it("numbers seven topics, and lets the eighth band continue the one above it", () => {
    /* The concentration band is a second reading of the drivers, not a new question, so it
       carries no heading and takes no number — see `continuation` in ../recipes.ts. Eight
       bands, seven headings, and the headings are what the reader counts. */
    const headed = areas().filter((node) => node.props.heading);
    expect(areas()).toHaveLength(8);
    expect(headed).toHaveLength(7);
    expect(headed.map((node) => node.props.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("lays the flagged set out as a rail rather than a column of paragraphs", () => {
    /* Four risks in two columns cost four rows of the page and spent them on the tail of a
       set the analysis had already put in priority order. On a rail the first two stay at
       full size, the count is stated, and the sections after this one keep their place —
       see the callout rule in ../compose.ts. Two would still be a Grid. */
    const attention = areas().find((node) => node.sectionId === "s.attention");
    const rail = attention?.children?.[0];
    expect(rail?.component).toBe("Carousel");
    expect(rail?.props.perView).toBe(2);
    expect(rail?.children?.map((kid) => kid.component)).toEqual([
      "RiskAlert",
      "RiskAlert",
      "RiskAlert",
      "RiskAlert",
    ]);
  });

  it("closes on the written outlook, by reference and not by copy", () => {
    const { spec } = composed();
    const last = spec.root[spec.root.length - 1];
    expect(last.component).toBe("Prose");
    expect(last.props.source).toBe("outlook");
    /* The words are nowhere in the spec, which is the whole point of `source` — the same
       promise `dataKey` makes about the bundle. */
    expect(JSON.stringify(spec.root)).not.toContain(PRASHANTH_REPORT.outlook?.text);

    const { container } = render(
      React.createElement(SpecRenderer, { spec, report: PRASHANTH_REPORT, bundle: PRASHANTH_BUNDLE }),
    );
    expect(container.textContent).toContain(PRASHANTH_REPORT.outlook?.text);
    expect(container.textContent).toContain(PRASHANTH_REPORT.outlook?.signature);
  });

  it("sets the capital call beside the dates it depends on", () => {
    const coming = areas().find((node) => node.sectionId === "s.coming");
    const grid = coming?.children?.[0];
    expect(grid?.component).toBe("Grid");
    expect(grid?.children?.map((kid) => kid.component)).toEqual(["CapitalFlow", "Timeline"]);
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
