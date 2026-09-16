/**
 * Layer 6 — the approved component registry.
 *
 * The vocabulary the model is allowed to reference, and nothing else. No JSX is
 * ever generated; a UI spec names components from this list, and the renderer
 * resolves the names. An unknown name is a validation failure, not a runtime
 * surprise.
 *
 * The old registry was `Record<RendererId, (props: { finding: Finding }) => ReactNode>`
 * (`renderers.tsx:755`). It got two things right — exhaustive over the id union,
 * so adding an id without a component was a type error — and everything else
 * wrong for this direction:
 *
 *   - every component took exactly one finding and no props, so there was no prop
 *     schema to validate and no way to vary a component's presentation;
 *   - there were no containers, and none could be added, because the map had no
 *     notion of children. That is the reason tabs, grids and disclosure were
 *     unreachable rather than merely unimplemented.
 *
 * So a `ComponentSpec` carries what a validator and a composer actually need: a
 * prop schema, what it means, which IA forms it implements, which finding kinds it
 * binds to, its variants and sizes, when to use it, when to use something else,
 * and what may nest inside it.
 *
 * Two rules hold across every entry:
 *
 *   1. **Props are presentation, never facts.** Labels, headings, column counts,
 *      variants. Data arrives by `dataKey` reference against the bundle. The
 *      validator rejects figures found in props, which is what makes "the UI
 *      composer cannot change the numbers" a checkable property.
 *   2. **Colour is not a prop anywhere.** It comes from the palette, as it
 *      already does in `renderers.tsx`. A runtime-composed view is exactly where
 *      per-component colour choices stop being survivable.
 *
 * Phase 1 defines the manifest. Phase 2 builds the components against it.
 */

import { z } from "zod";
import { hasEntitySeries, isPlottable, type Finding, type FindingKind } from "./findings";
import type { PresentationForm } from "./ia";

/* ---------------------------------------------------------------------- ids */

export const ComponentIdSchema = z.enum([
  // layout
  "PageHeader",
  "Section",
  "Grid",
  "Stack",
  "Tabs",
  "SplitPane",
  "Disclosure",
  // data
  "Metric",
  "MetricStrip",
  "DataTable",
  "RankedList",
  "Timeline",
  "KeyValueList",
  // visualisation
  "LineChart",
  "BarChart",
  "AllocationDonut",
  "ExposureHeatmap",
  // intelligence
  "InsightCard",
  "RiskAlert",
  "Recommendation",
  "NewsImpact",
  "WhatToWatch",
  "Checklist",
  "Comparison",
  // entity / wealth-specific
  "ClientCard",
  "HoldingCard",
  "AssetCard",
  "DocumentReference",
  "SourceList",
]);
export type ComponentId = z.infer<typeof ComponentIdSchema>;

/* -------------------------------------------------------------- child groups
 *
 * Named sets, so nesting rules read as intent rather than as 25-entry arrays,
 * and so adding a leaf component doesn't mean editing every container.
 */

const CONTAINERS: ComponentId[] = ["Section", "Grid", "Stack", "Tabs", "SplitPane", "Disclosure"];

const LEAVES: ComponentId[] = [
  "Metric",
  "MetricStrip",
  "DataTable",
  "RankedList",
  "Timeline",
  "KeyValueList",
  "LineChart",
  "BarChart",
  "AllocationDonut",
  "ExposureHeatmap",
  "InsightCard",
  "RiskAlert",
  "Recommendation",
  "NewsImpact",
  "Checklist",
  "Comparison",
  "ClientCard",
  "HoldingCard",
  "AssetCard",
  "DocumentReference",
  "SourceList",
];

/**
 * Everything a general-purpose container may hold.
 *
 * `WhatToWatch` is in neither list above: it is an intelligence component that takes
 * children, which makes it the one grouping component outside the layout category.
 * It is named here rather than folded into `CONTAINERS` because a Grid may not hold
 * one — a forward-look block beside three cards is a different page.
 */
const ANY_CONTENT: ComponentId[] = [...CONTAINERS, ...LEAVES, "WhatToWatch"];

/* --------------------------------------------------------------- prop atoms */

/**
 * A heading a person reads. Bounded because an unbounded string in a heading slot
 * is where a model puts a sentence, and a sentence in a heading breaks the
 * typographic hierarchy the design system is there to hold.
 */
