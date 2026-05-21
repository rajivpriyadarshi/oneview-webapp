const AUTH_TOKEN_KEY = "oneview.authToken";

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
}

export function getAuthHeaders() {
  const authToken = getStoredAuthToken();

  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
