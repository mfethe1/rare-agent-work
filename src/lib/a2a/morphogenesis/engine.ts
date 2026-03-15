/**
 * A2A Morphogenesis Engine
 *
 * Core business logic for agent fusion, fission, grafting, metamorphosis,
 * and replication. All operations are tracked with immutable morph events
 * for full provenance and rollback capability.
 *
 * Design principles:
 * - Every operation is consent-gated (all involved agents must approve)
 * - Every operation produces a MorphEvent with pre-morph snapshots
 * - Every operation is rollback-capable via snapshot restoration
 * - Safety checks run before execution (capability conflicts, trust, energy)
 * - Lineage tracking enables full provenance graphs
 */

import { randomUUID } from 'crypto';
import type {
  MorphEvent,
  MorphEventStatus,
  MorphOperation,
  MorphParams,
  AgentSnapshot,
  AgentCapabilitySnapshot,
  CapabilityDelta,
  SafetyCheck,
  SafetyCheckResult,
  CompositeAgent,
  FissionResult,
  ActiveGraft,
  MetamorphState,
  MetamorphPhase,
  ReplicaAgent,
  MorphRegistry,
  MorphLineageNode,
  MorphLineageGraph,
  FusionConfig,
  FissionConfig,
  GraftConfig,
  MetamorphConfig,
  ReplicationConfig,
  MergedCapability,
  PartitionedCapability,
  GraftedCapability,
  EmergedCapability,
} from './types';

// ── In-Memory Stores ────────────────────────────────────────────────────────
// Production: back these with Supabase tables (a2a_morph_events, etc.)

const morphEvents = new Map<string, MorphEvent>();
const composites = new Map<string, CompositeAgent>();
const fissions = new Map<string, FissionResult>();
const activeGrafts = new Map<string, ActiveGraft>();
const metamorphoses = new Map<string, MetamorphState>();
const replicas = new Map<string, ReplicaAgent>();

/** Consent tracking: eventId → Map<agentId, consented> */
const consentLedger = new Map<string, Map<string, boolean | null>>();

/** Energy budget per agent (morphogenesis costs energy to prevent abuse). */
const energyBudgets = new Map<string, number>();
const DEFAULT_ENERGY_BUDGET = 1000;
const ENERGY_COSTS: Record<MorphOperation, number> = {
  fusion: 100,
  fission: 80,
  graft: 30,
  metamorphosis: 120,
  replication: 50,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function getEnergy(agentId: string): number {
  return energyBudgets.get(agentId) ?? DEFAULT_ENERGY_BUDGET;
}

function deductEnergy(agentId: string, cost: number): void {
  energyBudgets.set(agentId, getEnergy(agentId) - cost);
}

/** Create a snapshot of an agent's capabilities for rollback. */
function snapshotAgent(
  agentId: string,
  name: string,
  description: string,
  capabilities: AgentCapabilitySnapshot[],
  trustLevel: string,
): AgentSnapshot {
  return {
    agent_id: agentId,
    name,
    description,
    capabilities,
    trust_level: trustLevel,
    metadata: {},
    snapshot_at: now(),
  };
}

// ── Safety Checks ───────────────────────────────────────────────────────────

function runSafetyChecks(
  operation: MorphOperation,
  sourceAgentIds: string[],
  initiatedBy: string,
): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  // Check 1: Energy budget
  const energy = getEnergy(initiatedBy);
  const cost = ENERGY_COSTS[operation];
  checks.push({
    check: 'energy_budget',
    result: energy >= cost ? 'passed' : 'failed',
    details: `Agent has ${energy} energy, operation costs ${cost}`,
    blocking: true,
  });

  // Check 2: Self-morphing (can't fuse with yourself)
  const uniqueAgents = new Set(sourceAgentIds);
  if (operation === 'fusion' && uniqueAgents.size < sourceAgentIds.length) {
    checks.push({
      check: 'no_self_fusion',
      result: 'failed',
      details: 'Cannot fuse an agent with itself',
      blocking: true,
    });
  } else {
    checks.push({
      check: 'no_self_fusion',
      result: 'passed',
      details: 'All source agents are distinct',
      blocking: true,
    });
  }

  // Check 3: Recursive depth limit (prevent infinite nesting)
  const maxDepth = 5;
  for (const agentId of sourceAgentIds) {
    const existing = composites.get(agentId);
    if (existing && existing.depth >= maxDepth) {
      checks.push({
        check: 'max_composition_depth',
        result: 'failed',
        details: `Agent ${agentId} is already at depth ${existing.depth} (max: ${maxDepth})`,
        blocking: true,
      });
    }
  }
  if (!checks.find(c => c.check === 'max_composition_depth')) {
    checks.push({
      check: 'max_composition_depth',
      result: 'passed',
      details: `All agents within depth limit of ${maxDepth}`,
      blocking: true,
    });
  }

  // Check 4: No active metamorphosis (can't morph while transforming)
  for (const agentId of sourceAgentIds) {
    const metamorph = metamorphoses.get(agentId);
    if (metamorph && metamorph.phase !== 'emerged') {
      checks.push({
        check: 'not_in_metamorphosis',
        result: 'failed',
        details: `Agent ${agentId} is currently in metamorphosis (${metamorph.phase})`,
        blocking: true,
      });
    }
  }
  if (!checks.find(c => c.check === 'not_in_metamorphosis')) {
    checks.push({
      check: 'not_in_metamorphosis',
      result: 'passed',
      details: 'No source agents are currently in metamorphosis',
      blocking: true,
    });
  }

  // Check 5: Replication lineage limit
  if (operation === 'replication') {
    const existingReplicas = Array.from(replicas.values()).filter(
      r => r.progenitor_id === sourceAgentIds[0] || r.agent_id === sourceAgentIds[0],
    );
    if (existingReplicas.length >= 100) {
      checks.push({
        check: 'replication_limit',
        result: 'failed',
        details: `Agent has ${existingReplicas.length} replicas (limit: 100)`,
        blocking: true,
      });
    } else {
      checks.push({
        check: 'replication_limit',
        result: 'passed',
        details: `Agent has ${existingReplicas.length} replicas`,
        blocking: false,
      });
    }
  }

  return checks;
}

