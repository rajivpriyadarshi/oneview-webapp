/**
 * The three worked examples from GENERATIVE-UI-ARCHITECTURE.md §6, as real objects.
 *
 * Fixtures rather than prose, for two reasons. They type-check, so an example cannot
 * quietly stop matching the contracts it is illustrating — the failure mode of every
 * design document. And they are hand-authored with no model in the loop, which means
 * Phase 2 can render a page and Phase 4 can be tested against a known-good target
 * before either the planner or the composer exists.
 *
 *   A. A lookup — "who covers the Tan family?" — which never reaches a view.
 *   B. A portfolio review — the full chain, AnalyticalReport.
 *   C. A comparison — two funding options, ComparisonReport.
 *
 * Figures here are invented and internally consistent; they are not from the book.
 */

import type { DataBundle } from "./data";
import type { IAPlan } from "./ia";
import type { IntentPlan } from "./intent";
import type { SemanticReport } from "./semantic";
import type { UISpec } from "./spec";

/* ========================================================================== */
/* A. Lookup — the cheap path                                                 */
/* ========================================================================== */

/**
 * The point of this example is what is *absent*: no semantic report, no IA plan, no
 * spec. `surface: "text"` short-circuits the pipeline at layer 1.
 *
 * Under the old design this same question produced a prose answer, then a decider
 * counted the figures in it, and only then concluded there was nothing to draw —
 * having already paid for the structuring prompt. Here the decision costs one field.
 */
export const LOOKUP_INTENT: IntentPlan = {
  taskType: "lookup",
  goal: "Find out who covers the Tan family.",
  scope: { kind: "client", ids: ["tan-family"] },
  timeRange: { kind: "none" },
  needs: { comparison: false, chronology: false, actions: false, composition: false },
  register: "factual",
  surface: "text",
  because: "One attribute of one relationship — the answer is a name.",
  dataRequests: [
    { key: "client.coverage", tool: "client_profile", args: { clientId: "tan-family" }, required: true },
  ],
};

/* ========================================================================== */
/* B. Portfolio review — AnalyticalReport                                     */
/* ========================================================================== */

export const REVIEW_INTENT: IntentPlan = {
  taskType: "portfolio_review",
  goal: "Review how the Tan family portfolio did over the quarter and what changed.",
  scope: { kind: "client", ids: ["tan-family"] },
  timeRange: { kind: "range", from: "2026-04-01", to: "2026-06-30", label: "Q2" },
  needs: { comparison: false, chronology: false, actions: true, composition: true },
  register: "analytical",
  surface: "view",
  because: "A quarter's performance, its drivers and its risk changes — four questions, not one.",
  dataRequests: [
    { key: "perf.total", tool: "performance", args: { clientId: "tan-family", period: "Q2" }, required: true },
    { key: "perf.summary", tool: "performance", args: { clientId: "tan-family", period: "Q2" }, required: true },
    { key: "perf.monthly", tool: "performance_series", args: { clientId: "tan-family" }, required: true },
    { key: "drivers.contributors", tool: "attribution", args: { clientId: "tan-family", side: "top" }, required: false },
    { key: "drivers.detractors", tool: "attribution", args: { clientId: "tan-family", side: "bottom" }, required: false },
    { key: "alloc.current", tool: "allocation", args: { clientId: "tan-family" }, required: false },
    { key: "risk.concentration", tool: "risk_checks", args: { clientId: "tan-family" }, required: false },
    { key: "actions.open", tool: "open_items", args: { clientId: "tan-family" }, required: false },
    { key: "evidence.sources", tool: "provenance", args: { clientId: "tan-family" }, required: false },
  ],
};

