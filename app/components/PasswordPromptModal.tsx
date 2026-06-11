"use client";

import { FormEvent, useState } from "react";

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

  if (!isOpen) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.trim()) {
      onSubmit(password.trim());
    }
  }

  return (
    <div className="docs-confirm-overlay" role="presentation">
      <div
        className="docs-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-prompt-title"
      >
        <h2 id="password-prompt-title">Password Required</h2>
        <p>
          This PDF is password-protected. Please enter the password to unlock it
          (e.g. your PAN number for Zerodha statements).
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="password-prompt-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter document password"
            autoFocus
            disabled={isLoading}
          />
          {error && <p className="statement-error">{error}</p>}
          <div className="docs-confirm-actions">
            <button
              type="button"
              className="docs-confirm-secondary"
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
              className="docs-confirm-danger"
              style={{ backgroundColor: "#2F9FF8", borderColor: "#2F9FF8" }}
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
