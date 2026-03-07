import { NextResponse } from 'next/server';
import { getAllReports } from '@/lib/reports';

export const revalidate = 3600;

export async function GET() {
  const reports = getAllReports().map(r => ({
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    price: r.price,
    priceLabel: r.priceLabel,
    audience: r.audience,
    valueprop: r.valueprop,
    url: `https://rareagent.work/reports/${r.slug}`,
    deliverables: r.deliverables,
    color: r.color,
  }));

  return NextResponse.json(
    { reports },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
