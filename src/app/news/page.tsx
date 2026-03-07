import { getFreshNews } from "@/lib/content";

export default function NewsPage() {
  const items = getFreshNews(14);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">AI News Digest</h1>
      <p className="mt-2 text-sm text-zinc-600">Strict freshness policy: only stories from the last 14 days are shown.</p>

      <ul className="mt-6 space-y-4">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border p-4">
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-zinc-700">{item.summary}</p>
            <div className="mt-2 text-xs text-zinc-500">
              <span>{new Date(item.published_at).toLocaleString()}</span>
              <span> · </span>
              <a className="underline" href={item.source_url} target="_blank" rel="noreferrer">source</a>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 ? <p className="mt-6 text-sm text-zinc-500">No fresh stories in the last 14 days.</p> : null}
    </main>
  );
}
