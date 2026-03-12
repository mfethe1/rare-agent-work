import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BreadcrumbJsonLd } from '@/components/JsonLd';
import PrintButton from '@/components/PrintButton';
import { getAllReports, getReport } from '@/lib/reports';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const colorMap: Record<string, { border: string; text: string; badge: string; surface: string }> = {
  blue:   { border: 'border-blue-500/30',   text: 'text-blue-400',   badge: 'bg-blue-900/50 border-blue-500/40 text-blue-300',   surface: 'from-blue-950/70 to-slate-950' },
  green:  { border: 'border-green-500/30',  text: 'text-green-400',  badge: 'bg-green-900/50 border-green-500/40 text-green-300',  surface: 'from-green-950/60 to-slate-950' },
  purple: { border: 'border-purple-500/30', text: 'text-purple-400', badge: 'bg-purple-900/50 border-purple-500/40 text-purple-300', surface: 'from-purple-950/60 to-slate-950' },
};

export default async function ProtectedReportHtmlPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getReport(slug);
  if (!report) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirect=/reports/${slug}/html`);
  }

  const c = colorMap[report.color] ?? colorMap.blue;
  const relatedReports = getAllReports().filter((r) => r.slug !== report.slug).slice(0, 2);

  return (
    <div className="min-h-screen bg-[#020617] text-gray-100 font-sans print:bg-white print:text-black">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://rareagent.work' },
          { name: 'Reports', url: 'https://rareagent.work/reports' },
          { name: report.title, url: `https://rareagent.work/reports/${report.slug}` },
          { name: 'Interactive HTML', url: `https://rareagent.work/reports/${report.slug}/html` },
        ]}
      />

      <nav className="border-b border-gray-800/80 bg-black/60 backdrop-blur-sm no-print print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center gap-4">
          <Link href={`/reports/${slug}`} className="text-white font-bold tracking-tighter">← Back to report</Link>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${c.badge}`}>
              Interactive HTML view
            </span>
            <PrintButton />
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
        <section className={`mb-10 overflow-hidden rounded-[28px] border ${c.border} bg-gradient-to-br ${c.surface}`}>
          <div className="border-b border-white/10 px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 overflow-hidden rounded-full border border-white/15 bg-white/5">
                  <Image src="/logo-medallion.jpg" alt="Rare Agent Work" fill className="object-cover" sizes="56px" priority />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-300">Rare Agent Work</p>
                  <p className="mt-1 text-lg font-semibold text-white">Interactive report reader</p>
                  <p className="text-sm text-slate-300">{report.edition} • {report.revision}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:min-w-[260px]">
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                  <div className="text-slate-400">Last updated</div>
                  <div className="mt-1 font-semibold text-white">{report.updatedAt}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                  <div className="text-slate-400">Reading time</div>
                  <div className="mt-1 font-semibold text-white">{report.readingTime}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${c.badge}`}>
                {report.price} {report.priceLabel}
              </span>
              <span className="text-xs text-gray-300 border border-white/10 px-3 py-1 rounded-full">{report.audience}</span>
              <span className="text-xs text-gray-300 border border-white/10 px-3 py-1 rounded-full">Freshness: {report.freshnessTimestamp}</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">{report.title}</h1>
            <p className={`text-xl ${c.text} font-medium mb-3`}>{report.subtitle}</p>
            <p className="text-slate-300 text-lg leading-relaxed max-w-3xl">{report.valueprop}</p>
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start print:hidden">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-bold text-white">Inside this report</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li><a href="#executive-summary" className="hover:text-white">Executive summary</a></li>
                <li><a href="#implications" className="hover:text-white">Implications</a></li>
                <li><a href="#action-steps" className="hover:text-white">Action steps</a></li>
                <li><a href="#risks" className="hover:text-white">Risks</a></li>
                <li><a href="#deliverables" className="hover:text-white">Deliverables</a></li>
                <li><a href="#sample-sections" className="hover:text-white">Sample sections</a></li>
                <li><a href="#citations" className="hover:text-white">Evidence & citations</a></li>
              </ul>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-bold text-white">Related reports</h2>
              <div className="mt-4 space-y-3">
                {relatedReports.map((related) => (
                  <Link key={related.slug} href={`/reports/${related.slug}`} className="block rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-white/20">
                    <div className="text-xs text-cyan-300 font-semibold">{related.price}</div>
                    <div className="mt-1 font-semibold text-white">{related.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{related.subtitle}</div>
                  </Link>
                ))}
              </div>
            </section>
          </aside>

          <div className="space-y-8">
            <section id="executive-summary" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-white">Executive summary</h2>
              <p className="mt-4 text-base leading-8 text-slate-200">{report.executiveSummary}</p>
            </section>

            <section id="implications" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-white">Implications</h2>
              <ul className="mt-4 space-y-3 text-base leading-8 text-slate-200">
                {report.implications.map((item) => (
                  <li key={item} className="flex gap-3"><span className={`${c.text} mt-1`}>●</span><span>{item}</span></li>
                ))}
              </ul>
            </section>

            <section id="action-steps" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-white">Action steps</h2>
              <ol className="mt-4 space-y-3 text-base leading-8 text-slate-200 list-decimal pl-5">
                {report.actionSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>

            <section id="risks" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-white">Risks and failure modes</h2>
              <ul className="mt-4 space-y-3 text-base leading-8 text-slate-200">
                {report.risks.map((item) => (
                  <li key={item} className="flex gap-3"><span className="mt-1 text-rose-300">●</span><span>{item}</span></li>
                ))}
              </ul>
            </section>

            <section id="deliverables" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-white">Deliverables</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {report.deliverables.map((item) => (
                  <div key={item.title} className={`rounded-2xl border ${c.border} bg-black/20 p-5`}>
                    <div className="text-2xl">{item.icon}</div>
                    <h3 className="mt-3 font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="sample-sections" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-white">Sample sections</h2>
              <div className="mt-6 space-y-8">
                {report.excerpt.map((section) => (
                  <article key={section.heading} className={`border-l-2 ${c.text.replace('text-', 'border-')} pl-6`}>
                    <h3 className={`text-xl font-bold ${c.text}`}>{section.heading}</h3>
                    <div className="mt-4 space-y-4 text-base leading-8 text-slate-200">
                      {section.body.split('\n\n').map((para, index) => (
                        <p key={index}>{para}</p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section id="citations" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-white">Evidence and citations</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {report.citations.map((citation) => (
                  <a
                    key={`${citation.label}-${citation.url}`}
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-white/20"
                  >
                    <div className="text-sm font-semibold text-white">{citation.label}</div>
                    <div className="mt-2 break-all text-sm text-sky-300">{citation.url}</div>
                    <div className="mt-2 text-xs text-slate-500">Accessed {citation.accessedAt}</div>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
