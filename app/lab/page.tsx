/**
 * /lab — the prototype chooser.
 *
 * The lab has more than one prototype in it now, and they answer different
 * questions, so landing straight in one of them hides that fact. This is the
 * front door: pick what you came to look at.
 *
 * Still a server component. It reads the register in ./prototypes and renders links, so
 * there is no state to own — the superseded prototypes are folded away with a
 * `<details>` rather than with React state, which keeps it that way and keeps them
 * reachable with scripting off. The one client island is ./SettingsButton.tsx, which
 * owns the model key because a static deployment has no environment to hold one.
 */

import Link from "next/link";
import { ARCHIVED, CURRENT, type Prototype } from "./prototypes";
import { SettingsButton } from "./SettingsButton";

export const metadata = {
  title: "Oneview Lab",
};

export default function LabIndexPage() {
  return (
    <main className="min-h-screen bg-[#F9F8F7] px-[24px] py-[64px] font-satoshi text-[#171615]">
      <div className="mx-auto w-full max-w-[820px]">
        <p className="m-0 font-satoshi text-[11px] font-semibold tracking-[0.14em] text-black/40 uppercase">
          Oneview Lab
        </p>
        <h1 className="mt-[10px] mb-0 font-satoshi text-[34px] leading-[40px] font-bold tracking-[-0.9px]">
          Choose a prototype
        </h1>
        <p className="mt-[10px] mb-0 max-w-[520px] font-satoshi text-[15px] leading-[23px] text-black/55">
          Each one is a self-contained prototype with its own controls. None of
          them touch production data. They will call a model if a key is
          configured — add one under Settings, bottom right — and say so on screen when
          they do; without one they fall back to a scripted stand-in and replay
          identically every time.
        </p>

        <div className="mt-[36px] grid gap-[14px]">
          {CURRENT.map((prototype) => (
            <PrototypeCard key={prototype.id} prototype={prototype} />
          ))}
        </div>

        {/* Superseded, not deleted. See the `archived` note in ./prototypes.ts. */}
        {ARCHIVED.length > 0 ? (
          <details className="group mt-[26px]">
            <summary className="inline-flex cursor-pointer list-none items-center gap-[7px] font-satoshi text-[13px] leading-[19px] font-semibold tracking-[-0.13px] text-black/45 transition-colors hover:text-black/75 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <span className="text-[11px] transition-transform duration-200 group-open:rotate-90">▶</span>
              See earlier prototypes
              <span className="font-medium text-black/30">({ARCHIVED.length})</span>
            </summary>
            <div className="mt-[14px] grid gap-[14px]">
              {ARCHIVED.map((prototype) => (
                <PrototypeCard key={prototype.id} prototype={prototype} />
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <SettingsButton />
    </main>
  );
}

function PrototypeCard({ prototype }: { prototype: Prototype }) {
  const ready = prototype.status === "ready";

  // One body, two wrappers. A planned prototype is a <div> rather than a
  // disabled link so it is never focusable and never looks clickable.
  const body = (
    <>
      <div className="flex items-start gap-[12px]">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-satoshi text-[20px] leading-[26px] font-bold tracking-[-0.44px]">
            {prototype.name}
          </h2>
          <p className="mt-[2px] mb-0 font-satoshi text-[13px] leading-[19px] font-medium tracking-[-0.13px] text-black/45">
            {prototype.tagline}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-[10px] py-[4px] font-satoshi text-[10px] leading-[16px] font-semibold tracking-[-0.2px] ${
            ready ? "bg-[#C9FAC5] text-[#111]" : "bg-black/[0.06] text-black/45"
          }`}
        >
          {ready ? "Ready" : "Planned"}
        </span>
      </div>

      <p className="mt-[12px] mb-0 max-w-[560px] font-satoshi text-[14px] leading-[21px] tracking-[-0.14px] text-black/65">
        {prototype.description}
      </p>

      {prototype.covers.length > 0 ? (
        <div className="mt-[14px] flex flex-wrap gap-[6px]">
          {prototype.covers.map((item) => (
            <span
              key={item}
              className="rounded-full bg-black/[0.04] px-[9px] py-[4px] font-satoshi text-[11px] leading-[16px] font-medium tracking-[-0.11px] text-black/55"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );

  const shell =
    "block rounded-[16px] border bg-white p-[20px] text-left transition-[border-color,box-shadow,transform] duration-200";

  if (!ready) {
    return (
      <div className={`${shell} border-black/[0.06] opacity-60`} aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={prototype.href}
      className={`${shell} border-black/[0.08] hover:-translate-y-[1px] hover:border-black/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] focus-visible:border-black/30 focus-visible:outline-none`}
    >
      {body}
    </Link>
  );
}
