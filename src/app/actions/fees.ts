"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeStr } from "@/lib/db-utils";
import {
  listingFeeAmounts,
  subscriptionFeeAmounts,
  type FeeSettingsAmounts,
} from "@/lib/fees/amounts";
import { canPayListingFee } from "@/lib/fees/deadline";
import {
  createRazorpayOrder,
  getRazorpayKeyId,
} from "@/lib/fees/razorpay";
import type { Database } from "@/lib/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];
type FeeType = Database["public"]["Enums"]["fee_type"];
type EventStatus = Database["public"]["Enums"]["event_status"];
type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type FeeRow = Database["public"]["Tables"]["platform_fees"]["Row"];

export type CheckoutOrder = {
  feeId: string;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  keyId: string;
  feeType: FeeType;
};

export type CreateFeeOrderResult =
  | { success: true; checkout: CheckoutOrder }
  | { success: false; error: string };

type ActionResult = { success: true } | { success: false; error: string };

const CreateListingOrderSchema = z.object({
  feeType: z.literal("event_listing"),
  eventId: z.string().uuid(),
});

const CreateSubscriptionOrderSchema = z.object({
  feeType: z.literal("sponsor_subscription"),
});

const CreateFeeOrderSchema = z.discriminatedUnion("feeType", [
  CreateListingOrderSchema,
  CreateSubscriptionOrderSchema,
]);

const MarkRefundedSchema = z.object({
  feeId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

async function loadSettings(
  admin: ReturnType<typeof createAdminClient>,
): Promise<FeeSettingsAmounts | null> {
  const { data } = await admin
    .from("settings")
    .select("listing_fee_paise, subscription_fee_paise, gst_rate_pct")
    .eq("id", 1)
    .maybeSingle();

  if (!data) return null;
  const row = data as Pick<
    SettingsRow,
    "listing_fee_paise" | "subscription_fee_paise" | "gst_rate_pct"
  >;
  return {
    listing_fee_paise: row.listing_fee_paise,
    subscription_fee_paise: row.subscription_fee_paise,
    gst_rate_pct: Number(row.gst_rate_pct),
  };
}

/**
 * FR-FEE-01 / FR-FEE-02: create a Razorpay order and a pending platform_fees row.
 * Returns checkout props only (key id is public; secrets stay server-side).
 */
export async function createFeeOrder(
  input: unknown,
): Promise<CreateFeeOrderResult> {
  const parsed = CreateFeeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: profileData } = await serverClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: UserRole } | null;
  if (!profile) return { success: false, error: "Profile not found" };

  const admin = createAdminClient();
  const settings = await loadSettings(admin);
  if (!settings) {
    return { success: false, error: "Fee settings unavailable" };
  }

  if (parsed.data.feeType === "event_listing") {
    return createListingOrder({
      admin,
      userId: user.id,
      role: profile.role,
      eventId: parsed.data.eventId,
      settings,
    });
  }

  return createSubscriptionOrder({
    admin,
    userId: user.id,
    role: profile.role,
    settings,
  });
}

async function createListingOrder(args: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  role: UserRole;
  eventId: string;
  settings: FeeSettingsAmounts;
}): Promise<CreateFeeOrderResult> {
  const { admin, userId, role, eventId, settings } = args;

  if (role !== "organizer") {
    return { success: false, error: "Only organizers can pay listing fees" };
  }

  const { data: eventData } = await admin
    .from("events")
    .select("id, organizer_id, start_date, status, title")
    .eq("id", eventId)
    .maybeSingle();

  const event = eventData as Pick<
    EventRow,
    "id" | "organizer_id" | "start_date" | "status" | "title"
  > | null;

  if (!event || event.organizer_id !== userId) {
    return { success: false, error: "Event not found" };
  }

  if ((event.status as EventStatus) !== "draft") {
    return {
      success: false,
      error: "Listing fee is only payable for draft events",
    };
  }

  // One paid listing fee per event (BR / unique partial index).
  const { data: paidFee } = await admin
    .from("platform_fees")
    .select("id")
    .eq("event_id", eventId)
    .eq("fee_type", "event_listing")
    .eq("status", "paid")
    .maybeSingle();

  if (paidFee) {
    return { success: false, error: "Listing fee already paid for this event" };
  }

  // BR-10: current_date <= start_date - 7
  if (!canPayListingFee(event.start_date)) {
    return {
      success: false,
      error: "Listing fee deadline has passed (7 days before start date)",
    };
  }

  const amounts = listingFeeAmounts(settings);
  const receipt = `list_${eventId.replace(/-/g, "").slice(0, 20)}`;

  let order;
  try {
    order = await createRazorpayOrder({
      amountPaise: amounts.amount_paise,
      receipt,
      notes: {
        fee_type: "event_listing",
        event_id: eventId,
        user_id: userId,
      },
    });
  } catch {
    return { success: false, error: "Could not create payment order" };
  }

  const { data: inserted, error: insertError } = await admin
    .from("platform_fees")
    .insert({
      user_id: userId,
      event_id: eventId,
      fee_type: "event_listing" satisfies FeeType,
      amount_paise: amounts.amount_paise,
      base_paise: amounts.base_paise,
      gst_paise: amounts.gst_paise,
      status: "pending",
      gateway_order_id: order.id,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      success: false,
      error: safeStr(insertError?.message) || "Could not record fee",
    };
  }

  const fee = inserted as Pick<FeeRow, "id">;

  return {
    success: true,
    checkout: {
      feeId: fee.id,
      orderId: order.id,
      amountPaise: amounts.amount_paise,
      currency: "INR",
      keyId: getRazorpayKeyId(),
      feeType: "event_listing",
    },
  };
}

