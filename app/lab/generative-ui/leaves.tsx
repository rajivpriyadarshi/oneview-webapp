"use client";

/**
 * Phase 2 — the leaf half of the approved registry, made real.
 *
 * Most of this file is a mapping rather than an implementation, and that is the
 * point. `../dynamic-ui/renderers.tsx` already contains nineteen working components —
 * the SVG line and donut geometry, the shared-scale overlay, the delta chips, the
 * severity tones — and every one of them takes exactly one argument: a `Finding`.
 *
 * A `Finding` is analysis output, not presentation. So handing those components a
 * finding resolved from the semantic report keeps the §9 boundary intact: the node
 * still carries no facts, only a `dataKey`, a `sectionId` and presentation props.
 * Rewriting 782 lines of working chart code into named-props form would have bought
 * nothing that the data-key indirection does not already guarantee.
 *
 * What is genuinely new here is the eleven components prototype 1 had no equivalent
 * for, and they are all text and structure: metric strips, key-value lists, entity
 * cards, provenance, a heatmap, a side-by-side comparison. None of them choose
 * colour, which is why none of them import the palette.
 *
 * Presentation props are *additive overrides* on top of the finding. `variant: "hero"`
 * on a Metric picks the 34px treatment; `sparkline: true` on a LineChart drops the
 * axes. The prop cannot change what the number is.
 */

import type React from "react";
import { RENDERER_COMPONENTS } from "../dynamic-ui/renderers";
import { Card, DeltaChip, Empty, INK, LABEL, Rows } from "./chrome";
import type { Finding } from "./findings";
import type { ComponentId } from "./registry";
import type { UINode } from "./spec";

/* ------------------------------------------------------- the reuse interface */

type Renderers = typeof RENDERER_COMPONENTS;
type RendererId = keyof Renderers;
/**
 * Prototype 1's `Finding`, derived from the component signature rather than imported.
 *
 * The two unions are structurally identical — this prototype's ./findings.ts was
 * ported from that one — but deriving the type means a divergence surfaces here as a
 * type error instead of as a wrong-looking chart.
 */
type LegacyFinding = Parameters<Renderers[RendererId]>[0]["finding"];

/** Named `draw` rather than `use`, which React reserves for hooks. */
const draw = (id: RendererId, finding: Finding): React.ReactNode =>
  RENDERER_COMPONENTS[id]({ finding: finding as LegacyFinding });

/* ------------------------------------------------------------------- inputs */

export type Provenance = { tool?: string; asOf?: string; sources?: string[] };

/**
 * What a leaf receives.
 *
 * Three channels, because the components legitimately need different things and
 * pretending otherwise would mean synthesising fake findings for the ones that
 * don't want one:
 *
 *   - `finding` — the resolved claim from the semantic report. What the chart and
 *     callout components read.
 *   - `value` — the raw bundle value behind `dataKey`. What a MetricStrip over three
 *     sibling figures, or a SourceList, actually wants.
 *   - `provenance` — tool and as-of, for the components whose job is provenance.
 *
 * `props` is the node's presentation props, already validated against the registry
 * schema by the time a leaf sees them.
 */
export type Resolved = {
  node: UINode;
  props: Record<string, unknown>;
  finding?: Finding;
  value?: unknown;
  provenance?: Provenance;
};

export type Leaf = (input: Resolved) => React.ReactNode;

/* ------------------------------------------------------------------ helpers */

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const bool = (value: unknown): boolean => value === true;

/** Fixed locale, so the server and client renders agree. */
const group = (value: number): string => value.toLocaleString("en-US");

/**
 * An identifier as a reader would write it: `indexLevel` → "Index level".
 *
 * Labels reach a leaf from three places — the composer's props, the finding, and, when
 * a node is bound straight to a bundle field, the field's own name. The third one is
 * how `INDEXLEVEL` and "Also weighed: indexLevel" got onto a page: a data field name
 * rendered as if it were a label. Casing a string is presentation, so this belongs
 * here; what it must never do is *invent* a label, which is why a string with a space
 * in it is already someone's prose and is returned untouched.
 */
