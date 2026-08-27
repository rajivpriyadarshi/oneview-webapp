"use client";

import { useEffect } from "react";

interface InteractionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  body: string;
  showGradientBackground?: boolean;
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function InteractionDetailModal({
  isOpen,
  onClose,
  subject,
  body,
  showGradientBackground = false,
}: InteractionDetailModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[600] overflow-y-auto p-[24px] backdrop-blur-[2px]"
      style={
        showGradientBackground
          ? {
              background: "linear-gradient(125deg, rgba(255,244,216,0.80) 0%, rgba(255,203,48,0.78) 30%, rgba(246,155,205,0.80) 64%, rgba(224,211,247,0.80) 100%)",
            }
          : {
              background: "rgba(0, 0, 0, 0.4)",
            }
      }
      onClick={onClose}
    >
      <button
        type="button"
        className="fixed right-[24px] top-[20px] z-[2] flex h-[40px] w-[40px] items-center justify-center rounded-full border border-black/10 bg-white text-black/80 shadow-[0_6px_22px_rgba(0,0,0,0.10)] transition hover:bg-white/90 hover:text-black"
        onClick={onClose}
        aria-label="Close"
      >
        <CloseIcon />
      </button>

      <div className="mx-auto flex min-h-full w-full max-w-[760px] items-center py-[72px] max-[720px]:py-[56px]">
        <div
          className="w-full rounded-[28px] bg-white px-[32px] py-[28px] shadow-[0_24px_90px_rgba(79,45,8,0.16)] max-[640px]:rounded-[22px] max-[640px]:px-[24px]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="m-0 mb-[24px] font-satoshi text-[24px] font-bold leading-[1.3] text-[#111827]">
            {subject}
          </h2>
          <div className="font-satoshi text-[15px] font-normal leading-[1.65] text-[#393939] whitespace-pre-wrap">
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
