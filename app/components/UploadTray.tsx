"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { removeTrayItem } from "../store/uploadTraySlice";
import "./UploadTray.css";

const HIDE_TRAY_PATHS: string[] = [];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getStatusLabel(status: string) {
  if (status === "complete") return "Uploaded";
  if (status === "error") return "Failed";
  if (status === "review") return "Review";
  if (status === "uploading") return "Uploading";
  return "Queued";
}

export function UploadTray() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { items, dismissed } = useAppSelector((s) => s.uploadTray);
  const [minimized, setMinimized] = useState(false);

  const currentClientId = searchParams.get("clientId") ?? searchParams.get("client_id");
  const visibleItems = useMemo(
    () => pathname === "/client" && currentClientId
      ? items.filter((item) => item.clientId && String(item.clientId) === currentClientId)
      : [],
    [currentClientId, items, pathname],
  );
  const visibleItemIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);

  const allDone = visibleItems.length > 0 && visibleItems.every(
    (item) => item.status === "complete" || item.status === "error" || item.status === "review",
  );
  const allSucceeded = visibleItems.length > 0 && visibleItems.every((item) => item.status === "complete");
  const onUploadPage = HIDE_TRAY_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (!allSucceeded || onUploadPage) return;
    const timer = setTimeout(() => {
      for (const itemId of visibleItemIds) {
        dispatch(removeTrayItem(itemId));
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [allSucceeded, onUploadPage, dispatch, visibleItemIds]);

  if (onUploadPage || dismissed || visibleItems.length === 0) return null;

  const successCount = visibleItems.filter((i) => i.status === "complete").length;
  const failedCount = visibleItems.filter((i) => i.status === "error").length;
  const reviewCount = visibleItems.filter((i) => i.status === "review").length;
  const uploading = !allDone;

  let title = "Uploading…";
  if (allDone) {
    if (reviewCount > 0 && failedCount > 0) title = "Upload complete with review and errors";
    else if (reviewCount > 0) title = "Upload complete with review needed";
    else if (failedCount > 0 && successCount === 0) title = "Upload failed";
    else if (failedCount > 0) title = "Upload complete with errors";
    else title = "Uploads complete";
  }

  let subtitle = "";
  if (allDone) {
    const parts: string[] = [];
    if (successCount > 0) parts.push(`${successCount} uploaded`);
    if (reviewCount > 0) parts.push(`${reviewCount} need review`);
    if (failedCount > 0) parts.push(`${failedCount} failed`);
    subtitle = parts.join(", ");
  } else {
    const activeCount = visibleItems.filter((i) => i.status === "uploading" || i.status === "queued").length;
    subtitle = `${activeCount} file${activeCount !== 1 ? "s" : ""} in progress`;
  }

  return (
    <div className="docs-upload-panel upload-tray-float">
      {/* Header */}
      <div className="docs-upload-panel-header" onClick={() => setMinimized(!minimized)} style={{ cursor: "pointer" }}>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            className="docs-upload-panel-close"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(!minimized);
            }}
            aria-label={minimized ? "Expand" : "Minimize"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ transform: minimized ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <path d="M5 7L9 11L13 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="docs-upload-panel-close"
            onClick={(e) => {
              e.stopPropagation();
              for (const item of visibleItems) {
                dispatch(removeTrayItem(item.id));
              }
            }}
            disabled={!allDone}
            aria-label="Close"
            style={{ opacity: allDone ? 1 : 0.3, cursor: allDone ? "pointer" : "not-allowed" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5L13 13M13 5L5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Items */}
      {!minimized && (
        <div className="docs-upload-list">
          {visibleItems.map((item) => (
            <div className="docs-upload-row" key={item.id}>
              <div className="docs-upload-file">
                <span className={`docs-upload-status is-${item.status}`} />
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.status === "error" || item.status === "review"
                      ? (item.error || item.detail || formatFileSize(item.size))
                      : (item.detail || formatFileSize(item.size))}
                  </span>
                </div>
              </div>
              <span className="docs-upload-state">{getStatusLabel(item.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
