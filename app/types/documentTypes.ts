export interface UIDocument {
  id: string;
  title: string;
  subtitle: string;
  documentType: DocumentType;
  icon: DocumentIconType;
  primaryTag: DocumentTag;
  statusTag?: DocumentTag;
  metadata?: {
    documentType: string;
    provider: string;
    mapsTo: string;
    keyDates: string;
  };
  expiryDate?: string;
  fileUrl?: string;
  createdAt: string;
}

export type DocumentType =
  | "Capital Call"
  | "Insurance"
  | "Trust"
  | "Property"
  | "Statement"
  | "KYC"
  | "Tax"
  | "Valuation"
  | "Agreement";

export type DocumentIconType =
  | "file-badge-2"
  | "list-checks"
  | "book-check"
  | "circle-x"
  | "chart-column"
  | "folder-lock"
  | "file-badge"
  | "image";

export interface DocumentTag {
  label: string;
  variant: "default" | "warning" | "error" | "success";
}
