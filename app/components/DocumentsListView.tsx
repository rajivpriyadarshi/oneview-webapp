"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import DocumentSearchBar from "./DocumentSearchBar";
import { ClientLottie } from "./ClientLottie";
import { api, useDeleteDocumentMutation, useGetDocumentQuery, useListDocumentsQuery, useUploadBrokerStatementMutation } from "../store/api";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addTrayItems, patchTrayItem } from "../store/uploadTraySlice";
import {
  getDocumentJobStatus,
  getDocumentStatus,
  type BrokerStatementUploadResponse,
  type DocumentJobStatusResponse,
  type DocumentRecord,
  type DocumentStatusResponse,
} from "../lib/documentsApi";
import { getRequestErrorMessage } from "../lib/apiClient";

const DOCUMENT_ACCEPT = ".pdf,.csv,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg";
const DOCUMENT_STATUS_POLL_INTERVAL_MS = 15000;
const DOCUMENT_STATUS_POLL_TIMEOUT_MS = 5 * 60 * 1000;

type SortOption = "Most recent" | "Oldest first" | "A-Z" | "Z-A";

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

// Modifier on .doc-tag (Figma 2446:21016). Returns "" for the neutral grey pill.
function getStatusTagVariant(status?: string | null) {
  const normalized = status?.toLowerCase();
  if (isError(normalized)) return "alert";
  if (isReview(normalized)) return "review";
  return "";
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

// "spot" tiles exported from the Figma vault rows (2446:20963 / 21007 / 21029 /
// 21043 / 21057 / 21071) — the same orange-gradient 64px tile the interactions
// timeline uses, with a different glyph per family. The older pastel
// `ic-*.png` set is a different visual language and is no longer used here.
// Figma only draws six glyphs, so several families share one; the ordering
// below matters, since the first substring hit wins.
const DOCUMENT_SPOTS: [string, string][] = [
  ["insurance", "/icons/documents/spot-verified.png"],
  ["certificate", "/icons/documents/spot-verified.png"],
  ["trust", "/icons/documents/spot-book.png"],
  ["will", "/icons/documents/spot-book.png"],
  ["deed", "/icons/documents/spot-book.png"],
  ["legal", "/icons/documents/spot-book.png"],
  ["agreement", "/icons/documents/spot-agreement.png"],
  ["contract", "/icons/documents/spot-agreement.png"],
  ["lease", "/icons/documents/spot-agreement.png"],
  ["property", "/icons/documents/spot-agreement.png"],
  ["real estate", "/icons/documents/spot-agreement.png"],
  ["statement", "/icons/documents/spot-chart.png"],
  ["portfolio", "/icons/documents/spot-chart.png"],
  ["holding", "/icons/documents/spot-chart.png"],
  ["banking", "/icons/documents/spot-chart.png"],
  ["valuation", "/icons/documents/spot-chart.png"],
  ["kyc", "/icons/documents/spot-folder-lock.png"],
  ["identity", "/icons/documents/spot-folder-lock.png"],
  ["custodian", "/icons/documents/spot-folder-lock.png"],
  ["compliance", "/icons/documents/spot-folder-lock.png"],
  ["account opening", "/icons/documents/spot-folder-lock.png"],
];

function getDocumentTypeIconPath(documentType: string): string {
  const normalizedType = documentType.toLowerCase();
  const match = DOCUMENT_SPOTS.find(([key]) => normalizedType.includes(key));
  return match?.[1] || "/icons/documents/spot-statement.png";
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

// Figma 2446:20967 reads "Fidelity Brokerage Account • Received on 18 Aug 2026" —
// provider first, then when it arrived. Falls back to the document type when the
// provider is unknown, so the line never starts with a bare bullet.
function buildRowSubtitle(document: DocumentRecord) {
  const provider = extractProvider(document);
  const lead = provider !== "-" ? provider : getDocumentType(document);
  return [lead, `Received on ${formatDate(document.created_at)}`].filter(Boolean).join(" • ");
}

const EXPIRY_WARNING_DAYS = 60;

// Not every document has one; when it does and it lands inside the warning
// window, the row picks up Figma's "Expires Soon" tag plus the red date in the
// trailing slot where an interaction row shows its timestamp.
function extractExpiry(document: DocumentRecord) {
  const raw = findStringByKeys(document.metadata, [
    "expiry_date",
    "expiration_date",
    "valid_until",
    "renewal_date",
    "coverage_end",
  ]);
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  const daysAway = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return {
    label: `Expires ${formatDocumentDate(raw)}`,
    isSoon: daysAway <= EXPIRY_WARNING_DAYS,
  };
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
  onStatusChange: (status: DocumentJobStatusResponse | DocumentStatusResponse) => void;
}) {
  const initialStatus = await getDocumentStatus(documentId, clientId);
  onStatusChange(initialStatus);

  if (!initialStatus.job_id) {
    if (!isProcessing(initialStatus.processing_status)) {
      return initialStatus;
    }
    throw new Error("Document is processing, but no job id was returned.");
  }

  let previousStatus: string | undefined;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= DOCUMENT_STATUS_POLL_TIMEOUT_MS) {
    const status = await getDocumentJobStatus(initialStatus.job_id);
    const nextStatus = status.status || "";

    if (nextStatus !== previousStatus) {
      previousStatus = nextStatus;
      onStatusChange(status);
    }

    if (status.status !== "processing") {
      return status;
    }

    await wait(DOCUMENT_STATUS_POLL_INTERVAL_MS);
  }

  throw new Error("Document processing timed out. It may still finish shortly.");
}

