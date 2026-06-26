"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useChat } from "@ai-sdk/react";
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  groupPartByType,
  MessagePrimitive,
  ThreadPrimitive,
  useToolCallElapsed,
  useThread,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import type { UIMessage } from "ai";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import { MobileHeader } from "../components/MobileHeader";
import {
  type AiChatSession,
  type ChatPrompt,
  aiChatFetch,
  archiveAiChatSession,
  createTitleFromPrompt,
  getAiAgentSlug,
  getAiChatsUrl,
  getAiChatMessagesUrl,
  getAiRequestHeaders,
  listAiChatSessions,
  listChatPrompts,
  loadAiChatMessages,
  mergeAiChatSessions,
  pinAiChatSession,
  readStoredAiChatSessions,
  upsertStoredAiChatSession,
  writeStoredAiChatSessions,
} from "../lib/aiChatApi";
import "./chat.css";

const PROMPT_SUGGESTIONS_ROW1 = [
  "How will falling oil prices impact my holdings?",
  "Do I have enough exposure to AI beneficiaries like NVIDIA and Broadcom?",
  "Could the Iran peace deal create new opportunities in energy?",
  "What sectors benefit most from rate cuts?",
];

const PROMPT_SUGGESTIONS_ROW2 = [
  "What strategies can I employ to hedge against geopolitical instability?",
  "Are emerging tech startups showing signs of becoming the next market leaders?",
  "How might changes in inflation affect my bond allocation?",
  "Which of my holdings are most sensitive to dollar strength?",
];

type AiChatMessageMetadata = {
  session_id?: string;
  message_id?: string;
  client_message_id?: string;
};

type ChatUiMessage = UIMessage<AiChatMessageMetadata>;

