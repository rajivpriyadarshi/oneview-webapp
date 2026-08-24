export type ArtifactType = "wealth.family_snapshot" | string;

export type ArtifactData = {
  id: string;
  artifact_type: string;
  artifact_version: number;
  name: string;
  payload: unknown;
  message_text?: string;
};

export type WealthFamilySnapshotGroupedChange = {
  category: string;
  items: string[];
};

export type WealthFamilySnapshotTimelineChange = {
  date?: string;
  type?: string;
  title?: string;
  subtitle?: string;
};

export type WealthFamilySnapshotPayload = {
  subject?: {
    name?: string;
    summary?: string;
    portfolio_value?: number;
    currency?: string;
    change?: number;
    change_pct?: number;
  };
  lastMeeting?: {
    date?: string;
    subject?: string;
    points?: string[];
  };
  nearTermFocus?: string[];
  performanceSummary?: string[];
  changes?: Array<WealthFamilySnapshotGroupedChange | WealthFamilySnapshotTimelineChange>;
  followUps?: Array<{
    done?: boolean;
    text?: string;
  }>;
  discussionPoints?: string[];
  priorities?: string[];
  actionItems?: string[];
};

export type ArtifactPayloadMap = {
  "wealth.family_snapshot": WealthFamilySnapshotPayload;
};
