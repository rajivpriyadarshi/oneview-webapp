"use client";

/**
 * /lab/generative-ui — the pipeline, driven by a real question.
 *
 * Same surface as `../dynamic-ui`: the advisor chat on the left, the client overview
 * on the right, and the generated view opening over it. The chrome is copied
 * class-for-class from that prototype (which copied it from app/client/page.tsx) so
 * the two can be compared without the shell being a variable — a copy on purpose, so
 * editing this lab cannot move a real screen.
 *
 * What is different is everything behind the send button. That prototype asked a
 * model for a finished document and animated it in. Here the query goes through nine
 * layers (./pipeline.ts), the model never sees a component name, the layout is chosen
 * by rules, and the result is validated before it is allowed on screen. Two things
 * on this page exist to make that visible rather than merely true:
 *
 *   - **The stage list** is the real pipeline reporting itself, each line filled in
 *     with what that layer actually did — the keys it fetched, the recipe it chose,
 *     the verdict it reached (§13).
 *   - **The answer** is always the first thing the chat says, and it takes over the
 *     pane entirely when composition fails. There is no toggle and no debug control:
 *     this pane is the report. Rich UI is an enhancement, never the source of truth
 *     (§14). The composer's trace, the validator's issues and anything dropped stay
 *     in the run result for whoever is debugging — they are not furniture on the page.
 *
 * This file owns state and pacing only. No layout decision is taken here.
 */

import { Check } from "lucide-react";
import React, { type CSSProperties } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import SuggestionChip from "../../components/SuggestionChip";
import MockClientOverview from "../MockClientOverview";
import { CLIENT } from "../dynamic-ui/clientBook";
import { INK, LABEL } from "./chrome";
import { run, type RunResult, type Stage, type Turn as HistoryTurn } from "./pipeline";
import { PINNED_CLIENTS, pinnedClient, type PinnedClientId } from "./pinned";
import { NarrativeFallback, SpecRenderer } from "./SpecRenderer";

const SUBJECT = CLIENT.name;

/**
 * The suggestions, per client, because the questions are not interchangeable.
 *
 * "Compare his two biggest holdings" is a real question about a listed book and a
 * meaningless one about four houses. Swapping the prompts with the client is not
 * decoration: it is the demo's whole point made visible before anything is sent — what
 * you can usefully ask depends on what the client has.
 */
const PROMPTS: Record<PinnedClientId, { id: string; label: string; prompt: string }[]> = {
  prashanth: [
    { id: "review", label: "Portfolio review", prompt: `How is ${SUBJECT.split(" ")[0]}'s portfolio doing?` },
    { id: "compare", label: "Compare holdings", prompt: "Compare his two biggest holdings" },
    { id: "liquidity", label: "Liquidity", prompt: "How would he fund the property purchase?" },
    { id: "lookup", label: "Lookup", prompt: "Who is his relationship manager?" },
  ],
  eleanor: [
    { id: "review", label: "Balance sheet", prompt: "How is Eleanor's balance sheet looking?" },
    { id: "property", label: "Property book", prompt: "What is in her property book?" },
    { id: "exposure", label: "Exposure", prompt: "Where is the biggest exposure in her portfolio?" },
    { id: "lookup", label: "Lookup", prompt: "Who is her relationship manager?" },
  ],
};

/**
 * How long one top-level area takes to land.
 *
 * Matched to the renderer's build animation (720ms frame + 620ms delay before the
 * content unblurs, ~1.6s in total), so the next area starts arriving while the last
 * one is settling rather than after it has finished.
 */
const REVEAL_MS = 1150;

/**
 * The one or two sentences that introduce a generated view in the chat.
 *
 * The report's own summary if it wrote one — it is the semantic layer's statement of
 * what the answer says — and the answer's opening sentences otherwise. Never a
 * paraphrase: both are text somebody upstream already committed to.
 */
function lead(summary: string | undefined, answer: string): string {
  const written = summary?.trim();
  if (written && written.length > 24) return written;
  const sentences = answer.trim().split(/(?<=[.?!])\s+/);
  return sentences.slice(0, 2).join(" ") || answer;
}

