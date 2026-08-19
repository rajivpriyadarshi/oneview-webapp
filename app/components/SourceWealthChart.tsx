"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  Legend,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartArea,
  type ChartData,
  type ChartOptions,
  type Plugin,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Chart } from "react-chartjs-2";

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, ChartDataLabels);

type NodeKind = "client" | "category" | "asset" | "dot";

type WealthMapPoint = {
  id: string;
  x: number;
  y: number;
  r: number;
  kind: NodeKind;
  title: string;
  subtitle?: string;
  status?: string;
  color: string;
  accent?: string;
  tone?: "green" | "red" | "gold" | "blue" | "purple" | "orange" | "brown";
  rotate?: number;
  badge?: string;
  featured?: boolean;
};

const client: WealthMapPoint = {
  id: "client",
  x: 12,
  y: 50,
  r: 18,
  kind: "client",
  title: "Prashanth Ranganathan",
  subtitle: "Adjusted value: $378M",
  color: "#211507",
  accent: "#b7771e",
};

const categories: WealthMapPoint[] = [
  { id: "family-trust", x: 38, y: 40, r: 8, kind: "category", title: "Family Trust", subtitle: "Adjusted value: $378M", color: "#ffffff", accent: "#c0c0c0", tone: "green", badge: "ENTITY" },
  { id: "financials", x: 38, y: 50, r: 8, kind: "category", title: "Financials", subtitle: "Adjusted value: $378M", color: "#fdf6ee", accent: "#8b6b3a", tone: "purple", badge: "CATEGORY", featured: true },
  { id: "family", x: 38, y: 58, r: 8, kind: "category", title: "Family", subtitle: "Adjusted value: $378M", color: "#ffffff", accent: "#c0c0c0", tone: "blue", badge: "CATEGORY" },
  { id: "non-financials", x: 38, y: 68, r: 8, kind: "category", title: "Non-financials", subtitle: "Adjusted value: $378M", color: "#ffffff", accent: "#c0c0c0", tone: "orange", badge: "CATEGORY" },
  { id: "loans", x: 62, y: 42, r: 8, kind: "category", title: "Loans", subtitle: "Adjusted value: $378M", color: "#ffffff", accent: "#c0c0c0", tone: "blue", badge: "CATEGORY" },
  { id: "assets", x: 62, y: 50, r: 8, kind: "category", title: "Assets", subtitle: "Adjusted value: $378M", color: "#fdf6ee", accent: "#8b6b3a", tone: "red", featured: true },
  { id: "investments", x: 62, y: 58, r: 8, kind: "category", title: "Investments", subtitle: "Adjusted value: $378M", color: "#ffffff", accent: "#c0c0c0", tone: "brown", badge: "CATEGORY" },
];

const assetDefs = [
  { id: "boat", title: "MENGI YAY VIRTUS XP55", subtitle: "Adjusted value: $45M", status: "Not on record", color: "#1c8f7c", badge: "ASSET" },
  { id: "porsche", title: "Porsche 911 GT3", subtitle: "Adjusted value: $90K", status: "Not on record", color: "#266f77", badge: "ASSET" },
  { id: "art", title: "Arts & paintings", subtitle: "Adjusted value: $101K", status: "Not on record", color: "#c9b05e", badge: "ASSET" },
  { id: "watch", title: "Rolex watches", subtitle: "Adjusted value: $70K", status: "Verified", color: "#294b2a", badge: "ASSET" },
  { id: "jlt", title: "Jumeirah lake tower", subtitle: "Adjusted value: $2.1M", status: "Expand details", color: "#136b77", badge: "ASSET", featured: true },
  { id: "bmw", title: "BMW X3", subtitle: "Adjusted value: $110K", status: "Not on record", color: "#243d58", badge: "ASSET" },
  { id: "farmland", title: "India Farmland", subtitle: "Adjusted value: $110K", status: "Not on record", color: "#4d8e35", badge: "ASSET" },
  { id: "australia", title: "Australia apartment", subtitle: "Adjusted value: $1M", status: "Not on record", color: "#7c6230", badge: "ASSET" },
  { id: "us-condo", title: "US condo", subtitle: "Adjusted value: $700K", status: "Not on record", color: "#5d7434", badge: "ASSET" },
  { id: "singapore", title: "Singapore penthouse", subtitle: "Adjusted value: $1M", status: "Not on record", color: "#358c74", badge: "ASSET" },
  { id: "mumbai", title: "Mumbai complex", subtitle: "Adjusted value: $800K", status: "Not on record", color: "#a86f2c", badge: "ASSET" },
];

