import type { UIMessage } from "ai";
import { appConfig } from "./config";
import { getAuthHeaders, getStoredAuthToken } from "./session";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAiRequestHeaders(headers?: HeadersInit): Record<string, string> {
  const requestHeaders = new Headers(headers);

  for (const [key, value] of Object.entries(getAuthHeaders())) {
    if (value) {
      requestHeaders.set(key, value);
    }
  }

  const csrfToken = getCsrfToken();
  if (csrfToken) {
    requestHeaders.set("X-CSRFToken", csrfToken);
  }

  return Object.fromEntries(requestHeaders.entries());
}

export function buildAiChatApiUrl(path = "") {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const baseUrl = appConfig.apiBaseUrl.endsWith("/")
    ? appConfig.apiBaseUrl
    : `${appConfig.apiBaseUrl}/`;

  return new URL(path.replace(/^\//, ""), baseUrl).toString();
}

let csrfPromise: Promise<void> | null = null;
const AI_CHAT_BASE_PATH = "oneview/chats/";
const LOCAL_CHAT_SESSIONS_KEY = "oneview:ai-chat-sessions";
const LOCAL_CHAT_SESSIONS_MAX = 24;
const LOCAL_CHAT_SESSIONS_FRESH_MS = 60_000;

type StoredAiChatSessions = {
  updatedAt?: number;
  sessions?: AiChatSession[];
};

async function ensureCsrfToken(): Promise<void> {
  if (getCsrfToken()) {
    return;
  }

  if (csrfPromise) {
    return csrfPromise;
  }

  csrfPromise = fetch(buildAiChatApiUrl(AI_CHAT_BASE_PATH), {
    cache: "no-store",
    credentials: "include",
    headers: getAiRequestHeaders(),
  })
    .then(() => undefined)
    .catch(() => undefined);

  return csrfPromise;
}
export type AiChatSession = {
  id: string;
  title: string;
  agent: string;
  created_at?: string;
  updated_at?: string;
  is_pinned?: boolean;
  is_archived?: boolean;
  source?: "server" | "local";
};

export type ChatPrompt = {
  id: number;
  title: string;
  description: string;
  user_message: string;
};

type ChatSummary = {
  id: string;
  title?: string | null;
  agent?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_pinned?: boolean | null;
  is_archived?: boolean | null;
};

type ChatListResponse = {
  chats?: ChatSummary[];
};

type ChatPromptsResponse = {
  prompts?: ChatPrompt[];
};

type MessagesResponse = {
  id: string;
  messages: UIMessage[];
};

type NormalizableSession = Partial<
  Omit<AiChatSession, "title" | "agent" | "created_at" | "updated_at" | "is_pinned" | "is_archived"> & {
    title: string | null;
    agent: string | null;
    created_at: string | null;
    updated_at: string | null;
    is_pinned: boolean | null;
    is_archived: boolean | null;
  }
>;

export function getAiAgentSlug() {
  return appConfig.aiAgentSlug;
}

export function getAiChatsUrl() {
  return buildAiChatApiUrl(AI_CHAT_BASE_PATH);
}

export function getAiChatMessagesUrl(sessionId: string) {
  return buildAiChatApiUrl(`${AI_CHAT_BASE_PATH}${encodeURIComponent(sessionId)}/messages/`);
}

export async function listAiChatSessions(options?: { archivedOnly?: boolean }) {
  requireAiAuthToken();

  const url = new URL(buildAiChatApiUrl(AI_CHAT_BASE_PATH));
  if (options?.archivedOnly) {
    url.searchParams.set("archived_only", "true");
  }

  const response = await aiChatFetch(url.toString(), {
    cache: "no-store",
    headers: getAiRequestHeaders(),
  });

  const payload = await readJson<ChatListResponse>(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Chat listing is not available."));
  }

  return (payload.chats ?? []).map((chat) => normalizeSession(chat, "server"));
}

function getAiChatPinUrl(sessionId: string) {
  return buildAiChatApiUrl(`${AI_CHAT_BASE_PATH}${encodeURIComponent(sessionId)}/pin/`);
}

function getAiChatArchiveUrl(sessionId: string) {
  return buildAiChatApiUrl(`${AI_CHAT_BASE_PATH}${encodeURIComponent(sessionId)}/archive/`);
}

export async function pinAiChatSession(sessionId: string, isPinned?: boolean) {
  requireAiAuthToken();

  const response = await aiChatFetch(getAiChatPinUrl(sessionId), {
    method: "PATCH",
    headers: { ...getAiRequestHeaders(), "Content-Type": "application/json" },
    body: typeof isPinned === "boolean" ? JSON.stringify({ is_pinned: isPinned }) : undefined,
  });

  const payload = await readJson<ChatSummary>(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Could not update the pinned state."));
  }

  return normalizeSession(payload, "server");
}

export async function archiveAiChatSession(sessionId: string, isArchived?: boolean) {
  requireAiAuthToken();

  const response = await aiChatFetch(getAiChatArchiveUrl(sessionId), {
    method: "PATCH",
    headers: { ...getAiRequestHeaders(), "Content-Type": "application/json" },
    body: typeof isArchived === "boolean" ? JSON.stringify({ is_archived: isArchived }) : undefined,
  });

  const payload = await readJson<ChatSummary>(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Could not update the archived state."));
  }

  return normalizeSession(payload, "server");
}

export async function listChatPrompts() {
  requireAiAuthToken();

  const response = await fetch("/api/oneview/chat-prompts", {
    cache: "no-store",
  });

  const payload = await readJson<ChatPromptsResponse>(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Chat prompts are not available."));
  }

  return payload.prompts ?? [];
}

export async function loadAiChatMessages(sessionId: string) {
  requireAiAuthToken();

  const response = await aiChatFetch(getAiChatMessagesUrl(sessionId), {
    cache: "no-store",
    headers: getAiRequestHeaders(),
  });

  const payload = await readJson<MessagesResponse>(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Could not load chat messages."));
  }

  return payload.messages ?? [];
}

export async function aiChatFetch(input: RequestInfo | URL, init?: RequestInit) {
  const method = init?.method?.toUpperCase() ?? "GET";
  const needsCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (needsCsrf) {
    await ensureCsrfToken();
  }

  return fetch(input, {
    ...init,
    cache: init?.cache ?? (method === "GET" ? "no-store" : undefined),
    credentials: init?.credentials ?? "include",
    headers: getAiRequestHeaders(init?.headers),
  });
}

function requireAiAuthToken() {
  if (getStoredAuthToken()) {
    return;
  }

  throw new Error("Authentication required.");
}

export function readStoredAiChatSessions(options?: { maxAgeMs?: number }) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_CHAT_SESSIONS_KEY) ?? "[]");
    const stored = parseStoredAiChatSessions(parsed);

    if (!stored.sessions.length) {
      return [];
    }

    if (
      typeof options?.maxAgeMs === "number" &&
      (!stored.updatedAt || Date.now() - stored.updatedAt > options.maxAgeMs)
    ) {
      return [];
    }

    return stored.sessions
      .filter((session): session is AiChatSession => {
        return session && typeof session === "object" && typeof session.id === "string" && session.id.length > 0;
      })
      .map((session) => normalizeSession(session, session.source === "server" ? "server" : "local"));
  } catch (error) {
    console.error("Failed to read stored AI chat sessions:", error);
    return [];
  }
}

