"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
import type { UIMessage } from "ai";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { ProtectedRoute } from "../components/ProtectedRoute";
import Sidebar from "../components/Sidebar";
import { MobileHeader } from "../components/MobileHeader";
import { SourceWealthChart } from "../components/SourceWealthChart";
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
import { appConfig } from "../lib/config";

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
    title: "Technology concentration is worrying",
    copy: "Diversification options for the NASDAQ position have not yet been discussed.",
    action: "Find alternatives to reduce tech exposure",
    prompt: "Find alternatives to reduce technology exposure in the portfolio.",
  },
  {
    title: "Enquiry about selling of property",
    copy: "Arjun was evaluating between getting a loan or selling some of his investments",
    action: "Evaluation options",
    prompt: "Evaluate options for funding a property sale versus taking a loan.",
  },
  {
    title: "Insurance document expired",
    copy: "Ask for new document",
    action: "Draft an email to ask",
    prompt: "Draft an email asking for the updated insurance document.",
  },
  {
    title: "Education fee approaching",
    copy: "The next university payment of $42,000 is expected in September. Confirm how the upcoming education payment will be funded.",
    action: "Compare ways to fund this",
    prompt: "Compare ways to fund the upcoming $42,000 education payment.",
  },
];

type AiChatMessageMetadata = {
  session_id?: string;
  message_id?: string;
  client_message_id?: string;
};

type ReplySuggestionsData = {
  suggestions: string[];
};

