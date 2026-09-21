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
import { LineSvg, RENDERER_COMPONENTS } from "../dynamic-ui/renderers";
import { Block, Card, DeltaChip, Empty, INK, LABEL, Rows, Tile } from "./chrome";
import { CHART, RHYTHM, SURFACE, TYPE, pill, toneOf } from "./ds";
import { isPlottable, type Finding } from "./findings";
import type { ComponentId } from "./registry";
import type { UINode } from "./spec";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

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
  /**
   * The claimed finding's measure group — sibling findings measuring the same entities.
   * Only collected for components that tabulate several measures at once; everywhere
   * else it is absent and a leaf renders `finding` alone, as before.
   */
  group?: Finding[];
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

/* --------------------------------------------------------------- new: prose */

/**
 * The written answer, in the flow of the document.
 *
 * Renders the finding's own `text` verbatim. There is no prop that can alter a word of
 * it: `variant` chooses the weight of the passage and `heading` is a title *above* it.
 * That is the whole of what the composer may decide about prose, and it is why prose
 * can be in the document at all without breaking the "cannot change the facts" rule.
 *
 * Markdown is handled to exactly one level — `**bold**` — because the analysis writes
 * figures in bold and dropping the emphasis would flatten the sentence that carries the
 * answer. Anything richer belongs to the fallback renderer, not here.
 */
function Prose({ props, finding, value }: Resolved) {
  const passage =
    finding && "text" in finding && typeof finding.text === "string"
      ? finding.text
      : typeof value === "string"
        ? value
        : undefined;
  if (!passage) return <Empty what="No passage to show." />;

  const variant = str(props.variant) ?? "body";
  const heading = str(props.heading) ?? (finding && "heading" in finding ? str(finding.heading) : undefined);
  const body = variant === "lead" ? TYPE.bodyLead : TYPE.body;

  return (
    <Block title={heading}>
      <div className={variant === "note" ? SURFACE.inset : undefined}>
        {passage.split(/\n{2,}/).map((para, index) => (
          <p key={index} className={`${body} ${index === 0 ? "" : "mt-[12px]"}`}>
            {emphasise(para)}
          </p>
        ))}
      </div>
    </Block>
  );
}

/**
 * `**bold**` → `<strong>`, and nothing else.
 *
 * Split rather than parsed: a regex with a capture group on an alternating split gives
 * the delimited runs at odd indices, which is enough for one inline mark and cannot
 * produce malformed output the way a partial markdown parser can.
 */
const emphasise = (raw: string): React.ReactNode[] =>
  raw.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-[#171615]">
        {part}
      </strong>
    ) : (
      part
    ),
  );

/**
 * Several short points, as bullets.
 *
 * Reads three shapes because the three are all honest sources for a list: a finding's
 * own bullet array, a bundle key holding strings, or a bundle key holding labelled
 * objects. What it never does is split one passage into bullets on punctuation — that
 * would be the composer rewriting the analysis, which is the line §9 draws.
 */
function BulletSummary({ props, value, finding, node }: Resolved) {
  const items: string[] = Array.isArray(value)
    ? value
        .map((entry) =>
          typeof entry === "string"
            ? entry
            : typeof entry === "object" && entry !== null
              ? text(
                  (entry as Record<string, unknown>).text ??
                    (entry as Record<string, unknown>).label ??
                    (entry as Record<string, unknown>).detail,
                )
              : text(entry),
        )
        .filter((entry) => entry !== "—")
    : finding && "text" in finding && typeof finding.text === "string"
      ? [finding.text]
      : [];

  if (items.length === 0) return escape({ props, value, finding, node }, "Nothing to list.");

  const numbered = bool(props.numbered);
  const List = numbered ? "ol" : "ul";

  return (
    <Block title={str(props.heading)}>
      <List className={RHYTHM.tight}>
        {items.map((item, index) => (
          <li key={index} className="flex gap-[10px]">
            <span className={`${TYPE.label} mt-[1px] shrink-0 tabular-nums`}>
              {numbered ? `${index + 1}.` : "•"}
            </span>
            <span className={TYPE.body}>{emphasise(item)}</span>
          </li>
        ))}
      </List>
    </Block>
  );
}

