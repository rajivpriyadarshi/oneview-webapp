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
    <section className="portfolio-summary">
      <div className="flex flex-col justify-between gap-6 md:gap-12 lg:gap-16">
        <div className="portfolio-info">
          <p className="portfolio-label">Total portfolio value</p>
          <h2 className="portfolio-value">
            {loading ? "..." : `${currSymbol}${marketValue}`}
          </h2>
          <p className={`portfolio-gain ${isPositive ? "" : "negative"}`}>
            {loading || !summary ? "" : `${isPositive ? "+" : "-"}${currSymbol}${formatLakhs(Math.abs(summary.total_gain_amount))} (${gainPct})`}
          </p>
        </div>
        <div className="portfolio-meta">
          {asOfDate && (
            <span className="portfolio-date">
              Prices as of <strong>{asOfDate}</strong>
            </span>
          )}
          <div className="portfolio-filters">
           
            <div className="currency-toggle">
              <button
                className={`currency-option ${currency === "INR" ? "active" : ""}`}
                onClick={() => onCurrencyChange("INR")}
              >
                INR
              </button>
              <button
                className={`currency-option ${currency === "USD" ? "active" : ""}`}
                onClick={() => onCurrencyChange("USD")}
              >
                USD
              </button>
            </div>
            <div className="filter-select-wrapper">
              <select
                className="filter-btn"
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
              <ChevronDown />
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

function ChevronDown() {
  return (
    <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
      <path d="M1 1L7 7L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
