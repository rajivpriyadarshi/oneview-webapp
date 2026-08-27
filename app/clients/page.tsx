"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { useGetCrmClientsQuery, type CrmClient, type CrmAttentionItem } from "../store/api";
import { getStoredAuthToken } from "../lib/session";

const SORT_OPTIONS = ["All priorities", "High", "Medium", "Low"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

export default function ClientsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("All priorities");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  useEffect(() => {
    if (!getStoredAuthToken()) {
      router.replace("/auth");
    }
  }, [router]);

  const { data, isLoading, isError } = useGetCrmClientsQuery();

  const allClients = data?.results ?? [];
  const clients = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    let list = allClients;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = allClients.filter((c) => c.display_name.toLowerCase().includes(q));
    }
    if (sortBy !== "All priorities") {
      const filterPriority = sortBy.toLowerCase();
      list = list.filter((c) => (c.priority ?? "low") === filterPriority);
    }
    return [...list].sort((a, b) => (priorityOrder[a.priority ?? "low"] ?? 2) - (priorityOrder[b.priority ?? "low"] ?? 2));
  }, [allClients, searchQuery, sortBy]);
  const totalCount = data?.count ?? 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F8F8F8" }}>
      <Sidebar />

      <main style={{ flex: 1, position: "relative", overflow: "hidden", padding: "48px 40px", marginLeft: 80 }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('/dashboard-bg.png')",
          backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 42, fontWeight: 600, color: "#000000", lineHeight: "50.4px", margin: 0, fontFamily: "ButlerPro, serif" }}>Client list</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 16, outline: "1px solid #E5E7EB", outlineOffset: -1, padding: "12px 20px" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="#4B5563" strokeWidth="2" />
              <path d="M14 14L17.5 17.5" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search a client"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: 15, color: "#111827", background: "transparent", width: 300, fontFamily: "Satoshi, sans-serif" }}
            />
          </div>
        </div>

        <div style={{
          background: "white",
          borderRadius: 24, border: "1px solid rgba(0,0,0,0.10)", overflow: "hidden",
        }}>
          <div style={{ padding: "24px 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: 0 }}>Client list</h2>
              <p style={{ fontSize: 14, color: "#475569", margin: "4px 0 0" }}>
                {isLoading ? "Loading..." : `${totalCount} clients need your attention`}
              </p>
            </div>
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <span style={{ fontSize: 14, color: "#4B5563" }}>Sort:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{sortBy}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showSortDropdown ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {showSortDropdown && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 8,
                  background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.10)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)", overflow: "hidden", zIndex: 10, minWidth: 160,
                }}>
                  {SORT_OPTIONS.map((option) => (
                    <div
                      key={option}
                      onClick={() => { setSortBy(option); setShowSortDropdown(false); }}
                      style={{
                        padding: "10px 16px", fontSize: 14, cursor: "pointer",
                        color: sortBy === option ? "#111827" : "#4B5563",
                        fontWeight: sortBy === option ? 700 : 400,
                        background: sortBy === option ? "rgba(0,0,0,0.04)" : "white",
                      }}
                      onMouseEnter={(e) => { if (sortBy !== option) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                      onMouseLeave={(e) => { if (sortBy !== option) e.currentTarget.style.background = "white"; }}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{
            display: "flex", gap: 16, padding: "4px 24px",
            background: "rgba(229,231,235,0.16)", borderBottom: "1px solid rgba(0,0,0,0.08)",
          }}>
            <div style={{ flex: "0 0 260px" }}>
              <span style={colHeaderStyle}>Client</span>
            </div>
            <div style={{ flex: 1 }}>
              <span style={colHeaderStyle}>Needs attention</span>
            </div>
            <div style={{ flex: "0 0 100px", textAlign: "center" as const }}>
              <span style={colHeaderStyle}>Priority</span>
            </div>
            <div style={{ flex: "0 0 40px" }} />
          </div>

          {isError && (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "#6B7280" }}>
              Failed to load clients. Please try again.
            </div>
          )}
          {isLoading && (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "#6B7280" }}>
              Loading clients...
            </div>
          )}
          {!isLoading && !isError && clients.length === 0 && (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "#6B7280" }}>
              No clients need attention right now.
            </div>
          )}
          {clients.map((client, i) => (
            <ClientRow
              key={client.id}
              client={client}
              isLast={i === clients.length - 1}
              onNavigate={(id) => router.push(`/client?clientId=${id}`)}
            />
          ))}
        </div>
        </div>
      </main>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatNetWorth(amount: string | null, currency: string | null): string {
  if (!amount) return "—";
  const num = parseFloat(amount);
  if (isNaN(num)) return "—";
  const symbol = CURRENCY_SYMBOLS[currency ?? ""] ?? (currency ?? "");
  if (num >= 1_000_000_000) return `${symbol}${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${symbol}${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${symbol}${(num / 1_000).toFixed(0)}K`;
  return `${symbol}${num.toFixed(0)}`;
}

