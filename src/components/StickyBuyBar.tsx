"use client";

import { useEffect, useRef, useState } from "react";
import BuyButton from "./BuyButton";

interface StickyBuyBarProps {
  title: string;
  price: string;
  planKey: string;
  color: string;
}

const btnMap: Record<string, string> = {
  blue: "bg-blue-500 hover:bg-blue-400",
  green: "bg-green-500 hover:bg-green-400",
  purple: "bg-purple-500 hover:bg-purple-400",
  red: "bg-red-500 hover:bg-red-400",
};

export default function StickyBuyBar({ title, price, planKey, color }: StickyBuyBarProps) {
  const [visible, setVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  const btn = btnMap[color] ?? btnMap.blue;

  return (
    <>
      {/* Sentinel placed right after the hero buy button */}
      <div ref={sentinelRef} className="sticky-buy-sentinel" />

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
              <p className="text-xs text-slate-400">{price} · One-time purchase · Instant access</p>
            </div>
            <div className="shrink-0">
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
