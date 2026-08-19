import type { Profile } from "./realAuthApi";

export async function getPostProfileRoute(profile: Profile) {
  // Skip onboarding screens - go directly to home page
  // TODO: Update to new landing page when designed
  return "/dashboard";
}
