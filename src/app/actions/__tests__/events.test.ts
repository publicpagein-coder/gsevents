import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelEvent,
  createEvent,
  deleteDraftEvent,
  resubmitRejectedEvent,
  submitPublishedChangeRequest,
  updateDraftOrRejectedEvent,
} from "../events";

const EVENT_ID = "00000000-0000-0000-0000-000000000010";
const USER_ID = "org-user-1";

function baseEventFields(fd: FormData) {
  fd.set("title", "Navratri Night");
  fd.set("description", "Garba");
  fd.set("event_type_id", "1");
  fd.set("city_id", "2");
  fd.set("venue", "GMDC");
  fd.set("season", "navratri-2027");
  fd.set("start_date", "2027-10-01");
  fd.set("end_date", "2027-10-10");
  fd.set("expected_audience", "5000");
  fd.set("visibility", "public");
  fd.set(
    "packages",
    JSON.stringify([
      { name: "Gold", price_paise: 100000, deliverables: "Logo", slots_total: 2 },
    ]),
  );
}

type TableState = {
  profile?: { role: string; verification_status: string | null };
  event?: {
    id: string;
    organizer_id: string;
    status: string;
    authority_letter_path: string | null;
  } | null;
  packages?: { id: string }[];
  insertEventId?: string;
  insertEventError?: string | null;
  updateError?: string | null;
  deleteError?: string | null;
  packageDeleteError?: string | null;
  packageInsertError?: string | null;
  changeRequestError?: string | null;
};

function makeServerClient(state: TableState) {
  const profile = state.profile ?? {
    role: "organizer",
    verification_status: "approved",
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: profile }),
    })),
  };
}

function makeAdmin(state: TableState) {
  return {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://example.com/letter.pdf" },
          error: null,
        }),
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "events") {
        let mode: "select" | "insert" | "update" | "delete" = "select";
        let inserted = false;
        const chain: Record<string, unknown> = {};
        chain["select"] = vi.fn().mockImplementation(() => {
          if (!inserted) mode = "select";
          return chain;
        });
        chain["insert"] = vi.fn().mockImplementation(() => {
          mode = "insert";
          inserted = true;
          return chain;
        });
        chain["update"] = vi.fn().mockImplementation(() => {
          mode = "update";
          return chain;
        });
        chain["delete"] = vi.fn().mockImplementation(() => {
          mode = "delete";
          return chain;
        });
        chain["eq"] = vi.fn().mockImplementation(() => {
          if (mode === "update") {
            return Promise.resolve({
              error: state.updateError ? { message: state.updateError } : null,
            });
          }
          if (mode === "delete") {
            return Promise.resolve({
              error: state.deleteError ? { message: state.deleteError } : null,
            });
          }
          return chain;
        });
        chain["maybeSingle"] = vi.fn().mockResolvedValue({
          data: state.event === undefined ? null : state.event,
        });
        chain["single"] = vi.fn().mockImplementation(() => {
          if (inserted) {
            if (state.insertEventError) {
              return Promise.resolve({
                data: null,
                error: { message: state.insertEventError },
              });
            }
            return Promise.resolve({
              data: { id: state.insertEventId ?? EVENT_ID },
              error: null,
            });
          }
          return Promise.resolve({ data: state.event ?? null });
        });
        return chain;
      }

      if (table === "sponsorship_packages") {
        let mode: "select" | "insert" | "delete" = "select";
        const chain: Record<string, unknown> = {};
        chain["select"] = vi.fn().mockImplementation(() => {
          mode = "select";
          return chain;
        });
        chain["insert"] = vi.fn().mockImplementation(() => {
          mode = "insert";
          return Promise.resolve({
            error: state.packageInsertError
              ? { message: state.packageInsertError }
              : null,
          });
        });
        chain["delete"] = vi.fn().mockImplementation(() => {
          mode = "delete";
          return chain;
        });
        chain["eq"] = vi.fn().mockImplementation(() => {
          if (mode === "delete") {
            return Promise.resolve({
              error: state.packageDeleteError
                ? { message: state.packageDeleteError }
                : null,
            });
          }
          if (mode === "select") {
            return Promise.resolve({
              data: state.packages ?? [],
              error: null,
            });
          }
          return chain;
        });
        return chain;
      }

      if (table === "event_change_requests") {
        return {
          insert: vi.fn().mockResolvedValue({
            error: state.changeRequestError
              ? { message: state.changeRequestError }
              : null,
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      };
    }),
  };
}

