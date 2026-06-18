import type { UIMessage } from "ai";
import { appConfig } from "./config";
import { getAuthHeaders, getStoredAuthToken } from "./session";

const AI_AGENT_SLUG = "wealth-advisor";
const AI_CHAT_BASE_PATH = "chats/";
const LOCAL_CHAT_SESSIONS_KEY = "oneview:ai-chat-sessions";

export type AiChatSession = {
  id: string;
  title: string;
  agent: string;
  created_at?: string;
  updated_at?: string;
  source?: "server" | "local";
};

type ChatListResponse = {
  chats?: Array<{
    id: string;
    title?: string | null;
    agent?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
};

type CreateChatResponse = {
  id: string;
  title?: string | null;
  agent?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MessagesResponse = {
  id: string;
  messages: UIMessage[];
};

export function getAiAgentSlug() {
  return AI_AGENT_SLUG;
}

export function buildAiChatApiUrl(path = "") {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const baseUrl = getAiApiBaseUrl();
  if (baseUrl.startsWith("/")) {
    return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }

  return new URL(path.replace(/^\//, ""), baseUrl).toString();
}

export function getAiChatMessagesUrl(sessionId: string) {
  return buildAiChatApiUrl(`${AI_CHAT_BASE_PATH}${encodeURIComponent(sessionId)}/messages/`);
}

export async function createAiChatSession() {
  requireAiAuthToken();

  const response = await aiChatFetch(buildAiChatApiUrl(AI_CHAT_BASE_PATH), {
    method: "POST",
    headers: getAiRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      metadata: {
        agent: AI_AGENT_SLUG,
      },
    }),
  });

  const payload = await readJson<CreateChatResponse>(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Could not start a chat."));
  }

  const session = normalizeSession(payload, "local");
  upsertStoredAiChatSession(session);
  return session;
}

export async function listAiChatSessions() {
  requireAiAuthToken();

  const response = await aiChatFetch(buildAiChatApiUrl(AI_CHAT_BASE_PATH), {
    headers: getAiRequestHeaders(),
  });

  const payload = await readJson<ChatListResponse>(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Chat listing is not available."));
  }

  return (payload.chats ?? []).map((chat) => normalizeSession(chat, "server"));
}

export async function loadAiChatMessages(sessionId: string) {
  requireAiAuthToken();

  const response = await aiChatFetch(getAiChatMessagesUrl(sessionId), {
    headers: getAiRequestHeaders(),
  });

  const payload = await readJson<MessagesResponse>(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Could not load chat messages."));
  }

  return payload.messages ?? [];
}

export function getAiRequestHeaders(headers?: HeadersInit): Record<string, string> {
  const requestHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(getAuthHeaders())) {
    if (value) {
      requestHeaders[key] = value;
    }
  }

  new Headers(headers).forEach((value, key) => {
    requestHeaders[key] = value;
  });

  return requestHeaders;
}

export async function aiChatFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers: getAiRequestHeaders(init?.headers),
  });
}

function getAiApiBaseUrl() {
  if (!appConfig.apiBaseUrl) {
    return "/api/ai/";
  }

  const normalized = appConfig.apiBaseUrl.endsWith("/")
    ? appConfig.apiBaseUrl
    : `${appConfig.apiBaseUrl}/`;

  if (normalized.includes("/api/wealth/")) {
    return normalized.replace(/\/api\/wealth\/.*$/, "/api/ai/");
  }

  if (normalized.endsWith("/api/")) {
    return new URL("ai/", normalized).toString();
  }

  return new URL("/api/ai/", normalized).toString();
}

function requireAiAuthToken() {
  if (getStoredAuthToken()) {
    return;
  }

  throw new Error("Authentication required.");
}

export function readStoredAiChatSessions() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_CHAT_SESSIONS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((session): session is AiChatSession => {
        return session && typeof session === "object" && typeof session.id === "string";
      })
      .map((session) => normalizeSession(session, "local"));
  } catch (error) {
    console.error("Failed to read stored AI chat sessions:", error);
    return [];
  }
}

export function upsertStoredAiChatSession(session: AiChatSession) {
  if (typeof window === "undefined") {
    return;
  }

  const sessions = mergeAiChatSessions([session], readStoredAiChatSessions());
  window.localStorage.setItem(LOCAL_CHAT_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 24)));
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
  session: Partial<CreateChatResponse | AiChatSession>,
  source: AiChatSession["source"],
): AiChatSession {
  return {
    id: String(session.id ?? ""),
    title: session.title || "New chat",
    agent: session.agent || AI_AGENT_SLUG,
    created_at: session.created_at ?? undefined,
    updated_at: session.updated_at ?? session.created_at ?? new Date().toISOString(),
    source,
  };
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
