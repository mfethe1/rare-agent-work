'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in development, silently capture digest in production
    console.error('[GlobalError]', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-[30rem] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/8 blur-3xl" />
      </div>

      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        {/* Error badge */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-rose-400/25 bg-rose-500/[0.07] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-rose-300/90">
          <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
          Something went wrong
        </div>

        <h1 className="mx-auto mt-7 max-w-2xl text-4xl font-black tracking-tight text-white sm:text-5xl">
          Unexpected error.
          <span className="mt-2 block bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
            We&apos;re on it.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-slate-400">
          Something failed while loading this page. This has been logged. You
          can retry, or navigate back to a known-good page.
        </p>

        {error.digest && (
          <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-2 font-mono text-xs text-slate-500">
            Error reference: {error.digest}
          </p>
        )}

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_16px_48px_rgba(34,211,238,0.25)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300 sm:w-auto"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
          >
            Back to home
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-12 flex flex-wrap justify-center gap-4 text-sm text-slate-500">
          <Link href="/reports" className="transition-colors hover:text-white">
            Reports
          </Link>
          <Link href="/news" className="transition-colors hover:text-white">
            News
          </Link>
          <Link
            href="/assessment"
            className="transition-colors hover:text-white"
          >
            Consulting
          </Link>
          <a
            href="mailto:hello@rareagent.work"
            className="transition-colors hover:text-cyan-400"
          >
            hello@rareagent.work
          </a>
        </div>
      </main>
    </div>
  );
}
