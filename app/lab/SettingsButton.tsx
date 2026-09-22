/**
 * The floating settings control, and the one thing behind it: the model key.
 *
 * It exists because the lab is deployed as a static site with no server and therefore no
 * environment to put a key in — see ../lab/apiKey.ts. Without a key every prototype still
 * runs, on its deterministic stand-in, and says on screen that it did; with one, the same
 * prototypes call the model. So this is an enhancement control, not a gate, and it is
 * written that way: nothing is blocked, nothing is modal on load, and the dialog can be
 * dismissed without a decision.
 *
 * Floating rather than in a header because the lab's pages do not share a header — each
 * prototype owns its own chrome — and a control that has to be added to three layouts in
 * three shapes is a control that will be missing from the fourth.
 */

"use client";

import React from "react";
import { Check, Eye, EyeOff, Settings, Trash2, X } from "lucide-react";
import { maskKey, providerOf, saveKey, useStoredKey } from "./apiKey";

/**
 * `tone` and `className` exist because the prototypes do not share a background.
 *
 * The chooser is a light page with an empty bottom-right corner; the Adaptive UI lab is
 * a two-pane workspace with its own dark floating control already parked there. A single
 * hard-coded position would have to be wrong on one of them, so the placement is the
 * caller's and only the behaviour is here.
 */
