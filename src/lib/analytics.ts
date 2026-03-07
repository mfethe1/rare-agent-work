"use client";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const ADS_ID = "AW-17716841198";

function gtagEvent(event: string, params: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", event, params);
}

export function trackCheckoutClick(plan: string) {
  gtagEvent("click_checkout", { plan });
}

export function trackBeginCheckout(plan: string) {
  gtagEvent("begin_checkout", {
    currency: "USD",
    plan,
  });
}

export function trackPurchase(params: {
  transactionId?: string;
  value?: number;
  currency?: string;
  plan?: string;
  adsConversionLabel?: string;
}) {
  const {
    transactionId,
    value = 0,
    currency = "USD",
    plan,
    adsConversionLabel,
  } = params;

  gtagEvent("purchase", {
    transaction_id: transactionId,
    value,
    currency,
    items: plan ? [{ item_id: plan, item_name: plan }] : undefined,
  });

  if (adsConversionLabel) {
    gtagEvent("conversion", {
      send_to: `${ADS_ID}/${adsConversionLabel}`,
      value,
      currency,
      transaction_id: transactionId,
    });
  }
}
