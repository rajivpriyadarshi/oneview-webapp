"use client";

import { useState } from "react";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import DocumentsListView from "../components/DocumentsListView";
import { MobileHeader } from "../components/MobileHeader";
import "./documents-vault.css";

export default function DocumentsVaultPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen overflow-x-hidden bg-transparent">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <MobileHeader onMenuOpen={() => setSidebarOpen(true)} />
        <main className="box-border w-full max-w-full flex-1 overflow-x-hidden pt-[70px] md:pt-[120px] md:ml-16 px-0 md:px-[60px]">
          <DocumentsListView />
        </main>
      </div>
    </ProtectedRoute>
  );
}
