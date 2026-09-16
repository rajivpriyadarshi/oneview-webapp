/**
 * The model behind /lab/dynamic-ui.
 *
 * This is layers 1–2 of DESIGN.md for real: the ask is open-ended, so a scripted
 * source can't answer it. The model reads the client book, decides what it found,
 * and reports *findings* — never a component, never a colour, never a size. What
 * to draw is decided afterwards, deterministically, by select.ts on the client.
 *
 * Three outcomes, and the model picks between them by choosing a tool:
 *   build_report  — a new report for a fresh ask
 *   patch_report  — ops against the report already on screen (follow-ups)
 *   no tool       — a plain conversational answer, when nothing needs drawing
 *
 * Runs on either Anthropic or OpenAI — whichever key is present, Anthropic first.
 * The tool contract is written once, in Anthropic's shape, and translated per
 * provider at the bottom of this file; the pipeline downstream cannot tell which
 * one answered.
 *
 * Server-side so the key never reaches the browser. If there is no key the route
 * says so and the client falls back to a local heuristic source, which is enough
 * to demo the assembly but is not the interesting half.
 */

import { NextResponse } from "next/server";
import { clientBook } from "../../../lab/dynamic-ui/clientBook";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const ANTHROPIC_MODEL = process.env.DYNAMIC_UI_MODEL ?? "claude-sonnet-5";
const OPENAI_MODEL = process.env.DYNAMIC_UI_OPENAI_MODEL ?? "gpt-5.2";

/* -------------------------------------------------------------- the contract */

const SERIES = {
  type: "object",
  properties: {
    name: { type: "string" },
    points: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, value: { type: "number" } },
        required: ["label", "value"],
      },
    },
  },
  required: ["name", "points"],
} as const;

const DELTA = {
  type: "object",
  properties: {
    label: { type: "string", description: "Pre-formatted, e.g. \"+4.8% QoQ\"" },
    value: { type: "number" },
    sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
  },
  required: ["label", "value", "sentiment"],
} as const;

/**
 * One schema covering all nine kinds, with the kind-specific fields optional.
 *
 * A discriminated union would be tighter, but tool schemas are a prompt as much
 * as a validator — one flat shape with described fields gets better compliance
 * than nine branches, and the client validates and coerces anyway.
 */
const FINDING = {
  type: "object",
  properties: {
    id: { type: "string", description: "kebab-case, unique within the report" },
    kind: {
      type: "string",
      enum: [
        "metric", "trend", "comparison", "composition",
        "transition", "requirement", "narrative", "recommendation", "flag", "checklist",
      ],
    },
    subject: {
      type: "string",
      description:
        "The section this belongs in, as meaning not position — e.g. \"Liquidity\". Findings sharing a subject are grouped.",
    },
    emphasis: { type: "string", enum: ["primary", "secondary", "supporting"] },
    confidence: { type: "number", description: "0–1" },
    sources: {
      type: "array",
      items: { type: "string" },
      description: "Which parts of the book this came from, e.g. \"Custody positions\"",
    },

    label: {
      type: "string",
      description:
        "Short heading for this finding, in the advisor's words — e.g. \"Funding sources against the need\". Always give one: it is what the reader sees at the top of the card.",
    },
    value: { type: "string", description: "metric: pre-formatted, e.g. \"S$33.3m\"" },
    delta: DELTA,
    series: SERIES,
    measure: { type: "string", description: "comparison: what is being compared" },
    entities: {
      type: "array",
      description: "comparison: give every entity a series when history matters",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "number" },
          display: { type: "string" },
          series: SERIES,
        },
        required: ["name", "value"],
      },
    },
    parts: {
      type: "array",
      description: "composition: values are shares of the whole (0.52, not 52)",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "number" },
          delta: DELTA,
        },
        required: ["label", "value"],
      },
    },
    subjectLabel: { type: "string", description: "transition / flag: what moved or what is wrong" },
    from: { type: "string", description: "transition" },
    to: { type: "string", description: "transition" },
    sentiment: { type: "string", enum: ["positive", "negative", "neutral"] },
    note: { type: "string" },
    amount: { type: "string", description: "requirement: pre-formatted" },
    purpose: { type: "string", description: "requirement" },
    deadline: { type: "string", description: "requirement: human phrasing" },
    heading: { type: "string", description: "narrative" },
    text: { type: "string", description: "narrative: markdown" },
    deltas: { type: "array", items: DELTA, description: "narrative: figures to pull out as chips" },
    title: { type: "string", description: "recommendation" },
    rationale: { type: "string", description: "recommendation" },
    action: { type: "string", description: "recommendation" },
    severity: { type: "string", enum: ["info", "warn", "critical"], description: "flag" },
    items: {
      type: "array",
      description:
        "checklist: things somebody still has to do. One line each, phrased as the action, not as advice about the action.",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          state: { type: "string", enum: ["todo", "doing", "done"] },
          due: { type: "string", description: "human phrasing, e.g. \"before the March review\"" },
          owner: { type: "string" },
        },
        required: ["text"],
      },
    },
  },
  // `label` is required for every kind, including the ones that don't strictly
  // need it. A card whose heading fell back to its own slug ("outstanding-
  // checklist") is the most visible way this contract can fail, and one required
  // string is a cheaper fix than per-kind schemas.
  required: ["id", "kind", "subject", "emphasis", "confidence", "sources", "label"],
} as const;