type ChatTurn = {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** The card that reopens the view. Absent on text-only answers. */
  widget?: { title: string; recipe: string; degraded: boolean };
  thinking?: boolean;
  /**
   * Why this turn is not what you would expect — the stand-in answered, or the
   * follow-up rebuilt rather than edited. In the chat, where it is read: a
   * degradation nobody can see is a degradation nobody can debug.
   */
  note?: string;
};

export default function GenerativeUILab() {
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [composerText, setComposerText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [result, setResult] = React.useState<RunResult | null>(null);
  const [open, setOpen] = React.useState(false);
  /** How many top-level areas of the current view have landed. See `placing` below. */
  const [placed, setPlaced] = React.useState(0);
  /**
   * Whose book the simulator has open.
   *
   * Prototype scaffolding, and labelled as such on screen. In a deployment the client
   * comes from the session and the question; this dropdown exists so a demo can put the
   * same question to two different balance sheets and show that the page that comes back
   * is a different shape — which is the architecture's central claim and otherwise has
   * to be taken on trust.
   */
  const [client, setClient] = React.useState<PinnedClientId>("prashanth");
  const prompts = PROMPTS[client];

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const nextId = React.useRef(1);
  const isEmpty = turns.length === 0;

  React.useEffect(() => {
    const node = viewportRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, busy]);

  const send = React.useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query || busy) return;

      /* The transcript the pipeline passes to the model: text only, never widgets. */
      const history: HistoryTurn[] = turns
        .filter((turn) => !turn.thinking)
        .map((turn) => ({ role: turn.role, text: turn.text }));

      const userId = nextId.current++;
      const replyId = nextId.current++;
      setTurns((was) => [
        ...was,
        { id: userId, role: "user", text: query },
        { id: replyId, role: "assistant", text: "", thinking: true },
      ]);
      setComposerText("");
      setBusy(true);
      setStages([]);
      setResult(null);
      setPlaced(0);
      /*
       * The panel does not open on send.
       *
       * Until layer 1 has decided, nobody knows whether this question has a page
       * behind it — "who is his RM" does not. Opening a sheet over the client
       * overview at send time promises a view before the decision that produces one
       * exists, and then takes it away. So the wait lives in the chat, and the panel
       * opens on the first stage that reports `surface === "view"`.
       */
      setOpen(false);

      const outcome = await run(
        query,
        [...history, { role: "user", text: query }],
        (next, surface) => {
          setStages(next);
          if (surface === "view") setOpen(true);
        },
        client,
      );

      setResult(outcome);
      setBusy(false);
      if (outcome.kind === "text") setOpen(false);

      /*
       * Two things a reader is entitled to know from the chat itself, because both
       * of them explain an answer that looks wrong:
       *
       *   - the stand-in wrote this, so the words are a fixture and two questions of
       *     the same shape produce the same prose;
       *   - a follow-up re-ran the whole pipeline instead of editing the last view,
       *     because conversational editing (§11) is designed and not yet wired.
       */
      const why: string[] = [];
      if (outcome.via === "local") {
        why.push(`Written by the local stand-in — ${outcome.notes[0] ?? "the model was not reachable"}`);
      }
      if (outcome.via === "pinned") {
        why.push("Pinned report — the data and the analysis are a fixture; the layout is composed live.");
      }
      if (history.length > 0 && outcome.kind !== "text") {
        why.push("Follow-ups build a new page rather than editing the last one.");
      }

      setTurns((was) =>
        was.map((turn) =>
          turn.id === replyId
            ? {
                ...turn,
                thinking: false,
                /*
                 * A view's chat turn is a lead, not the whole answer.
                 *
                 * Printing four paragraphs on the left and then the same four
                 * paragraphs' worth of structure on the right says everything twice
                 * and leaves the reader deciding which one to read. The chat hands
                 * over to the page; the full prose is one tab away on it.
                 *
                 * §14 is untouched by this: the answer is still written before any
                 * structure exists, still carried verbatim on the spec, and still
                 * reachable in one click. What changed is which copy leads.
                 */
                text: outcome.kind === "view" ? lead(outcome.report.summary, outcome.answer) : outcome.answer,
                note: why.length > 0 ? why.join(" ") : undefined,
                widget:
                  outcome.kind === "text"
                    ? undefined
                    : {
                        title: outcome.kind === "view" ? outcome.report.title : (outcome.report?.title ?? "Report"),
                        recipe: outcome.kind === "view" ? outcome.recipeId : "the answer",
                        degraded: outcome.kind === "fallback",
                      },
              }
            : turn,
        ),
      );
    },
    [busy, turns, client],
  );

  const reset = React.useCallback(() => {
    setTurns([]);
    setStages([]);
    setResult(null);
    setBusy(false);
    setOpen(false);
    setComposerText("");
    setPlaced(0);
  }, []);

  const choose = React.useCallback(
    (next: PinnedClientId) => {
      if (next === client) return;
      setClient(next);
      reset();
    },
    [client, reset],
  );

  const via = result?.via;
  const spec = result?.kind === "view" ? result.spec : undefined;
  const report = result && result.kind !== "text" ? result.report : undefined;

  /*
   * The assembly.
   *
   * A validated spec does not arrive area by area — it arrives whole, because layer 8
   * has to see all of it before any of it can be shown. So this is a reveal, not a
   * stream, and it is honest about which: the areas land in the order the recipe put
   * them in, one every REVEAL_MS, and the renderer plays each one's build animation as
   * it appears.
   *
   * Worth spending the second and a half on. The composed page is the claim this whole
   * architecture makes, and watching it come together one area at a time is what shows
   * a reader that a page has a *shape* someone decided — rather than a block of output
   * that appeared all at once and might as well have been HTML from a model.
   */
  const total = spec?.root.length ?? 0;
  React.useEffect(() => {
    if (!spec) {
      setPlaced(0);
      return;
    }
    setPlaced(1);
    let landed = 1;
    const timer = window.setInterval(() => {
      landed += 1;
      setPlaced(landed);
      if (landed >= spec.root.length) window.clearInterval(timer);
    }, REVEAL_MS);
    return () => window.clearInterval(timer);
  }, [spec]);

  const placing = spec !== undefined && placed < total;

  return (
    <div className={TW.shell}>
      <Sidebar />
      {/*
       * The simulator control — floating, dark, over everything, and deliberately not
       * part of the product.
       *
       * It exists to put the same question to two different balance sheets in front of an
       * audience, which is a thing about the demo and not a thing about the app. Sitting
       * it in the chat header made it read as a feature somebody had shipped; sitting it
       * on top of the interface as a dev overlay says what it is. Switching clears the
       * thread rather than continuing it: the history is about somebody else's balance
       * sheet, and a follow-up answered against the wrong book is the one failure here
       * that would look entirely plausible.
       */}
      <div className={TW.simulator}>
        <span className={TW.simulatorLabel}>Simulating</span>
        <div className="flex items-center gap-[2px]" role="group" aria-label="Simulated client">
          {PINNED_CLIENTS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={entry.distinction}
              aria-pressed={client === entry.id}
              className={client === entry.id ? TW.simulatorOn : TW.simulatorOff}
              onClick={() => choose(entry.id)}
            >
              {entry.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
      <main className={TW.workspace}>
        {/* ------------------------------------------------------------ chat */}
        <aside className={TW.advisorPanel} aria-label="Advisor chat (simulated)">
          <div className={TW.advisorHeader}>
            <div className={TW.conversationBtn}>
              <span className={TW.conversationText}>
                {isEmpty ? "New conversation" : (report?.title ?? "Conversation")}
              </span>
              <ChevronDownIcon />
            </div>
            <div className="flex shrink-0 items-center gap-[8px]">
              <Link
                href="/lab"
                className="font-satoshi text-[11px] font-bold uppercase tracking-[0.08em] text-black/35 transition-colors hover:text-black"
              >
                Lab
              </Link>
              <button type="button" className={TW.advisorAddBtn} aria-label="New conversation" onClick={reset}>
                <PlusIcon />
              </button>
            </div>
          </div>

          {isEmpty ? (
            <div className={TW.attentionContent}>
              <h1 className={`${TW.attentionTitle} stagger-in`} style={{ "--stagger-index": 1 } as CSSProperties}>
                What can I help<br />you with?
              </h1>
              <div className={TW.attentionList}>
                {prompts.map((item, index) => (
                  <div
                    key={item.id}
                    className="stagger-in max-w-full"
                    style={{ "--stagger-index": index + 2 } as CSSProperties}
                  >
                    <SuggestionChip label={item.prompt} className="max-w-full" onClick={() => send(item.prompt)} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className={`${TW.threadArea} ${isEmpty ? "" : TW.threadAreaFull}`}>
            <div className={TW.thread}>
              {!isEmpty ? (
                <div className={TW.messageViewport} ref={viewportRef}>
                  {turns.map((turn) =>
                    turn.role === "user" ? (
                      <div key={turn.id} className={TW.messageUser}>
                        <div className={TW.userMessageContent}>{turn.text}</div>
                      </div>
                    ) : (
                      <div key={turn.id} className={TW.messageAssistant}>
                        <div className={TW.messageStack}>
                          <div className={TW.assistantMessageContent}>
                            {turn.thinking ? (
                              <ChatStages stages={stages} />
                            ) : (
                              turn.text.split(/\n{2,}/).map((paragraph, index) => (
                                <p key={index} className={index === 0 ? "m-0" : "mt-[10px] mb-0"}>
                                  {paragraph}
                                </p>
                              ))
                            )}
                            {turn.note ? (
                              <p className="mt-[10px] mb-0 font-satoshi text-[11px] leading-[16px] text-black/35">
                                {turn.note}
                              </p>
                            ) : null}
                            {turn.widget ? (
                              <ViewWidget
                                title={turn.widget.title}
                                recipe={turn.widget.recipe}
                                degraded={turn.widget.degraded}
                                onOpen={() => setOpen(true)}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : null}

              <div className={isEmpty ? TW.composerDockEmpty : TW.composerDock}>
                <div className={TW.composerWrap}>
                  <div className={TW.promptChipsRow}>
                    <div className={TW.promptChipsLeft}>
                      {prompts.map((item) => (
                        <div
                          key={item.id}
                          className={TW.promptChip}
                          role="button"
                          tabIndex={0}
                          onClick={() => setComposerText(item.prompt)}
                        >
                          /{item.label}
                        </div>
                      ))}
                    </div>
                    <button type="button" className={TW.promptChipExpand} aria-label="Expand prompts">
                      <ChevronDownIcon />
                    </button>
                  </div>

                  <form
                    className={`${TW.composer} ${busy ? TW.composerThinking : ""}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      send(composerText);
                    }}
                  >
                    <div className={TW.composerInputRow}>
                      <textarea
                        className={TW.composerInput}
                        rows={1}
                        placeholder={isEmpty ? "What can I help you with?" : "Ask a follow-up..."}
                        value={composerText}
                        onChange={(event) => setComposerText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            send(composerText);
                          }
                        }}
                      />
                    </div>
                    <div className="flex shrink-0 items-center px-[16px]">
                      <button
                        type="submit"
                        className={TW.sendBtn}
                        disabled={!composerText.trim() || busy}
                        aria-label="Send message"
                      >
                        <ArrowUpIcon />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ------------------------------- right-hand surface: the same client
            overview every lab shows, with the generated view opening over it. */}
        {/* The panel switches with the simulator. It used to be hardcoded, which put
            Eleanor's report over Prashanth's name and AUM — see `ClientOverview`. */}
        <MockClientOverview client={pinnedClient(client).overview}>
          <div className="absolute right-[20px] bottom-[18px] z-[90] flex items-center gap-[14px] rounded-full border border-black/[0.07] bg-white/85 px-[14px] py-[8px] shadow-[0_6px_22px_rgba(0,0,0,0.06)] backdrop-blur-[8px]">
            {via ? (
              <span
                className="font-satoshi text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: via === "model" ? "#7F4E0B" : via === "pinned" ? "#2F5D50" : "#8a8a8a" }}
                title={
                  via === "model"
                    ? "The plan, answer and report came from the model"
                    : via === "pinned"
                      ? "A pinned report: the data and the analysis are a hand-authored fixture. The layout is still composed and validated live from them."
                      : "No model key set — the plan, answer and report came from the local stand-in analyst. Composition and validation are the same either way."
                }
              >
                {via === "model" ? "live model" : via === "pinned" ? "pinned" : "local"}
              </span>
            ) : null}
            {result?.kind === "view" ? (
              <span className="font-satoshi text-[11px] tracking-[-0.11px] text-black/40">{result.recipeId}</span>
            ) : null}
          </div>

          {open && (result || stages.length > 0) ? (
            <div className="absolute inset-0 z-[80]">
              <div aria-hidden className="gu-backdrop absolute inset-0 bg-[#f4f2ed]/[0.94] backdrop-blur-[2px]" />
              <div className="absolute inset-0 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close view"
                  className="absolute top-[16px] right-[20px] z-[2] grid h-[36px] w-[36px] place-items-center rounded-full border border-black/10 bg-white text-black/70 shadow-[0_6px_22px_rgba(0,0,0,0.10)] transition hover:text-black"
                >
                  ✕
                </button>
                {/* 940px, and generous inner padding. The measure is the document's
                    most consequential setting: at 860px with 26px of padding the
                    four-up figure strip could not breathe and every table wrapped. */}
                <div className="relative z-[1] mx-auto w-full max-w-[1200px] px-[28px] py-[48px] max-[900px]:px-[16px]">
                  <div className="gu-card relative overflow-hidden rounded-[20px] bg-[#fffefa] px-[44px] py-[38px] shadow-[0_24px_80px_rgba(58,35,9,0.14)] max-[900px]:px-[20px]">
                    <div aria-hidden className="absolute top-0 right-0 left-0 h-[3px] bg-[#8b6534]/[0.10]">
                      <div
                        className="h-full bg-[linear-gradient(90deg,#c9a877,#8b6534)] transition-[width] duration-500 ease-out"
                        style={{
                          // The bar keeps running while the areas land, so it finishes
                          // when the page does rather than when the data does.
                          width: placing
                            ? `${(placed / total) * 100}%`
                            : result
                              ? "100%"
                              : `${Math.min(stages.length / 6, 0.92) * 100}%`,
                        }}
                      />
                    </div>

                    {result ? (
                      <>
                        {/* No toolbar and no inspector. This pane is the document and
                            nothing else: no debug control for the reader to step around,
                            and no rule for the title to start underneath. §14 is unaffected
                            — the written answer is the chat's first reply, and it *is* this
                            pane whenever composition fails. The composer's trace and the
                            validator's issues are still in the run artifacts for whoever
                            is debugging; they are no longer furniture on the page. */}
                        {placing ? (
                          <div className="mb-[18px] font-satoshi text-[11px] tracking-[-0.11px] text-black/35">
                            Assembling · {placed}/{total}
                          </div>
                        ) : null}

                        {spec ? (
                          <SpecRenderer spec={spec} report={report} bundle={result.bundle} revealed={placed} />
                        ) : (
                          <NarrativeFallback title={report?.title} narrative={result.answer} />
                        )}

                        {result.kind === "fallback" ? (
                          <p className="mt-[16px] font-satoshi text-[11px] text-black/40">
                            The composed view did not pass validation, so this is the answer. {result.reason}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <StagePanel stages={stages} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </MockClientOverview>
      </main>

      <style>{`
        @keyframes gu-backdrop-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gu-card-in {
          from { opacity: 0; transform: translateY(18px) scale(0.97); filter: blur(6px) }
          to { opacity: 1; transform: none; filter: blur(0) }
        }
        @keyframes gu-line-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes gu-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.85) }
          50% { opacity: 1; transform: scale(1) }
        }
        .gu-backdrop { animation: gu-backdrop-in 300ms ease-out both }
        .gu-card { animation: gu-card-in 460ms cubic-bezier(0.22, 1, 0.36, 1) both }
        .gu-line { animation: gu-line-in 260ms ease-out both }
        .gu-pulse { animation: gu-pulse 900ms ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .gu-backdrop, .gu-card, .gu-line { animation-duration: 1ms }
          .gu-pulse { animation: none }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------- stages */

/**
 * The pipeline, reporting itself — four phases over six real stages.
 *
 * Each line is work that is running or has run, and its detail is what that layer actually
 * decided, never a phrase chosen to fill the wait (§13). What changed is the framing: the
 * six stages are the architecture's units, and a reader watching six flat bullets learns
 * the list without learning the shape. Grouped into the four things that are actually
 * happening — understanding the question, answering it, deciding what goes where, putting
 * the page together — the wait explains the system instead of enumerating it.
 *
 * The grouping is a presentation of the same run, not a different one: every stage still
 * reports, and a phase is done only when all of its stages are.
 */
const PHASES: { id: string; title: string; of: string[] }[] = [
  { id: "understand", title: "Understanding your question", of: ["plan"] },
  { id: "answer", title: "Answering it from your data", of: ["data", "answer"] },
  { id: "structure", title: "Deciding what goes where", of: ["structure", "compose"] },
  { id: "assemble", title: "Putting the page together", of: ["check"] },
];

/**
 * A long detail said shortly.
 *
 * The data stage's detail is the list of keys it fetched, which is the honest thing for it
 * to report and thirteen names wide on this page — it wrapped to two lines and pushed the
 * phases apart. Counting the same list is not a different claim, so a detail past the
 * measure becomes its own count. Nothing else is summarised: a recipe name, a task type and
 * a word count are already short, and shortening prose would be editing it.
 */
function said(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const parts = detail.split(", ");
  return parts.length > 3 && detail.length > 52 ? `${parts.length} data points` : detail;
}

function StagePanel({ stages }: { stages: Stage[] }) {
  const stageOf = (id: string) => stages.find((stage) => stage.id === id);
  const state = PHASES.map((phase) => {
    const own = phase.of.map(stageOf);
    const reached = own.filter((stage) => stage !== undefined) as Stage[];
    const done = reached.filter((stage) => stage.detail !== undefined);
    return {
      phase,
      /* The running stage is the last one reached that has not reported a detail; when all
         have, the phase is complete and the last one is what it says it did. */
      current: reached[reached.length - 1],
      started: reached.length > 0,
      complete: done.length === phase.of.length,
      fraction: done.length / phase.of.length,
    };
  });
  const running = state.findIndex((entry) => entry.started && !entry.complete);
  const spoken = state[running] ?? [...state].reverse().find((entry) => entry.started);
  const line = spoken
    ? spoken.complete
      ? said(spoken.current?.detail)
      : (spoken.current?.label ?? undefined)
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[620px] flex-col items-center py-[72px] max-[900px]:py-[40px]">
      <span className={LABEL}>Building your view</span>

      {/* Four columns of equal width, so the rails between the discs are equal lengths and
          the row reads as a track rather than as four items that happen to be in a line. */}
      <div className="mt-[30px] grid w-full grid-cols-4">
        {state.map((entry, index) => {
          const last = index === state.length - 1;
          const active = index === running;
          return (
            <div key={entry.phase.id} className="relative flex min-w-0 flex-col items-center">
              {/* The rail runs from this disc's centre to the next one's and fills by the
                  fraction of *this* phase's stages that have reported — which is why
                  answering and structuring, two stages each, move mid-phase instead of
                  sitting still and then jumping. Behind the discs, which carry the card's
                  own background so the track passes under them rather than through them. */}
              {last ? null : (
                <span className="absolute top-[10px] left-1/2 h-[2px] w-full overflow-hidden bg-black/[0.07]">
                  <span
                    className="absolute inset-y-0 left-0 bg-[#7F4E0B]/70 transition-[width] duration-700 ease-out"
                    style={{ width: `${entry.fraction * 100}%` }}
                  />
                </span>
              )}
              <span
                className={`relative z-[1] grid h-[22px] w-[22px] place-items-center rounded-full border transition-colors duration-300 ${
                  entry.complete
                    ? "border-[#7F4E0B] bg-[#7F4E0B]"
                    : active
                      ? "border-[#7F4E0B] bg-[#fffefa]"
                      : "border-black/15 bg-[#fffefa]"
                }`}
              >
                {entry.complete ? (
                  <Check size={12} strokeWidth={2.5} color="#fffefa" />
                ) : active ? (
                  <span className="gu-pulse block h-[7px] w-[7px] rounded-full bg-[#7F4E0B]" />
                ) : (
                  <span className="block h-[5px] w-[5px] rounded-full bg-black/15" />
                )}
              </span>
              <div
                className="gu-line mt-[12px] px-[8px] text-center font-satoshi text-[12px] leading-[1.35] tracking-[-0.12px] transition-colors duration-300"
                style={{ color: entry.started ? INK : "rgba(0,0,0,0.32)", animationDelay: `${index * 70}ms` }}
              >
                {entry.phase.title}
              </div>
            </div>
          );
        })}
      </div>

      {/*
       * One caption for the whole track, not one per column.
       *
       * Four captions under four columns is four ragged blocks of different heights, and
       * three of them are about work that has already finished. What the reader wants while
       * waiting is what is happening *now*, so the running phase says it, in the centre,
       * where the next line replaces the last in the same place. A completed run's last
       * phase keeps its detail there, so the panel does not end on a blank line.
       */}
      <div className="mt-[26px] flex h-[18px] items-center">
        {line ? (
          <span key={line} className="gu-line font-satoshi text-[13px] tracking-[-0.13px] text-black/45">
            {line}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The same list, compressed to one line, for while the chat waits. */
function ChatStages({ stages }: { stages: Stage[] }) {
  const current = stages[stages.length - 1];
  return (
    <p className="m-0 flex items-center gap-[6px] font-satoshi text-[13px] text-black/45">
      <span className="gu-pulse inline-block h-[6px] w-[6px] rounded-full bg-[#7F4E0B]" />
      {current?.label ?? "Thinking"}...
    </p>
  );
}

/* ------------------------------------------------------------------- widget */

function ViewWidget({
  title,
  recipe,
  degraded,
  onOpen,
}: {
  title: string;
  recipe: string;
  degraded: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-[10px] block w-full cursor-pointer rounded-[16px] border-0 p-[1.5px] text-left transition hover:-translate-y-px"
      style={{
        backgroundImage: degraded
          ? "linear-gradient(120deg, rgba(0,0,0,0.10), rgba(0,0,0,0.05))"
          : "linear-gradient(120deg, rgba(255,190,106,0.95), rgba(246,224,177,0.55) 45%, rgba(210,122,196,0.8))",
      }}
    >
      <span className="block rounded-[14.5px] bg-white px-[14px] py-[16px]">
        <span className="flex items-center justify-between gap-[14px]">
          <span className="min-w-0">
            <span className="mb-[3px] block font-satoshi text-[10px] font-medium uppercase tracking-[0.14em] text-black/50">
              {degraded ? "Answer" : recipe}
            </span>
            <span className="block truncate font-satoshi text-[15px] font-semibold leading-[1.25] tracking-[-0.15px] text-[#7b674f]">
              {title}
            </span>
          </span>
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(135deg,#ffe7a4_0%,#f7b73f_46%,#e9bdd8_100%)] font-satoshi text-[13px] text-[#a46100]">
            ›
          </span>
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ styles */

/**
 * Copied from ../dynamic-ui/page.tsx, which copied it from app/client/page.tsx. A
 * copy on purpose: editing the lab must never be able to move the real panel.
 */
const TW = {
  /**
   * `gu-theme` is what turns the shadcn primitives on. The token values live only
   * under this class (see ./ui/theme.css), so a shadcn component used outside the
   * prototype renders unstyled rather than inheriting a palette it shouldn't.
   */
  shell: "gu-theme h-screen overflow-hidden bg-white text-[#171615]",
  workspace:
    "relative ml-[80px] grid h-screen grid-cols-[434px_minmax(0,1fr)] overflow-hidden bg-white max-[1180px]:grid-cols-[minmax(360px,420px)_minmax(0,1fr)] max-[900px]:grid-cols-1",
  advisorPanel:
    "relative grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)] border-r border-black/10 bg-white",
  advisorHeader:
    "relative z-[40] flex h-[54px] min-w-0 items-center justify-between gap-[12px] border-b border-black/10 bg-white/70 px-[16px] backdrop-blur-[12px]",
  conversationBtn:
    "inline-flex min-w-0 max-w-full items-center justify-start gap-[5px] overflow-hidden rounded-[10px] py-[8px] font-satoshi text-[14px] font-bold leading-[130%] tracking-[-0.28px] text-black [&_svg]:h-[16px] [&_svg]:w-[16px] [&_svg]:shrink-0",
  conversationText: "block min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap",
  advisorAddBtn:
    "inline-grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[12px] border border-black/[0.08] bg-transparent text-black transition hover:bg-black/[0.03] [&_svg]:h-[16px] [&_svg]:w-[16px]",
  /* Bottom-right, unmistakably not furniture — and out of the composer's way. It sat
     bottom-left first, which is directly over the message box. */
  simulator:
    "fixed right-[16px] bottom-[16px] z-[120] inline-flex items-center gap-[10px] rounded-full border border-white/10 bg-[#171615]/92 py-[5px] pr-[6px] pl-[12px] shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-[10px]",
  simulatorLabel: "font-satoshi text-[9px] font-bold uppercase tracking-[0.12em] text-white/40",
  simulatorOn:
    "rounded-full bg-white px-[10px] py-[4px] font-satoshi text-[11px] font-bold tracking-[-0.1px] text-[#171615]",
  simulatorOff:
    "rounded-full px-[10px] py-[4px] font-satoshi text-[11px] font-bold tracking-[-0.1px] text-white/45 transition-colors hover:text-white/80",
  attentionContent: "flex min-h-0 flex-col justify-center overflow-auto px-[20px] pt-[64px] pb-[190px]",
  attentionTitle:
    "m-0 mb-[20px] max-w-[394px] font-butler-medium text-[40px] font-medium leading-[48px] tracking-[-2px] text-black",
  attentionList: "grid max-w-[394px] justify-items-start gap-[8px]",

  threadArea: "absolute right-[17px] bottom-[16px] left-[16px] z-[5]",
  threadAreaFull: "top-[54px] !right-0 !left-0",
  thread: "relative flex h-full min-h-0 flex-col overflow-hidden",

  messageViewport: "relative min-h-0 flex-1 overflow-y-auto pt-[24px] pr-[44px] pb-[176px] pl-[22px]",
  messageUser: "mb-[18px] flex w-full justify-end gap-2.5",
  messageAssistant: "mb-[18px] flex w-full justify-start gap-2.5",
  messageStack: "w-full max-w-full",
  userMessageContent:
    "max-w-full [overflow-wrap:anywhere] rounded-[20px_20px_0_20px] bg-[#F3F3F3] p-[16px] font-satoshi text-[14px] font-medium leading-[1.5] tracking-[-0.16px] text-[#0D0D0D]",
  assistantMessageContent:
    "max-w-full [overflow-wrap:anywhere] py-1 font-satoshi text-[13px] leading-relaxed text-black",

  composerDock: "absolute right-0 bottom-0 left-0 z-10 px-[22px]",
  composerDockEmpty: "relative z-10",
  composerWrap: "w-full rounded-[20px] border border-white bg-[#f7f7f7] p-[1px] pt-[6px]",
  composer:
    "relative mx-auto flex min-h-[74px] w-full items-center rounded-[24px] border border-black/[0.06] bg-white/90 py-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition",
  composerThinking: "ring-1 ring-[#b37f40]/40",
  composerInputRow: "min-w-0 flex-1 px-[24px]",
  composerInput:
    "h-auto min-h-0 w-full resize-none border-0 bg-transparent p-0 font-satoshi text-[16px] font-normal leading-[1.35] tracking-[-0.16px] text-black outline-none placeholder:text-black/60",
  sendBtn:
    "inline-grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border-0 bg-black p-0 text-white transition hover:-translate-y-px hover:bg-[#2d2926] disabled:opacity-100 [&_svg]:h-[24px] [&_svg]:w-[24px]",

  promptChipsRow:
    "mb-[6px] flex items-center justify-between gap-[4px] overflow-hidden rounded-[22px] px-[10px] pt-[4px]",
  promptChipsLeft: "flex min-w-0 flex-1 items-center gap-[8px] overflow-hidden",
  promptChip:
    "inline-flex min-w-0 shrink-0 cursor-pointer items-center rounded-full border border-white/60 bg-[#0000000A] px-[11px] py-[7px] font-satoshi text-[12px] font-normal leading-[16.2px] text-[#5d6b77] transition hover:bg-black/[0.07]",
  promptChipExpand:
    "inline-flex h-[32px] w-[40px] shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/60 text-black transition hover:bg-white/85 [&_svg]:h-[13px] [&_svg]:w-[13px]",
};

/* ------------------------------------------------------------------- icons */

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.001" />
      <path
        d="M12 18V7M12 7l-5 5M12 7l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
