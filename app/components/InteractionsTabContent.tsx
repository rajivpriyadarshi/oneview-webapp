"use client";

import { type CSSProperties, useState, useEffect, useRef } from "react";
import Image from "next/image";
import InteractionCard from "./InteractionCard";
import { ClientLottie } from "./ClientLottie";
import { listClientInteractions } from "../lib/wealthCrmApi";
import type { Interaction } from "../types/interactionTypes";

interface InteractionsTabContentProps {
  clientId: number | string;
  focusedInteractionId?: number | null;
  onFocusHandled?: () => void;
}

export default function InteractionsTabContent({ clientId, focusedInteractionId, onFocusHandled }: InteractionsTabContentProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const focusedRef = useRef<HTMLDivElement>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (focusedInteractionId != null && !loading && interactions.length > 0) {
      setExpandedIds((prev) => new Set(prev).add(focusedInteractionId));
      setTimeout(() => {
        const el = focusedRef.current;
        if (!el) return;
        let scrollParent: HTMLElement | null = el.parentElement;
        while (scrollParent) {
          const { overflowY } = getComputedStyle(scrollParent);
          if (overflowY === "auto" || overflowY === "scroll") break;
          scrollParent = scrollParent.parentElement;
        }
        if (scrollParent) {
          const elTop = el.getBoundingClientRect().top - scrollParent.getBoundingClientRect().top + scrollParent.scrollTop;
          scrollParent.scrollTo({ top: Math.max(0, elTop - 20), behavior: "smooth" });
        }
        onFocusHandled?.();
      }, 300);
    }
  }, [focusedInteractionId, loading, interactions]);

  // Debounce search query with 1000ms delay to show loader
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Load interactions when clientId or debouncedSearchQuery changes
  useEffect(() => {
    loadInteractions();
  }, [clientId, debouncedSearchQuery]);

  const loadInteractions = async () => {
    // Increment request ID for deduplication
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    try {
      const response = await listClientInteractions(clientId, {
        search: debouncedSearchQuery || undefined,
      });

      // Only update state if this is still the latest request (deduplication)
      if (currentRequestId === requestIdRef.current) {
        setInteractions(response.results);
      }
    } catch (error) {
      if (currentRequestId === requestIdRef.current) {
        console.error("Failed to load interactions:", error);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const groupInteractionsByDate = (interactions: Interaction[]) => {
    const groups: { [key: string]: Interaction[] } = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    interactions.forEach((interaction) => {
      const date = new Date(interaction.occurred_at);
      const interactionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      // Sentence case, not caps: Figma 2446:20307 reads "Today • 18 Jul 2026".
      let groupKey: string;
      if (interactionDate.getTime() === today.getTime()) {
        groupKey = `Today • ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
      } else if (interactionDate.getTime() === yesterday.getTime()) {
        groupKey = "Yesterday";
      } else {
        groupKey = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(interaction);
    });

    return groups;
  };

  const groupedInteractions = groupInteractionsByDate(interactions);

  return (
    <div className="vault-container">
      {/* Same pill field as the documents vault — Figma puts an identical 36px
          search row at the top of both feeds, so they share the markup and CSS
          instead of each carrying its own. */}
      <div className="doc-search-row">
        <div className="doc-search-field">
          <input
            type="text"
            placeholder="Search notes, people, entities, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button
              type="button"
              className="search-clear-button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <Image src="/icons/documents/fg-search.svg" alt="" width={16} height={16} />
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-state-lottie">
          <ClientLottie src="/loader.json" style={{ width: 120, height: 120 }} />
          <p>Loading interactions...</p>
        </div>
      ) : (
        <div className="timeline-feed">
          {/* staggerIndex runs continuously across the date groups — a header and
              the cards under it are one visual sequence, so restarting the count
              per group would make later groups arrive before earlier rows. It's
              a plain counter rather than an index because each group contributes
              its header plus a variable number of rows. */}
          {(() => {
            let staggerIndex = 0;
            return Object.entries(groupedInteractions).map(([dateGroup, groupInteractions]) => (
              <div key={dateGroup} className="timeline-group">
                <div className="date-header stagger-in" style={{ "--stagger-index": Math.min(staggerIndex++, 8) } as CSSProperties}>
                  <p>{dateGroup}</p>
                </div>
                <div className="timeline-rows">
                  {groupInteractions.map((interaction) => (
                    <div
                      key={interaction.id}
                      ref={interaction.id === focusedInteractionId ? focusedRef : undefined}
                      className="stagger-in"
                      style={{ "--stagger-index": Math.min(staggerIndex++, 8) } as CSSProperties}
                    >
                      <InteractionCard
                        interaction={interaction}
                        isExpanded={expandedIds.has(interaction.id)}
                        onToggleExpand={() => toggleExpand(interaction.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
          {interactions.length === 0 && !loading && (
            <div className="empty-state">
              <p>No interactions found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
