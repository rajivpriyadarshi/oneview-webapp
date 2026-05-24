export default function GoalsList() {
  return (
    <section className="goals-list">
      {/* <GoalItem name="Will planning" showAction /> */}
      <GoalItem name="House planning" href="https://housing.zinc.money/" />
      {/* <GoalItem name="Silverdale fund" /> */}
    </section>
  );
}

function GoalItem({ name, href }: { name: string; href?: string }) {
  return (
    <div className="goal-item">
      <div className="goal-item-left">
        <div className="goal-icon">
          <GoalStackIcon />
        </div>
        <span className="goal-name">{name}</span>
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="goal-action-btn"
        >
          View
          <ArrowRight />
        </a>
      )}
    </div>
  );
}

function GoalStackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path
        d="M12 2L3 7l9 5 9-5-9-5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12l9 5 9-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 17l9 5 9-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