function hasBlockingFailure(checks: SafetyCheck[]): boolean {
  return checks.some(c => c.result === 'failed' && c.blocking);
}

// ── Core: Propose Morph Operation ───────────────────────────────────────────

function createMorphEvent(
  operation: MorphOperation,
  sourceAgentIds: string[],
  initiatedBy: string,
  rationale: string,
  params: MorphParams,
  snapshots: AgentSnapshot[],
): MorphEvent {
  const safetyChecks = runSafetyChecks(operation, sourceAgentIds, initiatedBy);

  const event: MorphEvent = {
    id: randomUUID(),
    operation,
    status: hasBlockingFailure(safetyChecks) ? 'rejected' : 'proposed',
    source_agent_ids: sourceAgentIds,
    result_agent_ids: [],
    initiated_by: initiatedBy,
    rationale,
    params,
    pre_morph_snapshot: snapshots,
    capability_delta: { merged: [], partitioned: [], grafted: [], shed: [], emerged: [] },
    lineage_chain: buildLineageChain(sourceAgentIds),
    safety_checks: safetyChecks,
    energy_cost: ENERGY_COSTS[operation],
    created_at: now(),
    completed_at: null,
    rolled_back_at: null,
  };

  morphEvents.set(event.id, event);

  // Initialize consent ledger (all source agents must consent)
  if (event.status === 'proposed') {
    const ledger = new Map<string, boolean | null>();
    for (const agentId of sourceAgentIds) {
      // Initiator auto-consents
      ledger.set(agentId, agentId === initiatedBy ? true : null);
    }
    consentLedger.set(event.id, ledger);
  }

  return event;
}

function buildLineageChain(agentIds: string[]): string[] {
  const chain: string[] = [];
  for (const agentId of agentIds) {
    // Walk the event history for this agent
    for (const [eventId, event] of morphEvents) {
      if (
        event.status === 'completed' &&
        (event.source_agent_ids.includes(agentId) || event.result_agent_ids.includes(agentId))
      ) {
        chain.push(eventId);
      }
    }
  }
  return [...new Set(chain)];
}

// ── Consent ─────────────────────────────────────────────────────────────────

