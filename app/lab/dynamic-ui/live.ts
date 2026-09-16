/**
 * The client half of layers 1–2: ask the model, then trust nothing it said.
 *
 * `ask()` posts to /api/lab/dynamic-ui and turns the response into either a new
 * report, a patch against the one on screen, or a plain reply. Everything the
 * model returns is coerced into the `Finding` contract before it goes anywhere
 * near selection — a model that omits a required field should cost one malformed
 * block, not a blank page.
 *
 * When there is no key the route answers 501 and this falls back to
 * ./heuristics, which answers the same open-ended asks from the same book with
 * keyword-matched topics. Which path ran is reported as `via`, because a demo
 * where you can't tell whether the model is live is a demo that proves nothing.
 */

import type { Finding, FindingKind, FindingMeta, Sentiment, Series } from "./findings";
import type { ReportOp } from "./patch";
import { blockCount, orderedBlocks, type ReportDoc } from "./compose";
import { localAnalyse, localFact } from "./heuristics";
import { intentOf } from "./interpret";
import { decide } from "./decide";
import { reviseLocally } from "./revise";

export type Answer =
  | { kind: "reply"; reply: string; via: Via }
  | { kind: "report"; reply: string; title: string; findings: Finding[]; via: Via }
  | { kind: "patch"; reply: string; ops: ReportOp[]; via: Via };

export type Via = "model" | "local";

/* ---------------------------------------------------------------- coercion */

const KINDS: FindingKind[] = [
  "metric", "trend", "comparison", "composition",
  "transition", "requirement", "narrative", "recommendation", "flag", "checklist",
];

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const sentiment = (value: unknown): Sentiment =>
  value === "positive" || value === "negative" ? value : "neutral";

const delta = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const label = str(raw.label);
  if (!label) return undefined;
  return { label, value: num(raw.value) ?? 0, sentiment: sentiment(raw.sentiment) };
};

const seriesOf = (value: unknown): Series | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const points = Array.isArray(raw.points) ? raw.points : [];
  const cleaned = points
    .map((point) => {
      const p = point as Record<string, unknown>;
      const v = num(p.value);
      return v === undefined ? null : { label: str(p.label) ?? "", value: v };
    })
    .filter((point): point is { label: string; value: number } => point !== null);
  if (cleaned.length === 0) return undefined;
  return { name: str(raw.name) ?? "Series", points: cleaned };
};

const slugId = (value: string, index: number): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `finding-${index}`;

/**
 * Model output → a `Finding`, or null if there is nothing renderable in it.
 *
 * Deliberately forgiving about *which* fields are present and strict about the
 * envelope: a comparison that arrives with one entity is still a finding (the
 * FallbackList renderer will state it as text), but a finding with no id, kind or
 * subject can't be composed or patched, so it's dropped.
 */
