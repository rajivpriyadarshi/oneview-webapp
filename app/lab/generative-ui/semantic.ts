/**
 * Layer 3 — the semantic report model.
 *
 * What the information *means*. Not what it should look like.
 *
 * This is the biggest single change from the old pipeline, and the change is
 * structural rather than additive. The old model was `Finding[]` — one flat list
 * of claims, each carrying a free-text `subject`, with sections recovered
 * downstream by grouping on string equality of that field (`compose.ts:144`).
 *
 * Two things follow from that, and both are why this file exists:
 *
 *   - "Liquidity" and "Liquidity and funding" silently became one section or two,
 *     depending on whether the model happened to phrase them identically. A
 *     grouping mechanism that depends on exact string agreement between separate
 *     claims is not an information architecture.
 *   - There was nowhere to say that two sections answer the *same question*.
 *     Contributors and detractors were two unrelated bar charts because nothing
 *     in the model could state that they belong together — and that statement is
 *     the input the tabs rule needs.
 *
 * So the model is now two levels: a section is what a group of findings means
 * together, and `relations` says how sections stand to each other. Both are
 * semantic claims, and both are things the analysis knows and the composer
 * cannot infer.
 *
 * The rule this layer must hold: everything here is a claim about the world.
 * Nothing here is a presentation decision. `importance` is the closest call —
 * it is included because "this is the primary finding" is a claim about the
 * information, not about the layout. What the layout does with it is layer 4's.
 */

import { z } from "zod";
import { FindingSchema, type Finding, type MetricFinding } from "./findings";
import { TaskTypeSchema } from "./intent";

/**
 * What a section is *about*, semantically.
 *
 * The vocabulary the IA composer's grouping rules are written against — so
 * "concentration + currency + allocation shift belong in one Risk changes area"
 * is expressible as a rule over types rather than a guess over headings.
 */
export const SemanticTypeSchema = z.enum([
  "performance",
  /** What drove the performance — contributors, detractors, attribution. */
  "drivers",
  "allocation",
  "risk",
  "liquidity",
  "market_context",
  "activity",
  /** Amounts tied to dates: capital calls, maturities, funding needs. */
  "commitments",
  "recommendations",
  /** Things somebody still has to do. Distinct from recommendations. */
  "actions",
  "comparison",
  /** Who or what this is about. Opens an EntityOverview. */
  "identity",
  /** Documents, sources, methodology. Disclosure candidates by default. */
  "evidence",
  "summary",
]);
export type SemanticType = z.infer<typeof SemanticTypeSchema>;

export const SemanticSectionSchema = z.object({
  id: z.string().min(1),
  semanticType: SemanticTypeSchema,
  /**
   * The reader-facing question this section answers.
   *
   * Load-bearing, not documentation: the grouping rule "visually group sections
   * that answer the same question" reads this, and an area's heading is derived
   * from it. Writing the question forces the analysis to be honest about whether
   * two sections are really two things.
   */
  question: z.string().min(1),
  importance: z.enum(["primary", "secondary", "supporting"]),
  /**
   * One line saying what this section establishes — "Four key developments since the
   * last review."
   *
   * Content, which is why it is here and not a composer decision: it is a sentence about
   * the findings, and only the layer that wrote the findings may write it. The composer
   * prints it under the heading and can choose not to; it cannot compose one, and a
   * section that does not carry one simply has a heading.
   *
   * It exists because a question alone ("What changed?") tells the reader what is coming
   * but not whether it matters, and a page of nine bare questions reads as an interview.
   */
  takeaway: z.string().max(160).optional(),
  /**
   * Sibling views of one thing: ["contributors"], ["detractors"], ["1M"], ["YTD"].
   *
   * Two sections sharing a `question` and each carrying a different `groups` entry
   * is the exact signal the tabs rule wants — same question, sibling views, one
   * read at a time.
   */
  groups: z.array(z.string()).optional(),
  /** The claims. Uses the existing finding vocabulary unchanged. */
  findings: z.array(FindingSchema),
  /** Bundle keys this section stands on. The validator checks they exist. */
  dataKeys: z.array(z.string()),
  /**
   * Methodology, provenance, raw calculation, lower-priority detail.
   *
   * Split out from `findings` rather than flagged inside it, because "is this
   * needed for the first scan?" is a question about the claim, and answering it
   * here is what lets the disclosure rule work without the composer having to
   * guess which of eleven findings are footnotes.
   */
  detail: z.array(FindingSchema).optional(),
});
export type SemanticSection = z.infer<typeof SemanticSectionSchema>;

export const SemanticRelationSchema = z.object({
  kind: z.enum(["answers_same_question", "supports", "contrasts"]),
  sectionIds: z.array(z.string()).min(2),
});
export type SemanticRelation = z.infer<typeof SemanticRelationSchema>;

export const SemanticReportSchema = z.object({
  reportType: TaskTypeSchema,
  title: z.string().min(1),
  /** The answer in one or two sentences. Also the text fallback's headline. */
  summary: z.string().min(1),
  sections: z.array(SemanticSectionSchema),
  /**
   * The closing paragraph, and who is signing it.
   *
   * A filed note ends by saying where this is heading and who stands behind it, and that
   * is not a finding: it makes no measurement, it is not about one section, and it would
   * be wrong as a card. It is the report's own writing, like `summary` — which is why it
   * lives here and reaches the page by reference (`source: "outlook"`), never as a prop.
   *
   * Optional, because most answers do not close; a query about one holding has no outlook
   * and inventing one would be the composer writing prose.
   */
  outlook: z
    .object({ text: z.string().min(1), signature: z.string().min(1).max(120).optional() })
    .optional(),
  relations: z.array(SemanticRelationSchema).optional(),
  /**
   * The pass-1 prose answer, kept whole and unmodified.
   *
   * This is the §14 guarantee made concrete: the original answer travels *inside*
   * the semantic report, so every failure downstream — composition, spec
   * generation, validation, a component crashing — has something correct and
   * complete to fall back to without re-running anything. Rich UI is an
   * enhancement; this field is the source of truth.
   */
  narrative: z.string().min(1),
});
export type SemanticReport = z.infer<typeof SemanticReportSchema>;

