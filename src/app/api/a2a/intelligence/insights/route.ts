import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  extractInsights,
  listInsights,
  shareInsight,
  ExtractInsightsSchema,
  ShareInsightSchema,
} from '@/lib/a2a/intelligence';

/**
 * POST /api/a2a/intelligence/insights — Extract insights from outcome data
 * or share an existing insight with the ecosystem
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Share an existing insight
    const shareResult = ShareInsightSchema.safeParse(body);
    if (shareResult.success) {
      const insight = shareInsight(shareResult.data.insightId);
      if (!insight) {
        return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
      }
      return NextResponse.json({ insight, shared: true });
    }

    // Extract new insights
    const extractResult = ExtractInsightsSchema.safeParse(body);
    if (!extractResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: extractResult.error.flatten() }, { status: 422 });
    }

    const { agentId, capability, minSampleSize } = extractResult.data;
    const insights = extractInsights(capability, agentId, minSampleSize);
    return NextResponse.json({ insights, count: insights.length }, { status: 201 });
  } catch (err) {
    console.error('POST /api/a2a/intelligence/insights error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/intelligence/insights?capability=...&visibility=...
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing agent API key.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const capability = searchParams.get('capability') ?? undefined;
    const visibility = searchParams.get('visibility') as 'private' | 'shared' | undefined;
    const insights = listInsights(capability, visibility);
    return NextResponse.json({ insights });
  } catch (err) {
    console.error('GET /api/a2a/intelligence/insights error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
