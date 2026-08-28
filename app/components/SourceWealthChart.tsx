"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
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
import "./wealth-map-flow.css";
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

type GraphOwnershipItem = {
  title: string;
  points: string[];
};

type GraphCategory = {
  slug: string;
  label: string;
  adjustedValue?: number;
  items?: (GraphAssetItem | GraphAccountItem | GraphLiabilityItem | GraphClientItem | GraphOwnershipItem)[];
  members?: GraphFamilyMember[];
};

type GraphFinancials = {
  adjustedValue: number;
  categories: GraphCategory[];
};

type GraphNonFinancials = {
  adjustedValue: number;
  categories: GraphCategory[];
};

type GraphLiabilities = {
  adjustedValue: number;
  categories: GraphCategory[];
};

type GraphFamilyAndOwnership = {
  categories: GraphCategory[];
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
    nonFinancials: GraphNonFinancials;
    liabilities: GraphLiabilities;
    familyAndOwnership: GraphFamilyAndOwnership;
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
  margin_loan: "/wealth-map/loan.png",
  corporate_debt: "/wealth-map/business-liabilities.png",
  tax_payable: "/wealth-map/taxes.png",
  guarantee: "/wealth-map/guarantees.png",
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
  nonFinancials: "/wealth-map/non-financial-assets.png",
  liabilities: "/wealth-map/liabilities.png",
  familyAndOwnership: "/wealth-map/family-wealth.png",
};

const CATEGORY_IMAGES: Record<string, string> = {
  banking_cash: "/wealth-map/bank.png",
  investment_accounts: "/wealth-map/brokerage-account.png",
  retirement_tax_advantage: "/wealth-map/retirement-accounts.png",
  private_investments: "/wealth-map/investment-portfolio.png",
  digital_financial_assets: "/wealth-map/digital-assets.png",
  real_estate: "/wealth-map/real-estate.png",
  collections: "/wealth-map/art-collectibles.png",
  vehicles: "/wealth-map/vehicles.png",
  intellectual_property: "/wealth-map/intellectual-property.png",
  other_personal_property: "/wealth-map/other-personal-property.png",
  mortgages: "/wealth-map/mortgage.png",
  personal_liabilities: "/wealth-map/personal-liabilities.png",
  business_liabilities: "/wealth-map/business-liabilities.png",
  tax_legal_obligations: "/wealth-map/taxes.png",
  guarantee_exposure: "/wealth-map/guarantees.png",
  family_members: "/wealth-map/family.png",
  trusts_foundations: "/wealth-map/trust-foundation.png",
  companies_spvs: "/wealth-map/companies-spv.png",
  ownership_relationships: "/wealth-map/ownership-relationships.png",
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
  nonFinancials: { badge: "NON-FINANCIAL" },
  liabilities: { badge: "LIABILITIES" },
  familyAndOwnership: { badge: "FAMILY & OWNERSHIP" },
};

