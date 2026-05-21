"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand } from "./BrandMarks";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";
import {
  getCurrentUser,
  isApiUnauthorized,
  mockProtectedModuleRequest,
} from "../lib/mockAuthApi";

type User = {
  email: string;
  name: string;
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

    getCurrentUser(token)
      .then((currentUser) => {
        setUser(currentUser);
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
    const token = getStoredAuthToken();

    try {
      await mockProtectedModuleRequest(token, { forceUnauthorized: true });
    } catch (error) {
      if (isApiUnauthorized(error)) {
        clearAuthToken();
        router.replace("/");
        return;
      }

      setStatus(error instanceof Error ? error.message : "Request failed");
    }
  }

  function handleSignOut() {
    clearAuthToken();
    router.replace("/");
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
            ? `${user.name} is logged in as ${user.email}.`
            : "Loading the logged in user..."}
        </p>
        <button type="button" onClick={handleMock401}>
          Simulate 401 redirect
        </button>
      </section>
    </main>
  );
}
