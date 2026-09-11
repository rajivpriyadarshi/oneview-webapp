"use client";

/**
 * /lab/thought-chain — a simulated chat sidebar for iterating on the AI
 * thought-chain UI.
 *
 * No auth, no API, no streaming backend: every run is scripted data from
 * ./scenarios. That is the whole point — the chain's look and rhythm can be
 * reworked in isolation and reloaded in a second.
 *
 * Three moving parts:
 *   - ./scenarios      what the AI "does" and eventually answers
 *   - ./ThoughtChain   how a run looks (pure presentation, no timers)
 *   - this file        the driver: turns a scenario into frames and walks them
 *
 * The sidebar chrome below intentionally mirrors app/client/page.tsx's advisor
 * panel class-for-class so the chain is judged in its real surroundings. It is
 * a copy, not an import, so this lab can never regress the real screen.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Sidebar from "../../components/Sidebar";
import SuggestionChip from "../../components/SuggestionChip";
import MarkdownContent from "../../components/MarkdownContent";
import { ThoughtChain, type ThoughtProgress } from "./ThoughtChain";
import { SCENARIOS, DEFAULT_SCENARIO_ID, type Scenario } from "./scenarios";

/* ------------------------------------------------------------------ timing */

/** Delays in ms at 1x. The control bar divides these by the speed multiplier. */
const TIMING = {
  /** "Thinking..." before the first step appears. */
  thinking: 1000,
  /** After a step header lands, before its first bullet. */
  stepHeader: 650,
  /** Between bullets inside a step. */
  bullet: 850,
  /** After a step's last bullet, before the next step header. */
  stepGap: 550,
  /** After the chain completes, before the answer starts. */
  answer: 700,
  /** Per word of the answer stream. */
  answerWord: 28,
};

/* ------------------------------------------------------------------ frames */

type Frame = {
  /** Readout in the control bar. */
  label: string;
  progress: ThoughtProgress;
  showAnswer: boolean;
  /** Delay before this frame applies, at 1x. */
  delayMs: number;
};

/**
 * Flattens a scenario into an explicit list of snapshots.
 *
 * Frames rather than nested timers: it makes the run scrubbable and
 * step-throughable for free, which is what you actually want when tuning
 * rhythm. Each frame is a complete state, so jumping is just an assignment.
 */
function buildFrames(scenario: Scenario, staggerBullets: boolean): Frame[] {
  const frames: Frame[] = [
    { label: "Thinking", progress: { stepIndex: -1, bulletIndex: 0, done: false }, showAnswer: false, delayMs: 0 },
  ];

  scenario.steps.forEach((step, i) => {
    frames.push({
      label: `${step.label} — header`,
      progress: { stepIndex: i, bulletIndex: 0, done: false },
      showAnswer: false,
      delayMs: i === 0 ? TIMING.thinking : TIMING.stepGap,
    });

    if (staggerBullets) {
      step.bullets.forEach((_, bi) => {
        frames.push({
          label: `${step.label} — bullet ${bi + 1}`,
          progress: { stepIndex: i, bulletIndex: bi + 1, done: false },
          showAnswer: false,
          delayMs: bi === 0 ? TIMING.stepHeader : TIMING.bullet,
        });
      });
    }
  });

  frames.push({
    label: "Chain complete",
    progress: { stepIndex: scenario.steps.length, bulletIndex: 0, done: true },
    showAnswer: false,
    delayMs: TIMING.stepGap,
  });
  frames.push({
    label: "Answer",
    progress: { stepIndex: scenario.steps.length, bulletIndex: 0, done: true },
    showAnswer: true,
    delayMs: TIMING.answer,
  });

  return frames;
}

/* -------------------------------------------------------------------- page */