const heading = z.string().min(1).max(80);
const label = z.string().min(1).max(60);
const caption = z.string().min(1).max(160).optional();

/* --------------------------------------------------------------- the spec */

export type ComponentSpec = {
  id: ComponentId;
  /** What it means. Read by the composer's rules and by a human in review. */
  description: string;
  category: "layout" | "data" | "visualisation" | "intelligence" | "entity";
  /**
   * Runtime-validated. The same schema generates the model-facing JSON Schema in
   * Phase 3 via `z.toJSONSchema`, so the contract the model sees and the contract
   * the validator enforces cannot drift.
   */
  propsSchema: z.ZodType;
  /** Finding kinds this component can bind to. Empty for pure layout. */
  accepts: FindingKind[];
  /** IA forms it implements. The composer picks a form; this maps back. */
  implements: PresentationForm[];
  variants: string[];
  sizes: ("sm" | "md" | "lg")[];
  /** The rule, in prose. Shown in review and given to the composer. */
  useWhen: string;
  /** Where something else is the better answer, and what. */
  useInsteadWhen?: { condition: string; prefer: ComponentId }[];
  children: {
    allowed: ComponentId[] | "none";
    /** Named regions — Tabs' tab labels, SplitPane's two sides. */
    named?: Record<string, ComponentId[]>;
    min?: number;
    max?: number;
  };
  /** Whether this component needs a data binding to render anything. */
  requiresData: boolean;
  /**
   * How well it fits a finding, ported from `select.ts`'s scoring table.
   *
   * 0 excludes outright. The thresholds are the earned knowledge of the old
   * prototype and are kept verbatim: they are the part of that system that was
   * right, and re-deriving them by taste would lose real information.
   *
   * Consulted by the IA composer to break ties within a chosen form — never by
   * the model.
   */
  fit?: (finding: Finding, context: { count: number; siblings: number }) => number;
};

export type ComponentRegistry = Record<ComponentId, ComponentSpec>;

/* ------------------------------------------------------------ the manifest */

