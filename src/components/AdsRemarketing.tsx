"use client";

import { useEffect } from "react";
import { trackPageViewWithAds } from "@/lib/analytics";

/**
 * Fires a page_view event to the Google Ads tag on every render.
 * This enables remarketing audiences in Google Ads — "All visitors",
 * "Report viewers", etc. — without additional manual config.
 *
 * Place once in the root layout.
 */
export default function AdsRemarketing() {
  useEffect(() => {
    trackPageViewWithAds();
  }, []);

  return null;
}