/* ------------------------------------------------------------------ helpers */

export const IMPORTANCE_ORDER: Record<SemanticSection["importance"], number> = {
  primary: 0,
  secondary: 1,
  supporting: 2,
};

export const sectionById = (
  report: SemanticReport,
  id: string,
): SemanticSection | undefined => report.sections.find((section) => section.id === id);

/**
 * Sections the analysis says answer the same question, as groups.
 *
 * Two sources, and both count: an explicit `answers_same_question` relation, and
 * an identical `question` string. The second is a convenience for the model —
 * declaring the relation is better, but two sections that literally state the
 * same question should not need a separate assertion to be grouped.
 *
 * Returned in first-appearance order, and every section appears in exactly one
 * group, so the IA composer can walk these as a partition rather than
 * de-duplicating afterwards.
 */
export function questionGroups(report: SemanticReport): SemanticSection[][] {
  const groupOf = new Map<string, number>();
  const groups: SemanticSection[][] = [];

  const join = (ids: string[]) => {
    const existing = ids.map((id) => groupOf.get(id)).find((index) => index !== undefined);
    const index = existing ?? groups.length;
    if (existing === undefined) groups.push([]);
    for (const id of ids) {
      if (groupOf.has(id)) continue;
      const section = sectionById(report, id);
      if (!section) continue;
      groupOf.set(id, index);
      groups[index].push(section);
    }
  };

  for (const relation of report.relations ?? []) {
    if (relation.kind === "answers_same_question") join(relation.sectionIds);
  }

  const byQuestion = new Map<string, string[]>();
  for (const section of report.sections) {
    const key = section.question.trim().toLowerCase();
    byQuestion.set(key, [...(byQuestion.get(key) ?? []), section.id]);
  }
  for (const ids of byQuestion.values()) if (ids.length > 1) join(ids);

  // Everything not otherwise grouped is a group of one.
  for (const section of report.sections) if (!groupOf.has(section.id)) join([section.id]);

  return groups.filter((group) => group.length > 0);
}

/**
 * The figures that belong at the top of the document, under the executive summary.
 *
 * The reference layout opens on the sentence and then on three or four figures read as
 * a set — the numbers the summary is about, before any section. Nothing in the semantic
 * report says "these are the headline figures", and nothing should: that is a
 * presentation decision. So it is made here, by rule, over what the analysis already
 * wrote.
 *
 * The rule: metric findings only, ranked by the emphasis the analysis gave them and
 * then by where they appear, deduplicated by label, capped at four. Four is the cap the
 * strip has always had — past it a row of figures is a wall rather than a summary — and
 * two is the floor, because one tile is not a set and reads better in its own section.
 *
 * Nothing is computed, aggregated or rephrased. "Aggregated" here means gathered from
 * across the sections, not derived: every figure on the strip is a figure the analysis
 * stated, with the analysis's own label, value, delta and basis. A composer that
 * totalled two of them would be authoring a finding, which §9 forbids.
 *
 * Exported and shared, for the same reason `measureGroup` is: the composer claims these
 * findings so their sections do not print them twice, and the renderer resolves the
 * strip from them. If the two disagreed the strip would show one set of figures and the
 * page would repeat another.
 */
export const HEADLINE_FIGURES = { min: 2, max: 4 } as const;

export function headlineFigures(report: SemanticReport): MetricFinding[] {
  const rank = { primary: 0, secondary: 1, supporting: 2 } as const;
  const metrics = report.sections
    .flatMap((section) => section.findings)
    .filter((finding): finding is MetricFinding => finding.kind === "metric")
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => rank[a.finding.emphasis] - rank[b.finding.emphasis] || a.index - b.index);

  const chosen: MetricFinding[] = [];
  const seen = new Set<string>();
  for (const { finding } of metrics) {
    const key = finding.label.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(finding);
    if (chosen.length === HEADLINE_FIGURES.max) break;
  }

  return chosen.length >= HEADLINE_FIGURES.min ? chosen : [];
}

/**
 * The section whose takeaway is worth printing beside the summary.
 *
 * The most important section that wrote one, by the `importance` the analysis stated. A
 * rule rather than a claim, for the same reason `headlineFigures` is one: which line opens
 * the document is presentation, and it is decided here so the composer and the renderer
 * cannot disagree about it.
 *
 * Shared because the line is *moved*, not copied. The composer reads this to know which
 * section must not print its own takeaway again under its heading, and the renderer reads
 * it to know which line to resolve — and if the two used different rules the page would
 * open on one sentence and repeat another.
 */
export const openingSection = (report: SemanticReport): SemanticSection | undefined =>
  [...report.sections]
    .sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance])
    .find((section) => section.takeaway);

/** Every bundle key the report claims to stand on. */
export const referencedKeys = (report: SemanticReport): string[] => [
  ...new Set(report.sections.flatMap((section) => section.dataKeys)),
];

/**
 * True when the report has nothing worth composing.
 *
 * A report with no findings anywhere is a prose answer that went through the
 * motions, and the correct outcome is the narrative in the chat — not an empty
 * page with a title on it. The old pipeline reached the same conclusion at
 * `live.ts:486`; stating it as a predicate here means every caller agrees.
 */
export const isEmpty = (report: SemanticReport): boolean =>
  report.sections.every((section) => section.findings.length === 0);