function mockClients(state: TableState = {}) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeServerClient(state));
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(makeAdmin(state));
}

describe("createEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forbids non-organizer", async () => {
    mockClients({
      profile: { role: "sponsor", verification_status: null },
    });
    const fd = new FormData();
    baseEventFields(fd);
    const result = await createEvent(fd);
    expect(result.success).toBe(false);
  });

  it("forbids unapproved organizer", async () => {
    mockClients({
      profile: { role: "organizer", verification_status: "pending" },
    });
    const fd = new FormData();
    baseEventFields(fd);
    const result = await createEvent(fd);
    expect(result.success).toBe(false);
  });

  it("creates a draft with packages", async () => {
    mockClients({ insertEventId: EVENT_ID });
    const fd = new FormData();
    baseEventFields(fd);
    const result = await createEvent(fd);
    expect(result.success).toBe(true);
    if (result.success) expect(result.eventId).toBe(EVENT_ID);
  });

  it("rejects end before start", async () => {
    mockClients({});
    const fd = new FormData();
    baseEventFields(fd);
    fd.set("end_date", "2027-09-01");
    const result = await createEvent(fd);
    expect(result.success).toBe(false);
  });
});

describe("updateDraftOrRejectedEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows draft update", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "draft",
        authority_letter_path: null,
      },
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    baseEventFields(fd);
    const result = await updateDraftOrRejectedEvent(fd);
    expect(result.success).toBe(true);
  });

  it("blocks published direct update", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "published",
        authority_letter_path: null,
      },
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    baseEventFields(fd);
    const result = await updateDraftOrRejectedEvent(fd);
    expect(result.success).toBe(false);
  });
});

describe("deleteDraftEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes draft", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "draft",
        authority_letter_path: null,
      },
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    const result = await deleteDraftEvent(fd);
    expect(result.success).toBe(true);
  });

  it("blocks non-draft delete", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "pending_review",
        authority_letter_path: null,
      },
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    const result = await deleteDraftEvent(fd);
    expect(result.success).toBe(false);
  });
});

describe("cancelEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancels published", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "published",
        authority_letter_path: null,
      },
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    const result = await cancelEvent(fd);
    expect(result.success).toBe(true);
  });

  it("blocks cancelled again", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "cancelled",
        authority_letter_path: null,
      },
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    const result = await cancelEvent(fd);
    expect(result.success).toBe(false);
  });
});

describe("resubmitRejectedEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("moves rejected to pending_review when packages exist", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "rejected",
        authority_letter_path: null,
      },
      packages: [{ id: "pkg-1" }],
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    const result = await resubmitRejectedEvent(fd);
    expect(result.success).toBe(true);
  });

  it("blocks draft resubmit", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "draft",
        authority_letter_path: null,
      },
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    const result = await resubmitRejectedEvent(fd);
    expect(result.success).toBe(false);
  });
});

describe("submitPublishedChangeRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts change request for published event", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "published",
        authority_letter_path: null,
      },
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    baseEventFields(fd);
    const result = await submitPublishedChangeRequest(fd);
    expect(result.success).toBe(true);
  });

  it("blocks draft change request", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "draft",
        authority_letter_path: null,
      },
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    baseEventFields(fd);
    const result = await submitPublishedChangeRequest(fd);
    expect(result.success).toBe(false);
  });

  it("surfaces one-pending unique violation", async () => {
    mockClients({
      event: {
        id: EVENT_ID,
        organizer_id: USER_ID,
        status: "published",
        authority_letter_path: null,
      },
      changeRequestError:
        'duplicate key value violates unique constraint "event_change_requests_one_pending"',
    });
    const fd = new FormData();
    fd.set("eventId", EVENT_ID);
    baseEventFields(fd);
    const result = await submitPublishedChangeRequest(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/already pending/i);
  });
});
