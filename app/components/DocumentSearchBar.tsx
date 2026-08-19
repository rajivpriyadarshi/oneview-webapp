"use client";

interface DocumentSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onAddDocument: () => void;
}

export default function DocumentSearchBar({
  value,
  onChange,
  onAddDocument,
}: DocumentSearchBarProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      {/* Search input */}
      <div className="flex-1 relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <img
            src="/icons/documents/search.svg"
            alt="Search"
            className="w-5 h-5"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search across all documents, entities, amounts, dates, or actions..."
          className="w-full h-[32px] pl-12 pr-16 text-sm border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-100 rounded">
            /
          </span>
        </div>
      </div>

      {/* Add document button */}
      <button
        onClick={onAddDocument}
        className="flex items-center gap-2 h-[32px] px-4 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors flex-shrink-0"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
        >
          <path
            d="M8 3.5V12.5M3.5 8H12.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Add document</span>
      </button>
    </div>
  );
}
