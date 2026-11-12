import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayWebhookSignature } from "@/lib/fees/razorpay";
import { applyRazorpayWebhook } from "@/lib/fees/webhook";

export const runtime = "nodejs";

/**
 * FR-FEE-03: Razorpay webhook.
 * Verifies X-Razorpay-Signature, then updates platform_fees idempotently.
 * Never logs payment tokens or secrets.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await applyRazorpayWebhook(admin, body);

  if (!result.handled) {
    // Acknowledge unknown/malformed after signature verify so Razorpay
    // does not retry forever; surface error for our logs via status body only.
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }

  return NextResponse.json({ ok: true, action: result.action });
}
