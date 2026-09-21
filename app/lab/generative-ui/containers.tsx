"use client";

/**
 * Phase 2 — the container half of the registry.
 *
 * These are the seven components prototype 1 could not have. Its renderer map was
 * `Record<RendererId, (props: { finding }) => ReactNode>`, which has no notion of
 * children at all, and that — not a missing implementation — is why tabs, grids and
 * disclosure were unreachable there. The moment the spec became a tree, they became
 * ordinary.
 *
 * A container never sees data. It receives already-rendered children and the node's
 * presentation props, and arranges them. That is the whole reason the "the composer
 * cannot change the numbers" guarantee survives arrangement decisions: there is no
 * channel through which arrangement could reach a figure.
 *
 * `WhatToWatch` lives here rather than in ./leaves.tsx because it takes children,
 * even though the registry files it under intelligence.
 */

import React from "react";
import { InSection, LABEL, Rule } from "./chrome";
import { RHYTHM, SURFACE, TYPE } from "./ds";
import type { LayoutId } from "./leaves";
import type { UINode } from "./spec";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { cn } from "./ui/lib/cn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export type ContainerInput = {
  node: UINode;
  props: Record<string, unknown>;
  /** Rendered flat children, in order. */
  children: React.ReactNode[];
  /** Rendered named regions — Tabs' labels, SplitPane's two sides. */
  slots: Record<string, React.ReactNode[]>;
  /**
   * The view's title, from the semantic report.
   *
   * Passed in rather than taken from props because a title is a fact about the
   * report, and PageHeader has no `title` prop for exactly that reason — the
   * composer may choose the eyebrow and the subtitle, never the title.
   */
  docTitle?: string;
};

export type Container = (input: ContainerInput) => React.ReactNode;

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/* ------------------------------------------------------------------- header */

/**
 * The document's masthead: serif title, one line of purpose, then a rule.
 *
 * The rule is not decoration — it is what tells the reader the header has ended and the
 * report has begun, which is the job a card border used to do badly for every block at
 * once. The short darker segment at its left is the only flourish in the document, and
 * it earns its place by giving the eye a start point on a very wide measure.
 */
const PageHeader: Container = ({ props, docTitle }) => (
  <header>
    {str(props.eyebrow) ? <div className={`${TYPE.label} mb-[10px]`}>{props.eyebrow as string}</div> : null}
    <h1 className={TYPE.docTitle}>{docTitle ?? "Report"}</h1>
    {str(props.subtitle) ? <p className={`${TYPE.docSubtitle} mt-[8px]`}>{props.subtitle as string}</p> : null}
    <div className="mt-[22px] flex items-center">
      <span className="h-[2px] w-[80px] bg-[#171615]/70" />
      <span className={`h-px flex-1 border-t ${SURFACE.hairline}`} />
    </div>
  </header>
);

/* -------------------------------------------------------------------- flow */

/**
 * A titled region. Same framing as `Block`, because they are the same idea seen from
 * the two sides of the tree — a container with a heading, and a leaf with a heading.
 *
 * `variant: "bordered"` still boxes the section, but it is now the tinted inset rather
 * than a white panel, so a section the composer chose to set apart reads as set apart
 * instead of as one more card among cards.
 */
const Section: Container = ({ props, children }) => (
  <section className={props.variant === "bordered" ? `${SURFACE.inset} py-[20px]` : undefined}>
    {str(props.heading) ? <h2 className={TYPE.sectionTitle}>{props.heading as string}</h2> : null}
    {str(props.caption) ? <p className={`${TYPE.sectionCaption} mt-[3px]`}>{props.caption as string}</p> : null}
    {/* Declares what it printed, so a leaf inside it does not print the same words
        again. See `InSection` in ./chrome.tsx. */}
    <InSection heading={str(props.heading)}>
      <div className={`${str(props.heading) || str(props.caption) ? "mt-[16px]" : ""} ${RHYTHM.block}`}>{children}</div>
    </InSection>
  </section>
);

/**
 * Three gaps, and `normal` is the document rhythm rather than a card gutter.
 *
 * 28px between siblings is the measurement that does the most work in this whole
 * change. The old 12px was a grid gutter, and at 12px eight blocks read as one
 * undifferentiated mass, which is why the page needed borders to separate them at all.
 * Give the blocks air and the borders become unnecessary.
 */
const GAPS: Record<string, string> = { tight: "gap-[14px]", normal: "gap-[28px]", loose: "gap-[40px]" };

const Stack: Container = ({ props, children }) => (
  <div className={`flex flex-col ${GAPS[String(props.gap)] ?? GAPS.normal}`}>{children}</div>
);

/** Static class names, because Tailwind cannot see a computed one. */
const COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

const Grid: Container = ({ props, children }) => (
  <div className={`grid gap-[24px] ${COLUMNS[Number(props.columns)] ?? COLUMNS[2]}`}>
    {children.map((child, index) => (
      // Index keys are safe here: the child list is positional and its order is
      // fixed by the spec, and the real identity lives on the node ids one level down.
      <div key={index} className="min-w-0">
        {child}
      </div>
    ))}
  </div>
);

