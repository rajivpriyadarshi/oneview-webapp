"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  groupPartByType,
  type MessageState,
  MessagePrimitive,
  ThreadPrimitive,
  useToolCallElapsed,
  useThread,
  useThreadRuntime,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import type { ChatTransport, UIMessage } from "ai";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import Sidebar from "../components/Sidebar";
import {
  type AiChatSession,
  type ChatPrompt,
  aiChatFetch,
  createTitleFromPrompt,
  getAiAgentSlug,
  getAiRequestHeaders,
  getCrmClientChatsUrl,
  getCrmClientChatMessagesUrl,
  listAiChatSessions,
  listChatPrompts,
  listChatWorkflowCommands,
  loadAiChatMessages,
  mergeAiChatSessions,
  readStoredAiChatSessions,
  upsertStoredAiChatSession,
  writeStoredAiChatSessions,
} from "../lib/aiChatApi";
import { appConfig } from "../lib/config";
import {
  getWealthCrmClient,
  listWealthCrmClients,
  type WealthCrmClient,
} from "../lib/wealthCrmApi";

type ClientGroup = {
  client: WealthCrmClient;
  sessions: AiChatSession[];
  isLoading: boolean;
  isExpanded: boolean;
};

const DEFAULT_COMPOSER_PROMPTS: ChatPrompt[] = [
  {
    id: -10_001,
    title: "Portfolio review",
    description: "Review the portfolio and identify priority follow-ups.",
    user_message: "Review my portfolio and identify priority follow-ups.",
  },
  {
    id: -10_002,
    title: "Meeting prep",
    description: "Prepare talking points for an upcoming client meeting.",
    user_message: "Help me prepare talking points for my next client meeting.",
  },
  {
    id: -10_003,
    title: "Opportunity finder",
    description: "Find portfolio opportunities based on current holdings.",
    user_message: "Find portfolio opportunities based on current holdings.",
  },
];

type AiChatMessageMetadata = {
  session_id?: string;
  message_id?: string;
  client_message_id?: string;
  workflow_intent?: {
    tool_name: string;
    mode: "suggest" | "run";
  };
};

type ReplySuggestionsData = {
  suggestions: string[];
};

type AiChatDataParts = {
  "reply-suggestions": ReplySuggestionsData;
};

type ChatUiMessage = UIMessage<AiChatMessageMetadata, AiChatDataParts>;

const WARM_CHAT_CACHE_MAX_AGE_MS = 30_000;
const PENDING_LOCAL_CHAT_MAX_AGE_MS = 2 * 60_000;

