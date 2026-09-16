"use client";

/**
 * Layer 5 — the renderers. DESIGN.md §8.
 *
 * Dumb by design: typed finding in, pixels out. No selection logic, no data
 * fetching. Charts are hand-rolled SVG rather than chart.js — for a prototype
 * that's less configuration and full control over the visual language, and it
 * keeps every renderer in one reviewable file.
 *
 * All colour comes from ./palette. No renderer picks its own hex, which is the
 * rule that stops a runtime-composed report from looking assembled by accident.
 *
 * Card shell copies PortfolioReviewContent's recipe so a generated report is
 * visually continuous with the one that already ships.
 */

import {
  ACCENT,
  CHART_TRIM,
  SENTIMENT,
  categoricalSet,
  sequential,
  withAlpha,
} from "./palette";
import type {
  ChecklistFinding,
  ComparisonFinding,
  CompositionFinding,
  Delta,
  Finding,
  FlagFinding,
  MetricFinding,
  NarrativeFinding,
  RecommendationFinding,
  RequirementFinding,
  Sentiment,
  Series,
  TransitionFinding,
  TrendFinding,
} from "./findings";
import type { RendererId } from "./select";

/* -------------------------------------------------------------------- shell */

const CARD =
  "rounded-[12px] border border-black/10 bg-white/65 p-[14px] h-full flex flex-col";

const LABEL =
  "font-satoshi text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40";

