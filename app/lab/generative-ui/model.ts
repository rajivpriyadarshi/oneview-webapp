/**
 * The model boundary — three passes, and nothing else.
 *
 * Lifted wholesale out of `../../api/lab/generative-ui/route.ts` when the lab had to run
 * without a server. Nothing about the passes changed; what changed is that this file
 * knows nothing about where it is executing. It reads no environment, imports nothing
 * from `next/server`, and is handed the credential to use. So the same three prompts and
 * the same two provider shapes serve both callers:
 *
 *   - the route, which passes the server's key and never lets it reach the browser;
 *   - ./pipeline.ts, which passes the key the user typed into the lab's own settings
 *     (see ../apiKey.ts) and calls the provider directly from the page.
 *
 * The second path exists because a static deployment has no route to post to. It is the
 * weaker of the two on every axis that matters in production — the key is in the browser
 * and the provider sees the request's origin — and it is the only one that works on
 * GitHub Pages. The route is tried first wherever a route exists.
 *
 * Every layer that needs a model gets its own request, with its own system prompt and
 * its own tool schema, and sees only what that layer is entitled to see:
 *
 *   - `plan`      What is being asked, and what data would answer it. Sees the *tool
 *                 catalogue*, never the book. It cannot state a figure because it has
 *                 not been shown one.
 *   - `answer`    The prose answer. Sees the data that actually came back, keyed. This
 *                 is the authoritative answer and the thing the whole view falls back
 *                 to; it is written before anyone has thought about layout.
 *   - `structure` The same answer, split into semantic sections. Sees the answer and
 *                 the data. Chooses no components — the vocabulary is not in its
 *                 prompt, and composition happens in ./compose.ts with no model
 *                 involved at all.
 *
 * Two properties are load-bearing and easy to lose in a refactor. `clientBook()` is not
 * here: the facts a pass may use are exactly the bundle it is handed, which is what makes
 * "the model can only use the facts it was given" a property of the wiring rather than a
 * promise in a prompt. And the tool schemas are generated from the zod schemas with
 * `z.toJSONSchema` rather than hand-written beside them, so there is one definition of
 * each contract in the one place where drift is invisible until the output is wrong.
 */

import { z } from "zod";
import type { Provider } from "../apiKey";
import { IntentPlanSchema } from "./intent";
import { parseIntent, parseReport } from "./normalise";
import { SemanticReportSchema } from "./semantic";
import { CATALOGUE, TOOL_NAMES } from "./tools";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";
export const DEFAULT_OPENAI_MODEL = "gpt-5.2";

/* ------------------------------------------------------------------ schemas */

/**
 * Zod → JSON Schema, once per process.
 *
 * `io: "input"` because the model is *filling* the schema, so optionality has to be
 * read from the input side. Computed lazily and cached: a `toJSONSchema` failure
 * should be one failed request, not a module that refuses to load.
 */
const cache = new Map<string, Record<string, unknown>>();

function jsonSchema(name: string, schema: z.ZodType): Record<string, unknown> {
  const hit = cache.get(name);
  if (hit) return hit;
  const raw = z.toJSONSchema(schema, { io: "input", target: "draft-7" }) as Record<string, unknown>;
  // `$schema` is meaningful to a validator and noise to a tool-use API.
  const { $schema: _ignored, ...rest } = raw;
  cache.set(name, rest);
  return rest;
}

/** What the structuring pass returns. `narrative` is the caller's, never the model's. */
const ReportShapeSchema = SemanticReportSchema.omit({ narrative: true });

/* -------------------------------------------------------------------- prompts */

