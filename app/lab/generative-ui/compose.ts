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
import { cardinalityOf, hasEntitySeries, isPlottable, measureGroup, type Finding } from "./findings";
import type { ChartIntent, IAArea, IAPlan, PresentationForm, SectionPresentation } from "./ia";
import type { IntentPlan } from "./intent";
import { RECIPES, candidateSlots, selectRecipe, type RecipeId, type RecipeSlot, type ViewRecipe } from "./recipes";
import { bestFor, specOf, type ComponentId } from "./registry";
import {
  headlineFigures,
  openingSection,
  questionGroups,
  sectionById,
  type SemanticReport,
  type SemanticSection,
} from "./semantic";
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

/**
 * What the document calls itself, by task type. The masthead's eyebrow.
 *
 * A label, not a claim: it names the kind of report the planner asked for, which is
 * already decided by the time this file runs.
 */
const REPORT_KIND: Record<string, string> = {
  portfolio_review: "Portfolio review",
  /* "Portfolio review" rather than "Balance sheet review", because the recipe this task
     type selects leads with what the portfolio is and what it owes. A balance sheet is
     what you call it when there are liabilities on the other side. */
  property_review: "Portfolio review",
  comparison: "Comparison",
  meeting_prep: "Meeting preparation",
  liquidity_planning: "Liquidity plan",
  activity_review: "Activity review",
  risk_review: "Risk review",
  action_plan: "Action plan",
  entity_overview: "Entity overview",
  explanation: "Explanation",
  lookup: "Summary",
};

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
  /*
   * An activity section is a chronology, by definition of what the analysis put in it.
   *
   * The rule is about the *section*, not the finding, which is why it cannot be derived
   * from `formOf` — "what changed since the last review" is four dated events, and the
   * findings describing them are ordinary narratives and transitions that would otherwise
   * resolve to paragraphs and callouts. A column of four callouts loses the one thing the
   * reader is asking for here, which is the order they happened in.
   */
  if (section.semanticType === "activity") return { form: "timeline" };

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
/**
 * A section that says nothing the executive summary has not already said.
 *
 * The document now opens on `report.summary`, so a summary section whose prose *is* that
 * sentence prints it twice, one block apart, and the reader's first impression of the
 * report is that it repeats itself. This is a disclosure decision, which the composer is
 * allowed to make, and it removes nothing: the claim is on the page, at the top, in the
 * words the analysis wrote.
 *
 * Deliberately narrow. Only a `summary` section, only when *every* finding in it is
 * prose, and only on containment — a summary section that also carries a figure, a
 * comparison or a flag is saying something extra and stays.
 */
