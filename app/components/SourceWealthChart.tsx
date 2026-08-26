"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BubbleController,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartArea,
  type ChartData,
  type ChartOptions,
  type Plugin,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Chart } from "react-chartjs-2";
import { apiRequest } from "../lib/apiClient";

ChartJS.register(BubbleController, CategoryScale, LinearScale, PointElement, Tooltip, Legend, ChartDataLabels);

// --- API Types ---

type GraphAssetItem = {
  id: string;
  type: "asset";
  name: string;
  assetType: string;
  adjustedValue: number;
  currency: string;
  status: "valued" | "stale" | "not_on_record";
};

type GraphAccountItem = {
  id: string;
  type: "account";
  name: string;
  institution: string;
  adjustedValue: number;
  currency: string;
  status: "valued" | "stale" | "not_on_record";
};

type GraphLiabilityItem = {
  id: string;
  type: "liability";
  name: string;
  liabilityType: string;
  adjustedValue: number;
  linkedAssetId: string | null;
  status: "valued" | "stale" | "not_on_record";
};

type GraphClientItem = {
  id: number;
  type: "client";
  name: string;
  partyType: string;
  relationship: string;
  ownershipPct: number | null;
  adjustedValue: number;
  attributedValue: number;
  sharedWith: { clientId: number; name: string; relationship: string; pct: number }[];
};

type GraphFamilyMember = {
  id: number;
  name: string;
  partyType: string;
  relationship: string;
  adjustedValue: number;
};

type GraphFinancials = {
  adjustedValue: number;
  items: (GraphAssetItem | GraphAccountItem | GraphLiabilityItem)[];
};

type GraphFamily = {
  members: GraphFamilyMember[];
};

type GraphNonFinancials = {
  adjustedValue: number;
  items: GraphAssetItem[];
};

type GraphEntities = {
  adjustedValue: number;
  items: GraphClientItem[];
};

type GraphResponse = {
  client: {
    id: number;
    name: string;
    partyType: string;
    adjustedValue: number;
    currency: string;
  };
  sections: {
    financials: GraphFinancials;
    family: GraphFamily;
    nonFinancials: GraphNonFinancials;
    entities: GraphEntities;
  };
};

// --- Chart Node Types ---

type NodeKind = "client" | "section" | "typeGroup" | "item";

type WealthMapPoint = {
  id: string;
  x: number;
  y: number;
  r: number;
  kind: NodeKind;
  title: string;
  subtitle?: string;
  status?: string;
  color: string;
  accent?: string;
  tone?: "green" | "red" | "gold" | "blue" | "purple" | "orange" | "brown";
  section?: string;
  badge?: string;
  value?: number;
  imageSrc?: string;
};

const ASSET_TYPE_IMAGES: Record<string, string> = {
  real_estate: "/wealth-map/real-estate.png",
  vehicle: "/wealth-map/vehicles.png",
  apartment: "/wealth-map/apartments.png",
  farmland: "/wealth-map/farmland.png",
  residential: "/wealth-map/residential.png",
  condo: "/wealth-map/condo.png",
  commercial: "/wealth-map/commercial.png",
  villa: "/wealth-map/villa.png",
  jewellery: "/wealth-map/jewellery.png",
  jewelry: "/wealth-map/jewellery.png",
  digital_asset: "/wealth-map/digital-assets.png",
  crypto: "/wealth-map/digital-assets.png",
  gold: "/wealth-map/gold.png",
  art: "/wealth-map/art-collectibles.png",
  collectible: "/wealth-map/art-collectibles.png",
  watch: "/wealth-map/jewellery.png",
  cash: "/wealth-map/cash.png",
  savings: "/wealth-map/savings.png",
  investment: "/wealth-map/investments.png",
  equity: "/wealth-map/brokerage-account.png",
  bond: "/wealth-map/investments.png",
  mutual_fund: "/wealth-map/investment-portfolio.png",
  bank_account: "/wealth-map/bank-account.png",
  brokerage: "/wealth-map/brokerage-account.png",
  loan: "/wealth-map/loan.png",
  mortgage: "/wealth-map/mortgage.png",
  insurance: "/wealth-map/personal-liabilities.png",
  trust: "/wealth-map/trust-foundation.png",
  company: "/wealth-map/companies-spv.png",
  spv: "/wealth-map/companies-spv.png",
  angel_investment: "/wealth-map/investments.png",
  private_equity: "/wealth-map/holdings.png",
  venture_capital: "/wealth-map/holdings.png",
};

const SECTION_IMAGES: Record<string, string> = {
  financials: "/wealth-map/financials.png",
  family: "/wealth-map/family.png",
  nonFinancials: "/wealth-map/non-financial-assets.png",
  entities: "/wealth-map/companies-spv.png",
};

