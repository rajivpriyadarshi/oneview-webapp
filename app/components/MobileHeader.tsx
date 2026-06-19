"use client";

import Link from "next/link";
import { MeridianLogo } from "./MeridianLogo";

type Props = {
  onMenuOpen?: () => void;
};

export function MobileHeader({ onMenuOpen }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 border-b border-black/10 bg-[#ffffff26] backdrop-blur-[30px] md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-[42px] w-[42px] cursor-pointer items-center justify-center transition"
            aria-label="Open menu"
            onClick={onMenuOpen}
          >
            <HamburgerIcon />
          </button>
          <Link href="/dashboard" aria-label="Go to Dashboard">
            <MeridianLogo width={44} height={44} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/documents-vault"
            className="inline-flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-full border border-black/15 bg-white transition hover:bg-black/[0.04]"
            aria-label="Add statements"
          >
            <PlusIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 5V19M5 12H19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 12H21M3 6H21M3 18H21" stroke="#7F4E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