const WARM_CHAT_CACHE_MAX_AGE_MS = 30_000;
const PENDING_LOCAL_CHAT_MAX_AGE_MS = 2 * 60_000;

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatUiMessage[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isDraftChat, setIsDraftChat] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<ChatPrompt[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSessions, setArchivedSessions] = useState<AiChatSession[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const sessionsRefreshRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    listChatPrompts()
      .then((items) => {
        if (!cancelled) {
          setPrompts(items);
        }
      })
      .catch(() => {
        /* fall back to static suggestions */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSessions = useCallback(
    async ({ showCached = false, showLoading = false }: { showCached?: boolean; showLoading?: boolean } = {}) => {
      const requestId = ++sessionsRefreshRef.current;

      if (showLoading) {
        setIsLoadingSessions(true);
      }

      if (showCached) {
        const cachedSessions = getVisibleSessions(
          readStoredAiChatSessions({ maxAgeMs: WARM_CHAT_CACHE_MAX_AGE_MS }),
        );
        if (cachedSessions.length > 0) {
          setSessions(cachedSessions);
        }
      }

      try {
        const serverSessions = getVisibleSessions(await listAiChatSessions());
        if (requestId !== sessionsRefreshRef.current) {
          return;
        }

        const serverIds = new Set(serverSessions.map((session) => session.id));
        const pendingLocalSessions = getVisibleSessions(
          readStoredAiChatSessions({ maxAgeMs: PENDING_LOCAL_CHAT_MAX_AGE_MS }),
        ).filter((session) => session.source === "local" && !serverIds.has(session.id));
        const nextSessions = mergeAiChatSessions(serverSessions, pendingLocalSessions);

        setSessions(nextSessions);
        writeStoredAiChatSessions(serverSessions);
        setNotice(null);
      } catch (error) {
        console.error("Failed to load AI chat sessions:", error);
        if (requestId === sessionsRefreshRef.current) {
          const fallbackSessions = getVisibleSessions(readStoredAiChatSessions());
          setSessions(fallbackSessions);
          setNotice("Chat history could not be refreshed. Showing the latest browser fallback.");
        }
      } finally {
        if (requestId === sessionsRefreshRef.current) {
          setIsLoadingSessions(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void refreshSessions({ showCached: true, showLoading: true });
  }, [refreshSessions]);

  const prevSessionsLengthRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isLoadingSessions && sessions.length === 0) {
      setRailCollapsed(true);
    } else if (prevSessionsLengthRef.current === 0 && sessions.length > 0) {
      setRailCollapsed(false);
    }
    prevSessionsLengthRef.current = sessions.length;
  }, [isLoadingSessions, sessions.length]);

  useEffect(() => {
    const refreshVisibleChats = () => {
      if (document.visibilityState === "visible") {
        void refreshSessions();
      }
    };

    window.addEventListener("focus", refreshVisibleChats);
    document.addEventListener("visibilitychange", refreshVisibleChats);

    return () => {
      window.removeEventListener("focus", refreshVisibleChats);
      document.removeEventListener("visibilitychange", refreshVisibleChats);
    };
  }, [refreshSessions]);

  const selectedSession = useMemo(
    () =>
      sessions.find((session) => session.id === selectedSessionId) ??
      archivedSessions.find((session) => session.id === selectedSessionId) ??
      null,
    [selectedSessionId, sessions, archivedSessions],
  );

  const selectSession = async (session: AiChatSession) => {
    setIsDraftChat(false);
    setSelectedSessionId(session.id);
    setIsLoadingMessages(true);
    setNotice(null);

    try {
      const messages = (await loadAiChatMessages(session.id)) as ChatUiMessage[];
      setInitialMessages(messages);
    } catch (error) {
      console.error("Failed to load AI chat messages:", error);
      setInitialMessages([]);
      setNotice("This chat could not be loaded. Try another session or start a new one.");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const startNewChat = () => {
    setIsDraftChat(true);
    setSelectedSessionId(null);
    setInitialMessages([]);
    setNotice(null);
  };

  const handleTogglePin = async (session: AiChatSession) => {
    const nextPinned = !session.is_pinned;
    setSessions((current) =>
      current.map((item) => (item.id === session.id ? { ...item, is_pinned: nextPinned } : item)),
    );

    try {
      const updated = await pinAiChatSession(session.id, nextPinned);
      setSessions((current) => mergeAiChatSessions(current, [updated]));
      void refreshSessions();
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      setSessions((current) =>
        current.map((item) => (item.id === session.id ? { ...item, is_pinned: session.is_pinned } : item)),
      );
      setNotice("Could not update the pinned state.");
    }
  };

  const handleArchive = async (session: AiChatSession) => {
    setSessions((current) => current.filter((item) => item.id !== session.id));
    if (session.id === selectedSessionId) {
      startNewChat();
    }

    try {
      const updated = await archiveAiChatSession(session.id, true);
      setArchivedSessions((current) => mergeAiChatSessions(current, [updated]));
      void refreshSessions();
    } catch (error) {
      console.error("Failed to archive chat:", error);
      setSessions((current) => mergeAiChatSessions(current, [session]));
      setNotice("Could not archive the chat.");
    }
  };

  const handleUnarchive = async (session: AiChatSession) => {
    setArchivedSessions((current) => current.filter((item) => item.id !== session.id));

    try {
      const updated = await archiveAiChatSession(session.id, false);
      setSessions((current) => mergeAiChatSessions(current, [updated]));
      void refreshSessions();
    } catch (error) {
      console.error("Failed to unarchive chat:", error);
      setArchivedSessions((current) => mergeAiChatSessions(current, [session]));
      setNotice("Could not unarchive the chat.");
    }
  };

  const toggleArchivedView = async () => {
    if (showArchived) {
      setShowArchived(false);
      return;
    }

    setShowArchived(true);
    setIsLoadingArchived(true);
    setNotice(null);

    try {
      const archived = await listAiChatSessions({ archivedOnly: true });
      setArchivedSessions(archived);
    } catch (error) {
      console.error("Failed to load archived chats:", error);
      setNotice("Could not load archived chats.");
    } finally {
      setIsLoadingArchived(false);
    }
  };

  const updateSessionFromPrompt = (prompt: string) => {
    if (!selectedSession) {
      return;
    }

    const nextSession = {
      ...selectedSession,
      title: selectedSession.title === "New chat" ? createTitleFromPrompt(prompt) : selectedSession.title,
      updated_at: new Date().toISOString(),
    };

    upsertStoredAiChatSession(nextSession);
    setSessions((current) => mergeAiChatSessions([nextSession], current));
  };

  const handleAssistantFinished = ({
    sessionId,
    prompt,
    messages,
  }: {
    sessionId: string | null;
    prompt: string | null;
    messages: ChatUiMessage[];
  }) => {
    if (!sessionId) {
      if (selectedSession) {
        const nextSession = {
          ...selectedSession,
          updated_at: new Date().toISOString(),
        };

        upsertStoredAiChatSession(nextSession);
        setSessions((current) => mergeAiChatSessions([nextSession], current));
        window.setTimeout(() => void refreshSessions(), 500);
      }

      return;
    }

    const existingSession = sessions.find((session) => session.id === sessionId) ?? selectedSession;
    const nextSession: AiChatSession = {
      id: sessionId,
      title:
        existingSession?.title && existingSession.title !== "New chat"
          ? existingSession.title
          : createTitleFromPrompt(prompt ?? ""),
      agent: existingSession?.agent ?? getAiAgentSlug(),
      created_at: existingSession?.created_at,
      updated_at: new Date().toISOString(),
      source: existingSession?.source ?? "local",
    };

    upsertStoredAiChatSession(nextSession);
    setSessions((current) => mergeAiChatSessions([nextSession], current));
    setInitialMessages(messages);
    setSelectedSessionId(sessionId);
    setIsDraftChat(false);
    window.setTimeout(() => void refreshSessions(), 500);
  };

  return (
    <ProtectedRoute>
      <div className="chat-page-shell">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <MobileHeader onMenuOpen={() => setSidebarOpen(true)} />
        <header className="chat-page-header">
          <div className="chat-page-header-left">
            <h1 className="chat-page-header-title">Smart advisor</h1>
            <p className="chat-page-header-subtitle">Chat with it about  your investments and what’s happening in the markets</p>
          </div>
          <button type="button" className="chat-page-header-btn" onClick={startNewChat}>
            <span className="chat-page-header-btn-icon"><PlusIcon /></span>
            New chat
          </button>
        </header>
        <main className={`chat-page-main${railCollapsed ? " rail-collapsed" : ""}`}>
          {railCollapsed && (
            <button type="button" className="chat-rail-expand-btn" onClick={() => setRailCollapsed(false)} aria-label="Expand sidebar">
              <ExpandIcon />
            </button>
          )}
          <aside className={`chat-session-rail${railCollapsed ? " is-collapsed" : ""}`} aria-label="Chat sessions">
            <button type="button" className="chat-rail-collapse-btn" aria-label="Collapse sidebar" onClick={() => setRailCollapsed(true)}>
              <CollapseIcon />
            </button>
            <div className="chat-session-list">
              {showArchived ? (
                isLoadingArchived ? (
                  <p className="chat-session-muted">Loading archived chats...</p>
                ) : archivedSessions.length === 0 ? (
                  <p className="chat-session-muted">No archived chats.</p>
                ) : (
                  <>
                    <p className="chat-session-section-label">
                      <ArchiveIcon />
                      Archived conversations
                    </p>
                    {archivedSessions.map((session) => (
                      <SessionItem
                        key={`archived-${session.id}`}
                        session={session}
                        archived
                        active={session.id === selectedSessionId}
                        onSelect={() => selectSession(session)}
                        onTogglePin={() => handleTogglePin(session)}
                        onArchive={() => handleUnarchive(session)}
                      />
                    ))}
                  </>
                )
              ) : isLoadingSessions ? (
                <p className="chat-session-muted">Loading chats...</p>
              ) : sessions.length === 0 ? (
                <div className="chat-session-empty">
                  <div className="chat-session-empty-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      <line x1="17" y1="7" x2="7" y2="17"/>
                    </svg>
                  </div>
                  <p className="chat-session-empty-label">No chats yet.</p>
                </div>
              ) : (
                <>
                  {sessions.some((s) => s.is_pinned) && (
                    <>
                      <p className="chat-session-section-label">
                        <PinIcon />
                        Pinned conversations
                      </p>
                      {sessions.filter((s) => s.is_pinned).map((session) => (
                        <SessionItem
                          key={`pinned-${session.id}`}
                          session={session}
                          active={session.id === selectedSessionId}
                          onSelect={() => selectSession(session)}
                          onTogglePin={() => handleTogglePin(session)}
                          onArchive={() => handleArchive(session)}
                        />
                      ))}
                    </>
                  )}
                  {sessions.filter((s) => !s.is_pinned).length > 0 && (
                    <p className="chat-session-section-label" style={{ marginTop: sessions.some((s) => s.is_pinned) ? 8 : 0 }}>
                      <LockIcon />
                      {sessions.some((s) => s.is_pinned) ? "Other conversations" : "Your conversations"}
                    </p>
                  )}
                  {sessions.filter((s) => !s.is_pinned).map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      active={session.id === selectedSessionId}
                      onSelect={() => selectSession(session)}
                      onTogglePin={() => handleTogglePin(session)}
                      onArchive={() => handleArchive(session)}
                    />
                  ))}
                </>
              )}
            </div>

            <button type="button" className="chat-rail-archive-toggle" onClick={toggleArchivedView}>
              <ArchiveIcon />
              {showArchived ? "Back to chats" : "View archived"}
            </button>

            {notice ? <p className="chat-rail-notice">{notice}</p> : null}
          </aside>

          <section className="chat-thread-panel" aria-label="Wealth advisor chat">
            {selectedSession && !isDraftChat ? (
              <div style={{ position: "absolute", top: "-15%", right: "-15%", bottom: "-15%", left: "-30%", zIndex: 0, pointerEvents: "none", opacity: 0.8 }}>
                <Image src="/chat-hero-bg.png" alt="" fill className="object-cover" priority />
              </div>
            ) : (
              <div style={{ position: "absolute", top: "-15%", right: "-15%", bottom: "-15%", left: "-30%", zIndex: 0, pointerEvents: "none" }}>
                <Image src="/Hero-bg.png" alt="" fill className="object-cover" priority />
              </div>
            )}
            {selectedSession || isDraftChat ? (
              isLoadingMessages ? (
                <div className="chat-loading-state">Loading chat...</div>
              ) : (
                <ChatThread
                  key={selectedSession?.id ?? "draft"}
                  session={selectedSession}
                  initialMessages={initialMessages}
                  prompts={prompts}
                  onPromptSubmitted={updateSessionFromPrompt}
                  onAssistantFinished={handleAssistantFinished}
                />
              )
            ) : (
              <EmptyChatState onStart={startNewChat} />
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function getVisibleSessions(sessions: AiChatSession[]) {
  return mergeAiChatSessions(sessions).filter((session) => !session.is_archived);
}

function SessionItem({
  session,
  active,
  archived,
  onSelect,
  onTogglePin,
  onArchive,
}: {
  session: AiChatSession;
  active: boolean;
  archived?: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
}) {
  return (
    <div className={`chat-session-item${active ? " active" : ""}`}>
      <button type="button" className="chat-session-select" onClick={onSelect}>
        <span className="chat-session-title">{session.title}</span>
      </button>
      <div className="chat-session-actions">
        {!archived && (
          <button
            type="button"
            className={`chat-session-action${session.is_pinned ? " is-active" : ""}`}
            aria-label={session.is_pinned ? "Unpin chat" : "Pin chat"}
            title={session.is_pinned ? "Unpin chat" : "Pin chat"}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin();
            }}
          >
            <PinIcon />
          </button>
        )}
        <button
          type="button"
          className="chat-session-action"
          aria-label={archived ? "Unarchive chat" : "Archive chat"}
          title={archived ? "Unarchive chat" : "Archive chat"}
          onClick={(event) => {
            event.stopPropagation();
            onArchive();
          }}
        >
          {archived ? <UnarchiveIcon /> : <ArchiveIcon />}
        </button>
      </div>
    </div>
  );
}

type ChatThreadProps = {
  session: AiChatSession | null;
  initialMessages: ChatUiMessage[];
  prompts: ChatPrompt[];
  onPromptSubmitted: (prompt: string) => void;
  onAssistantFinished: (details: {
    sessionId: string | null;
    prompt: string | null;
    messages: ChatUiMessage[];
  }) => void;
};

function ChatThread({ session, initialMessages, prompts, onPromptSubmitted, onAssistantFinished }: ChatThreadProps) {
  const agent = getAiAgentSlug();
  const lastPromptRef = useRef<string | null>(null);
  const pendingSessionIdRef = useRef<string | null>(session?.id ?? null);
  const sessionId = session?.id ?? null;

  useEffect(() => {
    pendingSessionIdRef.current = sessionId;
  }, [sessionId]);

  const transport = useMemo(
    () =>
      new AssistantChatTransport<ChatUiMessage>({
        api: sessionId ? getAiChatMessagesUrl(sessionId) : getAiChatsUrl(),
        credentials: "include",
        headers: getAiRequestHeaders(),
        fetch: async (input, init) => {
          const response = await aiChatFetch(input, init);
          const responseSessionId = response.headers.get("X-Session-Id");

          if (responseSessionId) {
            pendingSessionIdRef.current = responseSessionId;
          }

          return response;
        },
        body: {
          metadata: {
            agent,
          },
        },
        prepareSendMessagesRequest(options) {
          const { messages } = options;
          const body = options.body ?? {};
          const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
          const prompt = latestUserMessage ? getMessageText(latestUserMessage) : "";
          const api = sessionId ? getAiChatMessagesUrl(sessionId) : getAiChatsUrl();

          if (prompt && prompt !== lastPromptRef.current) {
            lastPromptRef.current = prompt;
            onPromptSubmitted(prompt);
          }

          if (!sessionId) {
            pendingSessionIdRef.current = null;
          }

          return {
            ...options,
            api,
            body: {
              ...body,
              message: latestUserMessage,
              messages,
              metadata: {
                ...getRecord(body.metadata),
                agent,
              },
            },
          };
        },
      }),
    [agent, onPromptSubmitted, sessionId],
  );

  const chat = useChat<ChatUiMessage>({
    id: sessionId ?? "draft-chat",
    messages: initialMessages,
    transport,
    onFinish({ message, messages }) {
      onAssistantFinished({
        sessionId: sessionId ?? pendingSessionIdRef.current ?? getSessionIdFromMetadata(message.metadata),
        prompt: lastPromptRef.current,
        messages,
      });
    },
    onError(error) {
      console.error("AI chat stream failed:", error);
    },
  });
  const runtime = useAISDKRuntime(chat);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="chat-thread">
        <ThreadPrimitive.Root className="chat-assistant-thread">
          <AuiIf condition={(state) => state.thread.isEmpty}>
            <div className="chat-message-viewport is-empty">
              <div className="chat-empty-copy">
                <p className="chat-empty-heading">Ask anything about your portfolio</p>
                <Composer placeholder="Ask me anything about your holdings, market stocks, crypto, risk, or returns..." agent={agent} />
              </div>
              <div className="chat-suggestions-wrap">
                {(() => {
                  const promptMessages = prompts.map((p) => p.user_message).filter(Boolean);
                  const row1 = promptMessages.length > 0
                    ? promptMessages.filter((_, i) => i % 2 === 0)
                    : PROMPT_SUGGESTIONS_ROW1;
                  const row2 = promptMessages.length > 0
                    ? promptMessages.filter((_, i) => i % 2 === 1)
                    : PROMPT_SUGGESTIONS_ROW2;
                  return [row1, row2].map((row, rowIndex) => (
                    <div className="chat-suggestions-row" key={`row-${rowIndex}`}>
                      <div className="chat-suggestions-row-inner">
                        {row.map((suggestion) => (
                          <ThreadPrimitive.Suggestion key={suggestion} prompt={suggestion} send className="chat-suggestion-pill">
                            <SendArrowIcon />
                            {suggestion}
                          </ThreadPrimitive.Suggestion>
                        ))}
                        {row.map((suggestion) => (
                          <ThreadPrimitive.Suggestion key={`dup-${suggestion}`} prompt={suggestion} send className="chat-suggestion-pill">
                            <SendArrowIcon />
                            {suggestion}
                          </ThreadPrimitive.Suggestion>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </AuiIf>

          <AuiIf condition={(state) => !state.thread.isEmpty}>
            <ThreadPrimitive.Viewport className="chat-message-viewport" autoScroll>
              <ThreadPrimitive.Messages>
                {({ message }) => (message.role === "user" ? <UserMessage /> : <AssistantMessage />)}
              </ThreadPrimitive.Messages>
              <ThreadPrimitive.ViewportFooter className="chat-thread-footer">
                <ThreadPrimitive.ScrollToBottom className="chat-scroll-to-bottom" aria-label="Scroll to bottom">
                  <ArrowDownIcon />
                </ThreadPrimitive.ScrollToBottom>
              </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
          </AuiIf>
        </ThreadPrimitive.Root>

        {chat.error ? (
          <div className="chat-error-banner" role="alert">
            {chat.error.message || "The chat stream failed. Please try again."}
          </div>
        ) : null}

        <AuiIf condition={(state) => !state.thread.isEmpty}>
          <div className="chat-composer-dock">
            <Composer placeholder="Ask a follow-up..." agent={agent} />
          </div>
        </AuiIf>
      </div>
    </AssistantRuntimeProvider>
  );
}

function EmptyChatState({ onStart }: { onStart: () => void }) {
  return (
    <div className="chat-empty-start">
      <p className="chat-wordmark">OneView</p>
      <p className="chat-empty-subtitle">Start a session with your wealth advisor.</p>
      <button type="button" className="chat-start-btn" onClick={onStart}>
        <PlusIcon />
        <span>Start new chat</span>
      </button>
    </div>
  );
}

function useComposerFormat() {
  const applyFormat = useCallback((type: "bold" | "bullet") => {
    const textarea = document.querySelector<HTMLTextAreaElement>(".chat-composer-input");
    if (!textarea) return;
    textarea.focus();
    const { selectionStart: start, selectionEnd: end, value } = textarea;

    if (type === "bold") {
      const selected = value.slice(start, end);
      const replacement = `**${selected || "bold text"}**`;
      textarea.setRangeText(replacement, start, end, "select");
      if (!selected) {
        textarea.setSelectionRange(start + 2, start + 2 + "bold text".length);
      }
    } else {
      // bullet: prefix each selected line, or insert a new bullet
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", end);
      const blockEnd = lineEnd === -1 ? value.length : lineEnd;
      const block = value.slice(lineStart, blockEnd);
      const lines = block.split("\n");
      const allBulleted = lines.every((l) => l.startsWith("- "));
      const toggled = lines.map((l) => (allBulleted ? l.slice(2) : `- ${l}`)).join("\n");
      textarea.setRangeText(toggled, lineStart, blockEnd, "preserve");
    }

    // Trigger React's onChange by dispatching an input event
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  return applyFormat;
}

function Composer({ placeholder, agent }: { placeholder: string; agent: string }) {
  const isRunning = useThread((t) => t.isRunning);
  const applyFormat = useComposerFormat();
  return (
    <ComposerPrimitive.Root className="chat-composer-wrap">
      <div className={`chat-composer${isRunning ? " is-thinking" : ""}`}>
        <div className="chat-composer-input-row">
          <ComposerPrimitive.Input
            className="chat-composer-input"
            placeholder={placeholder}
            rows={1}
            autoFocus
          />
        </div>
        <div className="chat-composer-footer">
          <div className="chat-composer-footer-right">
            <ComposerPrimaryAction />
          </div>
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
}

function ComposerPrimaryAction() {
  return (
    <>
      <AuiIf condition={(state) => state.thread.isRunning}>
        <ComposerPrimitive.Cancel className="chat-send-btn" aria-label="Stop response" title="Stop response">
          <StopIcon />
        </ComposerPrimitive.Cancel>
      </AuiIf>
      <AuiIf condition={(state) => !state.thread.isRunning && !state.composer.isEmpty}>
        <ComposerPrimitive.Send className="chat-send-btn" aria-label="Send message" title="Send message">
          <ArrowUpIcon />
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(state) => !state.thread.isRunning && state.composer.isEmpty}>
        <button className="chat-send-btn" type="button" disabled aria-label="Send message" title="Send message">
          <ArrowUpIcon />
        </button>
      </AuiIf>
    </>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="chat-message user">
      <div className="chat-message-content">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="chat-message assistant">
      <div className="chat-message-stack">
        <div className="chat-message-content">
          <MessagePrimitive.GroupedParts
            groupBy={groupPartByType({
              "tool-call": ["group-tools"],
            })}
          >
            {({ part, children }) => {
              switch (part.type) {
                case "group-tools":
                  return (
                    <ToolCallGroup status={part.status.type} count={part.indices.length}>
                      {children}
                    </ToolCallGroup>
                  );
                case "text":
                  return <MarkdownText />;
                case "data":
                  return shouldHideDataPart(part.name)
                    ? null
                    : part.dataRendererUI ?? <DataStatusPart name={part.name} status={part.status?.type} />;
                case "tool-call":
                  return part.toolUI ?? <ToolCallPart {...part} />;
                case "indicator":
                  return <AssistantLoadingState />;
                default:
                  return null;
              }
            }}
          </MessagePrimitive.GroupedParts>
        </div>
        <div className="chat-message-controls">
        <AssistantActionBar />
        <BranchPickerPrimitive.Root className="chat-branch-picker" hideWhenSingleBranch>
          <BranchPickerPrimitive.Previous className="chat-branch-btn" aria-label="Previous response">
            <ChevronLeftIcon />
          </BranchPickerPrimitive.Previous>
          <span>
            <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
          </span>
          <BranchPickerPrimitive.Next className="chat-branch-btn" aria-label="Next response">
            <ChevronRightIcon />
          </BranchPickerPrimitive.Next>
        </BranchPickerPrimitive.Root>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root className="chat-action-bar" hideWhenRunning>
      <ActionBarPrimitive.Copy className="chat-action-btn" aria-label="Copy response" title="Copy response">
        <CopyIcon />
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload className="chat-action-btn" aria-label="Regenerate response" title="Regenerate response">
        <RefreshIcon />
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
}

// Converts inline • bullet strings into proper markdown list nodes
// Converts ALL CAPS paragraph labels like "BUILD THIS:" into bold headings
function remarkCapsHeadings() {
  return (tree: import("mdast").Root) => {
    visit(tree, "paragraph", (node: import("mdast").Paragraph, index: number | undefined, parent: import("mdast").Parent | undefined) => {
      if (!parent || index == null) return;
      const raw = node.children.map((c) => ("value" in c ? c.value : "")).join("").trim();
      // Match heading-like lines: ALL CAPS, or short Title Case lines ending with : or ?
      const isAllCaps = /^[A-Z][A-Z\s\d\-&/]{1,58}:?$/.test(raw);
      const isTitleHeading = raw.length <= 60 && /^[A-Z]/.test(raw) && /[?:]$/.test(raw) && !/\./.test(raw);
      if (!isAllCaps && !isTitleHeading) return;
      node.children = [{
        type: "strong",
        data: { hProperties: { className: ["heading"] } },
        children: [{ type: "text", value: raw }],
      } as unknown as import("mdast").Strong];
    });
  };
}

function remarkInlineBullets() {
  return (tree: import("mdast").Root) => {
    visit(tree, "paragraph", (node: import("mdast").Paragraph, index: number | undefined, parent: import("mdast").Parent | undefined) => {
      if (!parent || index == null) return;
      const raw = node.children.map((c) => ("value" in c ? c.value : "")).join("");
      if (!raw.includes("•")) return;
      const parts = raw.split("•").map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2) return;

      const makeList = (items: string[]): import("mdast").List => ({
        type: "list",
        ordered: false,
        spread: false,
        children: items.map((text) => ({
          type: "listItem" as const,
          spread: false,
          children: [{ type: "paragraph" as const, children: [{ type: "text" as const, value: text }] }],
        })),
      });

      if (parent.type === "listItem") {
        // Keep the text before the first bullet as the paragraph, add sub-list after
        const [lead, ...rest] = parts;
        const replacements: import("mdast").Content[] = [
          { type: "paragraph", children: [{ type: "text", value: lead }] },
          makeList(rest),
        ];
        parent.children.splice(index, 1, ...replacements);
      } else {
        parent.children.splice(index, 1, makeList(parts));
      }
    });
  };
}

// Wraps financial figures like $2.1M, $18,903, 5%, 0.06% in <strong>
function rehypeBoldNumbers() {
  return (tree: import("hast").Root) => {
    const PATTERN = /(\$[\d,]+(?:\.\d+)?(?:[KMBTkmbt](?:\b|(?=[^a-zA-Z])))?(?:\s*-\s*\$[\d,]+(?:\.\d+)?(?:[KMBTkmbt](?:\b|(?=[^a-zA-Z])))?)?|\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?%)/g;
    visit(tree, "text", (node: import("hast").Text, index: number | undefined, parent: import("hast").Parent | undefined) => {
      if (!parent || index == null) return;
      const parts: (import("hast").Text | import("hast").Element)[] = [];
      let last = 0;
      let match;
      PATTERN.lastIndex = 0;
      while ((match = PATTERN.exec(node.value)) !== null) {
        if (match.index > last) parts.push({ type: "text", value: node.value.slice(last, match.index) });
        parts.push({ type: "element", tagName: "strong", properties: { className: ["num"] }, children: [{ type: "text", value: match[0] }] });
        last = match.index + match[0].length;
      }
      if (parts.length === 0) return;
      if (last < node.value.length) parts.push({ type: "text", value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
    });
  };
}

function MarkdownText() {
  return <MarkdownTextPrimitive className="chat-markdown" remarkPlugins={[remarkGfm, remarkCapsHeadings, remarkInlineBullets]} rehypePlugins={[rehypeBoldNumbers]} />;
}

function ToolCallGroup({
  children,
  count,
  status,
}: {
  children: ReactNode;
  count: number;
  status: string;
}) {
  const isRunning = status === "running";
  const summary = isRunning ? "Using tools" : count === 1 ? "Used 1 tool" : `Used ${count} tools`;

  return (
    <details className="chat-tool-group" open={isRunning}>
      <summary className="chat-tool-group-summary">
        <span className="chat-tool-group-label">
          <ChevronDownIcon />
          <span>{summary}</span>
        </span>
        <span className={`chat-tool-group-status${isRunning ? " active" : ""}`}>
          {isRunning ? "Running" : "Done"}
        </span>
      </summary>
      <div className="chat-tool-group-body">{children}</div>
    </details>
  );
}

function ToolCallPart(props: {
  toolName: string;
  argsText: string;
  result?: unknown;
  status: { type: string };
 }) {
  const elapsedMs = useToolCallElapsed();
  const resultText = formatToolPayload(props.result);
  const inputText = formatToolPayload(props.argsText);

  return (
    <div className="chat-tool-card">
      <div className="chat-tool-card-header">
        <div>
          <p className="chat-tool-card-eyebrow">Tool</p>
          <h3>{humanizeToolName(props.toolName)}</h3>
        </div>
        <div className="chat-tool-card-meta">
          <span className={`chat-tool-badge ${getToolBadgeClassName(props.status.type)}`}>
            {formatToolState(props.status.type)}
          </span>
          {elapsedMs !== undefined ? <span className="chat-tool-time">{formatElapsedMs(elapsedMs)}</span> : null}
        </div>
      </div>

      <ToolPayloadBlock label="Input" value={inputText} />
      <ToolPayloadBlock
        label="Output"
        value={resultText}
        placeholder={props.status.type === "running" ? "Waiting for tool result..." : "No tool output returned."}
      />
    </div>
  );
}

function ToolPayloadBlock({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
}) {
  return (
    <div className="chat-tool-payload">
      <span className="chat-tool-payload-label">{label}</span>
      <pre className="chat-tool-payload-pre">{value ?? placeholder ?? "No data."}</pre>
    </div>
  );
}

function DataStatusPart({ name, status }: { name?: string; status?: string }) {
  return (
    <div className="chat-tool-inline-status">
      {name ? humanizeToolName(name) : "Event"}
      {status ? ` · ${formatToolState(status)}` : ""}
    </div>
  );
}

function AssistantLoadingState() {
  return (
    <div className="chat-tool-inline-status active" aria-live="polite">
      <span>Thinking</span>
      <span className="chat-loading-dots">
        <span className="chat-loading-dot" />
        <span className="chat-loading-dot" />
        <span className="chat-loading-dot" />
      </span>
    </div>
  );
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && "text" in part)
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

function getSessionIdFromMetadata(metadata: AiChatMessageMetadata | undefined) {
  return typeof metadata?.session_id === "string" && metadata.session_id.length > 0
    ? metadata.session_id
    : null;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isChatBusy(status: string) {
  return status === "submitted" || status === "streaming";
}

function formatSessionDate(value?: string) {
  if (!value) {
    return "Recent";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatToolPayload(value: unknown) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function shouldHideDataPart(name?: string) {
  if (!name) {
    return false;
  }

  return /tool[-_\s]?status/i.test(name);
}

function humanizeToolName(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatToolState(status: string) {
  switch (status) {
    case "running":
      return "Running";
    case "complete":
      return "Done";
    case "incomplete":
      return "Stopped";
    case "requires-action":
      return "Needs input";
    default:
      return "Pending";
  }
}

function getToolBadgeClassName(status: string) {
  switch (status) {
    case "complete":
      return "is-complete";
    case "incomplete":
      return "is-incomplete";
    case "requires-action":
      return "is-warning";
    default:
      return "is-running";
  }
}

function formatElapsedMs(value: number) {
  if (value < 1000) {
    return `${value}ms`;
  }

  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}s`;
}

function BoldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4h8a4 4 0 0 1 0 8H6V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 12h9a4 4 0 0 1 0 8H6V12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="4" cy="6" r="1.5" fill="currentColor" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" />
      <path d="M8 6H20M8 12H20M8 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5M5 12L12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7H17V17H7V7Z" fill="currentColor" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5V19M5 12L12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 8V5C8 3.9 8.9 3 10 3H19C20.1 3 21 3.9 21 5V14C21 15.1 20.1 16 19 16H16M5 8H14C15.1 8 16 8.9 16 10V19C16 20.1 15.1 21 14 21H5C3.9 21 3 20.1 3 19V10C3 8.9 3.9 8 5 8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6V11H15M4 18V13H9M18.5 9A7 7 0 0 0 6.1 6.4L4 8.5M5.5 15A7 7 0 0 0 17.9 17.6L20 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C10.9 2 10 2.9 10 4V12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12V4C14 2.9 13.1 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10M12 19V22M8 22H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SendArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="send-arrow-grad" x1="6.05858" y1="1.75946" x2="6.05858" y2="10.5475" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B37F40" />
          <stop offset="1" stopColor="#432411" />
        </linearGradient>
        <clipPath id="send-arrow-clip">
          <rect width="12.3077" height="12.3077" fill="white" />
        </clipPath>
      </defs>
      <g clipPath="url(#send-arrow-clip)">
        <path d="M5.38478 6.15388H2.56427M2.52085 6.30337L1.32346 9.88014C1.22939 10.1611 1.18235 10.3016 1.21611 10.3882C1.24542 10.4633 1.30838 10.5203 1.38606 10.5419C1.47551 10.5669 1.61062 10.5061 1.88085 10.3845L10.4508 6.52801C10.7146 6.40932 10.8465 6.34997 10.8872 6.26753C10.9226 6.1959 10.9226 6.11187 10.8872 6.04024C10.8465 5.9578 10.7146 5.89845 10.4508 5.77976L1.87786 1.92195C1.60845 1.80071 1.47375 1.7401 1.38438 1.76496C1.30677 1.78656 1.24382 1.84337 1.21441 1.91837C1.18054 2.00472 1.22707 2.14492 1.32014 2.42531L2.52119 6.0439C2.53717 6.09206 2.54516 6.11613 2.54832 6.14076C2.55112 6.16261 2.55109 6.18473 2.54823 6.20658C2.54501 6.2312 2.53696 6.25526 2.52085 6.30337Z" stroke="url(#send-arrow-grad)" strokeWidth="1.23077" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5.15625 18.2812H14.8438C16.7422 18.2812 18.2812 16.7422 18.2812 14.8438V5.15625C18.2812 3.25777 16.7422 1.71875 14.8438 1.71875H5.15625C3.25777 1.71875 1.71875 3.25777 1.71875 5.15625V14.8438C1.71875 16.7422 3.25777 18.2812 5.15625 18.2812Z" stroke="#262C31" strokeWidth="1.4"/>
      <path d="M7.5 18.2812V1.71875" stroke="#262C31" strokeWidth="1.4"/>
      <path d="M11.0156 11.9922L13.3594 9.64844L11.0156 7.30469" stroke="#262C31" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5.15625 18.2812H14.8438C16.7422 18.2812 18.2812 16.7422 18.2812 14.8438V5.15625C18.2812 3.25777 16.7422 1.71875 14.8438 1.71875H5.15625C3.25777 1.71875 1.71875 3.25777 1.71875 5.15625V14.8438C1.71875 16.7422 3.25777 18.2812 5.15625 18.2812Z" stroke="#262C31" strokeWidth="1.4"/>
      <path d="M7.5 18.2812V1.71875" stroke="#262C31" strokeWidth="1.4"/>
      <path d="M13.3594 11.9922L11.0156 9.64844L13.3594 7.30469" stroke="#262C31" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7H21V9H3V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 9V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 13H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UnarchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7H21V9H3V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 9V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 18V12M12 12L9.5 14.5M12 12L14.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <defs><clipPath id="pin-clip"><rect width="16" height="16" fill="white"/></clipPath></defs>
      <g clipPath="url(#pin-clip)">
        <path d="M5.58447 10.4109L1.81323 14.1821M7.79626 4.4279L6.75567 5.46849C6.67079 5.55337 6.62834 5.59581 6.57999 5.62954C6.53707 5.65947 6.49078 5.68425 6.44206 5.70335C6.38718 5.72488 6.32832 5.73665 6.21061 5.76019L3.76764 6.24879C3.13277 6.37576 2.81533 6.43925 2.66683 6.60662C2.53745 6.75242 2.47837 6.94755 2.50514 7.14064C2.53586 7.36227 2.76477 7.59118 3.22258 8.04899L7.9464 12.7728C8.40421 13.2306 8.63312 13.4595 8.85476 13.4903C9.04784 13.517 9.24297 13.4579 9.38878 13.3286C9.55614 13.1801 9.61963 12.8626 9.7466 12.2278L10.2352 9.78478C10.2587 9.66707 10.2705 9.60821 10.292 9.55333C10.3111 9.50462 10.3359 9.45832 10.3659 9.4154C10.3996 9.36705 10.442 9.32461 10.5269 9.23972L11.5675 8.19913C11.6218 8.14486 11.6489 8.11773 11.6787 8.09404C11.7052 8.07299 11.7333 8.05399 11.7627 8.0372C11.7957 8.01831 11.831 8.00319 11.9016 7.97296L13.5645 7.26029C14.0496 7.05237 14.2922 6.94841 14.4024 6.78042C14.4987 6.63352 14.5332 6.45452 14.4983 6.28234C14.4584 6.08544 14.2718 5.89883 13.8985 5.52562L10.4698 2.09686C10.0966 1.72364 9.90995 1.53703 9.71305 1.49712C9.54087 1.46221 9.36187 1.49669 9.21497 1.59304C9.04698 1.70323 8.94302 1.94579 8.73511 2.43093L8.02243 4.09383C7.9922 4.16437 7.97708 4.19965 7.95819 4.23272C7.9414 4.2621 7.9224 4.29017 7.90136 4.31666C7.87767 4.34649 7.85053 4.37363 7.79626 4.4279Z" stroke="black" strokeOpacity="0.3" strokeWidth="1.84615" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <defs><clipPath id="lock-clip"><rect width="16" height="16" fill="white"/></clipPath></defs>
      <g clipPath="url(#lock-clip)">
        <path d="M4.06283 7.48587C4.02139 7.21883 3.99989 6.94525 3.99989 6.66668C3.99989 3.72116 6.40342 1.33334 9.36831 1.33334C12.3332 1.33334 14.7367 3.72116 14.7367 6.66668C14.7367 7.33206 14.6141 7.96898 14.39 8.55635C14.3435 8.67833 14.3202 8.73933 14.3097 8.78695C14.2992 8.83413 14.2951 8.86733 14.294 8.91564C14.2929 8.96441 14.2995 9.01813 14.3127 9.12556L14.5811 11.3057C14.6101 11.5417 14.6247 11.6597 14.5854 11.7455C14.551 11.8207 14.4899 11.8804 14.414 11.913C14.3273 11.9503 14.2097 11.933 13.9744 11.8986L11.8509 11.5873C11.74 11.571 11.6846 11.5629 11.6341 11.5632C11.5841 11.5635 11.5496 11.5672 11.5007 11.5774C11.4513 11.5878 11.3882 11.6115 11.2619 11.6588C10.673 11.8793 10.0349 12 9.36831 12C9.08952 12 8.81569 11.9789 8.54836 11.9382M5.08764 14.6667C7.06424 14.6667 8.66659 13.0251 8.66659 11C8.66659 8.97497 7.06424 7.33334 5.08764 7.33334C3.11104 7.33334 1.50869 8.97497 1.50869 11C1.50869 11.4071 1.57344 11.7986 1.69295 12.1645C1.74347 12.3191 1.76873 12.3965 1.77702 12.4493C1.78568 12.5045 1.7872 12.5354 1.78397 12.5912C1.78088 12.6445 1.76753 12.7049 1.74081 12.8255L1.33325 14.6667L3.32979 14.394C3.43876 14.3791 3.49325 14.3717 3.54083 14.372C3.59093 14.3723 3.61752 14.3751 3.66666 14.3849C3.71332 14.3942 3.78269 14.4186 3.92143 14.4676C4.28698 14.5966 4.67932 14.6667 5.08764 14.6667Z" stroke="black" strokeOpacity="0.3" strokeWidth="1.84615" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  );
}