const PLAN_SYSTEM = `You are the planning layer of a private-banking assistant. You work out what job the adviser is trying to do, and what data would answer it. You do not answer the question.

Call plan_task exactly once.

How to decide:
- taskType is the job, not the phrasing. Two questions that produce the same shape of answer are the same task.
- surface is "text" only when the whole answer is one or two sentences: a fact, a name, a date, a single figure, a point of context. Everything else is "view". If the answer would carry three or more figures, weigh two things against each other, run down a schedule, list exposures, or argue for a course of action, it is "view". "How is the portfolio doing", "what are the risks", "how would he fund this" are all "view". A "lookup" task is always "text". When it is genuinely borderline, choose "view" — a laid-out answer still contains the prose, and a prose answer cannot contain the layout.
- needs.count must be set whenever the adviser named a number of things ("his two biggest", "the top four"). It is load-bearing and must not be rounded.
- needs flags describe what the task structurally requires, not what would be nice to have. comparison only when two or more named things are weighed against each other. chronology only when the answer is ordered by date and the dates are the argument — a schedule, a sequence of events; a twelve-month performance line is not chronology. composition only when parts of a whole are the point. actions only when the answer ends in something to do.
- because is a stated conclusion in one short sentence, in the adviser's language. Not your reasoning, not a description of your process.
- goal restates the job in one sentence.

Data requests: choose from the tools below, and only these. Give each one a dotted lower-case key you would want to refer to it by later (perf.series, alloc.sector, risk.open). Request what the answer needs and nothing more — four to seven requests answers most substantial questions. Mark a request required only when the answer is impossible without it.

Available tools:
${CATALOGUE}

You have not been shown any of the client's data and must not state any figure, holding, name or date as fact.`;

const ANSWER_SYSTEM = `You are a private-banking assistant answering an adviser about their client.

You are given the data that was fetched for this question, as JSON keyed by reference. That data is the only thing you know. Every figure, name, date and holding you mention must come from it. If something needed is missing, say so plainly in one clause and answer with what is there.

Write the answer, in prose:
- Lead with the conclusion. The adviser is busy and reads the first sentence.
- Two to four short paragraphs. No headings, no bullet lists, no markdown.
- Quote figures exactly as the data gives them. Do not convert units, re-base percentages, or round.
- Be specific. "Technology is 29% of the portfolio, up from 21%" beats "technology exposure has grown".
- Say what it means, not just what it is. Where something needs a decision, say so.
- No preamble, no offer to help further, no restating the question.

This answer is the authoritative response and may be shown on its own, so it must stand up without any accompanying layout.`;

const STRUCTURE_SYSTEM = `You are the semantic layer. You have an answer that has already been written and the data behind it. Your job is to say what the answer *means*, as structure. You do not write, revise, extend or improve the answer, and you do not add a single fact that is not already in it.

Call structure_report exactly once.

Title:
- The title names the document, the way a filed report is named. "Prashanth's portfolio review", "Prashanth's two largest holdings compared", "Funding the Sentosa purchase".
- Never the question that was asked, never a question at all, and never a sentence. "How is Prashanth's portfolio doing?" is a query; it is not a title.
- Name the client or the subject in it where there is one, so the page is identifiable without the query beside it.
- Never an answer or a figure. "Portfolio up 6.2%" is a finding and belongs in a section.

Sections:
- A section is a group of claims that answer one reader-facing question. Write that question in the question field, as a question.
- Two sections that answer the same question — contributors and detractors, this month and year to date — must either share an identical question string or be joined by an answers_same_question relation. This is how they end up presented as one thing rather than two.
- groups names which sibling view a section is: ["contributors"], ["detractors"], ["1M"], ["YTD"]. Set it only for genuine sibling views of one question.
- semanticType is what the section is about. Put provenance, methodology and sources in an "evidence" section.
- importance: exactly one section should be primary — the one that answers what was asked.
- dataKeys must be keys from the data you were given, spelled exactly. Do not invent keys.
- Prefer four to six substantial sections over ten thin ones.

Findings are the individual claims. Choose the kind that matches the shape of the claim: metric for one figure that matters, trend for something over time, comparison for entities on one measure, composition for parts of a whole, transition for "moved from A to B", requirement for an amount needed by a date, flag for something outside where it should be, recommendation for an argued course of action, checklist for outstanding items, narrative for judgement and context.

Rules that matter:
- Pre-formatted string fields (a metric's value, a delta's label, a requirement's amount) must read exactly as the answer states them, currency symbol and all.
- Numeric fields are raw numbers with no formatting. A composition's part values are shares — 0.52, not 52.
- A delta's sentiment is whether the change is good or bad for this client, not whether the number went up.
- Only put a claim in a section's detail array if it is methodology or provenance that a reader does not need on a first scan.
- Labels, measure names and entity names are read by a person. Write them as English — "Index level", not "indexLevel"; never a field name from the data.
- A metric's value is a single figure, written the way a reader reads it: "S$3.6m", "+32.1%", "S$800k". Never a field name, never a field name next to a number ("returnYtdPct 32.1"), never two or three figures crammed into one value. If the claim needs two figures held against each other it is not a metric — it is a comparison, or a transition from A to B.
- Give a metric a basis wherever the answer states one: what the figure is measured against, in a few words. "of total portfolio", "vs. the 35–45% range you set", "in the last 12 months", "across all custody accounts". It is a claim, not a caption — write it only where the answer supports it, and never invent a benchmark, a target or a range the data does not contain. No figure in it that the value or delta already carries.
- Things weighed against each other are one comparison finding holding every one of them, not one metric finding each. Five holdings compared is one comparison with five entities; five holdings on three measures is three comparison findings over the same five entities, one per measure. Never drop entities to make a claim fit, and never split one measure across several findings.
- If the data holds a series for what a claim is about, carry it: a trend's series.points, or every entity's own series on a comparison. A twelve-month history described as two end values is a different claim from the one the answer makes, and the presentation layer cannot recover the shape you left out.

You are describing meaning. You are not choosing layout, components, charts, colours, sizes, order or emphasis — none of that is yours, and none of it is available to you.`;

