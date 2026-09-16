/**
 * Tests for the selection layer — DESIGN.md §4.
 *
 * These assert the *rules table*, not the implementation: each case is one row
 * of the table in the design doc. If a rule changes deliberately, a test here
 * should change with it; if one breaks by accident, the report silently starts
 * drawing the wrong chart, which is exactly the failure that's hard to spot by
 * looking at a screen.
 *
 * The boundary cases are the point. 6 vs 7 entities and 8 vs 9 points are where
 * the layer earns its keep, so they're tested from both sides.
 */

import { describe, expect, it } from "vitest";
import { RENDERERS, selectRenderer } from "../select";
import type {
  ComparisonFinding,
  CompositionFinding,
  Finding,
  FindingMeta,
  MetricFinding,
  NarrativeFinding,
  Series,
  TrendFinding,
} from "../findings";

const meta = (overrides: Partial<FindingMeta> = {}): FindingMeta => ({
  id: "f1",
  emphasis: "secondary",
  confidence: 0.9,
  sources: ["Custody"],
  subject: "Portfolio",
  ...overrides,
});

const series = (count: number, name = "Value"): Series => ({
  name,
  points: Array.from({ length: count }, (_, i) => ({
    label: `P${i}`,
    value: i * 10,
  })),
});

const metric = (o: Partial<MetricFinding> = {}): MetricFinding => ({
  ...meta(),
  kind: "metric",
  label: "Total AUM",
  value: "S$25.4m",
  ...o,
});

const trend = (points: number, o: Partial<TrendFinding> = {}): TrendFinding => ({
  ...meta(),
  kind: "trend",
  label: "Portfolio value",
  series: series(points),
  ...o,
});

const comparison = (
  count: number,
  withSeries: boolean,
  o: Partial<ComparisonFinding> = {},
): ComparisonFinding => ({
  ...meta(),
  kind: "comparison",
  label: "Top holdings",
  measure: "Total return",
  entities: Array.from({ length: count }, (_, i) => ({
    name: `Holding ${i}`,
    value: i * 5,
    series: withSeries ? series(6, `Holding ${i}`) : undefined,
  })),
  ...o,
});

const composition = (parts: number): CompositionFinding => ({
  ...meta(),
  kind: "composition",
  label: "By asset class",
  parts: Array.from({ length: parts }, (_, i) => ({
    label: `Part ${i}`,
    value: 1 / parts,
  })),
});

/** Every selection in these tests is expected to succeed. */
function chosen(finding: Finding) {
  const trace = selectRenderer(finding);
  expect(trace, `nothing rendered ${finding.kind}`).not.toBeNull();
  return trace!;
}

describe("metric", () => {
  it("primary with a series is the hero, full width", () => {
    const trace = chosen(metric({ emphasis: "primary", series: series(8) }));
    expect(trace.rendererId).toBe("HeroMetric");
    expect(trace.span).toBe(12);
  });

  it("primary without a series is still the hero", () => {
    expect(chosen(metric({ emphasis: "primary" })).rendererId).toBe("HeroMetric");
  });

  it("secondary is a compact tile, and stays one even with a series", () => {
    // The rule is about emphasis, not about available data: a series must not
    // be able to promote a supporting metric into the headline.
    const trace = chosen(metric({ emphasis: "secondary", series: series(10) }));
    expect(trace.rendererId).toBe("StatTile");
    expect(trace.span).toBe(4);
  });
});

describe("trend", () => {
  it("8 points or fewer is a sparkline", () => {
    expect(chosen(trend(8)).rendererId).toBe("Sparkline");
  });

  it("9 points crosses over to a line chart", () => {
    expect(chosen(trend(9)).rendererId).toBe("LineChart");
  });

  it("a primary line chart takes the full width", () => {
    expect(chosen(trend(24, { emphasis: "primary" })).span).toBe(12);
  });

  it("a single point is not plottable, so no chart claims it", () => {
    // Falls to the text fallback rather than nothing: the finding is still a
    // claim worth stating, it just has no shape to draw.
    expect(selectRenderer(trend(1))?.rendererId).toBe("FallbackList");
  });
});

