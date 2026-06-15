"use client";

import { FormEvent, useEffect, useState } from "react";

type PasswordPromptModalProps = {
  isOpen: boolean;
  isLoading: boolean;
  error?: string;
  onSubmit: (password: string) => void;
  onClose: () => void;
};

export function PasswordPromptModal({
  isOpen,
  isLoading,
  error,
  onSubmit,
  onClose,
}: PasswordPromptModalProps) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (error) {
      setPassword("");
    }
  }, [error]);

  if (!isOpen) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.trim()) {
      onSubmit(password.trim());
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-6" role="presentation" onClick={(e) => e.stopPropagation()}>
      <div
        className="w-full max-w-[440px] rounded-[20px] bg-white p-7 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-prompt-title"
      >
        <h2
          id="password-prompt-title"
          className="m-0 mb-2.5 font-satoshi text-[20px] font-extrabold leading-7 tracking-[-0.02em] text-[#050505]"
          style={{ fontFeatureSettings: "'ss03' on" }}
        >
          Password Required
        </h2>
        <p
          className="m-0 font-satoshi text-[15px] font-normal leading-[22px] tracking-[-0.01em] text-black/65"
          style={{ fontFeatureSettings: "'ss03' on" }}
        >
          This PDF is password-protected. Please enter the password to unlock it
          (e.g. your PAN number for Zerodha statements).
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="mt-5 w-full rounded-2xl border-0 bg-[#f7f7f7] px-[23px] py-[18px] font-satoshi text-base font-bold leading-6 text-[#262626] outline-none placeholder:font-medium placeholder:text-[#828282] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ fontFeatureSettings: "'ss03' on", boxSizing: "border-box" }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter document password"
            autoFocus
            disabled={isLoading}
          />
          {error && (
            <p
              className="mt-2 font-satoshi text-[13px] font-bold text-[#a40000]"
              style={{ fontFeatureSettings: "'ss03' on" }}
            >
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2.5">
            <button
              type="button"
              className="min-h-12 cursor-pointer rounded-full border-0 bg-[#ebebeb] px-5 font-satoshi text-[15px] font-bold text-[#1f1f1f] transition-colors hover:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontFeatureSettings: "'ss03' on" }}
              onClick={() => {
                setPassword("");
                onClose();
              }}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-12 cursor-pointer rounded-full border-0 bg-black px-5 font-satoshi text-[15px] font-bold text-white transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-[black/40] disabled:text-white"
              style={{ fontFeatureSettings: "'ss03' on" }}
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