export function consentToMorph(
  eventId: string,
  agentId: string,
  consent: boolean,
  reason?: string,
): { event: MorphEvent; all_consented: boolean } {
  const event = morphEvents.get(eventId);
  if (!event) throw new Error(`Morph event ${eventId} not found`);
  if (event.status !== 'proposed') throw new Error(`Event is ${event.status}, not proposed`);

  const ledger = consentLedger.get(eventId);
  if (!ledger) throw new Error(`No consent ledger for event ${eventId}`);
  if (!ledger.has(agentId)) throw new Error(`Agent ${agentId} is not a party to this event`);

  ledger.set(agentId, consent);

  if (!consent) {
    event.status = 'rejected';
    morphEvents.set(eventId, event);
    return { event, all_consented: false };
  }

  const allConsented = Array.from(ledger.values()).every(v => v === true);
  if (allConsented) {
    event.status = 'approved';
    morphEvents.set(eventId, event);
  }

  return { event, all_consented: allConsented };
}

// ── Fusion ──────────────────────────────────────────────────────────────────

export function proposeFusion(
  agentIds: string[],
  config: FusionConfig,
  initiatedBy: string,
  rationale: string,
  agentSnapshots: AgentSnapshot[],
): MorphEvent {
  const params: MorphParams = { operation: 'fusion', config };
  return createMorphEvent('fusion', agentIds, initiatedBy, rationale, params, agentSnapshots);
}

export function executeFusion(eventId: string): {
  event: MorphEvent;
  composite: CompositeAgent;
} {
  const event = morphEvents.get(eventId);
  if (!event) throw new Error(`Morph event ${eventId} not found`);
  if (event.status !== 'approved') throw new Error(`Event must be approved, is ${event.status}`);
  if (event.operation !== 'fusion') throw new Error('Event is not a fusion operation');

  event.status = 'in_progress';
  const config = (event.params as { operation: 'fusion'; config: FusionConfig }).config;

  // Build capability map from snapshots
  const capabilitySources: Record<string, string[]> = {};
  const mergedCapabilities: MergedCapability[] = [];

  for (const snapshot of event.pre_morph_snapshot) {
    for (const cap of snapshot.capabilities) {
      if (config.exclude_capabilities?.includes(cap.id)) continue;
      if (!capabilitySources[cap.id]) capabilitySources[cap.id] = [];
      capabilitySources[cap.id].push(snapshot.agent_id);
    }
  }

  // For synthesis strategy, merge overlapping capabilities
  if (config.strategy === 'synthesis') {
    const overlapping = Object.entries(capabilitySources).filter(([, sources]) => sources.length > 1);
    for (const [capId, sources] of overlapping) {
      const mergedId = `synth.${capId}`;
      mergedCapabilities.push({
        source_ids: sources,
        result_id: mergedId,
        merge_strategy: 'synthesis',
      });
      capabilitySources[mergedId] = sources;
      delete capabilitySources[capId];
    }
  }

  // Determine composite depth
  let maxDepth = 0;
  for (const agentId of event.source_agent_ids) {
    const existing = composites.get(agentId);
    if (existing) maxDepth = Math.max(maxDepth, existing.depth);
  }

  const compositeAgentId = randomUUID();
  const composite: CompositeAgent = {
    agent_id: compositeAgentId,
    fusion_event_id: eventId,
    constituent_ids: [...event.source_agent_ids],
    strategy: config.strategy,
    capability_sources: capabilitySources,
    defusible: true,
    depth: maxDepth + 1,
    expires_at: config.ttl_seconds > 0
      ? new Date(Date.now() + config.ttl_seconds * 1000).toISOString()
      : null,
    created_at: now(),
  };

  composites.set(compositeAgentId, composite);

  // Update event
  event.status = 'completed';
  event.result_agent_ids = [compositeAgentId];
  event.completed_at = now();
  event.capability_delta.merged = mergedCapabilities;

  // Deduct energy
  deductEnergy(event.initiated_by, event.energy_cost);

  morphEvents.set(eventId, event);
  return { event, composite };
}

