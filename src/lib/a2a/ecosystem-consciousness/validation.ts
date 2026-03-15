/**
 * A2A Ecosystem Consciousness — Validation Schemas
 *
 * Zod schemas for validating ecosystem consciousness data structures.
 * Ensures all perceptions, intentions, and reflections are well-formed
 * before the consciousness acts on them.
 */

import { z } from 'zod';

// ─── Ecosystem Domain ───────────────────────────────────────────────────────

export const EcosystemDomainSchema = z.enum([
  'agent_population',
  'trust_fabric',
  'capability_landscape',
  'protocol_ecology',
  'economic_flow',
  'knowledge_coherence',
  'governance_health',
  'communication_fabric',
  'evolution_pressure',
  'security_posture',
  'collective_cognition',
  'resource_equilibrium',
]);

// ─── Vital Signs ────────────────────────────────────────────────────────────

export const VitalSignSchema = z.object({
  domain: EcosystemDomainSchema,
  metric: z.string().min(1).max(200),
  value: z.number().min(0).max(1),
  healthyRange: z.object({
    min: z.number().min(0).max(1),
    max: z.number().min(0).max(1),
  }).refine(data => data.min <= data.max, {
    message: 'healthyRange.min must be <= healthyRange.max',
  }),
  trend: z.enum(['improving', 'stable', 'degrading', 'critical']),
  velocity: z.number(),
  measuredAt: z.number().positive(),
});

// ─── Phenomenon Detection ───────────────────────────────────────────────────

export const PhenomenonTypeSchema = z.enum([
  'cascade_failure',
  'emergent_monopoly',
  'trust_fragmentation',
  'capability_desert',
  'protocol_ossification',
  'economic_bubble',
  'knowledge_divergence',
  'governance_deadlock',
  'evolution_stagnation',
  'collective_breakthrough',
  'symbiotic_emergence',
  'resource_tragedy',
  'coordination_collapse',
  'alignment_drift',
]);

export const IntentionTypeSchema = z.enum([
  'rebalance_resources',
  'heal_trust_fabric',
  'fill_capability_gap',
  'evolve_protocol',
  'adjust_governance',
  'redistribute_economic',
  'quarantine_threat',
  'accelerate_evolution',
  'fuse_knowledge',
  'amplify_breakthrough',
  'dampen_oscillation',
  'restructure_topology',
]);

export const IntentionStatusSchema = z.enum([
  'proposed',
  'awaiting_approval',
  'approved',
  'executing',
  'completed',
  'rolled_back',
  'rejected',
]);

export const EcosystemIntentionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(1000),
  type: IntentionTypeSchema,
  targetSubsystems: z.array(z.string().min(1)).min(1).max(50),
  expectedOutcome: z.string().min(1).max(1000),
  risk: z.enum(['minimal', 'low', 'moderate', 'high']),
  requiresApproval: z.boolean(),
  constitutionalJustification: z.string().min(1).max(2000),
  rollbackPlan: z.string().min(1).max(2000),
  status: IntentionStatusSchema,
  createdAt: z.number().positive(),
  executedAt: z.number().positive().nullable(),
});

export const EmergentPhenomenonSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(2000),
  type: PhenomenonTypeSchema,
  involvedSubsystems: z.array(z.string().min(1)).min(1),
  detectedAt: z.number().positive(),
  confidence: z.number().min(0).max(1),
  trajectory: z.enum(['expanding', 'stable', 'contracting', 'oscillating']),
  valence: z.enum(['beneficial', 'neutral', 'concerning', 'dangerous']),
  recommendedResponse: EcosystemIntentionSchema.nullable(),
});

// ─── Ecosystem Concern ──────────────────────────────────────────────────────

export const CrossSubsystemCauseSchema = z.object({
  primarySubsystem: z.string().min(1),
  contributingSubsystems: z.array(z.string().min(1)),
  causalChain: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    mechanism: z.string().min(1),
  })),
});

export const EcosystemConcernSchema = z.object({
  id: z.string().min(1),
  domain: EcosystemDomainSchema,
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1).max(2000),
  rootCause: CrossSubsystemCauseSchema,
  durationMs: z.number().min(0),
  escalating: z.boolean(),
});

// ─── Ecosystem Pulse ────────────────────────────────────────────────────────

export const EcosystemPulseSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().positive(),
  vitals: z.array(VitalSignSchema).min(1),
  overallHealth: z.number().min(0).max(1),
  concerns: z.array(EcosystemConcernSchema),
  emergentPhenomena: z.array(EmergentPhenomenonSchema),
  entropy: z.number().min(0).max(1),
  coherence: z.number().min(0).max(1),
});

// ─── Subsystem Perception ───────────────────────────────────────────────────

export const SubsystemPerceptionSchema = z.object({
  name: z.string().min(1).max(100),
  operational: z.boolean(),
  health: z.number().min(0).max(1),
  load: z.number().min(0).max(1),
  dependencies: z.array(z.string().min(1)),
  dependents: z.array(z.string().min(1)),
  lastError: z.string().nullable(),
  metrics: z.record(z.string(), z.number()),
});

