import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import PortfolioSummary from "../components/PortfolioSummary";
import PortfolioExposure from "../components/PortfolioExposure";
import HoldingsTable from "../components/HoldingsTable";
import "./dashboard.css";

export default function DashboardPage() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <DashboardHeader />
        <PortfolioSummary />
        <PortfolioExposure />
        <HoldingsTable />
      </main>
    </div>
  );
}