const TOOLS = [
  {
    name: "build_report",
    description:
      "Report what you found, as findings, for a new report. Use this when the advisor asks something that deserves a composed answer — an analysis, a review, a breakdown, a comparison, a summary of a topic. Also use it when the ask replaces the report on screen entirely.",
    input_schema: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          description:
            "One or two sentences to the advisor in the chat. Say what you looked at and what stood out. Never mention components, charts or layout.",
        },
        title: { type: "string", description: "Report title, e.g. \"Liquidity and near-term funding\"" },
        findings: { type: "array", items: FINDING },
      },
      required: ["reply", "title", "findings"],
    },
  },
  {
    name: "patch_report",
    description:
      "Change the report already on screen, rather than rebuilding it. Use this for follow-ups: adding something, removing something, restructuring, re-emphasising, reordering. Never regenerate what the advisor is already reading.",
    input_schema: {
      type: "object",
      properties: {
        reply: { type: "string", description: "One or two sentences to the advisor." },
        ops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: {
                type: "string",
                enum: ["addFinding", "removeBlock", "replaceBlock", "setEmphasis", "reorder"],
              },
              finding: FINDING,
              blockId: { type: "string", description: "From the report state you were given" },
              after: {
                type: "string",
                description: "Block id to place this after. Omit on addFinding to append.",
              },
              sectionId: { type: "string" },
              emphasis: { type: "string", enum: ["primary", "secondary", "supporting"] },
            },
            required: ["op"],
          },
        },
      },
      required: ["reply", "ops"],
    },
  },
];

const SYSTEM = `You are the analysis engine behind a private-wealth advisor's assistant. You are talking to the advisor, not the client.

You are given a book of facts about one client. Answer only from it: never invent a number, a holding, a date or a meeting. If the book cannot answer something, say so in your reply and report whatever it can support.

WHAT YOU OUTPUT

You report FINDINGS — claims about the data, plus the shape of the evidence for them. You never choose how anything is drawn. Do not name, request or hint at a component, chart type, colour, size, column or position. A separate deterministic layer reads the shape of your findings and picks the visual. Saying "show this as a pie chart" is the one thing that breaks this system.

The shape you give a finding IS how you influence the result, so be deliberate:
- one number that matters -> metric, with a series if the history is in the book
- one thing over time -> trend with a series
- N things on one measure -> comparison; give each entity its own series when the ask is about how they moved, not just where they ended

If the ask names a number of things — "the top 4 holdings", "his two biggest", "the worst three" — the comparison must contain exactly that many entities. Fewer only if the book holds fewer, and say so in your reply. A number in the ask is the one instruction you must not round off.

Comparing performance means comparing like with like: don't put a pooled sleeve's return (a bond ladder, a fund) on the same measure as a single listed name unless the advisor asked for exactly that.
- parts of a whole -> composition, values as shares (0.52, not 52)
- it moved from A to B -> transition
- an amount needed by a date -> requirement
- something is wrong -> flag
- do this, because -> recommendation
- things somebody still has to do -> checklist, one item per line. Use this rather than several recommendations when the advisor's question is "what is outstanding" — a recommendation argues a case, a checklist just needs working through.
- anything that is genuinely prose -> narrative, with deltas when there are figures worth pulling out

Prefer structure over prose: a narrative finding is the right answer for judgement and context, not for numbers you were too lazy to shape. But do not force structure that isn't there — a one-entity "comparison" is worse than a sentence.

'subject' groups findings into sections, so use a handful of meaningful subjects and put related findings under the same one. Order findings the way they should be read; put the thing that matters most first and mark it emphasis "primary". Most reports have 1-3 primary findings, not eight.

FOLLOW-UPS

When a report is already on screen, patch it. Add, remove, replace, re-emphasise or reorder using the block ids you were given. Restructuring means reorder and setEmphasis ops — not rebuilding. Only build_report again if the advisor has genuinely moved to a different subject.

REPORT OR REPLY — DECIDE THIS FIRST

Not every ask wants a page built. Before anything else, decide whether the answer has a shape.

Answer in plain text, calling NO tool, when the answer is one fact: a name, a date, a single number, who the relationship manager is, what the risk profile says, whether a document exists. "What is the client's name?" is one sentence. Building cards in front of a one-line answer is the worst thing you can do here, and it is worse than being terse.

Build a report when several things stand in relation to each other and the advisor has to see them together: an analysis, a comparison, a breakdown, an allocation, performance attribution, preparation for a review.

If you are between the two, answer in a sentence and offer to go deeper. The advisor can always ask for the report; they cannot un-see twenty cards.

HOW ANYTHING YOU SAY IN THE CHAT READS

The chat is plain text. No markdown, no bold, no bullet characters, no headings — asterisks show up literally on screen.

The book is a data file, so never quote its field names or raw values back: "35% funded" not "fundedPct 0.35", "within three months" not "horizon: within 3 months". Write the figure the way an advisor would say it out loud.`;

