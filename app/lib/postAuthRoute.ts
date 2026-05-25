import { listPortfolios } from "./portfoliosApi";
import type { Profile } from "./realAuthApi";

export async function getPostProfileRoute(profile: Profile) {
  const emailPrefix = profile.email.split("@")[0];
  const displayName = profile.display_name?.trim();

  if (!displayName || displayName === emailPrefix) {
    return "/profile/setup";
  }

  const portfolios = await listPortfolios();

  return portfolios.length === 0 ? "/onboarding/documents" : "/dashboard";
}
