"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand, ZincBrand } from "./BrandMarks";
import { useCrmLoginMutation } from "../store/api";
import { storeAuthToken, storeAdvisorProfile } from "../lib/session";
import useAnalytics from "../hooks/useAnalytics";

export default function CRMAuthFlow() {
  const router = useRouter();
  const { trackPage, trackClick, trackAPI } = useAnalytics();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [crmLogin] = useCrmLoginMutation();

  // Track page load
  useEffect(() => {
    trackPage({
      pageName: "CRM Login Page",
      params: {
        page_url: window.location.href,
        page_title: document.title,
      },
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    trackClick({
      buttonName: "CRM Login Submit",
      pageName: "CRM Login Page",
      params: { email },
    });

    try {
      const normalizedEmail = email.trim();
      validateEmail(normalizedEmail);

      if (!password) {
        throw new Error("Password is required.");
      }

      const session = await crmLogin({
        email: normalizedEmail,
        password,
      }).unwrap();

      trackAPI({
        pageName: "CRM Login Page",
        params: {
          event_name: "CRM Login Success",
          email: normalizedEmail,
        },
      });

      // Store auth token and advisor profile
      storeAuthToken(session.token);
      storeAdvisorProfile(session.advisor);

      // Redirect to clients page
      router.replace("/clients");
    } catch (requestError) {
      trackAPI({
        pageName: "CRM Login Page",
        params: {
          event_name: "CRM Login Failure",
          error: getErrorMessage(requestError),
        },
      });
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="auth-shell auth-shell-card" aria-labelledby="login-title">
        <OneviewBrand />
        <form className="login-card account-card" onSubmit={handleSubmit}>
          <h1
            id="login-title"
            style={{
              animation: "fadeInUp 0.6s ease-out 0.1s both",
              fontSize: "36px",
              fontWeight: 400,
            }}
          >
            CRM Login
          </h1>
          <p
            style={{
              animation: "fadeInUp 0.6s ease-out 0.25s both",
              marginBottom: "24px",
              color: "#6b7280",
            }}
          >
            Sign in to access your client management dashboard
          </p>

          <label
            className={`field account-field ${email ? "has-value" : ""}`}
            style={{ animation: "fadeInUp 0.6s ease-out 0.4s both" }}
          >
            <span>Email address</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Email address"
              required
            />
          </label>

          <label
            className={`field account-field ${password ? "has-value" : ""}`}
            style={{ animation: "fadeInUp 0.6s ease-out 0.55s both" }}
          >
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              aria-label="Password"
              required
            />
          </label>

          <button
            className="continue-button"
            type="submit"
            disabled={isSubmitting}
            style={{ animation: "fadeInUp 0.6s ease-out 0.7s both" }}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          {error ? <p className="form-error">{error}</p> : null}
        </form>
        <ZincBrand />
      </section>
    </main>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (typeof data === "object" && data !== null && "error" in data) {
      return String((data as { error: unknown }).error);
    }
  }

  return "Something went wrong. Please try again.";
}

function validateEmail(email: string) {
  if (!email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
}
