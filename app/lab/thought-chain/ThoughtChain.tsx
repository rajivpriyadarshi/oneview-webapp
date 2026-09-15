"use client";

/**
 * ThoughtChain — the surface you iterate on.
 *
 * Owns no timers: the page's simulation driver decides what is revealed and
 * hands it down as `progress`. The only state here is which steps the user has
 * manually expanded or collapsed, which is presentation, not simulation. That
 * split is the point of the lab — you can redesign this file freely without
 * touching timing, and retime the run without touching visuals.
 *
 * Two layers share one timeline:
 *   - `tool` steps    work being performed — the colourful gradient marks
 *   - `system` steps  infrastructure governing the run (privacy, routing) —
 *                     monochrome glyph, micro-label, contained detail block
 *
 * Production equivalent is app/components/WorkflowExecutionSteps.tsx, which
 * bakes the timers in, hardcodes the "Using/Used" verb, knows nothing about
 * the system layer, and keeps every step expanded. Once a design here settles,
 * port it back there.
 */

import { useEffect, useMemo, useState } from "react";

/**
 * A detail line under a step header. Plain prose in the normal case; the route
 * shape exists so the router's decision can be structured rather than flattened
 * into a sentence.
 */
export type ThoughtDetail =
  | string
  | { kind: "route"; from: string; to: string; meta?: string }
  | { kind: "mask"; items: MaskItem[] }
  | {
      kind: "model-select";
      /** Short key above the list, in the same register as the mask keys. */
      label?: string;
      candidates: ModelCandidate[];
      /** Must match one candidate's `name`. */
      chosen: string;
    };

/**
 * One model considered by the router. `fit` (0–1) drives the length of the
 * score track, which is the only quantitative thing shown — the note carries
 * the reason, because a bare number explains nothing.
 */
export type ModelCandidate = { name: string; note: string; fit: number };

/**
 * One field being redacted. `raw` and `masked` should be the same length —
 * the reveal is a clip wipe across two stacked layers, so a length mismatch
 * shows as the text jittering mid-wipe.
 */
export type MaskItem = { key: string; raw: string; masked: string };

export type ThoughtStep = {
  id: string;
  /**
   * "system" swaps the colourful tool treatment for the quiet infrastructure
   * one. Defaults to "tool".
   */
  kind?: "tool" | "system";
  /** Past-tense verb shown once the step is done. Omit for a bare label. */
  verb?: "Used" | "Ran" | "Read" | "Checked";
  /** Present-tense verb shown while the step is active. Defaults from `verb`. */
  verbActive?: string;
  label: string;
  bullets: ThoughtDetail[];
  /** Icon under /public, for tool steps. Falls back to the rotating set. */
  icon?: string;
  /** Monochrome glyph for system steps. */
  glyph?: "shield" | "router";
  /** Micro-label for system steps, e.g. "SYSTEM · PRIVACY". */
  systemLabel?: string;
};

/**
 * How long a detail line's own animation runs, so the driver can hold the next
 * line back until this one has finished. Plain prose needs no hold.
 *
 * Lives here rather than in the driver because these are the durations the
 * animations below actually use — splitting them would guarantee they drift.
 */
export function detailDwellMs(detail: ThoughtDetail): number {
  if (typeof detail === "string") return 0;
  if (detail.kind === "mask") {
    const last = Math.max(0, detail.items.length - 1);
    return MASK_LEAD_IN_MS + last * MASK_STAGGER_MS + MASK_SWEEP_MS + 180;
  }
  if (detail.kind === "model-select") {
    return MODEL_LEAD_IN_MS + detail.candidates.length * MODEL_EVAL_MS + MODEL_DECIDE_MS + 160;
  }
  return ROUTE_TOTAL_MS;
}

export type ThoughtProgress = {
  /** Index of the step currently working. -1 = nothing revealed yet. */
  stepIndex: number;
  /** How many detail lines of the active step are revealed. */
  bulletIndex: number;
  /** All steps finished. */
  done: boolean;
};

const DEFAULT_ICONS = [
  "/chat-workflow/family-context.png",
  "/chat-workflow/portfolio-review.png",
  "/chat-workflow/risk-alerts.png",
  "/chat-workflow/meeting-prep.png",
];

const ACTIVE_SPINNER_COLORS = ["#F97316", "#3B82F6", "#8B5CF6", "#EF4444", "#10B981", "#F59E0B"];

