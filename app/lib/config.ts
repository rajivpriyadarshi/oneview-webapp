export const appConfig = {
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  googleAuthStartUrl: process.env.NEXT_PUBLIC_GOOGLE_AUTH_START_URL ?? "",
  useMockAuth: process.env.NEXT_PUBLIC_USE_MOCK_AUTH !== "false",
};
