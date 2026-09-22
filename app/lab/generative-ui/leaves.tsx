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

import {
  Activity,
  Building2,
  ChevronRight,
  Circle,
  FileText,
  Landmark,
  Newspaper,
  Percent,
  Sparkles,
  TrendingUp,
  User,
  Warehouse,
} from "lucide-react";
import React from "react";
import { RENDERER_COMPONENTS } from "../dynamic-ui/renderers";
import {
  CapitalFlowBlock,
  ChecklistBlock,
  FlagBlock,
  NarrativeBlock,
  RecommendationBlock,
  RequirementBlock,
  TransitionBlock,
  emphasise,
} from "./blocks";
import { BarsFigure, DonutFigure, LineFigure, SparkFigure, barsLegend, share } from "./charts";
import { Block, Card, DeltaChip, Empty, Figure, INK, LABEL, Rows, Tile } from "./chrome";
import { markFor } from "./marks";
import { PALETTE, RHYTHM, SEVERITY, SURFACE, TONE, TYPE, pill, toneOf } from "./ds";
import { isPlottable, type Delta, type Finding, type Series } from "./findings";
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
/**
 * How a raw number reads, given whatever names it.
 *
 * `quarterChangePct: 3.8` rendered as "3.8" is not a smaller version of the truth, it is a
 * different number — 3.8 what? The unit is already stated, in the field name or the
 * measure's label, so reading it there is translation rather than invention: no unit in
 * the name, no unit on the page.
 *
 * The currency comes from the hint too. It used to be hardcoded to S$, which on a book
 * reported in US dollars printed a figure that was wrong by the exchange rate and looked
 * entirely plausible — the worst kind of wrong a report can be.
 *
 * Stated limit: the right home for this is layer 2, emitting `{value, display}` for every
 * figure the way `MetricFinding.value` already arrives pre-formatted. Until the tools do
 * that, a node bound directly to a field lands here.
 */