export const REVIEW_BUNDLE: DataBundle = {
  values: {
    "perf.total": { label: "Total return", value: "+6.2%", delta: { label: "+2.1pp vs benchmark", value: 2.1 } },
    "perf.summary": [
      { label: "Total return", value: "+6.2%" },
      { label: "Portfolio value", value: "S$25.4m" },
      { label: "Cash", value: "S$1.8m" },
    ],
    "perf.monthly": [
      { label: "Jul", value: 100 },
      { label: "Aug", value: 101.4 },
      { label: "Sep", value: 99.8 },
      { label: "Oct", value: 102.6 },
      { label: "Nov", value: 104.1 },
      { label: "Dec", value: 106.2 },
    ],
    "drivers.contributors": [
      { name: "Semiconductors", value: 2.4 },
      { name: "US large cap", value: 1.6 },
      { name: "SGD credit", value: 0.9 },
      { name: "Gold", value: 0.4 },
    ],
    "drivers.detractors": [
      { name: "China equity", value: -1.1 },
      { name: "Long-duration bonds", value: -0.6 },
      { name: "GBP cash", value: -0.2 },
    ],
    "alloc.current": [
      { label: "Equities", value: 0.52 },
      { label: "Fixed income", value: 0.26 },
      { label: "Alternatives", value: 0.11 },
      { label: "Cash", value: 0.07 },
      { label: "Property funds", value: 0.04 },
    ],
    "risk.concentration": {
      severity: "warn",
      subject: "Technology exposure",
      detail: "Technology is 29% of equities against a 20% guideline, up from 21% in March.",
    },
    "actions.open": [
      { text: "Confirm the Q3 capital call funding source", state: "todo", due: "before the review" },
      { text: "Refresh the risk profile questionnaire", state: "doing", owner: "Advisory" },
      { text: "Send the updated IPS for signature", state: "todo" },
    ],
    "evidence.sources": [
      { name: "Custody positions", asOf: "2026-06-30" },
      { name: "Performance engine", asOf: "2026-06-30" },
      { name: "Risk guidelines v4", asOf: "2026-01-15" },
    ],
  },
  provenance: {
    "perf.total": { tool: "performance", asOf: "2026-06-30", sources: ["Performance engine"] },
    "perf.summary": { tool: "performance", asOf: "2026-06-30", sources: ["Performance engine", "Custody positions"] },
    "perf.monthly": { tool: "performance_series", asOf: "2026-06-30", sources: ["Performance engine"] },
    "drivers.contributors": { tool: "attribution", asOf: "2026-06-30", sources: ["Performance engine"] },
    "drivers.detractors": { tool: "attribution", asOf: "2026-06-30", sources: ["Performance engine"] },
    "alloc.current": { tool: "allocation", asOf: "2026-06-30", sources: ["Custody positions"] },
    "risk.concentration": { tool: "risk_checks", asOf: "2026-06-30", sources: ["Risk guidelines v4"] },
    "actions.open": { tool: "open_items", asOf: "2026-06-28", sources: ["CRM"] },
    "evidence.sources": { tool: "provenance", asOf: "2026-06-30", sources: ["Custody positions"] },
  },
  failed: [],
};

/**
 * Note `s.contributors` and `s.detractors`: same `question`, different `groups`.
 *
 * That is the entire input the tabs rule needs, and it is the thing the old flat
 * `Finding[]` model could not say. Two findings with subjects "Contributors" and
 * "Detractors" were, to `compose.ts`, two unrelated sections.
 */
