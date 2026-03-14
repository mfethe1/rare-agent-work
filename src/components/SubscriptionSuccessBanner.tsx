'use client';

import { useEffect, useState, useCallback } from 'react';

const TIER_LABELS: Record<string, string> = {
  newsletter: 'Newsletter',
  starter: 'Starter',
  pro: 'Operator Access',
};

const TIER_DESCRIPTIONS: Record<string, string> = {
  newsletter: 'Weekly premium newsletter + hot-news alerts + AI news context',
  starter: 'All reports + AI guide with 50k tokens/mo',
  pro: 'All reports + AI guide + priority research drops + rolling updates',
};

const TIER_FEATURES: Record<string, string[]> = {
  newsletter: [
    'Premium newsletter delivered weekly',
    'Hot-news alerts as they break',
    'AI-powered context in the side panel',
  ],
  starter: [
    'Full access to every published report',
    'AI implementation guide — 50k tokens/mo',
    'All future reports included automatically',
  ],
  pro: [
    'Full access to every published report',
    'AI implementation guide — 200k tokens/mo',
    'Priority research drops before public release',
    'Rolling updates to all reports as the field evolves',
  ],
};

function getSearchParam(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

export default function SubscriptionSuccessBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tier, setTier] = useState('');
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'done' | 'failed'>('idle');

  useEffect(() => {
    const subscribed = getSearchParam('subscribed');
    const sessionId = getSearchParam('session_id');
    if (subscribed === 'true' && sessionId) {
      setVisible(true);
      setMounted(true);
    }
  }, []);

  const runVerify = useCallback(async () => {
    const sessionId = getSearchParam('session_id');
    if (!sessionId) return;

    const cacheKey = `rarw_sub_verified_${sessionId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setTier(cached);
      setVerifyState('done');
      return;
    }

    setVerifyState('verifying');
    try {
      const res = await fetch('/api/stripe/verify-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { verified: boolean; tier?: string };
        if (data.verified) {
          const resolvedTier = data.tier ?? '';
          sessionStorage.setItem(cacheKey, resolvedTier);
          setTier(resolvedTier);
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
  }, []);

  useEffect(() => {
    if (mounted) {
      void runVerify();
    }
  }, [mounted, runVerify]);

  const dismiss = useCallback(() => {
    setVisible(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('subscribed');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.toString());
  }, []);

  if (!visible) return null;

  const label = TIER_LABELS[tier] ?? tier ?? 'Your plan';
  const description = TIER_DESCRIPTIONS[tier] ?? '';
  const features = TIER_FEATURES[tier] ?? [];

  return (
    <div
      className={`mb-8 overflow-hidden rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] transition-all duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
      role="alert"
      aria-live="polite"
    >
      {/* Confirmation header */}
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
          {verifyState === 'verifying' && 'Confirming your subscription…'}
          {verifyState === 'failed' && 'Subscription received — confirmation pending'}
          {(verifyState === 'done' || verifyState === 'idle') && (
            <>
              Subscription confirmed — welcome to{' '}
              <span className="text-white">{label}</span>
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
        {description && (
          <p className="text-sm text-slate-300 mb-4">{description}</p>
        )}

        {features.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 mb-3">
              What&apos;s included
            </p>
            <ul className="space-y-2">
              {features.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-slate-200">
                  <span className="mt-[7px] shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {verifyState === 'failed' && (
          <p className="mt-3 text-xs leading-5 text-amber-400/80">
            Auto-verification timed out — your payment went through. Email{' '}
            <a href="mailto:hello@rareagent.work" className="underline hover:text-amber-300">
              hello@rareagent.work
            </a>{' '}
            with your receipt if your plan doesn&apos;t update within a few minutes.
          </p>
        )}

        {/* Confidence strip */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/8 pt-4">
          {[
            { icon: '🔒', label: 'Stripe-secured checkout' },
            { icon: '✉️', label: 'Receipt sent to your email' },
            { icon: '🔄', label: 'Cancel anytime from Stripe portal' },
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