/* ------------------------------------------------------------- new: figures */

/**
 * The figure strip, which is the document's lead.
 *
 * Four tiles rather than three by default: four is what fits one line at the document's
 * measure, and the strip is the one place in the report where a border is doing real
 * work — it makes the figures scannable as a set rather than as four paragraphs of
 * number. `secondary` becomes the caption under the value, which is where "vs. your
 * 35–45% range" belongs: attached to the figure it qualifies.
 */
function MetricStrip({ props, value, finding, group }: Resolved) {
  /*
   * The report's own figures, when this is the headline strip.
   *
   * Preferred over the bundle path because a metric finding is a *claim*: the analysis
   * chose the label, wrote the value as it should read, decided whether the change is
   * good news, and said what the figure is measured against. Reading the bundle instead
   * would put every field a row object happens to carry on the page, which is the
   * presentation layer introducing figures nobody claimed.
   */
  const figures = (group ?? []).filter(
    (member): member is Extract<Finding, { kind: "metric" }> => member.kind === "metric",
  );
  if (figures.length >= 2) {
    const columns =
      figures.length === 2 ? "sm:grid-cols-2" : figures.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
    return (
      <Block title={str(props.heading)}>
        <div className={`grid grid-cols-1 gap-[10px] ${columns}`}>
          {figures.slice(0, 4).map((member) => (
            <Tile
              key={member.id}
              label={humanise(member.label)}
              value={member.value}
              caption={member.basis}
              delta={member.delta}
            />
          ))}
        </div>
      </Block>
    );
  }

  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) {
    return finding ? draw("StatTile", finding) : <Empty what="No figures for this strip." />;
  }

  const shown = items.slice(0, 4);
  const columns =
    props.columns === 2 || shown.length === 2
      ? "sm:grid-cols-2"
      : props.columns === 3 || shown.length === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <Block title={str(props.heading)}>
      <div className={`grid grid-cols-1 gap-[10px] ${columns}`}>
        {shown.map((item, index) => {
          const entry = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
          const name = text(entry.label ?? entry.name ?? entry.key);
          const delta = entry.delta;
          return (
            <Tile
              key={`${name}:${index}`}
              label={humanise(name)}
              value={str(entry.display) ?? figure(entry.value, text(entry.key ?? entry.label ?? entry.name))}
              caption={str(entry.secondary) ?? str(entry.detail) ?? str(entry.note)}
              delta={
                typeof delta === "object" && delta !== null
                  ? (delta as { label: string; value?: number })
                  : undefined
              }
            />
          );
        })}
      </div>
    </Block>
  );
}

/* -------------------------------------------------------- new: flat document table */

/**
 * A table with no box around it and no vertical rules.
 *
 * Replaces the delegation to prototype 1's `DataTable`. That one draws a bordered card
 * with a filled header band, which is right for a dashboard widget and wrong here — at
 * document density the band and the border are two more edges competing with the eight
 * blocks around it. Hairlines between rows are enough to hold a column, and dropping
 * everything else is most of what makes the reference document look calm.
 *
 * Numeric columns right-align and get tabular figures; a column whose values read as
 * signed changes renders as tinted pills, because a change is a claim about direction
 * and colour is how a reader sees direction without arithmetic.
 */
