"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand, ZincBrand } from "./BrandMarks";
import { getPostProfileRoute } from "../lib/postAuthRoute";
import { getProfile, updateProfile } from "../lib/realAuthApi";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";

export function ProfileSetup() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getStoredAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    getProfile()
      .then((profile) => getPostProfileRoute(profile))
      .then((route) => {
        if (route !== "/profile/setup") {
          router.replace(route);
        }
      })
      .catch(() => {
        clearAuthToken();
        router.replace("/");
      });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = displayName.trim();

    if (!trimmedName) {
      setError("Enter your name to continue.");
      return;
    }

    setIsSubmitting(true);

    try {
      const profile = await updateProfile({ display_name: trimmedName });
      router.replace(await getPostProfileRoute(profile));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save your name.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="auth-shell auth-shell-card" aria-labelledby="profile-title">
        <OneviewBrand />
        <form className="login-card account-card" onSubmit={handleSubmit}>
          <h1 id="profile-title">What&apos;s your name?</h1>

          <label className="field account-field">
            <span>Full name</span>
            <input
              type="text"
              name="display_name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              aria-label="Full name"
              required
            />
          </label>

          <button className="continue-button" type="submit" disabled={isSubmitting}>
            Continue
          </button>

          {error ? <p className="form-error">{error}</p> : null}
        </form>
        <ZincBrand />
      </section>
    </main>
  );
}