describe("comparison", () => {
  it("two entities with history is the dual line chart", () => {
    // The follow-up case in DESIGN.md §6 — the one this prototype exists for.
    const trace = chosen(comparison(2, true));
    expect(trace.rendererId).toBe("DualLineChart");
    expect(trace.span).toBe(12);
  });

  it("two entities without history is paired bars", () => {
    expect(chosen(comparison(2, false)).rendererId).toBe("PairedBars");
  });

  it("3 to 12 entities is a bar chart", () => {
    // Bars are stacked rows here, not columns on an axis, so a ranking of eight
    // holdings is still a chart. Tabling it would hand the reader the numbers and
    // make them do the comparing.
    for (const n of [3, 4, 6, 8, 12]) {
      expect(chosen(comparison(n, false)).rendererId, `${n} entities`).toBe(
        "BarChart",
      );
    }
  });

  it("takes the full width once the labels need the room", () => {
    expect(chosen(comparison(4, false)).span).toBe(6);
    expect(chosen(comparison(8, false)).span).toBe(12);
  });

  it("13 entities falls through to a table", () => {
    expect(chosen(comparison(13, false)).rendererId).toBe("DataTable");
  });

  it("more than six lines is unreadable, so history gives way to bars", () => {
    expect(chosen(comparison(8, true)).rendererId).toBe("BarChart");
  });

  it("a single entity is not a comparison", () => {
    // Must not fall through to a one-row DataTable: "nothing to compare" is a
    // different problem from "too many rows to chart".
    expect(selectRenderer(comparison(1, false))?.rendererId).toBe("FallbackList");
  });

  it("partial history does not qualify as a dual line chart", () => {
    // hasEntitySeries requires *every* entity to be plottable — half a chart is
    // worse than a correct pair of bars.
    const finding = comparison(2, true);
    finding.entities[1].series = undefined;
    expect(chosen(finding).rendererId).toBe("PairedBars");
  });
});

describe("composition", () => {
  it("6 parts or fewer is a donut", () => {
    expect(chosen(composition(6)).rendererId).toBe("DonutChart");
  });

  it("7 parts becomes a stacked bar", () => {
    expect(chosen(composition(7)).rendererId).toBe("StackedBar");
  });

  it("13 parts gives up on charting and tables it", () => {
    expect(chosen(composition(13)).rendererId).toBe("DataTable");
  });

  it("a single part is not a composition worth drawing", () => {
    expect(selectRenderer(composition(1))?.rendererId).toBe("FallbackList");
  });
});

describe("narrative", () => {
  const base: NarrativeFinding = {
    ...meta(),
    kind: "narrative",
    text: "Performance held up through the quarter.",
  };

  it("plain prose is a prose block", () => {
    expect(chosen(base).rendererId).toBe("ProseBlock");
  });

  it("deltas promote it to chips", () => {
    expect(
      chosen({
        ...base,
        deltas: [{ label: "+12.4%", value: 12.4, sentiment: "positive" }],
      }).rendererId,
    ).toBe("NarrativeWithChips");
  });

  it("an empty deltas array is not deltas", () => {
    expect(chosen({ ...base, deltas: [] }).rendererId).toBe("ProseBlock");
  });
});

describe("the trace", () => {
  it("explains itself and ranks the alternatives", () => {
    const trace = chosen(comparison(2, true));
    expect(trace.reason).toContain("Two entities with history");
    expect(trace.fit).toBe(1);
    // PairedBars and DataTable still apply, ranked below, with the text
    // fallback last — it accepts everything and always scores lowest.
    expect(trace.runnersUp.map((r) => r.rendererId)).toEqual([
      "PairedBars",
      "DataTable",
      "FallbackList",
    ]);
  });

  it("orders runners-up by descending fit", () => {
    const { runnersUp } = chosen(comparison(2, true));
    const fits = runnersUp.map((r) => r.fit);
    expect([...fits].sort((a, b) => b - a)).toEqual(fits);
  });
});

describe("the table as a whole", () => {
  it("has no duplicate renderer ids", () => {
    const ids = RENDERERS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every finding kind", () => {
    // The guard against adding a kind to findings.ts and forgetting a renderer,
    // which selectRenderer can only report as a null at runtime.
    const kinds: Finding["kind"][] = [
      "metric",
      "trend",
      "comparison",
      "composition",
      "transition",
      "requirement",
      "narrative",
      "recommendation",
      "flag",
    ];
    for (const kind of kinds) {
      expect(
        RENDERERS.some((r) => r.accepts.includes(kind)),
        `no renderer accepts "${kind}"`,
      ).toBe(true);
    }
  });

  it("only ever asks for spans the 12-column grid can place", () => {
    const findings: Finding[] = [
      metric({ emphasis: "primary" }),
      metric(),
      trend(5),
      trend(20),
      comparison(2, true),
      comparison(2, false),
      comparison(4, false),
      comparison(9, false),
      composition(3),
      composition(9),
      composition(20),
      { ...meta(), kind: "transition", subjectLabel: "Tech", from: "21%", to: "29%", sentiment: "negative" },
      { ...meta(), kind: "requirement", amount: "~S$3m", purpose: "Property" },
      { ...meta(), kind: "narrative", text: "x" },
      { ...meta(), kind: "recommendation", title: "Review", rationale: "y" },
      { ...meta(), kind: "flag", severity: "critical", subjectLabel: "Concentration", detail: "z" },
    ];
    for (const finding of findings) {
      const trace = chosen(finding);
      expect([4, 6, 8, 12], `${finding.kind} → ${trace.span}`).toContain(
        trace.span,
      );
    }
  });

  it("is deterministic", () => {
    const finding = comparison(5, false);
    const a = selectRenderer(finding);
    const b = selectRenderer(finding);
    expect(a).toEqual(b);
  });
});
