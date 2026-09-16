/**
 * The shell primitives every component in this prototype sits inside.
 *
 * Deliberately a copy of the three constants and two small components from
 * `../dynamic-ui/renderers.tsx` rather than an import of them. Prototype 1 stays
 * untouched — it is the thing being compared against — and the duplication is three
 * class strings, which is cheaper than a refactor that could break a working page.
 *
 * When the palette is promoted to `app/design/` at Phase 8, this file is what
 * collapses into it.
 *
 * No colour is chosen here beyond the neutrals the whole surface already uses. The
 * charts get their colour from the palette by way of the reused renderers, and the
 * components defined in ./leaves.tsx are text and structure, which is why they need
 * none.
 */

import type React from "react";

export const CARD =
  "rounded-[12px] border border-black/10 bg-white/65 p-[14px] h-full flex flex-col";

export const LABEL =
  "font-satoshi text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40";

export const INK = "#171615";

export function Card({
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
      {label ? <div className={`${LABEL} mb-[10px]`}>{label}</div> : null}
      {children}
    </div>
  );
}

/** A change, with its direction carried by colour and sign rather than an arrow. */
export function DeltaChip({
  delta,
}: {
  delta: { label: string; value?: number; sentiment?: "positive" | "negative" | "neutral" };
}) {
  const sentiment =
    delta.sentiment ??
    (delta.value === undefined ? "neutral" : delta.value > 0 ? "positive" : delta.value < 0 ? "negative" : "neutral");

  const tone =
    sentiment === "positive"
      ? "text-[#1F6F4A] bg-[#1F6F4A]/8"
      : sentiment === "negative"
        ? "text-[#A03A2B] bg-[#A03A2B]/8"
        : "text-black/50 bg-black/5";

  return (
    <span
      className={`inline-flex items-center rounded-full px-[8px] py-[2px] font-satoshi text-[11px] font-medium ${tone}`}
    >
      {delta.label}
    </span>
  );
}

/**
 * What a component shows when its binding resolved to nothing.
 *
 * Never a blank space and never a crash. The validator should have caught a missing
 * binding before render (`unknown_data_key`), so reaching this is a bug — but §14
 * says the page still has to stand up, and an area that quietly renders nothing is
 * the failure that is hardest to notice.
 */
export function Empty({ what }: { what: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-black/12 p-[14px]">
      <div className={LABEL}>Not available</div>
      <div className="mt-[6px] font-satoshi text-[12px] text-black/45">{what}</div>
    </div>
  );
}

/* --------------------------------------------------------------- small parts */

export function Rule() {
  return <div className="h-px w-full bg-black/8" />;
}

export function Rows({
  rows,
  columns = 1,
}: {
  rows: { label: string; value: string }[];
  columns?: 1 | 2;
}) {
  return (
    <dl className={`grid gap-x-[18px] gap-y-[8px] ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-[12px]">
          <dt className="font-satoshi text-[12px] text-black/45">{row.label}</dt>
          <dd className="font-satoshi text-[13px] font-medium tabular-nums" style={{ color: INK }}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
