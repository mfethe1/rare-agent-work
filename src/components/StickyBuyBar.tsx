"use client";

import { useEffect, useRef, useState } from "react";
import BuyButton from "./BuyButton";

interface StickyBuyBarProps {
  title: string;
  price: string;
  planKey: string;
  color: string;
  /** Optional external sentinel element ID to observe instead of internal sentinel. */
  sentinelId?: string;
}

const btnMap: Record<string, string> = {
  blue: "bg-blue-500 hover:bg-blue-400",
  green: "bg-green-500 hover:bg-green-400",
  purple: "bg-purple-500 hover:bg-purple-400",
  red: "bg-red-500 hover:bg-red-400",
};

export default function StickyBuyBar({ title, price, planKey, color, sentinelId }: StickyBuyBarProps) {
  const [visible, setVisible] = useState(false);
  const internalSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If an external sentinel ID is provided, observe that element.
    // Otherwise, fall back to internal sentinel.
    const target = sentinelId
      ? document.getElementById(sentinelId)
      : internalSentinelRef.current;

    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [sentinelId]);

  const btn = btnMap[color] ?? btnMap.blue;

  return (
    <>
      {/* Internal sentinel — only used if no sentinelId is provided */}
      {!sentinelId && <div ref={internalSentinelRef} className="sticky-buy-sentinel-internal" />}

      {/* Sticky bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 print:hidden ${
          visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="border-t border-white/10 bg-[#020617]/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{title}</p>
              <p className="text-xs text-slate-400">{price} · One-time · Instant access · No subscription</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-xs text-slate-500 sm:block">✓ Full preview included</span>
              <BuyButton
                plan={planKey}
                label={`Buy — ${price}`}
                className={`inline-flex items-center justify-center rounded-full ${btn} px-6 py-2.5 text-sm font-bold text-white transition-all shadow-lg`}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