export const REVIEW_REPORT: SemanticReport = {
  reportType: "portfolio_review",
  title: "Tan family — Q2 review",
  summary:
    "The portfolio returned 6.2% over the quarter, ahead of benchmark, driven by semiconductors and US large cap. Technology exposure has drifted above guideline.",
  narrative:
    "The Tan family portfolio returned 6.2% in Q2, 2.1 percentage points ahead of its benchmark, taking the value to S$25.4m. Semiconductors contributed 2.4pp and US large cap a further 1.6pp; China equity cost 1.1pp and long-duration bonds 0.6pp. The main change to flag is concentration: technology is now 29% of the equity allocation against a 20% guideline, up from 21% in March. Three items remain open before the review, including confirming the funding source for the Q3 capital call.",
  sections: [
    {
      id: "s.summary",
      semanticType: "summary",
      question: "How did the portfolio do this quarter?",
      importance: "primary",
      dataKeys: ["perf.total"],
      findings: [
        {
          kind: "metric",
          id: "f.total",
          emphasis: "primary",
          confidence: 0.98,
          sources: ["Performance engine"],
          subject: "Performance",
          label: "Total return",
          value: "+6.2%",
          delta: { label: "+2.1pp vs benchmark", value: 2.1, sentiment: "positive" },
        },
      ],
    },
    {
      id: "s.performance",
      semanticType: "performance",
      question: "What did the quarter look like month by month?",
      importance: "primary",
      dataKeys: ["perf.summary", "perf.monthly"],
      findings: [
        {
          kind: "trend",
          id: "f.monthly",
          emphasis: "primary",
          confidence: 0.95,
          sources: ["Performance engine"],
          subject: "Performance",
          label: "Indexed value",
          series: {
            name: "Portfolio",
            points: [
              { label: "Jul", value: 100 },
              { label: "Aug", value: 101.4 },
              { label: "Sep", value: 99.8 },
              { label: "Oct", value: 102.6 },
              { label: "Nov", value: 104.1 },
              { label: "Dec", value: 106.2 },
            ],
          },
        },
      ],
    },
    {
      id: "s.contributors",
      semanticType: "drivers",
      question: "What drove the return?",
      importance: "secondary",
      groups: ["Contributors"],
      dataKeys: ["drivers.contributors"],
      findings: [
        {
          kind: "comparison",
          id: "f.contributors",
          emphasis: "secondary",
          confidence: 0.9,
          sources: ["Performance engine"],
          subject: "Attribution",
          label: "Top contributors",
          measure: "Contribution to return",
          entities: [
            { name: "Semiconductors", value: 2.4, display: "+2.4pp" },
            { name: "US large cap", value: 1.6, display: "+1.6pp" },
            { name: "SGD credit", value: 0.9, display: "+0.9pp" },
            { name: "Gold", value: 0.4, display: "+0.4pp" },
          ],
        },
      ],
    },
    {
      id: "s.detractors",
      semanticType: "drivers",
      question: "What drove the return?",
      importance: "secondary",
      groups: ["Detractors"],
      dataKeys: ["drivers.detractors"],
      findings: [
        {
          kind: "comparison",
          id: "f.detractors",
          emphasis: "secondary",
          confidence: 0.9,
          sources: ["Performance engine"],
          subject: "Attribution",
          label: "Largest detractors",
          measure: "Contribution to return",
          entities: [
            { name: "China equity", value: -1.1, display: "-1.1pp" },
            { name: "Long-duration bonds", value: -0.6, display: "-0.6pp" },
            { name: "GBP cash", value: -0.2, display: "-0.2pp" },
          ],
        },
      ],
    },
    {
      id: "s.allocation",
      semanticType: "allocation",
      question: "How is the money allocated now?",
      importance: "secondary",
      dataKeys: ["alloc.current"],
      findings: [
        {
          kind: "composition",
          id: "f.alloc",
          emphasis: "secondary",
          confidence: 0.97,
          sources: ["Custody positions"],
          subject: "Allocation",
          label: "Current allocation",
          parts: [
            { label: "Equities", value: 0.52 },
            { label: "Fixed income", value: 0.26 },
            { label: "Alternatives", value: 0.11 },
            { label: "Cash", value: 0.07 },
            { label: "Property funds", value: 0.04 },
          ],
        },
      ],
    },
    {
      id: "s.risk",
      semanticType: "risk",
      question: "What changed about the risk?",
      importance: "secondary",
      dataKeys: ["risk.concentration"],
      findings: [
        {
          kind: "flag",
          id: "f.concentration",
          emphasis: "primary",
          confidence: 0.92,
          sources: ["Risk guidelines v4"],
          subject: "Concentration",
          severity: "warn",
          subjectLabel: "Technology exposure",
          detail: "29% of equities against a 20% guideline, up from 21% in March.",
        },
      ],
    },
    {
      id: "s.actions",
      semanticType: "actions",
      question: "What is still outstanding?",
      importance: "supporting",
      dataKeys: ["actions.open"],
      findings: [
        {
          kind: "checklist",
          id: "f.open",
          emphasis: "supporting",
          confidence: 1,
          sources: ["CRM"],
          subject: "Open items",
          label: "Before the review",
          items: [
            { text: "Confirm the Q3 capital call funding source", state: "todo", due: "before the review" },
            { text: "Refresh the risk profile questionnaire", state: "doing", owner: "Advisory" },
            { text: "Send the updated IPS for signature", state: "todo" },
          ],
        },
      ],
    },
    {
      id: "s.evidence",
      semanticType: "evidence",
      question: "Where do these figures come from?",
      importance: "supporting",
      dataKeys: ["evidence.sources"],
      findings: [
        {
          kind: "narrative",
          id: "f.sources",
          emphasis: "supporting",
          confidence: 1,
          sources: ["Custody positions", "Performance engine"],
          subject: "Provenance",
          text: "Positions and performance as at 30 June 2026; guidelines from Risk guidelines v4.",
        },
      ],
    },
  ],
  relations: [{ kind: "answers_same_question", sectionIds: ["s.contributors", "s.detractors"] }],
};

