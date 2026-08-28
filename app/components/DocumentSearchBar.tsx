"use client";

import Image from "next/image";

interface DocumentSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onAddDocument: () => void;
}

// Figma 2446:20944 — a 36px pill field with the magnifier trailing, and a black
// pill button beside it. Styling lives in globals.css (.doc-search-row) so it
// can share the vault's other rules; the type sits in the unlayered block near
// the top of that file, because `button, input { font: inherit }` beats layered
// declarations regardless of specificity.
export default function DocumentSearchBar({
  value,
  onChange,
  onAddDocument,
}: DocumentSearchBarProps) {
  return (
    <div className="doc-search-row">
      <div className="doc-search-field">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search across all documents, entities, amounts, dates, or actions..."
        />
        <Image src="/icons/documents/fg-search.svg" alt="" width={16} height={16} />
      </div>

      <button type="button" className="doc-add-button" onClick={onAddDocument}>
        <Image src="/icons/documents/fg-upload.svg" alt="" width={16} height={16} />
        Add document
      </button>
    </div>
  );
}