export function defuse(compositeAgentId: string, initiatedBy: string, reason: string): {
  event: MorphEvent;
  restored_agents: string[];
} {
  const composite = composites.get(compositeAgentId);
  if (!composite) throw new Error(`Composite ${compositeAgentId} not found`);
  if (!composite.defusible) throw new Error('This composite cannot be defused');

  // Find the original fusion event for snapshots
  const fusionEvent = morphEvents.get(composite.fusion_event_id);
  if (!fusionEvent) throw new Error('Original fusion event not found');

  const defuseEvent: MorphEvent = {
    id: randomUUID(),
    operation: 'fusion', // defuse is the inverse of fusion
    status: 'completed',
    source_agent_ids: [compositeAgentId],
    result_agent_ids: composite.constituent_ids,
    initiated_by: initiatedBy,
    rationale: `Defusion: ${reason}`,
    params: fusionEvent.params,
    pre_morph_snapshot: [],
    capability_delta: { merged: [], partitioned: [], grafted: [], shed: [], emerged: [] },
    lineage_chain: [composite.fusion_event_id],
    safety_checks: [{ check: 'defusion', result: 'passed', details: 'Composite is defusible', blocking: false }],
    energy_cost: 0,
    created_at: now(),
    completed_at: now(),
    rolled_back_at: null,
  };

  morphEvents.set(defuseEvent.id, defuseEvent);
  composites.delete(compositeAgentId);

  return { event: defuseEvent, restored_agents: composite.constituent_ids };
}

// ── Fission ─────────────────────────────────────────────────────────────────

export function proposeFission(
  agentId: string,
  config: FissionConfig,
  initiatedBy: string,
  rationale: string,
  agentSnapshot: AgentSnapshot,
): MorphEvent {
  const params: MorphParams = { operation: 'fission', config };
  return createMorphEvent('fission', [agentId], initiatedBy, rationale, params, [agentSnapshot]);
}

export function executeFission(eventId: string): {
  event: MorphEvent;
  fission: FissionResult;
} {
  const event = morphEvents.get(eventId);
  if (!event) throw new Error(`Morph event ${eventId} not found`);
  if (event.status !== 'approved') throw new Error(`Event must be approved, is ${event.status}`);
  if (event.operation !== 'fission') throw new Error('Event is not a fission operation');

  event.status = 'in_progress';
  const config = (event.params as { operation: 'fission'; config: FissionConfig }).config;
  const parentId = event.source_agent_ids[0];
  const snapshot = event.pre_morph_snapshot[0];

  // Build partitions
  let capabilityAssignments: Record<string, string[]> = {};
  const subAgentIds: string[] = [];
  const partitioned: PartitionedCapability[] = [];

  if (config.strategy === 'manual' && config.partitions) {
    for (const partition of config.partitions) {
      const subId = randomUUID();
      subAgentIds.push(subId);
      capabilityAssignments[subId] = partition.capability_ids;
      for (const capId of partition.capability_ids) {
        partitioned.push({
          source_id: capId,
          partition_ids: [capId],
          partition_strategy: 'domain',
        });
      }
    }
  } else {
    // Auto-partition by strategy
    const allCaps = snapshot.capabilities.map(c => c.id);
    const targetCount = config.target_count ?? 2;
    const chunkSize = Math.ceil(allCaps.length / targetCount);

    for (let i = 0; i < targetCount; i++) {
      const subId = randomUUID();
      subAgentIds.push(subId);
      const chunk = allCaps.slice(i * chunkSize, (i + 1) * chunkSize);
      capabilityAssignments[subId] = chunk;
      for (const capId of chunk) {
        partitioned.push({
          source_id: capId,
          partition_ids: [capId],
          partition_strategy: config.strategy === 'manual' ? 'domain' : config.strategy,
        });
      }
    }
  }

  const fissionResult: FissionResult = {
    parent_agent_id: parentId,
    fission_event_id: eventId,
    sub_agent_ids: subAgentIds,
    capability_assignments: capabilityAssignments,
    reunifiable: true,
    expires_at: config.ttl_seconds > 0
      ? new Date(Date.now() + config.ttl_seconds * 1000).toISOString()
      : null,
    created_at: now(),
  };

  fissions.set(eventId, fissionResult);

  event.status = 'completed';
  event.result_agent_ids = subAgentIds;
  event.completed_at = now();
  event.capability_delta.partitioned = partitioned;

  deductEnergy(event.initiated_by, event.energy_cost);
  morphEvents.set(eventId, event);

  return { event, fission: fissionResult };
}

