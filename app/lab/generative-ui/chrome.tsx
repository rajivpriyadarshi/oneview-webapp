/**
 * The shell primitives every component in this prototype sits inside.
 *
 * Rewritten from the card-per-component version. That one gave each leaf a bordered
 * translucent panel, which meant a nine-finding report rendered as nine boxes of equal
 * visual weight — no hierarchy, no rhythm, and no way for the reader to tell the
 * conclusion from a footnote. The document model here inverts the default: a block is
 * a title plus content sitting flat on the page, and a box is reserved for the one
 * thing a box is honest about, a figure meant to be scanned against its peers.
 *
 * Every measurement comes from ./ds.ts. Nothing in this file chooses a pixel size, and
 * that is the point — see that file's header for why.
 *
 * `Card` survives as a named export because ./leaves.tsx still has a few callers, but
 * it is now the tinted inset from `SURFACE`, not a panel. New code should use `Block`.
 */

import React from "react";
import { RHYTHM, SURFACE, TONE, TYPE, pill, toneOf } from "./ds";

/**
 * The heading the enclosing Section has already printed.
 *
 * A leaf is handed a label by the composer and a Section is handed a heading, and for a
 * section holding one component they are the same words — so the page showed the
 * question, then the same question again one line below it. Neither side can see the
 * other, and neither should: the label is a prop the validator checks and the heading
 * belongs to the container. So the container states what it printed and `Block` declines
 * to repeat it. Presentation only — nothing is dropped that is not already on screen,
 * one line up.
 */
const SectionHeading = React.createContext<string | undefined>(undefined);

export const InSection = ({ heading, children }: { heading?: string; children: React.ReactNode }) => (
  <SectionHeading.Provider value={heading}>{children}</SectionHeading.Provider>
);

/** Kept for the handful of `${CARD}` string interpolations still in ./leaves.tsx. */
export const CARD = SURFACE.inset;

/** Kept for the same reason. Quiet sentence-case label, not the old uppercase chip. */
export const LABEL = TYPE.label;

export const INK = "#171615";

/**
 * A titled region of the document.
 *
 * This is the workhorse and it deliberately draws no border. The title, the optional
 * caption and the space above it are the whole framing — which is what the reference
 * document does, and why its eight blocks read as one page rather than eight panels.
 */
