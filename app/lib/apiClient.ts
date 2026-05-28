import { appConfig } from "./config";
import { clearAuthToken, getStoredAuthToken } from "./session";

export const UNAUTHORIZED_EVENT = "oneview:unauthorized";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
  skipAuth?: boolean;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers, skipAuth, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  const isFormData = body instanceof FormData;

  if (!skipAuth) {
    const authToken = getStoredAuthToken();

    if (!authToken) {
      throw new ApiError(401, "Authentication required.");
    }

    if (authToken) {
      requestHeaders.set("Authorization", `Token ${authToken}`);
    }
  }

  if (body && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...requestOptions,
    body: serializeBody(body, isFormData),
    headers: requestHeaders,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await readPayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      notifyUnauthorized();
    }

    throw new ApiError(response.status, getErrorMessage(payload), payload);
  }

  return payload as T;
}

export function isApiUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function buildApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const baseUrl = appConfig.apiBaseUrl.endsWith("/")
    ? appConfig.apiBaseUrl
    : `${appConfig.apiBaseUrl}/`;

  return new URL(path.replace(/^\//, ""), baseUrl).toString();
}

function serializeBody(
  body: ApiRequestOptions["body"],
  isFormData: boolean,
): BodyInit | undefined {
  if (!body) {
    return undefined;
  }

  if (isFormData || typeof body !== "object") {
    return body as BodyInit;
  }

  return JSON.stringify(body);
}

async function readPayload(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function getErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload) {
    return payload;
  }

  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;

    if (typeof error === "string") {
      return error;
    }
  }

  return "Request failed. Please try again.";
}

function notifyUnauthorized() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
