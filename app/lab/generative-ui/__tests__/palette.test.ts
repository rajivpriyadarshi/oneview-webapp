/**
 * The guard on the one deliberate duplication in this prototype.
 *
 * The palette is written twice: as CSS variables in ../ui/theme.css, which is the only thing
 * the shadcn primitives can read, and as `PALETTE` in ../ds.ts, which is the only form a
 * tint can be built from (`${PALETTE.ai}14` is a colour; `var(--gu-ai)14` is not). That is a
 * real constraint rather than an oversight, and the cost of it is that the two can drift —
 * silently, and in the worst way: half the page moves to the new colour and half does not.
 *
 * So this test parses the stylesheet as text and holds the two against each other. It is
 * deliberately dumb — a regex for `--gu-name: value`, then a comparison against a table of
 * which variable means which role. No CSS parser, because the failure it is guarding against
 * is someone editing a hex in one file and not the other, and that shows up in the crudest
 * possible check.
 *
 * ../ds.ts's header names this file. If the split is ever removed, delete it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE, TONE, SEVERITY, CHART } from "../ds";

const css = readFileSync(join(__dirname, "..", "ui", "theme.css"), "utf8");

/** Every `--gu-*: value` in the file, last declaration winning, as `.gu-theme` would. */
const declared = (() => {
  const out = new Map<string, string>();
  for (const match of css.matchAll(/--(gu-[a-z-]+)\s*:\s*([^;]+);/g)) {
    out.set(match[1], match[2].trim().toLowerCase());
  }
  return out;
})();

/**
 * Which CSS variable carries which `PALETTE` role.
 *
 * Written out rather than derived, because the mapping is not mechanical: shadcn's token
 * names and our role names are two different vocabularies and the join between them is a
 * decision. `--gu-card-foreground` being the same ink as `--gu-foreground` is a choice, not
 * a coincidence, and stating it here is what makes a change to it visible.
 */
const MAPPING: Record<string, string> = {
  "gu-background": PALETTE.shell,
  "gu-foreground": PALETTE.ink,
  "gu-card": PALETTE.card,
  "gu-card-foreground": PALETTE.ink,
  "gu-popover": PALETTE.card,
  "gu-popover-foreground": PALETTE.ink,
  "gu-primary": PALETTE.fill,
  "gu-primary-foreground": PALETTE.onFill,
  "gu-secondary": PALETTE.subtle,
  "gu-secondary-foreground": PALETTE.onSubtle,
  "gu-muted": PALETTE.surface,
  "gu-muted-foreground": PALETTE.muted,
  "gu-destructive": PALETTE.bad,
  "gu-destructive-foreground": PALETTE.onFill,
  "gu-border": PALETTE.border,
  "gu-input": PALETTE.line,
  "gu-ai": PALETTE.ai,
  "gu-ai-surface": PALETTE.aiSurface,
  "gu-ai-border": PALETTE.aiBorder,
  "gu-ok": PALETTE.ok,
  "gu-ok-surface": PALETTE.okSurface,
  "gu-ok-border": PALETTE.okBorder,
  "gu-meta": PALETTE.meta,
  "gu-body": PALETTE.body,
  "gu-radius": PALETTE.radius,
};

describe("the palette is written twice and says the same thing", () => {
  it("declares every variable the mapping names", () => {
    const missing = Object.keys(MAPPING).filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });

  for (const [name, expected] of Object.entries(MAPPING)) {
    it(`--${name} is ${expected}`, () => {
      expect(declared.get(name)).toBe(expected.toLowerCase());
    });
  }

  /*
   * Nothing outside the mapping, which is the half of the check that catches the real
   * failure. A missing variable breaks a component visibly; a *new* variable nobody
   * mirrored into `PALETTE` is how a second source of truth starts.
   */
  it("declares nothing the mapping does not account for", () => {
    const accounted = new Set(Object.keys(MAPPING));
    /* `--gu-accent` and `--gu-ring` are shadcn's, not the document's: a hover wash and a
       focus ring, used by primitives and by no hand-built leaf, so `PALETTE` has no role
       for them and inventing one would be worse than naming them here. */
    const shadcnOnly = ["gu-accent", "gu-accent-foreground", "gu-ring"];
    const orphans = [...declared.keys()].filter(
      (name) => !accounted.has(name) && !shadcnOnly.includes(name),
    );
    expect(orphans).toEqual([]);
  });
});

/**
 * And the roles in ds.ts resolve to the palette rather than to a hex someone typed.
 *
 * The Tailwind class strings cannot be `var(--gu-*)` — the utilities are arbitrary values
 * and Tailwind needs a literal — so `TYPE`, `TONE` and `SURFACE` inline the hexes too. Same
 * drift risk, one file closer.
 */
describe("the roles in ds.ts are built from the palette", () => {
  it("tones carry the palette's inks", () => {
    expect(TONE.positive.hex).toBe(PALETTE.ok);
    expect(TONE.negative.hex).toBe(PALETTE.bad);
    expect(TONE.neutral.hex).toBe(PALETTE.muted);
    expect(TONE.positive.text).toContain(PALETTE.ok);
    expect(TONE.neutral.bg).toContain(PALETTE.subtle);
  });

  it("severities carry the palette's inks", () => {
    expect(SEVERITY.info.hex).toBe(PALETTE.note);
    expect(SEVERITY.warn.hex).toBe(PALETTE.ai);
    expect(SEVERITY.critical.hex).toBe(PALETTE.bad);
  });

  it("charts draw the subject in the positive ink and its context in the divider grey", () => {
    expect(CHART.primary).toBe(PALETTE.ok);
    expect(CHART.context).toBe(PALETTE.border);
    expect(CHART.reference).toBe(PALETTE.subtle);
  });
});
