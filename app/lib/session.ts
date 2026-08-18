import type { CRMAdvisor } from "./realAuthApi";

const AUTH_TOKEN_KEY = "oneview.authToken";
const ADVISOR_PROFILE_KEY = "oneview.advisorProfile";

export function storeAuthToken(authToken: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, authToken);
}

export function getStoredAuthToken() {
  if (!canUseBrowserStorage()) {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearAuthToken() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  // Clear cached profile data on logout
  window.localStorage.removeItem('userProfile');
  clearAdvisorProfile();
}

export function storeAdvisorProfile(advisor: CRMAdvisor) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(ADVISOR_PROFILE_KEY, JSON.stringify(advisor));
}

export function getStoredAdvisorProfile(): CRMAdvisor | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const stored = window.localStorage.getItem(ADVISOR_PROFILE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as CRMAdvisor;
  } catch {
    return null;
  }
}

export function clearAdvisorProfile() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.removeItem(ADVISOR_PROFILE_KEY);
}

export function getAuthHeaders() {
  const authToken = getStoredAuthToken();

  return authToken ? { Authorization: `Token ${authToken}` } : {};
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
