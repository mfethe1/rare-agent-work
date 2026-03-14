import Link from 'next/link';
import Image from 'next/image';
import { getAllReports } from '@/lib/reports';

export const metadata = {
  title: '404 — Page Not Found',
  description: 'The page you are looking for does not exist. Browse operator-grade AI agent reports, news, and consulting from Rare Agent Work.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  const reports = getAllReports().slice(0, 3);

  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-[30rem] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/8 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
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
            <div className="hidden items-center gap-1 md:flex">
              {[
                { label: 'Reports', href: '/reports' },
                { label: 'News', href: '/news' },
                { label: 'Consulting', href: '/assessment' },
                { label: 'API', href: '/docs' },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full px-3.5 py-1.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </div>
            <Link
              href="/reports"
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-[0_6px_24px_rgba(34,211,238,0.18)] transition-all hover:-translate-y-px hover:bg-cyan-300"
            >
              Browse Reports
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:py-24">
        {/* 404 Hero */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-rose-400/25 bg-rose-500/[0.07] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-rose-300/90">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            404 — Page Not Found
          </div>

          <h1 className="mx-auto mt-7 max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl">
            This page doesn&apos;t exist.
            <span className="block mt-2 bg-gradient-to-r from-cyan-300 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
              But the failure playbooks do.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-400">
            The URL you followed isn&apos;t valid — broken link, mistyped path, or content that moved.
            The research and consulting are still here.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/reports"
              className="inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_16px_48px_rgba(34,211,238,0.25)] transition-all hover:-translate-y-0.5 hover:bg-cyan-300 sm:w-auto"
            >
              Browse the reports →
            </Link>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Back to home
            </Link>
          </div>
        </div>

        {/* Quick navigation grid */}
        <section className="mt-16">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Common destinations
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Reports',
                description: 'Operator playbooks for production AI systems',
                href: '/reports',
                icon: '📋',
                accent: 'border-cyan-500/20 hover:border-cyan-400/40',
              },
              {
                label: 'News Feed',
                description: 'Daily-curated AI agent news with operator context',
                href: '/news',
                icon: '📡',
                accent: 'border-emerald-500/20 hover:border-emerald-400/40',
              },
              {
                label: 'Consulting',
                description: 'Architecture review and implementation rescue',
                href: '/assessment',
                icon: '🔍',
                accent: 'border-fuchsia-500/20 hover:border-fuchsia-400/40',
              },
              {
                label: 'API Docs',
                description: 'Public endpoints — news, reports, models, OpenAPI',
                href: '/docs',
                icon: '⚡',
                accent: 'border-amber-500/20 hover:border-amber-400/40',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col gap-2.5 rounded-2xl border bg-white/[0.025] p-5 transition-all hover:bg-white/[0.04] ${item.accent}`}
              >
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent reports */}
        {reports.length > 0 && (
          <section className="mt-12 rounded-2xl border border-white/8 bg-white/[0.02] p-6 sm:p-8">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Or jump to a specific report
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {reports.map((report) => {
                const colorMap: Record<string, string> = {
                  blue: 'text-blue-300',
                  green: 'text-green-300',
                  purple: 'text-purple-300',
                  red: 'text-red-300',
                  amber: 'text-amber-300',
                };
                return (
                  <Link
                    key={report.slug}
                    href={`/reports/${report.slug}`}
                    className="group rounded-xl border border-white/10 bg-black/20 p-4 transition-all hover:border-white/20 hover:bg-black/30"
                  >
                    <p className={`text-xs font-bold ${colorMap[report.color] ?? 'text-slate-300'}`}>
                      {report.price} · {report.priceLabel}
                    </p>
                    <h3 className="mt-1.5 text-sm font-semibold text-white group-hover:text-slate-200 transition-colors leading-snug">
                      {report.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{report.subtitle}</p>
                    <p className="mt-3 text-[10px] font-semibold text-cyan-400/70 group-hover:text-cyan-400 transition-colors">
                      Read free preview →
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Contact strip */}
        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500">
            Looking for something specific?{' '}
            <a
              href="mailto:hello@rareagent.work"
              className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              hello@rareagent.work
            </a>
          </p>
        </div>
      </main>

      <footer className="mt-8 border-t border-white/10 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Rare Agent Work. Operator-grade AI agent research and consulting.
            </p>
            <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
              <Link href="/reports" className="hover:text-white transition-colors">Reports</Link>
              <Link href="/news" className="hover:text-white transition-colors">News</Link>
              <Link href="/assessment" className="hover:text-white transition-colors">Consulting</Link>
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