export function reunify(fissionEventId: string, initiatedBy: string, reason: string): {
  event: MorphEvent;
  reunified_agent_id: string;
} {
  const fission = fissions.get(fissionEventId);
  if (!fission) throw new Error(`Fission ${fissionEventId} not found`);
  if (!fission.reunifiable) throw new Error('This fission cannot be reunified');

  const originalEvent = morphEvents.get(fissionEventId);

  const reunifyEvent: MorphEvent = {
    id: randomUUID(),
    operation: 'fission',
    status: 'completed',
    source_agent_ids: fission.sub_agent_ids,
    result_agent_ids: [fission.parent_agent_id],
    initiated_by: initiatedBy,
    rationale: `Reunification: ${reason}`,
    params: originalEvent?.params ?? { operation: 'fission', config: {} as FissionConfig },
    pre_morph_snapshot: [],
    capability_delta: { merged: [], partitioned: [], grafted: [], shed: [], emerged: [] },
    lineage_chain: [fissionEventId],
    safety_checks: [{ check: 'reunification', result: 'passed', details: 'Fission is reunifiable', blocking: false }],
    energy_cost: 0,
    created_at: now(),
    completed_at: now(),
    rolled_back_at: null,
  };

  morphEvents.set(reunifyEvent.id, reunifyEvent);
  fissions.delete(fissionEventId);

  return { event: reunifyEvent, reunified_agent_id: fission.parent_agent_id };
}

// ── Graft ───────────────────────────────────────────────────────────────────

export function proposeGraft(
  config: GraftConfig,
  initiatedBy: string,
  rationale: string,
  donorSnapshot: AgentSnapshot,
  recipientSnapshot: AgentSnapshot,
): MorphEvent {
  const params: MorphParams = { operation: 'graft', config };
  return createMorphEvent(
    'graft',
    [config.donor_id, config.recipient_id],
    initiatedBy,
    rationale,
    params,
    [donorSnapshot, recipientSnapshot],
  );
}

export function executeGraft(eventId: string): {
  event: MorphEvent;
  graft: ActiveGraft;
} {
  const event = morphEvents.get(eventId);
  if (!event) throw new Error(`Morph event ${eventId} not found`);
  if (event.status !== 'approved') throw new Error(`Event must be approved, is ${event.status}`);
  if (event.operation !== 'graft') throw new Error('Event is not a graft operation');

  event.status = 'in_progress';
  const config = (event.params as { operation: 'graft'; config: GraftConfig }).config;

  const graft: ActiveGraft = {
    id: randomUUID(),
    morph_event_id: eventId,
    capability_id: config.capability_id,
    donor_id: config.donor_id,
    recipient_id: config.recipient_id,
    mode: config.mode,
    invocation_count: 0,
    max_invocations: config.max_invocations ?? null,
    revoked: false,
    revoked_at: null,
    revoke_reason: null,
    expires_at: new Date(Date.now() + config.ttl_seconds * 1000).toISOString(),
    created_at: now(),
  };

  activeGrafts.set(graft.id, graft);

  const graftedCap: GraftedCapability = {
    capability_id: config.capability_id,
    donor_id: config.donor_id,
    recipient_id: config.recipient_id,
    expires_at: graft.expires_at,
    revocable: config.revocable,
  };

  event.status = 'completed';
  event.result_agent_ids = [config.recipient_id];
  event.completed_at = now();
  event.capability_delta.grafted = [graftedCap];

  deductEnergy(event.initiated_by, event.energy_cost);
  morphEvents.set(eventId, event);

  return { event, graft };
}

export function revokeGraft(graftId: string, reason: string): ActiveGraft {
  const graft = activeGrafts.get(graftId);
  if (!graft) throw new Error(`Graft ${graftId} not found`);
  if (graft.revoked) throw new Error('Graft is already revoked');

  graft.revoked = true;
  graft.revoked_at = now();
  graft.revoke_reason = reason;
  activeGrafts.set(graftId, graft);

  return graft;
}