async function createSubscriptionOrder(args: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  role: UserRole;
  settings: FeeSettingsAmounts;
}): Promise<CreateFeeOrderResult> {
  const { admin, userId, role, settings } = args;

  if (role !== "sponsor") {
    return {
      success: false,
      error: "Only sponsors can pay a subscription",
    };
  }

  const { data: sponsor } = await admin
    .from("sponsor_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sponsor) {
    return { success: false, error: "Sponsor profile not found" };
  }

  const amounts = subscriptionFeeAmounts(settings);
  const receipt = `sub_${userId.replace(/-/g, "").slice(0, 24)}`;

  let order;
  try {
    order = await createRazorpayOrder({
      amountPaise: amounts.amount_paise,
      receipt,
      notes: {
        fee_type: "sponsor_subscription",
        user_id: userId,
      },
    });
  } catch {
    return { success: false, error: "Could not create payment order" };
  }

  const { data: inserted, error: insertError } = await admin
    .from("platform_fees")
    .insert({
      user_id: userId,
      event_id: null,
      fee_type: "sponsor_subscription" satisfies FeeType,
      amount_paise: amounts.amount_paise,
      base_paise: amounts.base_paise,
      gst_paise: amounts.gst_paise,
      status: "pending",
      gateway_order_id: order.id,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      success: false,
      error: safeStr(insertError?.message) || "Could not record fee",
    };
  }

  const fee = inserted as Pick<FeeRow, "id">;

  return {
    success: true,
    checkout: {
      feeId: fee.id,
      orderId: order.id,
      amountPaise: amounts.amount_paise,
      currency: "INR",
      keyId: getRazorpayKeyId(),
      feeType: "sponsor_subscription",
    },
  };
}

/**
 * FR-ADM-05 / BR-16: support admin marks a paid fee refunded (payment errors only).
 * Money movement happens in the Razorpay dashboard; this only updates app state.
 */
export async function markFeeRefunded(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = MarkRefundedSchema.safeParse({
    feeId: formData.get("feeId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const serverClient = await createClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: profileData } = await serverClient
    .from("profiles")
    .select("role, is_support")
    .eq("id", user.id)
    .single();

  const profile = profileData as {
    role: UserRole;
    is_support: boolean;
  } | null;

  // BR-16: only support permission may mark refunds.
  if (!profile?.is_support) {
    return { success: false, error: "Forbidden: support permission required" };
  }

  const admin = createAdminClient();
  const { data: feeData } = await admin
    .from("platform_fees")
    .select("id, status")
    .eq("id", parsed.data.feeId)
    .maybeSingle();

  const fee = feeData as Pick<FeeRow, "id" | "status"> | null;
  if (!fee) {
    return { success: false, error: "Fee not found" };
  }

  if (fee.status !== "paid") {
    return {
      success: false,
      error: "Only paid fees can be marked refunded",
    };
  }

  const { error } = await admin
    .from("platform_fees")
    .update({
      status: "refunded",
      refund_reason: parsed.data.reason,
    })
    .eq("id", fee.id)
    .eq("status", "paid");

  if (error) {
    return { success: false, error: safeStr(error.message) };
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "mark_fee_refunded",
    entity: "platform_fees",
    entity_id: fee.id,
    details: { reason: parsed.data.reason },
  });

  return { success: true };
}
