import Link from 'next/link';
import { BreadcrumbJsonLd } from '@/components/JsonLd';

export default function SubmitWorkThanksPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-slate-100">
      <BreadcrumbJsonLd items={[{ name: 'Home', url: 'https://rareagent.work' }, { name: 'Submit Work', url: 'https://rareagent.work/submit-work' }, { name: 'Thanks', url: 'https://rareagent.work/submit-work/thanks' }]} />
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <section className="w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Request received</p>
          <h1 className="mt-3 text-4xl font-bold text-white">Thanks — your brief is in review.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            We’ll review fit, trust boundaries, and next-step routing. Expect an initial response within 24 hours.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Link href="/news" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.08]">Explore live news</Link>
            <Link href="/pricing" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.08]">View pricing</Link>
            <Link href="/book-demo" className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20">Book strategy call</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
