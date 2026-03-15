/**
 * A2A Agent Genome — Request Validation Schemas
 */

import { z } from 'zod';

// ─── Shared Enums ───────────────────────────────────────────────────────────

const reasoningStrategies = [
  'chain_of_thought', 'tree_of_thought', 'graph_of_thought', 'debate',
  'ensemble', 'metacognitive', 'analogical', 'abductive',
] as const;

const learningModes = [
  'in_context', 'few_shot', 'reinforcement', 'imitation',
  'curriculum', 'self_supervised', 'collaborative',
] as const;

const capabilityMaturities = [
  'nascent', 'developing', 'proficient', 'expert', 'mastered',
] as const;

const capabilityProvenanceTypes = [
  'innate', 'learned', 'transferred', 'evolved', 'composed',
] as const;

const constitutionalPrinciples = [
  'harm_prevention', 'truthfulness', 'privacy_preservation', 'fairness',
  'transparency', 'human_oversight', 'resource_stewardship', 'cooperation',
  'reversibility', 'scope_limitation',
] as const;

const constraintEnforcements = ['hard', 'soft', 'advisory'] as const;

const messageEncodings = ['json', 'protobuf', 'msgpack', 'cbor'] as const;

const channelTypes = ['pipe', 'message_queue', 'shared_memory', 'signal', 'broadcast'] as const;

const derivationTypes = [
  'original', 'fork', 'evolution', 'merge', 'patch', 'metamorphosis',
] as const;

const signatureAlgorithms = ['ed25519', 'ecdsa-p256', 'rsa-pss-4096'] as const;

const mutationTypes = [
  'capability_added', 'capability_removed', 'capability_modified',
  'constraint_added', 'constraint_removed', 'constraint_modified',
  'resource_changed', 'protocol_changed', 'architecture_changed',
  'constitution_amended',
] as const;

// ─── Sub-schemas ────────────────────────────────────────────────────────────

const validationEvidenceSchema = z.object({
  type: z.enum(['benchmark', 'real_world', 'peer_review', 'formal_proof', 'simulation']),
  score: z.number().min(0).max(1),
  validatedAt: z.string().datetime(),
  artifactRef: z.string().min(1),
});

const capabilityProvenanceSchema = z.object({
  type: z.enum(capabilityProvenanceTypes),
  sourceAgentId: z.string().uuid().nullable(),
  sourceGenomeHash: z.string().nullable(),
  acquiredAt: z.string().datetime(),
  validationResults: z.array(validationEvidenceSchema),
});

const capabilityGeneSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  description: z.string().min(1).max(2000),
  maturity: z.enum(capabilityMaturities),
  performanceScore: z.number().min(0).max(1),
  requiredSubsystems: z.array(z.string()),
  dependencies: z.array(z.string()),
  conflicts: z.array(z.string()),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  latencyBudgetMs: z.number().positive(),
  delegable: z.boolean(),
  provenance: capabilityProvenanceSchema,
});

const cognitiveArchitectureSchema = z.object({
  primaryReasoning: z.enum(reasoningStrategies),
  fallbackStrategies: z.array(z.enum(reasoningStrategies)),
  learningModes: z.array(z.enum(learningModes)).min(1),
  maxReasoningDepth: z.number().int().positive().max(100),
  workingMemorySlots: z.number().int().positive().max(1000),
  attentionHorizon: z.number().int().positive(),
  debiasing: z.array(z.string()),
  domains: z.array(z.string()).min(1),
});

const constitutionalExceptionSchema = z.object({
  condition: z.string().min(1),
  authorizedBy: z.string().min(1),
  expiresAt: z.string().datetime().nullable(),
});

const constitutionalConstraintSchema = z.object({
  id: z.string().min(1).max(128),
  principle: z.enum(constitutionalPrinciples),
  rule: z.string().min(1).max(1000),
  formalSpec: z.string().min(1),
  enforcement: z.enum(constraintEnforcements),
  priority: z.number().int().min(0).max(1000),
  exceptions: z.array(constitutionalExceptionSchema),
});

const constitutionalDnaSchema = z.object({
  principles: z.array(z.enum(constitutionalPrinciples)).min(1),
  constraints: z.array(constitutionalConstraintSchema),
  maxAutonomy: z.number().min(0).max(1),
  escalationThreshold: z.number().min(0).max(1),
  selfModifiable: z.boolean(),
  constitutionHash: z.string().min(1),
});

const resourceProfileSchema = z.object({
  cpuMs: z.number().positive(),
  memoryBytes: z.number().positive(),
  ipcPerMinute: z.number().int().nonnegative(),
  maxChildren: z.number().int().nonnegative(),
  apiCalls: z.number().int().nonnegative(),
  storageBytes: z.number().nonnegative(),
});

const scalingPolicySchema = z.object({
  metric: z.enum(['cpu', 'memory', 'ipc', 'latency', 'queue_depth']),
  scaleUpThreshold: z.number().min(0).max(1),
  scaleDownThreshold: z.number().min(0).max(1),
  cooldownMs: z.number().positive(),
});

const resourceRequirementsSchema = z.object({
  minimum: resourceProfileSchema,
  recommended: resourceProfileSchema,
  maximum: resourceProfileSchema,
  elasticScaling: z.boolean(),
  scalingPolicy: scalingPolicySchema.nullable(),
});

const messageTypeDescriptorSchema = z.object({
  tag: z.string().min(1),
  description: z.string().min(1),
  schema: z.record(z.unknown()),
});

