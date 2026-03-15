/**
 * Universal Agent Protocol Bridge — Type Definitions
 *
 * Enables rareagent.work to communicate with agents running on any protocol:
 * Google A2A, OpenAI Agents API, LangChain/LangGraph, Microsoft AutoGen,
 * OASF (Open Agent Schema Framework), and custom protocols.
 *
 * The bridge auto-detects inbound protocol format, translates to the internal
 * canonical representation, routes to the appropriate handler, and translates
 * the response back to the caller's native protocol.
 *
 * Think of it as "HTTP content negotiation" but for entire agent protocols.
 */

// ────────────────────────────────────────────────────────────────
// Protocol Family Registry
// ────────────────────────────────────────────────────────────────

/** Known agent protocol families. Extensible via custom adapters. */
export type ProtocolFamily =
  | 'rareagent'        // Native rareagent.work A2A protocol
  | 'google_a2a'       // Google Agent-to-Agent Protocol (JSON-RPC based)
  | 'openai_agents'    // OpenAI Agents API (REST + SSE streaming)
  | 'langchain'        // LangChain / LangGraph agent protocol
  | 'autogen'          // Microsoft AutoGen multi-agent framework
  | 'oasf'             // Open Agent Schema Framework
  | 'mcp'              // Model Context Protocol (Anthropic)
  | 'custom';          // User-defined protocol with custom adapter

/** Protocol version following semver. */
export type ProtocolVersion = `${number}.${number}.${number}` | string;

/** Wire format for protocol messages. */
export type WireFormat = 'json' | 'json-rpc' | 'protobuf' | 'msgpack' | 'sse' | 'graphql';

/** Authentication method used by the external protocol. */
export type ExternalAuthMethod =
  | 'bearer_token'
  | 'api_key'
  | 'oauth2'
  | 'mtls'
  | 'signed_envelope'  // Our identity protocol
  | 'none';

// ────────────────────────────────────────────────────────────────
// Protocol Adapter Registration
// ────────────────────────────────────────────────────────────────

/** Registered protocol adapter — the translation layer for one protocol family. */
export interface ProtocolAdapter {
  id: string;
  protocol: ProtocolFamily;
  version: ProtocolVersion;
  display_name: string;
  description: string;

  /** Wire formats this adapter can read. */
  supported_wire_formats: WireFormat[];
  /** Authentication methods this adapter handles. */
  supported_auth_methods: ExternalAuthMethod[];

  /** Endpoint patterns this adapter recognizes (for auto-detection). */
  detection_patterns: DetectionPattern[];

  /** Capability mapping rules: how external capabilities map to our taxonomy. */
  capability_map: CapabilityMapping[];

  /** Task lifecycle state mapping. */
  state_map: StateMapping[];

  /** Whether this adapter supports bidirectional communication. */
  bidirectional: boolean;
  /** Whether this adapter supports streaming responses. */
  supports_streaming: boolean;

  /** Status of the adapter. */
  status: AdapterStatus;
  created_at: string;
  updated_at: string;
}

export type AdapterStatus = 'active' | 'deprecated' | 'experimental' | 'disabled';

/** Pattern used to auto-detect which protocol an inbound request uses. */
export interface DetectionPattern {
  /** What to check: header, body field, URL pattern, or content type. */
  type: 'header' | 'body_field' | 'url_pattern' | 'content_type';
  /** The key/path to check (e.g., "jsonrpc" for body field, "Content-Type" for header). */
  key: string;
  /** Expected value or regex pattern. */
  pattern: string;
  /** How important this signal is (higher = more weight). */
  weight: number;
}

/** Maps an external capability name/schema to our internal taxonomy. */
export interface CapabilityMapping {
  /** External capability identifier (e.g., Google A2A skill name). */
  external_id: string;
  /** Our internal capability ID. */
  internal_id: string;
  /** Transform rules for input/output payloads. */
  input_transform?: PayloadTransform;
  output_transform?: PayloadTransform;
}

/** Transform rule for converting between external and internal payload shapes. */
export interface PayloadTransform {
  /** JSONPath-style field mappings: { "target.field": "source.field" } */
  field_map: Record<string, string>;
  /** Fields to inject with static values. */
  defaults?: Record<string, unknown>;
  /** Fields to strip from the payload. */
  strip?: string[];
  /** Optional Handlebars-style template for complex transforms. */
  template?: string;
}

