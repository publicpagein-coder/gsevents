"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  createFeeOrder,
  type CheckoutOrder,
} from "@/app/actions/fees";

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

type ListingProps = {
  feeType: "event_listing";
  eventId: string;
  amountLabel: string;
  description: string;
};

type SubscriptionProps = {
  feeType: "sponsor_subscription";
  amountLabel: string;
  description: string;
};

type Props = ListingProps | SubscriptionProps;

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Opens Razorpay Standard Checkout after creating a server-side order.
 * Receives only plain props — never secrets.
 */
export function CheckoutButton(props: Props) {
  const t = useTranslations("fees");
  const tCommon = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [paidHint, setPaidHint] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openCheckout(checkout: CheckoutOrder) {
    startTransition(async () => {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setError(t("checkoutLoadError"));
        return;
      }

      const rzp = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: t("checkoutName"),
        description: props.description,
        order_id: checkout.orderId,
        handler: () => {
          // Status is finalized by the webhook (service role), not the client.
          setPaidHint(true);
        },
        modal: {
          ondismiss: () => {
            // User closed checkout; pending fee remains until failed webhook or retry.
          },
        },
      });
      rzp.open();
    });
  }

  function handleClick() {
    setError(null);
    setPaidHint(false);
    startTransition(async () => {
      const input =
        props.feeType === "event_listing"
          ? { feeType: "event_listing" as const, eventId: props.eventId }
          : { feeType: "sponsor_subscription" as const };

      const result = await createFeeOrder(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      openCheckout(result.checkout);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>{tCommon("error")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {paidHint && (
        <Alert>
          <AlertTitle>{t("paymentSubmittedTitle")}</AlertTitle>
          <AlertDescription>{t("paymentSubmittedBody")}</AlertDescription>
        </Alert>
      )}
      <Button type="button" onClick={handleClick} disabled={isPending}>
        {isPending ? tCommon("loading") : t("payButton", { amount: props.amountLabel })}
      </Button>
    </div>
  );
}
