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

type Props = {
  series: ValuationSeriesPoint[];
  currency: string;
  loading: boolean;
};

export default function PortfolioChart({ series, currency, loading }: Props) {
  void loading;
  const currSymbol = currency === "USD" ? "$" : "₹";

  const labels = series.map((p) => p.date);
  const dataPoints = series.map((p) => p.market_value);

  const hasData = dataPoints.length > 0;
  const maxVal = hasData ? Math.max(...dataPoints) : 60;
  const minVal = hasData ? Math.min(...dataPoints) : 0;
  const padding = (maxVal - minVal) * 0.15 || maxVal * 0.1;
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTooltipDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

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
        pointHoverBorderColor: "#fff",
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
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgba(255, 255, 255, 0.2)",
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        titleFont: {
          size: 11,
          weight: "400",
          family: "Satoshi, var(--font-inter), sans-serif",
        },
        bodyFont: {
          size: 14,
          weight: "700",
          family: "Satoshi, var(--font-inter), sans-serif",
        },
        callbacks: {
          title: (tooltipItems: { label: string }[]) => {
            return formatTooltipDate(tooltipItems[0].label);
          },
          label: (context: { parsed: { y: number } }) => {
            return formatLabel(context.parsed.y);
          },
        },
      },
      legend: { display: false },
    },
    scales: {
      x: {
        display: true,
        ticks: {
          color: "rgba(255, 255, 255, 0.5)",
          font: { size: 10, weight: "500", family: "Satoshi, var(--font-inter), sans-serif" },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          callback: function(value: number, index: number) {
            return formatDate(labels[index]);
          },
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
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
    <div className="relative min-h-[240px] w-full min-w-0 md:w-1/2 md:min-w-[300px] max-[900px]:h-[120px]">
      <Line data={data} options={options} plugins={[dottedGridPlugin]} />
    </div>
  );
}
