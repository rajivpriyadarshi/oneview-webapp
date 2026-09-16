"use client";

/**
 * /lab/dynamic-ui — the Dynamic UI prototype.
 *
 * The left column is the real advisor chat: the user types, the "model" reports
 * findings, and a deterministic layer maps those findings onto components. The
 * chat chrome below is copied class-for-class from app/lab/thought-chain (which
 * copied it from app/client/page.tsx) so the report is judged in its real
 * surroundings — a copy, not an import, so this lab cannot regress a real screen.
 *
 * This file owns *pacing and state* only. Selection and composition are pure
 * functions in ./select and ./compose; drawing is ./ReportView. Blocks land one
 * at a time on a timeout chain, and the reveal count is also a slider, so the
 * assembly can be scrubbed without re-running.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import SuggestionChip from "../../components/SuggestionChip";
import MockClientOverview from "../MockClientOverview";
import { CLIENT } from "./clientBook";
import { blockCount, composeReport, orderedBlocks, type ReportDoc } from "./compose";
import { applyOps } from "./patch";
import { ask, askBlock, type Stage, type Via } from "./live";
import { critique } from "./critique";
import { ReportView } from "./ReportView";
import { ThinkingPanel } from "./ThinkingPanel";

/**
 * Per-block landing interval.
 *
 * Deliberately slower than it needs to be: each block takes ~1.5s to build
 * itself (frame → outline → data, see ReportView), and the cadence has to leave
 * room for that or the builds overlap into a wall of movement instead of reading
 * as one component being assembled after another.
 */
const REVEAL_MS = 1150;

/**
 * Floor on how fast the thinking panel may add a line. Below about this, two lines
 * arriving together read as one flicker instead of two decisions.
 */
const STAGE_MIN_MS = 700;

const SUBJECT = CLIENT.name;

const PROMPTS = [
  { id: "report", label: "Portfolio analysis", prompt: `Give me a portfolio analysis for ${SUBJECT.split(" ")[0]}` },
  { id: "compare", label: "Compare holdings", prompt: "Add a comparison of his two biggest holdings" },
  { id: "liquidity", label: "Liquidity", prompt: "How would he fund the property purchase?" },
];

type Turn = {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** Renders the report card that reopens the overlay. */
  widget?: boolean;
  /** Renders "Thinking..." instead of text. */
  thinking?: boolean;
};