const humanise = (raw: string): string => {
  if (/\s/.test(raw)) return raw;
  const words = raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * A raw bundle number with the unit its own field name declares.
 *
 * `quarterChangePct: 3.8` rendered as "3.8" is not a smaller version of the truth, it
 * is a different number — 3.8 what? The unit is already stated, in the field name, so
 * reading it there is translation rather than invention: no unit in the name, no unit
 * on the page.
 *
 * Stated limit: the right home for this is layer 2, emitting `{value, display}` for
 * every figure the way `MetricFinding.value` already arrives pre-formatted. Until the
 * tools do that, a node bound directly to a field lands here.
 */
const figure = (value: unknown, hint = ""): string => {
  if (typeof value !== "number") return text(value);
  if (/pct|percent/i.test(hint)) return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  if (/bps/i.test(hint)) return `${group(value)} bps`;
  if (/(^|[^a-z])m$|millions?/i.test(hint)) {
    return Math.abs(value) >= 1 ? `S$${value.toFixed(1)}m` : `S$${Math.round(value * 1000)}k`;
  }
  return group(value);
};

const text = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? group(value)
      : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : "—";

const rowsFrom = (value: unknown): { label: string; value: string }[] => {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => ({
        label: text(entry.label ?? entry.name ?? entry.key ?? entry.title),
        value: text(entry.display ?? entry.value ?? entry.detail ?? entry.text),
      }));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      // Nested objects have no honest one-line rendering, so they are skipped
      // rather than stringified into "[object Object]".
      .filter(([, entry]) => typeof entry !== "object" || entry === null)
      .map(([key, entry]) => ({ label: key.replace(/([a-z])([A-Z])/g, "$1 $2"), value: text(entry) }));
  }
  return [];
};

/**
 * The escape hatch, and the reason an unexpected shape is never a blank area.
 *
 * `FallbackList` sniffs a finding's fields rather than switching on its kind, so it
 * renders something legible for any finding at all. Where there is no finding to
 * fall back to, `Empty` says so in words.
 */
const escape = (input: Resolved, what: string): React.ReactNode =>
  input.finding ? draw("FallbackList", input.finding) : <Empty what={what} />;

/* ------------------------------------------------------------- new: figures */

