"use client";

import { ClipboardEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand, ZincBrand } from "./BrandMarks";
import { startGoogleLogin } from "../lib/authApi";
import {
  isApiUnauthorized,
  requestEmailOtp,
  verifyEmailOtp,
} from "../lib/mockAuthApi";
import { getStoredAuthToken, storeAuthToken } from "../lib/session";

const DEFAULT_EMAIL = "naksh.mehta@gmail.com";
const OTP_LENGTH = 6;

export function AuthFlow() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "otp">("login");
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [otp, setOtp] = useState(["2", "5", "0", "5", "9", "0"]);
  const [retrySeconds, setRetrySeconds] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (getStoredAuthToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    if (step !== "otp" || retrySeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRetrySeconds((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [retrySeconds, step]);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await requestEmailOtp({ email });
      setRetrySeconds(25);
      setStep("otp");
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
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
      const session = await startGoogleLogin();

      if (session) {
        storeAuthToken(session.authToken);
        router.replace("/dashboard");
      }
    } catch (requestError) {
      if (isApiUnauthorized(requestError)) {
        router.replace("/");
        return;
      }

      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await verifyEmailOtp({ email, otp: otp.join("") });
      storeAuthToken(session.authToken);
      router.replace("/dashboard");
    } catch (requestError) {
      if (isApiUnauthorized(requestError)) {
        router.replace("/");
        return;
      }

      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, key: string) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pastedDigits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH - index)
      .split("");

    if (pastedDigits.length === 0) {
      return;
    }

    event.preventDefault();

    const nextOtp = [...otp];
    pastedDigits.forEach((digit, digitIndex) => {
      nextOtp[index + digitIndex] = digit;
    });

    setOtp(nextOtp);

    const nextFocusIndex = Math.min(index + pastedDigits.length, OTP_LENGTH - 1);
    otpRefs.current[nextFocusIndex]?.focus();
  }

  function handleDifferentEmail() {
    setStep("login");
    setError("");
  }

  async function handleRetryOtp() {
    if (retrySeconds > 0) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await requestEmailOtp({ email });
      setRetrySeconds(25);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
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

            <label className="field account-field">
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
        <section className="auth-shell otp-shell" aria-labelledby="otp-title">
          <OneviewBrand />
          <form className="otp-panel" onSubmit={handleOtpSubmit}>
            <h1 id="otp-title">Verify with OTP</h1>
            <p className="otp-copy">
              Please confirm your email by entering the OTP sent to your email
              address
            </p>
            <p className="sent-line">
              <span>Sent to: {email}</span>
              <button type="button" onClick={handleDifferentEmail}>
                Use a different email
              </button>
            </p>

            <div className="otp-inputs" aria-label="One-time password">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    otpRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(event) => handleOtpChange(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event.key)}
                  onPaste={(event) => handleOtpPaste(index, event)}
                  aria-label={`OTP digit ${index + 1}`}
                  required
                />
              ))}
            </div>

            <button className="continue-button otp-button" type="submit" disabled={isSubmitting}>
              Continue
            </button>

            {error ? <p className="form-error otp-error">{error}</p> : null}

            <button className="retry-button" type="button" onClick={handleRetryOtp}>
              Didn&apos;t receive it?{" "}
              {retrySeconds > 0 ? `Retry in ${retrySeconds} sec` : "Retry now"}
            </button>
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
