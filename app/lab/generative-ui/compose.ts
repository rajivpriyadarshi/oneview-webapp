/**
 * Layers 4, 5 and 7 — the composer.
 *
 * Semantic report in, UI spec out, deterministically. No model runs in this file,
 * and that is the point of the whole architecture: the model decides what is true
 * and what it means; *this* decides what the page looks like. Rules, not taste.
 *
 * Three passes, in order, each with its own reason to exist:
 *
 *   1. `planIA` — group sections into areas and choose an arrangement and a
 *      presentation form for each. Explicit rules over *sets* of sections: tabs for
 *      2–5 sibling views of one question, a table past the point where cards stop
 *      being readable, a grid only for genuinely independent items, disclosure for
 *      provenance. Every decision is recorded in `trace` with the rule that made it.
 *   2. Recipe selection (`selectRecipe`) — which page shape this job wants, and
 *      therefore what order the areas appear in. Slot order beats importance, so a
 *      primary recommendation still lands at the end of an analytical report.
 *   3. `buildSpec` — turn areas into approved components. The registry decides which
 *      component implements a form (`bestFor`), and props carry labels and
 *      arrangement only. Data arrives by `dataKey`.
 *
 * What replaces what: prototype 1's `select.ts` was `selectRenderer(finding) →
 * RendererId`, a function of one finding, which is why ten findings always produced
 * ten cards — there was no signature in which "these four belong in a table" could
 * be said. Its scoring thresholds survive, in the registry's `fit` functions, and
 * are consulted here to break ties *within* a form that these rules have already
 * chosen. `compose.ts` (the old one) sorted by emphasis and packed rows greedily;
 * `critique.ts` then repaired the result. Both jobs move here, before anything is
 * built, where a decision can be made rather than undone.
 *
 * The invariant this file must never break: it may group, rank, label, choose a
 * component, choose disclosure and choose emphasis. It may not touch a figure. Every
 * value a reader sees comes from a `Finding` the analysis wrote or from a bundle key
 * a tool returned — never from anything computed here.
 */

import { hasKey, type DataBundle } from "./data";
import { cardinalityOf, hasEntitySeries, isPlottable, type Finding } from "./findings";
import type { ChartIntent, IAArea, IAPlan, PresentationForm, SectionPresentation } from "./ia";
import type { IntentPlan } from "./intent";
import { RECIPES, candidateSlots, selectRecipe, type RecipeId, type RecipeSlot, type ViewRecipe } from "./recipes";
import { bestFor, specOf, type ComponentId } from "./registry";
import { questionGroups, sectionById, type SemanticReport, type SemanticSection } from "./semantic";
import type { UINode, UISpec } from "./spec";
import { FIGURE } from "./validate";

/* ------------------------------------------------------------------- labels */

const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/**
 * A label the validator will accept: bounded, and with no figure in it.
 *
 * The figure check is the same one `validate.ts` runs, imported rather than
 * restated — a composer that produces props its own validator rejects is a bug the
 * fallback would hide. Candidates are tried in order and the last one is trusted,
 * so callers pass a constant at the end.
 */
function safeText(max: number, ...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (!text || FIGURE.test(text)) continue;
    return clip(text, max);
  }
  return "Detail";
}

const safeLabel = (...candidates: (string | undefined)[]): string => safeText(60, ...candidates);
const safeHeading = (...candidates: (string | undefined)[]): string => safeText(80, ...candidates);

/** A question read as a heading: "How did the portfolio do?" → "How did the portfolio do". */
const asHeading = (question: string): string => question.replace(/\s*\?\s*$/, "");

const SEMANTIC_HEADINGS: Record<string, string> = {
  performance: "Performance",
  drivers: "Performance drivers",
  allocation: "Allocation",
  risk: "Risk",
  liquidity: "Liquidity",
  market_context: "Market context",
  activity: "Activity",
  commitments: "Commitments",
  recommendations: "Recommendation",
  actions: "Actions",
  comparison: "Options",
  identity: "Overview",
  evidence: "Sources and method",
  summary: "Summary",
};

/* -------------------------------------------------------------- layer 4: IA */