function getDocumentProcessingStatusFromJob(status?: DocumentJobStatusResponse["status"]) {
  if (status === "success") return "processed";
  if (status === "error") return "failed";
  if (status === "needs_review") return "needs_review";
  return "processing";
}

export default function DocumentsListView({ clientId }: { clientId?: number | string | null }) {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProcessingPollsRef = useRef<Set<string>>(new Set());
  const trayItems = useAppSelector((state) => state.uploadTray.items);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Most recent");
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [openMenuDocId, setOpenMenuDocId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");

  const { data: documents = [], isLoading, refetch: refetchDocuments } = useListDocumentsQuery(clientId || undefined, {
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

  // Dismiss the row's ⋮ menu on an outside click or Escape. pointerdown rather
  // than click, so the menu is gone before the row's own onClick can toggle the
  // card open; the trigger and popup both live inside [data-doc-menu], which is
  // how an inside click is excluded (the trigger keeps its own toggle).
  useEffect(() => {
    if (!openMenuDocId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-doc-menu]")) return;
      setOpenMenuDocId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuDocId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuDocId]);

  useEffect(() => {
    if (!clientId) return;

    for (const document of documents) {
      if (!isProcessing(document.processing_status)) continue;
      void pollDocumentToTerminal(String(document.id));
    }
  }, [clientId, documents]);

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

  function patchTrayItemFromDocument(
    trayItemId: string,
    document: Pick<DocumentRecord, "processing_status"> | DocumentStatusResponse | DocumentJobStatusResponse,
  ) {
    const status = "status" in document ? document.status : document.processing_status;

    if (status === "processing" || isProcessing(status)) {
      dispatch(patchTrayItem({
        id: trayItemId,
        status: "uploading",
        detail: "progress" in document && document.progress?.label ? document.progress.label : "Processing document.",
        error: undefined,
      }));
    } else if (status === "error" || isError(status)) {
      dispatch(patchTrayItem({
        id: trayItemId,
        status: "error",
        detail: undefined,
        error: "error" in document && document.error
          ? document.error
          : "message" in document && document.message
            ? document.message
            : "Document processing failed.",
      }));
    } else if (status === "needs_review" || isReview(status)) {
      dispatch(patchTrayItem({ id: trayItemId, status: "review", detail: undefined, error: "Document needs review." }));
    } else {
      dispatch(patchTrayItem({ id: trayItemId, status: "complete", detail: "Document ready.", error: undefined }));
    }
  }

  function patchDocumentInList(documentId: string, status: DocumentJobStatusResponse | DocumentStatusResponse) {
    if (!clientId) return;

    dispatch(api.util.updateQueryData("listDocuments", clientId, (draft) => {
      const document = draft.find((item) => String(item.id) === documentId);
      if (!document) return;

      if ("status" in status) {
        document.processing_status = getDocumentProcessingStatusFromJob(status.status);
        if (status.document_type) {
          document.document_type = status.document_type;
        }
        return;
      }

      if (status.processing_status) {
        document.processing_status = status.processing_status;
      }
    }));
  }

  async function pollDocumentToTerminal(documentId: string, trayItemId?: string) {
    if (!clientId) return;

    const pollKey = `${clientId}:${documentId}`;
    if (activeProcessingPollsRef.current.has(pollKey)) return;
    activeProcessingPollsRef.current.add(pollKey);

    try {
      const finalStatus = await pollDocumentProcessingStatus({
        documentId,
        clientId,
        onStatusChange: (status) => {
          patchDocumentInList(documentId, status);
          if (trayItemId) {
            patchTrayItemFromDocument(trayItemId, status);
          }
        },
      });

      patchDocumentInList(documentId, finalStatus);
      if (trayItemId) {
        patchTrayItemFromDocument(trayItemId, finalStatus);
      }
      void refetchDocuments();
    } catch (error) {
      if (trayItemId) {
        dispatch(patchTrayItem({
          id: trayItemId,
          status: "error",
          detail: undefined,
          error: getRequestErrorMessage(error, "Document status polling failed."),
        }));
      }
      void refetchDocuments();
    } finally {
      activeProcessingPollsRef.current.delete(pollKey);
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
        clientId,
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
        void pollDocumentToTerminal(documentId, trayItem.id);
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
    <div className="vault-container">
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
        <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 font-satoshi text-[14px] font-medium text-red-700">
          {uploadError}
        </p>
      ) : null}

      {/* Same shell as the interactions timeline (Figma 2446:20952), so the
          cards, spots and expand animation are shared rather than re-declared. */}
      <div className="timeline-feed">
        <div className="vault-sub-header">
          <p>
            {isLoading ? "" : `${filteredDocuments.length} document${filteredDocuments.length !== 1 ? "s" : ""}`}
          </p>
          <div className="vault-sort">
            <button type="button" className="flex items-center gap-[6px] rounded-full border-0 bg-transparent px-[10px] py-[6px] text-[rgba(13,13,13,0.7)]">
              <span>Sort: {sortBy}</span>
              <Image src="/icons/interaction/fg-chevron-down.svg" alt="" width={16} height={16} />
            </button>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
              <option value="Most recent">Most recent</option>
              <option value="Oldest first">Oldest first</option>
              <option value="A-Z">A-Z</option>
              <option value="Z-A">Z-A</option>
            </select>
          </div>
        </div>

        <div className="timeline-rows">
          {isLoading ? (
            <div className="grid min-h-[220px] place-items-center rounded-[16px] border border-black/[0.08] bg-white p-8">
              <ClientLottie src="/loader.json" style={{ width: 120, height: 120 }} />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-[16px] border border-black/[0.08] bg-white p-8 text-center font-satoshi text-[14px] text-[rgba(13,13,13,0.7)]">
              No documents found
            </div>
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
  const statusVariant = getStatusTagVariant(document.processing_status);
  // The happy path shows no pill at all, as in Figma — the tag slot is there to
  // surface processing, review and failure states.
  const showStatusTag = statusVariant !== "" || isProcessing(document.processing_status);
  const expiry = extractExpiry(detailDocument);

  return (
    <div
      className={`timeline-row ${isExpanded ? "expanded" : ""}`}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onClick={onToggleExpand}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleExpand();
        }
      }}
    >
      <div className="timeline-row-content">
        <div className="icon-wrapper">
          <Image
            src={getDocumentTypeIconPath(documentType)}
            alt=""
            width={64}
            height={64}
            className="interaction-icon"
          />
        </div>

        <div className="row-content">
          <h3 className="interaction-title">{getDisplayName(document)}</h3>
          <p className="interaction-subtitle">{buildRowSubtitle(document)}</p>
          {showStatusTag || (expiry?.isSoon && !isExpanded) ? (
            <div className="doc-tags">
              {showStatusTag ? (
                <span className={`doc-tag ${statusVariant}`}>{getStatusLabel(document.processing_status)}</span>
              ) : null}
              {expiry?.isSoon && !isExpanded ? <span className="doc-tag alert">Expires Soon</span> : null}
            </div>
          ) : null}
        </div>

        <div className="row-actions">
          {expiry && !isExpanded ? (
            <span className={expiry.isSoon ? "doc-expiry" : "timestamp"}>{expiry.label}</span>
          ) : null}

          {/* data-doc-menu marks the trigger + popup as one region, so the
              document-level dismiss listener can tell an inside click from an
              outside one without a ref per row. */}
          <div className="relative flex items-center" data-doc-menu>
            <button
              type="button"
              className="doc-menu-button"
              aria-label="Document actions"
              onClick={(event) => {
                event.stopPropagation();
                onToggleMenu();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="3" r="1.25" fill="currentColor" />
                <circle cx="8" cy="8" r="1.25" fill="currentColor" />
                <circle cx="8" cy="13" r="1.25" fill="currentColor" />
              </svg>
            </button>

            {isMenuOpen ? (
              <div className="doc-menu">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete();
                  }}
                >
                  Delete document
                </button>
              </div>
            ) : null}
          </div>

          <div className="chevron-icon" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            <Image src="/icons/interaction/fg-chevron-down.svg" alt="" width={16} height={16} />
          </div>
        </div>
      </div>

      {/* Mounted whether or not it's open, so the shared .expanded-shell grid can
          animate the height in both directions. */}
      <div className={`expanded-shell ${isExpanded ? "open" : ""}`} aria-hidden={!isExpanded}>
        <div className="expanded-body">
          <DocumentDetails document={detailDocument} isLoading={isFetchingDetail} />
          {fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="interaction-view-details"
              tabIndex={isExpanded ? undefined : -1}
              onClick={(event) => event.stopPropagation()}
            >
              View document
              <Image src="/icons/interaction/fg-arrow-right.svg" alt="" width={16} height={16} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
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
    <div className="metadata-table">
      {isLoading ? (
        <p className="m-0 py-[10px] font-satoshi text-[13px] text-[#6B7280]">Loading document details...</p>
      ) : null}
      {fields.map(([label, value]) => (
        <div key={label} className="metadata-row">
          <p className="metadata-label">{label}</p>
          <div className="metadata-value-group">
            <p>{value}</p>
            {/* Only a resolved field earns the tick, per Figma 2446:20983. */}
            {value && value !== "-" ? (
              <Image src="/icons/documents/fg-check-circle.svg" alt="" width={16} height={16} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
