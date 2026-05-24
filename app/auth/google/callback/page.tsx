"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GoogleAuthCallbackPage() {
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
