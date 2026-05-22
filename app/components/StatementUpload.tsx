"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OneviewBrand } from "./BrandMarks";
import { uploadBrokerStatement } from "../lib/documentsApi";
import { listPortfolios } from "../lib/portfoliosApi";
import { getProfile } from "../lib/realAuthApi";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".pdf"];

export function StatementUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [firstName, setFirstName] = useState("there");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUploadedStatement, setHasUploadedStatement] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getStoredAuthToken();

    if (!token) {
      router.replace("/");
      return;
    }

    getProfile()
      .then(async (profile) => {
        const displayName = profile.display_name?.trim();

        if (!displayName) {
          router.replace("/profile/setup");
          return;
        }

        const portfolios = await listPortfolios();

        if (portfolios.length > 0) {
          router.replace("/dashboard");
          return;
        }

        setFirstName(displayName.split(/\s+/)[0]);
      })
      .catch(() => {
        clearAuthToken();
        router.replace("/");
      });
  }, [router]);

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
    setError("");
    setMessage("");
    setHasUploadedStatement(false);

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
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError("Choose a statement to upload first.");
      return;
    }

    setError("");
    setMessage("");
    setIsUploading(true);

    try {
      const response = await uploadBrokerStatement({
        file: selectedFile,
        name: selectedFile.name,
        storeData: true,
        portfolioName: "Main Portfolio",
        useLlmFallback: true,
      });

      if (response.status === "error") {
        setError(response.error ?? "Unable to parse this statement.");
        return;
      }

      setMessage(
        `Uploaded ${response.positions_count ?? 0} positions from ${
          response.account_name ?? selectedFile.name
        }.`,
      );
      setHasUploadedStatement(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to upload this statement.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="statement-page">
      <header className="statement-topbar">
        <OneviewBrand />
        <div className="vault-avatar" aria-label="User avatar" />
      </header>

      <section className="statement-content" aria-labelledby="statement-title">
        <h1 id="statement-title">
          Welcome {firstName}! Add your accounts statements
          <br />
          to create your Oneview
        </h1>
        <p>
          Securely drop your key investment accounts statements here. We don&apos;t
          share or sell your data
        </p>

        <label
          className={`statement-dropzone${isDragging ? " is-dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.pdf"
            onChange={handleFileChange}
          />
          <span className="upload-icon">
            <UploadIcon />
          </span>
          <strong>
            {selectedFile ? selectedFile.name : "Drop your statements here"}
          </strong>
          <span>Supported file types: CSV, XLSX, PDF (Max 10MB)</span>
        </label>

        <p className="statement-support">
          We accepts Fidelity, Zerodha, Schwab, Groww, IBKR, Vested, and any CSV
          format
        </p>

        {error ? <p className="statement-error">{error}</p> : null}
        {message ? <p className="statement-success">{message}</p> : null}

        <button
          className="statement-submit"
          type="button"
          onClick={
            hasUploadedStatement
              ? () => router.replace("/dashboard")
              : selectedFile
                ? handleUpload
                : undefined
          }
          disabled={isUploading || !selectedFile}
        >
          {hasUploadedStatement
            ? "Go to Oneview"
            : selectedFile
              ? isUploading
                ? "Uploading..."
                : "Upload statements"
              : "Upload statements"}
          <ArrowRightIcon />
        </button>

        <p className="statement-security">
          Your data stays encrypted • 100% Safe and Secure
        </p>
      </section>
    </main>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 17V6M8 10l4-4 4 4M5 19h14" />
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
