"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import { apiRequest } from "../lib/apiClient";

type WorkflowCommand = {
  command: string;
  tool_name: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

type WorkflowCommandsResponse = {
  agent: string;
  commands: WorkflowCommand[];
};

const ICON_GRADIENTS = [
  "linear-gradient(180deg, rgba(255, 241, 163, 0.80) 0%, rgba(255, 241, 163, 0.80) 50%, rgba(255, 179, 134, 0.80) 75%, rgba(255, 111, 50, 0.80) 100%)",
  "linear-gradient(180deg, rgba(163, 255, 200, 0.80) 0%, rgba(163, 255, 200, 0.80) 50%, rgba(134, 220, 255, 0.80) 75%, rgba(50, 180, 255, 0.80) 100%)",
  "linear-gradient(180deg, rgba(163, 200, 255, 0.80) 0%, rgba(163, 200, 255, 0.80) 50%, rgba(134, 170, 255, 0.80) 75%, rgba(80, 130, 255, 0.80) 100%)",
  "linear-gradient(180deg, rgba(255, 200, 200, 0.80) 0%, rgba(255, 200, 200, 0.80) 50%, rgba(255, 160, 160, 0.80) 75%, rgba(255, 100, 100, 0.80) 100%)",
  "linear-gradient(180deg, rgba(220, 200, 255, 0.80) 0%, rgba(220, 200, 255, 0.80) 50%, rgba(190, 160, 255, 0.80) 75%, rgba(140, 80, 255, 0.80) 100%)",
  "linear-gradient(180deg, rgba(255, 230, 180, 0.80) 0%, rgba(255, 230, 180, 0.80) 50%, rgba(255, 200, 130, 0.80) 75%, rgba(255, 160, 50, 0.80) 100%)",
];

const ICONS = [<SearchIcon />, <CalendarIcon />, <ShieldIcon />, <HomeIcon />, <SearchIcon />, <CalendarIcon />];

export default function AppsPage() {
  const [commands, setCommands] = useState<WorkflowCommand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkflows() {
      try {
        const data = await apiRequest<WorkflowCommandsResponse>("/crm/chats/workflow-commands/");
        setCommands(data.commands);
      } catch {
        setCommands([]);
      } finally {
        setLoading(false);
      }
    }
    void fetchWorkflows();
  }, []);
  return (
    <ProtectedRoute>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{
          flex: 1,
          marginLeft: 80,
          position: "relative",
          background: "#F8F8F8",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: "100vh",
        }}>
          {/* Top gradient blob */}
          <div style={{
            width: 1283,
            height: 561,
            position: "absolute",
            left: 0,
            top: -115,
            opacity: 0.40,
            background: "linear-gradient(180deg, rgba(255, 241, 163, 0.80) 0%, rgba(255, 241, 163, 0.80) 50%, rgba(255, 179, 134, 0.80) 75%, rgba(255, 111, 50, 0.80) 100%)",
            filter: "blur(82px)",
          }} />
          {/* Bottom gradient blob */}
          <div style={{
            width: 1283,
            height: 561,
            position: "absolute",
            right: 0,
            bottom: -115,
            opacity: 0.40,
            background: "linear-gradient(0deg, rgba(255, 241, 163, 0.80) 0%, rgba(255, 241, 163, 0.80) 50%, rgba(255, 179, 134, 0.80) 75%, rgba(255, 111, 50, 0.80) 100%)",
            filter: "blur(82px)",
          }} />

          {/* Title */}
          <h1 style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            color: "#361F05",
            fontSize: 38,
            fontFamily: "ButlerPro, serif",
            fontWeight: 600,
            lineHeight: "45.6px",
            wordWrap: "break-word",
            marginTop: 60,
            marginBottom: 28,
          }}>
            Apps to simplify your workflows
          </h1>

          {/* Cards container */}
          <div style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 859,
            background: "white",
            borderRadius: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "32px 64px",
          }}>
            {loading ? (
              <div style={{ padding: 40, color: "rgba(0,0,0,0.4)", fontFamily: "Satoshi, sans-serif", fontSize: 14 }}>
                Loading workflows...
              </div>
            ) : commands.length === 0 ? (
              <div style={{ padding: 40, color: "rgba(0,0,0,0.4)", fontFamily: "Satoshi, sans-serif", fontSize: 14 }}>
                No workflows available
              </div>
            ) : (
            <div style={{
              width: "100%",
              maxWidth: 732,
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: 24,
              display: "inline-flex",
            }}>
              {commands.map((cmd, i) => (
                <div
                  key={cmd.command}
                  style={{
                    width: "100%",
                    height: 112,
                    paddingTop: 16,
                    paddingBottom: 16,
                    borderRadius: 16,
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 32,
                    display: "inline-flex",
                  }}
                >
                  <div style={{ flex: "1 1 0", justifyContent: "flex-start", alignItems: "center", gap: 16, display: "flex" }}>
                    {/* Icon */}
                    <div style={{
                      width: 96,
                      height: 96,
                      position: "relative",
                      background: "white",
                      overflow: "hidden",
                      borderRadius: 32,
                      outline: "1px rgba(0, 0, 0, 0.02) solid",
                      outlineOffset: "-1px",
                      flexShrink: 0,
                    }}>
                      <div style={{
                        width: 432,
                        height: 182,
                        left: -111,
                        top: -22,
                        position: "absolute",
                        background: ICON_GRADIENTS[i % ICON_GRADIENTS.length],
                        boxShadow: "64px 64px 64px",
                        filter: "blur(32px)",
                      }} />
                      <div style={{
                        width: 60,
                        height: 60,
                        left: 18,
                        top: 18,
                        position: "absolute",
                        mixBlendMode: "overlay",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        {ICONS[i % ICONS.length]}
                      </div>
                    </div>

                    {/* Text content */}
                    <div style={{ flex: "1 1 0", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", gap: 12, display: "inline-flex" }}>
                      <div style={{ alignSelf: "stretch", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", gap: 2, display: "flex" }}>
                        <div style={{
                          alignSelf: "stretch",
                          color: "black",
                          fontSize: 18,
                          fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                          fontWeight: 700,
                          lineHeight: "21.6px",
                          wordWrap: "break-word",
                        }}>
                          {cmd.name}
                        </div>
                        <div style={{
                          alignSelf: "stretch",
                          color: "rgba(0, 0, 0, 0.50)",
                          fontSize: 14,
                          fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                          fontWeight: 400,
                          lineHeight: "18.2px",
                          wordWrap: "break-word",
                        }}>
                          {cmd.description}
                        </div>
                      </div>
                      <div style={{ justifyContent: "flex-start", alignItems: "center", gap: 8, display: "inline-flex" }}>
                        <div style={{
                          paddingLeft: 8,
                          paddingRight: 8,
                          paddingTop: 4,
                          paddingBottom: 4,
                          background: "#F7F7F7",
                          borderRadius: 6,
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 10,
                          display: "flex",
                        }}>
                          <div style={{
                            color: "rgba(0, 0, 0, 0.40)",
                            fontSize: 12,
                            fontFamily: "Cascadia Code, monospace",
                            fontWeight: 400,
                            wordWrap: "break-word",
                          }}>
                            {cmd.command}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Run button */}
                  <button style={{
                    paddingLeft: 16,
                    paddingRight: 16,
                    paddingTop: 12,
                    paddingBottom: 12,
                    background: "black",
                    borderRadius: 28,
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 10,
                    display: "flex",
                    border: "none",
                    cursor: "pointer",
                  }}>
                    <span style={{
                      color: "white",
                      fontSize: 12,
                      fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                      fontWeight: 500,
                      lineHeight: "18px",
                      wordWrap: "break-word",
                    }}>
                      Run
                    </span>
                  </button>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Request a new App button */}
          <button style={{
            position: "relative",
            zIndex: 1,
            marginTop: 32,
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 16,
            paddingBottom: 16,
            background: "transparent",
            borderRadius: 30,
            outline: "1px rgba(0, 0, 0, 0.08) solid",
            outlineOffset: "-1px",
            border: "none",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            display: "inline-flex",
            cursor: "pointer",
          }}>
            <span style={{
              textAlign: "center",
              color: "black",
              fontSize: 18,
              fontFamily: "Satoshi Variable, Satoshi, sans-serif",
              fontWeight: 700,
              lineHeight: "21.6px",
              wordWrap: "break-word",
            }}>
              Request a new App
            </span>
          </button>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function SearchIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="5" y="5" width="30" height="30" rx="0" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" />
      <circle cx="18" cy="18" r="6" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" />
      <path d="M23 23L28 28" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="5" y="5" width="30" height="33.34" rx="2" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" />
      <path d="M5 14H35" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" />
      <path d="M13 2V7M27 2V7" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="10" y="19" width="5" height="5" rx="1" fill="rgba(0,0,0,0.70)" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M6.67 3.33H33.33V33.34C33.33 33.34 26.67 38.33 20 38.33C13.33 38.33 6.67 33.34 6.67 33.34V3.33Z" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14 20L18 24L26 16" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M5 16.67L20 3.33L35 16.67V35C35 35.92 34.25 36.67 33.33 36.67H6.67C5.75 36.67 5 35.92 5 35V16.67Z" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M15 36.67V23.33H25V36.67" stroke="rgba(0,0,0,0.70)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
