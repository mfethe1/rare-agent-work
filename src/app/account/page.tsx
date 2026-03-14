export const dynamic = "force-dynamic";
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import ConversionTracker from '@/components/ConversionTracker';
import SubscriptionSuccessBanner from '@/components/SubscriptionSuccessBanner';
import SiteNav from '@/components/SiteNav';
import { getReport } from '@/lib/reports';

// ── Types ───────────────────────────────────────────────────────────────

interface ReportPurchase {
  stripe_session_id: string;
  report_slug: string;
  plan_key: string;
  amount_cents: number;
  purchased_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key);
}

const TIER_META: Record<string, { label: string; color: string; accent: string; border: string; glow: string }> = {
  free: {
    label: 'Free',
    color: 'text-slate-400',
    accent: 'text-slate-300',
    border: 'border-slate-700/50',
    glow: 'rgba(148,163,184,0.05)',
  },
  newsletter: {
    label: 'Newsletter',
    color: 'text-fuchsia-300',
    accent: 'text-fuchsia-200',
    border: 'border-fuchsia-500/30',
    glow: 'rgba(232,121,249,0.08)',
  },
  starter: {
    label: 'Starter',
    color: 'text-blue-300',
    accent: 'text-blue-200',
    border: 'border-blue-500/30',
    glow: 'rgba(59,130,246,0.08)',
  },
  pro: {
    label: 'Operator Access',
    color: 'text-cyan-300',
    accent: 'text-cyan-200',
    border: 'border-cyan-500/30',
    glow: 'rgba(34,211,238,0.10)',
  },
};

