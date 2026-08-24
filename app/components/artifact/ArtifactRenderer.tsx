import type { ArtifactData, WealthFamilySnapshotPayload } from "../../types/artifactTypes";
import MarkdownContent from "../MarkdownContent";
import PortfolioReviewContent from "./PortfolioReviewContent";

export default function ArtifactRenderer({ artifact }: { artifact: ArtifactData }) {
  const { artifact_type, artifact_version, name, payload } = artifact;
  const messageText = artifact.message_text?.trim();

  if (messageText) {
    return (
      <>
        <h1 className="mb-[20px] font-serif text-[28px] font-normal leading-[1.1] text-black">
          Meeting Preparation
        </h1>
        <section className="rounded-[16px] border border-black/10 bg-white/70 p-[18px]">
          <MarkdownContent>{messageText}</MarkdownContent>
        </section>
      </>
    );
  }

  // Registry pattern for extensibility
  if (artifact_type === "wealth.family_snapshot" && artifact_version === 1) {
    return <PortfolioReviewContent payload={payload as WealthFamilySnapshotPayload} />;
  }

  // Fallback for unknown types
  return (
    <>
      <h1 className="mb-[20px] font-serif text-[28px] font-normal leading-[1.1] text-black">
        {name || "Artifact"}
      </h1>
      <div className="rounded-[12px] border border-[#973022]/20 bg-white/90 p-[16px]">
        <p className="mb-[12px] font-satoshi text-[14px] font-semibold text-[#8f2415]">
          Unknown artifact type: {artifact_type}@{artifact_version}
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-[8px] bg-black/5 p-[12px] font-mono text-[12px] text-black/70">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </>
  );
}
