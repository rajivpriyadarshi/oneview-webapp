import { apiRequest } from "./apiClient";

export type Account = {
  id: number;
  name: string;
  account_type: string;
  base_currency: string;
  institution_name?: string;
  is_active: boolean;
};

export type AccountValuation = {
  account_id: number;
  account_name: string;
  market_value: string;
  cost_basis: string;
  cash_balance: string;
  gain_amount: string;
  gain_pct: string;
  cumulative_twr: string;
  currency: string;
};

export type PortfolioValuation = {
  portfolio_id: number;
  portfolio_name: string;
  currency: string;
  market_value: string;
  cost_basis: string;
  gain_amount: string;
  gain_pct: string;
  accounts: AccountValuation[];
};

export type HoldingPosition = {
  id: number;
  portfolio_listing: number;
  security_name?: string;
  name?: string;
  ticker_symbol?: string;
  ticker?: string;
  type?: string;
  quantity: string;
  price?: string;
  current_price?: string;
  market_value: string;
  cost_basis: string;
  cost_basis_amount?: string;
  cost_basis_currency?: string;
  market_value_amount?: string;
  market_value_currency?: string;
  gain_amount?: string;
  gain_pct?: string;
};

export type HoldingsSnapshot = {
  id: number;
  account: number;
  as_of_date: string;
  positions: HoldingPosition[];
  positions_json: HoldingPosition[];
};

export type DailyValuation = {
  valuation_date: string;
  market_value: string;
  cost_basis: string;
  gain_amount: string;
  gain_pct: string;
  daily_twr?: string;
  cumulative_twr?: string;
};

export async function getPortfolioById(portfolioId: number) {
  return apiRequest<{ id: number; name: string; base_currency: string; accounts?: Account[] }>(
    `/portfolios/${portfolioId}/`,
  );
}

export async function getAccountsByPortfolioId(portfolioId: number) {
  const response = await apiRequest<Account[] | { results: Account[] }>(
    `/portfolios/${portfolioId}/accounts/`,
  );
  return Array.isArray(response) ? response : response.results;
}

export async function getPortfolioValuation(portfolioId: number, currency?: string) {
  const params = currency ? `?currency=${currency}` : "";
  return apiRequest<PortfolioValuation>(
    `/portfolios/${portfolioId}/valuation/${params}`,
  );
}

export async function getAccountValuation(portfolioId: number, accountId: number, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<DailyValuation[]>(
    `/portfolios/${portfolioId}/accounts/${accountId}/valuation/${query}`,
  );
}

export async function getAccountHoldings(portfolioId: number, accountId: number, date?: string) {
  const params = date ? `?date=${date}` : "";
  return apiRequest<HoldingsSnapshot>(
    `/portfolios/${portfolioId}/accounts/${accountId}/holdings/${params}`,
  );
}