function ClientRow({ client, isLast, onNavigate }: { client: CrmClient; isLast: boolean; onNavigate: (id: number) => void }) {
  const initials = getInitials(client.display_name);
  const netWorth = formatNetWorth(client.net_worth, client.net_worth_currency);
  const attention = client.attention_item;
  const priority = client.priority ?? "low";
  const priorityStyle = PRIORITY_STYLES[priority];

  return (
    <div
      onClick={() => onNavigate(client.id)}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "20px 24px",
        borderBottom: isLast ? "none" : "1px solid #E5E7EB",
        background: "white",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
    >
      <div style={{ flex: "0 0 260px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          backgroundImage: "linear-gradient(#FFFFFFB2, #FFFFFFB2), url('/insights.png')",
          backgroundSize: "cover", backgroundPosition: "center",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#4C2D08" }}>{initials}</span>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{client.display_name}</div>
          <div style={{ fontSize: 14, color: "#4B5563", marginTop: 2 }}>
            Net worth <strong>{netWorth}</strong>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
        {attention ? (
          <>
            <AttentionIcon type={attention.type} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#090D1A", lineHeight: "20px" }}>{attention.title}</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: "18px" }}>{attention.subtitle}</div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, color: "#6B7280" }}>No recent activity</div>
        )}
      </div>

      <div style={{ flex: "0 0 100px", display: "flex", justifyContent: "center" }}>
        <span style={{
          padding: "4px 6px", borderRadius: 6,
          background: priorityStyle.bg, color: priorityStyle.color,
          fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1.15px",
        }}>
          {priority}
        </span>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onNavigate(client.id); }}
        style={{
          flex: "0 0 32px", width: 32, height: 32, borderRadius: "50%",
          border: "1px solid rgba(0,0,0,0.08)", background: "white",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 12L12 4M12 4H6M12 4V10" stroke="rgba(0,0,0,0.70)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function AttentionIcon({ type }: { type: CrmAttentionItem["type"] }) {
  const s = ATTENTION_ICON_STYLES[type] ?? ATTENTION_ICON_STYLES.message;
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {(type === "meeting" || type === "task") && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2.5" width="12" height="10.5" rx="1.5" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M1 5.5H13" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M4.5 1V3.5M9.5 1V3.5" stroke={s.stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
      {type === "portfolio" && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="3" width="12" height="9" rx="1.5" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M5 3V2.5C5 1.94772 5.44772 1.5 6 1.5H8C8.55228 1.5 9 1.94772 9 2.5V3" stroke={s.stroke} strokeWidth="1.2" />
        </svg>
      )}
      {(type === "message" || type === "opportunity" || type === "request") && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 2.5C1 1.94772 1.44772 1.5 2 1.5H12C12.5523 1.5 13 1.94772 13 2.5V9.5C13 10.0523 12.5523 10.5 12 10.5H2C1.44772 10.5 1 10.0523 1 9.5V2.5Z" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M1.5 2.5L7 7L12.5 2.5" stroke={s.stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

const colHeaderStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "rgba(116,116,126,0.70)",
  textTransform: "uppercase", letterSpacing: "1.2px",
};

const PRIORITY_STYLES = {
  high: { bg: "#FFF0EB", color: "#D92206" },
  medium: { bg: "#E8F0FF", color: "#385CAB" },
  low: { bg: "#E5F7EB", color: "#218C47" },
};

const ATTENTION_ICON_STYLES: Record<string, { bg: string; stroke: string }> = {
  meeting: { bg: "rgba(239,68,68,0.08)", stroke: "#EF4444" },
  task: { bg: "rgba(239,68,68,0.08)", stroke: "#EF4444" },
  portfolio: { bg: "rgba(107,114,128,0.07)", stroke: "#475569" },
  opportunity: { bg: "#F9EFDE", stroke: "#804D13" },
  request: { bg: "#F9EFDE", stroke: "#804D13" },
  message: { bg: "#F9EFDE", stroke: "#804D13" },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", SGD: "S$", JPY: "¥", AUD: "A$", CAD: "C$",
};
