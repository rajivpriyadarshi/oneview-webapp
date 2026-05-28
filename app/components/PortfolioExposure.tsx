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
const SECTOR_COLORS = [
  "#F5A623",
  "#2BC5BD",
  "#5B7FE8",
  "#E84393",
  "#9B4DCA",
  "#E85454",
  "#27B16C",
  "#F5D842",
  "#E87B28",
  "#4DB6AC",
  "#7986CB",
  "#EF5350",
  "#26A69A",
  "#AB47BC",
  "#FFA726",
  "#66BB6A",
  "#42A5F5",
  "#EC407A",
];

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
              <SectorDonutChart segments={sectorData} />
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

function SectorDonutChart({ segments }: { segments: ChartSegment[] }) {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const cx = 180;
  const cy = 180;
  const r = 130;
  const strokeW = 18;
  const strokeWActive = 30;
  // Active radius shifts outward so inner edge stays fixed: r_active = r + (strokeWActive - strokeW) / 2
  const rActive = r + (strokeWActive - strokeW) / 2;
  const gapDeg = 1.0;
  const gapRad = (gapDeg * Math.PI) / 180;

  const total = segments.reduce((s, seg) => s + seg.percentage, 0);
  let cumAngle = -Math.PI / 2;

  const buildPath = (radius: number, startAngle: number, endAngle: number) => {
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const arcs = segments.map((seg) => {
    const frac = seg.percentage / total;
    const fullSpan = frac * 2 * Math.PI;
    const span = Math.max(fullSpan - gapRad, 0.01);
    const startAngle = cumAngle + gapRad / 2;
    const endAngle = startAngle + span;
    cumAngle += fullSpan;

    const midAngle = startAngle + span / 2;
    const path = buildPath(r, startAngle, endAngle);
    const activePath = buildPath(rActive, startAngle, endAngle);

    return { ...seg, path, activePath, midAngle };
  });

  const active = segments[activeIndex];

  return (
    <div className="sector-donut-wrapper">
      <svg
        viewBox="0 0 360 360"
        className="sector-donut-svg"
        style={{ overflow: 'visible' }}
        onMouseLeave={() => setActiveIndex(0)}
      >
        {arcs.map((arc, i) => {
          const isActive = i === activeIndex;
          return (
            <path
              key={arc.label}
              d={isActive ? arc.activePath : arc.path}
              fill="none"
              stroke={arc.color}
              strokeWidth={isActive ? strokeWActive : strokeW}
              strokeLinecap="butt"
              className="sector-donut-arc"
              style={{
                opacity: isActive ? 1 : 0.85,
              }}
              onMouseEnter={() => setActiveIndex(i)}
            />
          );
        })}

        {/* center percentage */}
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="36"
          fontWeight="800"
          fontFamily="Geist, Inter, sans-serif"
          fill="#0f0f0f"
          letterSpacing="-1"
        >
          {active.percentage.toFixed(1)}%
        </text>
        {/* center label */}
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="13"
          fontWeight="500"
          fontFamily="Geist, Inter, sans-serif"
          fill="#888"
          letterSpacing="0"
        >
          {active.label}
        </text>
      </svg>

      {/* legend chips */}
      <div className="sector-donut-legend">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className={`sector-donut-chip ${i === activeIndex ? 'active' : ''}`}
            style={{ '--chip-color': seg.color } as React.CSSProperties}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(0)}
          >
            <span className="sector-donut-chip-dot" style={{ background: seg.color }} />
            <span className="sector-donut-chip-label">{seg.label}</span>
            <span className="sector-donut-chip-pct">{seg.percentage.toFixed(1)}%</span>
          </div>
        ))}
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
