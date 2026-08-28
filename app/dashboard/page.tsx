"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { useGetCrmClientsQuery, useGetCrmAlertsQuery, useGetCrmMeetingsQuery, type CrmClient, type CrmAttentionItem, type CrmAlert, type CrmMeeting } from "../store/api";
import { getStoredAuthToken, getStoredAdvisorProfile } from "../lib/session";
import { apiRequest } from "../lib/apiClient";

const FILTER_TABS = ["All", "Task", "Meeting", "Portfolio", "Opportunities", "Requests"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

const ATTENTION_TYPE_MAP: Record<FilterTab, CrmAttentionItem["type"][] | null> = {
  All: null,
  Task: ["task"],
  Meeting: ["meeting"],
  Portfolio: ["portfolio"],
  Opportunities: ["opportunity"],
  Requests: ["request"],
};

export default function ClientsPage() {
  const router = useRouter();
  const [advisorName, setAdvisorName] = useState("");
  const [today, setToday] = useState("");
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showMeetingsModal, setShowMeetingsModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!getStoredAuthToken()) {
      router.replace("/auth");
      return;
    }
    const advisor = getStoredAdvisorProfile();
    if (advisor?.name) {
      setAdvisorName(advisor.name.split(" ")[0]);
    }
    setToday(new Date().toLocaleDateString("en-US", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }));
  }, [router]);

  const { data, isLoading, isError } = useGetCrmClientsQuery();
  const { data: alertsData } = useGetCrmAlertsQuery();
  const { data: meetingsData } = useGetCrmMeetingsQuery({ upcoming: true });

  const clients = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const alerts = alertsData?.results ?? [];
  const meetings = meetingsData?.results ?? [];

  const filteredClients = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const types = ATTENTION_TYPE_MAP[activeFilter];
    const list = types ? clients.filter((c) => c.attention_item && types.includes(c.attention_item.type)) : [...clients];
    return list.sort((a, b) => (priorityOrder[a.priority ?? "low"] ?? 2) - (priorityOrder[b.priority ?? "low"] ?? 2));
  }, [clients, activeFilter]);

  const displayClients = expanded ? filteredClients : filteredClients.slice(0, 4);

  const filterCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { All: clients.length, Task: 0, Meeting: 0, Portfolio: 0, Opportunities: 0, Requests: 0 };
    for (const c of clients) {
      if (!c.attention_item) continue;
      const t = c.attention_item.type;
      if (t === "task") counts.Task++;
      else if (t === "meeting") counts.Meeting++;
      else if (t === "portfolio") counts.Portfolio++;
      else if (t === "opportunity") counts.Opportunities++;
      else if (t === "request") counts.Requests++;
    }
    return counts;
  }, [clients]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F8F8F8" }}>
      <Sidebar />

      <main style={{ flex: 1, position: "relative", overflow: "hidden", padding: "48px 40px", marginLeft: 80 }}>
        <div style={{
          position: "absolute", inset: 0,
          // Exported from Figma 2486:7304.
          backgroundColor: "#F8F8F8",
          backgroundImage: "url('/dashboard-bg-glow.jpg')",
          backgroundSize: "cover", backgroundPosition: "top center", backgroundRepeat: "no-repeat",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            {today ? (
              <p style={{ color: "rgba(0,0,0,0.45)", fontSize: 14, fontFamily: "Satoshi Variable, sans-serif", fontWeight: 500, lineHeight: "21px", marginBottom: 4 }}>{today}</p>
            ) : null}
            <h1 style={{ fontSize: 38, fontWeight: 500, color: "black", lineHeight: "45.6px", margin: 0, fontFamily: "ButlerPro, serif" }}>
              Welcome{advisorName ? ` ${advisorName}` : ""}
            </h1>
          </div>

          {/* Two-column layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
            <div className="flex flex-col gap-4">
              {/* Client queue */}
              <div style={{
                flex: 1, background: "white",
                borderRadius: 24, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{ padding: "28px 28px 0" }}>
                  <div style={{ fontSize: 14, fontWeight: 400, color: "#475569", marginBottom: 4, fontFamily: "Satoshi, sans-serif", wordWrap: "break-word" }}>Today</div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    {isLoading ? "Loading..." : `${totalCount} clients needs your attention`}
                  </h2>
                </div>

                {/* Filter tabs */}
                <div style={{ display: "flex", gap: 8, padding: "16px 28px 20px", flexWrap: "wrap" }}>
                  {FILTER_TABS.map((tab) => {
                    const isActive = activeFilter === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => { setActiveFilter(tab); setExpanded(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 14px", borderRadius: 20,
                          border: isActive ? "none" : "1px solid rgba(0,0,0,0.10)",
                          background: isActive ? "#1a1a1a" : "white",
                          color: isActive ? "white" : "#374151",
                          fontSize: 13, fontWeight: 500, cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {tab}
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: isActive ? "rgba(255,255,255,0.7)" : "#6B7280",
                        }}>
                          {filterCounts[tab]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Client rows */}
                {isError && (
                  <div style={{ padding: "40px 28px", textAlign: "center", color: "#6B7280" }}>
                    Failed to load clients. Please try again.
                  </div>
                )}
                {isLoading && (
                  <div style={{ padding: "40px 28px", textAlign: "center", color: "#6B7280" }}>
                    Loading clients...
                  </div>
                )}
                {!isLoading && !isError && filteredClients.length === 0 && (
                  <div style={{ padding: "40px 28px", textAlign: "center", color: "#6B7280" }}>
                    No clients need attention right now.
                  </div>
                )}
                {displayClients.map((client, i) => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    isLast={i === displayClients.length - 1 && (expanded || filteredClients.length <= 4)}
                    onNavigate={(id) => router.push(`/client?clientId=${id}`)}
                  />
                ))}

                {/* Expand all */}
                {filteredClients.length > 4 && (
                  <div
                    onClick={() => setExpanded(!expanded)}
                    style={{
                      padding: "16px 28px",
                      display: "flex", justifyContent: "center", alignItems: "center", gap: 6,
                      cursor: "pointer", borderTop: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>
                      {expanded ? "Show less" : "Expand all"}
                    </span>
                    <svg
                      width="14" height="14" viewBox="0 0 14 14" fill="none"
                      style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                    >
                      <path d="M3 5.5L7 9.5L11 5.5" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
              {/* Market watch */}
              <MarketWatch />
            </div>

            {/* Right panels */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ManagedAssetsCard clients={clients} />
              <AlertsPanel alerts={alerts} onViewAll={() => setShowAlertsModal(true)} onCheckNow={(alert) => {
                const type = alert.type?.toLowerCase();
                if (type === "document" || type === "documents" && alert.client) {
                  router.push(`/client?clientId=${alert.client}&tab=documents`);
                } else if ((type === "chat" || type === "chats" || type === "message") && alert.client) {
                  router.push(`/chat?clientId=${alert.client}`);
                } else {
                  router.push("/apps");
                }
              }} />
              <MeetingsPanel meetings={meetings} onViewAll={() => setShowMeetingsModal(true)} onMeetingClick={(clientId) => router.push(`/client?clientId=${clientId}`)} />
            </div>
          </div>
        </div>
      </main>

      {showAlertsModal && (
        <ModalOverlay onClose={() => setShowAlertsModal(false)}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 20px" }}>All Alerts</h2>
          {alerts.length === 0 ? (
            <p style={{ fontSize: 14, color: "#6B7280", margin: 0 }}>No alerts</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
              {alerts.map((alert) => {
                const type = alert.type?.toLowerCase();
                const isDocType = type === "document" || type === "documents";
                const isChatType = type === "chat" || type === "chats" || type === "message";
                const isClickable = (isDocType || isChatType) && alert.client;
                const hasAction = isClickable || (alert.cta_url && alert.cta_text);
                const handleClick = () => {
                  setShowAlertsModal(false);
                  if (isDocType && alert.client) {
                    router.push(`/client?clientId=${alert.client}&tab=documents`);
                  } else if (isChatType && alert.client) {
                    router.push(`/chat?clientId=${alert.client}`);
                  } else {
                    router.push("/apps");
                  }
                };
                return (
                <div
                  key={alert.id}
                  onClick={hasAction ? handleClick : undefined}
                  style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: hasAction ? "pointer" : undefined, borderRadius: 8, padding: "16px 24px", transition: "background 0.15s", background: "#00000005" }}
                  onMouseEnter={hasAction ? (e) => (e.currentTarget.style.background = "rgba(0,0,0,0.03)") : undefined}
                  onMouseLeave={hasAction ? (e) => (e.currentTarget.style.background = "#00000005") : undefined}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                    background: (alert.cta_url && alert.cta_text && !isClickable) ? "#7F67B7" : "#39952D",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "black" }}>{alert.title}</div>
                    <div style={{ fontSize: 12, color: "rgba(33,37,37,0.70)", marginTop: 2 }}>
                      {alert.client_name ? `${alert.client_name} • ` : ""}{timeAgo(alert.created_at)}
                    </div>
                    {alert.cta_url && alert.cta_text && !isClickable && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#804D13", fontFamily: "Satoshi Variable, sans-serif", marginTop: 4, display: "inline-block" }}>
                        {alert.cta_text}
                      </span>
                    )}
                  </div>
                </div>
                );})}
            </div>
          )}
        </ModalOverlay>
      )}

      {showMeetingsModal && (
        <ModalOverlay onClose={() => setShowMeetingsModal(false)}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 20px" }}>All Upcoming Meetings</h2>
          {meetings.length === 0 ? (
            <p style={{ fontSize: 14, color: "#6B7280", margin: 0 }}>No upcoming meetings</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto" }}>
              {meetings.map((meeting, i) => {
                const d = new Date(meeting.scheduled_at);
                const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const isFirst = i === 0;
                const isClickable = meeting.client != null;
                return (
                  <div
                    key={meeting.id}
                    onClick={isClickable ? () => { setShowMeetingsModal(false); router.push(`/client?clientId=${meeting.client}`); } : undefined}
                    style={{
                      borderRadius: 16, padding: 16,
                      backgroundImage: isFirst ? "url('/insights.png')" : "linear-gradient(#FFFFFFE5, #FFFFFFE5), url('/insights.png')",
                      backgroundSize: "cover", backgroundPosition: "center",
                      backgroundColor: isFirst ? undefined : "#CA8C4626",
                      display: "flex", alignItems: "center", gap: 12,
                      cursor: isClickable ? "pointer" : "default",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: isFirst ? "#FDE5C3" : "#CA8C4626",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <MeetingIcon title={meeting.title} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{meeting.title}</div>
                      {meeting.client_name && (
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{meeting.client_name}</div>
                      )}
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                        {dateStr} • {timeStr} • {meeting.duration_minutes} min
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ModalOverlay>
      )}
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
        padding: "18px 28px",
        borderBottom: isLast ? "none" : "1px solid #F1F1F1",
        background: "white",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
    >
      <div style={{ flex: "0 0 240px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          backgroundImage: "linear-gradient(#FFFFFFB2, #FFFFFFB2), url('/insights.png')",
          backgroundSize: "cover", backgroundPosition: "center",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#4C2D08" }}>{initials}</span>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{client.display_name}</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
            Net worth <strong style={{ color: "#111827" }}>{netWorth}</strong>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
        {attention && (
          <>
            <AttentionIcon type={attention.type} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#090D1A", lineHeight: "20px" }}>{attention.title}</div>
              <div style={{ fontSize: 12, color: "#6B7280", lineHeight: "18px" }}>{attention.subtitle}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ flex: "0 0 80px", display: "flex", justifyContent: "center" }}>
        <span style={{
          padding: "4px 8px", borderRadius: 6,
          background: priorityStyle.bg, color: priorityStyle.color,
          fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.8px",
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
  const iconType = type === "meeting" || type === "task" ? "meeting" : "message";
  const s = ATTENTION_ICON_STYLES[iconType];
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {iconType === "meeting" && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2.5" width="12" height="10.5" rx="1.5" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M1 5.5H13" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M4.5 1V3.5M9.5 1V3.5" stroke={s.stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
      {iconType === "message" && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 2.5C1 1.94772 1.44772 1.5 2 1.5H12C12.5523 1.5 13 1.94772 13 2.5V9.5C13 10.0523 12.5523 10.5 12 10.5H2C1.44772 10.5 1 10.0523 1 9.5V2.5Z" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M1.5 2.5L7 7L12.5 2.5" stroke={s.stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

function timeAgo(isoDate: string): string {
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function AlertsPanel({ alerts, onViewAll, onCheckNow }: { alerts: CrmAlert[]; onViewAll: () => void; onCheckNow: (alert: CrmAlert) => void }) {
  return (
    <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.10)", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Alerts</h3>
        <button onClick={onViewAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#804D13", fontFamily: "Satoshi Variable, sans-serif", lineHeight: "100%" }}>View all</button>
      </div>

      {alerts.length === 0 ? (
        <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", padding: "16px 0", margin: 0 }}>No alerts</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.slice(0, 3).map((alert) => {
            const type = alert.type?.toLowerCase();
            const isDocType = type === "document" || type === "documents";
            const isChatType = type === "chat" || type === "chats" || type === "message";
            const isClickable = (isDocType || isChatType) && alert.client;
            const hasAction = isClickable || (alert.cta_url && alert.cta_text);
            return (
              <div
                key={alert.id}
                onClick={hasAction ? () => onCheckNow(alert) : undefined}
                style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: hasAction ? "pointer" : undefined, borderRadius: 8, padding: "16px 24px", transition: "background 0.15s", background: "#00000005" }}
                onMouseEnter={hasAction ? (e) => (e.currentTarget.style.background = "rgba(0,0,0,0.03)") : undefined}
                onMouseLeave={hasAction ? (e) => (e.currentTarget.style.background = "#00000005") : undefined}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                  background: (alert.cta_url && alert.cta_text && !isClickable) ? "#7F67B7" : "#39952D",
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "black" }}>{alert.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(33,37,37,0.70)", marginTop: 2 }}>
                    {alert.client_name ? `${alert.client_name} • ` : ""}{timeAgo(alert.created_at)}
                  </div>
                  {alert.cta_url && alert.cta_text && !isClickable && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#804D13", fontFamily: "Satoshi Variable, sans-serif", marginTop: 4, display: "inline-block" }}>
                      {alert.cta_text}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MeetingsPanel({ meetings, onViewAll, onMeetingClick }: { meetings: CrmMeeting[]; onViewAll: () => void; onMeetingClick: (clientId: number) => void }) {
  return (
    <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.10)", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Upcoming meetings</h3>
        <button onClick={onViewAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#804D13", fontFamily: "Satoshi Variable, sans-serif", lineHeight: "100%" }}>View all</button>
      </div>
      {meetings.length === 0 ? (
        <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", padding: "16px 0", margin: 0 }}>No upcoming meetings</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {meetings.slice(0, 3).map((meeting, i) => {
            const d = new Date(meeting.scheduled_at);
            const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const isFirst = i === 0;
            const isClickable = meeting.client != null;
            return (
              <div
                key={meeting.id}
                onClick={isClickable ? () => onMeetingClick(meeting.client!) : undefined}
                style={{
                  borderRadius: 16, padding: 16,
                  backgroundImage: isFirst ? "url('/insights.png')" : "linear-gradient(#FFFFFFE5, #FFFFFFE5), url('/insights.png')",
                  backgroundSize: "cover", backgroundPosition: "center",
                  backgroundColor: isFirst ? undefined : "#CA8C4626",
                  display: "flex", alignItems: "center", gap: 12,
                  cursor: isClickable ? "pointer" : "default",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: isFirst ? "#FDE5C3" : "#CA8C4626",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <MeetingIcon title={meeting.title} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{meeting.title}</div>
                  {meeting.client_name && (
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{meeting.client_name}</div>
                  )}
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                    {dateStr} • {timeStr} • {meeting.duration_minutes} min
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MeetingIcon({ title }: { title: string }) {
  const t = title.toLowerCase();
  if (t.includes("portfolio")) {
    return (
      <svg width="22" height="20" viewBox="0 0 22 20" fill="none">
        <path d="M15.0011 19V3C15.0011 2.46957 14.7904 1.96086 14.4153 1.58579C14.0402 1.21071 13.5314 1 13.001 1H9.00064C8.47016 1 7.96142 1.21071 7.58631 1.58579C7.21121 1.96086 7.00048 2.46957 7.00048 3V19M3.00016 5H19.0014C20.1061 5 21.0016 5.89543 21.0016 7V17C21.0016 18.1046 20.1061 19 19.0014 19H3.00016C1.8955 19 1 18.1046 1 17V7C1 5.89543 1.8955 5 3.00016 5Z" stroke="black" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (t.includes("onboard") || t.includes("new client")) {
    return (
      <svg width="22" height="20" viewBox="0 0 22 20" fill="none">
        <path d="M15.0011 19V17C15.0011 15.9391 14.5797 14.9217 13.8295 14.1716C13.0792 13.4214 12.0618 13 11.0008 13H5.00032C3.93937 13 2.92187 13.4214 2.17167 14.1716C1.42146 14.9217 1 15.9391 1 17V19M18.0014 6V12M21.0016 9H15.0011M12.0009 5C12.0009 7.20914 10.2099 9 8.00056 9C5.79124 9 4.00024 7.20914 4.00024 5C4.00024 2.79086 5.79124 1 8.00056 1C10.2099 1 12.0009 2.79086 12.0009 5Z" stroke="black" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
      <path d="M1 19V13M8.0008 19V1M15.0016 19V7" stroke="black" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ManagedAssetsCard({ clients }: { clients: CrmClient[] }) {
  const totalAssets = useMemo(() => {
    let sum = 0;
    for (const c of clients) {
      if (c.net_worth) {
        const num = parseFloat(c.net_worth);
        if (!isNaN(num)) sum += num;
      }
    }
    return sum;
  }, [clients]);

  const formatted = totalAssets >= 1_000_000_000
    ? `$${(totalAssets / 1_000_000_000).toFixed(2)}B`
    : totalAssets >= 1_000_000
    ? `$${(totalAssets / 1_000_000).toFixed(2)}M`
    : totalAssets >= 1_000
    ? `$${(totalAssets / 1_000).toFixed(0)}K`
    : `$${totalAssets.toFixed(0)}`;

  return (
    <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.08)", padding: "28px" }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(0,0,0,0.40)", letterSpacing: "1.44px", textTransform: "uppercase", margin: "0 0 8px", fontFamily: "Satoshi Variable, sans-serif", wordWrap: "break-word" }}>
        Managed assets
      </p>
      <p style={{ fontSize: 28, fontWeight: 500, color: "#111111", margin: "0 0 8px", fontFamily: "Satoshi Variable, sans-serif", wordWrap: "break-word" }}>
        {formatted}
      </p>
      {/* <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
          <path d="M5.9992 5.9992V1H1M5.9992 1L1 5.9992" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#10B981", fontFamily: "Satoshi Variable, sans-serif", wordWrap: "break-word" }}>
          $0.25B | 7.14% MTD
        </span>
      </div> */}
    </div>
  );
}

type PriceHistoryTicker = {
  ticker: string;
  prices: { date: string; close: number }[];
};

const TICKER_LABELS: Record<string, string> = {
  SPY: "S&P Futures",
  DIA: "Dow Futures",
  QQQ: "NASDAQ Fut.",
};

type MarketCardData = {
  name: string;
  value: string;
  change: string;
  delta: string;
  color: string;
  points: number[];
};

function buildMarketCards(tickers: PriceHistoryTicker[]): MarketCardData[] {
  return tickers.map((t) => {
    const prices = t.prices.map((p) => p.close);
    if (prices.length < 2) {
      return {
        name: TICKER_LABELS[t.ticker] ?? t.ticker,
        value: prices.length > 0 ? `$${prices[prices.length - 1].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-",
        change: "-",
        delta: "-",
        color: "#6B7280",
        points: prices,
      };
    }
    const latest = prices[prices.length - 1];
    const first = prices[0];
    const diff = latest - first;
    const pct = ((diff / first) * 100).toFixed(2);
    const isPositive = diff >= 0;
    return {
      name: TICKER_LABELS[t.ticker] ?? t.ticker,
      value: `$${latest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: `${Math.abs(Number(pct)).toFixed(2)}%`,
      delta: `${isPositive ? "+" : "-"} $${Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      color: isPositive ? "#1B7A3D" : "#9B1B1B",
      points: prices,
    };
  });
}

function MarketWatch() {
  const [cards, setCards] = useState<MarketCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const from = new Date(today);
    from.setMonth(from.getMonth() - 1);
    const toStr = today.toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);

    apiRequest<{ history: Record<string, Record<string, number>> }>(
      `/price-history/?tickers=SPY,DIA,QQQ&from=${fromStr}&to=${toStr}`,
    )
      .then((raw) => {
        if (cancelled) return;
        const history = raw?.history;
        if (!history || typeof history !== "object") {
          setCards([]);
          return;
        }
        const data: PriceHistoryTicker[] = Object.entries(history).map(([ticker, datePrices]) => ({
          ticker,
          prices: Object.entries(datePrices)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, close]) => ({ date, close })),
        }));
        setCards(buildMarketCards(data));
      })
      .catch((err) => {
        console.error("MarketWatch: Failed to load price history:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.08)", padding: "28px", marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 20px", fontFamily: "Satoshi Variable, sans-serif", wordWrap: "break-word" }}>Market watch</h2>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.45)", fontFamily: "Satoshi Variable, sans-serif" }}>Loading...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.08)", padding: "28px", marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 20px", fontFamily: "Satoshi Variable, sans-serif", wordWrap: "break-word" }}>Market watch</h2>
        <p style={{ fontSize: 13, color: "rgba(0,0,0,0.45)", fontFamily: "Satoshi Variable, sans-serif" }}>No market data available.</p>
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.08)", padding: "28px", marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 20px", fontFamily: "Satoshi Variable, sans-serif", wordWrap: "break-word" }}>Market watch</h2>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cards.length, 4)}, 1fr)`, gap: 16 }}>
        {cards.map((item) => (
          <div key={item.name} style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", padding: "16px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#27251E", fontFamily: "Satoshi Variable, sans-serif", lineHeight: "20px" }}>{item.name}</span>
              <span style={{ fontSize: 14, fontWeight: 400, color: item.color, lineHeight: "20px" }}>{item.change}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(0,0,0,0.45)", fontFamily: "Satoshi Variable, sans-serif", lineHeight: "16px" }}>{item.value}</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(0,0,0,0.45)", fontFamily: "Satoshi Variable, sans-serif", lineHeight: "16px" }}>{item.delta}</span>
            </div>
            <Sparkline points={item.points} color={item.color} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 200;
  const h = 48;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const midVal = (points[0] + points[points.length - 1]) / 2;
  const midY = h - ((midVal - min) / range) * (h - 8) - 4;
  const uid = `sp-${color.replace("#", "")}-${points.length}`;

  const pathD = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const areaD = `${pathD} L${w},${h} L0,${h} Z`;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`${uid}-green`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B7A3D" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#1B7A3D" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id={`${uid}-red`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9B1B1B" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#9B1B1B" stopOpacity="0.15" />
        </linearGradient>
        <clipPath id={`${uid}-above`}>
          <rect x="0" y="0" width={w} height={midY} />
        </clipPath>
        <clipPath id={`${uid}-below`}>
          <rect x="0" y={midY} width={w} height={h - midY} />
        </clipPath>
      </defs>
      <line x1="0" y1={midY} x2={w} y2={midY} stroke="rgba(0,0,0,0.12)" strokeWidth="1" strokeDasharray="4 3" />
      <path d={areaD} fill={`url(#${uid}-green)`} clipPath={`url(#${uid}-above)`} />
      <path d={pathD} fill="none" stroke="#1B7A3D" strokeWidth="1.5" clipPath={`url(#${uid}-above)`} />
      <path d={pathD} fill="none" stroke="#9B1B1B" strokeWidth="1.5" clipPath={`url(#${uid}-below)`} />
    </svg>
  );
}



function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 24, padding: 32,
          width: 480, maxWidth: "90vw", maxHeight: "80vh",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}


const PRIORITY_STYLES = {
  high: { bg: "#FFF0EB", color: "#D92206" },
  medium: { bg: "#E8F0FF", color: "#385CAB" },
  low: { bg: "#E5F7EB", color: "#218C47" },
};

const ATTENTION_ICON_STYLES = {
  meeting: { bg: "rgba(239,68,68,0.08)", stroke: "#EF4444" },
  message: { bg: "#F9EFDE", stroke: "#804D13" },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", SGD: "S$", JPY: "¥", AUD: "A$", CAD: "C$",
};
