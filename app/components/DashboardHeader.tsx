"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProfile } from "../lib/realAuthApi";

type Props = {
  updatedAt?: string;
  asOfDate?: string;
  currency?: string;
  onCurrencyChange?: (currency: string) => void;
};

export default function DashboardHeader({ updatedAt, asOfDate, currency = "INR", onCurrencyChange }: Props) {
  const [userName, setUserName] = useState("");
  const subtitle = 'See the unified view of all your investments';

  useEffect(() => {
    getProfile()
      .then((profile) => {
        const name = profile.display_name?.trim().split(/\s+/)[0] || "";
        setUserName(name);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-['ButlerPro'] text-[32px] font-normal leading-[38.4px] tracking-[-0.04em] text-black">
          Welcome {userName ? `${userName}` : ""}
        </h1>
        {subtitle && <p className="m-0 font-['Satoshi'] text-[14px] font-normal leading-[21px] tracking-[-0.02em] text-[#00000078]" style={{ fontFeatureSettings: "'ss03' on" }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {asOfDate && (
          <span className="font-satoshi text-[14px] font-normal leading-[21px] tracking-[-0.02em] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>
            Price as of {asOfDate}
          </span>
        )}
        {onCurrencyChange && (
          <div className="relative inline-flex items-center rounded-full border border-black/10 p-1 font-satoshi text-sm font-bold leading-6 tracking-[-0.04em]" style={{ fontFeatureSettings: "'ss03' on" }}>
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[52px] rounded-full bg-[#1a1a1a] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out ${
                currency === "USD" ? "translate-x-[52px]" : "translate-x-0"
              }`}
            />
            <button
              className={`relative z-10 inline-flex h-[36px] w-[52px] appearance-none items-center justify-center whitespace-nowrap border-0 bg-transparent px-[10px] py-[4px] text-[14px] font-bold leading-5 tracking-[-0.04em] transition-colors duration-300 focus:outline-none ${
                currency === "INR" ? "text-white" : "text-black/40 hover:text-black/70"
              }`}
              onClick={() => onCurrencyChange("INR")}
            >
              INR
            </button>
            <button
              className={`relative z-10 inline-flex h-[36px] w-[52px] appearance-none items-center justify-center whitespace-nowrap border-0 bg-transparent px-[10px] py-[4px] text-[14px] font-bold leading-5 tracking-[-0.04em] transition-colors duration-300 focus:outline-none ${
                currency === "USD" ? "text-white" : "text-black/40 hover:text-black/70"
              }`}
              onClick={() => onCurrencyChange("USD")}
            >
              USD
            </button>
          </div>
        )}
        <Link
          href="/documents-vault"
          className="inline-flex cursor-pointer justify-center items-center gap-[10px] rounded-full
          border-[1px] border-black/10 bg-transparent px-[24px] py-[16px] font-satoshi
          text-[16px] font-bold leading-6 tracking-[-0.04em] text-black transition hover:bg-black/[0.02]"
          style={{ fontFeatureSettings: "'ss03' on" }}
        >
          <PlusIcon />
          Add statements
        </Link>
      </div>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5V19M5 12H19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
