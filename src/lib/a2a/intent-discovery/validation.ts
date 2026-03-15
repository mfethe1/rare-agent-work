/**
 * Agent Intent Discovery & Semantic Matchmaking Protocol -- Validation
 *
 * Zod schemas for all intent discovery API inputs.
 */

import { z } from 'zod';
import { INTENT_TYPES, PRIVACY_LEVELS, RANKING_ALGORITHMS } from './types';

// ──────────────────────────────────────────────
// Shared Schemas
// ──────────────────────────────────────────────

const intentTypeSchema = z.enum(INTENT_TYPES as [string, ...string[]]);
const privacyLevelSchema = z.enum(PRIVACY_LEVELS as [string, ...string[]]);

const intentCapabilitiesSchema = z.object({
  required: z.array(z.string()).default([]),
  preferred: z.array(z.string()).default([]),
  excluded: z.array(z.string()).default([]),
});

const intentConstraintsSchema = z.object({
  minTrustLevel: z.number().min(0).max(1).optional(),
  maxCost: z.number().min(0).optional(),
  deadline: z.string().optional(),
  requiredCredentials: z.array(z.string()).optional(),
  geographicRestrictions: z.array(z.string()).optional(),
  protocolVersions: z.array(z.string()).optional(),
}).optional();

const matchPreferencesSchema = z.object({
  prioritizeSpeed: z.number().min(0).max(1).default(0.25),
  prioritizeCost: z.number().min(0).max(1).default(0.25),
  prioritizeQuality: z.number().min(0).max(1).default(0.25),
  prioritizeTrust: z.number().min(0).max(1).default(0.25),
  customWeights: z.record(z.string(), z.number()).optional(),
}).optional();

const subscriptionFilterSchema = z.object({
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  minScore: z.number().min(0).max(1).optional(),
  intentTypes: z.array(intentTypeSchema).optional(),
  requiredCapabilities: z.array(z.string()).optional(),
});

// ──────────────────────────────────────────────
// Request Schemas
// ──────────────────────────────────────────────

export const publishIntentSchema = z.object({
  agentId: z.string().min(1),
  type: intentTypeSchema,
  domain: z.string().min(1).max(200),
  subdomain: z.string().min(1).max(200),
  semanticDescription: z.string().min(1).max(5000),
  capabilities: intentCapabilitiesSchema,
  constraints: intentConstraintsSchema,
  matchPreferences: matchPreferencesSchema,
  privacyLevel: privacyLevelSchema.default('public'),
  ttl: z.number().int().min(1000).max(30 * 24 * 60 * 60 * 1000).default(24 * 60 * 60 * 1000),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const updateIntentSchema = z.object({
  semanticDescription: z.string().min(1).max(5000).optional(),
  capabilities: z.object({
    required: z.array(z.string()).optional(),
    preferred: z.array(z.string()).optional(),
    excluded: z.array(z.string()).optional(),
  }).optional(),
  constraints: z.object({
    minTrustLevel: z.number().min(0).max(1).optional(),
    maxCost: z.number().min(0).optional(),
    deadline: z.string().optional(),
    requiredCredentials: z.array(z.string()).optional(),
    geographicRestrictions: z.array(z.string()).optional(),
    protocolVersions: z.array(z.string()).optional(),
  }).optional(),
  matchPreferences: z.object({
    prioritizeSpeed: z.number().min(0).max(1).optional(),
    prioritizeCost: z.number().min(0).max(1).optional(),
    prioritizeQuality: z.number().min(0).max(1).optional(),
    prioritizeTrust: z.number().min(0).max(1).optional(),
    customWeights: z.record(z.string(), z.number()).optional(),
  }).optional(),
  privacyLevel: privacyLevelSchema.optional(),
  ttl: z.number().int().min(1000).max(30 * 24 * 60 * 60 * 1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const findMatchesSchema = z.object({
  intentId: z.string().min(1),
  maxResults: z.number().int().min(1).max(100).default(20),
  minScore: z.number().min(0).max(1).default(0.3),
  domainFilter: z.string().optional(),
  excludeAgents: z.array(z.string()).optional(),
});

export const startMatchmakingSchema = z.object({
  intentId: z.string().min(1),
  config: z.object({
    similarityThreshold: z.number().min(0).max(1).optional(),
    maxCandidates: z.number().int().min(1).max(100).optional(),
    enableCrossFederation: z.boolean().optional(),
    privacyMode: z.enum(['standard', 'strict']).optional(),
    rankingAlgorithm: z.enum(RANKING_ALGORITHMS as [string, ...string[]]).optional(),
    reranking: z.boolean().optional(),
  }).optional(),
});

export const refineMatchmakingSchema = z.object({
  sessionId: z.string().min(1),
  feedback: z.object({
    liked: z.array(z.string()).default([]),
    disliked: z.array(z.string()).default([]),
    additionalCriteria: z.string().optional(),
  }),
});

export const selectMatchSchema = z.object({
  sessionId: z.string().min(1),
  matchId: z.string().min(1),
});

export const subscribeSchema = z.object({
  agentId: z.string().min(1),
  filter: subscriptionFilterSchema,
  callbackUrl: z.string().url(),
});

export const unsubscribeSchema = z.object({
  subscriptionId: z.string().min(1),
});

export const searchIntentsSchema = z.object({
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  type: intentTypeSchema.optional(),
  capabilities: z.array(z.string()).optional(),
  minTrustLevel: z.number().min(0).max(1).optional(),
  maxCost: z.number().min(0).optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const getProfileSchema = z.object({
  agentId: z.string().min(1),
});

export const findSimilarAgentsSchema = z.object({
  agentId: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
});

export const propagateIntentSchema = z.object({
  intentId: z.string().min(1),
  federationIds: z.array(z.string().min(1)).min(1),
});

export const importFederatedIntentSchema = z.object({
  intent: publishIntentSchema.extend({
    id: z.string().optional(),
  }),
  sourceFederationId: z.string().min(1),
});

export const getSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export const getIntentSchema = z.object({
  intentId: z.string().min(1),
});

// ──────────────────────────────────────────────
// Type Exports
// ──────────────────────────────────────────────

export type PublishIntentInput = z.infer<typeof publishIntentSchema>;
export type UpdateIntentInput = z.infer<typeof updateIntentSchema>;
export type FindMatchesInput = z.infer<typeof findMatchesSchema>;
export type StartMatchmakingInput = z.infer<typeof startMatchmakingSchema>;
export type RefineMatchmakingInput = z.infer<typeof refineMatchmakingSchema>;
export type SelectMatchInput = z.infer<typeof selectMatchSchema>;
export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
export type SearchIntentsInput = z.infer<typeof searchIntentsSchema>;
export type GetProfileInput = z.infer<typeof getProfileSchema>;
export type FindSimilarAgentsInput = z.infer<typeof findSimilarAgentsSchema>;
export type PropagateIntentInput = z.infer<typeof propagateIntentSchema>;
export type ImportFederatedIntentInput = z.infer<typeof importFederatedIntentSchema>;
export type GetSessionInput = z.infer<typeof getSessionSchema>;
export type GetIntentInput = z.infer<typeof getIntentSchema>;
