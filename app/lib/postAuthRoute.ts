import type { Profile } from "./realAuthApi";

export async function getPostProfileRoute(profile: Profile) {
  // Skip onboarding screens - CRM users go directly to clients page
  return "/clients";
}
