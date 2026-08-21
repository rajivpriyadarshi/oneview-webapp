"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import DocumentSearchBar from "./DocumentSearchBar";
import { ClientLottie } from "./ClientLottie";
import { api, useDeleteDocumentMutation, useGetDocumentQuery, useListDocumentsQuery, useUploadBrokerStatementMutation } from "../store/api";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addTrayItems, patchTrayItem } from "../store/uploadTraySlice";
import { getDocumentStatus, type BrokerStatementUploadResponse, type DocumentRecord, type DocumentStatusResponse } from "../lib/documentsApi";
import { getRequestErrorMessage } from "../lib/apiClient";

const DOCUMENT_ACCEPT = ".pdf,.csv,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg";
const DOCUMENT_STATUS_POLL_INTERVAL_MS = 5000;
const DOCUMENT_STATUS_POLL_TIMEOUT_MS = 5 * 60 * 1000;

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
  const rawType = document.document_type || document.content_type || "Document";
  const mimeSubtype = rawType.includes("/") ? rawType.split("/").pop() : rawType;
  return formatLabel(mimeSubtype || "Document");
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

type MetadataRecord = Record<string, unknown>;

function isMetadataRecord(value: unknown): value is MetadataRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeMetadataKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getStringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function walkMetadata(value: unknown, visit: (key: string, child: unknown, parent: MetadataRecord) => void) {
  const seen = new WeakSet<object>();

  function walk(current: unknown) {
    if (!current || typeof current !== "object") return;
    if (seen.has(current)) return;
    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }

    const record = current as MetadataRecord;
    for (const [key, child] of Object.entries(record)) {
      visit(key, child, record);
      walk(child);
    }
  }

  walk(value);
}

function findRecordByKey(root: unknown, keyName: string) {
  const targetKey = normalizeMetadataKey(keyName);
  let match: MetadataRecord | null = null;

  walkMetadata(root, (key, value) => {
    if (match || normalizeMetadataKey(key) !== targetKey || !isMetadataRecord(value)) return;
    match = value;
  });

  return match;
}

function pickStringFromRecord(record: MetadataRecord | null, keys: string[]) {
  if (!record) return "";

  for (const key of keys) {
    const directValue = getStringValue(record[key]);
    if (directValue) return directValue;

    const normalizedKey = normalizeMetadataKey(key);
    const matchingEntry = Object.entries(record).find(([entryKey]) => normalizeMetadataKey(entryKey) === normalizedKey);
    const matchingValue = getStringValue(matchingEntry?.[1]);
    if (matchingValue) return matchingValue;
  }

  return "";
}

function findStringByKeys(root: unknown, keys: string[]) {
  const normalizedKeys = new Set(keys.map(normalizeMetadataKey));
  let match = "";

  walkMetadata(root, (key, value) => {
    if (match || !normalizedKeys.has(normalizeMetadataKey(key))) return;
    match = getStringValue(value);
  });

  return match;
}

function extractDocumentType(document: DocumentRecord) {
  const classification = findRecordByKey(document.metadata, "classification");
  const classifiedType = pickStringFromRecord(classification, ["category_label", "document_type", "category"]);
  return classifiedType ? formatLabel(classifiedType) : getDocumentType(document);
}

function extractProvider(document: DocumentRecord) {
  const classification = findRecordByKey(document.metadata, "classification");
  const classifiedProvider = pickStringFromRecord(classification, ["issuer_name", "provider", "provider_name", "institution_name"]);
  if (classifiedProvider) return classifiedProvider;

  const metadataProvider = findStringByKeys(document.metadata, ["issuer_name", "provider", "provider_name", "broker_name", "institution_name"]);
  if (metadataProvider) return metadataProvider;

  if (document.broker) return formatLabel(document.broker);
  return "-";
}

function extractIdentification(document: DocumentRecord) {
  const identifierTypePriority = [
    "policy_number",
    "account_number",
    "document_number",
    "certificate_number",
    "contract_number",
    "reference_number",
    "client_code",
    "vehicle_registration_number",
    "registration_number",
  ];
  const normalizedPriority = identifierTypePriority.map(normalizeMetadataKey);
  const identifiers: { type: string; value: string }[] = [];

  walkMetadata(document.metadata, (key, value) => {
    if (normalizeMetadataKey(key) !== "identifiers" || !Array.isArray(value)) return;

    for (const item of value) {
      if (!isMetadataRecord(item)) continue;
      const type = pickStringFromRecord(item, ["type", "name", "label"]);
      const identifierValue = pickStringFromRecord(item, ["value", "identifier", "number"]);
      if (type && identifierValue) {
        identifiers.push({ type, value: identifierValue });
      }
    }
  });

  if (identifiers.length > 0) {
    const rankedIdentifier = identifiers
      .map((identifier, index) => {
        const priorityIndex = normalizedPriority.indexOf(normalizeMetadataKey(identifier.type));
        return { ...identifier, index, rank: priorityIndex === -1 ? normalizedPriority.length : priorityIndex };
      })
      .sort((a, b) => a.rank - b.rank || a.index - b.index)[0];

    if (rankedIdentifier?.value) return rankedIdentifier.value;
  }

  let typedValueMatch = "";
  walkMetadata(document.metadata, (_key, _value, parent) => {
    if (typedValueMatch) return;
    const type = pickStringFromRecord(parent, ["type", "name", "label"]);
    if (!type || !normalizedPriority.includes(normalizeMetadataKey(type))) return;
    typedValueMatch = pickStringFromRecord(parent, ["value", "identifier", "number"]);
  });
  if (typedValueMatch) return typedValueMatch;

  const directIdentifier = findStringByKeys(document.metadata, identifierTypePriority);
  return directIdentifier || "-";
}

