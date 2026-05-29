import PortfolioChart from "./PortfolioChart";
import { type PortfolioViewResponse, type Account, type ValuationSeriesPoint } from "../lib/portfolioDataApi";
import { type Portfolio } from "../lib/portfoliosApi";

type Props = {
  portfolioView: PortfolioViewResponse | null;
  loading: boolean;
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
  chartLoading,
  accounts,
  selectedAccountId,
  onAccountChange,
  currency,
  onCurrencyChange,
  valuationSeries,
}: Props) {
  const summary = portfolioView?.summary;
  const currSymbol = currency === "USD" ? "$" : "₹";
  const marketValue = summary ? formatLakhs(summary.total_market_value) : "—";
  const gainAmount = summary ? formatLakhs(summary.total_gain_amount) : "—";
  const gainPct = summary?.total_gain_pct != null ? `${summary.total_gain_pct.toFixed(2)}%` : "";
  const isPositive = summary ? summary.total_gain_amount >= 0 : true;
  const asOfDate = portfolioView?.as_of_date ? formatDate(portfolioView.as_of_date) : "";

  return (
    <section
      data-analytics-section="portfolio_summary"
      className="relative mt-[32px] mb-[16px] flex min-h-[180px] items-stretch justify-between gap-5 overflow-hidden rounded-[20px] bg-[#2F2B2C] px-[48px] py-[40px] pb-[50px] max-[900px]:flex-col max-[900px]:gap-6"
    >
      <div className="flex flex-col justify-between gap-6 md:gap-12 lg:gap-16">
        <div className="z-[1] flex flex-col">
          <p className="m-0 font-satoshi text-sm font-medium leading-[21px] tracking-[-0.02em] text-[#979596]">Total portfolio value</p>
          <h2 className="m-0 mb-1 mt-2 font-satoshi text-[48px] font-bold leading-[120%] tracking-[-0.04em] text-white max-[720px]:text-[2.25rem]">
            {loading ? "..." : `${currSymbol}${marketValue}`}
          </h2>
          <p className={`m-0 mb-6 font-satoshi text-sm font-normal leading-[150%] tracking-[-0.02em] ${isPositive ? "text-[#D8FF9A]" : "text-red-400"}`}>
            {loading || !summary ? "" : `${isPositive ? "+" : "-"}${currSymbol}${formatLakhs(Math.abs(summary.total_gain_amount))} (${gainPct})`}
          </p>
        </div>
        <div className="flex items-center gap-4 max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-3">
          {asOfDate && (
            <span className="font-satoshi text-sm font-normal leading-[150%] tracking-[-0.02em] text-white">
              Prices as of <strong className="font-satoshi font-bold tracking-[-0.02em] text-white">{asOfDate}</strong>
            </span>
          )}
          <div className="flex gap-2.5">
            <div className="relative inline-flex items-center rounded-full border border-white/20 bg-white/5 p-1 font-satoshi text-sm font-bold leading-6 tracking-[-0.04em]">
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[88px] rounded-full bg-white/95 shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out ${
                  currency === "USD" ? "translate-x-[88px]" : "translate-x-0"
                }`}
              />
              <button
                className={`relative z-10 w-[88px] whitespace-nowrap rounded-full px-5 py-2 text-base font-bold leading-6 tracking-[-0.04em] transition-colors duration-300 ${
                  currency === "INR" ? "text-[#2F2B2C]" : "text-white/60 hover:text-white/85"
                }`}
                onClick={() => onCurrencyChange(currency === "INR" ? "USD" : "INR")}
              >
                INR
              </button>
              <button
                className={`relative z-10 w-[88px] whitespace-nowrap rounded-full px-5 py-2 text-base font-bold leading-6 tracking-[-0.04em] transition-colors duration-300 ${
                  currency === "USD" ? "text-[#2F2B2C]" : "text-white/60 hover:text-white/85"
                }`}
                onClick={() => onCurrencyChange(currency === "INR" ? "USD" : "INR")}
              >
                USD
              </button>
            </div>
            <div className="group relative inline-flex items-center">
              <select
                className="h-[58px] cursor-pointer appearance-none overflow-hidden whitespace-nowrap text-ellipsis rounded-full border border-white/20 bg-transparent pl-7 pr-12 font-satoshi text-base font-bold leading-6 tracking-[-0.04em] text-white outline-none transition hover:bg-white/[0.03]"
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
              <ChevronDown className="pointer-events-none absolute right-4 text-white transition-transform duration-200 ease-out group-focus-within:rotate-180" />
            </div>
          </div>
        </div>
      </div>
      <PortfolioChart series={valuationSeries} currency={currency} loading={chartLoading} />
    </section>
  );
}

function formatDate(dateStr?: string) {
  const date = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatLakhs(value: number) {
  if (Math.abs(value) >= 100000) {
    return `${(value / 100000).toFixed(1)}L`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

function truncateLabel(value: string, maxLength = 16) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="8" viewBox="0 0 14 8" fill="none" className={className}>
      <path d="M1 1L7 7L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