function DataTable({ props, value, finding, node }: Resolved) {
  const rows = (Array.isArray(value) ? value : []).filter(
    (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
  );
  if (rows.length === 0) return escape({ props, value, finding, node }, "No records to tabulate.");

  const declared = Array.isArray(props.columns)
    ? props.columns.filter((entry): entry is string => typeof entry === "string")
    : [];
  const keys = declared.length > 0 ? declared.filter((key) => key in rows[0]) : Object.keys(rows[0]);
  if (keys.length === 0) return escape({ props, value, finding, node }, "No columns to show.");

  const limit = typeof props.limit === "number" ? props.limit : 12;
  const numeric = (key: string) => rows.some((row) => typeof row[key] === "number");
  const isDelta = (key: string) => /change|delta|diff|alpha|contrib/i.test(key);

  return (
    <Block title={str(props.label)} caption={str(props.caption)}>
      <Table>
        <TableHeader>
          <TableRow className={`border-b ${SURFACE.hairline} hover:bg-transparent`}>
            {keys.map((key) => (
              <TableHead
                key={key}
                className={`${TYPE.label} h-auto px-0 pb-[10px] font-normal ${numeric(key) ? "text-right" : "text-left"} first:pl-0 last:pr-0`}
              >
                {humanise(key)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, limit).map((row, index) => (
            <TableRow key={index} className={`border-b ${SURFACE.hairline} last:border-b-0 hover:bg-black/[0.015]`}>
              {keys.map((key) => {
                const raw = row[key];
                const rendered = str(row[`${key}Display`]) ?? figure(raw, key);
                return (
                  <TableCell
                    key={key}
                    className={`${numeric(key) ? `${TYPE.cell} text-right tabular-nums` : TYPE.cell} px-[12px] py-[11px] first:pl-0 last:pr-0`}
                  >
                    {isDelta(key) && typeof raw === "number" ? (
                      <span className={pill(toneOf(raw))}>{rendered}</span>
                    ) : (
                      rendered
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > limit ? (
        <div className={TYPE.caption}>
          Showing {limit} of {rows.length}.
        </div>
      ) : null}
    </Block>
  );
}

/**
 * Entities down the side, measures across the top.
 *
 * Built from the findings, never from the bound array, and that is the whole point of
 * it existing next to `DataTable`. A table assembled from bundle rows shows whatever
 * columns the row objects happen to have — cost basis, asset class, an internal id —
 * and a report that shows a figure the analysis never made a claim about is the
 * presentation layer adding facts. Here a column exists if and only if some finding
 * measured it, so the table cannot say more than the answer said.
 *
 * Which column reads as a change is the finding's own doing: a measure whose values
 * straddle zero, or whose name says so. Those cells get the pill, and the tone comes
 * from the entity's own sentiment where it carried one — never from a prop.
 */
function ComparisonTable({ props, group, finding, node, value }: Resolved) {
  const measures = (group ?? (finding ? [finding] : [])).filter(
    (member): member is Extract<Finding, { kind: "comparison" }> => member.kind === "comparison",
  );
  if (measures.length === 0) return escape({ props, value, finding, node }, "Nothing to tabulate.");

  // Row order from the first measure — the one the composer claimed, so the order the
  // analysis put its primary claim in rather than an order chosen here.
  const names = measures[0].entities.map((entity) => entity.name);
  const cellOf = (measure: (typeof measures)[number], name: string) =>
    measure.entities.find((entity) => entity.name === name);

  /*
   * A change column, decided from the numbers rather than from the label alone. Values
   * on both sides of zero are a delta whatever the measure is called; a name that says
   * change, contribution or alpha is one even when this particular set happens to be
   * all positive.
   */
  const isDelta = (measure: (typeof measures)[number]): boolean =>
    /change|delta|diff|alpha|contribut|return|vs\b/i.test(measure.measure) ||
    measure.entities.some((entity) => entity.value < 0);

  return (
    <Block title={str(props.label)} caption={str(props.caption)}>
      <Table>
        <TableHeader>
          <TableRow className={`border-b ${SURFACE.hairline} hover:bg-transparent`}>
            <TableHead className={`${TYPE.label} h-auto px-0 pb-[10px] text-left font-normal`}>
              {str(props.entityHeader) ?? "Name"}
            </TableHead>
            {measures.map((measure) => (
              <TableHead
                key={measure.id}
                className={`${TYPE.label} h-auto px-[12px] pb-[10px] text-right font-normal last:pr-0`}
              >
                {measure.measure}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {names.map((name) => (
            <TableRow key={name} className={`border-b ${SURFACE.hairline} last:border-b-0 hover:bg-black/[0.015]`}>
              <TableCell className={`${TYPE.cell} px-0 py-[11px]`}>{name}</TableCell>
              {measures.map((measure) => {
                const entity = cellOf(measure, name);
                if (!entity) {
                  // A measure that skipped this entity. An em dash, not a zero: the
                  // analysis did not claim nothing, it claimed nothing.
                  return (
                    <TableCell key={measure.id} className={`${TYPE.cellMuted} px-[12px] py-[11px] text-right last:pr-0`}>
                      —
                    </TableCell>
                  );
                }
                const shown = entity.display ?? figure(entity.value, measure.measure);
                return (
                  <TableCell
                    key={measure.id}
                    className={`${TYPE.cell} px-[12px] py-[11px] text-right tabular-nums last:pr-0`}
                  >
                    {isDelta(measure) ? <span className={pill(toneOf(entity.value))}>{shown}</span> : shown}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Block>
  );
}

/* --------------------------------------------------- new: flat document bar chart */

/**
 * Bars with their values written on them, one subject and the rest as context.
 *
 * Also a replacement rather than a reuse, for a reason that is about meaning and not
 * taste: prototype 1's BarChart colours every bar from the palette, which tells the
 * reader that the categories differ in kind. In an exposure or allocation view they do
 * not — one of them is *the point* and the others exist to show it is large. So one bar
 * takes the ink and the rest go grey, and which one is chosen comes from the finding's
 * own emphasis, never from a prop.
 *
 * No axis and no gridlines: every value is printed above its bar, which is strictly
 * more precise than a reader interpolating against a scale.
 */
function BarChartFlat({ props, finding, value, node }: Resolved) {
  type Part = { label: string; value: number; display?: string };
  const parts: Part[] =
    finding?.kind === "composition"
      ? /*
         * A composition's values are *shares* — 0.29, not 29 — which the schema states
         * and this chart has to honour. Formatting them with the generic percentage
         * helper printed "+0.3%" for a 29% holding: not a rounder version of the truth
         * but a different number, and the one case on the page where being out by two
         * orders of magnitude looks plausible. Parts carry no `display`, so the share
         * is formatted here, once.
         */
        finding.parts.map((part) => ({
          label: part.label,
          value: part.value,
          // One decimal only where it says something: "8%", not "8.0%".
          display: `${Number((part.value * 100).toFixed(1))}%`,
        }))
      : finding?.kind === "comparison"
        ? finding.entities.map((entity) => ({ label: entity.name, value: entity.value, display: entity.display }))
        : (Array.isArray(value) ? value : [])
            .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
            .map((entry) => ({
              label: text(entry.label ?? entry.name),
              value: typeof entry.value === "number" ? entry.value : 0,
              display: str(entry.display),
            }));

  if (parts.length === 0) return escape({ props, finding, value, node }, "Nothing to chart.");

  const peak = Math.max(...parts.map((part) => Math.abs(part.value)), 1);
  /*
   * The subject is the largest share — what a concentration or allocation finding is
   * about — derived rather than passed, so no prop can point the emphasis elsewhere.
   *
   * Residual buckets are excluded from the running. "Other" is not a holding; it is
   * everything the analysis chose not to name, and giving it the ink tells the reader
   * the report is about the part it declined to break out.
   */
  const named = parts.filter((part) => !/^(others?|misc|remaining|unclassified)\b/i.test(part.label));
  const ranked = named.length > 0 ? named : parts;
  const subject = ranked.reduce((best, part) => (Math.abs(part.value) > Math.abs(best.value) ? part : best), ranked[0]);

  return (
    <Block
      title={str(props.label)}
      aside={
        <div className="flex items-center gap-[14px]">
          {[
            { name: str(props.subjectLabel) ?? "Current", hex: CHART.primary },
            { name: str(props.contextLabel) ?? "Others", hex: CHART.context },
          ].map((key) => (
            <span key={key.name} className={`${TYPE.caption} inline-flex items-center gap-[6px]`}>
              <span className="h-[8px] w-[8px] rounded-full" style={{ background: key.hex }} />
              {key.name}
            </span>
          ))}
        </div>
      }
    >
      <div className="flex items-end gap-[8px]" style={{ height: 150 }}>
        {parts.slice(0, 9).map((part) => {
          const on = part.label === subject.label;
          return (
            <div key={part.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-[6px]">
              <div className={`${TYPE.caption} tabular-nums ${on ? "font-medium text-[#171615]" : ""}`}>
                {part.display ?? figure(part.value, "pct")}
              </div>
              <div
                className="w-full rounded-t-[4px]"
                style={{
                  // A floor of 3px, so a 0.4% slice is still visibly a bar rather than
                  // a missing one. It distorts the ramp; a bar you cannot see is worse.
                  height: `${Math.max(3, (Math.abs(part.value) / peak) * 104)}px`,
                  background: on ? CHART.primary : CHART.context,
                }}
              />
              <div className={`${TYPE.caption} w-full truncate text-center`} title={part.label}>
                {part.label}
              </div>
            </div>
          );
        })}
      </div>
    </Block>
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
    <Block title={finding.label} caption={measures.length > 0 ? `Also weighed: ${measures.map(humanise).join(" · ")}` : undefined}>
      <div
        className={rows ? "flex flex-col gap-[10px]" : "grid gap-[10px]"}
        style={rows ? undefined : { gridTemplateColumns: `repeat(${finding.entities.length}, minmax(0, 1fr))` }}
      >
        {finding.entities.map((entity) => (
          <Tile
            key={entity.name}
            label={entity.name}
            value={entity.display ?? group(entity.value)}
            caption={humanise(finding.measure)}
          />
        ))}
      </div>
    </Block>
  );
}

/* --------------------------------------------------------- new: text blocks */

function KeyValueList({ props, value, finding, node }: Resolved) {
  const rows = rowsFrom(value);
  if (rows.length === 0) return escape({ props, value, finding, node }, "No attributes to list.");
  return (
    <Block title={str(props.label)}>
      <Rows rows={rows} columns={props.columns === 2 ? 2 : 1} />
    </Block>
  );
}

function Timeline({ props, value, finding, node }: Resolved) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return escape({ props, value, finding, node }, "No dated events.");

  return (
    <Block title={str(props.label)}>
      <ol className="flex flex-col">
        {items.map((item, index) => {
          const entry = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
          return (
            <li
              key={text(entry.label ?? entry.date ?? index)}
              className={`flex gap-[14px] border-b ${SURFACE.hairline} py-[11px] last:border-b-0`}
            >
              <div className={`${TYPE.label} w-[96px] shrink-0 tabular-nums`}>
                {text(entry.date ?? entry.label ?? entry.when)}
              </div>
              <div className={`${TYPE.cell} min-w-0`}>
                {text(entry.text ?? entry.detail ?? entry.display ?? entry.value)}
              </div>
            </li>
          );
        })}
      </ol>
    </Block>
  );
}

function NewsImpact({ props, value, finding, node }: Resolved) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return escape({ props, value, finding, node }, "No market context.");
  const limit = typeof props.limit === "number" ? props.limit : 4;

  return (
    <Block title={str(props.heading) ?? "Market context"}>
      <ul className="flex flex-col">
        {items.slice(0, limit).map((item, index) => {
          const entry = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
          return (
            <li key={text(entry.headline ?? index)} className={`border-b ${SURFACE.hairline} py-[11px] last:border-b-0`}>
              <div className={`${TYPE.cell} font-medium`}>{text(entry.headline ?? entry.title)}</div>
              <div className={`${TYPE.caption} mt-[3px]`}>{text(entry.impact ?? entry.text ?? entry.detail)}</div>
            </li>
          );
        })}
      </ul>
    </Block>
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
      <Block title={title ?? fallbackLabel} caption={title ? fallbackLabel : undefined}>
        <Rows rows={rows.filter((row) => !hidden.has(row.label))} />
      </Block>
    );
  };
  return EntityCard;
}

function SourceList({ props, value, provenance }: Resolved) {
  const rows = rowsFrom(value);
  const asOf = provenance?.asOf;
  if (rows.length === 0 && !asOf) return <Empty what="No sources recorded." />;

  return (
    <Block
      title={str(props.label) ?? "Sources"}
      caption={provenance?.tool ? `via ${provenance.tool}${asOf ? ` · as at ${asOf}` : ""}` : undefined}
    >
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.label}
            className={`flex items-baseline justify-between gap-[16px] border-b ${SURFACE.hairline} py-[8px] last:border-b-0`}
          >
            <span className={TYPE.cellMuted}>{row.label}</span>
            <span className={`${TYPE.caption} tabular-nums`}>{row.value}</span>
          </li>
        ))}
      </ul>
    </Block>
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
    <Block title={str(props.label)}>
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
    </Block>
  );
}

/* ------------------------------------------------------------- adaptations */

/**
 * A metric, at the weight the node asked for — and always the same component.
 *
 * It used to hand the finding to prototype 1's `HeroMetric` or `StatTile` depending on
 * the weight, which are two different widgets: 34px in a bordered panel with a
 * sparkline, or 22px in a card with no caption and different padding. Two figures
 * sitting side by side in one row therefore came out at two type sizes and two
 * heights, which reads as two kinds of information rather than as two peers. One
 * component now draws every figure in the report, and weight changes the type size
 * only. The history stays available to a figure standing on its own; peers in a row
 * never get it, because a spark under one of four cards is the unevenness again.
 */
const metric: Leaf = ({ props, finding, value, node }) => {
  const large = props.variant === "hero" || props.size === "lg";

  if (finding?.kind === "metric") {
    return (
      <Tile
        label={humanise(finding.label)}
        value={finding.value}
        caption={finding.basis}
        delta={finding.delta}
        size={large ? "lg" : "sm"}
        spark={
          large && isPlottable(finding.series) && finding.series ? (
            <LineSvg series={finding.series} color={CHART.primary} height={64} />
          ) : undefined
        }
      />
    );
  }

  // A metric node bound to something else still has one honest rendering: the raw
  // labelled value from the bundle.
  const entry = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  if (!entry) return escape({ props, finding, value, node }, "No figure to show.");
  return (
    <Tile
      label={humanise(str(props.label) ?? text(entry.label ?? node.dataKey?.split(".").at(-1)))}
      value={str(entry.display) ?? figure(entry.value, text(props.label ?? entry.label ?? node.dataKey))}
      caption={str(entry.secondary) ?? str(entry.detail)}
      delta={
        typeof entry.delta === "object" && entry.delta !== null
          ? (entry.delta as { label: string; value?: number })
          : undefined
      }
      size={large ? "lg" : "sm"}
    />
  );
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
  // Flat document table, not prototype 1's bordered widget — see `DataTable` above.
  DataTable,
  ComparisonTable,
  RankedList: bars,
  Timeline,
  KeyValueList,

  LineChart: line,
  BarChart: BarChartFlat,
  AllocationDonut: guarded("DonutChart", ["composition"], "No composition to draw."),
  ExposureHeatmap,

  Prose,
  BulletSummary,

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
