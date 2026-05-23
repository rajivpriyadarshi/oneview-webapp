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

type Document = {
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
  documents: Document[];
  loading?: boolean;
};

const columnHelper = createColumnHelper<Document>();

const GROUP_OPTIONS = ["Account", "Type", "Status"];

export default function DocumentsTable({ documents, loading = false }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState("Account");

  const toggleAll = () => {
    if (selectedRows.size === documents.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(documents.map((_, i) => i)));
    }
  };

  const toggleRow = (index: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "checkbox",
        header: () => (
          <span
            className={`docs-checkbox${selectedRows.size === documents.length && documents.length > 0 ? " checked" : ""}`}
            onClick={toggleAll}
          />
        ),
        cell: ({ row }) => (
          <span
            className={`docs-checkbox${selectedRows.has(row.index) ? " checked" : ""}`}
            onClick={() => toggleRow(row.index)}
          />
        ),
      }),
      columnHelper.accessor("filename", {
        header: "Filename",
        cell: (info) => (
          <div className="td-filename">
            <FileIcon type={info.row.original.fileType} />
            <span>{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor("downloadedOn", {
        header: "Downloaded on",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("downloadedBy", {
        header: "Downloaded by",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("size", {
        header: "Size",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("type", {
        header: "Type",
        cell: (info) => info.getValue(),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <a
            className="docs-view-btn"
            href={row.original.fileUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            View
          </a>
        ),
      }),
    ],
    [selectedRows, documents.length],
  );

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="docs-table-section">
      <div className="docs-table-header">
        <h2 className="docs-table-title">
          <DocumentsIcon />
          Added statements
        </h2>
        <div className="docs-group-by">
          <span className="docs-group-by-label">Group by:</span>
          <div className="docs-group-by-select-wrapper">
            <select
              className="docs-group-by-select"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              {GROUP_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown />
          </div>
        </div>
      </div>
      <div className="docs-table-wrapper">
        <table className="docs-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={header.id === "checkbox" ? "th-checkbox" : ""}
                    style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
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
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && documents.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                  No documents found
                </td>
              </tr>
            )}
            {!loading &&
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cell.column.id === "checkbox" ? "td-checkbox" : ""}>
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
  return <span className={`docs-file-icon file-${type}`}>{type.toUpperCase()}</span>;
}

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  return (
    <svg width="10" height="12" viewBox="0 0 6 9" fill="none" className="docs-sort-icon">
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
