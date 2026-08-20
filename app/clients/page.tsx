"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { useGetCrmClientsQuery, useGetCrmAlertsQuery, useGetCrmMeetingsQuery, type CrmClient, type CrmAlert, type CrmMeeting } from "../store/api";
import { getStoredAuthToken, getStoredAdvisorProfile } from "../lib/session";

export default function ClientsPage() {
  const router = useRouter();
  const [advisorName, setAdvisorName] = useState("");

  useEffect(() => {
    if (!getStoredAuthToken()) {
      router.replace("/auth");
      return;
    }
    const advisor = getStoredAdvisorProfile();
    if (advisor?.name) {
      setAdvisorName(advisor.name.split(" ")[0]);
    }
  }, [router]);

  const { data, isLoading, isError } = useGetCrmClientsQuery();
  const { data: alertsData } = useGetCrmAlertsQuery();
  const { data: meetingsData } = useGetCrmMeetingsQuery({ upcoming: true });

  const clients = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const alerts = alertsData?.results ?? [];
  const meetings = meetingsData?.results ?? [];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f7f6f3" }}>
      <Sidebar />

      <main style={{ flex: 1, position: "relative", overflow: "hidden", padding: "48px 40px", marginLeft: 80 }}>
        {/* Warm gradient blobs */}
        <div style={{
          position: "absolute", top: -115, left: 0, width: "80%", height: 561,
          background: "linear-gradient(180deg, rgba(255,241,163,0.80) 0%, rgba(255,241,163,0.80) 50%, rgba(255,178,134,0.80) 75%, rgba(255,111,50,0.80) 100%)",
          filter: "blur(82px)", opacity: 0.4, pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{
          position: "absolute", bottom: -150, right: -100, width: "80%", height: 561,
          background: "linear-gradient(180deg, rgba(255,241,163,0.80) 0%, rgba(255,241,163,0.80) 50%, rgba(255,178,134,0.80) 75%, rgba(255,111,50,0.80) 100%)",
          filter: "blur(82px)", opacity: 0.4, transform: "rotate(180deg)", pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ color: "rgba(0,0,0,0.45)", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{today}</p>
            <h1 style={{ fontSize: 38, fontWeight: 500, color: "#0a0a0a", lineHeight: 1.2, margin: 0 }}>
              Welcome{advisorName ? ` ${advisorName}` : ""}
            </h1>
          </div>

          {/* Two-column layout */}
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            {/* Client queue */}
            <div style={{
              flex: 1, background: "white",
              borderRadius: 24, border: "1px solid rgba(0,0,0,0.10)", overflow: "hidden",
            }}>
              <div style={{ padding: "24px 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: 0 }}>Client queue</h2>
                  <p style={{ fontSize: 14, color: "#475569", margin: "4px 0 0" }}>
                    {isLoading ? "Loading..." : `${totalCount} clients need your attention`}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, color: "#4B5563" }}>Sort:</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>All priorities</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#111827" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Column headers */}
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

            {/* Right panels */}
            <div style={{ flex: "0 0 360px", display: "flex", flexDirection: "column", gap: 16 }}>
              <AlertsPanel alerts={alerts} />
              <MeetingsPanel meetings={meetings} />
            </div>
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

function getAttention(client: CrmClient): { title: string; subtitle: string; type: "meeting" | "message" } {
  if (client.upcoming_meeting_at) {
    const d = new Date(client.upcoming_meeting_at);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return { title: `Upcoming meeting on ${dateStr}`, subtitle: `Prepare for ${timeStr} meeting`, type: "meeting" };
  }
  if (client.last_interaction_at) {
    const d = new Date(client.last_interaction_at);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { title: `Last interaction on ${dateStr}`, subtitle: "Review and follow up", type: "message" };
  }
  return { title: "No recent activity", subtitle: "Schedule a touchpoint", type: "message" };
}

function getPriority(client: CrmClient): "high" | "medium" | "low" {
  if (!client.upcoming_meeting_at) return "low";
  const daysUntil = (new Date(client.upcoming_meeting_at).getTime() - Date.now()) / 86_400_000;
  if (daysUntil <= 2) return "high";
  if (daysUntil <= 7) return "medium";
  return "low";
}

function ClientRow({ client, isLast, onNavigate }: { client: CrmClient; isLast: boolean; onNavigate: (id: number) => void }) {
  const initials = getInitials(client.display_name);
  const netWorth = formatNetWorth(client.net_worth, client.net_worth_currency);
  const attention = getAttention(client);
  const priority = getPriority(client);
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
          background: "linear-gradient(0deg, rgba(255,255,255,0.70), rgba(255,255,255,0.70)), #E1DEF8",
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
        <AttentionIcon type={attention.type} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#090D1A", lineHeight: "20px" }}>{attention.title}</div>
          <div style={{ fontSize: 12, color: "#475569", lineHeight: "18px" }}>{attention.subtitle}</div>
        </div>
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

function AttentionIcon({ type }: { type: "meeting" | "message" }) {
  const s = ATTENTION_ICON_STYLES[type];
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {type === "meeting" && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2.5" width="12" height="10.5" rx="1.5" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M1 5.5H13" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M4.5 1V3.5M9.5 1V3.5" stroke={s.stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
      {type === "message" && (
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

function AlertsPanel({ alerts }: { alerts: CrmAlert[] }) {
  return (
    <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.10)", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Alerts</h3>
        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.50)" }}>View all</button>
      </div>

      {alerts.length === 0 ? (
        <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", padding: "16px 0", margin: 0 }}>No alerts</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {alerts.map((alert) => (
            <div key={alert.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                background: alert.client ? "#39952D" : "#3B82F6",
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "black" }}>{alert.title}</div>
                <div style={{ fontSize: 12, color: "rgba(33,37,37,0.70)", marginTop: 2 }}>
                  {alert.client_name ? `${alert.client_name} • ` : ""}{timeAgo(alert.created_at)}
                </div>
                {alert.cta_url && alert.cta_text && (
                  <a
                    href={alert.cta_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, fontWeight: 600, color: "#3B82F6", textDecoration: "none", marginTop: 4, display: "inline-block" }}
                  >
                    {alert.cta_text}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingsPanel({ meetings }: { meetings: CrmMeeting[] }) {
  return (
    <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.10)", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Upcoming meetings</h3>
        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.50)" }}>View all</button>
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
            return (
              <div key={meeting.id} style={{
                borderRadius: 16, padding: 16,
                background: isFirst ? "linear-gradient(135deg, #c9a84c 0%, #8a5a1e 100%)" : "rgba(0,0,0,0.03)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: isFirst ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 13.5V9M7 13.5V6M11 13.5V10.5M15 13.5V4.5"
                      stroke={isFirst ? "white" : "#475569"} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isFirst ? "white" : "#0F172A" }}>{meeting.title}</div>
                  {meeting.client_name && (
                    <div style={{ fontSize: 12, color: isFirst ? "rgba(255,255,255,0.80)" : "#475569", marginTop: 2 }}>{meeting.client_name}</div>
                  )}
                  <div style={{ fontSize: 12, color: isFirst ? "rgba(255,255,255,0.80)" : "#475569", marginTop: 2 }}>
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

const colHeaderStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "rgba(116,116,126,0.70)",
  textTransform: "uppercase", letterSpacing: "1.2px",
};

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