const TW = {
  promptChipsRow: "mb-[10px] flex items-center justify-between gap-[4px] overflow-hidden rounded-[22px] p-[10px] pt-[8px] pb-[0px]",
  promptChipsLeft: "flex min-w-0 flex-1 items-center gap-[12px] overflow-hidden max-[640px]:gap-[8px]",
  promptChipsLeftExpanded: "!overflow-visible flex-wrap",
  promptChip: "inline-flex min-w-0 shrink-0 cursor-pointer items-center rounded-full border border-white/60 bg-[url('/insights.png')] bg-cover bg-center px-[11px] py-[7px] font-satoshi text-[12px] font-normal leading-[16.2px] text-[#5d6b77] transition hover:brightness-95 max-[640px]:max-w-[145px] max-[640px]:truncate",
  promptChipExpand: "inline-flex h-[32px] w-[40px] shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/60 text-black transition hover:bg-white/85 [&_svg]:h-[13px] [&_svg]:w-[13px]",
  promptMeasure: "pointer-events-none invisible absolute -z-10 flex items-center gap-[12px] whitespace-nowrap max-[640px]:gap-[8px]",
  promptMeasureChip: "inline-flex shrink-0 items-center rounded-full border border-white/60 bg-black/[0.035] px-[11px] py-[7px] font-satoshi text-[12px] font-normal leading-[16.2px] text-[#5d6b77]",
  composerWrap: "mx-auto w-full max-w-[720px] rounded-[30px] bg-[#F7F7F7] max-[640px]:rounded-[28px] pt-[10px]",
  composer: "relative mx-auto flex min-h-[56px] w-full items-center rounded-[24px] border border-black/[0.06] bg-white py-[8px] transition",
  composerThinking: "ring-1 ring-[#b37f40]/40",
  composerInputRow: "flex-1 min-w-0 px-[14px] max-[640px]:px-[14px]",
  composerInput: "h-auto min-h-0 w-full resize-none border-0 bg-transparent p-0 font-satoshi text-[14px] font-normal leading-[1.2] text-black outline-none [overflow-wrap:break-word] placeholder:text-[14px] placeholder:font-normal placeholder:leading-[1.2] placeholder:text-black/38",
  sendBtn: "inline-grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border-0 bg-black p-0 text-white transition hover:-translate-y-px hover:bg-[#2d2926] disabled:bg-black disabled:text-white [&_svg]:h-[20px] [&_svg]:w-[20px]",
  messageUser: "mb-[18px] flex w-full justify-end gap-2.5",
  messageAssistant: "mb-[18px] flex w-full justify-start gap-2.5",
  messageContent: "max-w-full [overflow-wrap:anywhere] rounded-lg font-satoshi text-[13px] leading-relaxed text-black",
  userMessageContent: "rounded-[20px_20px_4px_20px] border border-white/50 bg-[#f4f4f4]/70 px-[16px] py-[14px] text-black shadow-[0_2px_4px_rgba(0,0,0,0.04)]",
  assistantMessageContent: "py-1",
  messageStack: "max-w-full",
  replySuggestions: "mt-2 mb-1.5 flex max-w-full flex-wrap gap-2",
  replyPill: "inline-flex min-h-[34px] max-w-full items-center [overflow-wrap:anywhere] rounded-full border border-[#171615]/10 bg-white/40 px-[12px] py-[8px] text-left font-satoshi text-[13px] font-medium leading-[17px] text-[#171615] transition hover:-translate-y-px hover:border-[#7f4e0b]/30 hover:bg-white/70",
  messageControls: "mt-2 inline-flex items-center gap-1.5",
  inlineControls: "inline-flex items-center gap-1.5 text-[#171615]/50",
  actionBtn: "inline-grid h-[30px] w-[30px] place-items-center rounded-full border border-white/60 bg-white/50 text-[#171615]/60 shadow-sm backdrop-blur transition hover:-translate-y-px hover:bg-white/70 hover:text-[#171615]",
  branchCount: "font-satoshi text-[12px] font-bold tabular-nums",
  markdown: "[overflow-wrap:anywhere] font-satoshi text-[14px] leading-[18.9px] text-black/90 [&_a]:text-[#0e5f5b] [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[#0e5f5b]/20 [&_blockquote]:pl-[14px] [&_blockquote]:text-[#171615]/70 [&_code]:rounded [&_code]:bg-[#171615]/10 [&_code]:px-[6px] [&_code]:py-[2px] [&_code]:font-mono [&_code]:text-[0.88em] [&_h1]:mb-[10px] [&_h1]:text-[1em] [&_h1]:font-bold [&_h2]:mb-[10px] [&_h2]:text-[1em] [&_h2]:font-bold [&_h3]:mb-[10px] [&_h3]:text-[1em] [&_h3]:font-bold [&_li]:my-[4px] [&_ol]:mb-[16px] [&_ol]:list-decimal [&_ol]:pl-[20px] [&_p]:mb-[16px] [&_pre]:mb-[16px] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#171615]/10 [&_pre]:p-[12px] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_table]:mb-[16px] [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#171615]/10 [&_td]:p-[8px] [&_th]:border [&_th]:border-[#171615]/10 [&_th]:bg-white/60 [&_th]:p-[8px] [&_th]:text-left [&_th]:font-bold [&_ul]:mb-[16px] [&_ul]:list-disc [&_ul]:pl-[20px] [&>*:last-child]:mb-0",
  toolGroup: "my-3 overflow-hidden rounded-[10px] border border-[#0e5f5b]/10 bg-white/70",
  toolSummary: "flex cursor-pointer list-none items-center justify-between gap-2.5 px-3.5 py-3 select-none [&::-webkit-details-marker]:hidden",
  toolLabel: "inline-flex items-center gap-[8px] font-satoshi text-[12px] font-bold text-[#0e5f5b] [&_svg]:transition-transform",
  toolStatus: "font-satoshi text-[12px] font-bold text-[#171615]/55",
  toolStatusActive: "text-[#0e5f5b]",
  toolBody: "grid gap-2.5 px-3 pb-3",
  toolCard: "rounded-xl border border-[#171615]/10 bg-[#fffdf9] p-3",
  toolCardHeader: "mb-2.5 flex items-start justify-between gap-2.5",
  toolEyebrow: "m-0 mb-[2px] font-satoshi text-[10px] font-bold uppercase tracking-[0.08em] text-[#171615]/50",
  toolTitle: "m-0 font-satoshi text-[13px] font-bold leading-tight",
  toolMeta: "inline-flex flex-wrap items-center justify-end gap-2",
  toolBadge: "inline-flex w-fit items-center gap-[6px] rounded-full border px-[10px] py-[4px] font-satoshi text-[11px] font-bold leading-tight",
  toolTime: "inline-flex w-fit items-center gap-[6px] rounded-full bg-[#171615]/5 px-[10px] py-[4px] font-satoshi text-[11px] font-bold leading-tight text-[#171615]/60",
  toolPayload: "grid gap-1.5",
  toolPayloadLabel: "font-satoshi text-[10px] font-bold uppercase tracking-[0.08em] text-[#171615]/50",
  toolPayloadPre: "m-0 overflow-x-auto [overflow-wrap:anywhere] whitespace-pre-wrap rounded-[10px] bg-[#171615]/5 px-[12px] py-[10px] font-mono text-[12px] leading-normal text-[#171615]",
  inlineStatusActive: "mt-[10px] inline-flex items-center gap-[6px] bg-transparent px-0 py-[4px] font-satoshi text-[12px] font-normal text-black/50",
  loadingDots: "ml-0.5 inline-flex items-center gap-[3px]",
  loadingDot: "h-1 w-1 rounded-full bg-current",
};

