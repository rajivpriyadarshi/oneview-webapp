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

import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";
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
  /**
   * The section's one-line takeaway, resolved from the semantic report.
   *
   * Here for the same reason `docTitle` is: it is content, the container needs it, and a
   * prop carrying it would be the composer authoring a sentence about the findings. The
   * first attempt did exactly that and `literal_in_props` rejected the spec.
   */
  takeaway?: string;
};

export type Container = (input: ContainerInput) => React.ReactNode;

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * Where a control that belongs to a section's content can put itself on the section's own
 * heading line.
 *
 * The carousel's prev/next pair is the case this exists for. The pair is the carousel's — it
 * holds the scroll position and the disabled state — but the *row* it belongs on is the
 * section's, beside the heading, where every other document puts the controls for the thing
 * underneath. Rendered where it lives, it took a line of its own between the takeaway and
 * the cards, which read as a third piece of furniture and pushed the cards down.
 *
 * So `Section` publishes a host element and the control portals into it. A DOM portal rather
 * than an element passed up through state: the buttons stay inside the carousel's React tree,
 * so their handlers and their state need no lifting, and there is no render loop from a
 * parent storing a child's output. Before mount the host is null and the control renders in
 * place, which is also what a section without a heading gets.
 */
const SectionAside = React.createContext<HTMLElement | null>(null);

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
    {/* Kind on the left, period on the right, on one line above the title. Two labels of
        equal weight reading in opposite directions is what makes a masthead a masthead
        rather than a stack — and it is the only place on the page where the as-of date is
        a heading instead of a footnote. */}
    {str(props.eyebrow) || str(props.period) ? (
      <div className="mb-[14px] flex items-baseline justify-between gap-[16px]">
        <div className="font-satoshi text-[11px] font-bold uppercase tracking-[0.13em] text-black/45">
          {str(props.eyebrow)}
        </div>
        {str(props.period) ? <div className={TYPE.caption}>{props.period as string}</div> : null}
      </div>
    ) : null}
    <h1 className={TYPE.docTitle}>{docTitle ?? "Report"}</h1>
    {str(props.subtitle) ? <p className={`${TYPE.docSubtitle} mt-[8px]`}>{props.subtitle as string}</p> : null}
    <div className={`mt-[22px] border-t ${SURFACE.hairline}`} />
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
/**
 * A section: its heading, a line saying what it is about, then the content.
 *
 * `index` is still carried and still means position — the composer assigns it in page
 * order, the validator can see it, and a continuation band is the one that has none. It is
 * no longer *drawn*: a number in front of every heading turned the page into a numbered
 * list of parts, and the headings are strong enough to be the spine on their own.
 */
const Section: Container = ({ props, children, takeaway }) => {
  const heading = str(props.heading);
  const caption = takeaway ?? str(props.caption);
  /* The right end of the heading line, offered to the content. See `SectionAside`. */
  const [aside, setAside] = React.useState<HTMLDivElement | null>(null);
  return (
    <section className={props.variant === "bordered" ? `${SURFACE.inset} py-[20px]` : undefined}>
      <div className="flex items-end justify-between gap-[24px]">
        <div className="min-w-0">
          {heading ? <h2 className={TYPE.areaTitle}>{heading}</h2> : null}
          {caption ? <p className={`${TYPE.areaCaption} mt-[4px]`}>{caption}</p> : null}
        </div>
        <div ref={setAside} className="shrink-0" />
      </div>
      {/* Declares what it printed, so a leaf inside it does not print the same words
          again. See `InSection` in ./chrome.tsx. */}
      <InSection heading={heading}>
        <SectionAside.Provider value={aside}>
          <div className={`${heading || caption ? "mt-[16px]" : ""} ${RHYTHM.block}`}>{children}</div>
        </SectionAside.Provider>
      </InSection>
    </section>
  );
};

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
      //
      // A flex column with a `flex-1` child, rather than `h-full` on the child: the cell
      // stretches to the row either way, but a percentage height resolves against it only
      // sometimes, which is why a donut beside a five-row table left one panel stopping
      // short of the other. `flex-1` needs no definite height to fill the cell.
      <div key={index} className="flex min-w-0 flex-col [&>*]:flex-1">
        {child}
      </div>
    ))}
  </div>
);

/**
 * The grid, turned on its side once the set outgrows the page.
 *
 * Four flagged risks in two rows is a set the reader counts at a glance; six is two
 * screens of tinted boxes, and everything after them — the forward look, the decisions —
 * has been pushed under the fold by the least urgent items in the set. A rail keeps the
 * first two at full size, states how many there are, and charges a scroll only for the
 * part the reader was going to reach last.
 *
 * Native scroll with snap points rather than a transform carousel: the rail is a scroll
 * container, so a trackpad, a shift-wheel, a touch swipe and tab-to-focus all work without
 * this component implementing any of them, and nothing is `display: none` — an item off
 * screen is still in the accessibility tree and still printable. The buttons are a
 * convenience over that, not the mechanism, which is why they can be disabled at the ends
 * without the content becoming unreachable.
 *
 * `perView` is the only prop, and it is a count rather than a width — it sets how far a
 * button moves and what the counter says, not how wide a card is. See `Carousel` in
 * ./registry.ts for why the child cap matters more than the styling.
 */