/* --------------------------------------------------------------- providers */

type Tool = { name: string; description: string; schema: Record<string, unknown> };
type Call = { name: string; input: unknown };
type ModelReply = { text: string; call: Call | null };
type Ask = {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: Tool[];
  force?: string;
};

/**
 * Who to call and with what.
 *
 * `fromBrowser` is not a preference. Anthropic rejects a request carrying a key from a
 * page origin unless it is told the caller meant it, which is a guard against a key
 * ending up in a web app by accident. Here it is not an accident — the lab asked the
 * user for the key and said where it would go — so the header is set, and it is set from
 * this flag rather than by sniffing for `window` so that the route can never send it.
 */
export type Credential = {
  provider: Provider;
  key: string;
  /** Overrides for the model id, where a caller has them. */
  model?: string;
  fromBrowser?: boolean;
};

async function callAnthropic(credential: Credential, ask: Ask): Promise<ModelReply> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": credential.key,
      "anthropic-version": "2023-06-01",
      ...(credential.fromBrowser ? { "anthropic-dangerous-direct-browser-access": "true" } : {}),
    },
    body: JSON.stringify({
      model: credential.model ?? DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      system: ask.system,
      messages: ask.messages,
      ...(ask.tools.length > 0
        ? {
            tools: ask.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.schema,
            })),
          }
        : {}),
      ...(ask.force ? { tool_choice: { type: "tool", name: ask.force } } : {}),
    }),
  });

  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);

  const body = (await response.json()) as {
    content?: { type: string; text?: string; name?: string; input?: unknown }[];
  };

  let text = "";
  let call: Call | null = null;
  for (const block of body.content ?? []) {
    if (block.type === "text" && block.text) text += block.text;
    if (block.type === "tool_use" && block.name) call = { name: block.name, input: block.input };
  }
  return { text: text.trim(), call };
}

