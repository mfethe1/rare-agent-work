/**
 * GET /api/a2a/adversarial-resilience/threat-intelligence — Get threat signatures & network health
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getThreatIntelligence,
  getThreatIntelligenceSchema,
} from '@/lib/a2a/adversarial-resilience';
import type { ThreatCategory, ThreatSeverity } from '@/lib/a2a/adversarial-resilience';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') as ThreatCategory | null;
    const min_severity = url.searchParams.get('min_severity') as ThreatSeverity | null;
    const active_only = url.searchParams.get('active_only') !== 'false';

    const result = getThreatIntelligence({
      category: category ?? undefined,
      min_severity: min_severity ?? undefined,
      active_only,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