export const REVIEW_IA: IAPlan = {
  areas: [
    {
      id: "a.headline",
      heading: "How the quarter went",
      sectionIds: ["s.summary"],
      rank: 0,
      importance: "primary",
      arrangement: "single",
      presentation: {
        "s.summary": {
          form: "metric",
          emphasis: "hero",
          disclosure: "open",
          because: "One figure answers the question that was asked.",
        },
      },
    },
    {
      id: "a.changed",
      heading: "What changed",
      sectionIds: ["s.performance"],
      rank: 1,
      importance: "primary",
      arrangement: "single",
      presentation: {
        "s.performance": {
          form: "chart",
          chartOf: "trend",
          emphasis: "normal",
          disclosure: "open",
          because: "Six months of history — the shape matters more than each month's value.",
        },
      },
    },
    {
      id: "a.drivers",
      heading: "Performance drivers",
      sectionIds: ["s.contributors", "s.detractors"],
      rank: 2,
      importance: "secondary",
      // Two sections, same question, same visual structure, only one needed at a
      // time. This is the tabs rule firing on evidence rather than on adjacency.
      arrangement: "tabs",
      presentation: {
        "s.contributors": {
          form: "ranked_list",
          emphasis: "normal",
          disclosure: "open",
          because: "Four holdings on one measure — the order is the message.",
        },
        "s.detractors": {
          form: "ranked_list",
          emphasis: "normal",
          disclosure: "open",
          because: "The same measure from the other end.",
        },
      },
    },
    {
      id: "a.risk",
      heading: "Risk changes",
      // The brief's grouping rule: allocation and concentration answer one
      // question — has the shape of the risk changed — so they share an area.
      sectionIds: ["s.allocation", "s.risk"],
      rank: 3,
      importance: "secondary",
      arrangement: "grid",
      presentation: {
        "s.allocation": {
          form: "chart",
          chartOf: "composition",
          emphasis: "normal",
          disclosure: "open",
          because: "Five parts of one whole.",
        },
        "s.risk": {
          form: "callout",
          emphasis: "normal",
          disclosure: "open",
          because: "Something is outside guideline and needs a decision.",
        },
      },
    },
    {
      id: "a.actions",
      heading: "What to watch",
      sectionIds: ["s.actions"],
      rank: 4,
      importance: "supporting",
      arrangement: "single",
      presentation: {
        "s.actions": {
          form: "checklist",
          emphasis: "quiet",
          disclosure: "open",
          because: "Three open items to work through.",
        },
      },
    },
    {
      id: "a.provenance",
      heading: "Sources and method",
      sectionIds: ["s.evidence"],
      rank: 5,
      importance: "supporting",
      arrangement: "single",
      presentation: {
        "s.evidence": {
          form: "key_value",
          emphasis: "quiet",
          disclosure: "collapsed",
          because: "Provenance — present, but not competing with the answer.",
        },
      },
    },
  ],
  trace: [
    {
      rule: "group-same-question",
      because: "Contributors and detractors answer one question.",
      targets: ["s.contributors", "s.detractors"],
    },
    {
      rule: "tabs-for-sibling-views",
      because: "Two sibling views of one measure; only one is read at a time.",
      targets: ["a.drivers"],
    },
    {
      rule: "group-risk-changes",
      because: "Allocation and concentration are the same question about shape.",
      targets: ["a.risk"],
    },
    {
      rule: "collapse-provenance",
      because: "Sources are not needed for the first scan.",
      targets: ["s.evidence"],
    },
    {
      rule: "single-headline",
      because: "The total return is the answer; everything else supports it.",
      targets: ["s.summary"],
    },
  ],
};

