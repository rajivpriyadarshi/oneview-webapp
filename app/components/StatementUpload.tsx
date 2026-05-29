"use client";

import { ChangeEvent, CSSProperties, DragEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand } from "./BrandMarks";
import { DownloadInstructionModal } from "./DownloadInstructionModal";
import { OneviewInfoModal } from "./OneviewInfoModal";
import {
  useUploadBrokerStatementMutation,
  useListPortfoliosQuery,
  useGetProfileQuery,
  useDeleteDocumentMutation,
} from "../store/api";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";
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

export function StatementUpload() {
  const router = useRouter();
  const { trackPage, trackClick, trackAPI } = useAnalytics();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadProgressTimerRef = useRef<number | null>(null);
  const uploadRequestRef = useRef<{ abort?: () => void } | null>(null);
  const [firstName, setFirstName] = useState("there");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUploadedStatement, setHasUploadedStatement] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [hasStartedUploadFlow, setHasStartedUploadFlow] = useState(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const showUploadProgress = isUploading || hasUploadedStatement;

  const { data: profile, isError: profileError } = useGetProfileQuery(undefined, {
    skip: !getStoredAuthToken(),
  });
  const { data: portfolios } = useListPortfoliosQuery(undefined, {
    skip: !profile,
  });

  const [uploadBrokerStatement] = useUploadBrokerStatementMutation();
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
      clearUploadProgressTimer();
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      selectFile(file);
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

    const file = event.dataTransfer.files?.[0];

    if (file) {
      selectFile(file);
    }
  }

  function selectFile(file: File) {
    trackClick({
      buttonName: trackingEventsMap.documentsPage.CLICK_UPLOAD_STATEMENT,
      pageName: trackingEventsMap.documentsPage.PAGE,
      params: {
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      },
    });

    setHasStartedUploadFlow(true);
    setError("");
    setMessage("");
    setHasUploadedStatement(false);
    setUploadProgress(0);

    const lowerName = file.name.toLowerCase();
    const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((extension) =>
      lowerName.endsWith(extension),
    );

    if (!hasSupportedExtension) {
      setSelectedFile(null);
      setError("Upload a CSV, XLSX, or PDF statement.");
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setSelectedFile(null);
      setError("File size must be 10 MB or less.");
      return;
    }

    setSelectedFile(file);
    void handleUpload(file);
  }

  async function handleUpload(fileToUpload?: File) {
    if (isUploading) {
      return;
    }

    const uploadFile = fileToUpload ?? selectedFile;
    if (!uploadFile) {
      setError("Choose a statement to upload first.");
      return;
    }

    setError("");
    setMessage("");
    setIsUploading(true);
    setUploadProgress(0);
    startUploadProgressAnimation();

    try {
      const request = uploadBrokerStatement({
        file: uploadFile,
        name: uploadFile.name,
        storeData: true,
        portfolioName: "Main Portfolio",
        useLlmFallback: true,
      });
      uploadRequestRef.current = request as unknown as { abort?: () => void };
      const response = await request.unwrap();

      if (response.status === "error") {
        trackAPI({
          pageName: trackingEventsMap.documentsPage.PAGE,
          params: {
            event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
            error: response.error,
            file_name: uploadFile.name,
          },
        });
        setError(response.error ?? "Unable to parse this statement.");
        stopUploadProgressAnimation(false);
        return;
      }

      trackAPI({
        pageName: trackingEventsMap.documentsPage.PAGE,
        params: {
          event_name: trackingEventsMap.documentsPage.API_UPLOAD_SUCCESS,
          document_id: response.document_id,
          positions_count: response.positions_count,
          file_name: uploadFile.name,
        },
      });

      stopUploadProgressAnimation();
      setUploadedDocumentId(String(response.document_id));
      setHasUploadedStatement(true);
    } catch (requestError) {
      if (
        typeof requestError === "object" &&
        requestError !== null &&
        "name" in requestError &&
        requestError.name === "AbortError"
      ) {
        stopUploadProgressAnimation(false);
        return;
      }

      trackAPI({
        pageName: trackingEventsMap.documentsPage.PAGE,
        params: {
          event_name: trackingEventsMap.documentsPage.API_UPLOAD_FAILURE,
          error: requestError instanceof Error ? requestError.message : "Upload failed",
          file_name: uploadFile.name,
        },
      });

      stopUploadProgressAnimation(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to upload this statement.",
      );
    } finally {
      setIsUploading(false);
      uploadRequestRef.current = null;
    }
  }

  function startUploadProgressAnimation() {
    clearUploadProgressTimer();

    const startedAt = window.performance.now();
    uploadProgressTimerRef.current = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const nextProgress = Math.min(Math.round((elapsed / 3000) * 90), 90);
      setUploadProgress(nextProgress);

      if (nextProgress >= 90) {
        clearUploadProgressTimer();
      }
    }, 80);
  }

  function stopUploadProgressAnimation(complete = true) {
    clearUploadProgressTimer();
    setUploadProgress(complete ? 100 : 0);
  }

  function clearUploadProgressTimer() {
    if (!uploadProgressTimerRef.current) {
      return;
    }

    window.clearInterval(uploadProgressTimerRef.current);
    uploadProgressTimerRef.current = null;
  }

  async function clearSelectedFile() {
    trackClick({
      buttonName: trackingEventsMap.documentsPage.CLICK_REMOVE_DOCUMENT,
      pageName: trackingEventsMap.documentsPage.PAGE,
      params: {
        document_id: uploadedDocumentId,
      },
    });

    if (isUploading && uploadRequestRef.current?.abort) {
      uploadRequestRef.current.abort();
    }

    // Delete the uploaded document if it exists
    if (uploadedDocumentId && hasUploadedStatement) {
      try {
        await deleteDocument(uploadedDocumentId).unwrap();
        trackAPI({
          pageName: trackingEventsMap.documentsPage.PAGE,
          params: {
            event_name: trackingEventsMap.documentsPage.API_DELETE_SUCCESS,
            document_id: uploadedDocumentId,
          },
        });
      } catch (err) {
        console.error("Failed to delete document:", err);
        trackAPI({
          pageName: trackingEventsMap.documentsPage.PAGE,
          params: {
            event_name: trackingEventsMap.documentsPage.API_DELETE_FAILURE,
            document_id: uploadedDocumentId,
            error: err instanceof Error ? err.message : "Delete failed",
          },
        });
      }
    }

    setSelectedFile(null);
    setHasUploadedStatement(false);
    setUploadedDocumentId(null);
    setUploadProgress(0);
    setMessage("");
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
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
        <h1 id="statement-title">
          Welcome {firstName}! Add your accounts statements
          <br />
          to create your Meridian Oneview
        </h1>
        <p
          style={{
            color: '#5F5F5F',
            textAlign: 'center',
            fontFamily: 'Satoshi',
            fontSize: '1rem',
            fontStyle: 'light',
            fontWeight: 500,
            lineHeight: '150%',
            letterSpacing: '-0.64px',
          }}>
          Securely drop your key investment accounts statements here. We don&apos;t
          share or sell your data
        </p>

        <div className="statement-brokers">
          <span className="brokers-text">We accept</span>
          <div className="broker-icons">
            <img src="/broker-icons/fidelity.png" alt="Fidelity" className="broker-icon" />
            <img src="/broker-icons/zerodha.png" alt="Zerodha" className="broker-icon" />
            <img src="/broker-icons/shwab.png" alt="Charles Schwab" className="broker-icon" />
            <img src="/broker-icons/groww.png" alt="Groww" className="broker-icon" />
            <img src="/broker-icons/ibkr.png" alt="IBKR" className="broker-icon" />
            <img src="/broker-icons/vested.png" alt="Vested" className="broker-icon" />
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
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <span className="upload-icon">
            <UploadIcon />
          </span>
          <strong>Drop your statements here or <span className="select-files-text">select files</span></strong>
          <span>CSV, XLSX, PDF (Max 10MB)</span>
        </label>

        {selectedFile ? (
          <div className="statement-file-loading" aria-live="polite">
            <div
              className={`statement-file-loader${isUploading ? " is-uploading" : ""}${hasUploadedStatement ? " is-uploaded" : ""}`}
              style={{ "--upload-progress": `${uploadProgress}%` } as CSSProperties}
            >
              {hasUploadedStatement ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13.3327 4L5.99935 11.3333L2.66602 8" stroke="black" strokeOpacity="0.7" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span />
              )}
            </div>
            <div className="statement-file-meta">
              <strong>{selectedFile.name}</strong>
              <span>
                {formatFileSize(selectedFile.size)}
                {hasUploadedStatement ? " • Uploaded" : showUploadProgress ? ` • ${uploadProgress}%` : ""}
              </span>
            </div>
            <button
              type="button"
              className="statement-file-remove"
              onClick={clearSelectedFile}
              aria-label="Remove selected file"
              disabled={isUploading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M7.33268 0.666016L0.666016 7.33268M0.666016 0.666016L7.33268 7.33268" stroke="black" strokeOpacity="0.7" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ) : null}

        {error ? <p className="statement-error">{error}</p> : null}
        {message ? <p className="statement-success">{message}</p> : null}

        <div className="statement-cta-group">
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
            Check a sample Oneview
          </button>
          <button
            className="statement-submit"
            type="button"
            onClick={hasUploadedStatement ? () => {
              trackClick({
                buttonName: trackingEventsMap.documentsPage.CLICK_SEE_ONEVIEW,
                pageName: trackingEventsMap.documentsPage.PAGE,
              });
              router.replace("/onboarding/processing");
            } : undefined}
            disabled={!hasUploadedStatement || isUploading}
            aria-busy={isUploading}
          >
            See your Oneview
            <ArrowRightIcon />
          </button>
        </div>

        <div style={{ height: '24px' }} />

        <p className="statement-security">
          Your data stays encrypted • 100% Safe and Secure
        </p>
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
