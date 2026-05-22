import PortfolioChart from "./PortfolioChart";
import { type PortfolioValuation, type Account } from "../lib/portfolioDataApi";
import { type Portfolio } from "../lib/portfoliosApi";

type Props = {
  valuation: PortfolioValuation | null;
  loading: boolean;
  accounts: Account[];
  selectedAccountId: number | "all";
  onAccountChange: (accountId: number | "all") => void;
  portfolios: Portfolio[];
  selectedPortfolio: Portfolio | null;
  onPortfolioChange: (portfolioId: number) => void;
};

export default function PortfolioSummary({
  valuation,
  loading,
  accounts,
  selectedAccountId,
  onAccountChange,
  selectedPortfolio,
}: Props) {
  const marketValue = valuation ? formatLakhs(valuation.market_value) : "—";
  const gainAmount = valuation ? formatLakhs(valuation.gain_amount) : "—";
  const gainPct = valuation ? `${parseFloat(valuation.gain_pct).toFixed(2)}%` : "";
  const isPositive = valuation ? parseFloat(valuation.gain_amount) >= 0 : true;

  return (
    <section className="portfolio-summary">
      <div className="portfolio-info">
        <p className="portfolio-label">Total portfolio value</p>
        <h2 className="portfolio-value">
          {loading ? "..." : `₹${marketValue}`}
        </h2>
        <p className={`portfolio-gain ${isPositive ? "" : "negative"}`}>
          {loading ? "" : `${isPositive ? "+" : ""}${gainAmount} (${gainPct})`}
        </p>
        <div className="portfolio-meta">
          <span className="portfolio-date">
            Prices as of <strong>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong>
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
            </div>
            <button className="filter-btn">
              {selectedPortfolio?.base_currency || "INR"}
              <ChevronDown />
            </button>
          </div>
        </div>
      </div>
      <PortfolioChart />
    </section>
  );
}

function formatLakhs(value: string) {
  const num = parseFloat(value);
  if (Math.abs(num) >= 100000) {
    return `${(num / 100000).toFixed(1)}L`;
  }
  if (Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toFixed(2);
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
