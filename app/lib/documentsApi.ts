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
  uploaded_by?: number;
  uploaded_by_username?: string;
  accounts?: { id: number; name: string; institution_name: string; account_type: string }[];
  positions_count?: number;
  holdings_value?: number;
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

export type BrokerStatementUploadResponse = {
  status: "success" | "error";
  document_id: string | number;
  broker?: string;
  statement_date?: string;
  client_code?: string;
  account_name?: string;
  positions_count?: number;
  total_invested?: string;
  total_current?: string;
  currency?: string;
  error?: string;
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
    },
  );
}
