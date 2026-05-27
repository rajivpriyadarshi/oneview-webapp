"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuthToken } from "../lib/session";
import { useGetProfileQuery } from "../store/api";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hasToken] = useState(() => !!getStoredAuthToken());

  const { isSuccess, isError, isLoading } = useGetProfileQuery(undefined, {
    skip: !hasToken,
  });

  useEffect(() => {
    if (!hasToken || isError) {
      router.replace("/auth");
    }
  }, [hasToken, isError, router]);

  if (isLoading || !isSuccess) {
    return null;
  }

  return <>{children}</>;
}
