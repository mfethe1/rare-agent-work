import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  startSynthesis,
  submitProposal,
  voteOnProposal,
  verifyProtocol,
  approveProtocol,
  activateProtocol,
  deprecateProtocol,
  revokeProtocol,
  detectCommunicationGaps,
  evolveProtocol,
  listTemplates,
  instantiateFromTemplate,
  getProtocol,
  listProtocols,
  getSession,
  getGaps,
  getEvolutionHistory,
  getAuditLog,
} from '@/lib/a2a/protocol-synthesis/engine';
import {
  startSynthesisSchema,
  submitProposalSchema,
  voteOnProposalSchema,
  verifyProtocolSchema,
  detectGapsSchema,
  evolveProtocolSchema,
  listProtocolsSchema,
  approveProtocolSchema,
  deprecateProtocolSchema,
  revokeProtocolSchema,
  instantiateTemplateSchema,
} from '@/lib/a2a/protocol-synthesis/validation';

/**
 * POST /api/a2a/protocol-synthesis — Emergent Protocol Synthesis Engine.
 *
 * Enables agents to autonomously synthesize, verify, negotiate, and evolve
 * new communication protocols. Supports multiple operations via `action`:
 *
 *   - start_synthesis:     Begin a protocol synthesis session
 *   - submit_proposal:     Submit a protocol proposal in a negotiation session
 *   - vote_on_proposal:    Vote on a proposal in a negotiation session
 *   - verify_protocol:     Run constitutional verification on a protocol
 *   - approve_protocol:    Approve a verified protocol for use
 *   - activate_protocol:   Activate an approved protocol
 *   - deprecate_protocol:  Deprecate a protocol
 *   - revoke_protocol:     Immediately revoke a protocol (safety)
 *   - detect_gaps:         Detect communication gaps between agents
 *   - evolve_protocol:     Evolve a protocol based on usage metrics
 *   - list_templates:      List available protocol templates
 *   - instantiate_template: Create a protocol from a template
 *   - get_protocol:        Get a protocol by ID with lineage
 *   - list_protocols:      List protocols with filtering
 *   - get_session:         Get a synthesis session by ID
 *   - get_gaps:            List all detected communication gaps
 *   - get_evolution_history: Get evolution history for a protocol
 *   - get_audit_log:       Get audit log entries
 *
 * All operations require agent authentication.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const action = body.action as string;

    switch (action) {
      // ─── Synthesis ───────────────────────────────────────────
      case 'start_synthesis': {
        const parsed = startSynthesisSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = startSynthesis(parsed.data);
        return NextResponse.json(result);
      }

      case 'submit_proposal': {
        const parsed = submitProposalSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = submitProposal(parsed.data);
        return NextResponse.json(result);
      }

      case 'vote_on_proposal': {
        const parsed = voteOnProposalSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = voteOnProposal(parsed.data);
        return NextResponse.json(result);
      }

      // ─── Verification & Lifecycle ────────────────────────────
      case 'verify_protocol': {
        const parsed = verifyProtocolSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = verifyProtocol(parsed.data);
        return NextResponse.json(result);
      }

      case 'approve_protocol': {
        const parsed = approveProtocolSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = approveProtocol(parsed.data);
        return NextResponse.json(result);
      }

      case 'activate_protocol': {
        const protocolId = body.payload?.protocolId;
        if (!protocolId) {
          return NextResponse.json({ error: 'protocolId is required' }, { status: 400 });
        }
        const result = activateProtocol(protocolId);
        return NextResponse.json({ protocol: result });
      }

      case 'deprecate_protocol': {
        const parsed = deprecateProtocolSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = deprecateProtocol(parsed.data);
        return NextResponse.json(result);
      }

      case 'revoke_protocol': {
        const parsed = revokeProtocolSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = revokeProtocol(parsed.data);
        return NextResponse.json(result);
      }

      // ─── Gap Detection ───────────────────────────────────────
      case 'detect_gaps': {
        const parsed = detectGapsSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = detectCommunicationGaps(parsed.data);
        return NextResponse.json(result);
      }

      // ─── Evolution ───────────────────────────────────────────
      case 'evolve_protocol': {
        const parsed = evolveProtocolSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = evolveProtocol(parsed.data);
        return NextResponse.json(result);
      }

      // ─── Templates ───────────────────────────────────────────
      case 'list_templates': {
        const result = listTemplates();
        return NextResponse.json({ templates: result });
      }

      case 'instantiate_template': {
        const parsed = instantiateTemplateSchema.safeParse(body.payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = instantiateFromTemplate(parsed.data);
        return NextResponse.json(result);
      }

      // ─── Queries ─────────────────────────────────────────────
      case 'get_protocol': {
        const protocolId = body.payload?.protocolId;
        if (!protocolId) {
          return NextResponse.json({ error: 'protocolId is required' }, { status: 400 });
        }
        const result = getProtocol(protocolId);
        return NextResponse.json(result);
      }

      case 'list_protocols': {
        const parsed = listProtocolsSchema.safeParse(body.payload || {});
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
        }
        const result = listProtocols(parsed.data);
        return NextResponse.json(result);
      }

      case 'get_session': {
        const sessionId = body.payload?.sessionId;
        if (!sessionId) {
          return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }
        const result = getSession(sessionId);
        return NextResponse.json({ session: result });
      }

      case 'get_gaps': {
        const result = getGaps();
        return NextResponse.json({ gaps: result });
      }

      case 'get_evolution_history': {
        const protocolId = body.payload?.protocolId;
        if (!protocolId) {
          return NextResponse.json({ error: 'protocolId is required' }, { status: 400 });
        }
        const result = getEvolutionHistory(protocolId);
        return NextResponse.json({ records: result });
      }

      case 'get_audit_log': {
        const entityId = body.payload?.entityId;
        const limit = body.payload?.limit || 50;
        const result = getAuditLog(entityId, limit);
        return NextResponse.json({ entries: result });
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}`,
            availableActions: [
              'start_synthesis', 'submit_proposal', 'vote_on_proposal',
              'verify_protocol', 'approve_protocol', 'activate_protocol',
              'deprecate_protocol', 'revoke_protocol',
              'detect_gaps', 'evolve_protocol',
              'list_templates', 'instantiate_template',
              'get_protocol', 'list_protocols', 'get_session',
              'get_gaps', 'get_evolution_history', 'get_audit_log',
            ],
          },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error('[protocol-synthesis] Error:', err);
    return NextResponse.json(safeErrorBody(err), { status: 500 });
  }
}