export function coerceFinding(value: unknown, index: number): Finding | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const kind = KINDS.includes(raw.kind as FindingKind) ? (raw.kind as FindingKind) : "narrative";
  const labelish =
    str(raw.label) ?? str(raw.heading) ?? str(raw.title) ?? str(raw.subjectLabel) ?? `finding-${index}`;

  const meta: FindingMeta = {
    id: slugId(str(raw.id) ?? labelish, index),
    subject: str(raw.subject) ?? "Findings",
    emphasis:
      raw.emphasis === "primary" || raw.emphasis === "supporting" ? raw.emphasis : ("secondary" as const),
    confidence: Math.min(1, Math.max(0, num(raw.confidence) ?? 0.7)),
    sources: Array.isArray(raw.sources) ? raw.sources.filter((s): s is string => typeof s === "string") : [],
  };

  switch (kind) {
    case "metric":
      return {
        ...meta, kind, label: labelish,
        value: str(raw.value) ?? "—",
        delta: delta(raw.delta),
        series: seriesOf(raw.series),
      };

    case "trend": {
      const series = seriesOf(raw.series);
      // A trend with no series is not a trend. Keep the claim, lose the shape.
      if (!series) {
        return { ...meta, kind: "narrative", heading: labelish, text: str(raw.note) ?? labelish };
      }
      return { ...meta, kind, label: labelish, series, delta: delta(raw.delta) };
    }

    case "comparison": {
      const entities = (Array.isArray(raw.entities) ? raw.entities : [])
        .map((entity) => {
          const e = entity as Record<string, unknown>;
          const name = str(e.name);
          if (!name) return null;
          return { name, value: num(e.value) ?? 0, display: str(e.display), series: seriesOf(e.series) };
        })
        .filter((entity): entity is NonNullable<typeof entity> => entity !== null);
      return { ...meta, kind, label: labelish, measure: str(raw.measure) ?? "Value", entities };
    }

    case "composition": {
      const parts = (Array.isArray(raw.parts) ? raw.parts : [])
        .map((part) => {
          const p = part as Record<string, unknown>;
          const label = str(p.label);
          const value = num(p.value);
          if (!label || value === undefined) return null;
          // Models slip into percentages despite the schema saying shares.
          return { label, value: value > 1 ? value / 100 : value, delta: delta(p.delta) };
        })
        .filter((part): part is NonNullable<typeof part> => part !== null);
      return { ...meta, kind, label: labelish, parts };
    }

    case "transition": {
      const from = str(raw.from);
      const to = str(raw.to);
      if (!from || !to) {
        return { ...meta, kind: "narrative", heading: labelish, text: str(raw.note) ?? labelish };
      }
      return {
        ...meta, kind,
        subjectLabel: str(raw.subjectLabel) ?? labelish,
        from, to,
        sentiment: sentiment(raw.sentiment),
        note: str(raw.note),
      };
    }

    case "requirement":
      return {
        ...meta, kind,
        amount: str(raw.amount) ?? "—",
        purpose: str(raw.purpose) ?? labelish,
        deadline: str(raw.deadline),
        note: str(raw.note),
      };

    case "recommendation":
      return {
        ...meta, kind,
        title: str(raw.title) ?? labelish,
        rationale: str(raw.rationale) ?? str(raw.text) ?? "",
        action: str(raw.action),
      };

    case "flag":
      return {
        ...meta, kind,
        severity:
          raw.severity === "critical" || raw.severity === "info"
            ? raw.severity
            : ("warn" as const),
        subjectLabel: str(raw.subjectLabel) ?? labelish,
        detail: str(raw.detail) ?? str(raw.text) ?? "",
      };

    case "checklist": {
      const items = (Array.isArray(raw.items) ? raw.items : [])
        .map((item) => {
          // A bare string is the common shape a model reaches for, and refusing it
          // would drop the whole list over punctuation.
          const text = typeof item === "string" ? str(item) : str((item as Record<string, unknown>).text);
          if (!text) return null;
          const i = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
          const state: "todo" | "doing" | "done" =
            i.state === "done" || i.state === "doing" ? i.state : "todo";
          return { text, state, due: str(i.due), owner: str(i.owner) };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      // One tick box is a sentence. Say it as one rather than drawing a list of it.
      if (items.length < 1) {
        return { ...meta, kind: "narrative", heading: labelish, text: str(raw.note) ?? labelish };
      }
      return { ...meta, kind, label: labelish, items };
    }

    case "narrative":
    default: {
      const text = str(raw.text) ?? str(raw.detail) ?? str(raw.rationale);
      if (!text) return null;
      const deltas = (Array.isArray(raw.deltas) ? raw.deltas : [])
        .map(delta)
        .filter((d): d is NonNullable<typeof d> => d !== undefined);
      return {
        ...meta, kind: "narrative",
        heading: str(raw.heading) ?? str(raw.label),
        text,
        deltas: deltas.length > 0 ? deltas : undefined,
      };
    }
  }
}

/** Model output → ops. Ops referencing blocks that don't exist are dropped. */
function coerceOps(value: unknown, doc: ReportDoc): ReportOp[] {
  const ids = new Set(orderedBlocks(doc).map((block) => block.id));
  const raws = Array.isArray(value) ? value : [];

  return raws
    .map((entry, index): ReportOp | null => {
      const raw = entry as Record<string, unknown>;
      const after = str(raw.after);
      const anchor = after && ids.has(after) ? after : undefined;

      switch (raw.op) {
        case "addFinding": {
          const finding = coerceFinding(raw.finding, index);
          return finding
            ? { op: "addFinding", finding, after: anchor, sectionId: str(raw.sectionId) }
            : null;
        }
        case "removeBlock": {
          const blockId = str(raw.blockId);
          return blockId && ids.has(blockId) ? { op: "removeBlock", blockId } : null;
        }
        case "replaceBlock": {
          const blockId = str(raw.blockId);
          const finding = coerceFinding(raw.finding, index);
          return blockId && ids.has(blockId) && finding
            ? { op: "replaceBlock", blockId, finding }
            : null;
        }
        case "setEmphasis": {
          const blockId = str(raw.blockId);
          const emphasis = raw.emphasis;
          const valid = emphasis === "primary" || emphasis === "secondary" || emphasis === "supporting";
          return blockId && ids.has(blockId) && valid
            ? { op: "setEmphasis", blockId, emphasis }
            : null;
        }
        case "reorder": {
          const blockId = str(raw.blockId);
          return blockId && ids.has(blockId) && anchor
            ? { op: "reorder", blockId, after: anchor }
            : null;
        }
        default:
          return null;
      }
    })
    .filter((op): op is ReportOp => op !== null);
}

/* -------------------------------------------------------------------- local */

/**
 * The no-key path.
 *
 * With a report already on screen, anything the local analyst finds that isn't
 * on screen yet becomes an insertion — which is the same "patch, don't
 * regenerate" behaviour the model path has. If it finds nothing new, the ask has
 * moved on, so it rebuilds.
 */
function localAnswer(prompt: string, doc: ReportDoc | null, onStage: OnStage = () => {}): Answer {
  /**
   * The first decision, before any analysis: does this ask want a page built at
   * all? "What's the client's name?" has a one-line answer, and assembling
   * twenty-two cards in front of it is the exact failure the interpretation layer
   * exists to prevent. So intent is read first, and a lookup never reaches the
   * analyst.
   */
  onStage({ id: "answering", state: "start", note: "Answering from the file directly" });

  if (intentOf(prompt, doc !== null && blockCount(doc) > 0) === "answer") {
    const fact = localFact(prompt);
    onStage({ id: "answering", state: "done", note: "One fact, one sentence — nothing to lay out." });
    return {
      kind: "reply",
      reply:
        fact ??
        "That isn't in the file. It covers valuations, holdings, allocation, currency, borrowing, cash flow, goals, risks, fees and meeting notes — ask for any of those and I'll pull it.",
      via: "local",
    };
  }

  const { reply, title, findings } = localAnalyse(prompt);
  onStage({ id: "answering", state: "done", note: reply });

  /* The same decider the model path runs, on the local analyst's own answer. It
     can't overrule findings that already exist — those are structure, not prose —
     but its reading is what fills the panel, so the no-key demo shows the same
     thinking rather than a different, quieter system. */
  onStage({ id: "deciding", state: "start", note: STAGE_LABELS.deciding });
  const decision = decide(prompt, `${reply}\n\n${findings.map((f) => summarise(f)).join("\n")}`);
  onStage({
    id: "deciding",
    state: "done",
    note: findings.length === 0 ? decision.because : `Found ${findings.length} things worth laying out. ${decision.because}`,
    detail: findings.length === 0 ? undefined : decision.categories.map((c) => `${c.label} — ${c.because}`),
  });

  // An analysis that found nothing to draw is a reply, not an empty report.
  if (findings.length === 0) return { kind: "reply", reply, via: "local" };

  onStage({
    id: "structuring",
    state: "done",
    note: `${findings.length} findings across ${new Set(findings.map((f) => f.subject)).size} sections. Assembling.`,
  });

  if (doc) {
    const present = new Set(Object.keys(doc.findings));
    const fresh = findings.filter((finding) => !present.has(finding.id));
    if (fresh.length > 0) {
      const last = orderedBlocks(doc).at(-1)?.id;
      return {
        kind: "patch",
        reply: `Added ${fresh.length} thing${fresh.length === 1 ? "" : "s"} to the report rather than rebuilding it.`,
        ops: fresh.map((finding, i) => ({
          op: "addFinding" as const,
          finding,
          after: i === 0 ? last : `block-${fresh[i - 1].id}`,
        })),
        via: "local",
      };
    }
  }

  return { kind: "report", reply, title, findings, via: "local" };
}

/* ---------------------------------------------------------------------- ask */

/** What the model is told is currently on screen, so a patch can reference it. */
function reportState(doc: ReportDoc) {
  return {
    title: doc.title,
    blocks: orderedBlocks(doc).map((block) => {
      const finding = doc.findings[block.findingId];
      return {
        blockId: block.id,
        findingId: block.findingId,
        subject: finding?.subject ?? "",
        summary: finding ? `${finding.kind}: ${summarise(finding)}` : block.rendererId,
      };
    }),
  };
}

const summarise = (finding: Finding): string => {
  switch (finding.kind) {
    case "metric": return `${finding.label} = ${finding.value}`;
    case "trend": return finding.label;
    case "comparison": return `${finding.label} (${finding.entities.length} entities)`;
    case "composition": return `${finding.label} (${finding.parts.length} parts)`;
    case "transition": return `${finding.subjectLabel} ${finding.from} → ${finding.to}`;
    case "requirement": return `${finding.amount} for ${finding.purpose}`;
    case "narrative": return finding.heading ?? finding.text.slice(0, 60);
    case "recommendation": return finding.title;
    case "flag": return finding.subjectLabel;
    case "checklist": return `${finding.label} (${finding.items.length} items)`;
  }
};

/* --------------------------------------------------------------- the stages */

/**
 * What the pipeline is doing right now, reported as it happens.
 *
 * This exists because the staged flow is slow — deliberately so; the analysis is
 * a separate call from the shaping of it — and a blank report pane for eight
 * seconds reads as broken. The stages are the one honest thing to put there:
 * not a spinner, but what is actually being decided, in the order it is decided.
 */
export type StageId = "answering" | "deciding" | "structuring" | "patching";

export type Stage = {
  id: StageId;
  state: "start" | "done";
  /** One line, in the advisor's language. */
  note?: string;
  /** Supporting lines — the categories found, the counts behind a decision. */
  detail?: string[];
};

export type OnStage = (stage: Stage) => void;

const STAGE_LABELS: Record<StageId, string> = {
  answering: "Reading the file and working out the answer",
  deciding: "Deciding whether this wants a page or a sentence",
  structuring: "Shaping the answer into sections",
  patching: "Changing what's already on screen",
};

/** One model call at one stage. Null on anything unusable, so callers can fall back. */
async function stageCall(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch("/api/lab/dynamic-ui", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    return ((await response.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * A fresh ask, in stages: answer in prose, decide what that prose wants, and only
 * then shape it.
 *
 * The order is the whole design. Nothing here knows whether it is building a
 * report until stage two, which means stage one can't be tempted to write for the
 * schema — and a question that turns out to want a sentence never pays for the
 * structuring call at all.
 */
async function askStaged(
  prompt: string,
  doc: ReportDoc | null,
  history: { role: "user" | "assistant"; text: string }[],
  onStage: OnStage,
): Promise<Answer> {
  onStage({ id: "answering", state: "start", note: STAGE_LABELS.answering });

  const answered = await stageCall({ stage: "answer", prompt, history });
  const prose = str(answered?.answer);
  if (!prose) return localAnswer(prompt, doc, onStage);

  onStage({
    id: "answering",
    state: "done",
    note: `Answered in ${prose.split(/\s+/).length} words. Now looking at what shape that answer has.`,
  });

  onStage({ id: "deciding", state: "start", note: STAGE_LABELS.deciding });
  const decision = decide(prompt, prose);
  onStage({
    id: "deciding",
    state: "done",
    note: decision.because,
    detail:
      decision.wants === "report"
        ? decision.categories.map((category) => `${category.label} — ${category.because}`)
        : undefined,
  });

  // The cheap outcome, and the one the whole decider exists to reach: the answer
  // is the answer, and nothing gets built in front of it.
  if (decision.wants === "reply") return { kind: "reply", reply: prose, via: "model" };

  onStage({ id: "structuring", state: "start", note: STAGE_LABELS.structuring });
  const structured = await stageCall({
    stage: "structure",
    prompt,
    answer: prose,
    categories: decision.categories,
  });

  const findings = (Array.isArray(structured?.findings) ? structured.findings : [])
    .map(coerceFinding)
    .filter((finding): finding is Finding => finding !== null);

  if (findings.length === 0) {
    // The shaping stage found nothing to shape. The prose is still a good answer,
    // so it goes to the chat rather than being thrown away for an empty page.
    onStage({ id: "structuring", state: "done", note: "Nothing in the answer held a shape worth drawing, so it stays as a reply." });
    return { kind: "reply", reply: prose, via: "model" };
  }

  onStage({
    id: "structuring",
    state: "done",
    note: `${findings.length} finding${findings.length === 1 ? "" : "s"} across ${
      new Set(findings.map((finding) => finding.subject)).size
    } sections. Assembling.`,
  });

  return {
    kind: "report",
    reply: str(structured?.reply) ?? prose.split("\n")[0],
    title: str(structured?.title) ?? "Report",
    findings,
    via: "model",
  };
}

export async function ask(
  prompt: string,
  doc: ReportDoc | null,
  history: { role: "user" | "assistant"; text: string }[],
  onStage: OnStage = () => {},
): Promise<Answer> {
  // With a report already on screen the staged flow is the wrong shape: there is
  // nothing to decide about whether to build, and re-answering in prose would
  // throw away the block ids a patch has to reference. Follow-ups stay one call.
  if (doc && blockCount(doc) > 0) {
    onStage({ id: "patching", state: "start", note: STAGE_LABELS.patching });
  } else {
    return askStaged(prompt, doc, history, onStage);
  }

  let payload: unknown;

  try {
    const response = await fetch("/api/lab/dynamic-ui", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        report: doc && blockCount(doc) > 0 ? reportState(doc) : null,
        history,
      }),
    });
    if (!response.ok) return localAnswer(prompt, doc, onStage);
    payload = await response.json();
  } catch {
    return localAnswer(prompt, doc, onStage);
  }

  const data = (payload ?? {}) as Record<string, unknown>;
  const reply = str(data.reply) ?? "";

  if (data.kind === "patch" && doc) {
    const ops = coerceOps(data.ops, doc);
    // A patch that survived coercion as nothing at all would leave the chat
    // claiming a change that never happened, so fall through to a rebuild.
    if (ops.length > 0) return { kind: "patch", reply, ops, via: "model" };
  }

  if (data.kind === "report" || (data.kind === "patch" && Array.isArray(data.findings))) {
    const findings = (Array.isArray(data.findings) ? data.findings : [])
      .map(coerceFinding)
      .filter((finding): finding is Finding => finding !== null);
    if (findings.length > 0) {
      return { kind: "report", reply, title: str(data.title) ?? "Report", findings, via: "model" };
    }
  }

  if (reply) return { kind: "reply", reply, via: "model" };
  return localAnswer(prompt, doc, onStage);
}

/* ---------------------------------------------------------------- one card */

/**
 * A comment aimed at a single block.
 *
 * Same contract as `ask`, deliberately: the answer is ops, so the other cards
 * don't move. What differs is the scope handed to the model — the block's own
 * finding and its current selection, plus the instruction that it may restate
 * that finding but not name what draws it.
 *
 * On anything unusable coming back, the local reviser answers instead. A card
 * that silently ignores what you typed at it is worse than one revised by rules.
 */
export async function askBlock(
  prompt: string,
  doc: ReportDoc,
  blockId: string,
  history: { role: "user" | "assistant"; text: string }[],
): Promise<{ ops: ReportOp[]; reply: string; via: Via }> {
  const block = orderedBlocks(doc).find((candidate) => candidate.id === blockId);
  if (!block) return { ops: [], reply: "That card isn't in the report any more.", via: "local" };

  const local = () => ({ ...reviseLocally(doc, blockId, prompt), via: "local" as const });

  let payload: unknown;
  try {
    const response = await fetch("/api/lab/dynamic-ui", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "block",
        prompt,
        blockId,
        block: {
          blockId: block.id,
          rendererId: block.rendererId,
          drawnBecause: block.selection.reason,
          finding: doc.findings[block.findingId] ?? null,
        },
        report: reportState(doc),
        history,
      }),
    });
    if (!response.ok) return local();
    payload = await response.json();
  } catch {
    return local();
  }

  const data = (payload ?? {}) as Record<string, unknown>;
  const ops = coerceOps(data.ops, doc);
  const reply = str(data.reply) ?? "";

  // The model may legitimately answer a question about the card without changing
  // it — but if it neither changed anything nor said anything, the rules run.
  if (ops.length === 0) return reply ? { ops: [], reply, via: "model" } : local();
  return { ops, reply: reply || "Rethought that card.", via: "model" };
}
