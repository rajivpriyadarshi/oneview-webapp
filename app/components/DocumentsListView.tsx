"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import DocumentSearchBar from "./DocumentSearchBar";
import { api, useDeleteDocumentMutation, useGetDocumentQuery, useListDocumentsQuery, useUploadBrokerStatementMutation } from "../store/api";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addTrayItems, patchTrayItem } from "../store/uploadTraySlice";
import type { BrokerStatementUploadResponse, DocumentRecord } from "../lib/documentsApi";
import { getRequestErrorMessage } from "../lib/apiClient";

const DOCUMENT_ACCEPT = ".pdf,.csv,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg";

type SortOption = "Most recent" | "Oldest first" | "A-Z" | "Z-A";

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDisplayName(document: DocumentRecord) {
  return document.display_name || document.name || `Document ${document.id}`;
}

function getDocumentType(document: DocumentRecord) {
  return formatLabel(document.document_type || document.content_type || "Document");
}

function getStatusLabel(status?: string | null) {
  if (!status) return "Uploaded";

  const normalized = status.toLowerCase();
  if (normalized === "processed" || normalized === "completed" || normalized === "complete") return "Processed";
  if (normalized === "failed" || normalized === "error") return "Failed";
  if (normalized === "needs_review" || normalized === "review") return "Needs review";
  if (normalized === "processing" || normalized === "queued" || normalized === "running") return "Processing";

  return formatLabel(status);
}

