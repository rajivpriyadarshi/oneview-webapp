"use client";

import type { UIDocument } from "../types/documentTypes";

interface DocumentCardProps {
  document: UIDocument;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onViewDocument?: () => void;
}

export default function DocumentCard({
  document,
  isExpanded,
  onToggleExpand,
  onViewDocument,
}: DocumentCardProps) {
  const getTagStyles = (variant: string) => {
    switch (variant) {
      case "warning":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "error":
        return "bg-red-50 text-red-700 border-red-200";
      case "success":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div
      className={`
        border rounded-2xl transition-all cursor-pointer
        ${isExpanded ? "border-2 border-gray-900" : "border border-gray-200"}
      `}
      onClick={onToggleExpand}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
            <img
              src={`/icons/documents/${document.icon}.svg`}
              alt={document.documentType}
              className="w-6 h-6"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {document.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3">{document.subtitle}</p>

                {/* Tags */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getTagStyles(
                      document.primaryTag.variant
                    )}`}
                  >
                    {document.primaryTag.label}
                  </span>
                  {document.statusTag && (
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getTagStyles(
                        document.statusTag.variant
                      )}`}
                    >
                      {document.statusTag.label}
                    </span>
                  )}
                  {document.expiryDate && !isExpanded && (
                    <span className="text-xs text-gray-500">
                      {document.expiryDate}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDocument?.();
                  }}
                >
                  View document
                </button>
                <button
                  className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="8" cy="3" r="1" fill="currentColor" />
                    <circle cx="8" cy="8" r="1" fill="currentColor" />
                    <circle cx="8" cy="13" r="1" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Expanded metadata */}
            {isExpanded && document.metadata && (
              <div className="mt-6 space-y-3 pt-6 border-t border-gray-200">
                <div className="flex items-start gap-3">
                  <img
                    src="/icons/documents/check-circle.svg"
                    alt="Check"
                    className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Document type</p>
                    <p className="text-sm text-gray-900 font-medium">
                      {document.metadata.documentType}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <img
                    src="/icons/documents/check-circle.svg"
                    alt="Check"
                    className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Provider</p>
                    <p className="text-sm text-gray-900 font-medium">
                      {document.metadata.provider}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <img
                    src="/icons/documents/check-circle.svg"
                    alt="Check"
                    className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Maps to</p>
                    <p className="text-sm text-gray-900 font-medium">
                      {document.metadata.mapsTo}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <img
                    src="/icons/documents/check-circle.svg"
                    alt="Check"
                    className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Key dates</p>
                    <p className="text-sm text-gray-900 font-medium">
                      {document.metadata.keyDates}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
