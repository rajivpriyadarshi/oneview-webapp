"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UNAUTHORIZED_EVENT } from "../lib/apiClient";

export function AuthEvents() {
  const router = useRouter();

  useEffect(() => {
    function handleUnauthorized() {
      router.replace("/");
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [router]);

  return null;
}
