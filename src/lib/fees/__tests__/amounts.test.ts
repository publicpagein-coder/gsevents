import { describe, it, expect } from "vitest";
import {
  addExclusiveGst,
  formatPaiseAsInr,
  listingFeeAmounts,
  splitInclusiveGst,
  subscriptionFeeAmounts,
} from "../amounts";

describe("splitInclusiveGst", () => {
  it("splits ₹100 GST-inclusive at 18% into base + GST", () => {
    const result = splitInclusiveGst(10000, 18);
    expect(result.amount_paise).toBe(10000);
    expect(result.base_paise + result.gst_paise).toBe(10000);
    expect(result.base_paise).toBe(8475);
    expect(result.gst_paise).toBe(1525);
  });
});

describe("addExclusiveGst", () => {
  it("adds 18% GST on ₹500 base (BR-11)", () => {
    const result = addExclusiveGst(50000, 18);
    expect(result.base_paise).toBe(50000);
    expect(result.gst_paise).toBe(9000);
    expect(result.amount_paise).toBe(59000);
  });
});

describe("listingFeeAmounts / subscriptionFeeAmounts", () => {
  const settings = {
    listing_fee_paise: 10000,
    subscription_fee_paise: 50000,
    gst_rate_pct: 18,
  };

  it("uses listing total as GST-inclusive", () => {
    expect(listingFeeAmounts(settings).amount_paise).toBe(10000);
  });

  it("uses subscription base + GST", () => {
    expect(subscriptionFeeAmounts(settings).amount_paise).toBe(59000);
  });
});

describe("formatPaiseAsInr", () => {
  it("formats paise with Indian grouping", () => {
    expect(formatPaiseAsInr(10000)).toBe("₹100.00");
    expect(formatPaiseAsInr(59000)).toBe("₹590.00");
  });
});
