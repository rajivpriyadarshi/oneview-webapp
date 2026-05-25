"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import "../portfolio/portfolio.css";
import "../dashboard/home.css";
import "./wealth-map.css";

import {
  Chart as ChartJS,
  Tooltip,
  Colors,
  LinearScale,
  CategoryScale,
} from "chart.js";
import { SankeyController, Flow } from "chartjs-chart-sankey";
import { Chart } from "react-chartjs-2";

ChartJS.register(SankeyController, Flow, Tooltip, Colors, LinearScale, CategoryScale);

const MOCK_DATA = [
  { from: "Paychecks", to: "Income", flow: 4200 },
  { from: "Income", to: "Savings", flow: 480.54 },
  { from: "Income", to: "Housing", flow: 1593 },
  { from: "Income", to: "Financial", flow: 741.68 },
  { from: "Income", to: "Bills & Utilities", flow: 683.47 },
  { from: "Income", to: "Food & Dining", flow: 232.35 },
  { from: "Housing", to: "Mortgage", flow: 1385 },
  { from: "Housing", to: "Home Improvement", flow: 208 },
  { from: "Financial", to: "Loan Repayment", flow: 500.23 },
  { from: "Financial", to: "Insurance", flow: 201.45 },
  { from: "Financial", to: "Cash & ATM", flow: 40 },
  { from: "Bills & Utilities", to: "Garbage", flow: 320.47 },
  { from: "Bills & Utilities", to: "Phone", flow: 363 },
];

const COLOR_MAP: Record<string, string> = {
  Paychecks: "#5DADEC",
  Income: "#5DADEC",
  Savings: "#4CAF50",
  Housing: "#F5E6A3",
  Financial: "#E1BEE7",
  "Bills & Utilities": "#B0BEC5",
  "Food & Dining": "#FFCDD2",
  Mortgage: "#FFC107",
  "Home Improvement": "#FFC107",
  "Loan Repayment": "#AB47BC",
  Insurance: "#CE93D8",
  "Cash & ATM": "#3F51B5",
  Garbage: "#3F51B5",
  Phone: "#90A4AE",
};

const VIEW_OPTIONS = [
  { id: "sankey", icon: "sankey" },
  { id: "bar", icon: "bar" },
  { id: "grouped", icon: "grouped" },
];

export default function WealthMapPage() {
  const [groupBy, setGroupBy] = useState("By category & group");
  const [activeView, setActiveView] = useState("sankey");

  return (
    <ProtectedRoute>
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <h1 className="dashboard-title">Wealth map</h1>
              <p className="dashboard-subtitle">Total 8 files across 3 accounts</p>
            </div>
            <Link href="/documents-vault" className="upload-btn">
              <UploadIcon />
              Upload statements
            </Link>
          </header>

          <section className="wealth-map-card">
            <div className="wealth-map-toolbar">
              <div className="wealth-map-toolbar-left">
                <span className="wealth-map-label">CASH FLOW</span>
                <h2 className="wealth-map-date">Dec 1, 2024 - Dec 31, 2024</h2>
              </div>
              <div className="wealth-map-toolbar-right">
                <div className="wealth-map-group-select-wrapper">
                  <select
                    className="wealth-map-group-select"
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                  >
                    <option>By category &amp; group</option>
                    <option>By account</option>
                    <option>By type</option>
                  </select>
                  <ChevronDownIcon />
                </div>
                <div className="wealth-map-view-divider" />
                <div className="wealth-map-view-btns">
                  {VIEW_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`wealth-map-view-btn${activeView === opt.id ? " active" : ""}`}
                      onClick={() => setActiveView(opt.id)}
                    >
                      <ViewIcon type={opt.icon} />
                    </button>
                  ))}
                </div>
                <div className="wealth-map-view-divider" />
                <button className="wealth-map-share-btn">
                  <ShareIcon />
                  Share
                </button>
              </div>
            </div>

            <div className="wealth-map-chart-container">
              <SankeyChart />
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function SankeyChart() {
  const data = {
    datasets: [
      {
        data: MOCK_DATA,
        colorFrom: (c: { dataset: { data: typeof MOCK_DATA }; dataIndex: number }) =>
          COLOR_MAP[c.dataset.data[c.dataIndex]?.from] || "#ccc",
        colorTo: (c: { dataset: { data: typeof MOCK_DATA }; dataIndex: number }) =>
          COLOR_MAP[c.dataset.data[c.dataIndex]?.to] || "#ccc",
        colorMode: "gradient" as const,
        labels: Object.fromEntries(
          [...new Set(MOCK_DATA.flatMap((d) => [d.from, d.to]))].map((label) => [label, label])
        ),
        borderWidth: 0,
        nodeWidth: 20,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx: { raw: { from: string; to: string; flow: number } }) => {
            const { from, to, flow } = ctx.raw;
            return `${from} → ${to}: $${flow.toLocaleString()}`;
          },
        },
      },
    },
  };

  return (
    <Chart type="sankey" data={data as never} options={options as never} />
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path
        d="M21 15V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V15M7 8L12 3L17 8M12 3V15"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="wealth-map-chevron">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.667 8v4.667a1.333 1.333 0 001.333 1.333h8a1.333 1.333 0 001.333-1.333V8M10.667 4L8 1.333M8 1.333L5.333 4M8 1.333V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ViewIcon({ type }: { type: string }) {
  if (type === "sankey") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 4h3l4 5h5M2 14h3l4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (type === "bar") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="3" y="8" width="3" height="7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <rect x="7.5" y="4" width="3" height="11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <rect x="12" y="6" width="3" height="9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="8" width="2" height="7" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="5" y="5" width="2" height="10" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="8" y="9" width="2" height="6" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="11" y="6" width="2" height="9" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="14" y="4" width="2" height="11" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}
