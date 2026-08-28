"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * The one suggestion chip. Used by the empty-state prompts and the in-chat
 * reply suggestions, on both /chat and the client page's advisor panel.
 *
 * It ships as constants plus a body component rather than a single wrapper
 * component, because the four call sites need different root elements:
 * assistant-ui's <ThreadPrimitive.Suggestion> has to be the root to carry the
 * prompt, while the reply pills are plain divs with their own click handling.
 * Spreading the same class and style onto each is what keeps them identical.
 */
export const SUGGESTION_CHIP_CLASS =
  "inline-flex max-w-full cursor-pointer items-center gap-2.5 rounded-[12px] border border-white px-[8px] py-[6px] text-left [word-wrap:break-word] transition hover:-translate-y-px hover:brightness-[0.97]";

/**
 * Type and background live here, inline, on purpose.
 *
 * globals.css has an unlayered `button, input { font: inherit }` that beats
 * every layered utility regardless of specificity. A chip rendered as a
 * <button> (ThreadPrimitive.Suggestion) would silently take the root 16px and
 * appear scaled up next to the identical chip rendered as a <div>. Setting the
 * type here means the element type can't change how the chip looks.
 */
export const SUGGESTION_CHIP_STYLE: CSSProperties = {
  backgroundImage: "linear-gradient(#FFFFFFCC, #FFFFFFCC), url('/insights.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  fontFamily: "'Cascadia Code', monospace",
  fontSize: 12,
  fontWeight: 400,
  lineHeight: "16px",
  color: "#4C2D08",
  cursor: "pointer",
};

/** Leading arrow + label. Same reason for the inline size as the style above. */
export function SuggestionChipBody({ children }: { children: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="shrink-0 text-[#4C2D08]/60" style={{ fontSize: 12 }}>
        &rarr;
      </span>
      <span>{children}</span>
    </>
  );
}

/** Chip as a self-contained clickable div, for the reply-suggestion pills. */
export default function SuggestionChip({
  label,
  onClick,
  className = "",
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div
      className={`${SUGGESTION_CHIP_CLASS} ${className}`}
      style={SUGGESTION_CHIP_STYLE}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <SuggestionChipBody>{label}</SuggestionChipBody>
    </div>
  );
}