export const REVIEW_SPEC: UISpec = {
  id: "view.tan.q2",
  recipe: "AnalyticalReport",
  narrative: REVIEW_REPORT.narrative,
  meta: { reportId: "report.tan.q2", trace: REVIEW_IA.trace, unplacedSectionIds: [] },
  root: [
    {
      id: "n.header",
      component: "PageHeader",
      props: { eyebrow: "Portfolio review", subtitle: "Tan family · Q2" },
    },
    {
      id: "n.headline",
      component: "Section",
      props: { heading: "How the quarter went" },
      sectionId: "s.summary",
      children: [
        {
          id: "n.headline.stack",
          component: "Stack",
          props: { gap: "normal" },
          children: [
            {
              id: "n.total",
              component: "Metric",
              props: { label: "Total return", variant: "hero", size: "lg", showDelta: true },
              dataKey: "perf.total",
              sectionId: "s.summary",
              because: "One figure answers the question that was asked.",
            },
            {
              id: "n.summary",
              component: "MetricStrip",
              props: { columns: 3 },
              dataKey: "perf.summary",
              sectionId: "s.summary",
              because: "Three figures of comparable weight, read together.",
            },
          ],
        },
      ],
    },
    {
      id: "n.changed",
      component: "Section",
      props: { heading: "What changed" },
      sectionId: "s.performance",
      children: [
        {
          id: "n.monthly",
          component: "LineChart",
          props: { label: "Indexed value", showAxes: true, size: "lg" },
          dataKey: "perf.monthly",
          sectionId: "s.performance",
          because: "Six months of history — the shape matters more than each month's value.",
        },
      ],
    },
    {
      id: "n.drivers",
      component: "Section",
      props: { heading: "Performance drivers" },
      children: [
        {
          id: "n.drivers.tabs",
          component: "Tabs",
          props: { label: "Attribution", defaultTab: "Contributors", variant: "underline" },
          slots: {
            Contributors: [
              {
                id: "n.contributors",
                component: "RankedList",
                props: { label: "Contribution to return", variant: "bars" },
                dataKey: "drivers.contributors",
                sectionId: "s.contributors",
                because: "Four holdings on one measure — the order is the message.",
              },
            ],
            Detractors: [
              {
                id: "n.detractors",
                component: "RankedList",
                props: { label: "Contribution to return", variant: "bars" },
                dataKey: "drivers.detractors",
                sectionId: "s.detractors",
                because: "The same measure from the other end.",
              },
            ],
          },
        },
      ],
    },
    {
      id: "n.risk",
      component: "Section",
      props: { heading: "Risk changes" },
      children: [
        {
          id: "n.risk.grid",
          component: "Grid",
          props: { columns: 2 },
          children: [
            {
              id: "n.alloc",
              component: "AllocationDonut",
              props: { label: "Current allocation", showLegend: true },
              dataKey: "alloc.current",
              sectionId: "s.allocation",
              because: "Five parts of one whole.",
            },
            {
              id: "n.concentration",
              component: "RiskAlert",
              props: { heading: "Technology above guideline", variant: "warn" },
              dataKey: "risk.concentration",
              sectionId: "s.risk",
              because: "Something is outside guideline and needs a decision.",
            },
          ],
        },
      ],
    },
    {
      id: "n.watch",
      component: "Section",
      props: { heading: "What to watch" },
      children: [
        {
          id: "n.watch.group",
          component: "WhatToWatch",
          props: { heading: "Before the review" },
          children: [
            {
              id: "n.open",
              component: "Checklist",
              props: { label: "Open items", showOwners: true },
              dataKey: "actions.open",
              sectionId: "s.actions",
              because: "Three open items to work through.",
            },
          ],
        },
      ],
    },
    {
      id: "n.provenance",
      component: "Disclosure",
      props: { label: "Sources and method" },
      children: [
        {
          id: "n.sources",
          component: "SourceList",
          props: { label: "As at 30 June" },
          dataKey: "evidence.sources",
          sectionId: "s.evidence",
          because: "Provenance — present, but not competing with the answer.",
        },
      ],
    },
  ],
};

/* ========================================================================== */
/* C. Comparison — ComparisonReport                                           */
/* ========================================================================== */

