import PortfolioChart from "./PortfolioChart";
import { type PortfolioViewResponse, type Account } from "../lib/portfolioDataApi";
import { type Portfolio } from "../lib/portfoliosApi";

type Props = {
  portfolioView: PortfolioViewResponse | null;
  loading: boolean;
  accounts: Account[];
  selectedAccountId: number | "all";
  onAccountChange: (accountId: number | "all") => void;
  portfolios: Portfolio[];
  selectedPortfolio: Portfolio | null;
  onPortfolioChange: (portfolioId: number) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
};

export default function PortfolioSummary({
  portfolioView,
  loading,
  accounts,
  selectedAccountId,
  onAccountChange,
  currency,
  onCurrencyChange,
}: Props) {
  const summary = portfolioView?.summary;
  const currSymbol = currency === "USD" ? "$" : "₹";
  const marketValue = summary ? formatLakhs(summary.total_market_value) : "—";
  const gainAmount = summary ? formatLakhs(summary.total_gain_amount) : "—";
  const gainPct = summary?.total_gain_pct != null ? `${summary.total_gain_pct.toFixed(2)}%` : "";
  const isPositive = summary ? summary.total_gain_amount >= 0 : true;

  return (
    <section className="portfolio-summary">
      <div className="portfolio-info">
        <p className="portfolio-label">Total portfolio value</p>
        <h2 className="portfolio-value">
          {loading ? "..." : `${currSymbol}${marketValue}`}
        </h2>
        <p className={`portfolio-gain ${isPositive ? "" : "negative"}`}>
          {loading ? "" : `${isPositive ? "+" : "-"}${currSymbol}${formatLakhs(Math.abs(summary!.total_gain_amount))} (${gainPct})`}
        </p>
        <div className="portfolio-meta">
          <span className="portfolio-date">
            Prices as of <strong>{formatDate(portfolioView?.as_of_date)}</strong>
          </span>
          <div className="portfolio-filters">
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
            <div className="filter-select-wrapper">
              <select
                className="filter-btn"
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
              <ChevronDown />
            </div>
          </div>
        </div>
      </div>
      <PortfolioChart />
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
