import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { appConfig } from "../lib/config";
import { clearAuthToken, getStoredAuthToken, getStoredAdvisorProfile } from "../lib/session";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: appConfig.apiBaseUrl,
  prepareHeaders: (headers) => {
    const token = getStoredAuthToken();
    if (token) {
      headers.set("Authorization", `Token ${token}`);
    }
    return headers;
  },
});

export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const token = getStoredAuthToken();

  if (!token && isProtectedRequest(args)) {
    return { error: { status: 401, data: null } };
  }

  // Mock responses for CRM users (advisor profile exists)
  const advisorProfile = getStoredAdvisorProfile();
  if (advisorProfile) {
    const url = typeof args === "string" ? args : args.url;
    const mockResponse = getMockResponseForCRM(url);
    if (mockResponse) {
      return { data: mockResponse };
    }
  }

  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    clearAuthToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("oneview:unauthorized"));
    }
  }

  return result;
};

function isProtectedRequest(args: string | FetchArgs) {
  const url = typeof args === "string" ? args : args.url;

  // Allow public endpoints without token requirement
  return !url.startsWith("/auth/") && !url.includes("/crm/login");
}

function getMockResponseForCRM(url: string): unknown {
  // Mock portfolios endpoint
  if (url === "/portfolios/") {
    return [];
  }

  // Mock currencies endpoint
  if (url === "/currencies/") {
    return {
      currencies: [
        { currency_code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
        { currency_code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
        { currency_code: "GBP", name: "British Pound", symbol: "£", decimals: 2 },
        { currency_code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 },
        { currency_code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2 },
      ],
    };
  }

  // Mock profile endpoint
  if (url === "/me/") {
    const advisor = getStoredAdvisorProfile();
    return {
      id: advisor?.id || 1,
      username: advisor?.email?.split("@")[0] || "advisor",
      email: advisor?.email || "advisor@example.com",
      display_name: advisor?.name || "Advisor",
      base_currency: "USD",
      timezone: "Asia/Singapore",
      is_active: true,
      mailer_frequency: "weekly",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return null;
}