/** The finding an area's decisions are made about: highest emphasis, first wins. */
function dominant(section: SemanticSection): Finding | undefined {
  const order = { primary: 0, secondary: 1, supporting: 2 } as const;
  return [...section.findings].sort((a, b) => order[a.emphasis] - order[b.emphasis])[0];
}

const countOf = (section: SemanticSection, kind: Finding["kind"]): number =>
  section.findings.filter((finding) => finding.kind === kind).length;

/**
 * What a section should become.
 *
 * The brief's rules, as a switch over the shape of the evidence rather than over
 * anybody's preference:
 *
 *   - two or more sibling figures read together are a strip, one is a metric;
 *   - repeated records stop being readable as cards or a chart past about a dozen,
 *     and become a table — the old `select.ts` thresholds, kept;
 *   - entities that each carry a history are lines, because the shape is the claim;
 *   - two or three options weighed on a measure is a comparison, more is a ranking;
 *   - a chart earns its place only when trend, distribution, composition or
 *     magnitude matters more than reading the exact numbers, and `chartOf` records
 *     which of those the reason was.
 */
function formOf(finding: Finding): { form: PresentationForm; chartOf?: ChartIntent } {
  switch (finding.kind) {
    case "metric":
      return { form: "metric" };
    case "trend":
      return isPlottable(finding.series) ? { form: "chart", chartOf: "trend" } : { form: "metric" };
    case "comparison": {
      const n = finding.entities.length;
      if (n > 12) return { form: "table" };
      if (hasEntitySeries(finding)) return { form: "chart", chartOf: "trend" };
      if (n <= 3) return { form: "comparison" };
      return { form: "ranked_list" };
    }
    case "composition": {
      const n = finding.parts.length;
      if (n > 12) return { form: "table" };
      return { form: "chart", chartOf: n > 6 ? "distribution" : "composition" };
    }
    case "requirement":
      return { form: "timeline" };
    case "checklist":
      return { form: "checklist" };
    case "recommendation":
    case "flag":
    case "transition":
      return { form: "callout" };
    case "narrative":
      return { form: "prose" };
  }
}

function formFor(section: SemanticSection): { form: PresentationForm; chartOf?: ChartIntent } {
  if (section.semanticType === "evidence") return { form: "key_value" };

  const finding = dominant(section);
  if (!finding) return { form: "prose" };

  /* Sibling figures read together are a strip; one figure is a metric. */
  if (finding.kind === "metric" && countOf(section, "metric") >= 2) return { form: "metric_strip" };

  /*
   * Several comparisons in one section are the same entities on different measures —
   * five holdings by weight, by return, by P/L. A `Comparison` component takes three
   * entities and one measure, so it cannot state that claim without dropping both
   * entities and measures; a table states it and stays readable as the entity count
   * grows. This is the rule that makes "compare the top 5" scale past the top 3.
   */
  if (finding.kind === "comparison" && countOf(section, "comparison") >= 2) return { form: "table" };

  return formOf(finding);
}

/**
 * How an area's sections stand to each other on the page.
 *
 * `tabs` is the one with a real condition attached, and it is deliberately narrow:
 * sibling views of the *same question*, each naming which view it is, two to five of
 * them, and only one needed at a time. Sections that merely ended up adjacent never
 * qualify. Two sections the analysis marked as contrasting are a split instead,
 * because hiding one of two things being weighed against each other loses the point.
 */
