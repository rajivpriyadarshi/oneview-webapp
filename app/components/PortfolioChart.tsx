"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { type ValuationSeriesPoint } from "../lib/portfolioDataApi";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const dottedGridPlugin = {
  id: "dottedGrid",
  beforeDraw(chart: ChartJS) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const yScale = scales.y;
    if (!yScale) return;

    ctx.save();
    const ticks = yScale.ticks;
    for (const tick of ticks) {
      const y = yScale.getPixelForValue(tick.value as number);
      const startX = chartArea.left;
      const endX = chartArea.right;
      const dotRadius = 0.7;
      const gap = 8;

      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      for (let x = startX; x <= endX; x += gap) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },
};

const verticalLinePlugin = {
  id: "verticalLine",
  afterDatasetsDraw(chart: ChartJS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tooltip = (chart as any).tooltip;
    if (tooltip?._active?.length) {
      const { ctx, chartArea } = chart;
      const activePoint = tooltip._active[0];
      const x = activePoint.element.x;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(212, 200, 92, 0.5)";
      ctx.stroke();
      ctx.restore();
    }
  },
};

type Props = {
  series: ValuationSeriesPoint[];
  currency: string;
};

export default function PortfolioChart({ series, currency }: Props) {
  const currSymbol = currency === "USD" ? "$" : "₹";

  const labels = series.map((p) => p.date);
  const dataPoints = series.map((p) => p.market_value);

  const hasData = dataPoints.length > 0;
  const maxVal = hasData ? Math.max(...dataPoints) : 60;
  const minVal = hasData ? Math.min(...dataPoints) : 0;
  const padding = (maxVal - minVal) * 0.15 || maxVal * 0.1;
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;

  const data = {
    labels,
    datasets: [
      {
        data: dataPoints,
        borderColor: "#d4c85c",
        borderWidth: 2,
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return "transparent";
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, "rgba(180, 170, 60, 0.5)");
          gradient.addColorStop(0.6, "rgba(180, 170, 60, 0.15)");
          gradient.addColorStop(1, "rgba(180, 170, 60, 0)");
          return gradient;
        },
        fill: true,
        tension: 0.35,
        pointRadius: dataPoints.map((_, i) => (i === dataPoints.length - 1 ? 5 : 0)),
        pointBackgroundColor: "#d4c85c",
        pointBorderColor: "rgba(212, 200, 92, 0.4)",
        pointBorderWidth: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#d4c85c",
        pointHoverBorderColor: "#d4c85c",
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const formatLabel = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (num >= 100000) return `${currSymbol}${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `${currSymbol}${(num / 1000).toFixed(1)}K`;
    return `${currSymbol}${num.toFixed(0)}`;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      tooltip: {
        enabled: true,
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        titleColor: "rgba(255, 255, 255, 0.6)",
        bodyColor: "#fff",
        borderColor: "rgba(212, 200, 92, 0.3)",
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        titleFont: {
          size: 11,
          weight: "500",
          family: "Satoshi, var(--font-inter), sans-serif",
        },
        bodyFont: {
          size: 14,
          weight: "600",
          family: "Satoshi, var(--font-inter), sans-serif",
        },
        callbacks: {
          title: (tooltipItems) => {
            const date = tooltipItems[0]?.label;
            if (!date) return "";
            const parsedDate = new Date(date + "T00:00:00");
            return parsedDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
          },
          label: (context) => {
            const value = context.parsed.y;
            return formatLabel(value);
          },
        },
      },
      legend: { display: false },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        position: "right",
        min: yMin,
        max: yMax,
        ticks: {
          count: 5,
          color: "white",
          font: { size: 8, weight: "500", family: "Satoshi, var(--font-inter), sans-serif", lineHeight: 1.5 },
          callback: formatLabel,
          padding: 12,
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
      },
    },
    layout: {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  };

  return (
    <div className="portfolio-chart">
      <Line data={data} options={options} plugins={[dottedGridPlugin, verticalLinePlugin]} />
    </div>
  );
}
