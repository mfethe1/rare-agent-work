/**
 * POST /api/a2a/correlations/:id/links — Record a causal link between events
 *
 * When one event causes or triggers another, agents record that causal
 * relationship here. This builds the directed acyclic graph that powers
 * the causal graph and timeline endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { linkEvents, linkEventsBatch, CausalRelationship } from '@/lib/a2a/events/correlation';

const VALID_RELATIONSHIPS: CausalRelationship[] = [
  'caused', 'triggered', 'compensated', 'continued', 'branched', 'merged',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: correlation_id } = await params;
    const body = await request.json();

    // Support both single link and batch
    if (Array.isArray(body.links)) {
      // Batch mode
      const errors: string[] = [];
      for (let i = 0; i < body.links.length; i++) {
        const link = body.links[i];
        const err = validateLink(link);
        if (err) errors.push(`links[${i}]: ${err}`);
      }
      if (errors.length > 0) {
        return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
      }

      const links = await linkEventsBatch(
        body.links.map((l: Record<string, unknown>) => ({
          correlation_id,
          cause_event_id: l.cause_event_id as string,
          effect_event_id: l.effect_event_id as string,
          relationship: (l.relationship as CausalRelationship) ?? 'caused',
          metadata: (l.metadata as Record<string, unknown>) ?? {},
        }))
      );

      return NextResponse.json({ links, count: links.length }, { status: 201 });
    }

    // Single link mode
    const err = validateLink(body);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const link = await linkEvents({
      correlation_id,
      cause_event_id: body.cause_event_id,
      effect_event_id: body.effect_event_id,
      relationship: body.relationship ?? 'caused',
      metadata: body.metadata ?? {},
    });

    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('already exists')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes('Cannot link')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[Correlations] POST/:id/links error:', err);
    return NextResponse.json(
      { error: 'Failed to create causal link' },
      { status: 500 }
    );
  }
}

function validateLink(link: Record<string, unknown>): string | null {
  if (!link.cause_event_id || typeof link.cause_event_id !== 'string') {
    return 'cause_event_id is required';
  }
  if (!link.effect_event_id || typeof link.effect_event_id !== 'string') {
    return 'effect_event_id is required';
  }
  if (link.relationship && !VALID_RELATIONSHIPS.includes(link.relationship as CausalRelationship)) {
    return `Invalid relationship. Valid: ${VALID_RELATIONSHIPS.join(', ')}`;
  }
  return null;
}
