"use client";

/**
 * ResponseGrounding — the marker under a finished answer, and the panel behind it.
 *
 * Three layers of disclosure, each one only as heavy as the question it answers:
 *
 *   glance    the pill. Always visible, one word about whether to trust this.
 *   hover     the sources card. "What is this built on?" — answered in a line,
 *             floating over the answer so it costs no layout.
 *   inspect   the full panel. Context used, what was masked, policy.
 *
 * The third layer lives in <InspectResponsePanel>, which the page mounts beside
 * the chat column rather than this component rendering it inline — see its own
 * comment for why. That splits the open state out to the page, so the pill only
 * reports the intent to inspect.
 *
 * Data is scripted in ./grounding, and the level is driven from the lab's
 * control bar, so all three states can be compared without re-running.
 *
 * Icons are the exported Figma vectors under /public/icons/grounding, rendered
 * as CSS masks rather than <img> so they can take `currentColor` — the same
 * glyph appears in a green circle, an amber pill and a grey header, and the
 * exported SVGs have their stroke colour baked in.
 */

import { useEffect, useState } from "react";
import {
  GROUNDINGS,
  GROUNDING_TONE,
  contextMeta,
  groundingSources,
  sensitiveMeta,
  sensitiveTitle,
  type ContextItem,
  type Grounding,
  type GroundingIcon,
  type GroundingLevel,
  type SensitiveFinding,
} from "./grounding";

