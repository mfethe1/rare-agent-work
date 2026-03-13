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
    author: report.author,
    attribution: report.attribution,
    url: `https://rareagent.work/reports/${report.slug}`,
    best_for: report.bestFor,
    methodology: report.methodology,
    proof_points: report.proofPoints,
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
      name: 'Operator Access',
      price: '$49/mo',
      includes: 'Full report library, rolling updates, and higher AI guide limits for repeat-use buyers.',
      url: 'https://rareagent.work/pricing',
    },
    provenance: {
      authored_by: 'Michael Fethe',
      methodology_url: 'https://rareagent.work/trust',
      pricing_url: 'https://rareagent.work/pricing',
      docs_url: 'https://rareagent.work/docs',
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
