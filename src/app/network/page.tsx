import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ConsultingForm from '@/components/ConsultingForm';
import NetworkNarrative from '@/components/NetworkNarrative';
import { BreadcrumbJsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Agent Network',
  description:
    'The first public Agent Network surface from Rare Agent Work: a curated, trust-first discovery layer for serious agent operators, consulting, and early access.',
  keywords: [
    'agent network',
    'a2a strategy',
    'agent-to-agent discovery',
    'ai agent consulting',
    'trusted agent operators',
  ],
  alternates: {
    canonical: 'https://rareagent.work/network',
  },
  openGraph: {
    title: 'Agent Network | Rare Agent Work',
    description:
      'A curated, trust-first surface for discovering serious agent operators, early access, and consulting-led matches.',
    url: 'https://rareagent.work/network',
    siteName: 'Rare Agent Work',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Rare Agent Work Agent Network' }],
  },
};

const networkSignals = [
  { label: 'Trust-first', value: 'Manual curation over open submissions' },
  { label: 'A2A shape', value: 'Discovery, matching, and scoped collaboration' },
  { label: 'Best entry point', value: 'Early access or consulting-led brief' },
];

export default function NetworkPage() {
  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://rareagent.work' },
          { name: 'Agent Network', url: 'https://rareagent.work/network' },
        ]}
      />

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[20rem] h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/14 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-[-5rem] h-[24rem] w-[24rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(5,8,22,0.96),rgba(3,6,18,1))]" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
                <Image src="/logo-medallion.jpg" alt="Rare Agent Work logo" fill className="object-cover" sizes="40px" priority />
              </div>
              <div>
                <span className="block text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300/90">Rare Agent</span>
                <span className="block text-base font-bold tracking-tight text-white">Work</span>
              </div>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/news" className="text-xs text-slate-400 transition-colors hover:text-white sm:text-sm">News Feed</Link>
              <Link href="/reports" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Reports</Link>
              <Link href="/network" className="hidden text-xs text-cyan-300 transition-colors hover:text-cyan-200 sm:block sm:text-sm">Agent Network</Link>
              <Link href="/assessment" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Assessment</Link>
              <Link
                href="/book-demo"
                className="ml-1 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition-all hover:border-cyan-200 hover:bg-cyan-400/20 sm:px-4 sm:text-sm"
              >
                Book Demo
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-white/5 px-4 py-2 text-sm text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
              First public surface for the Rare Agent Work A2A strategy
            </div>

            <h1 className="mt-8 max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
              The
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-300 bg-clip-text text-transparent">
                Agent Network
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              A curated discovery layer for serious agent work: where teams with real implementation needs can find trusted operators,
              shape the brief, and start with a scoped engagement instead of a leap of faith.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link href="/submit-work" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-7 py-4 text-base font-semibold text-slate-950 shadow-[0_16px_50px_rgba(34,211,238,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-cyan-300">
                Submit work for curated matching
              </Link>
              <Link href="#trust-model" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10">
                See the trust model
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm shadow-[0_20px_70px_rgba(5,8,22,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Why this exists</p>
            <div className="mt-5 grid gap-4">
              {networkSignals.map((signal) => (
                <div key={signal.label} className="rounded-[1.25rem] border border-white/10 bg-[#07111f]/80 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{signal.label}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">{signal.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-400">
              Not a generic marketplace. Not a promise of autonomous backend magic. Just a polished front door for trust, fit, and operator-grade introductions.
            </p>
          </div>
        </section>

        <div id="trust-model">
          <NetworkNarrative />
        </div>

        <section id="early-access" className="mt-20 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Tell us what you are trying to solve</p>
            <h2 className="mt-3 text-4xl font-bold text-white">Start with a brief, not a brochure request</h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              The best matches come from concrete context: what the workflow is, where it breaks, who needs to trust it,
              and what kind of help would create the fastest validated next step.
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p>• Architecture reviews for agent products and internal copilots</p>
              <p>• Trusted introductions to operators who can design or ship the right layer</p>
              <p>• Consulting-led discovery when the problem is still fuzzy or politically sensitive</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <ConsultingForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-10 text-center text-sm text-slate-400">
        <p className="mb-3">© {new Date().getFullYear()} Rare Agent Work. Bespoke operator-grade AI research and introductions.</p>
        <div className="mb-3 flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/network" className="transition-colors hover:text-white">Agent Network</Link>
          <span className="text-white/20">·</span>
          <Link href="/news" className="transition-colors hover:text-white">News Feed</Link>
          <span className="text-white/20">·</span>
          <Link href="/assessment" className="transition-colors hover:text-white">Assessment</Link>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/reports" className="transition-colors hover:text-white">Reports</Link>
          <span className="text-white/20">·</span>
          <Link href="/book-demo" className="transition-colors hover:text-white">Book Demo</Link>
          <span className="text-white/20">·</span>
          <a href="mailto:hello@rareagent.work" className="transition-colors hover:text-white">hello@rareagent.work</a>
        </div>
      </footer>
    </div>
  );
}
