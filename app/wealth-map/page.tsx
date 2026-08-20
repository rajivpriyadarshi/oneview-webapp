"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BubbleController,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Chart } from "react-chartjs-2";
import { ProtectedRoute } from "../components/ProtectedRoute";
import "./wealth-map.css";

ChartJS.register(BubbleController, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler, ChartDataLabels);

type WealthPoint = {
  x: number;
  y: number;
  r: number;
  label: string;
  value?: string;
  status?: string;
  kind: "client" | "category" | "asset" | "dot";
};

const attentionItems = [
  {
    title: "Technology concentration is worrying",
    body: "Diversification options for the NASDAQ position have not yet been discussed.",
    action: "Find alternatives to reduce tech exposure",
  },
  {
    title: "Enquiry about selling of property",
    body: "Prashanth was evaluating getting a loan or selling some of his investments",
    action: "Evaluation options",
  },
  {
    title: "Insurance document expired",
    body: "Ask for new document",
    action: "Draft an email to ask",
  },
  {
    title: "Education fee approaching",
    body: "The next university payment of $42,000 is expected in September. Confirm how it will be funded.",
    action: "Compare ways to fund this",
  },
];

const categoryPoints: WealthPoint[] = [
  { x: 42, y: 66, r: 18, label: "Family Trust", value: "Adjusted value: $378M", kind: "category" },
  { x: 42, y: 50, r: 18, label: "Financials", value: "Adjusted value: $378M", kind: "category" },
  { x: 42, y: 37, r: 18, label: "Family", value: "Adjusted value: $378M", kind: "category" },
  { x: 42, y: 21, r: 18, label: "Non-financials", value: "Adjusted value: $378M", kind: "category" },
  { x: 65, y: 63, r: 18, label: "Loans", value: "Adjusted value: $378M", kind: "category" },
  { x: 65, y: 50, r: 20, label: "Assets", value: "Adjusted value: $378M", kind: "category" },
  { x: 65, y: 36, r: 18, label: "Investments", value: "Adjusted value: $378M", kind: "category" },
];

const assetPoints: WealthPoint[] = [
  { x: 88, y: 82, r: 14, label: "MENGI YAY VIRTUS XP55", value: "Adjusted value: $10K", status: "Not on record", kind: "asset" },
  { x: 91, y: 75, r: 14, label: "Porsche 911 GT3", value: "Adjusted value: $90K", status: "Not on record", kind: "asset" },
  { x: 93, y: 67, r: 14, label: "Arts & paintings", value: "Adjusted value: $101K", status: "Not on record", kind: "asset" },
  { x: 94, y: 58, r: 14, label: "Rolex watches", value: "Adjusted value: $70K", status: "Verified", kind: "asset" },
  { x: 95, y: 50, r: 16, label: "Jumeirah lake tower", value: "Adjusted value: $2.1M", status: "Explore details", kind: "asset" },
  { x: 94, y: 42, r: 14, label: "BMW X3", value: "Adjusted value: $80K", status: "Not on record", kind: "asset" },
  { x: 93, y: 34, r: 14, label: "India Farmland", value: "Adjusted value: $110K", status: "Not on record", kind: "asset" },
  { x: 91, y: 26, r: 14, label: "Australia apartment", value: "Adjusted value: $900K", status: "Not on record", kind: "asset" },
  { x: 88, y: 18, r: 14, label: "US condo", value: "Adjusted value: $700K", status: "Not on record", kind: "asset" },
];

const dotPoints: WealthPoint[] = [
  { x: 24, y: 48, r: 2.4, label: "", kind: "dot" },
  { x: 28, y: 52, r: 2, label: "", kind: "dot" },
  { x: 34, y: 45, r: 2, label: "", kind: "dot" },
  { x: 40, y: 72, r: 2.4, label: "", kind: "dot" },
  { x: 47, y: 69, r: 2, label: "", kind: "dot" },
  { x: 49, y: 50, r: 3, label: "", kind: "dot" },
  { x: 54, y: 46, r: 2, label: "", kind: "dot" },
  { x: 49, y: 32, r: 2.3, label: "", kind: "dot" },
  { x: 73, y: 65, r: 2.2, label: "", kind: "dot" },
  { x: 73, y: 50, r: 2.6, label: "", kind: "dot" },
  { x: 71, y: 37, r: 2.2, label: "", kind: "dot" },
];

