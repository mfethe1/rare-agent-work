import React from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getReport, getAllReports } from '@/lib/reports';
import ReportChat from '@/components/ReportChat';
import PrintButton from '@/components/PrintButton';
import BuyButton from '@/components/BuyButton';
import StickyBuyBar from '@/components/StickyBuyBar';
import Link from 'next/link';
import ConversionTracker from '@/components/ConversionTracker';
import { ReportJsonLd, BreadcrumbJsonLd } from '@/components/JsonLd';
import SiteNav from '@/components/SiteNav';

export function generateStaticParams() {
  return getAllReports().map((r) => ({ slug: r.slug }));
}

// Allow new reports added after build time to render dynamically (never 404)
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getReport(slug);
  if (!report) return {};
  const url = `https://rareagent.work/reports/${slug}`;
  return {
    title: `${report.title} — ${report.price}`,
    description: `${report.subtitle}. ${report.valueprop}`,
    keywords: [
      report.title,
      'AI agent report',
      'operator playbook',
      ...report.deliverables.map((d) => d.title),
    ],
    alternates: { canonical: url },
    openGraph: {
      title: `${report.title} — ${report.price}`,
      description: `${report.subtitle}. ${report.valueprop}`,
      url,
      siteName: 'Rare Agent Work',
      type: 'article',
      locale: 'en_US',
      images: ['/og-image.png'],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${report.title} — ${report.price}`,
      description: report.subtitle,
      images: ['/og-image.png'],
    },
  };
}

/** Format ISO date string or YYYY-MM-DD into a readable form */
function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return raw;
  }
}

/**
 * Render a text string with inline **bold** markdown support.
 * Handles: **bold text**, and passes through plain text unchanged.
 * Used in excerpt section rendering.
 */
function renderInlineBold(text: string, accentClass: string): React.ReactNode {
  // Split on **...** markers
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, j) =>
        j % 2 === 1
          ? <strong key={j} className={`font-semibold text-white`}>{part}</strong>
          : part,
      )}
    </>
  );
}

/**
 * Render a paragraph from an excerpt body with rich visual hierarchy.
 * Handles:
 *   - **N. Title** — desc  → numbered callout with accent bar + number badge
 *   - N. plain text        → numbered callout with badge
 *   - **bold**             → standalone section sub-header
 *   - **Bold term** text   → lead-bold callout with left accent bar
 *   - plain paragraph      → prose with inline bold support
 */
function ExcerptBody({ body, colorClass, borderClass }: { body: string; colorClass: string; borderClass: string }) {
  const paragraphs = body.split('\n\n').filter(p => p.trim().length > 0);

  return (
    <div className="space-y-4 text-sm leading-7 text-slate-300">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();

        // Numbered list item: starts with digit + dot (no bold lead)
        // e.g. "1. plain text" or "1. text with **bold** inside"
        // Must check BEFORE leadBoldMatch since "1. **text**" would otherwise match leadBoldMatch.
        const numberedMatch = trimmed.match(/^(\d+\.)(\s+)(.+)$/);
        if (numberedMatch) {
          const num = numberedMatch[1];
          const rest = numberedMatch[3];
          return (
            <div key={i} className={`flex gap-3 rounded-xl border ${borderClass} bg-black/20 px-4 py-3.5`}>
              <span className={`shrink-0 font-mono text-xs font-black mt-0.5 ${colorClass}`}>{num}</span>
              <span className="leading-6">{renderInlineBold(rest, colorClass)}</span>
            </div>
          );
        }

        // Standalone bold line — a paragraph that is ONLY bold text, used as section sub-header
        // e.g. "**Phase 1: Detection**"
        const standaloneBoldMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*$/);
        if (standaloneBoldMatch) {
          return (
            <p key={i} className={`mt-5 mb-0.5 text-[11px] font-bold uppercase tracking-[0.2em] ${colorClass}`}>
              {standaloneBoldMatch[1]}
            </p>
          );
        }

        // Paragraph that STARTS with **Bold term** — possibly a numbered checklist item
        const leadBoldMatch = trimmed.match(/^\*\*([^*]+)\*\*(.+)$/s);
        if (leadBoldMatch) {
          const boldTerm = leadBoldMatch[1];
          const rest = leadBoldMatch[2];
          // Detect if bold term starts with a number (e.g. "1. Source review" or "12. Eval coverage")
          const numericLead = boldTerm.match(/^(\d+)\.\s+(.+)$/);
          if (numericLead) {
            return (
              <div key={i} className={`flex gap-3 rounded-xl border ${borderClass} bg-black/20 px-4 py-3.5`}>
                <span className={`shrink-0 rounded-md border ${borderClass} bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-black leading-none mt-0.5 ${colorClass}`}>
                  {numericLead[1]}
                </span>
                <span>
                  <strong className="font-semibold text-white">{numericLead[2]}</strong>
                  {renderInlineBold(rest, colorClass)}
                </span>
              </div>
            );
          }
          // Non-numbered lead-bold: render as left accent bar callout with improved spacing
          return (
            <div key={i} className={`border-l-2 ${borderClass} pl-4 py-1`}>
              <p className="leading-6">
                <strong className="font-semibold text-white">{boldTerm}</strong>
                {renderInlineBold(rest, colorClass)}
              </p>
            </div>
          );
        }

        // Plain paragraph
        return <p key={i} className="leading-7">{renderInlineBold(trimmed, colorClass)}</p>;
      })}
    </div>
  );
}


const colorMap: Record<string, {
  border: string;
  text: string;
  badge: string;
  btn: string;
  btnHero: string;
  surface: string;
  glow: string;
  dot: string;
}> = {
  blue: {
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'bg-blue-900/50 border-blue-500/40 text-blue-200',
    btn: 'bg-blue-600 hover:bg-blue-500 text-white',
    btnHero: 'bg-blue-500 hover:bg-blue-400 shadow-[0_12px_40px_rgba(59,130,246,0.3)]',
    surface: 'from-blue-950/60 via-slate-950/80 to-slate-950',
    glow: 'rgba(59,130,246,0.12)',
    dot: 'bg-blue-400',
  },
  green: {
    border: 'border-green-500/30',
    text: 'text-green-400',
    badge: 'bg-green-900/50 border-green-500/40 text-green-200',
    btn: 'bg-green-600 hover:bg-green-500 text-white',
    btnHero: 'bg-green-500 hover:bg-green-400 shadow-[0_12px_40px_rgba(34,197,94,0.3)]',
    surface: 'from-green-950/50 via-slate-950/80 to-slate-950',
    glow: 'rgba(34,197,94,0.10)',
    dot: 'bg-green-400',
  },
  purple: {
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    badge: 'bg-purple-900/50 border-purple-500/40 text-purple-200',
    btn: 'bg-purple-600 hover:bg-purple-500 text-white',
    btnHero: 'bg-purple-500 hover:bg-purple-400 shadow-[0_12px_40px_rgba(168,85,247,0.3)]',
    surface: 'from-purple-950/50 via-slate-950/80 to-slate-950',
    glow: 'rgba(168,85,247,0.10)',
    dot: 'bg-purple-400',
  },
  red: {
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-900/50 border-red-500/40 text-red-200',
    btn: 'bg-red-600 hover:bg-red-500 text-white',
    btnHero: 'bg-red-500 hover:bg-red-400 shadow-[0_12px_40px_rgba(239,68,68,0.3)]',
    surface: 'from-red-950/50 via-slate-950/80 to-slate-950',
    glow: 'rgba(239,68,68,0.10)',
    dot: 'bg-red-400',
  },
  amber: {
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-900/50 border-amber-500/40 text-amber-200',
    btn: 'bg-amber-600 hover:bg-amber-500 text-white',
    btnHero: 'bg-amber-500 hover:bg-amber-400 shadow-[0_12px_40px_rgba(245,158,11,0.3)]',
    surface: 'from-amber-950/50 via-slate-950/80 to-slate-950',
    glow: 'rgba(245,158,11,0.10)',
    dot: 'bg-amber-400',
  },
};

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getReport(slug);
  if (!report) notFound();

  const c = colorMap[report.color] ?? colorMap.blue;
  const reportValue = Number(report.price.replace(/[^0-9.]/g, '')) || 0;
  const formattedDate = formatDate(report.updatedAt);

  return (
    <div className="min-h-screen bg-[#020617] text-gray-100 font-sans print:bg-white print:text-black">
      <ReportJsonLd
        title={report.title}
        description={report.subtitle}
        slug={report.slug}
        price={report.price}
        author={report.author}
        dateModified={report.updatedAt}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://rareagent.work' },
          { name: 'Reports', url: 'https://rareagent.work/reports' },
          { name: report.title, url: `https://rareagent.work/reports/${report.slug}` },
        ]}
      />
      <ConversionTracker kind="report" plan={report.planKey} value={reportValue} slug={report.slug} />

      {/* Sticky buy bar — appears after scrolling past hero CTA */}
      <StickyBuyBar
        title={report.title}
        price={report.price}
        planKey={report.planKey}
        color={report.color}
        sentinelId="hero-buy-sentinel"
      />

      {/* ── Nav ───────────────────────────────────────────────── */}
      <div className="print:hidden">
        <SiteNav
          variant="darker"
          primaryCta={{ label: `Get access — ${report.price}`, href: '#guide' }}
        />
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">

        {/* ── HERO: Report identity + primary purchase decision ─────── */}
        <section className="mb-10">

          {/* Letterhead strip */}
          <div className="mb-5 flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/15 bg-white/5 shrink-0">
              <Image src="/logo-medallion.jpg" alt="Rare Agent Work" fill className="object-cover" sizes="36px" priority />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Rare Agent Work · {report.edition}
              </p>
              <p className="text-[11px] text-slate-500">{report.revision} · Updated {formattedDate}</p>
            </div>
            {report.isNew && (
              <span className="ml-auto rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                New
              </span>
            )}
          </div>

          {/* Main hero card */}
          <div className={`overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br ${c.surface}`}
            style={{ boxShadow: `0 0 80px ${c.glow}` }}>

            <div className="p-6 sm:p-8 lg:p-10">
              {/* Price badge + audience */}
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${c.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                  {report.price} · {report.priceLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {report.readingTime}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                  {report.audience}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-[3.25rem] md:leading-[1.1]">
                {report.title}
              </h1>
              <p className={`mt-3 text-xl font-medium ${c.text}`}>{report.subtitle}</p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{report.valueprop}</p>

              {/* === WHAT YOU WALK AWAY WITH — sharp takeaways, no summary stack === */}
              <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
                <p className={`mb-3 text-[10px] font-bold uppercase tracking-[0.22em] ${c.text}`}>What this report gives you</p>
                <ul className="space-y-2.5">
                  {report.keyTakeaways.map((kt, idx) => (
                    <li key={kt} className="flex items-start gap-2.5 text-sm leading-6 text-slate-200">
                      <span className={`mt-0.5 shrink-0 font-mono text-[10px] font-black ${c.text}`}>{String(idx + 1).padStart(2, '0')}</span>
                      {kt}
                    </li>
                  ))}
                </ul>
              </div>

              {/* === SHARPEST INSIGHT — the one finding given away free === */}
              {report.sharpestInsight && (
                <div className={`mt-4 rounded-xl border-l-4 ${c.border} bg-black/30 p-5`}>
                  <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.22em] ${c.text}`}>
                    The finding that makes this worth buying — free
                  </p>
                  <p className="text-sm leading-7 text-slate-200 italic">&ldquo;{report.sharpestInsight}&rdquo;</p>
                </div>
              )}
              {/* Primary CTA block — the sentinel for StickyBuyBar lives right below this */}
              <div className="mt-7 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <BuyButton
                    label={`Get full access — ${report.price}`}
                    plan={report.planKey}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-full ${c.btnHero} px-8 py-4 text-base font-bold text-white transition-all sm:w-auto`}
                  />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs text-slate-400">✓ One-time purchase · Instant access · No subscription</p>
                    <p className="text-xs text-slate-500">Every locked section below opens immediately after checkout</p>
                  </div>
                </div>
                {/* Purchase confidence strip */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <svg className="h-3 w-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                    Full report delivered immediately
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <svg className="h-3 w-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                    AI implementation guide included
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <svg className="h-3 w-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                    Yours forever — no expiry
                  </span>
                </div>
              </div>
            </div>

            {/* Trust bar — strengthened with social proof */}
            <div className="border-t border-white/8 bg-black/20 px-6 py-3.5 sm:px-8">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {[
                  { label: 'Full preview before purchase', icon: '✓' },
                  { label: 'Cited sources', icon: '✓' },
                  { label: `Updated ${formattedDate}`, icon: '✓' },
                  { label: 'Human-authored', icon: '✓' },
                  { label: 'Secure Stripe checkout', icon: '🔒' },
                ].map((item) => (
                  <span key={item.label} className="text-[11px] font-medium text-slate-400">
                    <span className="mr-1 text-emerald-400">{item.icon}</span>{item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Sentinel: sticky bar watches this element — placed after hero CTA */}
        <div id="hero-buy-sentinel" />

        {/* ── Implications / Action steps / Risks ──────────────────── */}
        <section className="mb-10 grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Implications</h2>
            <ul className="space-y-3">
              {report.implications.map((implication) => (
                <li key={implication} className="flex gap-3 text-sm leading-6 text-slate-300">
                  <span className="mt-1 shrink-0 text-cyan-400">●</span>
                  <span>{implication}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Action Steps</h2>
            <ul className="space-y-3">
              {report.actionSteps.map((step) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-slate-300">
                  <span className={`mt-1 shrink-0 ${c.text}`}>●</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Risks & Failure Modes</h2>
            <ul className="space-y-3">
              {report.risks.map((risk) => (
                <li key={risk} className="flex gap-3 text-sm leading-6 text-slate-300">
                  <span className="mt-1 shrink-0 text-rose-400">●</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── WHO THIS IS NOT FOR ────────────────────────────────── */}
        {report.notForAudience && report.notForAudience.length > 0 && (
          <section className="mb-10">
            <div className="rounded-2xl border border-white/8 bg-white/[0.015] p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="text-base">✋</span>
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Who this report is NOT for</h2>
              </div>
              <ul className="space-y-2.5">
                {report.notForAudience.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-slate-500">
                    <span className="mt-0.5 shrink-0 text-slate-600">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-600 italic">
                Honest disqualification. If none of the above matches you, this report was written for you.
              </p>
            </div>
          </section>
        )}

        {/* ── What's inside ──────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white">What&apos;s Inside</h2>
            <span className="text-xs text-slate-500">{report.deliverables.length} deliverables</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.deliverables.map((d) => (
              <div key={d.title} className={`rounded-2xl border ${c.border} bg-white/[0.025] p-5`}>
                <div className="mb-3 text-2xl">{d.icon}</div>
                <h3 className="mb-1.5 text-sm font-bold text-white">{d.title}</h3>
                <p className="text-xs leading-5 text-slate-400">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Sample content (the preview that sells) ──────────────── */}
        <section className="mb-10">
          {/* Section navigator / TOC */}
          {report.excerpt.length >= 3 && (
            <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Preview Content</h2>
                <span className={`rounded-full border ${c.border} px-3 py-1 text-xs font-semibold ${c.text}`}>
                  {Math.min(2, report.excerpt.length)} of {report.excerpt.length} sections free
                </span>
              </div>
              <p className="mb-4 text-sm text-slate-400">
                Sections 1–2 are fully unlocked. The rest unlock after purchase.
              </p>
              <nav className="grid gap-2 sm:grid-cols-2">
                {report.excerpt.map((section, idx) => {
                  const isLockedNav = idx >= 2;
                  const hook = report.excerptHooks?.[idx];
                  return (
                    <a
                      key={section.heading}
                      href={`#excerpt-${idx}`}
                      className={`flex flex-col gap-1 rounded-xl border px-3 py-3 text-xs font-medium transition-all ${ !isLockedNav ? `border-white/8 bg-black/20 text-slate-300 hover:border-white/20 hover:text-white` : `border-white/5 bg-black/10 text-slate-600 hover:border-white/10 hover:text-slate-500` }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 font-mono text-[10px] font-black ${ !isLockedNav ? c.text : 'text-slate-700' }`}>{String(idx + 1).padStart(2, '0')}</span>
                        <span className="line-clamp-1 leading-5">{section.heading}</span>
                        {isLockedNav && <span className="ml-auto shrink-0 text-[9px] text-slate-700">🔒</span>}
                      </div>
                      {isLockedNav && hook && (
                        <p className="line-clamp-2 text-[10px] leading-4 text-slate-700 italic">{hook}</p>
                      )}
                    </a>
                  );
                })}
              </nav>
            </div>
          )}
          {report.excerpt.length < 3 && (
            <div className="mb-6 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div>
                <h2 className="text-xl font-bold text-white">Preview Content</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Real content from the report. Read it to judge fit before buying.
                </p>
              </div>
            </div>
          )}
          <div className="space-y-10">
            {report.excerpt.map((section, idx) => {
              const isLocked = idx >= 2;
              return (
              <div
                id={`excerpt-${idx}`}
                key={section.heading}
                className={`scroll-mt-20 rounded-2xl border ${ isLocked ? 'border-white/8 opacity-80' : c.border } bg-white/[0.02] ${ isLocked ? '' : 'p-6 sm:p-8' }`}
              >
                {/* Locked section header banner */}
                {isLocked && (
                  <div className="p-6">
                    <div className="mb-4 flex items-start gap-3">
                      <span className={`shrink-0 rounded-lg border border-white/8 bg-black/40 px-2.5 py-1 font-mono text-xs font-black text-slate-600`}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h3 className="text-base font-bold leading-snug text-slate-400">{section.heading}</h3>
                        {/* Hook: 1-line teaser that creates desire */}
                        {report.excerptHooks && report.excerptHooks[idx] && (
                          <p className={`mt-2 text-sm leading-6 ${c.text} opacity-80`}>
                            {report.excerptHooks[idx]}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-600">This section unlocks with purchase.</p>
                      <BuyButton
                        label={`Unlock — ${report.price}`}
                        plan={report.planKey}
                        className={`inline-flex shrink-0 items-center justify-center rounded-full ${c.btnHero} px-5 py-2 text-xs font-bold text-white transition-all`}
                      />
                    </div>
                  </div>
                )}
                {/* Open section header */}
                {!isLocked && (
                  <div className="mb-5 flex items-start gap-3">
                    <span className={`shrink-0 rounded-lg border ${c.border} bg-black/30 px-2.5 py-1 font-mono text-xs font-black ${c.text}`}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-lg font-bold leading-snug text-white">{section.heading}</h3>
                  </div>
                )}
                {/* Content: full for open sections, hook+CTA for locked */}
                {!isLocked && (
                  <>
                    <ExcerptBody body={section.body} colorClass={c.text} borderClass={c.border} />
                    {/* Inline micro-CTA after last open section */}
                    {idx === 1 && report.excerpt.length > 2 && (
                      <div className={`mt-6 flex flex-col gap-3 rounded-2xl border ${c.border} bg-black/30 p-5 sm:flex-row sm:items-center sm:justify-between`}>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>
                            {report.excerpt.length - 2} more section{report.excerpt.length - 2 !== 1 ? 's' : ''} in this report
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            The preview shows the depth. The full report is the tool you implement from.
                          </p>
                        </div>
                        <BuyButton
                          label={`Get full access — ${report.price}`}
                          plan={report.planKey}
                          className={`inline-flex shrink-0 items-center justify-center rounded-full ${c.btnHero} px-6 py-2.5 text-sm font-bold text-white transition-all`}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              );
            })}
          </div>
        </section>


        {/* ── Mid-page conversion CTA ───────────────────────────────── */}
        <section className="mb-10">
          <div className={`rounded-2xl border ${c.border} bg-gradient-to-br ${c.surface} p-7 text-center`}
            style={{ boxShadow: `0 0 60px ${c.glow}` }}>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${c.text}`}>You&apos;ve seen the writing quality and depth</p>
            <h2 className="mt-2 text-2xl font-bold text-white">The remaining {report.excerpt.length - 2} section{report.excerpt.length - 2 !== 1 ? 's' : ''} contain the implementation detail.</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
              The preview is the argument. The full report is the tool.
              One-time purchase — delivered immediately, no subscription, no expiry.
            </p>
            <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <BuyButton
                label={`Get full access — ${report.price}`}
                plan={report.planKey}
                className={`inline-flex items-center justify-center rounded-full ${c.btnHero} px-8 py-4 text-base font-bold text-white transition-all`}
              />
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.05] px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Compare plans →
              </Link>
            </div>
            <p className="mt-3 text-xs text-slate-500">Best for: {report.bestFor.join(' · ')}</p>
          </div>
        </section>

        {/* ── Evidence and citations ────────────────────────────────── */}
        <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Evidence &amp; Citations</h2>
              <p className="mt-1 text-sm text-slate-400">
                Every claim in this report traces to a verifiable source.
              </p>
            </div>
            <p className="shrink-0 text-xs text-slate-500">Last reviewed {formattedDate}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {report.citations.map((citation) => (
              <a
                key={`${citation.label}-${citation.url}`}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/10 bg-black/25 p-4 transition-colors hover:border-white/20 group"
              >
                <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">{citation.label}</div>
                <div className="mt-1.5 break-all text-xs text-sky-400">{citation.url}</div>
                <div className="mt-2 text-xs text-slate-500">Accessed {formatDate(citation.accessedAt)}</div>
              </a>
            ))}
          </div>
        </section>

        {/* ── Methodology + proof points ────────────────────────────── */}
        <section className="mb-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-bold text-white">Methodology</h2>
            <p className="mb-4 text-sm leading-6 text-slate-400">
              Who wrote this, what evidence shaped it, and how the recommendations are framed.
            </p>
            <ul className="space-y-3">
              {report.methodology.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-300">
                  <span className={`mt-1 shrink-0 ${c.text}`}>●</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-white/8 pt-4">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-400">Author:</span> {report.author} · {report.attribution}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            <h2 className="mb-4 text-xl font-bold text-white">Why This Report Earns Attention</h2>
            <div className="space-y-3">
              {report.proofPoints.map((item, index) => (
                <div key={item} className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Proof {index + 1}
                  </p>
                  <p className="text-sm leading-6 text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AI Implementation Guide ───────────────────────────────── */}
        <section className="mb-10 print:hidden" id="guide">
          <div className={`rounded-2xl border ${c.border} bg-white/[0.02] p-6 sm:p-8`}>
            <div className="mb-4 flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)] animate-pulse" />
              <h2 className="text-xl font-bold text-white">Ask the Implementation Guide</h2>
            </div>
            <p className="mb-6 text-sm leading-6 text-slate-400">
              Powered by Claude — trained on this report&apos;s content. Your first question is free.
            </p>
            <ReportChat reportSlug={report.slug} placeholder={report.chatPlaceholder} />
          </div>
        </section>

        {/* ── Consulting upsell ─────────────────────────────────────── */}
        <section className="mb-10 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.05] p-6 sm:p-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">When the report isn&apos;t enough</p>
              <h2 className="mt-2 text-xl font-bold text-white">Bring a real problem for direct human review.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Architecture review, implementation rescue, and strategy calls for teams with real blockers.
                Every intake is read by a human before any next step.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:shrink-0 lg:flex-col">
              <Link href="/assessment" className="inline-flex rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 transition-colors">
                Start an Assessment
              </Link>
              <Link href="/book-demo" className="inline-flex rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                Book a Strategy Call
              </Link>
            </div>
          </div>
        </section>

        {/* ── Related reports ───────────────────────────────────────── */}
        <section className="border-t border-white/8 pt-10 print:hidden">
          <h2 className="mb-5 text-lg font-bold text-white">Also from Rare Agent Work</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {getAllReports()
              .filter((r) => r.slug !== report.slug)
              .slice(0, 2)
              .map((r) => {
                const rc = colorMap[r.color] ?? colorMap.blue;
                return (
                  <Link
                    key={r.slug}
                    href={`/reports/${r.slug}`}
                    className="group rounded-xl border border-white/10 bg-white/[0.025] p-5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
                  >
                    <p className={`mb-1.5 text-xs font-bold ${rc.text}`}>{r.price} · {r.priceLabel}</p>
                    <h3 className="text-sm font-semibold leading-tight text-white group-hover:text-slate-200 transition-colors">{r.title}</h3>
                    <p className="mt-1.5 text-xs text-slate-500">{r.subtitle}</p>
                  </Link>
                );
              })}
            <Link
              href="/pricing"
              className="group flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] p-5 text-center transition-all hover:border-cyan-400/30 hover:bg-white/[0.04]"
            >
              <p className="text-2xl font-black text-cyan-400">∞</p>
              <p className="mt-1.5 text-sm font-semibold text-white">Operator Access</p>
              <p className="mt-1 text-xs text-slate-500">$49/mo · Full catalog + updates</p>
            </Link>
          </div>
        </section>

      </main>

      <footer className="mt-12 border-t border-white/8 py-8 text-center text-xs text-slate-600 print:hidden">
        <p>
          © {new Date().getFullYear()} Rare Agent Work ·{' '}
          <Link href="/" className="hover:text-slate-400 transition-colors">Home</Link>
          {' · '}
          <Link href="/reports" className="hover:text-slate-400 transition-colors">Reports</Link>
          {' · '}
          <Link href="/methodology" className="hover:text-slate-400 transition-colors">Methodology</Link>
        </p>
      </footer>
    </div>
  );
}
