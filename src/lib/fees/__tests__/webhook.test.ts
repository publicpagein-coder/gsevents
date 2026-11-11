import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyRazorpayWebhook } from "../webhook";

type FeeRow = {
  id: string;
  user_id: string;
  event_id: string | null;
  fee_type: "event_listing" | "sponsor_subscription";
  status: "pending" | "paid" | "failed" | "refunded";
  gateway_order_id: string;
  gateway_payment_id: string | null;
};

function makeAdmin(state: {
  feeByOrder: FeeRow | null;
  feeByPayment?: { id: string; status: string } | null;
  sponsorExpiry?: string | null;
}) {
  const feeUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });
  const eventUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });
  const sponsorUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  const client = {
    feeUpdate,
    eventUpdate,
    sponsorUpdate,
    from: vi.fn((table: string) => {
      if (table === "platform_fees") {
        let selectCols = "";
        return {
          select: vi.fn((cols?: string) => {
            selectCols = cols ?? "*";
            return {
              eq: vi.fn((col: string) => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data:
                    col === "gateway_payment_id"
                      ? (state.feeByPayment ?? null)
                      : selectCols === "*" || selectCols.includes("fee_type")
                        ? state.feeByOrder
                        : state.feeByOrder
                          ? { id: state.feeByOrder.id, status: state.feeByOrder.status }
                          : null,
                }),
              })),
            };
          }),
          update: feeUpdate,
        };
      }
      if (table === "events") {
        return { update: eventUpdate };
      }
      if (table === "sponsor_profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { subscription_expires_at: state.sponsorExpiry ?? null },
          }),
          update: sponsorUpdate,
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };
    }),
  };

  return client;
}

const pendingListing: FeeRow = {
  id: "fee-1",
  user_id: "org-1",
  event_id: "evt-1",
  fee_type: "event_listing",
  status: "pending",
  gateway_order_id: "order_1",
  gateway_payment_id: null,
};

const pendingSub: FeeRow = {
  id: "fee-2",
  user_id: "sp-1",
  event_id: null,
  fee_type: "sponsor_subscription",
  status: "pending",
  gateway_order_id: "order_2",
  gateway_payment_id: null,
};

describe("applyRazorpayWebhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is idempotent when gateway_payment_id already exists", async () => {
    const admin = makeAdmin({
      feeByOrder: pendingListing,
      feeByPayment: { id: "fee-1", status: "paid" },
    });

    const result = await applyRazorpayWebhook(
      admin as never,
      {
        event: "payment.captured",
        payload: {
          payment: {
            entity: { id: "pay_1", order_id: "order_1", status: "captured" },
          },
        },
      },
    );

    expect(result).toEqual({ handled: true, action: "noop" });
    expect(admin.feeUpdate).not.toHaveBeenCalled();
  });

  it("marks listing fee paid and moves draft event to pending_review", async () => {
    const admin = makeAdmin({
      feeByOrder: pendingListing,
      feeByPayment: null,
    });
    const now = new Date("2026-06-01T10:00:00.000Z");

    const result = await applyRazorpayWebhook(
      admin as never,
      {
        event: "payment.captured",
        payload: {
          payment: {
            entity: { id: "pay_1", order_id: "order_1", status: "captured" },
          },
        },
      },
      now,
    );

    expect(result).toEqual({ handled: true, action: "paid" });
    expect(admin.feeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        gateway_payment_id: "pay_1",
        paid_at: now.toISOString(),
      }),
    );
    expect(admin.eventUpdate).toHaveBeenCalledWith({ status: "pending_review" });
  });

  it("extends sponsor subscription on subscription payment", async () => {
    const admin = makeAdmin({
      feeByOrder: pendingSub,
      feeByPayment: null,
      sponsorExpiry: null,
    });
    const now = new Date("2026-06-01T10:00:00.000Z");

    const result = await applyRazorpayWebhook(
      admin as never,
      {
        event: "payment.captured",
        payload: {
          payment: {
            entity: { id: "pay_2", order_id: "order_2", status: "captured" },
          },
        },
      },
      now,
    );

    expect(result).toEqual({ handled: true, action: "paid" });
    expect(admin.sponsorUpdate).toHaveBeenCalledWith({
      subscription_expires_at: "2027-06-01T10:00:00.000Z",
    });
  });

  it("marks pending fee failed on payment.failed", async () => {
    const admin = makeAdmin({
      feeByOrder: pendingListing,
      feeByPayment: null,
    });

    const result = await applyRazorpayWebhook(
      admin as never,
      {
        event: "payment.failed",
        payload: {
          payment: {
            entity: { id: "pay_fail", order_id: "order_1", status: "failed" },
          },
        },
      },
    );

    expect(result).toEqual({ handled: true, action: "failed" });
    expect(admin.feeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
