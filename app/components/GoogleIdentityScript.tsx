"use client";

import { useEffect } from "react";

interface GoogleIdentityScriptProps {
  onLoad?: () => void;
}

export function GoogleIdentityScript({ onLoad }: GoogleIdentityScriptProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
      if (onLoad && window.google?.accounts?.id) {
        onLoad();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (onLoad) {
        onLoad();
      }
    };

    document.head.appendChild(script);

    return () => {
      const scriptElement = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (scriptElement) {
        scriptElement.remove();
      }
    };
  }, [onLoad]);

  return null;
}
