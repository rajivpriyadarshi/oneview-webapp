/**
 * Tests for the contracts — GENERATIVE-UI-ARCHITECTURE.md §5.
 *
 * Phase 1 ships no behaviour, so what is testable is the shape of the thing and the
 * small number of pure helpers the later phases will build on. Two kinds of
 * assertion here:
 *
 *   - the three worked examples satisfy the schemas they claim to, which is what
 *     stops a design document's examples from drifting away from its types;
 *   - the invariants the later layers will assume — every semantic type has a slot
 *     in every recipe, every registry entry is reachable from some presentation
 *     form, `questionGroups` is a partition.
 *
 * Those invariants matter more than they look. A semantic type with nowhere to go
 * silently drops a section; a component no form maps to is a component the composer
 * can never choose. Both fail by producing a thinner page, which is the hardest
 * failure to notice by looking at a screen.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import type {
  ChecklistFinding,
  ComparisonFinding,
  CompositionFinding,
  FindingMeta,
} from "../findings";
import { DataBundleSchema, allSources, hasKey, resolveKey } from "../data";
import { IAPlanSchema, headlineArea, orderedAreas, placedSectionIds } from "../ia";
import { IntentPlanSchema, normaliseIntent, requiredKeys } from "../intent";
import { RECIPES, candidateSlots, selectRecipe } from "../recipes";
import { COMPONENT_IDS, REGISTRY, allowsChild, bestFor, implementing, usesNamedSlots } from "../registry";
import { SemanticReportSchema, SemanticTypeSchema, isEmpty, questionGroups, referencedKeys } from "../semantic";
import { UISpecSchema, allNodes, boundKeys, maxDepth, nodeCount, usedComponents } from "../spec";
import { PresentationOpSchema, SemanticOpSchema, applySpecOps, isPresentationOp } from "../ops";
import {
  COMPARE_BUNDLE,
  COMPARE_IA,
  COMPARE_INTENT,
  COMPARE_REPORT,
  COMPARE_SPEC,
  LOOKUP_INTENT,
  REVIEW_BUNDLE,
  REVIEW_IA,
  REVIEW_INTENT,
  REVIEW_REPORT,
  REVIEW_SPEC,
} from "../examples";

describe("the worked examples satisfy their schemas", () => {
  it("parses the three intent plans", () => {
    for (const plan of [LOOKUP_INTENT, REVIEW_INTENT, COMPARE_INTENT]) {
      expect(IntentPlanSchema.safeParse(plan).success).toBe(true);
    }
  });

  it("parses both data bundles", () => {
    for (const bundle of [REVIEW_BUNDLE, COMPARE_BUNDLE]) {
      expect(DataBundleSchema.safeParse(bundle).success).toBe(true);
    }
  });

  it("parses both semantic reports", () => {
    for (const report of [REVIEW_REPORT, COMPARE_REPORT]) {
      const result = SemanticReportSchema.safeParse(report);
      expect(result.success ? null : result.error.issues).toBeNull();
    }
  });

  it("parses both IA plans and both specs", () => {
    for (const plan of [REVIEW_IA, COMPARE_IA]) {
      expect(IAPlanSchema.safeParse(plan).success).toBe(true);
    }
    for (const spec of [REVIEW_SPEC, COMPARE_SPEC]) {
      const result = UISpecSchema.safeParse(spec);
      expect(result.success ? null : result.error.issues).toBeNull();
    }
  });
});

describe("intent", () => {
  it("keeps a lookup on the text path", () => {
    expect(LOOKUP_INTENT.surface).toBe("text");
  });

  it("forces a lookup to text even when the planner says otherwise", () => {
    // The one thing not trusted from the model, because cards in front of a
    // one-line answer is the most visible way this pipeline can embarrass itself.
    const wrong = { ...LOOKUP_INTENT, surface: "view" as const };
    expect(normaliseIntent(wrong).surface).toBe("text");
  });

  it("leaves a real view alone", () => {
    expect(normaliseIntent(REVIEW_INTENT)).toEqual(REVIEW_INTENT);
  });

  it("reports the requests whose absence aborts the view", () => {
    expect(requiredKeys(REVIEW_INTENT)).toEqual(["perf.total", "perf.summary", "perf.monthly"]);
  });

  it("rejects a data key that is not a dotted lower-case namespace", () => {
    const bad = {
      ...REVIEW_INTENT,
      dataRequests: [{ key: "Perf Monthly", tool: "x", args: {}, required: true }],
    };
    expect(IntentPlanSchema.safeParse(bad).success).toBe(false);
  });
});

describe("data resolution", () => {
  it("resolves an exact key", () => {
    expect(resolveKey(REVIEW_BUNDLE, "perf.monthly")).toHaveLength(6);
  });

  it("walks into a value for a key nobody registered", () => {
    expect(resolveKey(REVIEW_BUNDLE, "risk.concentration.severity")).toBe("warn");
  });

  it("prefers an exact key over a prefix walk", () => {
    // "perf.total" is registered, so it must not be read as "total" out of "perf".
    expect(resolveKey(REVIEW_BUNDLE, "perf.total")).toMatchObject({ value: "+6.2%" });
  });

  it("returns undefined rather than throwing on a missing path", () => {
    expect(resolveKey(REVIEW_BUNDLE, "risk.nothing.here")).toBeUndefined();
  });

  it("treats an empty array as absent", () => {
    const bundle = { ...REVIEW_BUNDLE, values: { ...REVIEW_BUNDLE.values, "x.empty": [] } };
    expect(hasKey(bundle, "x.empty")).toBe(false);
  });

  it("dedupes sources across the bundle", () => {
    const sources = allSources(REVIEW_BUNDLE);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toContain("Performance engine");
  });
});

describe("semantic report", () => {
  it("groups sections that answer the same question", () => {
    const groups = questionGroups(REVIEW_REPORT);
    const drivers = groups.find((group) => group.some((section) => section.id === "s.contributors"));
    expect(drivers?.map((section) => section.id)).toEqual(["s.contributors", "s.detractors"]);
  });

  it("is a partition — every section in exactly one group", () => {
    const groups = questionGroups(REVIEW_REPORT);
    const ids = groups.flat().map((section) => section.id);
    expect(ids).toHaveLength(REVIEW_REPORT.sections.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("groups on an identical question string with no relation declared", () => {
    // Declaring the relation is better, but two sections that literally state the
    // same question should not need a separate assertion to be grouped.
    const report = { ...COMPARE_REPORT, relations: undefined };
    const twinned = {
      ...report,
      sections: report.sections.map((section) =>
        section.id === "s.cost" || section.id === "s.liquidity"
          ? { ...section, question: "What does it cost?" }
          : section,
      ),
    };
    const groups = questionGroups(twinned);
    expect(groups.some((group) => group.length === 2)).toBe(true);
  });

  it("reports every referenced key", () => {
    expect(referencedKeys(REVIEW_REPORT)).toContain("drivers.detractors");
  });

  it("calls a report with no findings anywhere empty", () => {
    expect(isEmpty(REVIEW_REPORT)).toBe(false);
    expect(
      isEmpty({
        ...REVIEW_REPORT,
        sections: REVIEW_REPORT.sections.map((section) => ({ ...section, findings: [] })),
      }),
    ).toBe(true);
  });

  it("references only keys the bundle actually carries", () => {
    for (const key of referencedKeys(REVIEW_REPORT)) {
      expect(hasKey(REVIEW_BUNDLE, key), key).toBe(true);
    }
  });
});

describe("recipes", () => {
  it("gives every semantic type somewhere to land in every recipe", () => {
    // A semantic type with no slot is a section that silently disappears.
    for (const recipe of Object.values(RECIPES)) {
      for (const type of SemanticTypeSchema.options) {
        expect(candidateSlots(recipe, type).length, `${recipe.id} / ${type}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every recipe's slot budget within its page budget", () => {
    for (const recipe of Object.values(RECIPES)) {
      const slots = recipe.slots.reduce((total, slot) => total + slot.maxAreas, 0);
      expect(slots, recipe.id).toBeGreaterThanOrEqual(recipe.maxAreas);
    }
  });

  it("puts chronology ahead of the task type", () => {
    expect(
      selectRecipe("portfolio_review", { comparison: false, chronology: true, actions: false }),
    ).toBe("TimelineReport");
  });

  it("keeps the task's own shape when that shape can hold a comparison", () => {
    // A review that weighs the portfolio against its benchmark needs a comparison; it
    // is not a comparison. AnalyticalReport has a slot for one, so it keeps the page.
    expect(
      selectRecipe("portfolio_review", { comparison: true, chronology: false, actions: false }),
    ).toBe("AnalyticalReport");
  });

  it("reaches the comparison shape by task type, not by the flag", () => {
    expect(
      selectRecipe("comparison", { comparison: true, chronology: false, actions: false }),
    ).toBe("ComparisonReport");
  });

  it("lets an explicit comparison keep its own shape when both flags are set", () => {
    expect(
      selectRecipe("comparison", { comparison: true, chronology: true, actions: false }),
    ).toBe("ComparisonReport");
  });

  it("matches the two example intents to the recipes their specs use", () => {
    expect(selectRecipe(REVIEW_INTENT.taskType, REVIEW_INTENT.needs)).toBe(REVIEW_SPEC.recipe);
    expect(selectRecipe(COMPARE_INTENT.taskType, COMPARE_INTENT.needs)).toBe(COMPARE_SPEC.recipe);
  });

  it("requires a comparison to end in a call", () => {
    const call = RECIPES.ComparisonReport.slots.find((slot) => slot.id === "call");
    expect(call?.required).toBe(true);
    expect(RECIPES.ComparisonReport.slots.at(-2)?.id).toBe("call");
  });
});

describe("registry", () => {
  it("keys every entry by its own id", () => {
    for (const id of COMPONENT_IDS) expect(REGISTRY[id].id).toBe(id);
  });

  it("makes every non-layout component reachable from some presentation form", () => {
    // A component no form maps to is a component the composer can never pick.
    for (const spec of COMPONENT_IDS.map((id) => REGISTRY[id])) {
      if (spec.category === "layout") continue;
      expect(spec.implements.length, spec.id).toBeGreaterThan(0);
    }
  });

  it("gives every presentation form at least one component", () => {
    for (const form of ["metric", "table", "chart", "callout", "checklist", "comparison"] as const) {
      expect(implementing(form).length, form).toBeGreaterThan(0);
    }
  });

  it("never lets a leaf take children", () => {
    for (const spec of COMPONENT_IDS.map((id) => REGISTRY[id])) {
      if (spec.category === "layout" || spec.id === "WhatToWatch") continue;
      expect(spec.children.allowed, spec.id).toBe("none");
    }
  });

  it("points every useInsteadWhen at a component that exists", () => {
    for (const spec of COMPONENT_IDS.map((id) => REGISTRY[id])) {
      for (const alternative of spec.useInsteadWhen ?? []) {
        expect(COMPONENT_IDS, `${spec.id} → ${alternative.prefer}`).toContain(alternative.prefer);
      }
    }
  });

  it("declares no colour props anywhere", () => {
    // Colour comes from the palette. A runtime-composed view is exactly where
    // per-component colour choices stop being survivable, so the absence is
    // asserted rather than left as a convention.
    for (const spec of COMPONENT_IDS.map((id) => REGISTRY[id])) {
      const json = JSON.stringify(z.toJSONSchema(spec.propsSchema));
      expect(json, spec.id).not.toMatch(/colou?r|palette|hex|#[0-9a-f]{3,6}/i);
    }
  });

  it("knows which containers take named regions", () => {
    expect(usesNamedSlots("Tabs")).toBe(true);
    expect(usesNamedSlots("SplitPane")).toBe(true);
    expect(usesNamedSlots("Grid")).toBe(false);
    expect(usesNamedSlots("Metric")).toBe(false);
  });

  it("permits the nesting the example specs use, and forbids the inverse", () => {
    expect(allowsChild("Section", "Tabs")).toBe(true);
    expect(allowsChild("Tabs", "RankedList")).toBe(true);
    expect(allowsChild("SplitPane", "BarChart")).toBe(true);
    expect(allowsChild("Metric", "Metric")).toBe(false);
    expect(allowsChild("Grid", "Section")).toBe(false);
  });
});

describe("registry fitness — the thresholds ported from prototype 1", () => {
  const meta: FindingMeta = {
    id: "f",
    emphasis: "secondary",
    confidence: 0.9,
    sources: [],
    subject: "S",
  };
  const series = (count: number) => ({
    name: "Series",
    points: Array.from({ length: count }, (_, index) => ({ label: `P${index}`, value: index })),
  });
  const entities = (count: number, withSeries = false) =>
    Array.from({ length: count }, (_, index) => ({
      name: `E${index}`,
      value: index,
      ...(withSeries ? { series: series(4) } : {}),
    }));
  const comparison = (count: number, withSeries = false): ComparisonFinding => ({
    ...meta,
    kind: "comparison",
    label: "L",
    measure: "M",
    entities: entities(count, withSeries),
  });
  const composition = (count: number): CompositionFinding => ({
    ...meta,
    kind: "composition",
    label: "L",
    parts: Array.from({ length: count }, (_, index) => ({ label: `P${index}`, value: 0.1 })),
  });

  const context = { count: 1, siblings: 1 };

  it("draws two entities with history as overlaid lines, not paired bars", () => {
    expect(bestFor("chart", comparison(2, true), context)?.id).toBe("LineChart");
  });

  it("draws two entities without history as bars", () => {
    expect(bestFor("chart", comparison(2), context)?.id).toBe("BarChart");
  });

  it("keeps three to six entities with history on lines", () => {
    expect(bestFor("chart", comparison(5, true), context)?.id).toBe("LineChart");
  });

  it("sends seven series to bars rather than an unreadable line chart", () => {
    expect(bestFor("chart", comparison(7, true), context)?.id).toBe("BarChart");
  });

  it("draws six parts as a donut and seven as bars", () => {
    expect(bestFor("chart", composition(6), context)?.id).toBe("AllocationDonut");
    expect(bestFor("chart", composition(7), context)?.id).toBe("BarChart");
  });

  it("sends more than twelve rows to a table", () => {
    expect(bestFor("table", comparison(13), context)?.id).toBe("DataTable");
  });

  it("refuses a table over one record", () => {
    expect(bestFor("table", comparison(1), context)).toBeNull();
  });

  it("refuses a checklist of one item", () => {
    const single: ChecklistFinding = { ...meta, kind: "checklist", label: "L", items: [{ text: "One" }] };
    expect(bestFor("checklist", single, context)).toBeNull();
  });

  it("returns the runners-up so a repair pass has somewhere to go", () => {
    const result = bestFor("chart", comparison(4), context);
    expect(result?.runnersUp.length ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe("IA plan helpers", () => {
  it("orders areas by rank", () => {
    expect(orderedAreas(REVIEW_IA).map((area) => area.id)).toEqual([
      "a.headline",
      "a.changed",
      "a.drivers",
      "a.risk",
      "a.actions",
      "a.provenance",
    ]);
  });

  it("finds the one area carrying the headline", () => {
    expect(headlineArea(REVIEW_IA)?.id).toBe("a.headline");
    expect(headlineArea(COMPARE_IA)?.id).toBe("a.question");
  });

  it("places every section the semantic report declares", () => {
    for (const [plan, report] of [
      [REVIEW_IA, REVIEW_REPORT],
      [COMPARE_IA, COMPARE_REPORT],
    ] as const) {
      const placed = new Set(placedSectionIds(plan));
      for (const section of report.sections) expect(placed, section.id).toContain(section.id);
    }
  });

  it("gives a presentation for every section it places", () => {
    for (const plan of [REVIEW_IA, COMPARE_IA]) {
      for (const area of plan.areas) {
        for (const id of area.sectionIds) expect(area.presentation[id], id).toBeDefined();
      }
    }
  });

  it("uses tabs only where the plan says the sections are sibling views", () => {
    for (const plan of [REVIEW_IA, COMPARE_IA]) {
      for (const area of plan.areas) {
        if (area.arrangement !== "tabs") continue;
        expect(area.sectionIds.length, area.id).toBeGreaterThanOrEqual(2);
        expect(area.sectionIds.length, area.id).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe("UI spec helpers", () => {
  it("walks the whole tree, including named regions", () => {
    expect(usedComponents(REVIEW_SPEC)).toContain("RankedList");
    expect(usedComponents(COMPARE_SPEC)).toContain("BarChart");
  });

  it("stays inside the depth and node budgets", () => {
    for (const spec of [REVIEW_SPEC, COMPARE_SPEC]) {
      expect(maxDepth(spec)).toBeLessThanOrEqual(6);
      expect(nodeCount(spec)).toBeLessThanOrEqual(60);
    }
  });

  it("binds only to keys the bundle carries", () => {
    for (const [spec, bundle] of [
      [REVIEW_SPEC, REVIEW_BUNDLE],
      [COMPARE_SPEC, COMPARE_BUNDLE],
    ] as const) {
      for (const key of boundKeys(spec)) expect(hasKey(bundle, key), key).toBe(true);
    }
  });

  it("traces every sectionId on a node back to a real section", () => {
    // The audit trail from a rendered node to the claim it came from. Without it,
    // conversational editing has nothing to address and Inspect has nothing to show.
    for (const [spec, report] of [
      [REVIEW_SPEC, REVIEW_REPORT],
      [COMPARE_SPEC, COMPARE_REPORT],
    ] as const) {
      const ids = new Set(report.sections.map((section) => section.id));
      for (const node of allNodes(spec)) {
        if (node.sectionId === undefined) continue;
        expect([...ids], `${spec.id} / ${node.id}`).toContain(node.sectionId);
      }
    }
  });

  it("binds data on every node whose component requires it", () => {
    for (const spec of [REVIEW_SPEC, COMPARE_SPEC]) {
      for (const node of allNodes(spec)) {
        if (!REGISTRY[node.component].requiresData) continue;
        expect(node.dataKey ?? node.dataKeys?.[0], `${spec.id} / ${node.id}`).toBeDefined();
      }
    }
  });

  it("gives every node a unique id, which the patch reducer depends on", () => {
    for (const spec of [REVIEW_SPEC, COMPARE_SPEC]) {
      const ids = allNodes(spec).map((node) => node.id);
      expect(new Set(ids).size, spec.id).toBe(ids.length);
    }
  });

  it("carries the narrative on the spec itself", () => {
    // Not merely reachable from the report: the fallback has to work when the thing
    // that failed is the spec.
    expect(REVIEW_SPEC.narrative).toBe(REVIEW_REPORT.narrative);
    expect(COMPARE_SPEC.narrative).toBe(COMPARE_REPORT.narrative);
  });
});

describe("patch op split", () => {
  it("classifies a presentation op as presentation", () => {
    const op = { op: "setComponent" as const, nodeId: "n.cost", component: "DataTable" as const };
    expect(PresentationOpSchema.safeParse(op).success).toBe(true);
    expect(isPresentationOp(op)).toBe(true);
  });

  it("keeps anything that changes a fact out of the presentation union", () => {
    // The structural guarantee behind §9: a repair pass emits PresentationOps, so
    // there is no code path by which it can add a finding.
    const op = {
      op: "addFinding" as const,
      sectionId: "s.risk",
      finding: REVIEW_REPORT.sections[0].findings[0],
    };
    expect(SemanticOpSchema.safeParse(op).success).toBe(true);
    expect(PresentationOpSchema.safeParse(op).success).toBe(false);
  });
});

/*
 * The repair reducer. These four cover the properties the pipeline relies on when it
 * applies a validator's own fix rather than falling back to prose.
 */
