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

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createAdmin,
  removeAdmin,
  toggleSupportPermission,
  updateFeeSettings,
} from "../super-admin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPER_ADMIN_ID = "00000000-0000-0000-0000-aaaaaaaaaaaa";
const TARGET_ADMIN_ID = "00000000-0000-0000-0000-bbbbbbbbbbbb";

function makeServerClient(role: string | null, userId = SUPER_ADMIN_ID) {
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: role ? { role } : null }),
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: role ? { id: userId } : null },
      }),
    },
    from: vi.fn().mockReturnValue(profileChain),
  };
}

/**
 * Stateful chain that separates select/update paths — avoids eq() conflict.
 */
function makeAdminClient(
  targetTable: string,
  selectData: unknown,
  updateResult: { error: null | { message: string } } = { error: null },
  authAdminCreateResult: { data: { user: { id: string } | null }; error: null | { message: string } } = {
    data: { user: { id: "new-uid" } },
    error: null,
  },
) {
  function makeChain() {
    let mode: "select" | "update" = "select";
    const chain = {
      select: vi.fn().mockImplementation(() => {
        mode = "select";
        return chain;
      }),
      update: vi.fn().mockImplementation(() => {
        mode = "update";
        return chain;
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockImplementation(() => {
        if (mode === "update") return Promise.resolve(updateResult);
        return chain;
      }),
      in: vi.fn().mockImplementation(() => chain),
      single: vi.fn().mockResolvedValue({ data: selectData }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    return chain;
  }

  const targetChain = makeChain();
  const auditChain = { insert: vi.fn().mockResolvedValue({ error: null }) };

  return {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue(authAdminCreateResult),
      },
    },
    from: vi.fn((table: string) => {
      if (table === targetTable) return targetChain;
      if (table === "audit_log") return auditChain;
      return makeChain();
    }),
  };
}

// ---------------------------------------------------------------------------
// Super-admin role guard tests
// ---------------------------------------------------------------------------

describe("super-admin role guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createAdmin: rejects unauthenticated caller", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient(null));
    const fd = new FormData();
    fd.set("phone", "+919876543210");
    const result = await createAdmin(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not authenticated/i);
  });

  it("createAdmin: rejects admin caller (not super_admin)", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("admin"));
    const fd = new FormData();
    fd.set("phone", "+919876543210");
    const result = await createAdmin(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/super_admin/i);
  });

  it("createAdmin: rejects organizer caller", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("organizer"));
    const fd = new FormData();
    fd.set("phone", "+919876543210");
    const result = await createAdmin(fd);
    expect(result.success).toBe(false);
  });

  it("removeAdmin: rejects admin caller", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("admin"));
    const fd = new FormData();
    fd.set("adminId", TARGET_ADMIN_ID);
    const result = await removeAdmin(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/super_admin/i);
  });

  it("toggleSupportPermission: rejects admin caller", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("admin"));
    const fd = new FormData();
    fd.set("adminId", TARGET_ADMIN_ID);
    const result = await toggleSupportPermission(fd);
    expect(result.success).toBe(false);
  });

  it("updateFeeSettings: rejects admin caller", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("admin"));
    const fd = new FormData();
    fd.set("listing_fee_paise", "10000");
    fd.set("subscription_fee_paise", "50000");
    fd.set("gst_rate_pct", "18");
    const result = await updateFeeSettings(fd);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createAdmin (happy path + validation)
// ---------------------------------------------------------------------------

describe("createAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an admin via Supabase auth.admin when phone is not found", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("super_admin"));
    // maybeSingle returns null (no existing user with that phone)
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", null),
    );
    const fd = new FormData();
    fd.set("phone", "+919876543210");
    const result = await createAdmin(fd);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid phone number", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("super_admin"));
    const fd = new FormData();
    fd.set("phone", "abc");
    const result = await createAdmin(fd);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// removeAdmin
// ---------------------------------------------------------------------------

describe("removeAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("demotes an admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("super_admin"));
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", { role: "admin" }),
    );
    const fd = new FormData();
    fd.set("adminId", TARGET_ADMIN_ID);
    const result = await removeAdmin(fd);
    expect(result.success).toBe(true);
  });

  it("refuses to demote a non-admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("super_admin"));
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", { role: "organizer" }),
    );
    const fd = new FormData();
    fd.set("adminId", TARGET_ADMIN_ID);
    const result = await removeAdmin(fd);
    expect(result.success).toBe(false);
  });

  it("refuses self-demotion", async () => {
    // Caller and target are the same UUID
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("super_admin", SUPER_ADMIN_ID),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", { role: "admin" }),
    );
    const fd = new FormData();
    fd.set("adminId", SUPER_ADMIN_ID);
    const result = await removeAdmin(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/yourself/i);
  });
});

// ---------------------------------------------------------------------------
// toggleSupportPermission
// ---------------------------------------------------------------------------

describe("toggleSupportPermission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toggles support from false to true", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("super_admin"));
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", { role: "admin", is_support: false }),
    );
    const fd = new FormData();
    fd.set("adminId", TARGET_ADMIN_ID);
    const result = await toggleSupportPermission(fd);
    expect(result.success).toBe(true);
  });

  it("refuses to toggle support on a non-admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("super_admin"));
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", { role: "organizer", is_support: false }),
    );
    const fd = new FormData();
    fd.set("adminId", TARGET_ADMIN_ID);
    const result = await toggleSupportPermission(fd);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateFeeSettings
// ---------------------------------------------------------------------------

describe("updateFeeSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves valid fee settings", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("super_admin"));
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("settings", { id: 1 }),
    );
    const fd = new FormData();
    fd.set("listing_fee_paise", "10000");
    fd.set("subscription_fee_paise", "50000");
    fd.set("gst_rate_pct", "18");
    fd.set("gstin", "");
    fd.set("launch_offer_text", "First sponsor free!");
    const result = await updateFeeSettings(fd);
    expect(result.success).toBe(true);
  });

  it("rejects negative listing fee", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("super_admin"));
    const fd = new FormData();
    fd.set("listing_fee_paise", "-100");
    fd.set("subscription_fee_paise", "50000");
    fd.set("gst_rate_pct", "18");
    const result = await updateFeeSettings(fd);
    expect(result.success).toBe(false);
  });

  it("rejects GST rate above 100", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient("super_admin"));
    const fd = new FormData();
    fd.set("listing_fee_paise", "10000");
    fd.set("subscription_fee_paise", "50000");
    fd.set("gst_rate_pct", "150");
    const result = await updateFeeSettings(fd);
    expect(result.success).toBe(false);
  });
});