function arrangementFor(
  group: SemanticSection[],
  report: SemanticReport,
  slot: RecipeSlot,
): { arrangement: IAArea["arrangement"]; rule: string; because: string } {
  if (slot.arrangement) {
    return {
      arrangement: slot.arrangement,
      rule: "recipe.slot-arrangement",
      because: `The ${slot.id} slot fixes how its contents read.`,
    };
  }

  if (group.length >= 2) {
    const siblings = group.every((section) => (section.groups?.length ?? 0) > 0);
    if (siblings && group.length <= 5) {
      return {
        arrangement: "tabs",
        rule: "ia.tabs-for-sibling-views",
        because: `${group.length} views of the same question, and only one is needed at a time.`,
      };
    }
    const contrasted = (report.relations ?? []).some(
      (relation) =>
        relation.kind === "contrasts" && group.every((section) => relation.sectionIds.includes(section.id)),
    );
    if (group.length === 2 && contrasted) {
      return {
        arrangement: "split",
        rule: "ia.split-for-contrast",
        because: "These two are being weighed against each other, so both stay visible.",
      };
    }

    /*
     * The same shape repeated over different data.
     *
     * Six identical bar-chart cards in a grid is not information architecture, it is
     * a dump: every card looks the same, so the page reads as one texture and the
     * reader has to work through titles to find anything. When three to five sections
     * resolve to the *same form* over *different data*, the repetition is itself the
     * argument for tabs — one is read at a time, and which one is the reader's choice
     * rather than the composer's guess.
     *
     * Two guards keep this from swallowing the page. Never when one of them is
     * `primary`: hiding the answer to the question behind a tab is worse than
     * repeating a shape. And bounded at five, by the same reasoning as sibling views —
     * past that the tab strip is its own navigation problem, and a stack is honest.
     */
    const forms = new Set(group.map((section) => formFor(section).form));
    if (forms.size === 1 && group.length >= 3 && group.length <= 5) {
      const answers = group.some((section) => section.importance === "primary");
      if (!answers) {
        return {
          arrangement: "tabs",
          rule: "ia.tabs-for-repeated-shape",
          because: `${group.length} sections of the same shape over different data; one is read at a time.`,
        };
      }
    }

    return {
      arrangement: "stack",
      rule: "ia.stack-related",
      because: "Related sections, read in order.",
    };
  }

  const section = group[0];
  const { form } = formFor(section);
  if (form === "table") {
    return {
      arrangement: "table",
      rule: "ia.table-for-many-records",
      because: "Too many records with the same attributes to read any other way.",
    };
  }
  if (form === "metric_strip") {
    return {
      arrangement: "grid",
      rule: "ia.grid-for-sibling-figures",
      because: "Figures of comparable weight, read together at a glance.",
    };
  }
  return { arrangement: "single", rule: "ia.single", because: "One thing to say here." };
}

export type IAResult = { plan: IAPlan; recipe: ViewRecipe; recipeId: RecipeId; unplaced: string[] };

/**
 * Group the report into areas and place them in the recipe's slots.
 *
 * Placement is first-fit in page order, bounded twice — by each slot's `maxAreas`
 * and by the recipe's total. The caps are the brief's "fewer, stronger sections" in
 * the only form that survives a model having a productive afternoon, and anything
 * that does not fit is reported as unplaced rather than dropped quietly.
 */