export function writeStoredAiChatSessions(sessions: AiChatSession[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    LOCAL_CHAT_SESSIONS_KEY,
    JSON.stringify({
      updatedAt: Date.now(),
      sessions: sessions.slice(0, LOCAL_CHAT_SESSIONS_MAX),
    } satisfies StoredAiChatSessions),
  );
}

export function upsertStoredAiChatSession(session: AiChatSession) {
  if (typeof window === "undefined") {
    return;
  }

  const sessions = mergeAiChatSessions(
    [session],
    readStoredAiChatSessions({ maxAgeMs: LOCAL_CHAT_SESSIONS_FRESH_MS }),
  );
  writeStoredAiChatSessions(sessions);
}

export function mergeAiChatSessions(...groups: AiChatSession[][]) {
  const byId = new Map<string, AiChatSession>();

  for (const session of groups.flat()) {
    const existing = byId.get(session.id);
    byId.set(session.id, {
      ...existing,
      ...session,
      title: session.title || existing?.title || "New chat",
      updated_at: session.updated_at || existing?.updated_at || session.created_at || existing?.created_at,
      is_pinned: session.is_pinned ?? existing?.is_pinned ?? false,
      is_archived: session.is_archived ?? existing?.is_archived ?? false,
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = Date.parse(a.updated_at ?? a.created_at ?? "");
    const bTime = Date.parse(b.updated_at ?? b.created_at ?? "");
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

export function createTitleFromPrompt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "New chat";
  }

  return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized;
}

function normalizeSession(
  session: NormalizableSession,
  source: AiChatSession["source"],
): AiChatSession {
  return {
    id: String(session.id ?? ""),
    title: session.title || "New chat",
    agent: session.agent || appConfig.aiAgentSlug,
    created_at: session.created_at ?? undefined,
    updated_at: session.updated_at ?? session.created_at ?? new Date().toISOString(),
    is_pinned: session.is_pinned ?? false,
    is_archived: session.is_archived ?? false,
    source,
  };
}

function parseStoredAiChatSessions(value: unknown): { updatedAt?: number; sessions: AiChatSession[] } {
  if (Array.isArray(value)) {
    return { sessions: value };
  }

  if (value && typeof value === "object") {
    const stored = value as StoredAiChatSessions;
    if (Array.isArray(stored.sessions)) {
      return {
        updatedAt: typeof stored.updatedAt === "number" ? stored.updatedAt : undefined,
        sessions: stored.sessions,
      };
    }
  }

  return { sessions: [] };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { detail: text } as T;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    for (const key of ["detail", "message", "error"]) {
      const value = (payload as Record<string, unknown>)[key];
      if (typeof value === "string" && value) {
        return value;
      }
    }
  }

  if (typeof payload === "string" && payload) {
    return payload;
  }

  return fallback;
}
