import { apiRequest } from "./apiClient";

export type Account = {
  id: number;
  name: string;
  account_type: string;
  base_currency: string;
  institution_name?: string;
  is_active: boolean;
};

export type PortfolioViewSummary = {
  total_market_value: number;
  total_cost_basis: number;
  total_cash: number;
  total_gain_amount: number;
  total_gain_pct: number | null;
};

export type PortfolioViewAccount = {
  account_id: number;
  account_name: string;
  institution_name: string | null;
  base_currency: string;
  market_value: number;
  cost_basis: number;
  cash: number;
  gain_amount: number;
  gain_pct: number | null;
  snapshot_date: string | null;
  position_count: number;
};

export type PortfolioViewPosition = {
  ticker: string;
  name: string;
  isin: string;
  asset_type: string;
  quantity: number;
  market_value: number;
  cost_basis: number;
  gain_amount: number;
  gain_pct: number | null;
  weight_pct: number | null;
  currency: string;
  account_ids: number[];
};

export type AssetAllocation = {
  [key: string]: {
    market_value: number;
    weight_pct: number | null;
  };
};

export type PortfolioViewResponse = {
  as_of_date: string;
  currency: string;
  summary: PortfolioViewSummary;
  accounts: PortfolioViewAccount[];
  positions: PortfolioViewPosition[];
  asset_allocation: AssetAllocation;
  sector_allocation?: AssetAllocation;
  currency_allocation?: AssetAllocation;
};

export async function getAccountsByPortfolioId(portfolioId: number) {
  const response = await apiRequest<Account[] | { results: Account[] }>(
    `/portfolios/${portfolioId}/accounts/`,
  );
  return Array.isArray(response) ? response : response.results;
}

export async function getPortfolioView(accountIds?: number[], currency = "INR", date?: string) {
  const today = date || new Date().toISOString().split("T")[0];
  return apiRequest<PortfolioViewResponse>("/portfolio-view/", {
    method: "POST",
    body: {
      account_ids: accountIds || [],
      currency,
      date: today,
    },
  });
}

export type ValuationSeriesPoint = {
  date: string;
  market_value: number;
  cost_basis: number;
  gain_amount: number;
};

export type ValuationsViewResponse = {
  from_date: string;
  to_date: string;
  currency: string;
  summary: {
    total_market_value: number;
    total_cost_basis: number;
    total_gain_amount: number;
    total_gain_pct: number | null;
  };
  price_series: ValuationSeriesPoint[];
  accounts: {
    account_id: number;
    account_name: string;
    institution_name: string | null;
    base_currency: string;
    series: ValuationSeriesPoint[];
  }[];
};

export async function getValuationsView(accountIds?: number[], currency = "INR", fromDate?: string, toDate?: string) {
  return apiRequest<ValuationsViewResponse>("/valuations-view/", {
    method: "POST",
    body: {
      account_ids: accountIds || [],
      currency,
      ...(fromDate && { from_date: fromDate }),
      ...(toDate && { to_date: toDate }),
    },
  });
}

export type SankeyNodeType = "portfolio" | "account" | "asset_type" | "instrument";

export type SankeyNode = {
  id: string;
  label: string;
  type: SankeyNodeType;
  level: number;
  color: string;
  sort_order: number;
  metadata?: {
    account_id?: number;
    institution_name?: string;
    position_count?: number;
    ticker?: string;
    name?: string;
    isin?: string;
    gain_pct?: number | null;
    weight_pct?: number | null;
  };
};

export type SankeyLink = {
  id: string;
  from: string;
  to: string;
  value: number;
  currency: string;
};

export type SankeyResponse = {
  as_of_date: string;
  currency: string;
  group_by: "account_asset_type_instrument";
  totals: {
    market_value: number;
    cost_basis: number;
    cash: number;
    gain_amount: number;
    gain_pct: number | null;
  };
  nodes: SankeyNode[];
  links: SankeyLink[];
  metadata: {
    generated_at: string;
    data_source: "portfolio_positions";
    value_basis: "market_value";
    has_uncategorized: boolean;
    min_link_value: number;
  };
};

export async function getSankey(accountIds?: number[], currency = "INR", date?: string) {
  return apiRequest<SankeyResponse>("/sankey/", {
    method: "POST",
    body: {
      account_ids: accountIds || [],
      currency,
      ...(date && { date }),
    },
  });
}
