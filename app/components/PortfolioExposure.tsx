"use client";

import { useMemo, useState } from "react";
import { type PortfolioViewResponse } from "../lib/portfolioDataApi";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";

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
const BROKER_COLORS = CHART_COLORS.map((color) => shadeHex(color, -18));
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
  const { trackClick } = useAnalytics();
  const assetPalette = useMemo(() => getShiftedPalette(ASSET_COLORS, "asset"), []);
  const brokerPalette = useMemo(() => getShiftedPalette(BROKER_COLORS, "broker"), []);
  const sectorPalette = useMemo(() => getShiftedPalette(SECTOR_COLORS, "sector"), []);

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
        color: assetPalette[i % assetPalette.length],
      }));
  }, [assetPalette, portfolioView]);

  const brokerData = useMemo(() => {
    if (!portfolioView?.accounts) return [];
    const total = portfolioView.accounts.reduce((sum, a) => sum + a.market_value, 0);
    return [...portfolioView.accounts]
      .sort((a, b) => b.market_value - a.market_value)
      .map((acc, i) => ({
        label: capitalize(acc.institution_name || acc.account_name),
        value: acc.market_value,
        percentage: total > 0 ? (acc.market_value / total) * 100 : 0,
        color: brokerPalette[i % brokerPalette.length],
      }));
  }, [brokerPalette, portfolioView]);

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
        color: sectorPalette[i % sectorPalette.length],
      }));
  }, [portfolioView, sectorPalette]);

  const hasSectorData = sectorData.length > 0;

  return (
    <section data-analytics-section="portfolio_exposure" className="mb-[16px] rounded-[32px] bg-white px-[16px] pl-[24px]">
      <h3 className="flex align-center items-center gap-2 border-b border-black/10 pl-[6px] py-[24px] font-satoshi text-[20px] font-bold leading-[130%] tracking-[-0.02em] text-black">
        <ExposureIcon />
        Portfolio Exposure
      </h3>
      <div className={`grid gap-0 ${!hasSectorData ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
        <div className="relative flex h-full min-w-0 flex-col items-center overflow-visible bg-white px-[30px] py-3.5 md:border-r md:border-black/15">
          <p className="mb-4 mt-0 text-center font-satoshi text-sm font-normal leading-[150%] tracking-[-0.02em] text-black">
            By <strong>Asset type</strong>
          </p>
          <div className="w-full">
            <SectorDonutChart segments={assetTypeData} />
          </div>
        </div>

        <div className={`relative flex h-full min-w-0 flex-col items-center overflow-visible bg-white px-[30px] py-3.5 ${hasSectorData ? "md:border-r md:border-black/15" : ""}`}>
          <p className="mb-4 mt-0 text-center font-satoshi text-sm font-normal leading-[150%] tracking-[-0.02em] text-black">
            By <strong>Broker</strong>
          </p>
          <div className="w-full">
            <SectorDonutChart segments={brokerData} />
          </div>
        </div>

        {hasSectorData && (
          <div className="relative flex h-full min-w-0 flex-col items-center overflow-visible bg-white px-[30px] py-3.5">
            <p className="mb-4 mt-0 text-center font-satoshi text-sm font-normal leading-[150%] tracking-[-0.02em] text-black">
              By <strong>Sector allocation</strong>
            </p>
            <div className="w-full">
              <SectorDonutChart
                segments={sectorData}
                onPillClick={(label, percentage) => {
                  trackClick({
                    buttonName: trackingEventsMap.dashboardPage.CLICK_SECTOR_ALLOCATION_PILL,
                    pageName: trackingEventsMap.dashboardPage.PAGE,
                    params: {
                      section_name: "portfolio_exposure",
                      chart_type: "sector_allocation",
                      pill_label: label,
                      pill_percentage: percentage,
                    },
                  });
                }}
              />
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
    <div className="flex flex-col items-center gap-6">
      <div className="mx-auto h-[320px] w-[320px] shrink-0">
        <svg viewBox="0 0 300 300" className="h-full w-full">
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
                  className="transition-opacity duration-150"
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
              <g className="pointer-events-none" style={{ zIndex: 1000 }}>
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
      <div className="w-full max-w-[420px] space-y-3">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className="flex items-center justify-center gap-2.5 rounded-lg px-1 py-1 text-center transition-opacity"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              opacity: hoveredIndex === null || hoveredIndex === i ? 1 : 0.4,
              cursor: 'pointer',
            }}
          >
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-[46px] font-satoshi text-[14px] font-bold leading-[150%] tracking-[-0.02em] text-black">{seg.label}</span>
            <span className="text-[14px] leading-[150%] text-black/20">•</span>
            <span className="font-satoshi text-[14px] font-medium leading-[150%] tracking-[-0.02em] text-black/60">
              {currSymbol}{formatValue(seg.value)} ({seg.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorDonutChart({
  segments,
  onPillClick,
}: {
  segments: ChartSegment[];
  onPillClick?: (label: string, percentage: number) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showMoreOpen, setShowMoreOpen] = useState(false);
  const safeSelectedIndex = segments.length === 0 ? 0 : Math.min(selectedIndex, segments.length - 1);
  const activeIndex = hoveredIndex ?? safeSelectedIndex;
  const safeActiveIndex = segments.length === 0 ? 0 : Math.min(activeIndex, segments.length - 1);
  const displayedIndexes = [
    safeSelectedIndex,
    ...segments.map((_, i) => i).filter((i) => i !== safeSelectedIndex),
  ].slice(0, 4);
  const remainingIndexes = segments.map((_, i) => i).filter((i) => !displayedIndexes.includes(i));
  const remainingCount = remainingIndexes.length;

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

  const active = segments[safeActiveIndex];

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox="0 0 360 360"
        className="h-[260px] w-[260px]"
        style={{ overflow: 'visible' }}
      >
        {arcs.map((arc, i) => {
          const isActive = i === safeActiveIndex;
          return (
            <path
              key={arc.label}
              d={isActive ? arc.activePath : arc.path}
              fill="none"
              stroke={arc.color}
              strokeWidth={isActive ? strokeWActive : strokeW}
              strokeLinecap="butt"
              className="transition-all duration-150"
              style={{
                opacity: isActive ? 1 : 0.85,
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setSelectedIndex(i)}
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
      <div className="flex w-full flex-wrap justify-center gap-2">
        {displayedIndexes.map((segIndex) => {
          const seg = segments[segIndex];
          const isActive = segIndex === safeActiveIndex;
          return (
          <div
            key={seg.label}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${isActive ? "" : "border-black/10 bg-white"}`}
            style={
              isActive
                ? {
                    borderColor: toRgba(seg.color, 0.5),
                    backgroundColor: toRgba(seg.color, 0.12),
                  }
                : undefined
            }
            onMouseEnter={() => setHoveredIndex(segIndex)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => {
              setSelectedIndex(segIndex);
              onPillClick?.(seg.label, seg.percentage);
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
            <span className="max-w-[110px] truncate text-black/80">{seg.label}</span>
            <span className="font-semibold text-black">{seg.percentage.toFixed(1)}%</span>
          </div>
        )})}
        {remainingCount > 0 && (
          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-black/70"
              onClick={() => setShowMoreOpen((prev) => !prev)}
            >
              <span className="font-medium">+{remainingCount} more</span>
            </button>
            {showMoreOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close more items"
                  className="fixed inset-0 z-10 cursor-default bg-transparent"
                  onClick={() => setShowMoreOpen(false)}
                />
                <div className="absolute left-1/2 z-20 mt-2 w-[260px] -translate-x-1/2 rounded-2xl border border-black/10 bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {remainingIndexes.map((segIndex) => {
                      const seg = segments[segIndex];
                      return (
                      <button
                        type="button"
                        key={seg.label}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition"
                        style={{
                          backgroundColor: hoveredIndex === segIndex ? toRgba(seg.color, 0.12) : "transparent",
                        }}
                        onMouseEnter={() => setHoveredIndex(segIndex)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => {
                          setSelectedIndex(segIndex);
                          setShowMoreOpen(false);
                          onPillClick?.(seg.label, seg.percentage);
                        }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
                        <span className="flex-1 truncate text-xs text-black/80">{seg.label}</span>
                        <span className="text-xs font-semibold text-black">{seg.percentage.toFixed(1)}%</span>
                      </button>
                    )})}
                  </div>
                </div>
              </>
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

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized.length === 3
    ? normalized.split("").map((ch) => ch + ch).join("")
    : normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getShiftedPalette(colors: string[], seed: string) {
  if (colors.length <= 1) return colors;
  const shift = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % colors.length;
  return colors.map((_, i) => colors[(i + shift) % colors.length]);
}

function shadeHex(hex: string, percent: number) {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((ch) => ch + ch).join("")
    : normalized;
  const num = parseInt(full, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function ExposureIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" width="26" height="26">
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
