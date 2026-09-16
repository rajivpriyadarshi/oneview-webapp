/**
 * The model boundary — turning what came back into something the pipeline can use.
 *
 * Two jobs, and one deliberate refusal.
 *
 *   1. **Fill in what a tool call reliably forgets.** Ids, `emphasis`, `confidence`,
 *      `sources`, `subject`. These are required by the schema and absent from about
 *      one call in three, and a whole report failing over a missing confidence score
 *      would be an own goal.
 *   2. **Drop what cannot be trusted.** A finding that still fails `FindingSchema`
 *      after the defaults are applied is reported and discarded, not patched into
 *      shape. Every dropped finding is named in the return value so the pipeline can
 *      say what it lost.
 *
 * The refusal: this file does not change values. That is the whole difference from
 * `../dynamic-ui/interpret.ts:coerceFinding`, which did the same defaulting job and
 * also carried `value > 1 ? value / 100 : value` — a presentation layer quietly
 * rewriting a number because a chart preferred a different unit. A composition whose
 * parts are percentages rather than shares is normalised *by the component that
 * draws it*, where the decision is visible and reversible. Silently dividing by a
 * hundred at the boundary is how a portfolio becomes 0.52% equities.
 *
 * `narrative` is also enforced here rather than trusted: the prose answer from pass 1
 * is written over whatever the structuring pass returned in that field. The model
 * gets to structure the answer, not to revise it — §14 in one assignment.
 */

import { FindingSchema, type Finding } from "./findings";
import { IntentPlanSchema, normaliseIntent, type IntentPlan } from "./intent";
import { SemanticReportSchema, type SemanticReport } from "./semantic";

type Bag = Record<string, unknown>;

const isBag = (value: unknown): value is Bag =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/* ----------------------------------------------------------------- findings */

const EMPHASIS = new Set(["primary", "secondary", "supporting"]);

/**
 * The label a finding is known by, whichever field its kind puts it in.
 *
 * `subject` is required by `FindingMetaSchema` and is the field models most often
 * leave out, because every kind already carries something that reads like a title.
 */
const subjectOf = (raw: Bag): string =>
  text(raw.subject) ??
  text(raw.label) ??
  text(raw.title) ??
  text(raw.subjectLabel) ??
  text(raw.heading) ??
  text(raw.purpose) ??
  "Finding";

function fillFinding(raw: unknown, index: number, sectionId: string): unknown {
  if (!isBag(raw)) return raw;

  const emphasis = text(raw.emphasis);
  const confidence = typeof raw.confidence === "number" ? raw.confidence : 0.7;

  return {
    ...raw,
    id: text(raw.id) ?? `${sectionId}_f${index + 1}`,
    emphasis: emphasis && EMPHASIS.has(emphasis) ? emphasis : "secondary",
    // Clamped rather than rejected: a model that answers 90 meant 0.9, and a
    // confidence out of range is not a reason to lose the claim it belongs to.
    confidence: Math.max(0, Math.min(confidence > 1 ? confidence / 100 : confidence, 1)),
    sources: list(raw.sources).filter((entry): entry is string => typeof entry === "string"),
    subject: subjectOf(raw),
  };
}

export type ReportOutcome = {
  report: SemanticReport | null;
  /** What was thrown away, and why. Surfaced in the panel, not swallowed. */
  dropped: string[];
  /** Why there is no report, when there is none. */
  reason?: string;
};

/**
 * A structuring call into a `SemanticReport`.
 *
 * `narrative` is supplied by the caller — the pass-1 answer — and always wins.
 */
