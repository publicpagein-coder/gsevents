import { describe, it, expect } from "vitest";
import { extendSubscriptionExpiry } from "../subscription";

describe("extendSubscriptionExpiry", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("starts from now when no current expiry", () => {
    const next = extendSubscriptionExpiry(null, now);
    expect(next).toBe("2027-06-01T12:00:00.000Z");
  });

  it("starts from now when current expiry is in the past", () => {
    const next = extendSubscriptionExpiry("2025-01-01T00:00:00.000Z", now);
    expect(next).toBe("2027-06-01T12:00:00.000Z");
  });

  it("extends from current expiry when still active", () => {
    const next = extendSubscriptionExpiry("2026-09-01T00:00:00.000Z", now);
    expect(next).toBe("2027-09-01T00:00:00.000Z");
  });
});
