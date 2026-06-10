"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import DocumentsTable, { type VaultDocument } from "./DocumentsTable";
import { DownloadInstructionModal } from "./DownloadInstructionModal";
import {
  api,
  useListDocumentsQuery,
  useDeleteDocumentMutation,
  useUploadBrokerStatementMutation,
  useLazyGetBrokerStatementJobStatusQuery,
} from "../store/api";
import { useAppDispatch } from "../store/hooks";
import type { DocumentRecord } from "../lib/documentsApi";
import { pollBrokerStatementJobStatus } from "../lib/documentsApi";
import { getRequestErrorMessage } from "../lib/apiClient";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".pdf"];

type UploadStatus = "queued" | "uploading" | "processing" | "complete" | "review" | "error";

type UploadItem = {
  id: string;
  name: string;
  size: string;
  status: UploadStatus;
  detail?: string;
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

function extractBrokerFromName(name: string): string {
  const match = name.match(/^([^-]+)\s*-/);
  if (match) {
    return match[1].trim();
  }
  return "Other";
}

function getBrokerDisplayName(broker: string | undefined): string {
  if (!broker) return "Other";
  const brokerNames: Record<string, string> = {
    zerodha: "Zerodha",
    ibkr: "IBKR",
    fidelity: "Fidelity",
    groww: "Groww",
    vested: "Vested",
    schwab: "Charles Schwab",
    kotak: "Kotak",
  };
  return brokerNames[broker.toLowerCase()] || broker.charAt(0).toUpperCase() + broker.slice(1);
}

function mapDocToTableRow(doc: DocumentRecord): VaultDocument {
  const brokerName = doc.broker
    ? getBrokerDisplayName(doc.broker)
    : extractBrokerFromName(doc.display_name || doc.name);

  return {
    id: String(doc.id),
    filename: doc.display_name || doc.name,
    uploadedOn: formatDate(doc.created_at),
    uploadedOnRaw: doc.created_at,
    uploadedBy: doc.uploaded_by_username || "Manual",
    size: formatFileSize(doc.file_size),
    type: doc.document_type === "investments" ? "Investments" : (doc.document_type || "Investments"),
    status: doc.processing_status === "processed" ? "Processed" : (doc.processing_status || "Processed"),
    fileType: getFileType(doc.name, doc.content_type),
    fileUrl: doc.file_url || doc.file,
    account: brokerName,
    holdingsCount: doc.positions_count,
    holdingsValue: doc.holdings_value,
  };
}

export function DocumentsVault() {
  const dispatch = useAppDispatch();
  const { trackPage, trackClick, trackAPI } = useAnalytics();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [documentsPendingDelete, setDocumentsPendingDelete] = useState<VaultDocument[]>([]);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: rawDocuments = [], isLoading: loading } = useListDocumentsQuery();
  const [deleteDocumentMutation] = useDeleteDocumentMutation();
  const [uploadBrokerStatement] = useUploadBrokerStatementMutation();
  const [getBrokerStatementJobStatus] = useLazyGetBrokerStatementJobStatusQuery();

  const documents = rawDocuments.map(mapDocToTableRow);
  const docCount = rawDocuments.length;
  const accountCount = new Set(
    rawDocuments.flatMap((d) => (d.accounts as { id: number }[])?.map((a) => a.id) || []),
  ).size;

  // Track page load
  useEffect(() => {
    trackPage({
      pageName: trackingEventsMap.documentsVaultPage.PAGE,
      params: {
        page_url: window.location.href,
        page_title: document.title,
        total_documents: docCount,
        total_accounts: accountCount,
      },
    });
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
      trackClick({
        buttonName: trackingEventsMap.documentsVaultPage.DROP_FILES,
        pageName: trackingEventsMap.documentsVaultPage.PAGE,
        params: {
          files_count: files.length,
        },
      });
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

        trackAPI({
          pageName: trackingEventsMap.documentsVaultPage.PAGE,
          params: {
            event_name: trackingEventsMap.documentsVaultPage.API_UPLOAD_FILE_START,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
          },
        });

        try {
          const response = await uploadBrokerStatement({
            file,
            name: file.name,
            storeData: true,
            useLlmFallback: true,
          }).unwrap();

          if (response.status === "duplicate") {
            const uploadDate = new Date(response.uploaded_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            trackAPI({
              pageName: trackingEventsMap.documentsVaultPage.PAGE,
              params: {
                event_name: trackingEventsMap.documentsVaultPage.API_UPLOAD_FILE_FAILURE,
                file_name: file.name,
                error: "duplicate",
                existing_document_id: response.existing_document_id,
              },
            });
            updateUploadItem(item.id, {
              status: "error",
              error: `This file was already uploaded on ${uploadDate}.`,
            });
          } else if (response.status === "error") {
            trackAPI({
              pageName: trackingEventsMap.documentsVaultPage.PAGE,
              params: {
                event_name: trackingEventsMap.documentsVaultPage.API_UPLOAD_FILE_FAILURE,
                file_name: file.name,
                error: response.error,
              },
            });
            updateUploadItem(item.id, {
              status: "error",
              error: response.error ?? "Unable to parse this statement.",
            });
          } else if (response.status === "processing") {
            updateUploadItem(item.id, {
              status: "processing",
              detail: response.message ?? "Extracting statement details.",
            });

            const jobResult = await pollBrokerStatementJobStatus({
              jobId: response.job_id,
              getStatus: (jobId) => getBrokerStatementJobStatus(jobId, false).unwrap(),
              onProgress: (progress) => {
                updateUploadItem(item.id, {
                  detail: progress?.label ?? "Extracting statement details.",
                });
              },
            });

            if (jobResult.status === "error") {
              trackAPI({
                pageName: trackingEventsMap.documentsVaultPage.PAGE,
                params: {
                  event_name: trackingEventsMap.documentsVaultPage.API_UPLOAD_FILE_FAILURE,
                  file_name: file.name,
                  error: jobResult.error,
                  job_id: response.job_id,
                },
              });
              updateUploadItem(item.id, {
                status: "error",
                detail: undefined,
                error: jobResult.error ?? "Unable to process this statement.",
              });
            } else if (jobResult.status === "needs_review") {
              trackAPI({
                pageName: trackingEventsMap.documentsVaultPage.PAGE,
                params: {
                  event_name: trackingEventsMap.documentsVaultPage.API_UPLOAD_FILE_FAILURE,
                  file_name: file.name,
                  error: jobResult.message,
                  job_id: response.job_id,
                  status: "needs_review",
                },
              });
              updateUploadItem(item.id, {
                status: "review",
                detail: undefined,
                error: jobResult.message ?? "Extraction complete but requires human review.",
              });
            } else {
              successCount += 1;
              dispatch(api.util.invalidateTags(["Documents", "Portfolios", "PortfolioView", "Sankey"]));
              trackAPI({
                pageName: trackingEventsMap.documentsVaultPage.PAGE,
                params: {
                  event_name: trackingEventsMap.documentsVaultPage.API_UPLOAD_FILE_SUCCESS,
                  file_name: file.name,
                  document_id: jobResult.document_id,
                  positions_count: jobResult.positions_count,
                  job_id: response.job_id,
                },
              });
              const detail = jobResult.storage?.overwrote_existing
                ? `Updated ${jobResult.storage.positions_updated} existing positions`
                : undefined;
              updateUploadItem(item.id, { status: "complete", detail, error: undefined });
            }
          } else if (response.status === "success") {
            successCount += 1;
            trackAPI({
              pageName: trackingEventsMap.documentsVaultPage.PAGE,
              params: {
                event_name: trackingEventsMap.documentsVaultPage.API_UPLOAD_FILE_SUCCESS,
                file_name: file.name,
                document_id: response.document_id,
                positions_count: response.positions_count,
              },
            });
            const detail = response.storage?.overwrote_existing
              ? `Updated ${response.storage.positions_updated} existing positions`
              : undefined;
            updateUploadItem(item.id, { status: "complete", detail, error: undefined });
          }
        } catch (uploadError) {
          trackAPI({
            pageName: trackingEventsMap.documentsVaultPage.PAGE,
            params: {
              event_name: trackingEventsMap.documentsVaultPage.API_UPLOAD_FILE_FAILURE,
              file_name: file.name,
              error: getRequestErrorMessage(uploadError, "Upload failed"),
            },
          });
          updateUploadItem(item.id, {
            status: "error",
            detail: undefined,
            error: getRequestErrorMessage(uploadError, "Upload failed."),
          });
        }
      }

      if (successCount > 0) {
        setUploadMessage(`Uploaded ${successCount} file${successCount > 1 ? "s" : ""}.`);
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

    trackClick({
      buttonName: trackingEventsMap.documentsVaultPage.CLICK_UPLOAD_PANEL_CLOSE,
      pageName: trackingEventsMap.documentsVaultPage.PAGE,
      params: {
        total_items: uploadItems.length,
        successful_uploads: uploadItems.filter((item) => item.status === "complete").length,
        failed_uploads: uploadItems.filter((item) => item.status === "error").length,
      },
    });

    setUploadItems([]);
    setUploadMessage("");
  }

  async function confirmDeleteDocuments() {
    if (documentsPendingDelete.length === 0) {
      return;
    }

    trackClick({
      buttonName: trackingEventsMap.documentsVaultPage.CLICK_DELETE_CONFIRM,
      pageName: trackingEventsMap.documentsVaultPage.PAGE,
      params: {
        files_count: documentsPendingDelete.length,
      },
    });

    setDeleting(true);
    setError("");
    setUploadMessage("");

    try {
      await Promise.all(
        documentsPendingDelete.map((document) => deleteDocumentMutation(document.id).unwrap()),
      );

      trackAPI({
        pageName: trackingEventsMap.documentsVaultPage.PAGE,
        params: {
          event_name: trackingEventsMap.documentsVaultPage.API_DELETE_SUCCESS,
          files_count: documentsPendingDelete.length,
        },
      });

      setUploadMessage(
        `Deleted ${documentsPendingDelete.length} file${documentsPendingDelete.length > 1 ? "s" : ""}.`,
      );
      setDocumentsPendingDelete([]);
    } catch (deleteError) {
      trackAPI({
        pageName: trackingEventsMap.documentsVaultPage.PAGE,
        params: {
          event_name: trackingEventsMap.documentsVaultPage.API_DELETE_FAILURE,
          files_count: documentsPendingDelete.length,
          error: deleteError instanceof Error ? deleteError.message : "Delete failed",
        },
      });

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
          <h1 className="docs-vault-title" style={{ fontFeatureSettings: "'ss03' on" }}>Documents vault</h1>
          <p className="docs-vault-subtitle" style={{ fontFeatureSettings: "'ss03' on" }}>
            Total {docCount} files{accountCount > 0 ? ` across ${accountCount} accounts` : ""}
          </p>
        </div>
        <div className="docs-vault-header-right">
          <div className="docs-vault-brokers">
            <div className="flex items-center gap-2">
              <img src="/broker-icons/groww.png" alt="Groww" className="h-[28px] w-[28px] rounded-full object-cover" />
              <img src="/broker-icons/fidelity.png" alt="Fidelity" className="h-[28px] w-[28px] rounded-full object-cover" />
              <img src="/broker-icons/zerodha.png" alt="Zerodha" className="h-[28px] w-[28px] rounded-full object-cover" />
              <img src="/broker-icons/vested.png" alt="Vested" className="h-[28px] w-[28px] rounded-full object-cover" />
              <img src="/broker-icons/shwab.png" alt="Charles Schwab" className="h-[28px] w-[28px] rounded-full object-cover" />
              <img src="/broker-icons/ibkr.png" alt="IBKR" className="h-[28px] w-[28px] rounded-full object-cover" />
            </div>
            <button
              type="button"
              className="font-satoshi font-medium leading-[150%] tracking-[-0.04em] text-[#7F4E0B] underline transition-opacity duration-200 hover:opacity-70"
              style={{ fontFeatureSettings: "'ss03' on", fontSize: "16px" }}
              onClick={() => {
                trackClick({
                  buttonName: trackingEventsMap.documentsVaultPage.CLICK_DOWNLOAD_INSTRUCTIONS,
                  pageName: trackingEventsMap.documentsVaultPage.PAGE,
                });
                setIsModalOpen(true);
              }}
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
        onClick={() => {
          trackClick({
            buttonName: trackingEventsMap.documentsVaultPage.CLICK_UPLOAD_AREA,
            pageName: trackingEventsMap.documentsVaultPage.PAGE,
          });
          fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.pdf"
          multiple
          onChange={handleFileChange}
        />
        <div className="docs-dropzone-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M14.9997 2.14258H2.14258M4.28544 9.28544L8.57115 4.99972L12.8569 9.28544M8.57115 4.99972V14.9997"
              stroke="black"
              strokeOpacity="0.7"
              strokeWidth="1.42857"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <strong style={{ fontFeatureSettings: "'ss03' on" }}>{isDragging ? "Drop files to upload" : <>Drop your statements here or <span className="text-[#7f4e0b]">select files</span></>}</strong>
        <span style={{ fontFeatureSettings: "'ss03' on" }}>CSV, XLSX, PDF (Max 10MB)</span>
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
                    <span>{item.error ?? item.detail ?? item.size}</span>
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
                onClick={() => {
                  trackClick({
                    buttonName: trackingEventsMap.documentsVaultPage.CLICK_DELETE_CANCEL,
                    pageName: trackingEventsMap.documentsVaultPage.PAGE,
                    params: {
                      files_count: documentsPendingDelete.length,
                    },
                  });
                  setDocumentsPendingDelete([]);
                }}
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
  if (status === "processing") return "Extracting";
  if (status === "complete") return "Uploaded";
  if (status === "review") return "Review";
  return "Failed";
}

function getUploadPanelTitle(items: UploadItem[], uploading: boolean) {
  if (uploading) {
    return `Uploading ${items.length} item${items.length > 1 ? "s" : ""}`;
  }

  const failedCount = items.filter((item) => item.status === "error").length;
  const completeCount = items.filter((item) => item.status === "complete").length;
  const reviewCount = items.filter((item) => item.status === "review").length;

  if (reviewCount > 0 && failedCount > 0) {
    return "Upload complete with review and errors";
  }

  if (reviewCount > 0) {
    return "Upload complete with review needed";
  }

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
  const reviewCount = items.filter((item) => item.status === "review").length;

  const parts = [`${completeCount} uploaded`];

  if (reviewCount > 0) {
    parts.push(`${reviewCount} need review`);
  }

  if (failedCount > 0) {
    parts.push(`${failedCount} failed`);
  }

  if (parts.length > 1) {
    return parts.join(", ");
  }

  return `${completeCount} of ${items.length} uploaded`;
}
