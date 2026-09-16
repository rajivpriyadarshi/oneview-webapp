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
import { INK, LABEL, Rule } from "./chrome";
import type { LayoutId } from "./leaves";
import type { UINode } from "./spec";

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

const PageHeader: Container = ({ props, docTitle }) => (
  <header className="flex flex-col gap-[6px]">
    {str(props.eyebrow) ? <div className={LABEL}>{props.eyebrow as string}</div> : null}
    <h1 className="font-satoshi text-[26px] font-medium leading-[1.15] tracking-[-0.01em]" style={{ color: INK }}>
      {docTitle ?? "Report"}
    </h1>
    {str(props.subtitle) ? (
      <div className="font-satoshi text-[13px] text-black/45">{props.subtitle as string}</div>
    ) : null}
  </header>
);

/* -------------------------------------------------------------------- flow */

const Section: Container = ({ props, children }) => (
  <section
    className={
      props.variant === "bordered" ? "rounded-[14px] border border-black/10 bg-white/40 p-[18px]" : undefined
    }
  >
    <div className="flex flex-col gap-[4px]">
      <h2 className="font-satoshi text-[15px] font-medium tracking-[-0.005em]" style={{ color: INK }}>
        {str(props.heading) ?? ""}
      </h2>
      {str(props.caption) ? (
        <p className="font-satoshi text-[12px] text-black/45">{props.caption as string}</p>
      ) : null}
    </div>
    <div className="mt-[12px] flex flex-col gap-[12px]">{children}</div>
  </section>
);

const GAPS: Record<string, string> = { tight: "gap-[8px]", normal: "gap-[12px]", loose: "gap-[20px]" };

const Stack: Container = ({ props, children }) => (
  <div className={`flex flex-col ${GAPS[String(props.gap)] ?? GAPS.normal}`}>{children}</div>
);

/** Static class names, because Tailwind cannot see a computed one. */
const COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

const Grid: Container = ({ props, children }) => (
  <div className={`grid gap-[12px] ${COLUMNS[Number(props.columns)] ?? COLUMNS[2]}`}>
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

function TabsView({ props, slots }: ContainerInput) {
  const names = Object.keys(slots);
  const preferred = str(props.defaultTab);
  const [active, setActive] = React.useState(preferred && names.includes(preferred) ? preferred : names[0]);
  const current = names.includes(active) ? active : names[0];
  const pill = props.variant === "pill";

  return (
    <div className="flex flex-col gap-[12px]">
      <div className={`flex items-center gap-[4px] ${pill ? "" : "border-b border-black/10"}`} role="tablist">
        {names.map((name) => {
          const on = name === current;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(name)}
              className={
                pill
                  ? `rounded-full px-[12px] py-[5px] font-satoshi text-[12px] transition-colors ${on ? "bg-black/85 text-white" : "text-black/45 hover:text-black/70"}`
                  : `-mb-px border-b-[1.5px] px-[10px] py-[7px] font-satoshi text-[12px] transition-colors ${on ? "border-black/70 text-black/85" : "border-transparent text-black/40 hover:text-black/65"}`
              }
            >
              {name}
            </button>
          );
        })}
      </div>
      {/* Only the active region is mounted, so a hidden chart does not measure
          itself against a zero-width container. */}
      <div role="tabpanel" className="flex flex-col gap-[12px]">
        {slots[current] ?? null}
      </div>
    </div>
  );
}

function DisclosureView({ props, children }: ContainerInput) {
  const [open, setOpen] = React.useState(props.defaultOpen === true);
  return (
    <div className="rounded-[12px] border border-black/8 bg-white/30">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-[10px] px-[14px] py-[11px] text-left"
      >
        <span className={LABEL}>{str(props.label) ?? "Detail"}</span>
        <span className="font-satoshi text-[11px] text-black/35">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <>
          <Rule />
          <div className="flex flex-col gap-[12px] p-[14px]">{children}</div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ what to watch */

const WhatToWatch: Container = ({ props, children }) => (
  <div className="rounded-[14px] border border-black/10 bg-[#FBF8F2] p-[16px]">
    <div className="flex flex-col gap-[2px]">
      <div className={LABEL}>Ahead</div>
      <div className="font-satoshi text-[14px] font-medium" style={{ color: INK }}>
        {str(props.heading) ?? "What to watch"}
      </div>
    </div>
    <div className="mt-[12px] flex flex-col gap-[10px]">{children}</div>
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
