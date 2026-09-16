"use client";

/**
 * AnnotatedAnswer — the answer, with masked PII marked in place.
 *
 * A green underline under any word that stood in for redacted data, and on hover
 * a card showing what the Privacy Guard step actually substituted. The thought
 * chain says *that* masking happened and the inspect panel counts it; this says
 * exactly *where* in the sentence you are reading it happened, which is the only
 * one of the three you can act on while reading.
 *
 * Rendered through the real MarkdownContent with an extra rehype pass rather
 * than a forked markdown pipeline, so the answer's type, spacing and number
 * bolding stay identical to production — the underline is the only difference.
 *
 * Hover is delegated from the wrapper rather than bound per span: the spans are
 * produced inside the markdown tree, where there is nowhere to hang React
 * handlers, and one listener on the container behaves the same.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { visit } from "unist-util-visit";
import type { Element, Parent, Root, Text } from "hast";
import MarkdownContent from "../../components/MarkdownContent";
import type { AnswerAnnotation } from "./grounding";

/** Green of the underline and the "Protected" pill, from the Figma marks. */
const MASK_GREEN = "#A3E86B";
const MASK_PILL_BG = "#C9FAC5";

const MARK_ATTR = "data-pii";

/** Exported Figma vector as a mask, so it can take currentColor. */
function Glyph({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
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
      }}
    />
  );
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Wraps every literal occurrence of an annotated term in a marked span.
 *
 * Longest term first, so an annotation that contains another one wins instead of
 * being chopped up by it. Text already inside a mark is skipped — visit walks
 * the nodes this plugin splices in, and without that guard the pass would keep
 * re-wrapping its own output.
 */
function rehypeMarkPII(annotations: AnswerAnnotation[]) {
  const terms = [...annotations].sort((a, b) => b.term.length - a.term.length);
  const pattern = new RegExp(`(${terms.map((a) => escapeRegExp(a.term)).join("|")})`, "g");

  return () => (tree: Root) => {
    visit(tree, "text", (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index == null) return;
      if (parent.type === "element" && (parent as Element).properties?.[MARK_ATTR] != null) return;

      const parts: (Text | Element)[] = [];
      let last = 0;
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(node.value)) !== null) {
        if (match.index > last) {
          parts.push({ type: "text", value: node.value.slice(last, match.index) });
        }
        parts.push({
          type: "element",
          tagName: "span",
          properties: { [MARK_ATTR]: match[0], className: ["pii-mark"] },
          children: [{ type: "text", value: match[0] }],
        });
        last = match.index + match[0].length;
      }

      if (parts.length === 0) return;
      if (last < node.value.length) {
        parts.push({ type: "text", value: node.value.slice(last) });
      }
      parent.children.splice(index, 1, ...parts);
    });
  };
}

/**
 * Where the card sits, measured against the wrapper. `left` is where it *wants*
 * to be — the card clamps that itself, since its width depends on the term and
 * is only knowable once rendered.
 */
type CardAnchor = {
  annotation: AnswerAnnotation;
  left: number;
  top: number;
  wrapperWidth: number;
};

export function AnnotatedAnswer({
  markdown,
  annotations,
  className,
}: {
  markdown: string;
  annotations?: AnswerAnnotation[];
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<CardAnchor | null>(null);

  const active = annotations?.length ? annotations : undefined;

  /**
   * Rebuilt whenever the annotation list changes. The plugin closes over the
   * terms, so a stale instance would keep marking the previous scenario's names.
   */
  const plugins = active ? [rehypeMarkPII(active)] : undefined;

  const openFor = useCallback(
    (target: HTMLElement) => {
      const wrapper = wrapperRef.current;
      const term = target.getAttribute(MARK_ATTR);
      if (!wrapper || !term || !active) return;

      const annotation = active.find((item) => item.term === term);
      if (!annotation) return;

      const wrapperBox = wrapper.getBoundingClientRect();
      const box = target.getBoundingClientRect();

      setAnchor({
        annotation,
        // Left-aligned to the word; MaskCard pulls it back inside the column.
        left: box.left - wrapperBox.left,
        // Below the word: the underline is already below it, so a card underneath
        // reads as attached, and the lines it covers are ones you have read.
        top: box.bottom - wrapperBox.top + 6,
        wrapperWidth: wrapperBox.width,
      });
    },
    [active],
  );

  const handleOver = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) => {
      const mark = (event.target as HTMLElement).closest?.(`[${MARK_ATTR}]`);
      if (mark instanceof HTMLElement) openFor(mark);
    },
    [openFor],
  );

  const handleOut = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Ignore moves between the word's own children; only a move that leaves the
    // mark entirely should close the card.
    const from = (event.target as HTMLElement).closest?.(`[${MARK_ATTR}]`);
    const to = event.relatedTarget instanceof HTMLElement
      ? event.relatedTarget.closest?.(`[${MARK_ATTR}]`)
      : null;
    if (from && from === to) return;
    setAnchor(null);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseOver={handleOver}
      onMouseOut={handleOut}
      onFocus={handleOver}
      onBlur={() => setAnchor(null)}
    >
      <MarkdownContent className={className} extraRehypePlugins={plugins}>
        {markdown}
      </MarkdownContent>

      {anchor ? <MaskCard anchor={anchor} /> : null}

      {/* Scoped to this wrapper so the mark styling can't leak into the real
          thread. text-decoration rather than a border: it follows the word
          across a line wrap, which a border-bottom on an inline span does not. */}
      <style>{`
        .pii-mark {
          text-decoration: underline;
          text-decoration-color: ${MASK_GREEN};
          text-decoration-thickness: 2px;
          text-underline-offset: 3px;
          text-decoration-skip-ink: none;
          cursor: help;
          transition: background-color 0.18s ease;
          border-radius: 3px;
        }
        .pii-mark:hover {
          background-color: ${MASK_GREEN}33;
        }
      `}</style>
    </div>
  );
}

