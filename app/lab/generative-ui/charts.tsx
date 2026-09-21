"use client";

/**
 * The charts, rebuilt to be read rather than glanced at.
 *
 * These replace the delegations to `../dynamic-ui/renderers.tsx`. That file's charts are
 * dashboard widgets — static SVG in a bordered panel, a palette colour per category, a
 * value printed above every bar — and three things about that are wrong for a document:
 *
 *   - **Nothing could be interrogated.** A report that states "43.5% in the United
 *     Kingdom" and then draws a bar you cannot point at has drawn a decoration. Every
 *     chart here answers a hover with the exact figure, its label and what it is a share
 *     of, so the picture is a way into the number instead of a substitute for it.
 *   - **Colour per category is a claim nobody made.** Five hues tell the reader the five
 *     asset classes differ in kind. They do not: one of them is the point and the rest
 *     are there to show it is large. So one series takes the ink and the others go grey,
 *     and which one is chosen is derived from the data — never passed in.
 *   - **Categories with names do not belong on an x-axis.** "Private investments" at
 *     11px, rotated or truncated under a vertical bar, is a label the reader has to
 *     decode. Horizontal bars put the name where names go, in a left column, reading
 *     left-to-right like the rest of the page.
 *
 * All geometry is proportional — a `0 0 100 H` viewBox stretched to the container with
 * `vectorEffect="non-scaling-stroke"` — so there is no measuring, no ResizeObserver and
 * no layout effect. Hover position comes from the pointer's fraction of the element's own
 * width, which is the same coordinate space, so the crosshair lands on the point without
 * either side knowing how wide the page is.
 *
 * Dots and tooltips are HTML positioned in percentages over the SVG rather than SVG
 * elements, because a circle inside a non-uniformly scaled viewBox is an ellipse.
 */

import React from "react";
import { CHART, TYPE, pill, toneOf } from "./ds";
import type { Delta, Series } from "./findings";

/* ------------------------------------------------------------------ helpers */

/** One decimal only where it says something: "8%", not "8.0%". */
export const share = (value: number): string => `${Number((value * 100).toFixed(1))}%`;

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/**
 * Which point the pointer is nearest, as an index.
 *
 * Read from the event's fraction of the target's own box, which is the one measurement
 * available without a ref and the only one that stays correct when the pane is resized
 * mid-hover.
 */
const indexAt = (event: React.PointerEvent<HTMLElement>, count: number): number => {
  const box = event.currentTarget.getBoundingClientRect();
  if (box.width === 0 || count <= 1) return 0;
  const fraction = clamp((event.clientX - box.left) / box.width, 0, 1);
  return Math.round(fraction * (count - 1));
};

/**
 * The hover readout: a small dark card, because it has to be legible over a chart.
 *
 * Positioned in percentages and translated back from its own left edge, so it tracks the
 * point without escaping the chart at either end.
 */
