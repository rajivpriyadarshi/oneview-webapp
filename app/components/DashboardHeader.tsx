import Link from "next/link";

export default function DashboardHeader() {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header-left">
        <h1 className="dashboard-title">Your investments</h1>
        <p className="dashboard-subtitle">Last updated: May 16, 2026 at 4:05 PM</p>
      </div>
      <Link href="/documents-vault" className="add-more-btn">
        <PlusIcon />
        Add more
      </Link>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
