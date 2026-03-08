import { notFound } from 'next/navigation';
import { getReport, getAllReports } from '@/lib/reports';
import ReportChat from '@/components/ReportChat';
import PrintButton from '@/components/PrintButton';
import BuyButton from '@/components/BuyButton';
import Link from 'next/link';
import ConversionTracker from '@/components/ConversionTracker';
import { ReportJsonLd, BreadcrumbJsonLd } from '@/components/JsonLd';

export function generateStaticParams() {
  return getAllReports().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getReport(slug);
  if (!report) return {};
  const url = `https://rareagent.work/reports/${slug}`;
  return {
    title: report.title,
    description: `${report.subtitle}. ${report.valueprop}`,
    keywords: [
      report.title,
      "AI agent report",
      "operator playbook",
      ...report.deliverables.map((d) => d.title),
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${report.title} — ${report.price}`,
      description: `${report.subtitle}. ${report.valueprop}`,
      url,
      siteName: "Rare Agent Work",
      type: "article",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image" as const,
      title: report.title,
      description: report.subtitle,
      images: ["/og-image.png"],
    },
  };
}

const colorMap: Record<string, { border: string; text: string; badge: string; btn: string }> = {
  blue:   { border: 'border-blue-500/30',   text: 'text-blue-400',   badge: 'bg-blue-900/50 border-blue-500/40 text-blue-300',   btn: 'bg-blue-600 hover:bg-blue-700' },
  green:  { border: 'border-green-500/30',  text: 'text-green-400',  badge: 'bg-green-900/50 border-green-500/40 text-green-300',  btn: 'bg-green-600 hover:bg-green-700' },
  purple: { border: 'border-purple-500/30', text: 'text-purple-400', badge: 'bg-purple-900/50 border-purple-500/40 text-purple-300', btn: 'bg-purple-600 hover:bg-purple-700' },
};

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getReport(slug);
  if (!report) notFound();

  const c = colorMap[report.color] ?? colorMap.blue;
  const reportValue = Number(report.price.replace(/[^0-9.]/g, "")) || 0;

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans print:bg-white print:text-black">
      <ReportJsonLd
        title={report.title}
        description={report.subtitle}
        slug={report.slug}
        price={report.price}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://rareagent.work" },
          { name: "Reports", url: "https://rareagent.work/reports" },
          { name: report.title, url: `https://rareagent.work/reports/${report.slug}` },
        ]}
      />

      {/* Nav */}
      <nav className="border-b border-gray-800 no-print print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-white font-bold tracking-tighter">← Rare Agent Work</Link>
          <div className="flex items-center gap-3">
            <PrintButton />
            <a href="/reports" className="bg-white text-black px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-200 transition-colors">
              All Reports
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <ConversionTracker kind="report" plan={report.planKey} value={reportValue} slug={report.slug} />

        {/* Hero */}
        <div className="mb-12">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${c.badge}`}>
              {report.price} {report.priceLabel}
            </span>
            <span className="text-xs text-gray-500 border border-gray-800 px-3 py-1 rounded-full">
              {report.audience}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            {report.title}
          </h1>
          <p className={`text-xl ${c.text} font-medium mb-3`}>{report.subtitle}</p>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">{report.valueprop}</p>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-6 no-print">
            <PrintButton />
            <BuyButton label={`Buy Full Report — ${report.price}`} plan={report.planKey} className={`${c.btn} text-white px-5 py-3 rounded-lg text-sm font-semibold transition-colors`} />
          </div>
        </div>

        {/* What You Get */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">What&apos;s Inside</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.deliverables.map((d) => (
              <div key={d.title} className={`border ${c.border} rounded-xl p-5 bg-gray-900/40`}>
                <div className="text-2xl mb-2">{d.icon}</div>
                <h3 className="font-semibold text-white mb-1">{d.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sample Content */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-2">Sample Content</h2>
          <p className="text-gray-500 text-sm mb-6">A preview of the writing quality and depth you get in this report.</p>
          <div className="space-y-8">
            {report.excerpt.map((section) => (
              <div key={section.heading} className={`border-l-2 ${c.text.replace('text-', 'border-')} pl-6`}>
                <h3 className={`text-lg font-bold ${c.text} mb-4`}>{section.heading}</h3>
                <div className="text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none">
                  {section.body.split('\n\n').map((para, i) => {
                    if (para.startsWith('**') && para.includes('**')) {
                      const parts = para.split(/\*\*(.*?)\*\*/g);
                      return (
                        <p key={i} className="mb-4">
                          {parts.map((part, j) =>
                            j % 2 === 1 ? <strong key={j} className="text-white">{part}</strong> : part
                          )}
                        </p>
                      );
                    }
                    return <p key={i} className="mb-4">{para}</p>;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className={`mt-8 border ${c.border} rounded-xl p-6 bg-gray-900/30 text-center`}>
            <p className="text-gray-300 mb-3">This is ~15% of the full report content.</p>
            <a href="/reports" className={`inline-block ${c.btn} text-white px-6 py-3 rounded-lg font-semibold text-sm transition-colors`}>
              Get the Full Report — {report.price}
            </a>
          </div>
        </section>

        {/* AI Assistant */}
        <section className="mb-14 no-print" id="guide">
          <div className={`border ${c.border} rounded-2xl p-6 md:p-8 bg-gray-900/40`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full bg-green-400 animate-pulse`} />
              <h2 className="text-xl font-bold text-white">Ask the Implementation Guide</h2>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Powered by Claude Sonnet 4.6 — knows this report and can help you implement it.
              5 free questions, then upgrade for unlimited access.
            </p>
            <ReportChat reportSlug={report.slug} placeholder={report.chatPlaceholder} />
          </div>
        </section>

        {/* Other Reports */}
        <section className="border-t border-gray-800 pt-12 no-print">
          <h2 className="text-xl font-bold text-white mb-6">Also from Rare Agent Work</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {getAllReports().filter(r => r.slug !== report.slug).map((r) => {
              const rc = colorMap[r.color] ?? colorMap.blue;
              return (
                <Link key={r.slug} href={`/reports/${r.slug}`}
                  className="border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors group">
                  <p className={`text-xs font-bold ${rc.text} mb-2`}>{r.price}</p>
                  <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors text-sm leading-tight mb-2">{r.title}</h3>
                  <p className="text-gray-500 text-xs">{r.subtitle}</p>
                </Link>
              );
            })}
            <a href="/reports"
              className="border border-gray-800 hover:border-blue-500/50 rounded-xl p-5 transition-colors group flex flex-col justify-center items-center text-center">
              <p className="text-2xl mb-2">∞</p>
              <p className="font-semibold text-white text-sm mb-1">Operator Access</p>
              <p className="text-gray-500 text-xs">$49/mo — full report catalog + rolling updates</p>
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-800 py-8 text-center text-gray-600 text-sm no-print">
        <p>© {new Date().getFullYear()} Rare Agent Work · <a href="/" className="hover:text-gray-400">Home</a></p>
      </footer>

    </div>
  );
}
