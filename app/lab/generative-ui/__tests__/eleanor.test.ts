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
 * The two findings the page is really for are pinned too: a quarter of the private book
 * carried at marks older than nine months, and S$6.95m of commitments against S$4.0m of
 * cash available once the preferred reserve is held. Those are the claims the analysis was
 * written to deliver; a layout that loses them has failed even if it validates.
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
import type { UINode } from "../spec";
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
    expect(primary.map((section) => section.id)).toEqual(["s.readout"]);
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

  it("opens on the readout, not on the estate it belongs to", () => {
    /*
     * Both were eligible for position one — the headline slot used to accept `identity` as
     * well as `summary`, and page order is read from each group's first candidate slot. So
     * the ownership sections sorted ahead of the summary, filled a slot with room for one
     * area, and left the only section marked `primary` — the one the headline figures are
     * lifted from — off the page entirely.
     */
    expect(composeView(ELEANOR_REPORT, ELEANOR_PLAN, ELEANOR_BUNDLE).unplaced).toEqual([]);
    const { plan } = planIA(ELEANOR_REPORT, ELEANOR_PLAN);
    expect(plan.areas[0].sectionIds).toEqual(["s.readout"]);
  });

  it("reads the structure and the split of value across it as one area", () => {
    const { plan } = planIA(ELEANOR_REPORT, ELEANOR_PLAN);
    const shared = plan.areas.find((area) => area.sectionIds.includes("s.ownership"));
    expect(shared?.sectionIds).toEqual(["s.estate", "s.ownership"]);
    expect(shared?.arrangement).toBe("split");
  });

  it("reads what the book is made of and where it sits as one area, side by side", () => {
    const { plan } = planIA(ELEANOR_REPORT, ELEANOR_PLAN);
    const shared = plan.areas.find((area) => area.sectionIds.includes("s.geography"));
    expect(shared?.sectionIds).toEqual(["s.allocation", "s.geography"]);
  });

  it("sets what is available beside what is due, because the gap is the difference", () => {
    /* The one pairing the section exists for: S$4.0m available against S$6.95m owed is a
       subtraction, and a reader who has to scroll between the halves is doing it from
       memory. Grouped by the report, given room by the recipe's single-area funding slot. */
    const { plan } = planIA(ELEANOR_REPORT, ELEANOR_PLAN);
    const shared = plan.areas.find((area) => area.sectionIds.includes("s.commitments"));
    expect(shared?.sectionIds).toEqual(["s.liquidity", "s.commitments"]);
    expect(shared?.arrangement).toBe("split");
  });
});