/** Maps external task/agent states to our internal lifecycle states. */
export interface StateMapping {
  external_state: string;
  internal_state: string;
  /** Whether this transition is lossy (information lost in translation). */
  lossy: boolean;
  /** Notes about semantic differences. */
  notes?: string;
}

// ────────────────────────────────────────────────────────────────
// Protocol Detection & Negotiation
// ────────────────────────────────────────────────────────────────

/** Result of auto-detecting which protocol an inbound message uses. */
export interface DetectionResult {
  /** Most likely protocol. */
  detected_protocol: ProtocolFamily;
  /** Confidence score 0-1. */
  confidence: number;
  /** All candidates with scores. */
  candidates: DetectionCandidate[];
  /** Which adapter to use. */
  adapter_id: string | null;
  /** Signals that contributed to the detection. */
  matched_patterns: MatchedPattern[];
}

export interface DetectionCandidate {
  protocol: ProtocolFamily;
  adapter_id: string;
  score: number;
}

export interface MatchedPattern {
  adapter_id: string;
  pattern: DetectionPattern;
  matched_value: string;
}

/** Negotiation request: two agents agree on which protocol to use. */
export interface ProtocolNegotiation {
  id: string;
  /** Agent initiating the negotiation. */
  initiator_agent_id: string;
  /** Agent receiving the negotiation. */
  responder_agent_id: string;
  /** Protocols the initiator supports (in preference order). */
  initiator_protocols: ProtocolPreference[];
  /** Protocols the responder supports. */
  responder_protocols: ProtocolPreference[];
  /** Agreed-upon protocol (null until negotiation completes). */
  agreed_protocol: AgreedProtocol | null;
  status: NegotiationStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface ProtocolPreference {
  protocol: ProtocolFamily;
  version: ProtocolVersion;
  wire_format: WireFormat;
  /** Priority 1 = most preferred. */
  priority: number;
}

export interface AgreedProtocol {
  protocol: ProtocolFamily;
  version: ProtocolVersion;
  wire_format: WireFormat;
  adapter_id: string;
  /** If a bridge is needed, which side adapts. */
  bridge_side: 'initiator' | 'responder' | 'both' | 'none';
}

export type NegotiationStatus = 'pending' | 'agreed' | 'failed' | 'expired';

// ────────────────────────────────────────────────────────────────
// Message Translation
// ────────────────────────────────────────────────────────────────

/** Canonical internal message — the "Esperanto" all protocols translate to/from. */
export interface CanonicalMessage {
  id: string;
  /** Original protocol the message came from. */
  source_protocol: ProtocolFamily;
  /** The adapter that translated it. */
  adapter_id: string;
  /** Message type in our canonical taxonomy. */
  type: CanonicalMessageType;
  /** Normalized sender identifier. */
  sender: CanonicalAgent;
  /** Normalized recipient identifier. */
  recipient: CanonicalAgent | null;
  /** The translated payload. */
  payload: Record<string, unknown>;
  /** Original raw message (preserved for debugging/audit). */
  raw_original: string;
  /** Translation metadata. */
  translation: TranslationMeta;
  timestamp: string;
}

export type CanonicalMessageType =
  | 'task_request'
  | 'task_response'
  | 'task_status_update'
  | 'task_cancel'
  | 'capability_query'
  | 'capability_response'
  | 'heartbeat'
  | 'error'
  | 'stream_chunk'
  | 'negotiation'
  | 'custom';

/** Normalized agent identity across protocols. */
export interface CanonicalAgent {
  /** Our internal agent ID (if known). */
  internal_id: string | null;
  /** External identifier in the source protocol. */
  external_id: string;
  /** Protocol they're using. */
  protocol: ProtocolFamily;
  /** Human-readable name. */
  name: string;
  /** Their endpoint URL. */
  endpoint?: string;
}

/** Metadata about a translation operation. */
export interface TranslationMeta {
  /** Time taken to translate (ms). */
  duration_ms: number;
  /** Whether any information was lost in translation. */
  lossy: boolean;
  /** Specific fields that couldn't be mapped. */
  unmapped_fields: string[];
  /** Warnings about semantic mismatches. */
  warnings: string[];
  /** Adapter version used. */
  adapter_version: ProtocolVersion;
}

// ────────────────────────────────────────────────────────────────
// Translation Session (stateful multi-turn conversations)
// ────────────────────────────────────────────────────────────────

/** A live translation session between two agents on different protocols. */
export interface TranslationSession {
  id: string;
  /** The two participating agents. */
  agent_a: SessionParticipant;
  agent_b: SessionParticipant;
  /** Agreed protocol from negotiation. */
  agreed_protocol: AgreedProtocol;
  /** Messages translated in this session. */
  message_count: number;
  /** Cumulative translation stats. */
  stats: SessionStats;
  status: SessionStatus;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
}

export interface SessionParticipant {
  agent_id: string;
  protocol: ProtocolFamily;
  adapter_id: string;
  endpoint?: string;
}

export interface SessionStats {
  messages_translated: number;
  avg_translation_ms: number;
  lossy_translations: number;
  total_unmapped_fields: number;
  errors: number;
}

export type SessionStatus = 'active' | 'paused' | 'expired' | 'closed';

// ────────────────────────────────────────────────────────────────
// API Request/Response Types
// ────────────────────────────────────────────────────────────────

// — Adapter CRUD —
export interface RegisterAdapterRequest {
  protocol: ProtocolFamily;
  version: ProtocolVersion;
  display_name: string;
  description: string;
  supported_wire_formats: WireFormat[];
  supported_auth_methods: ExternalAuthMethod[];
  detection_patterns: DetectionPattern[];
  capability_map: CapabilityMapping[];
  state_map: StateMapping[];
  bidirectional: boolean;
  supports_streaming: boolean;
}
export interface RegisterAdapterResponse {
  adapter: ProtocolAdapter;
}

export interface ListAdaptersResponse {
  adapters: ProtocolAdapter[];
  total: number;
}

export interface GetAdapterResponse {
  adapter: ProtocolAdapter;
}

// — Protocol Detection —
export interface DetectProtocolRequest {
  /** Raw request headers (key-value). */
  headers: Record<string, string>;
  /** Raw request body (as string). */
  body: string;
  /** Request URL path. */
  url?: string;
  /** Content-Type header value (convenience). */
  content_type?: string;
}
export interface DetectProtocolResponse {
  detection: DetectionResult;
}

// — Message Translation —
export interface TranslateMessageRequest {
  /** Source protocol (or "auto" for detection). */
  source_protocol: ProtocolFamily | 'auto';
  /** Target protocol to translate into. */
  target_protocol: ProtocolFamily;
  /** The raw message to translate. */
  message: string;
  /** Optional: existing session ID for context. */
  session_id?: string;
  /** Optional: specify source adapter. */
  source_adapter_id?: string;
  /** Optional: specify target adapter. */
  target_adapter_id?: string;
}
export interface TranslateMessageResponse {
  /** The translated message ready to send to the target. */
  translated: string;
  /** Canonical representation used as intermediate. */
  canonical: CanonicalMessage;
  /** Translation metadata. */
  translation: TranslationMeta;
}

// — Protocol Negotiation —
export interface StartNegotiationRequest {
  initiator_agent_id: string;
  responder_agent_id: string;
  initiator_protocols: ProtocolPreference[];
}
export interface StartNegotiationResponse {
  negotiation: ProtocolNegotiation;
}

export interface RespondNegotiationRequest {
  responder_protocols: ProtocolPreference[];
}
export interface RespondNegotiationResponse {
  negotiation: ProtocolNegotiation;
}

// — Translation Session —
export interface CreateSessionRequest {
  agent_a_id: string;
  agent_b_id: string;
  agent_a_protocol: ProtocolFamily;
  agent_b_protocol: ProtocolFamily;
  ttl_minutes?: number;
}
export interface CreateSessionResponse {
  session: TranslationSession;
}

export interface SessionMessageRequest {
  sender_agent_id: string;
  message: string;
}
export interface SessionMessageResponse {
  translated: string;
  canonical: CanonicalMessage;
  translation: TranslationMeta;
  session: TranslationSession;
}

export interface ListSessionsResponse {
  sessions: TranslationSession[];
  total: number;
}

// — Protocol Compatibility Matrix —
export interface CompatibilityEntry {
  source: ProtocolFamily;
  target: ProtocolFamily;
  supported: boolean;
  bidirectional: boolean;
  lossy_fields: string[];
  notes: string;
}

export interface CompatibilityMatrixResponse {
  matrix: CompatibilityEntry[];
  protocols: ProtocolFamily[];
  generated_at: string;
}
