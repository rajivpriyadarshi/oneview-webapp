import { appConfig } from "./config";
import { continueWithGoogle, type SessionResponse } from "./mockAuthApi";

const GOOGLE_OAUTH_STATE_KEY = "oneview.googleOAuthState";

export async function startGoogleLogin(): Promise<SessionResponse | null> {
  if (appConfig.useMockAuth) {
    return continueWithGoogle();
  }

  const authUrl = buildGoogleAuthUrl();
  window.location.assign(authUrl);
  return null;
}

export function getExpectedGoogleOAuthState() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(GOOGLE_OAUTH_STATE_KEY);
}

export function clearExpectedGoogleOAuthState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
}

function buildGoogleAuthUrl() {
  const authUrl = new URL(
    appConfig.googleAuthStartUrl || "/auth/google",
    appConfig.apiBaseUrl,
  );
  const redirectUri = new URL("/auth/google/callback", window.location.origin);
  const state = createOAuthState();

  window.sessionStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);
  authUrl.searchParams.set("redirect_uri", redirectUri.toString());
  authUrl.searchParams.set("state", state);

  return authUrl.toString();
}

function createOAuthState() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
