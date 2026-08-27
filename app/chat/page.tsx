"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
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
import { WorkflowExecutionSteps } from "../components/WorkflowExecutionSteps";
import { ArtifactPopupProvider } from "../contexts/ArtifactContext";
import ArtifactMessage from "../components/ArtifactMessage";
import ArtifactPopup from "../components/ArtifactPopup";
import {
  getArtifactFromPart,
  getArtifactFromParts,
  normalizeAiChatMessage,
  transformAiChatSseResponse,
} from "../utils/aiChatParts";

type ClientGroup = {
  client: WealthCrmClient;
  sessions: AiChatSession[];
  isLoading: boolean;
  isExpanded: boolean;
};

type ExecutionPlanData = { schema_version: number; flow_hash: string; steps: { position: number; node_id: string; component_type: string; label: string; description: string[]; group_id?: string; group_label?: string }[] };
const WorkflowPlanContext = createContext<ExecutionPlanData | null>(null);

const ATTENTION_ITEMS = [
  {
    action: "Find alternatives to reduce tech exposure",
    prompt: "Find alternatives to reduce tech exposure",
    bg: "bg-[linear-gradient(100deg,#fff7ed_0%,#fbf4dc_48%,#f4edf4_100%)]",
  },
  {
    action: "Evaluation options about selling property",
    prompt: "Evaluate options for funding a property sale versus taking a loan.",
    bg: "bg-[linear-gradient(100deg,#fff7ed_0%,#fbf4dc_50%,#f4edf4_100%)]",
  },
  {
    action: "Draft an email to ask for insurance document",
    prompt: "Draft an email asking for the updated insurance document.",
    bg: "bg-[linear-gradient(100deg,#fff7ed_0%,#fbf4dc_50%,#f4edf4_100%)]",
  },
  {
    action: "Compare ways to fund property purchase",
    prompt: "Compare ways to fund the upcoming $42,000 education payment.",
    bg: "bg-[linear-gradient(100deg,#fff7ed_0%,#fbf4dc_50%,#f4edf4_100%)]",
  },
];

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

type ArtifactData = {
  id: string;
  artifact_type: string;
  artifact_version: number;
  name: string;
  payload: unknown;
};

type AiChatDataParts = {
  "reply-suggestions": ReplySuggestionsData;
  artifact: ArtifactData;
};

type ChatUiMessage = UIMessage<AiChatMessageMetadata, AiChatDataParts>;

const WARM_CHAT_CACHE_MAX_AGE_MS = 30_000;
const PENDING_LOCAL_CHAT_MAX_AGE_MS = 2 * 60_000;

const TW = {
  promptChipsRow: "mb-[10px] flex items-center justify-between gap-[4px] overflow-hidden rounded-[22px] p-[10px] pt-[8px] pb-[0px]",
  promptChipsLeft: "flex min-w-0 flex-1 items-center gap-[12px] overflow-hidden max-[640px]:gap-[8px]",
  promptChipsLeftExpanded: "!overflow-visible flex-wrap",
  promptChip: "inline-flex min-w-0 shrink-0 cursor-pointer items-center rounded-full border border-white/60 bg-[#0000000A] px-[11px] py-[7px] font-satoshi text-[12px] font-normal leading-[16.2px] text-[#5d6b77] transition hover:brightness-95 max-[640px]:max-w-[145px] max-[640px]:truncate",
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
  // Self-contained (not layered on messageContent) so its 16px type isn't
  // fighting that block's text-[13px]. Per Figma 2411:13978.
  userMessageContent: "max-w-full [overflow-wrap:anywhere] rounded-[20px_20px_0_20px] bg-[#F3F3F3] p-[16px] font-satoshi text-[16px] font-medium leading-[1.5] tracking-[-0.16px] text-[#0D0D0D]",
  assistantMessageContent: "py-1",
  messageStack: "max-w-full",
  replySuggestions: "mt-3 mb-1.5 flex max-w-full flex-col items-start gap-[10px]",
  replyPill: "inline-flex items-center gap-2.5 rounded-[12px] border border-white px-[12px] py-[10px] text-left text-[12px] font-normal leading-[16px] text-[#4C2D08] [word-wrap:break-word] transition hover:-translate-y-px hover:brightness-[0.97]",
  messageControls: "mt-2 inline-flex items-center gap-1.5",
  inlineControls: "inline-flex items-center gap-1.5 text-[#171615]/50",
  actionBtn: "inline-grid h-[30px] w-[30px] place-items-center rounded-full border border-white/60 bg-white/50 text-[#171615]/60 shadow-sm backdrop-blur transition hover:-translate-y-px hover:bg-white/70 hover:text-[#171615]",
  branchCount: "font-satoshi text-[12px] font-bold tabular-nums",
  markdown: "[overflow-wrap:anywhere] font-satoshi text-[16px] leading-[1.5] tracking-[-0.16px] text-[#0D0D0D] [&_a]:text-[#0e5f5b] [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[#0e5f5b]/20 [&_blockquote]:pl-[14px] [&_blockquote]:text-[#171615]/70 [&_code]:rounded [&_code]:bg-[#171615]/10 [&_code]:px-[6px] [&_code]:py-[2px] [&_code]:font-mono [&_code]:text-[0.88em] [&_h1]:mb-[10px] [&_h1]:text-[1em] [&_h1]:font-bold [&_h2]:mb-[10px] [&_h2]:text-[1em] [&_h2]:font-bold [&_h3]:mb-[10px] [&_h3]:text-[1em] [&_h3]:font-bold [&_li]:my-[4px] [&_ol]:mb-[16px] [&_ol]:list-decimal [&_ol]:pl-[20px] [&_p]:mb-[16px] [&_pre]:mb-[16px] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#171615]/10 [&_pre]:p-[12px] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_table]:mb-[16px] [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#171615]/10 [&_td]:p-[8px] [&_th]:border [&_th]:border-[#171615]/10 [&_th]:bg-white/60 [&_th]:p-[8px] [&_th]:text-left [&_th]:font-bold [&_ul]:mb-[16px] [&_ul]:list-disc [&_ul]:pl-[20px] [&>*:last-child]:mb-0",
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
  attentionContent: "flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto px-6",
  attentionInner: "flex flex-col items-start",
  attentionTitle: "m-0 mb-[28px] font-butler text-[32px] font-normal leading-[38.4px] tracking-normal text-black [overflow-wrap:break-word]",
  attentionList: "grid max-w-[640px] gap-[14px] justify-items-start",
  attentionSuggestion: "inline-flex max-w-full cursor-pointer items-center gap-[10px] rounded-[9px] px-[14px] py-[9px] text-left font-['Cascadia_Code',monospace] text-[12px] font-normal leading-[1.2] text-[#8b6230] transition hover:brightness-[0.97]",
};

