/**
 * FR-FEE-01 / BR-10: listing fee must be paid no later than 7 days before
 * the event start date. Payment is allowed while current_date <= start_date - 7.
 *
 * An order created before the deadline is still accepted if the webhook
 * arrives after (handled by the webhook, not this check).
 */

const LISTING_FEE_LEAD_DAYS = 7;

/**
 * Return true when a listing-fee order may be created for the given start date.
 * Dates are calendar dates (YYYY-MM-DD or Date); comparison is date-only UTC.
 */
export function canPayListingFee(
  startDate: string | Date,
  today: string | Date = new Date(),
): boolean {
  const start = toUtcDateOnly(startDate);
  const now = toUtcDateOnly(today);
  const deadline = new Date(start);
  deadline.setUTCDate(deadline.getUTCDate() - LISTING_FEE_LEAD_DAYS);
  return now.getTime() <= deadline.getTime();
}

/** Parse a date or YYYY-MM-DD string to a UTC midnight Date. */
function toUtcDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  // Prefer the date portion so timestamptz strings still work.
  const datePart = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) {
    throw new Error(`Invalid date: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

export { LISTING_FEE_LEAD_DAYS };
