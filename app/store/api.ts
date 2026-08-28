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
  BrokerStatementJob,
  DocumentStatusResponse,
  DocumentJobStatusResponse,
  DeleteDocumentResponse,
} from "../lib/documentsApi";
import {
  isBrokerStatementJobStatusValid,
  isBrokerStatementUploadStatusValid,
  isDocumentJobStatusValid,
} from "../lib/documentsApi";
import type { AuthSession, PasswordlessAuthSession, Profile, CRMAuthSession } from "../lib/realAuthApi";

export type CrmAttentionItem = {
  type: "meeting" | "task" | "portfolio_change" | "opportunity" | "request" | "message";
  id: number;
  title: string;
  subtitle: string;
  occurred_at: string | null;
  scheduled_at: string | null;
};

export type CrmClient = {
  id: number;
  display_name: string;
  legal_name: string;
  party_type: string;
  base_currency: string;
  primary_tax_jurisdiction: string;
  is_active: boolean;
  priority: "high" | "medium" | "low";
  last_interaction_at: string | null;
  upcoming_meeting_at: string | null;
  net_worth: string | null;
  net_worth_currency: string | null;
  net_worth_change_1m: string | null;
  net_worth_change_1m_pct: string | null;
  attention_item: CrmAttentionItem | null;
  created_at: string;
  updated_at: string;
};

export type CrmAlert = {
  id: number;
  relationship_manager: number;
  client: number | null;
  client_name: string | null;
  title: string;
  type: string | null;
  cta_url: string | null;
  cta_text: string | null;
  mark_read: boolean;
  created_at: string;
};

export type CrmAlertsResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: CrmAlert[];
};

export type CrmMeeting = {
  id: number;
  relationship_manager: number;
  client: number | null;
  client_name: string | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  created_at: string;
};

export type CrmMeetingsResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: CrmMeeting[];
};

