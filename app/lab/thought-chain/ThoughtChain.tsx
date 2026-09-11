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
 * Production equivalent is app/components/WorkflowExecutionSteps.tsx, which
 * bakes the timers in, hardcodes the "Using/Used" verb, and keeps every step
 * expanded. Once a design here settles, port it back there.
 */

import { useState } from "react";

export type ThoughtStep = {
  id: string;
  /** Past-tense verb shown once the step is done. Omit for a bare label. */
  verb?: "Used" | "Ran" | "Read" | "Checked";
  /** Present-tense verb shown while the step is active. Defaults from `verb`. */
  verbActive?: string;
  label: string;
  bullets: string[];
  /** Icon under /public. Falls back to the rotating default set. */
  icon?: string;
};

export type ThoughtProgress = {
  /** Index of the step currently working. -1 = nothing revealed yet. */
  stepIndex: number;
  /** How many bullets of the active step are revealed. */
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
  /** Reveal the active step's bullets one at a time, rather than all at once. */
  staggerBullets = true,
  /**
   * Auto-expand only the working step and collapse the rest behind a chevron.
   * Off renders every revealed step expanded — the old behaviour, kept so the
   * two can be compared side by side while iterating.
   */
  collapseInactive = true,
}: {
  steps: ThoughtStep[];
  progress: ThoughtProgress;
  staggerBullets?: boolean;
  collapseInactive?: boolean;
}) {
  /**
   * Per-step user overrides of the auto expand/collapse. Sparse on purpose:
   * a step the user hasn't touched keeps following the active step, so the
   * chain still opens and closes itself as the run advances.
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  if (steps.length === 0) return null;

  /**
   * Which step opens itself. Normally the working one — but on completion
   * nothing is active, and collapsing all five at once leaves the chain as a
   * wall of bare headers that reads as broken. The last step holds open as the
   * most recent thing the AI did.
   */
  const autoExpandedIndex = progress.done ? steps.length - 1 : progress.stepIndex;

  return (
    // w-full so the right-aligned chevrons track the column edge rather than
    // the width of the longest bullet.
    <div className="relative mb-4 flex w-full flex-col">
      {/* Connector rail. Sits behind the icons (they carry z-index 2). */}
      <div
        className="absolute w-px bg-black/[0.06]"
        style={{ left: 11.5, top: 24, bottom: 10 }}
      />

      {steps.map((step, i) => {
        const isRevealed = progress.done || i <= progress.stepIndex;
        const isActive = !progress.done && i === progress.stepIndex;
        const isComplete = progress.done || i < progress.stepIndex;
        const icon = step.icon ?? DEFAULT_ICONS[i % DEFAULT_ICONS.length];
        const spinnerColor = ACTIVE_SPINNER_COLORS[i % ACTIVE_SPINNER_COLORS.length];

        const autoExpanded = collapseInactive ? i === autoExpandedIndex : true;
        const isExpanded = overrides[step.id] ?? autoExpanded;

        // The active step only shows the bullets the driver has released so far.
        const visibleBullets = !staggerBullets || isComplete
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
              className="group flex w-full items-center gap-[10px] border-0 bg-transparent p-0 pt-[10px] pb-[4px] text-left"
              aria-expanded={isExpanded}
              onClick={() => setOverrides((current) => ({ ...current, [step.id]: !isExpanded }))}
            >
              {isActive ? (
                <div
                  className="relative z-[2] grid h-[24px] w-[24px] shrink-0 place-items-center rounded-[10px]"
                  style={{ background: `linear-gradient(135deg, ${spinnerColor}40, ${spinnerColor}80)` }}
                >
                  <div
                    className="h-[10px] w-[10px] rounded-full border-2 border-white border-t-transparent"
                    style={{ animation: "tc-spin 0.8s linear infinite" }}
                  />
                </div>
              ) : (
                // Plain <img>: these are tiny static PNGs and next/image's
                // wrapper fights the fixed 24px rail alignment.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={icon}
                  alt=""
                  width={24}
                  height={24}
                  className="relative z-[2] shrink-0"
                />
              )}

              <span className="min-w-0 font-satoshi text-[14px] tracking-[-0.14px] text-black">
                {verb ? <span className="font-normal">{verb} </span> : null}
                <span className="font-medium">{step.label}</span>
              </span>

              {/* Flush right so the chevrons line up into a column regardless of
                  label length. Very low contrast at rest: it is an affordance
                  for a second read of the chain, not part of the first one.
                  Fixed square box, and the rotation is on the <svg> rather than
                  this wrapper — rotating a padded box swings its padding to the
                  other side and knocks the open chevron out of the column. */}
              <span
                className="ml-auto grid h-[20px] w-[20px] shrink-0 place-items-center text-black/20 transition-colors duration-300 group-hover:text-black/45"
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
            </button>

            {/* grid-template-rows 1fr/0fr animates to the content's natural
                height, which a max-height guess can't do without clipping the
                longer steps. */}
            <div
              className="grid transition-[grid-template-rows] duration-[350ms] ease-out"
              style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                {visibleBullets.map((bullet, bi) => (
                  <div
                    key={`${step.id}-${bi}`}
                    className="flex items-center gap-[10px] py-[2px]"
                    style={{ animation: "tc-bullet-in 0.45s ease both" }}
                  >
                    <div className="grid h-[24px] w-[24px] shrink-0 place-items-center">
                      <div className="h-[6px] w-[6px] rounded-full bg-[#CCCCCC]" />
                    </div>
                    <div className="font-satoshi text-[12px] font-normal tracking-[-0.12px] text-black/60">
                      {bullet}
                    </div>
                  </div>
                ))}
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
      `}</style>
    </div>
  );
}

export default ThoughtChain;
