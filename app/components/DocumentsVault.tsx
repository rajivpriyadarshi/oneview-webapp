"use client";

import { useState, useRef, useEffect, ChangeEvent, DragEvent } from "react";
import DocumentsTable from "./DocumentsTable";
import { DownloadInstructionModal } from "./DownloadInstructionModal";
import { listDocuments, uploadBrokerStatement, type DocumentRecord } from "../lib/documentsApi";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".pdf"];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${month} ${day}, ${year} at ${time}`;
}

function getFileType(name: string, contentType: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["xls", "xlsx"].includes(ext)) return "xls";
  if (ext === "pdf") return "pdf";
  if (ext === "csv") return "csv";
  if (["doc", "docx"].includes(ext)) return "docx";
  if (["png", "jpg", "jpeg"].includes(ext)) return "png";
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return "xls";
  return "csv";
}

function mapDocToTableRow(doc: DocumentRecord) {
  return {
    filename: doc.name,
    downloadedOn: formatDate(doc.created_at),
    downloadedBy: doc.uploaded_by_username || "Manual",
    size: formatFileSize(doc.file_size),
    type: "Investments",
    status: "Processing",
    fileType: getFileType(doc.name, doc.content_type),
    fileUrl: doc.file_url || doc.file,
  };
}

export function DocumentsVault() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<ReturnType<typeof mapDocToTableRow>[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [docCount, setDocCount] = useState(0);
  const [accountCount, setAccountCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function fetchDocuments() {
    listDocuments()
      .then((docs) => {
        setDocuments(docs.map(mapDocToTableRow));
        setDocCount(docs.length);
        const uniqueAccounts = new Set(
          docs.flatMap((d) => (d.accounts as { id: number }[])?.map((a) => a.id) || [])
        );
        setAccountCount(uniqueAccounts.size);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      handleUploadFiles(files);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleUploadFiles(files);
    }
  }

  async function handleUploadFiles(files: File[]) {
    setError("");
    setUploadMessage("");

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((ext) =>
        lowerName.endsWith(ext)
      );

      if (!hasSupportedExtension) {
        setError("Only CSV, XLSX, or PDF files are supported.");
        return;
      }

      if (file.size > MAX_UPLOAD_SIZE) {
        setError("File size must be 10 MB or less.");
        return;
      }
    }

    setUploading(true);

    try {
      for (const file of files) {
        const response = await uploadBrokerStatement({
          file,
          name: file.name,
          storeData: true,
          portfolioName: "Main Portfolio",
          useLlmFallback: true,
        });

        if (response.status === "error") {
          setError(response.error ?? "Unable to parse this statement.");
          return;
        }
      }

      setUploadMessage(`Successfully uploaded ${files.length} file${files.length > 1 ? "s" : ""}.`);
      fetchDocuments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to upload this statement."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="docs-vault-content">
      <header className="docs-vault-header">
        <div className="docs-vault-header-left">
          <h1 className="docs-vault-title">Documents vault</h1>
          <p className="docs-vault-subtitle">Total {docCount} files{accountCount > 0 ? ` across ${accountCount} accounts` : ""}</p>
        </div>
        <div className="docs-vault-header-right">
          <div className="docs-vault-brokers">
            <span className="brokers-text">We accepts</span>
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
              className="download-instruction"
              onClick={() => setIsModalOpen(true)}
            >
              See download instruction
            </button>
          </div>
        </div>
      </header>

      <div
        className={`docs-dropzone ${isDragging ? "is-dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.pdf"
          multiple
          onChange={handleFileChange}
        />
        <div className="docs-dropzone-icon">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path d="M12 16V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <strong>{uploading ? "Uploading..." : "Drop your statements here"}</strong>
        <span>Supported file types: CSV, XLSX, PDF (Max 10MB)</span>
      </div>

      {error && <p className="docs-error">{error}</p>}
      {uploadMessage && <p className="docs-success">{uploadMessage}</p>}

      <DocumentsTable documents={documents} loading={loading} />

      <DownloadInstructionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path d="M12 16V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
