/**
 * The document layer: prose in the flow, and the promise that putting it there did not
 * cost the §9 guarantee.
 *
 * The risk this file exists to pin down is specific. Text is the one kind of content
 * where "reference it, don't copy it" is easy to get wrong, because a string in a prop
 * looks harmless in a way a number does not — `literal_in_props` is tuned to catch
 * figures. So a composer that started writing `props.text = report.summary` would pass
 * every existing test while quietly making the spec a place where the answer can be
 * altered. These assertions say: the summary node references, never carries.
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { composeView } from "../compose";
import { SpecRenderer } from "../SpecRenderer";
import {
  COMPARE_BUNDLE,
  COMPARE_INTENT,
  COMPARE_REPORT,
  REVIEW_BUNDLE,
  REVIEW_INTENT,
  REVIEW_REPORT,
} from "../examples";
import { measureGroup, type ComparisonFinding, type Emphasis, type Finding } from "../findings";
import { REGISTRY } from "../registry";
import { headlineFigures, type SemanticReport } from "../semantic";
import type { UINode } from "../spec";
import { validate } from "../validate";

const CASES = [
  { name: "analytical review", report: REVIEW_REPORT, intent: REVIEW_INTENT, bundle: REVIEW_BUNDLE },
  { name: "comparison", report: COMPARE_REPORT, intent: COMPARE_INTENT, bundle: COMPARE_BUNDLE },
] as const;

const walk = (node: UINode, out: UINode[] = []): UINode[] => {
  out.push(node);
  for (const child of node.children ?? []) walk(child, out);
  for (const region of Object.values(node.slots ?? {})) for (const child of region) walk(child, out);
  return out;
};

const composed = (index: 0 | 1) => {
  const { report, intent, bundle } = CASES[index];
  const result = composeView(report, intent, bundle);
  if (!result.spec) throw new Error(`${CASES[index].name} composed no spec`);
  return { spec: result.spec, report, bundle, nodes: result.spec.root.flatMap((node) => walk(node)) };
};

describe("the document opens on prose", () => {
  for (const [index, testCase] of CASES.entries()) {
    it(`${testCase.name}: leads with the header, then the written summary`, () => {
      const { spec } = composed(index as 0 | 1);
      expect(spec.root[0].component).toBe("PageHeader");
      expect(spec.root[1].component).toBe("Prose");
      expect(spec.root[1].props.source).toBe("summary");
      /* `readout` rather than `lead`: the opening passage is washed and marked now, which
         is a weight, not a different passage. Both cases here carry no section takeaway, so
         the readout is the whole opening rather than the left half of a split. */
      expect(spec.root[1].props.variant).toBe("readout");
    });

    it(`${testCase.name}: references the summary and never copies it`, () => {
      const { spec, report } = composed(index as 0 | 1);
      const serialised = JSON.stringify(spec);
      // The whole point: the sentence is not anywhere in the spec.
      expect(serialised).not.toContain(report.summary);
      for (const node of walk(spec.root[1])) {
        expect(node.props).not.toHaveProperty("text");
        expect(node.props).not.toHaveProperty("content");
      }
    });

    it(`${testCase.name}: renders the referenced summary on the page`, () => {
      // The other half of the promise. Keeping the text out of the spec is only safe if
      // the reference resolves — otherwise the guarantee is bought with a blank block.
      const { spec, report, bundle } = composed(index as 0 | 1);
      render(React.createElement(SpecRenderer, { spec, report, bundle }));
      const opening = report.summary.split(/(?<=\.)\s/)[0];
      expect(screen.getByText(opening, { exact: false })).toBeTruthy();
    });

    it(`${testCase.name}: still validates, so a referenced binding counts as bound`, () => {
      const { spec, bundle } = composed(index as 0 | 1);
      const issues = validate(spec, bundle).issues.filter((issue) => issue.severity === "error");
      expect(issues).toEqual([]);
    });
  }
});