const communicationProtocolSchema = z.object({
  encodings: z.array(z.enum(messageEncodings)).min(1),
  channelTypes: z.array(z.enum(channelTypes)).min(1),
  emits: z.array(messageTypeDescriptorSchema),
  consumes: z.array(messageTypeDescriptorSchema),
  maxMessageSize: z.number().positive(),
  defaultTimeoutMs: z.number().positive(),
  streaming: z.boolean(),
  backpressureStrategy: z.enum(['drop_oldest', 'drop_newest', 'block', 'buffer']),
});

const genomeMutationSchema = z.object({
  type: z.enum(mutationTypes),
  path: z.string().min(1),
  description: z.string().min(1),
  reason: z.string().min(1),
  appliedBy: z.string().min(1),
  appliedAt: z.string().datetime(),
});

const fitnessMetricsSchema = z.object({
  overall: z.number().min(0).max(1),
  taskSuccessRate: z.number().min(0).max(1),
  responseQuality: z.number().min(0).max(1),
  resourceEfficiency: z.number().min(0).max(1),
  cooperationScore: z.number().min(0).max(1),
  safetyScore: z.number().min(0).max(1),
  sampleSize: z.number().int().nonnegative(),
  computedAt: z.string().datetime(),
});

const genomeLineageSchema = z.object({
  parentHash: z.string().nullable(),
  ancestors: z.array(z.string()),
  derivation: z.enum(derivationTypes),
  mutations: z.array(genomeMutationSchema),
  fitnessAtCreation: fitnessMetricsSchema,
  deprecated: z.boolean(),
  replacedBy: z.string().nullable(),
});

const compositionRoleSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  exposedCapabilities: z.array(z.string()),
  requiredFromPeers: z.array(z.string()),
});

const genomeCompatibilitySchema = z.object({
  lineageId: z.string().uuid(),
  versionRange: z.string().min(1),
  compatibilityScore: z.number().min(0).max(1),
  lastValidated: z.string().datetime(),
});

const genomeIncompatibilitySchema = z.object({
  lineageId: z.string().uuid(),
  reason: z.string().min(1),
  severity: z.enum(['warning', 'error', 'critical']),
});

const compositionRulesSchema = z.object({
  composable: z.boolean(),
  roles: z.array(compositionRoleSchema),
  compatibleWith: z.array(genomeCompatibilitySchema),
  incompatibleWith: z.array(genomeIncompatibilitySchema),
  maxCompositionSize: z.number().int().positive(),
  canOrchestrate: z.boolean(),
  canBeOrchestrated: z.boolean(),
});

const genomeSignatureSchema = z.object({
  algorithm: z.enum(signatureAlgorithms),
  publicKey: z.string().min(1),
  signature: z.string().min(1),
  signerId: z.string().min(1),
  signedAt: z.string().datetime(),
  signedHash: z.string().min(1),
  certificateChain: z.array(z.string()),
});

const genomeIdentitySchema = z.object({
  hash: z.string().min(1),
  name: z.string().min(1).max(256),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  specVersion: z.string().regex(/^\d+\.\d+\.\d+/),
  lineageId: z.string().uuid(),
  generation: z.number().int().nonnegative(),
  author: z.string().min(1).max(256),
  createdAt: z.string().datetime(),
  description: z.string().max(2000),
  tags: z.array(z.string().max(64)),
  license: z.string().min(1).max(128),
});

// ─── Complete Genome Schema ─────────────────────────────────────────────────

export const agentGenomeSchema = z.object({
  identity: genomeIdentitySchema,
  cognitiveArchitecture: cognitiveArchitectureSchema,
  capabilities: z.array(capabilityGeneSchema),
  constitution: constitutionalDnaSchema,
  resources: resourceRequirementsSchema,
  protocol: communicationProtocolSchema,
  lineage: genomeLineageSchema,
  composition: compositionRulesSchema,
  signatures: z.array(genomeSignatureSchema),
  extensions: z.record(z.unknown()),
});

// ─── Request Schemas ────────────────────────────────────────────────────────

export const registerGenomeSchema = z.object({
  genome: agentGenomeSchema,
});

export const getGenomeSchema = z.object({
  hash: z.string().min(1).optional(),
  lineageId: z.string().uuid().optional(),
  version: z.string().optional(),
}).refine(
  (data) => data.hash || data.lineageId,
  { message: 'Either hash or lineageId must be provided' },
);

export const searchGenomesSchema = z.object({
  query: z.string().max(500).optional(),
  tags: z.array(z.string().max(64)).optional(),
  author: z.string().max(256).optional(),
  capabilityId: z.string().max(128).optional(),
  minFitness: z.number().min(0).max(1).optional(),
  verificationStatus: z.enum(['unverified', 'signature_valid', 'audited', 'certified']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export const diffGenomesSchema = z.object({
  fromHash: z.string().min(1),
  toHash: z.string().min(1),
});

export const validateGenomeSchema = z.object({
  genome: agentGenomeSchema,
});

export const verifySignatureSchema = z.object({
  genomeHash: z.string().min(1),
  signatureIndex: z.number().int().nonnegative(),
});

export const getLineageSchema = z.object({
  lineageId: z.string().uuid(),
  maxDepth: z.number().int().positive().max(100).default(50),
});

export const instantiateGenomeSchema = z.object({
  genomeHash: z.string().min(1),
  envOverrides: z.record(z.string()).optional(),
  resourceOverrides: resourceProfileSchema.partial().optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low', 'idle']).optional(),
  labels: z.record(z.string()).optional(),
  parentPid: z.string().uuid().optional(),
});