export const REGISTRY: ComponentRegistry = {
  /* ------------------------------------------------------------------ layout */

  PageHeader: {
    id: "PageHeader",
    description: "The view's title block: eyebrow, title, subtitle, one-line summary.",
    category: "layout",
    propsSchema: z.object({
      eyebrow: label.optional(),
      subtitle: z.string().min(1).max(120).optional(),
    }),
    accepts: [],
    implements: [],
    variants: [],
    sizes: ["md"],
    useWhen: "Once per view, first. Never more than one.",
    children: { allowed: "none" },
    requiresData: false,
  },

  Section: {
    id: "Section",
    description: "A titled group of related content. The unit of the reader's scan.",
    category: "layout",
    propsSchema: z.object({ heading, caption }),
    accepts: [],
    implements: [],
    variants: ["plain", "bordered"],
    sizes: ["md"],
    useWhen:
      "To group content that answers one question. Prefer fewer, stronger sections over many thin ones.",
    children: { allowed: ANY_CONTENT, min: 1, max: 8 },
    requiresData: false,
  },

  Grid: {
    id: "Grid",
    description: "Equal-weight items side by side. The cards case, bounded.",
    category: "layout",
    propsSchema: z.object({ columns: z.union([z.literal(2), z.literal(3), z.literal(4)]) }),
    accepts: [],
    implements: [],
    variants: [],
    sizes: ["md"],
    useWhen:
      "Items are meaningfully independent, their content types differ, and each deserves standalone emphasis.",
    useInsteadWhen: [
      {
        condition: "more than about four items share the same attributes",
        prefer: "DataTable",
      },
      { condition: "the items are one ranking on one measure", prefer: "RankedList" },
    ],
    // Six is the ceiling because past it a grid of cards is a table that hasn't
    // admitted it yet — the failure the brief names as ten cards for ten securities.
    children: { allowed: [...LEAVES, "Stack"], min: 2, max: 6 },
    requiresData: false,
  },

  Stack: {
    id: "Stack",
    description: "Vertical flow, read in order. The default arrangement.",
    category: "layout",
    propsSchema: z.object({ gap: z.enum(["tight", "normal", "loose"]).optional() }),
    accepts: [],
    implements: [],
    variants: [],
    sizes: ["md"],
    useWhen: "Related content read one after another, where order carries meaning.",
    children: { allowed: ANY_CONTENT, min: 1, max: 10 },
    requiresData: false,
  },

  Tabs: {
    id: "Tabs",
    description: "Sibling views of one thing, one visible at a time.",
    category: "layout",
    propsSchema: z.object({ label: heading, defaultTab: z.string().optional() }),
    accepts: [],
    implements: [],
    variants: ["underline", "pill"],
    sizes: ["md"],
    useWhen:
      "2–5 sibling datasets or views that share a visual structure, where only one needs to be seen at once.",
    useInsteadWhen: [
      {
        condition: "the reader needs to see them at the same time to make a decision",
        prefer: "SplitPane",
      },
      { condition: "there would be only one tab", prefer: "Section" },
    ],
    // Named children, 2–5, enforced by the validator against `named` size.
    children: { allowed: [...LEAVES, "Stack", "Grid"], named: {}, min: 2, max: 5 },
    requiresData: false,
  },

  SplitPane: {
    id: "SplitPane",
    description: "Two things read against each other, simultaneously.",
    category: "layout",
    propsSchema: z.object({
      leftLabel: label.optional(),
      rightLabel: label.optional(),
      ratio: z.enum(["even", "wide-left", "wide-right"]).optional(),
    }),
    accepts: [],
    implements: [],
    variants: [],
    sizes: ["md"],
    useWhen: "Exactly two things, where the comparison is the point and hiding one loses it.",
    children: {
      allowed: [],
      named: { left: [...LEAVES, "Stack"], right: [...LEAVES, "Stack"] },
    },
    requiresData: false,
  },

  Disclosure: {
    id: "Disclosure",
    description: "Collapsed detail. Present but not competing for the first scan.",
    category: "layout",
    propsSchema: z.object({ label, defaultOpen: z.boolean().optional() }),
    accepts: [],
    implements: [],
    variants: [],
    sizes: ["md"],
    useWhen:
      "Provenance, methodology, raw calculation, sources, and detail not required for the first scan.",
    useInsteadWhen: [
      { condition: "the content answers the question that was asked", prefer: "Section" },
    ],
    children: { allowed: [...LEAVES, "Stack"], min: 1, max: 4 },
    requiresData: false,
  },

  /* -------------------------------------------------------------------- data */

  Metric: {
    id: "Metric",
    description: "One number that matters, with an optional change and caption.",
    category: "data",
    propsSchema: z.object({ label, caption, showDelta: z.boolean().optional() }),
    accepts: ["metric"],
    implements: ["metric"],
    variants: ["plain", "hero"],
    sizes: ["sm", "md", "lg"],
    useWhen: "A single figure the reader should take away.",
    useInsteadWhen: [{ condition: "there are 2–4 sibling figures", prefer: "MetricStrip" }],
    children: { allowed: "none" },
    requiresData: true,
    // Ported: primary emphasis with history earned the hero treatment; every
    // metric looking like the headline means none of them does.
    fit: (finding) =>
      finding.kind !== "metric" ? 0 : finding.emphasis === "primary" ? (isPlottable(finding.series) ? 1 : 0.75) : 0.9,
  },

  MetricStrip: {
    id: "MetricStrip",
    description: "A row of sibling figures, read together at a glance.",
    category: "data",
    propsSchema: z.object({
      // Four is the cap for the reason the brief gives: eight KPI cards in a row
      // is not a summary, it is a wall. The validator enforces it too.
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
      heading: heading.optional(),
    }),
    accepts: ["metric"],
    implements: ["metric_strip"],
    variants: [],
    sizes: ["md", "lg"],
    useWhen: "2–4 figures of comparable weight that belong to the same question.",
    useInsteadWhen: [{ condition: "more than four figures", prefer: "DataTable" }],
    children: { allowed: "none" },
    requiresData: true,
  },

  DataTable: {
    id: "DataTable",
    description: "Repeated records sharing attributes, where exact values matter.",
    category: "data",
    propsSchema: z.object({
      label: heading,
      compact: z.boolean().optional(),
      /** Column *keys* into the bound data. Not values. */
      columns: z.array(z.object({ key: z.string().min(1), header: label })).optional(),
      sortBy: z.string().optional(),
    }),
    accepts: ["comparison", "composition"],
    implements: ["table", "key_value"],
    variants: ["plain", "striped"],
    sizes: ["md", "lg"],
    useWhen:
      "More than about four records with the same attributes, or where comparison across rows matters more than shape.",
    useInsteadWhen: [
      { condition: "two simple records", prefer: "Comparison" },
      { condition: "shape or magnitude matters more than exact values", prefer: "BarChart" },
    ],
    children: { allowed: "none" },
    requiresData: true,
    // Ported verbatim, including the lower bound: a one-row table is not a table
    // with too many rows to chart, it is a finding with nothing to compare.
    fit: (finding) => {
      if (finding.kind === "comparison") {
        if (finding.entities.length < 2) return 0;
        return finding.entities.length > 12 ? 0.95 : 0.15;
      }
      if (finding.kind === "composition") {
        if (finding.parts.length < 2) return 0;
        return finding.parts.length > 12 ? 0.95 : 0.1;
      }
      return 0;
    },
  },

  RankedList: {
    id: "RankedList",
    description: "An ordered list on one measure, with the magnitude visible.",
    category: "data",
    propsSchema: z.object({ label: heading, limit: z.number().int().min(2).max(12).optional() }),
    accepts: ["comparison"],
    implements: ["ranked_list"],
    variants: ["bars", "plain"],
    sizes: ["md", "lg"],
    useWhen: "A top-or-bottom ranking where the order is the message.",
    useInsteadWhen: [{ condition: "each entity has its own history", prefer: "LineChart" }],
    children: { allowed: "none" },
    requiresData: true,
    fit: (finding) => {
      if (finding.kind !== "comparison") return 0;
      const n = finding.entities.length;
      return n >= 3 && n <= 12 ? 0.9 : 0;
    },
  },

  Timeline: {
    id: "Timeline",
    description: "Dated events in order. States, not a measured series.",
    category: "data",
    propsSchema: z.object({ label: heading, direction: z.enum(["down", "right"]).optional() }),
    accepts: ["transition", "requirement", "narrative"],
    implements: ["timeline"],
    variants: [],
    sizes: ["md", "lg"],
    useWhen: "Events placed on a calendar, where order in time carries the meaning.",
    useInsteadWhen: [
      // A line drawn through three dates with no values on them is a lie — the
      // reasoning behind the old decider's `timeline` → transition mapping.
      { condition: "the points carry values and the shape matters", prefer: "LineChart" },
    ],
    children: { allowed: "none" },
    requiresData: true,
  },

  KeyValueList: {
    id: "KeyValueList",
    description: "Labelled attributes of one thing.",
    category: "data",
    propsSchema: z.object({ label: heading.optional(), columns: z.union([z.literal(1), z.literal(2)]).optional() }),
    accepts: ["narrative", "metric", "requirement"],
    implements: ["key_value"],
    variants: [],
    sizes: ["sm", "md"],
    useWhen: "Attributes of a single entity, or methodology behind a figure.",
    children: { allowed: "none" },
    requiresData: true,
  },

  /* ----------------------------------------------------------- visualisation */

  LineChart: {
    id: "LineChart",
    description: "One or more things over time, on one scale.",
    category: "visualisation",
    propsSchema: z.object({
      label: heading,
      compareLabel: label.optional(),
      /** Sparkline drops axes and legend. Not a different component. */
      sparkline: z.boolean().optional(),
      showAxes: z.boolean().optional(),
    }),
    accepts: ["trend", "comparison", "metric"],
    implements: ["chart"],
    variants: ["plain", "benchmarked", "overlaid"],
    sizes: ["sm", "md", "lg"],
    useWhen: "Trend matters more than reading individual values.",
    useInsteadWhen: [
      { condition: "no history is present", prefer: "BarChart" },
      { condition: "more than six series", prefer: "DataTable" },
    ],
    children: { allowed: "none" },
    requiresData: true,
    // Ported: 2 entities with history → overlaid beats paired bars; 3–6 with
    // history stays lines; ≤8 points doesn't justify axes but still draws.
    fit: (finding) => {
      if (finding.kind === "trend") return isPlottable(finding.series) ? (finding.series.points.length > 8 ? 1 : 0.5) : 0;
      if (finding.kind === "comparison") {
        if (!hasEntitySeries(finding)) return 0;
        const n = finding.entities.length;
        if (n === 2) return 1;
        return n >= 3 && n <= 6 ? 0.96 : 0;
      }
      if (finding.kind === "metric") return isPlottable(finding.series) ? 0.3 : 0;
      return 0;
    },
  },

  BarChart: {
    id: "BarChart",
    description: "Magnitude across entities, or parts too many for a donut.",
    category: "visualisation",
    propsSchema: z.object({
      label: heading,
      orientation: z.enum(["horizontal", "vertical"]).optional(),
      stacked: z.boolean().optional(),
    }),
    accepts: ["comparison", "composition"],
    implements: ["chart"],
    variants: ["plain", "paired", "stacked"],
    sizes: ["md", "lg"],
    useWhen: "Magnitude or distribution across a handful of entities, without history.",
    useInsteadWhen: [
      { condition: "each entity has a history", prefer: "LineChart" },
      { condition: "more than twelve rows", prefer: "DataTable" },
    ],
    children: { allowed: "none" },
    requiresData: true,
    fit: (finding) => {
      if (finding.kind === "comparison") {
        const n = finding.entities.length;
        if (n === 2) return hasEntitySeries(finding) ? 0.5 : 0.95;
        return n >= 3 && n <= 12 ? 0.9 : 0;
      }
      if (finding.kind === "composition") {
        const n = finding.parts.length;
        // Above six a donut's slices stop being comparable; above twelve even a
        // stacked bar loses to a table.
        return n > 6 && n <= 12 ? 0.9 : n >= 2 ? 0.2 : 0;
      }
      return 0;
    },
  },

  AllocationDonut: {
    id: "AllocationDonut",
    description: "Parts of one whole, few enough for readable segments.",
    category: "visualisation",
    propsSchema: z.object({ label: heading, showLegend: z.boolean().optional() }),
    accepts: ["composition"],
    implements: ["chart"],
    variants: ["plain", "labelled"],
    sizes: ["sm", "md"],
    useWhen: "Composition of a whole, with six parts or fewer.",
    useInsteadWhen: [{ condition: "more than six parts", prefer: "BarChart" }],
    children: { allowed: "none" },
    requiresData: true,
    fit: (finding) =>
      finding.kind === "composition" && finding.parts.length >= 2 && finding.parts.length <= 6 ? 0.95 : 0,
  },

  ExposureHeatmap: {
    id: "ExposureHeatmap",
    description: "Two dimensions of exposure at once, by intensity.",
    category: "visualisation",
    propsSchema: z.object({ label: heading, rowsLabel: label.optional(), colsLabel: label.optional() }),
    accepts: ["composition", "comparison"],
    implements: ["chart"],
    variants: [],
    sizes: ["md", "lg"],
    useWhen: "A relationship across two dimensions, where the pattern matters more than the cells.",
    useInsteadWhen: [{ condition: "one dimension only", prefer: "BarChart" }],
    children: { allowed: "none" },
    requiresData: true,
  },

  /* ------------------------------------------------------------ intelligence */

  InsightCard: {
    id: "InsightCard",
    description: "A conclusion drawn from the data, not a restatement of it.",
    category: "intelligence",
    propsSchema: z.object({ heading: heading.optional() }),
    accepts: ["narrative", "transition"],
    implements: ["callout", "prose"],
    // "hero" is the universal headline signal, and the validator counts it: exactly
    // one node on a page may claim it. An InsightCard carries it because in an
    // analytical view the conclusion, not a figure, is usually the lead.
    variants: ["plain", "emphasis", "hero"],
    sizes: ["md", "lg"],
    useWhen: "Judgement or context: what this means, rather than what it is.",
    useInsteadWhen: [{ condition: "something is outside where it should be", prefer: "RiskAlert" }],
    children: { allowed: "none" },
    requiresData: true,
    fit: (finding) => (finding.kind === "narrative" ? 0.8 : finding.kind === "transition" ? 0.6 : 0),
  },

  RiskAlert: {
    id: "RiskAlert",
    description: "Something is outside where it should be, and needs attention.",
    category: "intelligence",
    propsSchema: z.object({ heading: heading.optional(), showSeverity: z.boolean().optional() }),
    accepts: ["flag", "transition"],
    implements: ["callout"],
    variants: ["info", "warn", "critical"],
    sizes: ["md", "lg"],
    useWhen: "A breach, a concentration, an unhedged exposure — anything needing a decision.",
    children: { allowed: "none" },
    requiresData: true,
    fit: (finding) => (finding.kind === "flag" ? 1 : finding.kind === "transition" && finding.sentiment === "negative" ? 0.5 : 0),
  },

  Recommendation: {
    id: "Recommendation",
    description: "Do this, because. An argued course of action.",
    category: "intelligence",
    propsSchema: z.object({ heading: heading.optional(), showAction: z.boolean().optional() }),
    accepts: ["recommendation"],
    implements: ["callout"],
    // "hero" rather than a separate "primary": an ActionPlan leads with the
    // recommendation, and one name for the lead means one thing to count.
    variants: ["plain", "hero"],
    sizes: ["md", "lg"],
    useWhen: "A course of action with a rationale behind it.",
    useInsteadWhen: [
      // A recommendation argues a case; a checklist just needs working through.
      { condition: "the reader's question is what is outstanding", prefer: "Checklist" },
    ],
    children: { allowed: "none" },
    requiresData: true,
    fit: (finding) => (finding.kind === "recommendation" ? 1 : 0),
  },

  NewsImpact: {
    id: "NewsImpact",
    description: "External events and what they mean for the holdings.",
    category: "intelligence",
    propsSchema: z.object({ heading: heading.optional(), limit: z.number().int().min(1).max(6).optional() }),
    accepts: ["narrative"],
    implements: ["callout", "prose"],
    variants: [],
    sizes: ["md", "lg"],
    useWhen: "Market context tied to specific positions.",
    children: { allowed: "none" },
    requiresData: true,
  },

  WhatToWatch: {
    id: "WhatToWatch",
    description: "Forward-looking items: what could change, and when.",
    category: "intelligence",
    propsSchema: z.object({ heading }),
    accepts: ["requirement", "narrative", "flag"],
    implements: ["callout"],
    variants: [],
    sizes: ["md", "lg"],
    useWhen: "Closing an analytical view on what happens next.",
    children: { allowed: ["Checklist", "Timeline", "KeyValueList", "InsightCard"], min: 1, max: 3 },
    requiresData: false,
  },

  Checklist: {
    id: "Checklist",
    description: "Things somebody still has to do, with state and owners.",
    category: "intelligence",
    propsSchema: z.object({
      label: heading.optional(),
      showOwners: z.boolean().optional(),
      ordered: z.boolean().optional(),
    }),
    accepts: ["checklist"],
    implements: ["checklist"],
    variants: [],
    sizes: ["md", "lg"],
    useWhen: "Open items to work through. Two or more; one is a sentence.",
    useInsteadWhen: [{ condition: "a single item", prefer: "InsightCard" }],
    children: { allowed: "none" },
    requiresData: true,
    fit: (finding) => (finding.kind === "checklist" && finding.items.length >= 2 ? 1 : 0),
  },

  Comparison: {
    id: "Comparison",
    description: "Two or three options weighed on the same measures.",
    category: "intelligence",
    propsSchema: z.object({
      /** Entity *names*, which are labels rather than facts. */
      entities: z.array(label).min(2).max(3),
      /** Measure names — the row headings. */
      measures: z.array(label).min(1).max(6),
    }),
    accepts: ["comparison", "narrative"],
    implements: ["comparison"],
    variants: ["columns", "rows"],
    sizes: ["md", "lg"],
    useWhen:
      "A decision between a small number of options, where every measure must be visible at once.",
    useInsteadWhen: [
      { condition: "only one measure and more than three options", prefer: "RankedList" },
      { condition: "the options need no decision, only a ranking", prefer: "DataTable" },
    ],
    children: { allowed: "none" },
    requiresData: true,
    fit: (finding) =>
      finding.kind === "comparison" && finding.entities.length >= 2 && finding.entities.length <= 3 ? 0.85 : 0,
  },

  /* ------------------------------------------------------------------ entity */

  ClientCard: {
    id: "ClientCard",
    description: "Who this is: name, segment, coverage, risk profile.",
    category: "entity",
    propsSchema: z.object({ showCoverage: z.boolean().optional() }),
    accepts: ["narrative", "metric"],
    implements: ["key_value"],
    variants: ["plain", "compact"],
    sizes: ["md", "lg"],
    useWhen: "Opening an entity overview, to establish identity before figures.",
    children: { allowed: "none" },
    requiresData: true,
  },

  HoldingCard: {
    id: "HoldingCard",
    description: "One position: size, weight, return, cost basis.",
    category: "entity",
    propsSchema: z.object({ showWeight: z.boolean().optional() }),
    accepts: ["metric", "narrative"],
    implements: ["key_value", "metric"],
    variants: ["plain", "compact"],
    sizes: ["sm", "md"],
    useWhen: "One position deserves standalone emphasis.",
    useInsteadWhen: [
      // The brief's rule, made mechanical: don't render ten identical cards.
      { condition: "more than about four positions", prefer: "DataTable" },
    ],
    children: { allowed: "none" },
    requiresData: true,
  },

  AssetCard: {
    id: "AssetCard",
    description: "A non-portfolio asset: property, private holding, insurance.",
    category: "entity",
    propsSchema: z.object({ showValuation: z.boolean().optional() }),
    accepts: ["metric", "narrative"],
    implements: ["key_value"],
    variants: [],
    sizes: ["sm", "md"],
    useWhen: "An asset outside the managed portfolio that the answer depends on.",
    useInsteadWhen: [{ condition: "more than about four assets", prefer: "DataTable" }],
    children: { allowed: "none" },
    requiresData: true,
  },

  DocumentReference: {
    id: "DocumentReference",
    description: "A document the answer rests on, linked.",
    category: "entity",
    propsSchema: z.object({ showDate: z.boolean().optional() }),
    accepts: ["narrative"],
    implements: ["key_value"],
    variants: [],
    sizes: ["sm", "md"],
    useWhen: "Pointing at evidence the reader may want to open.",
    children: { allowed: "none" },
    requiresData: true,
  },

  SourceList: {
    id: "SourceList",
    description: "Where the figures came from, and as of when.",
    category: "entity",
    propsSchema: z.object({ label: label.optional() }),
    accepts: [],
    implements: ["key_value"],
    variants: [],
    sizes: ["sm"],
    useWhen: "Provenance. Behind disclosure unless the advisor asked about sources.",
    children: { allowed: "none" },
    requiresData: true,
  },
};

