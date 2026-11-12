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
  approveOrganizer,
  rejectOrganizer,
  approveEvent,
  rejectEvent,
  approveChangeRequest,
  rejectChangeRequest,
} from "../admin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a server-side Supabase client mock for auth/role checks.
 * The profiles query chain (select → eq → single) always returns
 * { data: { role } } for the signed-in user.
 */
function makeServerClient(role: string | null, userId = "caller-uid") {
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
 * Build an admin (service-role) client mock that correctly handles two
 * separate call patterns on the same table:
 *
 *   SELECT path: .from(t).select(...).eq(...).single() → { data: selectData }
 *   UPDATE path: .from(t).update(...).eq(...)          → updateResult
 *
 * A stateful `mode` variable inside each chain object disambiguates which
 * `.eq` is executing so the chains don't interfere.
 */
function makeAdminClient(
  targetTable: string,
  selectData: unknown,
  updateResult: { error: null | { message: string } } = { error: null },
) {
  function makeChain() {
    let mode: "select" | "update" | "insert" = "select";
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
      single: vi.fn().mockResolvedValue({ data: selectData }),
      maybeSingle: vi.fn().mockResolvedValue({ data: selectData }),
      in: vi.fn().mockImplementation(() => chain),
    };
    return chain;
  }

  const targetChain = makeChain();
  const auditChain = {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === targetTable) return targetChain;
      if (table === "audit_log") return auditChain;
      // Fallback chain (e.g. events table when targetTable is profiles)
      const fb = makeChain();
      return fb;
    }),
  };
}

// ---------------------------------------------------------------------------
// approveOrganizer
// ---------------------------------------------------------------------------

describe("approveOrganizer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns forbidden when caller is not admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("organizer"),
    );
    const fd = new FormData();
    fd.set("organizerId", "00000000-0000-0000-0000-000000000001");
    const result = await approveOrganizer(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/forbidden/i);
  });

  it("returns error on invalid UUID", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", null),
    );
    const fd = new FormData();
    fd.set("organizerId", "not-a-uuid");
    const result = await approveOrganizer(fd);
    expect(result.success).toBe(false);
  });

  it("approves an organizer successfully", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", {
        id: "00000000-0000-0000-0000-000000000001",
        role: "organizer",
        verification_status: "pending",
      }),
    );
    const fd = new FormData();
    fd.set("organizerId", "00000000-0000-0000-0000-000000000001");
    const result = await approveOrganizer(fd);
    expect(result.success).toBe(true);
  });

  it("succeeds when caller is super_admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("super_admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", {
        id: "00000000-0000-0000-0000-000000000001",
        role: "organizer",
        verification_status: "pending",
      }),
    );
    const fd = new FormData();
    fd.set("organizerId", "00000000-0000-0000-0000-000000000001");
    const result = await approveOrganizer(fd);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rejectOrganizer
// ---------------------------------------------------------------------------

describe("rejectOrganizer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns forbidden when caller is not admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("sponsor"),
    );
    const fd = new FormData();
    fd.set("organizerId", "00000000-0000-0000-0000-000000000001");
    fd.set("reason", "Incomplete info");
    const result = await rejectOrganizer(fd);
    expect(result.success).toBe(false);
  });

  it("rejects an organizer successfully", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("profiles", {
        id: "00000000-0000-0000-0000-000000000001",
        role: "organizer",
        verification_status: "pending",
      }),
    );
    const fd = new FormData();
    fd.set("organizerId", "00000000-0000-0000-0000-000000000001");
    fd.set("reason", "Missing proof document");
    const result = await rejectOrganizer(fd);
    expect(result.success).toBe(true);
  });

  it("requires a non-empty reason", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    const fd = new FormData();
    fd.set("organizerId", "00000000-0000-0000-0000-000000000001");
    fd.set("reason", "");
    const result = await rejectOrganizer(fd);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// approveEvent
// ---------------------------------------------------------------------------

describe("approveEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns forbidden for non-admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("organizer"),
    );
    const fd = new FormData();
    fd.set("eventId", "00000000-0000-0000-0000-000000000002");
    const result = await approveEvent(fd);
    expect(result.success).toBe(false);
  });

  it("refuses to approve an event that is not pending_review", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("events", { status: "draft" }),
    );
    const fd = new FormData();
    fd.set("eventId", "00000000-0000-0000-0000-000000000002");
    const result = await approveEvent(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/draft/);
  });

  it("approves a pending_review event", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("events", { status: "pending_review" }),
    );
    const fd = new FormData();
    fd.set("eventId", "00000000-0000-0000-0000-000000000002");
    const result = await approveEvent(fd);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rejectEvent
// ---------------------------------------------------------------------------

