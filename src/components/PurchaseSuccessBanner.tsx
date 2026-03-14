'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface PurchaseSuccessBannerProps {
  reportTitle: string;
  reportSlug: string;
  reportPrice: string;
  reportColor: string;
  planKey: string;
}

const colorDot: Record<string, string> = {
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  purple: 'bg-purple-400',
  red: 'bg-red-400',
  amber: 'bg-amber-400',
};

const colorText: Record<string, string> = {
  blue: 'text-blue-300',
  green: 'text-green-300',
  purple: 'text-purple-300',
  red: 'text-red-300',
  amber: 'text-amber-300',
};

const colorBorder: Record<string, string> = {
  blue: 'border-blue-400/30',
  green: 'border-green-400/30',
  purple: 'border-purple-400/30',
  red: 'border-red-400/30',
  amber: 'border-amber-400/30',
};

const colorSurface: Record<string, string> = {
  blue: 'bg-blue-500/[0.06]',
  green: 'bg-green-500/[0.06]',
  purple: 'bg-purple-500/[0.06]',
  red: 'bg-red-500/[0.06]',
  amber: 'bg-amber-500/[0.06]',
};

/** Read the Stripe session_id from the current URL client-side */
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('session_id') ?? '';
}

export default function PurchaseSuccessBanner({
  reportTitle,
  reportSlug,
  reportPrice,
  reportColor,
}: PurchaseSuccessBannerProps) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'done' | 'failed'>('idle');
  const [confirmedEmail, setConfirmedEmail] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const runVerify = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    // Cache in sessionStorage to avoid re-verifying on navigation
    const cacheKey = `rarw_verified_${reportSlug}_${sessionId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setConfirmedEmail(cached === '__unknown__' ? '' : cached);
      setVerifyState('done');
      return;
    }

    setVerifyState('verifying');
    try {
      const res = await fetch('/api/stripe/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reportSlug }),
      });
      if (res.ok) {
        const data = await res.json() as { verified: boolean; email?: string };
        if (data.verified) {
          const email = data.email ?? '';
          sessionStorage.setItem(cacheKey, email || '__unknown__');
          setConfirmedEmail(email);
          setVerifyState('done');
        } else {
          setVerifyState('failed');
        }
      } else {
        setVerifyState('failed');
      }
    } catch {
      setVerifyState('failed');
    }
  }, [reportSlug]);

  useEffect(() => {
    if (mounted) {
      void runVerify();
    }
  }, [mounted, runVerify]);

  const dismiss = useCallback(() => {
    setVisible(false);
    // Clean URL without a page reload
    const url = new URL(window.location.href);
    url.searchParams.delete('purchased');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.toString());
  }, []);

  if (!visible) return null;

  const dot = colorDot[reportColor] ?? colorDot.blue;
  const txt = colorText[reportColor] ?? colorText.blue;
  const bdr = colorBorder[reportColor] ?? colorBorder.blue;
  const surf = colorSurface[reportColor] ?? colorSurface.blue;

  return (
    <div
      className={`mb-8 overflow-hidden rounded-2xl border ${bdr} ${surf} transition-all duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
      role="alert"
      aria-live="polite"
    >
      {/* Top strip — confirmation header */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-emerald-500/[0.10] px-5 py-3.5">
        {verifyState === 'verifying' ? (
          <span className="flex h-5 w-5 items-center justify-center shrink-0">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          </span>
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black shrink-0">
            ✓
          </span>
        )}
        <p className="flex-1 text-sm font-bold text-emerald-300">
          {verifyState === 'verifying' && 'Confirming your purchase…'}
          {verifyState === 'failed' && 'Purchase received — confirmation pending'}
          {(verifyState === 'done' || verifyState === 'idle') && (
            <>
              Purchase confirmed —{' '}
              {confirmedEmail ? (
                <span className="font-normal text-emerald-200/80">
                  receipt sent to <span className="font-mono">{confirmedEmail}</span>
                </span>
              ) : (
                <span>
                  you now have full access to{' '}
                  <span className="text-white">{reportTitle}</span>
                </span>
              )}
            </>
          )}
        </p>
        <button
          type="button"
          aria-label="Dismiss confirmation banner"
          onClick={dismiss}
          className="ml-auto shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">

          {/* Left: What they unlocked + access instructions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              What you just unlocked
            </p>
            <ul className="mt-3 space-y-2">
              {[
                'Full report — all implementation chapters and locked sections below',
                'Unlimited AI guide questions for this report',
                'Permanent access — linked to your purchase email forever',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-slate-200">
                  <span className={`mt-[7px] shrink-0 h-1.5 w-1.5 rounded-full ${dot}`} />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl border border-white/8 bg-black/25 px-4 py-3.5">
              <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${txt}`}>
                Access the full interactive reader
              </p>
              <p className="mt-1.5 text-sm leading-6 text-slate-300">
                Create a free account with the same email you used at checkout — your purchase is permanently
                linked to your email.{' '}
                <span className="font-semibold text-white">You never need to re-purchase.</span>
              </p>
            </div>

            {verifyState === 'failed' && (
              <p className="mt-3 text-xs leading-5 text-amber-400/80">
                Auto-verification timed out — your payment went through. Email{' '}
                <a href="mailto:hello@rareagent.work" className="underline hover:text-amber-300">
                  hello@rareagent.work
                </a>{' '}
                with your receipt if you need help accessing the full content.
              </p>
            )}
          </div>

          {/* Right: Primary CTA */}
          <div className="flex flex-col gap-3 sm:min-w-[200px]">
            <Link
              href={`/auth/login?redirect=/reports/${reportSlug}/html`}
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_8px_24px_rgba(52,211,153,0.25)] transition-all hover:-translate-y-px hover:bg-emerald-300"
            >
              Open full report →
            </Link>
            <a
              href="#guide"
              className={`inline-flex items-center justify-center rounded-full border ${bdr} px-6 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white`}
            >
              Ask the AI guide first
            </a>
            <p className="text-center text-[10px] text-slate-600">
              {reportPrice} · one-time · lifetime access
            </p>
          </div>
        </div>

        {/* Confidence strip */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/8 pt-4">
          {[
            { icon: '🔒', label: 'Stripe-secured checkout' },
            { icon: '✉️', label: 'Receipt sent to your email' },
            { icon: '♾️', label: 'Lifetime access — no expiry' },
            { icon: '🧾', label: 'Access linked to your email address' },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>{item.icon}</span>
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