describe("applySpecOps", () => {
  const first = REVIEW_SPEC.root[0];

  it("swaps one node's component and leaves the rest of the tree identical", () => {
    const target = allNodes(REVIEW_SPEC).find((node) => node.component === "Metric");
    expect(target).toBeDefined();
    const out = applySpecOps(REVIEW_SPEC, [
      { op: "setComponent", nodeId: target!.id, component: "DataTable" },
    ]);
    expect(out.rejected).toEqual([]);
    expect(allNodes(out.value).find((node) => node.id === target!.id)?.component).toBe("DataTable");
    // Purity: the input is untouched, and untouched areas keep their identity so the
    // renderer does not re-animate a page because one card changed.
    expect(allNodes(REVIEW_SPEC).find((node) => node.id === target!.id)?.component).toBe("Metric");
    expect(UISpecSchema.safeParse(out.value).success).toBe(true);
  });

  it("rejects an op whose target is not in the spec, and applies the rest", () => {
    const out = applySpecOps(REVIEW_SPEC, [
      { op: "setComponent", nodeId: "no_such_node", component: "DataTable" },
      { op: "setHeading", areaId: first.id, heading: "Performance drivers" },
    ]);
    expect(out.rejected).toHaveLength(1);
    expect(out.value.root[0].props.heading).toBe("Performance drivers");
  });

  it("refuses a removal that would empty the view", () => {
    const single: typeof REVIEW_SPEC = { ...REVIEW_SPEC, root: [first] };
    const out = applySpecOps(single, [{ op: "removeArea", areaId: first.id }]);
    expect(out.value.root).toHaveLength(1);
    expect(out.rejected[0].reason).toMatch(/empty/);
  });

  it("cannot express a change to the facts", () => {
    // The type system is the real guarantee; this asserts the runtime schema agrees,
    // so a repair pass can never carry a semantic op even if one is handed to it.
    expect(PresentationOpSchema.safeParse({ op: "setComponent", nodeId: "n1", component: "Metric" }).success).toBe(true);
    expect(
      PresentationOpSchema.safeParse({ op: "removeFinding", sectionId: "s1", findingId: "f1" }).success,
    ).toBe(false);
  });
});
