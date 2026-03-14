'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SiteNavProps {
  /** Override the primary CTA. Defaults to "Browse Reports". */
  primaryCta?: { label: string; href: string };
  /** Show a "new report" badge in the nav. */
  newReport?: { title: string; slug: string; price: string } | null;
  /** Variant controls background color to match page theme. */
  variant?: 'dark' | 'darker' | 'news';
}

const NAV_LINKS = [
  { label: 'Reports', href: '/reports' },
  { label: 'News', href: '/news' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Consulting', href: '/assessment' },
  { label: 'API', href: '/docs' },
] as const;

export default function SiteNav({
  primaryCta = { label: 'Browse Reports', href: '/reports' },
  newReport,
  variant = 'dark',
}: SiteNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const bgClass =
    variant === 'darker'
      ? 'bg-[#020617]/90'
      : variant === 'news'
      ? 'bg-[#0d0d0d]/90'
      : 'bg-[#050816]/85';

  const isActive = (href: string) => {
    if (href === '/reports') return pathname.startsWith('/reports');
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      className={`sticky top-0 z-50 border-b border-white/10 ${bgClass} backdrop-blur-xl`}
      role="navigation"
      aria-label="Site navigation"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* ── Wordmark ───────────────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0 group">
            <div className="relative h-8 w-8 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-[0_0_20px_rgba(34,211,238,0.12)] transition-all group-hover:shadow-[0_0_28px_rgba(34,211,238,0.22)]">
              <Image
                src="/logo-medallion.jpg"
                alt="Rare Agent Work"
                fill
                className="object-cover"
                sizes="32px"
                priority
              />
            </div>
            <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
              Rare Agent Work
            </span>
          </Link>

          {/* ── Desktop nav links ──────────────────────────────────── */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Right side: new badge + CTA ───────────────────────── */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* New report badge — desktop only */}
            {newReport && (
              <Link
                href={`/reports/${newReport.slug}`}
                className="hidden items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/[0.08] px-3 py-1.5 text-xs font-semibold text-red-300 transition-all hover:border-red-400/50 hover:bg-red-500/15 lg:flex"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                New: {newReport.title} · {newReport.price}
              </Link>
            )}

            {/* Secondary CTA — desktop only */}
            <Link
              href="/assessment"
              className="hidden rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Get Help
            </Link>

            {/* Primary CTA */}
            <Link
              href={primaryCta.href}
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-[0_6px_24px_rgba(34,211,238,0.18)] transition-all hover:-translate-y-px hover:bg-cyan-300 hover:shadow-[0_8px_32px_rgba(34,211,238,0.28)]"
            >
              {primaryCta.label}
            </Link>

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            >
              {menuOpen ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      {menuOpen && (
        <div className="border-t border-white/8 bg-[#050816]/98 px-4 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            {newReport && (
              <Link
                href={`/reports/${newReport.slug}`}
                onClick={() => setMenuOpen(false)}
                className="mt-2 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/12"
              >
                <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                New: {newReport.title} · {newReport.price}
              </Link>
            )}
            <Link
              href="/assessment"
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Get Help
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
