import { apiRequest } from "./apiClient";
import type { Interaction, InteractionsResponse, InteractionSourceType } from "../types/interactionTypes";

export type WealthCrmClient = {
  id: number;
  display_name: string;
  legal_name?: string | null;
  party_type?: string | null;
  base_currency?: string | null;
  primary_tax_jurisdiction?: string | null;
  is_active?: boolean;
  last_interaction_at?: string | null;
  upcoming_meeting_at?: string | null;
  net_worth?: string | number | null;
  net_worth_currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  segment?: string | null;
  family_status?: string | null;
  risk_profile?: string | null;
};

type WealthCrmClientsResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: WealthCrmClient[];
};

export async function listWealthCrmClients(params?: { search?: string; isActive?: boolean; page?: number }) {
  const searchParams = new URLSearchParams();

  if (params?.search) {
    searchParams.set("search", params.search);
  }

  if (typeof params?.isActive === "boolean") {
    searchParams.set("is_active", String(params.isActive));
  }

  if (params?.page) {
    searchParams.set("page", String(params.page));
  }

  const query = searchParams.toString();
  const response = await apiRequest<WealthCrmClientsResponse | WealthCrmClient[]>(
    `/crm/clients/${query ? `?${query}` : ""}`,
  );

  return Array.isArray(response) ? response : response.results;
}

export async function getWealthCrmClient(clientId: number | string) {
  return apiRequest<WealthCrmClient>(`/crm/clients/${encodeURIComponent(String(clientId))}/`);
}

export type ClientDetailResponse = {
  header: {
    display_name: string;
    summary: string;
    tags: string[];
    party_type: string;
  };
  aum: {
    total: string;
    currency: string;
    change_1m: string;
    change_1m_pct: string;
  };
  at_a_glance: {
    net_worth: string;
    net_worth_currency: string;
    client_since: string | null;
    segment: string | null;
    family: string | null;
    risk_profile: string | null;
  };
  asset_allocation: {
    total_managed: string;
    currency: string;
    buckets: Array<{
      label: string;
      value: string;
      pct: string;
    }>;
  };
  insights: unknown[];
  recent_activity: unknown[];
};

export async function getClientDetail(clientId: number | string) {
  return apiRequest<ClientDetailResponse>(`/crm/clients/${encodeURIComponent(String(clientId))}/`);
}

export async function listClientInteractions(
  clientId: number | string,
  params?: {
    source_type?: InteractionSourceType;
    search?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
  }
) {
  const searchParams = new URLSearchParams();

  if (params?.source_type) {
    searchParams.set("source_type", params.source_type);
  }

  if (params?.search) {
    searchParams.set("search", params.search);
  }

  if (params?.date_from) {
    searchParams.set("date_from", params.date_from);
  }

  if (params?.date_to) {
    searchParams.set("date_to", params.date_to);
  }

  if (params?.page) {
    searchParams.set("page", String(params.page));
  }

  const query = searchParams.toString();
  const response = await apiRequest<InteractionsResponse>(
    `/crm/clients/${encodeURIComponent(String(clientId))}/interactions/${query ? `?${query}` : ""}`
  );

  return response;
}