/* ------------------------------------------------------------------ helpers */

export const COMPONENT_IDS = Object.keys(REGISTRY) as ComponentId[];

export const isComponentId = (value: string): value is ComponentId => value in REGISTRY;

export const specOf = (id: ComponentId): ComponentSpec => REGISTRY[id];

/** Components implementing an IA form, for the composer to score. */
export const implementing = (form: PresentationForm): ComponentSpec[] =>
  COMPONENT_IDS.map(specOf).filter((spec) => spec.implements.includes(form));

/** Whether `child` may nest directly inside `parent`. */
export function allowsChild(parent: ComponentId, child: ComponentId): boolean {
  const { children } = specOf(parent);
  if (children.allowed === "none") return false;
  if (children.allowed.includes(child)) return true;
  return Object.values(children.named ?? {}).some((allowed) => allowed.includes(child));
}

/** Whether `parent` takes named regions rather than a flat child list. */
export const usesNamedSlots = (parent: ComponentId): boolean => {
  const { children } = specOf(parent);
  if (children.named === undefined) return false;
  // Tabs declares `named: {}` because its region names are the tab labels and are
  // therefore chosen per view; SplitPane declares fixed left/right.
  return Object.keys(children.named).length > 0 || parent === "Tabs";
};

/**
 * Best component for a finding within a chosen form, with the runners-up.
 *
 * The scoring pass from `select.ts`, narrowed: the form has already been decided
 * by the IA rules, so this only breaks ties between the components that implement
 * it. Ties fall to registry declaration order, as before.
 */
export function bestFor(
  form: PresentationForm,
  finding: Finding,
  context: { count: number; siblings: number },
): { id: ComponentId; fit: number; runnersUp: ComponentId[] } | null {
  const scored = implementing(form)
    .filter((spec) => spec.accepts.includes(finding.kind))
    .map((spec) => ({ spec, fit: spec.fit ? spec.fit(finding, context) : 0.5 }))
    .filter((entry) => entry.fit > 0)
    .sort((a, b) => b.fit - a.fit);

  const best = scored[0];
  if (!best) return null;
  return {
    id: best.spec.id,
    fit: best.fit,
    runnersUp: scored.slice(1).map((entry) => entry.spec.id),
  };
}
