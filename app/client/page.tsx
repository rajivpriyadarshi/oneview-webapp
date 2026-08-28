"use client";

import { type CSSProperties, type ReactNode, createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import SuggestionChip from "../components/SuggestionChip";
import { useChat } from "@ai-sdk/react";
import {
  ArcElement,
  Chart as ChartJS,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
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
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import { MobileHeader } from "../components/MobileHeader";
import { SourceWealthChart } from "../components/SourceWealthChart";
import DocumentsListView from "../components/DocumentsListView";
import InteractionsTabContent from "../components/InteractionsTabContent";
import { ClientLottie } from "../components/ClientLottie";
import { WorkflowExecutionSteps, useWorkflowExecutionPlan } from "../components/WorkflowExecutionSteps";
import { ArtifactPopupProvider } from "../contexts/ArtifactContext";
import { useArtifactContext } from "../hooks/useArtifactContext";
import ArtifactMessage from "../components/ArtifactMessage";
import ArtifactPopup from "../components/ArtifactPopup";
import {
  getArtifactFromPart,
  getArtifactFromParts,
  normalizeAiChatMessage,
  transformAiChatSseResponse,
} from "../utils/aiChatParts";
import {
  type AiChatSession,
  type ChatPrompt,
  aiChatFetch,
  archiveAiChatSession,
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
  pinAiChatSession,
  readStoredAiChatSessions,
  upsertStoredAiChatSession,
  writeStoredAiChatSessions,
} from "../lib/aiChatApi";
import { appConfig } from "../lib/config";
import {
  dismissClientInsight,
  getWealthCrmClient,
  getClientDetail,
  listWealthCrmClients,
  type WealthCrmClient,
  type ClientDetailResponse,
} from "../lib/wealthCrmApi";

ChartJS.register(ArcElement, Tooltip);

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

const ATTENTION_ITEMS = [
  {
    action: "How has the portfolio performed in the last month?",
    prompt: "How has the portfolio performed in the last month?",
  },
  {
    action: "When is my next meeting?",
    prompt: "When is my next meeting?",
  },
  {
    action: "Any upcoming liquidity needs?",
    prompt: "Any upcoming liquidity needs?",
  },
  {
    action: "Any outstanding follow-ups?",
    prompt: "Any outstanding follow-ups?",
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

const MOCK_ASSET_ALLOCATION_BUCKETS = [
  { label: "ETF", value: "6900000", pct: "34.30" },
  { label: "EQUITY", value: "5200000", pct: "25.87" },
  { label: "FIXED INCOME", value: "3600000", pct: "17.91" },
  { label: "REAL ASSETS", value: "2600000", pct: "12.94" },
  { label: "HEDGE FUNDS", value: "1800000", pct: "8.96" },
];
const ASSET_ALLOCATION_CHART_ROTATION_DEG = -90;

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
type ClientTab = "overview" | "wealth-map" | "interactions" | "documents";

const WARM_CHAT_CACHE_MAX_AGE_MS = 30_000;
const PENDING_LOCAL_CHAT_MAX_AGE_MS = 2 * 60_000;

const TW = {
  shell: "h-screen overflow-hidden bg-white text-[#171615]",
  mobileHistoryBtn: "hidden h-[36px] w-[36px] items-center justify-center rounded-full border-0 bg-transparent text-[#7f4e0b] max-md:inline-flex hover:bg-[#7f4e0b]/10",
  mobileHeaderBtn: "inline-flex shrink-0 items-center gap-[8px] rounded-full border border-[#804d13]/20 bg-[#f0ebe0] py-[8px] pr-[12px] pl-[8px] font-satoshi text-[13px] text-[#804d13] hover:bg-[#e8e0d0]",
  mobileHeaderBtnIcon: "inline-grid place-items-center rounded-full bg-gradient-to-b from-[#b37f40] to-[#432411] p-[6px] text-white",
  workspace: "relative ml-[80px] grid h-screen grid-cols-[434px_minmax(0,1fr)] overflow-hidden bg-white max-[1180px]:grid-cols-[minmax(360px,420px)_minmax(0,1fr)] max-[900px]:h-[calc(100vh-66px)] max-[900px]:grid-cols-1 max-[900px]:overflow-auto max-[720px]:ml-0",
  advisorPanel: "relative grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] border-r border-black/10 bg-white max-[900px]:h-auto max-[900px]:min-h-[calc(100vh-66px)] max-[900px]:grid-rows-[auto_auto_auto]",
  advisorHeader: "relative z-[40] flex h-[54px] min-w-0 items-center justify-between gap-[12px] overflow-visible border-b border-black/10 bg-white/70 px-[16px] backdrop-blur-[12px] max-[640px]:px-[12px]",
  conversationMenuWrap: "relative min-w-0 flex-1 overflow-visible text-left",
  // Not w-full: the chevron should sit right after the title, so the button
  // hugs its content and only the text truncates once it runs out of room.
  conversationBtn: "inline-flex min-w-0 max-w-full cursor-pointer items-center justify-start gap-[5px] overflow-hidden rounded-[10px] border-0 bg-transparent py-[8px] text-left font-satoshi text-[14px] font-bold leading-[130%] tracking-[-0.28px] text-black [&_svg]:h-[16px] [&_svg]:w-[16px] [&_svg]:shrink-0",
  conversationText: "block min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap",
  conversationDropdown: "absolute top-[43px] left-[-7px] z-[60] w-[238px] max-h-[50vh] overflow-y-auto rounded-[22px] border border-black/10 bg-white shadow-[0_24px_60px_rgba(0,0,0,0.14)] max-[640px]:left-[-4px] max-[640px]:w-[calc(100vw-64px)]",
  conversationDropdownItem: "flex min-h-[46px] w-full cursor-pointer items-center border-0 border-b border-black/10 bg-white px-[24px] text-left font-satoshi text-[13px] font-normal leading-[1.15] text-black transition last:border-b-0 hover:bg-black/[0.025]",
  conversationDropdownEmpty: "flex min-h-[46px] items-center px-[24px] font-satoshi text-[13px] font-normal text-black/40",
  advisorAddBtn: "inline-grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[12px] border border-black/[0.08] bg-transparent text-black transition hover:bg-black/[0.03] [&_svg]:h-[16px] [&_svg]:w-[16px]",
  attentionContent: "flex min-h-0 flex-col justify-center overflow-auto px-[20px] pt-[64px] pb-[190px] max-[900px]:px-[56px] max-[900px]:pt-[64px] max-[900px]:pb-[210px] max-[640px]:px-[16px] max-[640px]:pt-[48px] max-[640px]:pb-[170px]",
  attentionTitle: "m-0 mb-[20px] max-w-[394px] font-butler-medium text-[40px] font-medium leading-[48px] tracking-[-2px] text-black [font-feature-settings:'kern'_on,'liga'_on] [font-kerning:normal] [font-variant-ligatures:normal] [overflow-wrap:break-word] max-[640px]:max-w-[320px] max-[640px]:text-[36px] max-[640px]:leading-[43.2px] max-[640px]:tracking-[-1.6px]",
  attentionList: "grid max-w-[394px] gap-[8px] justify-items-start",
  promptChipsRow: "mb-[6px] flex items-center justify-between gap-[4px] overflow-hidden rounded-[22px] px-[10px] pt-[4px] pb-[0px]",
  promptChipsLeft: "flex min-w-0 flex-1 items-center gap-[8px] overflow-hidden max-[640px]:gap-[6px]",
  promptChipsLeftExpanded: "!overflow-visible flex-wrap",
  promptChip: "inline-flex min-w-0 shrink-0 cursor-pointer items-center rounded-full border border-white/60 bg-[#0000000A] px-[11px] py-[7px] font-satoshi text-[12px] font-normal leading-[16.2px] text-[#5d6b77] transition hover:bg-black/[0.07] max-[640px]:max-w-[145px] max-[640px]:truncate",
  promptChipExpand: "inline-flex h-[32px] w-[40px] shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/60 text-black transition hover:bg-white/85 [&_svg]:h-[13px] [&_svg]:w-[13px] max-[640px]:h-[32px] max-[640px]:w-[40px] max-[640px]:[&_svg]:h-[13px] max-[640px]:[&_svg]:w-[13px]",
  // Gaps must track promptChipsLeft above — this row is what the overflow
  // measurement counts against.
  promptMeasure: "pointer-events-none invisible absolute -z-10 flex items-center gap-[8px] whitespace-nowrap max-[640px]:gap-[6px]",
  promptMeasureChip: "inline-flex shrink-0 items-center rounded-full border border-white/60 bg-black/[0.035] px-[11px] py-[7px] font-satoshi text-[12px] font-normal leading-[16.2px] text-[#5d6b77]",
  compactThread: "absolute right-[17px] bottom-[16px] left-[16px] z-[5] max-[1180px]:right-[16px] max-[1180px]:left-[16px] max-[900px]:right-[20px] max-[900px]:left-[20px] max-[640px]:right-[14px] max-[640px]:bottom-[16px] max-[640px]:left-[14px]",
  fullThread: "top-[54px] !right-0 !left-0",
  loading: "flex min-h-screen flex-col items-center justify-center p-[32px] font-satoshi text-[13px] text-black/50",
  notice: "m-0 rounded-lg border border-[#171615]/10 bg-white/50 p-[12px] font-satoshi text-[13px] leading-snug text-[#171615]/50",
  thread: "relative flex h-full min-h-0 flex-col overflow-hidden",
  assistantThread: "flex h-full min-h-0 flex-1 flex-col",
  emptyViewport: "block overflow-visible",
  emptyCopy: "mx-auto flex w-full flex-col items-center p-0 text-center rounded-[30px]",
  emptyHeading: "hidden",
  suggestionsWrap: "hidden",
  suggestionsRow: "flex overflow-hidden py-1",
  suggestionsRowInner: "flex shrink-0 gap-2.5",
  suggestionPill: "inline-flex shrink-0 items-center gap-[8px] rounded-full border border-[#171615]/10 bg-white/30 px-[12px] py-[10px] font-satoshi text-[13px] leading-tight text-black backdrop-blur-xl transition hover:-translate-y-px hover:bg-white/55",
  messageViewport: "relative min-h-0 flex-1 overflow-y-auto pr-[44px] pl-[22px] pt-[24px] pb-[176px] max-[1180px]:pr-[38px] max-[1180px]:pl-[20px] max-[900px]:pr-[36px] max-[900px]:pl-[20px] max-[640px]:pr-[28px] max-[640px]:pl-[14px] max-[640px]:pb-[160px]",
  threadFooter: "sticky bottom-0 z-[5] bg-transparent pt-3",
  scrollToBottom: "hidden data-[state=visible]:inline-grid absolute left-1/2 top-[-16px] h-9 w-9 -translate-x-1/2 -translate-y-full place-items-center rounded-full border border-white/60 bg-white/85 text-[#171615] shadow-[0_2px_12px_rgba(0,0,0,0.12)] backdrop-blur-xl",
  errorBanner: "mx-auto mb-[10px] w-full rounded-lg border border-[#973022]/20 bg-white/70 px-[12px] py-[10px] font-satoshi text-[13px] text-[#8f2415]",
  composerDock: "absolute right-0 bottom-0 left-0 z-10 bg-transparent px-[22px] max-[1180px]:px-[20px] max-[900px]:px-[20px] max-[640px]:px-[14px]",
  composerWrap: "w-full rounded-[20px] border border-white bg-[#f7f7f7] p-[1px] pt-[6px]",
  composer: "relative mx-auto flex min-h-[74px] w-full items-center rounded-[24px] border border-black/[0.06] bg-white/90 py-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition",
  composerThinking: "ring-1 ring-[#b37f40]/40",
  composerInputRow: "min-w-0 flex-1 px-[24px] max-[640px]:px-[16px]",
  composerInput: "h-auto min-h-0 w-full resize-none border-0 bg-transparent p-0 font-satoshi text-[16px] font-normal leading-[1.35] tracking-[-0.16px] text-black outline-none [overflow-wrap:break-word] placeholder:text-[16px] placeholder:font-normal placeholder:leading-[1.35] placeholder:tracking-[-0.16px] placeholder:text-black/60",
  composerFooter: "hidden",
  composerFooterLeft: "flex min-w-0 items-center gap-[9px]",
  composerFooterRight: "flex items-center gap-[10px]",
  composerIconBtn: "inline-grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-0 bg-transparent p-0 text-black transition hover:bg-black/5 [&_svg]:h-[20px] [&_svg]:w-[20px]",
  composerModeBtn: "inline-flex min-h-[32px] min-w-0 items-center gap-[9px] rounded-full border border-black/10 bg-white px-[12px] font-satoshi text-[12px] font-normal leading-[14.4px] text-black [overflow-wrap:break-word] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition hover:bg-black/[0.02] max-[640px]:max-w-[168px]",
  composerModeText: "truncate font-satoshi text-[12px] font-normal leading-[14.4px] text-black [overflow-wrap:break-word]",
  sendBtn: "inline-grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border-0 bg-black p-0 text-white transition hover:-translate-y-px hover:bg-[#2d2926] disabled:bg-black disabled:text-white [&_svg]:h-[24px] [&_svg]:w-[24px] max-[640px]:h-[38px] max-[640px]:w-[38px]",
  messageUser: "mb-[18px] flex w-full justify-end gap-2.5",
  messageAssistant: "mb-[18px] flex w-full justify-start gap-2.5",
  messageContent: "max-w-full [overflow-wrap:anywhere] rounded-lg font-satoshi text-[13px] leading-relaxed text-black",
  // Self-contained (not layered on messageContent) so its 14px type isn't
  // fighting that block's text-[13px]. Matches the full chat screen.
  userMessageContent: "max-w-full [overflow-wrap:anywhere] rounded-[20px_20px_0_20px] bg-[#F3F3F3] p-[16px] font-satoshi text-[14px] font-medium leading-[1.5] tracking-[-0.16px] text-[#0D0D0D]",
  assistantMessageContent: "py-1",
  messageStack: "max-w-full",
  replySuggestions: "mt-3 mb-1.5 flex max-w-full flex-col items-start gap-[10px]",
  messageControls: "mt-2 inline-flex items-center gap-1.5",
  inlineControls: "inline-flex items-center gap-1.5 text-[#171615]/50",
  actionBtn: "inline-grid h-[30px] w-[30px] place-items-center rounded-full border border-white/60 bg-white/50 text-[#171615]/60 shadow-sm backdrop-blur transition hover:-translate-y-px hover:bg-white/70 hover:text-[#171615]",
  branchCount: "font-satoshi text-[12px] font-bold tabular-nums",
  markdown: "[overflow-wrap:anywhere] font-satoshi text-[14px] leading-[1.5] tracking-[-0.16px] text-[#0D0D0D] [&_a]:text-[#0e5f5b] [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[#0e5f5b]/20 [&_blockquote]:pl-[14px] [&_blockquote]:text-[#171615]/70 [&_code]:rounded [&_code]:bg-[#171615]/10 [&_code]:px-[6px] [&_code]:py-[2px] [&_code]:font-mono [&_code]:text-[0.88em] [&_h1]:mb-[10px] [&_h1]:text-[1em] [&_h1]:font-bold [&_h2]:mb-[10px] [&_h2]:text-[1em] [&_h2]:font-bold [&_h3]:mb-[10px] [&_h3]:text-[1em] [&_h3]:font-bold [&_li]:my-[4px] [&_ol]:mb-[16px] [&_ol]:list-decimal [&_ol]:pl-[20px] [&_p]:mb-[16px] [&_pre]:mb-[16px] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#171615]/10 [&_pre]:p-[12px] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_table]:mb-[16px] [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#171615]/10 [&_td]:p-[8px] [&_th]:border [&_th]:border-[#171615]/10 [&_th]:bg-white/60 [&_th]:p-[8px] [&_th]:text-left [&_th]:font-bold [&_ul]:mb-[16px] [&_ul]:list-disc [&_ul]:pl-[20px] [&>*:last-child]:mb-0",
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
  inlineStatus: "mt-[10px] inline-flex w-fit items-center gap-[6px] rounded-full bg-[#171615]/5 px-[10px] py-[4px] font-satoshi text-[11px] font-bold leading-tight text-[#171615]/60",
  inlineStatusActive: "mt-[10px] inline-flex items-center gap-[6px] bg-transparent px-0 py-[4px] font-satoshi text-[12px] font-normal text-black/50",
  loadingDots: "ml-0.5 inline-flex items-center gap-[3px]",
  loadingDot: "h-1 w-1 rounded-full bg-current",
};

type ExecutionPlanData = { schema_version: number; flow_hash: string; steps: { position: number; node_id: string; component_type: string; label: string; description: string[]; group_id?: string; group_label?: string }[] };
const WorkflowPlanContext = createContext<ExecutionPlanData | null>(null);

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedClientId = searchParams.get("clientId") ?? searchParams.get("client_id");
  const [initialPromptParam, setInitialPromptParam] = useState(() => searchParams.get("prompt") ?? null);
  const [initialWorkflowTool] = useState(() => searchParams.get("workflow_tool") ?? null);
  const [workflowExecutionPlan, setWorkflowExecutionPlan] = useWorkflowExecutionPlan();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [client, setClient] = useState<WealthCrmClient | null>(null);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatUiMessage[]>([]);
  const [chatResetId, setChatResetId] = useState(0);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isDraftChat, setIsDraftChat] = useState(true);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<ChatPrompt[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSessions, setArchivedSessions] = useState<AiChatSession[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const sessionsRefreshRef = useRef(0);
  const conversationMenuRef = useRef<HTMLDivElement | null>(null);
  const chatClientId = client?.id ?? requestedClientId ?? null;
  const chatRoute = chatClientId ? `/client?clientId=${encodeURIComponent(String(chatClientId))}` : "/client";

  const resolveChatClient = useCallback(async () => {
    if (client || requestedClientId) {
      return client;
    }

    setIsLoadingClient(true);

    try {
      const activeClients = await listWealthCrmClients({ isActive: true });
      const nextClient = activeClients[0] ?? (await listWealthCrmClients())[0] ?? null;
      setClient(nextClient);

      if (!nextClient) {
        setNotice("Could not find an assigned CRM client for this chat.");
      }

      return nextClient;
    } catch (error) {
      console.error("Failed to resolve wealth CRM client:", error);
      setClient(null);
      setNotice("Could not find an assigned CRM client for this chat.");
      return null;
    } finally {
      setIsLoadingClient(false);
    }
  }, [client, requestedClientId]);

  useEffect(() => {
    let cancelled = false;

    async function loadClient() {
      setIsLoadingClient(true);

      try {
        let nextClient: WealthCrmClient | null = null;

        if (requestedClientId) {
          nextClient = await getWealthCrmClient(requestedClientId);
        } else {
          const activeClients = await listWealthCrmClients({ isActive: true });
          nextClient = activeClients[0] ?? (await listWealthCrmClients())[0] ?? null;
        }

        if (!cancelled) {
          console.log("ChatPage: Loaded client:", nextClient);
          setClient(nextClient);
        }
      } catch (error) {
        console.error("Failed to load wealth CRM client:", error);
        if (!cancelled) {
          setClient(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClient(false);
        }
      }
    }

    void loadClient();

    return () => {
      cancelled = true;
    };
  }, [requestedClientId]);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      listChatPrompts(),
      listChatWorkflowCommands({ agent: getAiAgentSlug() }),
    ])
      .then(([promptResult, workflowResult]) => {
        if (!cancelled) {
          const staticPrompts = promptResult.status === "fulfilled" ? promptResult.value : [];
          const workflowPrompts = workflowResult.status === "fulfilled"
            ? workflowResult.value.map((command, index): ChatPrompt => ({
                id: -index - 1,
                title: command.name || command.command.replace(/^\//, ""),
                description: command.description || command.command,
                user_message: command.invocation_prompt || command.command,
                workflow_intent: {
                  tool_name: command.tool_name,
                  mode: "run",
                },
                execution_plan: command.execution_plan,
              }))
            : [];

          setPrompts(workflowPrompts.length > 0 ? workflowPrompts : mergeChatPrompts(workflowPrompts, staticPrompts));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrompts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!conversationMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || conversationMenuRef.current?.contains(target)) {
        return;
      }

      setConversationMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConversationMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [conversationMenuOpen]);

  const refreshSessions = useCallback(
    async ({ showCached = false, showLoading = false }: { showCached?: boolean; showLoading?: boolean } = {}) => {
      const requestId = ++sessionsRefreshRef.current;
      const clientId = chatClientId;

      if (showLoading) {
        setIsLoadingSessions(true);
      }

      if (!clientId) {
        setSessions([]);
        setIsLoadingSessions(false);
        return;
      }

      if (showCached) {
        const cachedSessions = getVisibleSessions(
          readStoredAiChatSessions({ maxAgeMs: WARM_CHAT_CACHE_MAX_AGE_MS }),
        ).filter((session) => String(session.client_id ?? "") === String(clientId));
        if (cachedSessions.length > 0) {
          setSessions(cachedSessions);
        }
      }

      try {
        const serverSessions = getVisibleSessions(await listAiChatSessions({ clientId }));
        if (requestId !== sessionsRefreshRef.current) {
          return;
        }

        const serverIds = new Set(serverSessions.map((session) => session.id));
        const pendingLocalSessions = getVisibleSessions(
          readStoredAiChatSessions({ maxAgeMs: PENDING_LOCAL_CHAT_MAX_AGE_MS }),
        ).filter((session) => {
          return session.source === "local" && String(session.client_id ?? "") === String(clientId) && !serverIds.has(session.id);
        });
        const nextSessions = mergeAiChatSessions(serverSessions, pendingLocalSessions);

        setSessions((current) => {
          const currentById = new Map(current.map((s) => [s.id, s]));
          return nextSessions.map((s) => {
            const local = currentById.get(s.id);
            if (local && local.title && local.title !== "New chat" && (!s.title || s.title === "New chat")) {
              return { ...s, title: local.title };
            }
            return s;
          });
        });
        writeStoredAiChatSessions(serverSessions);
        setNotice(null);
      } catch (error) {
        console.error("Failed to load AI chat sessions:", error);
        if (requestId === sessionsRefreshRef.current) {
          const fallbackSessions = getVisibleSessions(readStoredAiChatSessions());
          setSessions(fallbackSessions.filter((session) => String(session.client_id ?? "") === String(clientId)));
        }
      } finally {
        if (requestId === sessionsRefreshRef.current) {
          setIsLoadingSessions(false);
        }
      }
    },
    [chatClientId],
  );

  useEffect(() => {
    if (!isLoadingClient) {
      void refreshSessions({ showCached: true, showLoading: true });
    }
  }, [isLoadingClient, refreshSessions]);

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
  const isChatActive = hasStartedChat || Boolean(selectedSessionId) || Boolean(initialPromptParam) || initialMessages.length > 0;
  const chatThreadKeyRef = useRef<string | null>(null);
  const prevResetIdRef = useRef(chatResetId);
  const prevClientIdRef = useRef(chatClientId);
  const chatThreadKey = useMemo(() => {
    const resetChanged = chatResetId !== prevResetIdRef.current;
    const clientChanged = chatClientId !== prevClientIdRef.current;
    prevResetIdRef.current = chatResetId;
    prevClientIdRef.current = chatClientId;
    const baseKey = `${chatClientId ?? "pending-client"}:${chatResetId}`;
    if (resetChanged || clientChanged || !chatThreadKeyRef.current) {
      if (selectedSession && !initialPromptParam) {
        chatThreadKeyRef.current = `${baseKey}:${selectedSession.id}`;
      } else {
        chatThreadKeyRef.current = `${baseKey}:${initialPromptParam ?? "draft"}`;
      }
    }
    return chatThreadKeyRef.current;
  }, [chatClientId, chatResetId, selectedSession, initialPromptParam]);

  const selectSession = async (session: AiChatSession) => {
    setIsDraftChat(false);
    setHasStartedChat(true);
    setSelectedSessionId(session.id);
    setConversationMenuOpen(false);
    setMobileRailOpen(false);
    setIsLoadingMessages(true);
    setNotice(null);
    setWorkflowExecutionPlan(null);

    try {
      const messages = (await loadAiChatMessages(session.id, { clientId: chatClientId })) as ChatUiMessage[];
      const normalizedMessages = messages.map(normalizeAiChatMessage);
      setInitialMessages(normalizedMessages);
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
    setHasStartedChat(false);
    setSelectedSessionId(null);
    setConversationMenuOpen(false);
    setInitialMessages([]);
    setNotice(null);
    setMobileRailOpen(false);
    setInitialPromptParam(null);
    setChatResetId((id) => id + 1);
    router.replace(chatRoute);
  };

  const startPromptChat = async (prompt: string) => {
    setIsDraftChat(true);
    setHasStartedChat(true);
    setSelectedSessionId(null);
    setInitialMessages([]);
    setNotice(null);
    setMobileRailOpen(false);
    setInitialPromptParam(prompt);
    setChatResetId((id) => id + 1);
    router.replace(chatRoute);
    await resolveChatClient();
  };

  const handleTogglePin = async (session: AiChatSession) => {
    const nextPinned = !session.is_pinned;
    setSessions((current) =>
      current.map((item) => (item.id === session.id ? { ...item, is_pinned: nextPinned } : item)),
    );

    try {
      const updated = await pinAiChatSession(session.id, nextPinned, { clientId: chatClientId });
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
      const updated = await archiveAiChatSession(session.id, true, { clientId: chatClientId });
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
      const updated = await archiveAiChatSession(session.id, false, { clientId: chatClientId });
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
      const archived = await listAiChatSessions({ archivedOnly: true, clientId: chatClientId });
      setArchivedSessions(archived);
    } catch (error) {
      console.error("Failed to load archived chats:", error);
      setNotice("Could not load archived chats.");
    } finally {
      setIsLoadingArchived(false);
    }
  };

  const updateSessionFromPrompt = (prompt: string) => {
    setHasStartedChat(true);

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
    setHasStartedChat(true);

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
        existingSession?.title && existingSession.title !== "New conversation"
          ? existingSession.title
          : "New conversation",
      agent: existingSession?.agent ?? getAiAgentSlug(),
      client_id: existingSession?.client_id ?? chatClientId ?? undefined,
      created_at: existingSession?.created_at,
      updated_at: new Date().toISOString(),
      source: existingSession?.source ?? "local",
    };

    upsertStoredAiChatSession(nextSession);
    setSessions((current) => mergeAiChatSessions([nextSession], current));
    setInitialMessages(messages.map(normalizeAiChatMessage));
    setSelectedSessionId(sessionId);
    setIsDraftChat(false);
    window.setTimeout(() => void refreshSessions(), 300);
    window.setTimeout(() => void refreshSessions(), 2000);
  };

  return (
    <div className={TW.shell}>
      <Sidebar />
      <MobileHeader
        onMenuOpen={() => setMobileRailOpen(true)}
        logo={
          <button type="button" className={TW.mobileHistoryBtn} aria-label="Chat history" onClick={() => setMobileRailOpen(v => !v)}>
            <HistoryIcon />
          </button>
        }
        right={
          <button type="button" className={TW.mobileHeaderBtn} onClick={startNewChat}>
            <span className={TW.mobileHeaderBtnIcon}><PlusIcon /></span>
            New chat
          </button>
        }
      />
      <ArtifactPopupProvider autoOpenEnabled={true} positioning="client-panel">
        <main className={TW.workspace}>
          <aside className={TW.advisorPanel} aria-label="Advisor chat">
          <div className={`${TW.advisorHeader} stagger-in`} style={{ "--stagger-index": 0 } as CSSProperties}>
            <div className={TW.conversationMenuWrap} ref={conversationMenuRef}>
              <div
                className={TW.conversationBtn}
                onClick={() => setConversationMenuOpen((open) => !open)}
              >
                <span className={TW.conversationText}>
                  {selectedSession?.title && selectedSession.title !== "New chat" ? selectedSession.title : "New conversation"}
                </span>
                <ChevronDownIcon />
              </div>
              {conversationMenuOpen ? (
                <div className={TW.conversationDropdown} role="menu">
                  {isLoadingSessions ? (
                    <div className={TW.conversationDropdownEmpty}>Loading chats...</div>
                  ) : sessions.length > 0 ? (
                    sessions.map((session) => (
                      <div
                        key={session.id}
                        ref={(el) => { if (el && selectedSession?.id === session.id) { requestAnimationFrame(() => { const container = el.closest('[role="menu"]'); if (container) { container.scrollTop = Math.max(0, el.offsetTop - el.offsetHeight); } }); } }}
                        className={`${TW.conversationDropdownItem} ${selectedSession?.id === session.id ? "!bg-black/[0.05] font-medium" : ""}`}
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => void selectSession(session)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void selectSession(session);
                          }
                        }}
                      >
                        <span className="truncate">{session.title}</span>
                      </div>
                    ))
                  ) : (
                    <div className={TW.conversationDropdownEmpty}>No chats yet</div>
                  )}
                </div>
              ) : null}
            </div>
            <NewChatButton onClick={startNewChat} />

          </div>

          {!isChatActive ? (
            <div className={TW.attentionContent}>
              {/* Title, then each chip, cascade in via .stagger-in. The stagger
                  sits on a wrapper, never the chip: an entrance animation with
                  `both` holds transform: none and would kill the chip's hover
                  lift — see .hover-lift in globals.css. */}
              <h1 className={`${TW.attentionTitle} stagger-in`} style={{ "--stagger-index": 1 } as CSSProperties}>What can I help<br/>you with?</h1>
              <div className={TW.attentionList}>
                {ATTENTION_ITEMS.map((item, i) => (
                  <div key={item.action} className="stagger-in max-w-full" style={{ "--stagger-index": i + 2 } as CSSProperties}>
                    <SuggestionChip
                      label={item.action}
                      className="max-w-full"
                      onClick={() => void startPromptChat(item.prompt)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className={`${TW.compactThread} ${isChatActive ? TW.fullThread : ""}`}>
            {((isLoadingClient || !chatClientId) && isChatActive) || isLoadingMessages ? (
              <div className={TW.loading}>Loading chat...</div>
            ) : (
              <ChatThread
                key={chatThreadKey}
                session={selectedSession}
                initialMessages={initialMessages}
                prompts={prompts}
                clientId={chatClientId}
                onPromptSubmitted={updateSessionFromPrompt}
                onAssistantFinished={handleAssistantFinished}
                initialPrompt={isDraftChat && !selectedSession ? initialPromptParam : null}
                initialWorkflowTool={isDraftChat && !selectedSession ? initialWorkflowTool : null}
                executionPlan={workflowExecutionPlan}
                onExecutionPlanChange={setWorkflowExecutionPlan}
              />
            )}
          </div>
          {notice ? <p className={TW.notice}>{notice}</p> : null}
        </aside>

        <ClientOverview
          client={client}
          isLoadingClient={isLoadingClient}
          requestedClientId={requestedClientId}
          onAskAiInsight={(prompt) => void startPromptChat(prompt)}
        />
      </main>
      </ArtifactPopupProvider>
    </div>
  );
}

function getVisibleSessions(sessions: AiChatSession[]) {
  return mergeAiChatSessions(sessions).filter((session) => !session.is_archived);
}

function mergeChatPrompts(...groups: ChatPrompt[][]) {
  const byTitle = new Map<string, ChatPrompt>();

  for (const prompt of groups.flat()) {
    const key = prompt.title.trim().toLowerCase();
    if (!byTitle.has(key)) {
      byTitle.set(key, prompt);
    }
  }

  return Array.from(byTitle.values());
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
    <div className={`flex w-full items-center gap-1 rounded-xl py-1 pr-1 pl-3 text-left text-[#171615] transition hover:bg-black/5 ${active ? "bg-[#ede8df]" : "bg-transparent"}`}>
      <button type="button" className="flex min-w-0 flex-1 items-center border-0 bg-transparent py-2 text-left text-inherit" onClick={onSelect}>
        <span className={`truncate font-satoshi text-[13px] leading-snug text-[#171615] ${active ? "font-medium" : "font-normal"}`}>{session.title}</span>
      </button>
      <div className="flex items-center gap-0.5">
        {!archived && (
          <button
            type="button"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border-0 bg-transparent transition hover:bg-black/5 ${session.is_pinned ? "text-[#b37f40]" : "text-black/40"}`}
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
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-0 bg-transparent text-black/40 transition hover:bg-black/5 hover:text-[#171615]"
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
  clientId: number | string | null;
  onPromptSubmitted: (prompt: string) => void;
  onAssistantFinished: (details: {
    sessionId: string | null;
    prompt: string | null;
    messages: ChatUiMessage[];
  }) => void;
  initialPrompt?: string | null;
  initialWorkflowTool?: string | null;
  executionPlan?: ExecutionPlanData | null;
  onExecutionPlanChange?: (plan: ExecutionPlanData | null) => void;
};

function ChatThread({ session, initialMessages, prompts, clientId, onPromptSubmitted, onAssistantFinished, initialPrompt, initialWorkflowTool, executionPlan, onExecutionPlanChange }: ChatThreadProps) {
  const agent = getAiAgentSlug();
  const lastPromptRef = useRef<string | null>(null);
  const initialPromptFiredRef = useRef(false);
  const pendingSessionIdRef = useRef<string | null>(session?.id ?? null);
  const selectedPromptRef = useRef<ChatPrompt | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const sessionId = session?.id ?? null;

  useEffect(() => {
    pendingSessionIdRef.current = sessionId;
  }, [sessionId]);

  const transport = useMemo(
    () =>
      new AssistantChatTransport<ChatUiMessage>({
        api: clientId
          ? sessionId
            ? getCrmClientChatMessagesUrl(clientId, sessionId)
            : getCrmClientChatsUrl(clientId)
          : getCrmClientChatsUrl("missing-client"),
        credentials: "include",
        headers: getAiRequestHeaders(),
        fetch: async (input, init) => {
          const response = await aiChatFetch(input, init);
          const responseSessionId = response.headers.get("X-Session-Id");

          if (responseSessionId) {
            pendingSessionIdRef.current = responseSessionId;
          }

          return transformAiChatSseResponse(response);
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
          const latestUserMetadata = getMessageCustomMetadata(latestUserMessage?.metadata);
          if (!clientId) {
            throw new Error("CRM client id is required to send chat messages.");
          }

          const api = sessionId
            ? getCrmClientChatMessagesUrl(clientId, sessionId)
            : getCrmClientChatsUrl(clientId);

          if (prompt && prompt !== lastPromptRef.current) {
            lastPromptRef.current = prompt;
            onPromptSubmitted(prompt);
          }

          if (!sessionId) {
            pendingSessionIdRef.current = null;
          }

          const pendingWorkflow = selectedPromptRef.current;
          if (pendingWorkflow) {
            selectedPromptRef.current = null;
            setSelectedPromptId(null);
            onExecutionPlanChange?.(pendingWorkflow.execution_plan ?? null);
          } else {
            onExecutionPlanChange?.(null);
          }

          const { workflow_intent: _stripWf, ...safeUserMetadata } = latestUserMetadata as Record<string, unknown>;

          return {
            ...options,
            api,
            body: {
              ...body,
              message: prompt || latestUserMessage,
              messages,
              metadata: {
                ...safeUserMetadata,
                ...(pendingWorkflow?.workflow_intent ? { workflow_intent: pendingWorkflow.workflow_intent } : {}),
                ...getRecord(body.metadata),
                agent,
                client_id: clientId,
              },
            },
          };
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
    onError(error) {
      console.error("AI chat stream failed:", error);
    },
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

  useEffect(() => {
    if (!initialPrompt || initialPromptFiredRef.current || !clientId) return;
    initialPromptFiredRef.current = true;
    if (initialWorkflowTool) {
      selectedPromptRef.current = { id: -9999, title: "", description: "", user_message: initialPrompt, workflow_intent: { tool_name: initialWorkflowTool, mode: "run" }, execution_plan: executionPlan ?? undefined };
    }
    void chat.sendMessage({
      text: initialPrompt,
    });
  }, [chat, clientId, initialPrompt, initialWorkflowTool, executionPlan]);

  return (
    <WorkflowPlanContext.Provider value={executionPlan ?? null}>
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={TW.thread}>
        <ThreadPrimitive.Root className={TW.assistantThread}>
          <AuiIf condition={(state) => state.thread.isEmpty}>
            <div className={TW.emptyViewport}>
              {/* Lands after the empty-state title and its chips above. */}
              <div className={`${TW.emptyCopy} stagger-in`} style={{ "--stagger-index": ATTENTION_ITEMS.length + 2 } as CSSProperties}>
                <p className={TW.emptyHeading}>Ask anything about your portfolio</p>
                <Composer
                  placeholder="What can I help you with?"
                  agent={agent}
                  prompts={prompts}
                  onPromptSelect={handlePromptSelect}
                  selectedPromptId={selectedPromptId}
                />
              </div>
              <div className={TW.suggestionsWrap}>
                {(() => {
                  const promptMessages = prompts.map((p) => p.user_message).filter(Boolean);
                  const row1 = promptMessages.length > 0
                    ? promptMessages.filter((_, i) => i % 2 === 0)
                    : PROMPT_SUGGESTIONS_ROW1;
                  const row2 = promptMessages.length > 0
                    ? promptMessages.filter((_, i) => i % 2 === 1)
                    : PROMPT_SUGGESTIONS_ROW2;
                  return [row1, row2].map((row, rowIndex) => (
                    <div className={TW.suggestionsRow} key={`row-${rowIndex}`}>
                      <div className={TW.suggestionsRowInner}>
                        {row.map((suggestion) => (
                          <ThreadPrimitive.Suggestion key={suggestion} prompt={suggestion} send className={TW.suggestionPill}>
                            <SendArrowIcon />
                            {suggestion}
                          </ThreadPrimitive.Suggestion>
                        ))}
                        {row.map((suggestion) => (
                          <ThreadPrimitive.Suggestion key={`dup-${suggestion}`} prompt={suggestion} send className={TW.suggestionPill}>
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
            <ThreadPrimitive.Viewport className={TW.messageViewport} autoScroll>
              <ThreadPrimitive.Messages>
                {({ message }) => (
                  message.role === "user"
                    ? <UserMessage />
                    : <AssistantMessage message={message} showReplySuggestions={message.isLast} />
                )}
              </ThreadPrimitive.Messages>
              <ThreadThinking />
              <ThreadPrimitive.ViewportFooter className={TW.threadFooter}>
                <ThreadPrimitive.ScrollToBottom className={TW.scrollToBottom} aria-label="Scroll to bottom">
                  <ArrowDownIcon />
                </ThreadPrimitive.ScrollToBottom>
              </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
          </AuiIf>
        </ThreadPrimitive.Root>

        {chat.error ? (
          <div className={TW.errorBanner} role="alert">
            {chat.error.message || "The chat stream failed. Please try again."}
          </div>
        ) : null}

        <AuiIf condition={(state) => !state.thread.isEmpty}>
          <div className={TW.composerDock}>
            <Composer
              placeholder="Ask a follow-up..."
              agent={agent}
              prompts={prompts}
              onPromptSelect={handlePromptSelect}
              selectedPromptId={selectedPromptId}
            />
          </div>
        </AuiIf>
      </div>
    </AssistantRuntimeProvider>
    </WorkflowPlanContext.Provider>
  );
}

function ClientOverview({
  client,
  isLoadingClient,
  requestedClientId,
  onAskAiInsight,
}: {
  client: WealthCrmClient | null;
  isLoadingClient: boolean;
  requestedClientId: string | null;
  onAskAiInsight: (prompt: string) => void;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const validTabs: ClientTab[] = ["overview", "wealth-map", "interactions", "documents"];
  const [activeTab, setActiveTab] = useState<ClientTab>(
    validTabs.includes(tabParam as ClientTab) ? (tabParam as ClientTab) : "overview"
  );
  const [focusedInteractionId, setFocusedInteractionId] = useState<number | null>(null);
  const [principalImage, setPrincipalImage] = useState<string>("/principal-node/others.png");
  const clientId = client?.id ?? (requestedClientId ? Number(requestedClientId) : null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    getClientDetail(clientId).then((detail) => {
      if (cancelled) return;
      const src = getOverviewImageSrc(detail, client);
      setPrincipalImage(src.replace("/overview/", "/principal-node/"));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [clientId, client]);

  return (
    <section className="relative grid h-screen min-w-0 overflow-hidden grid-rows-[auto_minmax(0,1fr)] bg-[#F9F8F7] max-[900px]:h-auto max-[900px]:min-h-[calc(100vh-66px)]" aria-label="Client overview">
      <header className="flex h-[54px] min-w-0 items-center justify-between gap-[12px] overflow-hidden border-b border-black/10 bg-white/70 px-[16px] backdrop-blur-[12px] max-[900px]:sticky max-[900px]:top-0 max-[900px]:z-20 max-[640px]:px-[12px]">
        <nav className="no-scrollbar min-w-0 flex-1 overflow-x-auto" aria-label="Client sections">
          <ClientTabBar activeTab={activeTab} onSelect={setActiveTab} />
        </nav>
      </header>

      {activeTab === "overview" ? (
        <OverviewTab
          client={client}
          clientId={client?.id ?? requestedClientId}
          isLoadingClient={isLoadingClient}
          onAskAiInsight={onAskAiInsight}
          onOpenInteraction={(id) => { setFocusedInteractionId(id); setActiveTab("interactions"); }}
        />
      ) : null}
      {activeTab === "wealth-map" ? (
        <WealthMapTab
          clientId={client?.id ?? (requestedClientId ? Number(requestedClientId) : null)}
          clientImageSrc={principalImage}
          onProfileDetails={() => setActiveTab("overview")}
        />
      ) : null}
      {activeTab === "interactions" ? <InteractionsTab clientId={client?.id ?? (requestedClientId ? Number(requestedClientId) : null)} isLoadingClient={isLoadingClient} focusedInteractionId={focusedInteractionId} onFocusHandled={() => setFocusedInteractionId(null)} /> : null}
      {activeTab === "documents" ? <DocumentsTab clientId={client?.id ?? (requestedClientId ? Number(requestedClientId) : null)} /> : null}
      <ArtifactPopup />
    </section>
  );
}

const CLIENT_TABS: { id: ClientTab; label: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <OverviewIcon /> },
  { id: "wealth-map", label: "Wealth map", icon: <WealthMapIcon /> },
  { id: "interactions", label: "Interactions", icon: <InteractionsIcon /> },
  { id: "documents", label: "Documents", icon: <DocumentsNavIcon /> },
];

// The active #41240D pill is one shared element that slides between tabs rather
// than a background toggled per button, so switching tabs reads as movement.
// Its geometry has to be measured from the DOM — the labels are different
// widths and the nav scrolls horizontally — so the buttons register themselves
// and a layout effect copies the active one's offsetLeft/offsetWidth onto the
// pill. `ready` gates the transition: without it the pill would animate in from
// x=0 on first paint instead of starting under the initial tab.
function ClientTabBar({ activeTab, onSelect }: { activeTab: ClientTab; onSelect: (tab: ClientTab) => void }) {
  const itemsRef = useRef(new Map<ClientTab, HTMLLIElement>());
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemsRef.current.get(activeTab);
      if (!el) return;
      setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };

    measure();
    // The pill is positioned in the list's coordinate space, so it follows the
    // nav's scroll for free; only a resize (or a font swap changing label
    // widths) can invalidate the measurement.
    const observer = new ResizeObserver(measure);
    for (const el of itemsRef.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab]);

  useEffect(() => {
    // Also stays false under prefers-reduced-motion — the transition is set
    // inline, so a `motion-reduce:` utility could not turn it off.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <ul className="relative m-0 flex min-w-0 list-none items-center gap-[8px] p-0">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-full rounded-[42px] bg-[#41240D]"
        style={{
          transform: `translateX(${pill.left}px)`,
          width: pill.width,
          opacity: pill.width ? 1 : 0,
          transition: ready
            ? "transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), width 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease"
            : "none",
        }}
      />
      {CLIENT_TABS.map((tab) => (
        <ClientTabButton
          key={tab.id}
          active={activeTab === tab.id}
          icon={tab.icon}
          label={tab.label}
          onClick={() => onSelect(tab.id)}
          itemRef={(el) => {
            if (el) itemsRef.current.set(tab.id, el);
            else itemsRef.current.delete(tab.id);
          }}
        />
      ))}
    </ul>
  );
}

function ClientTabButton({
  active,
  icon,
  label,
  onClick,
  itemRef,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  itemRef: (el: HTMLLIElement | null) => void;
}) {
  return (
    // z-10 so the label sits above the sliding pill in ClientTabBar.
    <li ref={itemRef} className="relative z-10">
      <button
        type="button"
        // Per Figma 2411:15494: 8/12 padding, 5.137px icon gap, 17.124px icons,
        // 14px Satoshi Bold at -0.28px. Active is a #41240D pill (42px radius,
        // white text); inactive is transparent with a 12px radius. The active
        // fill itself is the shared pill behind these buttons, so only the text
        // colour changes here — it cross-fades as the pill arrives.
        className={`relative flex shrink-0 items-center gap-[5.137px] rounded-[42px] border-0 bg-transparent font-satoshi whitespace-nowrap [overflow-wrap:break-word] [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none] px-[12px] py-[8px] transition-colors duration-300 [&_svg]:h-[17.124px] [&_svg]:w-[17.124px] motion-reduce:transition-none ${
          active ? "text-white" : "text-black/80 hover:bg-black/5"
        }`}
        // Inline, not Tailwind: globals.css has an unlayered `button { font: inherit }`
        // that beats layered utilities, so text-[14px]/font-bold would be ignored.
        style={{
          fontSize: "14px", fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.28px",
          // globals.css only sets this on a few scoped selectors, so without it
          // macOS subpixel rendering makes Bold look heavier than Figma does.
          WebkitFontSmoothing: "antialiased",
        }}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        {icon}
        {label}
      </button>
    </li>
  );
}

// The overview's entrance order. One table rather than numbers scattered
// through the JSX, so the sequence can be read and reordered in one place.
const OVERVIEW_STAGGER = {
  backdrop: 0,
  name: 1,
  subtitle: 2,
  tags: 3,
  aumCard: 4,
  insights: 5,
  recentActivity: 6,
  recentActivityRows: 7,
};

function OverviewTab({
  client,
  clientId,
  isLoadingClient,
  onAskAiInsight,
  onOpenInteraction,
}: {
  client: WealthCrmClient | null;
  clientId: number | string | null;
  isLoadingClient: boolean;
  onAskAiInsight: (prompt: string) => void;
  onOpenInteraction: (id: number) => void;
}) {
  const [clientDetail, setClientDetail] = useState<ClientDetailResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [dismissedInsightIds, setDismissedInsightIds] = useState<Set<string>>(() => new Set());
  const searchParams = useSearchParams();
  const useMockAssetAllocation = searchParams.get("mock_asset_allocation") === "1";

  useEffect(() => {
    if (!clientId) {
      console.log("OverviewTab: No client ID, skipping API call");
      setClientDetail(null);
      setIsLoadingDetail(false);
      setDismissedInsightIds(new Set());
      return;
    }

    console.log("OverviewTab: Fetching client detail for ID:", clientId);
    let cancelled = false;
    setClientDetail(null);
    setIsLoadingDetail(true);
    setDismissedInsightIds(new Set());

    getClientDetail(clientId)
      .then((detail) => {
        if (!cancelled) {
          console.log("OverviewTab: Client detail loaded successfully:", detail);
          console.log("OverviewTab: AUM Change:", detail.aum?.change_1m, detail.aum?.change_1m_pct);
          console.log("OverviewTab: Asset Allocation Buckets:", detail.asset_allocation?.buckets);
          setClientDetail(detail);
        }
      })
      .catch((error) => {
        console.error("OverviewTab: Failed to load client detail:", error);
        if (!cancelled) {
          setClientDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleDismissInsight = useCallback(
    async (insight: OverviewInsight) => {
      if (!clientId || insight.id === undefined || insight.id === null) {
        return;
      }

      const insightId = String(insight.id);
      setDismissedInsightIds((current) => {
        const next = new Set(current);
        next.add(insightId);
        return next;
      });

      try {
        await dismissClientInsight(clientId, insight.id);
      } catch (error) {
        console.error("OverviewTab: Failed to dismiss insight:", error);
        setDismissedInsightIds((current) => {
          const next = new Set(current);
          next.delete(insightId);
          return next;
        });
      }
    },
    [clientId],
  );

  // Show loading state only while a request is actively in flight.
  if (isLoadingClient || isLoadingDetail) {
    return (
      <div className="relative min-h-0 overflow-auto bg-[#F9F8F7] pb-[48px]">
        <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center">
          <ClientLottie src="/loader.json" style={{ width: 200, height: 200 }} />
        </div>
      </div>
    );
  }

  if (!client && !clientDetail) {
    return (
      <div className="relative min-h-0 overflow-auto bg-[#F9F8F7] pb-[48px]">
        <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-[32px] text-center">
          <p className="m-0 font-satoshi text-[14px] text-black/50">No client details found.</p>
        </div>
      </div>
    );
  }

  // Use API data if available, otherwise fallback to client props
  const clientName = clientDetail?.header?.display_name || client?.display_name || client?.legal_name || "Client";
  const clientSubtitle = clientDetail?.header?.summary?.trim() || null;
  const moneyCurrency = clientDetail?.aum?.currency || client?.net_worth_currency || client?.base_currency;
  const clientAum = clientDetail?.aum?.total
    ? formatClientMoney(clientDetail.aum.total, clientDetail.aum.currency)
    : formatClientMoney(client?.net_worth, moneyCurrency);
  const clientSince = clientDetail?.at_a_glance?.client_since || getYear(client?.created_at) || "-";
  const segment = clientDetail?.at_a_glance?.segment || client?.segment || (client?.party_type ? formatLabelText(client.party_type) : "-");
  const familyStatus = clientDetail?.at_a_glance?.family?.trim() || client?.family_status || "-";
  const atAGlanceRecord = getRecord(clientDetail?.at_a_glance);
  const taxResidency = formatTaxResidency(
    getStringField(atAGlanceRecord, ["tax_residency", "primary_tax_jurisdiction", "tax_jurisdiction"])
      || client?.primary_tax_jurisdiction
      || clientDetail?.header?.tags?.[1],
  );
  const riskProfile = clientDetail?.at_a_glance?.risk_profile?.trim() || client?.risk_profile || "-";

  // AUM change data
  const aumChange = clientDetail?.aum?.change_1m
    ? formatClientMoney(clientDetail.aum.change_1m, clientDetail.aum.currency)
    : null;
  const aumChangePct = clientDetail?.aum?.change_1m_pct || null;
  const hasAumChange = Boolean(aumChange || aumChangePct);

  // Asset allocation data
  const assetAllocationData = useMockAssetAllocation
    ? MOCK_ASSET_ALLOCATION_BUCKETS
    : clientDetail?.asset_allocation?.buckets || [];
  const assetAllocationTotal = useMockAssetAllocation
    ? "$20.1M"
    : clientDetail?.asset_allocation?.total_managed
    ? formatClientMoney(clientDetail.asset_allocation.total_managed, clientDetail.asset_allocation.currency)
    : clientAum;
  const insightItems = getInsightItems(clientDetail?.insights);
  const visibleInsightItems = insightItems.filter((insight) => {
    const insightId = getInsightId(insight);
    return insightId === null || !dismissedInsightIds.has(String(insightId));
  });
  const hasInsights = visibleInsightItems.some((insight) => Boolean(normalizeInsight(insight)));
  const hasRecentActivity = (Array.isArray(clientDetail?.recent_activity) ? clientDetail.recent_activity : []).some((activity) => Boolean(normalizeActivity(activity)));
  const hasSidePanels = hasInsights || hasRecentActivity;
  const overviewImageSrc = getOverviewImageSrc(clientDetail, client);

  return (
    <div className="relative isolate min-h-0 overflow-auto bg-[#F9F8F7] pb-[48px]">
      {/* The overview builds up in one sequence: backdrop, name, subtitle,
          tags, the AUM card, then the side panels — and the recent-activity
          rows carry on from where the panels leave off (see OVERVIEW_STAGGER).
          Indices are explicit rather than derived because these are distinct
          elements, not a list. */}
      <div
        className="stagger-fade pointer-events-none absolute right-0 top-0 z-0 aspect-[1774/887] w-[92.8%] overflow-hidden bg-[#F9F8F7] max-[640px]:w-full"
        style={{ "--stagger-index": OVERVIEW_STAGGER.backdrop } as CSSProperties}
        aria-hidden="true"
      >
        <Image
          src={overviewImageSrc}
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 100vw, 92.8vw"
          className="object-cover"
        />
      </div>

      <section className="relative z-[1] bg-transparent px-[48px] pb-[56px] max-[1180px]:px-[24px] max-[640px]:px-[16px]">
        <div className="relative z-[1] flex w-full max-w-[540px] flex-col items-start gap-[16px] pt-[80px] max-[1180px]:pt-[72px] max-[640px]:pt-[48px]">
          <div className="flex w-full flex-col items-start">
            <h1
              className="stagger-in m-0 w-full font-butler-semibold text-[42px] font-semibold leading-[1.2] tracking-[-0.84px] text-[#261706] [font-feature-settings:'kern'_on,'liga'_off] [font-kerning:normal] [font-variant-ligatures:none] [overflow-wrap:break-word] max-[640px]:text-[34px]"
              style={{ "--stagger-index": OVERVIEW_STAGGER.name } as CSSProperties}
            >
              {clientName}
            </h1>
            {clientSubtitle ? (
              <p
                className="stagger-in m-0 w-full font-satoshi text-[16px] font-normal leading-[1.3] tracking-[-0.16px] text-black/80 [overflow-wrap:break-word]"
                style={{ "--stagger-index": OVERVIEW_STAGGER.subtitle } as CSSProperties}
              >
                {clientSubtitle}
              </p>
            ) : null}
          </div>
          <div
            className="stagger-in flex flex-wrap items-center gap-[10px]"
            style={{ "--stagger-index": OVERVIEW_STAGGER.tags } as CSSProperties}
            aria-label="Client tags"
          >
            <span className="inline-flex items-center justify-center rounded-[60px] bg-[rgba(127,78,11,0.08)] px-[16px] py-[8px] text-center font-satoshi text-[14px] font-bold leading-[1.2] tracking-[-0.28px] whitespace-nowrap text-black">{taxResidency}</span>
          </div>
        </div>
      </section>

      <div className={`relative z-[2] grid w-full gap-[16px] px-[48px] max-[1460px]:grid-cols-1 max-[1460px]:px-[24px] max-[640px]:px-[16px] ${hasSidePanels ? "grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"}`}>
        <div className="grid gap-[24px]">
          <div
            className="stagger-in flex w-full min-w-0 flex-col items-start gap-[32px] rounded-[16px] bg-[rgba(255,255,255,0.8)] px-[24px] py-[32px] max-[640px]:px-[20px] max-[640px]:py-[24px]"
            style={{
              "--stagger-index": OVERVIEW_STAGGER.aumCard,
              fontFeatureSettings: "'ss03' on, 'liga' off",
              fontKerning: "none",
              WebkitFontSmoothing: "antialiased",
            } as CSSProperties}
          >
            <section className="w-full">
              <div className="flex flex-col items-start gap-[4px]">
                <p className="m-0 font-satoshi text-[16px] font-bold leading-normal tracking-[1.92px] text-[#4D2E0C]">AUM</p>
                <div className="flex min-w-0 flex-wrap items-center gap-x-[12px] gap-y-[6px]">
                  <strong className="font-satoshi text-[32px] font-bold leading-normal tracking-normal whitespace-nowrap text-[#1A2229] max-[640px]:text-[28px]">{clientAum}</strong>
                  {hasAumChange ? (
                    <span className="inline-flex min-w-0 items-center gap-[6px] font-inter text-[13px] font-semibold leading-normal text-[#1E8A4B] max-[640px]:text-[12px]">
                      <Image src="/aum-trend-up.svg" alt="" width={12} height={12} className="h-[12px] w-[12px] shrink-0" />
                      {[aumChange, aumChangePct ? `${aumChangePct}% vs. last month` : null].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </div>
              </div>

              <h2 className="mt-[32px] mb-[16px] font-inter text-[12px] font-bold leading-normal uppercase text-[rgba(13,13,13,0.5)] max-[640px]:mt-[28px]">At a Glance</h2>
              <div className="flex w-full flex-col gap-[12px]">
                <AumFact label="Segment" value={segment} />
                <AumFact label="Client since" value={clientSince} />
                <AumFact label="Family" value={familyStatus} />
                <AumFact label="Tax Residency" value={taxResidency} />
                <AumFact label="Risk profile" value={riskProfile} last />
              </div>
            </section>

            <AssetAllocationChart
              totalLabel={assetAllocationTotal.replace(/\s/g, "")}
              buckets={assetAllocationData}
            />
          </div>
        </div>

        {hasSidePanels ? (
          <aside className="relative z-[3] grid content-start gap-[16px]">
            {hasInsights ? (
              <div className="stagger-in" style={{ "--stagger-index": OVERVIEW_STAGGER.insights } as CSSProperties}>
                <InsightPanel
                  insights={visibleInsightItems}
                  onAskAiInsight={onAskAiInsight}
                  onDismissInsight={handleDismissInsight}
                />
              </div>
            ) : null}
            {hasRecentActivity ? (
              <div className="stagger-in" style={{ "--stagger-index": OVERVIEW_STAGGER.recentActivity } as CSSProperties}>
                <RecentActivityPanel
                  activities={clientDetail?.recent_activity ?? []}
                  onOpenInteraction={onOpenInteraction}
                  staggerStart={OVERVIEW_STAGGER.recentActivityRows}
                />
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function WealthMapTab({ clientId, clientImageSrc, onProfileDetails }: { clientId: number | null; clientImageSrc?: string; onProfileDetails: () => void }) {
  return (
    <div className="overflow-hidden bg-white" style={{ height: "calc(100vh - 52px)" }}>
      <section className="relative h-full bg-white">
        <SourceWealthChart clientId={clientId} clientImageSrc={clientImageSrc} onProfileDetails={onProfileDetails} />
      </section>
    </div>
  );
}

function DocumentsTab({ clientId }: { clientId?: number | null }) {
  return (
    // No padding here: .vault-container owns the page inset (32/48/64),
    // exactly like InteractionsTab below.
    <div className="min-h-0 overflow-auto bg-white">
      <DocumentsListView clientId={clientId} />
    </div>
  );
}

function InteractionsTab({ clientId, isLoadingClient, focusedInteractionId, onFocusHandled }: { clientId?: number | null; isLoadingClient?: boolean; focusedInteractionId?: number | null; onFocusHandled?: () => void }) {
  if (isLoadingClient) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-white p-[32px]">
        <ClientLottie src="/loader.json" style={{ width: 120, height: 120 }} />
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-white p-[32px]">
        <p className="m-0 font-satoshi text-[14px] text-black/45">No client selected</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 overflow-auto bg-white">
      <InteractionsTabContent clientId={clientId} focusedInteractionId={focusedInteractionId} onFocusHandled={onFocusHandled} />
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-[#f7f3ee] p-[32px]">
      <p className="m-0 font-satoshi text-[14px] text-black/45">{title}</p>
    </div>
  );
}

function AumFact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className="contents">
      <div className="flex min-h-[27px] w-full items-start justify-between gap-[20px] py-[4px] text-[14px] leading-normal">
        <span className="shrink-0 font-satoshi font-normal text-[#0D0D0D] [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]">{label}</span>
        <strong className="min-w-0 text-right font-satoshi font-bold break-words text-[#111827] [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]">{value}</strong>
      </div>
      {last ? null : <div className="h-px w-full shrink-0 bg-[#E1E5E8]" aria-hidden="true" />}
    </div>
  );
}

function getOverviewImageSrc(clientDetail: ClientDetailResponse | null, client: WealthCrmClient | null) {
  const detailRecord = getRecord(clientDetail);
  const header = getRecord(clientDetail?.header);
  const atAGlance = getRecord(clientDetail?.at_a_glance);
  const tags = Array.isArray(clientDetail?.header?.tags) ? clientDetail.header.tags : [];
  const candidates = [
    header.country,
    header.country_code,
    header.primary_tax_jurisdiction,
    detailRecord.country,
    detailRecord.country_code,
    detailRecord.primary_tax_jurisdiction,
    atAGlance.country,
    atAGlance.country_code,
    atAGlance.primary_tax_jurisdiction,
    tags[1],
    client?.primary_tax_jurisdiction,
    header.summary,
  ];

  for (const candidate of candidates) {
    const image = getOverviewImageFromCountry(candidate);
    if (image) return image;
  }

  return "/overview/others.png";
}


function getOverviewImageFromCountry(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalized) return null;

  const compact = normalized.replace(/\s+/g, "");
  const aliases: Array<[string[], string]> = [
    [["sg", "sgp", "singapore"], "/overview/singapore.png"],
    [["au", "aus", "australia"], "/overview/australia.png"],
    [["us", "usa", "unitedstates", "unitedstatesofamerica", "america"], "/overview/usa.png"],
    [["cn", "chn", "china", "prc", "peoplesrepublicofchina"], "/overview/china.png"],
    [["in", "ind", "india"], "/overview/india.png"],
    [["ch", "che", "switzerland", "swiss"], "/overview/switzerland.png"],
  ];

  for (const [keys, image] of aliases) {
    if (keys.includes(compact)) return image;
  }

  const tokens = normalized.split(" ");
  for (const [keys, image] of aliases) {
    if (keys.some((key) => tokens.includes(key) || (key.length > 2 && compact.includes(key)))) return image;
  }

  return null;
}

function getClientSubtitle(client: WealthCrmClient | null) {
  if (!client) {
    return "-";
  }

  const location = client.primary_tax_jurisdiction || client.base_currency || "Singapore";
  const partyType = client.party_type ? formatLabelText(client.party_type).toLowerCase() : "client";
  const currency = client.net_worth_currency || client.base_currency;

  return `${location}-based ${partyType}${currency ? ` with wealth reported in ${currency}` : ""}`;
}

function formatClientMoney(value: string | number | null | undefined, currency?: string | null, fallback = "-") {
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(amount)) {
    return fallback;
  }

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const symbol = getCurrencySymbol(currency);
  const format = (scaled: number) => {
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return scaled.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  };

  if (absAmount >= 1_000_000_000) {
    return `${sign}${symbol}${format(absAmount / 1_000_000_000)} B`;
  }

  if (absAmount >= 1_000_000) {
    return `${sign}${symbol}${format(absAmount / 1_000_000)} M`;
  }

  if (absAmount >= 1_000) {
    return `${sign}${symbol}${format(absAmount / 1_000)} K`;
  }

  return `${sign}${symbol}${format(absAmount)}`;
}

function formatPercent(value: string | number | null | undefined, fallback = "-") {
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(amount)) {
    return fallback;
  }

  return `${amount.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}%`;
}

function getCurrencySymbol(currency?: string | null) {
  switch (currency?.toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "\u20ac";
    case "GBP":
      return "\u00a3";
    case "INR":
      return "\u20b9";
    case "JPY":
      return "\u00a5";
    default:
      return currency ? `${currency.toUpperCase()} ` : "$";
  }
}

function getYear(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : String(date.getFullYear());
}

function formatActivityDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const elapsedMs = Date.now() - date.getTime();

  if (elapsedMs >= 0) {
    const elapsedMinutes = Math.floor(elapsedMs / 60_000);

    if (elapsedMinutes < 60) {
      const minutes = Math.max(1, elapsedMinutes);
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
      return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 7) {
      return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
    }
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function formatInsightDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toDateString() === new Date().toDateString()
    ? "Today"
    : date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function formatLabelText(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTaxResidency(value: string | null | undefined) {
  const residency = value?.trim();

  if (!residency) {
    return "-";
  }

  if (/^[a-z]{2}$/i.test(residency)) {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(residency.toUpperCase()) || residency.toUpperCase();
    } catch {
      return residency.toUpperCase();
    }
  }

  return residency;
}

function InsightPanel({
  insights,
  onAskAiInsight,
  onDismissInsight,
}: {
  insights: unknown[];
  onAskAiInsight: (prompt: string) => void;
  onDismissInsight: (insight: OverviewInsight) => void;
}) {
  const normalizedInsights = useMemo(
    () => insights.map(normalizeInsight).filter((insight): insight is OverviewInsight => Boolean(insight)),
    [insights],
  );
  const insightKey = useMemo(() => getInsightKey(insights), [insights]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [insightKey]);

  useEffect(() => {
    if (normalizedInsights.length <= 1 || isCarouselPaused) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % normalizedInsights.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [normalizedInsights.length, insightKey, isCarouselPaused]);

  if (normalizedInsights.length === 0) {
    return null;
  }

  const safeActiveIndex = Math.min(activeIndex, normalizedInsights.length - 1);
  const activeInsight = normalizedInsights[safeActiveIndex] ?? normalizedInsights[0];
  const askAiPrompt = getInsightAskAiPrompt(activeInsight);

  return (
    <section
      className="relative flex h-[409px] flex-col items-start justify-between overflow-hidden rounded-[16px] p-[24px] max-[1180px]:min-h-[409px] max-[640px]:h-auto max-[640px]:p-[20px]"
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg viewBox='0 0 320 409' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' width='100%25' height='100%25' fill='url(%23grad)' opacity='0.94'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(41.7 30.35 -15.579 21.405 118 379)'><stop stop-color='rgba(254,213,86,1)' offset='0'/><stop stop-color='rgba(243,185,57,1)' offset='0.57927'/><stop stop-color='rgba(244,194,86,1)' offset='0.68445'/><stop stop-color='rgba(246,204,116,1)' offset='0.78963'/><stop stop-color='rgba(249,223,174,1)' offset='1'/></radialGradient></defs></svg>")`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
      onMouseEnter={() => setIsCarouselPaused(true)}
      onMouseLeave={() => setIsCarouselPaused(false)}
    >
      <div className="relative z-[1] flex w-full items-center gap-[4px]">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-satoshi text-[18px] font-bold leading-[24px] text-[#0D0D0D] [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]">Insights</h2>
          {activeInsight.timestamp ? (
            <p className="m-0 font-satoshi text-[12px] font-medium leading-normal text-[rgba(33,37,37,0.7)] [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]">{activeInsight.timestamp}</p>
          ) : null}
        </div>
        {normalizedInsights.length > 1 ? (
          <div className="flex h-[8px] shrink-0 items-center gap-[2px]" aria-label="Insight slides">
            {normalizedInsights.map((insight, index) => (
              <button
                key={`${insight.title}-${index}`}
                type="button"
                className={`h-[8px] w-[8px] shrink-0 rounded-full border-0 p-0 transition-colors ${index === safeActiveIndex ? "bg-black" : "bg-black/20 hover:bg-black/35"}`}
                aria-label={`Show insight ${index + 1}`}
                aria-current={index === safeActiveIndex ? "true" : undefined}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative z-[1] flex w-full flex-col items-start gap-[40px]" aria-live="polite">
        <div className="w-[232px] overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${safeActiveIndex * 100}%)` }}
          >
            {normalizedInsights.map((insight, index) => (
              <article key={`${insight.title}-${index}`} className="flex w-[232px] shrink-0 flex-col items-start gap-[8px]">
                <p className="m-0 w-full font-satoshi text-[24px] font-medium leading-[1.1] tracking-[-0.48px] text-[rgba(13,13,13,0.9)] [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]">
                  {insight.title}
                </p>
                {insight.body ? (
                  <p className="m-0 w-full font-satoshi text-[14px] font-normal leading-[1.5] text-[rgba(13,13,13,0.8)] [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]">
                    {insight.body}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
        <div className="flex w-full items-center gap-[8px]">
          <button
            type="button"
            className="inline-flex items-center gap-[4px] rounded-[50px] border-0 bg-black px-[12px] py-[8px] font-satoshi text-[14px] font-bold leading-[1.3] text-white [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]"
            style={{ fontFamily: "var(--font-satoshi), 'Satoshi', sans-serif", fontSize: "14px", fontWeight: 700, lineHeight: 1.3, fontFeatureSettings: "'ss03' on, 'liga' off", fontKerning: "none", WebkitFontSmoothing: "antialiased" }}
            onClick={() => onAskAiInsight(askAiPrompt)}
          >
            <Image src="/insights-ask-ai.svg" alt="" width={16} height={16} />
            Ask AI
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-[4px] rounded-[50px] border border-black/[0.08] bg-transparent px-[12px] py-[8px] font-satoshi text-[14px] font-bold leading-[1.3] text-black [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]"
            style={{ fontFamily: "var(--font-satoshi), 'Satoshi', sans-serif", fontSize: "14px", fontWeight: 700, lineHeight: 1.3, fontFeatureSettings: "'ss03' on, 'liga' off", fontKerning: "none", WebkitFontSmoothing: "antialiased" }}
            onClick={() => onDismissInsight(activeInsight)}
          >
            <Image src="/insights-dismiss.svg" alt="" width={16} height={16} />
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}

function RecentActivityPanel({
  activities,
  onOpenInteraction,
  staggerStart = 0,
}: {
  activities: unknown[];
  onOpenInteraction: (id: number) => void;
  // Where this list picks up in the overview's entrance sequence, so the rows
  // arrive after the panel itself rather than alongside it.
  staggerStart?: number;
}) {
  const normalizedActivities = activities
    .map(normalizeActivity)
    .filter((activity): activity is OverviewActivity => Boolean(activity));
  const pageSize = 3;
  const pageCount = Math.max(1, Math.ceil(normalizedActivities.length / pageSize));
  const [activityPage, setActivityPage] = useState(0);
  const visibleActivities = normalizedActivities.slice(activityPage * pageSize, (activityPage + 1) * pageSize);

  useEffect(() => {
    setActivityPage((page) => Math.min(page, pageCount - 1));
  }, [pageCount]);

  return (
    <section
      className="relative z-[4] flex min-h-[474px] flex-col items-start gap-[24px] overflow-hidden rounded-[16px] bg-[rgba(255,255,255,0.4)] p-[24px] backdrop-blur-[24px] max-[640px]:p-[20px]"
      style={{
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 8px 32px rgba(38,23,6,0.04)",
      }}
    >
      <div className="flex w-full shrink-0 items-center justify-between">
        <h2
          className="m-0 text-[#0F172A]"
          style={{
            fontFamily: "var(--font-satoshi), Satoshi, sans-serif",
            fontSize: "18px",
            fontWeight: 700,
            lineHeight: "24px",
            fontFeatureSettings: "'ss03' on, 'liga' off",
            fontKerning: "none",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          Recent Activity
        </h2>
        <div className="flex items-start gap-[8px]" aria-label="Recent activity pages">
          <button
            type="button"
            className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[99px] border border-[#EAEAEC] bg-white p-[8px]"
            style={{ opacity: activityPage === 0 ? 0.5 : 1 }}
            aria-label="Previous recent activities"
            disabled={activityPage === 0}
            onClick={() => setActivityPage((page) => Math.max(0, page - 1))}
          >
            <Image src="/recent-activity-chevron-left.svg" alt="" width={14} height={14} />
          </button>
          <button
            type="button"
            className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[99px] border border-[#EAEAEC] bg-white p-[8px]"
            style={{ opacity: activityPage >= pageCount - 1 ? 0.5 : 1 }}
            aria-label="Next recent activities"
            disabled={activityPage >= pageCount - 1}
            onClick={() => setActivityPage((page) => Math.min(pageCount - 1, page + 1))}
          >
            <Image src="/recent-activity-chevron-right.svg" alt="" width={14} height={14} />
          </button>
        </div>
      </div>
      <div className="flex w-full flex-col items-start gap-[16px]">
        {visibleActivities.map((activity, index) => {
          const absoluteIndex = activityPage * pageSize + index;
          return (
            <div key={`${activity.title}-${absoluteIndex}`} className="contents">
              <article
                className="stagger-in flex w-full cursor-pointer items-start gap-[12px] transition-opacity hover:opacity-80"
                style={{ "--stagger-index": Math.min(staggerStart + absoluteIndex, staggerStart + 8) } as CSSProperties}
                onClick={() => { if (activity.id != null) onOpenInteraction(Number(activity.id)); }}
                onKeyDown={(event) => {
                  if (activity.id != null && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onOpenInteraction(Number(activity.id));
                  }
                }}
                role={activity.id != null ? "link" : undefined}
                tabIndex={activity.id != null ? 0 : -1}
              >
                <span className={`inline-grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[8px] ${activity.iconClass}`}>
                  {activity.icon}
                </span>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-[8px]">
                  <div className="flex w-full flex-col items-start">
                    <h3
                      className="m-0 text-[#111827]"
                      style={{
                        fontFamily: "var(--font-satoshi), Satoshi, sans-serif",
                        fontSize: "16px",
                        fontWeight: 700,
                        lineHeight: "normal",
                        letterSpacing: "-0.16px",
                        fontFeatureSettings: "'ss03' on, 'liga' off",
                        fontKerning: "none",
                        WebkitFontSmoothing: "antialiased",
                      }}
                    >
                      {activity.title}
                    </h3>
                    <time
                      className="text-[rgba(33,37,37,0.7)]"
                      style={{
                        fontFamily: "var(--font-satoshi), Satoshi, sans-serif",
                        fontSize: "12px",
                        fontWeight: 500,
                        lineHeight: "normal",
                        fontFeatureSettings: "'ss03' on, 'liga' off",
                        fontKerning: "none",
                        WebkitFontSmoothing: "antialiased",
                      }}
                    >
                      {activity.date}
                    </time>
                  </div>
                  <RecentActivityDescription activity={activity} />
                </div>
              </article>
              {index < visibleActivities.length - 1 ? (
                <Image src="/recent-activity-divider.svg" alt="" width={272} height={1} className="shrink-0" />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentActivityDescription({ activity }: { activity: OverviewActivity }) {
  if (!activity.copy) {
    return null;
  }

  return (
    <p
      className="m-0 w-full overflow-hidden text-[rgba(13,13,13,0.8)]"
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 3,
        fontFamily: "var(--font-satoshi), Satoshi, sans-serif",
        fontSize: "14px",
        fontWeight: 400,
        lineHeight: 1.5,
        fontFeatureSettings: "'ss03' on, 'liga' off",
        fontKerning: "none",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {activity.copy}
    </p>
  );
}

type OverviewInsight = {
  id?: string | number;
  title: string;
  body?: string;
  timestamp?: string;
};

type OverviewActivity = {
  id?: string | number;
  icon: ReactNode;
  iconClass: string;
  title: string;
  date: string;
  copy: string;
};

function getInsightItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  return Array.isArray(value.items) ? value.items : [];
}

function getInsightId(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

function getInsightKey(insights: unknown[], scope?: number | string | null) {
  const parts = insights.map((insight, index) => {
    if (!isRecord(insight)) {
      return `${index}:${String(insight)}`;
    }

    const id = insight.id;
    if (typeof id === "string" || typeof id === "number") {
      return String(id);
    }

    return getStringField(insight, ["title", "headline", "name", "summary", "message", "text"]) || String(index);
  });

  return `${scope ?? "global"}:${parts.join("|")}`;
}

function getInsightAskAiPrompt(insight: OverviewInsight) {
  return `Help me understand this insight: ${[insight.title, insight.body].filter(Boolean).join(" - ")} `;
}

function getLongestStringField(record: Record<string, unknown>, keys: string[]) {
  return keys.reduce<string | null>((longest, key) => {
    const value = record[key];

    if (typeof value !== "string" || !value.trim()) {
      return longest;
    }

    const trimmed = value.trim();
    return !longest || trimmed.length > longest.length ? trimmed : longest;
  }, null);
}

function normalizeInsight(value: unknown): OverviewInsight | null {
  if (typeof value === "string") {
    return value.trim() ? { title: value.trim() } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const title = getStringField(value, ["title", "headline", "name", "summary", "message", "text"]);
  const body = getStringField(value, ["body", "description", "detail", "details", "copy", "recommendation"]);
  const timestamp = getStringField(value, ["updated_at", "created_at", "timestamp", "date"]);
  const id = getInsightId(value);

  if (!title && !body) {
    return null;
  }

  return {
    id: id ?? undefined,
    title: title || body || "Insight",
    body: body && body !== title ? body : undefined,
    timestamp: timestamp ? formatInsightDate(timestamp) : undefined,
  };
}

function normalizeActivity(value: unknown): OverviewActivity | null {
  if (typeof value === "string") {
    return value.trim()
      ? {
          icon: <Image src="/icons/documents/ic-statements.png" alt="" width={32} height={32} style={{ objectFit: 'contain' }} />,
          iconClass: "bg-transparent",
          title: value.trim(),
          date: "",
          copy: "",
        }
      : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const id = getInsightId(value);
  const iconField = getStringField(value, ["icon", "icon_type"]);
  const type = getStringField(value, ["type", "source_type", "channel", "kind"]);
  const title = getStringField(value, ["title", "subject", "name", "summary"]) || (type ? formatLabelText(type) : null);
  const copy = getLongestStringField(value, ["body", "full_description", "description_full", "copy", "description", "detail", "details", "note", "notes", "message", "text", "extracted_summary"]) || "";
  const dateValue = getStringField(value, ["date", "occurred_at", "created_at", "updated_at", "timestamp"]);

  if (!title && !copy) {
    return null;
  }

  // Use explicit icon field if provided, otherwise infer from type/title/copy
  const iconData = iconField ? getActivityIconByName(iconField) : getActivityIcon(type || title || copy);

  return {
    id: id ?? undefined,
    ...iconData,
    title: title || "Activity",
    date: dateValue ? formatActivityDate(dateValue) : "",
    copy,
  };
}

function getActivityIconByName(iconName: string) {
  const iconMap: Record<string, { path: string; iconClass: string; size: number }> = {
    // Meeting & Communication
    "meeting": { path: "/recent-activity-phone.svg", iconClass: "bg-[rgba(128,77,19,0.16)]", size: 16 },
    "meeting_note": { path: "/recent-activity-phone.svg", iconClass: "bg-[rgba(128,77,19,0.16)]", size: 16 },
    "phone": { path: "/recent-activity-phone.svg", iconClass: "bg-[rgba(128,77,19,0.16)]", size: 16 },
    "call": { path: "/recent-activity-phone.svg", iconClass: "bg-[rgba(128,77,19,0.16)]", size: 16 },
    "email": { path: "/recent-activity-mail.svg", iconClass: "bg-[rgba(128,77,19,0.16)]", size: 16 },
    "mail": { path: "/recent-activity-mail.svg", iconClass: "bg-[rgba(128,77,19,0.16)]", size: 16 },
    "message": { path: "/icons/interaction/ic-message.png", iconClass: "bg-transparent", size: 32 },

    // Financial & Documents
    "capital": { path: "/recent-activity-check.svg", iconClass: "bg-[rgba(128,77,19,0.16)]", size: 16 },
    "capital_call": { path: "/recent-activity-check.svg", iconClass: "bg-[rgba(128,77,19,0.16)]", size: 16 },
    "check": { path: "/recent-activity-check.svg", iconClass: "bg-[rgba(128,77,19,0.16)]", size: 16 },
    "distribution": { path: "/icons/documents/ic-distribution-notices.png", iconClass: "bg-transparent", size: 32 },
    "payment": { path: "/icons/documents/ic-banking.png", iconClass: "bg-transparent", size: 32 },
    "transfer": { path: "/icons/documents/ic-banking.png", iconClass: "bg-transparent", size: 32 },
    "banking": { path: "/icons/documents/ic-banking.png", iconClass: "bg-transparent", size: 32 },
    "statement": { path: "/icons/documents/ic-statements.png", iconClass: "bg-transparent", size: 32 },
    "document": { path: "/icons/interaction/ic-document.png", iconClass: "bg-transparent", size: 32 },

    // Legal & Compliance
    "legal": { path: "/icons/documents/ic-legal.png", iconClass: "bg-transparent", size: 32 },
    "compliance": { path: "/icons/documents/ic-compliance.png", iconClass: "bg-transparent", size: 32 },
    "tax": { path: "/icons/documents/ic-tax-documents.png", iconClass: "bg-transparent", size: 32 },

    // Investment & Property
    "investment": { path: "/icons/documents/ic-investment-agreements.png", iconClass: "bg-transparent", size: 32 },
    "real_estate": { path: "/icons/documents/ic-real-estate.png", iconClass: "bg-transparent", size: 32 },
    "property": { path: "/icons/documents/ic-real-estate.png", iconClass: "bg-transparent", size: 32 },

    // Other
    "insurance": { path: "/icons/documents/ic-insurance.png", iconClass: "bg-transparent", size: 32 },
    "trust": { path: "/icons/documents/ic-trust-wills.png", iconClass: "bg-transparent", size: 32 },
  };

  const normalized = iconName.toLowerCase().trim();
  const iconData = iconMap[normalized] || { path: "/icons/documents/ic-statements.png", iconClass: "bg-transparent", size: 32 };

  return {
    icon: <Image src={iconData.path} alt="" width={iconData.size} height={iconData.size} style={{ objectFit: 'contain' }} />,
    iconClass: iconData.iconClass,
  };
}

function getActivityIcon(value: string) {
  const normalized = value.toLowerCase();

  // Meeting activities
  if (normalized.includes("meeting") || normalized.includes("meet")) {
    return {
      icon: <Image src="/recent-activity-phone.svg" alt="" width={16} height={16} />,
      iconClass: "bg-[rgba(128,77,19,0.16)]",
    };
  }

  // Email activities
  if (normalized.includes("mail") || normalized.includes("email")) {
    return {
      icon: <Image src="/recent-activity-mail.svg" alt="" width={16} height={16} />,
      iconClass: "bg-[rgba(128,77,19,0.16)]",
    };
  }

  // Phone calls
  if (normalized.includes("phone") || normalized.includes("call")) {
    return {
      icon: <Image src="/recent-activity-phone.svg" alt="" width={16} height={16} />,
      iconClass: "bg-[rgba(128,77,19,0.16)]",
    };
  }

  // Distribution activities
  if (normalized.includes("distribution")) {
    return {
      icon: <Image src="/icons/documents/ic-distribution-notices.png" alt="" width={32} height={32} style={{ objectFit: 'contain' }} />,
      iconClass: "bg-transparent"
    };
  }

  // Capital calls
  if (normalized.includes("capital")) {
    return {
      icon: <Image src="/recent-activity-check.svg" alt="" width={16} height={16} />,
      iconClass: "bg-[rgba(128,77,19,0.16)]",
    };
  }

  // Banking/Payment/Transfer activities
  if (normalized.includes("payment") || normalized.includes("transfer") || normalized.includes("bank")) {
    return {
      icon: <Image src="/icons/documents/ic-banking.png" alt="" width={32} height={32} style={{ objectFit: 'contain' }} />,
      iconClass: "bg-transparent"
    };
  }

  // Document activities
  if (normalized.includes("document") || normalized.includes("file")) {
    return {
      icon: <Image src="/icons/interaction/ic-document.png" alt="" width={32} height={32} style={{ objectFit: 'contain' }} />,
      iconClass: "bg-transparent"
    };
  }

  // Default to statements icon for other activities
  return {
    icon: <Image src="/icons/documents/ic-statements.png" alt="" width={32} height={32} style={{ objectFit: 'contain' }} />,
    iconClass: "bg-transparent"
  };
}

function getStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function AssetAllocationCard({ totalLabel = "-" }: { totalLabel?: string }) {
  return <AssetAllocationChart totalLabel={totalLabel} />;
}

function AssetAllocationChart({
  totalLabel = "-",
  buckets = [],
}: {
  totalLabel?: string;
  buckets?: Array<{ label: string; value: string; pct: string }>;
}) {
  const allocationColors = ["#1D761F", "#1E8A4B", "#FFC14E", "#10B981", "#C8F65C", "#14B8A6", "#8B5CF6", "#F97316", "#804D13", "#FF5733", "#FFD700", "#FFA500", "#14B8D3"];
  const slices = buckets
    .map((bucket, index) => ({
      label: bucket.label || "Uncategorized",
      value: Number.parseFloat(String(bucket.pct ?? "")),
      color: allocationColors[index % allocationColors.length],
    }))
    .filter((bucket) => Number.isFinite(bucket.value));
  const labels = slices.map((bucket) => bucket.label);
  const data = slices.map((bucket) => bucket.value);
  const colors = slices.map((bucket) => bucket.color);
  const hasAllocationData = data.length > 0;
  const visibleSlices = slices.slice(0, 5);
  const allocationTotal = data.reduce((sum, value) => sum + value, 0);
  let allocationCumulative = 0;
  const allocationAnnotations = allocationTotal > 0 ? visibleSlices.map((slice) => {
    const start = allocationCumulative;
    allocationCumulative += slice.value;
    const end = allocationCumulative;

    // Calculate the mid-angle of the arc segment to match ChartJS rendering
    // ChartJS with rotation:-90 actually starts at LEFT (180° or -180°) and goes clockwise
    // Our percentages go 0% -> 100% clockwise from LEFT
    const startPct = start / allocationTotal;
    const endPct = end / allocationTotal;
    const midPct = (startPct + endPct) / 2;

    // Convert to angle: ChartJS starts at left (180°), we need to match that
    // Shift by 90° to the left: -90° - 90° = -180°
    const chartStartAngle = ASSET_ALLOCATION_CHART_ROTATION_DEG - 90;
    const midAngleDeg = chartStartAngle + (midPct * 360);
    const midAngleRad = (midAngleDeg * Math.PI) / 180;

    const cos = Math.cos(midAngleRad);
    const sin = Math.sin(midAngleRad);

    // Chart center and radii (reduced by 30% for shorter lines)
    const centerX = 235.5;
    const centerY = 161;
    const dotRadius = 104;
    const elbowRadius = 128;
    const labelRadius = 198;

    // Calculate positions along the radial line
    const dotX = centerX + cos * dotRadius;
    const dotY = centerY + sin * dotRadius;
    const elbowX = centerX + cos * elbowRadius;
    const elbowY = centerY + sin * elbowRadius;
    const labelX = centerX + cos * labelRadius;
    const labelY = centerY + sin * labelRadius;

    // Determine text anchor and line end based on which side of the chart
    const textAnchor: "start" | "end" = cos >= 0 ? "start" : "end";
    const lineEndX = cos >= 0 ? labelX - 8 : labelX + 8;

    return {
      ...slice,
      labelText: slice.label,
      dot: {
        x: dotX,
        y: dotY,
      },
      line: {
        x1: dotX,
        y1: dotY,
        x2: elbowX,
        y2: elbowY,
        x3: lineEndX,
        y3: labelY,
      },
      label: {
        x: labelX,
        y: labelY,
        anchor: textAnchor,
      },
    };
  }) : [];

  const chartData: ChartData<"doughnut", number[], string> = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors,
        borderColor: "transparent",
        borderWidth: 0,
        hoverOffset: 4,
        spacing: 0,
      },
    ],
  };

  const chartOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "71%",
    rotation: ASSET_ALLOCATION_CHART_ROTATION_DEG,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
      datalabels: {
        display: false,
      },
    },
  };

  return (
    <div className="relative flex min-h-[509px] w-full flex-col items-start gap-[24px] overflow-hidden rounded-[16px] bg-[#FCF9F4] p-[24px] shadow-[0_4px_6px_rgba(0,0,0,0.02)] backdrop-blur-[2px] max-[640px]:min-h-[470px] max-[640px]:p-[20px]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[16px] opacity-70" aria-hidden="true">
        <Image
          src="/asset-allocation-glow-primary.png"
          alt=""
          width={1961}
          height={1161}
          className="absolute left-1/2 top-1/2 h-[1161px] w-[1961px] max-w-none opacity-40"
          style={{ transform: "translate(-59%, -54%)" }}
        />
        <Image
          src="/asset-allocation-glow-secondary.png"
          alt=""
          width={1961}
          height={1161}
          className="absolute left-1/2 top-1/2 h-[1161px] w-[1961px] max-w-none opacity-40"
          style={{ transform: "translate(-45%, -34%) rotate(180deg)" }}
        />
      </div>

      <h2 className="relative z-[1] m-0 self-stretch font-satoshi text-[18px] font-bold leading-[24px] text-[#0F172A] [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]">Asset allocation</h2>

      <div className="relative z-[1] mx-auto h-[314px] w-full max-w-[471px] shrink-0">
        <div className="absolute left-1/2 top-[calc(50%+4px)] h-[218px] w-[218px] -translate-x-1/2 -translate-y-1/2 max-[640px]:h-[200px] max-[640px]:w-[200px]">
          {hasAllocationData ? (
            <Doughnut data={chartData} options={chartOptions} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-full border border-black/10 bg-white/45 text-center font-satoshi text-[13px] text-black/45 [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]">
              No allocation data
            </div>
          )}
          <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <strong className="font-satoshi text-[28px] font-[900] leading-[1.2] tracking-[-1.12px] text-black max-[640px]:text-[24px]">{totalLabel}</strong>
            <small className="mt-[2px] self-stretch text-center font-satoshi text-[12px] font-normal leading-[150%] tracking-[-0.24px] text-[#000]" style={{ fontFeatureSettings: "'ss02' on, 'ss03' on, 'liga' off", fontStyle: 'normal' }}>Managed assets</small>
          </span>
        </div>

        {/* Render all labels */}
        {hasAllocationData ? (
          <svg className="absolute inset-0 h-full w-full overflow-visible max-[640px]:hidden" viewBox="0 0 471 314" fill="none" aria-hidden="true">
            {allocationAnnotations.map((annotation, index) => (
              <g key={`${annotation.labelText}-${index}`}>
                <circle cx={annotation.dot.x} cy={annotation.dot.y} r="2" fill="#1A2229" />
                <path
                  d={`M ${annotation.line.x1} ${annotation.line.y1} L ${annotation.line.x2} ${annotation.line.y2} L ${annotation.line.x3} ${annotation.line.y3}`}
                  stroke="rgba(0,0,0,0.16)"
                  strokeWidth="1"
                  fill="none"
                />
                <text x={annotation.label.x} y={annotation.label.y} textAnchor={annotation.label.anchor} fill="#5C6A72" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="400">
                  <tspan x={annotation.label.x} dy="0">{annotation.labelText}</tspan>
                  <tspan x={annotation.label.x} dy="17" fill="#1A2229" fontFamily="Satoshi, sans-serif" fontSize="13" fontWeight="700" style={{ fontFeatureSettings: "'ss03' on, 'liga' off" }}>{formatPercent(annotation.value)}</tspan>
                </text>
              </g>
            ))}
          </svg>
        ) : null}
      </div>

      {hasAllocationData ? (
        <div className="absolute right-[24px] bottom-[34px] left-[24px] z-[1] flex flex-wrap items-center justify-center gap-[4px] max-[640px]:right-[20px] max-[640px]:bottom-[24px] max-[640px]:left-[20px]">
          {labels.map((label, index) => (
            <span key={label} className="inline-flex items-center gap-[8px] rounded-[20px] bg-black/[0.02] px-[8px] py-[4px]">
              <span className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: colors[index] }} />
              <span className="font-satoshi text-[12px] font-medium text-black/80 [font-feature-settings:'ss03'_on,'liga'_off,'kern'_off] [font-kerning:none]">{label}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AllocationLabel({
  className,
  name,
  value,
  lineClass,
  dotClass,
  alignRight = false,
}: {
  className: string;
  name: string;
  value: string;
  lineClass: string;
  dotClass: string;
  alignRight?: boolean;
}) {
  return (
    <div className={`absolute ${className} ${alignRight ? "text-left" : "text-right"} max-[640px]:hidden`}>
      <span className="block font-satoshi text-[16px] leading-tight text-[#6e7683]">{name}</span>
      <strong className="block font-satoshi text-[20px] leading-tight text-[#151923]">{value}</strong>
      <span className={`absolute bg-black/20 ${lineClass}`} aria-hidden="true" />
      <span className={`absolute h-[8px] w-[8px] rounded-full bg-black ${dotClass}`} aria-hidden="true" />
    </div>
  );
}

function MetricCard({ label, value, change, date }: { label: string; value: string; change: string; date: string }) {
  return (
    <article className="flex min-h-[300px] flex-col px-[20px] py-[32px] [backdrop-filter:blur(2px)] [background:linear-gradient(135deg,rgba(0,0,0,0)_0%,rgba(255,255,255,0)_50%,rgba(255,255,255,0.40)_75%,rgba(255,255,255,0)_100%),rgba(255,255,255,0.50)] [border-radius:16px] [outline-offset:-1px] [outline:1px_solid_rgba(0,0,0,0.16)] max-[640px]:min-h-[220px] max-[640px]:px-[22px] max-[640px]:py-[22px]">
      <h3 className="m-0 mb-[28px] [font-family:var(--font-inter)] text-[16px] font-[500] text-[#4D2E0C] [overflow-wrap:break-word]">{label}</h3>
      <strong className="font-satoshi text-[32px] font-bold tracking-normal text-[#1A2229] [overflow-wrap:break-word]">{value}</strong>
      <p className="mt-[24px] mb-0 flex flex-wrap gap-[12px] [font-family:var(--font-inter)] text-[13px] font-[400] leading-[24px] text-[#8899A6] [overflow-wrap:break-word]"><span className="inline-flex items-center gap-[8px] [font-family:var(--font-inter)] text-[13px] font-[600] text-[#10B981] [overflow-wrap:break-word]"><TrendUpIcon />{change}</span>{date}</p>
      <button type="button" className="mt-auto inline-flex w-fit items-center gap-[10px] rounded-[6px] border-0 bg-gradient-to-r from-[#fff6e7] via-[#fff8e8] to-[#f0e7f1] px-[18px] py-[12px] text-[#d69b2b] [&_svg]:h-[14px] [&_svg]:w-[14px]">
        <SendArrowIcon />
        <span className="[font-family:'Cascadia_Code',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace] text-[12px] font-normal leading-none [overflow-wrap:break-word]">Ask AI</span>
      </button>
    </article>
  );
}

function AvatarSeed({ wide = false }: { wide?: boolean }) {
  return (
    <span
      className={`${wide ? "row-auto h-[102px] w-full rounded-[10px]" : "row-span-2 h-[36px] w-[36px] rounded-full"} border-2 border-white/80 bg-[linear-gradient(135deg,rgba(15,73,47,0.85),rgba(216,152,51,0.78)),url('/avatar.png')] bg-cover bg-center`}
      aria-hidden="true"
    />
  );
}

function EmptyChatState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <p className="m-0 mb-2 font-serif text-[106px] leading-none text-[#171615]">OneView</p>
      <p className="m-0 max-w-[480px] font-satoshi text-[16px] leading-normal text-[#171615]/60">Start a session with your wealth advisor.</p>
      <button type="button" className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-[8px] rounded-full border border-[#171615]/15 bg-[#fffaf4] px-[18px] font-satoshi text-[13px] font-bold text-[#171615] transition hover:-translate-y-px hover:border-[#171615]/30 hover:bg-white" onClick={onStart}>
        <PlusIcon />
        <span>Start new chat</span>
      </button>
    </div>
  );
}

function useComposerFormat() {
  const applyFormat = useCallback((type: "bold" | "bullet") => {
    const textarea = document.querySelector<HTMLTextAreaElement>("[data-chat-composer-input]");
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

function Composer({ placeholder, agent, prompts, onPromptSelect, selectedPromptId }: { placeholder: string; agent: string; prompts?: ChatPrompt[]; onPromptSelect?: (prompt: ChatPrompt) => void; selectedPromptId?: number | null }) {
  const isRunning = useThread((t) => t.isRunning);
  const applyFormat = useComposerFormat();
  const threadRuntime = useThreadRuntime({ optional: true });
  const [promptsExpanded, setPromptsExpanded] = useState(false);
  const [collapsedPromptCount, setCollapsedPromptCount] = useState(2);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashDropdownRef = useRef<HTMLDivElement | null>(null);
  const promptListRef = useRef<HTMLDivElement | null>(null);
  const promptMeasureRef = useRef<HTMLDivElement | null>(null);
  void agent;
  void applyFormat;

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

  useEffect(() => {
    if (!threadRuntime) return;
    return threadRuntime.composer.subscribe(() => {
      const value = threadRuntime.composer.getState().text;
      if (value.startsWith("/")) {
        setSlashQuery(value.slice(1));
        setSlashIndex(0);
      } else {
        setSlashQuery(null);
      }
    });
  }, [threadRuntime]);
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

    if (!list || !measure || promptsExpanded || composerPrompts.length === 0) {
      return;
    }

    const updateVisiblePromptCount = () => {
      const chips = Array.from(measure.querySelectorAll<HTMLElement>("[data-prompt-measure-chip]"));
      const availableWidth = list.clientWidth;
      const gap = window.matchMedia("(max-width: 640px)").matches ? 8 : 12;
      let usedWidth = 0;
      let nextCount = 0;

      for (const chip of chips) {
        const nextWidth = usedWidth + (nextCount > 0 ? gap : 0) + chip.offsetWidth;
        if (nextWidth > availableWidth) {
          break;
        }

        usedWidth = nextWidth;
        nextCount += 1;
      }

      setCollapsedPromptCount(Math.max(2, nextCount));
    };

    updateVisiblePromptCount();

    const resizeObserver = new ResizeObserver(updateVisiblePromptCount);
    resizeObserver.observe(list);

    return () => {
      resizeObserver.disconnect();
    };
  }, [composerPrompts, promptsExpanded]);

  return (
    <ComposerPrimitive.Root className={TW.composerWrap}>
      {composerPrompts.length > 0 && (
        <div className={TW.promptMeasure} ref={promptMeasureRef} aria-hidden="true">
          {composerPrompts.map((p) => (
            <div key={p.id} className={TW.promptMeasureChip} data-prompt-measure-chip>
              /{p.title}
            </div>
          ))}
        </div>
      )}
      {visiblePrompts.length > 0 && !(slashQuery !== null && slashMatches.length > 0) && (
        <div className={TW.promptChipsRow}>
          <div className={`${TW.promptChipsLeft} ${promptsExpanded ? TW.promptChipsLeftExpanded : ""}`} ref={promptListRef}>
            {visiblePrompts.map((p) => (
              <div
                key={p.id}
                className={TW.promptChip}
                style={selectedPromptId === p.id ? { backgroundImage: "url('/insights.png')", backgroundSize: "cover", backgroundPosition: "center", border: "1px solid transparent" } : undefined}
                role="button"
                tabIndex={0}
                onClick={() => { onPromptSelect?.(p); if (selectedPromptId !== p.id && p.user_message && threadRuntime?.composer) { threadRuntime.composer.setText(p.user_message); window.requestAnimationFrame(() => { document.querySelector<HTMLTextAreaElement>("[data-chat-composer-input]")?.focus(); }); } else if (selectedPromptId === p.id && threadRuntime?.composer) { threadRuntime.composer.setText(""); } }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPromptSelect?.(p);
                    if (selectedPromptId !== p.id && p.user_message && threadRuntime?.composer) { threadRuntime.composer.setText(p.user_message); } else if (selectedPromptId === p.id && threadRuntime?.composer) { threadRuntime.composer.setText(""); }
                  }
                }}
              >
                /{p.title}
              </div>
            ))}
          </div>
          {(hasPromptOverflow || promptsExpanded) && composerPrompts.length > 1 ? (
            <button
              type="button"
              className={`${TW.promptChipExpand} ${promptsExpanded ? "rotate-180" : ""}`}
              aria-expanded={promptsExpanded}
              aria-label={promptsExpanded ? "Collapse prompts" : "Expand prompts"}
              onClick={() => setPromptsExpanded((v) => !v)}
            >
              <ChevronDownIcon />
            </button>
          ) : null}
        </div>
      )}
      {slashQuery !== null && slashMatches.length > 0 && (
        <div ref={slashDropdownRef} style={{ background: "white", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 12, padding: "6px 0", marginBottom: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto" }}>
          {slashMatches.map((p, i) => (
            <div
              key={p.id}
              // Column, not row: the panel is too narrow to keep the title on
              // the same line without wrapping it mid-name.
              // textAlign is explicit: the empty state above centres its text and
              // a wrapped description would otherwise inherit that centring.
              style={{ padding: "10px 16px", cursor: "pointer", background: i === slashIndex ? "#F2F2F2" : "transparent", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, textAlign: "left" }}
              onMouseEnter={() => setSlashIndex(i)}
              onMouseDown={(e) => { e.preventDefault(); if (threadRuntime?.composer) { threadRuntime.composer.setText(p.user_message || ""); onPromptSelect?.(p); setSlashQuery(null); } }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#804D13", whiteSpace: "nowrap" }}>/{p.title}</span>
              {p.description && <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>{p.description}</span>}
            </div>
          ))}
        </div>
      )}
      <div className={`${TW.composer} ${isRunning ? TW.composerThinking : ""}`}>
        <div className={TW.composerInputRow}>
          <ComposerPrimitive.Input
            className={TW.composerInput}
            data-chat-composer-input
            placeholder={placeholder}
            rows={1}
            autoFocus
          />
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
        <ComposerPrimitive.Cancel className={TW.sendBtn} aria-label="Stop response" title="Stop response">
          <StopIcon />
        </ComposerPrimitive.Cancel>
      </AuiIf>
      <AuiIf condition={(state) => !state.thread.isRunning && !state.composer.isEmpty}>
        <ComposerPrimitive.Send className={TW.sendBtn} aria-label="Send message" title="Send message">
          <ArrowUpIcon />
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(state) => !state.thread.isRunning && state.composer.isEmpty}>
        <button className={TW.sendBtn} type="button" disabled aria-label="Send message" title="Send message">
          <ArrowUpIcon />
        </button>
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

function AssistantMessage({
  message,
  showReplySuggestions,
}: {
  message: MessageState;
  showReplySuggestions: boolean;
}) {
  const replySuggestions = showReplySuggestions ? getReplySuggestions(message.content) : [];
  const messageArtifact = getArtifactFromParts(message.content);
  const workflowPlanCtx = useContext(WorkflowPlanContext);
  const workflowPlan = showReplySuggestions ? workflowPlanCtx : null;
  const hasSteps = Boolean(workflowPlan && workflowPlan.steps && workflowPlan.steps.length > 0);
  const isStreaming = message.status?.type !== "complete";
  const shouldShowArtifact = Boolean(messageArtifact && message.status?.type === "complete" && !isStreaming);
  const [stepsAnimationDone, setStepsAnimationDone] = useState(false);
  const showContent = !hasSteps || stepsAnimationDone;
  const contentRef = useRef<HTMLDivElement>(null);
  const { autoOpenArtifact, autoOpenEnabled } = useArtifactContext();
  const artifactRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasSteps) {
      setStepsAnimationDone(true);
      return;
    }
    const fallback = setTimeout(() => setStepsAnimationDone(true), 45000);
    return () => clearTimeout(fallback);
  }, [hasSteps]);

  useEffect(() => {
    if (showContent && hasSteps && stepsAnimationDone && contentRef.current) {
      setTimeout(() => {
        let el: HTMLElement | null = contentRef.current;
        while (el) {
          const style = getComputedStyle(el);
          if (style.overflowY === "auto" || style.overflowY === "scroll") {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            return;
          }
          el = el.parentElement;
        }
      }, 200);
    }
  }, [showContent, hasSteps, stepsAnimationDone]);

  // Auto-open artifact popup on client detail page
  useEffect(() => {
    if (!autoOpenEnabled || !message.isLast) return;
    if (!shouldShowArtifact || !messageArtifact) return;

    if (messageArtifact.id !== artifactRef.current) {
      artifactRef.current = messageArtifact.id;
      autoOpenArtifact(messageArtifact);
    }
  }, [messageArtifact, message.isLast, shouldShowArtifact, autoOpenEnabled, autoOpenArtifact]);

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
          <div ref={contentRef} style={{ opacity: showContent ? 1 : 0, maxHeight: showContent ? "none" : 0, overflow: "hidden", transition: "opacity 0.6s ease" }}>
          <MessagePrimitive.GroupedParts
            groupBy={groupPartByType({
              "tool-call": ["group-tools"],
            })}
          >
            {({ part, children }) => {
              const artifact = getArtifactFromPart(part);
              if (artifact) {
                return shouldShowArtifact ? <ArtifactMessage artifact={messageArtifact ?? artifact} /> : null;
              }

              switch (part.type) {
                case "group-tools":
                  return (
                    <ToolCallGroup status={part.status.type} count={part.indices.length}>
                      {children}
                    </ToolCallGroup>
                  );
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

                  return part.dataRendererUI ?? <DataStatusPart name={part.name} status={part.status?.type} />;
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
              <ReplySuggestionButton
                key={suggestion}
                suggestion={suggestion}
                autoSubmit={true}
              />
            ))}
          </div>
        ) : null}
        {showContent && <div className={TW.messageControls}>
        <AssistantActionBar />
        <BranchPickerPrimitive.Root className={TW.inlineControls} hideWhenSingleBranch>
          <BranchPickerPrimitive.Previous className={TW.actionBtn} aria-label="Previous response">
            <ChevronLeftIcon />
          </BranchPickerPrimitive.Previous>
          <span className={TW.branchCount}>
            <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
          </span>
          <BranchPickerPrimitive.Next className={TW.actionBtn} aria-label="Next response">
            <ChevronRightIcon />
          </BranchPickerPrimitive.Next>
        </BranchPickerPrimitive.Root>
        </div>}
      </div>
    </MessagePrimitive.Root>
  );
}

function ReplySuggestionButton({
  suggestion,
  autoSubmit,
}: {
  suggestion: string;
  autoSubmit: boolean;
}) {
  const threadRuntime = useThreadRuntime({ optional: true });

  const handleClick = () => {
    const composer = threadRuntime?.composer;
    if (!composer) {
      return;
    }

    composer.setText(suggestion);

    if (autoSubmit) {
      composer.send();
      return;
    }

    window.requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>("[data-chat-composer-input]")?.focus();
    });
  };

  return (
    <SuggestionChip label={suggestion} onClick={handleClick} />
  );
}

function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root className={TW.inlineControls} hideWhenRunning>
      <ActionBarPrimitive.Copy className={TW.actionBtn} aria-label="Copy response" title="Copy response">
        <CopyIcon />
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload className={TW.actionBtn} aria-label="Regenerate response" title="Regenerate response">
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

// Wraps financial figures like $2.1M, $18,903, 5%, 0.06% in <strong>
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
    <details className={TW.toolGroup} open={isRunning}>
      <summary className={TW.toolSummary}>
        <span className={TW.toolLabel}>
          <ChevronDownIcon />
          <span>{summary}</span>
        </span>
        <span className={`${TW.toolStatus} ${isRunning ? TW.toolStatusActive : ""}`}>
          {isRunning ? "Running" : "Done"}
        </span>
      </summary>
      <div className={TW.toolBody}>{children}</div>
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
    <div className={TW.toolCard}>
      <div className={TW.toolCardHeader}>
        <div>
          <p className={TW.toolEyebrow}>Tool</p>
          <h3 className={TW.toolTitle}>{humanizeToolName(props.toolName)}</h3>
        </div>
        <div className={TW.toolMeta}>
          <span className={`${TW.toolBadge} ${getToolBadgeClassName(props.status.type)}`}>
            {formatToolState(props.status.type)}
          </span>
          {elapsedMs !== undefined ? <span className={TW.toolTime}>{formatElapsedMs(elapsedMs)}</span> : null}
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
    <div className={TW.toolPayload}>
      <span className={TW.toolPayloadLabel}>{label}</span>
      <pre className={TW.toolPayloadPre}>{value ?? placeholder ?? "No data."}</pre>
    </div>
  );
}

function DataStatusPart({ name, status }: { name?: string; status?: string }) {
  return (
    <div className={TW.inlineStatus}>
      {name ? humanizeToolName(name) : "Event"}
      {status ? ` · ${formatToolState(status)}` : ""}
    </div>
  );
}

function AssistantLoadingState() {
  return (
    <div className={TW.inlineStatusActive} aria-live="polite">
      <span>Thinking</span>
      <span className={TW.loadingDots}>
        <span className={TW.loadingDot} />
        <span className={TW.loadingDot} />
        <span className={TW.loadingDot} />
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

function getMessageCustomMetadata(metadata: unknown) {
  const record = getRecord(metadata);
  return {
    ...record,
    ...getRecord(record.custom),
  };
}

function getReplySuggestions(parts: readonly unknown[]) {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = getRecord(parts[index]);
    if (part.type !== "data" || part.name !== "reply-suggestions") {
      continue;
    }

    const data = getRecord(part.data);
    const suggestions = data.suggestions;
    if (!Array.isArray(suggestions)) {
      return [];
    }

    const seenSuggestions = new Set<string>();
    return suggestions
      .filter((suggestion): suggestion is string => typeof suggestion === "string")
      .map((suggestion) => suggestion.trim())
      .filter((suggestion) => {
        if (!suggestion || seenSuggestions.has(suggestion)) {
          return false;
        }

        seenSuggestions.add(suggestion);
        return true;
      });
  }

  return [];
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

  // Don't hide artifacts - render as clickable message
  if (name === "artifact" || name === "data-artifact") {
    return false;
  }

  return name === "reply-suggestions" || /tool[-_\s]?status/i.test(name);
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
      return "border-[#0e5f5b]/15 bg-[#0e5f5b]/10 text-[#0e5f5b]";
    case "incomplete":
      return "border-[#973022]/20 bg-[#973022]/10 text-[#8f2415]";
    case "requires-action":
      return "border-[#973022]/20 bg-[#973022]/10 text-[#8f2415]";
    default:
      return "border-[#b36624]/20 bg-[#b36624]/10 text-[#9a5316]";
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

function NewChatButton({ onClick }: { onClick: () => void }) {
  const { closeArtifact } = useArtifactContext();
  return (
    <button
      type="button"
      className={TW.advisorAddBtn}
      aria-label="New conversation"
      onClick={() => { closeArtifact(); onClick(); }}
    >
      <PlusIcon />
    </button>
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

function OverviewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M15.1345 11.3374C14.6806 12.4108 13.9706 13.3568 13.0667 14.0924C12.1627 14.8281 11.0923 15.3312 9.94904 15.5576C8.80576 15.784 7.62442 15.727 6.5083 15.3914C5.39218 15.0558 4.37525 14.4519 3.54644 13.6325C2.71763 12.8131 2.10215 11.8031 1.75383 10.6909C1.40552 9.57868 1.33495 8.39807 1.54832 7.25228C1.76168 6.10649 2.25248 5.03041 2.97779 4.11812C3.70311 3.20583 4.64086 2.48511 5.70907 2.01896M15.1551 5.83135C15.4407 6.52093 15.6159 7.24995 15.6754 7.99162C15.69 8.17485 15.6974 8.26646 15.661 8.34899C15.6306 8.41793 15.5704 8.48316 15.5041 8.51896C15.4248 8.56183 15.3256 8.56183 15.1274 8.56183H9.1339C8.9341 8.56183 8.8342 8.56183 8.75789 8.52294C8.69076 8.48874 8.63619 8.43416 8.60198 8.36703C8.5631 8.29072 8.5631 8.19082 8.5631 7.99102V1.99756C8.5631 1.7993 8.5631 1.70017 8.60596 1.62081C8.64176 1.55452 8.707 1.49431 8.77594 1.46392C8.85846 1.42753 8.95008 1.43488 9.1333 1.44957C9.87498 1.50903 10.604 1.68424 11.2936 1.96987C12.1592 2.32845 12.9458 2.85401 13.6084 3.51656C14.2709 4.17912 14.7965 4.96568 15.1551 5.83135Z"
        stroke="currentColor"
        strokeWidth="1.42702"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WealthMapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <g clipPath="url(#wealth-map-icon-clip)">
        <path
          d="M15.6979 14.9838V13.5567C15.6979 12.2269 14.7883 11.1095 13.5574 10.7926M11.0601 2.34808C12.106 2.77147 12.8439 3.7969 12.8439 4.99466C12.8439 6.19241 12.106 7.21784 11.0601 7.64123M12.1303 14.9838C12.1303 13.654 12.1303 12.989 11.9131 12.4646C11.6234 11.7652 11.0678 11.2096 10.3685 10.92C9.84402 10.7027 9.17911 10.7027 7.8493 10.7027H5.70878C4.37897 10.7027 3.71406 10.7027 3.18957 10.92C2.49026 11.2096 1.93465 11.7652 1.64498 12.4646C1.42773 12.989 1.42773 13.654 1.42773 14.9838M9.63307 4.99466C9.63307 6.57089 8.35528 7.84869 6.77904 7.84869C5.2028 7.84869 3.92501 6.57089 3.92501 4.99466C3.92501 3.41842 5.2028 2.14062 6.77904 2.14062C8.35528 2.14062 9.63307 3.41842 9.63307 4.99466Z"
          stroke="currentColor"
          strokeWidth="1.42702"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="wealth-map-icon-clip">
          <rect width="17.1242" height="17.1242" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function InteractionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <g clipPath="url(#interactions-icon-clip)">
        <path
          d="M4.34909 8.01157C4.30475 7.72576 4.28174 7.43296 4.28174 7.13482C4.28174 3.98234 6.85414 1.42676 10.0274 1.42676C13.2006 1.42676 15.773 3.98234 15.773 7.13482C15.773 7.84695 15.6417 8.52862 15.4019 9.15726C15.3521 9.28782 15.3272 9.3531 15.3159 9.40407C15.3047 9.45456 15.3003 9.49009 15.2991 9.5418C15.2979 9.59399 15.305 9.65148 15.3191 9.76646L15.6064 12.0998C15.6375 12.3524 15.653 12.4787 15.611 12.5705C15.5742 12.6509 15.5088 12.7148 15.4275 12.7498C15.3348 12.7897 15.2089 12.7712 14.9571 12.7343L12.6844 12.4012C12.5657 12.3838 12.5063 12.3751 12.4523 12.3754C12.3989 12.3757 12.3619 12.3796 12.3095 12.3906C12.2567 12.4017 12.1891 12.427 12.054 12.4777C11.4237 12.7137 10.7407 12.8429 10.0274 12.8429C9.72897 12.8429 9.4359 12.8203 9.14978 12.7767M5.44591 15.6969C7.56138 15.6969 9.27632 13.9399 9.27632 11.7726C9.27632 9.60529 7.56138 7.84833 5.44591 7.84833C3.33043 7.84833 1.6155 9.60529 1.6155 11.7726C1.6155 12.2083 1.68479 12.6274 1.81271 13.0189C1.86678 13.1844 1.89381 13.2672 1.90269 13.3237C1.91195 13.3828 1.91357 13.4159 1.91012 13.4756C1.90682 13.5327 1.89252 13.5973 1.86393 13.7264L1.42773 15.6969L3.56455 15.4051C3.68118 15.3892 3.7395 15.3812 3.79042 15.3815C3.84404 15.3819 3.8725 15.3848 3.92509 15.3953C3.97503 15.4052 4.04928 15.4314 4.19776 15.4839C4.589 15.6219 5.00891 15.6969 5.44591 15.6969Z"
          stroke="currentColor"
          strokeWidth="1.42702"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="interactions-icon-clip">
          <rect width="17.1242" height="17.1242" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function DocumentsNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9.98859 1.61907V4.56624C9.98859 4.96584 9.98859 5.16564 10.0664 5.31827C10.1348 5.45253 10.2439 5.56168 10.3782 5.63009C10.5308 5.70785 10.7306 5.70785 11.1302 5.70785H14.0774M11.4156 9.27534H5.70755M11.4156 12.1294H5.70755M7.13456 6.42131H5.70755M9.98859 1.42676H6.27835C5.07955 1.42676 4.48014 1.42676 4.02226 1.66006C3.6195 1.86528 3.29204 2.19274 3.08682 2.5955C2.85352 3.05339 2.85352 3.65279 2.85352 4.85159V12.2721C2.85352 13.4709 2.85352 14.0703 3.08682 14.5282C3.29204 14.9309 3.6195 15.2584 4.02226 15.4636C4.48014 15.6969 5.07955 15.6969 6.27835 15.6969H10.8448C12.0436 15.6969 12.643 15.6969 13.1009 15.4636C13.5037 15.2584 13.8311 14.9309 14.0363 14.5282C14.2696 14.0703 14.2696 13.4709 14.2696 12.2721V5.7078L9.98859 1.42676Z"
        stroke="currentColor"
        strokeWidth="1.42702"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8.00065 8.66699C8.36884 8.66699 8.66732 8.36852 8.66732 8.00033C8.66732 7.63214 8.36884 7.33366 8.00065 7.33366C7.63246 7.33366 7.33398 7.63214 7.33398 8.00033C7.33398 8.36852 7.63246 8.66699 8.00065 8.66699Z" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.00065 4.00033C8.36884 4.00033 8.66732 3.70185 8.66732 3.33366C8.66732 2.96547 8.36884 2.66699 8.00065 2.66699C7.63246 2.66699 7.33398 2.96547 7.33398 3.33366C7.33398 3.70185 7.63246 4.00033 8.00065 4.00033Z" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.00065 13.3337C8.36884 13.3337 8.66732 13.0352 8.66732 12.667C8.66732 12.2988 8.36884 12.0003 8.00065 12.0003C7.63246 12.0003 7.33398 12.2988 7.33398 12.667C7.33398 13.0352 7.63246 13.3337 8.00065 13.3337Z" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M14 8V10.8C14 11.9201 14 12.4802 13.782 12.908C13.5903 13.2843 13.2843 13.5903 12.908 13.782C12.4802 14 11.9201 14 10.8 14H5.2C4.07989 14 3.51984 14 3.09202 13.782C2.71569 13.5903 2.40973 13.2843 2.21799 12.908C2 12.4802 2 11.9201 2 10.8V8M5.33333 4.66667L8 2L10.6667 4.66667M8 2V10"
        stroke="white"
        strokeWidth="1.14161"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 11L11 4M7 4H11V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2.33073 14.0003V10.667M2.33073 4.00033V0.666992M0.664062 2.33366H3.9974M0.664062 12.3337H3.9974M7.9974 1.33366L6.84128 4.33957C6.65327 4.82839 6.55927 5.0728 6.41308 5.27838C6.28352 5.46059 6.12433 5.61979 5.94212 5.74935C5.73653 5.89553 5.49212 5.98953 5.0033 6.17754L1.9974 7.33366L5.0033 8.48978C5.49212 8.67779 5.73653 8.77179 5.94212 8.91797C6.12433 9.04753 6.28352 9.20673 6.41308 9.38893C6.55927 9.59452 6.65327 9.83893 6.84128 10.3278L7.9974 13.3337L9.15352 10.3278C9.34152 9.83893 9.43553 9.59452 9.58171 9.38894C9.71127 9.20673 9.87047 9.04753 10.0527 8.91797C10.2583 8.77179 10.5027 8.67778 10.9915 8.48978L13.9974 7.33366L10.9915 6.17754C10.5027 5.98953 10.2583 5.89553 10.0527 5.74935C9.87046 5.61979 9.71127 5.46059 9.58171 5.27838C9.43553 5.0728 9.34152 4.82839 9.15351 4.33957L7.9974 1.33366Z" stroke="url(#paint0_linear_sparkle)" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="paint0_linear_sparkle" x1="10.6641" y1="14.0003" x2="0.664062" y2="-4.66634" gradientUnits="userSpaceOnUse">
          <stop stopColor="#804D13"/>
          <stop offset="1" stopColor="#FFE86A"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function ExpandCornersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3H3V8M3 3L9 9M16 21H21V16M21 21L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M14.5827 4.38017V13.7503C14.5827 16.2816 12.5307 18.3337 9.99935 18.3337C7.46804 18.3337 5.41602 16.2816 5.41602 13.7503V4.72255C5.41602 3.03501 6.78404 1.66699 8.47157 1.66699C10.1591 1.66699 11.5271 3.03501 11.5271 4.72255V13.7051C11.5271 14.5489 10.8431 15.2329 9.99935 15.2329C9.15558 15.2329 8.47157 14.5489 8.47157 13.7051V5.54296"
        stroke="black"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12V13C20 17.4183 16.4183 21 12 21C7.58172 21 4 17.4183 4 13V12M12 17C9.79086 17 8 15.2091 8 13V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V13C16 15.2091 14.2091 17 12 17Z"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function HistoryIcon() {
  return <ExpandIcon />;
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
