import { apiRequest } from "./apiClient";

export type UserProfile = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  base_currency: string;
  timezone: string;
  is_active: boolean;
  mailer_frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  created_at: string;
  updated_at: string;
};

export type ProfileUpdateRequest = {
  display_name?: string;
  base_currency?: string;
  timezone?: string;
  mailer_frequency?: "DAILY" | "WEEKLY" | "MONTHLY";
};

export async function getUserProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>("me/");
}

export async function updateUserProfile(
  updates: ProfileUpdateRequest
): Promise<UserProfile> {
  return apiRequest<UserProfile>("me/", {
    method: "PATCH",
    body: updates,
  });
}