export function Block({
  title,
  caption,
  children,
  aside,
  boxed = false,
}: {
  title?: string;
  caption?: string;
  children: React.ReactNode;
  /** Right-aligned furniture on the title line: a legend, a period switch. */
  aside?: React.ReactNode;
  /**
   * For content with its own geometry — a chart, a table, a schedule.
   *
   * The title goes *inside* the panel when this is set, because a title floating above a
   * bordered box belongs to the page while the box belongs to itself, and the reader has
   * to guess which. See `SURFACE.panel`.
   */
  boxed?: boolean;
}) {
  const printed = React.useContext(SectionHeading);
  const shown = title && printed && title.trim() === printed.trim() && !boxed ? undefined : title;
  return (
    <section className={boxed ? SURFACE.panel : RHYTHM.block}>
      {shown || caption || aside ? (
        <div className={`flex items-baseline justify-between gap-[16px] ${boxed ? "mb-[14px]" : ""}`}>
          <div className="min-w-0">
            {shown ? <h3 className={TYPE.sectionTitle}>{shown}</h3> : null}
            {caption ? <p className={`${TYPE.sectionCaption} mt-[2px]`}>{caption}</p> : null}
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A figure with its label above and its context below.
 *
 * Label / value / caption in that order, because the reader needs to know what they
 * are looking at before they read it. The delta rides beside the value rather than
 * under it so the pair is scanned as one thing.
 */
export function Figure({
  label,
  value,
  caption,
  delta,
  size = "sm",
  spark,
}: {
  label?: string;
  value: string;
  caption?: string;
  delta?: { label: string; value?: number; sentiment?: "positive" | "negative" | "neutral" };
  size?: "sm" | "lg";
  /** A figure's own history, for a figure standing alone. Never in a row of peers. */
  spark?: React.ReactNode;
}) {
  return (
    <div>
      {label ? <div className={TYPE.label}>{label}</div> : null}
      <div className="mt-[6px] flex items-center gap-[8px]">
        <span className={size === "lg" ? TYPE.figure : TYPE.figureSm}>{value}</span>
        {delta ? <DeltaChip delta={delta} /> : null}
      </div>
      {caption ? <div className={`${TYPE.caption} mt-[5px]`}>{caption}</div> : null}
      {spark ? <div className="mt-[12px]">{spark}</div> : null}
    </div>
  );
}

/**
 * The same figure, boxed, for a strip of peers.
 *
 * `h-full` so that tiles in one row are the same height whatever their contents. A row
 * of figures is read as a set, and a card that stops short of its neighbour reads as a
 * different kind of thing rather than as a shorter caption.
 */
export function Tile(props: React.ComponentProps<typeof Figure>) {
  return (
    <div className={`${SURFACE.tile} h-full`}>
      <Figure {...props} />
    </div>
  );
}

/**
 * Kept as `Card` for its existing callers, but no longer a panel.
 *
 * A tinted inset with no border radius drama, used where something genuinely needs
 * lifting off the page — a risk, a recommendation. Everywhere else, `Block`.
 */
export function Card({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${SURFACE.inset} ${className}`}>
      {label ? <div className={`${TYPE.label} mb-[10px]`}>{label}</div> : null}
      {children}
    </div>
  );
}

/**
 * A change, with its direction carried by colour and sign rather than an arrow.
 *
 * The tone comes from `sentiment` when the analysis stated one and from the sign
 * otherwise — see `toneOf`, which explains why the distinction matters.
 */
export function DeltaChip({
  delta,
}: {
  delta: { label: string; value?: number; sentiment?: "positive" | "negative" | "neutral" };
}) {
  const tone = toneOf(delta.value, delta.sentiment);
  /*
   * An arrow, where the direction is known and is not already written.
   *
   * Colour alone carries direction only for readers who see it, and a label the analysis
   * wrote as "+14%" already says which way it went — so the glyph is added exactly when
   * the tone is decided and the label is silent about it. It is a rendering of `sentiment`,
   * not a second opinion on it.
   */
  const arrow = tone === "neutral" || /^[+-]|↑|↓/.test(delta.label) ? "" : tone === "positive" ? "↑ " : "↓ ";
  return (
    <span className={pill(tone)}>
      {arrow}
      {delta.label}
    </span>
  );
}

/**
 * What a component shows when its binding resolved to nothing.
 *
 * Never a blank space and never a crash. The validator should have caught a missing
 * binding before render (`unknown_data_key`), so reaching this is a bug — but §14
 * says the page still has to stand up, and an area that quietly renders nothing is
 * the failure that is hardest to notice.
 */
export function Empty({ what }: { what: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-black/[0.12] px-[16px] py-[14px]">
      <div className={TYPE.label}>Not available</div>
      <div className={`${TYPE.caption} mt-[4px] text-black/55`}>{what}</div>
    </div>
  );
}

/* --------------------------------------------------------------- small parts */

export function Rule() {
  return <div className={`border-t ${SURFACE.hairline}`} />;
}

/**
 * Label–value pairs, as a definition list.
 *
 * Right-aligned values on a hairline grid rather than in a box, so a list of six
 * attributes reads as a table of contents and not as a sixth card.
 */
export function Rows({
  rows,
  columns = 1,
}: {
  rows: { label: string; value: string }[];
  columns?: 1 | 2;
}) {
  return (
    <dl className={`grid gap-x-[32px] ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {rows.map((row) => (
        <div
          key={row.label}
          className={`flex items-baseline justify-between gap-[16px] border-b ${SURFACE.hairline} py-[9px] last:border-b-0`}
        >
          <dt className={TYPE.label}>{row.label}</dt>
          <dd className={`${TYPE.cell} text-right tabular-nums`}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A severity or status word, as a pill. Text only — never a bare colour swatch. */
export function Tag({ label, tone = "neutral" }: { label: string; tone?: keyof typeof TONE }) {
  return <span className={pill(tone)}>{label}</span>;
}