export function planIA(report: SemanticReport, intent: IntentPlan): IAResult {
  const recipeId = selectRecipe(report.reportType, intent.needs);
  const recipe = RECIPES[recipeId];

  const trace: IAPlan["trace"] = [
    {
      rule: "recipe.select",
      because: `${recipeId} — ${recipe.description}`,
      targets: [recipeId],
    },
  ];

  const groups = questionGroups(report);
  const used = new Map<string, number>();
  const areas: IAArea[] = [];
  const unplaced: string[] = [];

  /* Slot order is the page's order, so groups are considered in the order their
     slot appears rather than in the order the model happened to emit them. */
  const slotIndex = (group: SemanticSection[]): number => {
    const candidates = candidateSlots(recipe, group[0].semanticType);
    return candidates.length > 0 ? recipe.slots.indexOf(candidates[0]) : recipe.slots.length;
  };
  const ordered = [...groups].sort((a, b) => slotIndex(a) - slotIndex(b));

  for (const group of ordered) {
    const slot = candidateSlots(recipe, group[0].semanticType).find(
      (candidate) => (used.get(candidate.id) ?? 0) < candidate.maxAreas,
    );

    if (!slot || areas.length >= recipe.maxAreas) {
      unplaced.push(...group.map((section) => section.id));
      trace.push({
        rule: slot ? "recipe.area-budget" : "recipe.no-slot",
        because: slot
          ? `The page is full at ${recipe.maxAreas} areas; fewer, stronger sections read better.`
          : `${recipeId} has no slot for ${group[0].semanticType}.`,
        targets: group.map((section) => section.id),
      });
      continue;
    }

    used.set(slot.id, (used.get(slot.id) ?? 0) + 1);
    const { arrangement, rule, because } = arrangementFor(group, report, slot);
    trace.push({ rule, because, targets: group.map((section) => section.id) });

    const presentation: Record<string, SectionPresentation> = {};
    for (const section of group) {
      const { form, chartOf } = formFor(section);
      presentation[section.id] = {
        form,
        chartOf,
        emphasis: section.importance === "supporting" ? "quiet" : "normal",
        disclosure: section.semanticType === "evidence" ? "collapsed" : (slot.disclosure ?? "open"),
        because:
          chartOf === undefined
            ? `${form.replace(/_/g, " ")} — ${asHeading(section.question).toLowerCase()}.`
            : `A chart because ${chartOf} matters more here than the exact values.`,
      };
    }

    /* One heading per area, from the question its sections share — which is how
       contributors and detractors become "Performance drivers" rather than two
       unrelated charts with two headings. */
    const heading =
      group.length > 1
        ? safeHeading(slot.defaultHeading, asHeading(group[0].question))
        : safeHeading(
            asHeading(group[0].question),
            slot.defaultHeading,
            SEMANTIC_HEADINGS[group[0].semanticType],
          );

    areas.push({
      id: `area_${slot.id}_${areas.length}`,
      heading,
      sectionIds: group.map((section) => section.id),
      rank: recipe.slots.indexOf(slot) * 10 + (used.get(slot.id) ?? 1),
      importance: group[0].importance,
      arrangement,
      presentation,
    });
  }

  /*
   * Exactly one entry point. `critique.ts` rules 2 and 3 — a page where everything
   * is the same weight has none, and a page with three has none either — made a
   * decision instead of a repair. The first area in page order carries it.
   */
  const lead = [...areas].sort((a, b) => a.rank - b.rank)[0];
  const leadSection = lead?.sectionIds[0];
  if (lead && leadSection) {
    lead.presentation[leadSection] = { ...lead.presentation[leadSection], emphasis: "hero" };
    trace.push({
      rule: "ia.one-headline",
      because: "A page needs exactly one entry point, and it is the first thing in reading order.",
      targets: [leadSection],
    });
  }

  /* A required slot with nothing in it means the recipe was the wrong shape, not
     that the view has a hole. The caller falls back to the text answer. */
  const missing = recipe.slots
    .filter((slot) => slot.required && (used.get(slot.id) ?? 0) === 0)
    .map((slot) => slot.id);
  if (missing.length > 0) {
    trace.push({
      rule: "recipe.required-slot-empty",
      because: `${recipeId} needs ${missing.join(", ")} and the report has nothing for it.`,
      targets: missing,
    });
  }

  return { plan: { areas, trace }, recipe, recipeId, unplaced };
}

/** Whether the plan filled every slot its recipe insists on. */
export const recipeSatisfied = (result: IAResult): boolean =>
  result.recipe.slots
    .filter((slot) => slot.required)
    .every((slot) =>
      result.plan.areas.some((area) => area.id.startsWith(`area_${slot.id}_`)),
    );

/* -------------------------------------------------------- layer 7: the spec */

/** Where a form has no scored winner, the kind decides. Every entry accepts its kind. */
const FALLBACK_COMPONENT: Record<Finding["kind"], ComponentId> = {
  metric: "Metric",
  trend: "LineChart",
  comparison: "RankedList",
  composition: "BarChart",
  transition: "InsightCard",
  requirement: "Timeline",
  narrative: "InsightCard",
  recommendation: "Recommendation",
  flag: "RiskAlert",
  checklist: "Checklist",
};

function componentFor(
  form: PresentationForm,
  finding: Finding,
  section: SemanticSection,
  siblings: number,
): ComponentId {
  if (section.semanticType === "evidence") return "SourceList";
  const scored = bestFor(form, finding, { count: cardinalityOf(finding), siblings });
  return scored?.id ?? FALLBACK_COMPONENT[finding.kind];
}

/**
 * Which bundle key a section's components bind to.
 *
 * The declared keys first, then the nearest namespace match, then nothing. The
 * fallback exists because `dataKeys` is written by the model and a key that does not
 * resolve costs the whole area — matching `perf.monthly` to `perf.series` is worth
 * doing, inventing a key is not.
 */
