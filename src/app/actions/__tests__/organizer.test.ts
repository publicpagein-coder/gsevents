import { describe, it, expect, vi, beforeEach } from "vitest";
import { isOrganizerProfileIncomplete } from "@/lib/organizer-profile";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveOrganizerProfile } from "../organizer";

function makeServerClient(
  role: string | null,
  profileExtras: Record<string, unknown> = {},
  userId = "org-user-1",
) {
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: role
        ? {
            role,
            verification_status: null,
            org_name: null,
            org_type: null,
            venue_name: null,
            ...profileExtras,
          }
        : null,
    }),
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

function makeAdminClient(updateError: { message: string } | null = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: updateError }),
    single: vi.fn().mockResolvedValue({ data: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "audit_log") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return chain;
    }),
  };
}

describe("isOrganizerProfileIncomplete", () => {
  it("is incomplete when required fields are missing", () => {
    expect(
      isOrganizerProfileIncomplete({
        org_name: null,
        org_type: null,
        venue_name: null,
      }),
    ).toBe(true);
    expect(
      isOrganizerProfileIncomplete({
        org_name: "  ",
        org_type: "society",
        venue_name: "Hall",
      }),
    ).toBe(true);
  });

  it("is complete when required fields are present", () => {
    expect(
      isOrganizerProfileIncomplete({
        org_name: "Society",
        org_type: "society",
        venue_name: "GMDC",
      }),
    ).toBe(false);
  });
});

describe("saveOrganizerProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  function validForm() {
    const fd = new FormData();
    fd.set("org_name", "Ahmedabad Cultural Society");
    fd.set("org_type", "society");
    fd.set("venue_name", "GMDC Ground");
    fd.set("social_link", "https://instagram.com/example");
    fd.set("proof_note", "Past event link");
    return fd;
  }

  it("rejects unauthenticated callers", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient(null),
    );
    const result = await saveOrganizerProfile(validForm());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/not authenticated/i);
  });

  it("rejects non-organizer callers", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("sponsor"),
    );
    const result = await saveOrganizerProfile(validForm());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/only organizers/i);
  });

  it("rejects invalid org_type", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("organizer"),
    );
    const fd = validForm();
    fd.set("org_type", "not-a-type");
    const result = await saveOrganizerProfile(fd);
    expect(result.success).toBe(false);
  });

  it("blocks edits when already approved", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("organizer", {
        verification_status: "approved",
        org_name: "Existing",
        org_type: "society",
        venue_name: "Hall",
      }),
    );
    const result = await saveOrganizerProfile(validForm());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/already approved/i);
  });

  it("saves organizer fields onto profiles", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("organizer"),
    );
    const admin = makeAdminClient();
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const result = await saveOrganizerProfile(validForm());
    expect(result.success).toBe(true);
    expect(admin.from).toHaveBeenCalledWith("profiles");
  });
});
