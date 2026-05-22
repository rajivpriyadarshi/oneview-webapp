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
import { type HoldingPosition } from "../lib/portfolioDataApi";

type Props = {
  holdings: HoldingPosition[];
  loading: boolean;
};

const columnHelper = createColumnHelper<HoldingPosition>();

export default function HoldingsTable({ holdings, loading }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "security",
        header: "Security",
        cell: (info) => {
          const row = info.row.original;
          const ticker = row.ticker_symbol || row.ticker || "—";
          const name = row.security_name || row.name || row.type || "";
          return (
            <div>
              <span className="security-ticker">{ticker}</span>
              <span className="security-name">{name}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("quantity", {
        header: "Quantity",
        cell: (info) => {
          const num = parseFloat(info.getValue());
          return num % 1 === 0 ? num.toString() : num.toFixed(4).replace(/0+$/, "");
        },
      }),
      columnHelper.display({
        id: "current_price",
        header: "Current price",
        cell: (info) => {
          const row = info.row.original;
          const val = row.current_price || (row as any).price;
          return val ? `₹${parseFloat(val).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
        },
      }),
      columnHelper.accessor("market_value", {
        header: "Market value",
        cell: (info) => `₹${parseFloat(info.getValue()).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      }),
      columnHelper.accessor("cost_basis", {
        header: "Cost basis",
        cell: (info) => `₹${parseFloat(info.getValue()).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      }),
      columnHelper.display({
        id: "gain_loss",
        header: "Gain/Loss",
        cell: (info) => {
          const row = info.row.original;
          const marketValue = parseFloat(row.market_value);
          const costBasis = parseFloat(row.cost_basis);
          const gainAmount = row.gain_amount ? parseFloat(row.gain_amount) : marketValue - costBasis;
          const gainPct = row.gain_pct
            ? parseFloat(row.gain_pct)
            : costBasis > 0 ? (gainAmount / costBasis) * 100 : 0;
          const isPositive = gainAmount >= 0;

          return (
            <span className={`td-gain ${isPositive ? "positive" : "negative"}`}>
              {isPositive ? "+" : ""}₹{Math.abs(gainAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({isPositive ? "+" : ""}{gainPct.toFixed(2)}%)
            </span>
          );
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: holdings,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="holdings-section">
      <h3 className="holdings-title">
        <HoldingsIcon />
        Your holdings
      </h3>
      <div className="holdings-table-wrapper">
        <table className="holdings-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={header.id === "gain_loss" ? "th-right" : ""}
                    style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <SortIndicator direction={header.column.getIsSorted()} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px" }}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && holdings.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                  No holdings found
                </td>
              </tr>
            )}
            {!loading &&
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
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

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  return (
    <svg viewBox="0 0 12 16" fill="none" width="10" height="14" className="sort-icon">
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

function HoldingsIcon() {
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