const TYPE_GROUP_IMAGES: Record<string, string> = {
  asset: "/wealth-map/holdings.png",
  account: "/wealth-map/bank-account.png",
  liability: "/wealth-map/liabilities.png",
  family: "/wealth-map/family.png",
};

const FAMILY_IMAGES: Record<string, string> = {
  spouse: "/wealth-map/female-spouse.png",
  wife: "/wealth-map/female-spouse.png",
  husband: "/wealth-map/male-spouse.png",
  child: "/wealth-map/child-boy.png",
  son: "/wealth-map/child-boy.png",
  daughter: "/wealth-map/child-girl.png",
  parent: "/wealth-map/family.png",
  self: "/wealth-map/uhnw-client.png",
};

const imageCache = new Map<string, HTMLImageElement>();

let _chartInstance: ChartJS | null = null;

function getImage(src: string): HTMLImageElement | null {
  if (imageCache.has(src)) {
    const img = imageCache.get(src)!;
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
  const img = new Image();
  img.onload = () => { if (_chartInstance) _chartInstance.draw(); };
  img.src = src;
  imageCache.set(src, img);
  return null;
}

function getAssetImage(assetType: string, name: string): string {
  const normalized = assetType.toLowerCase().replace(/[\s-]+/g, "_");
  if (ASSET_TYPE_IMAGES[normalized]) return ASSET_TYPE_IMAGES[normalized];
  const nameLower = name.toLowerCase();
  if (nameLower.includes("bank")) return "/wealth-map/bank-account.png";
  if (nameLower.includes("angel") || nameLower.includes("invest")) return "/wealth-map/investments.png";
  if (nameLower.includes("property") || nameLower.includes("apartment") || nameLower.includes("condo")) return "/wealth-map/real-estate.png";
  if (nameLower.includes("car") || nameLower.includes("porsche") || nameLower.includes("bmw") || nameLower.includes("vehicle")) return "/wealth-map/vehicles.png";
  if (nameLower.includes("gold")) return "/wealth-map/gold.png";
  if (nameLower.includes("art") || nameLower.includes("paint")) return "/wealth-map/art-collectibles.png";
  if (nameLower.includes("watch") || nameLower.includes("rolex")) return "/wealth-map/jewellery.png";
  if (nameLower.includes("farm")) return "/wealth-map/farmland.png";
  if (nameLower.includes("loan")) return "/wealth-map/loan.png";
  if (nameLower.includes("mortgage")) return "/wealth-map/mortgage.png";
  return "/wealth-map/holdings.png";
}

type HitZone = { id: string; left: number; top: number; right: number; bottom: number };

const SECTION_META: Record<string, { tone: WealthMapPoint["tone"]; accent: string; badge: string }> = {
  financials: { tone: "purple", accent: "#8b6b3a", badge: "FINANCIAL" },
  family: { tone: "blue", accent: "#2a6fb0", badge: "FAMILY" },
  nonFinancials: { tone: "orange", accent: "#b87333", badge: "NON-FINANCIAL" },
  entities: { tone: "green", accent: "#2a7856", badge: "ENTITY" },
};

const SECTION_LABELS: Record<string, string> = {
  financials: "Financials",
  family: "Family",
  nonFinancials: "Non-financials",
  entities: "Entities",
};

function formatValue(value: number, currency = "USD"): string {
  const abs = Math.abs(value);
  const prefix = value < 0 ? "-" : "";
  const symbol = currency === "USD" ? "$" : currency;
  if (abs >= 1_000_000) return `${prefix}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${prefix}${symbol}${abs.toFixed(0)}`;
}

const TYPE_GROUP_LABELS: Record<string, string> = {
  asset: "Assets",
  account: "Accounts",
  liability: "Liabilities",
  family: "Family Members",
};

function buildNodes(data: GraphResponse, expandedSection: string | null, expandedTypeGroup: string | null): WealthMapPoint[] {
  const nodes: WealthMapPoint[] = [];

  nodes.push({
    id: "client",
    x: 8,
    y: 50,
    r: 18,
    kind: "client",
    title: data.client.name,
    subtitle: `Adjusted value: ${formatValue(data.client.adjustedValue, data.client.currency)}`,
    color: "#211507",
    accent: "#b7771e",
    value: data.client.adjustedValue,
    imageSrc: "/wealth-map/uhnw-client.png",
  });

  const sectionKeys = Object.keys(data.sections) as (keyof typeof data.sections)[];
  const sectionCount = sectionKeys.length;
  const yStart = 30;
  const ySpacing = 40 / Math.max(sectionCount - 1, 1);

  sectionKeys.forEach((key, i) => {
    const meta = SECTION_META[key];
    const section = data.sections[key];
    const sectionValue = "adjustedValue" in section ? section.adjustedValue : 0;
    const isExpanded = expandedSection === key;

    nodes.push({
      id: key,
      x: 35,
      y: yStart + i * ySpacing,
      r: 8,
      kind: "section",
      title: SECTION_LABELS[key],
      subtitle: sectionValue ? formatValue(sectionValue, data.client.currency) : undefined,
      color: isExpanded ? "#fdf6ee" : "#ffffff",
      accent: meta.accent,
      tone: meta.tone,
      badge: meta.badge,
      section: key,
      value: sectionValue,
      imageSrc: SECTION_IMAGES[key],
    });
  });

  if (expandedSection) {
    const section = data.sections[expandedSection as keyof typeof data.sections];
    let items: { id: string; name: string; value: number; status?: string; type: string; imageSrc?: string }[] = [];

    if (expandedSection === "financials") {
      items = (section as GraphFinancials).items.map((item) => ({
        id: item.id,
        name: item.name,
        value: item.adjustedValue,
        status: item.status,
        type: item.type,
        imageSrc: item.type === "account" ? "/wealth-map/bank-account.png" : item.type === "liability" ? "/wealth-map/liabilities.png" : getAssetImage((item as GraphAssetItem).assetType ?? "", item.name),
      }));
    } else if (expandedSection === "family") {
      items = (section as GraphFamily).members.map((m) => ({
        id: String(m.id),
        name: m.name,
        value: m.adjustedValue,
        type: "family",
        imageSrc: FAMILY_IMAGES[m.relationship?.toLowerCase()] ?? "/wealth-map/family.png",
      }));
    } else if (expandedSection === "nonFinancials") {
      items = (section as GraphNonFinancials).items.map((item) => ({
        id: item.id,
        name: item.name,
        value: item.adjustedValue,
        status: item.status,
        type: item.type,
        imageSrc: getAssetImage(item.assetType ?? "", item.name),
      }));
    } else if (expandedSection === "entities") {
      items = (section as GraphEntities).items.map((item) => ({
        id: String(item.id),
        name: item.name,
        value: item.adjustedValue,
        type: item.partyType,
        imageSrc: "/wealth-map/companies-spv.png",
      }));
    }

    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.type;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }

    const typeKeys = Array.from(grouped.keys());
    const typeCount = typeKeys.length;
    const typeYSpacing = 22;
    const typeTotalSpan = (typeCount - 1) * typeYSpacing;
    const typeStartY = 50 - typeTotalSpan / 2;
    const meta = SECTION_META[expandedSection];

    typeKeys.forEach((typeKey, ti) => {
      const groupItems = grouped.get(typeKey)!;
      const groupValue = groupItems.reduce((sum, item) => sum + item.value, 0);
      const isTypeExpanded = expandedTypeGroup === `${expandedSection}:${typeKey}`;

      nodes.push({
        id: `type:${expandedSection}:${typeKey}`,
        x: 64,
        y: typeStartY + ti * typeYSpacing,
        r: 6,
        kind: "typeGroup",
        title: TYPE_GROUP_LABELS[typeKey] ?? typeKey.charAt(0).toUpperCase() + typeKey.slice(1),
        subtitle: groupValue ? formatValue(groupValue, data.client.currency) : undefined,
        color: isTypeExpanded ? "#fdf6ee" : "#ffffff",
        accent: meta.accent,
        tone: meta.tone,
        section: expandedSection,
        badge: `${groupItems.length}`,
        value: groupValue,
        imageSrc: TYPE_GROUP_IMAGES[typeKey] ?? "/wealth-map/holdings.png",
      });

      if (isTypeExpanded) {
        const itemCount = groupItems.length;
        const isLargeList = itemCount > 8;
        const spacing = isLargeList ? 8 : 14;
        const neededSpan = itemCount > 1 ? (itemCount - 1) * spacing : 0;
        const maxSpan = isLargeList ? 94 : 70;
        const totalSpan = Math.min(neededSpan, maxSpan);
        const centerY = 50;
        const startY = isLargeList ? 3 : centerY - totalSpan / 2;
        const itemSpacing = itemCount > 1 ? totalSpan / (itemCount - 1) : 0;

        groupItems.forEach((item, i) => {
          const itemY = itemCount === 1 ? 50 : startY + i * itemSpacing;
          const arc = isLargeList ? 0 : Math.sin((itemCount > 1 ? i / (itemCount - 1) : 0.5) * Math.PI) * 10;
          const itemX = isLargeList ? 86 : 84 + arc;
          nodes.push({
            id: `item:${item.id}`,
            x: itemX,
            y: itemY,
            r: 5,
            kind: "item",
            title: item.name,
            subtitle: item.value ? formatValue(item.value, data.client.currency) : undefined,
            status: item.status === "valued" ? "Valued" : item.status === "stale" ? "Stale" : item.status === "not_on_record" ? "Not on record" : undefined,
            color: meta.accent,
            accent: meta.accent,
            tone: meta.tone,
            section: expandedSection,
            value: item.value,
            imageSrc: item.imageSrc,
          });
        });
      }
    });
  }

  return nodes;
}

