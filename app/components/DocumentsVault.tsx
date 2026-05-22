"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import DocumentsTable from "./DocumentsTable";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".pdf"];

const mockDocuments = [
  {
    filename: "Fidelity holdings Mar 2024-Apr 2025.xls",
    downloadedOn: "Oct 22, 2025 at 9:30 AM",
    downloadedBy: "Zerodha MCP",
    size: "20 KB",
    type: "Investments",
    status: "Processing",
    fileType: "xls",
  },
  {
    filename: "Zerodha P&L Mar 2024-Apr 2025.xls",
    downloadedOn: "Oct 22, 2025 at 9:30 AM",
    downloadedBy: "Zerodha MCP",
    size: "20 KB",
    type: "Investments",
    status: "Processing",
    fileType: "xls",
  },
  {
    filename: "Zerodha P&L Mar 2024-Apr 2025.xls",
    downloadedOn: "Oct 22, 2025 at 9:30 AM",
    downloadedBy: "Manual",
    size: "20 KB",
    type: "Investments",
    status: "Processing",
    fileType: "png",
  },
  {
    filename: "HDFC statement XXXXX0032 (FY24-25).pdf",
    downloadedOn: "Oct 22, 2025 at 9:30 AM",
    downloadedBy: "Gmail MCP",
    size: "20 KB",
    type: "Investments",
    status: "Processing",
    fileType: "pdf",
  },
  {
    filename: "Zerodha P&L Mar 2024-Apr 2025.xls",
    downloadedOn: "Oct 22, 2025 at 9:30 AM",
    downloadedBy: "Zerodha MCP",
    size: "20 KB",
    type: "Investments",
    status: "Processing",
    fileType: "docx",
  },
  {
    filename: "Zerodha P&L Mar 2024-Apr 2025.xls",
    downloadedOn: "Oct 22, 2025 at 9:30 AM",
    downloadedBy: "Zerodha MCP",
    size: "20 KB",
    type: "Investments",
    status: "Processing",
    fileType: "csv",
  },
];

export function DocumentsVault() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      validateFiles(files);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      validateFiles(files);
    }
  }

  function validateFiles(files: File[]) {
    setError("");

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((ext) =>
        lowerName.endsWith(ext)
      );

      if (!hasSupportedExtension) {
        setError("Only CSV, XLSX, or PDF files are supported.");
        return;
      }

      if (file.size > MAX_UPLOAD_SIZE) {
        setError("File size must be 10 MB or less.");
        return;
      }
    }

    // Handle upload here
    console.log("Files validated:", files);
  }

  return (
    <div className="docs-vault-content">
      <header className="docs-vault-header">
        <div className="docs-vault-header-left">
          <h1 className="docs-vault-title">Documents vault</h1>
          <p className="docs-vault-subtitle">Total 8 files across 3 accounts</p>
        </div>
        <button
          className="upload-statements-btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon />
          Upload statements
        </button>
      </header>

      <div
        className={`docs-dropzone ${isDragging ? "is-dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.pdf"
          multiple
          onChange={handleFileChange}
        />
        <div className="docs-dropzone-icon">
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path d="M12 16V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <strong>Drop your statements here</strong>
        <span>Supported file types: CSV, XLSX, PDF (Max 10MB)</span>
      </div>

      {error && <p className="docs-error">{error}</p>}

      <DocumentsTable documents={mockDocuments} />
    </div>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path d="M12 16V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
