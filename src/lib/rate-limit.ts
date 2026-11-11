/**
 * In-process rate-limit store.
 *
 * Works for single-process deployments (Vercel serverless functions share
 * state only within one invocation by default). For multi-replica production
 * a Redis-backed store would be needed; this is acceptable for Stage 1.
 *
 * FR-AUTH-01: OTP requests and verification attempts are rate-limited.
 */

interface Bucket {
  count: number;
  /** Unix ms when the current window expires. */
  expiresAt: number;
}

const store = new Map<string, Bucket>();

/** Remove stale entries to avoid unbounded growth. */
function prune(): void {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.expiresAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the window resets. Only set when allowed is false. */
  retryAfterMs?: number;
}

/**
 * Check whether a request identified by `key` is within its rate limit.
 *
 * @param key        Unique bucket identifier (e.g. `otp_req:+91XXXXXXXXXX`).
 * @param maxAttempts Maximum attempts allowed within the window.
 * @param windowMs   Window duration in milliseconds.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): RateLimitResult {
  prune();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.expiresAt <= now) {
    store.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: existing.expiresAt - now };
  }

  existing.count += 1;
  return { allowed: true };
}
