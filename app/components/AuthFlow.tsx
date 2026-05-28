"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand, ZincBrand } from "./BrandMarks";
import {
  GoogleAuthCallbackHandler,
  initializeGoogleAuth,
  renderGoogleButton,
} from "../lib/authApi";
import {
  useAuthenticateWithGoogleMutation,
  useSendPasswordlessOtpMutation,
  useVerifyPasswordlessOtpMutation,
  useResendPasswordlessOtpMutation,
} from "../store/api";
import { api } from "../store/api";
import { store } from "../store/store";
import { clearAuthToken, getStoredAuthToken, storeAuthToken } from "../lib/session";
import { GoogleIdentityScript } from "./GoogleIdentityScript";
import type { Profile } from "../lib/realAuthApi";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";

export function AuthFlow() {
  const router = useRouter();
  const { trackPage, trackClick, trackAPI, trackUserAttributes } = useAnalytics();
  const [step, setStep] = useState<"login" | "otp">("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const hiddenGoogleButtonRef = useRef<HTMLDivElement>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [authenticateWithGoogle] = useAuthenticateWithGoogleMutation();
  const [sendPasswordlessOtp] = useSendPasswordlessOtpMutation();
  const [verifyPasswordlessOtp] = useVerifyPasswordlessOtpMutation();
  const [resendPasswordlessOtp] = useResendPasswordlessOtpMutation();

  // Track page load
  useEffect(() => {
    const pageName = step === "login" ? trackingEventsMap.authPage.PAGE : trackingEventsMap.otpPage.PAGE;
    trackPage({
      pageName,
      params: {
        page_url: window.location.href,
        page_title: document.title,
      },
    });
  }, [step]);

  useEffect(() => {
    clearAuthToken();
    store.dispatch(api.util.resetApiState());
  }, []);

  useEffect(() => {
    if (!isGoogleLoaded || !hiddenGoogleButtonRef.current) {
      return;
    }

    try {
      const handleGoogleCallback: GoogleAuthCallbackHandler = async (response) => {
        setError("");
        setIsSubmitting(true);

        try {
          const session = await authenticateWithGoogle({ id_token: response.credential }).unwrap();
          storeAuthToken(session.token);
          await routeByProfile();
        } catch (requestError) {
          setError(getErrorMessage(requestError));
        } finally {
          setIsSubmitting(false);
        }
      };

      initializeGoogleAuth(handleGoogleCallback);
      renderGoogleButton(hiddenGoogleButtonRef.current);
    } catch (err) {
      console.error("Failed to initialize Google Auth:", err);
    }
  }, [isGoogleLoaded, router]);

  useEffect(() => {
    if (step !== "otp" || resendCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldown((currentCooldown) => Math.max(currentCooldown - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown, step]);

  useEffect(() => {
    if (step === "otp") {
      otpInputRefs.current[0]?.focus();
    }
  }, [step]);

  function handleGoogleSubmit() {
    trackClick({
      buttonName: trackingEventsMap.authPage.CLICK_GOOGLE_SIGNIN,
      pageName: trackingEventsMap.authPage.PAGE,
    });

    if (!hiddenGoogleButtonRef.current) {
      return;
    }

    const googleButton = hiddenGoogleButtonRef.current.querySelector('div[role="button"]') as HTMLElement;
    if (googleButton) {
      googleButton.click();
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    trackClick({
      buttonName: trackingEventsMap.authPage.CLICK_EMAIL_CONTINUE,
      pageName: trackingEventsMap.authPage.PAGE,
      params: { email },
    });

    try {
      const normalizedEmail = email.trim();
      validateEmail(normalizedEmail);
      await sendPasswordlessOtp({ email: normalizedEmail }).unwrap();

      trackAPI({
        pageName: trackingEventsMap.authPage.PAGE,
        params: {
          event_name: trackingEventsMap.authPage.API_SEND_OTP_SUCCESS,
          email: normalizedEmail,
        },
      });

      setEmail(normalizedEmail);
      setOtp(Array(6).fill(""));
      setResendCooldown(60);
      setStep("otp");
    } catch (requestError) {
      trackAPI({
        pageName: trackingEventsMap.authPage.PAGE,
        params: {
          event_name: trackingEventsMap.authPage.API_SEND_OTP_FAILURE,
          error: getErrorMessage(requestError),
        },
      });
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }


  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    trackClick({
      buttonName: trackingEventsMap.otpPage.CLICK_VERIFY_OTP,
      pageName: trackingEventsMap.otpPage.PAGE,
    });

    try {
      const otpCode = otp.join("");

      if (otpCode.length !== 6) {
        throw new Error("Enter the 6-digit code.");
      }

      const session = await verifyPasswordlessOtp({ email, otp: otpCode }).unwrap();

      trackAPI({
        pageName: trackingEventsMap.otpPage.PAGE,
        params: {
          event_name: trackingEventsMap.otpPage.API_VERIFY_OTP_SUCCESS,
          email,
        },
      });

      storeAuthToken(session.token);
      await routeByProfile();
    } catch (requestError) {
      trackAPI({
        pageName: trackingEventsMap.otpPage.PAGE,
        params: {
          event_name: trackingEventsMap.otpPage.API_VERIFY_OTP_FAILURE,
          error: getErrorMessage(requestError),
        },
      });
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDifferentEmail() {
    trackClick({
      buttonName: trackingEventsMap.otpPage.CLICK_DIFFERENT_EMAIL,
      pageName: trackingEventsMap.otpPage.PAGE,
    });

    setStep("login");
    setError("");
    setOtp(Array(6).fill(""));
    setResendCooldown(0);
  }

  function handleOtpChange(index: number, value: string) {
    const digits = value.replace(/\D/g, "");

    if (!digits) {
      setOtp((currentOtp) => {
        const nextOtp = [...currentOtp];
        nextOtp[index] = "";
        return nextOtp;
      });
      return;
    }

    setOtp((currentOtp) => {
      const nextOtp = [...currentOtp];
      digits
        .slice(0, 6 - index)
        .split("")
        .forEach((digit, offset) => {
          nextOtp[index + offset] = digit;
        });
      return nextOtp;
    });

    const nextIndex = Math.min(index + digits.length, 5);
    otpInputRefs.current[nextIndex]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pastedCode = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (!pastedCode) {
      return;
    }

    const nextOtp = Array(6).fill("");
    pastedCode.split("").forEach((digit, index) => {
      nextOtp[index] = digit;
    });
    setOtp(nextOtp);
    otpInputRefs.current[Math.min(pastedCode.length, 6) - 1]?.focus();
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || isSubmitting) {
      return;
    }

    trackClick({
      buttonName: trackingEventsMap.otpPage.CLICK_RESEND_OTP,
      pageName: trackingEventsMap.otpPage.PAGE,
    });

    setError("");
    setIsSubmitting(true);

    try {
      await resendPasswordlessOtp({ email }).unwrap();
      setOtp(Array(6).fill(""));
      setResendCooldown(60);
      otpInputRefs.current[0]?.focus();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function routeByProfile() {
    if (!getStoredAuthToken()) {
      store.dispatch(api.util.resetApiState());
      return;
    }

    try {
      const profileResult = await store.dispatch(api.endpoints.getProfile.initiate(undefined, { forceRefetch: true }));
      if (profileResult.error || !profileResult.data) {
        throw new Error("Failed to fetch profile");
      }
      const profile = profileResult.data;

      // Set user identity in Mixpanel
      trackUserAttributes({
        id: String(profile.id),
        email: profile.email,
        fullName: profile.display_name,
        username: profile.username,
        baseCurrency: profile.base_currency,
        timezone: profile.timezone,
        isActive: String(profile.is_active),
        mailerFrequency: profile.mailer_frequency,
        createdAt: profile.created_at,
      });

      router.replace(await getPostProfileRouteFromStore(profile));
    } catch {
      clearAuthToken();
      store.dispatch(api.util.resetApiState());
      router.replace("/");
    }
  }

  return (
    <>
      <GoogleIdentityScript onLoad={() => setIsGoogleLoaded(true)} />
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
                disabled={isSubmitting || !isGoogleLoaded}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>

              {/* Hidden Google button that gets programmatically clicked */}
              <div ref={hiddenGoogleButtonRef} style={{ display: 'none' }} />

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
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackClick({
                    buttonName: trackingEventsMap.authPage.CLICK_TERMS_OF_SERVICE,
                    pageName: trackingEventsMap.authPage.PAGE,
                  });
                }}
              >
                Terms
              </a> and
              acknowledge their <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackClick({
                    buttonName: trackingEventsMap.authPage.CLICK_PRIVACY_POLICY,
                    pageName: trackingEventsMap.authPage.PAGE,
                  });
                }}
              >
                Privacy Policy
              </a>.
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
              Please confirm your email by entering the OTP sent to your email address
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
                    otpInputRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={digit}
                  onChange={(event) => handleOtpChange(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={handleOtpPaste}
                  aria-label={`OTP digit ${index + 1}`}
                />
              ))}
            </div>

            <button
              className="continue-button otp-button"
              type="submit"
              disabled={isSubmitting || otp.join("").length !== 6}
            >
              Verify OTP
            </button>

            {error ? <p className="form-error otp-error">{error}</p> : null}

            <button
              type="button"
              className="retry-button"
              onClick={handleResendOtp}
              disabled={isSubmitting || resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Didn't receive it? Retry in ${resendCooldown} sec`
                : "Didn't receive it? Resend code"}
            </button>
          </form>
          <ZincBrand />
        </section>
      )}
      </main>
    </>
  );
}

async function getPostProfileRouteFromStore(profile: Profile): Promise<string> {
  const emailPrefix = profile.email.split("@")[0];
  const displayName = profile.display_name?.trim();

  if (!displayName || displayName === emailPrefix) {
    return "/profile/setup";
  }

  const portfoliosResult = await store.dispatch(api.endpoints.listPortfolios.initiate(undefined, { forceRefetch: true }));
  const portfolios = portfoliosResult.data ?? [];

  return portfolios.length === 0 ? "/onboarding/documents" : "/dashboard";
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