async function callOpenAI(credential: Credential, ask: Ask): Promise<ModelReply> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${credential.key}` },
    body: JSON.stringify({
      model: credential.model ?? DEFAULT_OPENAI_MODEL,
      max_completion_tokens: 16000,
      messages: [{ role: "system", content: ask.system }, ...ask.messages],
      ...(ask.tools.length > 0
        ? {
            tools: ask.tools.map((tool) => ({
              type: "function",
              function: { name: tool.name, description: tool.description, parameters: tool.schema },
            })),
          }
        : {}),
      ...(ask.force ? { tool_choice: { type: "function", function: { name: ask.force } } } : {}),
    }),
  });

  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);

  const body = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: { function?: { name?: string; arguments?: string } }[];
      };
    }[];
  };

  const message = body.choices?.[0]?.message;
  let call: Call | null = null;
  const first = message?.tool_calls?.[0]?.function;
  if (first?.name) {
    try {
      call = { name: first.name, input: JSON.parse(first.arguments ?? "{}") };
    } catch {
      call = null;
    }
  }
  return { text: (message?.content ?? "").trim(), call };
}

const askModel = (credential: Credential, input: Ask): Promise<ModelReply> =>
  credential.provider === "anthropic" ? callAnthropic(credential, input) : callOpenAI(credential, input);

/* --------------------------------------------------------------- the passes */

export const StageRequestSchema = z.object({
  stage: z.enum(["plan", "answer", "structure"]),
  query: z.string().min(1),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() })).optional(),
  /** The plan, on the passes that follow it. */
  plan: z.unknown().optional(),
  /** The bundle's values, keyed. The only facts a content pass ever sees. */
  values: z.record(z.string(), z.unknown()).optional(),
  /** The pass-1 answer, on the structuring pass. */
  answer: z.string().optional(),
});

export type StageRequest = z.infer<typeof StageRequestSchema>;

/**
 * What a pass produced, as data rather than as a `Response`.
 *
 * `status` is carried so the route can hand it straight to HTTP without a second table
 * mapping reasons to codes. 501 is the one that matters: no key is a configuration
 * state, not a failure, and the caller has a deterministic stand-in to select instead.
 */
export type StageOutcome =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string; detail?: string; dropped?: string[] };

const transcript = (history: { role: "user" | "assistant"; text: string }[] | undefined): string => {
  const earlier = (history ?? []).slice(-6, -1).filter((turn) => turn.text.trim().length > 0);
  if (earlier.length === 0) return "";
  return `\n\nEarlier in this conversation:\n${earlier
    .map((turn) => `${turn.role === "user" ? "Adviser" : "You"}: ${turn.text}`)
    .join("\n")}`;
};

/**
 * Run one pass. Never throws.
 *
 * Every failure comes back as `{ ok: false }` with a legible detail, because both callers
 * have somewhere to land and neither can do anything useful with an exception.
 */
export async function runStage(input: StageRequest, credential: Credential | null): Promise<StageOutcome> {
  const parsed = StageRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: "bad-request", detail: parsed.error.message };
  const body = parsed.data;

  if (!credential?.key) return { ok: false, status: 501, error: "no-key" };

  const facts = JSON.stringify(body.values ?? {}, null, 1);

  try {
    if (body.stage === "plan") {
      const reply = await askModel(credential, {
        system: PLAN_SYSTEM,
        messages: [{ role: "user", content: `The adviser asks: "${body.query}"${transcript(body.history)}` }],
        tools: [
          {
            name: "plan_task",
            description: `Record what is being asked and what data would answer it. Tools available: ${TOOL_NAMES.join(", ")}.`,
            schema: jsonSchema("plan", IntentPlanSchema),
          },
        ],
        force: "plan_task",
      });

      const outcome = parseIntent(reply.call?.input);
      if (!outcome.plan) {
        return {
          ok: false,
          status: 502,
          error: "no-plan",
          detail: outcome.reason ?? reply.text ?? "the plan did not validate",
        };
      }
      return { ok: true, body: { kind: "plan", plan: outcome.plan } };
    }

    if (body.stage === "answer") {
      const goal = (body.plan as { goal?: string } | undefined)?.goal;
      const reply = await askModel(credential, {
        system: ANSWER_SYSTEM,
        messages: [
          {
            role: "user",
            content: `The adviser asks: "${body.query}"${goal ? `\n\nWhat they are trying to do: ${goal}` : ""}${transcript(body.history)}\n\nThe data fetched for this question:\n${facts}`,
          },
        ],
        tools: [],
      });

      if (!reply.text) return { ok: false, status: 502, error: "no-answer" };
      return { ok: true, body: { kind: "answer", answer: reply.text } };
    }

    /* structure */
    const answer = body.answer?.trim();
    if (!answer) return { ok: false, status: 400, error: "no-answer-to-structure" };

    const reply = await askModel(credential, {
      system: STRUCTURE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `The adviser asked: "${body.query}"\n\nThe answer that was written:\n${answer}\n\nThe data behind it, keyed. Use these keys exactly in dataKeys:\n${facts}`,
        },
      ],
      tools: [
        {
          name: "structure_report",
          description: "Record what the answer means, as semantic sections and findings. No presentation decisions.",
          schema: jsonSchema("report", ReportShapeSchema),
        },
      ],
      force: "structure_report",
    });

    const outcome = parseReport(reply.call?.input, answer);
    if (!outcome.report) {
      return { ok: false, status: 502, error: "no-report", detail: outcome.reason, dropped: outcome.dropped };
    }
    return { ok: true, body: { kind: "report", report: outcome.report, dropped: outcome.dropped } };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: "upstream",
      detail: error instanceof Error ? error.message : "unknown",
    };
  }
}
