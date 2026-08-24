export function formatMoney(value?: number, currency?: string): string {
  if (value === undefined || value === null) return "";

  const currencySymbol = currency === "USD" ? "$" : currency === "SGD" ? "S$" : currency || "";

  // Format with commas
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return `${currencySymbol}${formatted}m`;
}

export function formatChange(change?: number, changePct?: number): string {
  if (change === undefined || change === null) return "";

  const sign = change >= 0 ? "+" : "";
  const formattedChange = change.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  if (changePct !== undefined && changePct !== null) {
    const formattedPct = changePct.toFixed(1);
    return `(+$${formattedChange} / ${sign}${formattedPct}% since last review)`;
  }

  return `(${sign}$${formattedChange} since last review)`;
}

export function humanizeArtifactType(artifactType: string): string {
  switch (artifactType) {
    case "wealth.family_snapshot":
      return "Portfolio Review";
    default:
      return artifactType
        .split(".")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

export function getArtifactTypeLabel(artifactType: string): string {
  switch (artifactType) {
    case "wealth.family_snapshot":
      return "PORTFOLIO ANALYSIS";
    default:
      return artifactType.toUpperCase().replace(/\./g, " ");
  }
}
