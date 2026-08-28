"use client";

/**
 * Entry animation for modal-style popups: the scrim fades, the card rises.
 *
 * Kept as an inline <style> rather than living in globals.css because that
 * stylesheet sits inside an unclosed `@layer components`, so anything defined
 * there loses to Tailwind's utilities. Timing matches ArtifactPopup, which
 * carries its own copy — its backdrop settles at 0.82 opacity, not 1, so it
 * can't share these keyframes.
 *
 * There is no exit animation: these popups unmount the moment they close, so
 * a leave transition would need the markup kept alive through it.
 */
export const POPUP_SCRIM_CLASS = "popup-scrim";
export const POPUP_CARD_CLASS = "popup-card";

const CSS = `
  @keyframes popup-scrim-in { from { opacity: 0 } to { opacity: 1 } }
  @keyframes popup-card-in {
    from { opacity: 0; transform: translateY(14px) scale(0.975) }
    to { opacity: 1; transform: none }
  }
  .${POPUP_SCRIM_CLASS} { animation: popup-scrim-in 320ms ease-out both }
  .${POPUP_CARD_CLASS} { animation: popup-card-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both }
  @media (prefers-reduced-motion: reduce) {
    .${POPUP_SCRIM_CLASS}, .${POPUP_CARD_CLASS} { animation-duration: 1ms }
  }
`;

export default function PopupAnimStyles() {
  return <style>{CSS}</style>;
}
