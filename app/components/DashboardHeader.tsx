"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProfile } from "../lib/realAuthApi";

type CurrencyOption = { currency_code: string; name: string | null; symbol: string | null; decimals: number };

type Props = {
  updatedAt?: string;
  asOfDate?: string;
  currency?: string;
  apiCurrencies?: CurrencyOption[];
  onCurrencyChange?: (currency: string) => void;
};

export default function DashboardHeader({ asOfDate, currency = "INR", apiCurrencies = [], onCurrencyChange }: Props) {
  const [userName, setUserName] = useState("");
  const subtitle = 'See the unified view of all your investments';

  const ORDER = ["USD", "INR"];
  const currencyList = apiCurrencies.length > 0
    ? [...apiCurrencies.map((c) => c.currency_code)].sort((a, b) => {
        const ai = ORDER.indexOf(a);
        const bi = ORDER.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      })
    : [currency];

useEffect(() => {
    getProfile()
      .then((profile) => {
        const name = profile.display_name?.trim().split(/\s+/)[0] || "";
        setUserName(name);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="fixed top-0 right-0 z-50 mb-8 flex flex-col gap-4 border-b border-black/10 bg-[#ffffff26] px-6 py-4 backdrop-blur-[30px] sm:px-[60px] md:left-16 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col">
        <h1 className="m-0 font-['ButlerPro'] text-[24px] font-normal leading-[28.8px] tracking-[-0.04em] text-black">
          Welcome {userName ? `${userName}` : ""}
        </h1>
        {subtitle && <p className="m-0 mt-[-2px] font-['Satoshi'] text-[14px] font-normal leading-[21px] tracking-[-0.02em] text-[#00000078]" style={{ fontFeatureSettings: "'ss03' on" }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {asOfDate && (
          <span className="font-satoshi text-[14px] font-normal leading-[21px] tracking-[-0.02em] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>
            Price as of {asOfDate}
          </span>
        )}
        {onCurrencyChange && currencyList.length > 1 && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "38px",
              background: "linear-gradient(90deg, #2F1E07 0%, #58442A 100%)",
              padding: "2px",
            }}
          >
            {currencyList.map((code) => (
              <button
                key={code}
                onClick={() => onCurrencyChange(code)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "20px",
                  padding: "8px 16px",
                  fontSize: "16px",
                  fontWeight: 400,
                  fontFamily: "var(--font-satoshi), sans-serif",
                  lineHeight: 1.3,
                  letterSpacing: "-0.56px",
                  whiteSpace: "nowrap",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s",
                  background: currency === code ? "#fff" : "transparent",
                  color: currency === code ? "#2f2b2c" : "rgba(255,255,255,0.6)",
                }}
              >
                {code}
              </button>
            ))}
          </div>
        )}
        <Link
          href="/documents-vault"
          className="inline-flex cursor-pointer justify-center items-center gap-[10px] rounded-full
          border-[1px] border-black/10 bg-transparent pt-[10px] pb-[10px] pl-[12px] pr-[16px] font-satoshi
          text-[16px] font-medium leading-6 tracking-[-0.01em] text-black transition hover:bg-black/[0.02]"
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
