"use client";

import { useMemo } from "react";
import { type HoldingPosition } from "../lib/portfolioDataApi";

type Props = {
  holdings: HoldingPosition[];
};

type ChartSegment = {
  label: string;
  value: number;
  percentage: number;
  color: string;
};

const COLORS = ["#c8b850", "#6b5ce7", "#f472b6", "#34d399"];

export default function PortfolioExposure({ holdings }: Props) {
  const assetTypeData = useMemo(() => groupBy(holdings, "type"), [holdings]);

  return (
    <section className="portfolio-exposure">
      <h3 className="exposure-title">
        <ExposureIcon />
        Portfolio Exposure
      </h3>
      <div className="exposure-charts">
        <div className="exposure-chart">
          <p className="exposure-chart-label">
            By <strong>Asset type</strong>
          </p>
          <DonutChart segments={assetTypeData} />
          <div className="donut-legend">
            {assetTypeData.map((seg) => (
              <div className="legend-item" key={seg.label}>
                <span className="legend-dot" style={{ background: seg.color }} />
                <span>{seg.label}</span>
                <span className="legend-value">
                  ₹{formatValue(seg.value)} ({seg.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="exposure-chart">
          <p className="exposure-chart-label">
            By <strong>Broker</strong>
          </p>
          <div className="donut-container">
            <svg viewBox="0 0 120 120" className="donut">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#c8b850" strokeWidth="24" strokeDasharray="140 283" strokeDashoffset="0" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#6b5ce7" strokeWidth="24" strokeDasharray="90 283" strokeDashoffset="-140" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#f472b6" strokeWidth="24" strokeDasharray="53 283" strokeDashoffset="-230" />
            </svg>
          </div>
        </div>

        <div className="exposure-chart">
          <p className="exposure-chart-label">
            By <strong>Sector allocation</strong>
          </p>
          <div className="donut-container">
            <svg viewBox="0 0 120 120" className="donut">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#c8b850" strokeWidth="24" strokeDasharray="100 283" strokeDashoffset="0" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#6b5ce7" strokeWidth="24" strokeDasharray="120 283" strokeDashoffset="-100" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="#f472b6" strokeWidth="24" strokeDasharray="63 283" strokeDashoffset="-220" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function DonutChart({ segments }: { segments: ChartSegment[] }) {
  const circumference = 2 * Math.PI * 45;
  let offset = 0;

  return (
    <div className="donut-container">
      <svg viewBox="0 0 120 120" className="donut">
        {segments.map((seg) => {
          const dashLength = (seg.percentage / 100) * circumference;
          const el = (
            <circle
              key={seg.label}
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={seg.color}
              strokeWidth="24"
              strokeDasharray={`${dashLength} ${circumference}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dashLength;
          return el;
        })}
      </svg>
    </div>
  );
}

function groupBy(holdings: HoldingPosition[], key: "type"): ChartSegment[] {
  const groups: Record<string, number> = {};
  let total = 0;

  for (const h of holdings) {
    const label = h[key] || "Other";
    const value = parseFloat(h.market_value) || 0;
    groups[label] = (groups[label] || 0) + value;
    total += value;
  }

  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label: capitalize(label),
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }));
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}

function formatValue(num: number) {
  if (Math.abs(num) >= 100000) return `${(num / 100000).toFixed(2)}L`;
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toFixed(2);
}

function ExposureIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
      <path
        d="M4.99527 6.77795L1.42773 8.56172L8.30754 12.0016C8.40114 12.0484 8.44794 12.0718 8.49703 12.081C8.5405 12.0892 8.58512 12.0892 8.6286 12.081C8.67768 12.0718 8.72448 12.0484 8.81808 12.0016L15.6979 8.56172L12.1303 6.77795M4.99527 10.3455L1.42773 12.1293L8.30754 15.5692C8.40114 15.616 8.44794 15.6394 8.49703 15.6486C8.5405 15.6567 8.58512 15.6567 8.6286 15.6486C8.67768 15.6394 8.72448 15.616 8.81808 15.5692L15.6979 12.1293L12.1303 10.3455M1.42773 4.99418L8.30754 1.55428C8.40114 1.50748 8.44794 1.48408 8.49703 1.47487C8.5405 1.46671 8.58512 1.46671 8.6286 1.47487C8.67768 1.48408 8.72448 1.50748 8.81808 1.55428L15.6979 4.99418L8.81808 8.43408C8.72448 8.48088 8.67768 8.50428 8.6286 8.51349C8.58512 8.52165 8.5405 8.52165 8.49703 8.51349C8.44794 8.50428 8.40114 8.48088 8.30754 8.43408L1.42773 4.99418Z"
        stroke="currentColor"
        strokeWidth="1.42702"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
