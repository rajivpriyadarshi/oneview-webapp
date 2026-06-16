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
  "#7F4E0B", "#CE8016", "#A29076", "#444341", "#CAC0B2",
  "#59886B", "#B5603A", "#7D8840", "#A87C70", "#486878",
  "#508040", "#7A8898", "#C8A020", "#6B4060", "#4868A0",
  "#4A7050", "#508878", "#8878A0", "#785090", "#384870",
  "#8A5A48", "#904868", "#A0888C", "#6A7858",
];

function getChartColor(index: number, palette: string[]): string {
  const cycle = Math.floor(index / palette.length);
  const base = palette[index % palette.length];
  if (cycle === 0) return base;
  // Each cycle lightens by 20 or darkens by 20, alternating
  const shift = cycle % 2 === 1 ? 20 * cycle : -20 * cycle;
  return shadeHex(base, shift);
}

const ASSET_COLORS = CHART_COLORS;
const BROKER_COLORS = CHART_COLORS.map((color) => shadeHex(color, -18));
const SECTOR_COLORS = CHART_COLORS;

export default function PortfolioExposure({ portfolioView }: Props) {
  const { trackClick } = useAnalytics();
  const assetPalette = ASSET_COLORS;
  const brokerPalette = useMemo(() => [...BROKER_COLORS.slice(4), ...BROKER_COLORS.slice(0, 4)], []);
  const sectorPalette = useMemo(() => [...SECTOR_COLORS.slice(8), ...SECTOR_COLORS.slice(0, 8)], []);

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
        color: getChartColor(i, assetPalette),
      }));
  }, [assetPalette, portfolioView]);

  const currencyData = useMemo(() => {
    if (!portfolioView?.currency_allocation) return [];
    const entries = Object.entries(portfolioView.currency_allocation);
    const total = entries.reduce((sum, [, v]) => sum + v.market_value, 0);
    return entries
      .sort((a, b) => b[1].market_value - a[1].market_value)
      .map(([label, data], i) => ({
        label: label.toUpperCase(),
        value: data.market_value,
        percentage: data.weight_pct ?? (total > 0 ? (data.market_value / total) * 100 : 0),
        color: getChartColor(i, brokerPalette),
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
        color: getChartColor(i, sectorPalette),
      }));
  }, [portfolioView, sectorPalette]);

  const hasSectorData = sectorData.length > 0;

  return (
    <section data-analytics-section="portfolio_exposure" className="relative z-10 mb-[16px] overflow-visible rounded-[32px] bg-[#ffffffab] px-[16px] pl-[24px] backdrop-blur-[21px]">
      <h3 className="flex align-center items-center gap-2 border-b border-black/10 pl-[6px] py-[24px] font-satoshi text-[16px] font-bold leading-[130%] tracking-[-0.02em] text-black" style={{ fontFeatureSettings: "'ss03' on" }}>
        <ExposureIcon />
        Portfolio exposure
      </h3>
      <div className={`grid gap-0 ${!hasSectorData ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
        <div className="relative pt-[32px] pb-[46px] flex h-full min-w-0 flex-col items-center overflow-visible bg-transparent md:border-r md:border-black/15">
          <p className="mb-4 mt-0 text-center font-satoshi text-sm font-normal leading-[150%] tracking-[-0.02em] text-black" style={{ fontFeatureSettings: "'ss03' on" }}>
            By <strong>Asset type</strong>
          </p>
          <div className="w-full">
            <SectorDonutChart segments={assetTypeData} />
          </div>
        </div>

        <div className={`relative pt-[32px] pb-[46px] flex h-full min-w-0 flex-col items-center overflow-visible bg-transparent ${hasSectorData ? "md:border-r md:border-black/15" : ""}`}>
          <p className="mb-4 mt-0 text-center font-satoshi text-sm font-normal leading-[150%] tracking-[-0.02em] text-black" style={{ fontFeatureSettings: "'ss03' on" }}>
            By <strong>Currency</strong>
          </p>
          <div className="w-full">
            <SectorDonutChart segments={currencyData} />
          </div>
        </div>

        {hasSectorData && (
          <div className="relative pt-[32px] pb-[46px] flex h-full min-w-0 flex-col items-center overflow-visible bg-transparent">
            <p className="mb-4 mt-0 text-center font-satoshi text-sm font-normal leading-[150%] tracking-[-0.02em] text-black" style={{ fontFeatureSettings: "'ss03' on" }}>
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
            const value = `${currSymbol}${formatValue(segments[hoveredIndex].value, currency)}`;
            const pct = `${formatPct(segments[hoveredIndex].percentage)}%`;

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
            <span className="text-[46px] font-satoshi text-[14px] font-bold leading-[150%] tracking-[-0.02em] text-black" style={{ fontFeatureSettings: "'ss03' on" }}>{seg.label}</span>
            <span className="text-[14px] leading-[150%] text-black/20">•</span>
            <span className="font-satoshi text-[14px] font-medium leading-[150%] tracking-[-0.02em] text-black/60" style={{ fontFeatureSettings: "'ss03' on" }}>
              {currSymbol}{formatValue(seg.value, currency)} ({formatPct(seg.percentage)}%)
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
  const nonSelectedIndexes = segments.map((_, i) => i).filter((i) => i !== safeSelectedIndex);
  const secondRowIndexes = nonSelectedIndexes.slice(0, nonSelectedIndexes.length > 2 ? 1 : 2);
  const remainingIndexes = nonSelectedIndexes.slice(secondRowIndexes.length);
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

  if (!active) return null;

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
          fontSize="38"
          fontWeight="800"
          fontFamily="Satoshi, sans-serif"
          fill="#0f0f0f"
          letterSpacing="-1"
        >
          {formatPct(active.percentage)}%
        </text>
        {/* center label */}
        <text
          x={cx}
          y={cy + 24}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="14"
          fontWeight="500"
          fontFamily="Satoshi, sans-serif"
          fill="#888"
          letterSpacing="0"
        >
          {active.label}
        </text>
      </svg>

      {/* legend chips: max 2 rows, +n starts in second row */}
      <div className="flex w-full flex-col items-center gap-2">
        <div className="flex w-full justify-center">
          {(() => {
            const segIndex = safeSelectedIndex;
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
                <span className="font-semibold text-black">{formatPct(seg.percentage)}%</span>
              </div>
            );
          })()}
        </div>

        <div className="flex w-full flex-wrap justify-center gap-2">
          {secondRowIndexes.map((segIndex) => {
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
            <span className="font-semibold text-black">{formatPct(seg.percentage)}%</span>
          </div>
          )})}
          {remainingCount > 0 && (
          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2.5 py-1 text-black/70"
              style={{ fontSize: "16px" }}
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
                        <span className="text-xs font-semibold text-black">{formatPct(seg.percentage)}%</span>
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
    </div>
  );
}

function formatPct(value: number): string {
  return value.toFixed(2);
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase().replace(/_/g, " ");
}

function formatValue(num: number, currency = "INR") {
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (currency === "USD") {
    if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}K`;
    return num.toFixed(2);
  }
  if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}K`;
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
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <g clipPath="url(#clip0_portfolio_exposure_icon)">
        <path
          d="M15.1345 11.3374C14.6806 12.4108 13.9706 13.3568 13.0667 14.0924C12.1627 14.8281 11.0923 15.3312 9.94904 15.5576C8.80576 15.784 7.62442 15.727 6.5083 15.3914C5.39218 15.0558 4.37525 14.4519 3.54644 13.6325C2.71763 12.8131 2.10215 11.8031 1.75383 10.6909C1.40552 9.57868 1.33495 8.39807 1.54832 7.25228C1.76168 6.10649 2.25248 5.03041 2.97779 4.11812C3.70311 3.20583 4.64086 2.48511 5.70907 2.01896M15.1551 5.83135C15.4407 6.52093 15.6159 7.24995 15.6754 7.99162C15.69 8.17485 15.6974 8.26646 15.661 8.34899C15.6306 8.41793 15.5704 8.48316 15.5041 8.51896C15.4248 8.56183 15.3256 8.56183 15.1274 8.56183H9.1339C8.9341 8.56183 8.8342 8.56183 8.75789 8.52294C8.69076 8.48874 8.63619 8.43416 8.60198 8.36703C8.5631 8.29072 8.5631 8.19082 8.5631 7.99102V1.99756C8.5631 1.7993 8.5631 1.70017 8.60596 1.62081C8.64176 1.55452 8.707 1.49431 8.77594 1.46392C8.85846 1.42753 8.95008 1.43488 9.1333 1.44957C9.87498 1.50903 10.604 1.68424 11.2936 1.96987C12.1592 2.32845 12.9458 2.85401 13.6084 3.51656C14.2709 4.17912 14.7965 4.96568 15.1551 5.83135Z"
          stroke="currentColor"
          strokeWidth="1.42702"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_portfolio_exposure_icon">
          <rect width="17.1242" height="17.1242" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
