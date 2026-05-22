import Sidebar from "../components/Sidebar";
import HomeHeader from "../components/HomeHeader";
import InsightCard from "../components/InsightCard";
import GoalsList from "../components/GoalsList";
import "./home.css";

export default function HomePage() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <HomeHeader />
        <InsightCard />
        <GoalsList />
      </main>
    </div>
  );
}
