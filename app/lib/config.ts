export const appConfig = {
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  aiAgentSlug: process.env.NEXT_PUBLIC_AI_AGENT_SLUG ?? "wealth-advisor",
  replySuggestionsAutoSubmit: process.env.NEXT_PUBLIC_REPLY_SUGGESTIONS_AUTO_SUBMIT === "true",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  mixpanelToken: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ?? "",
};
