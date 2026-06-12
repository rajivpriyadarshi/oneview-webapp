"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import DocumentsTable, { type VaultDocument } from "./DocumentsTable";
import { DownloadInstructionModal } from "./DownloadInstructionModal";
import { PasswordPromptModal } from "./PasswordPromptModal";
import {
  api,
  useListDocumentsQuery,
  useDeleteDocumentMutation,
  useUploadBrokerStatementMutation,
  useRetryWithPasswordMutation,
  useLazyGetBrokerStatementJobStatusQuery,
} from "../store/api";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addTrayItems, patchTrayItem, dismissTray } from "../store/uploadTraySlice";
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
    currency: doc.currency,
  };
}

export function DocumentsVault() {
  const dispatch = useAppDispatch();
  const { trackPage, trackClick, trackAPI } = useAnalytics();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const trayItems = useAppSelector((s) => s.uploadTray.items);
  const uploadItems: UploadItem[] = trayItems.map((i) => ({
    id: i.id,
    name: i.name,
    size: formatFileSize(i.size),
    status: (i.status === "uploading" ? "processing" : i.status) as UploadStatus,
    detail: i.detail,
    error: i.error,
  }));
  const [uploadMessage, setUploadMessage] = useState("");
  const [documentsPendingDelete, setDocumentsPendingDelete] = useState<VaultDocument[]>([]);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      pollingAbortControllerRef.current?.abort();
    };
  }, []);

  const activeTrayItems = uploadItems.filter(
    (i) => i.status === "queued" || i.status === "uploading" || i.status === "processing",
  );
  const activeTrayNames = new Set(activeTrayItems.map((i) => i.name.toLowerCase()));

  const [hasApiProcessing, setHasApiProcessing] = useState(false);

  const { data: rawDocuments = [], isLoading: loading } = useListDocumentsQuery(undefined, {
    pollingInterval: activeTrayItems.length > 0 || hasApiProcessing ? 5000 : 0,
  });

  useEffect(() => {
    setHasApiProcessing(
      rawDocuments.some(
        (d: DocumentRecord) => d.processing_status && d.processing_status !== "processed",
      ),
    );
  }, [rawDocuments]);
  const [deleteDocumentMutation] = useDeleteDocumentMutation();
  const [uploadBrokerStatement] = useUploadBrokerStatementMutation();
  const [retryWithPassword] = useRetryWithPasswordMutation();
  const [getBrokerStatementJobStatus] = useLazyGetBrokerStatementJobStatusQuery();
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isRetryingPassword, setIsRetryingPassword] = useState(false);
  const [pendingPasswordDocId, setPendingPasswordDocId] = useState<string | number | null>(null);
  const [pendingPasswordItemId, setPendingPasswordItemId] = useState<string | null>(null);

  // Documents from API that are still processing (e.g. after a page reload)
  const apiProcessingDocs = rawDocuments.filter(
    (d: DocumentRecord) => d.processing_status && d.processing_status !== "processed",
  );
  const apiProcessingNames = new Set(
    apiProcessingDocs.map((d: DocumentRecord) => (d.display_name || d.name).toLowerCase()),
  );

  const documents = rawDocuments
    .map(mapDocToTableRow)
    .filter((d) => !activeTrayNames.has(d.filename.toLowerCase()) && !apiProcessingNames.has(d.filename.toLowerCase()));

  // Merge tray items + API-level processing docs into one list for the ghost rows
  const processingItems = [
    ...activeTrayItems.map((i) => ({ id: i.id, name: i.name, status: i.status, detail: i.detail })),
    ...apiProcessingDocs
      .filter((d: DocumentRecord) => !activeTrayNames.has((d.display_name || d.name).toLowerCase()))
      .map((d: DocumentRecord) => ({ id: String(d.id), name: d.display_name || d.name, status: "processing", detail: "Processing document." })),
  ];

  const docCount = rawDocuments.length;
  const accountCount = new Set(documents.map((d) => d.account)).size;

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
          error: validationError || undefined,
        },
      };
    });
    const validUploads = preparedItems.filter(({ item }) => item.status !== "error");

    dispatch(addTrayItems(preparedItems.map(({ file, item }) => ({
      id: item.id,
      name: item.name,
      size: file.size,
      status: item.status,
      progress: 0,
      error: item.error,
    }))));

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
            if (response.error_code === "password_required" || response.error_code === "password_incorrect") {
              setPendingPasswordDocId(response.document_id ?? null);
              setPendingPasswordItemId(item.id);
              setPasswordError(response.error_code === "password_incorrect" ? (response.error ?? "The provided password is incorrect.") : "");
              setShowPasswordPrompt(true);
              updateUploadItem(item.id, {
                status: "error",
                error: "Password required",
              });
            } else {
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
            }
          } else if (response.status === "processing") {
            updateUploadItem(item.id, {
              status: "processing",
              detail: response.message ?? "Extracting statement details.",
            });

            const abortController = new AbortController();
            pollingAbortControllerRef.current = abortController;

            let jobResult;
            try {
              jobResult = await pollBrokerStatementJobStatus({
                jobId: response.job_id,
                signal: abortController.signal,
                getStatus: (jobId) => getBrokerStatementJobStatus(jobId, false).unwrap(),
                onProgress: (progress) => {
                  const label = progress?.label?.replace(/^OCR/i, "Scanning") ?? "Extracting statement details.";
                  updateUploadItem(item.id, { detail: label });
                },
              });
            } finally {
              pollingAbortControllerRef.current = null;
            }

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
                error: jobResult.message ?? "Needs manual review to extract information.",
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
          if (uploadError instanceof Error && uploadError.name === "AbortError") {
            break;
          }
          // Handle password-protected PDF errors (400 responses from RTK Query)
          const errorData = typeof uploadError === "object" && uploadError !== null && "data" in uploadError
            ? (uploadError as { data: unknown }).data
            : null;

          if (
            errorData &&
            typeof errorData === "object" &&
            "error_code" in errorData &&
            ((errorData as { error_code: string }).error_code === "password_required" ||
              (errorData as { error_code: string }).error_code === "password_incorrect")
          ) {
            const data = errorData as { document_id: string | number; error?: string; error_code: string };
            setPendingPasswordDocId(data.document_id);
            setPendingPasswordItemId(item.id);
            setPasswordError(data.error_code === "password_incorrect" ? (data.error ?? "The provided password is incorrect.") : "");
            setShowPasswordPrompt(true);
            updateUploadItem(item.id, { status: "error", error: "Password required" });
          } else {
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
    const trayStatus = patch.status === "processing" ? "uploading" : patch.status;
    dispatch(patchTrayItem({
      id,
      ...(trayStatus !== undefined ? { status: trayStatus } : {}),
      ...(patch.detail !== undefined ? { detail: patch.detail } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
    }));
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

    dispatch(dismissTray());
    setUploadMessage("");
  }

  async function handlePasswordSubmit(password: string) {
    if (!pendingPasswordDocId) return;

    setIsRetryingPassword(true);
    setPasswordError("");

    try {
      const response = await retryWithPassword({
        documentId: pendingPasswordDocId,
        password,
      }).unwrap();

      if (response.status === "error") {
        if (response.error_code === "password_incorrect") {
          setPasswordError(response.error ?? "The provided password is incorrect.");
          return;
        }
        setShowPasswordPrompt(false);
        if (pendingPasswordItemId) {
          updateUploadItem(pendingPasswordItemId, {
            status: "error",
            error: response.error ?? "Unable to parse this statement.",
          });
        }
        return;
      }

      setShowPasswordPrompt(false);
      setPendingPasswordDocId(null);
      setPasswordError("");
      if (pendingPasswordItemId) {
        updateUploadItem(pendingPasswordItemId, { status: "complete", error: undefined });
      }
      setUploadMessage("File unlocked and processed successfully.");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to unlock document.",
      );
    } finally {
      setIsRetryingPassword(false);
    }
  }

  function handlePasswordPromptClose() {
    setShowPasswordPrompt(false);
    setPendingPasswordDocId(null);
    setPendingPasswordItemId(null);
    setPasswordError("");
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
              {[
                { src: "/broker-icons/groww.png", name: "Groww" },
                { src: "/broker-icons/fidelity.png", name: "Fidelity" },
                { src: "/broker-icons/zerodha.png", name: "Zerodha" },
                { src: "/broker-icons/vested.png", name: "Vested" },
                { src: "/broker-icons/shwab.png", name: "Charles Schwab" },
                { src: "/broker-icons/ibkr.png", name: "IBKR" },
              ].map(({ src, name }) => (
                <div key={name} className="group relative">
                  <img src={src} alt={name} className="h-[28px] w-[28px] rounded-full object-cover" />
                  <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-[#1a1a1a] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {name}
                  </span>
                </div>
              ))}
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
        <svg className="docs-dropzone-border" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <rect x="1" y="1" rx="31" ry="31" fill="none" stroke="rgba(127,78,11,0.3)" strokeWidth="2" strokeDasharray="14 8" style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }} />
        </svg>
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
        processingItems={processingItems}
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

      <PasswordPromptModal
        isOpen={showPasswordPrompt}
        isLoading={isRetryingPassword}
        error={passwordError}
        onSubmit={handlePasswordSubmit}
        onClose={handlePasswordPromptClose}
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