describe("the same entities, measured several ways, become one table", () => {
  const holdings = ["NVIDIA", "Microsoft", "SGS 10Y", "Gold ETF", "SGD credit"];
  const measure = (id: string, name: string, at: (index: number) => number): ComparisonFinding => ({
    kind: "comparison",
    id,
    emphasis: "primary",
    confidence: 0.9,
    sources: ["Custody"],
    subject: "Largest positions",
    label: "Holding",
    measure: name,
    entities: holdings.map((holding, index) => ({ name: holding, value: at(index) })),
  });

  const findings = [
    measure("m_weight", "Weight", (index) => 20 - index * 2),
    measure("m_return", "Return YTD", (index) => 30 - index * 7),
    measure("m_value", "Market value", (index) => 5 - index * 0.5),
  ];

  it("routes to ComparisonTable once the entities carry two measures, not before", () => {
    const one = { count: 5, siblings: 1, measures: 1 };
    const three = { count: 5, siblings: 1, measures: 3 };
    expect(REGISTRY.ComparisonTable.fit?.(findings[0], one) ?? 0).toBe(0);
    expect(REGISTRY.ComparisonTable.fit?.(findings[0], three) ?? 0).toBeGreaterThan(
      REGISTRY.DataTable.fit?.(findings[0], three) ?? 0,
    );
  });

  it("groups exactly the findings measuring the same entity set", () => {
    const other: ComparisonFinding = {
      ...findings[0],
      id: "m_other",
      entities: [
        { name: "Cash", value: 1 },
        { name: "SGD deposits", value: 2 },
      ],
    };
    expect(measureGroup([...findings, other], findings[0]).map((entry) => entry.id)).toEqual([
      "m_weight",
      "m_return",
      "m_value",
    ]);
    // A finding measuring different names is not a column of this table.
    expect(measureGroup([...findings, other], other).map((entry) => entry.id)).toEqual(["m_other"]);
  });

  it("puts every measure on the page once, as a column rather than as a second chart", () => {
    // The regression this pins: the composer used to leave the other measures unclaimed,
    // so the extras pass drew each one again as its own ranked list under the table.
    const report: SemanticReport = {
      ...REVIEW_REPORT,
      sections: [
        {
          id: "s_holdings",
          semanticType: "comparison",
          question: "How do the largest positions compare?",
          importance: "primary",
          dataKeys: Object.keys(REVIEW_BUNDLE.values).slice(0, 1),
          findings,
        },
      ],
    };
    const result = composeView(report, REVIEW_INTENT, REVIEW_BUNDLE);
    const components = (result.spec?.root ?? []).flatMap((node) => walk(node)).map((node) => node.component);
    expect(components).toContain("ComparisonTable");
    expect(components).not.toContain("RankedList");
    expect(components.filter((id) => id === "ComparisonTable")).toHaveLength(1);
  });

  it("renders a column per measure and a row per entity", () => {
    const report: SemanticReport = {
      ...REVIEW_REPORT,
      sections: [
        {
          id: "s_holdings",
          semanticType: "comparison",
          question: "How do the largest positions compare?",
          importance: "primary",
          dataKeys: Object.keys(REVIEW_BUNDLE.values).slice(0, 1),
          findings,
        },
      ],
    };
    const { spec } = composeView(report, REVIEW_INTENT, REVIEW_BUNDLE);
    if (!spec) throw new Error("composed no spec");
    render(React.createElement(SpecRenderer, { spec, report, bundle: REVIEW_BUNDLE }));

    for (const header of ["Holding", "Weight", "Return YTD", "Market value"]) {
      expect(screen.getByText(header)).toBeTruthy();
    }
    for (const holding of holdings) expect(screen.getByText(holding)).toBeTruthy();
  });
});

describe("the figures follow the summary", () => {
  const figure = (id: string, label: string, value: string, basis: string, emphasis: Emphasis): Finding => ({
    kind: "metric",
    id,
    emphasis,
    confidence: 0.96,
    sources: ["Custody"],
    subject: label,
    label,
    value,
    basis,
  });

  const report: SemanticReport = {
    ...REVIEW_REPORT,
    sections: [
      {
        id: "s_value",
        semanticType: "performance",
        question: "What is it worth?",
        importance: "primary",
        dataKeys: Object.keys(REVIEW_BUNDLE.values).slice(0, 1),
        findings: [
          figure("m_value", "Portfolio value", "S$33.3m", "across all custody accounts", "primary"),
          figure("m_liquid", "Liquid assets", "S$6.1m", "available without selling a position", "secondary"),
        ],
      },
      {
        id: "s_leverage",
        semanticType: "liquidity",
        question: "How much is borrowed?",
        importance: "secondary",
        dataKeys: Object.keys(REVIEW_BUNDLE.values).slice(0, 1),
        findings: [figure("m_ltv", "Loan to value", "18%", "against pledged assets", "secondary")],
      },
    ],
  };

  it("puts a strip of figures third, after the header and the summary", () => {
    const { spec } = composeView(report, REVIEW_INTENT, REVIEW_BUNDLE);
    if (!spec) throw new Error("composed no spec");
    expect(spec.root.map((node) => node.component).slice(0, 3)).toEqual(["PageHeader", "Prose", "MetricStrip"]);
    // A reference, not the figures: the strip names the rule, the renderer resolves it.
    expect(spec.root[2].props.source).toBe("key_figures");
    expect(JSON.stringify(spec.root[2])).not.toContain("33.3");
  });

  it("selects by emphasis, caps at four, and needs two before it is a strip at all", () => {
    expect(headlineFigures(report).map((entry) => entry.id)).toEqual(["m_value", "m_liquid", "m_ltv"]);
    // One figure is not a set. It stays in its section rather than becoming a lone tile.
    const single: SemanticReport = { ...report, sections: [report.sections[1]] };
    expect(headlineFigures(single)).toEqual([]);
    expect(composeView(single, REVIEW_INTENT, REVIEW_BUNDLE).spec?.root[2]?.component).not.toBe("MetricStrip");
  });

  it("moves the figures rather than copying them, so none is printed twice", () => {
    const { spec } = composeView(report, REVIEW_INTENT, REVIEW_BUNDLE);
    if (!spec) throw new Error("composed no spec");
    const { container } = render(React.createElement(SpecRenderer, { spec, report, bundle: REVIEW_BUNDLE }));
    const text = container.textContent ?? "";
    for (const value of ["S$33.3m", "S$6.1m", "18%"]) {
      expect(text.split(value)).toHaveLength(2);
    }
    // And the basis line is on the page, under the figure it qualifies.
    expect(text).toContain("across all custody accounts");
  });
});