const SECTION_LABELS: Record<string, string> = {
  financials: "Financials",
  nonFinancials: "Non-financials",
  liabilities: "Liabilities",
  familyAndOwnership: "Family & Ownership",
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

function formatNodeLabel(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getClientInitials(name: string): string {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "";
  if (nameParts.length === 1) return nameParts[0].slice(0, 2).toUpperCase();
  return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
}

// --- Custom Node Components ---

const FONT_FAMILY = "'Satoshi Variable', Satoshi, sans-serif";

function NodeTypeLabel({
  children,
  selected,
  selectedBackground = "#41240d",
}: {
  children: string;
  selected: boolean;
  selectedBackground?: string;
}) {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        background: selected ? selectedBackground : "rgba(65, 36, 13, 0.16)",
        borderRadius: 8,
        color: selected ? "#fff" : "#41240d",
        fontSize: 10.37,
        fontWeight: 700,
        letterSpacing: 0.622,
        lineHeight: "13.827px",
        padding: "4px 6px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function ClientNode({
  data,
}: {
  data: {
    name: string;
    value: string;
    imageSrc: string;
    meta: string;
    description: string;
    onProfileDetails: () => void;
  };
}) {
  const initials = getClientInitials(data.name);

  return (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: FONT_FAMILY, gap: 8, width: 328 }}>
      <NodeTypeLabel selected>CLIENT</NodeTypeLabel>
      <div
        style={{
          background: "#1b1202",
          border: "2px solid #bd7323",
          borderRadius: 24,
          boxShadow: "0 8px 8px rgba(0, 0, 0, 0.25)",
          padding: 16,
          position: "relative",
        }}
      >
        <div style={{ height: 169, overflow: "hidden", borderRadius: 16, position: "relative", width: 294 }}>
          <img
            src={data.imageSrc}
            alt={data.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            aria-hidden="true"
            style={{
              background: "rgba(45, 159, 22, 0.79)",
              inset: 0,
              mixBlendMode: "overlay",
              position: "absolute",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              color: "#fff",
              fontSize: 80,
              fontWeight: 900,
              left: "50%",
              lineHeight: 1.2,
              position: "absolute",
              textAlign: "center",
              textShadow: "0 4px 4px rgba(0, 0, 0, 0.24)",
              top: 37,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {initials}
          </div>
          <div
            style={{
              background: "linear-gradient(180deg, rgba(27,18,2,0) 45%, rgba(27,18,2,0.72) 100%)",
              inset: 0,
              position: "absolute",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 900, lineHeight: "24px" }}>{data.name}</div>
            <div style={{ color: "#fdfbb1", fontSize: 12, fontWeight: 500, lineHeight: "18px" }}>
              Adjusted value: {data.value}
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500, lineHeight: "18px" }}>
            {data.meta}
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 400, lineHeight: "20px" }}>
            {data.description}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              data.onProfileDetails();
            }}
            style={{
              alignItems: "center",
              alignSelf: "flex-start",
              background: "#ffb01d",
              border: 0,
              borderRadius: 32,
              color: "#000",
              display: "flex",
              fontFamily: "Inter, sans-serif",
              fontSize: 11.987,
              fontWeight: 600,
              gap: 4,
              letterSpacing: -0.48,
              lineHeight: "17.124px",
              padding: "8px 12px",
            }}
          >
            Profile details
            <img src="/wealth-map/arrow-circle-right-black.svg" alt="" aria-hidden="true" style={{ height: 16, width: 16 }} />
          </button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "transparent", border: "none" }} />
    </div>
  );
}

type CategoryNodeData = {
  badge: string;
  title: string;
  meta: string;
  estimatedValue: string;
  imageSrc: string;
  isExpanded: boolean;
  onClick: () => void;
};

function CategoryCard({ data }: { data: CategoryNodeData }) {
  return (
    <div
      style={{ cursor: "pointer", display: "flex", flexDirection: "column", fontFamily: FONT_FAMILY, gap: 8, width: 328 }}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Left} style={{ background: "transparent", border: "none" }} />
      <NodeTypeLabel selected={data.isExpanded}>{data.badge}</NodeTypeLabel>
      <div
        style={{
          alignItems: "center",
          background: data.isExpanded ? "rgba(254, 243, 223, 0.5)" : "rgba(255, 254, 252, 0.5)",
          backdropFilter: "blur(12px) saturate(120%)",
          border: data.isExpanded ? "2px solid #804d13" : "2px solid #d2d2d2",
          borderRadius: 24,
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.25)",
          display: "flex",
          gap: 16,
          padding: 16,
          transition: "background-color 160ms ease, border-color 160ms ease",
          WebkitBackdropFilter: "blur(12px) saturate(120%)",
          width: 328,
        }}
      >
        <div
          style={{
            borderRadius: 62,
            height: 65,
            overflow: "hidden",
            flexShrink: 0,
            width: 72,
          }}
        >
          <img src={data.imageSrc} alt={data.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
          <div style={{ color: "#000", fontSize: 20, fontWeight: 900, lineHeight: "24px" }}>{data.title}</div>
          <div style={{ color: "rgba(0,0,0,0.64)", fontSize: 12, fontWeight: 500, lineHeight: "18px" }}>{data.meta}</div>
          {data.estimatedValue && (
            <div style={{ color: "rgba(0,0,0,0.87)", fontSize: 12, fontWeight: 500, lineHeight: "20px", marginTop: 4 }}>
              Estimated value: <span style={{ fontWeight: 700 }}>{data.estimatedValue}</span>
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "transparent", border: "none" }} />
    </div>
  );
}

