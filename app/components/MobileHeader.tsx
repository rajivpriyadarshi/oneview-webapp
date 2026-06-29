"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MeridianLogo } from "./MeridianLogo";


type Props = {
  onMenuOpen?: () => void;
  right?: ReactNode;
  logo?: ReactNode;
};

export function MobileHeader({ onMenuOpen, right, logo }: Props) {
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
          {logo ?? (
            <Link href="/dashboard" aria-label="Go to Dashboard">
              <MeridianLogo width={44} height={44} />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}


function HamburgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 12H21M3 6H21M3 18H21" stroke="#7F4E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
