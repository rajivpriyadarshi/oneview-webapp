export default function PortfolioSummary() {
  return (
    <section className="portfolio-summary">
      <div className="portfolio-info">
        <p className="portfolio-label">Total portfolio value</p>
        <h2 className="portfolio-value">&#8377;49.2L</h2>
        <p className="portfolio-gain">+11.13 L (22.64%)</p>
        <div className="portfolio-meta">
          <span className="portfolio-date">Prices as of <strong>May 18, 026</strong></span>
          <div className="portfolio-filters">
            <button className="filter-btn">
              All accounts
              <ChevronDown />
            </button>
            <button className="filter-btn">
              INR
              <ChevronDown />
            </button>
          </div>
        </div>
      </div>
      <div className="portfolio-chart">
        <div className="chart-y-axis">
          <span>&#8377;60L</span>
          <span>&#8377;40L</span>
          <span>&#8377;30L</span>
          <span>&#8377;25L</span>
          <span>&#8377;10L</span>
        </div>
        <div className="chart-area">
          <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="chart-svg">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(200, 180, 80, 0.3)" />
                <stop offset="100%" stopColor="rgba(200, 180, 80, 0)" />
              </linearGradient>
            </defs>
            <path
              d="M0 100 L50 95 L100 90 L150 85 L180 80 L200 60 L230 30 L260 25 L280 20 L300 20"
              fill="none"
              stroke="#c8b850"
              strokeWidth="2"
            />
            <path
              d="M0 100 L50 95 L100 90 L150 85 L180 80 L200 60 L230 30 L260 25 L280 20 L300 20 L300 120 L0 120 Z"
              fill="url(#chartGradient)"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
