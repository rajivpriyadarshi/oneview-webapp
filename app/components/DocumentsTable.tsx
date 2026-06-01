"use client";

import { useMemo, useState } from "react";
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
  downloadedOn: string;
  downloadedBy: string;
  size: string;
  type: string;
  status: string;
  fileType: string;
  fileUrl?: string;
};

type Props = {
  documents: VaultDocument[];
  loading?: boolean;
  deleting?: boolean;
  onRequestDelete?: (documents: VaultDocument[]) => void;
};

const columnHelper = createColumnHelper<VaultDocument>();

export default function DocumentsTable({
  documents,
  loading = false,
  deleting = false,
  onRequestDelete,
}: Props) {
  const { trackClick } = useAnalytics();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const selectedDocuments = documents.filter((document) => selectedRows.has(document.id));
  const centerAlignedColumns = new Set(["uploadedOn", "uploadedBy", "size", "type", "actions"]);
  const columnWidths: Record<string, string> = {
    checkbox: "4%",
    filename: "30%",
    downloadedOn: "18%",
    downloadedBy: "16%",
    size: "8%",
    type: "12%",
    actions: "12%",
  };

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
        total_selected_after: isCurrentlySelected ? selectedRows.size - 1 : selectedRows.size + 1,
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
        cell: (info) => (
          <div className="flex min-w-0 items-center gap-3">
            <FileIcon type={info.row.original.fileType} />
            <span
              className="block min-w-0 truncate whitespace-nowrap font-satoshi text-[1rem] font-medium leading-[60px] tracking-[-0.64px] text-black"
              style={{ fontFeatureSettings: "'ss03' on" }}
              title={info.getValue()}
            >
              {info.getValue()}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("downloadedOn", {
        header: "Downloaded on",
        cell: (info) => <span className="overflow-hidden truncate whitespace-nowrap font-satoshi text-[1rem] font-medium leading-[60px] tracking-[-0.64px] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>{info.getValue()}</span>,
      }),
      columnHelper.accessor("downloadedBy", {
        header: "Downloaded by",
        cell: (info) => <span className="block overflow-hidden truncate whitespace-nowrap font-satoshi text-[1rem] font-medium leading-[60px] tracking-[-0.64px] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>{info.getValue()}</span>,
      }),
      columnHelper.accessor("size", {
        header: "Size",
        cell: (info) => <span className="overflow-hidden truncate font-satoshi text-[1rem] font-medium leading-[60px] tracking-[-0.64px] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>{info.getValue()}</span>,
      }),
      columnHelper.accessor("type", {
        header: "Type",
        cell: (info) => <span className="overflow-hidden truncate font-satoshi text-[1rem] font-medium leading-[60px] tracking-[-0.64px] text-black/50" style={{ fontFeatureSettings: "'ss03' on" }}>{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-2.5">
            <a
              className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-full bg-black text-white transition hover:bg-black/85"
              href={row.original.fileUrl || "#"}
              download
              aria-label="Download document"
              title="Download"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M14 10V10.8C14 11.9201 14 12.4802 13.782 12.908C13.5903 13.2843 13.2843 13.5903 12.908 13.782C12.4802 14 11.9201 14 10.8 14H5.2C4.07989 14 3.51984 14 3.09202 13.782C2.71569 13.5903 2.40973 13.2843 2.21799 12.908C2 12.4802 2 11.9201 2 10.8V10M4.66667 6.66667L8 10L11.3333 6.66667M8 10V2"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            {/* View button - commented out for now */}
            {/* <a
              className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-full bg-black text-white transition hover:bg-black/85"
              href={row.original.fileUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View document"
              title="View"
              onClick={() => {
                trackClick({
                  buttonName: trackingEventsMap.documentsVaultPage.CLICK_VIEW_DOCUMENT,
                  pageName: trackingEventsMap.documentsVaultPage.PAGE,
                  params: {
                    document_id: row.original.id,
                    filename: row.original.filename,
                    file_type: row.original.fileType,
                  },
                });
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M1.61342 8.4761C1.52262 8.33234 1.47723 8.26046 1.45182 8.1496C1.43273 8.06632 1.43273 7.93498 1.45182 7.85171C1.47723 7.74084 1.52262 7.66896 1.61341 7.5252C2.36369 6.33721 4.59693 3.33398 8.00027 3.33398C11.4036 3.33398 13.6369 6.33721 14.3871 7.5252C14.4779 7.66896 14.5233 7.74084 14.5487 7.85171C14.5678 7.93498 14.5678 8.06632 14.5487 8.1496C14.5233 8.26046 14.4779 8.33234 14.3871 8.4761C13.6369 9.66409 11.4036 12.6673 8.00027 12.6673C4.59693 12.6673 2.36369 9.66409 1.61342 8.4761Z"
                  stroke="white"
                  strokeWidth="1.33333"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.00027 10.0007C9.10484 10.0007 10.0003 9.10522 10.0003 8.00065C10.0003 6.89608 9.10484 6.00065 8.00027 6.00065C6.8957 6.00065 6.00027 6.89608 6.00027 8.00065C6.00027 9.10522 6.8957 10.0007 8.00027 10.0007Z"
                  stroke="white"
                  strokeWidth="1.33333"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a> */}
          </div>
        ),
      }),
    ],
    [selectedRows, documents.length, deleting, onRequestDelete],
  );

  const handleSortingChange = (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    setSorting((prevSorting) => {
      const newSorting = typeof updaterOrValue === "function" ? updaterOrValue(prevSorting) : updaterOrValue;

      // Track sorting event when sorting changes
      if (newSorting.length > 0 && JSON.stringify(newSorting) !== JSON.stringify(prevSorting)) {
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
        <h3 className="m-0 flex items-center gap-2 font-satoshi text-base font-bold leading-[130%] tracking-[-0.02em] text-black" style={{ fontFeatureSettings: "'ss03' on" }}>
          <DocumentsIcon />
          Added statements
        </h3>
        <div className="flex items-center gap-3">
          {selectedDocuments.length > 0 && (
            <button
              type="button"
              className="min-h-10 cursor-pointer rounded-full border border-red-600/20 bg-red-600/10 px-[16px] font-satoshi text-base font-bold text-red-700 transition hover:bg-red-600/15 disabled:cursor-not-allowed disabled:opacity-35"
              style={{ fontFeatureSettings: "'ss03' on" }}
              disabled={deleting}
              onClick={requestDelete}
            >
              {deleting ? "Deleting..." : `Delete (${selectedDocuments.length})`}
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto pb-4">
        <table className="w-full min-w-0 border-separate border-spacing-0">
          <thead className="table w-full table-fixed">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`sticky top-0 z-10 border-y border-black/10 bg-white px-4 py-0 font-satoshi text-sm font-medium leading-[60px] text-[#74747E] ${
                      header.id === "checkbox" ? "w-10" : ""
                    } ${
                      header.id === "checkbox" || header.id === "filename"
                        ? "text-left"
                        : centerAlignedColumns.has(header.id)
                          ? "text-center"
                          : ""
                    }`}
                    style={{
                      cursor: header.column.getCanSort() ? "pointer" : "default",
                      width: columnWidths[header.id] ?? undefined,
                      fontFeatureSettings: "'ss03' on",
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.id !== "checkbox" && header.id !== "actions" && (
                      <SortIndicator direction={header.column.getIsSorted()} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="mt-2 mb-2 block max-h-[70vh] overflow-y-auto">
            {loading && (
              <tr className="table w-full table-fixed">
                <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && documents.length === 0 && (
              <tr className="table w-full table-fixed">
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                  No documents found
                </td>
              </tr>
            )}
            {!loading &&
              table.getRowModel().rows.map((row, renderIndex) => (
                <tr
                  key={row.id}
                  className={`table w-full table-fixed`}
                >
                  {row.getVisibleCells().map((cell, cellIndex) => (
                    <td
                      key={cell.id}
                      className={`border-b border-black/10 bg-transparent px-4 py-[24px] ${
                        cell.column.id === "checkbox" ? "w-10 text-left" : ""
                      } ${
                        cell.column.id === "filename"
                          ? "text-left"
                          : centerAlignedColumns.has(cell.column.id)
                            ? "text-center"
                            : ""
                      } ${
                        cell.column.id !== "checkbox" && cell.column.id !== "filename"
                          ? "font-satoshi text-base font-medium leading-[60px] text-black/80"
                          : "text-sm text-black"
                      }`}
                      style={{
                        width: columnWidths[cell.column.id] ?? undefined,
                        fontFeatureSettings: "'ss03' on",
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
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
  const styles: Record<string, string> = {
    xls: "bg-[linear-gradient(90deg,#128044_0_35%,#21a365_35%_100%)]",
    pdf: "bg-[#e31b2f]",
    png: "bg-[linear-gradient(135deg,#dfe6ee_0_62%,#b6c4d4_62%)] text-[#6958ff]",
    docx: "bg-[#2b579a]",
    csv: "bg-[#22a768]",
    file: "bg-[#6b7280]",
  };
  const style = styles[type] ?? styles.file;
  return (
    <span className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded text-[7px] font-black uppercase text-white ${style}`}>
      {type.toUpperCase()}
    </span>
  );
}

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  return (
    <svg width="10" height="12" viewBox="0 0 6 9" fill="none" className="ml-1 inline-block align-middle">
      <path d="M0.5 3L3 0.5L5.5 3" stroke="black" strokeOpacity={direction === "asc" ? "1" : "0.5"} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M0.5 6L3 8.5L5.5 6" stroke="black" strokeOpacity={direction === "desc" ? "1" : "0.5"} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="docs-group-chevron">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
