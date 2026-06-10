import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import { DocumentsVault } from "../components/DocumentsVault";
import "./documents-vault.css";

export default function DocumentsVaultPage() {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen overflow-x-hidden bg-transparent">
        <Sidebar />
        <main className="box-border w-full max-w-full flex-1 overflow-x-hidden pt-[120px] md:ml-16 px-6 sm:px-[60px]">
          <DocumentsVault />
        </main>
      </div>
    </ProtectedRoute>
  );
}