export function parseReport(raw: unknown, narrative: string): ReportOutcome {
  if (!isBag(raw)) return { report: null, dropped: [], reason: "The structuring pass returned nothing usable." };

  const dropped: string[] = [];

  const sections = list(raw.sections).map((entry, sectionIndex) => {
    const section = isBag(entry) ? entry : {};
    const id = text(section.id) ?? `s${sectionIndex + 1}`;

    const keep = (findings: unknown[], where: string): Finding[] =>
      findings.flatMap((finding, index) => {
        const parsed = FindingSchema.safeParse(fillFinding(finding, index, id));
        if (parsed.success) return [parsed.data];
        dropped.push(
          `${where} in "${id}": ${parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
            .join("; ")}`,
        );
        return [];
      });

    return {
      ...section,
      id,
      importance: text(section.importance) && EMPHASIS.has(String(section.importance))
        ? section.importance
        : "secondary",
      question: text(section.question) ?? text(section.heading) ?? "What does this say?",
      dataKeys: list(section.dataKeys).filter((key): key is string => typeof key === "string"),
      findings: keep(list(section.findings), "finding"),
      ...(list(section.detail).length > 0 ? { detail: keep(list(section.detail), "detail") } : {}),
    };
  });

  const parsed = SemanticReportSchema.safeParse({
    ...raw,
    sections,
    narrative,
    title: text(raw.title) ?? "Report",
    summary: text(raw.summary) ?? narrative.split(/(?<=\.)\s/)[0] ?? narrative,
  });

  if (!parsed.success) {
    return {
      report: null,
      dropped,
      reason: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    };
  }

  return { report: parsed.data, dropped };
}

/* -------------------------------------------------------------------- intent */

/**
 * A planning call into an `IntentPlan`.
 *
 * Stricter than the report path on purpose: the plan is small, the model has the
 * whole schema, and a plan that arrives malformed is better treated as "no plan" —
 * the caller has a deterministic stand-in for that case, and guessing a task type
 * would send the rest of the pipeline confidently in the wrong direction.
 */
/**
 * A bundle key, in the house convention: dotted, lower-case, digits allowed.
 *
 * Models write `alloc.assetClass`, `cash_next_12m`, `Risk.Open`. Every one of those is
 * the same request under a different spelling, and none of them is a *claim* — the key
 * is the name the bundle files a value under, chosen by whoever asked. So this is a
 * rename, which the boundary is allowed to do, not a correction of anything the model
 * decided.
 *
 * It exists because the alternative was much worse: the schema rejected the key, which
 * rejected the whole plan, which sent an entire run to the stand-in analyst — six good
 * data requests and a correct task type thrown away over a capital letter, with the
 * fixture prose coming back looking like a real answer.
 */
function bundleKey(raw: unknown): string | undefined {
  const source = text(raw);
  if (!source) return undefined;
  const key = source
    .replace(/([a-z0-9])([A-Z])/g, "$1.$2") // assetClass → asset.Class
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ".") // spaces, underscores, dashes → separators
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/g, "");
  // Must still start with a letter to be a namespace rather than a number.
  return /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/.test(key) ? key : undefined;
}

export type IntentOutcome = {
  plan: IntentPlan | null;
  /**
   * Why there is no plan, when there is none.
   *
   * Load-bearing, not a nicety. Without it a rejected plan reaches the client as a
   * bare 502, the client quietly switches to the stand-in, and the fixture answers
   * look like the model's answers — which is exactly how a broken planner hides. The
   * reason has to travel far enough to be readable on screen.
   */
  reason?: string;
};

export function parseIntent(raw: unknown): IntentOutcome {
  if (!isBag(raw)) return { plan: null, reason: "The planning pass returned no tool call." };

  const requests = list(raw.dataRequests).flatMap((entry) => {
    if (!isBag(entry)) return [];
    const key = bundleKey(entry.key);
    if (!key || !text(entry.tool)) return [];
    return [
      {
        ...entry,
        key,
        args: isBag(entry.args) ? entry.args : {},
        required: entry.required !== false,
      },
    ];
  });

  const parsed = IntentPlanSchema.safeParse({ ...raw, dataRequests: requests });
  if (!parsed.success) {
    return {
      plan: null,
      reason: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    };
  }
  return { plan: normaliseIntent(parsed.data) };
}
