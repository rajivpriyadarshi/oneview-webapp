"use client";

import type { ArtifactData } from "../types/artifactTypes";
import { useArtifactContext } from "../hooks/useArtifactContext";
import { getArtifactTypeLabel } from "../utils/artifactFormatters";

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getArtifactCardLabel(artifact: ArtifactData) {
  const name = artifact.name.toLowerCase();
  if (name.includes("meeting") || name.includes("prep")) {
    return "MEETING PREP";
  }

  return getArtifactTypeLabel(artifact.artifact_type);
}

function getArtifactCardTitle(artifact: ArtifactData) {
  const payload = getRecord(artifact.payload);
  const explicitTitle = payload.title;
  if (typeof explicitTitle === "string" && explicitTitle.trim()) {
    return explicitTitle.trim();
  }

  if (artifact.artifact_type === "wealth.family_snapshot") {
    const subject = getRecord(payload.subject);
    const subjectName = subject.name;
    if (typeof subjectName === "string" && subjectName.trim()) {
      return `Quarterly portfolio review with ${subjectName.trim()}`;
    }
  }

  return artifact.name;
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ArtifactMessage({ artifact }: { artifact: ArtifactData }) {
  const { openArtifact } = useArtifactContext();
  const label = getArtifactCardLabel(artifact);
  const title = getArtifactCardTitle(artifact);

  return (
    <div
      className="my-3 w-full cursor-pointer rounded-[16px] p-[1.5px] transition hover:-translate-y-px"
      style={{
        backgroundImage: "linear-gradient(120deg, rgba(255,190,106,0.95), rgba(246,224,177,0.55) 45%, rgba(210,122,196,0.8)), url('/insights.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        margin: "12px 0",
      }}
      onClick={() => openArtifact(artifact)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openArtifact(artifact);
        }
      }}
    >
      <div
        className="flex items-center justify-between gap-[16px] rounded-[14.5px] bg-white px-[16px] py-[20px]"
      >
        <div className="min-w-0">
          <p className="mb-[4px] font-satoshi text-[10px] font-medium uppercase tracking-[0.14em] text-black/50">
            {label}
          </p>
          <p className="truncate font-satoshi text-[16px] font-semibold leading-[1.25] tracking-[-0.16px] text-[#7b674f]">
            {title}
          </p>
          <span className="sr-only">Click to view details</span>
        </div>
        <span className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(135deg,#ffe7a4_0%,#f7b73f_46%,#e9bdd8_100%)] text-[#a46100] shadow-[0_4px_12px_rgba(178,108,21,0.18)]">
          <ArrowIcon />
        </span>
      </div>
    </div>
  );
}