function restatesSummary(group: SemanticSection[], report: SemanticReport): boolean {
  const lead = report.summary.trim();
  if (lead.length < 24) return false;
  return group.every(
    (section) =>
      section.semanticType === "summary" &&
      section.findings.length > 0 &&
      section.findings.every((finding) => finding.kind === "narrative" && lead.includes(finding.text.trim())),
  );
}

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

  const groups = questionGroups(report).filter((group) => !restatesSummary(group, report));
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

    /*
     * The slot's name first, the question only where the slot is already taken.
     *
     * This was the other way round for single-section areas, and it is what made the page
     * read as a list of the analysis's questions — "1. What is the balance sheet worth",
     * "2. How is the book invested". Two problems with that. The headings are generated, so
     * they vary run to run and between clients, and a document whose section names move is
     * one a reader cannot learn; and a question is a sentence, which is the wrong grammar
     * for a numbered heading. The recipe's names are fixed, short and in the reader's
     * language rather than the pipeline's.
     *
     * Second and third areas in one slot still take their question, because three sections
     * all headed "What changed" is worse than a sentence — the number would be the only
     * thing distinguishing them. So the structural name goes to the first, which is the one
     * the reader anchors on, and the others say what they are.
     */
    const nth = (used.get(slot.id) ?? 1) - 1;
    const structural = nth === 0 ? slot.defaultHeading : slot.moreHeadings?.[nth - 1];
    /*
     * A continuation slot has no heading at all, on purpose.
     *
     * Some of what a section says is a second look at the section before it — the
     * concentration the rally created is part of "what drove the change", not a ninth thing
     * to read — and a heading would make it a new topic in the reader's count. So the
     * recipe can declare a slot that continues its neighbour: no name, no number, the
     * section's own one-line takeaway carrying the link. It is still its own area, so the
     * composer's rules about form and arrangement apply unchanged.
     */
    const heading = slot.continuation
      ? undefined
      : safeHeading(structural, asHeading(group[0].question), SEMANTIC_HEADINGS[group[0].semanticType]);

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
  // Prose, not InsightCard. A paragraph's default home is the document's flow; boxing
  // it was what kept the written answer off the success path entirely.
  narrative: "Prose",
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
  const scored = bestFor(form, finding, {
    count: cardinalityOf(finding),
    siblings,
    // The one thing a finding cannot know about itself: how many of its siblings
    // measure the same entities. Several measures over one set of names is a table,
    // and only this level can see it.
    measures: measureGroup(section.findings, finding).length,
  });
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
 * The dated list in a section, where it declared one.
 *
 * A schedule is chosen from the *finding* — a requirement is something due — but the key
 * the section's nodes bind to is whichever of its `dataKeys` resolved first, and on the
 * commitments section that is `commit.privatecredit`: one object, no dates. So the schedule
 * beside the capital flow found nothing to draw, fell back to rendering its own finding as
 * a line of text, and the three dates the section exists to state — the call, the trust, the
 * transfer — never reached the page while their key sat in the bundle unread.
 *
 * Narrow on purpose: it answers "which of the keys this section already declared holds dated
 * rows", and returns nothing when none does, in which case the caller keeps the section's
 * ordinary binding and the leaf's own fallback still applies. It cannot reach a key the
 * analysis did not name.
 */
const DATE_FIELDS = ["date", "when", "due"] as const;

