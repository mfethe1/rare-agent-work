import { NextResponse } from 'next/server';
import { getEventCatalog } from '@/lib/a2a/events';

/**
 * GET /api/a2a/events/catalog
 *
 * Returns the self-documenting event catalog with all available event types,
 * their schemas, and example payloads. Agents use this for discovery.
 */
export async function GET() {
  try {
    const catalog = getEventCatalog();
    return NextResponse.json({ catalog, total: catalog.length });
  } catch (err) {
    console.error('[API] GET /api/a2a/events/catalog error:', err);
    return NextResponse.json({ error: 'Failed to get event catalog' }, { status: 500 });
  }
}
