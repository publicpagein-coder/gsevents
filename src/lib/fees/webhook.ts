/**
 * FR-FEE-03: apply a verified Razorpay webhook payload to platform_fees.
 * Idempotent on gateway_payment_id. Service-role client required.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { extendSubscriptionExpiry } from "./subscription";
import { safeStr, safeStrNullable } from "@/lib/db-utils";

type AdminClient = SupabaseClient<Database>;
type FeeRow = Database["public"]["Tables"]["platform_fees"]["Row"];
type FeeStatus = Database["public"]["Enums"]["fee_status"];

export type WebhookApplyResult =
  | { handled: true; action: "noop" | "paid" | "failed" }
  | { handled: false; error: string };

type PaymentEntity = {
  id?: unknown;
  order_id?: unknown;
  status?: unknown;
};

type WebhookPayload = {
  event?: unknown;
  payload?: {
    payment?: {
      entity?: PaymentEntity;
    };
  };
};

function asPaymentEntity(raw: unknown): PaymentEntity | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as PaymentEntity;
}

/**
 * Process a parsed, signature-verified Razorpay webhook body.
 * Never logs payment tokens or secrets.
 */
export async function applyRazorpayWebhook(
  admin: AdminClient,
  body: unknown,
  now: Date = new Date(),
): Promise<WebhookApplyResult> {
  const payload = (body ?? {}) as WebhookPayload;
  const eventName =
    typeof payload.event === "string" ? payload.event : "";
  const payment = asPaymentEntity(payload.payload?.payment?.entity);

  if (!payment) {
    return { handled: false, error: "Missing payment entity" };
  }

  const gatewayPaymentId = safeStr(payment.id);
  const gatewayOrderId = safeStr(payment.order_id);

  if (!gatewayOrderId) {
    return { handled: false, error: "Missing order id" };
  }

  if (eventName === "payment.captured") {
    return applyCaptured(admin, gatewayOrderId, gatewayPaymentId, now);
  }

  if (eventName === "payment.failed") {
    return applyFailed(admin, gatewayOrderId, gatewayPaymentId);
  }

  // Ignore unrelated events with 200-equivalent handled noop.
  return { handled: true, action: "noop" };
}

async function loadFeeByOrder(
  admin: AdminClient,
  gatewayOrderId: string,
): Promise<FeeRow | null> {
  const { data } = await admin
    .from("platform_fees")
    .select("*")
    .eq("gateway_order_id", gatewayOrderId)
    .maybeSingle();
  return (data as FeeRow | null) ?? null;
}

async function applyCaptured(
  admin: AdminClient,
  gatewayOrderId: string,
  gatewayPaymentId: string,
  now: Date,
): Promise<WebhookApplyResult> {
  if (!gatewayPaymentId) {
    return { handled: false, error: "Missing payment id" };
  }

  // Idempotency: already recorded this payment id.
  const { data: byPayment } = await admin
    .from("platform_fees")
    .select("id, status")
    .eq("gateway_payment_id", gatewayPaymentId)
    .maybeSingle();

  if (byPayment) {
    return { handled: true, action: "noop" };
  }

  const fee = await loadFeeByOrder(admin, gatewayOrderId);
  if (!fee) {
    return { handled: false, error: "Unknown order" };
  }

  if (fee.status === "paid" || fee.status === "refunded") {
    return { handled: true, action: "noop" };
  }

  const paidAt = now.toISOString();
  const { error: updateError } = await admin
    .from("platform_fees")
    .update({
      status: "paid" satisfies FeeStatus,
      gateway_payment_id: gatewayPaymentId,
      paid_at: paidAt,
    })
    .eq("id", fee.id)
    .eq("status", "pending");

  if (updateError) {
    // Unique index race on gateway_payment_id → treat as idempotent success.
    if (updateError.message.toLowerCase().includes("duplicate")) {
      return { handled: true, action: "noop" };
    }
    return { handled: false, error: updateError.message };
  }

  if (fee.fee_type === "event_listing" && fee.event_id) {
    await moveDraftToPendingReview(admin, fee.event_id);
  }

  if (fee.fee_type === "sponsor_subscription") {
    await extendSponsorSubscription(admin, fee.user_id, now);
  }

  return { handled: true, action: "paid" };
}

async function applyFailed(
  admin: AdminClient,
  gatewayOrderId: string,
  gatewayPaymentId: string,
): Promise<WebhookApplyResult> {
  const fee = await loadFeeByOrder(admin, gatewayOrderId);
  if (!fee) {
    return { handled: false, error: "Unknown order" };
  }

  if (fee.status !== "pending") {
    return { handled: true, action: "noop" };
  }

  const update: Database["public"]["Tables"]["platform_fees"]["Update"] = {
    status: "failed",
  };
  if (gatewayPaymentId) {
    update.gateway_payment_id = gatewayPaymentId;
  }

  const { error } = await admin
    .from("platform_fees")
    .update(update)
    .eq("id", fee.id)
    .eq("status", "pending");

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return { handled: true, action: "noop" };
    }
    return { handled: false, error: error.message };
  }

  return { handled: true, action: "failed" };
}

async function moveDraftToPendingReview(
  admin: AdminClient,
  eventId: string,
): Promise<void> {
  // Fee is already paid; guard_event_status allows draft → pending_review.
  await admin
    .from("events")
    .update({ status: "pending_review" })
    .eq("id", eventId)
    .eq("status", "draft");
}

async function extendSponsorSubscription(
  admin: AdminClient,
  userId: string,
  now: Date,
): Promise<void> {
  const { data } = await admin
    .from("sponsor_profiles")
    .select("subscription_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  const current = safeStrNullable(
    (data as { subscription_expires_at: string | null } | null)
      ?.subscription_expires_at ?? null,
  );
  const nextExpiry = extendSubscriptionExpiry(current, now);

  await admin
    .from("sponsor_profiles")
    .update({ subscription_expires_at: nextExpiry })
    .eq("user_id", userId);
}