/**
 * The hover card, per the Figma design: what was detected, struck through, and
 * what the model received in its place.
 *
 * Sized to its content rather than to a fixed 283px. The whole point of the card
 * is the before/after pair, and a wrapped "Ranganathan Family Trust" sitting
 * beside a wrapped "[ENTITY_1]" makes that pair much harder to read than a wider
 * card does. It grows to fit and only wraps past 400px, where it would start
 * covering too much of the answer.
 */
function MaskCard({ anchor }: { anchor: CardAnchor }) {
  const { annotation, left, top, wrapperWidth } = anchor;
  const cardRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Measured before paint, so the clamp lands on the first frame — the card
  // never appears at the unclamped position.
  useLayoutEffect(() => {
    setWidth(cardRef.current?.offsetWidth ?? 0);
  }, [annotation]);

  return (
    <div
      ref={cardRef}
      className="pointer-events-none absolute z-[30] w-max min-w-[283px] max-w-[400px]"
      style={{
        left: width ? Math.min(left, Math.max(wrapperWidth - width, 0)) : left,
        top,
        animation: "pii-card-in 0.18s ease-out both",
      }}
    >
      <div className="flex flex-col gap-[10px] rounded-[16px] bg-white p-[16px] shadow-[0_1px_6px_rgba(0,0,0,0.12),0_10px_34px_rgba(0,0,0,0.10)]">
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-[4px] rounded-[42px] py-[4px] pr-[10px] pl-[6px] font-satoshi text-[10px] leading-[16px] font-semibold tracking-[-0.4px] text-[#111]"
            style={{ backgroundColor: MASK_PILL_BG }}
          >
            <Glyph name="shield-tick" size={12} />
            Protected
          </span>
          <Glyph name="link-external" size={16} className="text-black/50" />
        </div>

        <p className="m-0 font-satoshi text-[14px] leading-[1.5] font-normal tracking-[-0.28px] text-black/70">
          PII detected and masked before AI processing.
        </p>

        <div className="flex items-center justify-between gap-[8px] rounded-[8px] bg-[#F0F0F0] p-[16px] text-[#111]">
          <span className="flex flex-col items-center justify-center">
            <span className="font-satoshi text-[8px] font-semibold tracking-[0.48px] text-[#111]/60 uppercase">
              Detected
            </span>
            <span className="font-satoshi text-[14px] leading-[1.5] font-normal tracking-[-0.56px] whitespace-nowrap text-[#111]/70 line-through decoration-from-font [text-decoration-skip-ink:none]">
              {annotation.detected}
            </span>
          </span>

          <span className="shrink-0 font-satoshi text-[14px] leading-[1.5] tracking-[-0.56px]">
            &rarr;
          </span>

          <span className="flex flex-col items-center justify-center">
            <span className="font-satoshi text-[8px] font-semibold tracking-[0.48px] text-[#111]/60 uppercase">
              Masked PII
            </span>
            <span className="font-satoshi text-[14px] leading-[1.5] font-medium tracking-[-0.56px] whitespace-nowrap">
              {annotation.masked}
            </span>
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pii-card-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

export default AnnotatedAnswer;