function getStatusVariant(status?: string | null) {
  const normalized = status?.toLowerCase();
  if (!normalized || normalized === "processed" || normalized === "completed" || normalized === "complete") {
    return "bg-green-50 text-green-700 border-green-200";
  }
  if (normalized === "failed" || normalized === "error") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (normalized === "needs_review" || normalized === "review") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function isProcessing(status?: string | null) {
  const normalized = status?.toLowerCase();
  return Boolean(normalized && !["processed", "completed", "complete", "failed", "error", "needs_review", "review"].includes(normalized));
}

function isReview(status?: string | null) {
  const normalized = status?.toLowerCase();
  return normalized === "needs_review" || normalized === "review";
}

function isError(status?: string | null) {
  const normalized = status?.toLowerCase();
  return normalized === "failed" || normalized === "error";
}

function formatLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getDocumentTypeIconPath(documentType: string): string {
  const documentTypeToIcon: Record<string, string> = {
    banking: "/icons/documents/ic-banking.png",
    capital: "/icons/documents/ic-capital-calls.png",
    compliance: "/icons/documents/ic-compliance.png",
    corporate: "/icons/documents/ic-corporate-entity.png",
    distribution: "/icons/documents/ic-distribution-notices.png",
    insurance: "/icons/documents/ic-insurance.png",
    investment: "/icons/documents/ic-investment-agreements.png",
    investments: "/icons/documents/ic-statements.png",
    kyc: "/icons/documents/ic-identity-kyc.png",
    legal: "/icons/documents/ic-legal.png",
    loan: "/icons/documents/ic-loans-credit.png",
    property: "/icons/documents/ic-real-estate.png",
    statement: "/icons/documents/ic-statements.png",
    tax: "/icons/documents/ic-tax-documents.png",
    trust: "/icons/documents/ic-trust-wills.png",
  };
  const normalizedType = documentType.toLowerCase();
  const match = Object.entries(documentTypeToIcon).find(([key]) => normalizedType.includes(key));
  return match?.[1] || "/icons/documents/ic-statements.png";
}

function getUploadedDocumentId(response: BrokerStatementUploadResponse) {
  if ("document_id" in response && response.document_id) return String(response.document_id);
  if ("existing_document_id" in response && response.existing_document_id) return String(response.existing_document_id);
  return null;
}

function getUploadResponseError(response: BrokerStatementUploadResponse) {
  if (response.status === "error") {
    return response.error || "Upload failed.";
  }

  if (response.status === "duplicate") {
    return response.detail || "This document has already been uploaded.";
  }

  return "";
}

export default function DocumentsListView({ clientId }: { clientId?: number | string | null }) {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trayItems = useAppSelector((state) => state.uploadTray.items);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Most recent");
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [openMenuDocId, setOpenMenuDocId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [hasApiProcessing, setHasApiProcessing] = useState(false);

  const hasActiveUpload = trayItems.some((item) => item.status === "queued" || item.status === "uploading");
  const { data: documents = [], isLoading, isFetching } = useListDocumentsQuery(clientId || undefined, {
    refetchOnMountOrArgChange: true,
    pollingInterval: hasActiveUpload || hasApiProcessing ? 5000 : 0,
  });
  const { data: expandedDocument, isFetching: isFetchingDetail } = useGetDocumentQuery({
    id: expandedDocId ?? "",
    clientId,
  }, {
    skip: !expandedDocId,
  });
  const [uploadBrokerStatement] = useUploadBrokerStatementMutation();
  const [deleteDocument, { isLoading: isDeleting }] = useDeleteDocumentMutation();

  useEffect(() => {
    setHasApiProcessing(documentsHaveProcessingStatus(documents));
  }, [documents]);

  useEffect(() => {
    const documentsById = new Map(documents.map((document) => [String(document.id), document]));

    for (const item of trayItems) {
      if (item.status !== "uploading" || !item.documentId) continue;

      const document = documentsById.get(item.documentId);
      if (!document) continue;

      if (isProcessing(document.processing_status)) {
        if (item.detail !== "Processing document.") {
          dispatch(patchTrayItem({ id: item.id, detail: "Processing document." }));
        }
      } else if (isError(document.processing_status)) {
        dispatch(patchTrayItem({ id: item.id, status: "error", detail: undefined, error: "Document processing failed." }));
      } else if (isReview(document.processing_status)) {
        dispatch(patchTrayItem({ id: item.id, status: "review", detail: undefined, error: "Document needs review." }));
      } else {
        dispatch(patchTrayItem({ id: item.id, status: "complete", detail: "Document ready.", error: undefined }));
      }
    }
  }, [dispatch, documents, trayItems]);

  useEffect(() => {
    if (!expandedDocId || documents.some((document) => String(document.id) === expandedDocId)) return;
    setExpandedDocId(null);
  }, [documents, expandedDocId]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? documents.filter((document) => {
          const haystack = [
            getDisplayName(document),
            document.description,
            document.document_type,
            document.broker,
            document.uploaded_by_username,
            document.processing_status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
      : documents;

    return [...filtered].sort((a, b) => {
      if (sortBy === "Most recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "Oldest first") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "A-Z") return getDisplayName(a).localeCompare(getDisplayName(b));
      if (sortBy === "Z-A") return getDisplayName(b).localeCompare(getDisplayName(a));
      return 0;
    });
  }, [documents, searchQuery, sortBy]);

  function handleAddDocument() {
    setUploadError("");
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (files.length > 0) {
      void handleUploadFiles(files);
    }
  }

  async function handleUploadFiles(files: File[]) {
    setUploadError("");

    const preparedItems = files.map((file, index) => ({
      file,
      trayItem: {
        id: `${file.name}-${file.size}-${file.lastModified}-${index}-${Date.now()}`,
        name: file.name,
        size: file.size,
        status: "queued" as const,
        progress: 0,
      },
    }));

    dispatch(addTrayItems(preparedItems.map(({ trayItem }) => trayItem)));

    for (const { file, trayItem } of preparedItems) {
      dispatch(patchTrayItem({ id: trayItem.id, status: "uploading", detail: "Uploading document." }));

      try {
        const uploadResponse = await uploadBrokerStatement({ file, name: file.name }).unwrap();
        const responseError = getUploadResponseError(uploadResponse);

        if (responseError) {
          throw new Error(responseError);
        }

        const documentId = getUploadedDocumentId(uploadResponse);

        if (!documentId) {
          throw new Error("Upload succeeded but no document id was returned.");
        }

        dispatch(patchTrayItem({
          id: trayItem.id,
          documentId,
          status: "uploading",
          detail: "Checking document status.",
        }));

        dispatch(api.util.invalidateTags(["Documents"]));
      } catch (error) {
        dispatch(patchTrayItem({
          id: trayItem.id,
          status: "error",
          detail: undefined,
          error: getRequestErrorMessage(error, "Upload failed."),
        }));
        setUploadError(getRequestErrorMessage(error, "Upload failed."));
      }
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setOpenMenuDocId(null);

    try {
      await deleteDocument(documentId).unwrap();
      if (expandedDocId === documentId) {
        setExpandedDocId(null);
      }
      dispatch(api.util.invalidateTags(["Documents"]));
    } catch (error) {
      setUploadError(getRequestErrorMessage(error, "Failed to delete document."));
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={DOCUMENT_ACCEPT}
          multiple
          onChange={handleFileChange}
        />

        <DocumentSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onAddDocument={handleAddDocument}
        />

        {uploadError ? (
          <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {uploadError}
          </p>
        ) : null}

        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {isLoading ? "Loading documents..." : `${filteredDocuments.length} document${filteredDocuments.length !== 1 ? "s" : ""}`}
            {isFetching && !isLoading ? " · Refreshing" : ""}
          </p>
          <div className="relative">
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50">
              <span>Sort: {sortBy}</span>
              <img src="/icons/documents/chevron-down.svg" alt="Sort" className="h-4 w-4" />
            </button>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              <option value="Most recent">Most recent</option>
              <option value="Oldest first">Oldest first</option>
              <option value="A-Z">A-Z</option>
              <option value="Z-A">Z-A</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Loading documents...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No documents found</div>
          ) : (
            filteredDocuments.map((document) => {
              const documentId = String(document.id);
              const isExpanded = expandedDocId === documentId;
              const detailDocument = isExpanded ? (expandedDocument ?? document) : document;

              return (
                <DocumentRow
                  key={documentId}
                  document={document}
                  detailDocument={detailDocument}
                  isExpanded={isExpanded}
                  isFetchingDetail={isExpanded && isFetchingDetail}
                  isMenuOpen={openMenuDocId === documentId}
                  isDeleting={isDeleting}
                  onToggleExpand={() => {
                    setExpandedDocId(isExpanded ? null : documentId);
                    setOpenMenuDocId(null);
                  }}
                  onToggleMenu={() => setOpenMenuDocId(openMenuDocId === documentId ? null : documentId)}
                  onDelete={() => void handleDeleteDocument(documentId)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentRow({
  document,
  detailDocument,
  isExpanded,
  isFetchingDetail,
  isMenuOpen,
  isDeleting,
  onToggleExpand,
  onToggleMenu,
  onDelete,
}: {
  document: DocumentRecord;
  detailDocument: DocumentRecord;
  isExpanded: boolean;
  isFetchingDetail: boolean;
  isMenuOpen: boolean;
  isDeleting: boolean;
  onToggleExpand: () => void;
  onToggleMenu: () => void;
  onDelete: () => void;
}) {
  const documentType = getDocumentType(detailDocument);
  const fileUrl = detailDocument.file_url || detailDocument.file;

  return (
    <article className={`rounded-2xl border bg-white transition-all ${isExpanded ? "border-2 border-gray-900" : "border-gray-200"}`}>
      <div
        className="block w-full cursor-pointer p-6 text-left"
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center">
            <Image src={getDocumentTypeIconPath(documentType)} alt="" width={52} height={52} style={{ objectFit: "contain" }} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 text-base font-semibold text-gray-900">{getDisplayName(document)}</h3>
                <p className="mb-3 text-sm text-gray-600">
                  {formatFileSize(document.file_size)} · Uploaded {formatDate(document.created_at)}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {getDocumentType(document)}
                  </span>
                  <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${getStatusVariant(document.processing_status)}`}>
                    {getStatusLabel(document.processing_status)}
                  </span>
                  {document.broker ? <span className="text-xs text-gray-500">{formatLabel(document.broker)}</span> : null}
                </div>
              </div>

              <div className="relative flex flex-shrink-0 items-center gap-2">
                {isExpanded && fileUrl ? (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[26px] border border-[#E8E8E8] bg-white px-[14px] py-[6px] text-sm font-medium text-black transition-colors hover:bg-gray-50"
                    onClick={(event) => event.stopPropagation()}
                  >
                    View document
                  </a>
                ) : null}

                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-50"
                  aria-label="Document actions"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleMenu();
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="3" r="1" fill="currentColor" />
                    <circle cx="8" cy="8" r="1" fill="currentColor" />
                    <circle cx="8" cy="13" r="1" fill="currentColor" />
                  </svg>
                </button>

                {isMenuOpen ? (
                  <div className="absolute right-10 top-9 z-20 min-w-[148px] overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_16px_40px_rgba(0,0,0,0.14)]">
                    <button
                      type="button"
                      disabled={isDeleting}
                      className="block w-full px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete();
                      }}
                    >
                      Delete document
                    </button>
                  </div>
                ) : null}

                <span className="flex h-8 w-8 items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </div>

            {isExpanded ? (
              <DocumentDetails document={detailDocument} isLoading={isFetchingDetail} />
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function DocumentDetails({ document, isLoading }: { document: DocumentRecord; isLoading: boolean }) {
  const fields = [
    ["Document type", getDocumentType(document)],
    ["Provider", document.broker ? formatLabel(document.broker) : document.uploaded_by_username || "-"],
    ["Status", getStatusLabel(document.processing_status)],
    ["Uploaded by", document.uploaded_by_username || "-"],
    ["Uploaded on", formatDate(document.created_at)],
    ["Updated on", formatDate(document.updated_at)],
    ["File size", formatFileSize(document.file_size)],
    ["Content type", document.content_type || "-"],
    ["Accounts", document.accounts?.map((account) => account.name).join(", ") || "-"],
    ["Positions", typeof document.positions_count === "number" ? String(document.positions_count) : "-"],
    ["Holdings value", typeof document.holdings_value === "number" ? String(document.holdings_value) : "-"],
  ];

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      {isLoading ? <p className="mb-4 text-sm text-gray-500">Loading document details...</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="flex items-start gap-3">
            <img src="/icons/documents/check-circle.svg" alt="" className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs text-gray-500">{label}</p>
              <p className="break-words text-sm font-medium text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>
      {document.description ? (
        <div className="mt-4 rounded-xl bg-gray-50 p-4">
          <p className="mb-1 text-xs text-gray-500">Description</p>
          <p className="text-sm text-gray-900">{document.description}</p>
        </div>
      ) : null}
    </div>
  );
}

function documentsHaveProcessingStatus(documents: DocumentRecord[]) {
  return documents.some((document) => isProcessing(document.processing_status));
}