let _hitZones: HitZone[] = [];
let _expandedSection: string | null = null;
let _expandedTypeGroup: string | null = null;
let _hoveredItem: string | null = null;
let _animProgress = 1;
let _animSectionX = 50;
let _animSectionY = 50;
let _animSource: "section" | "typeGroup" = "section";

export function SourceWealthChart({ clientId, className = "" }: { clientId: number | null; className?: string }) {
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedTypeGroup, setExpandedTypeGroup] = useState<string | null>(null);
  const chartRef = useRef<ChartJS<"bubble", WealthMapPoint[]> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  _expandedSection = expandedSection;
  _expandedTypeGroup = expandedTypeGroup;
  _hoveredItem = hoveredItem;

  const animRef = useRef<number | null>(null);
  const prevExpandedRef = useRef<string | null>(null);
  const prevTypeGroupRef = useRef<string | null>(null);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const canvas = event.currentTarget.querySelector("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    let found: string | null = null;
    for (const zone of _hitZones) {
      if (zone.id.startsWith("item:") && mx >= zone.left && mx <= zone.right && my >= zone.top && my <= zone.bottom) {
        found = zone.id;
        break;
      }
    }
    setHoveredItem((prev) => prev !== found ? found : prev);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      _chartInstance = chartRef.current;
      chartRef.current.draw();
    }
  }, [hoveredItem]);

  useEffect(() => {
    if (chartRef.current) _chartInstance = chartRef.current;
  });

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    async function fetchGraph() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<GraphResponse>(`/clients/${clientId}/graph/`);
        if (!cancelled) setGraphData(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load graph");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchGraph();
    return () => { cancelled = true; };
  }, [clientId]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const canvas = event.currentTarget.querySelector("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    for (const zone of _hitZones) {
      if (clickX >= zone.left && clickX <= zone.right && clickY >= zone.top && clickY <= zone.bottom) {
        if (zone.id === "client" || zone.id.startsWith("item:")) break;
        if (zone.id.startsWith("type:")) {
          setExpandedTypeGroup((prev) => prev === zone.id.slice(5) ? null : zone.id.slice(5));
          break;
        }
        setExpandedSection((prev) => {
          if (prev === zone.id) return null;
          setExpandedTypeGroup(null);
          return zone.id;
        });
        break;
      }
    }
  }, []);

  const nodes = useMemo(() => {
    if (!graphData) return [];
    return buildNodes(graphData, expandedSection, expandedTypeGroup);
  }, [graphData, expandedSection, expandedTypeGroup]);

  useEffect(() => {
    for (const node of nodes) {
      if (node.imageSrc) getImage(node.imageSrc);
    }
  }, [nodes]);

  useEffect(() => {
    if (expandedSection && expandedSection !== prevExpandedRef.current) {
      const sectionNode = nodes.find((n) => n.kind === "section" && n.id === expandedSection);
      if (sectionNode) {
        _animSectionX = sectionNode.x;
        _animSectionY = sectionNode.y;
      }
      _animSource = "section";
      _animProgress = 0;
      const startTime = performance.now();
      const duration = 350;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        _animProgress = Math.min(elapsed / duration, 1);
        _animProgress = 1 - Math.pow(1 - _animProgress, 3);
        if (chartRef.current) chartRef.current.draw();
        if (elapsed < duration) {
          animRef.current = requestAnimationFrame(animate);
        }
      };
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(animate);
    } else if (!expandedSection) {
      _animProgress = 1;
    }
    prevExpandedRef.current = expandedSection;
  }, [expandedSection, nodes]);

  useEffect(() => {
    if (expandedTypeGroup && expandedTypeGroup !== prevTypeGroupRef.current) {
      const tgNode = nodes.find((n) => n.kind === "typeGroup" && n.id === `type:${expandedTypeGroup}`);
      if (tgNode) {
        _animSectionX = tgNode.x;
        _animSectionY = tgNode.y;
      }
      _animSource = "typeGroup";
      _animProgress = 0;
      const startTime = performance.now();
      const duration = 350;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        _animProgress = Math.min(elapsed / duration, 1);
        _animProgress = 1 - Math.pow(1 - _animProgress, 3);
        if (chartRef.current) chartRef.current.draw();
        if (elapsed < duration) {
          animRef.current = requestAnimationFrame(animate);
        }
      };
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(animate);
    } else if (!expandedTypeGroup) {
      _animProgress = 1;
    }
    prevTypeGroupRef.current = expandedTypeGroup;
  }, [expandedTypeGroup, nodes]);

  useEffect(() => {
    let el = containerRef.current?.parentElement;
    while (el && el.scrollHeight <= el.clientHeight) {
      el = el.parentElement;
    }
    if (!el) return;
    const itemCount = nodes.filter((n) => n.kind === "item").length;
    if (itemCount > 8) {
      requestAnimationFrame(() => {
        const scrollMax = el!.scrollHeight - el!.clientHeight;
        el!.scrollTo({ top: scrollMax / 2, behavior: "smooth" });
      });
    }
  }, [expandedSection, nodes]);

  const data = useMemo<ChartData<"bubble", WealthMapPoint[]>>(
    () => ({
      datasets: [
        {
          label: "Wealth map",
          data: nodes,
          backgroundColor: nodes.map(() => "rgba(0,0,0,0)"),
          borderColor: nodes.map(() => "rgba(0,0,0,0)"),
          borderWidth: 0,
        },
      ],
    }),
    [nodes],
  );

  const options = useMemo<ChartOptions<"bubble">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 24, right: 140, bottom: 22, left: 18 } },
      scales: {
        x: { type: "linear", min: 0, max: 100, display: false },
        y: { type: "linear", min: 0, max: 100, reverse: true, display: false },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false },
      },
    }),
    [],
  );

  const plugin = useMemo<Plugin<"bubble">>(() => createWealthMapPlugin(), []);

  if (!clientId) {
    return <div className="grid h-full place-items-center font-satoshi text-[14px] text-black/50">No client selected</div>;
  }

  if (loading) {
    return <div className="grid h-full place-items-center font-satoshi text-[14px] text-black/50">Loading wealth map...</div>;
  }

  if (error) {
    return <div className="grid h-full place-items-center font-satoshi text-[14px] text-red-500">{error}</div>;
  }

  if (!graphData) {
    return <div className="grid h-full place-items-center font-satoshi text-[14px] text-black/50">No data available</div>;
  }

  const expandedItemCount = nodes.filter((n) => n.kind === "item").length;
  const dynamicHeight = expandedItemCount > 8 ? Math.max(620, expandedItemCount * 70) : 620;

  return (
    <div ref={containerRef} className={`relative h-full w-full cursor-pointer overflow-auto ${className}`} onClick={handleClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{ minHeight: `${dynamicHeight}px` }}>
      <Chart ref={chartRef} type="bubble" data={data} options={options} plugins={[plugin]} />
    </div>
  );
}

