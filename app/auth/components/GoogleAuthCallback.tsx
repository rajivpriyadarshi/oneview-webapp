"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function GoogleAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth");
  }, [router]);

  return (
    <main className="auth-callback-page">
      <p>Redirecting to sign in...</p>
    </main>
  );
}