export default function DynamicUiPage() {
  const [doc, setDoc] = useState<ReportDoc | null>(null);
  const [visible, setVisible] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [composerText, setComposerText] = useState("");
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  /** Whether the last answer came from the model or the local stand-in. */
  const [via, setVia] = useState<Via | null>(null);
  /** The card the advisor has selected to comment on. */
  const [selected, setSelected] = useState<string | null>(null);
  const [revising, setRevising] = useState(false);
  /**
   * Per-block revision counter, folded into ReportView's keys. A card that was
   * rethought has to visibly rebuild — otherwise the numbers change under the
   * reader with nothing to say they were reconsidered.
   */
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  /**
   * What the pipeline is doing, while it is doing it. Fills the sheet before there
   * is anything to put in it — see ./ThinkingPanel.
   */
  const [stages, setStages] = useState<Stage[]>([]);

  const nextId = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Stage events waiting for their turn on screen, and when the last one landed. */
  const stageQueue = useRef<Stage[]>([]);
  const lastStageAt = useRef(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const isEmpty = turns.length === 0;

  // Follow the thread as it grows, the same as the real panel.
  useEffect(() => {
    const el = viewportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, visible]);

  const push = useCallback((turn: Omit<Turn, "id">) => {
    const id = (nextId.current += 1);
    setTurns((prev) => [...prev, { ...turn, id }]);
    return id;
  }, []);

  const replace = useCallback((id: number, turn: Omit<Turn, "id">) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...turn, id } : t)));
  }, []);

  /** Land blocks one at a time from `from` up to `to`. */
  const reveal = useCallback((from: number, to: number) => {
    for (let i = from; i < to; i += 1) {
      timers.current.push(
        setTimeout(() => setVisible(i + 1), (i - from + 1) * REVEAL_MS),
      );
    }
    timers.current.push(setTimeout(() => setBusy(false), (to - from + 1) * REVEAL_MS));
  }, []);

  /**
   * Stage events, held to a legibility floor.
   *
   * Two of the stages are local and finish in under a millisecond, so left alone
   * three lines would appear in the same frame and read as one flash rather than a
   * sequence. Everything is queued and released no faster than STAGE_MIN_MS apart.
   * The user's own note on this: taking time is fine.
   */
  const pushStage = useCallback((stage: Stage) => {
    stageQueue.current.push(stage);

    const drain = () => {
      const next = stageQueue.current.shift();
      if (!next) return;
      lastStageAt.current = performance.now();
      setStages((prev) => [...prev, next]);
      if (stageQueue.current.length > 0) {
        timers.current.push(setTimeout(drain, STAGE_MIN_MS));
      }
    };

    // Only the event that finds the queue empty starts a drain; the rest are
    // picked up by the drain already running.
    if (stageQueue.current.length !== 1) return;
    const since = performance.now() - lastStageAt.current;
    if (since >= STAGE_MIN_MS) drain();
    else timers.current.push(setTimeout(drain, STAGE_MIN_MS - since));
  }, []);

  const bump = useCallback((blockIds: string[]) => {
    if (blockIds.length === 0) return;
    setRevisions((prev) => {
      const next = { ...prev };
      for (const id of blockIds) next[id] = (next[id] ?? 0) + 1;
      return next;
    });
  }, []);

  /**
   * The review pass, run once the report has finished landing.
   *
   * Deliberately *after* the build rather than folded into it. The reader watches
   * the page assemble, then watches it get corrected — which is the honest
   * sequence, because the corrections are judgements about the assembled page and
   * couldn't have been made before it existed. Anything it changes replays its
   * build, and the chat says what changed and why.
   */
  const review = useCallback(
    (current: ReportDoc) => {
      const { ops, notes } = critique(current);
      if (ops.length === 0) return;

      const result = applyOps(current, ops);
      const before = new Map(orderedBlocks(current).map((block) => [block.id, block]));
      const touched = orderedBlocks(result.doc)
        .filter((block) => {
          const was = before.get(block.id);
          return !was || was.rendererId !== block.rendererId || was.span !== block.span;
        })
        .map((block) => block.id);

      setDoc(result.doc);
      setAdded([]);
      setVisible(blockCount(result.doc));
      bump([...touched, ...result.addedBlockIds]);
      push({
        role: "assistant",
        text: `Read the assembled report back and changed ${
          notes.length === 1 ? "one thing" : `${notes.length} things`
        }: ${notes.join(" ")}`,
      });
    },
    [bump, push],
  );

  /**
   * One path for every ask.
   *
   * There is no menu of supported questions: the model reads the client book and
   * decides whether what it found is a new report, a change to the one on screen,
   * or just an answer. Selection still happens here in code — whichever of those
   * it chose, it only ever handed back findings.
   */
  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;

      clearTimers();
      setComposerText("");
      push({ role: "user", text });
      setBusy(true);

      const thinkingId = push({ role: "assistant", text: "", thinking: true });

      /* The sheet opens now, not when the report is ready. Deciding and shaping are
         two model calls, and the honest thing to put in front of the wait is what
         the system is doing — so the pane is never blank and never a spinner. If
         the decider comes back with "a sentence is enough", it closes again having
         shown its working, which is a better outcome than never opening. */
      stageQueue.current = [];
      lastStageAt.current = 0;
      setStages([]);
      if (!doc) {
        setDoc(null);
        setVisible(0);
        setOpen(true);
      }

      const history = turns.map((turn) => ({ role: turn.role, text: turn.text }));
      const answer = await ask(text, doc, [...history, { role: "user", text }], pushStage);
      setVia(answer.via);

      if (answer.kind === "reply") {
        replace(thinkingId, { role: "assistant", text: answer.reply });
        // Nothing to lay out, so the sheet gets out of the way — but only after the
        // last stage line has had its moment, or the panel would vanish mid-sentence.
        if (!doc) timers.current.push(setTimeout(() => setOpen(false), STAGE_MIN_MS * 2));
        setBusy(false);
        return;
      }

      if (answer.kind === "patch" && doc) {
        const result = applyOps(doc, answer.ops);

        if (result.addedBlockIds.length === 0 && result.removedBlockIds.length === 0) {
          // Emphasis and order changes are re-selected, so the whole document
          // replays rather than one block landing.
          setDoc(result.doc);
          setAdded([]);
          setVisible(0);
          setOpen(true);
          replace(thinkingId, { role: "assistant", text: answer.reply, widget: true });
          reveal(0, blockCount(result.doc));
          return;
        }

        setDoc(result.doc);
        setAdded(result.addedBlockIds);
        setOpen(true);
        replace(thinkingId, { role: "assistant", text: answer.reply, widget: true });

        // Everything already there stays put; only the new blocks land.
        const total = blockCount(result.doc);
        const landed = Math.max(0, total - result.addedBlockIds.length);
        setVisible(landed);
        reveal(landed, total);
        return;
      }

      const findings = answer.kind === "report" ? answer.findings : [];
      const next = composeReport(findings, {
        id: "report",
        title: answer.kind === "report" ? answer.title : "Report",
        subject: SUBJECT,
      });

      /* Last fallback in the chain. Findings arrived but nothing survived selection
         and composition — every block declined to render. The answer is still an
         answer, so it goes to the chat as text: the report is an enhancement on top
         of the reply, and it is never allowed to take the reply down with it. */
      if (blockCount(next) === 0) {
        replace(thinkingId, { role: "assistant", text: answer.reply });
        setOpen(false);
        setBusy(false);
        return;
      }

      setAdded([]);
      setVisible(0);
      setSelected(null);
      setRevisions({});
      setDoc(next);
      replace(thinkingId, { role: "assistant", text: answer.reply, widget: true });
      // Auto-opens: the presence of a report is the signal, so there's no
      // heuristic here (DESIGN.md §11).
      setOpen(true);
      const built = blockCount(next);
      reveal(0, built);
      // A beat after the last block lands, the reviewer reads the page back.
      timers.current.push(setTimeout(() => review(next), (built + 1) * REVEAL_MS + 500));
    },
    [busy, clearTimers, doc, push, pushStage, replace, reveal, review, turns],
  );

  /**
   * A comment aimed at one card.
   *
   * Everything the advisor types here goes through the same two layers a typed
   * question does: interpretation reads the sentence into a shape, and the mapping
   * layer decides what draws that shape. So "show six of them" can turn two
   * overlaid lines into a bar chart — the card is rethought, not reconfigured.
   */
  const reviseCard = useCallback(
    async (blockId: string, comment: string) => {
      if (!doc || revising) return;

      setRevising(true);
      push({ role: "user", text: `On that card — ${comment}` });
      const thinkingId = push({ role: "assistant", text: "", thinking: true });

      const history = turns.map((turn) => ({ role: turn.role, text: turn.text }));
      const answer = await askBlock(comment, doc, blockId, history);
      setVia(answer.via);

      const done = (text: string) => {
        replace(thinkingId, { role: "assistant", text });
        setRevising(false);
      };

      if (answer.ops.length === 0) return done(answer.reply);

      const result = applyOps(doc, answer.ops);
      // Every op bounced: the instruction was real but impossible, and saying why
      // beats a card that looks like it ignored you.
      if (result.rejected.length === answer.ops.length) {
        return done(`${answer.reply} Except — ${result.rejected.map((entry) => entry.reason).join("; ")}.`);
      }

      setDoc(result.doc);
      setAdded(result.addedBlockIds);
      setVisible(blockCount(result.doc));
      setSelected(null);
      // The replacement lands with a new id; a redraw or an emphasis change keeps
      // the old one. Either way the card that changed rebuilds itself.
      bump([...result.addedBlockIds, blockId]);
      replace(thinkingId, { role: "assistant", text: answer.reply, widget: true });
      setRevising(false);
    },
    [bump, doc, push, replace, revising, turns],
  );

  const reset = useCallback(() => {
    clearTimers();
    setDoc(null);
    setVisible(0);
    setTurns([]);
    setComposerText("");
    setOpen(false);
    setAdded([]);
    setBusy(false);
    setSelected(null);
    setRevising(false);
    setRevisions({});
    stageQueue.current = [];
    lastStageAt.current = 0;
    setStages([]);
  }, [clearTimers]);

  const total = doc ? blockCount(doc) : 0;
  const landingName = doc && busy ? orderedBlocks(doc)[visible]?.rendererId : undefined;

  return (
    <div className={TW.shell}>
      <Sidebar />
      <main className={TW.workspace}>
        {/* ------------------------------------------------------------ chat */}
        <aside className={TW.advisorPanel} aria-label="Advisor chat (simulated)">
          <div className={TW.advisorHeader}>
            <div className={TW.conversationBtn}>
              <span className={TW.conversationText}>
                {isEmpty ? "New conversation" : "Portfolio analysis"}
              </span>
              <ChevronDownIcon />
            </div>
            <div className="flex shrink-0 items-center gap-[8px]">
              <Link
                href="/lab"
                className="font-satoshi text-[11px] font-bold tracking-[0.08em] uppercase text-black/35 transition-colors hover:text-black"
              >
                Lab
              </Link>
              <button
                type="button"
                className={TW.advisorAddBtn}
                aria-label="New conversation"
                onClick={reset}
              >
                <PlusIcon />
              </button>
            </div>
          </div>

          {isEmpty ? (
            <div className={TW.attentionContent}>
              <h1
                className={`${TW.attentionTitle} stagger-in`}
                style={{ "--stagger-index": 1 } as CSSProperties}
              >
                What can I help<br />you with?
              </h1>
              <div className={TW.attentionList}>
                {PROMPTS.map((item, i) => (
                  <div
                    key={item.id}
                    className="stagger-in max-w-full"
                    style={{ "--stagger-index": i + 2 } as CSSProperties}
                  >
                    <SuggestionChip
                      label={item.prompt}
                      className="max-w-full"
                      onClick={() => send(item.prompt)}
                    />
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
                              <p className="m-0 font-satoshi text-[13px] text-black/45">
                                Thinking...
                              </p>
                            ) : (
                              <p className="m-0">{turn.text}</p>
                            )}
                            {turn.widget ? (
                              <ReportWidget
                                title={doc?.title ?? "Report"}
                                building={busy}
                                landed={visible}
                                total={total}
                                landingName={landingName}
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
                      {PROMPTS.map((item) => (
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
                    <button
                      type="button"
                      className={TW.promptChipExpand}
                      aria-label="Expand prompts"
                    >
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

        {/* --------------------------------- right-hand surface: the client
            overview every lab shows, with the report opening over it. */}
        <MockClientOverview>
          {/* Lab controls. Floated over the panel rather than built into it, so
              the shared overview stays identical across prototypes. */}
          <div className="absolute right-[20px] bottom-[18px] z-[90] flex items-center gap-[14px] rounded-full border border-black/[0.07] bg-white/85 px-[14px] py-[8px] shadow-[0_6px_22px_rgba(0,0,0,0.06)] backdrop-blur-[8px]">
            {via ? (
              <span
                className="font-satoshi text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: via === "model" ? "#7F4E0B" : "#8a8a8a" }}
                title={
                  via === "model"
                    ? "Findings came from the model"
                    : "No model key set — findings came from the local stand-in analyst"
                }
              >
                {via === "model" ? "live model" : "local"}
              </span>
            ) : null}
            {total > 0 ? (
              <label className="font-satoshi text-[11px] tracking-[-0.11px] text-black/40">
                {visible}/{total}
                <input
                  type="range"
                  min={0}
                  max={total}
                  value={visible}
                  onChange={(event) => {
                    clearTimers();
                    setBusy(false);
                    setVisible(Number(event.target.value));
                  }}
                  className="ml-[8px] w-[100px] align-middle accent-[#7F4E0B]"
                />
              </label>
            ) : null}
          </div>

          {/* The overlay — absolute within this section, so it fills the
              right-hand panel and leaves the chat live. */}
          {open && (doc || stages.length > 0) ? (
            <div className="absolute inset-0 z-[80]">
              <div
                aria-hidden
                className="du-backdrop absolute inset-0 bg-[#F5F1EA]/[0.94] backdrop-blur-[2px]"
              />
              <div className="absolute inset-0 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close report"
                  className="absolute top-[16px] right-[20px] z-[2] grid h-[36px] w-[36px] place-items-center rounded-full border border-black/10 bg-white text-black/70 shadow-[0_6px_22px_rgba(0,0,0,0.10)] transition hover:text-black"
                >
                  ✕
                </button>
                <div className="relative z-[1] mx-auto w-full max-w-[860px] px-[28px] py-[56px] max-[900px]:px-[18px]">
                  <div className="du-card relative overflow-hidden rounded-[24px] bg-white px-[26px] py-[24px] shadow-[0_24px_80px_rgba(58,35,9,0.14)]">
                    {/* Build progress across the top edge of the sheet. */}
                    <div
                      aria-hidden
                      className="absolute top-0 right-0 left-0 h-[3px] bg-[#7F4E0B]/[0.08]"
                    >
                      <div
                        className="h-full bg-[linear-gradient(90deg,#C79A4A,#7F4E0B)] transition-[width] duration-500 ease-out"
                        style={{ width: total ? `${(visible / total) * 100}%` : "0%" }}
                      />
                    </div>

                    {/* The panel stays until the first block lands, then gets out
                        of the way — its job is the wait, not the report. */}
                    {visible === 0 ? <ThinkingPanel stages={stages} /> : null}

                    {doc ? (
                      <ReportView
                        doc={doc}
                        visibleCount={visible}
                        addedBlockIds={added}
                        selectedBlockId={selected}
                        onSelectBlock={setSelected}
                        onRevise={reviseCard}
                        revising={revising}
                        revisions={revisions}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </MockClientOverview>
      </main>

      <style>{`
        @keyframes du-backdrop-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes du-card-in {
          from { opacity: 0; transform: translateY(18px) scale(0.97); filter: blur(6px) }
          to { opacity: 1; transform: none; filter: blur(0) }
        }
        @keyframes du-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.85) }
          50% { opacity: 1; transform: scale(1) }
        }
        .du-backdrop { animation: du-backdrop-in 300ms ease-out both }
        .du-card { animation: du-card-in 460ms cubic-bezier(0.22, 1, 0.36, 1) both }
        .du-pulse { animation: du-pulse 900ms ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .du-backdrop, .du-card { animation-duration: 1ms }
          .du-pulse { animation: none }
        }
      `}</style>
    </div>
  );
}

/**
 * The chat-side widget. Copies the gradient card that opens artifacts today, and
 * doubles as the build readout while blocks are still landing — the chat says
 * what the report is doing without the report having to be on screen.
 */
function ReportWidget({
  title,
  building,
  landed,
  total,
  landingName,
  onOpen,
}: {
  title: string;
  building: boolean;
  landed: number;
  total: number;
  landingName?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-[10px] block w-full cursor-pointer rounded-[16px] border-0 p-[1.5px] text-left transition hover:-translate-y-px"
      style={{
        backgroundImage:
          "linear-gradient(120deg, rgba(255,190,106,0.95), rgba(246,224,177,0.55) 45%, rgba(210,122,196,0.8))",
      }}
    >
      <span className="block rounded-[14.5px] bg-white px-[14px] py-[16px]">
        <span className="flex items-center justify-between gap-[14px]">
          <span className="min-w-0">
            <span className="mb-[3px] block font-satoshi text-[10px] font-medium uppercase tracking-[0.14em] text-black/50">
              Portfolio analysis
            </span>
            <span className="block truncate font-satoshi text-[15px] font-semibold leading-[1.25] tracking-[-0.15px] text-[#7b674f]">
              {title}
            </span>
          </span>
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(135deg,#ffe7a4_0%,#f7b73f_46%,#e9bdd8_100%)] font-satoshi text-[13px] text-[#a46100]">
            ›
          </span>
        </span>

        {building && total > 0 ? (
          <span className="mt-[10px] block">
            <span className="flex items-center gap-[6px] font-satoshi text-[11px] tracking-[-0.11px] text-[#a46100]">
              <span className="du-pulse inline-block h-[6px] w-[6px] rounded-full bg-[#7F4E0B]" />
              Placing {landingName ?? "components"} · {landed}/{total}
            </span>
            <span className="mt-[6px] block h-[2px] w-full overflow-hidden rounded-full bg-[#7F4E0B]/10">
              <span
                className="block h-full bg-[#7F4E0B]/60 transition-[width] duration-500 ease-out"
                style={{ width: `${(landed / total) * 100}%` }}
              />
            </span>
          </span>
        ) : null}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ styles */

/**
 * Copied from app/lab/thought-chain/page.tsx, which copied it from
 * app/client/page.tsx. A copy on purpose: editing the lab must never be able to
 * move the real panel.
 */
const TW = {
  shell: "h-screen overflow-hidden bg-white text-[#171615]",
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
      <path d="M12 18V7M12 7l-5 5M12 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