function extractDocumentDate(document: DocumentRecord) {
  const dateRangePairs = [
    ["document_period_start", "document_period_end"],
    ["statement_period_start", "statement_period_end"],
    ["period_start", "period_end"],
    ["coverage_start", "coverage_end"],
    ["start_date", "end_date"],
    ["from_date", "to_date"],
    ["effective_date", "expiry_date"],
    ["commencement_date", "expiry_date"],
  ];

  for (const [startKey, endKey] of dateRangePairs) {
    const start = findStringByKeys(document.metadata, [startKey]);
    const end = findStringByKeys(document.metadata, [endKey]);
    if (start && end) return formatDocumentDateRange(start, end);
  }

  const singleDate = findStringByKeys(document.metadata, [
    "document_date",
    "statement_date",
    "as_of_date",
    "issue_date",
    "issued_date",
    "generation_date",
    "created_date",
  ]);

  return singleDate ? formatDocumentDate(singleDate) : "-";
}

function formatDocumentDateRange(start: string, end: string) {
  const formattedStart = formatDocumentDate(start);
  const formattedEnd = formatDocumentDate(end);
  if (!formattedStart) return formattedEnd || "-";
  if (!formattedEnd || formattedStart === formattedEnd) return formattedStart;
  return `${formattedStart} - ${formattedEnd}`;
}

function formatDocumentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function pollDocumentProcessingStatus({
  documentId,
  clientId,
  onStatusChange,
}: {
  documentId: string;
  clientId: number | string;
  onStatusChange: (status: DocumentStatusResponse) => void;
}) {
  const startedAt = Date.now();
  let previousStatus: string | undefined;

  while (Date.now() - startedAt <= DOCUMENT_STATUS_POLL_TIMEOUT_MS) {
    const status = await getDocumentStatus(documentId, clientId);
    const nextStatus = status.processing_status || "";

    if (nextStatus !== previousStatus) {
      previousStatus = nextStatus;
      onStatusChange(status);
    }

    if (!isProcessing(status.processing_status)) {
      return status;
    }

    await wait(DOCUMENT_STATUS_POLL_INTERVAL_MS);
  }

  throw new Error("Document processing timed out. It may still finish shortly.");
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

  const { data: documents = [], isLoading, isFetching, refetch: refetchDocuments } = useListDocumentsQuery(clientId || undefined, {
    refetchOnMountOrArgChange: true,
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

  function patchTrayItemFromDocument(trayItemId: string, document: Pick<DocumentRecord, "processing_status"> | DocumentStatusResponse) {
    if (isProcessing(document.processing_status)) {
      dispatch(patchTrayItem({
        id: trayItemId,
        status: "uploading",
        detail: "progress" in document && document.progress?.label ? document.progress.label : "Processing document.",
        error: undefined,
      }));
    } else if (isError(document.processing_status)) {
      dispatch(patchTrayItem({
        id: trayItemId,
        status: "error",
        detail: undefined,
        error: "error" in document && document.error ? document.error : "Document processing failed.",
      }));
    } else if (isReview(document.processing_status)) {
      dispatch(patchTrayItem({ id: trayItemId, status: "review", detail: undefined, error: "Document needs review." }));
    } else {
      dispatch(patchTrayItem({ id: trayItemId, status: "complete", detail: "Document ready.", error: undefined }));
    }
  }

  async function pollUploadedDocument(documentId: string, trayItemId: string) {
    if (!clientId) return;

    try {
      const finalDocument = await pollDocumentProcessingStatus({
        documentId,
        clientId,
        onStatusChange: (document) => {
          patchTrayItemFromDocument(trayItemId, document);
          void refetchDocuments();
        },
      });

      patchTrayItemFromDocument(trayItemId, finalDocument);
      void refetchDocuments();
    } catch (error) {
      dispatch(patchTrayItem({
        id: trayItemId,
        status: "error",
        detail: undefined,
        error: getRequestErrorMessage(error, "Document status polling failed."),
      }));
      void refetchDocuments();
    }
  }

  async function handleUploadFiles(files: File[]) {
    setUploadError("");

    if (!clientId) {
      setUploadError("Select a client before uploading documents.");
      return;
    }

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
        const uploadResponse = await uploadBrokerStatement({ file, name: file.name, clientId }).unwrap();
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

        void refetchDocuments();
        void pollUploadedDocument(documentId, trayItem.id);
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
      await deleteDocument(clientId ? { id: documentId, clientId } : documentId).unwrap();
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
            {isLoading ? "" : `${filteredDocuments.length} document${filteredDocuments.length !== 1 ? "s" : ""}`}
            {isFetching && !isLoading && filteredDocuments.length > 0 ? " · Refreshing" : ""}
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
            <div className="grid min-h-[220px] place-items-center rounded-2xl border border-gray-200 bg-white p-8">
              <ClientLottie src="/loader.json" style={{ width: 120, height: 120 }} />
            </div>
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
    ["Document type", extractDocumentType(document)],
    ["Provider", extractProvider(document)],
    ["Identification", extractIdentification(document)],
    ["Document date", extractDocumentDate(document)],
  ];

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      {isLoading ? <p className="mb-4 text-sm text-gray-500">Loading document details...</p> : null}
      <div className="divide-y divide-gray-100">
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[180px_minmax(0,1fr)_24px] items-center gap-4 py-4 max-sm:grid-cols-[1fr_24px]">
            <p className="m-0 text-sm text-gray-500 max-sm:col-span-2">{label}</p>
            <p className="m-0 break-words text-sm font-medium text-gray-900">{value}</p>
            <img src="/icons/documents/check-circle.svg" alt="" className="h-5 w-5 justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}
