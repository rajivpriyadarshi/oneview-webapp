"use client";

import React, { useMemo, useState, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";

export type VaultDocument = {
  id: string;
  filename: string;
  uploadedOn: string;
  uploadedOnRaw: string;
  uploadedBy: string;
  size: string;
  type: string;
  status: string;
  fileType: string;
  fileUrl?: string;
  account?: string;
  holdingsCount?: number;
  holdingsValue?: number;
};

type Props = {
  documents: VaultDocument[];
  loading?: boolean;
  deleting?: boolean;
  onRequestDelete?: (documents: VaultDocument[]) => void;
};

const columnHelper = createColumnHelper<VaultDocument>();

const GROUP_OPTIONS = ["Account", "Type", "Status"] as const;
type GroupOption = (typeof GROUP_OPTIONS)[number];

function formatHoldingsValue(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function getGroupKey(doc: VaultDocument, groupBy: GroupOption): string {
  switch (groupBy) {
    case "Account":
      return doc.account || "Unknown";
    case "Type":
      return doc.type || "Other";
    case "Status":
      return doc.status || "Unknown";
    default:
      return "Unknown";
  }
}

function groupDocuments(
  documents: VaultDocument[],
  groupBy: GroupOption
): Map<string, VaultDocument[]> {
  const groups = new Map<string, VaultDocument[]>();
  for (const doc of documents) {
    const key = getGroupKey(doc, groupBy);
    const existing = groups.get(key) || [];
    existing.push(doc);
    groups.set(key, existing);
  }
  return groups;
}

type ViewMode = "list" | "folder" | "timeline";

export default function DocumentsTable({
  documents,
  loading = false,
  deleting = false,
  onRequestDelete,
}: Props) {
  const { trackClick } = useAnalytics();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupOption>("Account");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const selectedDocuments = documents.filter((document) =>
    selectedRows.has(document.id)
  );
  const centerAlignedColumns = new Set([
    "actions",
  ]);
  const columnWidths: Record<string, string> = {
    checkbox: "4%",
    filename: "40%",
    uploadedOn: "24%",
    type: "16%",
    actions: "16%",
  };

  const groupedDocuments = useMemo(
    () => groupDocuments(documents, groupBy),
    [documents, groupBy]
  );

  const toggleAll = () => {
    const isSelectingAll = selectedRows.size !== documents.length;

    trackClick({
      buttonName: isSelectingAll
        ? trackingEventsMap.documentsVaultPage.CLICK_CHECKBOX_SELECT_ALL
        : trackingEventsMap.documentsVaultPage.CLICK_CHECKBOX_DESELECT_ALL,
      pageName: trackingEventsMap.documentsVaultPage.PAGE,
      params: {
        total_documents: documents.length,
        previously_selected: selectedRows.size,
      },
    });

    if (isSelectingAll) {
      setSelectedRows(new Set(documents.map((document) => document.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const toggleRow = (id: string) => {
    const isCurrentlySelected = selectedRows.has(id);

    trackClick({
      buttonName: isCurrentlySelected
        ? trackingEventsMap.documentsVaultPage.CLICK_CHECKBOX_DESELECT_ROW
        : trackingEventsMap.documentsVaultPage.CLICK_CHECKBOX_SELECT_ROW,
      pageName: trackingEventsMap.documentsVaultPage.PAGE,
      params: {
        document_id: id,
        total_selected_before: selectedRows.size,
        total_selected_after: isCurrentlySelected
          ? selectedRows.size - 1
          : selectedRows.size + 1,
      },
    });

    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const requestDelete = () => {
    if (selectedDocuments.length === 0 || deleting) {
      return;
    }

    trackClick({
      buttonName: trackingEventsMap.documentsVaultPage.CLICK_DELETE_BUTTON,
      pageName: trackingEventsMap.documentsVaultPage.PAGE,
      params: {
        files_count: selectedDocuments.length,
      },
    });

    onRequestDelete?.(selectedDocuments);
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "checkbox",
        header: () => (
          <span
            className={`relative block h-[18px] w-[18px] cursor-pointer rounded border-[1.5px] ${
              selectedRows.size === documents.length && documents.length > 0
                ? "border-[#1a1a1a] bg-[#1a1a1a]"
                : "border-[#d4d4d4] bg-white"
            }`}
            onClick={toggleAll}
          >
            {selectedRows.size === documents.length && documents.length > 0 ? (
              <span className="absolute left-[5px] top-[2px] h-[9px] w-[5px] rotate-45 border-b-2 border-r-2 border-white" />
            ) : null}
          </span>
        ),
        cell: ({ row }) => (
          <span
            className={`relative block h-[18px] w-[18px] cursor-pointer rounded border-[1.5px] ${
              selectedRows.has(row.original.id)
                ? "border-[#1a1a1a] bg-[#1a1a1a]"
                : "border-[#d4d4d4] bg-white"
            }`}
            onClick={() => toggleRow(row.original.id)}
          >
            {selectedRows.has(row.original.id) ? (
              <span className="absolute left-[5px] top-[2px] h-[9px] w-[5px] rotate-45 border-b-2 border-r-2 border-white" />
            ) : null}
          </span>
        ),
      }),
      columnHelper.accessor("filename", {
        header: "Filename",
        cell: (info) => {
          const doc = info.row.original;
          const hasExtractedData = doc.holdingsCount || doc.holdingsValue;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <FileIcon type={doc.fileType} />
              <div className="min-w-0 flex flex-col justify-center">
                <span
                  className="block min-w-0 truncate whitespace-nowrap font-satoshi text-[16px] font-medium tracking-[-0.64px] text-black"
                  style={{ fontFeatureSettings: "'ss03' on" }}
                  title={info.getValue()}
                >
                  {info.getValue()}
                </span>
                {hasExtractedData && (
                  <span
                    className="block text-[13px] font-normal text-black/50 mt-0.5"
                    style={{ fontFeatureSettings: "'ss03' on" }}
                  >
                    {doc.holdingsCount && `${doc.holdingsCount} holdings`}
                    {doc.holdingsCount && doc.holdingsValue && " · "}
                    {doc.holdingsValue && formatHoldingsValue(doc.holdingsValue)}
                  </span>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("uploadedOn", {
        header: "Uploaded on",
        cell: (info) => (
          <span
            className="overflow-hidden truncate whitespace-nowrap font-satoshi text-[14px] font-normal leading-[60px] text-black/50"
            style={{ fontFeatureSettings: "'ss03' on", letterSpacing: "-0.01em" }}
          >
            {info.getValue()}
          </span>
        ),
      }),
            columnHelper.accessor("type", {
        header: "Type",
        cell: (info) => (
          <span
            className="overflow-hidden truncate font-satoshi text-[14px] font-normal leading-[60px] text-black/50"
            style={{ fontFeatureSettings: "'ss03' on", letterSpacing: "-0.01em" }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-2.5">
            <a
              className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-full bg-black text-white transition-all duration-200 hover:bg-black/85 hover:scale-110 hover:shadow-lg"
              href={row.original.fileUrl || "#"}
              download
              aria-label="Download document"
              title="Download"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M14 10V10.8C14 11.9201 14 12.4802 13.782 12.908C13.5903 13.2843 13.2843 13.5903 12.908 13.782C12.4802 14 11.9201 14 10.8 14H5.2C4.07989 14 3.51984 14 3.09202 13.782C2.71569 13.5903 2.40973 13.2843 2.21799 12.908C2 12.4802 2 11.9201 2 10.8V10M4.66667 6.66667L8 10L11.3333 6.66667M8 10V2"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        ),
      }),
    ],
    [selectedRows, documents.length, deleting, onRequestDelete]
  );

  const handleSortingChange = (
    updaterOrValue: SortingState | ((old: SortingState) => SortingState)
  ) => {
    setSorting((prevSorting) => {
      const newSorting =
        typeof updaterOrValue === "function"
          ? updaterOrValue(prevSorting)
          : updaterOrValue;

      if (
        newSorting.length > 0 &&
        JSON.stringify(newSorting) !== JSON.stringify(prevSorting)
      ) {
        const sortInfo = newSorting[0];
        trackClick({
          buttonName: trackingEventsMap.documentsVaultPage.CLICK_SORT_COLUMN,
          pageName: trackingEventsMap.documentsVaultPage.PAGE,
          params: {
            column: sortInfo.id,
            direction: sortInfo.desc ? "desc" : "asc",
          },
        });
      }

      return newSorting;
    });
  };

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="mb-7 flex flex-col rounded-[32px] bg-white px-[16px] pl-[24px]">
      <div className="mb-0 flex min-h-[100px] items-center justify-between gap-4 py-[24px]">
        <h3
          className="m-0 flex items-center gap-2 font-satoshi text-[16px] font-bold leading-[130%] tracking-[-0.02em] text-black"
          style={{ fontFeatureSettings: "'ss03' on" }}
        >
          <DocumentsIcon />
          Added statements
        </h3>
        <div className="flex items-center gap-3">
          {selectedDocuments.length > 0 && (
            <button
              type="button"
              className="cursor-pointer rounded-full border border-red-600/20 bg-red-600/10 px-4 py-2 font-satoshi font-bold text-red-700 transition hover:bg-red-600/15 disabled:cursor-not-allowed disabled:opacity-35"
              style={{ fontFeatureSettings: "'ss03' on", fontSize: "14px" }}
              disabled={deleting}
              onClick={requestDelete}
            >
              {deleting ? "Deleting..." : `Delete (${selectedDocuments.length})`}
            </button>
          )}
          {viewMode === "list" && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-black/12 px-4 py-2 transition-all duration-200 hover:border-black/25 hover:bg-black/[0.02]">
              <span className="text-[14px] font-normal text-black/60 whitespace-nowrap">
                Group by:
              </span>
              <div className="inline-flex items-center gap-1">
                <select
                  className="appearance-none border-none bg-transparent text-[14px] font-semibold text-black cursor-pointer outline-none"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupOption)}
                >
                  {GROUP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="pointer-events-none text-black flex-shrink-0"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          )}
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>
      {viewMode === "list" ? (
        <div className="overflow-x-auto pb-4">
          <table className="w-full min-w-0 border-separate border-spacing-0">
            <thead className="table w-full table-fixed">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`sticky top-0 z-10 border-y border-black/10 bg-white px-4 py-0 font-satoshi text-[14px] font-medium leading-[60px] text-[#74747E] ${
                        header.id === "checkbox" ? "w-10" : ""
                      } ${
                        centerAlignedColumns.has(header.id)
                          ? "text-center"
                          : "text-left"
                      }`}
                      style={{
                        cursor: header.column.getCanSort() ? "pointer" : "default",
                        width: columnWidths[header.id] ?? undefined,
                        fontFeatureSettings: "'ss03' on",
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.id !== "checkbox" && header.id !== "actions" && (
                        <SortIndicator direction={header.column.getIsSorted()} />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="mt-2 mb-2 block">
              {loading && (
                <tr className="table w-full table-fixed">
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px" }}>
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && documents.length === 0 && (
                <tr className="table w-full table-fixed">
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--muted)",
                    }}
                  >
                    No documents found
                  </td>
                </tr>
              )}
              {!loading &&
                (() => {
                  const hasMultipleGroups = groupedDocuments.size > 1;
                  return Array.from(groupedDocuments.entries()).map(
                    ([groupName, groupDocs]) => {
                      const groupRows = table
                        .getRowModel()
                        .rows.filter((row) =>
                          groupDocs.some((doc) => doc.id === row.original.id)
                        );
                      const latestDoc = groupDocs.reduce(
                        (latest, doc) =>
                          new Date(doc.uploadedOnRaw) >
                          new Date(latest.uploadedOnRaw)
                            ? doc
                            : latest,
                        groupDocs[0]
                      );

                      const rowElements = groupRows.map((row) => (
                        <tr key={row.id} className="table w-full table-fixed">
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className={`border-b border-black/10 bg-transparent px-4 py-[16px] ${
                                cell.column.id === "checkbox"
                                  ? "w-10"
                                  : ""
                              } ${
                                centerAlignedColumns.has(cell.column.id)
                                  ? "text-center"
                                  : "text-left"
                              } ${
                                cell.column.id !== "checkbox" &&
                                cell.column.id !== "filename"
                                  ? "font-satoshi text-base font-medium leading-[60px] text-black/80"
                                  : "text-sm text-black"
                              }`}
                              style={{
                                width: columnWidths[cell.column.id] ?? undefined,
                                fontFeatureSettings: "'ss03' on",
                              }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </td>
                          ))}
                        </tr>
                      ));

                      if (!hasMultipleGroups) {
                        return <React.Fragment key={groupName}>{rowElements}</React.Fragment>;
                      }

                      return (
                        <GroupSection
                          key={groupName}
                          groupName={groupName}
                          count={groupDocs.length}
                          columnWidths={columnWidths}
                          centerAlignedColumns={centerAlignedColumns}
                          lastUpdated={latestDoc?.uploadedOn}
                        >
                          {rowElements}
                        </GroupSection>
                      );
                    }
                  );
                })()}
            </tbody>
          </table>
        </div>
      ) : viewMode === "folder" ? (
        <FolderView
          groupedDocuments={groupedDocuments}
          loading={loading}
          selectedRows={selectedRows}
          onToggleRow={toggleRow}
        />
      ) : (
        <TimelineView
          documents={documents}
          loading={loading}
          selectedRows={selectedRows}
          onToggleRow={toggleRow}
        />
      )}
    </section>
  );
}

function DocumentsIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
      <path
        d="M4.99527 6.77795L1.42773 8.56172L8.30754 12.0016C8.40114 12.0484 8.44794 12.0718 8.49703 12.081C8.5405 12.0892 8.58512 12.0892 8.6286 12.081C8.67768 12.0718 8.72448 12.0484 8.81808 12.0016L15.6979 8.56172L12.1303 6.77795M4.99527 10.3455L1.42773 12.1293L8.30754 15.5692C8.40114 15.616 8.44794 15.6394 8.49703 15.6486C8.5405 15.6567 8.58512 15.6567 8.6286 15.6486C8.67768 15.6394 8.72448 15.616 8.81808 15.5692L15.6979 12.1293L12.1303 10.3455M1.42773 4.99418L8.30754 1.55428C8.40114 1.50748 8.44794 1.48408 8.49703 1.47487C8.5405 1.46671 8.58512 1.46671 8.6286 1.47487C8.67768 1.48408 8.72448 1.50748 8.81808 1.55428L15.6979 4.99418L8.81808 8.43408C8.72448 8.48088 8.67768 8.50428 8.6286 8.51349C8.58512 8.52165 8.5405 8.52165 8.49703 8.51349C8.44794 8.50428 8.40114 8.48088 8.30754 8.43408L1.42773 4.99418Z"
        stroke="currentColor"
        strokeWidth="1.42702"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon({ type }: { type: string }) {
  const colors: Record<
    string,
    { bg: string; text: string; docBg?: string; docFold?: string }
  > = {
    pdf: { bg: "#e31b2f", text: "white", docBg: "#F5E6E8", docFold: "#E8CDD1" },
    xls: { bg: "#217346", text: "white", docBg: "#E6F2EC", docFold: "#C9E4D5" },
    xlsx: { bg: "#217346", text: "white", docBg: "#E6F2EC", docFold: "#C9E4D5" },
    csv: { bg: "#22a768", text: "white", docBg: "#E8F5EE", docFold: "#C9E8D7" },
    docx: { bg: "#2b579a", text: "white", docBg: "#E6EBF2", docFold: "#C9D4E4" },
    png: { bg: "#8B5CF6", text: "white", docBg: "#F3EEFE", docFold: "#E4D9FC" },
    jpg: { bg: "#8B5CF6", text: "white", docBg: "#F3EEFE", docFold: "#E4D9FC" },
    jpeg: { bg: "#8B5CF6", text: "white", docBg: "#F3EEFE", docFold: "#E4D9FC" },
    file: { bg: "#6b7280", text: "white", docBg: "#E5E7EB", docFold: "#D1D5DB" },
  };
  const { bg, text, docBg, docFold } = colors[type] ?? colors.file;
  const isImage = ["png", "jpg", "jpeg"].includes(type);

  if (isImage) {
    return (
      <div className="relative flex-shrink-0">
        <svg width="28" height="34" viewBox="0 0 48 56" fill="none">
          <path
            d="M4 4C4 1.79086 5.79086 0 8 0H30L44 14V52C44 54.2091 42.2091 56 40 56H8C5.79086 56 4 54.2091 4 52V4Z"
            fill={docBg}
          />
          <path
            d="M30 0L44 14H34C31.7909 14 30 12.2091 30 10V0Z"
            fill={docFold}
          />
          <circle cx="16" cy="24" r="4" fill={bg} opacity="0.6" />
          <path d="M8 34L16 26L22 32L28 24L36 34H8Z" fill={bg} opacity="0.6" />
          <rect x="8" y="36" width="28" height="14" rx="2" fill={bg} />
        </svg>
        <span
          className="absolute bottom-[5px] left-1/2 -translate-x-1/2 text-[5px] font-bold uppercase"
          style={{ color: text }}
        >
          {type}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0">
      <svg width="28" height="34" viewBox="0 0 48 56" fill="none">
        <path
          d="M4 4C4 1.79086 5.79086 0 8 0H30L44 14V52C44 54.2091 42.2091 56 40 56H8C5.79086 56 4 54.2091 4 52V4Z"
          fill={docBg}
        />
        <path
          d="M30 0L44 14H34C31.7909 14 30 12.2091 30 10V0Z"
          fill={docFold}
        />
        <rect x="8" y="36" width="28" height="14" rx="2" fill={bg} />
      </svg>
      <span
        className="absolute bottom-[5px] left-1/2 -translate-x-1/2 text-[5px] font-bold uppercase"
        style={{ color: text }}
      >
        {type === "xlsx" ? "xls" : type}
      </span>
    </div>
  );
}

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  return (
    <svg
      width="10"
      height="12"
      viewBox="0 0 6 9"
      fill="none"
      className="ml-1 inline-block align-middle"
    >
      <path
        d="M0.5 3L3 0.5L5.5 3"
        stroke="black"
        strokeOpacity={direction === "asc" ? "1" : "0.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.5 6L3 8.5L5.5 6"
        stroke="black"
        strokeOpacity={direction === "desc" ? "1" : "0.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="absolute right-0 pointer-events-none text-black"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const BROKER_ICONS: Record<string, string> = {
  Zerodha: "/broker-icons/zerodha.png",
  IBKR: "/broker-icons/ibkr.png",
  Fidelity: "/broker-icons/fidelity.png",
  Groww: "/broker-icons/groww.png",
  Vested: "/broker-icons/vested.png",
  "Charles Schwab": "/broker-icons/shwab.png",
};

function GroupSection({
  groupName,
  count,
  children,
  columnWidths,
  centerAlignedColumns,
  lastUpdated,
}: {
  groupName: string;
  count: number;
  children: React.ReactNode;
  columnWidths: Record<string, string>;
  centerAlignedColumns: Set<string>;
  lastUpdated?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const brokerIcon = BROKER_ICONS[groupName];

  return (
    <>
      <tr
        className="table w-full table-fixed cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td colSpan={5} className="bg-transparent px-4 pt-8 pb-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              {brokerIcon ? (
                <img
                  src={brokerIcon}
                  alt={groupName}
                  className="w-5 h-5 rounded-full object-contain"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-gray-500"
                  >
                    <path
                      d="M19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M9 7H7V9H9V7Z" fill="currentColor" />
                    <path d="M9 11H7V13H9V11Z" fill="currentColor" />
                    <path d="M9 15H7V17H9V15Z" fill="currentColor" />
                    <path d="M17 7H11V9H17V7Z" fill="currentColor" />
                    <path d="M17 11H11V13H17V11Z" fill="currentColor" />
                    <path d="M17 15H11V17H17V15Z" fill="currentColor" />
                  </svg>
                </span>
              )}
              <span className="font-semibold text-sm text-[#1a1a1a]">
                {groupName} ({count})
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={`flex-shrink-0 transition-transform duration-200 text-black/50 ${isExpanded ? "rotate-90" : ""}`}
              >
                <path
                  d="M4.5 3L7.5 6L4.5 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex-1 h-[1px]" style={{ backgroundImage: "repeating-linear-gradient(to right, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 8px, transparent 8px, transparent 12px)" }} />
            {/* {lastUpdated && (
              <span className="text-[12px] italic text-[#7f4e0c85]">
                Last updated on {lastUpdated}
              </span>
            )} */}
          </div>
        </td>
      </tr>
      {isExpanded && children}
    </>
  );
}

function ViewToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center rounded-full border border-black/12 p-1 transition-all duration-200 hover:border-black/25">
      <button
        type="button"
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
          viewMode === "list"
            ? "bg-black text-white"
            : "bg-transparent text-black/50 hover:text-black"
        }`}
        onClick={() => onViewModeChange("list")}
        title="List view"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 4H14M2 8H14M2 12H14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
          viewMode === "folder"
            ? "bg-black text-white"
            : "bg-transparent text-black/50 hover:text-black"
        }`}
        onClick={() => onViewModeChange("folder")}
        title="Folder view"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect
            x="2"
            y="2"
            width="5"
            height="5"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="2"
            width="5"
            height="5"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="2"
            y="9"
            width="5"
            height="5"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="9"
            width="5"
            height="5"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      <button
        type="button"
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
          viewMode === "timeline"
            ? "bg-black text-white"
            : "bg-transparent text-black/50 hover:text-black"
        }`}
        onClick={() => onViewModeChange("timeline")}
        title="Timeline view"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect
            x="2"
            y="2.5"
            width="12"
            height="11"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M2 6H14" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5.5 1V3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M10.5 1V3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

function FolderView({
  groupedDocuments,
  loading,
  selectedRows,
  onToggleRow,
}: {
  groupedDocuments: Map<string, VaultDocument[]>;
  loading: boolean;
  selectedRows: Set<string>;
  onToggleRow: (id: string) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-black/50">Loading...</span>
      </div>
    );
  }

  if (groupedDocuments.size === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-black/50">No documents found</span>
      </div>
    );
  }

  return (
    <div className="pb-4 space-y-6">
      {Array.from(groupedDocuments.entries()).map(([groupName, docs]) => {
        const brokerIcon = BROKER_ICONS[groupName];
        const isCollapsed = collapsedGroups.has(groupName);
        const latestDoc = docs.reduce(
          (latest, doc) =>
            new Date(doc.uploadedOnRaw) > new Date(latest.uploadedOnRaw)
              ? doc
              : latest,
          docs[0]
        );

        return (
          <div key={groupName}>
            <div className="flex items-center gap-4 mb-4 px-2">
              <button
                type="button"
                className="flex items-center gap-2 hover:opacity-70 transition flex-shrink-0"
                onClick={() => toggleGroup(groupName)}
              >
                {brokerIcon ? (
                  <img
                    src={brokerIcon}
                    alt={groupName}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M2 4C2 2.89543 2.89543 2 4 2H7L8.5 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z"
                        fill="currentColor"
                        fillOpacity="0.5"
                      />
                    </svg>
                  </div>
                )}
                <span className="font-semibold text-sm text-[#1a1a1a]">
                  {groupName} ({docs.length})
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="flex-1 h-[1px]" style={{ backgroundImage: "repeating-linear-gradient(to right, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 8px, transparent 8px, transparent 12px)" }} />
              {/* <span
                className="text-[12px] font-normal italic text-[#7f4e0c85]"
                style={{ fontFeatureSettings: "'ss03' on" }}
              >
                Last updated on{" "}
                {new Date(latestDoc.uploadedOnRaw).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span> */}
            </div>

            {!isCollapsed && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`relative flex flex-col items-center gap-1 px-4 py-[32px] rounded-[28px] cursor-pointer transition-all group border ${
                      selectedRows.has(doc.id)
                        ? "bg-blue-50 ring-2 ring-blue-500 border-blue-200"
                        : "bg-[#fafafa] border-black/5 hover:bg-[#f5f5f5] hover:border-black/10"
                    }`}
                    onClick={() => onToggleRow(doc.id)}
                  >
                    <div className="relative">
                      <FileIconLarge type={doc.fileType} />
                      {selectedRows.has(doc.id) && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2 6L5 9L10 3"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <Tooltip text={doc.filename}>
                      <p className="text-xs text-center text-[#1a1a1a] font-medium truncate max-w-[160px]">
                        {doc.filename}
                      </p>
                    </Tooltip>
                    <Tooltip text={doc.uploadedOn}>
                      <p className="text-[12px] text-black/50 truncate max-w-[160px]">
                        {doc.uploadedOn}
                      </p>
                    </Tooltip>
                    {selectedRows.has(doc.id) && (
                      <a
                        href={doc.fileUrl || "#"}
                        download
                        className="absolute bottom-2 right-2 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 hover:shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                        title="Download"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M14 10V10.8C14 11.9201 14 12.4802 13.782 12.908C13.5903 13.2843 13.2843 13.5903 12.908 13.782C12.4802 14 11.9201 14 10.8 14H5.2C4.07989 14 3.51984 14 3.09202 13.782C2.71569 13.5903 2.40973 13.2843 2.21799 12.908C2 12.4802 2 11.9201 2 10.8V10M4.66667 6.66667L8 10L11.3333 6.66667M8 10V2"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineView({
  documents,
  loading,
  selectedRows,
  onToggleRow,
}: {
  documents: VaultDocument[];
  loading: boolean;
  selectedRows: Set<string>;
  onToggleRow: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-black/50">Loading...</span>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-black/50">No documents found</span>
      </div>
    );
  }

  const sortedDocs = [...documents].sort(
    (a, b) =>
      new Date(b.uploadedOnRaw).getTime() - new Date(a.uploadedOnRaw).getTime()
  );

  const groupedByMonth = sortedDocs.reduce(
    (acc, doc) => {
      const date = new Date(doc.uploadedOnRaw);
      const monthKey = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(doc);
      return acc;
    },
    {} as Record<string, VaultDocument[]>
  );

  return (
    <div className="pb-4 px-4">
      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-black/10" />

        {Object.entries(groupedByMonth).map(([monthKey, docs]) => (
          <div key={monthKey} className="relative mb-8 last:mb-0">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-white border-2 border-black/10 flex items-center justify-center z-10">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect
                    x="2"
                    y="3"
                    width="14"
                    height="13"
                    rx="2"
                    stroke="black"
                    strokeWidth="1.5"
                  />
                  <path d="M2 7H16" stroke="black" strokeWidth="1.5" />
                  <path
                    d="M6 1V4"
                    stroke="black"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 1V4"
                    stroke="black"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="font-semibold text-sm text-[#1a1a1a]">
                {monthKey}
              </span>
            </div>

            <div className="ml-14 space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center gap-4 p-4 rounded-[28px] cursor-pointer transition-all hover:bg-[#f5f5f5] ${
                    selectedRows.has(doc.id)
                      ? "bg-blue-50 ring-2 ring-blue-500"
                      : "bg-[#fafafa]"
                  }`}
                  onClick={() => onToggleRow(doc.id)}
                >
                  <div className="relative flex-shrink-0">
                    <FileIcon type={doc.fileType} />
                    {selectedRows.has(doc.id) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Tooltip text={doc.filename}>
                      <p className="font-medium text-sm text-[#1a1a1a] truncate">
                        {doc.filename}
                      </p>
                    </Tooltip>
                    <p className="text-xs text-black/50 -mt-0.5">
                      {doc.account || "Unknown"}
                      {doc.holdingsCount && ` · ${doc.holdingsCount} holdings`}
                      {doc.holdingsValue &&
                        ` · ${formatHoldingsValue(doc.holdingsValue)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-black/40">
                      {new Date(doc.uploadedOnRaw).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      at{" "}
                      {new Date(doc.uploadedOnRaw).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {selectedRows.has(doc.id) && (
                      <a
                        href={doc.fileUrl || "#"}
                        download
                        className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                        title="Download"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M14 10V10.8C14 11.9201 14 12.4802 13.782 12.908C13.5903 13.2843 13.2843 13.5903 12.908 13.782C12.4802 14 11.9201 14 10.8 14H5.2C4.07989 14 3.51984 14 3.09202 13.782C2.71569 13.5903 2.40973 13.2843 2.21799 12.908C2 12.4802 2 11.9201 2 10.8V10M4.66667 6.66667L8 10L11.3333 6.66667M8 10V2"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileIconLarge({ type }: { type: string }) {
  const colors: Record<
    string,
    { bg: string; text: string; docBg?: string; docFold?: string }
  > = {
    pdf: { bg: "#e31b2f", text: "white", docBg: "#F5E6E8", docFold: "#E8CDD1" },
    xls: { bg: "#217346", text: "white", docBg: "#E6F2EC", docFold: "#C9E4D5" },
    xlsx: { bg: "#217346", text: "white", docBg: "#E6F2EC", docFold: "#C9E4D5" },
    csv: { bg: "#22a768", text: "white", docBg: "#E8F5EE", docFold: "#C9E8D7" },
    docx: { bg: "#2b579a", text: "white", docBg: "#E6EBF2", docFold: "#C9D4E4" },
    png: { bg: "#8B5CF6", text: "white", docBg: "#F3EEFE", docFold: "#E4D9FC" },
    jpg: { bg: "#8B5CF6", text: "white", docBg: "#F3EEFE", docFold: "#E4D9FC" },
    jpeg: { bg: "#8B5CF6", text: "white", docBg: "#F3EEFE", docFold: "#E4D9FC" },
    file: { bg: "#6b7280", text: "white", docBg: "#E5E7EB", docFold: "#D1D5DB" },
  };
  const { bg, text, docBg, docFold } = colors[type] ?? colors.file;
  const isImage = ["png", "jpg", "jpeg"].includes(type);

  if (isImage) {
    return (
      <div className="relative">
        <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
          <path
            d="M4 4C4 1.79086 5.79086 0 8 0H30L44 14V52C44 54.2091 42.2091 56 40 56H8C5.79086 56 4 54.2091 4 52V4Z"
            fill={docBg}
          />
          <path
            d="M30 0L44 14H34C31.7909 14 30 12.2091 30 10V0Z"
            fill={docFold}
          />
          <circle cx="16" cy="24" r="4" fill={bg} opacity="0.6" />
          <path d="M8 34L16 26L22 32L28 24L36 34H8Z" fill={bg} opacity="0.6" />
          <rect x="8" y="36" width="28" height="14" rx="2" fill={bg} />
        </svg>
        <span
          className="absolute bottom-[10px] left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase"
          style={{ color: text }}
        >
          {type}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
        <path
          d="M4 4C4 1.79086 5.79086 0 8 0H30L44 14V52C44 54.2091 42.2091 56 40 56H8C5.79086 56 4 54.2091 4 52V4Z"
          fill={docBg}
        />
        <path
          d="M30 0L44 14H34C31.7909 14 30 12.2091 30 10V0Z"
          fill={docFold}
        />
        <rect x="8" y="36" width="28" height="14" rx="2" fill={bg} />
      </svg>
      <span
        className="absolute bottom-[10px] left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase"
        style={{ color: text }}
      >
        {type === "xlsx" ? "xls" : type}
      </span>
    </div>
  );
}

function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded whitespace-nowrap pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
        </div>
      )}
    </div>
  );
}
