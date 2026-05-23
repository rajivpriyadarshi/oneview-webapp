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

const labels = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
const dataPoints = [10, 10, 10, 10, 10, 10, 10, 11, 13, 18, 30, 42, 48, 50, 50, 50, 50, 50, 50, 50];

export default function PortfolioChart() {
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
        pointRadius: Array(19).fill(0).concat([5]),
        pointBackgroundColor: "#d4c85c",
        pointBorderColor: "rgba(212, 200, 92, 0.4)",
        pointBorderWidth: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        position: "right",
        min: 10,
        max: 60,
        ticks: {
          stepSize: 10,
          color: "white",
          font: { size: 8, weight: "500", family: "Satoshi, var(--font-inter), sans-serif", lineHeight: 1.5 },
          callback: (value: number | string) => `₹${value}.0L`,
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
      <Line data={data} options={options} plugins={[dottedGridPlugin]} />
    </div>
  );
}