export const COMPARE_INTENT: IntentPlan = {
  taskType: "comparison",
  goal: "Decide between a Lombard loan and selling holdings to raise S$3m.",
  scope: { kind: "client", ids: ["tan-family"] },
  timeRange: { kind: "point", to: "2026-09-30", label: "by end September" },
  needs: { comparison: true, chronology: false, actions: true, composition: false, count: 2 },
  register: "analytical",
  surface: "view",
  because: "Two options weighed on the same measures, ending in a call.",
  dataRequests: [
    { key: "options.compare", tool: "funding_options", args: { clientId: "tan-family", amount: 3_000_000 }, required: true },
    { key: "cost.schedule", tool: "funding_cost", args: { clientId: "tan-family" }, required: true },
    { key: "liquidity.impact", tool: "liquidity_impact", args: { clientId: "tan-family" }, required: false },
    { key: "rec.primary", tool: "advice", args: { clientId: "tan-family" }, required: true },
    { key: "evidence.assumptions", tool: "provenance", args: { clientId: "tan-family" }, required: false },
  ],
};

export const COMPARE_BUNDLE: DataBundle = {
  values: {
    "ask.summary": {
      text: "Raising S$3m by end September. A Lombard facility costs more in interest but keeps the equity position and avoids a S$220k capital gains event.",
    },
    "options.compare": {
      measure: "Cost and impact",
      entities: [
        { name: "Lombard facility", value: 129_000, display: "S$129k over 12 months" },
        { name: "Sell holdings", value: 220_000, display: "S$220k realised gains tax" },
      ],
    },
    "cost.schedule": [
      { label: "Interest, year 1", value: 129_000 },
      { label: "Arrangement fee", value: 9_000 },
      { label: "Realised gains tax", value: 220_000 },
      { label: "Transaction costs", value: 12_000 },
    ],
    "liquidity.impact": [
      { label: "Cash after", value: 0.07 },
      { label: "Pledged collateral", value: 0.31 },
      { label: "Unencumbered", value: 0.62 },
    ],
    "rec.primary": {
      title: "Use the Lombard facility for the full S$3m",
      rationale:
        "The interest cost is lower than the tax on realising the position, the equity exposure stays intact, and the facility can be repaid from the December distribution.",
      action: "Draft the facility request for signature this week.",
    },
    "evidence.assumptions": [
      { name: "Lombard rate sheet", asOf: "2026-09-01" },
      { name: "Tax model v2", asOf: "2026-07-01" },
    ],
  },
  provenance: {
    "ask.summary": { tool: "advice", asOf: "2026-09-12", sources: ["Advisory"] },
    "options.compare": { tool: "funding_options", asOf: "2026-09-12", sources: ["Lombard rate sheet", "Tax model v2"] },
    "cost.schedule": { tool: "funding_cost", asOf: "2026-09-12", sources: ["Lombard rate sheet"] },
    "liquidity.impact": { tool: "liquidity_impact", asOf: "2026-09-12", sources: ["Custody positions"] },
    "rec.primary": { tool: "advice", asOf: "2026-09-12", sources: ["Advisory"] },
    "evidence.assumptions": { tool: "provenance", asOf: "2026-09-12", sources: ["Tax model v2"] },
  },
  failed: [],
};

