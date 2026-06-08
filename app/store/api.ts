import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "./baseQuery";
import type { Portfolio } from "../lib/portfoliosApi";
import type {
  Account,
  PortfolioViewResponse,
  SankeyResponse,
  ValuationsViewResponse,
} from "../lib/portfolioDataApi";
import type {
  DocumentRecord,
  DocumentPosition,
  BrokerStatementJobStatusResponse,
  BrokerStatementUploadResponse,
} from "../lib/documentsApi";
import type { AuthSession, PasswordlessAuthSession, Profile } from "../lib/realAuthApi";

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Portfolios", "Accounts", "PortfolioView", "Sankey", "Documents", "Profile"],
  endpoints: (builder) => ({
    // Auth
    authenticateWithGoogle: builder.mutation<
      { token: string; user: { id: number; email: string; name: string }; created: boolean },
      { id_token: string }
    >({
      query: (body) => ({ url: "/auth/google/", method: "POST", body }),
    }),
    login: builder.mutation<AuthSession, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/login/", method: "POST", body }),
    }),
    signup: builder.mutation<
      { message: string; email: string },
      { name: string; email: string; password: string; confirm_password: string; phone?: string }
    >({
      query: (body) => ({ url: "/auth/signup/", method: "POST", body }),
    }),
    verifySignupOtp: builder.mutation<AuthSession, { email: string; otp: string }>({
      query: (body) => ({ url: "/auth/signup/verify/", method: "POST", body }),
    }),
    resendSignupOtp: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({ url: "/auth/signup/resend-otp/", method: "POST", body }),
    }),
    sendPasswordlessOtp: builder.mutation<{ message: string; email: string }, { email: string }>({
      query: (body) => ({ url: "/auth/passwordless/send-otp/", method: "POST", body }),
    }),
    verifyPasswordlessOtp: builder.mutation<PasswordlessAuthSession, { email: string; otp: string }>({
      query: (body) => ({ url: "/auth/passwordless/verify/", method: "POST", body }),
    }),
    resendPasswordlessOtp: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({ url: "/auth/passwordless/resend-otp/", method: "POST", body }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({ url: "/auth/logout/", method: "POST" }),
    }),

    // Profile
    getProfile: builder.query<Profile, void>({
      query: () => "/me/",
      providesTags: ["Profile"],
    }),
    updateProfile: builder.mutation<
      Profile,
      Partial<Pick<Profile, "display_name" | "base_currency" | "timezone" | "mailer_frequency">>
    >({
      query: (body) => ({ url: "/me/", method: "PATCH", body }),
      invalidatesTags: ["Profile"],
    }),

    // Portfolios
    listPortfolios: builder.query<Portfolio[], void>({
      query: () => "/portfolios/",
      transformResponse: (response: Portfolio[] | { results: Portfolio[] }) =>
        Array.isArray(response) ? response : response.results,
      providesTags: ["Portfolios"],
    }),

    // Accounts
    getAccountsByPortfolioId: builder.query<Account[], number>({
      query: (portfolioId) => `/portfolios/${portfolioId}/accounts/`,
      transformResponse: (response: Account[] | { results: Account[] }) =>
        Array.isArray(response) ? response : response.results,
      providesTags: (_result, _error, portfolioId) => [
        { type: "Accounts", id: portfolioId },
      ],
    }),

    // Portfolio View
    getPortfolioView: builder.query<
      PortfolioViewResponse,
      { accountIds?: number[]; currency?: string; date?: string }
    >({
      query: ({ accountIds = [], currency = "INR", date }) => ({
        url: "/portfolio-view/",
        method: "POST",
        body: {
          account_ids: accountIds,
          currency,
          date: date || new Date().toISOString().split("T")[0],
        },
      }),
      providesTags: ["PortfolioView"],
    }),
    getSankey: builder.query<
      SankeyResponse,
      { accountIds?: number[]; currency?: string; date?: string }
    >({
      query: ({ accountIds = [], currency = "INR", date }) => ({
        url: "/sankey/",
        method: "POST",
        body: {
          account_ids: accountIds,
          currency,
          ...(date && { date }),
        },
      }),
      providesTags: ["Sankey"],
    }),

    // Valuations
    getValuationsView: builder.query<
      ValuationsViewResponse,
      { accountIds?: number[]; currency?: string; fromDate?: string; toDate?: string }
    >({
      query: ({ accountIds = [], currency = "INR", fromDate, toDate }) => ({
        url: "/valuations-view/",
        method: "POST",
        body: {
          account_ids: accountIds,
          currency,
          ...(fromDate && { from_date: fromDate }),
          ...(toDate && { to_date: toDate }),
        },
      }),
    }),

    // Documents
    listDocuments: builder.query<DocumentRecord[], void>({
      query: () => "/oneview/documents/",
      transformResponse: (response: DocumentRecord[] | { results: DocumentRecord[] }) =>
        Array.isArray(response) ? response : response.results,
      providesTags: ["Documents"],
    }),
    getDocument: builder.query<DocumentRecord, string>({
      query: (id) => `/oneview/documents/${id}/`,
      providesTags: (_result, _error, id) => [{ type: "Documents", id }],
    }),
    getDocumentPositions: builder.query<{ count: number; positions: DocumentPosition[] }, string>({
      query: (id) => `/oneview/documents/${id}/positions/`,
    }),
    uploadDocument: builder.mutation<
      DocumentRecord,
      { file: File; name?: string; description?: string }
    >({
      query: ({ file, name, description }) => {
        const formData = new FormData();
        formData.set("file", file);
        if (name) formData.set("name", name);
        if (description) formData.set("description", description);
        return { url: "/oneview/documents/", method: "POST", body: formData };
      },
      invalidatesTags: ["Documents"],
    }),
    updateDocument: builder.mutation<
      DocumentRecord,
      { id: string; data: Partial<Pick<DocumentRecord, "name" | "description">> }
    >({
      query: ({ id, data }) => ({
        url: `/oneview/documents/${id}/`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["Documents"],
    }),
    deleteDocument: builder.mutation<void, string>({
      query: (id) => ({ url: `/oneview/documents/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Documents"],
    }),
    uploadBrokerStatement: builder.mutation<
      BrokerStatementUploadResponse,
      {
        file: File;
        name?: string;
        description?: string;
        storeData?: boolean;
        portfolioName?: string;
        useLlmFallback?: boolean;
      }
    >({
      query: ({ file, name, description, storeData, portfolioName, useLlmFallback }) => {
        const formData = new FormData();
        formData.set("file", file);
        if (name) formData.set("name", name);
        if (description) formData.set("description", description);
        if (typeof storeData === "boolean") formData.set("store_data", String(storeData));
        if (portfolioName) formData.set("portfolio_name", portfolioName);
        if (typeof useLlmFallback === "boolean") formData.set("use_llm_fallback", String(useLlmFallback));
        return {
          url: "/oneview/broker-statements/upload/",
          method: "POST",
          body: formData,
          validateStatus: (response) =>
            response.status === 200 || response.status === 202 || response.status === 400,
        };
      },
      invalidatesTags: ["Documents", "Portfolios", "PortfolioView", "Sankey"],
    }),
    getBrokerStatementJobStatus: builder.query<BrokerStatementJobStatusResponse, string>({
      query: (jobId) => ({
        url: `/oneview/broker-statements/jobs/${encodeURIComponent(jobId)}/status/`,
        validateStatus: (response) =>
          response.status === 200 || response.status === 202 || response.status === 400,
      }),
    }),
  }),
});

export const {
  useAuthenticateWithGoogleMutation,
  useLoginMutation,
  useSignupMutation,
  useVerifySignupOtpMutation,
  useResendSignupOtpMutation,
  useSendPasswordlessOtpMutation,
  useVerifyPasswordlessOtpMutation,
  useResendPasswordlessOtpMutation,
  useLogoutMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useListPortfoliosQuery,
  useGetAccountsByPortfolioIdQuery,
  useGetPortfolioViewQuery,
  useGetSankeyQuery,
  useGetValuationsViewQuery,
  useListDocumentsQuery,
  useGetDocumentQuery,
  useGetDocumentPositionsQuery,
  useUploadDocumentMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
  useUploadBrokerStatementMutation,
  useLazyGetBrokerStatementJobStatusQuery,
} = api;
