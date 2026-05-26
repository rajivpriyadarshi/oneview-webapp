import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { appConfig } from "../lib/config";
import { clearAuthToken, getStoredAuthToken } from "../lib/session";

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
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    clearAuthToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("oneview:unauthorized"));
    }
  }

  return result;
};
