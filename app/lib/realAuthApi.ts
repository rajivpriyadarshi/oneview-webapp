import { apiRequest } from "./apiClient";

export type ApiUser = {
  id: number;
  email: string;
  name: string;
};

export type AuthSession = {
  token: string;
  user: ApiUser;
};

export type PasswordlessAuthSession = AuthSession & {
  created: boolean;
};

export type CRMAdvisor = {
  id: number;
  name: string;
  email: string;
  designation: string;
  team: string;
};

export type CRMAuthSession = {
  token: string;
  advisor: CRMAdvisor;
};

export type Profile = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  base_currency: string;
  timezone: string;
  is_active: boolean;
  mailer_frequency: string;
  created_at: string;
  updated_at: string;
};

export type CRMAdvisor = {
  id: number;
  name: string;
  email: string;
  designation: string;
  team: string;
};

export type CRMAuthSession = {
  token: string;
  advisor: CRMAdvisor;
};

export function initiateSignup(input: {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone?: string;
}) {
  return apiRequest<{ message: string; email: string }>("/auth/signup/", {
    method: "POST",
    body: input,
    skipAuth: true,
  });
}

export function verifySignupOtp(input: { email: string; otp: string }) {
  return apiRequest<AuthSession>("/auth/signup/verify/", {
    method: "POST",
    body: input,
    skipAuth: true,
  });
}

export function resendSignupOtp(input: { email: string }) {
  return apiRequest<{ message: string }>("/auth/signup/resend-otp/", {
    method: "POST",
    body: input,
    skipAuth: true,
  });
}

export function login(input: { email: string; password: string }) {
  return apiRequest<AuthSession>("/auth/login/", {
    method: "POST",
    body: input,
    skipAuth: true,
  });
}

export function sendPasswordlessOtp(input: { email: string }) {
  return apiRequest<{ message: string; email: string }>("/auth/passwordless/send-otp/", {
    method: "POST",
    body: input,
    skipAuth: true,
  });
}

export function verifyPasswordlessOtp(input: { email: string; otp: string }) {
  return apiRequest<PasswordlessAuthSession>("/auth/passwordless/verify/", {
    method: "POST",
    body: input,
    skipAuth: true,
  });
}

export function resendPasswordlessOtp(input: { email: string }) {
  return apiRequest<{ message: string }>("/auth/passwordless/resend-otp/", {
    method: "POST",
    body: input,
    skipAuth: true,
  });
}

export function logout() {
  return apiRequest<void>("/auth/logout/", {
    method: "POST",
  });
}

export function getProfile() {
  return apiRequest<Profile>("/me/");
}

export function updateProfile(
  input: Partial<Pick<Profile, "display_name" | "base_currency" | "timezone" | "mailer_frequency">>,
) {
  return apiRequest<Profile>("/me/", {
    method: "PATCH",
    body: input,
  });
}