describe("the page has the shape the report was designed to have", () => {
  const areas = () => {
    const { spec } = composed();
    return spec.root.filter((node) => node.component === "Section" || node.component === "WhatToWatch");
  };

  it("numbers eleven topics, every one of them headed", () => {
    /* Twelve areas: eleven bands, all headed, plus the sources, which are a collapsed
       Disclosure rather than a Section. The headings are what the reader counts. */
    const headed = areas().filter((node) => node.props.heading);
    expect(areas()).toHaveLength(11);
    expect(headed.map((node) => node.props.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("carries the three bands a portfolio report cannot have", () => {
    /*
     * The claim the two fixtures exist to make, reduced to three components.
     *
     * `KeyValueList` is labelled facts — a trustee, a governing law, a vesting year — and a
     * performance report has nothing of that shape to say. `ComparisonTable` over six
     * properties measured five ways is a schedule, where the same six inside a top-five
     * holdings table would be one large number. `NewsImpact` pairs an external move with
     * the one building it bears on. All three follow from the analysis declaring `identity`,
     * a five-measure comparison and `market_context` — types Prashanth's never declares.
     */
    /* Leaves only: the band's own container and any SplitPane or Stack inside it are how the
       area is arranged, not what it says. */
    const LAYOUT = new Set(["Section", "SplitPane", "Stack", "Grid"]);
    const leaves = (nodes: readonly UINode[]): string[] =>
      nodes.flatMap((node) => {
        const kids = [...(node.children ?? []), ...Object.values(node.slots ?? {}).flat()];
        return LAYOUT.has(node.component) ? leaves(kids) : [node.component];
      });
    const node = (sectionId: string) => leaves(areas().filter((area) => area.sectionId === sectionId));
    expect(node("s.estate")).toEqual(["KeyValueList", "Comparison"]);
    expect(node("s.properties")).toEqual(["ComparisonTable"]);
    expect(node("s.market")).toEqual(["NewsImpact"]);
  });

  it("keeps DataTable out of it, which is not the same as nothing choosing it", () => {
    /*
     * `DataTable` tabulates whatever columns the bound rows happen to carry, which is the
     * one contract a report cannot have: a column appears because the data had a field, not
     * because the analysis measured it. It nearly rendered here anyway — the ownership
     * section inherited the estate's `key_value` form, and DataTable is the only component
     * that implements `key_value` and accepts a comparison, so it won at a fit of 0.15.
     */
    expect(JSON.stringify(composed().spec.root)).not.toContain("DataTable");
  });

  it("stacks a comparison that has only half the page to sit in", () => {
    /* Three entity tiles side by side in a pane are a third of a column each, so
       "Whitfield Holdings Pte Ltd" wraps and the figures beneath the labels land at
       different heights — a set that stops being scannable where the figures matter.
       See the pane rule in ../compose.ts; the `rows` variant is the registry's. */
    const inPanes = (nodes: readonly UINode[], within = false): UINode[] =>
      nodes.flatMap((node) => {
        const kids = [...(node.children ?? []), ...Object.values(node.slots ?? {}).flat()];
        const inside = within || node.component === "SplitPane";
        return [...(inside && node.component === "Comparison" ? [node] : []), ...inPanes(kids, inside)];
      });
    const paned = inPanes(composed().spec.root);
    expect(paned.length).toBeGreaterThan(0);
    for (const node of paned) expect(node.props.variant).toBe("rows");
  });

  it("orders the page as the reader needs it, not as the model emitted it", () => {
    /*
     * Liquidity before valuations before attention before the calendar — and the calendar
     * *last* of the four, which it was not: page order is read from each group's first
     * candidate slot, so while the funding slot still accepted `commitments` the standalone
     * calendar sorted alongside it and printed "What's coming" as topic 5, ahead of what
     * needs attention. See the `accepts` note on the funding slot in ../recipes.ts.
     */
    expect(areas().map((node) => node.sectionId)).toEqual([
      "s.readout",
      "s.changed",
      "s.estate",
      "s.properties",
      "s.allocation",
      "s.liquidity",
      "s.market",
      "s.valuations",
      "s.attention",
      "s.coming",
      "s.recommend",
    ]);
  });

  it("puts the three attention items in one row rather than on a rail", () => {
    /* Four risks go on a rail because a 2×2 costs two rows and spends the second on the
       least urgent item. Three is the boundary: one row of three is still a set seen whole,
       with nothing behind a control. See the callout rule in ../compose.ts. */
    const attention = areas().find((node) => node.sectionId === "s.attention");
    const grid = attention?.children?.[0];
    expect(grid?.component).toBe("Grid");
    expect(grid?.props.columns).toBe(3);
    expect(grid?.children?.map((kid) => kid.component)).toEqual(["RiskAlert", "RiskAlert", "RiskAlert"]);
  });

  it("runs the funding calendar left to right, and the history downward", () => {
    /* Four short dated rows across read as a span of time; the same rows down spend the
       area on the empty right of every line. A history keeps its column either way, because
       its rows carry prose of unequal length — so the rule is gated on what the section is,
       not on how many rows it has. */
    const coming = areas().find((node) => node.sectionId === "s.coming");
    expect(coming?.children?.[0]?.component).toBe("Timeline");
    expect(coming?.children?.[0]?.props.direction).toBe("right");

    const changed = areas().find((node) => node.sectionId === "s.changed");
    expect(changed?.children?.[0]?.component).toBe("Timeline");
    expect(changed?.children?.[0]?.props.direction).toBeUndefined();
  });

  it("closes on the written outlook, by reference and not by copy", () => {
    const { spec } = composed();
    const last = spec.root[spec.root.length - 1];
    expect(last.component).toBe("Prose");
    expect(last.props.source).toBe("outlook");
    expect(JSON.stringify(spec.root)).not.toContain(ELEANOR_REPORT.outlook?.text);
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
    for (const figure of ["68.4", "11.0", "6.95", "2.95", "41.0", "26.0", "8.2", "5.1"]) {
      expect(serialised, figure).not.toContain(figure);
    }
    expect(serialised).not.toContain(ELEANOR_REPORT.summary);
  });

  it("lifts the figures the analysis marked primary, in document order", () => {
    expect(headlineFigures(ELEANOR_REPORT).map((figure) => figure.label)).toEqual([
      "Total portfolio value",
      "Cash & equivalents",
      "Upcoming commitments",
      "Total assets",
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

    for (const figure of ["S$68.4m", "S$6.95m"]) {
      expect(text, figure).toContain(figure);
      expect(drawn(figure), figure).toBe(1);
    }

    /*
     * And S$11.0m exactly twice, which is the one deliberate exception on this page.
     *
     * The rule the line above enforces is that a figure is not drawn as a figure in two
     * places, because a reader who meets the same number twice has to work out whether it
     * is the same number. The cash balance is the exception because the second appearance
     * is not a restatement: it is the first term of a subtraction — cash, less the
     * reserve, leaves what is available — and a derivation that starts from a figure the
     * reader has to remember from the top of the page is a derivation they cannot check.
     * Pinned at two rather than left unbounded, so a third appearance still fails.
     */
    expect(drawn("S$11.0m")).toBe(2);

    /* The funding gap and the stale marks: the two findings the analysis leads to. */
    expect(text).toContain("S$2.95m");
    expect(text).toContain("older than nine months");
    /* The estate, the schedule and the market context: the three bands only she has. */
    expect(text).toContain("Zinc Trustees (Singapore) Pte Ltd");
    expect(text).toContain("2041, or earlier at trustee discretion");
    expect(text).toContain("S$41.0m");
    expect(text).toContain("Singapore Shophouse, Tanjong Pagar");
    expect(text).toContain("5.1%");
    expect(text).toContain("Owner-occupied");
    expect(text).toMatch(/Kuala Lumpur office vacancy/i);

    /* And the dated calendar the funding question turns on. */
    for (const when of ["Q4 2026", "Q1 2027", "Q3 2027", "Q4 2027"]) {
      expect(text, when).toContain(when);
    }
  });
});
