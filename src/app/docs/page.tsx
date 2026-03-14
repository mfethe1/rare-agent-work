import type { Metadata } from 'next';
import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';
import { integrationPatterns, trustControlBullets } from '@/lib/site-copy';
import SiteNav from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Public Docs & API Quickstart',
  description:
    'Human-readable docs for Rare Agent Work public routes, machine-readable endpoints, OpenAPI spec, and quick test commands.',
  alternates: {
    canonical: 'https://rareagent.work/docs',
  },
  openGraph: {
    title: 'Rare Agent Work Docs',
    description: 'Public docs, endpoint overview, and quick test paths for rareagent.work.',
    url: 'https://rareagent.work/docs',
    siteName: 'Rare Agent Work',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Rare Agent Work Docs' }],
  },
};

const endpointCards = [
  {
    title: 'Model leaderboard',
    href: '/api/v1/models',
    summary: 'Ranked models for agentic work with scores, provider names, context window, and best-fit use cases.',
    example: 'curl https://rareagent.work/api/v1/models',
  },
  {
    title: 'Curated news feed',
    href: '/api/v1/news',
    summary: 'Fresh AI agent news with tags, summaries, and source links. Good for smoke tests and feed verification.',
    example: 'curl "https://rareagent.work/api/v1/news?tag=openai&limit=5"',
  },
  {
    title: 'Report catalog',
    href: '/api/v1/reports',
    summary: 'Operator-grade report metadata, pricing, deliverables, and preview sections.',
    example: 'curl https://rareagent.work/api/v1/reports',
  },
  {
    title: 'OpenAPI spec',
    href: '/api/v1/openapi.json',
    summary: 'Machine-readable API contract for agents, QA, and external integrations.',
    example: 'curl https://rareagent.work/api/v1/openapi.json',
  },
];

const machineReadableLinks = [
  {
    title: 'Agent card',
    href: '/.well-known/agent.json',
    description: 'Discovery metadata for agents and integrations.',
  },
  {
    title: 'LLMs.txt',
    href: '/llms.txt',
    description: 'Compressed human-plus-agent description of the site and reports.',
  },
  {
    title: 'Full llms.txt',
    href: '/llms-full.txt',
    description: 'Expanded machine-readable context surface.',
  },
  {
    title: 'RSS feed',
    href: '/feed.xml',
    description: 'Feed surface for news ingestion and subscription testing.',
  },
];

const humanFlow = [
  {
    title: 'Start Here',
    href: '/start-here',
    description: 'Fast orientation page for what the site is, who it is for, and where to go next.',
  },
  {
    title: 'Assessment',
    href: '/assessment',
    description: 'Highest-intent contact flow for consulting, architecture review, and implementation rescue.',
  },
  {
    title: 'Pricing',
    href: '/pricing',
    description: 'Clear offer page for newsletter, operator access, and next-step purchase decisions.',
  },
  {
    title: 'Trust Controls',
    href: '/trust',
    description: 'Process visibility for submit-work, consulting, network, and public API consumers.',
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://rareagent.work' },
          { name: 'Docs', url: 'https://rareagent.work/docs' },
        ]}
      />

      <SiteNav
        primaryCta={{ label: 'Browse Reports', href: '/reports' }}
      />

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <section className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Public docs</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            The fastest way to test Rare Agent Work without guessing where anything lives
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            This page exists for human QA, partner integrations, and agent-readable discovery. Use it to verify the public routes,
            the machine-readable surfaces, and the strongest contact path in one pass.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {humanFlow.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
              <Link href={item.href} className="mt-4 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                Open {item.title} →
              </Link>
            </div>
          ))}
        </section>

        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">API quickstart</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Public endpoints</h2>
            </div>
            <Link href="/api/v1/openapi.json" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
              Open raw OpenAPI spec →
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {endpointCards.map((endpoint) => (
              <div key={endpoint.href} className="rounded-3xl border border-white/10 bg-[#0b1730] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-semibold text-white">{endpoint.title}</h3>
                  <Link href={endpoint.href} className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                    Open →
                  </Link>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">{endpoint.summary}</p>
                <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-cyan-100">
                  <code>{endpoint.example}</code>
                </pre>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Machine-readable surfaces</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {machineReadableLinks.map((item) => (
                <div key={item.href} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                  <Link href={item.href} className="mt-4 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                    Open {item.title} →
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Recommended smoke test</p>
            <ol className="mt-4 space-y-4 text-sm leading-6 text-slate-200">
              <li>1. Open <Link href="/" className="text-white underline">home</Link> and verify the hero CTA path.</li>
              <li>2. Open <Link href="/docs" className="text-white underline">docs</Link> and hit at least one /api/v1 route.</li>
              <li>3. Open <Link href="/assessment" className="text-white underline">assessment</Link> and confirm the contact form renders.</li>
              <li>4. Check <Link href="/.well-known/agent.json" className="text-white underline">agent.json</Link> and <Link href="/llms.txt" className="text-white underline">llms.txt</Link>.</li>
            </ol>
            <div className="mt-6 space-y-3">
              <Link href="/assessment" className="block rounded-full bg-cyan-400 px-4 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                Use the contact flow
              </Link>
              <a href="mailto:hello@rareagent.work?subject=Rare%20Agent%20Work%20QA" className="block rounded-full border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/5">
                Email fallback
              </a>
            </div>
          </aside>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Integration patterns</p>
            <div className="mt-5 space-y-4">
              {integrationPatterns.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Public trust package</p>
            <div className="mt-5 space-y-3">
              {trustControlBullets.map((item) => (
                <div key={item} className="rounded-2xl border border-cyan-300/20 bg-[#07111f]/60 px-4 py-4 text-sm text-slate-100">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/trust" className="inline-flex rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                Open trust controls
              </Link>
              <Link href="/.well-known/agent-card.json" className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">
                View agent card
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
