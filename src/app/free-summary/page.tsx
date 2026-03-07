import { getFreeSummary } from "@/lib/content";

export default function FreeSummaryPage() {
  const summary = getFreeSummary(8);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Free AI Brief</h1>
      <p className="mt-2 text-sm text-zinc-600">Condensed recap of important recent events.</p>
      <p className="mt-1 text-xs text-zinc-500">Updated: {new Date(summary.updated_at).toLocaleString()}</p>

      <ul className="mt-6 space-y-4">
        {summary.items.map((item) => (
          <li key={item.id} className="rounded-lg border p-4">
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-zinc-700">Why it matters: {item.why_it_matters}</p>
            <a className="mt-2 inline-block text-xs underline" href={item.source_url} target="_blank" rel="noreferrer">View source</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
