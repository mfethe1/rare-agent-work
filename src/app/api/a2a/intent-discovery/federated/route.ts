import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { safeErrorBody } from '@/lib/api-errors';
import { intentDiscoveryEngine } from '@/lib/a2a/intent-discovery/engine';
import {
  propagateIntentSchema,
  importFederatedIntentSchema,
} from '@/lib/a2a/intent-discovery/validation';

export async function POST(req: NextRequest) {
  try {
    authenticateAgent(req);
    const body = await req.json();

    // Route: propagate vs import
    if (body.federationIds && body.intentId) {
      const parsed = propagateIntentSchema.parse(body);
      const result = intentDiscoveryEngine.propagateIntent(parsed.intentId, parsed.federationIds);
      return NextResponse.json(result);
    }

    if (body.sourceFederationId) {
      const parsed = importFederatedIntentSchema.parse(body);
      const intent = intentDiscoveryEngine.importFederatedIntent(parsed.intent, parsed.sourceFederationId);
      return NextResponse.json({ intent }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid request. Provide federationIds+intentId or sourceFederationId+intent.' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/a2a/intent-discovery/federated error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
