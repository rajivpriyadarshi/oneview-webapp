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
} from "../store/api";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".pdf"];

export function StatementUpload() {
  const router = useRouter();
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
  const showUploadProgress = isUploading || hasUploadedStatement;

  const { data: profile, isError: profileError } = useGetProfileQuery(undefined, {
    skip: !getStoredAuthToken(),
  });
  const { data: portfolios } = useListPortfoliosQuery(undefined, {
    skip: !profile,
  });

  const [uploadBrokerStatement] = useUploadBrokerStatementMutation();

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
    const displayName = profile.name?.trim();

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
        setError(response.error ?? "Unable to parse this statement.");
        stopUploadProgressAnimation(false);
        return;
      }

      stopUploadProgressAnimation();
      setMessage(
        `Uploaded ${response.positions_count ?? 0} positions from ${
          response.account_name ?? uploadFile.name
        }.`,
      );
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

  function clearSelectedFile() {
    if (isUploading && uploadRequestRef.current?.abort) {
      uploadRequestRef.current.abort();
    }
    setSelectedFile(null);
    setHasUploadedStatement(false);
    setUploadProgress(0);
    setMessage("");
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

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
            <div className="vault-avatar" />
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
        <p>
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
          <strong>Drop your statements here or select files</strong>
          <span>CSV, XLSX, PDF (Max 10MB)</span>
        </label>

        {selectedFile ? (
          <div className="statement-file-loading" aria-live="polite">
            <div
              className={`statement-file-loader${isUploading ? " is-uploading" : ""}`}
              style={{ "--upload-progress": `${uploadProgress}%` } as CSSProperties}
            >
              <span />
            </div>
            <div className="statement-file-meta">
              <strong>{selectedFile.name}</strong>
              <span>
                {formatFileSize(selectedFile.size)}
                {showUploadProgress ? ` • ${uploadProgress}%` : ""}
              </span>
            </div>
            {!hasUploadedStatement ? (
              <button
                type="button"
                className="statement-file-remove"
                onClick={clearSelectedFile}
                aria-label="Remove selected file"
              >
                ×
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="statement-error">{error}</p> : null}
        {message ? <p className="statement-success">{message}</p> : null}

        <div className="statement-cta-group">
          <button
            className="statement-sample-btn"
            type="button"
            onClick={() => setIsSampleModalOpen(true)}
          >
            Check a sample Oneview
          </button>
          <button
            className="statement-submit"
            type="button"
            onClick={hasUploadedStatement ? () => router.replace("/onboarding/processing") : undefined}
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
