/**
 * Tests for the validator — the layer that is allowed to say no.
 *
 * Written as an adversarial set. Each case is a spec that a model plausibly could
 * produce and that must not reach a screen: an unknown component, eight figures in a
 * row, tabs with one item, a table over two records, twelve identical cards, the same
 * fact three times, an empty container, a tree twelve deep, and a figure smuggled
 * into a prop.
 *
 * The last one is the important one. "The UI composer must not change the underlying
 * facts" is the constraint the whole architecture is arranged around, and the only
 * version of it worth having is the one a test can fail.
 *
 * The good-path assertion comes first, because a validator that rejects everything
 * passes every adversarial test.
 */

import { describe, expect, it } from "vitest";
import { emptyBundle, type DataBundle } from "../data";
import { LIMITS, outcomeOf, validate } from "../validate";
import type { UINode, UISpec } from "../spec";
import { COMPARE_BUNDLE, COMPARE_SPEC, REVIEW_BUNDLE, REVIEW_SPEC } from "../examples";

const codesOf = (spec: unknown, bundle: DataBundle) =>
  validate(spec, bundle).issues.map((issue) => issue.code);

/** A minimal valid spec, so each adversarial case differs in exactly one way. */
const base = (root: UINode[], narrative = "The portfolio returned 6.2% over the quarter."): UISpec => ({
  id: "view.test",
  recipe: "AnalyticalReport",
  narrative,
  meta: { reportId: "report.test", trace: [], unplacedSectionIds: [] },
  root: [{ id: "n.header", component: "PageHeader", props: {} }, ...root],
});

const bundleWith = (values: Record<string, unknown>): DataBundle => ({
  values,
  provenance: {},
  failed: [],
});

