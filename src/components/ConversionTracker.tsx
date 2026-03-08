"use client";

import { useEffect } from "react";
import {
  trackPurchase,
  trackViewItem,
  trackReportPreviewRead,
} from "@/lib/analytics";

interface ConversionTrackerProps {
  kind: "subscription" | "report";
  plan?: string;
  value?: number;
  slug?: string;
}

export default function ConversionTracker({
  kind,
  plan,
  value = 0,
  slug,
}: ConversionTrackerProps) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchased = params.get("purchased") === "true";
    const subscribed = params.get("subscribed") === "true";
    const sessionId = params.get("session_id") || undefined;

    // Always fire view_item for report pages (helps Google Ads build audiences)
    if (kind === "report" && plan) {
      trackViewItem(plan, value);
    }

    // Fire report_preview_read after 30s on page (engaged reader signal)
    if (kind === "report" && slug) {
      const readKey = `rarw_read_${slug}`;
      if (!sessionStorage.getItem(readKey)) {
        const timer = setTimeout(() => {
          trackReportPreviewRead(slug);
          sessionStorage.setItem(readKey, "1");
        }, 30_000);
        // eslint-disable-next-line consistent-return
        return () => clearTimeout(timer);
      }
    }

    if ((kind === "report" && !purchased) || (kind === "subscription" && !subscribed)) {
      return;
    }

    const sentKey = `rarw_conversion_${kind}_${sessionId ?? "no_session"}`;
    if (sessionStorage.getItem(sentKey)) return;

    // Conversion labels from Google Ads event snippets (not secrets — client-side tags)
    const ADS_LABELS = {
      report: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_REPORT || "OvqyCLL_vYQcEO6VhoBC",
      subscription: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_SUBSCRIBE || "yHNhCNb3xoQcEO6VhoBC",
    };
    const adsLabel = kind === "subscription" ? ADS_LABELS.subscription : ADS_LABELS.report;

    trackPurchase({
      transactionId: sessionId,
      value,
      currency: "USD",
      plan,
      adsConversionLabel: adsLabel,
    });

    sessionStorage.setItem(sentKey, "1");
  }, [kind, plan, value, slug]);

  return null;
}
