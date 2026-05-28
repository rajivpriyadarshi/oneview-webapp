"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand, ZincBrand } from "./BrandMarks";
import { useGetProfileQuery, useUpdateProfileMutation } from "../store/api";
import { api } from "../store/api";
import { store } from "../store/store";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";
import type { Profile } from "../lib/realAuthApi";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";

export function ProfileSetup() {
  const router = useRouter();
  const { trackPage, trackClick, trackAPI } = useAnalytics();
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { data: profile, isError: profileError } = useGetProfileQuery(undefined, {
    skip: !getStoredAuthToken(),
  });
  const [updateProfile] = useUpdateProfileMutation();

  // Track page load
  useEffect(() => {
    trackPage({
      pageName: trackingEventsMap.profileSetupPage.PAGE,
      params: {
        page_url: window.location.href,
        page_title: document.title,
      },
    });
  }, []);

  useEffect(() => {
    const token = getStoredAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    if (profileError) {
      clearAuthToken();
      router.replace("/");
      return;
    }

    if (!profile) return;

    getPostProfileRoute(profile).then((route) => {
      if (route !== "/profile/setup") {
        router.replace(route);
      }
    });
  }, [router, profile, profileError]);

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

    trackClick({
      buttonName: trackingEventsMap.profileSetupPage.CLICK_PROCEED,
      pageName: trackingEventsMap.profileSetupPage.PAGE,
      params: {
        name_length: trimmedName.length,
      },
    });

    setIsSubmitting(true);

    try {
      const updatedProfile = await updateProfile({ name: trimmedName }).unwrap();

      trackAPI({
        pageName: trackingEventsMap.profileSetupPage.PAGE,
        params: {
          event_name: trackingEventsMap.profileSetupPage.API_UPDATE_PROFILE_SUCCESS,
          name_length: trimmedName.length,
        },
      });

      router.replace(await getPostProfileRoute(updatedProfile));
    } catch (requestError) {
      trackAPI({
        pageName: trackingEventsMap.profileSetupPage.PAGE,
        params: {
          event_name: trackingEventsMap.profileSetupPage.API_UPDATE_PROFILE_FAILURE,
          error: requestError instanceof Error ? requestError.message : "Unable to save your name.",
        },
      });

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
              name="name"
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

async function getPostProfileRoute(profile: Profile): Promise<string> {
  const emailPrefix = profile.email.split("@")[0];
  const displayName = profile.name?.trim();

  if (!displayName || displayName === emailPrefix) {
    return "/profile/setup";
  }

  const portfoliosResult = await store.dispatch(api.endpoints.listPortfolios.initiate(undefined, { forceRefetch: true }));
  const portfolios = portfoliosResult.data ?? [];

  return portfolios.length === 0 ? "/onboarding/documents" : "/dashboard";
}
