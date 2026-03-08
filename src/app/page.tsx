import Image from 'next/image';
import Link from 'next/link';
import { getAllReports } from '@/lib/reports';
import ReportChat from '@/components/ReportChat';
import BuyButton from '@/components/BuyButton';
import ConsultingForm from '@/components/ConsultingForm';
import { WebsiteJsonLd } from '@/components/JsonLd';

const colorMap: Record<string, { border: string; text: string; btn: string }> = {
  blue: { border: 'border-cyan-400/20', text: 'text-cyan-300', btn: 'bg-cyan-500 hover:bg-cyan-400' },
  green: { border: 'border-emerald-400/20', text: 'text-emerald-300', btn: 'bg-emerald-500 hover:bg-emerald-400' },
  purple: { border: 'border-fuchsia-400/20', text: 'text-fuchsia-300', btn: 'bg-fuchsia-500 hover:bg-fuchsia-400' },
};

const featuredLogos = [
  {
    src: '/logos/Gemini_Generated_Image_8fgn98fgn98fgn98.jpg',
    alt: 'Rare Agent Work logo concept with luminous geometric framing',
    caption: 'Signal-rich visual identity',
  },
  {
    src: '/logos/Gemini_Generated_Image_b1ebffb1ebffb1eb.jpg',
    alt: 'Rare Agent Work crest concept in a futuristic editorial style',
    caption: 'Editorial, premium, unmistakably ours',
  },
  {
    src: '/logos/Gemini_Generated_Image_mtgvo9mtgvo9mtgv.jpg',
    alt: 'Rare Agent Work medallion concept with metallic finish',
    caption: 'Built for a premium operator brand',
  },
];

const testingCards = [
  {
    eyebrow: 'Step 1',
    title: 'Read the positioning and offer in one pass',
    body: 'Use Start Here to understand the operator angle, recommended path, and where each report fits before clicking deeper.',
    href: '/start-here',
    label: 'Open Start Here',
    testId: 'quicktest-start-here',
  },
  {
    eyebrow: 'Step 2',
    title: 'Hit the public docs and API routes',
    body: 'Open the docs page, verify the OpenAPI spec, and test the public /api/v1 endpoints without signing in.',
    href: '/docs',
    label: 'Open API docs',
    testId: 'quicktest-docs',
  },
  {
    eyebrow: 'Step 3',
    title: 'Use the strongest conversion path',
    body: 'Request an assessment or email the team directly so there is a clear high-intent path beyond browsing content.',
    href: '/assessment',
    label: 'Request an assessment',
    testId: 'quicktest-assessment',
  },
];

