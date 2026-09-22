/**
 * The model key, kept in the browser.
 *
 * The lab is deployed as a static site — GitHub Pages, no server, no environment
 * variables — so there is nowhere to put a key except the machine looking at it. This
 * module is that place, and it is deliberately the only one: a component that reads
 * `localStorage` directly is a second copy of the storage key and of the rule for
 * telling one provider from another.
 *
 * What this is not: secure. A key in `localStorage` is readable by anything running on
 * the origin and is sent from the browser straight to the provider, so it is visible in
 * the network tab of whoever is holding the laptop. That is an acceptable trade for a
 * prototype somebody drives with their own key, and unacceptable for anything else —
 * which is why `../api/lab/generative-ui/route.ts` still exists and still reads the
 * server's environment. Running behind a server, the server's key wins; there is no key
 * here at all and nobody is asked for one.
 *
 * Every prototype in the lab degrades rather than breaks without a key: the pipeline
 * falls back to its deterministic stand-in and says on screen that it did. So "no key"
 * is a normal state this module returns cleanly, not an error it throws.
 */

"use client";

import React from "react";

export type Provider = "anthropic" | "openai";

export type StoredKey = {
  provider: Provider;
  key: string;
};

/** Namespaced, because the origin is shared with whatever else is deployed under it. */
const STORAGE_KEY = "oneview.lab.model-key";

/**
 * Which provider a key belongs to, from its own prefix.
 *
 * Both vendors prefix their keys distinctly and have done for years, so this is reading
 * a label rather than guessing: `sk-ant-…` is Anthropic and everything else is treated
 * as OpenAI. Getting it wrong costs one rejected request with a legible message, which
 * is a better failure than a provider dropdown nobody reads.
 */
export const providerOf = (key: string): Provider => (key.trim().startsWith("sk-ant-") ? "anthropic" : "openai");

/** A key reduced to something safe to print: the prefix, the last four, nothing between. */
export const maskKey = (key: string): string => {
  const trimmed = key.trim();
  if (trimmed.length <= 12) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 7)}…${trimmed.slice(-4)}`;
};

/* ------------------------------------------------------------------ the store */

/*
 * Subscribers, so the modal and the run path never disagree.
 *
 * `localStorage` fires `storage` events across tabs but not within the tab that wrote,
 * so a set has to notify locally as well. Both are wired below and both go through the
 * same listener set, which is what lets `useStoredKey` be a `useSyncExternalStore` and
 * therefore correct under concurrent rendering rather than merely usually right.
 */
const listeners = new Set<() => void>();

const announce = (): void => {
  for (const listener of listeners) listener();
};

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

/**
 * The key, or null.
 *
 * Returns null on the server and null in a browser with storage denied (Safari in
 * private mode throws on access, not on write), because a prototype that cannot read a
 * key behaves exactly like one that was never given a key.
 */
export function readKey(): StoredKey | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  const key = raw?.trim();
  if (!key) return null;
  return { provider: providerOf(key), key };
}

/**
 * Save, or clear when handed nothing.
 *
 * Returns what was stored so a caller can show the provider it resolved to without
 * re-deriving it. A write that throws is reported as a failure rather than swallowed:
 * the one thing worse than not saving the key is a dialog that says it did.
 */
export function saveKey(raw: string): { ok: true; stored: StoredKey | null } | { ok: false; reason: string } {
  const key = raw.trim();
  if (typeof window === "undefined") return { ok: false, reason: "no browser storage here" };
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    return { ok: false, reason: "this browser would not let the page store anything" };
  }
  announce();
  return { ok: true, stored: key ? { provider: providerOf(key), key } : null };
}

export function clearKey(): void {
  saveKey("");
}

/* ------------------------------------------------------------------- the hook */

const snapshot = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * The stored key, as React state.
 *
 * The raw string is the snapshot rather than the parsed object, because
 * `useSyncExternalStore` compares snapshots by identity and a fresh object every call
 * is an infinite re-render. Parsing happens after.
 */
export function useStoredKey(): StoredKey | null {
  const raw = React.useSyncExternalStore(subscribe, snapshot, () => null);
  return React.useMemo(() => {
    const key = raw?.trim();
    return key ? { provider: providerOf(key), key } : null;
  }, [raw]);
}
