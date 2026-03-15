/**
 * GET /api/a2a/trust/domains — List all trust domains (built-in + custom)
 * POST /api/a2a/trust/domains — Register a custom trust domain
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  TRUST_DOMAINS,
  HIGH_STAKES_DOMAINS,
  DEFAULT_THRESHOLDS,
  HIGH_STAKES_THRESHOLDS,
  registerCustomDomain,
  listCustomDomains,
  customDomainSchema,
} from '@/lib/a2a/trust';

export async function GET() {
  const builtIn = TRUST_DOMAINS.map(d => ({
    key: d,
    label: d.replace(/_/g, ' '),
    built_in: true,
    high_stakes: HIGH_STAKES_DOMAINS.includes(d),
    thresholds: HIGH_STAKES_DOMAINS.includes(d) ? HIGH_STAKES_THRESHOLDS : DEFAULT_THRESHOLDS,
  }));

  const custom = listCustomDomains().map(d => ({
    key: d.key,
    label: d.label,
    built_in: false,
    high_stakes: d.high_stakes,
    description: d.description,
  }));

  return NextResponse.json({ domains: [...builtIn, ...custom] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = customDomainSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid custom domain', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = registerCustomDomain(parsed.data.label, {
    description: parsed.data.description,
    high_stakes: parsed.data.high_stakes,
    thresholds: parsed.data.custom_thresholds as any,
  });

  return NextResponse.json(result, { status: 201 });
}