function datedKey(section: SemanticSection, bundle: DataBundle): string | undefined {
  return section.dataKeys.find((key) => {
    const value = bundle.values[key];
    return (
      Array.isArray(value) &&
      value.some(
        (row) =>
          row !== null &&
          typeof row === "object" &&
          DATE_FIELDS.some((field) => typeof (row as Record<string, unknown>)[field] === "string"),
      )
    );
  });
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
  /*
   * What the enclosing Section is already headed with. A label equal to it is the same
   * words twice, one line apart; a label different from it is the claim's own name,
   * which the extras pass deliberately.
   */
  const sectionTitle = safeHeading(asHeading(section.question), fallbackHeading);

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
      // Four across, because four is what the document measure fits on one line and a
      // strip that wraps to a second row stops reading as a set.
      props.columns = 4;
      props.heading = title;
      break;

    case "Prose": {
      // `lead` only for the report's own summary section, so exactly one passage on the
      // page is set larger. Any more and the emphasis means nothing.
      const lead = section.semanticType === "summary" && presentation.emphasis !== "quiet";
      props.variant = lead ? "lead" : presentation.emphasis === "quiet" ? "note" : "body";
      // No heading when the finding brings its own — two titles on one passage is the
      // bug the old InsightCard comment was working around.
      if (finding.kind === "narrative" && !finding.heading) props.heading = title;
      break;
    }

    case "BulletSummary":
      props.heading = title;
      // Numbered when the items are a sequence to work through rather than a set of
      // observations. `requirement` is the kind that carries an order.
      props.numbered = finding.kind === "requirement" || finding.kind === "checklist";
      break;

    case "DataTable":
      props.label = title;
      props.compact = cardinalityOf(finding) > 8;
      break;

    case "ComparisonTable":
      // No label where the label would be the section's own heading, printed directly
      // above it. The table's columns name the measures; the question names the table.
      if (title !== sectionTitle) props.label = title;
      // The row header names what the rows *are*, and the finding's label is the only
      // place that is stated — "Holding", "Fund", "Option". Not derived from the entity
      // names, which would make the header a fact.
      props.entityHeader = safeLabel(finding.kind === "comparison" ? finding.label : undefined, "Name");
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
  /**
   * The section whose takeaway the opening panel prints.
   *
   * Claimed the same way a headline figure is: the line is moved to the top of the page,
   * not copied there, so the section it came from does not print it again one screen down.
   */
  openingTakeaway?: string;
  /** Every node made, in document order, for the headline pass. */
  created: UINode[];
  /**
   * Nodes that sit in a row of peers.
   *
   * The headline pass may not promote one of these. A row of figures is read as a set,
   * and enlarging one of four cards makes it a different kind of thing rather than a
   * more important one — which is exactly how the strip came out at two type sizes.
   */
  peers: Set<string>;
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
  /*
   * Unclaimed only, and never a second copy of something already placed.
   *
   * It used to end `fresh ?? pool[0]`, on the reasoning that a section should never come
   * out empty. That was safe only while every claim came from the same area; once the
   * headline strip could take a figure from anywhere in the report, the fallback printed
   * it a second time under its own section — the duplication the strip exists to remove.
   *
   * But "prefer the form's kinds" and "only unclaimed" are two conditions, and treating
   * them as one loses sections. `formFor` picks the form from the section's *dominant*
   * finding, which is exactly the finding the headline strip is most likely to have
   * promoted; a performance section whose one metric went to the strip then had its form
   * set to "metric", found no unclaimed metric, and was dropped — taking its benchmark
   * comparison and its narrative with it, both unplaced and neither duplicated anywhere.
   * So the kind preference degrades: the right shape first, then anything the section
   * still has to say, and only then nothing.
   */
  const chosen =
    fits.find((finding) => !build.claimed.has(finding.id)) ??
    section.findings.find((finding) => !build.claimed.has(finding.id));
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
    /* A schedule binds the section's dated rows, not its first resolving key — see
       `datedKey`. Every other component keeps the section's own binding. */
    const key = (component === "Timeline" ? datedKey(section, build.bundle) : undefined) ?? binding;
    if (spec.requiresData && !key) return null;

    const node: UINode = {
      id: uid(build, `n_${section.id}`),
      component,
      props: propsFor(component, finding, section, emphasis, label),
      sectionId: section.id,
      because: emphasis.because,
      ...(key ? { dataKey: key } : {}),
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
  /*
   * What the section leads with. One node, or a row of peer figures.
   *
   * This used to be two independent paths, and the strip path returned straight out of
   * the function — so a section presented as a strip placed its metrics and dropped
   * everything else it said. On the funding section that cost the `critical` flag
   * naming the US$310k shortfall: the most important sentence in the report, silently
   * absent, and not even counted as unplaced because the section did produce nodes.
   * The lead is chosen differently in the two cases; what follows it is not.
   */
  const lead: UINode[] = [];

  if (presentation.form === "metric_strip") {
    /*
     * Unclaimed only. A figure the headline strip took has already been placed, and
     * drawing it again here is the doubled-content mistake with numbers instead of
     * sentences. A section whose figures were all promoted yields nothing and is
     * dropped by `buildArea`.
     */
    const metrics = section.findings
      .filter((finding) => finding.kind === "metric" && !build.claimed.has(finding.id))
      .slice(0, 4);
    /*
     * One weight for every cell in the row. This used to give the first metric the
     * section's emphasis and the rest "normal", which resolved to two different
     * components — 34px with a sparkline beside 22px without — for two figures that are
     * peers by construction. Rank is expressed by which figures are in the row and in
     * what order, not by making one of them bigger.
     */
    const weight: SectionPresentation = { ...presentation, emphasis: "normal" };
    const cells = metrics
      .map((finding) => make(finding, "metric", weight))
      .filter((node): node is UINode => node !== null);
    for (const finding of metrics) build.claimed.add(finding.id);
    if (cells.length > 1) for (const cell of cells) build.peers.add(cell.id);

    if (cells.length === 1) {
      lead.push(cells[0]);
    } else if (cells.length > 1) {
      lead.push({
        id: uid(build, `g_${section.id}`),
        component: "Grid",
        props: { columns: Math.min(cells.length, 4) as 2 | 3 | 4 },
        children: cells,
      });
    }
    /* No cells is not a dead section: the strip form was chosen from the metrics, and
       if every one of them went to the headline strip the flags and requirements
       underneath them are still the section's content. The loop below picks them up. */
  } else {
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
     * A table over several measures has placed all of them, so none is left over.
     *
     * Without this the extras loop below sees the other measures still unclaimed and
     * draws each as its own ranked list — the reader gets the table and then every one
     * of its own columns again as bars. The renderer collects the same group by the same
     * predicate, so what is claimed here is exactly what appears in the table.
     */
    if (node.component === "ComparisonTable") {
      for (const member of measureGroup(section.findings, finding)) build.claimed.add(member.id);
    }

    lead.push(node);
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
  /*
   * Not for evidence sections. Every finding in one resolves to `SourceList`, which
   * draws the whole of the bound key rather than the finding it was given, so a second
   * and third node there is the same list of sources printed again — tried, and that is
   * exactly what it did. A method note that has to appear on the page belongs in the
   * evidence *data*, where the source list will render it as a row.
   */
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

  const body = [...lead, ...extras];
  /*
   * Nothing to draw. Whether that is a loss depends on why.
   *
   * A section whose every figure was lifted into the headline strip *has* reached the
   * page — the strip is where it landed — and calling that unplaced would report a
   * problem that does not exist, on the most common shape there is. But a section
   * holding findings nobody claimed and no component could draw has genuinely fallen
   * off, and that has to be said: an unplaced section and a section with nothing to say
   * look identical on screen, which is why this is counted rather than left to the eye.
   */
  if (body.length === 0) {
    const stranded = section.findings.some((finding) => !build.claimed.has(finding.id));
    if (stranded) build.unplaced.push(section.id);
    return [];
  }
  if (body.length === 1) return body;
  return [
    {
      id: uid(build, `k_${section.id}`),
      component: "Stack",
      props: { gap: "normal" },
      children: body,
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

  /*
   * What a section's own card is called, inside an area that holds several.
   *
   * A split is the case where the question is the wrong answer. Both sections in one share
   * it — that is what put them in the same area — so passing it down titled both cards
   * "What drove the change", which is also the heading directly above them. `regionName` is
   * the name of the *view*: "Portfolio performance", "Returns summary". Tabs keep the
   * question, because there the view's name is already on the tab and a card repeating it
   * would be the same words twice a line apart.
   */
  const titleFor = (section: SemanticSection, index: number): string =>
    sections.length === 1
      ? /* A continuation area has no heading of its own, so the card takes the name of what
           it is about — which is what `regionName` is for. */
        (area.heading ?? regionName(section, index))
      : area.arrangement === "split"
        ? regionName(section, index)
        : asHeading(section.question);

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
      titleFor(section, index),
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
    /*
     * A passage comes out of the pane and runs under it.
     *
     * A chart and a table are read side by side — that is what a split is for. A paragraph
     * is read along a line, and a paragraph stacked under a chart inside one pane gets the
     * chart's column width: half measure, four short lines, and the whole other half of the
     * page left blank beside it because the table opposite has already ended. So prose is
     * lifted to the full width below the pane, where it reads as the commentary on both
     * sides rather than as a footnote to one.
     *
     * Never when a pane is *only* prose — then the passage is that side of the comparison
     * and moving it would empty the pane.
     */
    const lift = (nodes: UINode[]): { pane: UINode[]; below: UINode[] } => {
      /* A section's several nodes arrive already wrapped in a Stack — see `nodesForSection`.
         Look through it, as the grid rules below do, or the passage is invisible here. */
      const inner =
        nodes.length === 1 && nodes[0].component === "Stack" && (nodes[0].children?.length ?? 0) > 1
          ? nodes[0].children ?? nodes
          : nodes;
      const kept = inner.filter((node) => node.component !== "Prose");
      return kept.length === 0 || kept.length === inner.length
        ? { pane: nodes, below: [] }
        : { pane: kept, below: inner.filter((node) => node.component === "Prose") };
    };
    const left = lift(per[0].nodes);
    const right = lift(per[1].nodes);
    body = [
      {
        id: uid(build, "split"),
        component: "SplitPane",
        /* No pane labels: `titleFor` has already given each side's card its own title, and a
           label above a titled card is the same name twice. */
        props: { ratio: "even" },
        slots: { left: region(left.pane), right: region(right.pane) },
      },
      ...left.below,
      ...right.below,
    ];
  } else {
    body = per.flatMap((entry) => entry.nodes);
    /*
     * One section's several nodes arrive wrapped in a Stack — see `nodesForSection`, which
     * has to return a single node so a tab or a pane can hold it. Inside an area that is
     * itself a column that wrapper means nothing, and it hides the count from the two
     * rules below, both of which are about how many things there are. So look through it.
     * Only here: in a tab or a pane the Stack is load-bearing.
     */
    const blocks =
      body.length === 1 && body[0].component === "Stack" && (body[0].children?.length ?? 0) > 1
        ? body[0].children ?? body
        : body;
    /*
     * A grid the recipe asked for, over whatever the section produced.
     *
     * The other grid in this file (below) is a rule about content — several things flagged
     * are a set. This one is a rule about *place*: some slots hold a row rather than a
     * column, because what belongs there is two or three readings of one thing and stacking
     * them full width would make each look like a separate claim. Columns follow the count,
     * capped at four, and a single node is left alone — a one-column grid is a div.
     */
    if (area.arrangement === "grid" && blocks.length >= 2 && blocks.length <= 4) {
      body = [
        {
          id: uid(build, `row_${area.id}`),
          component: "Grid",
          props: { columns: blocks.length as 2 | 3 | 4 },
          children: blocks,
        },
      ];
    }
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
      (
        ["Checklist", "Timeline", "KeyValueList", "InsightCard", "Prose", "BulletSummary"] as ComponentId[]
      ).includes(node.component),
    );
  if (forward) {
    return {
      id: uid(build, area.id),
      component: "WhatToWatch",
      sectionId: sections[0].id,
      props: {
        heading: safeHeading(area.heading, "What to watch"),
        ...(sections[0].takeaway && sections[0].id !== build.openingTakeaway ? { takeaway: true } : {}),
      },
      children: body.slice(0, 3),
    };
  }

  /*
   * Two or more things flagged in one section are a set, and a set reads as a grid.
   *
   * Stacked full-width callouts make four risks into four paragraphs the reader works
   * through in order, when what they want is to see how many there are and how bad. Two
   * columns says "four items, two of them serious" at a glance. Bounded to callouts only —
   * a chart and a table side by side at half width are both unreadable.
   */
  const called: ComponentId[] = ["RiskAlert", "Recommendation"];
  /* Through the section's own Stack wrapper, for the reason given where `blocks` is
     computed above: four flags in a column are four flags, whoever is holding them. */
  const candidates =
    body.length === 1 && body[0].component === "Stack" && (body[0].children?.length ?? 0) > 1
      ? body[0].children ?? body
      : body;
  const flags = candidates.filter((node) => called.includes(node.component));
  const allFlags = flags.length >= 2 && flags.length === candidates.length;
  /* A rail holds eight; a grid still stops at six, because past six the objection the Grid
     cap exists for — a grid of cards is a table that has not admitted it — is unanswered. */
  const risksOnly = flags.length > 2 && candidates.every((node) => node.component === "RiskAlert");
  if (allFlags && (risksOnly ? flags.length <= 8 : flags.length <= 6)) {
    /*
     * Past three, the set goes on a rail instead of into rows.
     *
     * Two columns of two is a set the reader sees whole. Two columns of four is the same
     * set costing four rows of the page, and what it spends them on is the tail — the
     * analysis put the items in priority order, so the boxes that push the next section
     * under the fold are the least urgent ones in the section. A rail keeps the first two
     * at full size, says how many there are, and leaves the page its shape. See `Carousel`
     * in ./registry.ts.
     *
     * Three is the boundary, and it is a boundary rather than a rounding: three cards in
     * one row of three is still a set seen whole, at one row's cost and with nothing
     * hidden behind a control. Four is where a 2×2 starts costing two rows and a rail
     * starts being worth its scroll.
     *
     * Risks only. Recommendations are the actions the report is asking for and the reader
     * has to be able to count them without scrolling — a decision behind a scroll is a
     * decision the reader does not know they were asked to make.
     */
    const rail = risksOnly && flags.length >= 4;
    body = [
      {
        id: uid(build, `fg_${area.id}`),
        ...(rail
          ? { component: "Carousel" as const, props: { perView: 2 } }
          : { component: "Grid" as const, props: { columns: flags.length === 3 ? 3 : 2 } }),
        children: candidates,
      },
    ];
  }

  /*
   * A schedule that has the section to itself loses its frame.
   *
   * The panel and its title exist to separate a card from the card beside it. Where the
   * timeline is the only thing in the area, there is nothing to separate it from, and the
   * title it would print is the words already standing above it as the heading. Set here
   * rather than in the leaf because only this level knows what else is in the area.
   */
  if (body.length === 1 && body[0].component === "Timeline" && body[0].props.label === area.heading) {
    body[0].props.variant = "flat";
    /*
     * And a funding calendar alone in its area runs left to right.
     *
     * A vertical rail is the right shape for a history: the rows carry prose of unequal
     * length and reading down them is reading a sequence. A calendar carries a date, a
     * name and an amount — four short cells, wide and shallow — and laid out downward it
     * spends most of the area on the empty right-hand side of every row. Across, the four
     * dates read as a span of time, which is the thing the section is about.
     *
     * Gated on `commitments` rather than on the row count, because the shape follows from
     * what the section *is*: an `activity` timeline is a history and keeps its column,
     * whether it holds three rows or ten.
     */
    if (sections[0].semanticType === "commitments") body[0].props.direction = "right";
  }

  return {
    id: uid(build, area.id),
    component: "Section",
    /* Named so the renderer can read the section's own line. The composer decides the line
       is shown; it never carries the words — see `Section.takeaway` in ./registry.ts. */
    sectionId: sections[0].id,
    props: {
      ...(area.heading ? { heading: safeHeading(area.heading) } : {}),
      /* The analysis's own line about the section, where it wrote one. Sections sharing
         an area are siblings of one question, so the first one's line describes the area.
         Unless the opening panel already printed it — see `Builder.openingTakeaway`. */
      ...(sections[0].takeaway && sections[0].id !== build.openingTakeaway ? { takeaway: true } : {}),
    },
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
    peers: new Set(),
    counter: { n: 0 },
    unplaced: [...ia.unplaced],
  };

  const header: UINode = {
    id: "header",
    component: "PageHeader",
    props: {
      /*
       * What kind of report this is, on the left of the masthead.
       *
       * This used to be the period, which put a date where the document's name for itself
       * belongs and then had nowhere to say what the thing was. The two are separate props
       * now and each one says one thing.
       */
      eyebrow: safeLabel(REPORT_KIND[report.reportType], SEMANTIC_HEADINGS[report.reportType], "Report"),
      /*
       * The period, if it can be said in a few words. A planner that writes "last 12
       * months (and YTD where available)" has written a caveat, not a label, and the
       * masthead has no room to argue — so long labels are dropped rather than clipped.
       */
      ...(intent.timeRange.label && intent.timeRange.label.length <= 28
        ? { period: safeLabel(intent.timeRange.label) }
        : {}),
      /* What the reader is holding, in one line. The recipe's own description of the
         shape it builds — presentation about presentation, so it carries no claim. */
      subtitle: clip(RECIPES[ia.recipeId].description, 120),
    },
  };

  /**
   * The executive summary, as the document's opening paragraph.
   *
   * This is the change that makes the output a report rather than a dashboard. The
   * analysis always wrote a summary; until now it was squeezed into the header subtitle
   * at 120 characters and otherwise discarded, so the page led with figures and the
   * reader had to infer the point. Leading with the sentence and following with the
   * evidence is how the reference document reads, and it is also what §14 has been
   * asking for all along — the written answer *in* the view, not behind a toggle.
   *
   * `source` rather than the text itself, so the spec still contains no content.
   */
  const summary: UINode = {
    id: "summary",
    component: "Prose",
    props: { heading: "Executive summary", variant: "readout", source: "summary" },
  };

  /**
   * The readout and the one line beside it.
   *
   * The reference layout opens on a washed panel with the answer in it and a narrow panel
   * to its right holding the single sentence worth remembering. That second panel is not a
   * second summary — it is the primary section's own takeaway, resolved by reference (see
   * `reportText`), which is why the composer can place it without being able to write it.
   *
   * Paired only when there is something to pair with. A report whose sections carry no
   * takeaway gets the readout at full width rather than a panel with a gap in it.
   */
  const lead = openingSection(report);
  if (lead) build.openingTakeaway = lead.id;
  const opening: UINode = lead
    ? {
        id: uid(build, "opening"),
        component: "SplitPane",
        props: { ratio: "wide-left" },
        slots: {
          left: [summary],
          right: [
            {
              id: uid(build, "takeaway"),
              component: "Prose",
              props: { heading: "Key takeaway", variant: "aside", source: "takeaway" },
            },
          ],
        },
      }
    : summary;

  /**
   * The figures, as the document's second line.
   *
   * A report opens on the sentence and then on the numbers the sentence is about — that
   * is the reference layout and it is also how a filed note reads. Before this, the
   * figures stayed wherever their section happened to fall, so a reader had to scroll
   * past an allocation chart to find the total value.
   *
   * The selection rule is `headlineFigures`, shared with the renderer. Claiming the
   * findings here is what keeps the page honest: a figure promoted to the top is *moved*
   * there, not copied, so nothing below prints it a second time. Where that empties a
   * section, `buildArea` drops it — a section that was only its figures has had its
   * content placed, higher up.
   */
  const figures = headlineFigures(report);
  const keyFigures: UINode | null =
    figures.length >= 2
      ? {
          id: "key_figures",
          component: "MetricStrip",
          props: {
            columns: Math.min(figures.length, 4) as 2 | 3 | 4,
            source: "key_figures",
          },
        }
      : null;
  if (keyFigures) for (const finding of figures) build.claimed.add(finding.id);

  const areas = [...ia.plan.areas].sort((a, b) => a.rank - b.rank);
  const body = areas
    .map((area) => buildArea(build, area, report, ia.recipe))
    .filter((node): node is UINode => node !== null);

  /*
   * The readout band belongs *inside* section 1, not above it.
   *
   * These two nodes used to sit at the root, between the masthead and the first section,
   * and the result was the specific mess the reference does not have: the answer and the
   * figures floated unheaded at the top, and section 1 — "The readout" — then held only
   * whatever the headline area had left over, which was one stranded hero card and a lone
   * chart. Three separate things where the reference has one band.
   *
   * Folding them in is a placement decision, so it belongs here rather than in
   * `buildArea`: only this level knows the opening exists at all. The headline slot is
   * capped at one area in every recipe, so `find` cannot pick the wrong section. Where
   * there is no headline section to fold into — a recipe whose required slot went
   * unfilled, which the validator rejects anyway — they stay at the root rather than being
   * dropped.
   */
  const band: UINode[] = [opening, ...(keyFigures ? [keyFigures] : [])];
  let readout = body.find((node) => node.component === "Section" && node.id.startsWith("area_headline_"));
  /*
   * The readout section may not exist yet, and that is the normal case rather than the odd
   * one. A headline section whose every figure went to the strip has no findings left to
   * draw, so `buildArea` correctly returns nothing for it — its content was placed, at the
   * top of the page. But the band *is* that section's content, so the section still has to
   * be there to hold it, with its heading and its number. Built here, from the area the IA
   * planner named, rather than left to the root: a page whose first heading is "2." reads as
   * though something was lost.
   */
  const headlineArea = areas.find((area) => area.id.startsWith("area_headline_"));
  if (!readout && headlineArea && band.length > 0) {
    readout = {
      id: uid(build, headlineArea.id),
      component: "Section",
      sectionId: headlineArea.sectionIds[0],
      props: { heading: safeHeading(headlineArea.heading) },
      children: [],
    };
    body.unshift(readout);
  }
  if (readout) {
    readout.children = [...band, ...(readout.children ?? [])].slice(0, 8);
    band.length = 0;
  }

  /*
   * Numbered in page order, and only once the page is known.
   *
   * It has to happen here rather than in `buildArea`: an area that produced nothing is
   * dropped, and numbering as they are built would leave gaps — "1, 2, 4" tells the reader
   * something went missing, which is both alarming and untrue. Disclosure is deliberately
   * not numbered; provenance is an appendix, not a seventh thing to read.
   */
  let numbered = 0;
  for (const node of body) {
    /* A section with no heading is a continuation of the one above it, so it takes no
       number — see `continuation` in ./recipes.ts. */
    if ((node.component === "Section" || node.component === "WhatToWatch") && node.props.heading) {
      numbered += 1;
      node.props.index = numbered;
    }
  }

  /*
   * The headline, placed after the fact.
   *
   * `planIA` names the section that should lead, but whether it *can* depends on the
   * component the registry chose — a RiskAlert has no hero variant and forcing one
   * would be an invalid prop. So if the intended lead could not take it, the first
   * node in reading order that can does instead, and a page that genuinely has no
   * candidate simply has no hero. The validator warns; it does not block.
   */
  /*
   * ...unless the page already opens on a strip of figures, in which case it has one.
   *
   * The fallback used to run regardless, and on a report with a headline strip it picked
   * the first figure *after* the strip — so a secondary number like total assets was drawn
   * at hero size, larger than the four figures the page leads with, directly underneath
   * them. A page has one entry point; the strip is it.
   */
  if (!keyFigures && !build.created.some((node) => node.props.variant === "hero")) {
    const candidate = build.created.find(
      (node) => !build.peers.has(node.id) && specOf(node.component).variants.includes("hero"),
    );
    if (candidate) {
      candidate.props.variant = "hero";
      if (specOf(candidate.component).sizes.includes("lg")) candidate.props.size = "lg";
    }
  }

  /*
   * The closing passage, where the analysis wrote one.
   *
   * Last in reading order and outside the numbering, for the same reason the sources are:
   * it is not an eighth thing to read, it is the end of the note. Placed unconditionally
   * where `report.outlook` exists and omitted where it does not — the composer decides the
   * card is there, never what it says (`source: "outlook"`, see ./semantic.ts).
   */
  const closing: UINode[] = report.outlook
    ? [
        {
          id: uid(build, "outlook"),
          component: "Prose",
          props: { heading: "Looking ahead", variant: "outlook", source: "outlook" },
        },
      ]
    : [];

  const spec: UISpec = {
    id: `view_${report.reportType}`,
    recipe: ia.recipeId,
    root: [header, ...band, ...body, ...closing],
    narrative: report.narrative,
    meta: {
      reportId: report.title,
      trace: ia.plan.trace,
      unplacedSectionIds: [...new Set(build.unplaced)],
    },
  };

  return { spec, ia: ia.plan, recipeId: ia.recipeId, unplaced: spec.meta.unplacedSectionIds };
}
