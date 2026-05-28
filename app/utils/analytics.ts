"use client";

import { useEffect } from "react";
import useAnalytics from "@/app/hooks/useAnalytics";

export default function Analytics({ children }: { children: React.ReactNode }) {
  const { initialize } = useAnalytics();

  useEffect(() => {
    initialize();
  }, []);

  return <>{children}</>;
}
