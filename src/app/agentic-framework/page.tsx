import Link from "next/link";
import { readBenchmarkSeeds } from "@/lib/taviliy";

const features = [
  {
    title: "Taviliy-powered ingestion",
    body: "We pull fresh AI + agentic intel every hour and normalize it into our memU/qmd store for instant reuse.",
  },
  {
    title: "Multi-agent refinement",
    body: "Researcher → Evaluator → Builder agents iterate on each Taviliy pull to produce actionable briefs + starter code.",
  },
  {
    title: "Managed job queue",
    body: "Customers can submit coding or research jobs and receive vetted outputs with provenance and cost tracking.",
  },
  {
    title: "Search + cost cache",
    body: "Identical or similar searches reuse cached context, slashing latency and spend while surfacing trend data.",
  },
];

export default function AgenticFrameworkPage() {
  const seeds = readBenchmarkSeeds();
  const completed = seeds.filter((item) => item.delta !== null);

  return (
    <main className="mx-auto max-w-5xl space-y-12 p-8">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-lime-500">New Offering</p>
        <h1 className="text-4xl font-bold">Agentic Framework Accelerator</h1>
        <p className="text-lg text-zinc-600">
          A fully-managed stack that combines Taviliy search, multi-agent refinement, and job automation so your team can
          ship faster with trustworthy AI context.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/api/payments/checkout"
            className="rounded-md bg-black px-6 py-3 text-sm font-semibold text-white"
          >
            Join the beta (Stripe Checkout)
          </Link>
          <a
            href="/docs/taviliy-agentic-framework.pdf"
            className="rounded-md border px-6 py-3 text-sm font-semibold"
          >
            Download architecture brief
          </a>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border bg-zinc-50 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Benchmark tracker</h3>
            <p className="text-sm text-zinc-600">
              We start with 10 canonical Taviliy searches and prove consistent improvement via the autoresearch loop.
            </p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-3xl font-semibold">{completed.length}/10</p>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Completed</p>
            </div>
            <div>
              <p className="text-3xl font-semibold">{seeds.length - completed.length}</p>
              <p className="text-xs uppercase tracking-wide text-zinc-500">In queue</p>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Query</th>
                <th className="py-2 pr-4">Raw Score</th>
                <th className="py-2 pr-4">Improved Score</th>
                <th className="py-2 pr-4">Delta</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {seeds.map((item) => (
                <tr key={item.query} className="border-t">
                  <td className="py-2 pr-4 font-medium text-zinc-800">{item.query}</td>
                  <td className="py-2 pr-4 text-zinc-600">{item.raw_score ?? "—"}</td>
                  <td className="py-2 pr-4 text-zinc-600">{item.improved_score ?? "—"}</td>
                  <td className="py-2 pr-4 text-zinc-600">{item.delta ?? "—"}</td>
                  <td className="py-2 text-zinc-600">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold">How it works</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600">
          <li>Taviliy ingests the latest agentic + AI infrastructure news directly into our cache.</li>
          <li>Autoresearch loop fans out to specialized agents that critique and refine the context.</li>
          <li>We log every query, token cost, and outcome so you can audit and reuse the insights.</li>
          <li>Stripe subscriptions unlock the managed job queue plus the API endpoints for direct integration.</li>
        </ol>
      </section>
    </main>
  );
}