describe("rejectEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns forbidden for non-admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("sponsor"),
    );
    const fd = new FormData();
    fd.set("eventId", "00000000-0000-0000-0000-000000000002");
    fd.set("reason", "Policy violation");
    const result = await rejectEvent(fd);
    expect(result.success).toBe(false);
  });

  it("rejects a pending_review event", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("events", { status: "pending_review" }),
    );
    const fd = new FormData();
    fd.set("eventId", "00000000-0000-0000-0000-000000000002");
    fd.set("reason", "Insufficient information");
    const result = await rejectEvent(fd);
    expect(result.success).toBe(true);
  });

  it("refuses to reject an event not in pending_review", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("events", { status: "published" }),
    );
    const fd = new FormData();
    fd.set("eventId", "00000000-0000-0000-0000-000000000002");
    fd.set("reason", "Test");
    const result = await rejectEvent(fd);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// approveChangeRequest
// ---------------------------------------------------------------------------

describe("approveChangeRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns forbidden for non-admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("organizer"),
    );
    const fd = new FormData();
    fd.set("changeRequestId", "00000000-0000-0000-0000-000000000003");
    const result = await approveChangeRequest(fd);
    expect(result.success).toBe(false);
  });

  it("returns error when change request not found", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("event_change_requests", null),
    );
    const fd = new FormData();
    fd.set("changeRequestId", "00000000-0000-0000-0000-000000000003");
    const result = await approveChangeRequest(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not found/i);
  });

  it("returns error when change request is not pending", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("event_change_requests", {
        event_id: "eid",
        proposed_fields: {},
        proposed_packages: null,
        status: "approved",
      }),
    );
    const fd = new FormData();
    fd.set("changeRequestId", "00000000-0000-0000-0000-000000000003");
    const result = await approveChangeRequest(fd);
    expect(result.success).toBe(false);
  });

  it("applies proposed packages and letter path when approving", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );

    const eventsUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const packagesDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const packagesInsert = vi.fn().mockResolvedValue({ error: null });
    const crUpdateEq = vi.fn().mockResolvedValue({ error: null });

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "event_change_requests") {
          let mode: "select" | "update" = "select";
          const chain: Record<string, unknown> = {};
          chain["select"] = vi.fn().mockImplementation(() => {
            mode = "select";
            return chain;
          });
          chain["update"] = vi.fn().mockImplementation(() => {
            mode = "update";
            return chain;
          });
          chain["eq"] = vi.fn().mockImplementation(() => {
            if (mode === "update") return crUpdateEq();
            return chain;
          });
          chain["single"] = vi.fn().mockResolvedValue({
            data: {
              event_id: "00000000-0000-0000-0000-000000000010",
              proposed_fields: { title: "Updated title", city_id: 2 },
              proposed_packages: [
                {
                  name: "Gold",
                  price_paise: 100000,
                  deliverables: "Logo",
                  slots_total: 1,
                },
              ],
              new_authority_letter_path: "org/evt/letter.pdf",
              status: "pending",
            },
          });
          return chain;
        }
        if (table === "events") {
          return { update: eventsUpdate };
        }
        if (table === "sponsorship_packages") {
          return {
            delete: vi.fn().mockReturnValue({ eq: packagesDeleteEq }),
            insert: packagesInsert,
          };
        }
        if (table === "audit_log") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    });

    const fd = new FormData();
    fd.set("changeRequestId", "00000000-0000-0000-0000-000000000003");
    const result = await approveChangeRequest(fd);
    expect(result.success).toBe(true);
    expect(eventsUpdate).toHaveBeenCalled();
    expect(packagesDeleteEq).toHaveBeenCalled();
    expect(packagesInsert).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// rejectChangeRequest
// ---------------------------------------------------------------------------

describe("rejectChangeRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns forbidden for non-admin", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("general"),
    );
    const fd = new FormData();
    fd.set("changeRequestId", "00000000-0000-0000-0000-000000000003");
    fd.set("reason", "Not acceptable");
    const result = await rejectChangeRequest(fd);
    expect(result.success).toBe(false);
  });

  it("requires a non-empty reason", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    const fd = new FormData();
    fd.set("changeRequestId", "00000000-0000-0000-0000-000000000003");
    fd.set("reason", "");
    const result = await rejectChangeRequest(fd);
    expect(result.success).toBe(false);
  });

  it("rejects a pending change request", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminClient("event_change_requests", {
        event_id: "eid",
        status: "pending",
      }),
    );
    const fd = new FormData();
    fd.set("changeRequestId", "00000000-0000-0000-0000-000000000003");
    fd.set("reason", "Content policy");
    const result = await rejectChangeRequest(fd);
    expect(result.success).toBe(true);
  });
});