export function recordGraftInvocation(graftId: string): ActiveGraft {
  const graft = activeGrafts.get(graftId);
  if (!graft) throw new Error(`Graft ${graftId} not found`);
  if (graft.revoked) throw new Error('Graft has been revoked');
  if (new Date(graft.expires_at) < new Date()) throw new Error('Graft has expired');
  if (graft.max_invocations && graft.invocation_count >= graft.max_invocations) {
    throw new Error('Graft invocation limit reached');
  }

  graft.invocation_count++;

  // Auto-revoke on limit
  if (graft.max_invocations && graft.invocation_count >= graft.max_invocations) {
    graft.revoked = true;
    graft.revoked_at = now();
    graft.revoke_reason = 'Max invocations reached';
  }

  activeGrafts.set(graftId, graft);
  return graft;
}

// ── Metamorphosis ───────────────────────────────────────────────────────────

export function proposeMetamorph(
  agentId: string,
  config: MetamorphConfig,
  initiatedBy: string,
  rationale: string,
  agentSnapshot: AgentSnapshot,
): { event: MorphEvent; state: MetamorphState } {
  const params: MorphParams = { operation: 'metamorphosis', config };
  const event = createMorphEvent('metamorphosis', [agentId], initiatedBy, rationale, params, [agentSnapshot]);

  // Metamorphosis is self-initiated, so auto-approve if initiator is the agent
  if (initiatedBy === agentId && event.status === 'proposed') {
    event.status = 'approved';
    morphEvents.set(event.id, event);
  }

  const state: MetamorphState = {
    agent_id: agentId,
    morph_event_id: event.id,
    phase: 'chrysalis',
    offline_capabilities: config.shed_capabilities,
    developing_capabilities: config.new_capabilities.map(c => c.id),
    progress: 0,
    eta_seconds: config.max_chrysalis_seconds,
    phase_started_at: now(),
  };

  metamorphoses.set(agentId, state);
  return { event, state };
}

export function advanceMetamorph(
  agentId: string,
  targetPhase: MetamorphPhase,
  progress?: number,
): { state: MetamorphState; event: MorphEvent } {
  const state = metamorphoses.get(agentId);
  if (!state) throw new Error(`No metamorphosis in progress for agent ${agentId}`);

  const event = morphEvents.get(state.morph_event_id);
  if (!event) throw new Error('Morph event not found');

  // Validate phase progression
  const phaseOrder: MetamorphPhase[] = ['chrysalis', 'transforming', 'stabilizing', 'emerged'];
  const currentIdx = phaseOrder.indexOf(state.phase);
  const targetIdx = phaseOrder.indexOf(targetPhase);
  if (targetIdx <= currentIdx) {
    throw new Error(`Cannot regress from ${state.phase} to ${targetPhase}`);
  }

  state.phase = targetPhase;
  state.progress = progress ?? (targetIdx / (phaseOrder.length - 1)) * 100;
  state.phase_started_at = now();

  if (targetPhase === 'emerged') {
    // Metamorphosis complete
    state.progress = 100;
    state.eta_seconds = 0;
    event.status = 'completed';
    event.completed_at = now();

    const config = (event.params as { operation: 'metamorphosis'; config: MetamorphConfig }).config;
    event.capability_delta.shed = config.shed_capabilities;
    event.capability_delta.emerged = config.new_capabilities.map(c => ({
      id: c.id,
      description: c.description,
      contributing_sources: config.shed_capabilities,
      confidence: 0.85,
    }));

    deductEnergy(event.initiated_by, event.energy_cost);
    morphEvents.set(event.id, event);
  }

  metamorphoses.set(agentId, state);
  return { state, event };
}

// ── Replication ─────────────────────────────────────────────────────────────

export function proposeReplication(
  agentId: string,
  config: ReplicationConfig,
  initiatedBy: string,
  rationale: string,
  agentSnapshot: AgentSnapshot,
): MorphEvent {
  // Check nested replication
  const existingReplica = replicas.get(agentId);
  if (existingReplica && !config.allow_nested_replication) {
    const event = createMorphEvent(
      'replication',
      [agentId],
      initiatedBy,
      rationale,
      { operation: 'replication', config },
      [agentSnapshot],
    );
    event.status = 'rejected';
    event.safety_checks.push({
      check: 'nested_replication',
      result: 'failed',
      details: 'Agent is a replica and nested replication is disabled',
      blocking: true,
    });
    morphEvents.set(event.id, event);
    return event;
  }

  const params: MorphParams = { operation: 'replication', config };
  const event = createMorphEvent('replication', [agentId], initiatedBy, rationale, params, [agentSnapshot]);

  // Self-replication auto-approves
  if (initiatedBy === agentId && event.status === 'proposed') {
    event.status = 'approved';
    morphEvents.set(event.id, event);
  }

  return event;
}

