"use client";

import { useState } from "react";

interface SubscribeButtonProps {
  label?: string;
  className?: string;
}

export default function SubscribeButton({
  label = "Start Operator Access — $49/mo",
  className,
}: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      const data = await res.json();
      if (data.url) {
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
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          className ||
          "bg-white text-black px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-200 transition-all disabled:opacity-60"
        }
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
