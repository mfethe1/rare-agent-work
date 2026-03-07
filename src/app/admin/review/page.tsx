import { isOwnerUser, ownerEmails } from "@/lib/auth";
import { getReports } from "@/lib/content";

export default async function AdminReviewPage() {
  const isOwner = await isOwnerUser();

  if (!isOwner) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Owner Review Queue</h1>
        <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Access denied. This queue is restricted to owner accounts only.
        </p>
        <p className="mt-2 text-xs text-zinc-500">Configured owner list: {ownerEmails().join(", ")}</p>
      </main>
    );
  }

  const queue = getReports().filter((r) => r.status === "pending_review" || r.status === "draft");

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Owner Review Queue</h1>
      <p className="mt-2 text-sm text-zinc-600">Only owners can approve before publish.</p>

      <ul className="mt-6 space-y-4">
        {queue.map((r) => (
          <li key={r.slug} className="rounded-lg border p-4">
            <h2 className="font-semibold">{r.title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{r.summary}</p>
            <p className="mt-2 text-xs text-zinc-500">Status: {r.status}</p>
            <p className="mt-2 text-xs text-zinc-500">Approval action endpoint scaffolded at /api/reports/review</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
