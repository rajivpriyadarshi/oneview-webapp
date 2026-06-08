import { apiRequest } from "./apiClient";

export type DocumentRecord = {
  id: string | number;
  name: string;
  description: string;
  file: string;
  file_url?: string;
  file_size: number;
  content_type: string;
  uploaded_by?: number;
  uploaded_by_username?: string;
  accounts?: unknown[];
  positions_count?: number;
  created_at: string;
  updated_at?: string;
};

export type DocumentPosition = {
  id: number;
  security_name: string;
  ticker: string;
  isin: string;
  asset_type: string;
  currency: string;
  as_of_date: string;
  quantity: string;
  cost_basis: string;
  cost_basis_currency: string;
  market_value: string;
  market_value_currency: string;
  account_name: string;
};

export type BrokerStatementUploadSuccessResponse = {
  status: "success";
  document_id: string | number;
  broker?: string;
  statement_date?: string;
  client_code?: string;
  account_name?: string;
  positions_count?: number;
  total_invested?: string;
  total_current?: string;
  currency?: string;
  warnings?: string[];
  positions?: unknown[];
  positions_truncated?: boolean;
  total_positions?: number;
  storage?: {
    portfolio: string;
    account: string;
    account_id: number;
    positions_created: number;
    positions_updated: number;
    listings_created: number;
  };
};

export type BrokerStatementUploadProcessingResponse = {
  status: "processing";
  job_id: string;
  document_id: string | number;
  message?: string;
};

export type BrokerStatementErrorResponse = {
  status: "error";
  job_id?: string;
  document_id?: string | number;
  error?: string;
};

export type BrokerStatementUploadResponse =
  | BrokerStatementUploadSuccessResponse
  | BrokerStatementUploadProcessingResponse
  | BrokerStatementErrorResponse;

export type BrokerStatementJobProgress = {
  label?: string;
  current?: number;
  total?: number;
};

export type BrokerStatementJobStatusResponse =
  | BrokerStatementUploadSuccessResponse
  | {
      status: "processing";
      job_id: string;
      progress?: BrokerStatementJobProgress;
    }
  | {
      status: "needs_review";
      job_id: string;
      message?: string;
    }
  | BrokerStatementErrorResponse;

export const BROKER_STATEMENT_JOB_POLL_INTERVAL_MS = 5000;
export const BROKER_STATEMENT_JOB_TIMEOUT_MS = 5 * 60 * 1000;

export async function pollBrokerStatementJobStatus(input: {
  jobId: string;
  getStatus: (jobId: string) => Promise<BrokerStatementJobStatusResponse>;
  onProgress?: (progress?: BrokerStatementJobProgress) => void;
  signal?: AbortSignal;
  intervalMs?: number;
  timeoutMs?: number;
}) {
  const {
    jobId,
    getStatus,
    onProgress,
    signal,
    intervalMs = BROKER_STATEMENT_JOB_POLL_INTERVAL_MS,
    timeoutMs = BROKER_STATEMENT_JOB_TIMEOUT_MS,
  } = input;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    if (signal?.aborted) {
      throw createAbortError();
    }

    const response = await getStatus(jobId);

    if (response.status !== "processing") {
      return response;
    }

    onProgress?.(response.progress);

    const elapsed = Date.now() - startedAt;
    const remaining = timeoutMs - elapsed;

    if (remaining <= 0) {
      break;
    }

    await wait(Math.min(intervalMs, remaining), signal);
  }

  throw new Error("Statement processing timed out. Try again in a few minutes.");
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    function handleAbort() {
      globalThis.clearTimeout(timeoutId);
      reject(createAbortError());
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function createAbortError() {
  const error = new Error("Polling aborted.");
  error.name = "AbortError";
  return error;
}

export async function listDocuments() {
  const response = await apiRequest<DocumentRecord[] | { results: DocumentRecord[] }>(
    "/oneview/documents/",
  );
  return Array.isArray(response) ? response : response.results;
}

export function uploadDocument(input: {
  file: File;
  name?: string;
  description?: string;
}) {
  const formData = new FormData();
  formData.set("file", input.file);

  if (input.name) {
    formData.set("name", input.name);
  }

  if (input.description) {
    formData.set("description", input.description);
  }

  return apiRequest<DocumentRecord>("/oneview/documents/", {
    method: "POST",
    body: formData,
  });
}

export function getDocument(id: string) {
  return apiRequest<DocumentRecord>(`/oneview/documents/${id}/`);
}

export function updateDocument(
  id: string,
  input: Partial<Pick<DocumentRecord, "name" | "description">>,
) {
  return apiRequest<DocumentRecord>(`/oneview/documents/${id}/`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteDocument(id: string) {
  return apiRequest<void>(`/oneview/documents/${id}/`, {
    method: "DELETE",
  });
}

export function getDocumentPositions(id: string) {
  return apiRequest<{ count: number; positions: DocumentPosition[] }>(
    `/oneview/documents/${id}/positions/`,
  );
}

export function uploadBrokerStatement(input: {
  file: File;
  name?: string;
  description?: string;
  storeData?: boolean;
  portfolioName?: string;
  useLlmFallback?: boolean;
}) {
  const formData = new FormData();
  formData.set("file", input.file);

  if (input.name) {
    formData.set("name", input.name);
  }

  if (input.description) {
    formData.set("description", input.description);
  }

  if (typeof input.storeData === "boolean") {
    formData.set("store_data", String(input.storeData));
  }

  if (input.portfolioName) {
    formData.set("portfolio_name", input.portfolioName);
  }

  if (typeof input.useLlmFallback === "boolean") {
    formData.set("use_llm_fallback", String(input.useLlmFallback));
  }

  return apiRequest<BrokerStatementUploadResponse>(
    "/oneview/broker-statements/upload/",
    {
      method: "POST",
      body: formData,
      validateStatus: (response) =>
        response.status === 200 || response.status === 202 || response.status === 400,
    },
  );
}

export function getBrokerStatementJobStatus(jobId: string) {
  return apiRequest<BrokerStatementJobStatusResponse>(
    `/oneview/broker-statements/jobs/${encodeURIComponent(jobId)}/status/`,
    {
      validateStatus: (response) =>
        response.status === 200 || response.status === 202 || response.status === 400,
    },
  );
}
