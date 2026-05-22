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
};

type Props = {
  documents: Document[];
  loading?: boolean;
};

const columnHelper = createColumnHelper<Document>();

export default function DocumentsTable({ documents, loading = false }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "checkbox",
        header: () => <span className="docs-checkbox" />,
        cell: () => <span className="docs-checkbox" />,
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
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <span className="docs-status-pill">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: () => (
          <button className="docs-view-btn" type="button">
            View
          </button>
        ),
      }),
    ],
    [],
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
      <h2 className="docs-table-title">Added documents</h2>
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
                <td colSpan={8} style={{ textAlign: "center", padding: "40px" }}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && documents.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
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

function FileIcon({ type }: { type: string }) {
  return <span className={`docs-file-icon file-${type}`}>{type.toUpperCase()}</span>;
}

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  return (
    <svg viewBox="0 0 12 16" fill="none" width="10" height="14" className="docs-sort-icon">
      <path
        d="M6 2l3 4H3l3-4z"
        fill="currentColor"
        opacity={direction === "asc" ? 1 : 0.3}
      />
      <path
        d="M6 14l-3-4h6l-3 4z"
        fill="currentColor"
        opacity={direction === "desc" ? 1 : 0.3}
      />
    </svg>
  );
}