function bindingFor(section: SemanticSection, bundle: DataBundle): string | undefined {
  const declared = section.dataKeys.find((key) => hasKey(bundle, key));
  if (declared) return declared;

  const available = Object.keys(bundle.values);
  for (const key of section.dataKeys) {
    const head = key.split(".")[0];
    const near = available.find((candidate) => candidate.split(".")[0] === head);
    if (near) return near;
  }
  return undefined;
}

/**
 * Presentation props, and only presentation props.
 *
 * Every string here is a label, a heading or a name; every number is a count or a
 * limit. Nothing in this function can put a figure on the page — the values come
 * from the finding and the bundle at render time, which is what `dataKey` is for.
 * `safeLabel`/`safeHeading` are the belt and braces: a heading the analysis wrote
 * with a figure in it gets replaced rather than passed through.
 */
function propsFor(
  component: ComponentId,
  finding: Finding,
  section: SemanticSection,
  presentation: SectionPresentation,
  heading: string,
): Record<string, unknown> {
  const spec = specOf(component);
  const props: Record<string, unknown> = {};

  const fallbackHeading = SEMANTIC_HEADINGS[section.semanticType];
  const title = safeHeading(heading, asHeading(section.question), fallbackHeading);

  switch (component) {
    case "Metric":
      props.label = safeLabel(
        finding.kind === "metric" ? finding.label : undefined,
        finding.subject,
        fallbackHeading,
      );
      if (finding.kind === "metric" && finding.delta) props.showDelta = true;
      break;

    case "MetricStrip":
      props.columns = 3;
      props.heading = title;
      break;

    case "DataTable":
      props.label = title;
      props.compact = cardinalityOf(finding) > 8;
      break;

    case "RankedList":
      props.label = title;
      props.limit = Math.max(2, Math.min(cardinalityOf(finding), 12));
      break;

    case "Timeline":
      props.label = title;
      break;

    case "KeyValueList":
      props.label = title;
      break;

    case "LineChart":
      props.label = title;
      // A sparkline is a line chart that has given up its axes, not a different
      // component — so a quiet section keeps the shape and loses the furniture.
      if (presentation.emphasis === "quiet") props.sparkline = true;
      break;

    case "BarChart":
      props.label = title;
      if (finding.kind === "composition" && finding.parts.length > 6) props.stacked = true;
      break;

    case "AllocationDonut":
      props.label = title;
      props.showLegend = true;
      break;

    case "ExposureHeatmap":
      props.label = title;
      break;

    case "InsightCard":
      // No `heading`: an InsightCard draws the finding's own heading, and passing a
      // second one would put two competing titles on one card.
      break;

    case "RiskAlert":
      props.showSeverity = true;
      break;

    case "Recommendation":
      props.showAction = true;
      break;

    case "NewsImpact":
      props.limit = 3;
      break;

    case "Checklist":
      props.label = title;
      props.showOwners = true;
      break;

    case "Comparison": {
      const names =
        finding.kind === "comparison"
          ? finding.entities.map((entity) => entity.name).filter((name) => !FIGURE.test(name))
          : [];
      props.entities = names.slice(0, 3).map((name) => clip(name, 60));
      props.measures = [
        safeLabel(finding.kind === "comparison" ? finding.measure : undefined, fallbackHeading),
      ];
      break;
    }

    case "ClientCard":
      props.showCoverage = true;
      break;
    case "HoldingCard":
      props.showWeight = true;
      break;
    case "AssetCard":
      props.showValuation = true;
      break;
    case "DocumentReference":
      props.showDate = true;
      break;

    case "SourceList":
      props.label = safeLabel("Sources", fallbackHeading);
      break;

    default:
      break;
  }

  /* Emphasis is expressed with the variants and sizes the component declares, and
     silently dropped where it declares none — the alternative is a validation error
     for a decision that was only ever a preference. */
  if (presentation.emphasis === "hero" && spec.variants.includes("hero")) {
    props.variant = "hero";
    if (spec.sizes.includes("lg")) props.size = "lg";
  } else if (presentation.emphasis === "quiet" && spec.sizes.includes("sm")) {
    props.size = "sm";
  }

  return props;
}

type Builder = {
  bundle: DataBundle;
  /** Findings already spoken for, in document order. Mirrors the renderer's claim. */
  claimed: Set<string>;
  /** Every node made, in document order, for the headline pass. */
  created: UINode[];
  counter: { n: number };
  unplaced: string[];
};

