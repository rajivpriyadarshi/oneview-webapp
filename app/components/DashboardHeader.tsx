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
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 5V19M5 12H19" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
