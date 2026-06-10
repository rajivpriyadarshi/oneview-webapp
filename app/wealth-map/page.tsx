"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import { useGetSankeyQuery, useListDocumentsQuery } from "../store/api";
import type { SankeyNode, SankeyResponse } from "../lib/portfolioDataApi";
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

const VIEW_OPTIONS = [
  { id: "sankey", icon: "sankey" },
  { id: "bar", icon: "bar" },
  { id: "grouped", icon: "grouped" },
];

export default function WealthMapPage() {
  const [activeView, setActiveView] = useState("sankey");
  const { data: sankeyData, isFetching, isError } = useGetSankeyQuery({
    accountIds: [],
    currency: "INR",
  });
  const { data: rawDocuments = [] } = useListDocumentsQuery();
  const docCount = rawDocuments.length;
  const accountCount = new Set(
    rawDocuments.map((d) =>
      d.broker
        ? d.broker
        : (d.display_name || d.name).match(/^([^-]+)\s*-/)?.[1]?.trim() ?? "Other"
    )
  ).size;

  return (
    <ProtectedRoute>
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="m-0 font-[var(--font-butler)] text-[2rem] font-medium leading-[38.4px] text-black">Wealth map</h1>
              <p className="m-0 font-[var(--font-inter)] text-sm font-normal leading-[21px] text-black/70">
                Total {docCount} files{accountCount > 0 ? ` across ${accountCount} brokers` : ""}
              </p>
            </div>
            <Link
              href="/documents-vault"
              className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-[#1a1a1a] px-7 py-3.5 font-[var(--font-inter)] text-base font-semibold leading-6 text-white no-underline transition hover:bg-[#333]"
            >
              <UploadIcon />
              Upload statements
            </Link>
          </header>

          <section className="wealth-map-card">
            <div className="wealth-map-toolbar">
              <div className="wealth-map-toolbar-left">
                <span className="wealth-map-label">Portfolio flow</span>
                <h2 className="wealth-map-date">
                  {sankeyData ? `As of ${formatDate(sankeyData.as_of_date)}` : "Loading portfolio flow"}
                </h2>
              </div>
              <div className="wealth-map-toolbar-right">
                <div className="wealth-map-group-select-wrapper">
                  <select
                    className="wealth-map-group-select"
                    value="account_asset_type_instrument"
                    disabled
                    aria-label="Sankey grouping"
                  >
                    <option value="account_asset_type_instrument">
                      Account → Asset type → Instrument
                    </option>
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
              {isFetching && <div className="wealth-map-state">Loading sankey chart...</div>}
              {isError && !isFetching && (
                <div className="wealth-map-state">Unable to load sankey chart.</div>
              )}
              {!isFetching && !isError && sankeyData && sankeyData.links.length > 0 && (
                <SankeyChart sankey={sankeyData} />
              )}
              {!isFetching && !isError && sankeyData && sankeyData.links.length === 0 && (
                <div className="wealth-map-state">No holdings found for this view.</div>
              )}
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}

type ChartSankeyLink = {
  from: string;
  to: string;
  flow: number;
  sourceId: string;
  targetId: string;
  currency: string;
};

function SankeyChart({ sankey }: { sankey: SankeyResponse }) {
  const { chartLinks, nodeById, labels } = useMemo(() => {
    const nodes = new Map<string, SankeyNode>(
      sankey.nodes.map((node) => [node.id, node]),
    );
    const links = sankey.links.map((link) => ({
      from: nodes.get(link.from)?.label ?? link.from,
      to: nodes.get(link.to)?.label ?? link.to,
      flow: link.value,
      sourceId: link.from,
      targetId: link.to,
      currency: link.currency,
    }));

    return {
      chartLinks: links,
      nodeById: nodes,
      labels: Object.fromEntries(
        sankey.nodes.map((node) => [node.label, node.label]),
      ),
    };
  }, [sankey]);

  const data = {
    datasets: [
      {
        data: chartLinks,
        colorFrom: (c: { dataset: { data: ChartSankeyLink[] }; dataIndex: number }) =>
          nodeById.get(c.dataset.data[c.dataIndex]?.sourceId)?.color || "#ccc",
        colorTo: (c: { dataset: { data: ChartSankeyLink[] }; dataIndex: number }) =>
          nodeById.get(c.dataset.data[c.dataIndex]?.targetId)?.color || "#ccc",
        colorMode: "gradient" as const,
        labels,
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
          label: (ctx: { raw: ChartSankeyLink }) => {
            const { from, to, flow, currency } = ctx.raw;
            return `${from} → ${to}: ${formatCurrency(flow, currency)}`;
          },
        },
      },
    },
  };

  return (
    <Chart type="sankey" data={data as never} options={options as never} />
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
