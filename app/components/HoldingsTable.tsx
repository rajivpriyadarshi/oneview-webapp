"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { type PortfolioViewPosition } from "../lib/portfolioDataApi";
import { appConfig } from "../lib/config";
import { getStoredAuthToken } from "../lib/session";

type Props = {
  positions: PortfolioViewPosition[];
  loading: boolean;
};

const columnHelper = createColumnHelper<PortfolioViewPosition>();
const FALLBACK_ICON_COLORS = [
  "#b4d3fa",
  "#c5fad9",
  "#f7d6a8",
  "#d0b6fa",
  "#ffbac8",
  "#bcf0f7",
  "#edd59d",
  "#b8c8ff",
  "#d5de92",
  "#e3b594",
];

function getCurrencySymbol(currency?: string): string {
  switch (currency?.toUpperCase()) {
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    case "JPY": return "¥";
    case "INR":
    default: return "₹";
  }
}

function formatCurrencyAmount(value: number, currency?: string) {
  return `${getCurrencySymbol(currency)}${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

export default function HoldingsTable({ positions, loading }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => row.ticker || "", {
        id: "security",
        header: "Security",
        sortingFn: "alphanumeric",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="security-cell">
              <InstrumentIcon
                symbol={row.ticker}
                name={row.name}
                isProfitable={row.gain_amount >= 0}
              />
              <div className="security-copy">
                <span className="security-ticker">{row.ticker || "—"}</span>
                <span className="security-name">{row.name || ""}</span>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor("quantity", {
        header: "Quantity",
        sortingFn: "basic",
        cell: (info) => {
          return formatNumber(info.getValue());
        },
      }),
      columnHelper.accessor((row) => row.cost_basis > 0 && row.quantity > 0 ? row.market_value / row.quantity : 0, {
        id: "current_price",
        header: "Current price",
        sortingFn: "basic",
        cell: (info) => {
          const row = info.row.original;
          const price = row.quantity > 0 ? row.market_value / row.quantity : 0;
          return price > 0 ? formatCurrencyAmount(price, row.currency) : "—";
        },
      }),
      columnHelper.accessor("market_value", {
        header: "Market value",
        sortingFn: "basic",
        cell: (info) => {
          return formatCurrencyAmount(info.getValue(), info.row.original.currency);
        },
      }),
      columnHelper.accessor("cost_basis", {
        header: "Cost basis",
        sortingFn: "basic",
        cell: (info) => {
          return formatCurrencyAmount(info.getValue(), info.row.original.currency);
        },
      }),
      columnHelper.accessor("gain_amount", {
        id: "gain_loss",
        header: "Gain/Loss",
        sortingFn: "basic",
        cell: (info) => {
          const row = info.row.original;
          const gainAmount = row.gain_amount;
          const gainPct = row.gain_pct ?? (row.cost_basis > 0 ? (gainAmount / row.cost_basis) * 100 : 0);
          const isPositive = gainAmount >= 0;

          return (
            <span className={`td-gain ${isPositive ? "positive" : "negative"}`}>
              {isPositive ? "+" : "-"}{formatCurrencyAmount(Math.abs(gainAmount), row.currency)} ({isPositive ? "+" : ""}{gainPct.toFixed(2)}%)
            </span>
          );
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: positions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: false,
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
            {!loading && positions.length === 0 && (
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

function InstrumentIcon({
  symbol,
  name,
  isProfitable,
}: {
  symbol?: string;
  name?: string;
  isProfitable: boolean;
}) {
  const [iconUrl, setIconUrl] = useState("");
  const [useFallback, setUseFallback] = useState(!symbol);
  const fallbackSeed = symbol || name || "";
  const fallbackColorDetails = getFallbackIconColorDetails(fallbackSeed);
  const fallbackColor = fallbackColorDetails.color;
  const fallbackInitial = getFallbackIconInitial(fallbackSeed);

  useEffect(() => {
    console.info("[InstrumentIcon] computed fallback", {
      symbol,
      name,
      fallbackSeed,
      fallbackInitial,
      asciiSum: fallbackColorDetails.asciiSum,
      paletteSize: FALLBACK_ICON_COLORS.length,
      colorIndex: fallbackColorDetails.colorIndex,
      fallbackColor,
      isProfitable,
      initialUseFallback: !symbol,
    });
  }, [
    fallbackColor,
    fallbackColorDetails.asciiSum,
    fallbackColorDetails.colorIndex,
    fallbackInitial,
    fallbackSeed,
    isProfitable,
    name,
    symbol,
  ]);

  useEffect(() => {
    if (!symbol) {
      console.info("[InstrumentIcon] using fallback because symbol is missing", {
        name,
        fallbackSeed,
        fallbackColor,
      });
      setIconUrl("");
      setUseFallback(true);
      return;
    }

    const authToken = getStoredAuthToken();

    if (!authToken) {
      console.info("[InstrumentIcon] using fallback because auth token is missing", {
        symbol,
        fallbackSeed,
        fallbackColor,
      });
      setIconUrl("");
      setUseFallback(true);
      return;
    }

    let objectUrl = "";
    let isMounted = true;

    console.info("[InstrumentIcon] fetching icon", {
      symbol,
      fallbackSeed,
      fallbackColor,
    });

    fetchIcon(symbol, authToken)
      .then((blobUrl) => {
        if (!isMounted) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        objectUrl = blobUrl;
        console.info("[InstrumentIcon] icon fetch returned blob URL", {
          symbol,
          blobUrl,
        });
        setIconUrl(blobUrl);
        setUseFallback(false);
      })
      .catch((error) => {
        if (isMounted) {
          console.info("[InstrumentIcon] using fallback because icon fetch failed", {
            symbol,
            fallbackSeed,
            fallbackColor,
            error,
          });
          setIconUrl("");
          setUseFallback(true);
        }
      });

    return () => {
      isMounted = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fallbackColor, fallbackSeed, name, symbol]);

  if (useFallback || !iconUrl) {
    console.info("[InstrumentIcon] rendering fallback badge", {
      symbol,
      name,
      fallbackSeed,
      fallbackInitial,
      fallbackColor,
      asciiSum: fallbackColorDetails.asciiSum,
      colorIndex: fallbackColorDetails.colorIndex,
      useFallback,
      hasIconUrl: Boolean(iconUrl),
    });

    return (
      <span
        className="instrument-icon fallback"
        style={{ backgroundColor: fallbackColor }}
        aria-hidden="true"
      >
        {fallbackInitial}
      </span>
    );
  }

  return (
    <img
      src={iconUrl}
      alt=""
      className="instrument-icon"
      onError={() => setUseFallback(true)}
      onLoad={(event) => {
        const blankImage = isBlankImage(event.currentTarget);
        console.info("[InstrumentIcon] loaded icon image", {
          symbol,
          naturalWidth: event.currentTarget.naturalWidth,
          naturalHeight: event.currentTarget.naturalHeight,
          blankImage,
        });

        if (blankImage) {
          console.info("[InstrumentIcon] using fallback because loaded icon is blank", {
            symbol,
            fallbackSeed,
            fallbackColor,
          });
          setUseFallback(true);
        }
      }}
    />
  );
}

function getFallbackIconColorDetails(value: string) {
  const asciiSum = value
    .toUpperCase()
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const colorIndex = asciiSum % FALLBACK_ICON_COLORS.length;

  return {
    asciiSum,
    colorIndex,
    color: FALLBACK_ICON_COLORS[colorIndex],
  };
}

function getFallbackIconInitial(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue[0].toUpperCase() : "?";
}

async function fetchIcon(symbol: string, authToken: string) {
  const baseUrl = appConfig.apiBaseUrl.endsWith("/")
    ? appConfig.apiBaseUrl
    : `${appConfig.apiBaseUrl}/`;
  const iconUrl = new URL(`icon/${encodeURIComponent(symbol)}/`, baseUrl).toString();
  const response = await fetch(iconUrl, {
    headers: {
      Authorization: `Token ${authToken}`,
    },
  });

  console.info("[InstrumentIcon] icon response", {
    symbol,
    iconUrl,
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length"),
    redirected: response.redirected,
    finalUrl: response.url,
  });

  if (!response.ok) {
    throw new Error("Icon not found.");
  }

  const blob = await response.blob();

  console.info("[InstrumentIcon] icon blob", {
    symbol,
    blobSize: blob.size,
    blobType: blob.type,
  });

  if (blob.size === 0 || !blob.type.startsWith("image/")) {
    throw new Error("Icon response is not an image.");
  }

  return URL.createObjectURL(blob);
}

function isBlankImage(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context || image.naturalWidth === 0 || image.naturalHeight === 0) {
    return true;
  }

  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];
    const isVisible = alpha > 24;
    const isNotWhite = red < 245 || green < 245 || blue < 245;

    if (isVisible && isNotWhite) {
      return false;
    }
  }

  return true;
}

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  return (
    <svg width="10" height="12" viewBox="0 0 6 9" fill="none" className="sort-icon">
      <path d="M0.5 3L3 0.5L5.5 3" stroke="black" strokeOpacity={direction === "asc" ? "1" : "0.5"} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M0.5 6L3 8.5L5.5 6" stroke="black" strokeOpacity={direction === "desc" ? "1" : "0.5"} strokeLinecap="round" strokeLinejoin="round"/>
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