function Readout({
  x,
  title,
  lines,
}: {
  /** 0–100, the horizontal position within the plot. */
  x: number;
  title: string;
  lines: { name?: string; value: string; hex?: string }[];
}) {
  return (
    <div
      className="pointer-events-none absolute bottom-full z-[2] mb-[10px]"
      style={{ left: `${x}%`, transform: `translateX(${x > 70 ? "-100%" : x < 30 ? "0%" : "-50%"})` }}
    >
      <div className="min-w-[104px] rounded-[8px] bg-[#171615] px-[10px] py-[8px] shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
        <div className="font-satoshi text-[11px] leading-[1.3] text-white/55">{title}</div>
        {lines.map((line, index) => (
          <div key={index} className="mt-[4px] flex items-center gap-[7px]">
            {line.hex ? (
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: line.hex }} />
            ) : null}
            {line.name ? (
              <span className="font-satoshi text-[11px] leading-[1.3] text-white/60">{line.name}</span>
            ) : null}
            <span className="ml-auto font-satoshi text-[13px] font-medium leading-[1.3] tabular-nums text-white">
              {line.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A legend entry. Text and a dot, never a bare swatch. */
const Key = ({ name, hex }: { name: string; hex: string }) => (
  <span className={`${TYPE.caption} inline-flex items-center gap-[6px]`}>
    <span className="h-[8px] w-[8px] rounded-full" style={{ background: hex }} />
    {name}
  </span>
);

/* -------------------------------------------------------------------- lines */

const PLOT = 100;

type LineInput = {
  series: Series[];
  /** How a value reads. The analysis's own formatting where it has any. */
  format: (value: number) => string;
  height?: number;
  /** A series is the subject; the rest are context. Index into `series`. */
  subject?: number;
};

/**
 * One or several series over the same ticks, on one scale.
 *
 * Shared min/max is not a detail: separately scaled lines drawn side by side tell the
 * reader they can be compared when they cannot. A single series also gets a fill under
 * it, which several cannot have — overlapping washes stop being readable at two.
 *
 * The scale is padded by a tenth of the range and never anchored at zero. A portfolio
 * that moved from 108.2 to 113.3 is a 5% move, and a zero-based axis draws it as a flat
 * line; the tick labels say what the band is, so the reader is not misled about it.
 */
export function LineFigure({ series, format, height = 168, subject = 0 }: LineInput) {
  const [active, setActive] = React.useState<number | null>(null);

  const drawable = series.filter((entry) => entry.points.length >= 2);
  if (drawable.length === 0) return null;

  const count = Math.max(...drawable.map((entry) => entry.points.length));
  const values = drawable.flatMap((entry) => entry.points.map((point) => point.value));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = (high - low || Math.abs(high) || 1) * 0.12;
  const floor = low - pad;
  const ceiling = high + pad;

  const x = (index: number): number => (count === 1 ? PLOT / 2 : (index / (count - 1)) * PLOT);
  const y = (value: number): number => height - ((value - floor) / (ceiling - floor)) * height;

  const ink = (index: number): string => (index === subject || drawable.length === 1 ? CHART.primary : CHART.context);

  const ticks = drawable[0].points;
  const shown = active !== null ? Math.min(active, count - 1) : null;

  return (
    <div>
      <div
        className="relative cursor-crosshair select-none"
        style={{ height }}
        onPointerMove={(event) => setActive(indexAt(event, count))}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${PLOT} ${height}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* Three quiet rules. Enough to read a level against, not a grid. */}
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line
              key={fraction}
              x1={0}
              x2={PLOT}
              y1={height * fraction}
              y2={height * fraction}
              stroke="#171615"
              strokeOpacity={0.055}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {drawable.length === 1 ? (
            <>
              <defs>
                <linearGradient id="gu-line-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path
                d={`M0,${height} ${drawable[0].points
                  .map((point, index) => `L${x(index)},${y(point.value)}`)
                  .join(" ")} L${PLOT},${height} Z`}
                fill="url(#gu-line-fill)"
              />
            </>
          ) : null}
          {drawable.map((entry, index) => (
            <path
              key={entry.name}
              d={entry.points.map((point, at) => `${at === 0 ? "M" : "L"}${x(at)},${y(point.value)}`).join(" ")}
              fill="none"
              stroke={ink(index)}
              strokeWidth={index === subject ? 2 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {shown !== null ? (
            <line
              x1={x(shown)}
              x2={x(shown)}
              y1={0}
              y2={height}
              stroke="#171615"
              strokeOpacity={0.22}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        {/* The dots, in HTML — see the file header on why not SVG circles. */}
        {drawable.map((entry, index) => {
          const at = shown ?? entry.points.length - 1;
          const point = entry.points[Math.min(at, entry.points.length - 1)];
          if (!point) return null;
          return (
            <span
              key={entry.name}
              className="pointer-events-none absolute h-[9px] w-[9px] rounded-full border-2 border-white transition-opacity"
              style={{
                left: `${x(Math.min(at, entry.points.length - 1))}%`,
                top: y(point.value),
                marginLeft: -4.5,
                marginTop: -4.5,
                background: ink(index),
                opacity: shown === null && index !== subject ? 0 : 1,
              }}
            />
          );
        })}

        {shown !== null ? (
          <Readout
            x={x(shown)}
            title={ticks[Math.min(shown, ticks.length - 1)]?.label ?? ""}
            lines={drawable.map((entry, index) => ({
              name: drawable.length > 1 ? entry.name : undefined,
              hex: drawable.length > 1 ? ink(index) : undefined,
              value: format(entry.points[Math.min(shown, entry.points.length - 1)]?.value ?? 0),
            }))}
          />
        ) : null}
      </div>

      <div className="mt-[10px] flex items-baseline justify-between">
        {[0, Math.floor((ticks.length - 1) / 2), ticks.length - 1]
          .filter((index, at, all) => all.indexOf(index) === at)
          .map((index) => (
            <span key={index} className={TYPE.caption}>
              {ticks[index]?.label}
            </span>
          ))}
      </div>

      {drawable.length > 1 ? (
        <div className="mt-[10px] flex flex-wrap items-center gap-[14px]">
          {drawable.map((entry, index) => (
            <Key key={entry.name} name={entry.name} hex={ink(index)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A figure's own history, at the size of a line of text.
 *
 * No axis, no hover, no labels — a spark is a shape, and anything more beside a figure
 * competes with the figure. The value is already printed next to it.
 */
export function SparkFigure({ series, height = 34 }: { series: Series; height?: number }) {
  if (series.points.length < 2) return null;
  const values = series.points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;

  return (
    <svg
      className="h-full w-full"
      style={{ height }}
      viewBox={`0 0 ${PLOT} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={series.points
          .map((point, index) => {
            const x = series.points.length === 1 ? PLOT / 2 : (index / (series.points.length - 1)) * PLOT;
            return `${index === 0 ? "M" : "L"}${x},${height - ((point.value - low) / span) * (height - 4) - 2}`;
          })
          .join(" ")}
        fill="none"
        stroke={CHART.primary}
        strokeWidth={1.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* --------------------------------------------------------------------- bars */

type Part = { label: string; value: number; display?: string; delta?: Delta };

/**
 * Named quantities as horizontal bars, which is a table the reader can also see.
 *
 * Name, bar, figure — three columns, one row per part, hairlines between them. That
 * arrangement does what a vertical bar chart of the same data cannot: it keeps full
 * category names, it holds an arbitrary number of rows without the bars getting thin, and
 * the figures line up in a column so they can be compared as numbers as well as lengths.
 *
 * The subject is the largest named part, derived here. Residual buckets are excluded from
 * the running — "Other" is not a holding, it is everything the analysis chose not to
 * break out, and giving it the ink says the report is about the part it declined to name.
 */
export function BarsFigure({
  parts,
  format,
  total,
}: {
  parts: Part[];
  format: (value: number) => string;
  /** What the bars are a share of, said in words in the hover readout. */
  total?: string;
}) {
  const [active, setActive] = React.useState<string | null>(null);
  if (parts.length === 0) return null;

  const peak = Math.max(...parts.map((part) => Math.abs(part.value)), Number.MIN_VALUE);
  const named = parts.filter((part) => !/^(others?|misc|remaining|unclassified)\b/i.test(part.label));
  const ranked = named.length > 0 ? named : parts;
  const subject = ranked.reduce((best, part) => (Math.abs(part.value) > Math.abs(best.value) ? part : best), ranked[0]);

  return (
    <div>
      {parts.map((part) => {
        const on = part.label === subject.label;
        const lit = active === part.label;
        return (
          <div
            key={part.label}
            className="group grid grid-cols-[minmax(84px,150px)_minmax(0,1fr)_auto] items-center gap-[14px] border-b border-black/[0.06] py-[9px] last:border-b-0"
            onPointerEnter={() => setActive(part.label)}
            onPointerLeave={() => setActive(null)}
          >
            <span
              className={`${TYPE.cell} truncate transition-colors ${lit ? "" : "text-black/70"}`}
              title={part.label}
            >
              {part.label}
            </span>
            <span className="relative block h-[10px] overflow-hidden rounded-[3px] bg-black/[0.045]">
              <span
                className="absolute inset-y-0 left-0 rounded-[3px] transition-[width,opacity] duration-300"
                style={{
                  width: `${Math.max(1.5, (Math.abs(part.value) / peak) * 100)}%`,
                  background: on ? CHART.primary : CHART.context,
                  opacity: lit || active === null ? 1 : 0.55,
                }}
              />
            </span>
            <span className="flex items-center justify-end gap-[8px]">
              {part.delta ? <span className={pill(toneOf(part.delta.value, part.delta.sentiment))}>{part.delta.label}</span> : null}
              <span
                className={`${TYPE.cell} w-[72px] text-right tabular-nums ${on || lit ? "font-medium" : "text-black/70"}`}
              >
                {part.display ?? format(part.value)}
              </span>
            </span>
          </div>
        );
      })}
      {total ? <div className={`${TYPE.caption} mt-[10px]`}>{total}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------- donut */

/**
 * Parts of a whole, with the whole in the middle.
 *
 * The centre is the readout: hovering a segment puts that part's name and share where the
 * eye already is, rather than in a tooltip that covers the ring. With nothing hovered it
 * names the largest part, so the chart states its own conclusion at rest.
 *
 * Shares are normalised rather than trusted to sum to 1 — the schema says they need not,
 * because of rounding and residual buckets, and a ring drawn from unnormalised shares
 * either overlaps itself or leaves a gap that looks like missing data.
 */
export function DonutFigure({ parts, format }: { parts: Part[]; format: (value: number) => string }) {
  const [active, setActive] = React.useState<string | null>(null);
  if (parts.length === 0) return null;

  const sum = parts.reduce((running, part) => running + Math.abs(part.value), 0) || 1;
  const largest = parts.reduce((best, part) => (Math.abs(part.value) > Math.abs(best.value) ? part : best), parts[0]);
  const shown = parts.find((part) => part.label === active) ?? largest;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let travelled = 0;

  /* One ink at descending alpha, ordered largest-first, rather than a hue per part: the
     ring shows relative size, and a palette would imply the parts differ in kind. */
  const ordered = [...parts].sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
  const inkOf = (index: number): string =>
    index === 0 ? CHART.primary : `rgba(44, 95, 75, ${(0.62 - Math.min(index, 5) * 0.09).toFixed(2)})`;

  return (
    <div className="flex flex-wrap items-center gap-[28px]">
      <div className="relative shrink-0" style={{ width: 148, height: 148 }}>
        <svg viewBox="0 0 148 148" className="h-full w-full -rotate-90">
          {ordered.map((part, index) => {
            const fraction = Math.abs(part.value) / sum;
            const dash = fraction * circumference;
            const offset = travelled;
            travelled += dash;
            const lit = active === null || active === part.label;
            return (
              <circle
                key={part.label}
                cx={74}
                cy={74}
                r={radius}
                fill="none"
                stroke={inkOf(index)}
                strokeWidth={active === part.label ? 22 : 18}
                strokeOpacity={lit ? 1 : 0.35}
                strokeDasharray={`${Math.max(dash - 1.5, 0.5)} ${circumference}`}
                strokeDashoffset={-offset}
                className="cursor-pointer transition-[stroke-width,stroke-opacity] duration-200"
                onPointerEnter={() => setActive(part.label)}
                onPointerLeave={() => setActive(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[22px] text-center">
          <span className="font-satoshi text-[19px] font-medium leading-[1.1] tabular-nums text-[#171615]">
            {shown.display ?? format(shown.value)}
          </span>
          <span className={`${TYPE.caption} mt-[3px] line-clamp-2 leading-[1.3]`}>{shown.label}</span>
        </div>
      </div>

      <ul className="min-w-[180px] flex-1">
        {ordered.map((part, index) => (
          <li
            key={part.label}
            className={`flex items-baseline gap-[10px] border-b border-black/[0.06] py-[7px] last:border-b-0 ${
              active === part.label ? "" : "opacity-80"
            }`}
            onPointerEnter={() => setActive(part.label)}
            onPointerLeave={() => setActive(null)}
          >
            <span
              className="mt-[6px] h-[8px] w-[8px] shrink-0 rounded-full"
              style={{ background: inkOf(index) }}
            />
            <span className={`${TYPE.cell} min-w-0 flex-1 truncate text-black/75`}>{part.label}</span>
            <span className={`${TYPE.cell} shrink-0 tabular-nums`}>{part.display ?? format(part.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------- wrappers */

/**
 * The legend a bar chart gets, said in the analysis's terms.
 *
 * Kept out of `BarsFigure` because a chart whose rows are all one thing does not need a
 * key at all, and only the caller knows whether the emphasis is meaningful here.
 */
export const barsLegend = (subject: string, context: string): React.ReactNode => (
  <div className="flex items-center gap-[14px]">
    <Key name={subject} hex={CHART.primary} />
    <Key name={context} hex={CHART.context} />
  </div>
);