/**
 * One card, 400px, and every card in the rail the same height as the tallest.
 *
 * A fixed width rather than a fraction of the rail, because a rail is not a grid: the card
 * is a fixed object the reader scrolls past, and sizing it off the container made the same
 * four risks four different shapes depending on how wide the chat pane happened to be. At
 * 400px the measure holds around 55 characters, which is where the prose in a flag reads.
 *
 * The height is the part that was visibly wrong: `h-full` on the card resolved against a
 * wrapper with no height of its own, so a two-line flag stopped short beside a six-line one
 * and the two read as different kinds of thing. The wrapper is a flex column and the card is
 * `flex-1`, which is the one arrangement that stretches without needing a measured height.
 *
 * `min()` so a rail narrower than one card still shows a whole card rather than a clipped one.
 */
const CARD = "flex w-[min(400px,100%)] shrink-0 snap-start flex-col [&>*]:flex-1";

function CarouselView({ props, children }: ContainerInput) {
  const per = Number(props.perView) === 3 ? 3 : 2;
  const count = children.length;
  const rail = React.useRef<HTMLDivElement | null>(null);
  const [at, setAt] = React.useState(0);

  /* One card's width, measured rather than computed from `per`: the rail is full width
     below md and the arithmetic would be wrong there, and the element already knows. */
  const step = () => {
    const el = rail.current;
    return el && count > 0 ? el.scrollWidth / count : 0;
  };

  const onScroll = () => {
    const el = rail.current;
    const width = step();
    if (el && width > 0) setAt(Math.round(el.scrollLeft / width));
  };

  const move = (direction: -1 | 1) => {
    const el = rail.current;
    const width = step();
    if (el && width > 0) el.scrollBy({ left: direction * width, behavior: "smooth" });
  };

  const last = Math.max(count - per, 0);
  const first = Math.min(at, last);
  const shown = Math.min(first + per, count);
  const host = React.useContext(SectionAside);

  const controls =
    count > per ? (
      <div className="flex items-center gap-[10px]">
        <span className={`${TYPE.caption} tabular-nums`}>
          {first + 1}–{shown} of {count}
        </span>
        {([-1, 1] as const).map((direction) => {
          const Mark = direction === -1 ? ChevronLeft : ChevronRight;
          const spent = direction === -1 ? first <= 0 : first >= last;
          return (
            <button
              key={direction}
              type="button"
              onClick={() => move(direction)}
              disabled={spent}
              aria-label={direction === -1 ? "Previous" : "Next"}
              className={`grid h-[28px] w-[28px] place-items-center rounded-full border transition-colors ${SURFACE.hairline} ${
                spent ? "opacity-35" : "hover:bg-black/[0.04]"
              }`}
            >
              <Mark className="h-[14px] w-[14px] text-[#52525b]" strokeWidth={1.8} aria-hidden />
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-[12px]">
      {/* On the section's heading line where there is one, in place where there is not. */}
      {controls ? (host ? createPortal(controls, host) : <div className="flex justify-end">{controls}</div>) : null}
      <div
        ref={rail}
        onScroll={onScroll}
        className="-mx-[2px] flex snap-x snap-mandatory items-stretch gap-[24px] overflow-x-auto px-[2px] pb-[4px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children.map((child, index) => (
          // Positional, like Grid's: identity lives on the node ids one level down.
          <div key={index} className={CARD}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

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
        {/* The two sides are one band, so a pane holding a single panel fills the band's
            height rather than stopping at its own text. Two washed boxes of different
            heights beside each other read as one finished and one cut short — which is
            wrong, because the short one is a one-line takeaway by design.

            `only-child` deliberately: where a pane stacks several blocks, their heights are
            their own business and stretching them would distribute the slack arbitrarily.

            `flex-1` on the child rather than `h-full`, for the reason given in `Grid`. */}
        <div className="flex flex-1 flex-col gap-[12px] [&>*:only-child]:flex-1">
          {slots[side] ?? null}
        </div>
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

/**
 * The last section: numbered like the others, and tinted because it closes the document.
 *
 * Two arguments met here and the reference settled them. Against the tint: a conclusion
 * that does not look like part of the document reads as a footer, which is what the old
 * panel-with-an-"Ahead"-label did. For it: a reader who has just come down nine sections
 * needs to be told the page has ended, and a closing card is how a written note says so.
 *
 * So it keeps the heading at section weight — it is the last section, not an appendix — and
 * takes the wash inside it. `SURFACE.inset` rather than a new tint, because the only thing
 * being said is "this is the end", and that does not need a colour of its own.
 */
const WhatToWatch: Container = ({ props, children, takeaway }) => {
  const heading = str(props.heading) ?? "What to watch";
  /* The heading sits on the page, not inside the panel — the same place every other section
     puts its heading. Inside, it was a heading at section weight indented by the panel's own
     padding, so the last band of the document was the one band whose title did not line up
     with the seven above it, and the tint read as a card containing a section rather than as
     a section whose list happens to be tinted. */
  return (
    <section>
      <h2 className={TYPE.areaTitle}>{heading}</h2>
      {takeaway ? <p className={`${TYPE.areaCaption} mt-[4px]`}>{takeaway}</p> : null}
      <InSection heading={heading}>
        <div className={`mt-[20px] ${SURFACE.inset} px-[22px] py-[20px] ${RHYTHM.block}`}>{children}</div>
      </InSection>
    </section>
  );
};

/* ------------------------------------------------------------- the mapping */

export const CONTAINER_COMPONENTS: Record<LayoutId, Container> = {
  PageHeader,
  Section,
  Grid,
  Carousel: (input) => <CarouselView {...input} />,
  Stack,
  Tabs: (input) => <TabsView {...input} />,
  SplitPane,
  Disclosure: (input) => <DisclosureView {...input} />,
  WhatToWatch,
};

export const isLayoutId = (id: string): id is LayoutId => id in CONTAINER_COMPONENTS;
