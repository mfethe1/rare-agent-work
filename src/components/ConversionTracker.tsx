"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/analytics";

interface ConversionTrackerProps {
  kind: "subscription" | "report";
  plan?: string;
  value?: number;
}

export default function ConversionTracker({
  kind,
  plan,
  value = 0,
}: ConversionTrackerProps) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchased = params.get("purchased") === "true";
    const subscribed = params.get("subscribed") === "true";
    const sessionId = params.get("session_id") || undefined;

    if ((kind === "report" && !purchased) || (kind === "subscription" && !subscribed)) {
      return;
    }

    const sentKey = `rarw_conversion_${kind}_${sessionId ?? "no_session"}`;
    if (sessionStorage.getItem(sentKey)) return;

    const adsLabel =
      kind === "subscription"
        ? process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_SUBSCRIBE
        : process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_REPORT;

    trackPurchase({
      transactionId: sessionId,
      value,
      currency: "USD",
      plan,
      adsConversionLabel: adsLabel,
    });

    sessionStorage.setItem(sentKey, "1");
  }, [kind, plan, value]);

  return null;
}
