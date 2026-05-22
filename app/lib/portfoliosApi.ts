import { apiRequest } from "./apiClient";

export type Portfolio = {
  id: number;
  name: string;
  base_currency: string;
  base_currency_code?: string;
  primary_fx_provider?: string;
  created_at?: string;
  updated_at?: string;
};

type PaginatedPortfolios = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Portfolio[];
};

export async function listPortfolios() {
  const response = await apiRequest<Portfolio[] | PaginatedPortfolios>(
    "/portfolios/",
  );

  return Array.isArray(response) ? response : response.results;
}