/**
 * Layer 6, aimed at one card.
 *
 * The advisor selected a block and typed at it. The scope is deliberately narrow:
 * restate *that* finding, or answer a question about it. Everything else on the
 * page is off limits, because the whole point of a card-level edit is that the
 * rest of the report doesn't move.
 */
const BLOCK_SYSTEM = `${SYSTEM}

YOU ARE EDITING ONE CARD

The advisor has selected a single block and commented on it. You are given that block's finding and the report around it.

- Change only that block. Use patch_report with a replaceBlock op carrying the restated finding, or setEmphasis, or removeBlock. Do not touch any other blockId, and do not add blocks unless the comment explicitly asks for something alongside it.
- Restate the finding at the shape the comment asks for: more or fewer entities, a different measure, with or without history. Keep the id kebab-case and make it describe the new shape, so it is a different id from the old one.
- The rule about never naming a component still holds, even if the advisor names one themselves. If they say "make this a table", report the finding and let the deterministic layer handle the request — a separate override path already exists for that, and it is not yours.
- If the comment is a question about the card rather than an instruction to it, answer in plain text and call no tool.`;

/* ------------------------------------------------------------ staged answering
 *
 * The two stages that make up a fresh ask, in order:
 *
 *   1. answer    — think about the question in prose, with no tools and no idea
 *                  that a report exists. This is the analysis.
 *   2. structure — take the prose it already wrote and shape it into findings,
 *                  adding nothing.
 *
 * Splitting them is the point. Asking one call to analyse *and* emit structured
 * findings makes the structure lead the thinking: the model reaches for four
 * comparisons because comparisons are what the schema rewards. Answering first in
 * prose means the analysis is the analysis, and the shaping stage is a translation
 * with a decision already made about whether it is even needed.
 *
 * Between the two, the client's decider reads the prose and says whether it wants
 * a page at all — which is why stage 1 must not be told about findings.
 */

const ANSWER_SYSTEM = `You are the analysis engine behind a private-wealth advisor's assistant. You are talking to the advisor, not the client.

You are given a book of facts about one client. Answer only from it: never invent a number, a holding, a date or a meeting. If the book cannot answer something, say so plainly.

Answer the advisor's question in prose, as well as you can, at whatever length it deserves. A question with a one-fact answer gets one sentence — do not pad it, and do not volunteer an analysis nobody asked for. A question that genuinely needs several things weighed against each other gets all of them.

Cite the actual figures from the book as you go. Be specific: "S$4.2m, 12.6% of the portfolio" rather than "a significant position".

Write for a person. The book is a data file, so never quote its field names, keys or raw values at the advisor — "35% funded" not "fundedPct 0.35", "within three months" not "horizon: \\"within 3 months\\"". No markdown, no bold, no citations in brackets.

Do not describe a layout, a chart, a card or a component. Do not write headings. Just answer.`;