const formatterFor = (hint: string): ((value: number) => string) => {
  const currency = /US\$/i.test(hint)
    ? "US$"
    : /S\$/.test(hint)
      ? "S$"
      : /€|\bEUR\b/.test(hint)
        ? "€"
        : /£|\bGBP\b/.test(hint)
          ? "£"
          : "";
  if (/%|pct|percent|share|weight/i.test(hint)) {
    return (value) => (Math.abs(value) <= 1 ? share(value) : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`);
  }
  if (/bps/i.test(hint)) return (value) => `${group(value)} bps`;
  if (/\$m|\bm\b|millions?|value|amount|cost|gain|market|worth|cash|balance/i.test(hint)) {
    return (value) =>
      Math.abs(value) >= 1 || value === 0
        ? `${currency}${value.toFixed(1)}m`
        : `${currency}${Math.round(value * 1000)}k`;
  }
  return (value) => group(Number(value.toFixed(2)));
};

const figure = (value: unknown, hint = ""): string =>
  typeof value === "number" ? formatterFor(hint)(value) : text(value);

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
  /* The closing passage resolves to a pair rather than a string — text plus the name under
     it. Both are the report's own words; see `outlook` in ./semantic.ts. */
  const pair =
    value && typeof value === "object" && "text" in value
      ? (value as { text: string; signature?: string })
      : undefined;
  const passage =
    finding && "text" in finding && typeof finding.text === "string"
      ? finding.text
      : typeof value === "string"
        ? value
        : pair?.text;
  if (!passage) return <Empty what="No passage to show." />;

  const variant = str(props.variant) ?? "body";
  const heading = str(props.heading) ?? (finding && "heading" in finding ? str(finding.heading) : undefined);
  /* The readout and the takeaway beside it are one band, read in one glance, so they are
     set at one size. They were 16px and 15px, which is not a hierarchy — at a difference
     that small it reads as a mistake rather than as emphasis, and the emphasis is already
     carried by the wash, the mark and the column widths. */
  const lede = variant === "lead" || variant === "readout" || variant === "aside";
  const body = lede ? TYPE.bodyLead : TYPE.body;

  const paragraphs = passage.split(/\n{2,}/).map((para, index) => (
    <p key={index} className={`${body} ${index === 0 ? "" : "mt-[12px]"}`}>
      {emphasise(para)}
    </p>
  ));

  /*
   * The opening statement, washed and marked — the one passage on the page that is framed.
   *
   * It earns the frame because it is the only thing a reader who reads nothing else will
   * read, and because the frame is what says "this is the answer" rather than "this is the
   * first section". Everything below it is deliberately flat, so one washed panel reads as
   * emphasis; two would read as a dashboard again.
   *
   * The tone is `TONE.positive` because a readout is a conclusion, not a warning, and the
   * severity palette is reserved for things that need attention. No hue is chosen here.
   */
  /*
   * The closing passage, and the name under it.
   *
   * A tinted band rather than a washed panel, and it sits at the foot of the page, so it
   * reads as the end of a note rather than a second answer. The signature is set as a
   * caption above a hairline — small, because it is attribution and not a claim.
   */
  if (variant === "outlook") {
    return (
      <div className={`${SURFACE.inset} px-[20px] py-[18px]`}>
        {heading ? <div className={`${TYPE.sectionTitle} mb-[8px]`}>{heading}</div> : null}
        {paragraphs}
        {pair?.signature ? (
          <div className={`mt-[14px] border-t pt-[10px] ${SURFACE.hairline} ${TYPE.caption}`}>
            {pair.signature}
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === "readout") {
    /* Amber, not green — see `SURFACE.generated`. The wash says "a machine wrote this";
       green in this document is reserved for saying a number went the client's way. */
    const hex = PALETTE.ai;
    return (
      <div className={`${SURFACE.generated} flex gap-[14px] p-[20px]`}>
        <span
          className="mt-[3px] grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full"
          style={{ background: `${hex}1F`, color: hex }}
          aria-hidden
        >
          <Sparkles className="h-[15px] w-[15px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          {heading ? (
            <div
              className="mb-[8px] font-satoshi text-[10px] font-bold uppercase tracking-[0.11em]"
              style={{ color: hex }}
            >
              {heading}
            </div>
          ) : null}
          {paragraphs}
        </div>
      </div>
    );
  }

  /*
   * The one line worth remembering, in a narrow panel beside the readout.
   *
   * It is a panel with a micro-label *inside* it, not a section with a heading above it,
   * and the difference is the whole point: at section weight, "Key takeaway" set in serif
   * over a grey box competed with the numbered headings and read as a seventh section
   * wedged into the top of the page. The label belongs to the panel the way a caption
   * belongs to a photograph — small, uppercase, and clearly subordinate to the sentence it
   * introduces.
   *
   * No border and a flat wash, so it reads as a quieter neighbour of the readout rather
   * than as a competing card. Full height, because it sits in a two-column band and a
   * short panel floating beside a tall one looks unfinished.
   */
  if (variant === "aside") {
    return (
      <div className={`flex h-full flex-col rounded-[12px] ${SURFACE.inset} p-[18px]`}>
        {heading ? (
          <div className="mb-[8px] font-satoshi text-[10px] font-bold uppercase tracking-[0.11em] text-black/40">
            {heading}
          </div>
        ) : null}
        {paragraphs}
      </div>
    );
  }

  return (
    <Block title={heading}>
      <div className={variant === "note" ? SURFACE.inset : undefined}>{paragraphs}</div>
    </Block>
  );
}

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
function MetricStrip({ node, props, value, finding, group }: Resolved) {
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
    return finding ? metric({ node, props, finding, value }) : <Empty what="No figures for this strip." />;
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
  /* `xDisplay` is the pre-formatted twin of `x` and the cell renderer below already reaches
     for it, so it is not a column of its own. Deriving columns from the row's keys used to
     print both — "Value" beside "Value Display", the same number twice. */
  const keys =
    declared.length > 0
      ? declared.filter((key) => key in rows[0])
      : Object.keys(rows[0]).filter((key) => !(key.endsWith("Display") && key.slice(0, -7) in rows[0]));
  if (keys.length === 0) return escape({ props, value, finding, node }, "No columns to show.");

  const limit = typeof props.limit === "number" ? props.limit : 12;
  const numeric = (key: string) => rows.some((row) => typeof row[key] === "number");
  const isDelta = (key: string) => /change|delta|diff|alpha|contrib/i.test(key);

  return (
    <Block title={str(props.label)} caption={str(props.caption)} boxed>
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
    <Block title={str(props.label)} caption={str(props.caption)} boxed>
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

/* ----------------------------------------------------------- charted findings */

/**
 * The parts a chart draws, from whichever of the three sources this node has.
 *
 * Shared by the bar, donut and ranked-list paths so they cannot disagree about what the
 * finding said. A composition's values are *shares* — 0.29, not 29 — which the schema
 * states and every chart has to honour; formatting them with a generic percentage helper
 * printed "+0.3%" for a 29% holding, which is not a rounder version of the truth but a
 * different number, and the one case on the page where being out by two orders of
 * magnitude looks plausible. Shares carry no `display`, so they are formatted here, once.
 */
type Part = { label: string; value: number; display?: string; delta?: Delta };

const partsOf = (finding: Finding | undefined, value: unknown): { parts: Part[]; shares: boolean } => {
  if (finding?.kind === "composition") {
    return {
      shares: true,
      parts: finding.parts.map((part) => ({
        label: part.label,
        value: part.value,
        display: share(part.value),
        delta: part.delta,
      })),
    };
  }
  if (finding?.kind === "comparison") {
    return {
      shares: false,
      parts: finding.entities.map((entity) => ({
        label: entity.name,
        value: entity.value,
        display: entity.display,
      })),
    };
  }
  return {
    shares: false,
    parts: (Array.isArray(value) ? value : [])
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => ({
        label: text(entry.label ?? entry.name),
        value: typeof entry.value === "number" ? entry.value : 0,
        display: str(entry.display),
      })),
  };
};

/** What the numbers in a chart are measured in, read off whatever named them. */
const chartFormat = (finding: Finding | undefined, props: Record<string, unknown>, node: UINode) =>
  formatterFor(
    [
      finding && "measure" in finding ? finding.measure : undefined,
      finding && "label" in finding ? finding.label : undefined,
      str(props.label),
      node.dataKey,
    ]
      .filter(Boolean)
      .join(" "),
  );

/**
 * Named quantities as horizontal bars — see `BarsFigure` in ./charts.tsx for why
 * horizontal and why one bar takes the ink.
 *
 * The legend is only drawn when the emphasis means something, which is when there is more
 * than one bar to be emphasised against.
 */
function BarChartFlat({ props, finding, value, node }: Resolved) {
  const { parts, shares } = partsOf(finding, value);
  if (parts.length === 0) return escape({ props, finding, value, node }, "Nothing to chart.");

  return (
    <Block
      title={str(props.label)}
      aside={parts.length > 1 ? barsLegend(str(props.subjectLabel) ?? "Largest", str(props.contextLabel) ?? "Rest") : undefined}
      boxed
    >
      <BarsFigure
        parts={parts}
        format={shares ? share : chartFormat(finding, props, node)}
        total={shares ? "Shares of total assets." : undefined}
      />
    </Block>
  );
}

/** Parts of a whole, as a ring with the whole in the middle. */
function AllocationDonut({ props, finding, value, node }: Resolved) {
  const { parts, shares } = partsOf(finding, value);
  if (parts.length === 0) return escape({ props, finding, value, node }, "No composition to draw.");
  return (
    <Block title={str(props.label) ?? (finding && "label" in finding ? finding.label : undefined)} boxed>
      <DonutFigure parts={parts} format={shares ? share : chartFormat(finding, props, node)} />
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
/**
 * A glyph per kind of entity, for the kinds the analysis is allowed to record.
 *
 * Keyed on the closed `nature` enum in ./findings.ts, exactly as `EVENT_MARKS` below is
 * keyed on a timeline row's own `kind`. The mapping lives here because it is presentation;
 * the classification lives in the analysis because it is a claim about what the thing is.
 * An entity with no recorded nature gets no plate — the glyph identifies, and a renderer
 * that guessed "trust" from the word "Trust" in a name would be reading tea leaves.
 */
const ENTITY_MARKS = {
  trust: Landmark,
  company: Building2,
  individual: User,
  account: FileText,
  property: Warehouse,
  fund: Activity,
} as const;

function Comparison({ props, finding, node }: Resolved) {
  if (finding?.kind !== "comparison") return escape({ props, finding, node }, "Nothing to compare.");

  /*
   * The measure is said once, above the row, and never again.
   *
   * Every entity in a comparison is measured on the *same* measure — that is what makes
   * it a comparison — so a caption under each tile repeats one phrase as many times as
   * there are options, and the composer's `measures` prop names that same measure again
   * on top. "Also weighed: Assets held", then "Assets held" three times. What the figures
   * are is a property of the set, so it is stated where the set is named; `measures` only
   * earns a line when it names something the measure does not.
   */
  const shown = humanise(finding.measure);
  const also = (Array.isArray(props.measures) ? props.measures.filter((entry) => typeof entry === "string") : [])
    .map(humanise)
    .filter((name) => name.toLowerCase() !== shown.toLowerCase());
  const rows = props.variant === "rows";

  /*
   * And the measure is not said at all when the figures already say it.
   *
   * The line above earns its place when the tiles show bare numbers — three values of 41,
   * 18.7 and 8.7 mean nothing without "Value held" over them. When every entity carries a
   * pre-formatted `display`, the unit is on the figure: "S$41.0m" under a named entity is
   * already an amount held, and a caption reading "Value held" — or "Amount" over a cash
   * position — is a table's column header stranded above a set of cards. Measures in
   * `props.measures` that name something else still print, because those say something the
   * figures do not.
   */
  const captioned = finding.entities.every((entity) => entity.display) ? also : [shown, ...also];

  return (
    <Block title={finding.label} caption={captioned.length > 0 ? captioned.join(" · ") : undefined}>
      <div
        className={rows ? "flex flex-col gap-[10px]" : "grid gap-[10px]"}
        style={rows ? undefined : { gridTemplateColumns: `repeat(${finding.entities.length}, minmax(0, 1fr))` }}
      >
        {finding.entities.map((entity) => (
          <Tile
            key={entity.name}
            label={entity.name}
            value={entity.display ?? group(entity.value)}
            icon={entity.nature ? ENTITY_MARKS[entity.nature] : undefined}
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

/**
 * Dated events, as a schedule: when, what, how much.
 *
 * Two things this used to get wrong, and both are the same mistake — trusting the bound
 * key further than it deserved.
 *
 * A timeline is chosen from the *finding* (a requirement is something due), but the key it
 * binds to is whichever of the section's `dataKeys` resolved first. On the funding section
 * that is the liquidity list: undated rows, drawn as if they were a calendar, with their
 * bare values in the description column — while the requirement itself, the amount and the
 * deadline that make it urgent, never reached the page at all. So a row with no date is not
 * a timeline entry, and a key with no dated rows means the finding gets drawn instead.
 *
 * And the amount belongs in its own column. Reading `display ?? value` into the description
 * slot printed "S$2.4m" where the name of the commitment should have been, so a five-line
 * calendar said five dates and five figures and never once said what was being paid for.
 */
/**
 * What kind of event this was, as an icon and an ink.
 *
 * Keyed on the data's own `kind` field, so the mapping is a rendering of a recorded
 * category and not a guess made from the sentence. An unrecognised kind — or a row with
 * none — gets the neutral dot, which is what the rail looked like before: a component that
 * invented a category for an event it did not understand would be adding a claim.
 */
const EVENT_MARKS = {
  valuation: { icon: TrendingUp, hex: TONE.positive.hex },
  commitment: { icon: FileText, hex: SEVERITY.info.hex },
  concentration: { icon: Activity, hex: SEVERITY.warn.hex },
  structure: { icon: Landmark, hex: SEVERITY.info.hex },
} as const;

const markOf = (kind: string | undefined): { icon: typeof Circle; hex: string } =>
  (kind && kind in EVENT_MARKS ? EVENT_MARKS[kind as keyof typeof EVENT_MARKS] : undefined) ?? {
    icon: Circle,
    hex: TONE.neutral.hex,
  };

function Timeline(input: Resolved) {
  const { props, value, finding, node } = input;
  const rows = (Array.isArray(value) ? value : []).filter(
    (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
  );
  const dated = rows.filter((entry) => str(entry.date) ?? str(entry.when) ?? str(entry.due));
  if (dated.length === 0) return finding ? insight(input) : escape(input, "No dated events.");

  const hint = str(props.label) ?? node.dataKey ?? "";
  /* The claimed finding is a requirement and the schedule is what it is due within, so
     its note belongs above the schedule rather than nowhere — which is where it went
     when the rows came from the bundle and the finding was only used to pick the form. */
  /* And a narrative claimed by a schedule is the sentence the analysis wrote *about* the
     schedule, which is worth more above it than lost: the form was picked from the dated
     rows, so before this the words the section was written around reached nothing. */
  const caption =
    finding?.kind === "requirement" ? finding.note : finding?.kind === "narrative" ? finding.text : undefined;
  /*
   * Flat where the schedule *is* the section, boxed where it is one card among several.
   *
   * The same component both times, and the difference is not decoration: a panel headed
   * "What changed" directly under a section headed "What changed" says the same words
   * twice a line apart and frames content that already has the page to itself. Beside a
   * sibling card it needs the edge, because there the panel is what separates the two.
   */
  const boxed = props.variant !== "flat";

  /* Shared by both directions, because the fields a row carries are a property of the
     data and not of the axis it is laid out on. */
  const events = dated.map((entry, index) => ({
    key: `${str(entry.date) ?? index}:${index}`,
    when: str(entry.date) ?? str(entry.when) ?? str(entry.due) ?? "",
    what: str(entry.name) ?? str(entry.label) ?? str(entry.text),
    detail:
      str(entry.detail) ??
      str(entry.display) ??
      (typeof entry.value === "number" ? figure(entry.value, hint) : undefined),
    /* A rendering of the field, not a judgement added to it: the analysis recorded how
       firm each date is, and a calendar that hides that reads as certain. */
    firmness: str(entry.confidence),
    /* The mark is read from the data's own `kind`, never inferred from the words: a
       component that guessed "this sounds like a risk" would be adding a claim. */
    mark: markOf(str(entry.kind)),
  }));

  /*
   * Left to right, where the composer asked for it.
   *
   * Same rows, same marks, same hairline logic turned ninety degrees — the rail runs
   * horizontally behind the marks and each event becomes a column under its own date. It
   * is the right shape for a short calendar and the wrong one for a history: the columns
   * are equal width, so a row of unequal prose either wraps into a ragged wall or gets
   * cut. ./compose.ts only sets `direction: "right"` for a commitments section alone in
   * its area, and the cap here is the backstop for that — past six columns there is no
   * width left to read, so it falls back to the vertical form rather than squeezing.
   */
  if (props.direction === "right" && events.length <= 6) {
    return (
      <Block title={boxed ? str(props.label) : undefined} caption={caption} boxed={boxed}>
        <ol className="relative grid gap-x-[20px]" style={{ gridTemplateColumns: `repeat(${events.length}, minmax(0, 1fr))` }}>
          {/* Behind the marks, and inset by half a column at each end so the line starts
              at the first mark and stops at the last rather than running off into margin. */}
          <span
            className="absolute top-[35px] h-[1px] bg-black/[0.10]"
            style={{ left: `${50 / events.length}%`, right: `${50 / events.length}%` }}
            aria-hidden
          />
          {events.map((event) => (
            <li key={event.key} className="relative flex min-w-0 flex-col items-start">
              <div className={`${TYPE.caption} tabular-nums`}>{event.when}</div>
              <span
                className="relative mt-[8px] grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full"
                /* Opaque, so the rail passes behind the mark and not through it. */
                style={{ background: PALETTE.card, color: event.mark.hex }}
                aria-hidden
              >
                <span
                  className="grid h-[28px] w-[28px] place-items-center rounded-full"
                  style={{ background: `${event.mark.hex}14` }}
                >
                  <event.mark.icon className="h-[14px] w-[14px]" strokeWidth={1.9} />
                </span>
              </span>
              <div className={`${TYPE.sectionTitle} mt-[10px]`}>{event.what ?? "—"}</div>
              {event.detail ? <div className={`${TYPE.caption} mt-[3px]`}>{event.detail}</div> : null}
              {event.firmness && event.firmness !== "high" ? (
                <div className={`${TYPE.caption} mt-[2px]`}>{event.firmness} confidence</div>
              ) : null}
            </li>
          ))}
        </ol>
      </Block>
    );
  }

  return (
    <Block title={boxed ? str(props.label) : undefined} caption={caption} boxed={boxed}>
      {/* Date, mark, event — three columns and a rail.
          The date moves into its own column because a reader scanning a schedule scans
          dates, and a date set above its own event turns four events into eight lines. The
          rail runs behind the marks so the rows stay in normal flow and a long description
          still wraps under itself; the hairlines are what make each row one event. */}
      <ol className="relative flex flex-col">
        {/* 88px date column + 16px gap + half of the 32px mark column. */}
        <span className="absolute top-[26px] bottom-[26px] left-[120px] w-[1px] bg-black/[0.10]" aria-hidden />
        {events.map(({ key, when, what, detail, firmness, mark }) => {
          return (
            <li
              key={key}
              className={`grid grid-cols-[88px_32px_minmax(0,1fr)] items-start gap-x-[16px] border-t py-[14px] first:border-t-0 ${SURFACE.hairline}`}
            >
              <div className={`${TYPE.caption} pt-[7px] tabular-nums`}>{when}</div>
              <div className="flex justify-center pt-[2px]">
                <span
                  className="grid h-[28px] w-[28px] place-items-center rounded-full"
                  style={{ background: `${mark.hex}14`, color: mark.hex }}
                  aria-hidden
                >
                  <mark.icon className="h-[14px] w-[14px]" strokeWidth={1.9} />
                </span>
              </div>
              <div className="min-w-0">
                <div className={TYPE.sectionTitle}>{what ?? "—"}</div>
                {detail ? <div className={`${TYPE.caption} mt-[3px]`}>{detail}</div> : null}
                {firmness && firmness !== "high" ? (
                  <div className={`${TYPE.caption} mt-[2px]`}>{firmness} confidence on the date</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Block>
  );
}

/**
 * A glyph per kind of market move, on the same terms as `ENTITY_MARKS`.
 *
 * Each row of market context is one of a handful of things — a price move, a rate
 * decision, a change in supply — and the row records which. The glyph is looked up from
 * that record, with the neutral `Newspaper` for a row whose kind is absent or unknown, so
 * a new category shows up as an unmarked row rather than as a wrong icon.
 */
const MARKET_MARKS: Record<string, typeof Newspaper> = {
  prices: TrendingUp,
  rates: Percent,
  supply: Building2,
  demand: Activity,
  regulation: Landmark,
  currency: FileText,
};

/**
 * A card per item, because an external claim has to carry its attribution.
 *
 * This was three rows of a list: a headline, the sentence saying what it bears on, and a
 * glyph. Everything on the rest of the page comes out of her own file, and these three do
 * not — they are published third-party data, and a market claim that does not say who
 * published it or when is not context, it is hearsay. So the card shows the topic, the
 * headline, what it means for this book, the date and the publication, and links out to the
 * article. The first gets the larger treatment because it is the one the analysis put first.
 *
 * The image is furniture and is treated as such: `object-cover` inside a fixed plate, the
 * headline over a scrim on the lead card, and a missing file degrades to the tinted plate
 * rather than to a broken-image glyph. Nothing in the picture carries information — a reader
 * who cannot see it loses no claim, which is the test for anything decorative on this page.
 */
type NewsItem = {
  kind?: string;
  topic?: string;
  headline?: string;
  title?: string;
  impact?: string;
  text?: string;
  detail?: string;
  takeaway?: string;
  date?: string;
  source?: string;
  url?: string;
  image?: string;
};

/** The plate, with the art if it loads and without it if it does not. */
function Art({ src, alt, height, children }: { src?: string; alt: string; height: number; children?: React.ReactNode }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="relative w-full overflow-hidden bg-[#eeece6]" style={{ height }}>
      {src && !failed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : null}
      {children}
    </div>
  );
}

function NewsImpact({ props, value, finding, node }: Resolved) {
  const items = (Array.isArray(value) ? value : []).filter(
    (item): item is NewsItem => typeof item === "object" && item !== null,
  );
  if (items.length === 0) return escape({ props, value, finding, node }, "No market context.");
  const limit = typeof props.limit === "number" ? props.limit : 4;
  const shown = items.slice(0, limit);
  const [lead, ...rest] = shown;
  const takeaways = shown.map((item) => item.takeaway).filter((line): line is string => Boolean(line));

  const headlineOf = (item: NewsItem) => text(item.headline ?? item.title);
  const bodyOf = (item: NewsItem) => text(item.impact ?? item.text ?? item.detail);

  const attribution = (item: NewsItem) =>
    item.date || item.source ? (
      <span className={`${TYPE.caption} shrink-0`}>{[item.date, item.source].filter(Boolean).join(" · ")}</span>
    ) : null;

  const readMore = (item: NewsItem) =>
    item.url ? (
      <a
        href={item.url}
        className={`${TYPE.cell} inline-flex items-center gap-[4px] font-medium text-[#7F4E0B] no-underline hover:underline`}
      >
        Read full article
        <ChevronRight size={13} strokeWidth={2} />
      </a>
    ) : null;

  const eyebrow = (item: NewsItem, onDark = false) =>
    item.topic ? (
      <div
        className={`text-[10px] font-medium tracking-[0.09em] uppercase ${onDark ? "text-white/75" : ""}`}
        style={onDark ? undefined : { color: PALETTE.muted }}
      >
        {item.topic}
      </div>
    ) : null;

  return (
    <Block title={str(props.heading) ?? "Market context"}>
      <div className={`grid gap-[18px] ${rest.length > 0 ? "md:grid-cols-[1.4fr_1fr_1fr]" : ""}`}>
        {/* The lead: art with the headline over it, and the reading below the fold of the
            plate where a paragraph has its full measure. */}
        <article
          className={`flex min-w-0 flex-col overflow-hidden rounded-[12px] border bg-[#fffefa] ${SURFACE.hairline}`}
        >
          <Art src={lead.image} alt={headlineOf(lead)} height={300}>
            <div className="absolute inset-0 flex flex-col justify-end bg-[linear-gradient(180deg,rgba(0,0,0,0)_38%,rgba(0,0,0,0.72)_100%)] p-[20px]">
              {eyebrow(lead, true)}
              <h4 className="mt-[6px] font-satoshi text-[21px] leading-[1.22] font-medium tracking-[-0.34px] text-white">
                {headlineOf(lead)}
              </h4>
            </div>
          </Art>
          <div className="flex flex-1 flex-col gap-[14px] p-[20px]">
            <p className={`${TYPE.body} m-0`}>{bodyOf(lead)}</p>
            <div className="mt-auto flex items-baseline justify-between gap-[14px]">
              {readMore(lead)}
              {attribution(lead)}
            </div>
          </div>
        </article>

        {rest.map((item) => (
          <article
            key={headlineOf(item)}
            className={`flex min-w-0 flex-col overflow-hidden rounded-[12px] border bg-[#fffefa] ${SURFACE.hairline}`}
          >
            <Art src={item.image} alt={headlineOf(item)} height={148} />
            <div className="flex flex-1 flex-col gap-[10px] p-[18px]">
              {eyebrow(item)}
              <h4 className="m-0 font-satoshi text-[16px] leading-[1.28] font-medium tracking-[-0.24px]">
                {headlineOf(item)}
              </h4>
              <p className={`${TYPE.body} m-0`}>{bodyOf(item)}</p>
              <div className="mt-auto flex flex-col gap-[6px] pt-[4px]">
                {readMore(item)}
                {attribution(item)}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/*
       * And the line that makes this context rather than news.
       *
       * Each item is external; each takeaway is about her book, and it comes from the
       * analysis — the renderer picks no favourites and writes nothing. The band only exists
       * when the items carry takeaways, so a feed with no bearing on the portfolio simply
       * does not get one.
       */}
      {takeaways.length > 0 ? (
        <div className={`mt-[18px] grid gap-[18px] rounded-[12px] border p-[20px] md:grid-cols-[auto_repeat(3,minmax(0,1fr))] ${SURFACE.hairline}`}>
          <div className="font-satoshi text-[14px] leading-[1.3] font-medium tracking-[-0.2px] md:max-w-[130px]">
            Key takeaways for your portfolio
          </div>
          {takeaways.map((line, index) => (
            <div key={line} className="flex min-w-0 gap-[10px] md:border-l md:border-black/[0.07] md:pl-[18px]">
              <span className="shrink-0 font-satoshi text-[12px] tracking-[0.02em] tabular-nums" style={{ color: PALETTE.line }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={`${TYPE.body}`}>{line}</span>
            </div>
          ))}
        </div>
      ) : null}
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
    <Block title={str(props.label)} boxed>
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
  /*
   * A box only where a box means something.
   *
   * `SURFACE.tile` is for a figure being scanned against its peers, and a figure on its
   * own inside a section has no peers — so one bordered card sitting alone under a
   * heading, mid-column, reads as something left over from a row that is not there. That
   * is exactly what "Instruments in the listed book / 5" looked like. The headline strip
   * still boxes, because there the set is the point; the lead figure of a section still
   * boxes, because it is the section's plaque. Everything else is a figure in the flow.
   */
  const Shape = large ? Tile : Figure;

  if (finding?.kind === "metric") {
    return (
      <Shape
        label={humanise(finding.label)}
        value={finding.value}
        caption={finding.basis}
        delta={finding.delta}
        size={large ? "lg" : "sm"}
        /* The instrument's own logo, where the finding named one. A lookup on a ticker the
           analysis supplied, not a guess from the words of the label — see ./marks.ts. */
        mark={markFor(finding.symbol)}
        spark={
          large && isPlottable(finding.series) && finding.series ? (
            <SparkFigure series={finding.series} height={48} />
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
    <Shape
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
/**
 * A line chart, from whichever findings carry a history.
 *
 * Two or more entities with their own series go on *one* shared scale, which is the piece
 * of knowledge worth keeping from the earlier renderers: separately scaled lines drawn
 * side by side tell the reader they can be compared when they cannot. The interactive
 * readout is what makes the chart worth having at all — see ./charts.tsx.
 */
const line: Leaf = ({ props, finding, node, value }) => {
  if (!finding) return escape({ props, finding, node, value }, "No series to draw.");

  const series: Series[] =
    finding.kind === "comparison"
      ? finding.entities.filter((entity) => isPlottable(entity.series)).map((entity) => entity.series as Series)
      : (finding.kind === "trend" || finding.kind === "metric") && isPlottable(finding.series)
        ? [finding.series as Series]
        : [];
  if (series.length === 0) return escape({ props, finding, node, value }, "No series to draw.");

  if (bool(props.sparkline)) return <SparkFigure series={series[0]} />;

  return (
    <Block title={str(props.label) ?? ("label" in finding ? finding.label : undefined)} boxed>
      <LineFigure series={series} format={chartFormat(finding, props, node)} />
    </Block>
  );
};

/**
 * A conclusion, rendered as whatever kind of conclusion it is.
 *
 * One registry id over three finding kinds, because to the composer they are one thing —
 * "the point of this section" — and to a reader they are not: a transition wants its two
 * states side by side, a requirement wants its date next to its amount, and a narrative
 * wants to be a paragraph. See ./blocks.tsx.
 */
const insight: Leaf = (input) => {
  const { finding } = input;
  if (!finding) return escape(input, "No conclusion to show.");
  if (finding.kind === "transition") return <TransitionBlock finding={finding} />;
  if (finding.kind === "requirement") return <RequirementBlock finding={finding} />;
  if (finding.kind === "narrative") return <NarrativeBlock finding={finding} />;
  return escape(input, "No conclusion to show.");
};

const flag: Leaf = (input) =>
  input.finding?.kind === "flag" ? (
    <FlagBlock finding={input.finding} />
  ) : input.finding?.kind === "transition" ? (
    <TransitionBlock finding={input.finding} />
  ) : (
    escape(input, "Nothing flagged.")
  );

const recommendation: Leaf = (input) =>
  input.finding?.kind === "recommendation" ? (
    <RecommendationBlock finding={input.finding} />
  ) : (
    escape(input, "No recommendation.")
  );

const capitalFlow: Leaf = (input) =>
  input.finding?.kind === "transition" ? (
    <CapitalFlowBlock finding={input.finding} />
  ) : (
    escape(input, "No transfer to show.")
  );

const checklist: Leaf = (input) =>
  input.finding?.kind === "checklist" ? <ChecklistBlock finding={input.finding} /> : escape(input, "No open items.");

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
  RankedList: BarChartFlat,
  Timeline,
  KeyValueList,

  LineChart: line,
  BarChart: BarChartFlat,
  AllocationDonut,
  ExposureHeatmap,

  Prose,
  BulletSummary,

  InsightCard: insight,
  RiskAlert: flag,
  CapitalFlow: capitalFlow,
  Recommendation: recommendation,
  NewsImpact,
  Checklist: checklist,
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
  | "Carousel"
  | "Stack"
  | "Tabs"
  | "SplitPane"
  | "Disclosure"
  | "WhatToWatch";

export const isLeafId = (id: ComponentId): id is Exclude<ComponentId, LayoutId> => id in LEAF_COMPONENTS;
