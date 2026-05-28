"use client";

import { useEffect, useState } from "react";

export function AnalyticsDebug() {
  const [status, setStatus] = useState({
    token: "Checking...",
    version: "Checking...",
    mixpanelLoaded: false,
    testEventSent: false,
  });

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
    const version = process.env.NEXT_PUBLIC_VERSION || "not set";
    const mixpanelLoaded = typeof window !== "undefined" && Boolean((window as any).mixpanel);

    setStatus({
      token: token ? "✅ SET" : "❌ MISSING",
      version: version,
      mixpanelLoaded,
      testEventSent: false,
    });

    console.log("=== MIXPANEL DEBUG INFO ===");
    console.log("Token set:", Boolean(token));
    console.log("App version:", version);
    console.log("Mixpanel loaded:", mixpanelLoaded);
    console.log("Mixpanel object:", (window as any).mixpanel);

    if (mixpanelLoaded && token) {
      console.log("Distinct ID:", (window as any).mixpanel?.get_distinct_id?.());

      // Send test event
      (window as any).mixpanel?.track("debug_test_event", {
        timestamp: Date.now(),
        source: "AnalyticsDebug component",
      });
      setStatus(prev => ({ ...prev, testEventSent: true }));
      console.log("Test event sent");
    } else {
      console.warn("Cannot send test event - Mixpanel not properly initialized");
    }
    console.log("=========================");
  }, []);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        right: 10,
        background: "rgba(0, 0, 0, 0.9)",
        color: "lime",
        padding: "12px",
        fontSize: "11px",
        fontFamily: "monospace",
        zIndex: 9999,
        borderRadius: "6px",
        border: "1px solid lime",
        maxWidth: "300px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "8px", color: "white" }}>
        📊 Analytics Debug
      </div>
      <div>Token: {status.token}</div>
      <div>Version: {status.version}</div>
      <div>Mixpanel: {status.mixpanelLoaded ? "✅ Loaded" : "❌ Not loaded"}</div>
      <div>Test Event: {status.testEventSent ? "✅ Sent" : "⏳ Pending"}</div>
      <div style={{ marginTop: "8px", fontSize: "10px", color: "#999" }}>
        Check browser console for details
      </div>
    </div>
  );
}
