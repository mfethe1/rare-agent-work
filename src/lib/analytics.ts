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

/* ── Funnel events (GA4 recommended e-commerce events) ── */

export function trackViewItem(plan: string, price: number) {
  gtagEvent("view_item", {
    currency: "USD",
    value: price,
    items: [{ item_id: plan, item_name: plan, price }],
  });
}

export function trackCheckoutClick(plan: string) {
  gtagEvent("click_checkout", { plan });
}

export function trackBeginCheckout(plan: string, value?: number) {
  gtagEvent("begin_checkout", {
    currency: "USD",
    value: value ?? 0,
    items: [{ item_id: plan, item_name: plan }],
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
    items: plan ? [{ item_id: plan, item_name: plan, price: value }] : undefined,
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

/* ── Engagement events for audience building ── */

export function trackReportPreviewRead(slug: string) {
  gtagEvent("report_preview_read", {
    report_slug: slug,
    content_type: "report_preview",
  });
}

export function trackGuideQuestion(slug: string) {
  gtagEvent("guide_question_asked", {
    report_slug: slug,
    content_type: "ai_guide",
  });
}

export function trackNewsClick(articleUrl: string) {
  gtagEvent("news_article_click", {
    article_url: articleUrl,
    content_type: "news",
  });
}

export function trackSignupIntent(source: string) {
  gtagEvent("sign_up", { method: source });
}

/* ── Google Ads remarketing helper ── */

export function trackPageViewWithAds() {
  // Fires a conversion-linker compatible page_view for remarketing audiences
  gtagEvent("page_view", {
    send_to: ADS_ID,
  });
}
