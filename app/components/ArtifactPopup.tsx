"use client";

import { useEffect } from "react";
import { useArtifactContext } from "../hooks/useArtifactContext";
import ArtifactRenderer from "./artifact/ArtifactRenderer";

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Keyframes live here rather than in globals.css: that stylesheet is inside an
// unclosed `@layer components`, so anything defined there loses to Tailwind's
// utilities. Duration/easing shared by both popup variants.
const ANIM_STYLES = `
  @keyframes artifact-backdrop-in { from { opacity: 0 } to { opacity: 0.82 } }
  @keyframes artifact-card-in {
    from { opacity: 0; transform: translateY(14px) scale(0.975) }
    to { opacity: 1; transform: none }
  }
  .artifact-backdrop { animation: artifact-backdrop-in 320ms ease-out both }
  .artifact-card { animation: artifact-card-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both }
  @media (prefers-reduced-motion: reduce) {
    .artifact-backdrop, .artifact-card { animation-duration: 1ms }
  }
`;

export default function ArtifactPopup() {
  const { artifact, isOpen, closeArtifact, positioning } = useArtifactContext();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeArtifact();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeArtifact]);

  if (!isOpen || !artifact) {
    return null;
  }

  if (positioning === "client-panel") {
    return (
      <div className="absolute inset-0 z-[80]">
        <style>{ANIM_STYLES}</style>
        {/* Backdrop exported from Figma 2473:7283 rather than hand-mixed gradient
            stops. It gets its own layer because opacity can't be applied to just
            the background-image of the scroll container. */}
        <div
          aria-hidden
          className="artifact-backdrop pointer-events-none absolute inset-0 opacity-[0.82] backdrop-blur-[2px]"
          style={{
            backgroundImage: "url('/artifact-backdrop.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 overflow-y-auto" onClick={closeArtifact}>
          <button
            type="button"
            className="absolute right-[24px] top-[20px] z-[2] flex h-[40px] w-[40px] items-center justify-center rounded-full border border-black/10 bg-white text-black/80 shadow-[0_6px_22px_rgba(0,0,0,0.10)] transition hover:bg-white/90 hover:text-black"
            onClick={closeArtifact}
            aria-label="Close"
          >
            <CloseIcon />
          </button>

          <div className="relative z-[1] mx-auto flex min-h-full w-full max-w-[900px] items-center px-[32px] py-[96px] max-[900px]:px-[20px] max-[900px]:py-[78px]">
            <div
              className="artifact-card w-full rounded-[28px] bg-white px-[32px] py-[28px] shadow-[0_24px_80px_rgba(58,35,9,0.16)] max-[640px]:rounded-[22px] max-[640px]:px-[22px]"
              onClick={(e) => e.stopPropagation()}
            >
              <ArtifactRenderer artifact={artifact} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (positioning === "fixed") {
    return (
      <div
        className="fixed inset-0 z-[600] overflow-y-auto p-[24px]"
        onClick={closeArtifact}
      >
        <style>{ANIM_STYLES}</style>
        {/* Same Figma backdrop (2473:7283) as the client-panel variant; fixed so
            it stays put while the artifact scrolls. */}
        <div
          aria-hidden
          className="artifact-backdrop pointer-events-none fixed inset-0 opacity-[0.82] backdrop-blur-[2px]"
          style={{
            backgroundImage: "url('/artifact-backdrop.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <button
          type="button"
          className="fixed right-[24px] top-[20px] z-[2] flex h-[40px] w-[40px] items-center justify-center rounded-full border border-black/10 bg-white text-black/80 shadow-[0_6px_22px_rgba(0,0,0,0.10)] transition hover:bg-white/90 hover:text-black"
          onClick={closeArtifact}
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="relative z-[1] mx-auto flex min-h-full w-full max-w-[760px] items-center py-[72px] max-[720px]:py-[56px]">
          <div
            className="artifact-card w-full rounded-[28px] bg-white px-[28px] py-[24px] shadow-[0_24px_90px_rgba(79,45,8,0.16)] max-[640px]:rounded-[22px] max-[640px]:px-[22px]"
            onClick={(e) => e.stopPropagation()}
          >
            <ArtifactRenderer artifact={artifact} />
          </div>
        </div>
      </div>
    );
  }

  const positionClass = positioning === "absolute" ? "absolute" : "fixed";

  return (
    <div
      className={`${positionClass} inset-0 z-[80] flex items-center justify-center bg-black/40 p-[24px] backdrop-blur-[4px]`}
      onClick={closeArtifact}
    >
      <style>{ANIM_STYLES}</style>
      <div
        className="artifact-card relative max-h-[90vh] w-full max-w-[720px] overflow-hidden rounded-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
        style={{
          backgroundImage: "linear-gradient(#FFFFFFDD, #FFFFFFDD), url('/insights.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          className="absolute right-[20px] top-[20px] z-[1] flex h-[32px] w-[32px] items-center justify-center rounded-full border border-black/10 bg-white/80 text-black/60 transition hover:bg-white hover:text-black"
          onClick={closeArtifact}
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        {/* Scrollable content */}
        <div className="max-h-[90vh] overflow-y-auto px-[32px] py-[32px]">
          <ArtifactRenderer artifact={artifact} />
        </div>
      </div>
    </div>
  );
}
