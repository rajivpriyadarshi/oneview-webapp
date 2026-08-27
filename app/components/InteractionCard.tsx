"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { Interaction } from "../types/interactionTypes";
import { getCrmInteraction } from "../lib/wealthCrmApi";
import InteractionDetailModal from "./InteractionDetailModal";

interface InteractionCardProps {
  interaction: Interaction;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// Cache for storing fetched interaction details
const interactionDetailCache = new Map<number, Interaction & { body?: string | null }>();

export default function InteractionCard({
  interaction,
  isExpanded,
  onToggleExpand,
}: InteractionCardProps) {
  const [detailedInteraction, setDetailedInteraction] = useState<Interaction & { body?: string | null }>(interaction);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasLoadedDetail, setHasLoadedDetail] = useState(false);
  const getIconForSourceType = (sourceType: string): string => {
    switch (sourceType) {
      case "meeting_note":
        return "/icons/interaction/ic-meeting.png";
      case "email":
        return "/icons/interaction/ic-email.png";
      case "document":
        return "/icons/interaction/ic-document.png";
      case "text_note":
      case "call_summary":
      case "voice_note":
        return "/icons/interaction/ic-message.png";
      default:
        return "/icons/interaction/ic-document.png";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const interactionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today.getTime() - interactionDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    } else {
      // Other days - show date
      return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    }
  };

  const getDirectionArrow = (direction: string) => {
    switch (direction) {
      case "client_to_advisor":
        return " → ";
      case "advisor_to_client":
        return " ← ";
      default:
        return " • ";
    }
  };

  const hasExpandedContent =
    detailedInteraction.extracted_summary ||
    (detailedInteraction.key_takeaways && detailedInteraction.key_takeaways.length > 0) ||
    (detailedInteraction.next_steps && detailedInteraction.next_steps.length > 0) ||
    (detailedInteraction.attendees && detailedInteraction.attendees.length > 0);

  // Fetch detailed interaction on expand
  useEffect(() => {
    if (isExpanded && !hasLoadedDetail) {
      // Check if we have cached data
      const cached = interactionDetailCache.get(interaction.id);
      if (cached) {
        setDetailedInteraction(cached);
        setHasLoadedDetail(true);
        return;
      }

      // Fetch from API if not cached
      const fetchDetail = async () => {
        setIsLoadingDetail(true);
        try {
          const detail = await getCrmInteraction(interaction.id);
          // Merge the detailed data with the original interaction to preserve list-only fields
          const mergedDetail = {
            ...interaction, // Keep subtitle, memory_updated, etc. from list
            ...detail, // Override with detailed data
            subtitle: interaction.subtitle, // Preserve subtitle from list
            memory_updated: interaction.memory_updated, // Preserve memory_updated from list
          };

          // Cache the result
          interactionDetailCache.set(interaction.id, mergedDetail);
          setDetailedInteraction(mergedDetail);
          setHasLoadedDetail(true);
        } catch (error) {
          console.error("Failed to fetch interaction detail:", error);
        } finally {
          setIsLoadingDetail(false);
        }
      };
      fetchDetail();
    }
  }, [isExpanded, hasLoadedDetail, interaction]);

  // Reset detailed interaction when base interaction changes
  useEffect(() => {
    // Check cache first
    const cached = interactionDetailCache.get(interaction.id);
    if (cached) {
      setDetailedInteraction(cached);
      setHasLoadedDetail(true);
    } else {
      setDetailedInteraction(interaction);
      setHasLoadedDetail(false);
    }
  }, [interaction.id, interaction]);

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  return (
    <div
      className={`timeline-row ${isExpanded ? "expanded" : ""}`}
      onClick={() => hasExpandedContent && !isModalOpen && onToggleExpand()}
      style={{ cursor: hasExpandedContent ? "pointer" : "default" }}
    >
      <div className="timeline-row-content">
        <div className="icon-wrapper">
          <Image
            src={getIconForSourceType(interaction.source_type)}
            alt=""
            width={64}
            height={64}
            className="interaction-icon"
          />
        </div>

        <div className="row-content">
          <h3 className="interaction-title">{detailedInteraction.subject}</h3>
          <p className="interaction-subtitle">
            {detailedInteraction.subtitle}
          </p>
          {detailedInteraction.memory_updated && (
            <div className="ai-action">
              <Image src="/ic-memory-updated.svg" alt="" width={12} height={12} />
              <span>Memory updated</span>
            </div>
          )}
        </div>

        <div className="row-actions">
          <span className="timestamp">{formatTimestamp(detailedInteraction.occurred_at)}</span>
          {hasExpandedContent && (
            <div className="chevron-icon" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {isExpanded && hasExpandedContent && (
        <div className="expanded-body">
          {isLoadingDetail ? (
            <div className="loading-indicator" style={{ padding: "20px", textAlign: "center", color: "#6B7280", fontSize: "13px" }}>
              Loading details...
            </div>
          ) : (
            <>
              {detailedInteraction.extracted_summary && (
                <p className="summary-text">{detailedInteraction.extracted_summary}</p>
              )}

              {((detailedInteraction.key_takeaways && detailedInteraction.key_takeaways.length > 0) ||
                (detailedInteraction.next_steps && detailedInteraction.next_steps.length > 0)) && (
                <div className="takeaways-steps">
                  {detailedInteraction.key_takeaways && detailedInteraction.key_takeaways.length > 0 && (
                    <div className="key-takeaways">
                      <h4 className="section-title">Key takeaways</h4>
                      <div className="bullets">
                        {detailedInteraction.key_takeaways.map((takeaway, index) => (
                          <p key={index}>{takeaway}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailedInteraction.next_steps && detailedInteraction.next_steps.length > 0 && (
                    <div className="next-steps">
                      <h4 className="section-title">Next steps</h4>
                      <div className="steps-list">
                        {detailedInteraction.next_steps.map((step, index) => (
                          <p key={index}>{step}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailedInteraction.attendees && detailedInteraction.attendees.length > 0 && (
                <div className="attendees-section">
                  <h4 className="section-title">Attendees</h4>
                  <p className="attendees-list">{detailedInteraction.attendees.join(", ")}</p>
                </div>
              )}

              {detailedInteraction.subject && detailedInteraction.body && (
                <button
                  type="button"
                  className="interaction-view-details"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(true);
                  }}
                >
                  View details
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {detailedInteraction.subject && detailedInteraction.body && (
        <InteractionDetailModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          subject={detailedInteraction.subject}
          body={detailedInteraction.body}
          showGradientBackground={false}
        />
      )}
    </div>
  );
}
