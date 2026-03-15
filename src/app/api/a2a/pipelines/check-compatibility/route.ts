import { NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import { checkSchemaCompatibility, schemaCheckSchema } from '@/lib/a2a/pipelines';
import { getServiceDb } from '@/lib/a2a/auth';

/**
 * POST /api/a2a/pipelines/check-compatibility — Check schema compatibility.
 *
 * Given two capabilities (source and target), checks whether the source's
 * output schema can feed the target's input schema. Returns compatibility
 * level, matched/missing fields, and type mismatch details.
 *
 * This is the primitive agents use to determine if two capabilities
 * can be chained in a pipeline without data loss.
 */
export async function POST(req: Request) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schemaCheckSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request.', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { source_capability_id, source_version, target_capability_id, target_version } = parsed.data;

    // Fetch schemas from capability versions
    const db = getServiceDb();
    if (!db) {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
    }

    const [sourceSchema, targetSchema] = await Promise.all([
      fetchSchema(db, source_capability_id, source_version, 'output_schema'),
      fetchSchema(db, target_capability_id, target_version, 'input_schema'),
    ]);

    const check = checkSchemaCompatibility(
      sourceSchema,
      targetSchema,
      source_capability_id,
      target_capability_id,
      source_version,
      target_version,
    );

    return NextResponse.json({ check });
  } catch (err) {
    console.error('[A2A Pipeline] Compatibility check failed:', err);
    return NextResponse.json({ error: 'Compatibility check failed.' }, { status: 500 });
  }
}

/** Fetch a capability's schema (input or output) from the versions table. */
async function fetchSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  capabilityId: string,
  version: string | undefined,
  schemaField: 'input_schema' | 'output_schema',
): Promise<Record<string, unknown> | undefined> {
  let query = db
    .from('agent_capability_versions')
    .select(schemaField)
    .eq('capability_id', capabilityId)
    .eq('lifecycle', 'active')
    .order('created_at', { ascending: false })
    .limit(1);

  if (version) {
    query = query.eq('version', version);
  }

  const { data } = await query;
  if (data && data.length > 0) {
    return data[0][schemaField] as Record<string, unknown> | undefined;
  }

  // Fallback: check platform intents
  const { listPlatformIntents } = await import('@/lib/a2a/executor');
  const intent = listPlatformIntents().find(i => i.intent === capabilityId);
  if (intent?.input_schema && schemaField === 'input_schema') {
    return intent.input_schema;
  }

  return undefined;
}