const STRUCTURE_SYSTEM = `${SYSTEM}

YOU ARE SHAPING AN ANSWER YOU ALREADY WROTE

You are given the advisor's question, the prose answer you already gave, and the sections that answer earned.

Your only job is to turn that prose into findings. Add nothing: every figure, name, date and claim must already be in the answer. If something in the answer has no shape worth drawing, it is a narrative finding — that is a legitimate outcome, not a failure.

Cover the sections you were given, in the order you were given them, using the finding kind named for each. If a section turns out to have nothing behind it in the answer, skip it and say so in your reply rather than inventing something to fill it.`;

const STRUCTURE_TOOL = {
  name: "structure_report",
  description:
    "Shape the prose answer you already gave into findings. Adds nothing new — this is a translation, not a second analysis.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description:
          "One or two sentences to the advisor. Say what the report lays out. Never mention components, charts or layout.",
      },
      title: { type: "string", description: "Report title, e.g. \"Liquidity and near-term funding\"" },
      findings: { type: "array", items: FINDING },
    },
    required: ["reply", "title", "findings"],
  },
};

/* ------------------------------------------------------------------ providers
 *
 * Two APIs, one shape.
 *
 * Everything above is written against Anthropic's tool format because that is
 * what the contract was designed in — a tool schema here is a prompt as much as a
 * validator, and rewriting the descriptions per provider would let the two drift
 * apart in exactly the place where drift is invisible until the output is wrong.
 * So the schemas stay in one form and this layer translates.
 *
 * Which provider runs is decided by which key is present, Anthropic first. The
 * pipeline downstream cannot tell the difference: it gets prose from the answer
 * stage and one tool call from the others, either way.
 */

type Call = { name: string; input: unknown };
type ModelReply = { text: string; call: Call | null };

type Tool = { name: string; description: string; input_schema: unknown };

type Ask = {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: Tool[];
  /** Set when the stage has exactly one legitimate outcome. */
  force?: string;
};

async function callAnthropic(key: string, ask: Ask): Promise<ModelReply> {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      system: ask.system,
      ...(ask.tools.length > 0
        ? {
            tools: ask.tools,
            ...(ask.force ? { tool_choice: { type: "tool", name: ask.force } } : {}),
          }
        : {}),
      messages: ask.messages,
    }),
  });

  if (!response.ok) throw new Error(`anthropic ${response.status}: ${await response.text()}`);

  const data = (await response.json()) as {
    content?: ({ type: "text"; text: string } | { type: "tool_use"; name: string; input: unknown })[];
  };
  const blocks = data.content ?? [];

  return {
    text: blocks
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim(),
    call:
      blocks.find(
        (block): block is { type: "tool_use"; name: string; input: unknown } => block.type === "tool_use",
      ) ?? null,
  };
}

async function callOpenAI(key: string, ask: Ask): Promise<ModelReply> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      // Reasoning models on this endpoint take max_completion_tokens, and the
      // reasoning itself is billed against it — hence the headroom over the 8k
      // Anthropic gets for the same work.
      max_completion_tokens: 16000,
      messages: [{ role: "system", content: ask.system }, ...ask.messages],
      ...(ask.tools.length > 0
        ? {
            tools: ask.tools.map((tool) => ({
              type: "function",
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema,
              },
            })),
            tool_choice: ask.force
              ? { type: "function", function: { name: ask.force } }
              : "auto",
          }
        : {}),
    }),
  });

  if (!response.ok) throw new Error(`openai ${response.status}: ${await response.text()}`);

  const data = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: { function?: { name?: string; arguments?: string } }[];
      };
    }[];
  };

  const message = data.choices?.[0]?.message;
  const raw = message?.tool_calls?.[0]?.function;

  let call: Call | null = null;
  if (raw?.name) {
    // Arguments arrive as a JSON string. Malformed JSON is treated as no call at
    // all rather than throwing — the client's fallback chain handles an empty
    // outcome, and taking the whole request down loses the prose too.
    try {
      call = { name: raw.name, input: JSON.parse(raw.arguments ?? "{}") };
    } catch {
      call = null;
    }
  }

  return { text: (message?.content ?? "").trim(), call };
}

/* ----------------------------------------------------------------- the route */

