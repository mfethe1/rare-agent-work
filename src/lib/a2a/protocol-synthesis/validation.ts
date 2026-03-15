/**
 * A2A Emergent Protocol Synthesis — Validation Schemas
 */

import { z } from 'zod';

// ─── Shared Schemas ──────────────────────────────────────────────────────────

const protocolMessageTypeSchema = z.object({
  name: z.string().min(1).max(128),
  schema: z.record(z.unknown()),
  description: z.string().min(1).max(1024),
  required: z.boolean(),
});

const stateInvariantSchema = z.object({
  description: z.string().min(1).max(512),
  expression: z.string().min(1).max(512),
  severity: z.enum(['warning', 'error', 'critical']),
});

const protocolStateSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(512),
  initial: z.boolean(),
  terminal: z.boolean(),
  invariants: z.array(stateInvariantSchema).default([]),
});

const protocolTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  trigger: z.string().min(1),
  sender: z.string().min(1),
  guard: z.string().optional(),
  effects: z.array(z.string()).optional(),
  timeout: z.number().positive().optional(),
});

const protocolRoleSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(512),
  requiredCapabilities: z.array(z.string()),
  canSend: z.array(z.string()),
  canReceive: z.array(z.string()),
  cardinality: z.object({
    min: z.number().int().min(0),
    max: z.number().int().min(1),
  }),
});

const constitutionalConstraintSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    'safety', 'privacy', 'fairness', 'transparency',
    'termination', 'resource_bound', 'no_covert_channel',
  ]),
  description: z.string().min(1).max(1024),
  formalSpec: z.string().min(1).max(512),
  mandatory: z.boolean(),
});

const evolutionDriverSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('low_success_rate'), currentRate: z.number(), targetRate: z.number() }),
  z.object({ type: z.literal('high_latency'), currentMs: z.number(), targetMs: z.number() }),
  z.object({ type: z.literal('frequent_timeout'), timeoutRate: z.number() }),
  z.object({ type: z.literal('participant_feedback'), feedbackSummary: z.string() }),
  z.object({ type: z.literal('security_patch'), vulnerabilityId: z.string() }),
  z.object({ type: z.literal('capability_expansion'), newCapabilities: z.array(z.string()) }),
]);

const protocolCategorySchema = z.enum([
  'coordination', 'negotiation', 'data_exchange', 'consensus',
  'streaming', 'challenge', 'auction', 'delegation', 'composite',
]);

const synthesisStrategySchema = z.enum([
  'gap_detection', 'composition', 'refinement',
  'negotiation', 'evolution', 'template',
]);

// ─── API Request Schemas ─────────────────────────────────────────────────────

export const startSynthesisSchema = z.object({
  strategy: synthesisStrategySchema,
  participantAgentIds: z.array(z.string().min(1)).min(1).max(32),
  problemStatement: z.string().min(10).max(4096),
  constraints: z.array(constitutionalConstraintSchema).optional(),
  composeFrom: z.array(z.string()).optional(),
  refineProtocolId: z.string().optional(),
  templateId: z.string().optional(),
  templateParams: z.record(z.unknown()).optional(),
  evolveProtocolId: z.string().optional(),
}).refine(
  (data) => {
    if (data.strategy === 'composition' && (!data.composeFrom || data.composeFrom.length < 2)) {
      return false;
    }
    if (data.strategy === 'refinement' && !data.refineProtocolId) return false;
    if (data.strategy === 'template' && !data.templateId) return false;
    if (data.strategy === 'evolution' && !data.evolveProtocolId) return false;
    return true;
  },
  { message: 'Missing required fields for the selected synthesis strategy' }
);

export const submitProposalSchema = z.object({
  sessionId: z.string().min(1),
  proposerAgentId: z.string().min(1),
  protocol: z.object({
    version: z.string().min(1),
    name: z.string().min(1).max(256),
    description: z.string().min(1).max(4096),
    category: protocolCategorySchema,
    synthesizedBy: z.array(z.string()),
    synthesisSessionId: z.string(),
    parentProtocolId: z.string().optional(),
    roles: z.array(protocolRoleSchema).min(1),
    messageTypes: z.array(protocolMessageTypeSchema).min(1),
    states: z.array(protocolStateSchema).min(2), // At least initial + terminal
    transitions: z.array(protocolTransitionSchema).min(1),
    constitutionalConstraints: z.array(constitutionalConstraintSchema).default([]),
    verificationResult: z.any().optional(),
    approvals: z.array(z.any()).default([]),
    composedFrom: z.array(z.string()).default([]),
    compatibleWith: z.array(z.string()).default([]),
  }),
});

export const voteOnProposalSchema = z.object({
  sessionId: z.string().min(1),
  proposalId: z.string().min(1),
  agentId: z.string().min(1),
  vote: z.enum(['approve', 'reject', 'amend']),
  reason: z.string().min(1).max(2048),
  amendments: z.record(z.unknown()).optional(),
});

export const verifyProtocolSchema = z.object({
  protocolId: z.string().min(1),
  additionalConstraints: z.array(constitutionalConstraintSchema).optional(),
});

export const detectGapsSchema = z.object({
  agentIds: z.array(z.string().min(1)).min(1),
  interactionDescription: z.string().min(10).max(4096),
  failureDetails: z.string().min(1).max(4096),
});

export const evolveProtocolSchema = z.object({
  protocolId: z.string().min(1),
  drivers: z.array(evolutionDriverSchema).min(1),
  maxMutations: z.number().int().min(1).max(20).optional(),
});

export const listProtocolsSchema = z.object({
  category: protocolCategorySchema.optional(),
  status: z.enum([
    'draft', 'proposed', 'under_review', 'verified',
    'approved', 'active', 'deprecated', 'revoked',
  ]).optional(),
  synthesizedBy: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const approveProtocolSchema = z.object({
  protocolId: z.string().min(1),
  approverAgentId: z.string().min(1),
  conditions: z.array(z.string()).optional(),
});

export const deprecateProtocolSchema = z.object({
  protocolId: z.string().min(1),
  reason: z.string().min(1).max(2048),
  replacementId: z.string().optional(),
});

export const revokeProtocolSchema = z.object({
  protocolId: z.string().min(1),
  reason: z.string().min(1).max(2048),
  violationId: z.string().optional(),
});

export const instantiateTemplateSchema = z.object({
  templateId: z.string().min(1),
  params: z.record(z.unknown()),
  participantAgentIds: z.array(z.string().min(1)).min(1),
});

// ─── Type Exports ────────────────────────────────────────────────────────────

export type StartSynthesisInput = z.infer<typeof startSynthesisSchema>;
export type SubmitProposalInput = z.infer<typeof submitProposalSchema>;
export type VoteOnProposalInput = z.infer<typeof voteOnProposalSchema>;
export type VerifyProtocolInput = z.infer<typeof verifyProtocolSchema>;
export type DetectGapsInput = z.infer<typeof detectGapsSchema>;
export type EvolveProtocolInput = z.infer<typeof evolveProtocolSchema>;
export type ListProtocolsInput = z.infer<typeof listProtocolsSchema>;
export type ApproveProtocolInput = z.infer<typeof approveProtocolSchema>;
export type DeprecateProtocolInput = z.infer<typeof deprecateProtocolSchema>;
export type RevokeProtocolInput = z.infer<typeof revokeProtocolSchema>;
export type InstantiateTemplateInput = z.infer<typeof instantiateTemplateSchema>;