export default function ThoughtChainLabPage() {
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [speed, setSpeed] = useState(1);
  const [staggerBullets, setStaggerBullets] = useState(true);
  const [collapseInactive, setCollapseInactive] = useState(true);
  const [stepMode, setStepMode] = useState(false);
  const [showOverview, setShowOverview] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(true);

  /** null = empty state (nothing sent yet). */
  const [sentPrompt, setSentPrompt] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(-1);
  const [answerWords, setAnswerWords] = useState(0);
  const [composerText, setComposerText] = useState("");

  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0],
    [scenarioId],
  );
  const frames = useMemo(() => buildFrames(scenario, staggerBullets), [scenario, staggerBullets]);
  const answerWordList = useMemo(() => scenario.answer.split(/(\s+)/), [scenario]);

  const frame = frameIndex >= 0 ? frames[Math.min(frameIndex, frames.length - 1)] : null;
  const isRunning = sentPrompt !== null && frameIndex < frames.length - 1;
  const viewportRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setSentPrompt(null);
    setFrameIndex(-1);
    setAnswerWords(0);
  }, []);

  const start = useCallback((prompt: string) => {
    setSentPrompt(prompt);
    setFrameIndex(0);
    setAnswerWords(0);
    setComposerText("");
  }, []);

  const replay = useCallback(() => {
    setFrameIndex(0);
    setAnswerWords(0);
    if (sentPrompt === null) setSentPrompt(scenario.prompt);
  }, [sentPrompt, scenario.prompt]);

  /**
   * Switching scenario rebuilds the frame list, so the current position is
   * meaningless — drop back to the empty state.
   *
   * Done here rather than in an effect on `scenarioId`: the suggestion chips
   * change the scenario *and* start a run in the same commit, and an effect
   * would race the start and win, leaving a dead empty state.
   */
  const selectScenario = useCallback((id: string) => {
    setScenarioId(id);
    reset();
  }, [reset]);

  /**
   * Toggling stagger only adds or removes bullet frames, so the run can stay
   * where it is — the index just needs clamping to the shorter list.
   */
  const toggleStaggerBullets = useCallback((value: boolean) => {
    setStaggerBullets(value);
    setFrameIndex((i) => (i < 0 ? i : Math.min(i, buildFrames(scenario, value).length - 1)));
  }, [scenario]);

  // Frame advance. Skipped entirely in step mode so "Next" is the only clock.
  useEffect(() => {
    if (stepMode) return;
    if (frameIndex < 0 || frameIndex >= frames.length - 1) return;

    const next = frames[frameIndex + 1];
    const timer = setTimeout(() => setFrameIndex(frameIndex + 1), next.delayMs / speed);
    return () => clearTimeout(timer);
  }, [frameIndex, frames, speed, stepMode]);

  // Answer stream. Runs on its own clock once the answer frame lands.
  useEffect(() => {
    if (!frame?.showAnswer) return;
    if (answerWords >= answerWordList.length) return;

    const timer = setTimeout(
      () => setAnswerWords((n) => Math.min(n + 2, answerWordList.length)),
      TIMING.answerWord / speed,
    );
    return () => clearTimeout(timer);
  }, [frame?.showAnswer, answerWords, answerWordList.length, speed]);

  // Keep the newest content in view, the way the real thread does.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [frameIndex, answerWords]);

  const skipToEnd = useCallback(() => {
    if (sentPrompt === null) setSentPrompt(scenario.prompt);
    setFrameIndex(frames.length - 1);
    setAnswerWords(answerWordList.length);
  }, [sentPrompt, scenario.prompt, frames.length, answerWordList.length]);

  const isEmpty = sentPrompt === null;
  const showThinking = frame !== null && frame.progress.stepIndex < 0;
  const answerText = frame?.showAnswer ? answerWordList.slice(0, answerWords).join("") : "";

  return (
    <div className={TW.shell}>
      <Sidebar />
      <main className={showOverview ? TW.workspace : TW.workspaceSolo}>
        <aside className={TW.advisorPanel} aria-label="Advisor chat (simulated)">
          <div className={TW.advisorHeader}>
            <div className={TW.conversationBtn}>
              <span className={TW.conversationText}>
                {isEmpty ? "New conversation" : scenario.name}
              </span>
              <ChevronDownIcon />
            </div>
            <button type="button" className={TW.advisorAddBtn} aria-label="New conversation" onClick={reset}>
              <PlusIcon />
            </button>
          </div>

          {isEmpty ? (
            <div className={TW.attentionContent}>
              <h1 className={`${TW.attentionTitle} stagger-in`} style={{ "--stagger-index": 1 } as CSSProperties}>
                What can I help<br />you with?
              </h1>
              <div className={TW.attentionList}>
                {SCENARIOS.map((item, i) => (
                  <div
                    key={item.id}
                    className="stagger-in max-w-full"
                    style={{ "--stagger-index": i + 2 } as CSSProperties}
                  >
                    <SuggestionChip
                      label={item.prompt}
                      className="max-w-full"
                      onClick={() => {
                        setScenarioId(item.id);
                        start(item.prompt);
                      }}
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
                  <div className={TW.messageUser}>
                    <div className={TW.userMessageContent}>{sentPrompt}</div>
                  </div>

                  <div className={TW.messageAssistant}>
                    <div className={TW.messageStack}>
                      <div className={TW.assistantMessageContent}>
                        {showThinking ? (
                          <p className="m-0 font-satoshi text-[13px] text-black/45">Thinking...</p>
                        ) : null}

                        <ThoughtChain
                          steps={scenario.steps}
                          progress={frame?.progress ?? { stepIndex: -1, bulletIndex: 0, done: false }}
                          staggerBullets={staggerBullets}
                          collapseInactive={collapseInactive}
                        />

                        {answerText ? (
                          <MarkdownContent className={TW.markdown}>{answerText}</MarkdownContent>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={isEmpty ? TW.composerDockEmpty : TW.composerDock}>
                <div className={TW.composerWrap}>
                  <div className={TW.promptChipsRow}>
                    <div className={TW.promptChipsLeft}>
                      {SCENARIOS.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className={TW.promptChip}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setScenarioId(item.id);
                            setComposerText(item.prompt);
                          }}
                        >
                          /{item.name}
                        </div>
                      ))}
                    </div>
                    <button type="button" className={TW.promptChipExpand} aria-label="Expand prompts">
                      <ChevronDownIcon />
                    </button>
                  </div>

                  <form
                    className={`${TW.composer} ${isRunning ? TW.composerThinking : ""}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const text = composerText.trim();
                      if (text) start(text);
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
                            const text = composerText.trim();
                            if (text) start(text);
                          }
                        }}
                      />
                    </div>
                    <div className="flex shrink-0 items-center px-[16px]">
                      <button
                        type="submit"
                        className={TW.sendBtn}
                        disabled={!composerText.trim()}
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

        {showOverview ? <MockClientOverview /> : null}
      </main>

      <ControlBar
        open={controlsOpen}
        onToggleOpen={() => setControlsOpen((v) => !v)}
        scenarioId={scenarioId}
        onScenarioChange={selectScenario}
        speed={speed}
        onSpeedChange={setSpeed}
        staggerBullets={staggerBullets}
        onStaggerBulletsChange={toggleStaggerBullets}
        collapseInactive={collapseInactive}
        onCollapseInactiveChange={setCollapseInactive}
        stepMode={stepMode}
        onStepModeChange={setStepMode}
        showOverview={showOverview}
        onShowOverviewChange={setShowOverview}
        frameIndex={frameIndex}
        frameCount={frames.length}
        frameLabel={frame?.label ?? "idle"}
        onScrub={(index) => {
          if (sentPrompt === null) setSentPrompt(scenario.prompt);
          setFrameIndex(index);
          setAnswerWords(frames[index]?.showAnswer ? answerWordList.length : 0);
        }}
        onNext={() => setFrameIndex((i) => Math.min(i + 1, frames.length - 1))}
        onPrev={() => setFrameIndex((i) => Math.max(i - 1, 0))}
        onReplay={replay}
        onSkipToEnd={skipToEnd}
        onReset={reset}
      />
    </div>
  );
}

/* ------------------------------------------------------------- control bar */

function ControlBar({
  open,
  onToggleOpen,
  scenarioId,
  onScenarioChange,
  speed,
  onSpeedChange,
  staggerBullets,
  onStaggerBulletsChange,
  collapseInactive,
  onCollapseInactiveChange,
  stepMode,
  onStepModeChange,
  showOverview,
  onShowOverviewChange,
  frameIndex,
  frameCount,
  frameLabel,
  onScrub,
  onNext,
  onPrev,
  onReplay,
  onSkipToEnd,
  onReset,
}: {
  open: boolean;
  onToggleOpen: () => void;
  scenarioId: string;
  onScenarioChange: (id: string) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  staggerBullets: boolean;
  onStaggerBulletsChange: (value: boolean) => void;
  collapseInactive: boolean;
  onCollapseInactiveChange: (value: boolean) => void;
  stepMode: boolean;
  onStepModeChange: (value: boolean) => void;
  showOverview: boolean;
  onShowOverviewChange: (value: boolean) => void;
  frameIndex: number;
  frameCount: number;
  frameLabel: string;
  onScrub: (index: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onReplay: () => void;
  onSkipToEnd: () => void;
  onReset: () => void;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        className="fixed right-4 bottom-4 z-[100] rounded-full bg-black/85 px-4 py-2 font-satoshi text-[12px] font-medium text-white shadow-lg backdrop-blur"
      >
        Sim controls
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-4 z-[100] w-[300px] rounded-[16px] border border-white/10 bg-[#1a1a1a]/95 p-4 font-satoshi text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-white/50">
          Thought chain sim
        </span>
        <button type="button" onClick={onToggleOpen} className="text-[16px] leading-none text-white/40 hover:text-white">
          ×
        </button>
      </div>

      <label className="mb-3 block">
        <span className={CTRL.label}>Scenario</span>
        <select
          className={CTRL.select}
          value={scenarioId}
          onChange={(event) => onScenarioChange(event.target.value)}
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>

      <div className="mb-3">
        <span className={CTRL.label}>Speed</span>
        <div className="flex gap-1">
          {[0.25, 0.5, 1, 2, 4].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onSpeedChange(value)}
              className={`${CTRL.segment} ${speed === value ? CTRL.segmentOn : ""}`}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <span className={CTRL.label}>
          Frame {Math.max(frameIndex, 0) + 1} / {frameCount} — <span className="text-white/70">{frameLabel}</span>
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(frameCount - 1, 0)}
          value={Math.max(frameIndex, 0)}
          onChange={(event) => onScrub(Number(event.target.value))}
          className="w-full accent-[#b37f40]"
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1">
        <button type="button" className={CTRL.button} onClick={onReplay}>Replay</button>
        <button type="button" className={CTRL.button} onClick={onSkipToEnd}>Skip to end</button>
        <button type="button" className={CTRL.button} onClick={onPrev}>‹ Prev frame</button>
        <button type="button" className={CTRL.button} onClick={onNext}>Next frame ›</button>
        <button type="button" className={`${CTRL.button} col-span-2`} onClick={onReset}>Back to empty state</button>
      </div>

      <div className="grid gap-1.5 border-t border-white/10 pt-3">
        <Toggle label="Step mode (manual frames)" value={stepMode} onChange={onStepModeChange} />
        <Toggle label="Collapse inactive steps" value={collapseInactive} onChange={onCollapseInactiveChange} />
        <Toggle label="Stagger bullets" value={staggerBullets} onChange={onStaggerBulletsChange} />
        <Toggle label="Show client panel" value={showOverview} onChange={onShowOverviewChange} />
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-white/80">
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-[#b37f40]"
      />
      {label}
    </label>
  );
}

const CTRL = {
  label: "mb-1 block text-[11px] font-medium text-white/45",
  select: "w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[12px] text-white outline-none",
  segment: "flex-1 rounded-lg border border-white/15 bg-transparent py-1 text-[11px] text-white/60 transition hover:bg-white/10",
  segmentOn: "!border-[#b37f40] !bg-[#b37f40]/25 !text-white",
  button: "rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[11px] text-white/85 transition hover:bg-white/15",
};

/* --------------------------------------------------------- mock right pane */

/**
 * A static stand-in for ClientOverview. Present only so the chain is reviewed
 * at its real width against real neighbouring colour — none of it is wired up.
 */
function MockClientOverview() {
  return (
    <section className="relative grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#F9F8F7]" aria-label="Client overview (mock)">
      <header className="flex h-[54px] items-center gap-2 border-b border-black/10 bg-white/70 px-4 backdrop-blur-[12px]">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#432411] px-4 py-2 font-satoshi text-[13px] font-medium text-white">
          Overview
        </span>
        <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-satoshi text-[13px] text-black/60">
          Wealth map
        </span>
        <span className="ml-auto rounded-full bg-black/5 px-3 py-1 font-satoshi text-[11px] text-black/40">
          mock — not wired
        </span>
      </header>

      <div className="overflow-y-auto px-[40px] py-[36px]">
        <h1 className="m-0 font-butler-medium text-[44px] leading-[1.1] tracking-[-1.5px] text-[#432411]">
          Prashanth Kumar
        </h1>
        <p className="mt-3 max-w-[520px] font-satoshi text-[15px] leading-[24px] text-black/60">
          Singapore-based family office with concentrated technology equity, private
          investments, trust structures and multi-currency exposure.
        </p>
        <span className="mt-4 inline-flex rounded-full bg-black/[0.06] px-4 py-2 font-satoshi text-[13px] font-medium text-[#171615]">
          Singapore
        </span>

        <div className="mt-8 max-w-[520px] rounded-[24px] bg-white p-[28px] shadow-[0_2px_20px_rgba(0,0,0,0.04)]">
          <p className="m-0 font-satoshi text-[13px] font-bold tracking-[0.08em] uppercase text-[#804D13]">AUM</p>
          <p className="mt-2 mb-0 flex items-baseline gap-3 font-satoshi text-[40px] font-bold tracking-[-1px] text-[#171615]">
            $33.3 M
            <span className="font-satoshi text-[15px] font-medium text-[#1a7f4b]">↗ +3.8%</span>
          </p>

          <p className="mt-7 mb-0 font-satoshi text-[12px] font-bold tracking-[0.08em] uppercase text-black/40">
            At a glance
          </p>
          <dl className="m-0 mt-2">
            {[
              ["Segment", "Family office"],
              ["Client since", "2016"],
              ["Family", "4 members"],
              ["Tax residency", "Singapore"],
              ["Risk profile", "Growth"],
            ].map(([key, value]) => (
              <div key={key} className="flex items-center justify-between border-b border-black/[0.07] py-[14px] last:border-b-0">
                <dt className="font-satoshi text-[15px] text-black/70">{key}</dt>
                <dd className="m-0 font-satoshi text-[15px] font-medium text-[#171615]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ styles */

/**
 * Copied from app/client/page.tsx's TW map, trimmed to what this lab renders.
 * A copy on purpose: editing the lab must never be able to move the real panel.
 */
const TW = {
  shell: "h-screen overflow-hidden bg-white text-[#171615]",
  workspace: "relative ml-[80px] grid h-screen grid-cols-[434px_minmax(0,1fr)] overflow-hidden bg-white max-[1180px]:grid-cols-[minmax(360px,420px)_minmax(0,1fr)] max-[900px]:grid-cols-1",
  workspaceSolo: "relative ml-[80px] grid h-screen grid-cols-[434px_minmax(0,1fr)] overflow-hidden bg-white",
  advisorPanel: "relative grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)] border-r border-black/10 bg-white",
  advisorHeader: "relative z-[40] flex h-[54px] min-w-0 items-center justify-between gap-[12px] border-b border-black/10 bg-white/70 px-[16px] backdrop-blur-[12px]",
  conversationBtn: "inline-flex min-w-0 max-w-full items-center justify-start gap-[5px] overflow-hidden rounded-[10px] py-[8px] font-satoshi text-[14px] font-bold leading-[130%] tracking-[-0.28px] text-black [&_svg]:h-[16px] [&_svg]:w-[16px] [&_svg]:shrink-0",
  conversationText: "block min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap",
  advisorAddBtn: "inline-grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[12px] border border-black/[0.08] bg-transparent text-black transition hover:bg-black/[0.03] [&_svg]:h-[16px] [&_svg]:w-[16px]",
  attentionContent: "flex min-h-0 flex-col justify-center overflow-auto px-[20px] pt-[64px] pb-[190px]",
  attentionTitle: "m-0 mb-[20px] max-w-[394px] font-butler-medium text-[40px] font-medium leading-[48px] tracking-[-2px] text-black",
  attentionList: "grid max-w-[394px] justify-items-start gap-[8px]",

  // The thread is absolutely positioned over the panel, exactly as on /client:
  // docked to the bottom in the empty state, full-height once a run starts.
  threadArea: "absolute right-[17px] bottom-[16px] left-[16px] z-[5]",
  threadAreaFull: "top-[54px] !right-0 !left-0",
  thread: "relative flex h-full min-h-0 flex-col overflow-hidden",

  messageViewport: "relative min-h-0 flex-1 overflow-y-auto pt-[24px] pr-[44px] pb-[176px] pl-[22px]",
  messageUser: "mb-[18px] flex w-full justify-end gap-2.5",
  messageAssistant: "mb-[18px] flex w-full justify-start gap-2.5",
  // w-full, not just max-w-full: the assistant message is a flex item under
  // justify-start, so content-sizing would shrink it to its longest bullet and
  // pull the chain's right-aligned chevrons in off the column edge.
  messageStack: "w-full max-w-full",
  userMessageContent: "max-w-full [overflow-wrap:anywhere] rounded-[20px_20px_0_20px] bg-[#F3F3F3] p-[16px] font-satoshi text-[14px] font-medium leading-[1.5] tracking-[-0.16px] text-[#0D0D0D]",
  assistantMessageContent: "max-w-full [overflow-wrap:anywhere] py-1 font-satoshi text-[13px] leading-relaxed text-black",
  markdown: "[overflow-wrap:anywhere] font-satoshi text-[14px] leading-[1.5] tracking-[-0.16px] text-[#0D0D0D] [&_li]:my-[4px] [&_p]:mb-[16px] [&_strong]:font-bold [&_ul]:mb-[16px] [&_ul]:list-disc [&_ul]:pl-[20px] [&>*:last-child]:mb-0",

  composerDock: "absolute right-0 bottom-0 left-0 z-10 px-[22px]",
  composerDockEmpty: "relative z-10",
  composerWrap: "w-full rounded-[20px] border border-white bg-[#f7f7f7] p-[1px] pt-[6px]",
  composer: "relative mx-auto flex min-h-[74px] w-full items-center rounded-[24px] border border-black/[0.06] bg-white/90 py-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition",
  composerThinking: "ring-1 ring-[#b37f40]/40",
  composerInputRow: "min-w-0 flex-1 px-[24px]",
  composerInput: "h-auto min-h-0 w-full resize-none border-0 bg-transparent p-0 font-satoshi text-[16px] font-normal leading-[1.35] tracking-[-0.16px] text-black outline-none placeholder:text-black/60",
  sendBtn: "inline-grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border-0 bg-black p-0 text-white transition hover:-translate-y-px hover:bg-[#2d2926] disabled:opacity-100 [&_svg]:h-[24px] [&_svg]:w-[24px]",

  promptChipsRow: "mb-[6px] flex items-center justify-between gap-[4px] overflow-hidden rounded-[22px] px-[10px] pt-[4px]",
  promptChipsLeft: "flex min-w-0 flex-1 items-center gap-[8px] overflow-hidden",
  promptChip: "inline-flex min-w-0 shrink-0 cursor-pointer items-center rounded-full border border-white/60 bg-[#0000000A] px-[11px] py-[7px] font-satoshi text-[12px] font-normal leading-[16.2px] text-[#5d6b77] transition hover:bg-black/[0.07]",
  promptChipExpand: "inline-flex h-[32px] w-[40px] shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/60 text-black transition hover:bg-white/85 [&_svg]:h-[13px] [&_svg]:w-[13px]",
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
