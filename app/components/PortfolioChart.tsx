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
        borderColor: "#1a1a1a",
        borderWidth: 2,
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return "transparent";
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, "rgba(0, 0, 0, 0.15)");
          gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.05)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          return gradient;
        },
        fill: true,
        tension: 0.35,
        pointRadius: dataPoints.map((_, i) => (i === dataPoints.length - 1 ? 5 : 0)),
        pointBackgroundColor: "#1a1a1a",
        pointBorderColor: "rgba(26, 26, 26, 0.3)",
        pointBorderWidth: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#1a1a1a",
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const formatLabel = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    const abs = Math.abs(num);
    const sign = num < 0 ? "-" : "";
    if (abs >= 10000000) return `${sign}${currSymbol}${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}${currSymbol}${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `${sign}${currSymbol}${(abs / 1000).toFixed(1)}K`;
    return `${sign}${currSymbol}${abs.toFixed(0)}`;
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
        borderColor: "rgba(0, 0, 0, 0.1)",
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
          color: "rgba(0, 0, 0, 0.4)",
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
          color: "rgba(0, 0, 0, 0.4)",
          font: { size: 9, weight: "500", family: "Satoshi, var(--font-inter), sans-serif", lineHeight: 1.5 },
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
    <div className="relative min-h-[240px] w-full min-w-0 max-[900px]:h-[160px]">
      <Line data={data} options={options} />
    </div>
  );
}
