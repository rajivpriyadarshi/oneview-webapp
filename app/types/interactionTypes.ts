export type InteractionSourceType =
  | "email"
  | "voice_note"
  | "text_note"
  | "meeting_note"
  | "call_summary"
  | "document";

export type InteractionDirection =
  | "client_to_advisor"
  | "advisor_to_client"
  | "meeting"
  | "internal"
  | "other";

export interface InteractionMemoryDelta {
  identity?: {
    name?: string;
  };
  next_actions?: string[];
  key_takeaways?: string[];
  [key: string]: any;
}

export interface Interaction {
  id: number;
  occurred_at: string;
  source_type: InteractionSourceType;
  source_type_display: string;
  direction: InteractionDirection;
  direction_display: string;
  subject: string;
  subtitle: string;
  extracted_summary?: string | null;
  memory_delta?: InteractionMemoryDelta | null;
  memory_updated: boolean;
  key_takeaways?: string[];
  next_steps?: string[];
  meeting_duration_minutes?: number | null;
  attendees?: string[];
  created_at: string;
}

export interface InteractionsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Interaction[];
}
