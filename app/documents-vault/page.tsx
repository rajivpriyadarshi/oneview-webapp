import Sidebar from "../components/Sidebar";
import { DocumentsVault } from "../components/DocumentsVault";
import "../portfolio/portfolio.css";
import "./documents-vault.css";

export default function DocumentsVaultPage() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <DocumentsVault />
      </main>
    </div>
  );
}