export const COMPARE_REPORT: SemanticReport = {
  reportType: "comparison",
  title: "Raising S$3m — facility or sale",
  summary:
    "A Lombard facility costs S$138k in interest and fees against S$232k in tax and transaction costs to sell, and keeps the equity position intact.",
  narrative:
    "To raise S$3m by end September there are two workable routes. A Lombard facility against the custody account costs roughly S$129k in interest over twelve months plus a S$9k arrangement fee, and pledges about 31% of the portfolio as collateral. Selling holdings raises the cash outright but realises approximately S$220k in capital gains tax plus S$12k of transaction costs, and gives up an equity position that has been the main contributor to return this year. On cost alone the facility is the cheaper route by around S$94k, and it can be repaid from the December distribution. The recommendation is the facility for the full amount.",
  sections: [
    {
      id: "s.question",
      semanticType: "summary",
      question: "Which route should we take?",
      importance: "primary",
      dataKeys: ["ask.summary"],
      findings: [
        {
          kind: "narrative",
          id: "f.ask",
          emphasis: "primary",
          confidence: 0.9,
          sources: ["Advisory"],
          subject: "The question",
          heading: "The cheaper route is the facility",
          text: "A Lombard facility costs more in interest but avoids a S$220k gains event and keeps the equity position.",
        },
      ],
    },
    {
      id: "s.options",
      semanticType: "comparison",
      question: "How do the two options compare?",
      importance: "primary",
      dataKeys: ["options.compare"],
      findings: [
        {
          kind: "comparison",
          id: "f.options",
          emphasis: "primary",
          confidence: 0.88,
          sources: ["Lombard rate sheet", "Tax model v2"],
          subject: "Funding options",
          label: "Cost of raising S$3m",
          measure: "Total cost",
          entities: [
            { name: "Lombard facility", value: 138_000, display: "S$138k" },
            { name: "Sell holdings", value: 232_000, display: "S$232k" },
          ],
        },
      ],
    },
    {
      id: "s.cost",
      semanticType: "commitments",
      question: "Where does the cost come from?",
      importance: "secondary",
      dataKeys: ["cost.schedule"],
      findings: [
        {
          kind: "comparison",
          id: "f.cost",
          emphasis: "secondary",
          confidence: 0.85,
          sources: ["Lombard rate sheet"],
          subject: "Cost breakdown",
          label: "Cost components",
          measure: "Amount",
          entities: [
            { name: "Interest, year 1", value: 129_000, display: "S$129k" },
            { name: "Arrangement fee", value: 9_000, display: "S$9k" },
            { name: "Realised gains tax", value: 220_000, display: "S$220k" },
            { name: "Transaction costs", value: 12_000, display: "S$12k" },
          ],
        },
      ],
    },
    {
      id: "s.liquidity",
      semanticType: "liquidity",
      question: "What does it do to liquidity?",
      importance: "secondary",
      dataKeys: ["liquidity.impact"],
      findings: [
        {
          kind: "composition",
          id: "f.liq",
          emphasis: "secondary",
          confidence: 0.9,
          sources: ["Custody positions"],
          subject: "Liquidity",
          label: "Portfolio after drawdown",
          parts: [
            { label: "Cash after", value: 0.07 },
            { label: "Pledged collateral", value: 0.31 },
            { label: "Unencumbered", value: 0.62 },
          ],
        },
      ],
    },
    {
      id: "s.call",
      semanticType: "recommendations",
      question: "So what do we do?",
      importance: "primary",
      dataKeys: ["rec.primary"],
      findings: [
        {
          kind: "recommendation",
          id: "f.rec",
          emphasis: "primary",
          confidence: 0.86,
          sources: ["Advisory"],
          subject: "Recommendation",
          title: "Use the Lombard facility for the full amount",
          rationale:
            "Lower cost than realising the position, the equity exposure stays intact, and it can be repaid from the December distribution.",
          action: "Draft the facility request for signature this week.",
        },
      ],
    },
    {
      id: "s.assumptions",
      semanticType: "evidence",
      question: "What is this based on?",
      importance: "supporting",
      dataKeys: ["evidence.assumptions"],
      findings: [
        {
          kind: "narrative",
          id: "f.assumptions",
          emphasis: "supporting",
          confidence: 1,
          sources: ["Lombard rate sheet", "Tax model v2"],
          subject: "Assumptions",
          text: "Rates from the September sheet; tax at the current headline rate with no loss offsets assumed.",
        },
      ],
    },
  ],
};

export const COMPARE_IA: IAPlan = {
  areas: [
    {
      id: "a.question",
      heading: "The call",
      sectionIds: ["s.question"],
      rank: 0,
      importance: "primary",
      arrangement: "single",
      presentation: {
        "s.question": {
          form: "callout",
          emphasis: "hero",
          disclosure: "open",
          because: "The advisor asked which one; lead with the answer.",
        },
      },
    },
    {
      id: "a.options",
      heading: "Options",
      sectionIds: ["s.options"],
      rank: 1,
      importance: "primary",
      arrangement: "single",
      presentation: {
        "s.options": {
          form: "comparison",
          emphasis: "normal",
          disclosure: "open",
          because: "Two options on the same measure, both visible at once.",
        },
      },
    },
    {
      id: "a.measures",
      heading: "How they differ",
      sectionIds: ["s.cost", "s.liquidity"],
      rank: 2,
      importance: "secondary",
      // Split rather than tabs: the cost and the liquidity consequence are read
      // against each other to make the decision, so hiding one loses the point.
      arrangement: "split",
      presentation: {
        "s.cost": {
          form: "chart",
          chartOf: "magnitude",
          emphasis: "normal",
          disclosure: "open",
          because: "Four components where the relative size is the message.",
        },
        "s.liquidity": {
          form: "table",
          emphasis: "normal",
          disclosure: "open",
          because: "Three figures the advisor will quote exactly.",
        },
      },
    },
    {
      id: "a.call",
      heading: "Recommendation",
      sectionIds: ["s.call"],
      rank: 3,
      importance: "primary",
      arrangement: "single",
      presentation: {
        "s.call": {
          form: "callout",
          emphasis: "normal",
          disclosure: "open",
          because: "A course of action with the reasoning behind it.",
        },
      },
    },
    {
      id: "a.assumptions",
      heading: "Assumptions",
      sectionIds: ["s.assumptions"],
      rank: 4,
      importance: "supporting",
      arrangement: "single",
      presentation: {
        "s.assumptions": {
          form: "key_value",
          emphasis: "quiet",
          disclosure: "collapsed",
          because: "Method, available but not in the way.",
        },
      },
    },
  ],
  trace: [
    {
      rule: "recipe-comparison",
      because: "The ask names two options and expects a call.",
      targets: ["a.options", "a.call"],
    },
    {
      rule: "split-not-tabs",
      because: "Cost and liquidity are read together to decide.",
      targets: ["a.measures"],
    },
    {
      rule: "recommendation-last",
      because: "A comparison that does not end in a call is a table.",
      targets: ["a.call"],
    },
  ],
};