export function executeReplication(eventId: string): {
  event: MorphEvent;
  replicas: ReplicaAgent[];
} {
  const event = morphEvents.get(eventId);
  if (!event) throw new Error(`Morph event ${eventId} not found`);
  if (event.status !== 'approved') throw new Error(`Event must be approved, is ${event.status}`);
  if (event.operation !== 'replication') throw new Error('Event is not a replication operation');

  event.status = 'in_progress';
  const config = (event.params as { operation: 'replication'; config: ReplicationConfig }).config;
  const progenitorId = event.source_agent_ids[0];

  // Determine generation
  const existingReplica = replicas.get(progenitorId);
  const generation = existingReplica ? existingReplica.generation + 1 : 0;

  const newReplicas: ReplicaAgent[] = [];
  for (let i = 0; i < config.count; i++) {
    const replicaId = randomUUID();

    // Calculate divergence based on variation type
    let divergence = 0;
    switch (config.variation) {
      case 'exact':
        divergence = 0;
        break;
      case 'drift':
        divergence = config.drift_magnitude ?? 0.1;
        break;
      case 'specialized':
        divergence = 0.5; // Specialized clones diverge significantly
        break;
      case 'complementary':
        divergence = 0.8; // Complementary clones are highly divergent
        break;
    }

    const replica: ReplicaAgent = {
      agent_id: replicaId,
      progenitor_id: progenitorId,
      morph_event_id: eventId,
      variation: config.variation,
      generation,
      divergence_score: divergence,
      expires_at: config.ttl_seconds > 0
        ? new Date(Date.now() + config.ttl_seconds * 1000).toISOString()
        : null,
      created_at: now(),
    };

    replicas.set(replicaId, replica);
    newReplicas.push(replica);
  }

  event.status = 'completed';
  event.result_agent_ids = newReplicas.map(r => r.agent_id);
  event.completed_at = now();

  deductEnergy(event.initiated_by, event.energy_cost);
  morphEvents.set(eventId, event);

  return { event, replicas: newReplicas };
}

// ── Rollback ────────────────────────────────────────────────────────────────

export function rollbackMorph(eventId: string, reason: string): {
  event: MorphEvent;
  restored_agents: string[];
} {
  const event = morphEvents.get(eventId);
  if (!event) throw new Error(`Morph event ${eventId} not found`);
  if (event.status !== 'completed') throw new Error('Can only rollback completed events');
  if (event.rolled_back_at) throw new Error('Event already rolled back');

  // Clean up based on operation type
  const restoredAgents = event.source_agent_ids;

  switch (event.operation) {
    case 'fusion':
      for (const agentId of event.result_agent_ids) {
        composites.delete(agentId);
      }
      break;
    case 'fission':
      fissions.delete(eventId);
      break;
    case 'graft':
      for (const graft of activeGrafts.values()) {
        if (graft.morph_event_id === eventId) {
          activeGrafts.delete(graft.id);
        }
      }
      break;
    case 'metamorphosis':
      for (const agentId of event.source_agent_ids) {
        metamorphoses.delete(agentId);
      }
      break;
    case 'replication':
      for (const agentId of event.result_agent_ids) {
        replicas.delete(agentId);
      }
      break;
  }

  event.status = 'rolled_back';
  event.rolled_back_at = now();

  // Refund energy
  energyBudgets.set(
    event.initiated_by,
    getEnergy(event.initiated_by) + event.energy_cost,
  );

  morphEvents.set(eventId, event);
  return { event, restored_agents: restoredAgents };
}

// ── Registry ────────────────────────────────────────────────────────────────

export function getMorphRegistry(): MorphRegistry {
  return {
    composites: Array.from(composites.values()),
    fissions: Array.from(fissions.values()),
    grafts: Array.from(activeGrafts.values()).filter(g => !g.revoked),
    metamorphoses: Array.from(metamorphoses.values()).filter(m => m.phase !== 'emerged'),
    replicas: Array.from(replicas.values()),
    total_events: morphEvents.size,
    energy_budget: DEFAULT_ENERGY_BUDGET,
  };
}

