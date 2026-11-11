import { describe, it, expect } from "vitest";
import { canPayListingFee } from "../deadline";

describe("canPayListingFee (BR-10)", () => {
  it("allows payment when today is exactly start_date - 7", () => {
    expect(canPayListingFee("2026-12-20", "2026-12-13")).toBe(true);
  });

  it("allows payment more than 7 days before start", () => {
    expect(canPayListingFee("2026-12-20", "2026-11-01")).toBe(true);
  });

  it("blocks payment when today is after start_date - 7", () => {
    expect(canPayListingFee("2026-12-20", "2026-12-14")).toBe(false);
  });

  it("blocks payment on the start date", () => {
    expect(canPayListingFee("2026-12-20", "2026-12-20")).toBe(false);
  });
});
