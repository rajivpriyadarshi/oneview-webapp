"use client";

import { useState, useEffect, useRef } from "react";

type ExecutionPlanStep = {
  position: number;
  node_id: string;
  component_type: string;
  label: string;
  description: string[];
  group_id?: string;
  group_label?: string;
};

type ExecutionPlan = {
  schema_version: number;
  flow_hash: string;
  steps: ExecutionPlanStep[];
};

const STEP_COLORS = [
  "#F97316",
  "#3B82F6",
  "#8B5CF6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
];

export function WorkflowExecutionSteps({
  executionPlan,
  onAnimationComplete,
}: {
  executionPlan: ExecutionPlan;
  isRunning?: boolean;
  onAnimationComplete?: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const completedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  useEffect(() => {
    if (executionPlan.steps.length === 0) {
      onCompleteRef.current?.();
      return;
    }
    if (completedRef.current) return;

    let cancelled = false;
    let currentStep = 0;

    const advance = () => {
      if (cancelled) return;
      currentStep += 1;
      setVisibleCount(currentStep);

      if (currentStep < executionPlan.steps.length) {
        const delay = 3000 + Math.random() * 2000;
        setTimeout(advance, delay);
      } else {
        completedRef.current = true;
        setTimeout(() => {
          if (!cancelled) onCompleteRef.current?.();
        }, 800);
      }
    };

    const initialDelay = setTimeout(advance, 1200);

    return () => {
      cancelled = true;
      clearTimeout(initialDelay);
    };
  }, []);

  useEffect(() => {
    if (visibleCount > 0 && bottomRef.current) {
      setTimeout(() => {
        let el: HTMLElement | null = bottomRef.current;
        while (el) {
          const style = getComputedStyle(el);
          if (style.overflowY === "auto" || style.overflowY === "scroll") {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            return;
          }
          el = el.parentElement;
        }
      }, 150);
    }
  }, [visibleCount]);

  if (executionPlan.steps.length === 0) return null;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", marginBottom: 16 }}>
      {/* Vertical line */}
      <div style={{
        position: "absolute",
        left: 12,
        top: 20,
        bottom: 10,
        width: 1,
        background: "rgba(0, 0, 0, 0.04)",
      }} />

      {executionPlan.steps.map((step, i) => {
        const isVisible = i < visibleCount;
        const isActive = i === visibleCount - 1 && visibleCount < executionPlan.steps.length;
        const isCompleted = isVisible && !isActive;
        const color = STEP_COLORS[i % STEP_COLORS.length];

        return (
          <div
            key={step.node_id}
            style={{
              display: "flex",
              flexDirection: "column",
              opacity: isVisible ? 1 : 0,
              maxHeight: isVisible ? 600 : 0,
              overflow: "hidden",
              transition: "opacity 0.8s ease, max-height 0.8s ease",
            }}
          >
            {/* Step header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingTop: 10,
              paddingBottom: 4,
            }}>
              {/* Icon */}
              <div style={{
                width: 24,
                height: 24,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${color}40, ${color}80)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                {isActive ? (
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: "2px solid white",
                    borderTopColor: "transparent",
                    animation: "wf-spin 0.8s linear infinite",
                  }} />
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* Label */}
              <div>
                <span style={{
                  color: "black",
                  fontSize: 16,
                  letterSpacing: "-0.16px",
                  fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                  fontWeight: 400,
                }}>
                  {isCompleted ? "Used " : "Using "}
                </span>
                <span style={{
                  color: "black",
                  fontSize: 16,
                  letterSpacing: "-0.16px",
                  fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                  fontWeight: 500,
                }}>
                  {step.label}
                </span>
              </div>
            </div>

            {/* Description bullets */}
            {step.description.map((desc, di) => (
              <div
                key={di}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  paddingTop: 2,
                  paddingBottom: 2,
                }}
              >
                <div style={{
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    background: "#CCCCCC",
                    borderRadius: 9999,
                  }} />
                </div>
                <div style={{
                  color: "rgba(0, 0, 0, 0.6)",
                  fontSize: 12,
                  letterSpacing: "-0.12px",
                  fontFamily: "Satoshi Variable, Satoshi, sans-serif",
                  fontWeight: 400,
                }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div ref={bottomRef} />
      <style>{`
        @keyframes wf-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function useWorkflowExecutionPlan() {
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("workflow_execution_plan");
    if (stored) {
      try {
        setPlan(JSON.parse(stored));
      } catch { /* ignore */ }
      sessionStorage.removeItem("workflow_execution_plan");
    }
  }, []);

  return [plan, setPlan] as const;
}
