"use client";

import { CSSProperties, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { dismissTray, removeTrayItem } from "../store/uploadTraySlice";

const HIDE_TRAY_PATHS = ["/documents-vault", "/onboarding/documents", "/onboarding/processing"];

export function UploadTray() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const { items, dismissed } = useAppSelector((s) => s.uploadTray);

  const allDone = items.length > 0 && items.every(
    (item) => item.status === "complete" || item.status === "error" || item.status === "review",
  );
  const allSucceeded = items.length > 0 && items.every((item) => item.status === "complete");
  const onUploadPage = HIDE_TRAY_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (!allSucceeded || onUploadPage) return;
    const timer = setTimeout(() => dispatch(dismissTray()), 3000);
    return () => clearTimeout(timer);
  }, [allSucceeded, onUploadPage, dispatch]);
  if (onUploadPage || dismissed || items.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        width: 340,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderRadius: 20,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 10px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-satoshi), Arial, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.28px",
            color: "#000",
          }}
        >
          {allDone ? "Uploads complete" : "Uploading…"}
        </span>
        {allDone && (
          <button
            type="button"
            onClick={() => dispatch(dismissTray())}
            aria-label="Close"
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              color: "rgba(0,0,0,0.5)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11.333 4.667L4.667 11.333M4.667 4.667L11.333 11.333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 12px 12px" }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 8px",
              borderRadius: 14,
              background: "rgba(0,0,0,0.025)",
            }}
          >
            <div
              className={[
                "statement-file-loader",
                item.status === "queued" ? "is-queued" : "",
                item.status === "uploading" ? "is-uploading" : "",
                item.status === "complete" ? "is-uploaded" : "",
                item.status === "review" ? "is-review" : "",
                item.status === "error" ? "is-error" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--upload-progress": `${item.progress}%` } as CSSProperties}
            >
              {item.status === "complete" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : item.status === "review" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.0784 19.0784L16.25 16.25M19.0784 4.99994L16.25 7.82837M4.92157 19.0784L7.75 16.25M4.92157 4.99994L7.75 7.82837" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : item.status === "error" ? (
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                  <path d="M8 4V8M8 10.6667V12M14.6667 8C14.6667 11.6819 11.6819 14.6667 8 14.6667C4.3181 14.6667 1.33333 11.6819 1.33333 8C1.33333 4.3181 4.3181 1.33333 8 1.33333C11.6819 1.33333 14.6667 4.3181 14.6667 8Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span
                style={{
                  fontFamily: "var(--font-satoshi), Arial, sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "-0.26px",
                  color: "#000",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.name}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-satoshi), Arial, sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "-0.24px",
                  color: "rgba(0,0,0,0.45)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.status === "complete"
                  ? (item.detail ?? formatFileSize(item.size))
                  : item.status === "error" || item.status === "review"
                    ? item.error
                    : (item.detail ?? formatFileSize(item.size))}
              </span>
            </div>

            {(item.status === "complete" || item.status === "error" || item.status === "review") && (
              <button
                type="button"
                onClick={() => dispatch(removeTrayItem(item.id))}
                aria-label="Dismiss"
                style={{
                  flexShrink: 0,
                  border: "none",
                  background: "rgba(0,0,0,0.05)",
                  cursor: "pointer",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(0,0,0,0.5)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M11.333 4.667L4.667 11.333M4.667 4.667L11.333 11.333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