describe("the good path", () => {
  it("accepts both worked examples", () => {
    for (const [spec, bundle] of [
      [REVIEW_SPEC, REVIEW_BUNDLE],
      [COMPARE_SPEC, COMPARE_BUNDLE],
    ] as const) {
      const result = validate(spec, bundle);
      expect(result.issues, spec.id).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });

  it("tells the caller to render a clean spec", () => {
    expect(outcomeOf(validate(REVIEW_SPEC, REVIEW_BUNDLE), false)).toBe("render");
  });
});

describe("structural rejection", () => {
  it("rejects a spec that is not a spec", () => {
    expect(codesOf({ id: "x" }, emptyBundle())).toEqual(["schema_invalid"]);
  });

  it("rejects a component that is not in the registry", () => {
    // The unknown-component case from §14. It fails here rather than at render.
    const spec = { ...base([]), root: [{ id: "n.1", component: "FancyChart", props: {} }] };
    expect(codesOf(spec, emptyBundle())).toContain("schema_invalid");
  });

  it("rejects a prop the component does not have", () => {
    const spec = base([
      { id: "n.1", component: "Section", props: { heading: "Risk", tone: "playful" }, children: [
        { id: "n.2", component: "InsightCard", props: {}, dataKey: "a.b" },
      ] },
    ]);
    expect(codesOf(spec, bundleWith({ "a.b": { text: "x" } }))).toContain("unknown_prop");
  });

  it("rejects a variant the component does not come in", () => {
    const spec = base([
      { id: "n.1", component: "Metric", props: { label: "Return", variant: "glossy" }, dataKey: "a.b" },
    ]);
    expect(codesOf(spec, bundleWith({ "a.b": 1 }))).toContain("invalid_props");
  });

  it("rejects illegal nesting", () => {
    const spec = base([
      { id: "n.1", component: "Grid", props: { columns: 2 }, children: [
        { id: "n.2", component: "Section", props: { heading: "Nested" }, children: [
          { id: "n.3", component: "InsightCard", props: {}, dataKey: "a.b" },
        ] },
        { id: "n.4", component: "InsightCard", props: {}, dataKey: "a.b" },
      ] },
    ]);
    expect(codesOf(spec, bundleWith({ "a.b": { text: "x" } }))).toContain("illegal_nesting");
  });

  it("rejects a flat child list on a container that takes named regions", () => {
    const spec = base([
      { id: "n.1", component: "Tabs", props: { label: "Attribution" }, children: [
        { id: "n.2", component: "RankedList", props: { label: "Top" }, dataKey: "a.b" },
        { id: "n.3", component: "RankedList", props: { label: "Bottom" }, dataKey: "a.b" },
      ] },
    ]);
    expect(codesOf(spec, bundleWith({ "a.b": [1, 2, 3] }))).toContain("wrong_slot_shape");
  });

  it("rejects a tree deeper than the limit", () => {
    let node: UINode = { id: "leaf", component: "InsightCard", props: {}, dataKey: "a.b" };
    for (let level = 0; level < LIMITS.maxDepth + 2; level += 1) {
      node = { id: `wrap.${level}`, component: "Section", props: { heading: `L${level}` }, children: [node] };
    }
    expect(codesOf(base([node]), bundleWith({ "a.b": { text: "x" } }))).toContain("depth_exceeded");
  });

  it("rejects a duplicate node id", () => {
    const spec = base([
      { id: "n.dup", component: "InsightCard", props: {}, dataKey: "a.b" },
      { id: "n.dup", component: "InsightCard", props: {}, dataKey: "a.b" },
    ]);
    expect(codesOf(spec, bundleWith({ "a.b": { text: "x" } }))).toContain("duplicate_node_id");
  });

  it("rejects a component that needs data and has none", () => {
    expect(codesOf(base([{ id: "n.1", component: "LineChart", props: { label: "Value" } }]), emptyBundle())).toContain(
      "missing_data_binding",
    );
  });

  it("rejects a binding to a key that never arrived", () => {
    const spec = base([{ id: "n.1", component: "LineChart", props: { label: "Value" }, dataKey: "perf.ghost" }]);
    expect(codesOf(spec, bundleWith({ "perf.real": [1, 2] }))).toContain("unknown_data_key");
  });

  it("rejects an empty container", () => {
    const spec = base([{ id: "n.1", component: "Section", props: { heading: "Nothing here" }, children: [] }]);
    expect(codesOf(spec, emptyBundle())).toContain("empty_container");
  });
});

describe("figures may not appear in props — the §9 guarantee", () => {
  const bundle = bundleWith({ "a.b": { text: "x" } });

  it.each([
    ["currency", "Cash of S$1.8m"],
    ["percentage", "Up 6.2% on the quarter"],
    ["basis points", "210 bps ahead"],
    ["grouped thousands", "Raised 3,000,000 in September"],
    ["a decimal", "Ratio of 1.4 against the guideline"],
  ])("rejects a %s restated in a heading", (_name, heading) => {
    const spec = base([{ id: "n.1", component: "InsightCard", props: { heading }, dataKey: "a.b" }]);
    expect(codesOf(spec, bundle)).toContain("literal_in_props");
  });

  it.each([
    ["a period label", "Q3 2026"],
    ["a count in a title", "Top 10 holdings"],
    ["a horizon", "1M return"],
  ])("allows %s, which is a label rather than a value", (_name, heading) => {
    // Deliberately not "contains a digit": a rule that rejects "Q3 2026" is a rule
    // the next person deletes.
    const spec = base([{ id: "n.1", component: "InsightCard", props: { heading }, dataKey: "a.b" }]);
    expect(codesOf(spec, bundle)).not.toContain("literal_in_props");
  });

  it("looks inside array props too", () => {
    const spec = base([
      {
        id: "n.1",
        component: "Comparison",
        props: { entities: ["Facility", "Sale"], measures: ["Cost of S$138k"] },
        dataKey: "a.b",
      },
    ]);
    expect(codesOf(spec, bundle)).toContain("literal_in_props");
  });
});

describe("UX heuristics", () => {
  it("rejects eight figures in one row", () => {
    const metrics = Array.from({ length: 8 }, (_, index) => ({
      id: `n.m${index}`,
      component: "Metric" as const,
      props: { label: `Measure ${index}` },
      dataKey: "a.b",
    }));
    const spec = base([{ id: "n.grid", component: "Grid", props: { columns: 4 }, children: metrics }]);
    const result = validate(spec, bundleWith({ "a.b": 1 }));
    expect(result.issues.map((issue) => issue.code)).toContain("too_many_metrics_in_row");
    expect(result.ok).toBe(false);
  });

  it("rejects a metric strip over nine figures, where the row is one node", () => {
    const spec = base([{ id: "n.strip", component: "MetricStrip", props: { columns: 4 }, dataKey: "kpi.all" }]);
    const codes = codesOf(spec, bundleWith({ "kpi.all": Array.from({ length: 9 }, (_, i) => i) }));
    expect(codes).toContain("too_many_metrics_in_row");
  });

  it("rejects tabs with one item", () => {
    const spec = base([
      {
        id: "n.tabs",
        component: "Tabs",
        props: { label: "Attribution" },
        slots: { Contributors: [{ id: "n.only", component: "RankedList", props: { label: "Top" }, dataKey: "a.b" }] },
      },
    ]);
    expect(codesOf(spec, bundleWith({ "a.b": [1, 2, 3] }))).toContain("degenerate_tabs");
  });

  it("warns about a table over two records", () => {
    const spec = base([{ id: "n.t", component: "DataTable", props: { label: "Options" }, dataKey: "opt.two" }]);
    const result = validate(spec, bundleWith({ "opt.two": [1, 2] }));
    expect(result.issues.map((issue) => issue.code)).toContain("table_too_small");
    // A warning, not an error: it is bad design, not a broken page.
    expect(result.ok).toBe(true);
  });

  it("rejects twelve identical cards", () => {
    const cards = Array.from({ length: 12 }, (_, index) => ({
      id: `n.h${index}`,
      component: "HoldingCard" as const,
      props: { showWeight: true },
      dataKey: "hold.all",
    }));
    const spec = base([{ id: "n.stack", component: "Stack", props: {}, children: cards }]);
    const codes = codesOf(spec, bundleWith({ "hold.all": [1] }));
    expect(codes).toContain("identical_siblings");
  });

  it("offers a table as the repair for both card failures", () => {
    const cards = Array.from({ length: 6 }, (_, index) => ({
      id: `n.h${index}`,
      component: "HoldingCard" as const,
      props: {},
      dataKey: "hold.all",
    }));
    const spec = base([{ id: "n.stack", component: "Stack", props: {}, children: cards }]);
    const result = validate(spec, bundleWith({ "hold.all": [1] }));
    expect(result.repairs).toEqual(
      expect.arrayContaining([{ op: "setComponent", nodeId: "n.stack", component: "DataTable" }]),
    );
  });

  it("warns when one fact is rendered three times", () => {
    const spec = base([
      { id: "n.1", component: "Metric", props: { label: "Return" }, dataKey: "perf.total" },
      { id: "n.2", component: "LineChart", props: { label: "Return" }, dataKey: "perf.total" },
      { id: "n.3", component: "InsightCard", props: { heading: "Return" }, dataKey: "perf.total" },
    ]);
    expect(codesOf(spec, bundleWith({ "perf.total": 1 }))).toContain("duplicate_content");
  });

  it("allows the same fact twice — a headline and its chart", () => {
    const spec = base([
      { id: "n.1", component: "Metric", props: { label: "Return" }, dataKey: "perf.total" },
      { id: "n.2", component: "LineChart", props: { label: "Return" }, dataKey: "perf.total" },
    ]);
    expect(codesOf(spec, bundleWith({ "perf.total": 1 }))).not.toContain("duplicate_content");
  });

  it("warns about competing headlines", () => {
    const spec = base([
      { id: "n.1", component: "Metric", props: { label: "Return", variant: "hero" }, dataKey: "a.b" },
      { id: "n.2", component: "InsightCard", props: { variant: "hero" }, dataKey: "a.b" },
    ]);
    expect(codesOf(spec, bundleWith({ "a.b": 1 }))).toContain("competing_headlines");
  });

  it("warns when a long page has no headline at all", () => {
    const nodes = Array.from({ length: 8 }, (_, index) => ({
      id: `n.${index}`,
      component: "InsightCard" as const,
      props: { heading: `Point ${index}` },
      dataKey: "a.b",
    }));
    expect(codesOf(base(nodes), bundleWith({ "a.b": 1 }))).toContain("no_headline");
  });

  it("does not ask a short page for a headline", () => {
    const spec = base([{ id: "n.1", component: "InsightCard", props: {}, dataKey: "a.b" }]);
    expect(codesOf(spec, bundleWith({ "a.b": 1 }))).not.toContain("no_headline");
  });

  it("rejects a second page header", () => {
    const spec = base([{ id: "n.h2", component: "PageHeader", props: { eyebrow: "Also" } }]);
    const result = validate(spec, emptyBundle());
    expect(result.issues.map((issue) => issue.code)).toContain("missing_page_header");
    expect(result.ok).toBe(false);
  });

  it("rejects a page over the node budget", () => {
    const nodes = Array.from({ length: LIMITS.maxNodes + 5 }, (_, index) => ({
      id: `n.${index}`,
      component: "InsightCard" as const,
      props: {},
      dataKey: "a.b",
    }));
    expect(codesOf(base(nodes), bundleWith({ "a.b": 1 }))).toContain("node_budget_exceeded");
  });
});

describe("the fallback contract", () => {
  const broken = base([{ id: "n.1", component: "LineChart", props: { label: "Value" }, dataKey: "gone" }]);

  it("offers one repair pass when there is a repair to offer", () => {
    const cards = Array.from({ length: 6 }, (_, index) => ({
      id: `n.h${index}`,
      component: "HoldingCard" as const,
      props: {},
      dataKey: "a.b",
    }));
    const result = validate(base([{ id: "n.s", component: "Stack", props: {}, children: cards }]), bundleWith({ "a.b": [1] }));
    expect(outcomeOf(result, false)).toBe("repair");
    // One pass, not a loop. A validator that keeps asking eventually accepts
    // something bad because it ran out of patience.
    expect(outcomeOf(result, true)).toBe("fallback");
  });

  it("falls back immediately when no repair could help", () => {
    const result = validate(broken, emptyBundle());
    expect(result.repairs).toEqual([]);
    expect(outcomeOf(result, false)).toBe("fallback");
  });

  it("keeps the narrative available on the spec that failed", () => {
    // §14: rich UI is an enhancement, never the source of truth.
    expect(broken.narrative.length).toBeGreaterThan(0);
    expect(validate(broken, emptyBundle()).ok).toBe(false);
  });
});
