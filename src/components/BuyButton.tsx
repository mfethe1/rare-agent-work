"use client";

import { useState } from "react";
import { trackBeginCheckout, trackCheckoutClick } from "@/lib/analytics";

interface BuyButtonProps {
  plan: string;
  label?: string;
  className?: string;
}

export default function BuyButton({ plan, label = "Buy this report", className }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    trackCheckoutClick(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        trackBeginCheckout(plan);
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          className ||
          "inline-block border border-gray-700 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60"
        }
      >
        {loading ? "Redirecting to checkout…" : label}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
