import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-bold">RareAgent</h1>
      <p className="mt-3 text-zinc-700">Fast AI intelligence, curated model rankings, and robust reports with owner approval gates.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card href="/news" title="News Digest" desc="Fresh AI news (last 14 days only)." />
        <Card href="/free-summary" title="Free Summary" desc="Condensed event summary for fast reading." />
        <Card href="/models" title="Model Rankings" desc="Curated latest model capabilities and rank." />
        <Card href="/reports/empirical-architecture" title="Empirical Architecture Report" desc="Report page (no more 404)." />
        <Card href="/admin/review" title="Owner Review Queue" desc="Owner-only approval queue for premium reports." />
        <Card href="/signup" title="Sign up" desc="Account sign-up for subscriptions/reports access." />
      </div>
    </main>
  );
}

function Card({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="rounded-lg border p-4 hover:bg-zinc-50">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-600">{desc}</p>
    </Link>
  );
}