function SectionNode({ data }: { data: CategoryNodeData }) {
  return <CategoryCard data={data} />;
}

function TypeGroupNode({ data }: { data: CategoryNodeData }) {
  return <CategoryCard data={data} />;
}

function ItemNode({
  data,
}: {
  data: {
    name: string;
    value: string;
    status?: string;
    imageSrc: string;
    kindLabel: string;
    detail?: string;
    isSelected: boolean;
    onClick: () => void;
  };
}) {
  return (
    <div
      onClick={data.onClick}
      style={{ cursor: "pointer", display: "flex", flexDirection: "column", fontFamily: FONT_FAMILY, gap: 8, width: 417 }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "transparent", border: "none" }} />
      <NodeTypeLabel selected={data.isSelected} selectedBackground="#4d2e0c">ASSET</NodeTypeLabel>
      <div style={{ alignItems: "center", display: "flex", gap: 16, width: data.isSelected ? 412 : 417 }}>
        <div
          style={{
            flexShrink: 0,
            height: 156,
            position: "relative",
            width: 88,
          }}
        >
          <img
            src={data.imageSrc}
            alt={data.name}
            style={{
              borderRadius: 16,
              boxShadow: data.isSelected ? "0 0 0 2px #804d13" : "none",
              display: "block",
              height: 156,
              objectFit: "cover",
              position: "relative",
              width: 88,
            }}
          />
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 17, minWidth: 0 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#804d13", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, lineHeight: "18px", textTransform: "uppercase" }}>
              {data.kindLabel}
            </div>
            <div style={{ color: "#000", fontSize: 20, fontWeight: 900, lineHeight: "24px" }}>{data.name}</div>
            {data.detail && (
              <div style={{ color: "rgba(0,0,0,0.64)", fontSize: 12, fontWeight: 500, lineHeight: "18px" }}>{data.detail}</div>
            )}
            {data.value && (
              <div style={{ color: "rgba(0,0,0,0.87)", fontSize: 12, fontWeight: 500, lineHeight: "20px" }}>
                Value: <span style={{ fontWeight: data.isSelected ? 700 : 500 }}>{data.value}</span>
              </div>
            )}
          </div>
          {!data.isSelected && data.status === "Valued" ? (
            <div style={{ alignItems: "center", color: "#15803d", display: "flex", fontSize: 12, fontWeight: 700, gap: 4, lineHeight: "18px" }}>
              <img src="/wealth-map/check-green.svg" alt="" aria-hidden="true" style={{ height: 12, width: 12 }} />
              Valued
            </div>
          ) : !data.isSelected && data.status ? (
            <div style={{ color: "rgba(0,0,0,0.64)", fontSize: 12, fontWeight: 700, lineHeight: "18px" }}>
              {data.status}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OwnershipNode({ data }: { data: { title: string; points: string[] } }) {
  const [expanded, setExpanded] = useState(false);
  const visiblePoints = expanded ? data.points : data.points.slice(0, 3);
  const hasMore = data.points.length > 3;

  return (
    <div style={{ fontFamily: FONT_FAMILY, maxWidth: 240 }}>
      <Handle type="target" position={Position.Left} style={{ background: "transparent", border: "none" }} />
      <div
        style={{
          background: "#ffffff",
          border: "0.8px solid rgba(0,0,0,0.08)",
          borderRadius: 8,
          padding: "8px 10px",
          boxShadow: "0 3px 6px rgba(30,28,24,0.06)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 10, color: "#111", marginBottom: 4 }}>{data.title}</div>
        {visiblePoints.map((point, i) => (
          <div key={i} style={{ fontSize: 9, color: "#666", lineHeight: "1.4", marginTop: 2, display: "flex", gap: 4 }}>
            <span style={{ flexShrink: 0 }}>•</span>
            <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{point}</span>
          </div>
        ))}
        {hasMore && (
          <div
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ fontSize: 9, color: "#8b6b3a", marginTop: 4, cursor: "pointer", fontWeight: 600 }}
          >
            {expanded ? "Show less" : `+${data.points.length - 3} more`}
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
  ownershipNode: OwnershipNode,
};

// --- Layout builder ---

const X_CLIENT = 0;
const X_SECTION = 560;
const X_TYPEGROUP = 1120;
const X_ITEM = 1680;
const SECTION_Y_SPACING = 176;
const TYPEGROUP_Y_SPACING = 176;
const ITEM_Y_SPACING = 224;

function buildFlowElements(
  data: GraphResponse,
  expandedSection: string | null,
  expandedTypeGroup: string | null,
  selectedItemId: string | null,
  onSectionClick: (sectionKey: string) => void,
  onTypeGroupClick: (typeGroupKey: string) => void,
  onItemClick: (itemId: string) => void,
  onProfileDetails: () => void,
  clientImageSrc?: string,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Client node
  const sectionKeys = Object.keys(data.sections) as (keyof typeof data.sections)[];
  const totalSectionHeight = (sectionKeys.length - 1) * SECTION_Y_SPACING;
  const clientY = totalSectionHeight / 2;

  const familyCategories = data.sections.familyAndOwnership.categories;
  const familyMemberCount = familyCategories.find((category) => category.slug === "family_members")?.members?.length ?? 0;

  nodes.push({
    id: "client",
    type: "clientNode",
    position: { x: X_CLIENT, y: clientY - 216 },
    data: {
      name: data.client.name,
      value: formatValue(data.client.adjustedValue, data.client.currency),
      imageSrc: clientImageSrc || "/wealth-map/uhnw-client.png",
      meta: `${familyMemberCount} Family Members · ${sectionKeys.length} Categories`,
      description:
        "Wealth spans businesses, investments, trusts and multiple geographies, with liquidity, concentration and succession being the most important areas to watch.",
      onProfileDetails,
    },
    draggable: false,
  });

  // Section nodes
  sectionKeys.forEach((key, i) => {
    const section = data.sections[key];
    const sectionValue = "adjustedValue" in section ? (section as { adjustedValue: number }).adjustedValue : 0;
    const categories = section.categories;
    const itemCount = categories.reduce(
      (total, category) => total + (category.items?.length ?? category.members?.length ?? 0),
      0,
    );
    const isExpanded = expandedSection === key;
    const sectionY = i * SECTION_Y_SPACING;

    nodes.push({
      id: `section-${key}`,
      type: "sectionNode",
      position: { x: X_SECTION, y: sectionY },
      data: {
        badge: SECTION_META[key].badge,
        title: SECTION_LABELS[key],
        meta: `${categories.length} Categories · ${itemCount} Assets`,
        estimatedValue: sectionValue ? formatValue(sectionValue, data.client.currency) : "",
        imageSrc: SECTION_IMAGES[key],
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

  // Category nodes (when a section is expanded)
  if (expandedSection) {
    const section = data.sections[expandedSection as keyof typeof data.sections];

    type DisplayItem = {
      id: string;
      name: string;
      value: number;
      status?: string;
      imageSrc: string;
      kindLabel: string;
      detail?: string;
    };
    type OwnershipDisplayItem = { id: string; title: string; points: string[] };
    type DisplayCategory = { slug: string; label: string; adjustedValue: number; items: DisplayItem[]; ownershipItems?: OwnershipDisplayItem[] };

    let categories: DisplayCategory[] = [];

    if (expandedSection === "financials" || expandedSection === "nonFinancials" || expandedSection === "liabilities") {
      const sec = section as { adjustedValue: number; categories: GraphCategory[] };
      categories = sec.categories.map((cat) => ({
        slug: cat.slug,
        label: cat.label,
        adjustedValue: cat.adjustedValue ?? 0,
        items: (cat.items ?? []).map((item) => {
          let imageSrc: string;
          if ("type" in item && item.type === "account") {
            imageSrc = "/wealth-map/bank-account.png";
          } else if ("type" in item && item.type === "liability") {
            const lt = (item as GraphLiabilityItem).liabilityType ?? "";
            imageSrc = getAssetImage(lt, item.name);
          } else if ("type" in item && item.type === "asset") {
            imageSrc = getAssetImage((item as GraphAssetItem).assetType ?? "", (item as GraphAssetItem).name);
          } else {
            imageSrc = "/wealth-map/holdings.png";
          }
          return {
            id: (item as { id: string }).id,
            name: (item as { name: string }).name,
            value: (item as { adjustedValue: number }).adjustedValue,
            status: (item as { status?: string }).status,
            imageSrc,
            kindLabel:
              "type" in item && item.type === "asset"
                ? formatNodeLabel((item as GraphAssetItem).assetType, "Asset")
                : "type" in item && item.type === "liability"
                  ? formatNodeLabel((item as GraphLiabilityItem).liabilityType, "Liability")
                  : "Account",
            detail: "type" in item && item.type === "account" ? (item as GraphAccountItem).institution : undefined,
          };
        }),
      }));
    } else if (expandedSection === "familyAndOwnership") {
      const fao = section as GraphFamilyAndOwnership;
      categories = fao.categories.map((cat) => {
        if (cat.slug === "family_members") {
          return {
            slug: cat.slug,
            label: cat.label,
            adjustedValue: 0,
            items: (cat.members ?? []).map((m) => ({
              id: String(m.id),
              name: m.name,
              value: m.adjustedValue,
              imageSrc: FAMILY_IMAGES[m.relationship?.toLowerCase()] ?? "/wealth-map/family.png",
              kindLabel: formatNodeLabel(m.partyType, "Person"),
              detail: formatNodeLabel(m.relationship, "Family member"),
            })),
          };
        } else if (cat.slug === "ownership_relationships") {
          return {
            slug: cat.slug,
            label: cat.label,
            adjustedValue: 0,
            items: [],
            ownershipItems: (cat.items ?? []).map((item, idx) => ({
              id: `ownership-${idx}`,
              title: (item as GraphOwnershipItem).title,
              points: (item as GraphOwnershipItem).points,
            })),
          };
        } else {
          return {
            slug: cat.slug,
            label: cat.label,
            adjustedValue: cat.adjustedValue ?? 0,
            items: (cat.items ?? []).map((item) => {
              const ci = item as unknown as GraphClientItem;
              let imageSrc = "/wealth-map/companies-spv.png";
              if (ci.partyType === "trust" || ci.partyType === "foundation" || ci.partyType === "estate") {
                imageSrc = "/wealth-map/trust-foundation.png";
              }
              return {
                id: String(ci.id),
                name: ci.name,
                value: ci.adjustedValue ?? 0,
                imageSrc,
                kindLabel: formatNodeLabel(ci.partyType, "Entity"),
                detail: ci.relationship ? formatNodeLabel(ci.relationship, "") : undefined,
              };
            }),
          };
        }
      });
    }

    const totalCatHeight = (categories.length - 1) * TYPEGROUP_Y_SPACING;
    const catStartY = clientY - totalCatHeight / 2;

    categories.forEach((cat, ci) => {
      const fullCatKey = `${expandedSection}:${cat.slug}`;
      const isCatExpanded = expandedTypeGroup === fullCatKey;
      const catY = catStartY + ci * TYPEGROUP_Y_SPACING;
      const itemCount = cat.ownershipItems ? cat.ownershipItems.length : cat.items.length;

      nodes.push({
        id: `typegroup-${fullCatKey}`,
        type: "typeGroupNode",
        position: { x: X_TYPEGROUP, y: catY },
        data: {
          badge: "CATEGORY",
          title: cat.label,
          meta: `${itemCount} Assets`,
          estimatedValue: cat.adjustedValue ? formatValue(cat.adjustedValue, data.client.currency) : "",
          imageSrc: CATEGORY_IMAGES[cat.slug] ?? "/wealth-map/holdings.png",
          isExpanded: isCatExpanded,
          onClick: () => onTypeGroupClick(fullCatKey),
        },
        draggable: false,
      });

      edges.push({
        id: `edge-section-${fullCatKey}`,
        source: `section-${expandedSection}`,
        target: `typegroup-${fullCatKey}`,
        type: "default",
        style: {
          stroke: "#b88555",
          strokeWidth: 1.4,
        },
        animated: false,
      });

      // Item nodes (when category is expanded)
      if (isCatExpanded) {
        if (cat.ownershipItems && cat.ownershipItems.length > 0) {
          const getOwnershipCardHeight = (item: { points: string[] }) => {
            const pointCount = item.points.length;
            const titleHeight = 18;
            const pointHeight = pointCount * 28;
            const padding = 20;
            const showMoreHeight = pointCount > 3 ? 18 : 0;
            return titleHeight + pointHeight + padding + showMoreHeight + 30;
          };

          const cardHeights = cat.ownershipItems.map(getOwnershipCardHeight);
          const totalItemHeight = cardHeights.reduce((sum, h) => sum + h, 0) + (cat.ownershipItems.length - 1) * 16;
          const itemStartY = catY + 23 - totalItemHeight / 2;

          let cumulativeY = 0;
          cat.ownershipItems.forEach((item, ii) => {
            const itemY = itemStartY + cumulativeY;
            cumulativeY += cardHeights[ii] + 16;

            nodes.push({
              id: `item-${item.id}`,
              type: "ownershipNode",
              position: { x: X_ITEM, y: itemY },
              data: {
                title: item.title,
                points: item.points,
              },
              draggable: false,
            });

            edges.push({
              id: `edge-typegroup-item-${item.id}`,
              source: `typegroup-${fullCatKey}`,
              target: `item-${item.id}`,
              type: "default",
              style: {
                stroke: "#b88555",
                strokeWidth: 1,
              },
              animated: false,
            });
          });
        } else {
          const totalItemHeight = (cat.items.length - 1) * ITEM_Y_SPACING;
          const itemStartY = catY + 23 - totalItemHeight / 2;

          cat.items.forEach((item, ii) => {
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
                kindLabel: item.kindLabel,
                detail: item.detail,
                isSelected: selectedItemId === item.id,
                onClick: () => onItemClick(item.id),
              },
              draggable: false,
            });

            edges.push({
              id: `edge-typegroup-item-${item.id}`,
              source: `typegroup-${fullCatKey}`,
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
      }
    });
  }

  return { nodes, edges };
}

// --- Inner Flow Component (needs ReactFlowProvider above it) ---

function WealthMapFlow({
  graphData,
  className,
  clientImageSrc,
  onProfileDetails,
}: {
  graphData: GraphResponse;
  className: string;
  clientImageSrc?: string;
  onProfileDetails: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>("financials");
  const [expandedTypeGroup, setExpandedTypeGroup] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const { fitView } = useReactFlow();

  const onSectionClick = useCallback(
    (sectionKey: string) => {
      setExpandedSection((prev) => {
        if (prev === sectionKey) return null;
        setExpandedTypeGroup(null);
        setSelectedItemId(null);
        return sectionKey;
      });
    },
    [],
  );

  const onTypeGroupClick = useCallback(
    (typeGroupKey: string) => {
      setSelectedItemId(null);
      setExpandedTypeGroup((prev) => (prev === typeGroupKey ? null : typeGroupKey));
    },
    [],
  );

  const onItemClick = useCallback((itemId: string) => {
    setSelectedItemId((previous) => (previous === itemId ? null : itemId));
  }, []);

  const { nodes: flowNodes, edges: flowEdges } = useMemo(
    () =>
      buildFlowElements(
        graphData,
        expandedSection,
        expandedTypeGroup,
        selectedItemId,
        onSectionClick,
        onTypeGroupClick,
        onItemClick,
        onProfileDetails,
        clientImageSrc,
      ),
    [graphData, expandedSection, expandedTypeGroup, selectedItemId, onSectionClick, onTypeGroupClick, onItemClick, onProfileDetails, clientImageSrc],
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
  }, [expandedSection, expandedTypeGroup, selectedItemId, fitView]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} style={{ fontFamily: FONT_FAMILY }}>
      <div className="wealth-map-screen-grid" aria-hidden="true" />
      <ReactFlow
        className="relative z-[1]"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesConnectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
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

export function SourceWealthChart({
  clientId,
  className = "",
  clientImageSrc,
  onProfileDetails,
}: {
  clientId: number | null;
  className?: string;
  clientImageSrc?: string;
  onProfileDetails: () => void;
}) {
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
      <WealthMapFlow graphData={graphData} className={className} clientImageSrc={clientImageSrc} onProfileDetails={onProfileDetails} />
    </ReactFlowProvider>
  );
}
