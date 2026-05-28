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
  const token = getStoredAuthToken();

  if (!token && isProtectedRequest(args)) {
    return { error: { status: 401, data: null } };
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

  return !url.startsWith("/auth/");
}
