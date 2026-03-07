import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportBySlug } from "@/lib/content";

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getReportBySlug(slug);
  if (!report) return notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">{report.title}</h1>
      <p className="mt-2 text-sm text-zinc-600">Status: {report.status}</p>
      <p className="mt-2 text-zinc-700">{report.summary}</p>
      <article className="mt-6 rounded-lg border p-4 text-sm text-zinc-800">{report.content}</article>
      <Link href="/admin/review" className="mt-4 inline-block text-sm underline">Go to review queue</Link>
    </main>
  );
}
