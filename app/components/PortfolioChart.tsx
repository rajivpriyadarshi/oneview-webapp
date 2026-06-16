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
  currencySymbol?: string;
  loading: boolean;
};

export default function PortfolioChart({ series, currency, currencySymbol, loading }: Props) {
  void loading;
  const currSymbol = currencySymbol ?? (currency === "USD" ? "$" : "₹");

  const labels = series.map((p) => p.date);
  const dataPoints = series.map((p) => p.market_value);

  const hasData = dataPoints.length > 1;
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
        borderColor: (ctx: { chart: ChartJS }) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return "#2F1E07";
          const gradient = canvasCtx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
          gradient.addColorStop(0, "#2F1E07");
          gradient.addColorStop(1, "#58442A");
          return gradient;
        },
        borderWidth: 2,
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return "transparent";
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, "rgba(47, 30, 7, 0.15)");
          gradient.addColorStop(0.7, "rgba(88, 68, 42, 0.05)");
          gradient.addColorStop(1, "rgba(88, 68, 42, 0)");
          return gradient;
        },
        fill: true,
        tension: 0.35,
        pointRadius: dataPoints.map((_, i) => (i === dataPoints.length - 1 ? 5 : 0)),
        pointBackgroundColor: "#2F1E07",
        pointBorderColor: "rgba(47, 30, 7, 0.3)",
        pointBorderWidth: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#2F1E07",
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const formatLabel = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    const abs = Math.abs(num);
    const sign = num < 0 ? "-" : "";
    const f2 = (n: number) => Math.floor(n * 100) / 100;
    if (currency.toUpperCase() !== "INR") {
      if (abs >= 1_000_000_000) return `${sign}${currSymbol}${f2(abs / 1_000_000_000).toFixed(2)}B`;
      if (abs >= 1_000_000) return `${sign}${currSymbol}${f2(abs / 1_000_000).toFixed(2)}M`;
      if (abs >= 1_000) return `${sign}${currSymbol}${f2(abs / 1_000).toFixed(1)}K`;
      return `${sign}${currSymbol}${abs.toFixed(0)}`;
    }
    if (abs >= 10_000_000) return `${sign}${currSymbol}${f2(abs / 10_000_000).toFixed(2)}Cr`;
    if (abs >= 100_000) return `${sign}${currSymbol}${f2(abs / 100_000).toFixed(1)}L`;
    if (abs >= 1_000) return `${sign}${currSymbol}${f2(abs / 1_000).toFixed(1)}K`;
    return `${sign}${currSymbol}${abs.toFixed(0)}`;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: "easeInOutQuart",
    },
    transitions: {
      active: {
        animation: {
          duration: 400,
        },
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      tooltip: {
        enabled: true,
        mode: "index",
        intersect: false,
        backgroundColor: (context: { tooltip: { dataPoints?: { parsed: { y: number } }[] } }) => {
          const startValue = dataPoints[0] ?? 0;
          const currentValue = context.tooltip?.dataPoints?.[0]?.parsed?.y ?? startValue;
          return currentValue >= startValue ? "rgba(18, 128, 68, 0.9)" : "rgba(220, 38, 38, 0.9)";
        },
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
          afterBody: (tooltipItems: { parsed: { y: number } }[]) => {
            const startValue = dataPoints[0] ?? 0;
            const currentValue = tooltipItems[0]?.parsed?.y ?? startValue;
            const diff = currentValue - startValue;
            const pct = startValue !== 0 ? ((diff / startValue) * 100).toFixed(2) : "0.00";
            const sign = diff >= 0 ? "+" : "";
            return `${sign}${formatLabel(diff)} (${sign}${pct}%)`;
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

  if (!hasData) {
    return (
      <div className="relative min-h-[240px] w-full min-w-0 max-[900px]:h-[160px] flex items-center justify-center">
        <a href="/onboarding/documents" className="block w-full">
          <img src="/empty-state.png" alt="No chart data — add statements" className="max-h-[240px] w-full object-contain opacity-70 cursor-pointer hover:opacity-90 transition-opacity" />
        </a>
      </div>
    );
  }

  return (
    <div className="relative min-h-[240px] w-full min-w-0 max-[900px]:h-[160px]">
      <Line data={data} options={options} />
    </div>
  );
}
