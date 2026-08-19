import { apiRequest } from "./apiClient";

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
