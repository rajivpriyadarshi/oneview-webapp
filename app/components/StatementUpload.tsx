"use client";

import { ChangeEvent, CSSProperties, DragEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand } from "./BrandMarks";
import { DownloadInstructionModal } from "./DownloadInstructionModal";
import { OneviewInfoModal } from "./OneviewInfoModal";
import {
  api,
  useUploadBrokerStatementMutation,
  useLazyGetBrokerStatementJobStatusQuery,
  useListPortfoliosQuery,
  useGetProfileQuery,
  useDeleteDocumentMutation,
} from "../store/api";
import { useAppDispatch } from "../store/hooks";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";
import { pollBrokerStatementJobStatus } from "../lib/documentsApi";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".pdf"];

const CHART_COLORS = [
  "#FE5D26", "#388DE8", "#CE8016", "#6438E8", "#59886B",
  "#444444", "#FFC75F", "#9EDE73", "#184D47", "#D2DB20",
  "#939191", "#76FDB0", "#2F2B2C", "#FFB2FC", "#B0EDFF",
  "#A3A1FB", "#7A2783", "#F46396"
];

type UploadStatus = "queued" | "uploading" | "complete" | "error";

type UploadItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number;
  detail?: string;
  error?: string;
  documentId?: string;
};

export function StatementUpload() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { trackPage, trackClick, trackAPI } = useAnalytics();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pollingAbortControllerRef = useRef<AbortController | null>(null);
  const [firstName, setFirstName] = useState("there");
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [hasStartedUploadFlow, setHasStartedUploadFlow] = useState(false);

  const hasCompletedUploads = uploadItems.some(item => item.status === "complete");
  const hasAnyUploads = uploadItems.length > 0;

  const { data: profile, isError: profileError } = useGetProfileQuery(undefined, {
    skip: !getStoredAuthToken(),
  });
  const { data: portfolios } = useListPortfoliosQuery(undefined, {
    skip: !profile,
  });

  const [uploadBrokerStatement] = useUploadBrokerStatementMutation();
  const [getBrokerStatementJobStatus] = useLazyGetBrokerStatementJobStatusQuery();
  const [deleteDocument] = useDeleteDocumentMutation();

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      router.replace("/");
      return;
    }

    if (profileError) {
      clearAuthToken();
      router.replace("/");
      return;
    }

    if (!profile) return;

    const emailPrefix = profile.email.split("@")[0];
    const displayName = profile.display_name?.trim();

    if (!displayName || displayName === emailPrefix) {
      router.replace("/profile/setup");
      return;
    }

    if (!hasStartedUploadFlow && portfolios && portfolios.length > 0) {
      router.replace("/dashboard");
      return;
    }

    setFirstName(displayName.split(/\s+/)[0]);
  }, [router, profile, profileError, portfolios, hasStartedUploadFlow]);

  // Track page load
  useEffect(() => {
    trackPage({
      pageName: trackingEventsMap.documentsPage.PAGE,
      params: {
        page_url: window.location.href,
        page_title: document.title,
      },
    });
  }, []);

  useEffect(() => {
    return () => {
      pollingAbortControllerRef.current?.abort();
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (files.length > 0) {
      void handleUploadFiles(files);
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    const files = Array.from(event.dataTransfer.files);

    if (files.length > 0) {
      trackClick({
        buttonName: trackingEventsMap.documentsPage.DROP_FILES,
        pageName: trackingEventsMap.documentsPage.PAGE,
        params: {
          files_count: files.length,
        },
      });
      void handleUploadFiles(files);
    }
  }

  function validateFile(file: File): string {
    const lowerName = file.name.toLowerCase();
    const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((extension) =>
      lowerName.endsWith(extension),
    );

    if (!hasSupportedExtension) {
      return "Only CSV, XLSX, or PDF files are supported.";
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return "File size must be 10 MB or less.";
    }

    return "";
  }

  async function handleUploadFiles(files: File[]) {
    setError("");
    setMessage("");
    setHasStartedUploadFlow(true);

    const preparedItems: UploadItem[] = files.map((file, index) => {
      const validationError = validateFile(file);

      trackClick({
        buttonName: trackingEventsMap.documentsPage.CLICK_UPLOAD_STATEMENT,
        pageName: trackingEventsMap.documentsPage.PAGE,
        params: {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        },
      });

      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        name: file.name,
        size: file.size,
        status: validationError ? "error" : "queued",
        progress: 0,
        error: validationError,
      };
    });

    const validUploads = preparedItems.filter(item => item.status !== "error");

    setUploadItems(prev => [...prev, ...preparedItems]);

    if (validUploads.length === 0) {
      setError("No supported files selected.");
      return;
    }

    setIsUploading(true);

    try {
      let successCount = 0;

      for (const item of validUploads) {
        updateUploadItem(item.id, { status: "uploading", progress: 0 });
        startProgressAnimation(item.id);

        trackAPI({
          pageName: trackingEventsMap.documentsPage.PAGE,
          params: {
            event_name: trackingEventsMap.documentsPage.API_UPLOAD_FILE_START,
            file_name: item.file.name,
            file_size: item.file.size,
            file_type: item.file.type,
          },
        });

        try {
          const response = await uploadBrokerStatement({
            file: item.file,
            name: item.file.name,
            storeData: true,
            portfolioName: "Main Portfolio",
            useLlmFallback: true,
          }).unwrap();

          if (response.status === "duplicate") {
            const uploadDate = new Date(response.uploaded_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            trackAPI({
              pageName: trackingEventsMap.documentsPage.PAGE,
              params: {
                event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
                error: "duplicate",
                file_name: item.file.name,
                existing_document_id: response.existing_document_id,
              },
            });
            updateUploadItem(item.id, {
              status: "error",
              progress: 0,
              error: `This file was already uploaded on ${uploadDate}.`,
            });
          } else if (response.status === "error") {
            trackAPI({
              pageName: trackingEventsMap.documentsPage.PAGE,
              params: {
                event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
                file_name: item.file.name,
                error: response.error,
              },
            });
            updateUploadItem(item.id, {
              status: "error",
              progress: 0,
              error: response.error ?? "Unable to parse this statement.",
            });
          } else if (response.status === "processing") {
            updateUploadItem(item.id, {
              status: "uploading",
              progress: 90,
              detail: response.message ?? "Extracting statement details.",
            });

            const abortController = new AbortController();
            pollingAbortControllerRef.current = abortController;

            try {
              const jobResult = await pollBrokerStatementJobStatus({
                jobId: response.job_id,
                signal: abortController.signal,
                getStatus: (jobId) => getBrokerStatementJobStatus(jobId, false).unwrap(),
                onProgress: (progress) => {
                  if (
                    typeof progress?.current === "number" &&
                    typeof progress.total === "number" &&
                    progress.total > 0
                  ) {
                    const pct = Math.min(
                      95,
                      Math.max(10, Math.round((progress.current / progress.total) * 95)),
                    );
                    updateUploadItem(item.id, {
                      progress: pct,
                      detail: progress.label ?? "Extracting statement details.",
                    });
                    return;
                  }

                  updateUploadItem(item.id, {
                    detail: progress?.label ?? "Extracting statement details.",
                  });
                },
              });

              if (jobResult.status === "error") {
                trackAPI({
                  pageName: trackingEventsMap.documentsPage.PAGE,
                  params: {
                    event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
                    error: jobResult.error,
                    file_name: item.file.name,
                    job_id: response.job_id,
                  },
                });
                updateUploadItem(item.id, {
                  status: "error",
                  progress: 0,
                  detail: undefined,
                  error: jobResult.error ?? "Unable to process this statement.",
                });
              } else if (jobResult.status === "needs_review") {
                trackAPI({
                  pageName: trackingEventsMap.documentsPage.PAGE,
                  params: {
                    event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
                    error: jobResult.message,
                    file_name: item.file.name,
                    job_id: response.job_id,
                    status: "needs_review",
                  },
                });
                updateUploadItem(item.id, {
                  status: "error",
                  progress: 0,
                  detail: undefined,
                  error: jobResult.message ?? "Extraction complete but requires human review.",
                });
              } else {
                successCount += 1;
                dispatch(
                  api.util.invalidateTags([
                    "Documents",
                    "Portfolios",
                    "PortfolioView",
                    "Sankey",
                  ]),
                );
                trackAPI({
                  pageName: trackingEventsMap.documentsPage.PAGE,
                  params: {
                    event_name: trackingEventsMap.documentsPage.API_UPLOAD_SUCCESS,
                    document_id: jobResult.document_id,
                    positions_count: jobResult.positions_count,
                    file_name: item.file.name,
                    job_id: response.job_id,
                  },
                });
                if (jobResult.storage?.overwrote_existing) {
                  setMessage(
                    `Updated ${jobResult.storage.positions_updated} existing positions for this statement date.`,
                  );
                }
                updateUploadItem(item.id, {
                  status: "complete",
                  progress: 100,
                  detail: getUploadCompleteDetail(jobResult.positions_count, item.size),
                  documentId: String(jobResult.document_id),
                });
              }
            } finally {
              pollingAbortControllerRef.current = null;
            }
          } else {
            successCount += 1;
            trackAPI({
              pageName: trackingEventsMap.documentsPage.PAGE,
              params: {
                event_name: trackingEventsMap.documentsPage.API_UPLOAD_SUCCESS,
                file_name: item.file.name,
                document_id: response.document_id,
                positions_count: response.positions_count,
              },
            });
            updateUploadItem(item.id, {
              status: "complete",
              progress: 100,
              detail: getUploadCompleteDetail(response.positions_count, item.size),
              documentId: String(response.document_id),
            });
          }
        } catch (uploadError) {
          trackAPI({
            pageName: trackingEventsMap.documentsPage.PAGE,
            params: {
              event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
              file_name: item.file.name,
              error: uploadError instanceof Error ? uploadError.message : "Upload failed",
            },
          });
          updateUploadItem(item.id, {
            status: "error",
            progress: 0,
            detail: undefined,
            error: uploadError instanceof Error ? uploadError.message : "Upload failed.",
          });
        }
      }

      if (successCount > 0) {
        setMessage(`Uploaded ${successCount} file${successCount > 1 ? "s" : ""} successfully.`);
      }
    } finally {
      setIsUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function updateUploadItem(id: string, patch: Partial<UploadItem>) {
    setUploadItems(items =>
      items.map(item => item.id === id ? { ...item, ...patch } : item)
    );
  }

  function startProgressAnimation(itemId: string) {
    const interval = setInterval(() => {
      setUploadItems(items =>
        items.map(item => {
          if (item.id === itemId && item.status === "uploading" && item.progress < 90) {
            return { ...item, progress: Math.min(item.progress + 5, 90) };
          }
          return item;
        })
      );
    }, 200);

    setTimeout(() => clearInterval(interval), 20000);
  }

  async function removeUploadItem(itemId: string) {
    const item = uploadItems.find(i => i.id === itemId);
    if (!item) return;

    trackClick({
      buttonName: trackingEventsMap.documentsPage.CLICK_REMOVE_DOCUMENT,
      pageName: trackingEventsMap.documentsPage.PAGE,
      params: {
        document_id: item.documentId,
        file_name: item.name,
      },
    });

    if (item.status === "uploading") {
      pollingAbortControllerRef.current?.abort();
    }

    // Delete the uploaded document if it exists
    if (item.documentId && item.status === "complete") {
      try {
        await deleteDocument(item.documentId).unwrap();
        trackAPI({
          pageName: trackingEventsMap.documentsPage.PAGE,
          params: {
            event_name: trackingEventsMap.documentsPage.API_DELETE_SUCCESS,
            document_id: item.documentId,
          },
        });
      } catch (err) {
        console.error("Failed to delete document:", err);
        trackAPI({
          pageName: trackingEventsMap.documentsPage.PAGE,
          params: {
            event_name: trackingEventsMap.documentsPage.API_DELETE_FAILURE,
            document_id: item.documentId,
            error: err instanceof Error ? err.message : "Delete failed",
          },
        });
      }
    }

    setUploadItems(items => items.filter(i => i.id !== itemId));
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0]?.toUpperCase() || "U";
  };

  const getColorFromName = (name: string) => {
    const asciiSum = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return CHART_COLORS[asciiSum % CHART_COLORS.length];
  };

  const displayName = profile?.display_name || "";
  const initials = displayName ? getInitials(displayName) : "U";
  const avatarColor = displayName ? getColorFromName(displayName) : CHART_COLORS[0];

  return (
    <main className="statement-page">
      <header className="statement-topbar">
        <OneviewBrand />
        <div className="statement-profile">
          <button
            className="statement-avatar-btn"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="Profile menu"
          >
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="22" fill={avatarColor} />
              <text
                x="22"
                y="22"
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fill: "#FFF",
                  fontFamily: "Inter",
                  fontSize: "16px",
                  fontWeight: 600,
                  letterSpacing: "-0.64px",
                }}
              >
                {initials}
              </text>
            </svg>
          </button>
          {showProfileMenu && (
            <>
              <div className="profile-menu-backdrop" onClick={() => setShowProfileMenu(false)} />
              <div className="profile-menu-dropdown">
                <button
                  className="profile-menu-item"
                  onClick={() => {
                    clearAuthToken();
                    router.push("/");
                  }}
                >
                  <LogoutIcon />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <section className="statement-content" aria-labelledby="statement-title">
        <div className="statement-grid">
          {/* Left Column */}
          <div className="statement-left">
            <div className="statement-title-wrapper">
              <p className="statement-welcome">Welcome {firstName}!</p>
              <h1 id="statement-title" className="statement-title-desktop">
                Add your account statements
                <br />
                to create your unified view
              </h1>
            </div>

            <div className="statement-brokers">              
              <div className="broker-icons">
                <img src="/broker-icons/groww.png" alt="Groww" className="broker-icon" />
                <img src="/broker-icons/fidelity.png" alt="Fidelity" className="broker-icon" />
                <img src="/broker-icons/zerodha.png" alt="Zerodha" className="broker-icon" />
                <img src="/broker-icons/vested.png" alt="Vested" className="broker-icon" />
                <img src="/broker-icons/shwab.png" alt="Charles Schwab" className="broker-icon" />
                <img src="/broker-icons/ibkr.png" alt="IBKR" className="broker-icon" />
              </div>
              <span className="brokers-text">and any CSV format</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  trackClick({
                    buttonName: trackingEventsMap.documentsPage.CLICK_DOWNLOAD_INSTRUCTIONS,
                    pageName: trackingEventsMap.documentsPage.PAGE,
                  });
                  setIsModalOpen(true);
                }}
                className="download-instruction"
              >
                See download instruction
              </button>
            </div>

            <div className="statement-cta-group">
              <button
                className="statement-submit"
                type="button"
                onClick={hasCompletedUploads ? () => {
                  trackClick({
                    buttonName: trackingEventsMap.documentsPage.CLICK_SEE_ONEVIEW,
                    pageName: trackingEventsMap.documentsPage.PAGE,
                  });
                  router.replace("/onboarding/processing");
                } : undefined}
                disabled={!hasCompletedUploads || isUploading}
                aria-busy={isUploading}
              >
                See your unified view
                <ArrowRightIcon />
              </button>
              <button
                className="statement-sample-btn"
                type="button"
                onClick={() => {
                  trackClick({
                    buttonName: trackingEventsMap.documentsPage.CLICK_CHECK_SAMPLE,
                    pageName: trackingEventsMap.documentsPage.PAGE,
                  });
                  setIsSampleModalOpen(true);
                }}
              >
                Check sample
              </button>
            </div>
          </div>

          {/* Right Column */}
          <div className="statement-right">
            <p className="statement-security-top">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1.33334L2.66667 3.33334V7.33334C2.66667 10.6667 5.33333 13.6667 8 14.6667C10.6667 13.6667 13.3333 10.6667 13.3333 7.33334V3.33334L8 1.33334Z" stroke="#4CAF50" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 8L7.33333 9.33333L10 6.66667" stroke="#4CAF50" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Your data stays encrypted • 100% Safe and Secure
            </p>

            <label
              className={`statement-dropzone${isDragging ? " is-dragging" : ""}${isUploading ? " is-disabled" : ""}`}
              onDragOver={isUploading ? undefined : handleDragOver}
              onDragLeave={isUploading ? undefined : handleDragLeave}
              onDrop={isUploading ? undefined : handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.pdf"
                multiple
                onChange={handleFileChange}
                disabled={isUploading}
              />
              <span className="upload-icon">
                <UploadIcon />
              </span>
              <strong>Drop your statements here or <span className="select-files-text">select files</span></strong>
              <span>CSV, XLSX, PDF (Max 10MB)</span>
            </label>

            {uploadItems.length > 0 && (
              <div className="statement-uploads-list">
                {uploadItems.map((item) => (
                  <div key={item.id} className="statement-file-loading" aria-live="polite">
                    <div
                      className={`statement-file-loader${item.status === "uploading" ? " is-uploading" : ""}${item.status === "complete" ? " is-uploaded" : ""}${item.status === "error" ? " is-error" : ""}`}
                      style={{ "--upload-progress": `${item.progress}%` } as CSSProperties}
                    >
                      {item.status === "complete" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M13.3327 4L5.99935 11.3333L2.66602 8" stroke="white" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : item.status === "error" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M8 4V8M8 10.6667V12M14.6667 8C14.6667 11.6819 11.6819 14.6667 8 14.6667C4.3181 14.6667 1.33333 11.6819 1.33333 8C1.33333 4.3181 4.3181 1.33333 8 1.33333C11.6819 1.33333 14.6667 4.3181 14.6667 8Z" stroke="#DC2626" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <span />
                      )}
                    </div>
                    <div className="statement-file-meta">
                      <strong>{item.name}</strong>
                      <span>
                        {item.status === "complete"
                          ? item.detail ?? formatFileSize(item.size)
                          : item.status === "error"
                            ? item.error
                            : item.detail ?? formatFileSize(item.size)
                        }
                      </span>
                    </div>
                    <button
                      type="button"
                      className="statement-file-remove"
                      onClick={() => removeUploadItem(item.id)}
                      aria-label="Remove selected file"
                      disabled={isUploading && item.status === "uploading"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M7.33268 0.666016L0.666016 7.33268M0.666016 0.666016L7.33268 7.33268" stroke="black" strokeOpacity="0.7" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error ? <p className="statement-error">{error}</p> : null}
            {message ? <p className="statement-success">{message}</p> : null}
          </div>
        </div>
      </section>

      <DownloadInstructionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <OneviewInfoModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
      />
    </main>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" width="16" height="16">
      <path
        d="M12.333 12.333L15.666 9m0 0L12.333 5.667M15.666 9H6.333M6.333 2.333H5.2c-1.12 0-1.68 0-2.108.218a2 2 0 00-.874.874c-.218.428-.218.988-.218 2.108v7.934c0 1.12 0 1.68.218 2.108a2 2 0 00.874.874c.428.218.988.218 2.108.218h1.133"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14.9997 2.14258H2.14258M4.28544 9.28544L8.57115 4.99972L12.8569 9.28544M8.57115 4.99972V14.9997" stroke="black" strokeOpacity="0.7" strokeWidth="1.42857" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function getUploadCompleteDetail(positionsCount: number | undefined, size: number) {
  if (typeof positionsCount !== "number") {
    return formatFileSize(size);
  }

  return `${positionsCount} holding${positionsCount === 1 ? "" : "s"} • ${formatFileSize(size)}`;
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const data = "data" in error ? (error as { data?: unknown }).data : error;

    if (data && typeof data === "object") {
      for (const key of ["error", "message", "detail"]) {
        const value = (data as Record<string, unknown>)[key];

        if (typeof value === "string" && value) {
          return value;
        }
      }
    }

    if (typeof data === "string" && data) {
      return data;
    }
  }

  return fallback;
}
