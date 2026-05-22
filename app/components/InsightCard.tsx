export default function InsightCard() {
  return (
    <section className="insight-card">
      <span className="insight-tag">TOP PRIORITY</span>
      <h2 className="insight-heading">
        With 20% more US exposure, your portfolio would have held up better
      </h2>
      <p className="insight-description">
        Your holdings in USD is outperforming your Indian equities by ~6%. Consider
      </p>
      <div className="insight-value-block">
        <span className="insight-value">+&#8377;19.2L</span>
        <span className="insight-value-label">Estimated difference</span>
      </div>
      <button className="view-simulation-btn">
        View simulation
        <ArrowRight />
      </button>
    </section>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
      <path
        d="M4 10h12M12 6l4 4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
