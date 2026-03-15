/**
 * Universal Agent Protocol Bridge — Zod Validation Schemas
 */

import { z } from 'zod';

// ── Shared enums ──

const protocolFamilySchema = z.enum([
  'rareagent', 'google_a2a', 'openai_agents', 'langchain',
  'autogen', 'oasf', 'mcp', 'custom',
]);

const wireFormatSchema = z.enum(['json', 'json-rpc', 'protobuf', 'msgpack', 'sse', 'graphql']);

const authMethodSchema = z.enum([
  'bearer_token', 'api_key', 'oauth2', 'mtls', 'signed_envelope', 'none',
]);

const adapterStatusSchema = z.enum(['active', 'deprecated', 'experimental', 'disabled']);

// ── Sub-schemas ──

const detectionPatternSchema = z.object({
  type: z.enum(['header', 'body_field', 'url_pattern', 'content_type']),
  key: z.string().min(1),
  pattern: z.string().min(1),
  weight: z.number().min(0).max(10),
});

const payloadTransformSchema = z.object({
  field_map: z.record(z.string()),
  defaults: z.record(z.unknown()).optional(),
  strip: z.array(z.string()).optional(),
  template: z.string().optional(),
});

const capabilityMappingSchema = z.object({
  external_id: z.string().min(1),
  internal_id: z.string().min(1),
  input_transform: payloadTransformSchema.optional(),
  output_transform: payloadTransformSchema.optional(),
});

const stateMappingSchema = z.object({
  external_state: z.string().min(1),
  internal_state: z.string().min(1),
  lossy: z.boolean(),
  notes: z.string().optional(),
});

const protocolPreferenceSchema = z.object({
  protocol: protocolFamilySchema,
  version: z.string().min(1),
  wire_format: wireFormatSchema,
  priority: z.number().int().min(1),
});

// ── API Schemas ──

export const registerAdapterSchema = z.object({
  protocol: protocolFamilySchema,
  version: z.string().min(1).max(20),
  display_name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  supported_wire_formats: z.array(wireFormatSchema).min(1),
  supported_auth_methods: z.array(authMethodSchema).min(1),
  detection_patterns: z.array(detectionPatternSchema).min(1).max(20),
  capability_map: z.array(capabilityMappingSchema).max(200),
  state_map: z.array(stateMappingSchema).min(1).max(50),
  bidirectional: z.boolean(),
  supports_streaming: z.boolean(),
});
export type RegisterAdapterInput = z.infer<typeof registerAdapterSchema>;

export const listAdaptersSchema = z.object({
  protocol: protocolFamilySchema.optional(),
  status: adapterStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListAdaptersInput = z.infer<typeof listAdaptersSchema>;

export const detectProtocolSchema = z.object({
  headers: z.record(z.string()),
  body: z.string().max(100_000),
  url: z.string().optional(),
  content_type: z.string().optional(),
});
export type DetectProtocolInput = z.infer<typeof detectProtocolSchema>;

export const translateMessageSchema = z.object({
  source_protocol: z.union([protocolFamilySchema, z.literal('auto')]),
  target_protocol: protocolFamilySchema,
  message: z.string().min(1).max(500_000),
  session_id: z.string().uuid().optional(),
  source_adapter_id: z.string().uuid().optional(),
  target_adapter_id: z.string().uuid().optional(),
});
export type TranslateMessageInput = z.infer<typeof translateMessageSchema>;

export const startNegotiationSchema = z.object({
  initiator_agent_id: z.string().min(1),
  responder_agent_id: z.string().min(1),
  initiator_protocols: z.array(protocolPreferenceSchema).min(1).max(10),
});
export type StartNegotiationInput = z.infer<typeof startNegotiationSchema>;

export const respondNegotiationSchema = z.object({
  responder_protocols: z.array(protocolPreferenceSchema).min(1).max(10),
});
export type RespondNegotiationInput = z.infer<typeof respondNegotiationSchema>;

export const createSessionSchema = z.object({
  agent_a_id: z.string().min(1),
  agent_b_id: z.string().min(1),
  agent_a_protocol: protocolFamilySchema,
  agent_b_protocol: protocolFamilySchema,
  ttl_minutes: z.number().int().min(1).max(1440).default(60),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const sessionMessageSchema = z.object({
  sender_agent_id: z.string().min(1),
  message: z.string().min(1).max(500_000),
});
export type SessionMessageInput = z.infer<typeof sessionMessageSchema>;

export const listSessionsSchema = z.object({
  agent_id: z.string().optional(),
  status: z.enum(['active', 'paused', 'expired', 'closed']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListSessionsInput = z.infer<typeof listSessionsSchema>;
