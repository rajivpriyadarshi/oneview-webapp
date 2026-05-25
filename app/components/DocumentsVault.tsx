"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import DocumentsTable, { type VaultDocument } from "./DocumentsTable";
import { DownloadInstructionModal } from "./DownloadInstructionModal";
import { deleteDocument, listDocuments, uploadDocument, type DocumentRecord } from "../lib/documentsApi";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".pdf"];

type UploadStatus = "queued" | "uploading" | "complete" | "error";

type UploadItem = {
  id: string;
  name: string;
  size: string;
  status: UploadStatus;
  error?: string;
};

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

function mapDocToTableRow(doc: DocumentRecord): VaultDocument {
  return {
    id: String(doc.id),
    filename: doc.name,
    downloadedOn: formatDate(doc.created_at),
    downloadedBy: doc.uploaded_by_username || "Manual",
    size: formatFileSize(doc.file_size),
    type: "Investments",
    status: "Processed",
    fileType: getFileType(doc.name, doc.content_type),
    fileUrl: doc.file_url || doc.file,
  };
}

export function DocumentsVault() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [documentsPendingDelete, setDocumentsPendingDelete] = useState<VaultDocument[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [accountCount, setAccountCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function fetchDocuments() {
    setLoading(true);
    listDocuments()
      .then((docs) => {
        setDocuments(docs.map(mapDocToTableRow));
        setDocCount(docs.length);
        const uniqueAccounts = new Set(
          docs.flatMap((d) => (d.accounts as { id: number }[])?.map((a) => a.id) || []),
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
      void handleUploadFiles(files);
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
      void handleUploadFiles(files);
    }
  }

  async function handleUploadFiles(files: File[]) {
    setError("");
    setUploadMessage("");

    const preparedItems = files.map((file, index) => {
      const validationError = validateFile(file);

      return {
        file,
        item: {
          id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
          name: file.name,
          size: formatFileSize(file.size),
          status: validationError ? "error" as const : "queued" as const,
          error: validationError,
        },
      };
    });
    const validUploads = preparedItems.filter(({ item }) => item.status !== "error");

    setUploadItems(preparedItems.map(({ item }) => item));

    if (validUploads.length === 0) {
      setError("No supported files selected.");
      return;
    }

    setUploading(true);

    try {
      let successCount = 0;

      for (const { file, item } of validUploads) {
        updateUploadItem(item.id, { status: "uploading", error: undefined });

        try {
          await uploadDocument({
            file,
            name: file.name,
          });
          successCount += 1;
          updateUploadItem(item.id, { status: "complete" });
        } catch (uploadError) {
          updateUploadItem(item.id, {
            status: "error",
            error: uploadError instanceof Error ? uploadError.message : "Upload failed.",
          });
        }
      }

      if (successCount > 0) {
        setUploadMessage(`Uploaded ${successCount} file${successCount > 1 ? "s" : ""}.`);
        fetchDocuments();
      }
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function updateUploadItem(id: string, patch: Partial<UploadItem>) {
    setUploadItems((items) =>
      items.map((item) => item.id === id ? { ...item, ...patch } : item),
    );
  }

  function validateFile(file: File) {
    const lowerName = file.name.toLowerCase();
    const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext),
    );

    if (!hasSupportedExtension) {
      return "Only CSV, XLSX, or PDF files are supported.";
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return "File size must be 10 MB or less.";
    }

    return "";
  }

  function clearUploadPanel() {
    if (uploading) {
      return;
    }

    setUploadItems([]);
    setUploadMessage("");
  }

  async function confirmDeleteDocuments() {
    if (documentsPendingDelete.length === 0) {
      return;
    }

    setDeleting(true);
    setError("");
    setUploadMessage("");

    try {
      await Promise.all(
        documentsPendingDelete.map((document) => deleteDocument(document.id)),
      );
      setUploadMessage(
        `Deleted ${documentsPendingDelete.length} file${documentsPendingDelete.length > 1 ? "s" : ""}.`,
      );
      setDocumentsPendingDelete([]);
      fetchDocuments();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete selected files.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="docs-vault-content">
      <header className="docs-vault-header">
        <div className="docs-vault-header-left">
          <h1 className="docs-vault-title">Documents vault</h1>
          <p className="docs-vault-subtitle">
            Total {docCount} files{accountCount > 0 ? ` across ${accountCount} accounts` : ""}
          </p>
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
        <strong>{isDragging ? "Drop files to upload" : "Drop files here"}</strong>
        <span>or click to browse CSV, XLSX, PDF files up to 10MB</span>
      </div>

      {error && <p className="docs-error">{error}</p>}
      {uploadMessage && <p className="docs-success">{uploadMessage}</p>}

      <DocumentsTable
        documents={documents}
        loading={loading}
        deleting={deleting}
        onRequestDelete={setDocumentsPendingDelete}
      />

      {uploadItems.length > 0 && (
        <section className="docs-upload-panel" aria-live="polite">
          <div className="docs-upload-panel-header">
            <div>
              <strong>{getUploadPanelTitle(uploadItems, uploading)}</strong>
              <span>{getUploadPanelSubtitle(uploadItems)}</span>
            </div>
            <button
              type="button"
              className="docs-upload-panel-close"
              onClick={clearUploadPanel}
              disabled={uploading}
              aria-label="Close upload status"
            >
              ×
            </button>
          </div>
          <div className="docs-upload-list">
            {uploadItems.map((item) => (
              <div className="docs-upload-row" key={item.id}>
                <div className="docs-upload-file">
                  <span className={`docs-upload-status is-${item.status}`} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.error ?? item.size}</span>
                  </div>
                </div>
                <span className="docs-upload-state">{getUploadStatusLabel(item.status)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <DownloadInstructionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {documentsPendingDelete.length > 0 && (
        <div className="docs-confirm-overlay" role="presentation">
          <div className="docs-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-documents-title">
            <h2 id="delete-documents-title">Delete selected files?</h2>
            <p>
              {documentsPendingDelete.length === 1
                ? `This will permanently delete "${documentsPendingDelete[0].filename}" from your vault.`
                : `This will permanently delete ${documentsPendingDelete.length} files from your vault.`}
            </p>
            <div className="docs-confirm-actions">
              <button
                type="button"
                className="docs-confirm-secondary"
                disabled={deleting}
                onClick={() => setDocumentsPendingDelete([])}
              >
                Cancel
              </button>
              <button
                type="button"
                className="docs-confirm-danger"
                disabled={deleting}
                onClick={confirmDeleteDocuments}
              >
                {deleting ? "Deleting..." : "Delete files"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getUploadStatusLabel(status: UploadStatus) {
  if (status === "queued") return "Queued";
  if (status === "uploading") return "Uploading";
  if (status === "complete") return "Uploaded";
  return "Failed";
}

function getUploadPanelTitle(items: UploadItem[], uploading: boolean) {
  if (uploading) {
    return `Uploading ${items.length} item${items.length > 1 ? "s" : ""}`;
  }

  const failedCount = items.filter((item) => item.status === "error").length;
  const completeCount = items.filter((item) => item.status === "complete").length;

  if (failedCount > 0 && completeCount === 0) {
    return "Upload failed";
  }

  if (failedCount > 0) {
    return "Upload complete with errors";
  }

  return "Upload complete";
}

function getUploadPanelSubtitle(items: UploadItem[]) {
  const completeCount = items.filter((item) => item.status === "complete").length;
  const failedCount = items.filter((item) => item.status === "error").length;

  if (failedCount > 0) {
    return `${completeCount} uploaded, ${failedCount} failed`;
  }

  return `${completeCount} of ${items.length} uploaded`;
}
