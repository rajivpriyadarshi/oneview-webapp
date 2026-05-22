"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearExpectedGoogleOAuthState,
  getExpectedGoogleOAuthState,
} from "../../lib/authApi";
import { storeAuthToken } from "../../lib/session";

export function GoogleAuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing Google sign in...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedState = params.get("state");
    const expectedState = getExpectedGoogleOAuthState();
    const authToken = params.get("auth_token") ?? params.get("token");
    const error = params.get("error");

    clearExpectedGoogleOAuthState();

    if (error) {
      setMessage("Google sign in was cancelled or failed.");
      window.setTimeout(() => router.replace("/"), 900);
      return;
    }

    if (expectedState && returnedState !== expectedState) {
      setMessage("Google sign in could not be verified.");
      window.setTimeout(() => router.replace("/"), 900);
      return;
    }

    if (!authToken) {
      setMessage("Google sign in did not return a session.");
      window.setTimeout(() => router.replace("/"), 900);
      return;
    }

    storeAuthToken(authToken);
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="auth-callback-page">
      <p>{message}</p>
    </main>
  );
}