const clientPoint: WealthPoint = {
  x: 24,
  y: 50,
  r: 24,
  label: "Prashanth Ranganathan",
  value: "Adjusted value: $378M",
  kind: "client",
};

const categoryColors = ["#0e9f59", "#8e35d1", "#1687e8", "#ef9a1a", "#13b7cf", "#e6362f", "#824500"];

export default function WealthMapPage() {
  return (
    <ProtectedRoute>
      <main className="wealth-tab-page">
        <aside className="wealth-assistant-panel">
          <div className="wealth-conversation-header">
            <button type="button" className="plain-control">
              New conversation
              <ChevronDownIcon />
            </button>
            <button type="button" className="icon-control" aria-label="New conversation">
              <PlusIcon />
            </button>
          </div>

          <section className="wealth-attention">
            <h1>Things that need your attention</h1>
            <div className="wealth-attention-list">
              {attentionItems.map((item) => (
                <article className="wealth-attention-card" key={item.title}>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                  <button type="button">
                    <ArrowRightIcon />
                    {item.action}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <div className="wealth-composer">
            <span>What can I help you with?</span>
            <div>
              <button type="button" className="icon-control" aria-label="Attach document">
                <PaperclipIcon />
              </button>
              <button type="button" className="workflow-control">
                Explore workflows
                <ChevronDownIcon />
              </button>
              <button type="button" className="icon-control" aria-label="Voice input">
                <MicIcon />
              </button>
              <button type="button" className="send-control" aria-label="Send">
                <UpArrowIcon />
              </button>
            </div>
          </div>
        </aside>

        <section className="wealth-tab-workspace">
          <header className="wealth-tab-header">
            <nav className="wealth-section-tabs" aria-label="Wealth tabs">
              <Link href="/dashboard">
                <PieIcon />
                Overview
              </Link>
              <Link href="/wealth-map" className="active">
                <PeopleIcon />
                Wealth map
              </Link>
              <Link href="/client">
                <ChatIcon />
                Interactions
              </Link>
              <Link href="/documents-vault">
                <DocumentIcon />
                Documents
              </Link>
            </nav>
            <div className="wealth-header-actions">
              <button type="button" className="icon-control bordered" aria-label="More options">
                <MoreIcon />
              </button>
              <button type="button" className="share-control">
                <ShareIcon />
                Share
              </button>
            </div>
          </header>

          <section className="wealth-chart-stage" aria-label="Wealth map chart">
            <WealthMapChart />
            <div className="wealth-zoom-controls" aria-label="Map controls">
              <button type="button" aria-label="Zoom out">
                <MinusIcon />
              </button>
              <button type="button" aria-label="Zoom in">
                <PlusIcon />
              </button>
              <button type="button" aria-label="Reset view">
                <HomeIcon />
              </button>
            </div>
          </section>
        </section>
      </main>
    </ProtectedRoute>
  );
}

function WealthMapChart() {
  const data = useMemo<ChartData<"bubble", WealthPoint[]>>(
    () => ({
      datasets: [
        {
          label: "Client",
          data: [clientPoint],
          backgroundColor: "#17120a",
          borderColor: "#17120a",
          borderWidth: 2,
        },
        {
          label: "Categories",
          data: categoryPoints,
          backgroundColor: categoryColors,
          borderColor: categoryColors,
          borderWidth: 2,
        },
        {
          label: "Assets",
          data: assetPoints,
          backgroundColor: assetPoints.map((point) => (point.status === "Verified" ? "#2f8d50" : "#d7b681")),
          borderColor: assetPoints.map((point) => (point.label === "Jumeirah lake tower" ? "#b47c42" : "#c8a77b")),
          borderWidth: assetPoints.map((point) => (point.label === "Jumeirah lake tower" ? 3 : 1.5)),
        },
        {
          label: "Signal dots",
          data: dotPoints,
          backgroundColor: ["#875000", "#875000", "#875000", "#0e9f59", "#0e9f59", "#8e35d1", "#8e35d1", "#1687e8", "#13b7cf", "#e6362f", "#824500"],
          borderWidth: 0,
          datalabels: { display: false },
        },
      ],
    }),
    [],
  );

  const options = useMemo<ChartOptions<"bubble">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: { left: 30, right: 118, top: 70, bottom: 46 },
      },
      scales: {
        x: {
          type: "linear",
          min: 0,
          max: 100,
          display: false,
        },
        y: {
          type: "linear",
          min: 0,
          max: 90,
          display: false,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw as WealthPoint;
              return [point.label, point.value, point.status].filter(Boolean) as string[];
            },
          },
        },
        datalabels: {
          align: (context) => {
            const point = getPointFromLabelContext(context);
            return point.kind === "asset" ? "right" : "right";
          },
          anchor: "end",
          offset: (context) => (getPointFromLabelContext(context).kind === "asset" ? 12 : 10),
          clip: false,
          color: (context) => (getPointFromLabelContext(context).kind === "client" ? "#fff" : "#111"),
          font: (context) => {
            const point = getPointFromLabelContext(context);
            return {
              family: "Satoshi",
              size: point.kind === "asset" ? 11 : 12,
              weight: 700,
            };
          },
          formatter: (value: WealthPoint) => {
            if (value.kind === "dot") return "";
            if (value.kind === "client") return `${value.label}\n${value.value}`;
            if (value.kind === "asset") return `${value.label}\n${value.value}\n${value.status}`;
            return `${value.label}\n${value.value}`;
          },
          textAlign: "left",
        },
      },
    }),
    [],
  );

  return <Chart type="bubble" data={data} options={options} plugins={[wealthMapCanvasPlugin]} />;
}

