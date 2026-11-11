/**
 * FR-FEE-02: extend sponsor subscription by one year from the later of
 * now and the current expiry (so early renewals stack).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

export function extendSubscriptionExpiry(
  currentExpiresAt: string | null,
  now: Date = new Date(),
): string {
  const currentMs = currentExpiresAt
    ? new Date(currentExpiresAt).getTime()
    : NaN;
  const baseMs =
    Number.isFinite(currentMs) && currentMs > now.getTime()
      ? currentMs
      : now.getTime();
  const next = new Date(baseMs + DAYS_PER_YEAR * MS_PER_DAY);
  return next.toISOString();
}
