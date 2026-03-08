import { NextResponse } from 'next/server';
import { getAllReports } from '@/lib/reports';

export async function GET() {
  const reports = getAllReports();

  const data = reports.map(report => ({
    slug: report.slug,
    title: report.title,
    subtitle: report.subtitle,
    price: report.price,
    price_type: report.priceLabel,
    audience: report.audience,
    value_proposition: report.valueprop,
    url: `https://rareagent.work/reports/${report.slug}`,
    deliverables: report.deliverables.map(d => ({
      title: d.title,
      description: d.desc,
    })),
    preview_sections: report.excerpt.map(e => ({
      heading: e.heading,
      body: e.body,
    })),
  }));

  return NextResponse.json({
    data,
    count: data.length,
    subscription: {
      name: 'All Access — Starter Plan',
      price: '$29/mo',
      includes: 'All current reports + every future report, content updated every 3 days, AI implementation guide (50k tokens/mo)',
      url: 'https://rareagent.work/pricing',
    },
    updated_at: new Date().toISOString(),
    source: 'https://rareagent.work',
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
