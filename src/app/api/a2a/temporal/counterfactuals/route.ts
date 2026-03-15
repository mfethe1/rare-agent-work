/**
 * POST /api/a2a/temporal/counterfactuals — Run counterfactual analysis
 *
 * Implements Pearl's do-calculus for "what-if" reasoning.
 * Agents can ask: "What would happen if node X were set to value V?"
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/a2a/auth';
import {
  computeCounterfactual,
  compareInterventions,
  findMinimalIntervention,
  attributeCausalResponsibility,
} from '@/lib/a2a/temporal';
import type { CausalGraph, CounterfactualIntervention } from '@/lib/a2a/temporal';
import { safeErrorBody } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateAgent(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      action,
      graph,
      intervention,
      interventions,
      outcomeNodeIds,
      targetNodeId,
      candidateNodeIds,
    }: {
      action: 'counterfactual' | 'compare' | 'minimal_intervention' | 'attribute';
      graph: CausalGraph;
      intervention?: CounterfactualIntervention;
      interventions?: CounterfactualIntervention[];
      outcomeNodeIds?: string[];
      targetNodeId?: string;
      candidateNodeIds?: string[];
    } = body;

    if (!graph || !action) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'graph and action are required' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'counterfactual': {
        if (!intervention || !outcomeNodeIds) {
          return NextResponse.json(
            { error: 'intervention and outcomeNodeIds required for counterfactual action' },
            { status: 400 },
          );
        }
        const result = computeCounterfactual(graph, intervention, outcomeNodeIds);
        return NextResponse.json({ counterfactual: result });
      }

      case 'compare': {
        if (!interventions || !outcomeNodeIds) {
          return NextResponse.json(
            { error: 'interventions and outcomeNodeIds required for compare action' },
            { status: 400 },
          );
        }
        const results = compareInterventions(
          graph,
          interventions,
          outcomeNodeIds,
          (outcome) => outcome.probabilityOfOccurrence,
        );
        return NextResponse.json({ comparisons: results });
      }

      case 'minimal_intervention': {
        if (!targetNodeId || !candidateNodeIds) {
          return NextResponse.json(
            { error: 'targetNodeId and candidateNodeIds required for minimal_intervention action' },
            { status: 400 },
          );
        }
        const leverages = findMinimalIntervention(graph, targetNodeId, candidateNodeIds);
        return NextResponse.json({ leverages });
      }

      case 'attribute': {
        if (!targetNodeId) {
          return NextResponse.json(
            { error: 'targetNodeId required for attribute action' },
            { status: 400 },
          );
        }
        const attributions = attributeCausalResponsibility(graph, targetNodeId);
        return NextResponse.json({ attributions });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[a2a/temporal/counterfactuals] POST error:', err);
    return NextResponse.json(safeErrorBody(), { status: 500 });
  }
}
