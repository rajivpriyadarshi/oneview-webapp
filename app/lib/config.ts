export const appConfig = {
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://labs-sbox.zinc.money/api/wealth",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
};
