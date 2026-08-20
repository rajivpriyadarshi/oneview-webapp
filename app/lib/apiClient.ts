import { appConfig } from "./config";
import { clearAuthToken, getStoredAuthToken } from "./session";

export const UNAUTHORIZED_EVENT = "oneview:unauthorized";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
  skipAuth?: boolean;
  validateStatus?: (response: Response, payload: unknown) => boolean;
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
  const { body, headers, skipAuth, validateStatus, ...requestOptions } = options;
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

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      ...requestOptions,
      body: serializeBody(body, isFormData),
      headers: requestHeaders,
    });
  } catch (err) {
    clearAuthToken();
    notifyUnauthorized();
    throw new ApiError(0, "Network error. Please check your connection.", null);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await readPayload(response);

  const isValidResponse = validateStatus?.(response, payload) ?? response.ok;

  if (!isValidResponse) {
    if (response.status === 401 || response.status === 403) {
      clearAuthToken();
      notifyUnauthorized();
    }

    throw new ApiError(response.status, getPayloadErrorMessage(payload), payload);
  }

  return payload as T;
}

export function isApiUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (error && typeof error === "object") {
    const data = "data" in error ? (error as { data?: unknown }).data : error;
    return getPayloadErrorMessage(data, fallback);
  }

  return fallback;
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

function getPayloadErrorMessage(payload: unknown, fallback = "Request failed. Please try again.") {
  if (typeof payload === "string" && payload) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    for (const key of ["error", "message", "detail"]) {
      const value = (payload as Record<string, unknown>)[key];

      if (typeof value === "string" && value) {
        return value;
      }
    }
  }

  return fallback;
}

function notifyUnauthorized() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