export function SettingsButton({
  tone = "light",
  className = "fixed right-[20px] bottom-[20px] z-40",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const stored = useStoredKey();

  const skin =
    tone === "dark"
      ? "border-white/10 bg-[#171615]/92 text-white/55 backdrop-blur-[10px] hover:border-white/25 hover:text-white"
      : "border-black/[0.08] bg-white text-black/55 hover:border-black/20 hover:text-black";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={stored ? "Settings — a model key is saved" : "Settings — no model key saved"}
        className={`${className} grid h-[40px] w-[40px] place-items-center rounded-full border shadow-[0_8px_28px_rgba(0,0,0,0.18)] transition-[transform,color,border-color] duration-200 hover:-translate-y-[1px] focus-visible:outline-none ${skin}`}
      >
        <Settings size={18} strokeWidth={1.75} />
        {/*
         * A dot for "a key is saved", and no dot for the other case.
         *
         * Deliberately not a red badge when the key is missing: no key is the normal,
         * working state of this lab, and a warning on the default state trains people to
         * ignore warnings. The presence of a key is the exception worth marking, because
         * it is the state where questions cost money.
         */}
        {stored ? (
          <span
            className={`absolute top-[6px] right-[6px] h-[7px] w-[7px] rounded-full bg-[#4ba861] ring-2 ${tone === "dark" ? "ring-[#171615]" : "ring-white"}`}
          />
        ) : null}
      </button>

      {open ? <KeyDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------- dialog */

function KeyDialog({ onClose }: { onClose: () => void }) {
  const stored = useStoredKey();
  const [draft, setDraft] = React.useState(stored?.key ?? "");
  const [reveal, setReveal] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const field = React.useRef<HTMLInputElement>(null);

  /* Escape closes, and focus starts in the field — a dialog you have to mouse into is a
     dialog that is slower than the env var it replaces. */
  React.useEffect(() => {
    field.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmed = draft.trim();
  /* The provider the key *would* resolve to, shown live, so the one decision this dialog
     makes on the user's behalf is visible before they commit to it rather than after. */
  const provider = trimmed ? providerOf(trimmed) : null;
  const changed = trimmed !== (stored?.key ?? "");

  const commit = () => {
    const result = saveKey(trimmed);
    if (!result.ok) {
      setNote({ tone: "bad", text: result.reason });
      return;
    }
    setNote({
      tone: "ok",
      text: result.stored ? `Saved. Questions will go to ${label(result.stored.provider)}.` : "Key removed.",
    });
  };

  const remove = () => {
    saveKey("");
    setDraft("");
    setNote({ tone: "ok", text: "Key removed. The prototypes will use their scripted stand-in." });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-[20px] font-satoshi">
      {/* A button rather than a div with an onClick: clicking the backdrop to dismiss is a
          mouse affordance, and Escape above is the keyboard one, but the element still has
          to be something a screen reader can describe. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/30 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Model key"
        className="relative w-full max-w-[520px] rounded-[18px] border border-black/[0.08] bg-white p-[24px] shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
      >
        <div className="flex items-start justify-between gap-[16px]">
          <div className="min-w-0">
            <h2 className="m-0 text-[19px] leading-[25px] font-bold tracking-[-0.4px] text-[#171615]">Model key</h2>
            <p className="mt-[4px] mb-0 text-[13px] leading-[19px] text-black/50">
              Paste an Anthropic or OpenAI key to run the prototypes against a real model.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-[4px] -mr-[4px] grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-black/40 transition-colors hover:bg-black/[0.05] hover:text-black focus-visible:outline-none"
          >
            <X size={17} strokeWidth={1.9} />
          </button>
        </div>

        <div className="mt-[18px]">
          <label htmlFor="lab-model-key" className="block text-[11px] font-semibold tracking-[0.1em] text-black/40 uppercase">
            API key
          </label>
          <div className="mt-[7px] flex items-center gap-[8px]">
            <div className="relative min-w-0 flex-1">
              <input
                id="lab-model-key"
                ref={field}
                type={reveal ? "text" : "password"}
                value={draft}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  setDraft(event.target.value);
                  setNote(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commit();
                }}
                placeholder="sk-ant-… or sk-…"
                className="w-full rounded-[10px] border border-black/[0.12] bg-white py-[10px] pr-[38px] pl-[12px] font-mono text-[13px] leading-[20px] text-[#171615] outline-none placeholder:font-satoshi placeholder:text-black/30 focus:border-black/35"
              />
              <button
                type="button"
                onClick={() => setReveal((was) => !was)}
                aria-label={reveal ? "Hide the key" : "Show the key"}
                className="absolute top-1/2 right-[8px] grid h-[26px] w-[26px] -translate-y-1/2 place-items-center rounded-[7px] text-black/35 transition-colors hover:bg-black/[0.05] hover:text-black/70 focus-visible:outline-none"
              >
                {reveal ? <EyeOff size={15} strokeWidth={1.8} /> : <Eye size={15} strokeWidth={1.8} />}
              </button>
            </div>

            <button
              type="button"
              onClick={commit}
              disabled={!changed}
              className="shrink-0 rounded-[10px] bg-[#171615] px-[16px] py-[10px] text-[13px] leading-[20px] font-semibold text-white transition-opacity disabled:opacity-30"
            >
              Save
            </button>
          </div>

          <div className="mt-[9px] flex min-h-[20px] items-center gap-[10px] text-[12px] leading-[18px]">
            {provider ? (
              <span className="rounded-full bg-black/[0.05] px-[8px] py-[2px] font-medium text-black/60">
                {label(provider)}
              </span>
            ) : null}
            {note ? (
              <span className={`inline-flex items-center gap-[5px] ${note.tone === "ok" ? "text-[#2f6f3e]" : "text-[#9a3412]"}`}>
                {note.tone === "ok" ? <Check size={13} strokeWidth={2.2} /> : null}
                {note.text}
              </span>
            ) : stored && !changed ? (
              <span className="font-mono text-black/40">{maskKey(stored.key)}</span>
            ) : null}
          </div>
        </div>

        {/*
         * What it does with the key, stated where the key is entered.
         *
         * Not a legal notice and not hidden behind a disclosure: the trade this dialog
         * makes — a key in the browser, sent straight to the provider — is the kind of
         * thing a person should be able to decline, and they cannot decline what they are
         * told afterwards.
         */}
        <p className="mt-[16px] mb-0 border-t border-black/[0.07] pt-[14px] text-[12px] leading-[18px] text-black/45">
          Saved in this browser only, and sent from this page straight to the provider — it never
          reaches a server of ours, and it is not shared with anyone else who opens the site. Anything
          running on this origin can read it, so use a key you can revoke. Running locally with a key
          in the environment, that one is used instead and this is ignored.
        </p>

        {stored ? (
          <button
            type="button"
            onClick={remove}
            className="mt-[12px] inline-flex items-center gap-[6px] text-[12px] leading-[18px] font-semibold text-black/45 transition-colors hover:text-[#9a3412] focus-visible:outline-none"
          >
            <Trash2 size={13} strokeWidth={1.9} />
            Remove the saved key
          </button>
        ) : null}
      </div>
    </div>
  );
}

const label = (provider: "anthropic" | "openai"): string => (provider === "anthropic" ? "Anthropic" : "OpenAI");
