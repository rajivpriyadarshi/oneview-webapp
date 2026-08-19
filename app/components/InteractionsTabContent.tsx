"use client";

import { useState, useEffect, useRef } from "react";
import { Lottie } from "lottie-react";
import InteractionCard from "./InteractionCard";
import { listClientInteractions } from "../lib/wealthCrmApi";
import type { Interaction } from "../types/interactionTypes";

interface InteractionsTabContentProps {
  clientId: number | string;
}

export default function InteractionsTabContent({ clientId }: InteractionsTabContentProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loaderAnimation, setLoaderAnimation] = useState<any>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);

  // Load Lottie animation
  useEffect(() => {
    fetch("/loader.json")
      .then((res) => res.json())
      .then((data) => setLoaderAnimation(data))
      .catch((err) => console.error("Failed to load animation:", err));
  }, []);

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

      let groupKey: string;
      if (interactionDate.getTime() === today.getTime()) {
        const formatted = date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
        groupKey = `TODAY • ${formatted.toUpperCase()}`;
      } else if (interactionDate.getTime() === yesterday.getTime()) {
        groupKey = "YESTERDAY";
      } else {
        groupKey = date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
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
    <div className="interactions-container interactions-tab-container">
      <div className="search-header-container">
        <div className="search-bar">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search notes, people, entities, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-state-lottie">
          {loaderAnimation && <Lottie src={loaderAnimation} autoplay loop style={{ width: 120, height: 120 }} />}
          <p>Loading interactions...</p>
        </div>
      ) : (
        <div className="timeline-feed">
          {Object.entries(groupedInteractions).map(([dateGroup, groupInteractions]) => (
            <div key={dateGroup}>
              <div className="date-header">
                <p>{dateGroup}</p>
              </div>
              {groupInteractions.map((interaction) => (
                <InteractionCard
                  key={interaction.id}
                  interaction={interaction}
                  isExpanded={expandedIds.has(interaction.id)}
                  onToggleExpand={() => toggleExpand(interaction.id)}
                />
              ))}
            </div>
          ))}
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
