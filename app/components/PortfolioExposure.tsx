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

const ASSET_COLORS = ["#f5e680", "#7c5ce7", "#f472b6", "#34d399", "#f97316"];
const BROKER_COLORS = ["#7c5ce7", "#f472b6", "#f5e680", "#34d399", "#f97316"];
const SECTOR_COLORS = ["#34d399", "#f97316", "#7c5ce7", "#f472b6", "#60a5fa"];

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
        color: ASSET_COLORS[i % ASSET_COLORS.length],
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
        color: BROKER_COLORS[i % BROKER_COLORS.length],
      }));
  }, [portfolioView]);

  const sectorData = useMemo(() => {
    if (!portfolioView?.sector_allocation) return [];
    const entries = Object.entries(portfolioView.sector_allocation);
    const total = entries.reduce((sum, [, v]) => sum + v.market_value, 0);
    return entries
      .sort((a, b) => b[1].market_value - a[1].market_value)
      .map(([label, data], i) => ({
        label: capitalize(label),
        value: data.market_value,
        percentage: data.weight_pct ?? (total > 0 ? (data.market_value / total) * 100 : 0),
        color: SECTOR_COLORS[i % SECTOR_COLORS.length],
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

        {sectorData.length > 0 && (
          <div className="exposure-chart">
            <p className="exposure-chart-label">
              By <strong>Sector allocation</strong>
            </p>
            <LabeledDonut segments={sectorData} currency={currency} />
          </div>
        )}
      </div>
    </section>
  );
}

function LabeledDonut({ segments, currency }: { segments: ChartSegment[]; currency: string }) {
  const circumference = 2 * Math.PI * 80;
  const currSymbol = currency === "USD" ? "$" : "₹";
  const cx = 200;
  const cy = 180;
  const donutR = 80;
  const strokeW = 32;
  const outerEdge = donutR + strokeW / 2;

  let offset = 0;
  const segmentsWithAngles = segments.map((seg) => {
    const dashLength = (seg.percentage / 100) * circumference;
    const startAngle = (offset / circumference) * 360 - 90;
    const midAngle = startAngle + ((seg.percentage / 100) * 360) / 2;
    offset += dashLength;
    return { ...seg, midAngle, dashLength };
  });

  let drawOffset = 0;

  const labelPositions = (() => {
    const positions: { finalY: number; seg: typeof segmentsWithAngles[0]; isRight: boolean }[] = [];
    const minGap = 44;

    for (const seg of segmentsWithAngles) {
      const rad = (seg.midAngle * Math.PI) / 180;
      const isRight = Math.cos(rad) >= 0;
      let finalY = cy + 120 * Math.sin(rad);

      for (const placed of positions) {
        if ((isRight && placed.isRight) || (!isRight && !placed.isRight)) {
          const dy = Math.abs(finalY - placed.finalY);
          if (dy < minGap) {
            finalY = placed.finalY + (finalY > placed.finalY ? minGap : -minGap);
          }
        }
      }

      positions.push({ finalY, seg, isRight });
    }
    return positions;
  })();

  return (
    <div className="donut-labeled-container">
      <svg viewBox="0 0 400 360" className="donut-labeled">
        {segmentsWithAngles.map((seg) => {
          const el = (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={donutR}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeW}
              strokeDasharray={`${seg.dashLength} ${circumference}`}
              strokeDashoffset={-drawOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          drawOffset += seg.dashLength;
          return el;
        })}
        {labelPositions.map(({ finalY, seg, isRight }) => {
          const rad = (seg.midAngle * Math.PI) / 180;
          const edgeX = cx + outerEdge * Math.cos(rad);
          const edgeY = cy + outerEdge * Math.sin(rad);
          const horizEnd = isRight ? 310 : 90;
          const dotX = horizEnd;
          const labelX = isRight ? dotX + 14 : dotX - 14;
          const anchor = isRight ? "start" : "end";

          return (
            <g key={seg.label}>
              <polyline
                points={`${edgeX},${edgeY} ${isRight ? edgeX + 15 : edgeX - 15},${finalY} ${horizEnd},${finalY}`}
                fill="none"
                stroke="#1a1a1a"
                strokeWidth="1"
              />
              <circle cx={dotX} cy={finalY} r="4.5" fill={seg.color} />
              <text
                x={labelX}
                y={finalY + 4}
                textAnchor={anchor}
                fontSize="13"
                fontWeight="700"
                fill="#1a1a1a"
              >
                {seg.label}
              </text>
              <text
                x={labelX}
                y={finalY + 20}
                textAnchor={anchor}
                fontSize="11"
                fill="#6f6f6f"
              >
                {currSymbol}{formatValue(seg.value)} ({seg.percentage.toFixed(1)}%)
              </text>
            </g>
          );
        })}
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