export default function ChatOnePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedClientId = searchParams.get("clientId") ?? searchParams.get("client_id");
  const [clients, setClients] = useState<WealthCrmClient[]>([]);
  const [clientGroups, setClientGroups] = useState<Map<number | string, ClientGroup>>(new Map());
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatUiMessage[]>([]);
  const [chatResetId, setChatResetId] = useState(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [prompts, setPrompts] = useState<ChatPrompt[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const chatClientId = selectedClientId ?? requestedClientId ?? clients[0]?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    async function loadClients() {
      setIsLoadingClients(true);
      try {
        const activeClients = await listWealthCrmClients({ isActive: true });
        const allClients = activeClients.length > 0 ? activeClients : await listWealthCrmClients();
        if (!cancelled) setClients(allClients);
      } catch {
        if (!cancelled) setClients([]);
      } finally {
        if (!cancelled) setIsLoadingClients(false);
      }
    }
    void loadClients();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listChatWorkflowCommands({ agent: getAiAgentSlug() }).then((commands) => {
      if (cancelled) return;
      setPrompts(commands.map((command, index): ChatPrompt => ({
        id: -index - 1,
        title: command.name || command.command.replace(/^\//, ""),
        description: command.description || command.command,
        user_message: command.command,
        workflow_intent: { tool_name: command.tool_name, mode: "run" },
      })));
    }).catch(() => { if (!cancelled) setPrompts([]); });
    return () => { cancelled = true; };
  }, []);

  const toggleClientGroup = useCallback(async (client: WealthCrmClient) => {
    const clientId = client.id;
    setClientGroups((prev) => {
      const existing = prev.get(clientId);
      if (existing?.isExpanded) {
        const next = new Map(prev);
        next.set(clientId, { ...existing, isExpanded: false });
        return next;
      }
      if (existing && existing.sessions.length > 0) {
        const next = new Map(prev);
        next.set(clientId, { ...existing, isExpanded: true });
        return next;
      }
      const next = new Map(prev);
      next.set(clientId, { client, sessions: [], isLoading: true, isExpanded: true });
      return next;
    });

    const existing = clientGroups.get(clientId);
    if (existing?.isExpanded || (existing && existing.sessions.length > 0)) return;

    try {
      const sessions = getVisibleSessions(await listAiChatSessions({ clientId }));
      setClientGroups((prev) => {
        const next = new Map(prev);
        next.set(clientId, { client, sessions, isLoading: false, isExpanded: true });
        return next;
      });
    } catch {
      setClientGroups((prev) => {
        const next = new Map(prev);
        next.set(clientId, { client, sessions: [], isLoading: false, isExpanded: true });
        return next;
      });
    }
  }, [clientGroups]);

  const refreshClientSessions = useCallback(async (clientId: number | string) => {
    try {
      const sessions = getVisibleSessions(await listAiChatSessions({ clientId }));
      setClientGroups((prev) => {
        const existing = prev.get(clientId);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(clientId, { ...existing, sessions, isLoading: false });
        return next;
      });
    } catch { /* keep existing */ }
  }, []);

  const selectedSession = useMemo(() => {
    for (const group of clientGroups.values()) {
      const found = group.sessions.find((s) => s.id === selectedSessionId);
      if (found) return found;
    }
    return null;
  }, [selectedSessionId, clientGroups]);

  const selectSession = async (session: AiChatSession, clientId: number | string) => {
    setHasStartedChat(true);
    setSelectedSessionId(session.id);
    setSelectedClientId(clientId);
    setIsLoadingMessages(true);
    try {
      const messages = (await loadAiChatMessages(session.id, { clientId })) as ChatUiMessage[];
      setInitialMessages(messages);
    } catch {
      setInitialMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const startNewChat = () => {
    setHasStartedChat(false);
    setSelectedSessionId(null);
    setInitialMessages([]);
    setChatResetId((id) => id + 1);
  };

  const handleAssistantFinished = ({ sessionId, prompt, messages }: { sessionId: string | null; prompt: string | null; messages: ChatUiMessage[] }) => {
    setHasStartedChat(true);
    if (!sessionId) return;
    const existingSession = selectedSession;
    const nextSession: AiChatSession = {
      id: sessionId,
      title: existingSession?.title && existingSession.title !== "New chat" ? existingSession.title : createTitleFromPrompt(prompt ?? ""),
      agent: existingSession?.agent ?? getAiAgentSlug(),
      client_id: existingSession?.client_id ?? chatClientId ?? undefined,
      created_at: existingSession?.created_at,
      updated_at: new Date().toISOString(),
      source: existingSession?.source ?? "local",
    };
    upsertStoredAiChatSession(nextSession);
    setInitialMessages(messages);
    setSelectedSessionId(sessionId);
    if (chatClientId) {
      window.setTimeout(() => void refreshClientSessions(chatClientId), 500);
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white">
      {/* Background */}
      <img src="/chat-vector-bg.png" alt="" className="pointer-events-none absolute bottom-0 left-0 w-full" />

      <Sidebar />

      {/* Top Header Bar */}
      <header className="fixed left-[80px] right-0 top-0 z-50 flex items-center justify-between border-b border-black/10 bg-white/20 px-6 py-2.5 backdrop-blur-[32px]">
        <h1 className="m-0 text-[22px] font-medium leading-[26.4px] text-black" style={{ fontFamily: "var(--font-butler)" }}>AI assistant</h1>
        <button type="button" onClick={startNewChat} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-3 font-satoshi text-[12px] font-medium leading-[18px] text-white shadow-[0_3px_4px_rgba(0,0,0,0.04)] transition hover:bg-[#2d2926]">
          New chat
        </button>
      </header>

      {/* Main layout */}
      <div className="ml-[80px] flex h-screen pt-[60px]">
        {/* Left Panel */}
        <aside className={`relative h-full shrink-0 border-r border-black/10 backdrop-blur-[12px] transition-all duration-300 max-[900px]:hidden ${sidebarCollapsed ? "w-0 overflow-hidden border-r-0" : "w-[348px]"}`}>
          {/* Search input */}
          <div className="px-3 pt-6 pb-4">
            <div className="flex items-center justify-between rounded-full bg-white px-[14px] py-3" style={{ outline: "1px solid rgba(0,0,0,0.10)", outlineOffset: "-1px" }}>
              <span className="font-satoshi text-[14px] leading-[18px] text-black/60">Search your chat</span>
              <SearchIcon />
            </div>
          </div>
          <div className="absolute left-[13px] right-[13px] top-[88px] bottom-0 overflow-y-auto">
            {isLoadingClients ? (
              <div className="py-6 text-center font-satoshi text-[12px] text-black/40">Loading clients...</div>
            ) : (
              clients.map((client) => {
                const group = clientGroups.get(client.id);
                const isExpanded = group?.isExpanded ?? false;
                const initial = (client.display_name || "?").trim()[0].toUpperCase();
                return (
                  <div key={client.id} className="mb-2">
                    <div
                      className="flex cursor-pointer items-center justify-between py-3 px-1"
                      onClick={() => void toggleClientGroup(client)}
                    >
                      <div className="flex items-center gap-2.5">
                        <ClientAvatar initial={initial} />
                        <span className="font-satoshi text-[14px] font-medium leading-[21px] text-black">{client.display_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full text-black/30 hover:text-black/60" onClick={(e) => { e.stopPropagation(); }}>
                          <MoreDotsIcon />
                        </button>
                        <ChevronIcon expanded={isExpanded} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="ml-1 mb-2 flex flex-col gap-[6px]">
                        {group?.isLoading ? (
                          <div className="py-2 pl-3 font-satoshi text-[12px] text-black/40">Loading...</div>
                        ) : group?.sessions.length ? (
                          group.sessions.map((session) => (
                            <div
                              key={session.id}
                              style={session.id === selectedSessionId ? { backgroundImage: "linear-gradient(#FFFFFFCC, #FFFFFFCC), url('/insights.png')", backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                              className={`cursor-pointer rounded-2xl px-3 py-2.5 font-satoshi text-[13px] leading-[18px] transition ${session.id === selectedSessionId ? "font-medium text-black" : "bg-[#FEFCFA] text-black/80 hover:bg-[#FBF7F2]"}`}
                              onClick={() => void selectSession(session, client.id)}
                            >
                              {session.title}
                            </div>
                          ))
                        ) : (
                          <div className="py-2 pl-3 font-satoshi text-[12px] text-black/40">No chats yet</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Collapse button */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((v) => !v)}
          className={`absolute top-[100px] z-20 flex h-[42px] w-[42px] items-center justify-center rounded-full border border-black/10 bg-white transition-all duration-300 max-[900px]:hidden ${sidebarCollapsed ? "left-[87px]" : "left-[435px]"}`}
        >
          <span className={`inline-flex transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : ""}`}>
            <CollapseIcon />
          </span>
        </button>

        {/* Chat Area */}
        <section className="relative flex h-full flex-1 flex-col overflow-hidden">
          {(isLoadingClients || !chatClientId) || isLoadingMessages ? (
            <div className="flex flex-1 items-center justify-center font-satoshi text-[13px] text-black/50">Loading chat...</div>
          ) : (
            <ChatThread
              key={`${chatClientId}:${selectedSession?.id ?? "draft"}:${chatResetId}`}
              session={selectedSession}
              initialMessages={initialMessages}
              prompts={prompts}
              clientId={chatClientId}
              onPromptSubmitted={() => setHasStartedChat(true)}
              onAssistantFinished={handleAssistantFinished}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function getVisibleSessions(sessions: AiChatSession[]) {
  return mergeAiChatSessions(sessions).filter((s) => !s.is_archived);
}

function mergeChatPrompts(...groups: ChatPrompt[][]) {
  const byTitle = new Map<string, ChatPrompt>();
  for (const prompt of groups.flat()) {
    const key = prompt.title.trim().toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, prompt);
  }
  return Array.from(byTitle.values());
}

type ChatThreadProps = {
  session: AiChatSession | null;
  initialMessages: ChatUiMessage[];
  prompts: ChatPrompt[];
  clientId: number | string | null;
  onPromptSubmitted: (prompt: string) => void;
  onAssistantFinished: (details: { sessionId: string | null; prompt: string | null; messages: ChatUiMessage[] }) => void;
};

function ChatThread({ session, initialMessages, prompts, clientId, onPromptSubmitted, onAssistantFinished }: ChatThreadProps) {
  const agent = getAiAgentSlug();
  const lastPromptRef = useRef<string | null>(null);
  const pendingSessionIdRef = useRef<string | null>(session?.id ?? null);
  const sessionId = session?.id ?? null;

  useEffect(() => { pendingSessionIdRef.current = sessionId; }, [sessionId]);

  const transport = useMemo(
    () => new AssistantChatTransport<ChatUiMessage>({
      api: clientId
        ? sessionId ? getCrmClientChatMessagesUrl(clientId, sessionId) : getCrmClientChatsUrl(clientId)
        : getCrmClientChatsUrl("missing-client"),
      credentials: "include",
      headers: getAiRequestHeaders(),
      fetch: async (input, init) => {
        const response = await aiChatFetch(input, init);
        const responseSessionId = response.headers.get("X-Session-Id");
        if (responseSessionId) pendingSessionIdRef.current = responseSessionId;
        return response;
      },
      body: { metadata: { agent } },
      prepareSendMessagesRequest(options) {
        const { messages } = options;
        const body = options.body ?? {};
        const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
        const prompt = latestUserMessage ? getMessageText(latestUserMessage) : "";
        if (!clientId) throw new Error("CRM client id is required.");
        const api = sessionId ? getCrmClientChatMessagesUrl(clientId, sessionId) : getCrmClientChatsUrl(clientId);
        if (prompt && prompt !== lastPromptRef.current) {
          lastPromptRef.current = prompt;
          onPromptSubmitted(prompt);
        }
        if (!sessionId) pendingSessionIdRef.current = null;
        return { ...options, api, body: { ...body, message: prompt || latestUserMessage, messages, metadata: { ...getRecord(body.metadata), agent, client_id: clientId } } };
      },
    }),
    [agent, clientId, onPromptSubmitted, sessionId],
  );

  const chat = useChat<ChatUiMessage>({
    id: sessionId ?? "draft-chat",
    messages: initialMessages,
    transport: transport as unknown as ChatTransport<ChatUiMessage>,
    onFinish({ message, messages }) {
      onAssistantFinished({
        sessionId: sessionId ?? pendingSessionIdRef.current ?? getSessionIdFromMetadata(message.metadata),
        prompt: lastPromptRef.current,
        messages,
      });
    },
    onError(error) { console.error("AI chat stream failed:", error); },
  });

  const runtime = useAISDKRuntime(chat);
  const handlePromptSelect = useCallback(
    (prompt: ChatPrompt) => {
      void chat.sendMessage({
        text: prompt.user_message,
        metadata: prompt.workflow_intent ? { workflow_intent: prompt.workflow_intent } : undefined,
      });
    },
    [chat],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <ThreadPrimitive.Root className="flex h-full min-h-0 flex-1 flex-col">
          <AuiIf condition={(state) => state.thread.isEmpty}>
            <div className="flex flex-1 flex-col items-center justify-center px-6">
              <div className="w-full max-w-[720px]">
                <Composer placeholder="What can I help you with?" prompts={prompts} onPromptSelect={handlePromptSelect} />
              </div>
            </div>
          </AuiIf>

          <AuiIf condition={(state) => !state.thread.isEmpty}>
            <ThreadPrimitive.Viewport className="relative min-h-0 flex-1 overflow-y-auto px-6 pt-[24px] pb-[176px]" autoScroll>
              <div className="mx-auto w-full max-w-[720px]">
                <ThreadPrimitive.Messages>
                  {({ message }) => (
                    message.role === "user" ? <UserMessage /> : <AssistantMessage message={message} showReplySuggestions={message.isLast} />
                  )}
                </ThreadPrimitive.Messages>
              </div>
              <ThreadPrimitive.ViewportFooter className="sticky bottom-0 z-[5] bg-transparent pt-3">
                <ThreadPrimitive.ScrollToBottom className="hidden data-[state=visible]:inline-grid absolute left-1/2 top-[-16px] h-9 w-9 -translate-x-1/2 -translate-y-full place-items-center rounded-full border border-white/60 bg-white/85 text-[#171615] shadow-[0_2px_12px_rgba(0,0,0,0.12)] backdrop-blur-xl" aria-label="Scroll to bottom">
                  <ArrowDownIcon />
                </ThreadPrimitive.ScrollToBottom>
              </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
          </AuiIf>
        </ThreadPrimitive.Root>

        {chat.error ? (
          <div className="mx-auto mb-[10px] w-full max-w-[720px] rounded-lg border border-[#973022]/20 bg-white/70 px-[12px] py-[10px] font-satoshi text-[13px] text-[#8f2415]" role="alert">
            {chat.error.message || "The chat stream failed. Please try again."}
          </div>
        ) : null}

        <AuiIf condition={(state) => !state.thread.isEmpty}>
          <div className="absolute right-0 bottom-0 left-0 z-10 bg-transparent px-[22px] pb-[24px] max-[640px]:px-[14px]">
            <Composer placeholder="Ask a follow-up..." prompts={prompts} onPromptSelect={handlePromptSelect} />
          </div>
        </AuiIf>
      </div>
    </AssistantRuntimeProvider>
  );
}

function Composer({ placeholder, prompts, onPromptSelect }: { placeholder: string; prompts?: ChatPrompt[]; onPromptSelect?: (prompt: ChatPrompt) => void }) {
  const isRunning = useThread((t) => t.isRunning);
  const [promptsExpanded, setPromptsExpanded] = useState(false);
  const [collapsedPromptCount, setCollapsedPromptCount] = useState(2);
  const promptListRef = useRef<HTMLDivElement | null>(null);
  const promptMeasureRef = useRef<HTMLDivElement | null>(null);

  const composerPrompts = prompts && prompts.length > 0 ? prompts : DEFAULT_COMPOSER_PROMPTS;
  const hasPromptOverflow = collapsedPromptCount < composerPrompts.length;
  const visiblePrompts = composerPrompts.length > 0
    ? (promptsExpanded ? composerPrompts : composerPrompts.slice(0, Math.max(1, collapsedPromptCount)))
    : [];

  useLayoutEffect(() => {
    const list = promptListRef.current;
    const measure = promptMeasureRef.current;
    if (!list || !measure || promptsExpanded || composerPrompts.length === 0) return;
    const updateVisiblePromptCount = () => {
      const chips = Array.from(measure.querySelectorAll<HTMLElement>("[data-prompt-measure-chip]"));
      const availableWidth = list.clientWidth;
      const gap = window.matchMedia("(max-width: 640px)").matches ? 8 : 12;
      let usedWidth = 0;
      let nextCount = 0;
      for (const chip of chips) {
        const nextWidth = usedWidth + (nextCount > 0 ? gap : 0) + chip.offsetWidth;
        if (nextWidth > availableWidth) break;
        usedWidth = nextWidth;
        nextCount += 1;
      }
      setCollapsedPromptCount(Math.max(1, nextCount));
    };
    updateVisiblePromptCount();
    const ro = new ResizeObserver(updateVisiblePromptCount);
    ro.observe(list);
    return () => { ro.disconnect(); };
  }, [composerPrompts, promptsExpanded]);

  return (
    <ComposerPrimitive.Root className={TW.composerWrap}>
      {composerPrompts.length > 0 && (
        <div className={TW.promptMeasure} ref={promptMeasureRef} aria-hidden="true">
          {composerPrompts.map((p) => (
            <div key={p.id} className={TW.promptMeasureChip} data-prompt-measure-chip>/{p.title}</div>
          ))}
        </div>
      )}
      {visiblePrompts.length > 0 && (
        <div className={TW.promptChipsRow}>
          <div className={`${TW.promptChipsLeft} ${promptsExpanded ? TW.promptChipsLeftExpanded : ""}`} ref={promptListRef}>
            {visiblePrompts.map((p) => (
              <div key={p.id} className={TW.promptChip} role="button" tabIndex={0} onClick={() => onPromptSelect?.(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPromptSelect?.(p); } }}>
                /{p.title}
              </div>
            ))}
          </div>
          {(hasPromptOverflow || promptsExpanded) && composerPrompts.length > 1 ? (
            <button type="button" className={`${TW.promptChipExpand} ${promptsExpanded ? "rotate-180" : ""}`} aria-expanded={promptsExpanded} onClick={() => setPromptsExpanded((v) => !v)}>
              <ChevronDownIcon />
            </button>
          ) : null}
        </div>
      )}
      <div className={`${TW.composer} ${isRunning ? TW.composerThinking : ""}`}>
        <div className={TW.composerInputRow}>
          <ComposerPrimitive.Input className={TW.composerInput} data-chat-composer-input placeholder={placeholder} rows={1} autoFocus />
        </div>
        <div className="flex shrink-0 items-center px-[16px]">
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
        <ComposerPrimitive.Cancel className={TW.sendBtn} aria-label="Stop response"><StopIcon /></ComposerPrimitive.Cancel>
      </AuiIf>
      <AuiIf condition={(state) => !state.thread.isRunning && !state.composer.isEmpty}>
        <ComposerPrimitive.Send className={TW.sendBtn} aria-label="Send message"><ArrowUpIcon /></ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(state) => !state.thread.isRunning && state.composer.isEmpty}>
        <button className={TW.sendBtn} type="button" disabled aria-label="Send message"><ArrowUpIcon /></button>
      </AuiIf>
    </>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className={TW.messageUser}>
      <div className={`${TW.messageContent} ${TW.userMessageContent}`}>
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage({ message, showReplySuggestions }: { message: MessageState; showReplySuggestions: boolean }) {
  const replySuggestions = showReplySuggestions ? getReplySuggestions(message.content) : [];
  return (
    <MessagePrimitive.Root className={TW.messageAssistant}>
      <div className={TW.messageStack}>
        <div className={`${TW.messageContent} ${TW.assistantMessageContent}`}>
          <MessagePrimitive.GroupedParts groupBy={groupPartByType({ "tool-call": ["group-tools"] })}>
            {({ part, children }) => {
              switch (part.type) {
                case "group-tools":
                  return <ToolCallGroup status={part.status.type} count={part.indices.length}>{children}</ToolCallGroup>;
                case "text":
                  return <MarkdownText />;
                case "data":
                  return shouldHideDataPart(part.name) ? null : <DataStatusPart name={part.name} status={part.status?.type} />;
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
        {replySuggestions.length > 0 ? (
          <div className={TW.replySuggestions} aria-label="Reply suggestions">
            {replySuggestions.map((suggestion) => (
              <ReplySuggestionButton key={suggestion} suggestion={suggestion} autoSubmit={appConfig.replySuggestionsAutoSubmit} />
            ))}
          </div>
        ) : null}
        <div className={TW.messageControls}>
          <AssistantActionBar />
          <BranchPickerPrimitive.Root className={TW.inlineControls} hideWhenSingleBranch>
            <BranchPickerPrimitive.Previous className={TW.actionBtn} aria-label="Previous response"><ChevronLeftIcon /></BranchPickerPrimitive.Previous>
            <span className={TW.branchCount}><BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count /></span>
            <BranchPickerPrimitive.Next className={TW.actionBtn} aria-label="Next response"><ChevronRightIcon /></BranchPickerPrimitive.Next>
          </BranchPickerPrimitive.Root>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function ReplySuggestionButton({ suggestion, autoSubmit }: { suggestion: string; autoSubmit: boolean }) {
  const threadRuntime = useThreadRuntime({ optional: true });
  const handleClick = () => {
    const composer = threadRuntime?.composer;
    if (!composer) return;
    composer.setText(suggestion);
    if (autoSubmit) { composer.send(); return; }
    window.requestAnimationFrame(() => { document.querySelector<HTMLTextAreaElement>("[data-chat-composer-input]")?.focus(); });
  };
  return <button type="button" className={TW.replyPill} onClick={handleClick}>{suggestion}</button>;
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root className={TW.inlineControls} hideWhenRunning>
      <ActionBarPrimitive.Copy className={TW.actionBtn} aria-label="Copy response"><CopyIcon /></ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload className={TW.actionBtn} aria-label="Regenerate response"><RefreshIcon /></ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
}

function MarkdownText() {
  return <MarkdownTextPrimitive className={TW.markdown} remarkPlugins={[remarkGfm]} />;
}

function ToolCallGroup({ children, count, status }: { children: ReactNode; count: number; status: string }) {
  const isRunning = status === "running";
  const summary = isRunning ? "Using tools" : count === 1 ? "Used 1 tool" : `Used ${count} tools`;
  return (
    <details className={TW.toolGroup} open={isRunning}>
      <summary className={TW.toolSummary}>
        <span className={TW.toolLabel}><ChevronDownIcon /><span>{summary}</span></span>
        <span className={`${TW.toolStatus} ${isRunning ? TW.toolStatusActive : ""}`}>{isRunning ? "Running" : "Done"}</span>
      </summary>
      <div className={TW.toolBody}>{children}</div>
    </details>
  );
}

function ToolCallPart(props: { toolName: string; argsText: string; result?: unknown; status: { type: string } }) {
  const elapsedMs = useToolCallElapsed();
  const resultText = formatToolPayload(props.result);
  const inputText = formatToolPayload(props.argsText);
  return (
    <div className={TW.toolCard}>
      <div className={TW.toolCardHeader}>
        <div>
          <p className={TW.toolEyebrow}>Tool</p>
          <h3 className={TW.toolTitle}>{humanizeToolName(props.toolName)}</h3>
        </div>
        <div className={TW.toolMeta}>
          <span className={`${TW.toolBadge} ${getToolBadgeClassName(props.status.type)}`}>{formatToolState(props.status.type)}</span>
          {elapsedMs !== undefined ? <span className={TW.toolTime}>{formatElapsedMs(elapsedMs)}</span> : null}
        </div>
      </div>
      <div className={TW.toolPayload}><span className={TW.toolPayloadLabel}>Input</span><pre className={TW.toolPayloadPre}>{inputText ?? "No data."}</pre></div>
      <div className={TW.toolPayload}><span className={TW.toolPayloadLabel}>Output</span><pre className={TW.toolPayloadPre}>{resultText ?? (props.status.type === "running" ? "Waiting for tool result..." : "No tool output returned.")}</pre></div>
    </div>
  );
}

function DataStatusPart({ name, status }: { name?: string; status?: string }) {
  return <div className="mt-[10px] inline-flex w-fit items-center gap-[6px] rounded-full bg-[#171615]/5 px-[10px] py-[4px] font-satoshi text-[11px] font-bold leading-tight text-[#171615]/60">{name ? humanizeToolName(name) : "Event"}{status ? ` · ${formatToolState(status)}` : ""}</div>;
}

function AssistantLoadingState() {
  return (
    <div className={TW.inlineStatusActive} aria-live="polite">
      <span>Thinking</span>
      <span className={TW.loadingDots}><span className={TW.loadingDot} /><span className={TW.loadingDot} /><span className={TW.loadingDot} /></span>
    </div>
  );
}

// Utilities
function getMessageText(message: UIMessage) {
  return message.parts.filter((p): p is { type: "text"; text: string } => p.type === "text" && "text" in p).map((p) => p.text).join("\n\n").trim();
}

function getSessionIdFromMetadata(metadata: AiChatMessageMetadata | undefined) {
  return typeof metadata?.session_id === "string" && metadata.session_id.length > 0 ? metadata.session_id : null;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getReplySuggestions(parts: readonly unknown[]) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = getRecord(parts[i]);
    if (part.type !== "data" || part.name !== "reply-suggestions") continue;
    const data = getRecord(part.data);
    const suggestions = data.suggestions;
    if (!Array.isArray(suggestions)) return [];
    const seen = new Set<string>();
    return suggestions.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter((s) => { if (!s || seen.has(s)) return false; seen.add(s); return true; });
  }
  return [];
}

function shouldHideDataPart(name?: string) {
  if (!name) return false;
  return name === "reply-suggestions" || /tool[-_\s]?status/i.test(name);
}

function humanizeToolName(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatToolState(status: string) {
  switch (status) { case "running": return "Running"; case "complete": return "Done"; case "incomplete": return "Stopped"; case "requires-action": return "Needs input"; default: return "Pending"; }
}

function getToolBadgeClassName(status: string) {
  switch (status) { case "complete": return "border-[#0e5f5b]/15 bg-[#0e5f5b]/10 text-[#0e5f5b]"; case "incomplete": case "requires-action": return "border-[#973022]/20 bg-[#973022]/10 text-[#8f2415]"; default: return "border-[#b36624]/20 bg-[#b36624]/10 text-[#9a5316]"; }
}

function formatElapsedMs(value: number) {
  return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}s`;
}

function formatToolPayload(value: unknown) {
  if (value === undefined) return null;
  if (typeof value === "string") { const t = value.trim(); if (!t) return null; try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return t; } }
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

// Icons
function ClientAvatar({ initial }: { initial: string }) {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundImage: "linear-gradient(#FFFFFFB2, #FFFFFFB2), url('/insights.png')", backgroundSize: "cover", backgroundPosition: "center" }}>
      <span className="font-satoshi text-[9px] font-bold text-[#4C2D08]">{initial}</span>
    </div>
  );
}

function SearchIcon() {
  return (
    <div className="flex h-4 w-4 items-center justify-center">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="rgba(0,0,0,0.70)" strokeWidth="1.85" /><path d="M11 11L14 14" stroke="rgba(0,0,0,0.70)" strokeWidth="1.85" strokeLinecap="round" /></svg>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <div className="flex h-5 w-5 items-center justify-center opacity-40">
      <svg width="10" height="5" viewBox="0 0 10 5" fill="none" className={`transition-transform ${expanded ? "rotate-180" : ""}`}><path d="M0 0L5 5L10 0" stroke="rgba(0,0,0,0.40)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

function CollapseIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1.72" y="1.72" width="16.56" height="16.56" rx="2" stroke="#262C31" strokeWidth="1.4" /><path d="M7.5 18.2812V1.71875" stroke="#262C31" strokeWidth="1.4" /><path d="M13.3594 11.9922L11.0156 9.64844L13.3594 7.30469" stroke="#262C31" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function MoreDotsIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="13" cy="8" r="1.2" fill="currentColor" /></svg>;
}

function ArrowUpIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M5 12L12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function StopIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 7H17V17H7V7Z" fill="currentColor" /></svg>;
}

function ArrowDownIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5V19M5 12L12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronDownIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronLeftIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronRightIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CopyIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 8V5C8 3.9 8.9 3 10 3H19C20.1 3 21 3.9 21 5V14C21 15.1 20.1 16 19 16H16M5 8H14C15.1 8 16 8.9 16 10V19C16 20.1 15.1 21 14 21H5C3.9 21 3 20.1 3 19V10C3 8.9 3.9 8 5 8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
}

function RefreshIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6V11H15M4 18V13H9M18.5 9A7 7 0 0 0 6.1 6.4L4 8.5M5.5 15A7 7 0 0 0 17.9 17.6L20 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
