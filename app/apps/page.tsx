"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import { apiRequest } from "../lib/apiClient";
import { useGetCrmClientsQuery, type CrmClient } from "../store/api";

type ExecutionPlanStep = {
  position: number;
  node_id: string;
  component_type: string;
  label: string;
  description: string[];
  group_id?: string;
  group_label?: string;
};

type ExecutionPlan = {
  schema_version: number;
  flow_hash: string;
  steps: ExecutionPlanStep[];
};

type WorkflowCommand = {
  command: string;
  tool_name: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execution_plan?: ExecutionPlan;
};

type WorkflowCommandsResponse = {
  agent: string;
  commands: WorkflowCommand[];
};

const WORKFLOW_ICONS = [
  "/portfolio-review.png",
  "/meeting-preparation.png",
  "/opportunity-finder.png",
  "/real-estate-value.png",
  "/top-movers-news.png",
];

export default function AppsPage() {
  const router = useRouter();
  const [commands, setCommands] = useState<WorkflowCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommand, setSelectedCommand] = useState<WorkflowCommand | null>(null);
  const [searchText, setSearchText] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const { data: clientsData } = useGetCrmClientsQuery();

  const filteredClients = (clientsData?.results ?? []).filter((c) =>
    c.display_name.toLowerCase().includes(searchText.toLowerCase())
  );

  function handleRunClick(cmd: WorkflowCommand) {
    setSelectedCommand(cmd);
    setSearchText("");
  }

  function handleClientSelect(client: CrmClient) {
    if (!selectedCommand) return;
    if (selectedCommand.execution_plan) {
      sessionStorage.setItem("workflow_execution_plan", JSON.stringify(selectedCommand.execution_plan));
    }
    setSelectedCommand(null);
    router.push(
      `/client?clientId=${client.id}&prompt=${encodeURIComponent(selectedCommand.command)}&workflow_tool=${encodeURIComponent(selectedCommand.tool_name)}`
    );
  }

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
          {/* Background image */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/bg-app-workflow.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }} />

          {/* Title */}
          <h1 style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            color: "black",
            fontSize: 48,
            fontFamily: "ButlerPro, serif",
            fontWeight: 400,
            lineHeight: "57.6px",
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
            background: "transparent",
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
                      borderRadius: 32,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}>
                      <img
                        src={WORKFLOW_ICONS[i % WORKFLOW_ICONS.length]}
                        alt={cmd.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
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
                          background: "#F2F2F2",
                          borderRadius: 6,
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 10,
                          display: "flex",
                        }}>
                          <div style={{
                            color: "#00000066",
                            fontSize: 12,
                            fontFamily: "Cascadia Code, monospace",
                            fontWeight: 400,
                            wordWrap: "break-word",
                          }}>
                            {cmd.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Run button */}
                  <button
                    onClick={() => handleRunClick(cmd)}
                    style={{
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
                    }}
                  >
                    <svg width="11" height="14" viewBox="0 0 11 14" fill="none">
                      <path d="M0.664062 2.08057C0.664062 1.43313 0.664062 1.10941 0.799056 0.930962C0.916659 0.775503 1.09641 0.679302 1.29099 0.667684C1.51435 0.654348 1.78371 0.833916 2.32241 1.19305L9.33278 5.86663C9.77791 6.16338 10.0005 6.31176 10.078 6.49878C10.1458 6.66228 10.1458 6.84603 10.078 7.00954C10.0005 7.19655 9.77791 7.34493 9.33278 7.64167L2.32241 12.3153C1.7837 12.6744 1.51435 12.854 1.29099 12.8406C1.09641 12.829 0.916659 12.7328 0.799056 12.5773C0.664062 12.3989 0.664062 12.0752 0.664062 11.4277V2.08057Z" stroke="white" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
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
          <button
            onClick={() => { setShowFeedback(true); setFeedbackSubmitted(false); setFeedbackText(""); }}
            style={{
              position: "relative",
              zIndex: 1,
              marginTop: 32,
              marginBottom: 48,
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
            }}
          >
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
          {/* Feedback modal */}
          {showFeedback && (
            <div
              onClick={() => setShowFeedback(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                background: "rgba(0,0,0,0.30)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 440,
                  padding: 32,
                  background: "rgba(255, 255, 255, 0.95)",
                  boxShadow: "0px 4px 34px rgba(0, 0, 0, 0.16)",
                  borderRadius: 24,
                  flexDirection: "column",
                  gap: 20,
                  display: "flex",
                  backdropFilter: "blur(20px)",
                }}
              >
                {feedbackSubmitted ? (
                  <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0" }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "#E8F5E9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13L9 17L19 7" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div style={{
                      color: "black",
                      fontSize: 20,
                      fontFamily: "ButlerPro, serif",
                      fontWeight: 400,
                    }}>
                      Thank you!
                    </div>
                    <div style={{
                      color: "rgba(0,0,0,0.50)",
                      fontSize: 14,
                      fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                      fontWeight: 400,
                      lineHeight: "20px",
                    }}>
                      We&apos;ve received your request and will review it shortly.
                    </div>
                    <button
                      onClick={() => setShowFeedback(false)}
                      style={{
                        marginTop: 8,
                        padding: "12px 32px",
                        background: "black",
                        borderRadius: 28,
                        border: "none",
                        color: "white",
                        fontSize: 14,
                        fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{
                      textAlign: "center",
                      color: "black",
                      fontSize: 24,
                      fontFamily: "ButlerPro, serif",
                      fontWeight: 400,
                      lineHeight: "28.80px",
                    }}>
                      Request a new App
                    </div>
                    <div style={{
                      textAlign: "center",
                      color: "rgba(0,0,0,0.50)",
                      fontSize: 14,
                      fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                      fontWeight: 400,
                      lineHeight: "20px",
                    }}>
                      Tell us what workflow you&apos;d like automated and we&apos;ll look into building it.
                    </div>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Describe the app you'd like to see..."
                      autoFocus
                      style={{
                        width: "100%",
                        minHeight: 120,
                        padding: 16,
                        borderRadius: 16,
                        border: "1px solid #E5E7EB",
                        outline: "none",
                        resize: "vertical",
                        fontSize: 15,
                        fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                        fontWeight: 400,
                        color: "black",
                        background: "white",
                      }}
                    />
                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => setShowFeedback(false)}
                        style={{
                          padding: "12px 24px",
                          borderRadius: 28,
                          border: "1px solid rgba(0,0,0,0.10)",
                          background: "white",
                          color: "#374151",
                          fontSize: 14,
                          fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setFeedbackSubmitted(true)}
                        disabled={!feedbackText.trim()}
                        style={{
                          padding: "12px 24px",
                          borderRadius: 28,
                          border: "none",
                          background: feedbackText.trim() ? "black" : "rgba(0,0,0,0.20)",
                          color: "white",
                          fontSize: 14,
                          fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                          fontWeight: 500,
                          cursor: feedbackText.trim() ? "pointer" : "default",
                        }}
                      >
                        Submit
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Client selection modal */}
          {selectedCommand && (
            <div
              onClick={() => setSelectedCommand(null)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                background: "rgba(0,0,0,0.30)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 400,
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingTop: 32,
                  paddingBottom: 32,
                  background: "rgba(255, 255, 255, 0.80)",
                  boxShadow: "0px 4px 34px rgba(0, 0, 0, 0.16)",
                  overflow: "hidden",
                  borderRadius: 24,
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 20,
                  display: "inline-flex",
                  backdropFilter: "blur(20px)",
                }}
              >
                <div style={{
                  alignSelf: "stretch",
                  textAlign: "center",
                  color: "black",
                  fontSize: 24,
                  fontFamily: "ButlerPro, serif",
                  fontWeight: 400,
                  lineHeight: "28.80px",
                  wordWrap: "break-word",
                }}>
                  Which client do you<br />want to review?
                </div>

                <div style={{
                  alignSelf: "stretch",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 8,
                  display: "flex",
                }}>
                  {/* Search input */}
                  <div style={{
                    alignSelf: "stretch",
                    padding: 16,
                    borderRadius: 16,
                    outline: "1px #E5E7EB solid",
                    outlineOffset: "-1px",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 12,
                    display: "flex",
                  }}>
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Search clients..."
                      autoFocus
                      style={{
                        flex: "1 1 0",
                        color: "black",
                        fontSize: 15,
                        fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                        fontWeight: 500,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                      }}
                    />
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="9" cy="9" r="6" stroke="#4B5563" strokeWidth="2" />
                      <path d="M14 14L18 18" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>

                  {/* Client list */}
                  <div style={{
                    alignSelf: "stretch",
                    maxHeight: 300,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}>
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleClientSelect(client)}
                        style={{
                          alignSelf: "stretch",
                          height: 64,
                          paddingLeft: 12,
                          paddingRight: 12,
                          paddingTop: 16,
                          paddingBottom: 16,
                          background: "white",
                          boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.13)",
                          borderRadius: 13,
                          justifyContent: "flex-start",
                          alignItems: "center",
                          gap: 10,
                          display: "flex",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ flex: "1 1 0", justifyContent: "space-between", alignItems: "center", display: "flex" }}>
                          <div style={{ flex: "1 1 0", justifyContent: "flex-start", alignItems: "center", gap: 8, display: "flex" }}>
                            {/* Avatar */}
                            <div style={{
                              width: 32,
                              height: 32,
                              background: "linear-gradient(0deg, rgba(255, 255, 255, 0.70) 0%, rgba(255, 255, 255, 0.70) 100%), #E1DEF8",
                              borderRadius: "50%",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              flexShrink: 0,
                            }}>
                              <span style={{
                                color: "#4C2D08",
                                fontSize: 10,
                                fontFamily: "Inter, sans-serif",
                                fontWeight: 700,
                              }}>
                                {client.display_name.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            {/* Name */}
                            <div style={{
                              color: "#111827",
                              fontSize: 14,
                              fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                              fontWeight: 500,
                              wordWrap: "break-word",
                            }}>
                              {client.display_name}
                            </div>
                          </div>
                          {/* Chevron */}
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M9 6L15 12L9 18" stroke="rgba(0, 0, 0, 0.40)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <div style={{
                        padding: 24,
                        textAlign: "center",
                        color: "rgba(0,0,0,0.4)",
                        fontSize: 14,
                        fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                      }}>
                        No clients found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
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