export default function Home() {
  const reports = getAllReports();

  return (
    <div className="min-h-screen bg-[#050816] font-sans text-slate-100 selection:bg-cyan-400 selection:text-slate-950">
      <WebsiteJsonLd />

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[24rem] h-[22rem] w-[22rem] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-5rem] h-[26rem] w-[26rem] rounded-full bg-emerald-500/10 blur-3xl" />
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
              <Link href="/start-here" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Start Here</Link>
              <Link href="/news" className="text-xs text-slate-400 transition-colors hover:text-white sm:text-sm">News Feed</Link>
              <Link href="/digest" className="text-xs text-slate-400 transition-colors hover:text-white sm:text-sm">Weekly Digest</Link>
              <Link href="/reports" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Reports</Link>
              <Link href="/docs" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Docs</Link>
              <Link href="/assessment" className="hidden text-xs text-slate-400 transition-colors hover:text-white sm:block sm:text-sm">Assessment</Link>
              <Link
                href="/pricing"
                className="ml-1 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition-all hover:border-cyan-200 hover:bg-cyan-400/20 sm:px-4 sm:text-sm"
              >
                View Plans
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-white/5 px-4 py-2 text-sm text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
              RareAgent.work for teams shipping agents
            </div>

            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
              Bespoke intelligence for the
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-300 bg-clip-text text-transparent">
                rare agents doing real work
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              Rare Agent Work blends a premium operator news desk, applied research, and direct implementation support.
              Less generic AI content. More signal, sharper taste, and a brand that looks like it belongs in the room.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/start-here"
                data-testid="hero-primary-cta"
                className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-7 py-4 text-base font-semibold text-slate-950 shadow-[0_16px_50px_rgba(34,211,238,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Start here
              </Link>
              <Link
                href="/assessment"
                data-testid="hero-assessment-cta"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Request an assessment
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400">
              <Link href="/docs" data-testid="hero-docs-link" className="rounded-full border border-white/10 px-4 py-2 transition-colors hover:border-cyan-300/40 hover:text-white">
                Read the public API docs
              </Link>
              <a href="mailto:hello@rareagent.work?subject=Rare%20Agent%20Work%20demo%20request" className="rounded-full border border-white/10 px-4 py-2 transition-colors hover:border-cyan-300/40 hover:text-white">
                Email Michael for a demo
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Positioning</p>
                <p className="mt-2 text-sm font-medium text-white">Premium operator identity, not generic AI SaaS chrome</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Brand assets</p>
                <p className="mt-2 text-sm font-medium text-white">New logos and figures woven into the front page narrative</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Testing path</p>
                <p className="mt-2 text-sm font-medium text-white">Start Here → Docs → Assessment gives visitors a clear top-to-bottom evaluation loop</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-cyan-400/20 via-transparent to-fuchsia-400/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 p-4 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[#07111f] px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Brand system</p>
                  <p className="mt-1 text-lg font-semibold text-white">Rare Agent Work</p>
                </div>
                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Live refresh
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                <div className="relative min-h-[24rem] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#091426]">
                  <Image
                    src="/logos/Gemini_Generated_Image_osb757osb757osb7.jpg"
                    alt="Rare Agent Work signature emblem"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Signature mark</p>
                    <p className="mt-2 text-xl font-semibold text-white">A more ownable visual system for RareAgent.work</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {featuredLogos.map((logo) => (
                    <div key={logo.src} className="group relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#091426]">
                      <div className="relative h-32 w-full">
                        <Image src={logo.src} alt={logo.alt} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 1024px) 100vw, 24vw" />
                      </div>
                      <div className="border-t border-white/10 p-3">
                        <p className="text-sm font-medium text-white">{logo.caption}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <section className="border-y border-white/10 bg-white/[0.03] py-14 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">Brand direction</p>
              <h2 className="mt-3 text-3xl font-bold text-white">From generic landing page to something with a point of view</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                The new visual treatment uses the uploaded Rare Agent figures as editorial anchors: premium marks, metallic medallions,
                and a darker palette that feels closer to an operator publication than a default startup template.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {featuredLogos.map((logo) => (
                <div key={`${logo.src}-tile`} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#081120] p-2">
                  <div className="relative h-48 overflow-hidden rounded-[1.1rem]">
                    <Image src={logo.src} alt={logo.alt} fill className="object-cover" sizes="(max-width: 1024px) 33vw, 20vw" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="quick-test" data-testid="quick-test-section" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">Fast test path</p>
            <h2 className="mt-3 text-3xl font-bold text-white">A clearer way to evaluate the product in minutes</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              The site now has an explicit top-of-funnel path: orient on the thesis, verify the machine-readable surfaces,
              then use the assessment flow as the high-intent CTA.
            </p>
          </div>
          <Link href="/docs" className="inline-flex items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20">
            Open docs and endpoints
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {testingCards.map((card) => (
            <div key={card.title} className="flex flex-col rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{card.eyebrow}</p>
              <h3 className="mt-3 text-xl font-semibold text-white">{card.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-slate-300">{card.body}</p>
              <Link
                href={card.href}
                data-testid={card.testId}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                {card.label}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-3xl font-bold text-white">Clear pricing, clearer outcomes</h2>
            <p className="mx-auto max-w-3xl text-lg text-slate-300">
              Competitors mostly sell links or hype. Rare Agent Work should sell speed, interpretation, and access to expertise.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
              <div className="mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Free</span>
                <p className="mt-1 text-3xl font-bold text-white">$0</p>
                <p className="mt-1 text-sm text-slate-400">Try the product before committing</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-slate-300">
                <li>✓ Browse the live news feed</li>
                <li>✓ Read report previews</li>
                <li>✓ Ask limited AI questions</li>
              </ul>
              <Link href="/news" className="inline-flex rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15">
                Start free
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-[1.75rem] border border-fuchsia-400/30 bg-fuchsia-500/10 p-7 backdrop-blur-sm">
              <div className="absolute right-4 top-4">
                <span className="rounded-full bg-fuchsia-400 px-2.5 py-1 text-xs font-semibold text-slate-950">Best entry point</span>
              </div>
              <div className="mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-fuchsia-200">Newsletter</span>
                <p className="mt-1 text-3xl font-bold text-white">$10<span className="text-lg font-normal text-slate-300">/mo</span></p>
                <p className="mt-1 text-sm text-slate-300">For people who want the signal without the noise</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-slate-100">
                <li>✓ Weekly premium newsletter</li>
                <li>✓ Hot-news alerts as important stories land</li>
                <li>✓ Side-panel AI context on the news desk</li>
                <li>✓ Operator summaries focused on what changed and what to do next</li>
              </ul>
              <BuyButton plan="newsletter" label="Get the newsletter — $10/mo" className="inline-flex rounded-full bg-fuchsia-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-fuchsia-300" />
            </div>

            <div className="rounded-[1.75rem] border border-cyan-400/30 bg-cyan-500/10 p-7 backdrop-blur-sm">
              <div className="mb-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Operator Access</span>
                <p className="mt-1 text-3xl font-bold text-white">$49<span className="text-lg font-normal text-slate-300">/mo</span></p>
                <p className="mt-1 text-sm text-slate-300">For teams actively building with agents</p>
              </div>
              <ul className="mb-7 space-y-3 text-sm text-slate-100">
                <li>✓ Everything in Newsletter</li>
                <li>✓ Full report library and rolling updates</li>
                <li>✓ More AI implementation help</li>
                <li>✓ Priority access to new research drops</li>
              </ul>
              <BuyButton plan="pro" label="Get Operator Access — $49/mo" className="inline-flex rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300" />
            </div>
          </div>
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">What you can actually buy here</p>
          <h2 className="mb-4 text-4xl font-bold text-white">Rare Agent Work catalog</h2>
          <p className="mx-auto max-w-3xl text-lg text-slate-300">
            This is not just a report store anymore. The product now has three layers: a live operator news desk, a $10/month
            newsletter, and direct consulting access for teams that need implementation help.
          </p>
        </div>

        <div className="mb-10 grid gap-6 lg:grid-cols-3">
          <div className="rounded-[1.75rem] border border-fuchsia-400/30 bg-fuchsia-500/10 p-7 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-fuchsia-400 px-2.5 py-1 text-xs font-semibold text-slate-950">New core offer</span>
              <span className="text-sm font-semibold text-fuchsia-200">$10/mo</span>
            </div>
            <h3 className="text-2xl font-bold text-white">Newsletter membership</h3>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              Weekly premium newsletter, hot-news alerts, and side-panel AI context built for subscribed operators.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li>✓ Premium newsletter</li>
              <li>✓ Hot-news alerts</li>
              <li>✓ Contextual AI chat on the news feed</li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <BuyButton plan="newsletter" label="Get newsletter — $10/mo" className="inline-flex rounded-full bg-fuchsia-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-fuchsia-300" />
              <Link href="/pricing" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                View pricing
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-cyan-400/30 bg-cyan-500/10 p-7 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">Live desk</span>
              <span className="text-sm font-semibold text-cyan-200">Updated continuously</span>
            </div>
            <h3 className="text-2xl font-bold text-white">Hot-news feed + subscriber copilot</h3>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              Breaking agent news with context beside the feed — what changed, why it matters, and what a team should do next.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li>✓ Freshness signals on the feed</li>
              <li>✓ Side-panel context chat</li>
              <li>✓ Built for operators, not casual readers</li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/news" className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300">
                Open live news
              </Link>
              <Link href="/digest" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Read digest
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-emerald-400/30 bg-emerald-500/10 p-7 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">Direct access</span>
              <span className="text-sm font-semibold text-emerald-200">Consulting</span>
            </div>
            <h3 className="text-2xl font-bold text-white">Bring Michael in</h3>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              For teams that need strategy, architecture review, implementation help, or an operator-grade audit of what they are building.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li>✓ Intake form on-site</li>
              <li>✓ Email routed directly to Michael</li>
              <li>✓ Best for serious agent teams</li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="#assessment" className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300">
                Request consulting
              </Link>
              <Link href="/assessment" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Open assessment
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-10 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Reference library</p>
              <h3 className="mt-2 text-2xl font-bold text-white">Operator-grade reports still anchor the catalog</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                The reports remain the durable reference layer: implementation playbooks, architecture guidance, and technical decision support.
              </p>
            </div>
            <Link href="/reports" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
              Browse all reports
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {reports.map((report) => {
            const c = colorMap[report.color] ?? colorMap.blue;
            const excerpt = report.excerpt[0];
            return (
              <div key={report.slug} className={`flex flex-col rounded-[1.75rem] border ${c.border} bg-white/[0.04] p-8 transition-all hover:-translate-y-1 hover:border-white/20`}>
                <div className="mb-3 flex items-start justify-between">
                  <span className={`text-2xl font-extrabold ${c.text}`}>{report.price}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">{report.priceLabel}</span>
                </div>
                <h3 className="mb-2 text-xl font-bold text-white">{report.title}</h3>
                <p className={`mb-3 text-sm font-semibold ${c.text}`}>{report.subtitle}</p>
                <p className="mb-4 text-sm leading-relaxed text-slate-300">{report.audience}</p>

                <div className={`mb-5 border-l-2 ${c.text.replace('text-', 'border-')} pl-4`}>
                  <p className={`mb-1 text-xs font-semibold ${c.text}`}>{excerpt.heading}</p>
                  <p className="line-clamp-3 text-xs leading-relaxed text-slate-400">
                    {excerpt.body.split('\n\n')[0].replace(/\*\*(.*?)\*\*/g, '$1')}
                  </p>
                </div>

                <div className="mb-5 space-y-2">
                  {report.deliverables.slice(0, 3).map((d) => (
                    <div key={d.title} className="flex items-start gap-2 text-sm">
                      <span>{d.icon}</span>
                      <span className="text-slate-300">{d.title}</span>
                    </div>
                  ))}
                  <p className="pl-6 text-xs text-slate-500">+ {report.deliverables.length - 3} more sections</p>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  <Link href={`/reports/${report.slug}`} className={`text-center text-sm font-semibold ${c.text} hover:underline`}>
                    Read preview →
                  </Link>
                  <BuyButton label={`Buy — ${report.price}`} plan={report.planKey} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="guide" className="border-y border-white/10 bg-white/[0.03] py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-3xl font-bold text-white">Ask the AI guide</h2>
            <p className="text-slate-300">Use the same expert framing that powers the reports and the news desk.</p>
            <p className="mt-2 text-sm text-slate-400">
              <Link href="/auth/login" className="text-cyan-300 underline hover:text-cyan-200">Sign in</Link>
              {' '}for higher usage limits and full member access.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-[#07111f]/90 p-6 shadow-[0_20px_60px_rgba(5,8,22,0.55)]">
            <ReportChat placeholder="What should I build first? Which frameworks are real? How do I avoid the common traps?" />
          </div>
        </div>
      </section>

      <section id="assessment" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Assessment</p>
            <h2 className="mt-3 text-4xl font-bold text-white">Need hands-on help? Bring Michael in directly.</h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Strategy, architecture review, deployment design, implementation rescue, and executive briefings for teams building serious agent systems.
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p>• AI agent product strategy and market positioning</p>
              <p>• Workflow and multi-agent architecture reviews</p>
              <p>• High-trust implementation plans for internal teams and clients</p>
              <p>• Rapid audits of reliability, observability, and deployment risk</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-400">
              <Link href="/assessment" className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20">
                Open full assessment page
              </Link>
              <a href="mailto:hello@rareagent.work?subject=Rare%20Agent%20Work%20assessment" className="rounded-full border border-white/10 px-4 py-2 transition-colors hover:border-cyan-300/40 hover:text-white">
                Email fallback
              </a>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <ConsultingForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="mb-2 text-2xl font-bold text-white">Report History</h2>
            <p className="text-sm text-slate-400">Every version archived. Subscribers get access to the full history.</p>
          </div>
          <Link href="/research/history" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            Full archive →
          </Link>
        </div>
        <div className="divide-y divide-white/10 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.03]">
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <span className="mb-1 block text-xs font-mono text-slate-400">v1.0 · Mar 4, 2026</span>
              <p className="text-sm font-semibold text-white">Initial Launch — Three core operator reports</p>
              <p className="mt-1 text-xs text-slate-400">Agent Setup in 60 Minutes · Single to Multi-Agent · Empirical Architecture</p>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">Current</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 text-center text-sm text-slate-400">
        <p className="mb-3">© {new Date().getFullYear()} Rare Agent Work. Bespoke operator-grade AI research and news.</p>
        <div className="mb-3 flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/start-here" className="transition-colors hover:text-white">Start Here</Link>
          <span className="text-white/20">·</span>
          <Link href="/news" className="transition-colors hover:text-white">News Feed</Link>
          <span className="text-white/20">·</span>
          <Link href="/digest" className="transition-colors hover:text-white">Weekly Digest</Link>
          <span className="text-white/20">·</span>
          <Link href="/docs" className="transition-colors hover:text-white">Docs</Link>
          <span className="text-white/20">·</span>
          <Link href="/assessment" className="transition-colors hover:text-white">Assessment</Link>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          <Link href="/research/history" className="transition-colors hover:text-white">Report Archive</Link>
          <span className="text-white/20">·</span>
          <Link href="/auth/login" className="transition-colors hover:text-white">Sign In</Link>
          <span className="text-white/20">·</span>
          <a href="mailto:hello@rareagent.work" className="transition-colors hover:text-white">hello@rareagent.work</a>
        </div>
      </footer>
    </div>
  );
}
