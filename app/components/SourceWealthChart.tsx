"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiRequest } from "../lib/apiClient";

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

// --- Constants ---

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

const SECTION_META: Record<string, { badge: string }> = {
  financials: { badge: "FINANCIAL" },
  family: { badge: "FAMILY" },
  nonFinancials: { badge: "NON-FINANCIAL" },
  entities: { badge: "ENTITY" },
};

const SECTION_LABELS: Record<string, string> = {
  financials: "Financials",
  family: "Family",
  nonFinancials: "Non-financials",
  entities: "Entities",
};

const TYPE_GROUP_LABELS: Record<string, string> = {
  asset: "Assets",
  account: "Accounts",
  liability: "Liabilities",
  family: "Family Members",
};

// --- Helpers ---

function formatValue(value: number, currency = "USD"): string {
  const abs = Math.abs(value);
  const prefix = value < 0 ? "-" : "";
  const symbol = currency === "USD" ? "$" : currency;
  if (abs >= 1_000_000) return `${prefix}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}${symbol}${(abs / 1_000).toFixed(0)}K`;
  return `${prefix}${symbol}${abs.toFixed(0)}`;
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

// --- Custom Node Components ---

const FONT_FAMILY = "'Satoshi Variable', Satoshi, sans-serif";

function ClientNode({ data }: { data: { name: string; value: string; imageSrc: string } }) {
  return (
    <div style={{ fontFamily: FONT_FAMILY, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: -20,
          left: 0,
          background: "#050505",
          color: "#fff",
          fontSize: 9,
          fontWeight: 800,
          padding: "2px 8px",
          borderRadius: 4,
          letterSpacing: 0.5,
        }}
      >
        CLIENT
      </div>
      <div
        style={{
          width: 155,
          height: 192,
          background: "#1b1207",
          border: "1.8px solid #9b5c09",
          borderRadius: 11,
          overflow: "hidden",
          boxShadow: "0 7px 14px rgba(65, 44, 18, 0.24)",
          position: "relative",
        }}
      >
        <div style={{ width: "100%", height: 80, overflow: "hidden", borderRadius: "9px 9px 0 0" }}>
          <img
            src={data.imageSrc}
            alt={data.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "30px 10px 14px",
            background: "linear-gradient(to bottom, rgba(22,13,3,0) 0%, rgba(22,13,3,0.84) 34%, rgba(16,10,2,0.98) 100%)",
          }}
        >
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>{data.name}</div>
          <div style={{ color: "#f3d585", fontWeight: 500, fontSize: 10, marginTop: 4 }}>
            Adjusted value: {data.value}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#4caf15",
            boxShadow: "0 0 6px rgba(76, 175, 21, 0.42)",
          }}
        />
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "transparent", border: "none" }} />
    </div>
  );
}

