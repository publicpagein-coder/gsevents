/**
 * FR-FEE / BR-11: GST amount helpers.
 *
 * Listing fee: settings.listing_fee_paise is GST-inclusive total.
 * Subscription: settings.subscription_fee_paise is base; GST is added on top.
 */

export type FeeAmounts = {
  base_paise: number;
  gst_paise: number;
  amount_paise: number;
};

export type FeeSettingsAmounts = {
  listing_fee_paise: number;
  subscription_fee_paise: number;
  gst_rate_pct: number;
};

/** Split a GST-inclusive total into base + GST using the given rate. */
export function splitInclusiveGst(
  totalPaise: number,
  gstRatePct: number,
): FeeAmounts {
  if (totalPaise < 0 || !Number.isFinite(totalPaise)) {
    throw new Error("Invalid total amount");
  }
  if (gstRatePct < 0 || !Number.isFinite(gstRatePct)) {
    throw new Error("Invalid GST rate");
  }
  const divisor = 1 + gstRatePct / 100;
  const base_paise = Math.round(totalPaise / divisor);
  const gst_paise = totalPaise - base_paise;
  return { base_paise, gst_paise, amount_paise: totalPaise };
}

/** Add GST on top of a tax-exclusive base. */
export function addExclusiveGst(
  basePaise: number,
  gstRatePct: number,
): FeeAmounts {
  if (basePaise < 0 || !Number.isFinite(basePaise)) {
    throw new Error("Invalid base amount");
  }
  if (gstRatePct < 0 || !Number.isFinite(gstRatePct)) {
    throw new Error("Invalid GST rate");
  }
  const gst_paise = Math.round((basePaise * gstRatePct) / 100);
  return {
    base_paise: basePaise,
    gst_paise,
    amount_paise: basePaise + gst_paise,
  };
}

/** Listing fee amounts from settings (GST included in listing_fee_paise). */
export function listingFeeAmounts(settings: FeeSettingsAmounts): FeeAmounts {
  return splitInclusiveGst(settings.listing_fee_paise, settings.gst_rate_pct);
}

/** Sponsor subscription amounts from settings (base + GST). */
export function subscriptionFeeAmounts(
  settings: FeeSettingsAmounts,
): FeeAmounts {
  return addExclusiveGst(
    settings.subscription_fee_paise,
    settings.gst_rate_pct,
  );
}

/** Format paise as Indian rupees string, e.g. 10000 → "₹100.00". */
export function formatPaiseAsInr(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