const ARC_CX = 62;
const ARC_CY = 50;
const ARC_R = 48;

const assets: WealthMapPoint[] = assetDefs.map((def, i) => {
  const angle = -60 + (120 / (assetDefs.length - 1)) * i;
  const rad = (angle * Math.PI) / 180;
  return {
    ...def,
    x: ARC_CX + ARC_R * Math.cos(rad),
    y: ARC_CY + ARC_R * Math.sin(rad),
    r: def.featured ? 5.5 : 5,
    kind: "asset" as const,
    rotate: angle,
  };
});

const dots: WealthMapPoint[] = [
  { id: "d1", x: 13, y: 48, r: 1.2, kind: "dot", title: "", color: "#7F4E0B" },
  { id: "d10", x: 67, y: 63, r: 1.3, kind: "dot", title: "", color: "#7F4E0B" },
];

const allPoints = [client, ...categories, ...assets, ...dots];

export function SourceWealthChart({ className = "" }: { className?: string }) {
  const data = useMemo<ChartData<"bubble", WealthMapPoint[]>>(
    () => ({
      datasets: [
        {
          label: "Wealth map",
          data: allPoints,
          backgroundColor: allPoints.map((point) => point.kind === "dot" ? point.color : "rgba(0,0,0,0)"),
          borderColor: allPoints.map((point) => point.kind === "dot" ? point.color : "rgba(0,0,0,0)"),
          borderWidth: 0,
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
      layout: { padding: { top: 24, right: 140, bottom: 22, left: 18 } },
      scales: {
        x: { min: 0, max: 100, display: false },
        y: { min: 0, max: 100, reverse: true, display: false },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false },
      },
    }),
    [],
  );

  return (
    <div className={`relative h-full min-h-[620px] w-full overflow-auto ${className}`}>
      <Chart type="bubble" data={data} options={options} plugins={[wealthMapPlugin]} />
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-1 shadow-sm">
        <button type="button" className="text-sm font-medium text-gray-800 w-6 h-6 flex items-center justify-center">−</button>
        <button type="button" className="text-sm font-medium text-gray-800 w-6 h-6 flex items-center justify-center">+</button>
        <button type="button" className="w-6 h-6 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
            <path d="M4 11l8-7 8 7M6.5 10v9h11v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const wealthMapPlugin: Plugin<"bubble"> = {
  id: "radialWealthMap",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;

    const px = (x: number) => scales.x.getPixelForValue(x);
    const py = (y: number) => scales.y.getPixelForValue(y);

    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
    drawGrid(ctx, chartArea);
    drawAmbient(ctx, px(38), py(43), "#caffdc", 170);
    drawAmbient(ctx, px(50), py(52), "#dacdff", 155);
    drawAmbient(ctx, px(64), py(54), "#ffd0b8", 145);
    drawAmbient(ctx, px(42), py(76), "#fff0aa", 125);
    drawConnections(ctx, px, py);
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart;
    const px = (x: number) => scales.x.getPixelForValue(x);
    const py = (y: number) => scales.y.getPixelForValue(y);

    ctx.save();
    drawClientCard(ctx, px(client.x), py(client.y));
    categories.forEach((node) => drawCategoryCard(ctx, px(node.x), py(node.y), node));
    assets.forEach((asset) => drawAssetTile(ctx, px(asset.x), py(asset.y), asset));

    // Brown dot at Financials left edge connection
    const catLeftEdge = px(38) - 26;
    ctx.fillStyle = "#7F4E0B";
    ctx.beginPath();
    ctx.arc(catLeftEdge, py(50), 4, 0, Math.PI * 2);
    ctx.fill();

    // Brown dot at Assets left edge connection
    const rightCatLeftEdge = px(62) - 26;
    ctx.fillStyle = "#7F4E0B";
    ctx.beginPath();
    ctx.arc(rightCatLeftEdge, py(50), 4, 0, Math.PI * 2);
    ctx.fill();

    // Brown dot at featured asset (Jumeirah lake tower) connection
    const featuredAsset = assets.find((a) => a.featured);
    if (featuredAsset) {
      ctx.fillStyle = "#7F4E0B";
      ctx.beginPath();
      ctx.arc(px(featuredAsset.x) - 23, py(featuredAsset.y), 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};

function drawConnections(
  ctx: CanvasRenderingContext2D,
  px: (value: number) => number,
  py: (value: number) => number,
) {
  ctx.save();
  ctx.strokeStyle = "#c99649";
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  ctx.moveTo(px(-5), py(client.y));
  ctx.lineTo(px(client.x - 5), py(client.y));
  ctx.stroke();
  ctx.restore();
  const greenDotX = px(client.x) + 155 / 2 - 8;
  const greenDotY = py(client.y) + 192 / 2 - 12;
  const catLeftEdge = px(38) - 26;
  drawCurve(ctx, greenDotX, greenDotY, catLeftEdge, py(40), "rgba(122,210,182,0.35)", 1);
  drawCurve(ctx, greenDotX, greenDotY, catLeftEdge, py(50), "#ad6a22", 1.2);
  drawCurve(ctx, greenDotX, greenDotY, catLeftEdge, py(58), "rgba(70,166,232,0.35)", 1);
  drawCurve(ctx, greenDotX, greenDotY, catLeftEdge, py(68), "rgba(241,162,27,0.35)", 1);
  // Straight horizontal line: Financials → Assets (selected)
  const rightCatLeftEdge = px(62) - 26;
  ctx.save();
  ctx.strokeStyle = "#b27331";
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  ctx.moveTo(catLeftEdge + 140, py(50));
  ctx.lineTo(rightCatLeftEdge, py(50));
  ctx.stroke();
  ctx.restore();
  // Pink curves: center → Loans (up) and center → Investments (down) (non-selected, faded)
  const midLineX = catLeftEdge + 140 + (rightCatLeftEdge - catLeftEdge - 140) * 0.1;
  drawCurve(ctx, midLineX, py(50), rightCatLeftEdge, py(40), "rgba(226,170,192,0.4)", 0.8);
  drawCurve(ctx, midLineX, py(50), rightCatLeftEdge, py(62), "rgba(226,170,192,0.4)", 0.8);

  const assetsRightEdge = rightCatLeftEdge + 140;
  assets.forEach((asset) => {
    drawCurve(ctx, assetsRightEdge, py(50), px(asset.x), py(asset.y), "#b88555", asset.featured ? 1.3 : 0.9, !asset.featured);
  });

}

function drawGrid(ctx: CanvasRenderingContext2D, area: ChartArea) {
  ctx.fillStyle = "rgba(74, 65, 56, 0.24)";
  for (let x = area.left; x <= area.right; x += 46) {
    for (let y = area.top; y <= area.bottom; y += 46) {
      ctx.beginPath();
      ctx.arc(x, y, 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}


function drawAmbient(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, radius: number) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  dotted = false,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = dotted ? 0.62 : 0.82;
  ctx.setLineDash(dotted ? [6, 4] : []);
  const midX = x1 + (x2 - x1) * 0.55;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawClientCard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const width = 155;
  const height = 192;
  const left = x - width / 2;
  const top = y - height / 2;

  drawBadge(ctx, left, top - 16, 32, "CLIENT", "#050505", "#fff", 5.5, 13, 4);
  ctx.shadowColor = "rgba(65, 44, 18, 0.24)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = "#1b1207";
  roundRect(ctx, left, top, width, height, 11);
  ctx.fill();
  ctx.strokeStyle = "#9b5c09";
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.shadowColor = "transparent";

  drawPortraitPhoto(ctx, left + 8, top + 8, width - 16, 72);

  const overlay = ctx.createLinearGradient(left, top + 60, left, top + height);
  overlay.addColorStop(0, "rgba(22, 13, 3, 0)");
  overlay.addColorStop(0.34, "rgba(22, 13, 3, 0.84)");
  overlay.addColorStop(1, "rgba(16, 10, 2, 0.98)");
  ctx.fillStyle = overlay;
  roundRect(ctx, left + 8, top + 48, width - 16, height - 58, 7);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "800 10px Satoshi, Arial";
  ctx.fillText("Prashanth Ranganathan", left + 10, top + 98);
  ctx.fillStyle = "#f3d585";
  ctx.font = "500 6px Satoshi, Arial";
  ctx.fillText("Adjusted value: $378M", left + 10, top + 108);
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  ctx.font = "400 6px Satoshi, Arial";
  wrapText(
    ctx,
    "Prashanth's wealth spans businesses, investments, trusts and multiple geographies, with liquidity, concentration and succession being the most important areas to watch.",
    left + 10,
    top + 124,
    width - 20,
    9,
    top + 160,
  );

  ctx.fillStyle = "#ffbf28";
  roundRect(ctx, left + 10, top + height - 26, 62, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = "800 6px Satoshi, Arial";
  ctx.fillText("Expand details", left + 17, top + height - 14);
  drawArrowCircle(ctx, left + 58, top + height - 18, 4);

  ctx.fillStyle = "#4caf15";
  ctx.shadowColor = "rgba(76, 175, 21, 0.42)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(left + width - 8, top + height - 12, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
}

function drawPortraitPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.save();
  roundRect(ctx, x, y, width, height, 14);
  ctx.clip();

  const background = ctx.createLinearGradient(x, y, x + width, y + height);
  background.addColorStop(0, "#55b95f");
  background.addColorStop(0.48, "#d4bd4a");
  background.addColorStop(1, "#334d35");
  ctx.fillStyle = background;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  for (let i = 0; i < 5; i += 1) {
    const stripeX = x + width * (0.12 + i * 0.18);
    ctx.fillRect(stripeX, y, width * 0.045, height);
  }

  const diagonal = ctx.createLinearGradient(x, y + height, x + width, y);
  diagonal.addColorStop(0, "rgba(255,255,255,0)");
  diagonal.addColorStop(0.52, "rgba(255,255,255,0.18)");
  diagonal.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = diagonal;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function drawArrowCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 8) {
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.45, y);
  ctx.lineTo(x + radius * 0.32, y);
  ctx.moveTo(x, y - radius * 0.38);
  ctx.lineTo(x + radius * 0.48, y);
  ctx.lineTo(x, y + radius * 0.38);
  ctx.stroke();
}

function drawCategoryCard(ctx: CanvasRenderingContext2D, x: number, y: number, node: WealthMapPoint) {
  const isActive = node.featured === true;
  const width = 140;
  const height = 44;
  const left = x - 26;
  const top = y - height / 2;
  if (node.badge) drawBadge(ctx, left, top - 15, 42, node.badge, isActive ? "#7a6840" : "#aeb9b6", "#fff", 5.5, 12, 4);
  ctx.shadowColor = "rgba(30, 28, 24, 0.12)";
  ctx.shadowBlur = isActive ? 12 : 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = isActive ? "#fdf6ee" : "#ffffff";
  roundRect(ctx, left, top, width, height, 9);
  ctx.fill();
  ctx.strokeStyle = isActive ? "#8b6b3a" : "rgba(0,0,0,0.1)";
  ctx.lineWidth = isActive ? 1.6 : 1;
  ctx.stroke();
  ctx.shadowColor = "transparent";
  drawPhoto(ctx, left + 9, top + 8, 28, 28, node.accent ?? "#5f8f4e", true);

  ctx.fillStyle = "#111";
  ctx.font = "800 10px Satoshi, Arial";
  ctx.fillText(node.title, left + 43, top + 22);
  ctx.fillStyle = "rgba(17, 17, 17, 0.62)";
  ctx.font = "500 6px Satoshi, Arial";
  ctx.fillText(node.subtitle ?? "", left + 43, top + 32);
}

function drawAssetTile(ctx: CanvasRenderingContext2D, x: number, y: number, asset: WealthMapPoint) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((asset.rotate ?? 0) * Math.PI) / 180);

  const tileW = asset.featured ? 48 : 40;
  const tileH = asset.featured ? 56 : 56;
  const tileX = -tileW / 2;
  const tileY = -tileH / 2;

  drawBadge(ctx, tileX, tileY - 14, 28, asset.badge ?? "ASSET", asset.featured ? "#6a4309" : "#aeb9b6", "#fff", 5, 11, 3);

  ctx.shadowColor = "rgba(30, 28, 24, 0.18)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  drawPhoto(ctx, tileX, tileY, tileW, tileH, asset.color);
  ctx.shadowColor = "transparent";

  if (asset.featured) {
    ctx.strokeStyle = "#b47c42";
    ctx.lineWidth = 2;
    roundRect(ctx, tileX - 2, tileY - 2, tileW + 4, tileH + 4, 9);
    ctx.stroke();
  }

  const textX = tileW / 2 + 6;
  const textY = -8;

  if (asset.featured) {
    ctx.fillStyle = "#9b6b2f";
    ctx.font = "800 6px Satoshi, Arial";
    ctx.fillText("RESIDENTIAL", textX, textY - 2);
    ctx.fillStyle = "#111";
    ctx.font = "800 10px Satoshi, Arial";
    ctx.fillText(asset.title, textX, textY + 10);
    ctx.fillStyle = "#777";
    ctx.font = "500 7px Satoshi, Arial";
    ctx.fillText(asset.subtitle ?? "", textX, textY + 19);
    ctx.fillStyle = "#111";
    roundRect(ctx, textX, textY + 24, 80, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 6.5px Satoshi, Arial";
    ctx.fillText("Expand details", textX + 8, textY + 34);
    ctx.beginPath();
    ctx.arc(textX + 68, textY + 32, 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.fillStyle = "#111";
    ctx.font = "800 9px Satoshi, Arial";
    ctx.fillText(asset.title, textX, textY + 3);
    ctx.fillStyle = "#777";
    ctx.font = "500 7px Satoshi, Arial";
    ctx.fillText(asset.subtitle ?? "", textX, textY + 13);
    const isVerified = asset.status === "Verified";
    ctx.fillStyle = isVerified ? "#1a8f4a" : "#d44";
    ctx.font = "600 7px Satoshi, Arial";
    ctx.fillText((isVerified ? "✓ " : "⊘ ") + (asset.status ?? ""), textX, textY + 23);
  }

  ctx.restore();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  text: string,
  fill: string,
  color: string,
  fontSize = 6,
  height = 14,
  radius = 4,
) {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = `800 ${fontSize}px Satoshi, Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + width / 2, y + height / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string, circular = false) {
  ctx.save();
  roundRect(ctx, x, y, width, height, circular ? width / 2 : 8);
  ctx.clip();
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.5, "#e0bd63");
  gradient.addColorStop(1, "#12352b");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.26)";
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(x + i * width * 0.22, y, width * 0.06, height);
  }
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxY = Infinity) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    if (currentY > maxY) break;
    const testLine = `${line}${word} `;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = `${word} `;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line && currentY <= maxY) ctx.fillText(line, x, currentY);
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
