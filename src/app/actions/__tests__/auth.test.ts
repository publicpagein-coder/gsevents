import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

// Rate-limit helper is mocked so tests are not flaky due to shared state.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestOtp, verifyOtp, updateProfile } from "../auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockFn = ReturnType<typeof vi.fn>;

/**
 * Build a Supabase server client mock (auth only — no write operations).
 *
 * userId:             auth user id (null = not signed in)
 * signInWithOtpError: error message from signInWithOtp, or null for success
 * verifyOtpError:     error message from verifyOtp, or null for success
 */
function makeServerClient(opts: {
  userId?: string | null;
  signInWithOtpError?: string | null;
  verifyOtpError?: string | null;
}) {
  const {
    userId = "user-1",
    signInWithOtpError = null,
    verifyOtpError = null,
  } = opts;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
      signInWithOtp: vi.fn().mockResolvedValue({
        error: signInWithOtpError ? { message: signInWithOtpError } : null,
      }),
      verifyOtp: vi.fn().mockResolvedValue({
        error: verifyOtpError ? { message: verifyOtpError } : null,
      }),
    },
    // Server client shouldn't be used for profile writes (admin client is used instead).
    from: vi.fn(),
  };
}

/**
 * Build an admin client mock for profile update operations.
 * The `updateProfile` action authenticates via the server client, then
 * writes via the admin client.
 */
function makeAdminClient(updateError: string | null = null) {
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ error: updateError ? { message: updateError } : null }),
  };
  return {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue(updateChain),
    }),
  };
}

const mockCreateClient = createClient as unknown as MockFn;
const mockCreateAdminClient = createAdminClient as unknown as MockFn;
const mockCheckRateLimit = checkRateLimit as unknown as MockFn;

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockReturnValue({ allowed: true });
});

// ---------------------------------------------------------------------------
// FR-AUTH-02 / FR-AUTH-03: Role validation at sign-up via requestOtp
// ---------------------------------------------------------------------------

describe("requestOtp — role enum enforcement (FR-AUTH-02, FR-AUTH-03)", () => {
  it("accepts role=organizer and passes it in signInWithOtp data", async () => {
    const client = makeServerClient({ signInWithOtpError: null });
    mockCreateClient.mockResolvedValue(client);

    const result = await requestOtp("+919876543210", "organizer");
    expect(result.success).toBe(true);

    const callArgs = (client.auth.signInWithOtp as MockFn).mock.calls[0]?.[0] as {
      options?: { data?: { role?: string } };
    };
    expect(callArgs?.options?.data?.role).toBe("organizer");
  });

  it("accepts role=sponsor and passes it in signInWithOtp data", async () => {
    const client = makeServerClient({ signInWithOtpError: null });
    mockCreateClient.mockResolvedValue(client);

    const result = await requestOtp("+919876543210", "sponsor");
    expect(result.success).toBe(true);
  });

  it("rejects role=admin before calling Supabase", async () => {
    const client = makeServerClient({});
    mockCreateClient.mockResolvedValue(client);

    const result = await requestOtp("+919876543210", "admin");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /organizer or sponsor/i,
    );
    // Supabase must NOT have been called
    expect((client.auth.signInWithOtp as MockFn)).not.toHaveBeenCalled();
  });

  it("rejects role=super_admin before calling Supabase", async () => {
    const client = makeServerClient({});
    mockCreateClient.mockResolvedValue(client);

    const result = await requestOtp("+919876543210", "super_admin");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /organizer or sponsor/i,
    );
    expect((client.auth.signInWithOtp as MockFn)).not.toHaveBeenCalled();
  });

  it("sends OTP without role for returning users", async () => {
    const client = makeServerClient({ signInWithOtpError: null });
    mockCreateClient.mockResolvedValue(client);

    const result = await requestOtp("+919876543210");
    expect(result.success).toBe(true);

    const callArgs = (client.auth.signInWithOtp as MockFn).mock.calls[0]?.[0] as {
      options?: { data?: unknown };
    };
    // data should not be present when no role is provided
    expect(callArgs?.options?.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// FR-AUTH-01: Rate limiting on OTP request
// ---------------------------------------------------------------------------

describe("requestOtp — rate limiting (FR-AUTH-01)", () => {
  it("returns error when rate limit exceeded", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 60_000 });

    const result = await requestOtp("+919876543210");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/wait/i);
  });
});

// ---------------------------------------------------------------------------
// FR-AUTH-01: Phone validation
// ---------------------------------------------------------------------------

describe("requestOtp — phone validation", () => {
  it("rejects a phone number without country code", async () => {
    const result = await requestOtp("9876543210");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/E.164/i);
  });
});

describe("verifyOtp — phone and token validation (FR-AUTH-01)", () => {
  it("rejects a phone number without country code", async () => {
    const result = await verifyOtp("9876543210", "123456");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/E.164/i);
  });

  it("rejects a non-6-digit OTP", async () => {
    const result = await verifyOtp("+919876543210", "12345");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/6 digit/i);
  });

  it("returns error when rate limit exceeded", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 60_000 });
    const client = makeServerClient({});
    mockCreateClient.mockResolvedValue(client);

    const result = await verifyOtp("+919876543210", "123456");
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/wait/i);
  });
});

// ---------------------------------------------------------------------------
// FR-AUTH-03: updateProfile — protected field rejection
// ---------------------------------------------------------------------------

describe("updateProfile — protected field rejection (FR-AUTH-03)", () => {
  it("rejects a request that includes role", async () => {
    const serverClient = makeServerClient({ userId: "user-1" });
    mockCreateClient.mockResolvedValue(serverClient);

    const formData = new FormData();
    formData.set("full_name", "Test User");
    formData.set("role", "admin"); // must be blocked before the DB write

    const result = await updateProfile(formData);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/role/i);
  });

  it("rejects a request that includes verification_status", async () => {
    const serverClient = makeServerClient({ userId: "user-1" });
    mockCreateClient.mockResolvedValue(serverClient);

    const formData = new FormData();
    formData.set("verification_status", "approved");

    const result = await updateProfile(formData);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /verification_status/i,
    );
  });

  it("rejects a request that includes is_support", async () => {
    const serverClient = makeServerClient({ userId: "user-1" });
    mockCreateClient.mockResolvedValue(serverClient);

    const formData = new FormData();
    formData.set("is_support", "true");

    const result = await updateProfile(formData);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/is_support/i);
  });

  it("allows updating allowed fields (full_name, city_id, preferred_language)", async () => {
    const serverClient = makeServerClient({ userId: "user-1" });
    mockCreateClient.mockResolvedValue(serverClient);
    mockCreateAdminClient.mockReturnValue(makeAdminClient(null));

    const formData = new FormData();
    formData.set("full_name", "Ravi Kumar");
    formData.set("city_id", "1");
    formData.set("preferred_language", "hi");

    const result = await updateProfile(formData);
    expect(result.success).toBe(true);
  });

  it("returns error when not authenticated", async () => {
    const serverClient = makeServerClient({ userId: null });
    mockCreateClient.mockResolvedValue(serverClient);

    const formData = new FormData();
    formData.set("full_name", "Ravi");

    const result = await updateProfile(formData);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/authenticated/i);
  });
});
