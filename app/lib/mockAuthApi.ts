const MOCK_OTP = "250590";
const MOCK_AUTH_TOKEN = "mock-oneview-session-token";

type RequestOtpParams = {
  email: string;
};

type VerifyOtpParams = {
  email: string;
  otp: string;
};

type SessionResponse = {
  authToken: string;
  expiresInSeconds: number;
};

type MockModuleOptions = {
  forceUnauthorized?: boolean;
};

export class MockApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "MockApiError";
    this.status = status;
  }
}

export async function requestEmailOtp({ email }: RequestOtpParams) {
  await mockLatency();

  if (!email.includes("@")) {
    throw new MockApiError(400, "Enter a valid email address.");
  }

  return {
    delivery: "email",
    email,
    otpLength: MOCK_OTP.length,
  };
}

export async function verifyEmailOtp({ email, otp }: VerifyOtpParams) {
  await mockLatency();

  if (!email.includes("@")) {
    throw new MockApiError(400, "Enter a valid email address.");
  }

  if (otp !== MOCK_OTP) {
    throw new MockApiError(401, "The OTP is invalid or expired.");
  }

  return createSessionResponse();
}

export async function continueWithGoogle() {
  await mockLatency();
  return createSessionResponse();
}

export async function getCurrentUser(authToken: string | null) {
  await mockLatency();
  assertAuthenticated(authToken);

  return {
    email: "naksh.mehta@gmail.com",
    name: "Naksh Mehta",
  };
}

export async function mockProtectedModuleRequest(
  authToken: string | null,
  options: MockModuleOptions = {},
) {
  await mockLatency();

  if (options.forceUnauthorized) {
    throw new MockApiError(401, "Session expired.");
  }

  assertAuthenticated(authToken);

  return {
    status: "ok",
    modules: [],
  };
}

export function isApiUnauthorized(error: unknown) {
  return error instanceof MockApiError && error.status === 401;
}

function createSessionResponse(): SessionResponse {
  return {
    authToken: MOCK_AUTH_TOKEN,
    expiresInSeconds: 60 * 60,
  };
}

function assertAuthenticated(authToken: string | null) {
  if (authToken !== MOCK_AUTH_TOKEN) {
    throw new MockApiError(401, "Session expired.");
  }
}

function mockLatency() {
  return new Promise((resolve) => setTimeout(resolve, 250));
}