function MetricStrip({ props, value, finding }: Resolved) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) {
    return finding ? draw("StatTile", finding) : <Empty what="No figures for this strip." />;
  }

  const columns = props.columns === 2 ? "grid-cols-2" : props.columns === 4 ? "grid-cols-4" : "grid-cols-3";
  const heading = str(props.heading);

  return (
    <div>
      {heading ? <div className={`${LABEL} mb-[10px]`}>{heading}</div> : null}
      <div className={`grid gap-[10px] ${columns}`}>
        {items.slice(0, 4).map((item, index) => {
          const entry = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
          return (
            <div key={text(entry.label ?? index)} className="rounded-[10px] border border-black/8 bg-white/50 p-[12px]">
              <div className={LABEL}>{humanise(text(entry.label ?? entry.name ?? entry.key))}</div>
              <div
                className="mt-[6px] font-satoshi text-[20px] font-medium tabular-nums leading-none"
                style={{ color: INK }}
              >
                {str(entry.display) ?? figure(entry.value, text(entry.key ?? entry.label ?? entry.name))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- new: comparison */

/**
 * Two or three options against each other, everything visible at once.
 *
 * The values come from the finding's entities. `props.measures` names the measures
 * that were weighed and is rendered as a footnote rather than as a matrix, because
 * the composer supplies measure *names* and inventing a value for each name is
 * exactly the fabrication §9 forbids.
 */
function Comparison({ props, finding, node }: Resolved) {
  if (finding?.kind !== "comparison") return escape({ props, finding, node }, "Nothing to compare.");

  const measures = Array.isArray(props.measures) ? props.measures.filter((entry) => typeof entry === "string") : [];
  const rows = props.variant === "rows";

  return (
    <Card label={finding.label}>
      <div className={rows ? "flex flex-col gap-[10px]" : "grid gap-[10px]"} style={rows ? undefined : { gridTemplateColumns: `repeat(${finding.entities.length}, minmax(0, 1fr))` }}>
        {finding.entities.map((entity) => (
          <div key={entity.name} className="rounded-[10px] border border-black/8 bg-white/50 p-[12px]">
            <div className="font-satoshi text-[12px] font-medium" style={{ color: INK }}>
              {entity.name}
            </div>
            <div className="mt-[8px] font-satoshi text-[22px] font-medium tabular-nums leading-none" style={{ color: INK }}>
              {entity.display ?? group(entity.value)}
            </div>
            <div className={`${LABEL} mt-[8px]`}>{humanise(finding.measure)}</div>
          </div>
        ))}
      </div>
      {measures.length > 0 ? (
        <div className="mt-[12px] font-satoshi text-[11px] text-black/40">Also weighed: {measures.map(humanise).join(" · ")}</div>
      ) : null}
    </Card>
  );
}

/* --------------------------------------------------------- new: text blocks */

function KeyValueList({ props, value, finding, node }: Resolved) {
  const rows = rowsFrom(value);
  if (rows.length === 0) return escape({ props, value, finding, node }, "No attributes to list.");
  return (
    <Card label={str(props.label)}>
      <Rows rows={rows} columns={props.columns === 2 ? 2 : 1} />
    </Card>
  );
}

function Timeline({ props, value, finding, node }: Resolved) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return escape({ props, value, finding, node }, "No dated events.");

  return (
    <Card label={str(props.label)}>
      <ol className="flex flex-col gap-[12px]">
        {items.map((item, index) => {
          const entry = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
          return (
            <li key={text(entry.label ?? entry.date ?? index)} className="flex gap-[10px]">
              <div className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full border border-black/25" />
              <div className="min-w-0">
                <div className={LABEL}>{text(entry.date ?? entry.label ?? entry.when)}</div>
                <div className="mt-[3px] font-satoshi text-[13px]" style={{ color: INK }}>
                  {text(entry.text ?? entry.detail ?? entry.display ?? entry.value)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function NewsImpact({ props, value, finding, node }: Resolved) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return escape({ props, value, finding, node }, "No market context.");
  const limit = typeof props.limit === "number" ? props.limit : 4;

  return (
    <Card label={str(props.heading) ?? "Market context"}>
      <ul className="flex flex-col gap-[12px]">
        {items.slice(0, limit).map((item, index) => {
          const entry = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
          return (
            <li key={text(entry.headline ?? index)}>
              <div className="font-satoshi text-[13px] font-medium" style={{ color: INK }}>
                {text(entry.headline ?? entry.title)}
              </div>
              <div className="mt-[3px] font-satoshi text-[12px] text-black/55">
                {text(entry.impact ?? entry.text ?? entry.detail)}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------- new: entity cards */

/**
 * One implementation behind four registry ids.
 *
 * A client, a holding, an asset and a document are the same shape to a renderer —
 * labelled attributes of one entity — and they are four entries in the registry
 * because they mean different things to the *composer*, not because they draw
 * differently. Four near-identical files would have been four places to fix a bug.
 */
function entityCard(fallbackLabel: string): Leaf {
  const EntityCard: Leaf = ({ props, value, finding, node }) => {
    const rows = rowsFrom(value);
    if (rows.length === 0) return escape({ props, value, finding, node }, `No ${fallbackLabel.toLowerCase()} detail.`);

    const title = str((typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}).name);
    const hidden = new Set(["name", ...(bool(props.showWeight) ? [] : []), ...(bool(props.showDate) ? [] : [])]);

    return (
      <Card label={fallbackLabel}>
        {title ? (
          <div className="mb-[10px] font-satoshi text-[15px] font-medium" style={{ color: INK }}>
            {title}
          </div>
        ) : null}
        <Rows rows={rows.filter((row) => !hidden.has(row.label))} />
      </Card>
    );
  };
  return EntityCard;
}

function SourceList({ props, value, provenance }: Resolved) {
  const rows = rowsFrom(value);
  const asOf = provenance?.asOf;
  if (rows.length === 0 && !asOf) return <Empty what="No sources recorded." />;

  return (
    <div>
      <div className={LABEL}>{str(props.label) ?? "Sources"}</div>
      <ul className="mt-[8px] flex flex-col gap-[6px]">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-[12px]">
            <span className="font-satoshi text-[12px]" style={{ color: INK }}>
              {row.label}
            </span>
            <span className="font-satoshi text-[11px] tabular-nums text-black/40">{row.value}</span>
          </li>
        ))}
      </ul>
      {provenance?.tool ? (
        <div className="mt-[10px] font-satoshi text-[11px] text-black/35">
          via {provenance.tool}
          {asOf ? ` · as at ${asOf}` : ""}
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------- new: heatmap */

function ExposureHeatmap({ props, value, finding, node }: Resolved) {
  const cells = (Array.isArray(value) ? value : [])
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      row: text(entry.row ?? entry.label),
      col: text(entry.col ?? entry.group),
      value: typeof entry.value === "number" ? entry.value : 0,
    }));
  if (cells.length === 0) return escape({ props, value, finding, node }, "No two-dimensional exposure.");

  const rows = [...new Set(cells.map((cell) => cell.row))];
  const cols = [...new Set(cells.map((cell) => cell.col))];
  const peak = Math.max(...cells.map((cell) => Math.abs(cell.value)), 1);

  return (
    <Card label={str(props.label)}>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(0, 1fr))` }}>
        <div />
        {cols.map((col) => (
          <div key={col} className={`${LABEL} truncate text-center`}>
            {col}
          </div>
        ))}
        {rows.map((row) => (
          <div key={row} className="contents">
            <div className={`${LABEL} pr-[8px] text-right`}>{row}</div>
            {cols.map((col) => {
              const cell = cells.find((entry) => entry.row === row && entry.col === col);
              const intensity = cell ? Math.abs(cell.value) / peak : 0;
              return (
                <div
                  key={`${row}:${col}`}
                  className="flex h-[30px] items-center justify-center rounded-[4px] font-satoshi text-[11px] tabular-nums"
                  // Intensity, not hue. One ink at varying alpha keeps the ramp
                  // readable and keeps colour out of the component's decisions.
                  style={{ background: `rgba(23, 22, 21, ${(0.05 + intensity * 0.28).toFixed(3)})`, color: INK }}
                >
                  {cell ? group(cell.value) : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------- adaptations */

/** A metric, at the weight the node asked for. */
const metric: Leaf = ({ props, finding, value, node }) => {
  if (finding?.kind !== "metric") {
    // A metric node bound to something else still has one honest rendering: the raw
    // labelled value from the bundle.
    const entry = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
    if (!entry) return escape({ props, finding, value, node }, "No figure to show.");
    return (
      <Card>
        <div className={LABEL}>{humanise(str(props.label) ?? text(entry.label ?? node.dataKey?.split(".").at(-1)))}</div>
        <div className="mt-[6px] font-satoshi text-[22px] font-medium tabular-nums" style={{ color: INK }}>
          {str(entry.display) ?? figure(entry.value, text(props.label ?? entry.label ?? node.dataKey))}
        </div>
        {typeof entry.delta === "object" && entry.delta !== null ? (
          <div className="mt-[8px]">
            <DeltaChip delta={entry.delta as { label: string; value?: number }} />
          </div>
        ) : null}
      </Card>
    );
  }
  return draw(props.variant === "hero" || props.size === "lg" ? "HeroMetric" : "StatTile", finding);
};

/**
 * A line chart, at one of three weights.
 *
 * The three-way choice below is the one place a presentation prop reaches into the
 * reused renderers, and it is where prototype 1's earned knowledge sits: two or more
 * entities with their own history go to the overlay, which puts every series on a
 * single min/max scale. Separately-scaled lines cannot be compared, and drawing them
 * side by side implies they can.
 */
const line: Leaf = ({ props, finding, node, value }) => {
  if (!finding) return escape({ props, finding, node, value }, "No series to draw.");
  if (bool(props.sparkline)) return draw("Sparkline", finding);
  if (finding.kind === "comparison") {
    return draw(finding.entities.length === 2 ? "DualLineChart" : "MultiLineChart", finding);
  }
  if (finding.kind === "trend" || finding.kind === "metric") return draw("LineChart", finding);
  return escape({ props, finding, node, value }, "No series to draw.");
};

const bars: Leaf = ({ props, finding, node, value }) => {
  if (!finding) return escape({ props, finding, node, value }, "Nothing to chart.");
  if (finding.kind === "composition" && bool(props.stacked)) return draw("StackedBar", finding);
  if (finding.kind === "comparison" || finding.kind === "composition") return draw("BarChart", finding);
  return escape({ props, finding, node, value }, "Nothing to chart.");
};

const insight: Leaf = ({ props, finding, node, value }) => {
  if (!finding) return escape({ props, finding, node, value }, "No conclusion to show.");
  if (finding.kind === "transition") return draw("TransitionCard", finding);
  // `NarrativeWithChips` is the right treatment only when there are chips to show;
  // without them it is a prose block with extra machinery.
  if ("deltas" in finding && Array.isArray((finding as { deltas?: unknown[] }).deltas)) {
    return draw("NarrativeWithChips", finding);
  }
  return draw("ProseBlock", finding);
};

const guarded =
  (id: RendererId, kinds: Finding["kind"][], what: string): Leaf =>
  (input) =>
    input.finding && kinds.includes(input.finding.kind) ? draw(id, input.finding) : escape(input, what);

/* ------------------------------------------------------------- the mapping */

/**
 * Every non-container id in the registry, resolved to something that renders.
 *
 * Typed as a total map over the leaf ids, so adding an id to the registry without
 * building it is a type error rather than a blank area at runtime — the one property
 * prototype 1's renderer map got right, kept.
 */
export const LEAF_COMPONENTS: Record<Exclude<ComponentId, LayoutId>, Leaf> = {
  Metric: metric,
  MetricStrip,
  DataTable: guarded("DataTable", ["comparison", "composition"], "No records to tabulate."),
  RankedList: bars,
  Timeline,
  KeyValueList,

  LineChart: line,
  BarChart: bars,
  AllocationDonut: guarded("DonutChart", ["composition"], "No composition to draw."),
  ExposureHeatmap,

  InsightCard: insight,
  RiskAlert: guarded("FlagCallout", ["flag", "transition"], "Nothing flagged."),
  Recommendation: guarded("RecommendationCard", ["recommendation"], "No recommendation."),
  NewsImpact,
  Checklist: guarded("Checklist", ["checklist"], "No open items."),
  Comparison,

  ClientCard: entityCard("Client"),
  HoldingCard: entityCard("Position"),
  AssetCard: entityCard("Asset"),
  DocumentReference: entityCard("Document"),
  SourceList,
};

/** The ids ./containers.tsx owns. Kept here so the map above can exclude them. */
export type LayoutId =
  | "PageHeader"
  | "Section"
  | "Grid"
  | "Stack"
  | "Tabs"
  | "SplitPane"
  | "Disclosure"
  | "WhatToWatch";

export const isLeafId = (id: ComponentId): id is Exclude<ComponentId, LayoutId> => id in LEAF_COMPONENTS;
