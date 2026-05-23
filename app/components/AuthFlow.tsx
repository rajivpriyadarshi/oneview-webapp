"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand, ZincBrand } from "./BrandMarks";
import { startGoogleLogin } from "../lib/authApi";
import { isApiUnauthorized as isRealApiUnauthorized } from "../lib/apiClient";
import { getPostProfileRoute } from "../lib/postAuthRoute";
import { getProfile, login } from "../lib/realAuthApi";
import { clearAuthToken, getStoredAuthToken, storeAuthToken } from "../lib/session";

export function AuthFlow() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getStoredAuthToken()) {
      routeByProfile();
    }
  }, [router]);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      validateEmail(email);
      setStep("password");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSubmit() {
    setError("");
    setIsSubmitting(true);

    try {
      await startGoogleLogin();
    } catch (requestError) {
      if (isUnauthorizedAuthError(requestError)) {
        router.replace("/");
        return;
      }

      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await login({ email, password });
      storeAuthToken(session.token);
      await routeByProfile();
    } catch (requestError) {
      if (isUnauthorizedAuthError(requestError)) {
        setError("Invalid email or password.");
        return;
      }

      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDifferentEmail() {
    setStep("login");
    setError("");
  }

  async function routeByProfile() {
    try {
      const profile = await getProfile();
      router.replace(await getPostProfileRoute(profile));
    } catch {
      clearAuthToken();
      router.replace("/");
    }
  }

  return (
    <main className="login-page">
      {step === "login" ? (
        <section className="auth-shell auth-shell-card" aria-labelledby="login-title">
          <OneviewBrand />
          <form className="login-card account-card" onSubmit={handleEmailSubmit}>
            <h1 id="login-title">Get started</h1>

            <button
              className="google-button"
              type="button"
              onClick={handleGoogleSubmit}
              disabled={isSubmitting}
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <div className="or-divider">OR</div>

            <label className={`field account-field ${email ? 'has-value' : ''}`}>
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

            <button className="continue-button" type="submit" disabled={isSubmitting}>
              Continue with Email
            </button>

            {error ? <p className="form-error">{error}</p> : null}

            <p className="terms">
              By continuing, you agree to Zinc&apos;s Consumer{" "}
              <a href="#">Terms</a> and <a href="#">Usage Policy</a>, and
              acknowledge their <a href="#">Privacy Policy</a>.
            </p>
          </form>
          <ZincBrand />
        </section>
      ) : (
        <section className="auth-shell otp-shell" aria-labelledby="password-title">
          <OneviewBrand />
          <form className="otp-panel" onSubmit={handlePasswordSubmit}>
            <h1 id="password-title">Enter password</h1>
            <p className="otp-copy">
              Password login is enabled while OTP login support is being added
              to the API.
            </p>
            <p className="sent-line">
              <span>Email: {email}</span>
              <button type="button" onClick={handleDifferentEmail}>
                Use a different email
              </button>
            </p>

            <label className={`field account-field password-login-field ${password ? 'has-value' : ''}`}>
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
              className="continue-button otp-button"
              type="submit"
              disabled={isSubmitting}
            >
              Continue
            </button>

            {error ? <p className="form-error otp-error">{error}</p> : null}
          </form>
          <ZincBrand />
        </section>
      )}
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="google-icon" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52Z"
      />
    </svg>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function validateEmail(email: string) {
  if (!email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
}

function isUnauthorizedAuthError(error: unknown) {
  return isRealApiUnauthorized(error);
}