function getPointFromLabelContext(context: { chart: ChartJS; datasetIndex: number; dataIndex: number }) {
  const dataset = context.chart.data.datasets[context.datasetIndex];
  return dataset.data[context.dataIndex] as WealthPoint;
}

const wealthMapCanvasPlugin: Plugin<"bubble"> = {
  id: "wealthMapCanvas",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;

    ctx.save();
    drawGrid(ctx, chartArea);
    drawRings(ctx, chartArea);
    drawAmbient(ctx, scales.x.getPixelForValue(51), scales.y.getPixelForValue(51), "#9bf0c0");
    drawAmbient(ctx, scales.x.getPixelForValue(56), scales.y.getPixelForValue(45), "#d6c7ff");
    drawAmbient(ctx, scales.x.getPixelForValue(64), scales.y.getPixelForValue(39), "#ffd7bd");

    const point = (x: number, y: number) => ({
      x: scales.x.getPixelForValue(x),
      y: scales.y.getPixelForValue(y),
    });

    drawCurve(ctx, point(0, 50), point(24, 50), "#c99649", 1.7);
    [[42, 66, "#33aa72"], [42, 50, "#9b62cd"], [42, 37, "#4b9de7"], [42, 21, "#dca044"]].forEach(([x, y, color]) => {
      drawCurve(ctx, point(24, 50), point(Number(x), Number(y)), String(color), 1.25);
    });
    [[65, 63, "#74c8d0"], [65, 50, "#df7a75"], [65, 36, "#a86a24"]].forEach(([x, y, color]) => {
      drawCurve(ctx, point(42, 50), point(Number(x), Number(y)), String(color), 1.25);
    });
    assetPoints.forEach((asset) => {
      drawCurve(ctx, point(65, 50), point(asset.x, asset.y), "#caa47d", 1, true);
    });
    drawCurve(ctx, point(65, 50), point(95, 50), "#a66f33", 1.8);
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart;
    ctx.save();
    drawNodeCard(ctx, scales.x.getPixelForValue(clientPoint.x), scales.y.getPixelForValue(clientPoint.y), 178, 76, "#17120a", "#17120a");
    categoryPoints.forEach((node, index) => {
      drawNodeCard(
        ctx,
        scales.x.getPixelForValue(node.x),
        scales.y.getPixelForValue(node.y),
        170,
        54,
        "rgba(255, 255, 255, 0.92)",
        categoryColors[index],
      );
    });
    assetPoints.forEach((asset) => {
      drawAssetTile(ctx, scales.x.getPixelForValue(asset.x), scales.y.getPixelForValue(asset.y), asset.status === "Verified");
    });
    ctx.restore();
  },
};