export const COMPARE_SPEC: UISpec = {
  id: "view.tan.funding",
  recipe: "ComparisonReport",
  narrative: COMPARE_REPORT.narrative,
  meta: { reportId: "report.tan.funding", trace: COMPARE_IA.trace, unplacedSectionIds: [] },
  root: [
    {
      id: "n.header",
      component: "PageHeader",
      // No amount in the subtitle, deliberately. The validator rejects figures in
      // props, and "raising S$3m" is a figure — it belongs in a binding, not a label.
      props: { eyebrow: "Funding decision", subtitle: "Tan family · raising cash by September" },
    },
    {
      id: "n.question",
      component: "Section",
      props: { heading: "The call" },
      children: [
        {
          id: "n.ask",
          component: "InsightCard",
          props: { heading: "The facility is the cheaper route", variant: "hero" },
          dataKey: "ask.summary",
          sectionId: "s.question",
          because: "The advisor asked which one; lead with the answer.",
        },
      ],
    },
    {
      id: "n.options",
      component: "Section",
      props: { heading: "Options" },
      children: [
        {
          id: "n.compare",
          component: "Comparison",
          props: {
            entities: ["Lombard facility", "Sell holdings"],
            measures: ["Total cost", "Tax event", "Equity position", "Collateral"],
            variant: "columns",
          },
          dataKey: "options.compare",
          sectionId: "s.options",
          because: "Two options on the same measures, both visible at once.",
        },
      ],
    },
    {
      id: "n.measures",
      component: "Section",
      props: { heading: "How they differ" },
      children: [
        {
          id: "n.measures.split",
          component: "SplitPane",
          props: { leftLabel: "Cost", rightLabel: "Liquidity after", ratio: "even" },
          slots: {
            left: [
              {
                id: "n.cost",
                component: "BarChart",
                props: { label: "Cost components", orientation: "horizontal" },
                dataKey: "cost.schedule",
                sectionId: "s.cost",
                because: "Four components where the relative size is the message.",
              },
            ],
            right: [
              {
                id: "n.liquidity",
                component: "DataTable",
                props: { label: "Portfolio after drawdown", compact: true },
                dataKey: "liquidity.impact",
                sectionId: "s.liquidity",
                because: "Three figures the advisor will quote exactly.",
              },
            ],
          },
        },
      ],
    },
    {
      id: "n.call",
      component: "Section",
      props: { heading: "Recommendation" },
      children: [
        {
          id: "n.rec",
          component: "Recommendation",
          props: { heading: "Use the facility for the full amount", showAction: true },
          dataKey: "rec.primary",
          sectionId: "s.call",
          because: "A course of action with the reasoning behind it.",
        },
      ],
    },
    {
      id: "n.assumptions",
      component: "Disclosure",
      props: { label: "Assumptions" },
      children: [
        {
          id: "n.assumption.sources",
          component: "SourceList",
          props: {},
          dataKey: "evidence.assumptions",
          sectionId: "s.assumptions",
          because: "Method, available but not in the way.",
        },
      ],
    },
  ],
};
