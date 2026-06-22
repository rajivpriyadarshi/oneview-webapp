"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import type { UIMessage } from "ai";
import remarkGfm from "remark-gfm";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import { MobileHeader } from "../components/MobileHeader";
import {
  type AiChatSession,
  aiChatFetch,
  createTitleFromPrompt,
  getAiAgentSlug,
  getAiChatsUrl,
  getAiChatMessagesUrl,
  getAiRequestHeaders,
  listAiChatSessions,
  loadAiChatMessages,
  mergeAiChatSessions,
  readStoredAiChatSessions,
  upsertStoredAiChatSession,
} from "../lib/aiChatApi";
import "./chat.css";

const PROMPT_SUGGESTIONS = [
  "What changed in my portfolio?",
  "Where am I overexposed?",
  "Summarize my recent account activity",
];

type AiChatMessageMetadata = {
  session_id?: string;
  message_id?: string;
  client_message_id?: string;
};

type ChatUiMessage = UIMessage<AiChatMessageMetadata>;

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatUiMessage[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isDraftChat, setIsDraftChat] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      const storedSessions = readStoredAiChatSessions();
      if (!cancelled) {
        setSessions(storedSessions);
      }

      try {
        const serverSessions = await listAiChatSessions();
        if (cancelled) {
          return;
        }

        const mergedSessions = mergeAiChatSessions(serverSessions, storedSessions);
        setSessions(mergedSessions);
        setNotice(null);
      } catch {
        if (!cancelled) {
          setNotice("Chat history is stored on this browser until backend listing is available.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSessions(false);
        }
      }
    }

    loadSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
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
  };

  return (
    <ProtectedRoute>
      <div className="chat-page-shell">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <MobileHeader onMenuOpen={() => setSidebarOpen(true)} />
        <main className="chat-page-main">
          <aside className="chat-session-rail" aria-label="Chat sessions">
            <div className="chat-session-rail-header">
              <div>
                <p className="chat-kicker">AI advisor</p>
                <h1>Chat</h1>
              </div>
              <button
                type="button"
                className="chat-new-icon-btn"
                onClick={startNewChat}
                aria-label="Start new chat"
                title="Start new chat"
              >
                <PlusIcon />
              </button>
            </div>

            <button
              type="button"
              className="chat-new-session-btn"
              onClick={startNewChat}
            >
              <PlusIcon />
              <span>New chat</span>
            </button>

            <div className="chat-session-list">
              {isLoadingSessions ? (
                <p className="chat-session-muted">Loading chats...</p>
              ) : sessions.length === 0 ? (
                <p className="chat-session-muted">No chats yet.</p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={`chat-session-item${session.id === selectedSessionId ? " active" : ""}`}
                    onClick={() => selectSession(session)}
                  >
                    <span className="chat-session-title">{session.title}</span>
                    <span className="chat-session-meta">
                      {formatSessionDate(session.updated_at ?? session.created_at)}
                    </span>
                  </button>
                ))
              )}
            </div>

            {notice ? <p className="chat-rail-notice">{notice}</p> : null}
          </aside>

          <section className="chat-thread-panel" aria-label="Wealth advisor chat">
            {selectedSession || isDraftChat ? (
              isLoadingMessages ? (
                <div className="chat-loading-state">Loading chat...</div>
              ) : (
                <ChatThread
                  key={selectedSession?.id ?? "draft"}
                  session={selectedSession}
                  initialMessages={initialMessages}
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

type ChatThreadProps = {
  session: AiChatSession | null;
  initialMessages: ChatUiMessage[];
  onPromptSubmitted: (prompt: string) => void;
  onAssistantFinished: (details: {
    sessionId: string | null;
    prompt: string | null;
    messages: ChatUiMessage[];
  }) => void;
};

function ChatThread({ session, initialMessages, onPromptSubmitted, onAssistantFinished }: ChatThreadProps) {
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
        <div className="chat-thread-topbar">
          <div>
            <p className="chat-kicker">Wealth advisor</p>
            <h2>{session?.title ?? "New chat"}</h2>
          </div>
          <span className={`chat-status ${isChatBusy(chat.status) ? "active" : ""}`}>
            {chat.status === "streaming" ? "Answering" : chat.status === "submitted" ? "Thinking" : "Ready"}
          </span>
        </div>

        <ThreadPrimitive.Root className="chat-assistant-thread">
          <AuiIf condition={(state) => state.thread.isEmpty}>
            <div className="chat-message-viewport is-empty">
              <div className="chat-empty-copy">
                <p className="chat-wordmark">OneView</p>
                <p className="chat-empty-subtitle">
                  Ask about portfolio moves, allocation, documents, or recent account activity.
                </p>
                <div className="chat-suggestions">
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <ThreadPrimitive.Suggestion key={suggestion} prompt={suggestion} send>
                      {suggestion}
                    </ThreadPrimitive.Suggestion>
                  ))}
                </div>
              </div>
              <Composer placeholder="Ask anything about your wealth..." agent={agent} />
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
                <Composer placeholder="Ask a follow-up..." agent={agent} />
              </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
          </AuiIf>
        </ThreadPrimitive.Root>

        {chat.error ? (
          <div className="chat-error-banner" role="alert">
            {chat.error.message || "The chat stream failed. Please try again."}
          </div>
        ) : null}
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

function Composer({ placeholder, agent }: { placeholder: string; agent: string }) {
  return (
    <ComposerPrimitive.Root className="chat-composer-wrap">
      <div className="chat-composer">
        <ComposerPrimitive.Input
          className="chat-composer-input"
          placeholder={placeholder}
          rows={2}
          autoFocus
        />
        <div className="chat-composer-footer">
          <span className="chat-agent-pill">
            <SearchIcon />
            {agent}
          </span>
          <ComposerPrimaryAction />
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
    </MessagePrimitive.Root>
  );
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root className="chat-action-bar" hideWhenRunning autohide="not-last">
      <ActionBarPrimitive.Copy className="chat-action-btn" aria-label="Copy response" title="Copy response">
        <CopyIcon />
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload className="chat-action-btn" aria-label="Regenerate response" title="Regenerate response">
        <RefreshIcon />
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
}

function MarkdownText() {
  return <MarkdownTextPrimitive className="chat-markdown" remarkPlugins={[remarkGfm]} />;
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
      <span className="chat-loading-dot" />
      <span>Working…</span>
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