const PRESENT_TENSE: Record<string, string> = {
  Used: "Using",
  Ran: "Running",
  Read: "Reading",
  Checked: "Checking",
};

export function ThoughtChain({
  steps,
  progress,
  /** Reveal the active step's detail lines one at a time, rather than at once. */
  staggerBullets = true,
  /**
   * Auto-expand only the working step and collapse the rest behind a chevron.
   * Off renders every revealed step expanded — the old behaviour, kept so the
   * two can be compared side by side while iterating.
   */
  collapseInactive = true,
  /**
   * Divides every delay and duration below, so the lab's speed control moves
   * these decorative animations in step with the driver's frames instead of
   * leaving them running at 1x while the run races ahead.
   */
  speed = 1,
}: {
  steps: ThoughtStep[];
  progress: ThoughtProgress;
  staggerBullets?: boolean;
  collapseInactive?: boolean;
  speed?: number;
}) {
  /**
   * Per-step user overrides of the auto expand/collapse. Sparse on purpose:
   * a step the user hasn't touched keeps following the active step, so the
   * chain still opens and closes itself as the run advances.
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  if (steps.length === 0) return null;

  /**
   * Which step opens itself: the working one, and nothing once the run is done.
   * A finished run collapses to its headers — the detail belonged to watching
   * the work happen, and the answer below is what matters afterwards.
   */
  const autoExpandedIndex = progress.done ? -1 : progress.stepIndex;

  return (
    // w-full so the right-aligned chevrons track the column edge rather than
    // the width of the longest detail line.
    <div className="relative mb-4 flex w-full flex-col">
      {/* The one continuous timeline. System steps sit to its right like every
          other step, so the run still reads straight down. */}
      <div
        className="absolute w-px bg-black/[0.06]"
        // top tracks the first header's pt so the rail still emerges from
        // behind the first mark rather than above it.
        style={{ left: 11.5, top: 30, bottom: 10 }}
      />

      {steps.map((step, i) => {
        const isRevealed = progress.done || i <= progress.stepIndex;
        const isActive = !progress.done && i === progress.stepIndex;
        const isComplete = progress.done || i < progress.stepIndex;
        const isSystem = step.kind === "system";

        // One rule for both layers: only the working step is open. A system
        // step's detail earns its space while the check is running and stops
        // earning it the moment the check resolves, so Privacy Guard closes as
        // routing begins. Re-openable by hand via the chevron.
        const autoExpanded = !collapseInactive || i === autoExpandedIndex;
        const isExpanded = overrides[step.id] ?? autoExpanded;

        // The active step only shows the lines the driver has released so far.
        const visibleDetails = !staggerBullets || isComplete
          ? step.bullets
          : isActive
            ? step.bullets.slice(0, progress.bulletIndex)
            : [];

        const verb = isComplete
          ? step.verb
          : step.verb
            ? (step.verbActive ?? PRESENT_TENSE[step.verb] ?? step.verb)
            : undefined;

        return (
          <div
            key={step.id}
            className="flex flex-col overflow-hidden transition-[opacity,max-height] duration-700 ease-out"
            style={{
              opacity: isRevealed ? 1 : 0,
              maxHeight: isRevealed ? 600 : 0,
            }}
          >
            {/* Whole header is the disclosure hit area — the chevron alone is
                too small a target at 14px type. */}
            <button
              type="button"
              className="group flex w-full items-center gap-[10px] border-0 bg-transparent p-0 pt-[16px] pb-[6px] text-left"
              aria-expanded={isExpanded}
              onClick={() => setOverrides((current) => ({ ...current, [step.id]: !isExpanded }))}
            >
              <StepMark step={step} index={i} isActive={isActive} />

              <span className="min-w-0 font-satoshi text-[14px] tracking-[-0.14px] text-black">
                {verb ? <span className="font-normal">{verb} </span> : null}
                <span className="font-medium">{step.label}</span>
              </span>

              {/* Grouped so the chevron stays the last, flush-right element on
                  every row — the system micro-label can't knock the chevron
                  column out of alignment. */}
              <span className="ml-auto flex shrink-0 items-center gap-[8px]">
                {isSystem && step.systemLabel ? (
                  <span className="font-satoshi text-[9px] font-medium tracking-[0.09em] whitespace-nowrap text-black/30 uppercase">
                    {step.systemLabel}
                  </span>
                ) : null}

                {/* Fixed square box, and the rotation is on the <svg> rather
                    than this wrapper — rotating a padded box swings its padding
                    to the other side and knocks the chevron out of the column. */}
                <span
                  className="grid h-[20px] w-[20px] place-items-center text-black/20 transition-colors duration-300 group-hover:text-black/45"
                  aria-hidden="true"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className="transition-transform duration-300"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "none" }}
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>
            </button>

            {/* grid-template-rows 1fr/0fr animates to the content's natural
                height, which a max-height guess can't do without clipping the
                longer steps. */}
            <div
              className="grid transition-[grid-template-rows] duration-[350ms] ease-out"
              style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                {isSystem ? (
                  /* Indented to 34px (24px mark + 10px gap) so it starts on the
                     header's text column and the timeline passes to its left.
                     Outline plus a barely-there tint, no fill weight: it should
                     read as a different layer, not as a card. */
                  <div className="mt-[2px] mb-[6px] ml-[34px] rounded-[10px] border border-black/[0.06] bg-black/[0.015] px-[12px] py-[9px]">
                    {visibleDetails.map((detail, di) => (
                      <div
                        key={`${step.id}-${di}`}
                        className={di > 0 ? "mt-[6px]" : undefined}
                        style={{ animation: "tc-bullet-in 0.45s ease both" }}
                      >
                        <DetailLine detail={detail} speed={speed} />
                      </div>
                    ))}
                  </div>
                ) : (
                  visibleDetails.map((detail, di) => (
                    <div
                      key={`${step.id}-${di}`}
                      className="flex items-center gap-[10px] py-[2px]"
                      style={{ animation: "tc-bullet-in 0.45s ease both" }}
                    >
                      <div className="grid h-[24px] w-[24px] shrink-0 place-items-center">
                        <div className="h-[6px] w-[6px] rounded-full bg-[#CCCCCC]" />
                      </div>
                      <DetailLine detail={detail} speed={speed} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes tc-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes tc-bullet-in {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes rt-in {
          from { opacity: 0; transform: translateX(-3px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes rt-travel {
          0%   { opacity: 0; transform: translate(0, -50%) scale(0.6); }
          25%  { opacity: 1; transform: translate(4px, -50%) scale(1); }
          75%  { opacity: 1; transform: translate(14px, -50%) scale(1); }
          100% { opacity: 0; transform: translate(18px, -50%) scale(0.6); }
        }
        @keyframes rt-land {
          from { opacity: 0; transform: translateY(2px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
        @keyframes ms-ping {
          0%   { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.16); }
          70%  { box-shadow: 0 0 0 5px rgba(0, 0, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
        }
        @keyframes rt-flash {
          0%   { opacity: 0; }
          18%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/** Detail typography is identical in both layers — only the container differs. */
function DetailLine({ detail, speed }: { detail: ThoughtDetail; speed: number }) {
  if (typeof detail === "string") {
    return (
      <div className="font-satoshi text-[12px] font-normal tracking-[-0.12px] text-black/60">
        {detail}
      </div>
    );
  }

  if (detail.kind === "mask") {
    return <MaskBlock items={detail.items} speed={speed} />;
  }

  if (detail.kind === "model-select") {
    return (
      <ModelSelectBlock
        label={detail.label}
        candidates={detail.candidates}
        chosen={detail.chosen}
        speed={speed}
      />
    );
  }

  return <RouteBlock from={detail.from} to={detail.to} meta={detail.meta} speed={speed} />;
}

/** Delay before the first candidate is examined, per-candidate dwell, and the
 *  pause before the winner is declared. */
const MODEL_LEAD_IN_MS = 280;
const MODEL_EVAL_MS = 460;
const MODEL_DECIDE_MS = 380;

/**
 * The model choice, animated as an actual evaluation rather than a fait
 * accompli: every candidate is visible from the start, a scan head walks down
 * them one at a time filling each score track and stating its verdict, and only
 * once the list is exhausted does the winner take emphasis while the rest
 * recede. Watching it should make the ordering of events obvious — considered
 * first, decided second.
 *
 * Has its own clock because the stages are stateful (which row is under
 * examination, and whether a decision has been reached); CSS delays alone
 * cannot express "everything before row N looks different from everything
 * after".
 */
function ModelSelectBlock({
  label,
  candidates,
  chosen,
  speed,
}: {
  label?: string;
  candidates: ModelCandidate[];
  chosen: string;
  speed: number;
}) {
  /** -1 = not started, 0..n-1 = examining that row, n = decided. */
  const [cursor, setCursor] = useState(-1);
  const count = candidates.length;

  useEffect(() => {
    const timers: number[] = [];
    for (let i = 0; i <= count; i += 1) {
      const at = (MODEL_LEAD_IN_MS + i * MODEL_EVAL_MS) / speed;
      timers.push(window.setTimeout(() => setCursor(i), at));
    }
    return () => timers.forEach(clearTimeout);
  }, [count, speed]);

  const decided = cursor >= count;
  const note = decided
    ? candidates.find((candidate) => candidate.name === chosen)?.note
    : cursor >= 0
      ? candidates[cursor]?.note
      : undefined;

  return (
    <div className="font-satoshi text-[12px] tracking-[-0.12px]">
      {label ? (
        <div className="mb-[5px] text-[11px] font-normal tracking-[-0.11px] text-black/35">
          {label}
        </div>
      ) : null}

      <div className="grid gap-[4px]">
        {candidates.map((candidate, i) => {
          const isChosen = candidate.name === chosen;
          const examining = !decided && i === cursor;
          const examined = i < cursor || decided;

          // Three states, one rule: unexamined rows are quiet, the row under
          // examination is legible, and after the decision only the winner is.
          const nameTone = decided
            ? isChosen
              ? "font-medium text-black/85"
              : "font-normal text-black/25"
            : examining
              ? "font-normal text-black/75"
              : "font-normal text-black/40";

          return (
            <div
              key={candidate.name}
              className="relative flex items-center gap-[8px] transition-[opacity,color] duration-300 ease-out"
              style={{ animation: `rt-in ${Math.round(300 / speed)}ms ease ${Math.round((i * 70) / speed)}ms both` }}
            >
              {/* Examination highlight — the scan head, as a band rather than a
                  border so it doesn't add structure to the trace. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-[6px] -inset-y-[3px] rounded-[5px] bg-black/[0.05] transition-opacity duration-200 ease-out"
                style={{ opacity: examining ? 1 : 0 }}
              />

              <span
                aria-hidden="true"
                className="relative h-[4px] w-[4px] shrink-0 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor: decided
                    ? isChosen
                      ? "rgba(0,0,0,0.7)"
                      : "rgba(0,0,0,0.12)"
                    : examining
                      ? "rgba(0,0,0,0.55)"
                      : "rgba(0,0,0,0.18)",
                  animation: examining ? `ms-ping ${Math.round(700 / speed)}ms ease-out infinite` : undefined,
                }}
              />

              <span className={`relative min-w-0 truncate ${nameTone}`}>{candidate.name}</span>

              {/* Score track: fills as the row is examined, so the comparison
                  is legible at a glance without printing numbers. */}
              <span
                aria-hidden="true"
                className="relative ml-auto h-[3px] w-[34px] shrink-0 overflow-hidden rounded-full bg-black/[0.07]"
              >
                <span
                  className="block h-full rounded-full transition-[width,background-color] duration-[420ms] ease-out"
                  style={{
                    width: examined ? `${Math.round(candidate.fit * 100)}%` : "0%",
                    backgroundColor: decided && !isChosen ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.45)",
                  }}
                />
              </span>

              {/* Fixed slot so the rows don't shift when the tick lands. */}
              <span className="relative grid h-[12px] w-[12px] shrink-0 place-items-center">
                {decided && isChosen ? (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                    style={{ animation: `rt-land ${Math.round(360 / speed)}ms cubic-bezier(0.2, 0.8, 0.2, 1) both` }}
                  >
                    <path
                      d="M1.6 5.2 L3.9 7.5 L8.4 2.6"
                      stroke="rgba(0,0,0,0.75)"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      {/* One shared verdict line rather than a note per row: at 434px a
          per-row note wraps to three lines and the list stops being scannable.
          Keying on the text restarts the fade, so each verdict reads as new. */}
      <div className="mt-[6px] min-h-[15px] text-[11px] tracking-[-0.11px] text-black/35">
        {note ? (
          <span key={note} style={{ animation: `rt-in ${Math.round(240 / speed)}ms ease both` }}>
            {note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The routing decision, staged so it reads as a choice being made: the source
 * classification arrives, a dot travels the arrow, and the selected route lands
 * with a brief highlight that settles. All CSS delays — the sequence is short
 * enough that giving it a clock would buy nothing.
 */
function RouteBlock({
  from,
  to,
  meta,
  speed,
}: {
  from: string;
  to: string;
  meta?: string;
  speed: number;
}) {
  const ms = (value: number) => `${Math.round(value / speed)}ms`;

  return (
    <div className="font-satoshi text-[12px] tracking-[-0.12px]">
      <div className="flex flex-wrap items-baseline gap-x-[6px]">
        <span
          className="font-normal text-black/45"
          style={{ animation: `rt-in ${ms(360)} ease ${ms(40)} both` }}
        >
          {from}
        </span>

        {/* Fixed-width track so the dot has somewhere to travel. */}
        <span className="relative inline-block h-[12px] w-[18px] shrink-0 self-center">
          <span
            className="absolute inset-0 grid place-items-center text-black/25"
            style={{ animation: `rt-in ${ms(300)} ease ${ms(240)} both` }}
          >
            &rarr;
          </span>
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-0 h-[3px] w-[3px] -translate-y-1/2 rounded-full bg-black/45"
            style={{ animation: `rt-travel ${ms(560)} cubic-bezier(0.4, 0, 0.2, 1) ${ms(300)} both` }}
          />
        </span>

        {/* The only emphasis in the system layer: the route actually chosen. */}
        <span className="relative inline-block">
          <span
            aria-hidden="true"
            className="absolute -inset-x-[5px] -inset-y-[2px] rounded-[5px] bg-black/[0.06]"
            style={{ animation: `rt-flash ${ms(1000)} ease ${ms(800)} both` }}
          />
          <span
            className="relative font-medium text-black/85"
            style={{ animation: `rt-land ${ms(420)} cubic-bezier(0.2, 0.8, 0.2, 1) ${ms(800)} both` }}
          >
            {to}
          </span>
        </span>
      </div>

      {meta ? (
        <div
          className="mt-[3px] font-normal text-black/35"
          style={{ animation: `rt-in ${ms(360)} ease ${ms(1080)} both` }}
        >
          {meta}
        </div>
      ) : null}
    </div>
  );
}

/** The route sequence's last animation ends at 1080 + 360; plus a short tail. */
const ROUTE_TOTAL_MS = 1560;

/** Delay before the first field starts redacting, and the gap between fields. */
const MASK_LEAD_IN_MS = 260;
const MASK_STAGGER_MS = 300;

function MaskBlock({ items, speed }: { items: MaskItem[]; speed: number }) {
  return (
    <div className="grid gap-[5px]">
      {items.map((item, i) => (
        <div
          key={item.key}
          className="grid grid-cols-[76px_minmax(0,1fr)] items-baseline gap-x-[10px]"
        >
          <span className="font-satoshi text-[11px] font-normal tracking-[-0.11px] text-black/35">
            {item.key}
          </span>
          <MaskedValue
            raw={item.raw}
            masked={item.masked}
            delayMs={(MASK_LEAD_IN_MS + i * MASK_STAGGER_MS) / speed}
            durationMs={MASK_SWEEP_MS / speed}
          />
        </div>
      ))}
    </div>
  );
}

const MASK_SWEEP_MS = 780;

/** Deterministic scramble alphabet — no Math.random, so SSR and client agree. */
const SCRAMBLE = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

/** Characters that survive the scramble, so the value keeps its recognisable shape. */
const STRUCTURAL = new Set([" ", "-", "@", ".", "+", "/"]);

/**
 * Redaction as a scan head sweeping the value: characters scramble as the head
 * reaches them and settle to their masked form behind it, with a soft band
 * riding the head. Reads as the field being actively processed rather than
 * simply swapped.
 *
 * This is the one place with its own clock. The driver still owns the run — the
 * sweep is decorative and self-contained, and starting it on mount is what
 * syncs it to the field appearing. Mono type throughout so the head can be
 * positioned in `ch` units and land on character boundaries.
 */
function MaskedValue({
  raw,
  masked,
  delayMs,
  durationMs,
}: {
  raw: string;
  masked: string;
  delayMs: number;
  durationMs: number;
}) {
  const rawChars = useMemo(() => [...raw], [raw]);
  const maskedChars = useMemo(() => [...masked], [masked]);

  /** 0 = untouched, 1 = fully masked. */
  const [sweep, setSweep] = useState(0);
  /** Bumped on a slower cadence than the frame loop so the scramble is legible. */
  const [roll, setRoll] = useState(0);

  useEffect(() => {
    let frame = 0;
    let startedAt = 0;
    let lastRoll = 0;

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt - delayMs;

      if (elapsed >= durationMs) {
        setSweep(1);
        return;
      }
      if (elapsed > 0) {
        setSweep(elapsed / durationMs);
        if (now - lastRoll > 60) {
          lastRoll = now;
          setRoll((value) => value + 1);
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [delayMs, durationMs, raw, masked]);

  // Eased so the head slows as it lands, rather than stopping dead.
  const eased = sweep >= 1 ? 1 : 1 - Math.pow(1 - sweep, 2);
  const head = eased * rawChars.length;
  const isSettled = sweep >= 1;

  return (
    <span className="relative inline-block font-mono text-[11px] leading-[16px] whitespace-pre">
      {rawChars.map((char, i) => {
        const settled = i < head - 0.5;
        const underHead = !settled && i < head + 1.4;

        if (settled) {
          return (
            <span key={i} className="text-black/70">
              {maskedChars[i] ?? char}
            </span>
          );
        }
        if (underHead && !STRUCTURAL.has(char)) {
          return (
            <span key={i} className="text-black/35">
              {SCRAMBLE[(i * 7 + roll * 13) % SCRAMBLE.length]}
            </span>
          );
        }
        return (
          <span key={i} className="text-black/50">
            {char}
          </span>
        );
      })}

      {/* The head itself. 1ch-wide soft band, so it tracks characters exactly. */}
      {!isSettled && sweep > 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-y-[2px] rounded-[2px]"
          style={{
            left: `${Math.max(head - 0.4, 0)}ch`,
            width: "1.8ch",
            background: "linear-gradient(90deg, rgba(0,0,0,0.02), rgba(0,0,0,0.10), rgba(0,0,0,0.02))",
          }}
        />
      ) : null}
    </span>
  );
}

/**
 * The 24px mark on the timeline. Same footprint in both layers so the rail
 * stays aligned; the treatment is what separates them — gradient for tools,
 * flat outlined monochrome for system steps.
 */
function StepMark({
  step,
  index,
  isActive,
}: {
  step: ThoughtStep;
  index: number;
  isActive: boolean;
}) {
  const isSystem = step.kind === "system";

  if (isSystem) {
    return (
      <span className="relative z-[2] grid h-[24px] w-[24px] shrink-0 place-items-center rounded-[8px] border border-black/[0.08] bg-white text-black/45">
        {isActive ? (
          <span
            className="h-[10px] w-[10px] rounded-full border-[1.5px] border-black/25 border-t-transparent"
            style={{ animation: "tc-spin 0.8s linear infinite" }}
          />
        ) : step.glyph === "router" ? (
          <RouterGlyph />
        ) : (
          <ShieldGlyph />
        )}
      </span>
    );
  }

  if (isActive) {
    const color = ACTIVE_SPINNER_COLORS[index % ACTIVE_SPINNER_COLORS.length];
    return (
      <span
        className="relative z-[2] grid h-[24px] w-[24px] shrink-0 place-items-center rounded-[10px]"
        style={{ background: `linear-gradient(135deg, ${color}40, ${color}80)` }}
      >
        <span
          className="h-[10px] w-[10px] rounded-full border-2 border-white border-t-transparent"
          style={{ animation: "tc-spin 0.8s linear infinite" }}
        />
      </span>
    );
  }

  return (
    // Plain <img>: these are tiny static PNGs and next/image's wrapper fights
    // the fixed 24px rail alignment.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={step.icon ?? DEFAULT_ICONS[index % DEFAULT_ICONS.length]}
      alt=""
      width={24}
      height={24}
      className="relative z-[2] shrink-0"
    />
  );
}

function ShieldGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M6 1.6l3.5 1.3v3.2c0 2.1-1.5 3.6-3.5 4.3-2-.7-3.5-2.2-3.5-4.3V2.9L6 1.6z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="5.5" r="0.95" fill="currentColor" />
    </svg>
  );
}

function RouterGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M1.6 6h2.2c1.6 0 1.6-3 3.2-3h1.4M3.8 6c1.6 0 1.6 3 3.2 3h1.4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="9.6" cy="3" r="1" fill="currentColor" />
      <circle cx="9.6" cy="9" r="1" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export default ThoughtChain;
