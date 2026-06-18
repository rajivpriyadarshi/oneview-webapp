"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import { MobileHeader } from "../components/MobileHeader";
import {
  type AiChatSession,
  aiChatFetch,
  createAiChatSession,
  createTitleFromPrompt,
  getAiAgentSlug,
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

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
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
    setSelectedSessionId(session.id);
    setIsLoadingMessages(true);
    setNotice(null);

    try {
      const messages = await loadAiChatMessages(session.id);
      setInitialMessages(messages);
    } catch (error) {
      console.error("Failed to load AI chat messages:", error);
      setInitialMessages([]);
      setNotice("This chat could not be loaded. Try another session or start a new one.");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const startNewChat = async () => {
    setIsCreatingSession(true);
    setNotice(null);

    try {
      const session = await createAiChatSession();
      setSessions((current) => mergeAiChatSessions([session], current));
      setSelectedSessionId(session.id);
      setInitialMessages([]);
    } catch (error) {
      console.error("Failed to create AI chat session:", error);
      setNotice("Could not start a chat. Check that you are signed in and the AI API is reachable.");
    } finally {
      setIsCreatingSession(false);
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

  const updateSelectedSessionTimestamp = () => {
    if (!selectedSession) {
      return;
    }

    const nextSession = {
      ...selectedSession,
      updated_at: new Date().toISOString(),
    };

    upsertStoredAiChatSession(nextSession);
    setSessions((current) => mergeAiChatSessions([nextSession], current));
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
                disabled={isCreatingSession}
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
              disabled={isCreatingSession}
            >
              <PlusIcon />
              <span>{isCreatingSession ? "Starting..." : "New chat"}</span>
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
            {selectedSession ? (
              isLoadingMessages ? (
                <div className="chat-loading-state">Loading chat...</div>
              ) : (
                <ChatThread
                  key={selectedSession.id}
                  session={selectedSession}
                  initialMessages={initialMessages}
                  onPromptSubmitted={updateSessionFromPrompt}
                  onAssistantFinished={updateSelectedSessionTimestamp}
                />
              )
            ) : (
              <EmptyChatState onStart={startNewChat} isCreating={isCreatingSession} />
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}

type ChatThreadProps = {
  session: AiChatSession;
  initialMessages: UIMessage[];
  onPromptSubmitted: (prompt: string) => void;
  onAssistantFinished: () => void;
};

function ChatThread({ session, initialMessages, onPromptSubmitted, onAssistantFinished }: ChatThreadProps) {
  const [input, setInput] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const agent = getAiAgentSlug();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: getAiChatMessagesUrl(session.id),
        credentials: "include",
        headers: getAiRequestHeaders(),
        fetch: aiChatFetch,
        body: {
          metadata: {
            agent,
          },
        },
        prepareSendMessagesRequest({ messages, body, credentials, headers, api }) {
          const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");

          return {
            api,
            credentials,
            headers,
            body: {
              ...body,
              message: latestUserMessage,
              messages,
              metadata: {
                agent,
              },
            },
          };
        },
      }),
    [agent, session.id],
  );

  const chat = useChat({
    id: session.id,
    messages: initialMessages,
    transport,
    onFinish: onAssistantFinished,
    onError(error) {
      console.error("AI chat stream failed:", error);
    },
  });

  const isBusy = chat.status === "submitted" || chat.status === "streaming";

  useEffect(() => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat.messages, chat.status]);

  const submitMessage = async (event?: FormEvent<HTMLFormElement>, overrideText?: string) => {
    event?.preventDefault();
    const text = (overrideText ?? input).trim();

    if (!text || isBusy) {
      return;
    }

    setInput("");
    onPromptSubmitted(text);

    await chat.sendMessage(
      {
        text,
        metadata: {
          created_at: new Date().toISOString(),
        },
      },
      {
        body: {
          metadata: {
            agent,
          },
        },
        metadata: {
          agent,
        },
      },
    );
  };

  return (
    <div className="chat-thread">
      <div className="chat-thread-topbar">
        <div>
          <p className="chat-kicker">Wealth advisor</p>
          <h2>{session.title}</h2>
        </div>
        <span className={`chat-status ${isBusy ? "active" : ""}`}>
          {chat.status === "streaming" ? "Answering" : chat.status === "submitted" ? "Thinking" : "Ready"}
        </span>
      </div>

      <div ref={viewportRef} className={`chat-message-viewport${chat.messages.length === 0 ? " is-empty" : ""}`}>
        {chat.messages.length === 0 ? (
          <div className="chat-empty-copy">
            <div className="chat-search-avatar">
              <SearchIcon />
            </div>
            <p className="chat-wordmark">perplexity</p>
            <p className="chat-empty-subtitle">Ask about portfolio moves, allocation, documents, or recent account activity.</p>
            <div className="chat-suggestions">
              {PROMPT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submitMessage(undefined, suggestion)}
                  disabled={isBusy}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chat.messages.map((message) => <ChatMessageBubble key={message.id} message={message} />)
        )}
      </div>

      {chat.error ? (
        <div className="chat-error-banner" role="alert">
          {chat.error.message || "The chat stream failed. Please try again."}
        </div>
      ) : null}

      <form className="chat-composer-wrap" onSubmit={submitMessage}>
        <div className="chat-composer">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitMessage();
              }
            }}
            placeholder="Ask anything about your wealth..."
            rows={2}
          />
          <div className="chat-composer-footer">
            <span className="chat-agent-pill">
              <SearchIcon />
              {agent}
            </span>
            <button
              type={isBusy ? "button" : "submit"}
              className="chat-send-btn"
              onClick={isBusy ? chat.stop : undefined}
              disabled={!isBusy && input.trim().length === 0}
              aria-label={isBusy ? "Stop response" : "Send message"}
              title={isBusy ? "Stop response" : "Send message"}
            >
              {isBusy ? <StopIcon /> : <ArrowUpIcon />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function EmptyChatState({ onStart, isCreating }: { onStart: () => void; isCreating: boolean }) {
  return (
    <div className="chat-empty-start">
      <div className="chat-search-avatar">
        <SearchIcon />
      </div>
      <p className="chat-wordmark">perplexity</p>
      <p className="chat-empty-subtitle">Start a session with your wealth advisor.</p>
      <button type="button" className="chat-start-btn" onClick={onStart} disabled={isCreating}>
        <PlusIcon />
        <span>{isCreating ? "Starting..." : "Start new chat"}</span>
      </button>
    </div>
  );
}

function ChatMessageBubble({ message }: { message: UIMessage }) {
  const text = getMessageText(message);
  const toolStatuses = getToolStatuses(message);

  return (
    <article className={`chat-message ${message.role}`}>
      {message.role === "assistant" ? (
        <div className="chat-message-avatar">
          <SearchIcon />
        </div>
      ) : null}
      <div className="chat-message-content">
        {text ? <p>{text}</p> : null}
        {toolStatuses.map((status, index) => (
          <div key={`${message.id}-tool-${index}`} className="chat-tool-status">
            {status}
          </div>
        ))}
      </div>
    </article>
  );
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && "text" in part)
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

function getToolStatuses(message: UIMessage) {
  return message.parts.flatMap((part) => {
    if (!part.type.startsWith("data-tool-status")) {
      return [];
    }

    const data = "data" in part ? part.data : part;
    if (typeof data === "string") {
      return [data];
    }

    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const label = [record.tool, record.name, record.status, record.message]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(" - ");

      return label ? [label] : ["Tool activity"];
    }

    return ["Tool activity"];
  });
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
