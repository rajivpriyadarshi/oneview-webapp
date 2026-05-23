"use client";

import { useMemo } from "react";
import { type PortfolioViewResponse } from "../lib/portfolioDataApi";

type Props = {
  portfolioView: PortfolioViewResponse | null;
};

type ChartSegment = {
  label: string;
  value: number;
  percentage: number;
  color: string;
};

const COLORS = ["#f5e680", "#7c5ce7", "#f472b6", "#34d399", "#f97316"];

export default function PortfolioExposure({ portfolioView }: Props) {
  const assetTypeData = useMemo(() => {
    if (!portfolioView?.asset_allocation) return [];
    const entries = Object.entries(portfolioView.asset_allocation);
    const total = entries.reduce((sum, [, v]) => sum + v.market_value, 0);
    return entries
      .sort((a, b) => b[1].market_value - a[1].market_value)
      .map(([label, data], i) => ({
        label: capitalize(label),
        value: data.market_value,
        percentage: data.weight_pct ?? (total > 0 ? (data.market_value / total) * 100 : 0),
        color: COLORS[i % COLORS.length],
      }));
  }, [portfolioView]);

  const brokerData = useMemo(() => {
    if (!portfolioView?.accounts) return [];
    const total = portfolioView.accounts.reduce((sum, a) => sum + a.market_value, 0);
    return portfolioView.accounts
      .sort((a, b) => b.market_value - a.market_value)
      .map((acc, i) => ({
        label: capitalize(acc.institution_name || acc.account_name),
        value: acc.market_value,
        percentage: total > 0 ? (acc.market_value / total) * 100 : 0,
        color: COLORS[i % COLORS.length],
      }));
  }, [portfolioView]);

  const currency = portfolioView?.currency || "INR";

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
          <LabeledDonut segments={assetTypeData} currency={currency} />
        </div>

        <div className="exposure-chart">
          <p className="exposure-chart-label">
            By <strong>Broker</strong>
          </p>
          <LabeledDonut segments={brokerData} currency={currency} />
        </div>
      </div>
    </section>
  );
}

function LabeledDonut({ segments, currency }: { segments: ChartSegment[]; currency: string }) {
  const circumference = 2 * Math.PI * 80;
  const currSymbol = currency === "USD" ? "$" : "₹";

  let offset = 0;
  const segmentsWithAngles = segments.map((seg) => {
    const dashLength = (seg.percentage / 100) * circumference;
    const startAngle = (offset / circumference) * 360 - 90;
    const midAngle = startAngle + ((seg.percentage / 100) * 360) / 2;
    offset += dashLength;
    return { ...seg, midAngle, dashLength };
  });

  let drawOffset = 0;

  return (
    <div className="donut-labeled-container">
      <svg viewBox="0 0 360 360" className="donut-labeled">
        {segmentsWithAngles.map((seg) => {
          const el = (
            <circle
              key={seg.label}
              cx="180"
              cy="180"
              r="80"
              fill="none"
              stroke={seg.color}
              strokeWidth="32"
              strokeDasharray={`${seg.dashLength} ${circumference}`}
              strokeDashoffset={-drawOffset}
              transform="rotate(-90 180 180)"
            />
          );
          drawOffset += seg.dashLength;
          return el;
        })}
        {(() => {
          const labels: { x: number; y: number; seg: typeof segmentsWithAngles[0] }[] = [];
          const minGap = 45;

          for (const seg of segmentsWithAngles) {
            const labelRadius = 155;
            const rad = (seg.midAngle * Math.PI) / 180;
            let x = 180 + labelRadius * Math.cos(rad);
            let y = 180 + labelRadius * Math.sin(rad);

            for (const placed of labels) {
              const dx = x - placed.x;
              const dy = y - placed.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minGap) {
                const angle = Math.atan2(dy, dx);
                y = placed.y + minGap * Math.sin(angle);
                x = placed.x + minGap * Math.cos(angle);
              }
            }

            labels.push({ x, y, seg });
          }

          return labels.map(({ x, y, seg }) => {
            const innerRadius = 112;
            const rad = (seg.midAngle * Math.PI) / 180;
            const x1 = 180 + innerRadius * Math.cos(rad);
            const y1 = 180 + innerRadius * Math.sin(rad);
            const lineEndRadius = 130;
            const x2 = 180 + lineEndRadius * Math.cos(rad);
            const y2 = 180 + lineEndRadius * Math.sin(rad);

            return (
              <g key={seg.label}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#080808" strokeWidth="1" />
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight="700"
                  fill="#080808"
                >
                  {seg.label}
                </text>
                <circle cx={x} cy={y + 4} r="4" fill={seg.color} />
                <text
                  x={x}
                  y={y + 22}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#6f6f6f"
                >
                  {currSymbol}{formatValue(seg.value)} ({seg.percentage.toFixed(1)}%)
                </text>
              </g>
            );
          });
        })()}
      </svg>
    </div>
  );
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase().replace(/_/g, " ");
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
