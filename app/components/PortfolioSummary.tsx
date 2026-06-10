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
  const gainAmount = summary ? formatLakhs(Math.abs(summary.total_gain_amount)) : "—";
  const gainPct = summary?.total_gain_pct != null ? `${summary.total_gain_pct.toFixed(2)}%` : "";
  const isPositive = summary ? summary.total_gain_amount >= 0 : true;

  return (
    <section
      data-analytics-section="portfolio_summary"
      className="relative mb-[16px] overflow-hidden rounded-[32px] bg-white px-[24px] sm:px-[48px] py-[40px]"
    >
      <div className="mb-6">
        <div className="group relative inline-flex items-center">
          <select
            className="h-[48px] cursor-pointer appearance-none overflow-hidden whitespace-nowrap text-ellipsis rounded-full border border-black/10 bg-transparent pl-5 pr-10 font-satoshi text-[14px] font-bold leading-6 tracking-[-0.04em] text-black outline-none transition hover:bg-black/[0.02]"
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
        <div className="flex flex-col justify-center gap-2">
          <p className="m-0 font-satoshi text-[14px] font-normal leading-[21px] tracking-[-0.02em] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>
            Total assets
          </p>
          <h2 className="m-0 font-['ButlerPro'] text-[72px] font-medium leading-[100%] tracking-[-0.04em] text-black max-[720px]:text-[48px]">
            {loading ? "..." : `${currSymbol}${marketValue}`}
          </h2>
          <p className={`m-0 mt-2 font-satoshi text-[16px] font-medium leading-[150%] tracking-[-0.02em] ${isPositive ? "text-[#128044]" : "text-red-600"}`} style={{ fontFeatureSettings: "'ss03' on" }}>
            {loading || !summary ? "" : `${isPositive ? "+" : "-"}${gainAmount} L (${gainPct})`}
          </p>
        </div>

        <div className="flex-1 min-w-0 max-w-[60%] max-[900px]:max-w-full">
          <PortfolioChart series={valuationSeries} currency={currency} loading={chartLoading} />
        </div>
      </div>
    </section>
  );
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
    <svg width="12" height="7" viewBox="0 0 14 8" fill="none" className={className}>
      <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