function Card({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${CARD} ${className}`}>
      {label ? <p className={`m-0 mb-[8px] ${LABEL}`}>{label}</p> : null}
      {children}
    </div>
  );
}

function DeltaChip({ delta }: { delta: Delta }) {
  const tone = SENTIMENT[delta.sentiment];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-[8px] py-[3px] font-satoshi text-[11px] font-semibold tracking-[-0.11px]"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      {delta.label}
    </span>
  );
}

/* -------------------------------------------------------------------- charts */

/** Normalised path builder shared by every line-ish chart. */
function linePath(series: Series, width: number, height: number, pad = 4) {
  const values = series.points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(series.points.length - 1, 1);
  const points = series.points.map((point, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (point.value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  return { d, points, width, height };
}

function LineSvg({
  series,
  color,
  height = 120,
  fill = true,
  showAxis = false,
}: {
  series: Series;
  color: string;
  height?: number;
  fill?: boolean;
  showAxis?: boolean;
}) {
  const W = 600;
  const { d, points } = linePath(series, W, height);
  const gradientId = `g-${series.name.replace(/\W/g, "")}`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={withAlpha(color, CHART_TRIM.areaFrom)} />
          <stop offset="100%" stopColor={withAlpha(color, CHART_TRIM.areaTo)} />
        </linearGradient>
      </defs>
      {showAxis ? (
        <>
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={0}
              x2={W}
              y1={height * t}
              y2={height * t}
              stroke={CHART_TRIM.grid}
              strokeWidth={1}
            />
          ))}
        </>
      ) : null}
      {fill ? (
        <path
          d={`${d} L${last[0]},${height} L${points[0][0]},${height} Z`}
          fill={`url(#${gradientId})`}
        />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function AxisLabels({ series }: { series: Series }) {
  const points = series.points;
  const ticks = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  return (
    <div className="mt-[6px] flex justify-between font-satoshi text-[10px] tracking-[-0.1px]" style={{ color: CHART_TRIM.label }}>
      {ticks.map((tick, i) => (
        <span key={`${tick.label}-${i}`}>{tick.label}</span>
      ))}
    </div>
  );
}

function Donut({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0) || 1;
  const colors = categoricalSet(parts.length);
  const R = 54;
  const STROKE = 22;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-[16px]">
      <svg width={140} height={140} viewBox="0 0 140 140" className="shrink-0" aria-hidden="true">
        <g transform="rotate(-90 70 70)">
          {parts.map((part, i) => {
            const fraction = part.value / total;
            const dash = fraction * C;
            const el = (
              <circle
                key={part.label}
                cx={70}
                cy={70}
                r={R}
                fill="none"
                stroke={colors[i]}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
      </svg>
      <ul className="m-0 flex min-w-0 list-none flex-col gap-[6px] p-0">
        {parts.map((part, i) => (
          <li key={part.label} className="flex items-center gap-[8px]">
            <span
              className="h-[10px] w-[10px] shrink-0 rounded-[3px]"
              style={{ backgroundColor: colors[i] }}
            />
            <span className="truncate font-satoshi text-[12px] tracking-[-0.12px] text-black/70">
              {part.label}
            </span>
            <span className="ml-auto shrink-0 font-satoshi text-[12px] font-semibold tabular-nums text-black">
              {Math.round((part.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ renderers */

function HeroMetric({ finding }: { finding: MetricFinding }) {
  return (
    <div className="rounded-[12px] border border-black/10 bg-white/65 p-[18px]">
      <p className={`m-0 ${LABEL}`}>{finding.label}</p>
      <div className="mt-[6px] flex flex-wrap items-end gap-[12px]">
        <span className="font-satoshi text-[34px] leading-[38px] font-bold tracking-[-1px] text-[#171615]">
          {finding.value}
        </span>
        {finding.delta ? <DeltaChip delta={finding.delta} /> : null}
      </div>
      {finding.series && finding.series.points.length >= 2 ? (
        <div className="mt-[10px]">
          <LineSvg series={finding.series} color={ACCENT} height={72} />
          <AxisLabels series={finding.series} />
        </div>
      ) : null}
    </div>
  );
}

function StatTile({ finding }: { finding: MetricFinding }) {
  return (
    <Card>
      <p className={`m-0 ${LABEL}`}>{finding.label}</p>
      <span className="mt-[4px] font-satoshi text-[22px] leading-[28px] font-bold tracking-[-0.5px] text-[#171615]">
        {finding.value}
      </span>
      {finding.delta ? (
        <div className="mt-[8px]">
          <DeltaChip delta={finding.delta} />
        </div>
      ) : null}
    </Card>
  );
}

function SparklineBlock({ finding }: { finding: TrendFinding }) {
  return (
    <Card label={finding.label}>
      <LineSvg series={finding.series} color={ACCENT} height={54} />
      <AxisLabels series={finding.series} />
    </Card>
  );
}

function LineChartBlock({ finding }: { finding: TrendFinding }) {
  return (
    <Card label={finding.label}>
      <LineSvg series={finding.series} color={ACCENT} height={140} showAxis />
      <AxisLabels series={finding.series} />
    </Card>
  );
}

function OverlaidLines({ finding }: { finding: ComparisonFinding }) {
  const colors = categoricalSet(finding.entities.length);
  const W = 600;
  const H = 160;

  // One shared scale across every entity, or the lines can't be compared — which
  // is the entire point of putting them on the same axes. Works at two lines or
  // at six; the mapping layer decides how many arrive.
  const all = finding.entities.flatMap((e) => e.series?.points.map((p) => p.value) ?? []);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;

  return (
    <Card label={finding.label}>
      <div className="mb-[8px] flex flex-wrap gap-[12px]">
        {finding.entities.map((entity, i) => (
          <span key={entity.name} className="flex items-center gap-[6px]">
            <span className="h-[3px] w-[14px] rounded-full" style={{ backgroundColor: colors[i] }} />
            <span className="font-satoshi text-[12px] font-medium tracking-[-0.12px] text-black/70">
              {entity.name}
            </span>
            {entity.display ? (
              <span className="font-satoshi text-[12px] font-semibold tabular-nums text-black">
                {entity.display}
              </span>
            ) : null}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={0} x2={W} y1={H * t} y2={H * t} stroke={CHART_TRIM.grid} strokeWidth={1} />
        ))}
        {finding.entities.map((entity, i) => {
          const points = entity.series?.points ?? [];
          if (points.length < 2) return null;
          const stepX = (W - 8) / (points.length - 1);
          const d = points
            .map((point, j) => {
              const x = 4 + j * stepX;
              const y = 4 + (1 - (point.value - min) / span) * (H - 8);
              return `${j === 0 ? "M" : "L"}${x},${y}`;
            })
            .join(" ");
          return (
            <path
              key={entity.name}
              d={d}
              fill="none"
              stroke={colors[i]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {finding.entities[0]?.series ? <AxisLabels series={finding.entities[0].series} /> : null}
    </Card>
  );
}

function BarsBlock({ finding }: { finding: ComparisonFinding }) {
  const max = Math.max(...finding.entities.map((e) => Math.abs(e.value)), 1);
  const colors = sequential(finding.entities.length);

  return (
    <Card label={finding.label}>
      <p className={`m-0 mb-[10px] font-satoshi text-[11px] tracking-[-0.11px] text-black/45`}>
        {finding.measure}
      </p>
      <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
        {finding.entities.map((entity, i) => (
          <li key={entity.name}>
            <div className="flex items-baseline justify-between gap-[8px]">
              <span className="truncate font-satoshi text-[12px] tracking-[-0.12px] text-black/70">
                {entity.name}
              </span>
              <span className="shrink-0 font-satoshi text-[12px] font-semibold tabular-nums text-black">
                {entity.display ?? entity.value}
              </span>
            </div>
            <div className="mt-[4px] h-[8px] w-full overflow-hidden rounded-full bg-black/[0.05]">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${(Math.abs(entity.value) / max) * 100}%`,
                  backgroundColor: colors[i],
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DonutBlock({ finding }: { finding: CompositionFinding }) {
  return (
    <Card label={finding.label}>
      <Donut parts={finding.parts} />
    </Card>
  );
}

function StackedBar({ finding }: { finding: CompositionFinding }) {
  const total = finding.parts.reduce((sum, p) => sum + p.value, 0) || 1;
  const colors = categoricalSet(finding.parts.length);

  return (
    <Card label={finding.label}>
      <div className="flex h-[26px] w-full overflow-hidden rounded-[6px]">
        {finding.parts.map((part, i) => (
          <div
            key={part.label}
            style={{ width: `${(part.value / total) * 100}%`, backgroundColor: colors[i] }}
            title={part.label}
          />
        ))}
      </div>
      <ul className="mt-[10px] grid grid-cols-2 gap-x-[16px] gap-y-[5px] p-0 m-0 list-none">
        {finding.parts.map((part, i) => (
          <li key={part.label} className="flex items-center gap-[6px]">
            <span className="h-[8px] w-[8px] shrink-0 rounded-[2px]" style={{ backgroundColor: colors[i] }} />
            <span className="truncate font-satoshi text-[11px] tracking-[-0.11px] text-black/65">
              {part.label}
            </span>
            <span className="ml-auto font-satoshi text-[11px] font-semibold tabular-nums text-black/80">
              {Math.round((part.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * The generic table — the one renderer that isn't a lift, because both existing
 * tables in the repo hardcode their columns for a fixed row type.
 */
function DataTable({ finding }: { finding: ComparisonFinding | CompositionFinding }) {
  const rows =
    finding.kind === "comparison"
      ? finding.entities.map((e) => ({
          name: e.name,
          value: e.display ?? String(e.value),
          delta: undefined as Delta | undefined,
        }))
      : finding.parts.map((p) => ({
          name: p.label,
          value: `${Math.round(p.value * 100)}%`,
          delta: p.delta,
        }));
  const measure = finding.kind === "comparison" ? finding.measure : "Share";

  return (
    <Card label={finding.label}>
      <table className="w-full border-collapse font-satoshi">
        <thead>
          <tr>
            <th className={`pb-[6px] text-left ${LABEL}`}>Name</th>
            <th className={`pb-[6px] text-right ${LABEL}`}>{measure}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-black/[0.06]">
              <td className="py-[7px] pr-[8px] text-[12px] tracking-[-0.12px] text-black/75">
                {row.name}
              </td>
              <td className="py-[7px] text-right text-[12px] font-semibold tabular-nums text-black">
                <span className="inline-flex items-center gap-[8px]">
                  {row.value}
                  {row.delta ? <DeltaChip delta={row.delta} /> : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function TransitionCard({ finding }: { finding: TransitionFinding }) {
  const tone = SENTIMENT[finding.sentiment];
  return (
    <Card label={finding.subjectLabel}>
      <div className="flex items-center gap-[10px]">
        <span className="font-satoshi text-[20px] font-bold tracking-[-0.5px] text-black/40">
          {finding.from}
        </span>
        <span className="font-satoshi text-[16px]" style={{ color: tone.fg }} aria-label="changed to">
          →
        </span>
        <span className="font-satoshi text-[24px] font-bold tracking-[-0.6px]" style={{ color: tone.fg }}>
          {finding.to}
        </span>
      </div>
      {finding.note ? (
        <p className="mt-[8px] mb-0 font-satoshi text-[12px] leading-[18px] tracking-[-0.12px] text-black/55">
          {finding.note}
        </p>
      ) : null}
    </Card>
  );
}

function RequirementCard({ finding }: { finding: RequirementFinding }) {
  return (
    <Card label="Requirement">
      <div className="flex flex-wrap items-baseline gap-[8px]">
        <span className="font-satoshi text-[24px] font-bold tracking-[-0.6px] text-[#171615]">
          {finding.amount}
        </span>
        {finding.deadline ? (
          <span className="rounded-full bg-black/[0.05] px-[8px] py-[3px] font-satoshi text-[11px] font-medium text-black/60">
            {finding.deadline}
          </span>
        ) : null}
      </div>
      <p className="mt-[6px] mb-0 font-satoshi text-[13px] leading-[19px] font-medium tracking-[-0.13px] text-black/75">
        {finding.purpose}
      </p>
      {finding.note ? (
        <p className="mt-[6px] mb-0 font-satoshi text-[12px] leading-[18px] tracking-[-0.12px] text-black/50">
          {finding.note}
        </p>
      ) : null}
    </Card>
  );
}

function ProseBlock({ finding }: { finding: NarrativeFinding }) {
  return (
    <div className="rounded-[12px] border border-black/10 bg-white/65 p-[14px]">
      {finding.heading ? (
        <h4 className="m-0 mb-[6px] font-satoshi text-[14px] font-bold tracking-[-0.28px] text-[#171615]">
          {finding.heading}
        </h4>
      ) : null}
      <p className="m-0 font-satoshi text-[13px] leading-[20px] tracking-[-0.13px] text-black/70">
        {finding.text}
      </p>
    </div>
  );
}

function NarrativeWithChips({ finding }: { finding: NarrativeFinding }) {
  return (
    <div className="rounded-[12px] border border-black/10 bg-white/65 p-[14px]">
      {finding.heading ? (
        <h4 className="m-0 mb-[6px] font-satoshi text-[14px] font-bold tracking-[-0.28px] text-[#171615]">
          {finding.heading}
        </h4>
      ) : null}
      <p className="m-0 font-satoshi text-[13px] leading-[20px] tracking-[-0.13px] text-black/70">
        {finding.text}
      </p>
      <div className="mt-[10px] flex flex-wrap gap-[6px]">
        {finding.deltas?.map((delta) => <DeltaChip key={delta.label} delta={delta} />)}
      </div>
    </div>
  );
}

function RecommendationCard({ finding }: { finding: RecommendationFinding }) {
  return (
    <div className="rounded-[12px] border border-black/10 bg-[#FBF8F2] p-[14px]">
      <p className={`m-0 ${LABEL}`}>Recommendation</p>
      <h4 className="mt-[5px] mb-0 font-satoshi text-[15px] font-bold tracking-[-0.3px] text-[#171615]">
        {finding.title}
      </h4>
      <p className="mt-[6px] mb-0 font-satoshi text-[13px] leading-[20px] tracking-[-0.13px] text-black/70">
        {finding.rationale}
      </p>
      {finding.action ? (
        <button
          type="button"
          className="mt-[10px] rounded-full border-0 bg-[#171615] px-[14px] py-[7px] font-satoshi text-[12px] font-semibold tracking-[-0.12px] text-white transition-opacity hover:opacity-85"
        >
          {finding.action}
        </button>
      ) : null}
    </div>
  );
}

const FLAG_TONE: Record<FlagFinding["severity"], Sentiment> = {
  info: "neutral",
  warn: "negative",
  critical: "negative",
};

function FlagCallout({ finding }: { finding: FlagFinding }) {
  const tone = SENTIMENT[FLAG_TONE[finding.severity]];
  return (
    <div
      className="rounded-[12px] border p-[14px]"
      style={{ backgroundColor: tone.bg, borderColor: withAlpha(tone.fg, 0.25) }}
    >
      <p className="m-0 font-satoshi text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: tone.fg }}>
        {finding.severity === "critical" ? "Critical" : finding.severity === "warn" ? "Needs attention" : "Note"}
      </p>
      <h4 className="mt-[5px] mb-0 font-satoshi text-[14px] font-bold tracking-[-0.28px] text-[#171615]">
        {finding.subjectLabel}
      </h4>
      <p className="mt-[5px] mb-0 font-satoshi text-[13px] leading-[19px] tracking-[-0.13px] text-black/70">
        {finding.detail}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- checklist */

/**
 * Open items, as tick boxes.
 *
 * The one renderer whose job is to be scanned rather than read: an advisor
 * looking at this wants to know what is left, so the state marker leads and the
 * text follows. Done items stay visible and struck through — a list that hides
 * what was finished loses the reader's sense of how much of it is real progress.
 */
function Checklist({ finding }: { finding: ChecklistFinding }) {
  const open = finding.items.filter((item) => (item.state ?? "todo") !== "done").length;

  return (
    <Card label={finding.subject}>
      <div className="flex items-baseline justify-between gap-[10px]">
        <h4 className="m-0 font-satoshi text-[14px] font-bold leading-[19px] tracking-[-0.28px] text-[#171615]">
          {finding.label}
        </h4>
        <span className="shrink-0 font-satoshi text-[11px] font-semibold tracking-[-0.11px] text-black/40">
          {open} open
        </span>
      </div>

      <ul className="mt-[10px] mb-0 grid list-none gap-[8px] p-0">
        {finding.items.map((item, i) => {
          const state = item.state ?? "todo";
          const isDone = state === "done";
          return (
            <li key={i} className="flex items-start gap-[9px]">
              <span
                aria-hidden
                className="mt-[1px] grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border font-satoshi text-[10px] leading-none"
                style={{
                  borderColor: isDone ? withAlpha(ACCENT, 0.5) : "rgba(23,22,21,0.22)",
                  backgroundColor: isDone
                    ? withAlpha(ACCENT, 0.9)
                    : state === "doing"
                      ? withAlpha(ACCENT, 0.2)
                      : "transparent",
                  color: "#fff",
                }}
              >
                {isDone ? "\u2713" : state === "doing" ? "\u00B7" : ""}
              </span>
              <span className="min-w-0">
                <span
                  className="block font-satoshi text-[13px] leading-[19px] tracking-[-0.13px]"
                  style={{
                    color: isDone ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.78)",
                    textDecoration: isDone ? "line-through" : undefined,
                  }}
                >
                  {item.text}
                </span>
                {item.due || item.owner ? (
                  <span className="mt-[2px] block font-satoshi text-[11px] tracking-[-0.11px] text-black/40">
                    {[item.owner, item.due].filter(Boolean).join(" \u00B7 ")}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ----------------------------------------------------------------- fallback */

/**
 * The last resort: a heading and pointers, for a finding no chart wanted.
 *
 * Reads whatever fields the finding happens to carry rather than switching on
 * kind, because the whole reason this renderer is reached is that the finding
 * didn't fit the shape its kind implies.
 */
function FallbackList({ finding }: { finding: Finding }) {
  const f = finding as Finding & Record<string, unknown>;

  const heading =
    (typeof f.label === "string" && f.label) ||
    (typeof f.heading === "string" && f.heading) ||
    (typeof f.title === "string" && f.title) ||
    (typeof f.subjectLabel === "string" && f.subjectLabel) ||
    finding.subject;

  const lines: string[] = [];
  if (typeof f.value === "string") lines.push(f.value);
  if (typeof f.text === "string") lines.push(f.text);
  if (typeof f.detail === "string") lines.push(f.detail);
  if (typeof f.rationale === "string") lines.push(f.rationale);
  if (typeof f.action === "string") lines.push(f.action);
  if (typeof f.amount === "string") {
    lines.push([f.amount, f.purpose, f.deadline].filter((part) => typeof part === "string").join(" · "));
  }
  if (typeof f.from === "string" && typeof f.to === "string") lines.push(`${f.from} → ${f.to}`);
  if (typeof f.note === "string") lines.push(f.note);

  const entities = Array.isArray(f.entities) ? f.entities : [];
  for (const entity of entities as { name?: string; display?: string; value?: number }[]) {
    lines.push(`${entity.name ?? "—"}: ${entity.display ?? entity.value ?? "—"}`);
  }
  const parts = Array.isArray(f.parts) ? f.parts : [];
  for (const part of parts as { label?: string; value?: number }[]) {
    lines.push(`${part.label ?? "—"}: ${Math.round((part.value ?? 0) * 100)}%`);
  }
  const series = f.series as Series | undefined;
  if (series?.points?.length === 1) {
    lines.push(`${series.points[0].label}: ${series.points[0].value}`);
  }

  const deltas = (Array.isArray(f.deltas) ? f.deltas : []) as Delta[];

  return (
    <Card label={finding.subject}>
      <h4 className="m-0 font-satoshi text-[14px] font-bold leading-[19px] tracking-[-0.28px] text-[#171615]">
        {heading}
      </h4>
      {lines.length > 0 ? (
        <ul className="mt-[7px] mb-0 list-disc pl-[18px]">
          {lines.map((line, i) => (
            <li
              key={i}
              className="font-satoshi text-[13px] leading-[19px] tracking-[-0.13px] text-black/70"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {deltas.length > 0 ? (
        <div className="mt-[9px] flex flex-wrap gap-[6px]">
          {deltas.map((delta, i) => (
            <DeltaChip key={i} delta={delta} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ registry */

/**
 * Renderer id → component. The registry is exhaustive over RendererId, so
 * adding a renderer to select.ts without building it is a type error rather
 * than a blank block.
 */
export const RENDERER_COMPONENTS: Record<
  RendererId,
  (props: { finding: Finding }) => React.ReactNode
> = {
  HeroMetric: ({ finding }) => <HeroMetric finding={finding as MetricFinding} />,
  StatTile: ({ finding }) => <StatTile finding={finding as MetricFinding} />,
  Sparkline: ({ finding }) => <SparklineBlock finding={finding as TrendFinding} />,
  LineChart: ({ finding }) => <LineChartBlock finding={finding as TrendFinding} />,
  DualLineChart: ({ finding }) => <OverlaidLines finding={finding as ComparisonFinding} />,
  MultiLineChart: ({ finding }) => <OverlaidLines finding={finding as ComparisonFinding} />,
  PairedBars: ({ finding }) => <BarsBlock finding={finding as ComparisonFinding} />,
  BarChart: ({ finding }) => <BarsBlock finding={finding as ComparisonFinding} />,
  DonutChart: ({ finding }) => <DonutBlock finding={finding as CompositionFinding} />,
  StackedBar: ({ finding }) => <StackedBar finding={finding as CompositionFinding} />,
  DataTable: ({ finding }) => (
    <DataTable finding={finding as ComparisonFinding | CompositionFinding} />
  ),
  TransitionCard: ({ finding }) => <TransitionCard finding={finding as TransitionFinding} />,
  RequirementCard: ({ finding }) => <RequirementCard finding={finding as RequirementFinding} />,
  NarrativeWithChips: ({ finding }) => <NarrativeWithChips finding={finding as NarrativeFinding} />,
  ProseBlock: ({ finding }) => <ProseBlock finding={finding as NarrativeFinding} />,
  RecommendationCard: ({ finding }) => (
    <RecommendationCard finding={finding as RecommendationFinding} />
  ),
  FlagCallout: ({ finding }) => <FlagCallout finding={finding as FlagFinding} />,
  Checklist: ({ finding }) => <Checklist finding={finding as ChecklistFinding} />,
  FallbackList: ({ finding }) => <FallbackList finding={finding} />,
};
