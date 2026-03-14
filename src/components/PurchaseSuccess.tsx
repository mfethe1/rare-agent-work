'use client';

/**
 * PurchaseSuccess — Post-purchase unlock component.
 *
 * Rendered on /reports/[slug]?purchased=true&session_id=...
 * Verifies the Stripe session server-side, shows a confirmation banner,
 * and (critically) unlocks all report excerpt sections for this browser session.
 *
 * The unlock is persisted in sessionStorage so it survives navigation within
 * the same browser session. On next visit the user will need to re-verify,
 * but the Stripe session ID is permanent so the check succeeds instantly.
 */

import { useEffect, useState, useCallback } from 'react';

interface Props {
  reportSlug: string;
  sessionId: string;
  onUnlocked: () => void;
}

type VerifyState = 'verifying' | 'unlocked' | 'failed';

const SESSION_KEY = (slug: string, sid: string) => `rarw_unlocked_${slug}_${sid}`;

export default function PurchaseSuccess({ reportSlug, sessionId, onUnlocked }: Props) {
  const [state, setState] = useState<VerifyState>(() => {
    // Check sessionStorage first to avoid re-verification on navigation
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem(SESSION_KEY(reportSlug, sessionId)) === '1') {
        return 'unlocked';
      }
    }
    return 'verifying';
  });

  const [email, setEmail] = useState<string>('');
  const [dismissed, setDismissed] = useState(false);

  const verify = useCallback(async () => {
    try {
      const res = await fetch('/api/stripe/verify-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reportSlug }),
      });

      if (res.ok) {
        const data = await res.json() as { verified: boolean; email: string };
        if (data.verified) {
          sessionStorage.setItem(SESSION_KEY(reportSlug, sessionId), '1');
          setEmail(data.email ?? '');
          setState('unlocked');
          onUnlocked();
        } else {
          setState('failed');
        }
      } else {
        setState('failed');
      }
    } catch {
      setState('failed');
    }
  }, [sessionId, reportSlug, onUnlocked]);

  useEffect(() => {
    if (state === 'verifying') {
      void verify();
    } else if (state === 'unlocked') {
      // Already unlocked from sessionStorage — immediately notify parent
      onUnlocked();
    }
  }, [state, verify, onUnlocked]);

  if (dismissed) return null;

  if (state === 'verifying') {
    return (
      <div className="mb-8 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.08] p-5">
        <div className="flex items-center gap-3">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-sm font-semibold text-cyan-300">Verifying your purchase…</p>
        </div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="mb-8 rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-amber-300">Purchase verification issue</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              We couldn&apos;t verify your purchase automatically. All sections are visible below.
              If you have any issues, email{' '}
              <a href="mailto:hello@rareagent.work" className="text-amber-300 underline">
                hello@rareagent.work
              </a>{' '}
              with your receipt and we&apos;ll resolve it within 24 hours.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Unlocked state — celebratory confirmation banner
  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-emerald-400/40 bg-emerald-500/[0.08]">
      <div className="border-b border-emerald-400/20 bg-emerald-500/[0.05] px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🔓</span>
          <p className="text-sm font-bold text-emerald-300">Full report unlocked</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors text-xs"
          aria-label="Dismiss confirmation"
        >
          ✕
        </button>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm leading-6 text-slate-300">
          <span className="font-semibold text-white">Purchase confirmed.</span>{' '}
          {email && (
            <>
              Receipt sent to{' '}
              <span className="font-mono text-emerald-300">{email}</span>.{' '}
            </>
          )}
          All sections are now unlocked below. Scroll down to continue reading.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-emerald-400">✓</span>
            Instant access — no account required
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-emerald-400">✓</span>
            Use this link to re-access anytime
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-emerald-400">✓</span>
            Questions? hello@rareagent.work
          </div>
        </div>
      </div>
    </div>
  );
}
