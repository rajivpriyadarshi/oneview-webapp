"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import PortfolioChart from "./PortfolioChart";
import { type PortfolioViewResponse, type Account, type ValuationSeriesPoint, type PortfolioViewPosition } from "../lib/portfolioDataApi";
import { type Portfolio } from "../lib/portfoliosApi";

type Props = {
  portfolioView: PortfolioViewResponse | null;
  loading: boolean;
  valuesRefetching?: boolean;
  chartLoading: boolean;
  accounts: Account[];
  selectedAccountId: number | "all";
  onAccountChange: (accountId: number | "all") => void;
  portfolios: Portfolio[];
  selectedPortfolio: Portfolio | null;
  onPortfolioChange: (portfolioId: number) => void;
  currency: string;
  currencySymbol?: string;
  onCurrencyChange: (currency: string) => void;
  valuationSeries: ValuationSeriesPoint[];
  onExcludedHoldingsClick?: (positions: PortfolioViewPosition[]) => void;
};

export default function PortfolioSummary({
  portfolioView,
  loading,
  valuesRefetching,
  chartLoading,
  accounts,
  selectedAccountId,
  onAccountChange,
  currency,
  currencySymbol,
  onCurrencyChange,
  valuationSeries,
  onExcludedHoldingsClick,
}: Props) {
  const [prevCurrency, setPrevCurrency] = useState(currency);
  const [currencyChanging, setCurrencyChanging] = useState(false);

  const zeroCostPositions: PortfolioViewPosition[] = (portfolioView?.positions ?? []).filter(
    (p) => p.cost_basis === 0 || p.cost_basis === null,
  );
  const excludedCount = zeroCostPositions.length;
  const CUTOFF = 10;

  useEffect(() => {
    if (currency !== prevCurrency) {
      setCurrencyChanging(true);
      setPrevCurrency(currency);
      const timeout = setTimeout(() => setCurrencyChanging(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [currency, prevCurrency]);

  useEffect(() => {
    if (currencyChanging && !valuesRefetching && !loading) {
      setCurrencyChanging(false);
    }
  }, [valuesRefetching, loading, currencyChanging]);

  const summary = portfolioView?.summary;
  const currSymbol = currencySymbol ?? getCurrencySymbol(currency);
  const marketValue = summary ? formatLakhs(summary.total_market_value, currency) : "—";
  const gainAmount = summary ? formatLakhs(Math.abs(summary.total_gain_amount), currency) : "—";
  const gainPct = summary?.total_gain_pct != null ? `${summary.total_gain_pct.toFixed(2)}%` : "";
  const isPositive = summary ? summary.total_gain_amount >= 0 : true;

  return (
    <section
      data-analytics-section="portfolio_summary"
      className="relative mb-[16px] py-[32px]"
    >
      <div className="mb-[-10px] hidden md:flex md:items-center md:gap-3">
        <div className="group relative inline-flex items-center">
          <span
            className="pointer-events-none invisible absolute whitespace-nowrap pl-5 pr-10 font-satoshi text-[16px] font-bold leading-6 tracking-[-0.02em]"
            style={{ fontFeatureSettings: "'ss03' on" }}
            aria-hidden="true"
            ref={(el) => {
              if (el) {
                const select = el.nextElementSibling as HTMLSelectElement | null;
                if (select) select.style.width = `${el.offsetWidth + 2}px`;
              }
            }}
          >
            {selectedAccountId === "all" ? "All accounts" : (accounts.find(a => a.id === selectedAccountId)?.name || "")}
          </span>
          <select
            className="h-[48px] cursor-pointer appearance-none whitespace-nowrap rounded-full border border-black/10 bg-[#ffffff] pl-5 pr-10 font-satoshi text-[16px] font-bold leading-6 tracking-[-0.02em] text-black outline-none backdrop-blur-[20px] transition hover:bg-black/[0.02]"
            style={{ fontFeatureSettings: "'ss03' on" }}
            value={selectedAccountId}
            onChange={(e) => {
              const val = e.target.value;
              onAccountChange(val === "all" ? "all" : Number(val));
            }}
          >
            <option value="all">All accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 text-black/60" />
        </div>
        <Link
          href="/documents-vault"
          className="inline-flex h-[48px] w-[48px] cursor-pointer items-center justify-center rounded-full border border-black/10 bg-[#f6f5f3] transition hover:bg-[#f0efed]"
          aria-label="Add statements"
        >
          <PlusIcon />
        </Link>
      </div>

      <div className="flex items-stretch justify-between gap-8 max-[900px]:flex-col max-[900px]:gap-6">
        <div className="flex flex-col justify-center gap-0 max-[900px]:items-center max-[900px]:text-center">
          <p className="m-0 mb-[12px] font-satoshi text-[16px] max-[720px]:text-[15px] font-normal leading-[21px] tracking-[-0.02em] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>
            Total assets
          </p>
          <RollingText
            text={loading ? "..." : `${currSymbol}${marketValue}`}
            isLoading={currencyChanging || !!valuesRefetching}
            className="m-0 font-['ButlerPro'] text-[140px] font-normal leading-[100%] tracking-[-0.04em] text-[#2F1E07] max-[720px]:text-[110px]"
          />
          <p
            className={`m-0 mt-[-16px] max-[720px]:mt-[4px] flex flex-wrap items-center gap-x-2 gap-y-0 font-satoshi text-[16px] max-[720px]:text-[14px] font-normal leading-[150%] tracking-[-0.02em]`}
            style={{ fontFeatureSettings: "'ss03' on" }}
          >
            {!loading && summary && !currencyChanging && !valuesRefetching && (
              <span className={isPositive ? "text-[#128044]" : "text-red-600"}>
                {`${isPositive ? "+" : "-"}${currSymbol}${gainAmount} (${gainPct})`}
              </span>
            )}
            {!loading && !currencyChanging && !valuesRefetching && excludedCount > 0 && summary && (
              <>
                <span className="text-black/20">•</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0" style={{ color: "#B91C1C" }}>
                  <path d="M8 6V8.66667M8 11.3333H8.00667M6.86 2.57333L1.21333 12C1.09693 12.2018 1.03533 12.4303 1.03467 12.663C1.034 12.8957 1.09429 13.1246 1.20955 13.327C1.32482 13.5295 1.49095 13.6984 1.69133 13.8167C1.89171 13.9351 2.11939 13.998 2.35133 14H13.6487C13.8806 13.998 14.1083 13.9351 14.3087 13.8167C14.509 13.6984 14.6752 13.5295 14.7904 13.327C14.9057 13.1246 14.966 12.8957 14.9653 12.663C14.9647 12.4303 14.9031 12.2018 14.7867 12L9.14 2.57333C9.02117 2.37742 8.85383 2.21543 8.65402 2.10313C8.4542 1.99083 8.22888 1.93198 8 1.93198C7.77112 1.93198 7.5458 1.99083 7.34598 2.10313C7.14617 2.21543 6.97883 2.37742 6.86 2.57333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <button
                  type="button"
                  onClick={() => onExcludedHoldingsClick?.(zeroCostPositions)}
                  className="cursor-pointer bg-transparent border-0 p-0 font-satoshi text-[16px] max-[720px]:text-[14px] font-normal text-black/50 hover:text-black/80 transition-colors"
                  style={{ fontFeatureSettings: "'ss03' on" }}
                >
                  {excludedCount > CUTOFF ? (
                    <>
                      <span className="underline underline-offset-2">Several holdings</span>
                      {" were excluded from this analysis"}
                    </>
                  ) : (
                    <>
                      <span className="underline underline-offset-2">
                        {excludedCount} of your holdings
                      </span>
                      {excludedCount !== 1 ? " were" : " was"} excluded from this analysis
                    </>
                  )}
                </button>
              </>
            )}
          </p>
        </div>

        <div className="flex-1 min-w-0 max-w-[55%] max-[900px]:max-w-full">
          <PortfolioChart series={valuationSeries} currency={currency} currencySymbol={currSymbol} loading={chartLoading} />
        </div>
      </div>
      {/* Mobile fixed bottom accounts bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-4 pt-2">
        <div className="relative w-full rounded-2xl border border-black/10 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <select
            className="w-full appearance-none rounded-2xl bg-transparent pl-5 pr-12 py-4 font-satoshi text-[16px] font-semibold leading-6 tracking-[-0.02em] text-black outline-none cursor-pointer"
            style={{ fontFeatureSettings: "'ss03' on" }}
            value={selectedAccountId}
            onChange={(e) => {
              const val = e.target.value;
              onAccountChange(val === "all" ? "all" : Number(val));
            }}
          >
            <option value="all">All accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2">
            <svg width="14" height="9" viewBox="0 0 14 9" fill="none">
              <path d="M1 1L7 7L13 1" stroke="#2f2b2c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
      </div>
    </section>
  );
}

function getCurrencySymbol(currency?: string): string {
  switch (currency?.toUpperCase()) {
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    case "JPY": return "¥";
    case "INR":
    default: return "₹";
  }
}

function floor2(n: number) { return Math.floor(n * 100) / 100; }

function formatLakhs(value: number, currency = "INR") {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (currency.toUpperCase() !== "INR") {
    if (abs >= 1_000_000_000) return `${sign}${floor2(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}${floor2(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}${floor2(abs / 1_000).toFixed(1)}K`;
    return floor2(value).toFixed(2);
  }
  if (abs >= 10_000_000) return `${sign}${floor2(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${sign}${floor2(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${floor2(abs / 1_000).toFixed(1)}K`;
  return floor2(value).toFixed(2);
}

function truncateLabel(value: string, maxLength = 16) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5V19M5 12H19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="7" viewBox="0 0 14 8" fill="none" className={className}>
      <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function RollingText({ text, isLoading, className }: { text: string; isLoading: boolean; className: string }) {
  const lastStableText = useRef(text === "..." ? "" : text);

  useEffect(() => {
    if (text !== "...") {
      lastStableText.current = text;
    }
  }, [text]);

  if (text === "..." || isLoading) {
    const placeholder = lastStableText.current || "€28.36M";
    return (
      <h2 className={`shimmer-overlay ${className}`} style={{ display: "inline-block", color: "transparent", padding: "0.08em 0.05em" }}>
        {placeholder}
      </h2>
    );
  }

  return <h2 className={className}>{text}</h2>;
}
