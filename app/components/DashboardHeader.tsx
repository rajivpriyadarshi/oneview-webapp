"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getProfile } from "../lib/realAuthApi";
import { MeridianLogo } from "./MeridianLogo";

const TOOLTIP_SEEN_KEY = "currency_toggle_tooltip_seen";

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
  const [showTooltip, setShowTooltip] = useState(false);
  const [hovered, setHovered] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    if (!onCurrencyChange) return;
    const seen = localStorage.getItem(TOOLTIP_SEEN_KEY);
    if (!seen) {
      setShowTooltip(true);
      autoTimer.current = setTimeout(() => {
        setShowTooltip(false);
        localStorage.setItem(TOOLTIP_SEEN_KEY, "1");
      }, 2500);
    }
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
  }, [onCurrencyChange]);

  const selectStyle = {
    fontFeatureSettings: "'ss03' on",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%232f2b2c' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat" as const,
    backgroundPosition: "right 12px center",
  };

  const tooltipVisible = showTooltip || hovered;

  const currencySelect = onCurrencyChange && currencyList.length > 1 && (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {currencyList.length > 4 ? (
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="h-[42px] appearance-none rounded-full border border-black/15 bg-white pl-4 pr-9 font-satoshi text-[15px] font-medium tracking-[-0.02em] text-black outline-none cursor-pointer transition hover:bg-black/[0.02]"
          style={selectStyle}
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
      )}
      {tooltipVisible && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a1a",
            color: "#fff",
            borderRadius: "10px",
            padding: "8px 14px",
            fontSize: "13px",
            fontFamily: "var(--font-satoshi), sans-serif",
            fontWeight: 500,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 100,
            letterSpacing: "-0.02em",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          }}
        >
          View your assets in your preferred currency
          <div style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "6px solid #1a1a1a",
          }} />
        </div>
      )}
    </div>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-[200] border-b border-black/10 bg-[#ffffff26] backdrop-blur-[30px] md:left-16">
      {/* Mobile navbar */}
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <Link href="/dashboard" aria-label="Go to Dashboard">
          <MeridianLogo width={44} height={44} />
        </Link>
        <div className="flex items-center gap-2">
          {onCurrencyChange && (
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              className="h-[42px] appearance-none rounded-full border border-black/15 bg-white pl-4 pr-9 font-satoshi text-[15px] font-medium tracking-[-0.02em] text-black outline-none cursor-pointer"
              style={selectStyle}
            >
              {currencyList.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
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

      {/* Desktop */}
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
          {currencySelect}
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

function HamburgerIcon({ color = "#7F4E0B" }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12H21M3 6H21M3 18H21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
