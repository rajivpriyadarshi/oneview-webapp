"use client";

import { useMemo, useState } from "react";
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

// Color palette for charts - designed for visual distinction and accessibility
const CHART_COLORS = [
  "#4d558a",
  "#e39f4b",
  "#6438E8",
  "#CE8016",  
  "#59886B",
  "#444444",    
  "#FFC75F",    
  "#9EDE73", 
  "#184D47",   
  "#D2DB20", 
  "#939191",  
  "#76FDB0", 
  "#2F2B2C", 
  "#FFB2FC", 
  "#B0EDFF",
  "#A3A1FB",
  "#7A2783",
  "#F46396"
];

const ASSET_COLORS = CHART_COLORS;
const BROKER_COLORS = CHART_COLORS;
const SECTOR_COLORS = CHART_COLORS;

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
    return [...portfolioView.accounts]
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

  const hasSectorData = sectorData.length > 0;

  return (
    <section className="portfolio-exposure">
      <h3 className="exposure-title">
        <ExposureIcon />
        Portfolio Exposure
      </h3>
      <div className={`exposure-charts ${!hasSectorData ? 'two-charts' : ''}`}>
        <div className="exposure-chart">
          <p className="exposure-chart-label">
            By <strong>Asset type</strong>
          </p>
          <div className="exposure-chart-content">
            <LabeledDonut segments={assetTypeData} currency={currency} />
          </div>
        </div>

        <div className="exposure-chart">
          <p className="exposure-chart-label">
            By <strong>Broker</strong>
          </p>
          <div className="exposure-chart-content">
            <LabeledDonut segments={brokerData} currency={currency} />
          </div>
        </div>

        {hasSectorData && (
          <div className="exposure-chart exposure-chart-sector">
            <p className="exposure-chart-label">
              By <strong>Sector allocation</strong>
            </p>
            <div className="exposure-chart-content">
              <SectorBarChart segments={sectorData} currency={currency} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function LabeledDonut({ segments, currency }: { segments: ChartSegment[]; currency: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const circumference = 2 * Math.PI * 80;
  const currSymbol = currency === "USD" ? "$" : "₹";
  const cx = 150;
  const cy = 150;
  const donutR = 80;
  const strokeW = 32;
  const labelRadius = donutR + strokeW / 2 + 30;

  let cumulativeAngle = 0;
  const segmentsWithAngles = segments.map((seg) => {
    const dashLength = (seg.percentage / 100) * circumference;
    const startAngle = cumulativeAngle;
    const angleSpan = (seg.percentage / 100) * 360;
    const midAngle = startAngle + angleSpan / 2;
    cumulativeAngle += angleSpan;
    return { ...seg, dashLength, midAngle };
  });

  let drawOffset = 0;

  const getHoverLabelPosition = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    const x = cx + labelRadius * Math.cos(radians);
    const y = cy + labelRadius * Math.sin(radians);
    const anchor = angle > 90 && angle < 270 ? "end" : "start";
    return { x, y, anchor };
  };

  return (
    <div className="donut-container">
      <div className="donut-chart-wrapper">
        <svg viewBox="0 0 300 300" className="donut-chart">
          <g>
            {segmentsWithAngles.map((seg, i) => {
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
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="donut-segment"
                  style={{
                    opacity: hoveredIndex === null || hoveredIndex === i ? 1 : 0.4,
                    cursor: 'pointer',
                  }}
                />
              );
              drawOffset += seg.dashLength;
              return el;
            })}
          </g>
          {hoveredIndex !== null && (() => {
            const pos = getHoverLabelPosition(segmentsWithAngles[hoveredIndex].midAngle);
            const label = segments[hoveredIndex].label;
            const value = `${currSymbol}${formatValue(segments[hoveredIndex].value)}`;
            const pct = `${segments[hoveredIndex].percentage.toFixed(1)}%`;

            // Estimate box width based on longest text (rough approximation: 7px per char for label, 6px for others)
            const labelWidth = label.length * 7;
            const valueWidth = value.length * 6;
            const pctWidth = pct.length * 6;
            const boxWidth = Math.max(labelWidth, valueWidth, pctWidth, 100) + 24; // +24 for padding
            const boxHeight = 56;
            const boxX = pos.anchor === "end" ? pos.x - boxWidth : pos.x;
            const textX = boxX + boxWidth / 2;

            return (
              <g className="donut-hover-label" style={{ zIndex: 1000 }}>
                <rect
                  x={boxX}
                  y={pos.y - 28}
                  width={boxWidth}
                  height={boxHeight}
                  rx="8"
                  fill="white"
                  filter="drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15))"
                />
                <text
                  x={textX}
                  y={pos.y - 10}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="#1a1a1a"
                >
                  {label}
                </text>
                <text
                  x={textX}
                  y={pos.y + 8}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#6f6f6f"
                >
                  {value}
                </text>
                <text
                  x={textX}
                  y={pos.y + 22}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fill={segments[hoveredIndex].color}
                >
                  {pct}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
      <div className="donut-legends">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className="legend-item"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              opacity: hoveredIndex === null || hoveredIndex === i ? 1 : 0.4,
              cursor: 'pointer',
            }}
          >
            <div className="legend-color" style={{ backgroundColor: seg.color }} />
            <div className="legend-text">
              <span className="legend-label">{seg.label}</span>
              <span className="legend-value">
                {currSymbol}{formatValue(seg.value)} ({seg.percentage.toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorBarChart({ segments, currency }: { segments: ChartSegment[]; currency: string }) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const currSymbol = currency === "USD" ? "$" : "₹";

  const top5 = segments.slice(0, 5);
  const others = segments.slice(5);
  const othersTotal = others.reduce((sum, seg) => sum + seg.percentage, 0);

  return (
    <div className="sector-bar-container">
      <div className="sector-items">
        {top5.map((seg) => (
          <div
            key={seg.label}
            className="sector-item"
            onMouseEnter={() => setHoveredBar(seg.label)}
            onMouseLeave={() => setHoveredBar(null)}
            style={{
              opacity: hoveredBar && hoveredBar !== seg.label ? 0.3 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div className="sector-item-header">
              <span className="sector-item-label">{seg.label}</span>
              <span className="sector-item-value">{seg.percentage.toFixed(2)}%</span>
            </div>
            <div className="sector-bar-wrapper">
              <div
                className="sector-bar"
                style={{
                  width: `${seg.percentage}%`,
                  backgroundColor: seg.color,
                }}
              />
            </div>
          </div>
        ))}
        {others.length > 0 && (
          <div
            className="sector-item sector-item-others"
            onMouseEnter={() => setHoveredBar('others')}
            onMouseLeave={() => setHoveredBar(null)}
            style={{
              opacity: hoveredBar && hoveredBar !== 'others' ? 0.3 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div className="sector-item-header">
              <span className="sector-item-label">+{others.length} more</span>
              <span className="sector-item-value">{othersTotal.toFixed(2)}%</span>
            </div>
            <div className="sector-bar-wrapper sector-bar-combined">
              {others.map((seg, i) => {
                const prevWidths = others.slice(0, i).reduce((sum, s) => sum + s.percentage, 0);
                return (
                  <div
                    key={seg.label}
                    className="sector-bar-segment"
                    style={{
                      width: `${(seg.percentage / othersTotal) * 100}%`,
                      backgroundColor: seg.color,
                    }}
                  />
                );
              })}
            </div>
            {hoveredBar === 'others' && (
              <div className="sector-tooltip">
                <div className="sector-tooltip-content">
                  {others.map((seg) => (
                    <div key={seg.label} className="sector-tooltip-item">
                      <div className="sector-tooltip-color" style={{ backgroundColor: seg.color }} />
                      <span className="sector-tooltip-label">{seg.label}</span>
                      <span className="sector-tooltip-value">{seg.percentage.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
