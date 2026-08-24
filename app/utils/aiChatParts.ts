import type { ArtifactData } from "../types/artifactTypes";

type JsonRecord = Record<string, unknown>;

function getRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

export function isArtifactData(value: unknown): value is ArtifactData {
  const record = getRecord(value);
  return Boolean(
    record &&
      typeof record.id === "string" &&
      typeof record.artifact_type === "string" &&
      typeof record.artifact_version === "number" &&
      typeof record.name === "string" &&
      "payload" in record,
  );
}

export function getArtifactFromPart(part: unknown): ArtifactData | null {
  const record = getRecord(part);
  if (!record) return null;

  const data = record.data;
  if (
    (record.type === "data" && (record.name === "artifact" || record.name === "data-artifact")) ||
    record.type === "data-artifact" ||
    record.type === "data-data-artifact" ||
    record.name === "data-artifact"
  ) {
    return isArtifactData(data) ? data : isArtifactData(record) ? record : null;
  }

  if (record.type === "data" && isArtifactData(data)) {
    return data;
  }

  return null;
}

export function getTextFromParts(parts: readonly unknown[]): string {
  return parts
    .map((part) => {
      const record = getRecord(part);
      return record?.type === "text" && typeof record.text === "string" ? record.text : "";
    })
    .map((text) => text.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function getArtifactFromParts(parts: readonly unknown[]): ArtifactData | null {
  const messageText = getTextFromParts(parts);
  const artifact = parts.map(getArtifactFromPart).find(Boolean);
  if (!artifact) return null;
  return messageText ? { ...artifact, message_text: messageText } : artifact;
}

export function normalizeAiChatPart(part: unknown): unknown {
  const record = getRecord(part);
  if (!record) return part;

  const artifact = getArtifactFromPart(record);
  if (artifact) {
    return {
      ...record,
      type: "data-artifact",
      data: artifact,
    };
  }

  if (record.type === "data-reply-suggestions") {
    return {
      ...record,
      type: "data-reply-suggestions",
      data: record.data,
    };
  }

  return part;
}

export function normalizeAiChatMessage<T>(message: T): T {
  const record = getRecord(message);
  if (!record) return message;

  const rawParts = Array.isArray(record.content)
    ? record.content
    : Array.isArray(record.parts)
      ? record.parts
      : null;

  if (!rawParts) return message;

  const parts = rawParts.map(normalizeAiChatPart);
  return {
    ...record,
    content: parts,
    parts,
  } as T;
}

export function normalizeAiChatSsePayload(payload: unknown): unknown {
  const part = normalizeAiChatPart(payload);
  if (part !== payload) return part;

  const record = getRecord(payload);
  if (!record) return payload;

  let changed = false;
  const next: JsonRecord = { ...record };

  for (const key of ["messages", "content", "parts"] as const) {
    if (!Array.isArray(record[key])) continue;
    next[key] = record[key].map((item) => {
      const normalized = key === "messages" ? normalizeAiChatMessage(item) : normalizeAiChatPart(item);
      if (normalized !== item) changed = true;
      return normalized;
    });
  }

  if (record.message) {
    const normalizedMessage = normalizeAiChatMessage(record.message);
    if (normalizedMessage !== record.message) {
      next.message = normalizedMessage;
      changed = true;
    }
  }

  return changed ? next : payload;
}

export function transformAiChatSseResponse(response: Response): Response {
  if (!response.body) return response;

  const reader = response.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      const flushLine = (line: string) => {
        if (!line.startsWith("data: ")) {
          controller.enqueue(encoder.encode(`${line}\n`));
          return;
        }

        const data = line.slice(6);
        if (!data || data === "[DONE]") {
          controller.enqueue(encoder.encode(`${line}\n`));
          return;
        }

        try {
          const json = JSON.parse(data);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(normalizeAiChatSsePayload(json))}\n`));
        } catch {
          controller.enqueue(encoder.encode(`${line}\n`));
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            flushLine(line.replace(/\r$/, ""));
          }
        }

        buffer += decoder.decode();
        if (buffer) flushLine(buffer.replace(/\r$/, ""));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}