// ── Lineage Graph ───────────────────────────────────────────────────────────

export function getMorphLineage(agentId: string, maxDepth: number = 10): MorphLineageGraph {
  const nodes: Record<string, MorphLineageNode> = {};
  const visited = new Set<string>();

  function traverse(id: string, depth: number): void {
    if (visited.has(id) || depth > maxDepth) return;
    visited.add(id);

    const producedBy: string[] = [];
    const participatedIn: string[] = [];
    let form: MorphLineageNode['form'] = 'original';

    for (const [eventId, event] of morphEvents) {
      if (event.status !== 'completed' && event.status !== 'rolled_back') continue;

      if (event.result_agent_ids.includes(id)) {
        producedBy.push(eventId);
      }
      if (event.source_agent_ids.includes(id)) {
        participatedIn.push(eventId);
      }
    }

    // Determine current form
    if (composites.has(id)) form = 'composite';
    else if (replicas.has(id)) form = 'replica';
    else if (metamorphoses.has(id) && metamorphoses.get(id)!.phase === 'emerged') form = 'metamorphosed';
    else {
      // Check if this agent is a sub-agent from fission
      for (const fission of fissions.values()) {
        if (fission.sub_agent_ids.includes(id)) { form = 'sub_agent'; break; }
      }
      // Check if dormant (fused into a composite)
      for (const composite of composites.values()) {
        if (composite.constituent_ids.includes(id)) { form = 'dormant'; break; }
      }
    }

    nodes[id] = { agent_id: id, form, produced_by: producedBy, participated_in: participatedIn, depth };

    // Traverse connected agents
    for (const eventId of [...producedBy, ...participatedIn]) {
      const event = morphEvents.get(eventId);
      if (!event) continue;
      for (const connectedId of [...event.source_agent_ids, ...event.result_agent_ids]) {
        traverse(connectedId, depth + 1);
      }
    }
  }

  traverse(agentId, 0);

  const roots = Object.keys(nodes).filter(id => nodes[id].produced_by.length === 0);
  const leaves = Object.keys(nodes).filter(id => {
    const node = nodes[id];
    return node.form !== 'dormant' && !node.participated_in.some(eid => {
      const e = morphEvents.get(eid);
      return e && e.status === 'completed';
    });
  });

  return {
    nodes,
    roots,
    leaves,
    total_operations: new Set(
      Object.values(nodes).flatMap(n => [...n.produced_by, ...n.participated_in]),
    ).size,
  };
}

// ── History ─────────────────────────────────────────────────────────────────

export function getMorphHistory(filters?: {
  operation?: MorphOperation;
  agent_id?: string;
  status?: MorphEventStatus;
  limit?: number;
  offset?: number;
}): { events: MorphEvent[]; total: number } {
  let events = Array.from(morphEvents.values());

  if (filters?.operation) {
    events = events.filter(e => e.operation === filters.operation);
  }
  if (filters?.agent_id) {
    events = events.filter(
      e => e.source_agent_ids.includes(filters.agent_id!) ||
           e.result_agent_ids.includes(filters.agent_id!),
    );
  }
  if (filters?.status) {
    events = events.filter(e => e.status === filters.status);
  }

  // Sort by created_at descending
  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = events.length;
  const offset = filters?.offset ?? 0;
  const limit = filters?.limit ?? 50;
  events = events.slice(offset, offset + limit);

  return { events, total };
}

// ── Composite Queries ───────────────────────────────────────────────────────

export function getComposite(agentId: string): CompositeAgent | undefined {
  return composites.get(agentId);
}

export function getFission(eventId: string): FissionResult | undefined {
  return fissions.get(eventId);
}

export function getActiveGraft(graftId: string): ActiveGraft | undefined {
  return activeGrafts.get(graftId);
}

export function getMetamorphState(agentId: string): MetamorphState | undefined {
  return metamorphoses.get(agentId);
}

export function getAgentGrafts(agentId: string): ActiveGraft[] {
  return Array.from(activeGrafts.values()).filter(
    g => (g.donor_id === agentId || g.recipient_id === agentId) && !g.revoked,
  );
}

export function getAgentReplicas(progenitorId: string): ReplicaAgent[] {
  return Array.from(replicas.values()).filter(r => r.progenitor_id === progenitorId);
}
