import { apiRequest } from "./apiClient";

export type DocumentRecord = {
  id: string | number;
  name: string;
  display_name?: string;
  description: string;
  file: string;
  file_url?: string;
  file_size: number;
  content_type: string;
  broker?: string;
  document_type?: string;
  processing_status?: string;
  currency?: string;
  uploaded_by?: number;
  uploaded_by_username?: string;
  accounts?: { id: number; name: string; institution_name: string; account_type: string }[];
  positions_count?: number;
  holdings_value?: number;
  metadata?: unknown;
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
    account_created?: boolean;
    positions_created: number;
    positions_updated: number;
    listings_created: number;
    overwrote_existing?: boolean;
  };
};

export type BrokerStatementUploadProcessingResponse = {
  status: "processing";
  job_id: string;
  document_id: string | number;
  message?: string;
};

export type BrokerStatementDuplicateResponse = {
  status: "duplicate";
  detail: string;
  existing_document_id: number;
  existing_document_name: string;
  uploaded_at: string;
};

export type BrokerStatementErrorResponse = {
  status: "error";
  job_id?: string;
  document_id?: string | number;
  error?: string;
  error_code?: "password_required" | "password_incorrect";
};

export type BrokerStatementUploadResponse =
  | BrokerStatementUploadSuccessResponse
  | BrokerStatementUploadProcessingResponse
  | BrokerStatementDuplicateResponse
  | BrokerStatementErrorResponse;

export type BrokerStatementJobProgress = {
  label?: string;
  current?: number;
  total?: number;
};

export type DocumentStatusResponse = {
  id: string | number;
  processing_status?: string;
  progress?: BrokerStatementJobProgress;
  job_id?: string;
  error?: string;
  failure_details?: unknown;
};

export type DeleteDocumentResponse = {
  status: "deleted";
  deactivate_empty_accounts: boolean;
  document_id: string | number;
  deleted_positions: number;
  deactivated_accounts: number;
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

export function isBrokerStatementUploadStatusValid(response: { status: number }) {
  return [200, 202, 400, 409].includes(response.status);
}

export function isBrokerStatementJobStatusValid(response: { status: number }) {
  return [200, 202, 400].includes(response.status);
}

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

function getClientQueryString(clientId?: number | string | null) {
  if (!clientId) return "";
  const searchParams = new URLSearchParams({ client_id: String(clientId) });
  return `?${searchParams.toString()}`;
}

export async function listDocuments(clientId?: number | string | null) {
  const response = await apiRequest<DocumentRecord[] | { results: DocumentRecord[] }>(
    `/oneview/documents/${getClientQueryString(clientId)}`,
  );
  return Array.isArray(response) ? response : response.results;
}

export function uploadDocument(input: {
  file: File;
  clientId?: number | string | null;
  name?: string;
  description?: string;
}) {
  const formData = new FormData();
  formData.set("file", input.file);

  if (input.clientId) {
    formData.set("client_id", String(input.clientId));
  }

  if (input.name) {
    formData.set("name", input.name);
  }

  if (input.description) {
    formData.set("description", input.description);
  }

  return apiRequest<BrokerStatementUploadResponse>("/oneview/document/upload/", {
    method: "POST",
    body: formData,
    validateStatus: isBrokerStatementUploadStatusValid,
  });
}

export function getDocument(id: string, clientId?: number | string | null) {
  return apiRequest<DocumentRecord>(`/oneview/documents/${id}/${getClientQueryString(clientId)}`);
}

export function getDocumentStatus(id: string, clientId: number | string) {
  return apiRequest<DocumentStatusResponse>(
    `/oneview/documents/${id}/status/${getClientQueryString(clientId)}`,
  );
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

export function deleteDocument(
  id: string,
  clientId?: number | string | null,
  options?: { deactivateEmptyAccounts?: boolean },
) {
  const searchParams = new URLSearchParams();
  if (clientId) searchParams.set("client_id", String(clientId));
  if (typeof options?.deactivateEmptyAccounts === "boolean") {
    searchParams.set("deactivate_empty_accounts", String(options.deactivateEmptyAccounts));
  }
  const qs = searchParams.toString();

  return apiRequest<DeleteDocumentResponse>(`/oneview/documents/${id}/${qs ? `?${qs}` : ""}`, {
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
  password?: string;
  clientId?: number | string | null;
  storeData?: boolean;
  portfolioName?: string;
  portfolioId?: number | string;
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

  if (input.password) {
    formData.set("password", input.password);
  }

  if (input.clientId) {
    formData.set("client_id", String(input.clientId));
  }

  if (typeof input.storeData === "boolean") {
    formData.set("store_data", String(input.storeData));
  }

  if (input.portfolioName) {
    formData.set("portfolio_name", input.portfolioName);
  }

  if (input.portfolioId) {
    formData.set("portfolio_id", String(input.portfolioId));
  }

  if (typeof input.useLlmFallback === "boolean") {
    formData.set("use_llm_fallback", String(input.useLlmFallback));
  }

  return apiRequest<BrokerStatementUploadResponse>(
    "/oneview/document/upload/",
    {
      method: "POST",
      body: formData,
      validateStatus: isBrokerStatementUploadStatusValid,
    },
  );
}

export function getBrokerStatementJobStatus(jobId: string) {
  return apiRequest<BrokerStatementJobStatusResponse>(
    `/oneview/broker-statements/jobs/${encodeURIComponent(jobId)}/status/`,
    {
      validateStatus: isBrokerStatementJobStatusValid,
    },
  );
}

export type BrokerStatementJob = {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed" | "needs_review";
  original_filename: string;
  document_id: number | null;
  created_at: string;
  updated_at: string;
  progress: { label?: string; current?: number; total?: number } | null;
  broker_detected: string | null;
  positions_count: number | null;
  error_summary: string | null;
};

export function listBrokerStatementJobs() {
  return apiRequest<BrokerStatementJob[]>("/oneview/broker-statements/jobs/");
}

export function retryWithPassword(input: {
  documentId: string | number;
  password: string;
}) {
  const formData = new FormData();
  formData.set("document_id", String(input.documentId));
  formData.set("password", input.password);

  return apiRequest<BrokerStatementUploadResponse>(
    "/oneview/broker-statements/retry-with-password/",
    {
      method: "POST",
      body: formData,
    },
  );
}
