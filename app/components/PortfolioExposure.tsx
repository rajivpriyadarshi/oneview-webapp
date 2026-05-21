export default function PortfolioExposure() {
  return (
    <section className="portfolio-exposure">
      <h3 className="exposure-title">
        <ExposureIcon />
        Portfolio Exposure
      </h3>
      <div className="exposure-charts">
        <div className="exposure-chart">
          <p className="exposure-chart-label">
            By <strong>Asset type</strong>
          </p>
          <div className="donut-container">
            <svg viewBox="0 0 120 120" className="donut">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#c8b850" strokeWidth="24" strokeDasharray="160 283" strokeDashoffset="0" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#6b5ce7" strokeWidth="24" strokeDasharray="103 283" strokeDashoffset="-160" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#f472b6" strokeWidth="24" strokeDasharray="20 283" strokeDashoffset="-263" />
            </svg>
          </div>
          <div className="donut-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#c8b850" }} />
              <span>ETF</span>
              <span className="legend-value">&#8377;21.34L (43.3%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#6b5ce7" }} />
              <span>Equity</span>
              <span className="legend-value">&#8377;27.86L (56.6%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#f472b6" }} />
              <span>Other</span>
              <span className="legend-value">&#8377;23K (0.1%)</span>
            </div>
          </div>
        </div>

        <div className="exposure-chart">
          <p className="exposure-chart-label">
            By <strong>Broker</strong>
          </p>
          <div className="donut-container">
            <svg viewBox="0 0 120 120" className="donut">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#c8b850" strokeWidth="24" strokeDasharray="140 283" strokeDashoffset="0" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#6b5ce7" strokeWidth="24" strokeDasharray="90 283" strokeDashoffset="-140" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#f472b6" strokeWidth="24" strokeDasharray="53 283" strokeDashoffset="-230" />
            </svg>
          </div>
        </div>

        <div className="exposure-chart">
          <p className="exposure-chart-label">
            By <strong>Sector allocation</strong>
          </p>
          <div className="donut-container">
            <svg viewBox="0 0 120 120" className="donut">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#c8b850" strokeWidth="24" strokeDasharray="100 283" strokeDashoffset="0" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#6b5ce7" strokeWidth="24" strokeDasharray="120 283" strokeDashoffset="-100" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#f472b6" strokeWidth="24" strokeDasharray="63 283" strokeDashoffset="-220" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExposureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3v9l6.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