const uid = (build: Builder, base: string): string => {
  build.counter.n += 1;
  return `${base}_${build.counter.n}`;
};

/**
 * The next finding in a section this component could draw.
 *
 * Deliberately the same algorithm the renderer uses (`SpecRenderer.claimFinding`):
 * first unclaimed finding whose kind the component accepts. Two implementations of
 * one rule is a real risk, and the alternative — a `findingId` on every node — would
 * hand the composer a finer grip on the report's contents than it needs. Both walk
 * the tree in document order, so both land on the same finding.
 */
function claim(build: Builder, section: SemanticSection, accepts: Finding["kind"][]): Finding | undefined {
  const fits = accepts.length > 0 ? section.findings.filter((f) => accepts.includes(f.kind)) : section.findings;
  const pool = fits.length > 0 ? fits : section.findings;
  const fresh = pool.find((finding) => !build.claimed.has(finding.id));
  const chosen = fresh ?? pool[0];
  if (chosen) build.claimed.add(chosen.id);
  return chosen;
}

/** The node (or nodes) a section becomes. Empty when there is nothing to draw. */
function nodesForSection(
  build: Builder,
  section: SemanticSection,
  presentation: SectionPresentation,
  heading: string,
  siblings: number,
): UINode[] {
  if (section.findings.length === 0) {
    build.unplaced.push(section.id);
    return [];
  }

  const binding = bindingFor(section, build.bundle);

  const make = (
    finding: Finding,
    form: PresentationForm,
    emphasis: SectionPresentation,
    label = heading,
  ): UINode | null => {
    const component = componentFor(form, finding, section, siblings);
    const spec = specOf(component);
    if (spec.requiresData && !binding) return null;

    const node: UINode = {
      id: uid(build, `n_${section.id}`),
      component,
      props: propsFor(component, finding, section, emphasis, label),
      sectionId: section.id,
      because: emphasis.because,
      ...(binding ? { dataKey: binding } : {}),
    };
    build.created.push(node);
    return node;
  };

  /*
   * A strip of sibling figures is a bounded grid of metrics, not one component over
   * an unbounded list. Four is the ceiling the brief names and the validator
   * enforces; past it the honest answer is a table, and `formFor` has already said
   * so for the cases where the count is known from the finding.
   */
  if (presentation.form === "metric_strip") {
    const metrics = section.findings.filter((finding) => finding.kind === "metric").slice(0, 4);
    const cells = metrics
      .map((finding, index) =>
        make(finding, "metric", index === 0 ? presentation : { ...presentation, emphasis: "normal" }),
      )
      .filter((node): node is UINode => node !== null);
    for (const finding of metrics) build.claimed.add(finding.id);

    if (cells.length === 0) return [];
    if (cells.length === 1) return cells;
    return [
      {
        id: uid(build, `g_${section.id}`),
        component: "Grid",
        props: { columns: Math.min(cells.length, 4) as 2 | 3 | 4 },
        children: cells,
      },
    ];
  }

  const kinds = section.semanticType === "evidence" ? [] : componentAccepts(presentation.form);
  const finding = claim(build, section, kinds);
  if (!finding) {
    build.unplaced.push(section.id);
    return [];
  }

  const node = make(finding, presentation.form, presentation);
  if (!node) {
    build.unplaced.push(section.id);
    return [];
  }

  /*
   * Everything else the section says.
   *
   * A section is a *group* of claims, and until this loop existed only one of them
   * reached the page: three flags became a single callout, a composition beside a
   * transition lost the transition, and five holdings on three measures showed one
   * measure. The report read thinner than the analysis actually was, and nothing
   * said so — the dropped findings were not even counted as unplaced.
   *
   * Two things keep this from turning into a dump. Nothing here can introduce a
   * claim: every node draws a finding the analysis already wrote, chosen by its own
   * shape via `formOf`, so the page gets fuller without the composer getting a
   * voice. And it is bounded — a section with a dozen claims in it is an analysis
   * problem, not a layout opportunity.
   */
  const extras: UINode[] = [];
  if (section.semanticType !== "evidence") {
    const rest = section.findings.filter((left) => !build.claimed.has(left.id)).slice(0, 4);
    for (const left of rest) {
      build.claimed.add(left.id);
      // Its own name, not the section's: three tables all headed by the same question
      // is the shape of the section, not the content of the claim.
      const own = left.kind === "comparison" ? left.measure : left.kind === "metric" ? left.label : left.subject;
      const extra = make(left, formOf(left).form, { ...presentation, emphasis: "normal" }, own);
      if (extra) extras.push(extra);
    }
  }

  if (extras.length === 0) return [node];
  return [
    {
      id: uid(build, `k_${section.id}`),
      component: "Stack",
      props: { gap: "normal" },
      children: [node, ...extras],
    },
  ];
}

