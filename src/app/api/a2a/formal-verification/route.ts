import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  verifyModel,
  composeAndVerify,
  analyzeDeadlocks,
  discoverInvariants,
  generateCertificate,
  getCertificatesForGenome,
  verifyCertificateIntegrity,
  VerificationError,
} from '@/lib/a2a/formal-verification/engine';
import type {
  VerifyModelRequest,
  VerifyCompositionRequest,
  InvariantDiscoveryRequest,
} from '@/lib/a2a/formal-verification/types';

/**
 * POST /api/a2a/formal-verification — Verify agent behavioral models.
 *
 * Supports multiple operations via the `action` field:
 *   - verify_model:       Check properties against a single agent model
 *   - verify_composition: Check properties on composed multi-agent system
 *   - analyze_deadlocks:  Detect deadlock states in a model
 *   - discover_invariants: Auto-discover invariants from state space
 *   - get_certificates:   Retrieve proof certificates for a genome
 *   - verify_certificate: Check a certificate's cryptographic integrity
 *
 * All operations require authentication.
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
      case 'verify_model': {
        const req = body.payload as VerifyModelRequest;
        if (!req?.model) {
          return NextResponse.json({ error: 'model is required' }, { status: 400 });
        }
        const result = verifyModel(req);
        return NextResponse.json(result);
      }

      case 'verify_composition': {
        const req = body.payload as VerifyCompositionRequest;
        if (!req?.agents || req.agents.length < 2) {
          return NextResponse.json(
            { error: 'At least 2 agent models required for composition verification' },
            { status: 400 },
          );
        }
        const result = composeAndVerify(req);
        return NextResponse.json(result);
      }

      case 'analyze_deadlocks': {
        const model = body.payload?.model;
        if (!model) {
          return NextResponse.json({ error: 'model is required' }, { status: 400 });
        }
        const bounds = body.payload?.bounds;
        const result = analyzeDeadlocks(model, bounds);
        return NextResponse.json(result);
      }

      case 'discover_invariants': {
        const req = body.payload as InvariantDiscoveryRequest;
        if (!req?.model) {
          return NextResponse.json({ error: 'model is required' }, { status: 400 });
        }
        const invariants = discoverInvariants(req);
        return NextResponse.json({ invariants, count: invariants.length });
      }

      case 'get_certificates': {
        const genomeHash = body.payload?.genomeHash as string;
        if (!genomeHash) {
          return NextResponse.json({ error: 'genomeHash is required' }, { status: 400 });
        }
        const certificates = getCertificatesForGenome(genomeHash);
        return NextResponse.json({ certificates, count: certificates.length });
      }

      case 'verify_certificate': {
        const certificate = body.payload?.certificate;
        if (!certificate) {
          return NextResponse.json({ error: 'certificate is required' }, { status: 400 });
        }
        const valid = verifyCertificateIntegrity(certificate);
        return NextResponse.json({ valid, certificateId: certificate.id });
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Valid actions: verify_model, verify_composition, analyze_deadlocks, discover_invariants, get_certificates, verify_certificate`,
          },
          { status: 400 },
        );
    }
  } catch (err) {
    if (err instanceof VerificationError) {
      return NextResponse.json(
        { error: err.message, code: err.code, details: err.details },
        { status: 422 },
      );
    }
    console.error('Formal verification error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}

/**
 * GET /api/a2a/formal-verification — Get verification capabilities and templates.
 */
export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json(
      { error: 'Authentication required. Provide a valid Bearer token.' },
      { status: 401 },
    );
  }

  return NextResponse.json({
    capabilities: {
      modelChecking: true,
      compositionVerification: true,
      deadlockDetection: true,
      invariantDiscovery: true,
      proofCertificates: true,
      temporalLogic: ['LTL', 'CTL'],
      compositionOperators: ['parallel', 'synchronous', 'asynchronous', 'pipeline', 'hierarchical'],
    },
    standardTemplates: [
      'no_unsafe_states',
      'always_eventually_idle',
      'mutual_exclusion',
      'deadlock_free',
      'starvation_free',
      'bounded_resource',
      'request_response',
      'no_message_loss',
      'termination',
      'constitutional_compliance',
      'capability_bounded',
      'escalation_reachable',
      'audit_completeness',
      'graceful_degradation',
      'data_flow_integrity',
    ],
    defaultBounds: {
      maxDepth: 1000,
      maxStates: 100000,
      timeoutMs: 30000,
      symmetryReduction: true,
      partialOrderReduction: true,
    },
    actions: [
      { name: 'verify_model', description: 'Check temporal logic properties against a behavioral model' },
      { name: 'verify_composition', description: 'Verify properties on a composed multi-agent system' },
      { name: 'analyze_deadlocks', description: 'Detect deadlock states in a behavioral model' },
      { name: 'discover_invariants', description: 'Auto-discover invariants from reachable state space' },
      { name: 'get_certificates', description: 'Retrieve proof certificates for a genome hash' },
      { name: 'verify_certificate', description: 'Verify cryptographic integrity of a proof certificate' },
    ],
  });
}