const RATIOS: Record<string, string> = {
  even: "md:grid-cols-2",
  "wide-left": "md:grid-cols-[3fr_2fr]",
  "wide-right": "md:grid-cols-[2fr_3fr]",
};

const SplitPane: Container = ({ props, slots }) => (
  <div className={`grid grid-cols-1 gap-[14px] ${RATIOS[String(props.ratio)] ?? RATIOS.even}`}>
    {(["left", "right"] as const).map((side) => (
      <div key={side} className="flex min-w-0 flex-col gap-[8px]">
        {str(props[`${side}Label`]) ? <div className={LABEL}>{props[`${side}Label`] as string}</div> : null}
        <div className="flex flex-col gap-[12px]">{slots[side] ?? null}</div>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------ stateful containers */

/**
 * Built on Radix by way of shadcn, not on two buttons and a `useState`.
 *
 * The hand-rolled version that was here got the visuals right and the behaviour
 * wrong: no arrow-key navigation between tabs, no roving tabindex, no
 * `aria-controls`/`aria-labelledby` pairing between a trigger and its panel. Those
 * are not polish — a generated view can put a table or a chart behind a tab, and a
 * tabstrip you cannot reach with a keyboard hides data from anyone not using a mouse.
 *
 * Radix is uncontrolled here (`defaultValue`) because tab selection is transient view
 * state that nothing else reads. `slots` is keyed by the tab label the composer chose,
 * so the label doubles as the Radix value — fine, because label uniqueness is already
 * guaranteed: they are object keys.
 */
function TabsView({ props, slots }: ContainerInput) {
  const names = Object.keys(slots);
  const preferred = str(props.defaultTab);
  const first = preferred && names.includes(preferred) ? preferred : names[0];
  const pill = props.variant === "pill";

  return (
    <Tabs defaultValue={first} className="flex flex-col gap-[12px]">
      {/* shadcn's default TabsList is a filled pill tray. Both of our variants
          override it, so the classes it brings are undone rather than tuned — the
          value we keep from the component is the Radix wiring, not its skin. */}
      <TabsList
        className={cn(
          "h-auto justify-start gap-[4px] rounded-none bg-transparent p-0 text-inherit",
          pill ? "" : "border-b border-black/10",
        )}
      >
        {names.map((name) => (
          <TabsTrigger
            key={name}
            value={name}
            className={cn(
              "font-satoshi text-[12px] font-normal shadow-none transition-colors data-[state=active]:shadow-none",
              pill
                ? "rounded-full px-[12px] py-[5px] text-black/45 hover:text-black/70 data-[state=active]:bg-black/85 data-[state=active]:text-white"
                : "-mb-px rounded-none border-b-[1.5px] border-transparent px-[10px] py-[7px] text-black/40 hover:text-black/65 data-[state=active]:border-black/70 data-[state=active]:bg-transparent data-[state=active]:text-black/85",
            )}
          >
            {name}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* Radix unmounts the inactive panels, which is the behaviour we want and
          previously had to implement: a hidden chart never measures itself against a
          zero-width container. */}
      {names.map((name) => (
        <TabsContent key={name} value={name} className="mt-0 flex flex-col gap-[12px]">
          {slots[name] ?? null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * Radix Collapsible, for the `aria-controls`/`aria-expanded` pair a screen reader
 * needs to announce that the trigger owns the region below it. `defaultOpen` comes
 * from the composer's disclosure decision, which is one of the few presentation calls
 * the brief explicitly allows it to make.
 */
function DisclosureView({ props, children }: ContainerInput) {
  return (
    <Collapsible
      defaultOpen={props.defaultOpen === true}
      className="group rounded-[12px] border border-black/8 bg-white/30"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-[10px] px-[14px] py-[11px] text-left">
        <span className={LABEL}>{str(props.label) ?? "Detail"}</span>
        {/* One element per state rather than a ternary on `open`, because the
            component is uncontrolled now and `data-state` is the only thing that
            knows. */}
        <span className="font-satoshi text-[11px] text-black/35">
          <span className="group-data-[state=open]:hidden">Show</span>
          <span className="hidden group-data-[state=open]:inline">Hide</span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Rule />
        <div className="flex flex-col gap-[12px] p-[14px]">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ------------------------------------------------------------ what to watch */

const WhatToWatch: Container = ({ props, children }) => (
  <div className={`${SURFACE.inset} py-[20px]`}>
    <div className={TYPE.label}>Ahead</div>
    <div className={`${TYPE.sectionTitle} mt-[2px]`}>{str(props.heading) ?? "What to watch"}</div>
    <div className={`mt-[16px] ${RHYTHM.block}`}>{children}</div>
  </div>
);

/* ------------------------------------------------------------- the mapping */

export const CONTAINER_COMPONENTS: Record<LayoutId, Container> = {
  PageHeader,
  Section,
  Grid,
  Stack,
  Tabs: (input) => <TabsView {...input} />,
  SplitPane,
  Disclosure: (input) => <DisclosureView {...input} />,
  WhatToWatch,
};

export const isLayoutId = (id: string): id is LayoutId => id in CONTAINER_COMPONENTS;
