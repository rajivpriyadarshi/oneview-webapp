"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { useGetCrmClientsQuery, useGetCrmAlertsQuery, useGetCrmMeetingsQuery, type CrmClient, type CrmAlert, type CrmMeeting } from "../store/api";
import { getStoredAuthToken, getStoredAdvisorProfile } from "../lib/session";

export default function ClientsPage() {
  const router = useRouter();
  const [advisorName, setAdvisorName] = useState("");
  const [today, setToday] = useState("");
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showMeetingsModal, setShowMeetingsModal] = useState(false);

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
            {today ? (
              <p style={{ color: "rgba(0,0,0,0.45)", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{today}</p>
            ) : null}
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
              <MeetingsPanel meetings={meetings} onViewAll={() => setShowMeetingsModal(true)} />
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
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 400, overflowY: "auto" }}>
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
                  style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: hasAction ? "pointer" : undefined, borderRadius: 8, padding: 8, transition: "background 0.15s" }}
                  onMouseEnter={hasAction ? (e) => (e.currentTarget.style.background = "rgba(0,0,0,0.03)") : undefined}
                  onMouseLeave={hasAction ? (e) => (e.currentTarget.style.background = "transparent") : undefined}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                    background: alert.client ? "#39952D" : "#3B82F6",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "black" }}>{alert.title}</div>
                    <div style={{ fontSize: 12, color: "rgba(33,37,37,0.70)", marginTop: 2 }}>
                      {alert.client_name ? `${alert.client_name} • ` : ""}{timeAgo(alert.created_at)}
                    </div>
                    {alert.cta_url && alert.cta_text && !isClickable && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#3B82F6", marginTop: 4, display: "inline-block" }}>
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
                return (
                  <div key={meeting.id} style={{
                    borderRadius: 16, padding: 16,
                    backgroundImage: isFirst ? "url('/insights.png')" : "linear-gradient(#FFFFFFCC, #FFFFFFCC), url('/insights.png')",
                    backgroundSize: "cover", backgroundPosition: "center",
                    backgroundColor: isFirst ? undefined : "#CA8C4626",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
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

function AlertsPanel({ alerts, onViewAll, onCheckNow }: { alerts: CrmAlert[]; onViewAll: () => void; onCheckNow: (alert: CrmAlert) => void }) {
  return (
    <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.10)", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Alerts</h3>
        <button onClick={onViewAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.50)" }}>View all</button>
      </div>

      {alerts.length === 0 ? (
        <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", padding: "16px 0", margin: 0 }}>No alerts</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: hasAction ? "pointer" : undefined, borderRadius: 8, padding: 8, transition: "background 0.15s" }}
                onMouseEnter={hasAction ? (e) => (e.currentTarget.style.background = "rgba(0,0,0,0.03)") : undefined}
                onMouseLeave={hasAction ? (e) => (e.currentTarget.style.background = "transparent") : undefined}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                  background: alert.client ? "#39952D" : "#3B82F6",
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "black" }}>{alert.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(33,37,37,0.70)", marginTop: 2 }}>
                    {alert.client_name ? `${alert.client_name} • ` : ""}{timeAgo(alert.created_at)}
                  </div>
                  {alert.cta_url && alert.cta_text && !isClickable && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#3B82F6", marginTop: 4, display: "inline-block" }}>
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

function MeetingsPanel({ meetings, onViewAll }: { meetings: CrmMeeting[]; onViewAll: () => void }) {
  return (
    <div style={{ background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.10)", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Upcoming meetings</h3>
        <button onClick={onViewAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.50)" }}>View all</button>
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
                backgroundImage: isFirst ? "url('/insights.png')" : "linear-gradient(#FFFFFFCC, #FFFFFFCC), url('/insights.png')",
                backgroundSize: "cover", backgroundPosition: "center",
                backgroundColor: isFirst ? undefined : "#CA8C4626",
                display: "flex", alignItems: "center", gap: 12,
              }}>
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
