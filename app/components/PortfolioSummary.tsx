"use client";

import { useState, useEffect, useRef } from "react";
import PortfolioChart from "./PortfolioChart";
import { type PortfolioViewResponse, type Account, type ValuationSeriesPoint } from "../lib/portfolioDataApi";
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
  onCurrencyChange: (currency: string) => void;
  valuationSeries: ValuationSeriesPoint[];
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
  onCurrencyChange,
  valuationSeries,
}: Props) {
  const [prevCurrency, setPrevCurrency] = useState(currency);
  const [currencyChanging, setCurrencyChanging] = useState(false);

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
  const currSymbol = currency === "USD" ? "$" : "₹";
  const marketValue = summary ? formatLakhs(summary.total_market_value) : "—";
  const gainAmount = summary ? formatLakhs(Math.abs(summary.total_gain_amount)) : "—";
  const gainPct = summary?.total_gain_pct != null ? `${summary.total_gain_pct.toFixed(2)}%` : "";
  const isPositive = summary ? summary.total_gain_amount >= 0 : true;

  return (
    <section
      data-analytics-section="portfolio_summary"
      className="relative mb-[16px] py-[32px]"
    >
      <div className="mb-[-10px]">
        <div className="group relative inline-flex items-center">
          <select
            className="h-[48px] cursor-pointer appearance-none overflow-hidden whitespace-nowrap text-ellipsis rounded-full border border-black/10 bg-[#ffffff78] pl-5 pr-10 font-satoshi text-[14px] font-bold leading-6 tracking-[-0.04em] text-black outline-none backdrop-blur-[20px] transition hover:bg-black/[0.02]"
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
                {truncateLabel(acc.name)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 text-black/60" />
        </div>
      </div>

      <div className="flex items-stretch justify-between gap-8 max-[900px]:flex-col max-[900px]:gap-6">
        <div className="flex flex-col justify-center gap-0">
          <p className="m-0 mb-[12px] font-satoshi text-[16px] font-normal leading-[21px] tracking-[-0.02em] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>
            Total assets
          </p>
          <RollingText
            text={loading ? "..." : `${currSymbol}${marketValue}`}
            isLoading={currencyChanging || !!valuesRefetching}
            className="m-0 font-['ButlerPro'] text-[140px] font-normal leading-[100%] tracking-[-0.04em] text-black/80 max-[720px]:text-[64px]"
          />
          <p
            className={`m-0 mt-[-16px] font-satoshi text-[16px] font-normal leading-[150%] tracking-[-0.02em] ${isPositive ? "text-[#128044]" : "text-red-600"}`}
            style={{ fontFeatureSettings: "'ss03' on" }}
          >
            {loading || !summary ? "" : `${isPositive ? "+" : "-"}${currSymbol}${gainAmount} (${gainPct})`}
          </p>
        </div>

        <div className="flex-1 min-w-0 max-w-[55%] max-[900px]:max-w-full">
          <PortfolioChart series={valuationSeries} currency={currency} loading={chartLoading} />
        </div>
      </div>
    </section>
  );
}

function formatLakhs(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10000000) {
    return `${sign}${(abs / 10000000).toFixed(2)}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}${(abs / 100000).toFixed(1)}L`;
  }
  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

function truncateLabel(value: string, maxLength = 16) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="7" viewBox="0 0 14 8" fill="none" className={className}>
      <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const DIGITS = "0123456789";
const CHARS = "₹$0123456789.LKM";

function RollingText({ text, isLoading, className }: { text: string; isLoading: boolean; className: string }) {
  const [prevText, setPrevText] = useState(text);
  const [currentText, setCurrentText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const isFirstRender = useRef(true);
  const lastStableText = useRef(text === "..." ? "" : text);

  useEffect(() => {
    if (text !== "...") {
      lastStableText.current = text;
    }
  }, [text]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setCurrentText(text);
      setPrevText(text);
      return;
    }
    if (text !== currentText && text !== "...") {
      setPrevText(currentText);
      setCurrentText(text);
      setIsAnimating(true);
      const timeout = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timeout);
    }
    if (text === "...") {
      setCurrentText(text);
    }
  }, [text]);

  if (text === "..." || isLoading) {
    const placeholder = lastStableText.current || "₹00.0L";
    return (
      <h2 className={className} style={{ display: "flex", alignItems: "baseline" }}>
        {placeholder.split("").map((char, i) => {
          if (DIGITS.includes(char)) {
            return (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", height: "1em", lineHeight: 1 }}>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    animation: `slot-spin-infinite 0.8s infinite linear`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                >
                  <span style={{ height: "1em", lineHeight: 1 }}>0</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>1</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>2</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>3</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>4</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>5</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>6</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>7</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>8</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>9</span>
                </span>
              </span>
            );
          }
          if (char === "L" || char === "K" || char === "M") {
            return (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", height: "1em", lineHeight: 1 }}>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    animation: `slot-spin-suffix 1s infinite linear`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                >
                  <span style={{ height: "1em", lineHeight: 1 }}>L</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>K</span>
                  <span style={{ height: "1em", lineHeight: 1 }}>M</span>
                </span>
              </span>
            );
          }
          return <span key={i}>{char}</span>;
        })}
      </h2>
    );
  }

  const maxLen = Math.max(currentText.length, prevText.length);
  const paddedCurrent = currentText.padStart(maxLen);
  const paddedPrev = prevText.padStart(maxLen);

  return (
    <h2 className={className} style={{ display: "flex", alignItems: "baseline" }}>
      {paddedCurrent.split("").map((char, i) => {
        const prevChar = paddedPrev[i] || "";
        const isDigit = DIGITS.includes(char) && DIGITS.includes(prevChar);

        if (!isAnimating || char === prevChar) {
          return <SlotChar key={i} char={char} />;
        }

        if (isDigit) {
          return <RollingDigit key={i} from={prevChar} to={char} />;
        }

        return <FlipChar key={i} char={char} />;
      })}
    </h2>
  );
}

function SlotChar({ char }: { char: string }) {
  return (
    <span className="inline-block">
      {char === " " ? " " : char}
    </span>
  );
}

function FlipChar({ char }: { char: string }) {
  return (
    <span className="inline-block overflow-hidden" style={{ height: "1em", lineHeight: 1 }}>
      <span
        style={{
          display: "inline-block",
          animation: "slot-flip 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        }}
      >
        {char}
      </span>
    </span>
  );
}

function RollingDigit({ from, to }: { from: string; to: string }) {
  const fromNum = parseInt(from);
  const toNum = parseInt(to);
  const diff = ((toNum - fromNum) + 10) % 10;
  const steps: string[] = [];
  for (let i = 0; i <= diff; i++) {
    steps.push(String((fromNum + i) % 10));
  }

  const totalHeight = steps.length;

  return (
    <span className="inline-block overflow-hidden" style={{ height: "1em", lineHeight: 1 }}>
      <span
        style={{
          display: "inline-flex",
          flexDirection: "column",
          animation: `slot-roll-${steps.length} 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards`,
        }}
      >
        {steps.map((digit, i) => (
          <span key={i} className="inline-block" style={{ height: "1em", lineHeight: 1 }}>
            {digit}
          </span>
        ))}
      </span>
    </span>
  );
}
