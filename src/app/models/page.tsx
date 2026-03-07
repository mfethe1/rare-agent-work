import { getModels } from "@/lib/content";

export default function ModelsPage() {
  const models = getModels();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-bold">Model Rankings</h1>
      <p className="mt-2 text-sm text-zinc-600">Curated from multiple sources, ordered by ranking score.</p>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="p-3">Model</th>
              <th className="p-3">Provider</th>
              <th className="p-3">Capabilities</th>
              <th className="p-3">Score</th>
              <th className="p-3">Verified</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={`${m.provider}-${m.model_name}`} className="border-t">
                <td className="p-3 font-medium">{m.model_name}</td>
                <td className="p-3">{m.provider}</td>
                <td className="p-3">{m.capabilities.join(", ")}</td>
                <td className="p-3">{m.ranking_score}</td>
                <td className="p-3">{new Date(m.last_verified_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