type Body = {
  prompt?: string;
  /** "block" when the comment is aimed at one selected card. */
  mode?: "ask" | "block";
  /**
   * Which stage of a fresh ask this is. Omitted means the single-shot path, which
   * is what a follow-up patch against an existing report still uses.
   */
  stage?: "answer" | "structure";
  /** structure stage: the prose from the answer stage, verbatim. */
  answer?: string;
  /** structure stage: what the decider found in that prose. */
  categories?: { id: string; label: string; produces: string; because: string }[];
  blockId?: string;
  /** The selected block, with the finding behind it. */
  block?: unknown;
  /** Compact description of what's on screen, so patches can reference block ids. */
  report?: { title: string; blocks: { blockId: string; findingId: string; subject: string; summary: string }[] } | null;
  history?: { role: "user" | "assistant"; text: string }[];
};

export async function POST(request: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey && !openaiKey) {
    // Not an error the user can fix from the UI, so it's reported as a
    // capability the client can route around rather than a failure.
    return NextResponse.json({ error: "no-key" }, { status: 501 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) return NextResponse.json({ error: "no-prompt" }, { status: 400 });

  const state = body.report
    ? `A report is currently on screen. Patch it rather than rebuilding it unless the advisor has moved on.\n\n${JSON.stringify(body.report)}`
    : "No report is on screen yet.";

  const editingCard = body.mode === "block" && !!body.blockId && !!body.block;
  const stage = body.stage;

  const sections = (body.categories ?? [])
    .map((category, i) => `${i + 1}. ${category.label} — as ${category.produces} findings (${category.because})`)
    .join("\n");

  const content = editingCard
    ? `CLIENT BOOK\n${clientBook()}\n\nREPORT STATE\n${state}\n\nSELECTED CARD\n${JSON.stringify(body.block)}\n\nADVISOR'S COMMENT ON THAT CARD\n${prompt}`
    : stage === "answer"
      ? `CLIENT BOOK\n${clientBook()}\n\nADVISOR ASKS\n${prompt}`
      : stage === "structure"
        ? `CLIENT BOOK\n${clientBook()}\n\nADVISOR ASKED\n${prompt}\n\nTHE ANSWER YOU GAVE\n${body.answer ?? ""}\n\nSECTIONS THIS ANSWER EARNED\n${sections || "(none identified — use your judgement, and keep it to what the answer says)"}`
        : `CLIENT BOOK\n${clientBook()}\n\nREPORT STATE\n${state}\n\nADVISOR ASKS\n${prompt}`;

  const messages = [
    // The structure stage is a translation of one specific piece of prose it is
    // handed outright, so earlier turns are noise that pulls it toward answering
    // the question again.
    ...(stage === "structure" ? [] : (body.history ?? []).slice(-8)).map((turn) => ({
      role: turn.role,
      content: turn.text,
    })),
    { role: "user" as const, content },
  ];

  const system = editingCard
    ? BLOCK_SYSTEM
    : stage === "answer"
      ? ANSWER_SYSTEM
      : stage === "structure"
        ? STRUCTURE_SYSTEM
        : SYSTEM;

  /* The tool list is the cheapest way to make a wrong outcome impossible rather
     than merely discouraged: editing one card can only be a patch, the answer
     stage must not reach for structure at all, and the structure stage has
     exactly one thing to do and is forced to do it. */
  const ask: Ask = {
    system,
    messages,
    tools:
      stage === "answer"
        ? []
        : stage === "structure"
          ? [STRUCTURE_TOOL]
          : editingCard
            ? TOOLS.filter((tool) => tool.name === "patch_report")
            : TOOLS,
    force: stage === "structure" ? "structure_report" : undefined,
  };

  let result: ModelReply;
  try {
    result = anthropicKey
      ? await callAnthropic(anthropicKey, ask)
      : await callOpenAI(openaiKey as string, ask);
  } catch (error) {
    return NextResponse.json({ error: "upstream", detail: String(error) }, { status: 502 });
  }

  const { text, call } = result;

  // The answer stage is prose by construction. It goes back unshaped, because the
  // decision about what to do with it is the client's to make.
  if (stage === "answer") {
    return NextResponse.json({ kind: "answer", answer: text });
  }

  if (!call) {
    return NextResponse.json({ kind: "reply", reply: text || "I don't have anything to add." });
  }

  const input = (call.input ?? {}) as Record<string, unknown>;
  const reply = typeof input.reply === "string" && input.reply ? input.reply : text;

  if (call.name === "patch_report") {
    return NextResponse.json({
      kind: "patch",
      reply,
      ops: Array.isArray(input.ops) ? input.ops : [],
    });
  }

  return NextResponse.json({
    kind: "report",
    reply,
    title: typeof input.title === "string" ? input.title : "Report",
    findings: Array.isArray(input.findings) ? input.findings : [],
  });
}