function SectionNode({ data }: { data: { title: string; subtitle: string; imageSrc: string; badge: string; isExpanded: boolean; onClick: () => void } }) {
  return (
    <div style={{ fontFamily: FONT_FAMILY, position: "relative", cursor: "pointer" }} onClick={data.onClick}>
      <Handle type="target" position={Position.Left} style={{ background: "transparent", border: "none" }} />
      <div
        style={{
          position: "absolute",
          top: -18,
          left: 0,
          background: data.isExpanded ? "#7a6840" : "#aeb9b6",
          color: "#fff",
          fontSize: 8,
          fontWeight: 800,
          padding: "2px 8px",
          borderRadius: 4,
          letterSpacing: 0.4,
        }}
      >
        {data.badge}
      </div>
      <div
        style={{
          width: 180,
          height: 52,
          background: data.isExpanded ? "#fdf6ee" : "#ffffff",
          border: data.isExpanded ? "1.6px solid #8b6b3a" : "1px solid rgba(0,0,0,0.1)",
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          boxShadow: data.isExpanded ? "0 4px 12px rgba(30,28,24,0.12)" : "0 4px 8px rgba(30,28,24,0.08)",
          gap: 10,
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <img src={data.imageSrc} alt={data.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: "#111" }}>{data.title}</div>
          <div style={{ fontWeight: 500, fontSize: 9, color: "rgba(17,17,17,0.62)", marginTop: 1 }}>{data.subtitle}</div>
        </div>
        <div
          style={{
            color: data.isExpanded ? "#8b6b3a" : "#999",
            fontSize: 12,
            fontWeight: 700,
            transition: "transform 0.2s ease",
            transform: data.isExpanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          &#x203A;
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "transparent", border: "none" }} />
    </div>
  );
}

function TypeGroupNode({ data }: { data: { title: string; subtitle: string; imageSrc: string; count: number; isExpanded: boolean; accent: string; onClick: () => void } }) {
  return (
    <div style={{ fontFamily: FONT_FAMILY, position: "relative", cursor: "pointer" }} onClick={data.onClick}>
      <Handle type="target" position={Position.Left} style={{ background: "transparent", border: "none" }} />
      <div
        style={{
          width: 165,
          height: 46,
          background: data.isExpanded ? "#fdf6ee" : "#ffffff",
          border: data.isExpanded ? `1.4px solid ${data.accent}` : "0.8px solid rgba(0,0,0,0.08)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          boxShadow: data.isExpanded ? "0 3px 10px rgba(30,28,24,0.10)" : "0 3px 6px rgba(30,28,24,0.06)",
          gap: 8,
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              overflow: "hidden",
            }}
          >
            <img src={data.imageSrc} alt={data.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div
            style={{
              position: "absolute",
              top: -4,
              right: -6,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: data.accent,
              color: "#fff",
              fontSize: 8,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {data.count}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: "#111" }}>{data.title}</div>
          <div style={{ fontWeight: 500, fontSize: 9, color: "rgba(17,17,17,0.55)", marginTop: 1 }}>{data.subtitle}</div>
        </div>
        <div
          style={{
            color: data.isExpanded ? data.accent : "#aaa",
            fontSize: 11,
            fontWeight: 700,
            transition: "transform 0.2s ease",
            transform: data.isExpanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          &#x203A;
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "transparent", border: "none" }} />
    </div>
  );
}

function ItemNode({ data }: { data: { name: string; value: string; status?: string; imageSrc: string } }) {
  const statusColor = data.status === "Valued" ? "#1a8f4a" : data.status === "Stale" ? "#d4a017" : "#d44";
  const statusIcon = data.status === "Valued" ? "✓" : data.status === "Stale" ? "⏱" : "⊘";
  const truncatedName = data.name.length > 22 ? data.name.slice(0, 20) + "…" : data.name;

  return (
    <div style={{ fontFamily: FONT_FAMILY, display: "flex", alignItems: "center", gap: 8 }}>
      <Handle type="target" position={Position.Left} style={{ background: "transparent", border: "none" }} />
      <div
        style={{
          width: 44,
          height: 52,
          borderRadius: 8,
          overflow: "hidden",
          flexShrink: 0,
          boxShadow: "0 3px 8px rgba(30,28,24,0.18)",
        }}
      >
        <img src={data.imageSrc} alt={data.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 11, color: "#111" }}>{truncatedName}</div>
        <div style={{ fontWeight: 500, fontSize: 9, color: "#777", marginTop: 2 }}>{data.value}</div>
        {data.status && (
          <div style={{ fontWeight: 600, fontSize: 9, color: statusColor, marginTop: 2 }}>
            {statusIcon} {data.status}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Node type registry ---

const nodeTypes: NodeTypes = {
  clientNode: ClientNode,
  sectionNode: SectionNode,
  typeGroupNode: TypeGroupNode,
  itemNode: ItemNode,
};

// --- Layout builder ---

const X_CLIENT = 0;
const X_SECTION = 300;
const X_TYPEGROUP = 580;
const X_ITEM = 850;
const SECTION_Y_SPACING = 100;
const TYPEGROUP_Y_SPACING = 80;
const ITEM_Y_SPACING = 72;

function buildFlowElements(
  data: GraphResponse,
  expandedSection: string | null,
  expandedTypeGroup: string | null,
  onSectionClick: (sectionKey: string) => void,
  onTypeGroupClick: (typeGroupKey: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Client node
  const sectionKeys = Object.keys(data.sections) as (keyof typeof data.sections)[];
  const totalSectionHeight = (sectionKeys.length - 1) * SECTION_Y_SPACING;
  const clientY = totalSectionHeight / 2;

  nodes.push({
    id: "client",
    type: "clientNode",
    position: { x: X_CLIENT, y: clientY - 96 },
    data: {
      name: data.client.name,
      value: formatValue(data.client.adjustedValue, data.client.currency),
      imageSrc: "/wealth-map/uhnw-client.png",
    },
    draggable: false,
  });

  // Section nodes
  sectionKeys.forEach((key, i) => {
    const meta = SECTION_META[key];
    const section = data.sections[key];
    const sectionValue = "adjustedValue" in section ? (section as { adjustedValue: number }).adjustedValue : 0;
    const isExpanded = expandedSection === key;
    const sectionY = i * SECTION_Y_SPACING;

    nodes.push({
      id: `section-${key}`,
      type: "sectionNode",
      position: { x: X_SECTION, y: sectionY },
      data: {
        title: SECTION_LABELS[key],
        subtitle: sectionValue ? formatValue(sectionValue, data.client.currency) : "",
        imageSrc: SECTION_IMAGES[key],
        badge: meta.badge,
        isExpanded,
        onClick: () => onSectionClick(key),
      },
      draggable: false,
    });

    edges.push({
      id: `edge-client-${key}`,
      source: "client",
      target: `section-${key}`,
      type: "default",
      style: {
        stroke: isExpanded ? "#ad6a22" : "rgba(180,160,120,0.35)",
        strokeWidth: isExpanded ? 1.8 : 1.2,
      },
      animated: false,
    });
  });

  // Type group nodes (when a section is expanded)
  if (expandedSection) {
    const section = data.sections[expandedSection as keyof typeof data.sections];
    let items: { id: string; name: string; value: number; status?: string; type: string; imageSrc: string }[] = [];

    if (expandedSection === "financials") {
      items = (section as GraphFinancials).items.map((item) => ({
        id: item.id,
        name: item.name,
        value: item.adjustedValue,
        status: item.status,
        type: item.type,
        imageSrc:
          item.type === "account"
            ? "/wealth-map/bank-account.png"
            : item.type === "liability"
              ? "/wealth-map/liabilities.png"
              : getAssetImage((item as GraphAssetItem).assetType ?? "", item.name),
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

    // Group by type
    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.type;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }

    const typeKeys = Array.from(grouped.keys());
    const totalTypeHeight = (typeKeys.length - 1) * TYPEGROUP_Y_SPACING;
    const typeStartY = clientY - totalTypeHeight / 2;

    typeKeys.forEach((typeKey, ti) => {
      const groupItems = grouped.get(typeKey)!;
      const groupValue = groupItems.reduce((sum, item) => sum + item.value, 0);
      const fullTypeGroupKey = `${expandedSection}:${typeKey}`;
      const isTypeExpanded = expandedTypeGroup === fullTypeGroupKey;
      const typeGroupY = typeStartY + ti * TYPEGROUP_Y_SPACING;

      nodes.push({
        id: `typegroup-${fullTypeGroupKey}`,
        type: "typeGroupNode",
        position: { x: X_TYPEGROUP, y: typeGroupY },
        data: {
          title: TYPE_GROUP_LABELS[typeKey] ?? typeKey.charAt(0).toUpperCase() + typeKey.slice(1),
          subtitle: groupValue ? formatValue(groupValue, data.client.currency) : "",
          imageSrc: TYPE_GROUP_IMAGES[typeKey] ?? "/wealth-map/holdings.png",
          count: groupItems.length,
          isExpanded: isTypeExpanded,
          accent: "#8b6b3a",
          onClick: () => onTypeGroupClick(fullTypeGroupKey),
        },
        draggable: false,
      });

      edges.push({
        id: `edge-section-${fullTypeGroupKey}`,
        source: `section-${expandedSection}`,
        target: `typegroup-${fullTypeGroupKey}`,
        type: "default",
        style: {
          stroke: "#b88555",
          strokeWidth: 1.4,
        },
        animated: false,
      });

      // Item nodes (when type group is expanded)
      if (isTypeExpanded) {
        const totalItemHeight = (groupItems.length - 1) * ITEM_Y_SPACING;
        const itemStartY = typeGroupY + 23 - totalItemHeight / 2;

        groupItems.forEach((item, ii) => {
          const itemY = itemStartY + ii * ITEM_Y_SPACING;
          const statusLabel =
            item.status === "valued" ? "Valued" : item.status === "stale" ? "Stale" : item.status === "not_on_record" ? "Not on record" : undefined;

          nodes.push({
            id: `item-${item.id}`,
            type: "itemNode",
            position: { x: X_ITEM, y: itemY },
            data: {
              name: item.name,
              value: item.value ? formatValue(item.value, data.client.currency) : "",
              status: statusLabel,
              imageSrc: item.imageSrc,
            },
            draggable: false,
          });

          edges.push({
            id: `edge-typegroup-item-${item.id}`,
            source: `typegroup-${fullTypeGroupKey}`,
            target: `item-${item.id}`,
            type: "default",
            style: {
              stroke: "#b88555",
              strokeWidth: 1,
            },
            animated: false,
          });
        });
      }
    });
  }

  return { nodes, edges };
}

// --- Inner Flow Component (needs ReactFlowProvider above it) ---

function WealthMapFlow({
  graphData,
  className,
}: {
  graphData: GraphResponse;
  className: string;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedTypeGroup, setExpandedTypeGroup] = useState<string | null>(null);
  const { fitView } = useReactFlow();

  const onSectionClick = useCallback(
    (sectionKey: string) => {
      setExpandedSection((prev) => {
        if (prev === sectionKey) return null;
        setExpandedTypeGroup(null);
        return sectionKey;
      });
    },
    [],
  );

  const onTypeGroupClick = useCallback(
    (typeGroupKey: string) => {
      setExpandedTypeGroup((prev) => (prev === typeGroupKey ? null : typeGroupKey));
    },
    [],
  );

  const { nodes: flowNodes, edges: flowEdges } = useMemo(
    () => buildFlowElements(graphData, expandedSection, expandedTypeGroup, onSectionClick, onTypeGroupClick),
    [graphData, expandedSection, expandedTypeGroup, onSectionClick, onTypeGroupClick],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);
    return () => clearTimeout(timer);
  }, [expandedSection, expandedTypeGroup, fitView]);

  return (
    <div className={`h-full w-full ${className}`} style={{ fontFamily: FONT_FAMILY }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(74, 65, 56, 0.24)" gap={46} size={2.7} variant={"dots" as any} />
        <Controls
          showInteractive={false}
          style={{
            bottom: 16,
            left: 16,
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        />
      </ReactFlow>
    </div>
  );
}

// --- Main Export ---

export function SourceWealthChart({ clientId, className = "" }: { clientId: number | null; className?: string }) {
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <div className="grid h-full place-items-center text-[14px] text-black/50" style={{ fontFamily: FONT_FAMILY }}>
        No client selected
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid h-full place-items-center text-[14px] text-black/50" style={{ fontFamily: FONT_FAMILY }}>
        Loading wealth map...
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid h-full place-items-center text-[14px] text-red-500" style={{ fontFamily: FONT_FAMILY }}>
        {error}
      </div>
    );
  }

  if (!graphData) {
    return (
      <div className="grid h-full place-items-center text-[14px] text-black/50" style={{ fontFamily: FONT_FAMILY }}>
        No data available
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <WealthMapFlow graphData={graphData} className={className} />
    </ReactFlowProvider>
  );
}