// --- Rendering Plugin ---

function createWealthMapPlugin(): Plugin<"bubble"> {
  return {
    id: "radialWealthMap",
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
      drawGrid(ctx, chartArea);

      const { scales } = chart;
      const px = (x: number) => scales.x.getPixelForValue(x);
      const py = (y: number) => scales.y.getPixelForValue(y);

      drawAmbient(ctx, px(40), py(45), "#caffdc", 170);
      drawAmbient(ctx, px(55), py(50), "#dacdff", 155);
      drawAmbient(ctx, px(70), py(55), "#ffd0b8", 145);

      const nodes = chart.data.datasets[0]?.data as WealthMapPoint[] | undefined;
      if (nodes) {
        drawConnections(ctx, px, py, nodes);
      }

      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const px = (x: number) => scales.x.getPixelForValue(x);
      const py = (y: number) => scales.y.getPixelForValue(y);

      const nodes = chart.data.datasets[0]?.data as WealthMapPoint[] | undefined;
      if (!nodes || nodes.length === 0) return;

      ctx.save();
      const zones: HitZone[] = [];

      const originX = px(_animSectionX);
      const originY = py(_animSectionY);

      for (const node of nodes) {
        let nodeX = px(node.x);
        let nodeY = py(node.y);

        if (node.kind === "client") {
          drawClientCard(ctx, nodeX, nodeY, node);
          zones.push({ id: node.id, left: nodeX - 78, top: nodeY - 96, right: nodeX + 78, bottom: nodeY + 96 });
        } else if (node.kind === "section") {
          const isExpanded = _expandedSection === node.id;
          drawSectionCard(ctx, nodeX, nodeY, node, isExpanded);
          zones.push({ id: node.id, left: nodeX - 26, top: nodeY - 22, right: nodeX + 114, bottom: nodeY + 22 });
        } else if (node.kind === "typeGroup") {
          if (_animProgress < 1 && _animSource === "section") {
            const t = _animProgress;
            nodeX = originX + (nodeX - originX) * t;
            nodeY = originY + (nodeY - originY) * t;
            ctx.globalAlpha = t;
          }
          const isTypeExpanded = node.color === "#fdf6ee";
          drawTypeGroupCard(ctx, nodeX, nodeY, node, isTypeExpanded);
          ctx.globalAlpha = 1;
          zones.push({ id: node.id, left: nodeX - 22, top: nodeY - 20, right: nodeX + 110, bottom: nodeY + 20 });
        } else if (node.kind === "item") {
          if (_animProgress < 1 && _animSource === "typeGroup") {
            const t = _animProgress;
            nodeX = originX + (nodeX - originX) * t;
            nodeY = originY + (nodeY - originY) * t;
            ctx.globalAlpha = t;
          }
          drawItemTile(ctx, nodeX, nodeY, node);
          ctx.globalAlpha = 1;
          zones.push({ id: node.id, left: nodeX - 22, top: nodeY - 26, right: nodeX + 120, bottom: nodeY + 26 });
        }
      }

      if (_hoveredItem) {
        const hoveredNode = nodes.find((n) => n.id === _hoveredItem);
        if (hoveredNode) {
          drawItemTooltip(ctx, px(hoveredNode.x), py(hoveredNode.y), hoveredNode);
        }
      }

      ctx.restore();
      _hitZones = zones;
    },
  };
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  px: (v: number) => number,
  py: (v: number) => number,
  nodes: WealthMapPoint[],
) {
  const clientNode = nodes.find((n) => n.kind === "client");
  const sections = nodes.filter((n) => n.kind === "section");
  const typeGroups = nodes.filter((n) => n.kind === "typeGroup");
  const items = nodes.filter((n) => n.kind === "item");

  if (!clientNode) return;

  const clientX = px(clientNode.x);
  const clientY = py(clientNode.y);
  const greenDotX = clientX + 78;

  sections.forEach((section) => {
    const sectionLeft = px(section.x) - 26;
    const sectionY = py(section.y);
    const isExpanded = _expandedSection === section.id;
    const color = isExpanded ? "#ad6a22" : `rgba(180,160,120,0.35)`;
    const width = isExpanded ? 1.4 : 1;
    drawCurve(ctx, greenDotX, clientY, sectionLeft, sectionY, color, width);
  });

  if (typeGroups.length > 0) {
    const expandedSection = sections.find((s) => _expandedSection === s.id);
    if (expandedSection) {
      const sectionRight = px(expandedSection.x) - 26 + 140;
      const sectionY = py(expandedSection.y);
      const t = _animProgress;
      ctx.globalAlpha = t * 0.82;
      typeGroups.forEach((tg) => {
        const targetX = px(tg.x) - 22;
        const targetY = py(tg.y);
        const endX = sectionRight + (targetX - sectionRight) * t;
        const endY = sectionY + (targetY - sectionY) * t;
        drawCurve(ctx, sectionRight, sectionY, endX, endY, "#b88555", 1.2);
      });
      ctx.globalAlpha = 1;
    }
  }

  if (items.length > 0) {
    const expandedTG = typeGroups.find((tg) => tg.color === "#fdf6ee");
    if (expandedTG) {
      const tgRight = px(expandedTG.x) - 22 + 132;
      const tgY = py(expandedTG.y);
      const t = _animProgress;
      ctx.globalAlpha = t * 0.82;
      items.forEach((item) => {
        const targetX = px(item.x) - 20;
        const targetY = py(item.y);
        const endX = tgRight + (targetX - tgRight) * t;
        const endY = tgY + (targetY - tgY) * t;
        drawCurve(ctx, tgRight, tgY, endX, endY, "#b88555", 1);
      });
      ctx.globalAlpha = 1;
    }
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, area: ChartArea) {
  ctx.fillStyle = "rgba(74, 65, 56, 0.24)";
  for (let x = area.left; x <= area.right; x += 46) {
    for (let y = area.top; y <= area.bottom; y += 46) {
      ctx.beginPath();
      ctx.arc(x, y, 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawAmbient(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, radius: number) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.82;
  const midX = x1 + (x2 - x1) * 0.55;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawClientCard(ctx: CanvasRenderingContext2D, x: number, y: number, node: WealthMapPoint) {
  const width = 155;
  const height = 192;
  const left = x - width / 2;
  const top = y - height / 2;

  drawBadge(ctx, left, top - 16, 32, "CLIENT", "#050505", "#fff", 5.5, 13, 4);
  ctx.shadowColor = "rgba(65, 44, 18, 0.24)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = "#1b1207";
  roundRect(ctx, left, top, width, height, 11);
  ctx.fill();
  ctx.strokeStyle = "#9b5c09";
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.shadowColor = "transparent";

  drawPortraitPhoto(ctx, left + 8, top + 8, width - 16, 72, node.imageSrc);

  const overlay = ctx.createLinearGradient(left, top + 60, left, top + height);
  overlay.addColorStop(0, "rgba(22, 13, 3, 0)");
  overlay.addColorStop(0.34, "rgba(22, 13, 3, 0.84)");
  overlay.addColorStop(1, "rgba(16, 10, 2, 0.98)");
  ctx.fillStyle = overlay;
  roundRect(ctx, left + 8, top + 48, width - 16, height - 58, 7);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "800 10px Satoshi, Arial";
  ctx.fillText(node.title, left + 10, top + 98);
  ctx.fillStyle = "#f3d585";
  ctx.font = "500 6px Satoshi, Arial";
  ctx.fillText(node.subtitle ?? "", left + 10, top + 108);

  ctx.fillStyle = "#4caf15";
  ctx.shadowColor = "rgba(76, 175, 21, 0.42)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(left + width - 8, top + height - 12, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
}

function drawSectionCard(ctx: CanvasRenderingContext2D, x: number, y: number, node: WealthMapPoint, isExpanded: boolean) {
  const width = 140;
  const height = 44;
  const left = x - 26;
  const top = y - height / 2;

  if (node.badge) drawBadge(ctx, left, top - 15, 60, node.badge, isExpanded ? "#7a6840" : "#aeb9b6", "#fff", 5.5, 12, 4);

  ctx.shadowColor = "rgba(30, 28, 24, 0.12)";
  ctx.shadowBlur = isExpanded ? 12 : 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = isExpanded ? "#fdf6ee" : "#ffffff";
  roundRect(ctx, left, top, width, height, 9);
  ctx.fill();
  ctx.strokeStyle = isExpanded ? "#8b6b3a" : "rgba(0,0,0,0.1)";
  ctx.lineWidth = isExpanded ? 1.6 : 1;
  ctx.stroke();
  ctx.shadowColor = "transparent";

  drawPhoto(ctx, left + 9, top + 8, 28, 28, node.accent ?? "#5f8f4e", true, node.imageSrc);

  ctx.fillStyle = "#111";
  ctx.font = "800 10px Satoshi, Arial";
  ctx.fillText(node.title, left + 43, top + 22);
  ctx.fillStyle = "rgba(17, 17, 17, 0.62)";
  ctx.font = "500 6px Satoshi, Arial";
  ctx.fillText(node.subtitle ?? "", left + 43, top + 32);

  const arrowX = left + width - 16;
  const arrowY = top + height / 2;
  ctx.strokeStyle = isExpanded ? "#8b6b3a" : "#999";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (isExpanded) {
    ctx.moveTo(arrowX - 3, arrowY + 2);
    ctx.lineTo(arrowX, arrowY - 2);
    ctx.lineTo(arrowX + 3, arrowY + 2);
  } else {
    ctx.moveTo(arrowX - 2, arrowY - 3);
    ctx.lineTo(arrowX + 2, arrowY);
    ctx.lineTo(arrowX - 2, arrowY + 3);
  }
  ctx.stroke();
}

function drawTypeGroupCard(ctx: CanvasRenderingContext2D, x: number, y: number, node: WealthMapPoint, isExpanded: boolean) {
  const width = 130;
  const height = 38;
  const left = x - 22;
  const top = y - height / 2;

  ctx.shadowColor = "rgba(30, 28, 24, 0.10)";
  ctx.shadowBlur = isExpanded ? 10 : 6;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = isExpanded ? "#fdf6ee" : "#ffffff";
  roundRect(ctx, left, top, width, height, 8);
  ctx.fill();
  ctx.strokeStyle = isExpanded ? (node.accent ?? "#8b6b3a") : "rgba(0,0,0,0.08)";
  ctx.lineWidth = isExpanded ? 1.4 : 0.8;
  ctx.stroke();
  ctx.shadowColor = "transparent";

  const circleX = left + 15;
  const circleY = top + height / 2;
  drawPhoto(ctx, circleX - 10, circleY - 10, 20, 20, node.accent ?? "#8b6b3a", true, node.imageSrc);

  const badgeX = circleX + 7;
  const badgeY = circleY - 8;
  ctx.fillStyle = node.accent ?? "#8b6b3a";
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 5.5px Satoshi, Arial";
  ctx.textAlign = "center";
  ctx.fillText(node.badge ?? "", badgeX, badgeY + 2);
  ctx.textAlign = "left";

  ctx.fillStyle = "#111";
  ctx.font = "700 9px Satoshi, Arial";
  ctx.fillText(node.title, left + 30, top + 17);
  ctx.fillStyle = "rgba(17, 17, 17, 0.55)";
  ctx.font = "500 7px Satoshi, Arial";
  ctx.fillText(node.subtitle ?? "", left + 30, top + 28);

  const arrowX = left + width - 14;
  const arrowY = top + height / 2;
  ctx.strokeStyle = isExpanded ? (node.accent ?? "#8b6b3a") : "#aaa";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (isExpanded) {
    ctx.moveTo(arrowX - 3, arrowY + 2);
    ctx.lineTo(arrowX, arrowY - 2);
    ctx.lineTo(arrowX + 3, arrowY + 2);
  } else {
    ctx.moveTo(arrowX - 2, arrowY - 3);
    ctx.lineTo(arrowX + 2, arrowY);
    ctx.lineTo(arrowX - 2, arrowY + 3);
  }
  ctx.stroke();
}

function drawItemTile(ctx: CanvasRenderingContext2D, x: number, y: number, node: WealthMapPoint) {
  const tileW = 44;
  const tileH = 52;
  const left = x - tileW / 2;
  const top = y - tileH / 2;

  ctx.shadowColor = "rgba(30, 28, 24, 0.18)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  drawPhoto(ctx, left, top, tileW, tileH, node.color, false, node.imageSrc);
  ctx.shadowColor = "transparent";

  const textX = left + tileW + 6;
  const textY = y - 6;

  ctx.fillStyle = "#111";
  ctx.font = "800 9px Satoshi, Arial";
  const maxTitleWidth = 100;
  const title = node.title.length > 22 ? node.title.slice(0, 20) + "…" : node.title;
  ctx.fillText(title, textX, textY);
  ctx.fillStyle = "#777";
  ctx.font = "500 7px Satoshi, Arial";
  ctx.fillText(node.subtitle ?? "", textX, textY + 11);

  if (node.status) {
    const isGood = node.status === "Valued";
    ctx.fillStyle = isGood ? "#1a8f4a" : node.status === "Stale" ? "#d4a017" : "#d44";
    ctx.font = "600 7px Satoshi, Arial";
    const icon = isGood ? "✓ " : node.status === "Stale" ? "⏱ " : "⊘ ";
    ctx.fillText(icon + node.status, textX, textY + 22);
  }
}

function drawItemTooltip(ctx: CanvasRenderingContext2D, x: number, y: number, node: WealthMapPoint) {
  const padding = 10;
  const lineHeight = 14;
  const lines: string[] = [node.title];
  if (node.subtitle) lines.push(node.subtitle);
  if (node.status) lines.push(node.status);

  ctx.font = "600 10px Satoshi, Arial";
  const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const width = maxWidth + padding * 2;
  const height = lines.length * lineHeight + padding * 2 - 4;

  const tooltipX = x + 50;
  const tooltipY = y - height - 10;

  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#1b1207";
  roundRect(ctx, tooltipX, tooltipY, width, height, 8);
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.strokeStyle = "#8b6b3a";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "700 10px Satoshi, Arial";
  ctx.fillText(lines[0], tooltipX + padding, tooltipY + padding + 10);

  if (lines[1]) {
    ctx.fillStyle = "#f3d585";
    ctx.font = "500 9px Satoshi, Arial";
    ctx.fillText(lines[1], tooltipX + padding, tooltipY + padding + 10 + lineHeight);
  }

  if (lines[2]) {
    const isGood = lines[2] === "Valued";
    ctx.fillStyle = isGood ? "#6fd88a" : lines[2] === "Stale" ? "#f5d167" : "#ff7b7b";
    ctx.font = "600 9px Satoshi, Arial";
    ctx.fillText(lines[2], tooltipX + padding, tooltipY + padding + 10 + lineHeight * 2);
  }
}

// --- Drawing Utilities ---

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  text: string,
  fill: string,
  color: string,
  fontSize = 6,
  height = 14,
  radius = 4,
) {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = `800 ${fontSize}px Satoshi, Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + width / 2, y + height / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawPortraitPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, imageSrc?: string) {
  ctx.save();
  roundRect(ctx, x, y, width, height, 14);
  ctx.clip();
  const img = imageSrc ? getImage(imageSrc) : null;
  if (img) {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = width / height;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (imgAspect > boxAspect) {
      sw = img.naturalHeight * boxAspect;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / boxAspect;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
  } else {
    const background = ctx.createLinearGradient(x, y, x + width, y + height);
    background.addColorStop(0, "#55b95f");
    background.addColorStop(0.48, "#d4bd4a");
    background.addColorStop(1, "#334d35");
    ctx.fillStyle = background;
    ctx.fillRect(x, y, width, height);
  }
  ctx.restore();
}

function drawPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string, circular = false, imageSrc?: string) {
  ctx.save();
  roundRect(ctx, x, y, width, height, circular ? width / 2 : 8);
  ctx.clip();
  const img = imageSrc ? getImage(imageSrc) : null;
  if (img) {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = width / height;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (imgAspect > boxAspect) {
      sw = img.naturalHeight * boxAspect;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / boxAspect;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
  } else {
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, "#e0bd63");
    gradient.addColorStop(1, "#12352b");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
