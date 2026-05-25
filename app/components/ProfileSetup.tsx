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
      .then(async (profile) => {
        const route = await getPostProfileRoute(profile);
        if (route !== "/profile/setup") {
          router.replace(route);
        }
      })
      .catch(() => {
        clearAuthToken();
        router.replace("/");
      });
  }, [router]);

  function isNameValid(name: string): boolean {
    const trimmedName = name.trim();
    const nameWithoutSpaces = trimmedName.replace(/\s+/g, "");
    return nameWithoutSpaces.length >= 2;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = displayName.trim();

    if (!trimmedName) {
      setError("Enter your name to continue.");
      return;
    }

    if (!isNameValid(displayName)) {
      setError("Name must be at least 2 characters.");
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
      <section className="auth-shell profile-shell" aria-labelledby="profile-title">
        <OneviewBrand />
        <form className="profile-form" onSubmit={handleSubmit}>
          <h1 id="profile-title">What should we call you?</h1>

          <div className="profile-name-field">
            <input
              type="text"
              name="display_name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Enter your name"
              autoComplete="name"
              autoFocus
              aria-label="Name"
              required
            />
          </div>

          <button
            className="profile-continue-button"
            type="submit"
            disabled={isSubmitting || !isNameValid(displayName)}
          >
            {isSubmitting ? "Saving..." : "Proceed"}
          </button>

          {error ? <p className="form-error profile-error">{error}</p> : null}
        </form>
        <ZincBrand />
      </section>
    </main>
  );
}
