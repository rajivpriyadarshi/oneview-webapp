"use client";

import { useState } from "react";
import DocumentSearchBar from "./DocumentSearchBar";
import DocumentCard from "./DocumentCard";
import { MOCK_DOCUMENTS } from "../data/mockDocuments";

export default function DocumentsListView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("Most recent");
  const [expandedDocId, setExpandedDocId] = useState<string | null>(
    MOCK_DOCUMENTS[0]?.id || null
  );

  const filteredDocuments = MOCK_DOCUMENTS.filter((doc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(query) ||
      doc.subtitle.toLowerCase().includes(query) ||
      doc.documentType.toLowerCase().includes(query) ||
      doc.primaryTag.label.toLowerCase().includes(query)
    );
  });

  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    if (sortBy === "Most recent") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  const handleAddDocument = () => {
    console.log("Add document clicked");
  };

  const handleViewDocument = (doc: typeof MOCK_DOCUMENTS[0]) => {
    console.log("View document:", doc.id);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search bar */}
        <DocumentSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onAddDocument={handleAddDocument}
        />

        {/* Document count and sort */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-600">
            {sortedDocuments.length} document
            {sortedDocuments.length !== 1 ? "s" : ""}
          </p>
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              <span>Sort: {sortBy}</span>
              <img
                src="/icons/documents/chevron-down.svg"
                alt="Sort"
                className="w-4 h-4"
              />
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            >
              <option value="Most recent">Most recent</option>
              <option value="Oldest first">Oldest first</option>
              <option value="A-Z">A-Z</option>
              <option value="Z-A">Z-A</option>
            </select>
          </div>
        </div>

        {/* Documents list */}
        <div className="space-y-4">
          {sortedDocuments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No documents found</p>
            </div>
          ) : (
            sortedDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                isExpanded={expandedDocId === doc.id}
                onToggleExpand={() =>
                  setExpandedDocId(expandedDocId === doc.id ? null : doc.id)
                }
                onViewDocument={() => handleViewDocument(doc)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