export type CrmClientsResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: CrmClient[];
};

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
    crmLogin: builder.mutation<CRMAuthSession, { email: string; password: string }>({
      query: (body) => ({ url: "/crm/login/", method: "POST", body }),
    }),
    crmLogout: builder.mutation<{ message: string }, void>({
      query: () => ({ url: "/crm/logout/", method: "POST" }),
    }),
    crmResetData: builder.mutation<{ status: string; message: string }, void>({
      query: () => ({ url: "/crm/reset/", method: "POST" }),
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
      { accountIds?: number[]; currency?: string }
    >({
      query: ({ accountIds = [], currency = "INR" }) => ({
        url: "/portfolio-view/",
        method: "POST",
        body: {
          account_ids: accountIds,
          currency,
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
      { accountIds?: number[]; currency?: string }
    >({
      query: ({ accountIds = [], currency = "INR" }) => ({
        url: "/valuations-view/",
        method: "POST",
        body: {
          account_ids: accountIds,
          currency,
        },
      }),
    }),

    // Documents
    listDocuments: builder.query<DocumentRecord[], number | string | void>({
      query: (clientId) => {
        const searchParams = new URLSearchParams();
        if (clientId) searchParams.set("client_id", String(clientId));
        const qs = searchParams.toString();
        return `/oneview/documents/${qs ? `?${qs}` : ""}`;
      },
      transformResponse: (response: DocumentRecord[] | { results: DocumentRecord[] }) =>
        Array.isArray(response) ? response : response.results,
      keepUnusedDataFor: 0,
      providesTags: ["Documents"],
    }),
    getDocument: builder.query<DocumentRecord, { id: string; clientId?: number | string | null }>({
      query: ({ id, clientId }) => {
        const searchParams = new URLSearchParams();
        if (clientId) searchParams.set("client_id", String(clientId));
        const qs = searchParams.toString();
        return `/oneview/documents/${id}/${qs ? `?${qs}` : ""}`;
      },
      providesTags: (_result, _error, { id }) => [{ type: "Documents", id }],
    }),
    getDocumentPositions: builder.query<{ count: number; positions: DocumentPosition[] }, string>({
      query: (id) => `/oneview/documents/${id}/positions/`,
    }),
    uploadDocument: builder.mutation<
      BrokerStatementUploadResponse,
      { file: File; clientId?: number | string | null; name?: string; description?: string }
    >({
      query: ({ file, clientId, name, description }) => {
        const formData = new FormData();
        formData.set("file", file);
        if (clientId) formData.set("client_id", String(clientId));
        if (name) formData.set("name", name);
        if (description) formData.set("description", description);
        return {
          url: "/oneview/document/upload/",
          method: "POST",
          body: formData,
          validateStatus: isBrokerStatementUploadStatusValid,
        };
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
    getDocumentStatus: builder.query<DocumentStatusResponse, { id: string; clientId: number | string }>({
      query: ({ id, clientId }) => {
        const searchParams = new URLSearchParams({ client_id: String(clientId) });
        return `/oneview/documents/${id}/status/?${searchParams.toString()}`;
      },
      providesTags: (_result, _error, { id }) => [{ type: "Documents", id }],
    }),
    getDocumentJobStatus: builder.query<DocumentJobStatusResponse, string>({
      query: (jobId) => ({
        url: `/oneview/document/jobs/${encodeURIComponent(jobId)}/status/`,
        validateStatus: isDocumentJobStatusValid,
      }),
    }),
    deleteDocument: builder.mutation<
      DeleteDocumentResponse,
      string | { id: string; clientId?: number | string | null; deactivateEmptyAccounts?: boolean }
    >({
      query: (arg) => {
        const id = typeof arg === "string" ? arg : arg.id;
        const searchParams = new URLSearchParams();
        if (typeof arg !== "string" && arg.clientId) searchParams.set("client_id", String(arg.clientId));
        if (typeof arg !== "string" && typeof arg.deactivateEmptyAccounts === "boolean") {
          searchParams.set("deactivate_empty_accounts", String(arg.deactivateEmptyAccounts));
        }
        const qs = searchParams.toString();
        return { url: `/oneview/documents/${id}/${qs ? `?${qs}` : ""}`, method: "DELETE" };
      },
      invalidatesTags: ["Documents"],
    }),
    uploadBrokerStatement: builder.mutation<
      BrokerStatementUploadResponse,
      {
        file: File;
        name?: string;
        description?: string;
        password?: string;
        clientId?: number | string | null;
        storeData?: boolean;
        portfolioName?: string;
        portfolioId?: number | string;
        useLlmFallback?: boolean;
      }
    >({
      query: ({ file, name, description, password, clientId, storeData, portfolioName, portfolioId, useLlmFallback }) => {
        const formData = new FormData();
        formData.set("file", file);
        if (name) formData.set("name", name);
        if (description) formData.set("description", description);
        if (password) formData.set("password", password);
        if (clientId) formData.set("client_id", String(clientId));
        if (typeof storeData === "boolean") formData.set("store_data", String(storeData));
        if (portfolioName) formData.set("portfolio_name", portfolioName);
        if (portfolioId) formData.set("portfolio_id", String(portfolioId));
        if (typeof useLlmFallback === "boolean") formData.set("use_llm_fallback", String(useLlmFallback));
        return {
          url: "/oneview/document/upload/",
          method: "POST",
          body: formData,
          validateStatus: isBrokerStatementUploadStatusValid,
        };
      },
      invalidatesTags: ["Documents", "Portfolios", "PortfolioView", "Sankey"],
    }),
    retryWithPassword: builder.mutation<
      BrokerStatementUploadResponse,
      { documentId: string | number; password: string }
    >({
      query: ({ documentId, password }) => {
        const formData = new FormData();
        formData.set("document_id", String(documentId));
        formData.set("password", password);
        return {
          url: "/oneview/broker-statements/retry-with-password/",
          method: "POST",
          body: formData,
          validateStatus: isBrokerStatementUploadStatusValid,
        };
      },
      invalidatesTags: ["Documents", "Portfolios", "PortfolioView", "Sankey"],
    }),
    getBrokerStatementJobStatus: builder.query<BrokerStatementJobStatusResponse, string>({
      query: (jobId) => ({
        url: `/oneview/broker-statements/jobs/${encodeURIComponent(jobId)}/status/`,
        validateStatus: isBrokerStatementJobStatusValid,
      }),
    }),
    listBrokerStatementJobs: builder.query<BrokerStatementJob[], void>({
      query: () => ({ url: "/oneview/broker-statements/jobs/" }),
      providesTags: ["Documents"],
    }),
    listCurrencies: builder.query<{ currency_code: string; name: string | null; symbol: string | null; decimals: number }[], void>({
      query: () => ({ url: "/currencies/" }),
      transformResponse: (response: { currencies: { currency_code: string; name: string | null; symbol: string | null; decimals: number }[] }) => response.currencies,
    }),

    // CRM Meetings
    getCrmMeetings: builder.query<CrmMeetingsResponse, { upcoming?: boolean; page?: number } | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.upcoming) searchParams.set("upcoming", "true");
        if (params?.page) searchParams.set("page", String(params.page));
        const qs = searchParams.toString();
        return `/crm/meetings/${qs ? `?${qs}` : ""}`;
      },
    }),

    // CRM Alerts
    getCrmAlerts: builder.query<CrmAlertsResponse, { page?: number } | void>({
      query: (params) => {
        const qs = params?.page ? `?page=${params.page}` : "";
        return `/crm/alerts/${qs}`;
      },
    }),

    // CRM Clients
    getCrmClients: builder.query<CrmClientsResponse, { search?: string; is_active?: string; page?: number } | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.search) searchParams.set("search", params.search);
        if (params?.is_active) searchParams.set("is_active", params.is_active);
        if (params?.page) searchParams.set("page", String(params.page));
        const qs = searchParams.toString();
        return `/crm/clients/${qs ? `?${qs}` : ""}`;
      },
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
  useCrmLoginMutation,
  useCrmLogoutMutation,
  useCrmResetDataMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useListPortfoliosQuery,
  useGetAccountsByPortfolioIdQuery,
  useGetPortfolioViewQuery,
  useGetSankeyQuery,
  useGetValuationsViewQuery,
  useListDocumentsQuery,
  useGetDocumentQuery,
  useGetDocumentStatusQuery,
  useLazyGetDocumentJobStatusQuery,
  useGetDocumentPositionsQuery,
  useUploadDocumentMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
  useUploadBrokerStatementMutation,
  useRetryWithPasswordMutation,
  useLazyGetBrokerStatementJobStatusQuery,
  useListBrokerStatementJobsQuery,
  useListCurrenciesQuery,
  useGetCrmMeetingsQuery,
  useGetCrmAlertsQuery,
  useGetCrmClientsQuery,
} = api;