type AiChatDataParts = {
  "reply-suggestions": ReplySuggestionsData;
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
  workspace: "ml-[80px] grid h-screen grid-cols-[minmax(300px,380px)_minmax(0,1fr)] overflow-hidden bg-white max-[1180px]:grid-cols-[minmax(292px,350px)_minmax(0,1fr)] max-[900px]:h-[calc(100vh-66px)] max-[900px]:grid-cols-1 max-[900px]:overflow-auto max-[720px]:ml-0",
  advisorPanel: "relative grid h-screen min-w-0 grid-rows-[64px_minmax(0,1fr)_auto] border-r border-black/10 bg-white max-[900px]:h-auto max-[900px]:min-h-[calc(100vh-66px)] max-[900px]:grid-rows-[64px_auto_auto]",
  advisorHeader: "flex items-center justify-between gap-[10px] border-b border-black/10 pr-[14px] pl-[12px] max-[640px]:pr-[12px] max-[640px]:pl-[12px]",
  conversationBtn: "inline-flex min-w-0 items-center gap-[8px] border-0 bg-transparent py-[6px] font-satoshi text-[13px] font-medium leading-[16.9px] tracking-normal text-black [overflow-wrap:break-word]",
  conversationText: "truncate",
  advisorAddBtn: "inline-grid h-[30px] w-[30px] place-items-center rounded-full border-0 bg-transparent text-black hover:bg-black/5 [&_svg]:h-[15px] [&_svg]:w-[15px]",
  attentionContent: "flex min-h-0 flex-col justify-end overflow-auto pr-[14px] pl-[12px] pt-[28px] pb-[128px] max-[900px]:justify-start max-[900px]:pr-[12px] max-[900px]:pl-[12px] max-[900px]:pt-[24px] max-[900px]:pb-[128px]",
  attentionTitle: "m-0 mb-[18px] max-w-[340px] font-serif text-[38px] font-normal leading-[45.6px] tracking-normal text-black [overflow-wrap:break-word]",
  attentionList: "grid gap-[9px]",
  attentionCard: "grid justify-items-start gap-[5px] rounded-[12px] border border-black/10 bg-white px-[13px] py-[11px] text-left shadow-[0_1px_0_rgba(0,0,0,0.02)] transition hover:-translate-y-px hover:border-[#804d13]/25 hover:shadow-[0_10px_28px_rgba(31,24,14,0.08)]",
  attentionCardTitle: "font-satoshi text-[16px] font-normal leading-[17.6px] text-[#282420] [overflow-wrap:break-word]",
  attentionCopy: "max-w-[340px] bg-gradient-to-b from-[#E7DB94]/40 via-[#FFB386]/40 to-[#FF6F32]/40 bg-clip-text font-satoshi text-[12px] font-normal leading-[15.6px] text-transparent [overflow-wrap:break-word]",
  attentionAction: "mt-[6px] inline-flex max-w-full flex-wrap items-center gap-[7px] rounded-[7px] bg-gradient-to-r from-[#fff6e7] to-[#f0e7f1] px-[9px] py-[5px] font-mono text-[12px] font-normal text-black/20 [overflow-wrap:break-word]",
  compactThread: "absolute right-[14px] bottom-[14px] left-[12px] z-[5] max-[900px]:right-[12px] max-[900px]:left-[12px]",
  loading: "flex min-h-screen flex-col items-center justify-center p-[32px] font-satoshi text-[13px] text-black/50",
  notice: "m-0 rounded-lg border border-[#171615]/10 bg-white/50 p-[12px] font-satoshi text-[13px] leading-snug text-[#171615]/50",
  thread: "relative flex h-auto min-h-0 flex-col overflow-visible",
  assistantThread: "flex min-h-0 flex-1 flex-col",
  emptyViewport: "block overflow-visible",
  emptyCopy: "mx-auto flex w-full flex-col items-center p-0 text-center",
  emptyHeading: "hidden",
  suggestionsWrap: "hidden",
  suggestionsRow: "flex overflow-hidden py-1",
  suggestionsRowInner: "flex shrink-0 gap-2.5",
  suggestionPill: "inline-flex shrink-0 items-center gap-[8px] rounded-full border border-[#171615]/10 bg-white/30 px-[12px] py-[10px] font-satoshi text-[13px] leading-tight text-black backdrop-blur-xl transition hover:-translate-y-px hover:bg-white/55",
  messageViewport: "relative max-h-60 min-h-0 flex-1 overflow-y-auto px-0 pt-0 pb-[78px]",
  threadFooter: "sticky bottom-0 z-[5] bg-transparent pt-3",
  scrollToBottom: "hidden data-[state=visible]:inline-grid absolute left-1/2 top-[-16px] h-9 w-9 -translate-x-1/2 -translate-y-full place-items-center rounded-full border border-white/60 bg-white/85 text-[#171615] shadow-[0_2px_12px_rgba(0,0,0,0.12)] backdrop-blur-xl",
  errorBanner: "mx-auto mb-[10px] w-full rounded-lg border border-[#973022]/20 bg-white/70 px-[12px] py-[10px] font-satoshi text-[13px] text-[#8f2415]",
  composerDock: "absolute right-0 bottom-0 left-0 z-10 bg-transparent p-0",
  composerWrap: "w-full p-0",
  composer: "relative mx-auto grid min-h-[104px] w-full grid-rows-[1fr_auto] rounded-[22px] border border-black/10 bg-white px-[16px] py-[14px] shadow-[0px_2px_10px_0px_#0000000F] transition max-[640px]:min-h-[104px] max-[640px]:rounded-[20px] max-[640px]:px-[14px] max-[640px]:py-[14px]",
  composerThinking: "ring-1 ring-[#b37f40]/40",
  composerInputRow: "min-w-0 self-start",
  composerInput: "h-auto min-h-0 w-full resize-none border-0 bg-transparent p-0 font-satoshi text-[14px] font-normal leading-[18.9px] text-black outline-none [overflow-wrap:break-word] placeholder:text-[14px] placeholder:font-normal placeholder:leading-[18.9px] placeholder:text-black/40",
  composerFooter: "flex min-w-0 items-center justify-between gap-[10px] p-0",
  composerFooterLeft: "flex min-w-0 items-center gap-[9px]",
  composerFooterRight: "flex items-center gap-[10px]",
  composerIconBtn: "inline-grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-0 bg-transparent p-0 text-black transition hover:bg-black/5 [&_svg]:h-[20px] [&_svg]:w-[20px]",
  composerModeBtn: "inline-flex min-h-[32px] min-w-0 items-center gap-[9px] rounded-full border border-black/10 bg-white px-[12px] font-satoshi text-[12px] font-normal leading-[14.4px] text-black [overflow-wrap:break-word] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition hover:bg-black/[0.02] max-[640px]:max-w-[168px]",
  composerModeText: "truncate font-satoshi text-[12px] font-normal leading-[14.4px] text-black [overflow-wrap:break-word]",
  sendBtn: "inline-grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full border-0 bg-black p-0 text-white transition hover:-translate-y-px hover:bg-[#2d2926] disabled:bg-black disabled:text-white [&_svg]:h-[24px] [&_svg]:w-[24px]",
  messageUser: "mb-[18px] flex w-full justify-end gap-2.5",
  messageAssistant: "mb-[18px] flex w-full justify-start gap-2.5",
  messageContent: "max-w-full [overflow-wrap:anywhere] rounded-lg font-satoshi text-[13px] leading-relaxed text-black",
  userMessageContent: "rounded-[18px_18px_4px_18px] border border-white/50 bg-[#ede8df] px-[14px] py-[12px] text-black",
  assistantMessageContent: "py-1",
  messageStack: "max-w-full",
  replySuggestions: "mt-2 mb-1.5 flex max-w-full flex-wrap gap-2",
  replyPill: "inline-flex min-h-[34px] max-w-full items-center [overflow-wrap:anywhere] rounded-full border border-[#171615]/10 bg-white/40 px-[12px] py-[8px] text-left font-satoshi text-[13px] font-medium leading-[17px] text-[#171615] transition hover:-translate-y-px hover:border-[#7f4e0b]/30 hover:bg-white/70",
  messageControls: "mt-2 inline-flex items-center gap-1.5",
  inlineControls: "inline-flex items-center gap-1.5 text-[#171615]/50",
  actionBtn: "inline-grid h-[30px] w-[30px] place-items-center rounded-full border border-white/60 bg-white/50 text-[#171615]/60 shadow-sm backdrop-blur transition hover:-translate-y-px hover:bg-white/70 hover:text-[#171615]",
  branchCount: "font-satoshi text-[12px] font-bold tabular-nums",
  markdown: "[overflow-wrap:anywhere] font-satoshi text-[13px] leading-relaxed text-black [&_a]:text-[#0e5f5b] [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[#0e5f5b]/20 [&_blockquote]:pl-[14px] [&_blockquote]:text-[#171615]/70 [&_code]:rounded [&_code]:bg-[#171615]/10 [&_code]:px-[6px] [&_code]:py-[2px] [&_code]:font-mono [&_code]:text-[0.88em] [&_h1]:mb-[10px] [&_h1]:text-[1em] [&_h1]:font-bold [&_h2]:mb-[10px] [&_h2]:text-[1em] [&_h2]:font-bold [&_h3]:mb-[10px] [&_h3]:text-[1em] [&_h3]:font-bold [&_li]:my-[4px] [&_ol]:mb-[16px] [&_ol]:list-decimal [&_ol]:pl-[20px] [&_p]:mb-[16px] [&_pre]:mb-[16px] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#171615]/10 [&_pre]:p-[12px] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_table]:mb-[16px] [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#171615]/10 [&_td]:p-[8px] [&_th]:border [&_th]:border-[#171615]/10 [&_th]:bg-white/60 [&_th]:p-[8px] [&_th]:text-left [&_th]:font-bold [&_ul]:mb-[16px] [&_ul]:list-disc [&_ul]:pl-[20px] [&>*:last-child]:mb-0",
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

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialPromptParam, setInitialPromptParam] = useState(() => searchParams.get("prompt") ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
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
    setMobileRailOpen(false);
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
    setMobileRailOpen(false);
    setInitialPromptParam(null);
    router.replace("/chat");
  };

  const startPromptChat = (prompt: string) => {
    setIsDraftChat(true);
    setSelectedSessionId(null);
    setInitialMessages([]);
    setNotice(null);
    setMobileRailOpen(false);
    setInitialPromptParam(prompt);
    router.replace("/chat");
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
    <div className={TW.shell}>
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <MobileHeader
        onMenuOpen={() => setSidebarOpen(true)}
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
      <main className={TW.workspace}>
        <aside className={TW.advisorPanel} aria-label="Advisor chat">
          <div className={TW.advisorHeader}>
            <ul className="m-0 min-w-0 list-none p-0">
              <li
                className={TW.conversationBtn}
                role="button"
                tabIndex={0}
                onClick={startNewChat}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    startNewChat();
                  }
                }}
              >
                <span className={TW.conversationText}>{selectedSession?.title && selectedSession.title !== "New chat" ? selectedSession.title : "New conversation"}</span>
                <ChevronDownIcon />
              </li>
            </ul>
            <button type="button" className={TW.advisorAddBtn} aria-label="New conversation" onClick={startNewChat}>
              <PlusIcon />
            </button>
          </div>

          <div className={TW.attentionContent}>
            <h1 className={TW.attentionTitle}>Things that need your attention</h1>
            <div className={TW.attentionList}>
              {ATTENTION_ITEMS.map((item) => (
                <button
                  type="button"
                  className={TW.attentionCard}
                  key={item.title}
                  onClick={() => startPromptChat(item.prompt)}
                >
                  <span className={TW.attentionCardTitle}>{item.title}</span>
                  <span className={TW.attentionCopy}>{item.copy}</span>
                  <span className={TW.attentionAction}><SendArrowIcon />{item.action}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={TW.compactThread}>
            {isLoadingMessages ? (
              <div className={TW.loading}>Loading chat...</div>
            ) : (
              <ChatThread
                key={selectedSession?.id ?? initialPromptParam ?? "draft"}
                session={selectedSession}
                initialMessages={initialMessages}
                prompts={prompts}
                onPromptSubmitted={updateSessionFromPrompt}
                onAssistantFinished={handleAssistantFinished}
                initialPrompt={isDraftChat && !selectedSession ? initialPromptParam : null}
              />
            )}
          </div>
          {notice ? <p className={TW.notice}>{notice}</p> : null}
        </aside>

        <ClientOverview />
      </main>
    </div>
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
  onPromptSubmitted: (prompt: string) => void;
  onAssistantFinished: (details: {
    sessionId: string | null;
    prompt: string | null;
    messages: ChatUiMessage[];
  }) => void;
  initialPrompt?: string | null;
};

function ChatThread({ session, initialMessages, prompts, onPromptSubmitted, onAssistantFinished, initialPrompt }: ChatThreadProps) {
  const agent = getAiAgentSlug();
  const lastPromptRef = useRef<string | null>(null);
  const initialPromptFiredRef = useRef(false);
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

  useEffect(() => {
    if (!initialPrompt || initialPromptFiredRef.current) return;
    initialPromptFiredRef.current = true;
    runtime.thread.append({ role: "user", content: [{ type: "text", text: initialPrompt }] });
  }, [initialPrompt, runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={TW.thread}>
        <ThreadPrimitive.Root className={TW.assistantThread}>
          <AuiIf condition={(state) => state.thread.isEmpty}>
            <div className={TW.emptyViewport}>
              <div className={TW.emptyCopy}>
                <p className={TW.emptyHeading}>Ask anything about your portfolio</p>
                <Composer placeholder="What can I help you with?" agent={agent} />
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
            <Composer placeholder="Ask a follow-up..." agent={agent} />
          </div>
        </AuiIf>
      </div>
    </AssistantRuntimeProvider>
  );
}

function ClientOverview() {
  const [activeTab, setActiveTab] = useState<ClientTab>("overview");

  return (
    <section className="grid h-screen min-w-0 overflow-hidden grid-rows-[64px_minmax(0,1fr)] bg-gradient-to-b from-white to-[#f6f1eb] max-[900px]:h-auto max-[900px]:min-h-[calc(100vh-66px)]" aria-label="Client overview">
      <header className="flex min-w-0 items-center justify-between gap-[9px] overflow-hidden border-b border-black/10 bg-white/85 px-[18px] pr-[12px] backdrop-blur-xl max-[900px]:sticky max-[900px]:top-0 max-[900px]:z-20 max-[640px]:px-[12px]">
        <nav className="no-scrollbar min-w-0 flex-1 overflow-x-auto" aria-label="Client sections">
          <ul className="m-0 flex min-w-0 list-none items-center gap-[10px] p-0">
            <ClientTabButton active={activeTab === "overview"} icon={<OverviewIcon />} label="Overview" onClick={() => setActiveTab("overview")} />
            <ClientTabButton active={activeTab === "wealth-map"} icon={<WealthMapIcon />} label="Wealth map" onClick={() => setActiveTab("wealth-map")} />
            <ClientTabButton active={activeTab === "interactions"} icon={<InteractionsIcon />} label="Interactions" onClick={() => setActiveTab("interactions")} />
            <ClientTabButton active={activeTab === "documents"} icon={<DocumentsNavIcon />} label="Documents" onClick={() => setActiveTab("documents")} />
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-[9px] max-[640px]:hidden">
          <button type="button" className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[12px] border border-black/20 bg-white p-[9px] text-black hover:bg-black/5 [&_svg]:h-[18px] [&_svg]:w-[18px]" aria-label="More options"><MoreIcon /></button>
          <button type="button" className="inline-flex h-[32px] shrink-0 items-center justify-center gap-[7px] rounded-[9px] border-0 bg-black px-[12px] py-[8px] text-white max-[1320px]:w-[32px] max-[1320px]:px-0 max-[1320px]:py-0 [&_svg]:h-[16px] [&_svg]:w-[16px]" aria-label="Share">
            <ShareIcon />
            <span className="[font-family:var(--font-inter)] text-[11.99px] font-[600] leading-[17.12px] text-white [overflow-wrap:break-word] max-[1320px]:sr-only">Share</span>
          </button>
        </div>
      </header>

      {activeTab === "overview" ? <OverviewTab /> : null}
      {activeTab === "wealth-map" ? <WealthMapTab /> : null}
      {activeTab === "interactions" ? <PlaceholderTab title="Interactions" /> : null}
      {activeTab === "documents" ? <PlaceholderTab title="Documents" /> : null}
    </section>
  );
}

function ClientTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`inline-flex min-h-[32px] shrink-0 items-center gap-[7px] rounded-[9px] border-0 px-[12px] font-satoshi text-[14px] leading-[18.2px] tracking-normal whitespace-nowrap text-black [overflow-wrap:break-word] [&_svg]:h-[16px] [&_svg]:w-[16px] ${active ? "bg-[#eeeae4] font-bold" : "bg-transparent font-medium hover:bg-black/5"}`}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        {icon}
        {label}
      </button>
    </li>
  );
}

