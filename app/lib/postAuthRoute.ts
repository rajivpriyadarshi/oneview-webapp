import { listPortfolios } from "./portfoliosApi";
import type { Profile } from "./realAuthApi";

export async function getPostProfileRoute(profile: Profile) {
  if (!profile.display_name?.trim()) {
    return "/profile/setup";
  }

  const portfolios = await listPortfolios();

  return portfolios.length === 0 ? "/onboarding/documents" : "/dashboard";
}