/**
 * Finding kinds a form can be built from.
 *
 * Used to pick which of a section's findings the node will draw before the
 * component is chosen — the component is chosen *from* the finding, so the order
 * has to be this way round.
 */
function componentAccepts(form: PresentationForm): Finding["kind"][] {
  switch (form) {
    case "metric":
    case "metric_strip":
      return ["metric"];
    case "chart":
      return ["trend", "comparison", "composition", "metric"];
    case "table":
      return ["comparison", "composition"];
    case "ranked_list":
      return ["comparison"];
    case "timeline":
      return ["requirement", "transition", "narrative"];
    case "checklist":
      return ["checklist"];
    case "comparison":
      return ["comparison", "narrative"];
    case "callout":
      return ["recommendation", "flag", "transition", "narrative"];
    case "key_value":
      return ["narrative", "metric", "requirement"];
    case "prose":
      return ["narrative", "transition"];
  }
}

/**
 * A tab's or a pane's name: which sibling view this section is.
 *
 * A tab strip is read sideways, so the name has to be a noun and it has to be short.
 * `groups` is the analysis saying exactly that ("contributors", "YTD") and is always
 * preferred. Where tabs came from the repeated-shape rule instead there is no
 * `groups`, and the section's *question* is a sentence — so the topic of its leading
 * finding stands in, and the question is only a last resort before "View 2".
 */
const regionName = (section: SemanticSection, index: number): string =>
  clip(
    safeLabel(section.groups?.[0], dominant(section)?.subject, asHeading(section.question), `View ${index + 1}`),
    28,
  );

/**
 * One area, wrapped in whatever its arrangement calls for.
 *
 * Note what a container never receives: a `dataKey`. Arrangement has no channel to
 * a figure, which is why grouping decisions cannot change the facts even in
 * principle rather than merely by convention.
 */
function buildArea(build: Builder, area: IAArea, report: SemanticReport, recipe: ViewRecipe): UINode | null {
  const sections = area.sectionIds
    .map((id) => sectionById(report, id))
    .filter((section): section is SemanticSection => section !== undefined);
  if (sections.length === 0) return null;

  const collapsed = sections.every(
    (section) => area.presentation[section.id]?.disclosure === "collapsed",
  );

  const per = sections.map((section, index) => ({
    section,
    index,
    nodes: nodesForSection(
      build,
      section,
      area.presentation[section.id] ?? {
        form: "prose",
        emphasis: "normal",
        disclosure: "open",
        because: "Nothing more specific applied.",
      },
      sections.length > 1 ? asHeading(section.question) : area.heading,
      sections.length,
    ),
  })).filter((entry) => entry.nodes.length > 0);

  if (per.length === 0) return null;

  /* Tabs and split panes take named regions; a region holding two nodes gets a
     Stack, because the registry allows a Stack there and not a loose pair. */
  const region = (nodes: UINode[]): UINode[] =>
    nodes.length <= 1
      ? nodes
      : [{ id: uid(build, "st"), component: "Stack", props: { gap: "normal" }, children: nodes }];

  let body: UINode[];

  if (area.arrangement === "tabs" && per.length >= 2 && per.length <= 5) {
    const slots: Record<string, UINode[]> = {};
    for (const entry of per) slots[regionName(entry.section, entry.index)] = region(entry.nodes);
    body = [
      {
        id: uid(build, "tabs"),
        component: "Tabs",
        props: { label: safeHeading(area.heading), variant: "underline" },
        slots,
      },
    ];
  } else if (area.arrangement === "split" && per.length === 2) {
    body = [
      {
        id: uid(build, "split"),
        component: "SplitPane",
        props: {
          leftLabel: regionName(per[0].section, 0),
          rightLabel: regionName(per[1].section, 1),
          ratio: "even",
        },
        slots: { left: region(per[0].nodes), right: region(per[1].nodes) },
      },
    ];
  } else {
    body = per.flatMap((entry) => entry.nodes);
  }

  /* Provenance and methodology open collapsed. The brief's disclosure rule, and the
     one place the composer is allowed to decide something is not worth the first
     scan — because layer 3 already said so by putting it in an evidence section. */
  if (collapsed) {
    const inner = body.every((node) => node.component !== "Section")
      ? body
      : [{ id: uid(build, "st"), component: "Stack" as ComponentId, props: {}, children: body }];
    return {
      id: uid(build, area.id),
      component: "Disclosure",
      props: { label: safeLabel(area.heading, "Sources and method") },
      children: inner.slice(0, 4),
    };
  }

  /*
   * An analytical report closes on what happens next, and `WhatToWatch` is the
   * component for it — but only when everything in the area is something it may
   * hold. Where it is not, an ordinary Section says the same thing without
   * pretending, which is cheaper than a special case that renders wrong.
   */
  const forward =
    recipe.id === "AnalyticalReport" &&
    area.id.startsWith("area_actions_") &&
    body.every((node) =>
      (["Checklist", "Timeline", "KeyValueList", "InsightCard"] as ComponentId[]).includes(node.component),
    );
  if (forward) {
    return {
      id: uid(build, area.id),
      component: "WhatToWatch",
      props: { heading: safeHeading(area.heading, "What to watch") },
      children: body.slice(0, 3),
    };
  }

  return {
    id: uid(build, area.id),
    component: "Section",
    props: { heading: safeHeading(area.heading) },
    children: body.slice(0, 8),
  };
}