function OverviewTab() {
  return (
      <div className="min-h-0 overflow-auto bg-[#f7f3ee] pb-[40px]">
        <section className="relative overflow-visible bg-[#f7f3ee] px-[48px] pt-[48px] pb-[40px] max-[1180px]:px-[44px] max-[640px]:px-[16px] max-[640px]:pt-[36px]">
          <div className="absolute inset-x-0 top-0 h-[470px] overflow-hidden h-[500px]">
            <Image src="/overview.png" alt="" fill priority sizes="(max-width: 900px) 100vw, calc(100vw - 608px)" />
          </div>
          <div className="relative z-[1]">
            <h1 className="whitespace-nowrap font-serif text-[42px] font-medium leading-[50.4px] tracking-normal text-[#4D2E0C] [overflow-wrap:break-word] max-[1380px]:whitespace-normal">The Ranganathan Family</h1>
            <p className="m-0 max-w-[480px] font-satoshi text-[16px] font-normal leading-[20.8px] text-[#423d37] [overflow-wrap:break-word]">Singapore based entrepreneur with wealth distributed across India, USA, Australia</p>
            <div className="mt-[16px] flex flex-wrap gap-[18px]" aria-label="Client tags">
              <span className="inline-flex min-h-[44px] items-center rounded-full bg-[#eee9e1] px-[16px] py-[8px] font-satoshi text-[16px] font-normal leading-[19.2px] text-black [overflow-wrap:break-word]">$100M</span>
              <span className="inline-flex min-h-[44px] items-center rounded-full bg-[#eee9e1] px-[16px] py-[8px] font-satoshi text-[16px] font-normal leading-[19.2px] text-black [overflow-wrap:break-word]">Singapore</span>
              <span className="inline-flex min-h-[44px] items-center rounded-full bg-[#eee9e1] px-[16px] py-[8px] font-satoshi text-[16px] font-normal leading-[19.2px] text-black [overflow-wrap:break-word]">India</span>
            </div>
          </div>

          <div className="relative z-[1] mt-[80px]" aria-labelledby="since-visit-title">
            <h2 id="since-visit-title" className="m-0 mb-[14px] font-serif text-[24px] font-semibold leading-[28.8px] text-black [overflow-wrap:break-word]">Since your last visit</h2>
            <div className="grid grid-cols-3 gap-[18px] max-[1180px]:grid-cols-1">
              <MetricCard label="Net worth" value="$3.70B" change="$0.25B 7.14%" date="from Jan 1, 2025" />
              <MetricCard label="Alternative assets" value="$926,874,585" change="$3.3M 3.54%" date="from Apr 1, 2024" />
              <MetricCard label="Cash flow" value="$14.20M" change="$1.46M 11.03%" date="from Jan 1, 2025" />
            </div>
          </div>
        </section>

        <section className="relative mx-[64px] mt-[28px] mb-[26px] h-[380px] overflow-hidden rounded-[18px] border border-black/15 bg-[#fbfaf7] bg-[radial-gradient(circle_at_58%_48%,rgba(238,195,87,0.25),transparent_32%),radial-gradient(circle_at_86%_42%,rgba(70,190,205,0.20),transparent_30%),radial-gradient(circle_at_80%_78%,rgba(146,110,226,0.16),transparent_30%)] before:absolute before:inset-0 before:bg-[radial-gradient(rgba(70,56,38,0.22)_1.5px,transparent_1.5px)] before:bg-[length:34px_34px] before:opacity-45 max-[1180px]:mx-[44px] max-[640px]:mx-[18px]" aria-label="Wealth map preview">
          <h2 className="relative z-[1] m-0 px-[30px] pt-[28px] font-satoshi text-[20px] font-extrabold text-[#111]">Wealth map</h2>
          <button type="button" className="absolute bottom-[24px] left-[24px] z-[2] inline-grid h-[54px] w-[54px] place-items-center rounded-full border-0 bg-black/15 text-[#575757]" aria-label="Expand wealth map"><ExpandCornersIcon /></button>
          <div className="absolute top-[166px] left-[78px] z-[2] grid min-w-[198px] grid-cols-[42px_minmax(0,1fr)] items-center gap-x-3 rounded-xl bg-white/85 p-3 shadow-[0_4px_12px_rgba(0,0,0,0.18)]">
            <span className="absolute -top-[17px] left-0 rounded bg-black px-[7px] py-[3px] font-satoshi text-[7px] font-extrabold text-white">CLIENT</span>
            <AvatarSeed />
            <strong className="truncate font-satoshi text-[11px] leading-tight text-black">Ranganathan family</strong>
            <small className="font-satoshi text-[8px] leading-tight text-[#4f4a43]">Adjusted value: $378M</small>
          </div>
          <div className="absolute top-[205px] left-[260px] z-[1] h-px w-[200px] origin-left bg-[#9b651d]" />
          <div className="absolute top-[78px] left-[39%] z-[2] grid min-h-60 w-[198px] grid-cols-1 rounded-xl border-2 border-[#b77b24] bg-[#251907] p-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.18)] max-[640px]:left-[34%]">
            <span className="absolute -top-[17px] left-0 rounded bg-black px-[7px] py-[3px] font-satoshi text-[7px] font-extrabold text-white">CLIENT</span>
            <AvatarSeed wide />
            <strong className="truncate font-satoshi text-[11px] leading-tight text-white">Prashanth Ranganathan</strong>
            <small className="font-satoshi text-[8px] leading-tight text-white">Adjusted value: $378M</small>
            <p className="m-0 mt-2 font-satoshi text-[8px] leading-[1.35] text-white/70">Prashanth's wealth spans businesses, investments, trusts and multiple geographies.</p>
            <button type="button" className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border-0 bg-[#f4af23] px-2.5 py-2 font-mono text-[9px] font-extrabold text-[#231908]">Expand details <ChevronRightIcon /></button>
          </div>
          <div className="absolute top-[205px] left-[calc(39%+198px)] z-[1] h-px w-[220px] origin-left -rotate-[29deg] bg-[#9b651d]" />
          <div className="absolute top-[205px] left-[calc(39%+198px)] z-[1] h-px w-[230px] origin-left rotate-[24deg] bg-[#4bb7a1]" />
          <div className="absolute top-[14px] right-[14%] z-[2] grid min-w-[198px] grid-cols-[42px_minmax(0,1fr)] items-center gap-x-3 rounded-xl bg-white/85 p-3 shadow-[0_4px_12px_rgba(0,0,0,0.18)] max-[640px]:-right-[72px]">
            <AvatarSeed /><strong className="truncate font-satoshi text-[11px] leading-tight text-black">Family Trust</strong><small className="font-satoshi text-[8px] leading-tight text-[#4f4a43]">Adjusted value: $378M</small>
          </div>
          <div className="absolute top-[162px] right-[14%] z-[2] grid min-w-[198px] grid-cols-[42px_minmax(0,1fr)] items-center gap-x-3 rounded-xl border border-[#9d5d21] bg-white/85 p-3 shadow-[0_4px_12px_rgba(0,0,0,0.18)] max-[640px]:-right-[72px]">
            <span className="absolute -top-[17px] left-0 rounded bg-black/25 px-[7px] py-[3px] font-satoshi text-[7px] font-extrabold text-white">CATEGORY</span>
            <AvatarSeed /><strong className="truncate font-satoshi text-[11px] leading-tight text-black">Financials</strong><small className="font-satoshi text-[8px] leading-tight text-[#4f4a43]">Adjusted value: $378M</small>
          </div>
          <div className="absolute right-[14%] bottom-[42px] z-[2] grid min-w-[198px] grid-cols-[42px_minmax(0,1fr)] items-center gap-x-3 rounded-xl bg-white/85 p-3 shadow-[0_4px_12px_rgba(0,0,0,0.18)] max-[640px]:-right-[72px]">
            <span className="absolute -top-[17px] left-0 rounded bg-black/25 px-[7px] py-[3px] font-satoshi text-[7px] font-extrabold text-white">CATEGORY</span>
            <AvatarSeed /><strong className="truncate font-satoshi text-[11px] leading-tight text-black">Family</strong><small className="font-satoshi text-[8px] leading-tight text-[#4f4a43]">Adjusted value: $378M</small>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-[24px] px-[64px] max-[1180px]:grid-cols-1 max-[1180px]:px-[44px] max-[640px]:px-[16px]">
          <section className="min-h-[220px] overflow-hidden rounded-[18px] bg-white px-[30px] py-[28px]">
            <h2 className="m-0 font-satoshi text-[18px] font-extrabold text-[#111]">Asset allocation</h2>
            <div className="mx-auto mt-[34px] grid h-[160px] w-[160px] place-items-center rounded-full bg-[conic-gradient(#2f9b62_0_34%,#d69b2b_34%_57%,#4b82c3_57%_77%,#9b63b7_77%_100%)]" aria-hidden="true">
              <span className="h-[88px] w-[88px] rounded-full bg-white" />
            </div>
          </section>
          <section className="min-h-[220px] overflow-hidden rounded-[18px] bg-white px-[30px] py-[28px]">
            <h2 className="m-0 font-satoshi text-[18px] font-extrabold text-[#111]">Value (USD) grouped by asset class</h2>
            <div className="mt-[38px] flex h-[168px] items-end gap-[20px] border-y border-[#e1e5ea] px-[14px]" aria-hidden="true">
              <span className="w-[36px] rounded-t bg-[#2f9b62]" style={{ height: "42%" }} />
              <span className="w-[36px] rounded-t bg-[#2f9b62]" style={{ height: "68%" }} />
              <span className="w-[36px] rounded-t bg-[#2f9b62]" style={{ height: "28%" }} />
              <span className="w-[36px] rounded-t bg-[#2f9b62]" style={{ height: "82%" }} />
              <span className="w-[36px] rounded-t bg-[#2f9b62]" style={{ height: "52%" }} />
            </div>
          </section>
        </div>
      </div>
  );
}

function WealthMapTab() {
  return (
    <div className="min-h-0 overflow-auto bg-white">
      <section className="relative h-[calc(100vh-64px)] min-h-[640px] overflow-hidden bg-white">
        <SourceWealthChart />
      </section>
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
      <p className="m-0 mb-2 font-serif text-[clamp(48px,8vw,106px)] leading-none text-[#171615]">OneView</p>
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

function Composer({ placeholder, agent }: { placeholder: string; agent: string }) {
  const isRunning = useThread((t) => t.isRunning);
  const applyFormat = useComposerFormat();
  void agent;
  void applyFormat;
  return (
    <ComposerPrimitive.Root className={TW.composerWrap}>
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
        <div className={TW.composerFooter}>
          <div className={TW.composerFooterLeft}>
            <button type="button" className={TW.composerIconBtn} aria-label="Attach file" title="Attach file">
              <PaperclipIcon />
            </button>
            <button type="button" className={TW.composerModeBtn} aria-label="Explore workflows" title="Explore workflows">
              <span className={TW.composerModeText}>Explore workflows</span>
              <ChevronDownIcon />
            </button>
          </div>
          <div className={TW.composerFooterRight}>
            <button type="button" className={TW.composerIconBtn} aria-label="Use microphone" title="Use microphone">
              <MicIcon />
            </button>
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

function UserMessage() {
  return (
    <MessagePrimitive.Root className={TW.messageUser}>
      <div className={`${TW.messageContent} ${TW.userMessageContent}`}>
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

  return (
    <MessagePrimitive.Root className={TW.messageAssistant}>
      <div className={TW.messageStack}>
        <div className={`${TW.messageContent} ${TW.assistantMessageContent}`}>
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
        {replySuggestions.length > 0 ? (
          <div className={TW.replySuggestions} aria-label="Reply suggestions">
            {replySuggestions.map((suggestion) => (
              <ReplySuggestionButton
                key={suggestion}
                suggestion={suggestion}
                autoSubmit={appConfig.replySuggestionsAutoSubmit}
              />
            ))}
          </div>
        ) : null}
        <div className={TW.messageControls}>
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
        </div>
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
    <button type="button" className={TW.replyPill} onClick={handleClick}>
      {suggestion}
    </button>
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
