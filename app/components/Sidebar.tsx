export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg
          aria-hidden="true"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          width="36"
          height="36"
        >
          <path
            d="M32 5.5 38.1 10l7.5-.8 3.1 6.9 6.9 3.1-.8 7.5 4.7 6.1-4.7 6.1.8 7.5-6.9 3.1-3.1 6.9-7.5-.8-6.1 4.9-6.1-4.9-7.5.8-3.1-6.9-6.9-3.1.8-7.5-4.7-6.1 4.7-6.1-.8-7.5 6.9-3.1 3.1-6.9 7.5.8L32 5.5Z"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <rect
            x="21"
            y="21"
            width="22"
            height="22"
            rx="6"
            transform="rotate(45 32 32)"
            fill="currentColor"
          />
        </svg>
      </div>

      <nav className="sidebar-nav">
        <button className="sidebar-btn active" aria-label="Investments">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path
              d="M3 17l4-4 4 4 10-10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 7h7v7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button className="sidebar-btn" aria-label="Portfolio">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path
              d="M12 2l2.4 4.8L20 8l-4 3.8 1 5.2-5-2.6L7 17l1-5.2-4-3.8 5.6-1.2L12 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button className="sidebar-btn" aria-label="Goals">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path
              d="M12 2l2.09 6.26L20.18 9l-5 4.09L16.54 20 12 16.27 7.46 20l1.36-6.91-5-4.09 6.09-.74L12 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
        <button className="sidebar-btn" aria-label="Reports">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 2v6h6M8 13h8M8 17h8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </nav>

      <div className="sidebar-avatar">
        <div className="avatar-placeholder" />
      </div>
    </aside>
  );
}
