import { appConfig } from "./config";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void;
          renderButton: (parent: HTMLElement, options: GsiButtonConfiguration) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GsiButtonConfiguration {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  width?: number;
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
}

export interface GoogleAuthCallbackHandler {
  (response: GoogleCredentialResponse): void | Promise<void>;
}

export function initializeGoogleAuth(callback: GoogleAuthCallbackHandler) {
  if (!window.google?.accounts?.id) {
    throw new Error("Google Identity Services SDK not loaded");
  }

  if (!appConfig.googleClientId) {
    throw new Error("Google Client ID not configured");
  }

  window.google.accounts.id.initialize({
    client_id: appConfig.googleClientId,
    callback: callback,
  });
}

export function renderGoogleButton(
  element: HTMLElement,
  options?: GsiButtonConfiguration
) {
  if (!window.google?.accounts?.id) {
    throw new Error("Google Identity Services SDK not loaded");
  }

  window.google.accounts.id.renderButton(element, {
    theme: "outline",
    size: "large",
    width: 400,
    ...options,
  });
}

export async function authenticateWithGoogle(idToken: string): Promise<{
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
  created: boolean;
}> {
  const response = await fetch(`${appConfig.apiBaseUrl}/auth/google/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Google authentication failed");
  }

  return response.json();
}