// Selected chat row: gradient texture washed out by 80% white, per Figma 2411:14694.
const ACTIVE_CHAT_BG = {
  backgroundImage: "linear-gradient(rgba(255,255,255,0.8), rgba(255,255,255,0.8)), url('/gradient-texture.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
} as const;

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
  const [searchQuery, setSearchQuery] = useState("");
  const [hasPrefetchedSessions, setHasPrefetchedSessions] = useState(false);
  const [workflowExecutionPlan, setWorkflowExecutionPlan] = useState<ExecutionPlanData | null>(null);

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => {
      if (client.display_name?.toLowerCase().includes(q)) return true;
      const group = clientGroups.get(client.id);
      if (group?.sessions.some((s) => s.title?.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [clients, clientGroups, searchQuery]);

  const chatClientId = selectedClientId ?? requestedClientId ?? clients[0]?.id ?? null;

  // Split the list once chat counts are known: clients you've talked about first
  // (most recent activity on top), everyone else after.
  const clientSections = useMemo(() => {
    if (!hasPrefetchedSessions) return [{ label: "Clients", clients: filteredClients }];
    const withChats: WealthCrmClient[] = [];
    const withoutChats: WealthCrmClient[] = [];
    for (const client of filteredClients) {
      if ((clientGroups.get(client.id)?.sessions.length ?? 0) > 0) withChats.push(client);
      else withoutChats.push(client);
    }
    withChats.sort((a, b) => lastActivityAt(clientGroups.get(b.id)) - lastActivityAt(clientGroups.get(a.id)));
    const sections = [] as { label: string; clients: WealthCrmClient[] }[];
    if (withChats.length) sections.push({ label: "Recent chats", clients: withChats });
    if (withoutChats.length) sections.push({ label: withChats.length ? "Other clients" : "Clients", clients: withoutChats });
    return sections;
  }, [filteredClients, clientGroups, hasPrefetchedSessions]);

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
    if (!requestedClientId || isLoadingClients || clients.length === 0) return;
    const clientId = Number(requestedClientId) || requestedClientId;
    const client = clients.find((c) => c.id === clientId || String(c.id) === String(requestedClientId));
    if (client) {
      setSelectedClientId(client.id);
      void toggleClientGroup(client);
    }
  }, [requestedClientId, isLoadingClients, clients]);

  // Load every client's chats up front. Needed to split the list into "Recent chats"
  // vs "Other clients" — a collapsed row otherwise gives no hint whether it has any.
  useEffect(() => {
    if (isLoadingClients || clients.length === 0) return;
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        clients.map(async (client) => {
          try {
            return { client, sessions: getVisibleSessions(await listAiChatSessions({ clientId: client.id })) };
          } catch {
            return { client, sessions: [] as AiChatSession[] };
          }
        }),
      );
      if (cancelled) return;
      setClientGroups((prev) => {
        const next = new Map(prev);
        for (const { client, sessions } of results) {
          const existing = next.get(client.id);
          // Don't clobber a group the user already opened / that is mid-fetch.
          if (existing?.isExpanded || existing?.isLoading) continue;
          next.set(client.id, { client, sessions, isLoading: false, isExpanded: false });
        }
        return next;
      });
      setHasPrefetchedSessions(true);
    })();
    return () => { cancelled = true; };
  }, [isLoadingClients, clients]);

  // Open the most recently used client on arrival, so the list isn't all-collapsed.
  const didAutoExpand = useRef(false);
  useEffect(() => {
    if (didAutoExpand.current || requestedClientId || !hasPrefetchedSessions || clients.length === 0) return;
    const target = [...clients]
      .filter((c) => (clientGroups.get(c.id)?.sessions.length ?? 0) > 0)
      .sort((a, b) => lastActivityAt(clientGroups.get(b.id)) - lastActivityAt(clientGroups.get(a.id)))[0];
    if (!target) return;
    didAutoExpand.current = true;
    void toggleClientGroup(target);
  }, [requestedClientId, hasPrefetchedSessions, clients, clientGroups]);

  useEffect(() => {
    let cancelled = false;
    listChatWorkflowCommands({ agent: getAiAgentSlug() }).then((commands) => {
      if (cancelled) return;
      setPrompts(commands.map((command, index): ChatPrompt => ({
        id: -index - 1,
        title: command.name || command.command.replace(/^\//, ""),
        description: command.description || command.command,
        user_message: command.invocation_prompt || command.command,
        workflow_intent: { tool_name: command.tool_name, mode: "run" },
        execution_plan: command.execution_plan,
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
        const oldByIdMap = new Map(existing.sessions.map((s) => [s.id, s]));
        const merged = sessions.map((s) => {
          if ((!s.title || s.title === "New chat") && oldByIdMap.has(s.id)) {
            const old = oldByIdMap.get(s.id)!;
            if (old.title && old.title !== "New chat") return { ...s, title: old.title };
          }
          return s;
        });
        const next = new Map(prev);
        next.set(clientId, { ...existing, sessions: merged, isLoading: false });
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
      const normalizedMessages = messages.map(normalizeAiChatMessage);
      setInitialMessages(normalizedMessages);
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
    const title = existingSession?.title && existingSession.title !== "New chat" ? existingSession.title : createTitleFromPrompt(prompt ?? "");
    const nextSession: AiChatSession = {
      id: sessionId,
      title,
      agent: existingSession?.agent ?? getAiAgentSlug(),
      client_id: existingSession?.client_id ?? chatClientId ?? undefined,
      created_at: existingSession?.created_at,
      updated_at: new Date().toISOString(),
      source: existingSession?.source ?? "local",
    };
    upsertStoredAiChatSession(nextSession);
    setInitialMessages(messages.map(normalizeAiChatMessage));
    setSelectedSessionId(sessionId);
    if (chatClientId) {
      setClientGroups((prev) => {
        const existing = prev.get(chatClientId);
        if (!existing) return prev;
        const alreadyExists = existing.sessions.some((s) => s.id === sessionId);
        const updatedSessions = alreadyExists
          ? existing.sessions.map((s) => s.id === sessionId ? { ...s, title } : s)
          : [nextSession, ...existing.sessions];
        const next = new Map(prev);
        next.set(chatClientId, { ...existing, sessions: updatedSessions, isExpanded: true });
        return next;
      });
      window.setTimeout(() => void refreshClientSessions(chatClientId), 2000);
    }
  };

  return (
    <ArtifactPopupProvider autoOpenEnabled={false} positioning="fixed">
      <div className="relative h-screen w-full overflow-hidden bg-white">
        <Sidebar />

      {/* Top Header Bar */}
      <header className="fixed left-[80px] right-0 top-0 z-50 flex h-[56px] items-center justify-between border-b border-black/10 bg-white/20 px-4 backdrop-blur-[32px]">
        <h1 className="m-0 text-[22px] font-medium leading-[26.4px] text-black" style={{ fontFamily: "var(--font-butler)" }}>AI assistant</h1>
      </header>

      {/* Main layout */}
      <div className="ml-[80px] flex h-screen pt-[56px]">
        {/* Left Panel */}
        <aside className={`relative h-full shrink-0 overflow-hidden border-r border-black/[0.08] bg-white transition-all duration-300 max-[900px]:hidden ${sidebarCollapsed ? "w-0 border-r-0" : "w-[280px]"}`}>
          <div className="flex h-full flex-col gap-4 overflow-y-auto overflow-x-hidden px-2 py-4">
            {/* Search input */}
            <div className="flex shrink-0 items-center gap-2 rounded-[50px] border border-black/10 bg-white px-4 py-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your chats"
                className="min-w-0 flex-1 border-0 bg-transparent text-black outline-none placeholder:text-black/60"
                // Inline, not utilities: the unlayered `input { font: inherit }` reset in
                // globals.css outranks any layered Tailwind font utility here.
                style={{ fontFamily: "var(--font-satoshi)", fontSize: 12, fontWeight: 500, lineHeight: "18px", letterSpacing: "-0.12px" }}
              />
              <img src="/chat-sidebar/icon-search.svg" alt="" className="h-4 w-4 shrink-0" />
            </div>

            {/* Clients + chat history */}
            {isLoadingClients ? (
              <div className="px-2 font-satoshi text-[12px] text-black/40">Loading clients...</div>
            ) : (
              clientSections.map((section) => (
                <div key={section.label} className="flex flex-col gap-4">
                  <div className="flex h-4 items-center px-2">
                    <span className="font-satoshi text-[10px] font-medium leading-4 text-[#6B7280]">{section.label}</span>
                  </div>

                  {section.clients.map((client) => {
                  const group = clientGroups.get(client.id);
                  const hasSearchQuery = searchQuery.trim().length > 0;
                  const isExpanded = hasSearchQuery ? true : (group?.isExpanded ?? false);
                  const sessions = group?.sessions ?? [];
                  const visibleSessions = hasSearchQuery
                    ? sessions.filter((s) => s.title?.toLowerCase().includes(searchQuery.trim().toLowerCase()))
                    : sessions;
                  const showNewChat = selectedClientId === client.id && !selectedSessionId;
                  return (
                    <div key={client.id} className="flex flex-col gap-1">
                      {/* Client folder row. Plus + chevron only appear on hover. */}
                      <div
                        // The row is 16px tall per Figma; the ::before pad extends the
                        // click target into the 16px gap without affecting layout.
                        // mb-1 when open gives the folder title a little air above
                        // its chat list (on top of the wrapper's gap-1).
                        className={`group/client relative flex h-4 cursor-pointer items-center px-2 before:absolute before:inset-x-0 before:-inset-y-2 before:-z-10 before:content-[''] ${isExpanded ? "mb-1" : ""}`}
                        onClick={() => void toggleClientGroup(client)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <img src="/chat-sidebar/icon-folder.svg" alt="" className="h-4 w-4 shrink-0" />
                          <span className="truncate font-satoshi text-[12px] font-bold leading-4 text-[#0D0D0D]">{client.display_name}</span>
                        </div>
                        {/* Zero-width until hover, so the name only truncates once the
                            icons actually take up room. 56px = 8px pad + 16 + 8 gap + 16,
                            with slack so subpixel rounding can't clip the chevron. */}
                        <div className="flex max-w-0 shrink-0 items-center gap-2 overflow-hidden opacity-0 transition-all duration-200 focus-within:max-w-[56px] focus-within:pl-2 focus-within:opacity-100 group-hover/client:max-w-[56px] group-hover/client:pl-2 group-hover/client:opacity-100">
                          <button
                            type="button"
                            aria-label="New chat"
                            className="h-4 w-4 shrink-0"
                            onClick={(e) => { e.stopPropagation(); if (!isExpanded) void toggleClientGroup(client); setSelectedClientId(client.id); startNewChat(); }}
                          >
                            <img src="/chat-sidebar/icon-plus.svg" alt="" className="h-4 w-4" />
                          </button>
                          <img
                            src="/chat-sidebar/icon-chevron-down.svg"
                            alt=""
                            className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="flex flex-col pl-4">
                          {showNewChat && (
                            <div
                              style={ACTIVE_CHAT_BG}
                              className="cursor-pointer truncate rounded-lg px-2 py-[7px] font-satoshi text-[12px] font-normal leading-[18px] tracking-[-0.24px] text-black"
                              onClick={() => { setSelectedClientId(client.id); startNewChat(); }}
                            >
                              New chat
                            </div>
                          )}
                          {group?.isLoading ? (
                            <div className="px-2 py-[7px] font-satoshi text-[12px] leading-[18px] text-black/40">Loading...</div>
                          ) : visibleSessions.length === 0 && !showNewChat ? (
                            <div className="px-2 py-[7px] font-satoshi text-[12px] leading-[18px] tracking-[-0.24px] text-black/40">
                              {searchQuery.trim() ? "No matching chats" : "No chats yet"}
                            </div>
                          ) : (
                            visibleSessions.map((session) => {
                              const isActive = session.id === selectedSessionId;
                              return (
                                <div
                                  key={session.id}
                                  style={isActive ? ACTIVE_CHAT_BG : undefined}
                                  className={`cursor-pointer truncate rounded-lg px-2 py-[7px] font-satoshi text-[12px] font-normal leading-[18px] tracking-[-0.24px] text-black ${isActive ? "" : "hover:bg-black/[0.04]"}`}
                                  onClick={() => void selectSession(session, client.id)}
                                >
                                  {session.title}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Collapse button */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((v) => !v)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          // top-[69px] centers the 42px button on the search field: 56px header
          // + 16px panel padding + 18px (half the 36px field) - 21px.
          className={`absolute top-[69px] z-20 flex h-[42px] w-[42px] items-center justify-center rounded-full border border-black/10 bg-white transition-all duration-300 max-[900px]:hidden ${sidebarCollapsed ? "left-[87px]" : "left-[367px]"}`}
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
              onExecutionPlanChange={setWorkflowExecutionPlan}
              executionPlan={workflowExecutionPlan}
            />
          )}
        </section>
      </div>
        <ArtifactPopup />
      </div>
    </ArtifactPopupProvider>
  );
}

function lastActivityAt(group?: ClientGroup) {
  if (!group) return 0;
  return group.sessions.reduce((latest, session) => {
    const stamp = Date.parse(session.updated_at ?? session.created_at ?? "");
    return Number.isNaN(stamp) ? latest : Math.max(latest, stamp);
  }, 0);
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
  onExecutionPlanChange?: (plan: ExecutionPlanData | null) => void;
  executionPlan?: ExecutionPlanData | null;
};

function ChatThread({ session, initialMessages, prompts, clientId, onPromptSubmitted, onAssistantFinished, onExecutionPlanChange, executionPlan }: ChatThreadProps) {
  const agent = getAiAgentSlug();
  const lastPromptRef = useRef<string | null>(null);
  const pendingSessionIdRef = useRef<string | null>(session?.id ?? null);
  const selectedPromptRef = useRef<ChatPrompt | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
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

        return transformAiChatSseResponse(response);
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
        const latestUserMetadata = getMessageCustomMetadata(latestUserMessage?.metadata);
        const pendingWorkflow = selectedPromptRef.current;
        if (pendingWorkflow) {
          selectedPromptRef.current = null;
          setSelectedPromptId(null);
          if (pendingWorkflow.execution_plan) {
            onExecutionPlanChange?.(pendingWorkflow.execution_plan);
          }
        } else {
          onExecutionPlanChange?.(null);
        }
        const { workflow_intent: _stripWf, ...safeUserMetadata } = latestUserMetadata as Record<string, unknown>;
        return { ...options, api, body: { ...body, message: prompt || latestUserMessage, messages, metadata: { ...safeUserMetadata, ...(pendingWorkflow?.workflow_intent ? { workflow_intent: pendingWorkflow.workflow_intent } : {}), ...getRecord(body.metadata), agent, client_id: clientId } } };
      },
    }),
    [agent, clientId, onPromptSubmitted, sessionId],
  );

  const chat = useChat<ChatUiMessage>({
    id: sessionId ?? "draft-chat",
    messages: initialMessages,
    transport: transport as unknown as ChatTransport<ChatUiMessage>,
    onFinish({ message, messages }) {
      window.setTimeout(() => {
        onAssistantFinished({
          sessionId: sessionId ?? pendingSessionIdRef.current ?? getSessionIdFromMetadata(message.metadata),
          prompt: lastPromptRef.current,
          messages,
        });
      }, 0);
    },
    onError(error) { console.error("AI chat stream failed:", error); },
  });

  const runtime = useAISDKRuntime(chat);
  const handlePromptSelect = useCallback(
    (prompt: ChatPrompt) => {
      if (selectedPromptId === prompt.id) {
        selectedPromptRef.current = null;
        setSelectedPromptId(null);
        return;
      }
      selectedPromptRef.current = prompt;
      setSelectedPromptId(prompt.id);
    },
    [selectedPromptId],
  );

  return (
    <WorkflowPlanContext.Provider value={executionPlan ?? null}>
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <ThreadPrimitive.Root className="flex h-full min-h-0 flex-1 flex-col">
          <AuiIf condition={(state) => state.thread.isEmpty}>
            <div className="flex flex-1 flex-col">
              <div className={TW.attentionContent}>
                <div className={TW.attentionInner}>
                  <h1 className={TW.attentionTitle}>What can I help you with?</h1>
                  <div className={TW.attentionList}>
                    {ATTENTION_ITEMS.map((item) => (
                      <ThreadPrimitive.Suggestion
                        key={item.action}
                        prompt={item.prompt}
                        send
                        className={`${TW.attentionSuggestion} ${item.bg}`}
                        style={{ fontFamily: "'Cascadia Code', monospace", fontSize: 12 }}
                      >
                        <span aria-hidden="true" className="text-[#6b5c3b]">&rarr;</span>
                        <span style={{ background: "linear-gradient(90deg, #988267 0%, #8C6722 50%, #7D6F7E 100%)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{item.action}</span>
                      </ThreadPrimitive.Suggestion>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 pb-[24px]">
                <Composer placeholder="What can I help you with?" prompts={prompts} onPromptSelect={handlePromptSelect} selectedPromptId={selectedPromptId} />
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
                <ThreadThinking />
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
            <Composer placeholder="Ask a follow-up..." prompts={prompts} onPromptSelect={handlePromptSelect} selectedPromptId={selectedPromptId} />
          </div>
        </AuiIf>
      </div>
    </AssistantRuntimeProvider>
    </WorkflowPlanContext.Provider>
  );
}

function Composer({ placeholder, prompts, onPromptSelect, selectedPromptId }: { placeholder: string; prompts?: ChatPrompt[]; onPromptSelect?: (prompt: ChatPrompt) => void; selectedPromptId?: number | null }) {
  const isRunning = useThread((t) => t.isRunning);
  const threadRuntime = useThreadRuntime({ optional: true });
  const [promptsExpanded, setPromptsExpanded] = useState(false);
  const [collapsedPromptCount, setCollapsedPromptCount] = useState(2);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashDropdownRef = useRef<HTMLDivElement | null>(null);
  const promptListRef = useRef<HTMLDivElement | null>(null);
  const promptMeasureRef = useRef<HTMLDivElement | null>(null);

  const composerPrompts = prompts && prompts.length > 0 ? prompts : DEFAULT_COMPOSER_PROMPTS;

  const slashMatches = useMemo(() => {
    if (slashQuery === null) return [];
    const q = slashQuery.toLowerCase();
    return composerPrompts.filter((p) => p.title.toLowerCase().includes(q));
  }, [slashQuery, composerPrompts]);

  const slashMatchesRef = useRef(slashMatches);
  slashMatchesRef.current = slashMatches;
  const slashQueryRef = useRef(slashQuery);
  slashQueryRef.current = slashQuery;
  const slashIndexRef = useRef(slashIndex);
  slashIndexRef.current = slashIndex;

  const handleComposerInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const value = (e.target as HTMLTextAreaElement).value;
    if (value.startsWith("/")) {
      setSlashQuery(value.slice(1));
      setSlashIndex(0);
    } else {
      setSlashQuery(null);
    }
  }, []);

  useEffect(() => {
    if (slashDropdownRef.current && slashQuery !== null) {
      const item = slashDropdownRef.current.children[slashIndex] as HTMLElement | undefined;
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [slashIndex, slashQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (slashQueryRef.current === null || slashMatchesRef.current.length === 0) return;
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const match = slashMatchesRef.current[slashIndexRef.current];
        if (match && threadRuntime?.composer) {
          threadRuntime.composer.setText(match.user_message || "");
          onPromptSelect?.(match);
          setSlashQuery(null);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashMatchesRef.current.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashMatchesRef.current.length) % slashMatchesRef.current.length);
      } else if (e.key === "Escape") {
        setSlashQuery(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [threadRuntime, onPromptSelect]);
  const hasPromptOverflow = collapsedPromptCount < composerPrompts.length;
  const visiblePrompts = useMemo(() => {
    if (composerPrompts.length === 0) return [];
    if (promptsExpanded) return composerPrompts;
    const sliced = composerPrompts.slice(0, Math.max(2, collapsedPromptCount));
    if (selectedPromptId && !sliced.some((p) => p.id === selectedPromptId)) {
      const selected = composerPrompts.find((p) => p.id === selectedPromptId);
      if (selected) return [selected, ...sliced.slice(0, sliced.length - 1)];
    }
    return sliced;
  }, [composerPrompts, promptsExpanded, collapsedPromptCount, selectedPromptId]);

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
      setCollapsedPromptCount(Math.max(2, nextCount));
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
              <div key={p.id} className={TW.promptChip} style={selectedPromptId === p.id ? { backgroundImage: "url('/insights.png')", backgroundSize: "cover", backgroundPosition: "center", border: "1px solid transparent" } : undefined} role="button" tabIndex={0} onClick={() => { onPromptSelect?.(p); if (selectedPromptId !== p.id && p.user_message && threadRuntime?.composer) { threadRuntime.composer.setText(p.user_message); window.requestAnimationFrame(() => { document.querySelector<HTMLTextAreaElement>("[data-chat-composer-input]")?.focus(); }); } else if (selectedPromptId === p.id && threadRuntime?.composer) { threadRuntime.composer.setText(""); } }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPromptSelect?.(p); if (selectedPromptId !== p.id && p.user_message && threadRuntime?.composer) { threadRuntime.composer.setText(p.user_message); } else if (selectedPromptId === p.id && threadRuntime?.composer) { threadRuntime.composer.setText(""); } } }}>
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
      <div className={`${TW.composer} ${isRunning ? TW.composerThinking : ""}`} style={{ position: "relative" }}>
        {slashQuery !== null && slashMatches.length > 0 && (
          <div ref={slashDropdownRef} style={{ position: "absolute", bottom: "100%", left: 0, right: 0, background: "white", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, padding: "6px 0", marginBottom: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto", zIndex: 10 }}>
            {slashMatches.map((p, i) => (
              <div
                key={p.id}
                style={{ padding: "10px 16px", cursor: "pointer", background: i === slashIndex ? "#F2F2F2" : "transparent", display: "flex", alignItems: "center", gap: 8 }}
                onMouseEnter={() => setSlashIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); if (threadRuntime?.composer) { threadRuntime.composer.setText(p.user_message || ""); onPromptSelect?.(p); setSlashQuery(null); } }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "#804D13" }}>/{p.title}</span>
                {p.description && <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>{p.description}</span>}
              </div>
            ))}
          </div>
        )}
        <div className={TW.composerInputRow}>
          <ComposerPrimitive.Input className={TW.composerInput} data-chat-composer-input placeholder={placeholder} rows={1} autoFocus onInput={handleComposerInput} />
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

function ThreadThinking() {
  const isRunning = useThread((t) => t.isRunning);
  const messages = useThread((t) => t.messages);
  const lastMessage = messages[messages.length - 1];
  const showThinking = isRunning && (!lastMessage || lastMessage.role === "user");
  if (!showThinking) return null;
  return (
    <div className={TW.messageAssistant}>
      <div className={TW.messageStack}>
        <div className={`${TW.messageContent} ${TW.assistantMessageContent}`}>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(0,0,0,0.45)", fontFamily: "Satoshi Variable, sans-serif" }}>Thinking...</p>
        </div>
      </div>
    </div>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className={TW.messageUser}>
      <div className={TW.userMessageContent}>
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage({ message, showReplySuggestions }: { message: MessageState; showReplySuggestions: boolean }) {
  const replySuggestions = showReplySuggestions ? getReplySuggestions(message.content) : [];
  const messageArtifact = getArtifactFromParts(message.content);
  const workflowPlanCtx = useContext(WorkflowPlanContext);
  const workflowPlan = showReplySuggestions ? workflowPlanCtx : null;
  const hasSteps = Boolean(workflowPlan && workflowPlan.steps && workflowPlan.steps.length > 0);
  const isStreaming = message.status?.type !== "complete";
  const shouldShowArtifact = Boolean(messageArtifact && message.status?.type === "complete" && !isStreaming);
  const [stepsAnimationDone, setStepsAnimationDone] = useState(false);
  const showContent = !hasSteps || stepsAnimationDone;

  useEffect(() => {
    if (!hasSteps) { setStepsAnimationDone(true); return; }
    const fallback = setTimeout(() => setStepsAnimationDone(true), 45000);
    return () => clearTimeout(fallback);
  }, [hasSteps]);

  return (
    <MessagePrimitive.Root className={TW.messageAssistant}>
      <div className={TW.messageStack}>
        <div className={`${TW.messageContent} ${TW.assistantMessageContent}`}>
          {workflowPlan && (
            <WorkflowExecutionSteps
              executionPlan={workflowPlan}
              isRunning={isStreaming}
              onAnimationComplete={() => setStepsAnimationDone(true)}
            />
          )}
          <div style={{ opacity: showContent ? 1 : 0, maxHeight: showContent ? "none" : 0, overflow: "hidden", transition: "opacity 0.6s ease" }}>
          <MessagePrimitive.GroupedParts groupBy={groupPartByType({ "tool-call": ["group-tools"] })}>
            {({ part, children }) => {
              const artifact = getArtifactFromPart(part);
              if (artifact) {
                return shouldShowArtifact ? <ArtifactMessage artifact={messageArtifact ?? artifact} /> : null;
              }

              switch (part.type) {
                case "group-tools":
                  return <ToolCallGroup status={part.status.type} count={part.indices.length}>{children}</ToolCallGroup>;
                case "text":
                  if (messageArtifact) return null;
                  return <MarkdownText />;
                case "data":
                  if (shouldHideDataPart(part.name)) return null;

                  // Render artifact as clickable message
                  if (part.name === "artifact" || part.name === "data-artifact") {
                    const artifactData = part.data as ArtifactData;
                    return shouldShowArtifact ? <ArtifactMessage artifact={messageArtifact ?? artifactData} /> : null;
                  }

                  return <DataStatusPart name={part.name} status={part.status?.type} />;
                case "tool-call":
                  return part.toolUI ?? <ToolCallPart {...part} />;
                case "indicator":
                  return workflowPlan ? null : <AssistantLoadingState />;
                default:
                  return null;
              }
            }}
          </MessagePrimitive.GroupedParts>
          </div>
        </div>
        {replySuggestions.length > 0 && showContent ? (
          <div className={TW.replySuggestions} aria-label="Reply suggestions">
            <p className="mb-1 font-satoshi text-[14px] font-medium leading-[20px] text-black/80">If you want to know more</p>
            {replySuggestions.map((suggestion) => (
              <ReplySuggestionButton key={suggestion} suggestion={suggestion} autoSubmit={true} />
            ))}
          </div>
        ) : null}
        {showContent && <div className={TW.messageControls}>
          <AssistantActionBar />
          <BranchPickerPrimitive.Root className={TW.inlineControls} hideWhenSingleBranch>
            <BranchPickerPrimitive.Previous className={TW.actionBtn} aria-label="Previous response"><ChevronLeftIcon /></BranchPickerPrimitive.Previous>
            <span className={TW.branchCount}><BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count /></span>
            <BranchPickerPrimitive.Next className={TW.actionBtn} aria-label="Next response"><ChevronRightIcon /></BranchPickerPrimitive.Next>
          </BranchPickerPrimitive.Root>
        </div>}
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
    if (autoSubmit) {
      composer.send();
      return;
    }
    window.requestAnimationFrame(() => { document.querySelector<HTMLTextAreaElement>("[data-chat-composer-input]")?.focus(); });
  };
  return (
    <div className={TW.replyPill} style={{ backgroundImage: "linear-gradient(#FFFFFFCC, #FFFFFFCC), url('/insights.png')", backgroundSize: "cover", backgroundPosition: "center", fontFamily: "'Cascadia Code', monospace", cursor: "pointer" }} onClick={handleClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}>
      <span className="shrink-0 text-[12px] text-[#4C2D08]/60">&rarr;</span>
      <span>{suggestion}</span>
    </div>
  );
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root className={TW.inlineControls} hideWhenRunning>
      <ActionBarPrimitive.Copy className={TW.actionBtn} aria-label="Copy response"><CopyIcon /></ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload className={TW.actionBtn} aria-label="Regenerate response"><RefreshIcon /></ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
}

function remarkCapsHeadings() {
  return (tree: import("mdast").Root) => {
    visit(tree, "paragraph", (node: import("mdast").Paragraph, index: number | undefined, parent: import("mdast").Parent | undefined) => {
      if (!parent || index == null) return;
      if (node.children.some((c) => c.type !== "text")) return;
      const raw = node.children.map((c) => ("value" in c ? c.value : "")).join("").trim();
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
  function extractText(node: import("mdast").PhrasingContent): string {
    if ("value" in node) return node.value;
    if ("children" in node) return (node.children as import("mdast").PhrasingContent[]).map(extractText).join("");
    return "";
  }
  return (tree: import("mdast").Root) => {
    visit(tree, "paragraph", (node: import("mdast").Paragraph, index: number | undefined, parent: import("mdast").Parent | undefined) => {
      if (!parent || index == null) return;
      const raw = node.children.map(extractText).join("");
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

function rehypeBoldNumbers() {
  return (tree: import("hast").Root) => {
    const PATTERN = /(\$[\d,]+(?:\.\d+)?(?:[KMBTkmbt](?:\b|(?=[^a-zA-Z])))?(?:\s*[–—\-]\s*\$?[\d,]+(?:\.\d+)?(?:[KMBTkmbt](?:\b|(?=[^a-zA-Z])))?)?|\b\d+(?:\.\d+)?(?:\s*[–—\-]\s*\d+(?:\.\d+)?)?%)/g;
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
  return <MarkdownTextPrimitive className={TW.markdown} remarkPlugins={[remarkGfm, remarkCapsHeadings, remarkInlineBullets]} rehypePlugins={[rehypeBoldNumbers]} />;
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

function getMessageCustomMetadata(metadata: unknown) {
  const record = getRecord(metadata);
  return { ...record, ...getRecord(record.custom) };
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

  // Don't hide artifacts - render as clickable message
  if (name === "artifact" || name === "data-artifact") {
    return false;
  }

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
function CollapseIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1.72" y="1.72" width="16.56" height="16.56" rx="2" stroke="#262C31" strokeWidth="1.4" /><path d="M7.5 18.2812V1.71875" stroke="#262C31" strokeWidth="1.4" /><path d="M13.3594 11.9922L11.0156 9.64844L13.3594 7.30469" stroke="#262C31" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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
