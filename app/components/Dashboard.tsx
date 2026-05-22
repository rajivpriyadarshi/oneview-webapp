"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand } from "./BrandMarks";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";
import { isApiUnauthorized } from "../lib/apiClient";
import { getPostProfileRoute } from "../lib/postAuthRoute";
import { getProfile, logout } from "../lib/realAuthApi";

type User = {
  email: string;
  displayName: string;
};

export function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState("Checking session...");

  useEffect(() => {
    const token = getStoredAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    getProfile()
      .then(async (profile) => {
        const route = await getPostProfileRoute(profile);

        if (route !== "/dashboard") {
          router.replace(route);
          return;
        }

        setUser({
          email: profile.email,
          displayName: profile.display_name.trim(),
        });
        setStatus("Session active");
      })
      .catch((error) => {
        if (isApiUnauthorized(error)) {
          clearAuthToken();
          router.replace("/");
          return;
        }

        setStatus(error instanceof Error ? error.message : "Unable to load user");
      });
  }, [router]);

  async function handleMock401() {
    clearAuthToken();
    router.replace("/");
  }

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      clearAuthToken();
      router.replace("/");
    }
  }

  return (
    <main className="dashboard-page">
      <nav className="dashboard-nav">
        <OneviewBrand />
        <button type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </nav>

      <section className="dashboard-content">
        <p className="dashboard-kicker">{status}</p>
        <h1>Oneview framework is ready</h1>
        <p>
          {user
            ? `${user.displayName} is logged in as ${user.email}.`
            : "Loading the logged in user..."}
        </p>
        <button type="button" onClick={handleMock401}>
          Simulate 401 redirect
        </button>
      </section>
    </main>
  );
}
