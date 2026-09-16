"use client";

/**
 * The report — sections, the 12-column grid, and progressive assembly.
 *
 * Pure presentation: it is handed a `ReportDoc` and a count of how many blocks
 * are visible, and it draws that. No timers here — the page owns the pacing, the
 * same split the Chat transparency lab uses, so the assembly stays scrubbable.
 *
 * Every block lands in three beats rather than fading in as a finished thing:
 *
 *   1. the slot is reserved and shimmers (the block *before* it is placed),
 *   2. the card's frame draws in with a live gradient outline running round it
 *      and skeleton bars where the content will go,
 *   3. the outline settles and the real content populates into the frame.
 *
 * All of it is CSS keyframes on stable, keyed elements, so scrubbing the reveal
 * backwards and forwards replays the same build instead of desynchronising.
 *
 * Blocks are keyed by their stable `Block.id`, which is what lets a block
 * inserted by a follow-up animate in while everything around it stays put.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { orderedBlocks, type Block, type ReportDoc } from "./compose";
import { RENDERER_COMPONENTS } from "./renderers";

const SPAN_CLASS: Record<number, string> = {
  4: "col-span-4 max-[720px]:col-span-12",
  6: "col-span-6 max-[720px]:col-span-12",
  8: "col-span-8 max-[720px]:col-span-12",
  12: "col-span-12",
};

export function ReportView({
  doc,
  visibleCount,
  addedBlockIds = [],
  selectedBlockId = null,
  onSelectBlock,
  onRevise,
  revising = false,
  revisions,
}: {
  doc: ReportDoc;
  /** How many blocks of the reveal sequence to show. */
  visibleCount: number;
  /** Blocks added by the latest patch, highlighted so the insertion is legible. */
  addedBlockIds?: string[];
  /** The card the advisor is commenting on, if any. */
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string | null) => void;
  /** Submit a comment aimed at one card. */
  onRevise?: (blockId: string, comment: string) => void;
  /** A card-level revision is in flight. */
  revising?: boolean;
  /**
   * How many times each block has been revised, folded into its React key so a
   * card that was rethought replays the three-beat build instead of mutating in
   * place. A revision that lands silently doesn't read as a rethink.
   */
  revisions?: Record<string, number>;
}) {
  const ordered = orderedBlocks(doc);
  const visible = new Set(ordered.slice(0, visibleCount).map((block) => block.id));
  /**
   * The block that is *about* to land. Drawing its skeleton in place, at its real
   * span, is what makes the assembly read as construction rather than as a list
   * appearing: the slot is reserved and shimmering before it fills.
   */
  const pending = ordered[visibleCount];

  /* One card, wherever it sits — the grid and a tab panel draw the same thing. */
  const renderBlock = (block: Block) => (
    <BlockShell
      key={`${block.id}:${revisions?.[block.id] ?? 0}`}
      block={block}
      doc={doc}
      isNew={addedBlockIds.includes(block.id)}
      selectable={!!onSelectBlock}
      isSelected={selectedBlockId === block.id}
      onSelect={onSelectBlock}
      onRevise={onRevise}
      revising={revising}
    />
  );

  return (
    // Clicking the page background, rather than a card, drops the selection —
    // the same way clicking off a selected object does anywhere else.
    <div onClick={() => onSelectBlock?.(null)}>
      <header className="mb-[20px]">
        <p className="m-0 font-satoshi text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">
          Portfolio analysis
        </p>
        <h2 className="mt-[6px] mb-0 font-satoshi text-[24px] leading-[30px] font-bold tracking-[-0.6px] text-[#171615]">
          {doc.title}
        </h2>
        <p className="mt-[4px] mb-0 font-satoshi text-[13px] tracking-[-0.13px] text-black/50">
          {doc.subject}
        </p>
      </header>

      {doc.sections.map((section) => {
        const groups = section.groups ?? [];
        const tabbed = new Set(groups.flatMap((group) => group.tabs.map((tab) => tab.blockId)));
        const shown = section.blocks.filter((block) => visible.has(block.id));
        /* Blocks the grid still owns: everything this section did not fold into tabs. */
        const loose = shown.filter((block) => !tabbed.has(block.id));
        /*
         * A block landing inside a tab group gets no skeleton slot. The strip has no
         * empty column to reserve — reserving one would mean drawing a panel for a tab
         * that does not exist yet — so the tab simply appears when the block lands.
         */
        const ghost =
          pending && !tabbed.has(pending.id) && section.blocks.some((b) => b.id === pending.id)
            ? pending
            : null;
        /* Only the tabs whose blocks have landed, so a group assembles tab by tab. */
        const strips = groups
          .map((group) => ({
            group,
            tabs: group.tabs
              .map((tab) => ({
                label: tab.label,
                block: section.blocks.find((block) => block.id === tab.blockId),
              }))
              .filter((tab): tab is { label: string; block: Block } => !!tab.block && visible.has(tab.block.id)),
          }))
          .filter((strip) => strip.tabs.length > 0);

        // A section whose blocks haven't landed yet stays out entirely, so the
        // report grows downward rather than showing empty headings — unless its
        // first block is the one currently landing, in which case the heading
        // arrives with the skeleton.
        if (shown.length === 0 && !ghost) return null;

        return (
          <section key={section.id} className="mb-[24px]">
            <h3 className="du-heading m-0 mb-[10px] font-satoshi text-[16px] font-bold tracking-[-0.32px] text-[#171615]">
              {section.heading}
            </h3>
            {loose.length > 0 || ghost ? (
              <div className="grid grid-cols-12 gap-[10px]">
                {loose.map((block) => renderBlock(block))}
                {ghost ? (
                  <div
                    key={`${ghost.id}-ghost`}
                    className={`du-ghost ${SPAN_CLASS[ghost.span] ?? SPAN_CLASS[12]}`}
                    aria-hidden
                  >
                    <div className="du-shimmer h-full min-h-[92px] rounded-[12px] border border-dashed border-[#7F4E0B]/25 bg-[#7F4E0B]/[0.04]" />
                  </div>
                ) : null}
              </div>
            ) : null}
            {strips.map((strip) => (
              <TabbedGroup
                key={strip.group.id}
                label={strip.group.because}
                tabs={strip.tabs}
                render={renderBlock}
              />
            ))}
          </section>
        );
      })}

      {/* An unrenderable finding is a gap in the renderer table, so the lab says
          so rather than quietly producing a shorter report. */}
      {doc.unrendered.length > 0 ? (
        <div className="mt-[16px] rounded-[10px] border border-dashed border-black/15 p-[12px]">
          <p className="m-0 font-satoshi text-[11px] font-semibold uppercase tracking-[0.12em] text-black/40">
            {doc.unrendered.length} finding{doc.unrendered.length === 1 ? "" : "s"} not rendered
          </p>
          <ul className="mt-[6px] mb-0 list-none p-0">
            {doc.unrendered.map((item) => (
              <li
                key={item.findingId}
                className="font-satoshi text-[12px] leading-[18px] tracking-[-0.12px] text-black/55"
              >
                {item.kind} · {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <style>{`
        /* Registered so the conic gradient's angle can be animated at all —
           custom properties are strings to the animation engine otherwise. */
        @property --du-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        /* Beat 2 → 3: the card's own box arrives first, empty. */
        @keyframes du-frame-in {
          0%   { opacity: 0; transform: translateY(16px) scale(0.96); }
          70%  { opacity: 1; transform: translateY(0) scale(1.008); }
          100% { opacity: 1; transform: none; }
        }
        /* The content populates into the frame, a beat later: rises, unblurs,
           sharpens. This is the "data arriving" half of the build. */
        @keyframes du-fill-in {
          0%   { opacity: 0; transform: translateY(10px); filter: blur(7px); }
          60%  { opacity: 1; filter: blur(0.6px); }
          100% { opacity: 1; transform: none; filter: blur(0); }
        }
        /* The AI outline: a gradient that runs round the card's edge while it is
           being built, then fades off once the content is in. */
        @keyframes du-outline-spin { to { --du-angle: 360deg; } }
        @keyframes du-outline-out {
          0%   { opacity: 0; }
          12%  { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
        /* Scaffold: the skeleton bars standing in for content, cross-fading out
           underneath it as the real thing lands on top. */
        @keyframes du-scaffold-out {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          62%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes du-shimmer {
          from { background-position: -180% 0; }
          to   { background-position: 180% 0; }
        }
        /* A single pass of light across the finished block. Driven by
           background-position rather than transform so it needs no clipping
           wrapper and cannot escape the block's box. */
        @keyframes du-sheen {
          from { background-position: -160% 0; opacity: 0.85; }
          to   { background-position: 160% 0; opacity: 0; }
        }
        @keyframes du-ghost-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes du-heading-in {
          from { opacity: 0; transform: translateY(6px); letter-spacing: 0.4px; }
          to   { opacity: 1; transform: none; }
        }

        /* --- the block, as a three-beat build ------------------------------- */

        .du-block {
          position: relative;
          animation: du-frame-in 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        /* The renderer's card, held back so the frame reads as empty first. */
        .du-fill {
          animation: du-fill-in 900ms 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        /* The card's own surface, drawn behind the scaffold so the box exists
           from the first beat even though it has nothing in it yet. */
        .du-plate {
          position: absolute;
          inset: 0;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          animation: du-scaffold-out 1500ms ease-out both;
          pointer-events: none;
        }
        .du-scaffold {
          position: absolute;
          inset: 0;
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 9px;
          animation: du-scaffold-out 1500ms ease-out both;
          pointer-events: none;
        }
        .du-bar {
          height: 8px;
          border-radius: 4px;
          background-image: linear-gradient(100deg, rgba(23,22,21,0.05) 30%, rgba(127,78,11,0.16) 50%, rgba(23,22,21,0.05) 70%);
          background-size: 220% 100%;
          animation: du-shimmer 1100ms linear infinite;
        }
        .du-outline {
          position: absolute;
          inset: -1.5px;
          border-radius: 13.5px;
          padding: 1.5px;
          pointer-events: none;
          background: conic-gradient(
            from var(--du-angle),
            rgba(127,78,11,0.05) 0deg,
            #7F4E0B 60deg,
            #E0A34E 120deg,
            #9A6BE0 200deg,
            #4B7FD4 265deg,
            rgba(127,78,11,0.05) 360deg
          );
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          animation:
            du-outline-spin 1150ms linear 2,
            du-outline-out 1700ms ease-out both;
        }
        .du-block::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 12px;
          pointer-events: none;
          background-image: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.9) 50%, transparent 70%);
          background-size: 220% 100%;
          background-repeat: no-repeat;
          mix-blend-mode: overlay;
          animation: du-sheen 1100ms 900ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        /* --- a card you can point at -------------------------------------- */

        .du-selectable { cursor: pointer; outline-offset: 3px; }
        .du-selectable:focus-visible {
          outline: 2px solid rgba(127,78,11,0.75);
          border-radius: 12px;
        }
        /* The affordance is quiet: a label that only appears on hover, because a
           permanent one on every card turns a report into a toolbar. */
        .du-hint {
          position: absolute;
          top: -9px;
          right: 8px;
          z-index: 15;
          padding: 2px 7px;
          border-radius: 999px;
          background: #171615;
          color: #fff;
          font-family: var(--font-satoshi, inherit);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          opacity: 0;
          transform: translateY(3px);
          transition: opacity 140ms ease-out, transform 140ms ease-out;
          pointer-events: none;
        }
        .du-selectable:hover .du-hint,
        .du-selectable:focus-visible .du-hint { opacity: 1; transform: none; }
        @keyframes du-comment-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.985); }
          to   { opacity: 1; transform: none; }
        }
        .du-comment { animation: du-comment-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both; }

        .du-heading { animation: du-heading-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .du-ghost { animation: du-ghost-in 300ms ease-out both; }
        .du-shimmer {
          background-image: linear-gradient(100deg, rgba(127,78,11,0.03) 30%, rgba(127,78,11,0.13) 50%, rgba(127,78,11,0.03) 70%);
          background-size: 220% 100%;
          animation: du-shimmer 1200ms linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .du-block, .du-heading, .du-ghost, .du-fill, .du-comment { animation-duration: 1ms; animation-delay: 0ms; }
          .du-block::after, .du-shimmer, .du-outline, .du-scaffold, .du-plate { animation: none; }
          .du-block::after, .du-outline, .du-scaffold, .du-plate { display: none; }
        }
      `}</style>
    </div>
  );
}

/** How many skeleton bars stand in for a block while its frame is being drawn. */
/**
 * Sibling cards, one at a time.
 *
 * The tab strip is the whole point: six cards of the same shape stacked down a page
 * read as one texture, and the reader has to work through six headings to find the
 * one they came for. As a strip, the headings *are* the navigation.
 *
 * `active` is clamped rather than reset, because tabs arrive one at a time while the
 * report is still assembling — a strip that jumped back to the first tab every time
 * another landed would fight the reader for the duration of the build.
 */
function TabbedGroup({
  label,
  tabs,
  render,
}: {
  /** Why these are together. The strip's accessible name. */
  label: string;
  tabs: { label: string; block: Block }[];
  render: (block: Block) => ReactNode;
}) {
  const [active, setActive] = useState(0);
  const index = Math.min(active, tabs.length - 1);
  const current = tabs[index];

  return (
    <div className="mt-[2px]">
      <div
        role="tablist"
        aria-label={label}
        className="mb-[10px] flex flex-wrap items-center gap-[6px]"
      >
        {tabs.map((tab, position) => {
          const on = position === index;
          return (
            <button
              key={tab.block.id}
              type="button"
              role="tab"
              aria-selected={on}
              // Selecting a tab must not also select the card underneath it: the
              // click is navigation, not a choice of what to comment on.
              onClick={(event) => {
                event.stopPropagation();
                setActive(position);
              }}
              className={`rounded-full border px-[11px] py-[5px] font-satoshi text-[11px] font-semibold tracking-[-0.11px] transition-colors ${
                on
                  ? "border-transparent bg-[#171615] text-white"
                  : "border-black/12 bg-white text-black/55 hover:border-black/25 hover:text-black/80"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {current ? <div className="grid grid-cols-12">{render(current.block)}</div> : null}
    </div>
  );
}

const scaffoldBars = (span: number): number[] => (span >= 12 ? [58, 92, 78, 40] : [64, 90, 46]);

function BlockShell({
  block,
  doc,
  isNew,
  selectable,
  isSelected,
  onSelect,
  onRevise,
  revising,
}: {
  block: Block;
  doc: ReportDoc;
  isNew: boolean;
  selectable: boolean;
  isSelected: boolean;
  onSelect?: (blockId: string | null) => void;
  onRevise?: (blockId: string, comment: string) => void;
  revising: boolean;
}) {
  const finding = doc.findings[block.findingId];
  const Renderer = RENDERER_COMPONENTS[block.rendererId];

  if (!finding || !Renderer) return null;

  const ring = isSelected
    ? { outline: "2px solid rgba(127,78,11,0.75)", outlineOffset: 3, borderRadius: 12 }
    : isNew
      ? { outline: "2px solid rgba(127,78,11,0.35)", outlineOffset: 3, borderRadius: 12 }
      : undefined;

  return (
    <div
      className={`du-block ${selectable ? "du-selectable" : ""} ${SPAN_CLASS[block.span] ?? SPAN_CLASS[12]}`}
      style={ring}
      // A card is a thing you can point at, so it takes a click and a key —
      // but it is not a button: the report underneath it is still readable text.
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? isSelected : undefined}
      aria-label={selectable ? `Comment on ${block.rendererId}` : undefined}
      onClick={(event) => {
        if (!selectable) return;
        event.stopPropagation();
        onSelect?.(isSelected ? null : block.id);
      }}
      onKeyDown={(event) => {
        if (!selectable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(isSelected ? null : block.id);
        }
      }}
    >
      {/* Beats 1–2, layered underneath: the empty card and its skeleton, both
          fading out as the content lands on top of them. Absolutely positioned,
          so the block's height is the finished content's height throughout and
          nothing below it jumps mid-build. */}
      <div className="du-plate" aria-hidden />
      <div className="du-scaffold" aria-hidden>
        {scaffoldBars(block.span).map((width, i) => (
          <div key={i} className="du-bar" style={{ width: `${width}%`, animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      <div className="du-outline" aria-hidden />

      <div className="du-fill">
        <Renderer finding={finding} />
      </div>

      {selectable ? (
        <span className="du-hint" aria-hidden>
          Comment
        </span>
      ) : null}

      {isSelected && onRevise ? (
        <CommentBox
          rendererId={block.rendererId}
          reason={block.selection.reason}
          busy={revising}
          onClose={() => onSelect?.(null)}
          onSubmit={(comment) => onRevise(block.id, comment)}
        />
      ) : null}
    </div>
  );
}

/**
 * The comment box, anchored under the card it belongs to.
 *
 * Deliberately not a form of controls. The advisor types what they want to
 * *know* — "show six of them", "by value instead", "drop the history" — and the
 * interpretation and mapping layers decide what that means and what draws it.
 * The examples underneath exist because a blank box gives no clue that a sentence
 * is the input.
 */
function CommentBox({
  rendererId,
  reason,
  busy,
  onClose,
  onSubmit,
}: {
  rendererId: string;
  reason: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const comment = text.trim();
    if (!comment || busy) return;
    setText("");
    onSubmit(comment);
  };

  return (
    <div
      className="du-comment absolute top-[calc(100%+10px)] right-0 left-0 z-[20] rounded-[12px] border border-black/[0.08] bg-white p-[12px] shadow-[0_16px_40px_rgba(58,35,9,0.18)]"
      // Clicks inside the box must not read as a click on the card behind it,
      // which would toggle the selection off mid-sentence.
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <p className="m-0 mb-[8px] font-satoshi text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40">
        {rendererId} · {reason}
      </p>
      <textarea
        ref={inputRef}
        rows={2}
        value={text}
        disabled={busy}
        placeholder="What should this card show instead?"
        className="w-full resize-none rounded-[8px] border border-black/[0.1] bg-white px-[10px] py-[8px] font-satoshi text-[13px] leading-[1.4] tracking-[-0.13px] text-[#171615] outline-none placeholder:text-black/35 focus:border-[#7F4E0B]/45"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="mt-[8px] flex items-center justify-between gap-[10px]">
        <span className="font-satoshi text-[11px] tracking-[-0.11px] text-black/35">
          {busy ? "Rethinking this card..." : "e.g. show six of them · by value · drop the history"}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || busy}
          className="shrink-0 rounded-full bg-[#171615] px-[12px] py-[6px] font-satoshi text-[12px] font-semibold text-white transition hover:bg-[#2d2926] disabled:opacity-40"
        >
          Rethink
        </button>
      </div>
    </div>
  );
}

export default ReportView;
