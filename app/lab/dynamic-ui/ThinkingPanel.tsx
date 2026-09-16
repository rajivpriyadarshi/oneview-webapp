"use client";

/**
 * What fills the report pane before there is a report.
 *
 * The staged flow is slow on purpose — the analysis is one call, deciding what
 * that analysis wants is a separate pass over it, and shaping it into sections is
 * a third. Six to ten seconds of blank sheet reads as broken, and a spinner reads
 * as "no idea, wait". So the sheet shows the actual sequence instead: what was
 * answered, what the decider read in that answer, which sections it earned.
 *
 * It is not decoration and it is not a log. Every line here is a decision that was
 * genuinely made, in the order it was made, phrased the way it would be explained
 * out loud — which means when the layout comes out wrong, the reader can see
 * *where* it went wrong rather than only that it did.
 */

import type { Stage } from "./live";
import { ACCENT, withAlpha } from "./palette";

export type ThinkingLine = {
  id: string;
  text: string;
  detail?: string[];
  state: "active" | "done";
};

/** Stage events, in arrival order, folded into one line per stage. */
export function linesFrom(stages: Stage[]): ThinkingLine[] {
  const lines: ThinkingLine[] = [];
  for (const stage of stages) {
    const existing = lines.find((line) => line.id === stage.id);
    const text = stage.note ?? stage.id;
    if (existing) {
      // A stage's "done" note supersedes its "start" note: the start says what is
      // being attempted, the end says what was found, and only the second is worth
      // keeping once it exists.
      existing.text = stage.state === "done" ? text : existing.text;
      existing.detail = stage.detail ?? existing.detail;
      existing.state = stage.state === "done" ? "done" : existing.state;
    } else {
      lines.push({ id: stage.id, text, detail: stage.detail, state: stage.state === "done" ? "done" : "active" });
    }
  }
  return lines;
}

export function ThinkingPanel({ stages, title }: { stages: Stage[]; title?: string }) {
  const lines = linesFrom(stages);
  if (lines.length === 0) return null;

  return (
    <section className="du-think" aria-live="polite" aria-label="Working it out">
      <p
        className="m-0 font-satoshi text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: withAlpha(ACCENT, 0.65) }}
      >
        {title ?? "Working it out"}
      </p>

      <ol className="mt-[16px] mb-0 grid list-none gap-[14px] p-0">
        {lines.map((line, i) => (
          <li
            key={line.id}
            className="du-think-line grid grid-cols-[16px_minmax(0,1fr)] gap-[10px]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span aria-hidden className="pt-[4px]">
              {line.state === "done" ? (
                <svg viewBox="0 0 16 16" className="h-[13px] w-[13px]" fill="none">
                  <path
                    d="M3.5 8.5l3 3 6-7"
                    stroke={ACCENT}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span
                  className="du-think-dot mt-[3px] block h-[7px] w-[7px] rounded-full"
                  style={{ backgroundColor: ACCENT }}
                />
              )}
            </span>

            <span className="min-w-0">
              <span
                className="block font-satoshi text-[13.5px] leading-[1.5] tracking-[-0.1px]"
                style={{ color: line.state === "done" ? "rgba(23,22,21,0.78)" : "#171615" }}
              >
                {line.text}
              </span>
              {line.detail && line.detail.length > 0 ? (
                <span className="mt-[8px] grid gap-[5px]">
                  {line.detail.map((entry) => (
                    <span
                      key={entry}
                      className="block rounded-[8px] px-[10px] py-[6px] font-satoshi text-[12px] leading-[1.45] tracking-[-0.08px]"
                      style={{
                        backgroundColor: withAlpha(ACCENT, 0.05),
                        color: "rgba(23,22,21,0.62)",
                      }}
                    >
                      {entry}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      <style>{`
        @keyframes du-think-in {
          from { opacity: 0; transform: translateY(6px) }
          to { opacity: 1; transform: none }
        }
        @keyframes du-think-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.7) }
          50% { opacity: 1; transform: scale(1) }
        }
        .du-think-line { animation: du-think-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both }
        .du-think-dot { animation: du-think-dot 1000ms ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .du-think-line { animation-duration: 1ms }
          .du-think-dot { animation: none }
        }
      `}</style>
    </section>
  );
}

export default ThinkingPanel;
