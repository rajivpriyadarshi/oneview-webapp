"use client";

import Image from "next/image";
import type { Interaction } from "../types/interactionTypes";

interface InteractionCardProps {
  interaction: Interaction;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export default function InteractionCard({
  interaction,
  isExpanded,
  onToggleExpand,
}: InteractionCardProps) {
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
    interaction.extracted_summary ||
    (interaction.key_takeaways && interaction.key_takeaways.length > 0) ||
    (interaction.next_steps && interaction.next_steps.length > 0) ||
    (interaction.attendees && interaction.attendees.length > 0);

  return (
    <div
      className={`timeline-row ${isExpanded ? "expanded" : ""}`}
      onClick={() => hasExpandedContent && onToggleExpand()}
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
          <h3 className="interaction-title">{interaction.subject}</h3>
          <p className="interaction-subtitle">
            {interaction.subtitle}
          </p>
          {interaction.memory_updated && (
            <div className="ai-action">
              <Image src="/ic-memory-updated.svg" alt="" width={12} height={12} />
              <span>Memory updated</span>
            </div>
          )}
        </div>

        <div className="row-actions">
          <span className="timestamp">{formatTimestamp(interaction.occurred_at)}</span>
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
          {interaction.extracted_summary && (
            <p className="summary-text">{interaction.extracted_summary}</p>
          )}

          {((interaction.key_takeaways && interaction.key_takeaways.length > 0) ||
            (interaction.next_steps && interaction.next_steps.length > 0)) && (
            <div className="takeaways-steps">
              {interaction.key_takeaways && interaction.key_takeaways.length > 0 && (
                <div className="key-takeaways">
                  <h4 className="section-title">Key takeaways</h4>
                  <div className="bullets">
                    {interaction.key_takeaways.map((takeaway, index) => (
                      <p key={index}>{takeaway}</p>
                    ))}
                  </div>
                </div>
              )}

              {interaction.next_steps && interaction.next_steps.length > 0 && (
                <div className="next-steps">
                  <h4 className="section-title">Next steps</h4>
                  <div className="steps-list">
                    {interaction.next_steps.map((step, index) => (
                      <p key={index}>{step}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {interaction.attendees && interaction.attendees.length > 0 && (
            <div className="attendees-section">
              <h4 className="section-title">Attendees</h4>
              <p className="attendees-list">{interaction.attendees.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
