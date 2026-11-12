import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/fees/razorpay", () => ({
  createRazorpayOrder: vi.fn(),
  getRazorpayKeyId: vi.fn(() => "rzp_test_key"),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder } from "@/lib/fees/razorpay";
import { createFeeOrder, markFeeRefunded } from "../fees";

const SETTINGS = {
  listing_fee_paise: 10000,
  subscription_fee_paise: 50000,
  gst_rate_pct: 18,
};

function makeServerClient(
  role: string | null,
  userId = "user-1",
  extras: Record<string, unknown> = {},
) {
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: role ? { role, ...extras } : null,
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

type TableHandlers = Record<
  string,
  {
    selectData?: unknown;
    maybeSingleData?: unknown;
    insertResult?: { data: unknown; error: null | { message: string } };
    updateError?: null | { message: string };
  }
>;

function makeAdminFromHandlers(handlers: TableHandlers) {
  return {
    from: vi.fn((table: string) => {
      const h = handlers[table] ?? {};
      let mode: "select" | "insert" | "update" = "select";
      const chain: Record<string, unknown> = {};
      chain["select"] = vi.fn().mockImplementation(() => {
        mode = "select";
        return chain;
      });
      chain["insert"] = vi.fn().mockImplementation(() => {
        mode = "insert";
        return chain;
      });
      chain["update"] = vi.fn().mockImplementation(() => {
        mode = "update";
        return chain;
      });
      chain["eq"] = vi.fn().mockImplementation(() => {
        if (mode === "update") {
          return Promise.resolve({ error: h.updateError ?? null });
        }
        return chain;
      });
      chain["maybeSingle"] = vi.fn().mockResolvedValue({
        data: h.maybeSingleData ?? null,
      });
      chain["single"] = vi.fn().mockImplementation(() => {
        if (mode === "insert") {
          return Promise.resolve(
            h.insertResult ?? { data: { id: "fee-1" }, error: null },
          );
        }
        return Promise.resolve({ data: h.selectData ?? null });
      });
      return chain;
    }),
  };
}

describe("createFeeOrder — listing rules (FR-FEE-01 / BR-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createRazorpayOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "order_1",
      amount: 10000,
      currency: "INR",
    });
  });

  it("blocks non-organizers", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("sponsor"),
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminFromHandlers({
        settings: { maybeSingleData: SETTINGS },
      }),
    );

    const result = await createFeeOrder({
      feeType: "event_listing",
      eventId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/organizer/i);
    }
  });

  it("blocks after the 7-day deadline", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("organizer", "org-1"),
    );

    // start_date 8 days from a fixed "now" would require controlling Date.
    // Use a start date clearly in the past relative to real now.
    const pastStart = "2020-01-15";

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminFromHandlers({
        settings: { maybeSingleData: SETTINGS },
        events: {
          maybeSingleData: {
            id: "00000000-0000-4000-8000-000000000001",
            organizer_id: "org-1",
            start_date: pastStart,
            status: "draft",
            title: "Old Event",
          },
        },
        platform_fees: { maybeSingleData: null },
      }),
    );

    const result = await createFeeOrder({
      feeType: "event_listing",
      eventId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/deadline/i);
    }
  });

  it("blocks when listing fee already paid", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("organizer", "org-1"),
    );

    const farFuture = "2099-12-01";
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdminFromHandlers({
        settings: { maybeSingleData: SETTINGS },
        events: {
          maybeSingleData: {
            id: "00000000-0000-4000-8000-000000000001",
            organizer_id: "org-1",
            start_date: farFuture,
            status: "draft",
            title: "Future Event",
          },
        },
        platform_fees: { maybeSingleData: { id: "paid-fee" } },
      }),
    );

    const result = await createFeeOrder({
      feeType: "event_listing",
      eventId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/already paid/i);
    }
  });

  it("creates an order within the deadline", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("organizer", "org-1"),
    );

    const farFuture = "2099-12-01";
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "fee-new" }, error: null }),
      }),
    });

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "settings") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: SETTINGS }),
          };
        }
        if (table === "events") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "00000000-0000-4000-8000-000000000001",
                organizer_id: "org-1",
                start_date: farFuture,
                status: "draft",
                title: "Future Event",
              },
            }),
          };
        }
        if (table === "platform_fees") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            insert,
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    });

    const result = await createFeeOrder({
      feeType: "event_listing",
      eventId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.checkout.amountPaise).toBe(10000);
      expect(result.checkout.keyId).toBe("rzp_test_key");
      expect(result.checkout.orderId).toBe("order_1");
    }
    expect(createRazorpayOrder).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
  });
});

describe("createFeeOrder — subscription amount (FR-FEE-02 / BR-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createRazorpayOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "order_sub",
      amount: 59000,
      currency: "INR",
    });
  });

  it("charges base + GST for sponsors", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("sponsor", "sp-1"),
    );

    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "fee-sub" }, error: null }),
      }),
    });

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "settings") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: SETTINGS }),
          };
        }
        if (table === "sponsor_profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: "sp-1" } }),
          };
        }
        if (table === "platform_fees") {
          return { insert };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    });

    const result = await createFeeOrder({ feeType: "sponsor_subscription" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.checkout.amountPaise).toBe(59000);
      expect(result.checkout.feeType).toBe("sponsor_subscription");
    }
    expect(createRazorpayOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaise: 59000 }),
    );
  });
});

describe("markFeeRefunded (FR-ADM-05 / BR-16)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forbids callers without is_support", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin", "adm-1", { is_support: false }),
    );

    const fd = new FormData();
    fd.set("feeId", "00000000-0000-4000-8000-000000000099");
    fd.set("reason", "Duplicate charge");
    const result = await markFeeRefunded(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/support/i);
    }
  });

  it("allows support to mark a paid fee refunded", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin", "adm-1", { is_support: true }),
    );

    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const auditInsert = vi.fn().mockResolvedValue({ error: null });

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "platform_fees") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "00000000-0000-4000-8000-000000000099", status: "paid" },
            }),
            update,
          };
        }
        if (table === "audit_log") {
          return { insert: auditInsert };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    });

    const fd = new FormData();
    fd.set("feeId", "00000000-0000-4000-8000-000000000099");
    fd.set("reason", "Duplicate charge");
    const result = await markFeeRefunded(fd);
    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalled();
    expect(auditInsert).toHaveBeenCalled();
  });

  it("rejects refunding a non-paid fee", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeServerClient("admin", "adm-1", { is_support: true }),
    );

    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "00000000-0000-4000-8000-000000000099", status: "pending" },
        }),
      })),
    });

    const fd = new FormData();
    fd.set("feeId", "00000000-0000-4000-8000-000000000099");
    fd.set("reason", "Duplicate charge");
    const result = await markFeeRefunded(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/paid/i);
    }
  });
});
