import Link from 'next/link';

export default function AuthorSignal() {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Who is behind this</p>
      <h2 className="mt-3 text-2xl font-bold text-white">Rare Agent Work is built around Michael Fethe’s operator lens.</h2>
      <p className="mt-4 text-sm leading-7 text-slate-300">
        The product is opinionated on purpose: less marketplace noise, more judgment about what teams should build, what they should delay, and what usually breaks in production.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/about" className="inline-flex rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300">About Rare Agent Work</Link>
        <Link href="/methodology" className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Methodology</Link>
      </div>
    </section>
  );
}
