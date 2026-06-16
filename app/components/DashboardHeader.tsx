"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProfile } from "../lib/realAuthApi";
import { MeridianLogo } from "./MeridianLogo";

type CurrencyOption = { currency_code: string; name: string | null; symbol: string | null; decimals: number };

type Props = {
  updatedAt?: string;
  asOfDate?: string;
  currency?: string;
  apiCurrencies?: CurrencyOption[];
  onCurrencyChange?: (currency: string) => void;
  onMenuOpen?: () => void;
};

export default function DashboardHeader({ asOfDate, currency = "INR", apiCurrencies = [], onCurrencyChange, onMenuOpen }: Props) {
  const [userName, setUserName] = useState("");
  const subtitle = 'See the unified view of all your investments';

  const ORDER = ["USD", "INR"];
  const currencyList = (() => {
    const codes = ["USD", ...apiCurrencies.map((c) => c.currency_code).filter((c) => c !== "USD")];
    return codes.sort((a, b) => {
      const ai = ORDER.indexOf(a);
      const bi = ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  })();

useEffect(() => {
    getProfile()
      .then((profile) => {
        const name = profile.display_name?.trim().split(/\s+/)[0] || "";
        setUserName(name);
      })
      .catch(() => {});
  }, []);

  const currencyControl = onCurrencyChange && currencyList.length > 1 && (
    currencyList.length > 4 ? (
      <select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        className="h-[42px] cursor-pointer appearance-none rounded-full border border-black/10 bg-white pl-4 pr-8 font-satoshi text-[15px] font-medium leading-6 tracking-[-0.02em] text-black outline-none transition hover:bg-black/[0.02]"
        style={{ fontFeatureSettings: "'ss03' on" }}
      >
        {currencyList.map((code) => (
          <option key={code} value={code}>{code}</option>
        ))}
      </select>
    ) : (
      <div style={{ display: "inline-flex", alignItems: "center", borderRadius: "38px", background: "linear-gradient(90deg, #2F1E07 0%, #58442A 100%)", padding: "2px" }}>
        {currencyList.map((code) => (
          <button
            key={code}
            onClick={() => onCurrencyChange(code)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              borderRadius: "20px", padding: "8px 16px", fontSize: "16px", fontWeight: 400,
              fontFamily: "var(--font-satoshi), sans-serif", lineHeight: 1.3, letterSpacing: "-0.56px",
              whiteSpace: "nowrap", border: "none", cursor: "pointer", transition: "all 0.3s",
              background: currency === code ? "#fff" : "transparent",
              color: currency === code ? "#2f2b2c" : "rgba(255,255,255,0.6)",
            }}
          >
            {code}
          </button>
        ))}
      </div>
    )
  );

  return (
    <header className="fixed top-0 left-0 right-0 border-b border-black/10 bg-[#ffffff26] backdrop-blur-[30px] md:left-16">
      {/* Mobile navbar */}
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        {/* Logo */}
        <Link href="/dashboard" aria-label="Go to Dashboard">
          <MeridianLogo width={44} height={44} />
        </Link>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {onCurrencyChange && (
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="h-[42px] appearance-none rounded-full border border-black/15 bg-white pl-4 pr-8 font-satoshi text-[15px] font-medium tracking-[-0.02em] text-black outline-none cursor-pointer"
                style={{ fontFeatureSettings: "'ss03' on" }}
              >
                {currencyList.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <ChevronDownIcon />
              </span>
            </div>
          )}
          <Link
            href="/documents-vault"
            className="inline-flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-full border border-black/15 bg-white transition hover:bg-black/[0.04]"
            aria-label="Add statements"
          >
            <PlusIcon />
          </Link>
          <button
            type="button"
            className="inline-flex h-[42px] w-[42px] cursor-pointer items-center justify-center transition"
            aria-label="Open menu"
            onClick={onMenuOpen}
          >
            <HamburgerIcon color="#7F4E0B" />
          </button>
        </div>
      </div>

      {/* Desktop: full row with welcome text */}
      <div className="hidden md:flex md:items-center md:justify-between px-[60px] py-4">
        <div className="flex flex-col">
          <h1 className="m-0 font-['ButlerPro'] text-[24px] font-normal leading-[28.8px] tracking-[-0.04em] text-black">
            Welcome {userName ? `${userName}` : ""}
          </h1>
          <p className="m-0 mt-[-2px] font-['Satoshi'] text-[14px] font-normal leading-[21px] tracking-[-0.02em] text-[#00000078]" style={{ fontFeatureSettings: "'ss03' on" }}>{subtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          {asOfDate && (
            <span className="font-satoshi text-[14px] font-normal leading-[21px] tracking-[-0.02em] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>
              Price as of {asOfDate}
            </span>
          )}
          {currencyControl}
          <Link
            href="/documents-vault"
            className="inline-flex cursor-pointer justify-center items-center gap-[10px] rounded-full border-[1px] border-black/10 bg-transparent pt-[10px] pb-[10px] pl-[12px] pr-[16px] font-satoshi text-[16px] font-medium leading-6 tracking-[-0.01em] text-black transition hover:bg-black/[0.02]"
            style={{ fontFeatureSettings: "'ss03' on" }}
          >
            <PlusIcon />
            Add statements
          </Link>
        </div>
      </div>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5V19M5 12H19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
      <path d="M1 1L6 7L11 1" stroke="#2f2b2c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function HamburgerIcon({ color = "#7F4E0B" }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12H21M3 6H21M3 18H21" stroke="#7F4E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  );
}