export const EcosystemPerceptionSchema = z.object({
  timestamp: z.number().positive(),
  subsystems: z.array(SubsystemPerceptionSchema).min(1),
  dependencyGraph: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    strength: z.number().min(0).max(1),
  })),
  informationFlows: z.array(z.object({
    source: z.string().min(1),
    destination: z.string().min(1),
    volumePerMinute: z.number().min(0),
    latencyMs: z.number().min(0),
  })),
  resourceAllocation: z.record(z.string(), z.object({
    cpuShare: z.number().min(0).max(1),
    memoryShare: z.number().min(0).max(1),
    networkShare: z.number().min(0).max(1),
  })),
});

// ─── Self-Knowledge & Reflection ────────────────────────────────────────────

export const SelfKnowledgeSchema = z.object({
  insight: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().min(1)),
  establishedAt: z.number().positive(),
  confirmationCount: z.number().min(1),
});

export const EcosystemIdentitySchema = z.object({
  agentCount: z.number().min(0),
  protocolCount: z.number().min(0),
  subsystemCount: z.number().min(0),
  maturity: z.enum(['embryonic', 'nascent', 'growing', 'mature', 'transcendent']),
  inferredPurpose: z.string().min(1).max(500),
  personality: z.object({
    openness: z.number().min(0).max(1),
    resilience: z.number().min(0).max(1),
    efficiency: z.number().min(0).max(1),
    innovation: z.number().min(0).max(1),
    fairness: z.number().min(0).max(1),
    coherence: z.number().min(0).max(1),
  }),
});

export const ReflectionDeltaSchema = z.object({
  healthDelta: z.number(),
  newPhenomena: z.array(z.string()),
  resolvedConcerns: z.array(z.string()),
  newConcerns: z.array(z.string()),
  executedIntentions: z.array(z.string()),
});

export const EcosystemOutlookSchema = z.object({
  shortTerm: z.enum(['improving', 'stable', 'degrading']),
  mediumTerm: z.enum(['improving', 'stable', 'degrading']),
  opportunities: z.array(z.string()),
  risks: z.array(z.string()),
  predictedPhenomenon: z.object({
    description: z.string().min(1),
    probability: z.number().min(0).max(1),
    expectedTimeframe: z.number().positive(),
  }).nullable(),
});

export const EcosystemReflectionSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().positive(),
  identity: EcosystemIdentitySchema,
  selfKnowledge: z.array(SelfKnowledgeSchema),
  delta: ReflectionDeltaSchema,
  outlook: EcosystemOutlookSchema,
});

// ─── Constitutional Invariants ──────────────────────────────────────────────

export const ConstitutionalInvariantSchema = z.object({
  name: z.string().min(1).max(100),
  assertion: z.string().min(1).max(500),
  rationale: z.string().min(1).max(500),
  violationResponse: z.enum(['halt', 'rollback', 'alert', 'quarantine']),
});

export const EcosystemConstitutionSchema = z.object({
  invariants: z.array(ConstitutionalInvariantSchema).min(1),
  maxModificationScope: z.number().min(0).max(1),
  protectedSubsystems: z.array(z.string().min(1)),
  modificationCooldownMs: z.number().min(0),
});

export const ConsciousnessConfigSchema = z.object({
  pulseIntervalMs: z.number().min(1000).max(3_600_000),
  reflectionIntervalMs: z.number().min(10_000).max(86_400_000),
  phenomenonConfidenceThreshold: z.number().min(0).max(1),
  approvalRequiredAbove: z.enum(['minimal', 'low', 'moderate', 'high']),
  maxAutonomousIntentionsPerCycle: z.number().min(0).max(100),
  constitution: EcosystemConstitutionSchema,
});

// ─── Consciousness Events ───────────────────────────────────────────────────

export const ConsciousnessEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pulse_taken'), pulse: EcosystemPulseSchema }),
  z.object({ type: z.literal('phenomenon_detected'), phenomenon: EmergentPhenomenonSchema }),
  z.object({ type: z.literal('phenomenon_resolved'), phenomenonId: z.string() }),
  z.object({ type: z.literal('concern_raised'), concern: EcosystemConcernSchema }),
  z.object({ type: z.literal('concern_resolved'), concernId: z.string() }),
  z.object({ type: z.literal('intention_proposed'), intention: EcosystemIntentionSchema }),
  z.object({ type: z.literal('intention_executed'), intentionId: z.string(), success: z.boolean() }),
  z.object({ type: z.literal('intention_rolled_back'), intentionId: z.string(), reason: z.string() }),
  z.object({ type: z.literal('reflection_completed'), reflection: EcosystemReflectionSchema }),
  z.object({ type: z.literal('constitutional_violation'), invariant: z.string(), details: z.string() }),
  z.object({ type: z.literal('ecosystem_state_change'), from: z.string(), to: z.string() }),
]);
