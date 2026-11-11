/**
 * Server-only Razorpay helpers for FR-FEE.
 * Never import this module from client components.
 * KEY_SECRET and WEBHOOK_SECRET must never reach the browser or logs.
 */

import Razorpay from "razorpay";

export type CreatedOrder = {
  id: string;
  amount: number;
  currency: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

/** Public key id — safe to return to the client for Standard Checkout. */
export function getRazorpayKeyId(): string {
  return requireEnv("RAZORPAY_KEY_ID");
}

function getRazorpayKeySecret(): string {
  return requireEnv("RAZORPAY_KEY_SECRET");
}

function getWebhookSecret(): string {
  return requireEnv("RAZORPAY_WEBHOOK_SECRET");
}

let cachedClient: Razorpay | null = null;

function getClient(): Razorpay {
  if (!cachedClient) {
    cachedClient = new Razorpay({
      key_id: getRazorpayKeyId(),
      key_secret: getRazorpayKeySecret(),
    });
  }
  return cachedClient;
}

/** Create a Razorpay order (amount in paise). Receipt max 40 chars. */
export async function createRazorpayOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string | number>;
}): Promise<CreatedOrder> {
  const client = getClient();
  const order = await client.orders.create({
    amount: params.amountPaise,
    currency: "INR",
    receipt: params.receipt.slice(0, 40),
    notes: params.notes,
  });

  const id = typeof order.id === "string" ? order.id : String(order.id);
  const amount =
    typeof order.amount === "number" ? order.amount : Number(order.amount);

  return {
    id,
    amount,
    currency: typeof order.currency === "string" ? order.currency : "INR",
  };
}

/**
 * Verify X-Razorpay-Signature against the raw request body.
 * Returns false on mismatch; does not throw on bad signature.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  try {
    return Razorpay.validateWebhookSignature(
      rawBody,
      signature,
      getWebhookSecret(),
    );
  } catch {
    return false;
  }
}

/** Reset cached client (tests only). */
export function __resetRazorpayClientForTests(): void {
  cachedClient = null;
}