describe("a share is printed as a share", () => {
  it("renders a 0.29 weight as 29%, not as a delta two orders of magnitude out", () => {
    // Worth a permanent test because the failure mode was not a rounder version of the
    // truth but a different number, and 0.3% is a plausible-looking figure on a page
    // about a portfolio. The bar chart is the one place a fraction met a pct formatter.
    const report: SemanticReport = {
      ...REVIEW_REPORT,
      sections: [
        {
          id: "s_alloc",
          semanticType: "allocation",
          question: "How is the portfolio made up?",
          importance: "primary",
          dataKeys: Object.keys(REVIEW_BUNDLE.values).slice(0, 1),
          findings: [
            {
              kind: "composition",
              id: "f_alloc",
              emphasis: "primary",
              confidence: 0.95,
              sources: ["Custody"],
              subject: "Allocation",
              label: "Current",
              parts: [
                { label: "Technology", value: 0.29 },
                { label: "Financials", value: 0.18 },
                { label: "Healthcare", value: 0.15 },
                { label: "Industrials", value: 0.12 },
                { label: "Consumer", value: 0.08 },
                { label: "Energy", value: 0.07 },
              ],
            },
          ],
        },
      ],
    };
    const { spec } = composeView(report, REVIEW_INTENT, REVIEW_BUNDLE);
    if (!spec) throw new Error("composed no spec");
    const { container } = render(React.createElement(SpecRenderer, { spec, report, bundle: REVIEW_BUNDLE }));
    const text = container.textContent ?? "";
    expect(text).toContain("29%");
    expect(text).not.toContain("0.3%");
    // And no trailing zero where the decimal says nothing.
    expect(text).toContain("8%");
    expect(text).not.toContain("8.0%");
  });
});

describe("the executive summary is printed once", () => {
  it("drops a summary section that only restates report.summary", () => {
    // The lead Prose already references report.summary. A section whose findings repeat
    // that sentence is the same paragraph twice, one of them under a heading.
    const report: SemanticReport = {
      ...REVIEW_REPORT,
      sections: [
        {
          id: "s_summary",
          semanticType: "summary",
          question: "What is the headline?",
          importance: "primary",
          dataKeys: Object.keys(REVIEW_BUNDLE.values).slice(0, 1),
          findings: [
            {
              kind: "narrative",
              id: "f_summary",
              emphasis: "primary",
              confidence: 0.95,
              sources: ["Performance engine"],
              subject: "Headline",
              text: REVIEW_REPORT.summary,
            },
          ],
        },
        ...REVIEW_REPORT.sections,
      ],
    };
    const { spec } = composeView(report, REVIEW_INTENT, REVIEW_BUNDLE);
    if (!spec) throw new Error("composed no spec");
    const { container } = render(React.createElement(SpecRenderer, { spec, report, bundle: REVIEW_BUNDLE }));
    const opening = report.summary.split(/(?<=\.)\s/)[0];
    const text = container.textContent ?? "";
    expect(text.split(opening)).toHaveLength(2);
  });
});

describe("prose is a component, not a fallback", () => {
  it("routes a plain narrative finding to Prose rather than boxing it", () => {
    // The fit table is the mechanism, so assert on it directly: a narrative with no
    // deltas must score higher for Prose than for InsightCard, or the composer's
    // tie-break puts the paragraph back in a card.
    const narrative = {
      kind: "narrative" as const,
      id: "n1",
      emphasis: "secondary" as const,
      confidence: 0.9,
      sources: ["t"],
      subject: "Concentration",
      text: "Technology is now the largest exposure by some margin.",
    };
    const context = { count: 1, siblings: 1 };
    const prose = REGISTRY.Prose.fit?.(narrative, context) ?? 0;
    const card = REGISTRY.InsightCard.fit?.(narrative, context) ?? 0;
    expect(prose).toBeGreaterThan(card);
  });

  it("hands a narrative carrying deltas back to InsightCard, which has the chips", () => {
    const withDeltas = {
      kind: "narrative" as const,
      id: "n2",
      emphasis: "secondary" as const,
      confidence: 0.9,
      sources: ["t"],
      subject: "Performance",
      text: "Ahead of benchmark.",
      deltas: [{ label: "+60bps", value: 60, sentiment: "positive" as const }],
    };
    const context = { count: 1, siblings: 1 };
    expect(REGISTRY.InsightCard.fit?.(withDeltas, context) ?? 0).toBeGreaterThan(
      REGISTRY.Prose.fit?.(withDeltas, context) ?? 0,
    );
  });

  it("declares no children on either prose component, so neither can nest a figure", () => {
    expect(REGISTRY.Prose.children.allowed).toBe("none");
    expect(REGISTRY.BulletSummary.children.allowed).toBe("none");
  });
});