const COLOR_MAP: Record<string, { text: string; border: string; badge: string; btn: string }> = {
  blue: {
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    badge: 'bg-blue-900/40 border-blue-500/30 text-blue-200',
    btn: 'bg-blue-600 hover:bg-blue-500 text-white',
  },
  green: {
    text: 'text-green-400',
    border: 'border-green-500/30',
    badge: 'bg-green-900/40 border-green-500/30 text-green-200',
    btn: 'bg-green-600 hover:bg-green-500 text-white',
  },
  purple: {
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    badge: 'bg-purple-900/40 border-purple-500/30 text-purple-200',
    btn: 'bg-purple-600 hover:bg-purple-500 text-white',
  },
  red: {
    text: 'text-red-400',
    border: 'border-red-500/30',
    badge: 'bg-red-900/40 border-red-500/30 text-red-200',
    btn: 'bg-red-600 hover:bg-red-500 text-white',
  },
  amber: {
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    badge: 'bg-amber-900/40 border-amber-500/30 text-amber-200',
    btn: 'bg-amber-600 hover:bg-amber-500 text-white',
  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirect=/account');

  // Fetch profile and report purchases in parallel
  const [profileResult, purchasesResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    (() => {
      const admin = getAdminSupabase();
      if (!admin || !user.email) return Promise.resolve({ data: [] as ReportPurchase[] });
      return admin
        .from('report_purchases')
        .select('stripe_session_id, report_slug, plan_key, amount_cents, purchased_at')
        .eq('customer_email', user.email)
        .order('purchased_at', { ascending: false });
    })(),
  ]);

  const profile = profileResult.data;
  const purchases = (purchasesResult.data ?? []) as ReportPurchase[];

  const tier = profile?.tier ?? 'free';
  const tierMeta = TIER_META[tier] ?? TIER_META.free;
  const tokensUsed = profile?.tokens_used ?? 0;
  const tokensBudget = profile?.tokens_budget ?? 0;
  const usagePct = tokensBudget > 0 ? Math.min(100, (tokensUsed / tokensBudget) * 100) : 0;

  // Enrich purchases with report metadata
  const enrichedPurchases = purchases
    .map((p) => ({ ...p, report: getReport(p.report_slug) }))
    .filter((p) => !!p.report);

  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-[30rem] h-[18rem] w-[18rem] rounded-full bg-fuchsia-500/8 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.95),rgba(3,6,18,1))]" />
      </div>

      <ConversionTracker
        kind="subscription"
        plan={tier}
        value={tier === 'pro' ? 49 : tier === 'starter' ? 29 : tier === 'newsletter' ? 10 : 0}
      />

      <SiteNav primaryCta={{ label: 'Browse Reports', href: '/reports' }} />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Your account</p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            {user.email}
          </h1>
        </div>

        <SubscriptionSuccessBanner />

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

          {/* ── Left column: purchases + access ─────────────────────── */}
          <div className="space-y-6">

            {/* ── PURCHASED REPORTS ─────────────────────────────────── */}
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Your reports
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-white">
                    {enrichedPurchases.length > 0
                      ? `${enrichedPurchases.length} report${enrichedPurchases.length !== 1 ? 's' : ''} purchased`
                      : 'No reports purchased yet'}
                  </h2>
                </div>
                {enrichedPurchases.length > 0 && (
                  <Link
                    href="/reports"
                    className="shrink-0 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    Browse more →
                  </Link>
                )}
              </div>

              {enrichedPurchases.length > 0 ? (
                <div className="space-y-4">
                  {enrichedPurchases.map(({ report, purchased_at, amount_cents, report_slug }) => {
                    if (!report) return null;
                    const c = COLOR_MAP[report.color] ?? COLOR_MAP.blue;
                    return (
                      <div
                        key={report_slug}
                        className={`overflow-hidden rounded-2xl border ${c.border} bg-white/[0.025] backdrop-blur-sm`}
                      >
                        <div className="p-5 sm:p-6">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${c.badge}`}>
                                  {report.price}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Purchased {formatDate(purchased_at)}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-white leading-snug">{report.title}</h3>
                              <p className={`mt-1 text-xs ${c.text}`}>{report.subtitle}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Link
                              href={`/reports/${report_slug}?purchased=true`}
                              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all ${c.btn}`}
                            >
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Read full report
                            </Link>
                            <Link
                              href={`/reports/${report_slug}`}
                              className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                            >
                              Report page →
                            </Link>
                          </div>
                        </div>
                        {/* AI guide strip */}
                        <div className={`border-t border-white/8 bg-black/20 px-5 py-3 flex items-center justify-between gap-3`}>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                            <p className="text-[11px] text-slate-400">AI implementation guide included</p>
                          </div>
                          <Link
                            href={`/reports/${report_slug}#guide`}
                            className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            Ask a question →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Empty state — direct to reports */
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
                  <p className="text-2xl mb-3">📄</p>
                  <h3 className="text-base font-bold text-white mb-2">No reports yet</h3>
                  <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">
                    Every report includes a full free preview before you buy. Read before you commit.
                  </p>
                  <Link
                    href="/reports"
                    className="inline-flex rounded-full bg-cyan-400 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 transition-colors"
                  >
                    Browse reports →
                  </Link>
                </div>
              )}
            </section>

            {/* ── SUBSCRIPTION STATUS ────────────────────────────────── */}
            {tier !== 'free' && (
              <section>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Subscription
                </p>
                <div
                  className={`rounded-2xl border ${tierMeta.border} bg-white/[0.025] p-6`}
                  style={{ boxShadow: `0 0 40px ${tierMeta.glow}` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${tierMeta.color}`}>
                        {tierMeta.label} plan
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {tier === 'pro' && 'All reports + rolling updates + AI guide + priority research drops.'}
                        {tier === 'starter' && 'All reports + AI guide with expanded token budget.'}
                        {tier === 'newsletter' && 'Weekly premium newsletter + hot-news alerts + AI news context.'}
                      </p>
                    </div>
                    <Link
                      href="/pricing"
                      className="shrink-0 inline-flex rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Change plan
                    </Link>
                  </div>

                  {/* Token usage */}
                  {tokensBudget > 0 && (
                    <div className="mt-5 border-t border-white/8 pt-5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-400">AI token usage this month</p>
                        <p className="text-xs font-mono text-slate-300">
                          {tokensUsed.toLocaleString()} / {tokensBudget.toLocaleString()}
                        </p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            usagePct > 90
                              ? 'bg-red-500'
                              : usagePct > 70
                              ? 'bg-amber-400'
                              : 'bg-cyan-400'
                          }`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        {usagePct.toFixed(1)}% used · Resets on next billing date
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

          </div>

          {/* ── Right column: account info + actions ─────────────────── */}
          <div className="space-y-5">

            {/* Account card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Account
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Email</span>
                  <span className="truncate font-medium text-white text-right max-w-[180px]">{user.email}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Plan</span>
                  <span className={`font-bold ${tierMeta.color}`}>{tierMeta.label}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Reports</span>
                  <span className="font-medium text-white">{enrichedPurchases.length}</span>
                </div>
              </div>

              <div className="mt-5 border-t border-white/8 pt-4">
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>

            {/* Upgrade prompt for free users */}
            {tier === 'free' && (
              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.07] p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300 mb-2">
                  Upgrade your access
                </p>
                <p className="text-sm leading-6 text-slate-300 mb-4">
                  Start with the $10/mo newsletter or get full operator access for $49/mo — all reports, AI guide, and rolling updates.
                </p>
                <Link
                  href="/pricing"
                  className="inline-flex w-full items-center justify-center rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300"
                >
                  See plans →
                </Link>
              </div>
            )}

            {/* Consulting CTA */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 mb-2">
                Human consulting
              </p>
              <p className="text-sm leading-6 text-slate-400 mb-4">
                Architecture review, implementation rescue, or strategy call. Every intake read by a human first.
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/assessment"
                  className="inline-flex w-full items-center justify-center rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                >
                  Start an assessment
                </Link>
                <Link
                  href="/book-demo"
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-white hover:border-white/20"
                >
                  Book a strategy call
                </Link>
              </div>
            </div>

            {/* API keys link */}
            <Link
              href="/account/api-keys"
              className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4 text-sm font-medium text-slate-400 transition-colors hover:border-white/15 hover:text-white group"
            >
              <span>API keys</span>
              <span className="text-slate-600 group-hover:text-slate-400 transition-colors">→</span>
            </Link>

          </div>
        </div>

      </main>

      <footer className="mt-12 border-t border-white/8 py-8 text-center text-xs text-slate-600">
        <p>
          © {new Date().getFullYear()} Rare Agent Work ·{' '}
          <Link href="/" className="hover:text-slate-400 transition-colors">
            Home
          </Link>
          {' · '}
          <Link href="/reports" className="hover:text-slate-400 transition-colors">
            Reports
          </Link>
          {' · '}
          <a href="mailto:hello@rareagent.work" className="hover:text-slate-400 transition-colors">
            hello@rareagent.work
          </a>
        </p>
      </footer>
    </div>
  );
}