export type ComposeResult = {
  spec: UISpec;
  ia: IAPlan;
  recipeId: RecipeId;
  /** Sections that never made it onto the page, stated rather than dropped. */
  unplaced: string[];
};

/**
 * Semantic report + intent + data → a validated-shape UI spec.
 *
 * Never throws and never returns a partial tree: a report with nothing placeable
 * yields a spec with only its header, which the caller's validator will reject in
 * favour of the narrative. That is the intended path, not a failure — §14's
 * fallback is the answer, and it is always there.
 */
export function composeView(
  report: SemanticReport,
  intent: IntentPlan,
  bundle: DataBundle,
): ComposeResult {
  const ia = planIA(report, intent);
  const build: Builder = {
    bundle,
    claimed: new Set(),
    created: [],
    counter: { n: 0 },
    unplaced: [...ia.unplaced],
  };

  const header: UINode = {
    id: "header",
    component: "PageHeader",
    props: {
      eyebrow: safeLabel(intent.timeRange.label, SEMANTIC_HEADINGS[report.reportType], "Report"),
      subtitle: safeText(120, report.summary, intent.goal),
    },
  };

  const areas = [...ia.plan.areas].sort((a, b) => a.rank - b.rank);
  const body = areas
    .map((area) => buildArea(build, area, report, ia.recipe))
    .filter((node): node is UINode => node !== null);

  /*
   * The headline, placed after the fact.
   *
   * `planIA` names the section that should lead, but whether it *can* depends on the
   * component the registry chose — a RiskAlert has no hero variant and forcing one
   * would be an invalid prop. So if the intended lead could not take it, the first
   * node in reading order that can does instead, and a page that genuinely has no
   * candidate simply has no hero. The validator warns; it does not block.
   */
  if (!build.created.some((node) => node.props.variant === "hero")) {
    const candidate = build.created.find((node) => specOf(node.component).variants.includes("hero"));
    if (candidate) {
      candidate.props.variant = "hero";
      if (specOf(candidate.component).sizes.includes("lg")) candidate.props.size = "lg";
    }
  }

  const spec: UISpec = {
    id: `view_${report.reportType}`,
    recipe: ia.recipeId,
    root: [header, ...body],
    narrative: report.narrative,
    meta: {
      reportId: report.title,
      trace: ia.plan.trace,
      unplacedSectionIds: [...new Set(build.unplaced)],
    },
  };

  return { spec, ia: ia.plan, recipeId: ia.recipeId, unplaced: spec.meta.unplacedSectionIds };
}