/** Exported Figma vector, recoloured via mask so it inherits text colour. */
function Glyph({
  name,
  size = 16,
  className,
  style,
}: {
  name: GroundingIcon;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const url = `url(/icons/grounding/${name}.svg)`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------------- marker */

export function ResponseGrounding({
  level,
  onInspect,
}: {
  level: GroundingLevel;
  onInspect: () => void;
}) {
  const grounding = GROUNDINGS[level];
  const tone = GROUNDING_TONE[level];

  return (
    // The hover card is positioned against this wrapper and sits directly on
    // top of the pill with no gap, so travelling from pill to card never leaves
    // the hover target. focus-within keeps it reachable from the keyboard.
    <div className="group relative mt-[10px] inline-block">
      {/* Metrics are the Figma tag component's: 12px glyph, 4px gap, 6/10
          padding, 42px radius, semibold 10/16 at -0.2px, #111 at 80%. */}
      <button
        type="button"
        onClick={onInspect}
        className="inline-flex items-center gap-[4px] rounded-[42px] border-0 py-[4px] pr-[10px] pl-[6px] font-satoshi text-[10px] leading-[16px] font-semibold tracking-[-0.2px] transition-[filter] duration-200 hover:brightness-[0.96]"
        style={{ backgroundColor: tone.pillBg, color: `${tone.pillFg}CC` }}
        aria-label={`${grounding.label} — inspect response`}
      >
        <Glyph name={tone.icon} size={12} />
        {grounding.label}
      </button>

      <SourcesCard grounding={grounding} onInspect={onInspect} />
    </div>
  );
}

/**
 * The hover disclosure. Floats above the pill and over the answer — the answer
 * behind it is blurred by the card's own backdrop rather than dimmed by a
 * scrim, so the response stays visible as context without competing to be read.
 */
function SourcesCard({
  grounding,
  onInspect,
}: {
  grounding: Grounding;
  onInspect: () => void;
}) {
  // No role="tooltip": it holds the Inspect button, and a tooltip is not
  // allowed to contain interactive content.
  return (
    <div
      className="pointer-events-none absolute bottom-full left-0 z-[30] w-[300px] origin-bottom-left translate-y-[6px] scale-[0.98] pb-[6px] opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100"
    >
      <div className="rounded-[16px] border border-black/[0.05] bg-white/85 px-[16px] py-[13px] shadow-[0_8px_30px_rgba(0,0,0,0.10)] backdrop-blur-[10px]">
        <div className="flex items-start gap-[8px]">
          <span className="font-satoshi text-[10px] font-medium tracking-[0.08em] text-black/35 uppercase">
            Sources:
          </span>
          {/* Escape hatch to the full panel. Sits on the label's line so it
              can't be mistaken for one of the sources. */}
          <button
            type="button"
            onClick={onInspect}
            className="ml-auto -mt-[3px] -mr-[4px] shrink-0 rounded-full border-0 bg-black/[0.04] px-[8px] py-[3px] font-satoshi text-[10px] font-medium tracking-[-0.1px] text-black/55 transition-colors hover:bg-black/[0.08] hover:text-black/80"
          >
            Inspect
          </button>
        </div>

        <p className="mt-[5px] mb-0 font-satoshi text-[13px] leading-[19px] font-normal tracking-[-0.13px] text-black/80">
          {groundingSources(grounding).join(" · ")}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- full panel */

/**
 * The inspect panel — a sidebar hinged on the chat column's right edge, not a
 * modal.
 *
 * Mounted by the page inside the chat panel and pushed out with `left-full`, so
 * it tracks that column's width at every breakpoint and reads as an extension of
 * the conversation rather than a layer over it. It deliberately overlays the
 * client overview instead of displacing it: the answer being explained must stay
 * where it was, and only one of the two right-hand surfaces is ever being read.
 *
 * Consequences of not being a modal: no scrim, no aria-modal, no focus trap.
 * The thread stays live and scrollable behind it, which is the point — the
 * panel is an annotation of the answer, so you can read both at once. Escape
 * still closes, since that is what a panel opened from a button owes you.
 */
export function InspectResponsePanel({
  level,
  open,
  onClose,
}: {
  level: GroundingLevel;
  open: boolean;
  onClose: () => void;
}) {
  const grounding = GROUNDINGS[level];
  const tone = GROUNDING_TONE[level];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Top offset clears the overview's tab row so the two headers sit on one
    // line; max-height keeps a long panel scrolling inside itself rather than
    // running off the bottom of the screen.
    <aside
      aria-label="Inspect response"
      className="absolute top-[72px] left-full z-[40] max-h-[calc(100vh-104px)] w-[318px] overflow-y-auto overscroll-contain rounded-[16px] border border-black/[0.08] bg-white p-[15px] shadow-[0_18px_50px_rgba(0,0,0,0.14)]"
      style={{ animation: "rg-panel-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both" }}
    >
      <div className="flex items-start gap-[8px]">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-satoshi text-[18px] leading-[24px] font-bold tracking-[-0.36px] text-black">
            Inspect Response
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-[2px] -mr-[2px] grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[6px] border-0 bg-transparent text-black/70 transition-colors hover:bg-black/[0.05] hover:text-black"
        >
          <Glyph name="close" size={16} />
        </button>
      </div>

      <p className="mt-[6px] mb-0 font-satoshi text-[12px] leading-[18px] font-medium tracking-[-0.24px] text-black/50">
        See how this answer was created, what information was used, and how your
        data stays protected
      </p>

      {/* Verdict banner — the one place the level is stated outright. */}
      <div
        className="mt-[14px] rounded-[8px] border px-[16px] py-[14px]"
        style={{ backgroundColor: tone.bannerBg, borderColor: tone.bannerBorder }}
      >
        <span
          className="inline-flex items-center gap-[4px] rounded-[42px] py-[4px] pr-[10px] pl-[6px] font-satoshi text-[10px] leading-[16px] font-semibold tracking-[-0.2px] text-black"
          style={{ backgroundColor: tone.chipBg }}
        >
          <Glyph name={tone.icon} size={12} />
          {grounding.banner}
        </span>
        <p className="mt-[10px] mb-0 font-satoshi text-[12px] leading-[18px] font-medium tracking-[-0.24px] text-[#02160A]/70">
          {grounding.verdict}
        </p>
      </div>

      <Section
        icon="layers-three"
        title="Context used"
        meta={contextMeta(grounding)}
        defaultOpen
      >
        <div className="flex flex-col">
          {grounding.context.map((item) => (
            <ContextRow key={item.title} item={item} />
          ))}
        </div>
      </Section>

      <Section
        icon="shield-tick"
        title="Sensitive data"
        meta={sensitiveMeta(grounding)}
        defaultOpen
      >
        <div className="flex flex-col gap-[12px] px-[8px] pt-[4px]">
          {grounding.sensitive.map((finding) => (
            <SensitiveRow key={finding.tone} finding={finding} />
          ))}
        </div>
      </Section>

      {/* Collapsed by default: the answer is that it passed, and the detail
          only matters when it didn't. */}
      <Section icon="cpu-chip" title="Policy" meta={grounding.policy}>
        <div className="px-[8px] pt-[4px] font-satoshi text-[11px] leading-[16px] tracking-[-0.11px] text-black/45">
          {grounding.policyNote}
        </div>
      </Section>

      <style>{`
        @keyframes rg-panel-in {
          from { opacity: 0; transform: translateX(-10px) scale(0.99); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </aside>
  );
}

/**
 * One collapsible card. The chevrons in the design imply real disclosure, so
 * they get it — and it keeps the panel to one screen at every level.
 */
function Section({
  icon,
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  icon: GroundingIcon;
  title: string;
  meta: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-[8px] rounded-[8px] border border-[#EFEFEF] bg-white px-[8px] py-[16px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-[4px] border-0 bg-transparent p-0 px-[8px] text-left"
      >
        <Glyph name={icon} size={16} className="text-black" />
        <span className="font-satoshi text-[14px] leading-[20px] font-bold tracking-[-0.28px] text-black">
          {title}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-[2px]">
          <span className="font-satoshi text-[10px] leading-[16px] font-medium tracking-[-0.2px] text-[#111]/60">
            {meta}
          </span>
          <Glyph
            name="chevron-down"
            size={16}
            className="text-black/70 transition-transform duration-300"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          />
        </span>
      </button>

      {/* Same 1fr/0fr trick the thought chain uses, so the card animates to the
          content's natural height instead of a guessed max-height. */}
      <div
        className="grid transition-[grid-template-rows] duration-[300ms] ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pt-[12px]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ContextRow({ item }: { item: ContextItem }) {
  return (
    <div className="flex items-center gap-[8px] rounded-[8px] p-[8px]">
      <span className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[8px] bg-[#EFEFEF] text-[#535353]">
        <Glyph name={item.icon} size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-satoshi text-[12px] leading-[18px] font-medium tracking-[-0.24px] text-black">
          {item.title}
        </span>
        <span className="font-satoshi text-[10px] leading-[16px] font-medium tracking-[-0.2px] text-black/50">
          {item.source} · {item.detail}
        </span>
      </span>
    </div>
  );
}

function SensitiveRow({ finding }: { finding: SensitiveFinding }) {
  const isWarn = finding.tone === "warn";

  return (
    <div>
      <div className="flex items-start gap-[8px]">
        <span
          className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full"
          style={{
            backgroundColor: isWarn ? "#FAEDE7" : "#E7FAEF",
            color: isWarn ? "#BB4D2F" : "#2FBB6B",
          }}
        >
          <Glyph name={isWarn ? "alert-triangle" : "check"} size={14} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-satoshi text-[12px] leading-[18px] font-medium tracking-[-0.24px] text-black">
            {sensitiveTitle(finding)}
          </span>
          <span className="font-satoshi text-[10px] leading-[16px] font-medium tracking-[-0.2px] text-black/50">
            {finding.note}
          </span>
        </span>
      </div>

      {/* Indented to the text column so it reads as belonging to the finding
          above rather than as a fourth row in the list. */}
      {finding.action ? (
        <div className="mt-[8px] ml-[32px] flex items-center justify-between gap-[8px] rounded-[8px] bg-[#F0F0F0] px-[12px] py-[8px]">
          <span className="min-w-0 truncate font-satoshi text-[12px] leading-[1.5] tracking-[-0.24px] text-[#111]/70">
            {finding.action.label}
          </span>
          <button
            type="button"
            className="shrink-0 border-0 bg-transparent p-0 font-satoshi text-[12px] leading-[1.5] font-semibold tracking-[-0.24px] text-[#111] transition-opacity hover:opacity-60"
          >
            {finding.action.verb}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default ResponseGrounding;