function drawGrid(ctx: CanvasRenderingContext2D, area: { left: number; right: number; top: number; bottom: number }) {
  ctx.fillStyle = "rgba(74, 65, 56, 0.22)";
  for (let x = area.left; x <= area.right; x += 50) {
    for (let y = area.top; y <= area.bottom; y += 50) {
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRings(ctx: CanvasRenderingContext2D, area: { right: number; top: number; bottom: number }) {
  const centerX = area.right - 54;
  const centerY = (area.top + area.bottom) / 2;
  ctx.strokeStyle = "rgba(190, 164, 125, 0.18)";
  ctx.lineWidth = 1;
  [150, 270, 395].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI * 0.58, Math.PI * 1.42);
    ctx.stroke();
  });
  ctx.strokeStyle = "rgba(190, 164, 125, 0.28)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 286, Math.PI * 0.58, Math.PI * 1.42);
  ctx.stroke();
}

function drawAmbient(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, 150);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
  width: number,
  dashed = false,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = dashed ? 0.58 : 0.75;
  ctx.setLineDash(dashed ? [1, 5] : []);
  ctx.beginPath();
  const midX = start.x + (end.x - start.x) * 0.56;
  ctx.moveTo(start.x, start.y);
  ctx.bezierCurveTo(midX, start.y, midX, end.y, end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawNodeCard(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, fill: string, stroke: string) {
  const radius = 12;
  const left = x - 28;
  const top = y - height / 2;
  ctx.shadowColor = "rgba(30, 28, 24, 0.16)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.4;
  roundRect(ctx, left, top, width, height, radius);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = fill === "#17120a" ? "#ffbf28" : stroke;
  ctx.beginPath();
  ctx.arc(left + 28, y, 16, 0, Math.PI * 2);
  ctx.fill();
}

function drawAssetTile(ctx: CanvasRenderingContext2D, x: number, y: number, verified: boolean) {
  ctx.shadowColor = "rgba(30, 28, 24, 0.15)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = verified ? "#2f8d50" : "#caa56e";
  roundRect(ctx, x - 15, y - 15, 30, 30, 7);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
  ctx.fillRect(x - 8, y - 8, 16, 16);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function SvgIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
      {children}
    </svg>
  );
}

function ChevronDownIcon() {
  return <SvgIcon><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>;
}

function PlusIcon() {
  return <SvgIcon><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></SvgIcon>;
}

function ArrowRightIcon() {
  return <SvgIcon><path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>;
}

function PaperclipIcon() {
  return <SvgIcon><path d="M8 12.7l6.8-6.8a3 3 0 014.2 4.2l-8.2 8.2a4.5 4.5 0 01-6.4-6.4l8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>;
}

function MicIcon() {
  return <SvgIcon><path d="M12 14a4 4 0 004-4V6a4 4 0 00-8 0v4a4 4 0 004 4zM5 10a7 7 0 0014 0M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>;
}

function UpArrowIcon() {
  return <SvgIcon><path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>;
}

function PieIcon() {
  return <SvgIcon><path d="M12 3v9h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M20.5 15A9 9 0 1110 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></SvgIcon>;
}

function PeopleIcon() {
  return <SvgIcon><path d="M8.5 11a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM3 19c.5-3.3 2.5-5.2 5.5-5.2s5 1.9 5.5 5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M16 11a2.7 2.7 0 100-5.4M15.5 14c2.2.2 3.8 1.8 4.2 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></SvgIcon>;
}

function ChatIcon() {
  return <SvgIcon><path d="M20 11.5c0 4-3.8 7.2-8.5 7.2-1.1 0-2.2-.2-3.1-.5L4 19.5l1.2-3.4A6.7 6.7 0 013 11.5C3 7.5 6.8 4.3 11.5 4.3S20 7.5 20 11.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>;
}

function DocumentIcon() {
  return <SvgIcon><path d="M7 3h7l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M14 3v5h5M8.5 12h7M8.5 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>;
}

function MoreIcon() {
  return <SvgIcon><path d="M12 6.5h.01M12 12h.01M12 17.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></SvgIcon>;
}

function ShareIcon() {
  return <SvgIcon><path d="M12 15V4M7 8l5-5 5 5M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>;
}

function MinusIcon() {
  return <SvgIcon><path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></SvgIcon>;
}

function HomeIcon() {
  return <SvgIcon><path d="M4 11l8-7 8 7M6.5 10v9h11v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></SvgIcon>;
}
