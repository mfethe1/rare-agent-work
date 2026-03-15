/**
 * Universal Agent Protocol Bridge — Core Engine
 *
 * Translates between agent protocol families in real-time, enabling
 * cross-platform agent collaboration without requiring either party
 * to change their native protocol.
 *
 * Architecture:
 *   External Agent ──► Protocol Detection ──► Adapter (inbound) ──► Canonical Message
 *   Canonical Message ──► Adapter (outbound) ──► External Agent
 *
 * Built-in adapters for: Google A2A, OpenAI Agents, LangChain,
 * AutoGen, MCP, and the native rareagent protocol.
 */

import { randomUUID } from 'crypto';
import type {
  ProtocolFamily,
  ProtocolVersion,
  WireFormat,
  ProtocolAdapter,
  AdapterStatus,
  DetectionPattern,
  CapabilityMapping,
  StateMapping,
  DetectionResult,
  DetectionCandidate,
  MatchedPattern,
  ProtocolNegotiation,
  ProtocolPreference,
  AgreedProtocol,
  NegotiationStatus,
  CanonicalMessage,
  CanonicalMessageType,
  CanonicalAgent,
  TranslationMeta,
  TranslationSession,
  SessionParticipant,
  SessionStats,
  SessionStatus,
  CompatibilityEntry,
  PayloadTransform,
} from './types';

// ────────────────────────────────────────────────────────────────
// In-Memory Stores (backed by Supabase in production)
// ────────────────────────────────────────────────────────────────

const adapters = new Map<string, ProtocolAdapter>();
const negotiations = new Map<string, ProtocolNegotiation>();
const sessions = new Map<string, TranslationSession>();
const sessionMessages = new Map<string, CanonicalMessage[]>();

/** Reset all stores (for testing). */
export function resetBridgeStores(): void {
  adapters.clear();
  negotiations.clear();
  sessions.clear();
  sessionMessages.clear();
  // Re-register built-in adapters
  registerBuiltInAdapters();
}

// ────────────────────────────────────────────────────────────────
// Built-In Protocol Adapters
// ────────────────────────────────────────────────────────────────

/** The built-in adapters for well-known protocols. */
function registerBuiltInAdapters(): void {
  const builtIns: Array<Omit<ProtocolAdapter, 'id' | 'created_at' | 'updated_at'>> = [
    {
      protocol: 'rareagent',
      version: '1.0.0',
      display_name: 'RareAgent Native',
      description: 'Native rareagent.work A2A protocol — no translation needed.',
      supported_wire_formats: ['json'],
      supported_auth_methods: ['api_key', 'signed_envelope'],
      detection_patterns: [
        { type: 'header', key: 'x-agent-id', pattern: '.+', weight: 3 },
        { type: 'body_field', key: 'intent', pattern: '^(news\\.|report\\.|models\\.|ask|digest\\.|agent\\.|x-)', weight: 5 },
      ],
      capability_map: [],
      state_map: [
        { external_state: 'submitted', internal_state: 'submitted', lossy: false },
        { external_state: 'accepted', internal_state: 'accepted', lossy: false },
        { external_state: 'in_progress', internal_state: 'in_progress', lossy: false },
        { external_state: 'completed', internal_state: 'completed', lossy: false },
        { external_state: 'failed', internal_state: 'failed', lossy: false },
        { external_state: 'rejected', internal_state: 'rejected', lossy: false },
      ],
      bidirectional: true,
      supports_streaming: true,
      status: 'active',
    },
    {
      protocol: 'google_a2a',
      version: '1.0.0',
      display_name: 'Google A2A Protocol',
      description: 'Google Agent-to-Agent Protocol using JSON-RPC 2.0 over HTTPS.',
      supported_wire_formats: ['json-rpc'],
      supported_auth_methods: ['bearer_token', 'oauth2'],
      detection_patterns: [
        { type: 'body_field', key: 'jsonrpc', pattern: '^2\\.0$', weight: 4 },
        { type: 'body_field', key: 'method', pattern: '^(tasks/|agent/)', weight: 5 },
        { type: 'header', key: 'content-type', pattern: 'application/json', weight: 1 },
      ],
      capability_map: [
        { external_id: 'tasks/send', internal_id: 'task.submit', input_transform: googleTaskToCanonical() },
        { external_id: 'tasks/get', internal_id: 'task.status' },
        { external_id: 'tasks/cancel', internal_id: 'task.cancel' },
        { external_id: 'agent/authenticatedExtendedCard', internal_id: 'agent.discover' },
      ],
      state_map: [
        { external_state: 'submitted', internal_state: 'submitted', lossy: false },
        { external_state: 'working', internal_state: 'in_progress', lossy: false },
        { external_state: 'input-required', internal_state: 'in_progress', lossy: true, notes: 'Rareagent has no input-required state; maps to in_progress' },
        { external_state: 'completed', internal_state: 'completed', lossy: false },
        { external_state: 'failed', internal_state: 'failed', lossy: false },
        { external_state: 'canceled', internal_state: 'rejected', lossy: true, notes: 'Google uses canceled; rareagent uses rejected' },
      ],
      bidirectional: true,
      supports_streaming: true,
      status: 'active',
    },
    {
      protocol: 'openai_agents',
      version: '1.0.0',
      display_name: 'OpenAI Agents API',
      description: 'OpenAI Agents API using REST endpoints with SSE streaming.',
      supported_wire_formats: ['json', 'sse'],
      supported_auth_methods: ['bearer_token', 'api_key'],
      detection_patterns: [
        { type: 'header', key: 'authorization', pattern: '^Bearer sk-', weight: 4 },
        { type: 'url_pattern', key: 'path', pattern: '/v1/(agents|threads|runs)', weight: 5 },
        { type: 'body_field', key: 'model', pattern: '^gpt-', weight: 3 },
      ],
      capability_map: [
        { external_id: 'runs.create', internal_id: 'task.submit', input_transform: openaiRunToCanonical() },
        { external_id: 'runs.retrieve', internal_id: 'task.status' },
        { external_id: 'runs.cancel', internal_id: 'task.cancel' },
        { external_id: 'agents.list', internal_id: 'agent.discover' },
      ],
      state_map: [
        { external_state: 'queued', internal_state: 'submitted', lossy: false },
        { external_state: 'in_progress', internal_state: 'in_progress', lossy: false },
        { external_state: 'requires_action', internal_state: 'in_progress', lossy: true, notes: 'Tool call pending; no equivalent in rareagent' },
        { external_state: 'completed', internal_state: 'completed', lossy: false },
        { external_state: 'failed', internal_state: 'failed', lossy: false },
        { external_state: 'cancelled', internal_state: 'rejected', lossy: true },
        { external_state: 'expired', internal_state: 'failed', lossy: true, notes: 'Rareagent has no expired state' },
      ],
      bidirectional: true,
      supports_streaming: true,
      status: 'active',
    },
    {
      protocol: 'langchain',
      version: '1.0.0',
      display_name: 'LangChain / LangGraph',
      description: 'LangChain agent protocol with LangGraph state machine support.',
      supported_wire_formats: ['json'],
      supported_auth_methods: ['api_key', 'bearer_token'],
      detection_patterns: [
        { type: 'body_field', key: 'input', pattern: '.+', weight: 2 },
        { type: 'body_field', key: 'config', pattern: '.+', weight: 2 },
        { type: 'url_pattern', key: 'path', pattern: '/(invoke|stream|batch)', weight: 4 },
        { type: 'header', key: 'x-langchain-api-key', pattern: '.+', weight: 5 },
      ],
      capability_map: [
        { external_id: 'invoke', internal_id: 'task.submit', input_transform: langchainInvokeToCanonical() },
        { external_id: 'batch', internal_id: 'task.submit' },
        { external_id: 'stream', internal_id: 'task.submit' },
      ],
      state_map: [
        { external_state: 'pending', internal_state: 'submitted', lossy: false },
        { external_state: 'running', internal_state: 'in_progress', lossy: false },
        { external_state: 'success', internal_state: 'completed', lossy: false },
        { external_state: 'error', internal_state: 'failed', lossy: false },
      ],
      bidirectional: false,
      supports_streaming: true,
      status: 'active',
    },
    {
      protocol: 'autogen',
      version: '0.4.0',
      display_name: 'Microsoft AutoGen',
      description: 'Microsoft AutoGen multi-agent conversation framework.',
      supported_wire_formats: ['json'],
      supported_auth_methods: ['api_key', 'bearer_token', 'none'],
      detection_patterns: [
        { type: 'body_field', key: 'messages', pattern: '.+', weight: 2 },
        { type: 'body_field', key: 'sender', pattern: '.+', weight: 3 },
        { type: 'body_field', key: 'recipient', pattern: '.+', weight: 3 },
        { type: 'header', key: 'x-autogen-session', pattern: '.+', weight: 5 },
      ],
      capability_map: [
        { external_id: 'initiate_chat', internal_id: 'task.submit' },
        { external_id: 'generate_reply', internal_id: 'task.submit' },
      ],
      state_map: [
        { external_state: 'initiated', internal_state: 'submitted', lossy: false },
        { external_state: 'in_progress', internal_state: 'in_progress', lossy: false },
        { external_state: 'terminated', internal_state: 'completed', lossy: true, notes: 'AutoGen terminated can mean success or intentional stop' },
        { external_state: 'error', internal_state: 'failed', lossy: false },
      ],
      bidirectional: true,
      supports_streaming: false,
      status: 'active',
    },
    {
      protocol: 'mcp',
      version: '1.0.0',
      display_name: 'Model Context Protocol',
      description: 'Anthropic Model Context Protocol for tool/resource sharing.',
      supported_wire_formats: ['json'],
      supported_auth_methods: ['bearer_token', 'none'],
      detection_patterns: [
        { type: 'body_field', key: 'jsonrpc', pattern: '^2\\.0$', weight: 2 },
        { type: 'body_field', key: 'method', pattern: '^(tools/|resources/|prompts/|sampling/)', weight: 6 },
        { type: 'header', key: 'x-mcp-version', pattern: '.+', weight: 5 },
      ],
      capability_map: [
        { external_id: 'tools/call', internal_id: 'task.submit' },
        { external_id: 'tools/list', internal_id: 'agent.discover' },
        { external_id: 'resources/read', internal_id: 'task.submit' },
        { external_id: 'sampling/createMessage', internal_id: 'task.submit' },
      ],
      state_map: [
        { external_state: 'pending', internal_state: 'submitted', lossy: false },
        { external_state: 'in_progress', internal_state: 'in_progress', lossy: false },
        { external_state: 'completed', internal_state: 'completed', lossy: false },
        { external_state: 'error', internal_state: 'failed', lossy: false },
      ],
      bidirectional: true,
      supports_streaming: true,
      status: 'active',
    },
  ];

  for (const b of builtIns) {
    const id = randomUUID();
    const now = new Date().toISOString();
    adapters.set(id, { ...b, id, created_at: now, updated_at: now });
  }
}

// Initialize built-in adapters on module load
registerBuiltInAdapters();

// ── Payload transform helpers ──

function googleTaskToCanonical(): PayloadTransform {
  return {
    field_map: {
      'intent': 'params.message.parts[0].text',
      'input.text': 'params.message.parts[0].text',
      'metadata.session_id': 'params.sessionId',
      'metadata.task_id': 'id',
    },
    defaults: { priority: 'normal' },
    strip: ['jsonrpc', 'method'],
  };
}

function openaiRunToCanonical(): PayloadTransform {
  return {
    field_map: {
      'intent': 'instructions',
      'input.text': 'instructions',
      'input.model': 'model',
      'metadata.thread_id': 'thread_id',
      'metadata.assistant_id': 'assistant_id',
    },
    defaults: { priority: 'normal' },
    strip: ['tools', 'temperature'],
  };
}

function langchainInvokeToCanonical(): PayloadTransform {
  return {
    field_map: {
      'intent': 'input',
      'input.text': 'input',
      'metadata.config': 'config',
      'metadata.tags': 'config.tags',
    },
    defaults: { priority: 'normal' },
  };
}

// ────────────────────────────────────────────────────────────────
// Adapter Management
// ────────────────────────────────────────────────────────────────

export interface RegisterAdapterParams {
  protocol: ProtocolFamily;
  version: ProtocolVersion;
  display_name: string;
  description: string;
  supported_wire_formats: WireFormat[];
  supported_auth_methods: string[];
  detection_patterns: DetectionPattern[];
  capability_map: CapabilityMapping[];
  state_map: StateMapping[];
  bidirectional: boolean;
  supports_streaming: boolean;
}

export function registerAdapter(params: RegisterAdapterParams): ProtocolAdapter {
  const id = randomUUID();
  const now = new Date().toISOString();
  const adapter: ProtocolAdapter = {
    id,
    protocol: params.protocol,
    version: params.version,
    display_name: params.display_name,
    description: params.description,
    supported_wire_formats: params.supported_wire_formats,
    supported_auth_methods: params.supported_auth_methods as ProtocolAdapter['supported_auth_methods'],
    detection_patterns: params.detection_patterns,
    capability_map: params.capability_map,
    state_map: params.state_map,
    bidirectional: params.bidirectional,
    supports_streaming: params.supports_streaming,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
  adapters.set(id, adapter);
  return adapter;
}

export function getAdapter(id: string): ProtocolAdapter | null {
  return adapters.get(id) ?? null;
}

export function listAdapters(opts?: {
  protocol?: ProtocolFamily;
  status?: AdapterStatus;
  limit?: number;
  offset?: number;
}): { adapters: ProtocolAdapter[]; total: number } {
  let results = Array.from(adapters.values());
  if (opts?.protocol) results = results.filter(a => a.protocol === opts.protocol);
  if (opts?.status) results = results.filter(a => a.status === opts.status);
  const total = results.length;
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 50;
  return { adapters: results.slice(offset, offset + limit), total };
}

export function updateAdapterStatus(id: string, status: AdapterStatus): ProtocolAdapter | null {
  const adapter = adapters.get(id);
  if (!adapter) return null;
  adapter.status = status;
  adapter.updated_at = new Date().toISOString();
  return adapter;
}

export function findAdapterForProtocol(protocol: ProtocolFamily): ProtocolAdapter | null {
  for (const adapter of adapters.values()) {
    if (adapter.protocol === protocol && adapter.status === 'active') return adapter;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// Protocol Detection
// ────────────────────────────────────────────────────────────────

export interface DetectProtocolParams {
  headers: Record<string, string>;
  body: string;
  url?: string;
  content_type?: string;
}

/** Auto-detect which protocol an inbound request uses. */
export function detectProtocol(params: DetectProtocolParams): DetectionResult {
  const { headers, body, url, content_type } = params;
  const matchedPatterns: MatchedPattern[] = [];
  const scoreByAdapter = new Map<string, number>();

  let parsedBody: Record<string, unknown> | null = null;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    // Non-JSON body — some patterns will just not match
  }

  // Normalize headers to lowercase keys
  const normHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    normHeaders[k.toLowerCase()] = v;
  }

  for (const adapter of adapters.values()) {
    if (adapter.status !== 'active') continue;
    let adapterScore = 0;

    for (const pattern of adapter.detection_patterns) {
      const match = evaluatePattern(pattern, normHeaders, parsedBody, url, content_type);
      if (match) {
        adapterScore += pattern.weight;
        matchedPatterns.push({
          adapter_id: adapter.id,
          pattern,
          matched_value: match,
        });
      }
    }

    if (adapterScore > 0) {
      scoreByAdapter.set(adapter.id, adapterScore);
    }
  }

  // Rank candidates
  const candidates: DetectionCandidate[] = [];
  for (const [adapterId, score] of scoreByAdapter.entries()) {
    const adapter = adapters.get(adapterId)!;
    candidates.push({ protocol: adapter.protocol, adapter_id: adapterId, score });
  }
  candidates.sort((a, b) => b.score - a.score);

  // Compute confidence: top score relative to max possible
  const topScore = candidates[0]?.score ?? 0;
  const maxPossibleScore = Math.max(
    ...Array.from(adapters.values())
      .filter(a => a.status === 'active')
      .map(a => a.detection_patterns.reduce((sum, p) => sum + p.weight, 0)),
    1,
  );
  const confidence = Math.min(topScore / maxPossibleScore, 1);

  return {
    detected_protocol: candidates[0]?.protocol ?? 'custom',
    confidence,
    candidates,
    adapter_id: candidates[0]?.adapter_id ?? null,
    matched_patterns: matchedPatterns,
  };
}

function evaluatePattern(
  pattern: DetectionPattern,
  headers: Record<string, string>,
  body: Record<string, unknown> | null,
  url: string | undefined,
  contentType: string | undefined,
): string | null {
  try {
    const regex = new RegExp(pattern.pattern);
    switch (pattern.type) {
      case 'header': {
        const value = headers[pattern.key.toLowerCase()];
        if (value && regex.test(value)) return value;
        return null;
      }
      case 'body_field': {
        if (!body) return null;
        const value = getNestedField(body, pattern.key);
        const strValue = typeof value === 'string' ? value : JSON.stringify(value);
        if (strValue && regex.test(strValue)) return strValue;
        return null;
      }
      case 'url_pattern': {
        if (url && regex.test(url)) return url;
        return null;
      }
      case 'content_type': {
        const ct = contentType ?? headers['content-type'];
        if (ct && regex.test(ct)) return ct;
        return null;
      }
    }
  } catch {
    return null;
  }
}

function getNestedField(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ────────────────────────────────────────────────────────────────
// Message Translation
// ────────────────────────────────────────────────────────────────

export interface TranslateParams {
  source_protocol: ProtocolFamily | 'auto';
  target_protocol: ProtocolFamily;
  message: string;
  session_id?: string;
  source_adapter_id?: string;
  target_adapter_id?: string;
}

export interface TranslateResult {
  translated: string;
  canonical: CanonicalMessage;
  translation: TranslationMeta;
}

/** Translate a message from one protocol to another. */
export function translateMessage(params: TranslateParams): TranslateResult {
  const startTime = Date.now();

  // 1. Resolve source protocol
  let sourceProtocol = params.source_protocol;
  let sourceAdapterId = params.source_adapter_id ?? null;

  if (sourceProtocol === 'auto') {
    let parsedHeaders: Record<string, string> = {};
    try {
      const parsed = JSON.parse(params.message);
      if (parsed._headers) {
        parsedHeaders = parsed._headers;
      }
    } catch {
      // Not JSON with headers
    }
    const detection = detectProtocol({
      headers: parsedHeaders,
      body: params.message,
    });
    sourceProtocol = detection.detected_protocol;
    sourceAdapterId = detection.adapter_id;
  }

  // 2. Find adapters
  const sourceAdapter = sourceAdapterId
    ? adapters.get(sourceAdapterId)
    : findAdapterForProtocol(sourceProtocol as ProtocolFamily);
  const targetAdapter = params.target_adapter_id
    ? adapters.get(params.target_adapter_id)
    : findAdapterForProtocol(params.target_protocol);

  if (!sourceAdapter) {
    throw new BridgeError(`No active adapter found for source protocol: ${sourceProtocol}`, 'ADAPTER_NOT_FOUND');
  }
  if (!targetAdapter) {
    throw new BridgeError(`No active adapter found for target protocol: ${params.target_protocol}`, 'ADAPTER_NOT_FOUND');
  }

  // 3. Parse source message to canonical form
  const canonical = inboundTranslate(params.message, sourceAdapter);

  // 4. Translate canonical to target format
  const translated = outboundTranslate(canonical, targetAdapter);

  // 5. Compute translation metadata
  const unmappedFields = findUnmappedFields(params.message, sourceAdapter);
  const warnings = computeWarnings(sourceAdapter, targetAdapter);
  const duration_ms = Date.now() - startTime;

  const translationMeta: TranslationMeta = {
    duration_ms,
    lossy: unmappedFields.length > 0 || warnings.length > 0,
    unmapped_fields: unmappedFields,
    warnings,
    adapter_version: sourceAdapter.version,
  };

  // 6. If in a session, record the message
  if (params.session_id) {
    const msgs = sessionMessages.get(params.session_id) ?? [];
    msgs.push(canonical);
    sessionMessages.set(params.session_id, msgs);

    // Update session stats
    const session = sessions.get(params.session_id);
    if (session) {
      session.message_count++;
      session.stats.messages_translated++;
      session.stats.avg_translation_ms = (
        (session.stats.avg_translation_ms * (session.stats.messages_translated - 1) + duration_ms) /
        session.stats.messages_translated
      );
      if (translationMeta.lossy) session.stats.lossy_translations++;
      session.stats.total_unmapped_fields += unmappedFields.length;
      session.last_activity_at = new Date().toISOString();
    }
  }

  return { translated, canonical, translation: translationMeta };
}

/** Convert an inbound message to canonical form using the source adapter. */
function inboundTranslate(rawMessage: string, adapter: ProtocolAdapter): CanonicalMessage {
  const now = new Date().toISOString();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    parsed = { raw: rawMessage };
  }

  // Determine message type from protocol-specific signals
  const msgType = detectMessageType(parsed, adapter);

  // Extract sender info
  const sender = extractSender(parsed, adapter);

  // Apply capability mapping to normalize the payload
  const payload = applyInboundTransforms(parsed, adapter);

  return {
    id: randomUUID(),
    source_protocol: adapter.protocol,
    adapter_id: adapter.id,
    type: msgType,
    sender,
    recipient: null,
    payload,
    raw_original: rawMessage,
    translation: {
      duration_ms: 0, // Will be set by caller
      lossy: false,
      unmapped_fields: [],
      warnings: [],
      adapter_version: adapter.version,
    },
    timestamp: now,
  };
}

/** Convert a canonical message to the target protocol's wire format. */
function outboundTranslate(canonical: CanonicalMessage, targetAdapter: ProtocolAdapter): string {
  const protocol = targetAdapter.protocol;

  switch (protocol) {
    case 'google_a2a':
      return JSON.stringify(toGoogleA2A(canonical));
    case 'openai_agents':
      return JSON.stringify(toOpenAIAgents(canonical));
    case 'langchain':
      return JSON.stringify(toLangChain(canonical));
    case 'autogen':
      return JSON.stringify(toAutoGen(canonical));
    case 'mcp':
      return JSON.stringify(toMCP(canonical));
    case 'rareagent':
      return JSON.stringify(toRareAgent(canonical));
    default:
      // For custom/unknown protocols, output canonical JSON
      return JSON.stringify(canonical.payload);
  }
}

// ── Protocol-specific outbound converters ──

function toGoogleA2A(canonical: CanonicalMessage): Record<string, unknown> {
  const taskState = mapStateToExternal(canonical, 'google_a2a');
  if (canonical.type === 'task_request') {
    return {
      jsonrpc: '2.0',
      method: 'tasks/send',
      id: canonical.id,
      params: {
        message: {
          role: 'user',
          parts: [{ type: 'text', text: canonical.payload.intent ?? canonical.payload.raw ?? '' }],
        },
        ...(canonical.payload.metadata as Record<string, unknown> ?? {}),
      },
    };
  }
  return {
    jsonrpc: '2.0',
    id: canonical.id,
    result: {
      id: canonical.id,
      status: { state: taskState },
      artifacts: canonical.payload.output ? [{ parts: [{ type: 'text', text: canonical.payload.output }] }] : [],
    },
  };
}

function toOpenAIAgents(canonical: CanonicalMessage): Record<string, unknown> {
  if (canonical.type === 'task_request') {
    return {
      instructions: canonical.payload.intent ?? canonical.payload.raw ?? '',
      model: canonical.payload.model ?? 'gpt-4o',
      ...(canonical.payload.metadata as Record<string, unknown> ?? {}),
    };
  }
  const taskState = mapStateToExternal(canonical, 'openai_agents');
  return {
    id: canonical.id,
    status: taskState,
    output: canonical.payload.output ?? null,
  };
}

function toLangChain(canonical: CanonicalMessage): Record<string, unknown> {
  return {
    input: canonical.payload.intent ?? canonical.payload.raw ?? '',
    config: canonical.payload.metadata ?? {},
  };
}

function toAutoGen(canonical: CanonicalMessage): Record<string, unknown> {
  return {
    sender: canonical.sender.name,
    recipient: canonical.recipient?.name ?? 'assistant',
    messages: [{
      role: 'user',
      content: canonical.payload.intent ?? canonical.payload.raw ?? '',
    }],
  };
}

function toMCP(canonical: CanonicalMessage): Record<string, unknown> {
  if (canonical.type === 'task_request') {
    return {
      jsonrpc: '2.0',
      method: 'tools/call',
      id: canonical.id,
      params: {
        name: canonical.payload.intent ?? 'unknown',
        arguments: canonical.payload.input ?? {},
      },
    };
  }
  return {
    jsonrpc: '2.0',
    id: canonical.id,
    result: {
      content: [{ type: 'text', text: JSON.stringify(canonical.payload.output ?? canonical.payload) }],
    },
  };
}

function toRareAgent(canonical: CanonicalMessage): Record<string, unknown> {
  return {
    intent: canonical.payload.intent ?? 'ask',
    input: canonical.payload.input ?? { text: canonical.payload.raw ?? '' },
    priority: canonical.payload.priority ?? 'normal',
    metadata: canonical.payload.metadata ?? {},
  };
}

// ── Shared helpers ──

function detectMessageType(parsed: Record<string, unknown>, adapter: ProtocolAdapter): CanonicalMessageType {
  // Google A2A / MCP: JSON-RPC method field
  if (typeof parsed.method === 'string') {
    const m = parsed.method as string;
    if (m.includes('send') || m.includes('create') || m.includes('invoke') || m.includes('call')) return 'task_request';
    if (m.includes('get') || m.includes('retrieve') || m.includes('status')) return 'task_status_update';
    if (m.includes('cancel')) return 'task_cancel';
    if (m.includes('list') || m.includes('discover') || m.includes('Card')) return 'capability_query';
  }
  // OpenAI / LangChain: presence of certain fields
  if (parsed.instructions || parsed.input) return 'task_request';
  if (parsed.status) return 'task_status_update';
  // AutoGen: messages array
  if (Array.isArray(parsed.messages)) return 'task_request';
  // Default
  if (parsed.intent) return 'task_request';
  return 'custom';
}

function extractSender(parsed: Record<string, unknown>, adapter: ProtocolAdapter): CanonicalAgent {
  // Try common fields across protocols
  const agentId = (parsed.agent_id ?? parsed.sender ?? parsed.assistant_id ?? 'unknown') as string;
  const name = (parsed.agent_name ?? parsed.sender ?? parsed.name ?? agentId) as string;
  return {
    internal_id: null,
    external_id: agentId,
    protocol: adapter.protocol,
    name,
  };
}

function applyInboundTransforms(
  parsed: Record<string, unknown>,
  adapter: ProtocolAdapter,
): Record<string, unknown> {
  // Start with the raw parsed data
  const result: Record<string, unknown> = { ...parsed };

  // Apply first matching capability map transform
  for (const mapping of adapter.capability_map) {
    if (mapping.input_transform) {
      const transform = mapping.input_transform;
      // Apply field mappings
      for (const [target, source] of Object.entries(transform.field_map)) {
        const value = getNestedField(parsed, source);
        if (value !== undefined) {
          setNestedField(result, target, value);
        }
      }
      // Apply defaults
      if (transform.defaults) {
        for (const [key, value] of Object.entries(transform.defaults)) {
          if (getNestedField(result, key) === undefined) {
            setNestedField(result, key, value);
          }
        }
      }
      // Strip fields
      if (transform.strip) {
        for (const field of transform.strip) {
          delete result[field];
        }
      }
      break; // Apply first matching transform only
    }
  }

  return result;
}

function setNestedField(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function mapStateToExternal(canonical: CanonicalMessage, targetProtocol: ProtocolFamily): string {
  const adapter = findAdapterForProtocol(targetProtocol);
  if (!adapter) return 'unknown';

  const internalState = (canonical.payload.status as string) ?? 'submitted';
  for (const mapping of adapter.state_map) {
    if (mapping.internal_state === internalState) return mapping.external_state;
  }
  return internalState;
}

function findUnmappedFields(rawMessage: string, adapter: ProtocolAdapter): string[] {
  try {
    const parsed = JSON.parse(rawMessage);
    const mappedTargets = new Set(
      adapter.capability_map.flatMap(m =>
        m.input_transform ? Object.values(m.input_transform.field_map) : [],
      ),
    );
    const topLevelKeys = Object.keys(parsed);
    // Fields not referenced by any transform
    return topLevelKeys.filter(k =>
      !mappedTargets.has(k) &&
      !['jsonrpc', 'id', 'method', 'intent', 'input', 'output', 'status', 'priority'].includes(k),
    );
  } catch {
    return [];
  }
}

function computeWarnings(source: ProtocolAdapter, target: ProtocolAdapter): string[] {
  const warnings: string[] = [];
  if (source.supports_streaming && !target.supports_streaming) {
    warnings.push(`Target protocol ${target.protocol} does not support streaming; responses will be buffered.`);
  }
  if (source.bidirectional && !target.bidirectional) {
    warnings.push(`Target protocol ${target.protocol} is unidirectional; callbacks may not work.`);
  }
  // Check for lossy state mappings
  const lossyStates = target.state_map.filter(s => s.lossy);
  if (lossyStates.length > 0) {
    warnings.push(`${lossyStates.length} state mappings are lossy for ${target.protocol}.`);
  }
  return warnings;
}

// ────────────────────────────────────────────────────────────────
// Protocol Negotiation
// ────────────────────────────────────────────────────────────────

export function startNegotiation(
  initiator_agent_id: string,
  responder_agent_id: string,
  initiator_protocols: ProtocolPreference[],
): ProtocolNegotiation {
  const id = randomUUID();
  const now = new Date().toISOString();
  const negotiation: ProtocolNegotiation = {
    id,
    initiator_agent_id,
    responder_agent_id,
    initiator_protocols,
    responder_protocols: [],
    agreed_protocol: null,
    status: 'pending',
    created_at: now,
    resolved_at: null,
  };
  negotiations.set(id, negotiation);
  return negotiation;
}

export function respondToNegotiation(
  negotiation_id: string,
  responder_protocols: ProtocolPreference[],
): ProtocolNegotiation {
  const negotiation = negotiations.get(negotiation_id);
  if (!negotiation) throw new BridgeError('Negotiation not found', 'NOT_FOUND');
  if (negotiation.status !== 'pending') {
    throw new BridgeError(`Negotiation already ${negotiation.status}`, 'INVALID_STATE');
  }

  negotiation.responder_protocols = responder_protocols;

  // Find best mutual protocol: score = 1/(init_priority * resp_priority)
  let bestScore = 0;
  let bestAgreement: AgreedProtocol | null = null;

  for (const init of negotiation.initiator_protocols) {
    for (const resp of responder_protocols) {
      if (init.protocol === resp.protocol && init.wire_format === resp.wire_format) {
        const score = 1 / (init.priority * resp.priority);
        if (score > bestScore) {
          bestScore = score;
          const adapter = findAdapterForProtocol(init.protocol);
          bestAgreement = {
            protocol: init.protocol,
            version: init.version,
            wire_format: init.wire_format,
            adapter_id: adapter?.id ?? '',
            bridge_side: 'none',
          };
        }
      }
    }
  }

  // If no exact match, try bridge: find a shared adapter
  if (!bestAgreement) {
    for (const init of negotiation.initiator_protocols) {
      for (const resp of responder_protocols) {
        const initAdapter = findAdapterForProtocol(init.protocol);
        const respAdapter = findAdapterForProtocol(resp.protocol);
        if (initAdapter && respAdapter) {
          // Both sides have adapters — we can bridge via canonical form
          const score = 1 / (init.priority * resp.priority);
          if (score > bestScore) {
            bestScore = score;
            bestAgreement = {
              protocol: 'rareagent', // Bridge through canonical
              version: '1.0.0',
              wire_format: 'json',
              adapter_id: initAdapter.id,
              bridge_side: 'both',
            };
          }
        }
      }
    }
  }

  if (bestAgreement) {
    negotiation.agreed_protocol = bestAgreement;
    negotiation.status = 'agreed';
  } else {
    negotiation.status = 'failed';
  }
  negotiation.resolved_at = new Date().toISOString();

  return negotiation;
}

export function getNegotiation(id: string): ProtocolNegotiation | null {
  return negotiations.get(id) ?? null;
}

// ────────────────────────────────────────────────────────────────
// Translation Sessions
// ────────────────────────────────────────────────────────────────

export function createSession(params: {
  agent_a_id: string;
  agent_b_id: string;
  agent_a_protocol: ProtocolFamily;
  agent_b_protocol: ProtocolFamily;
  ttl_minutes?: number;
}): TranslationSession {
  const adapterA = findAdapterForProtocol(params.agent_a_protocol);
  const adapterB = findAdapterForProtocol(params.agent_b_protocol);

  if (!adapterA) throw new BridgeError(`No adapter for ${params.agent_a_protocol}`, 'ADAPTER_NOT_FOUND');
  if (!adapterB) throw new BridgeError(`No adapter for ${params.agent_b_protocol}`, 'ADAPTER_NOT_FOUND');

  const now = new Date();
  const ttl = params.ttl_minutes ?? 60;
  const expiresAt = new Date(now.getTime() + ttl * 60_000);

  const session: TranslationSession = {
    id: randomUUID(),
    agent_a: {
      agent_id: params.agent_a_id,
      protocol: params.agent_a_protocol,
      adapter_id: adapterA.id,
    },
    agent_b: {
      agent_id: params.agent_b_id,
      protocol: params.agent_b_protocol,
      adapter_id: adapterB.id,
    },
    agreed_protocol: {
      protocol: 'rareagent',
      version: '1.0.0',
      wire_format: 'json',
      adapter_id: adapterA.id,
      bridge_side: params.agent_a_protocol === params.agent_b_protocol ? 'none' : 'both',
    },
    message_count: 0,
    stats: {
      messages_translated: 0,
      avg_translation_ms: 0,
      lossy_translations: 0,
      total_unmapped_fields: 0,
      errors: 0,
    },
    status: 'active',
    created_at: now.toISOString(),
    last_activity_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  sessions.set(session.id, session);
  sessionMessages.set(session.id, []);
  return session;
}

export function getSession(id: string): TranslationSession | null {
  return sessions.get(id) ?? null;
}

export function listSessions(opts?: {
  agent_id?: string;
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}): { sessions: TranslationSession[]; total: number } {
  let results = Array.from(sessions.values());
  if (opts?.agent_id) {
    results = results.filter(s =>
      s.agent_a.agent_id === opts.agent_id || s.agent_b.agent_id === opts.agent_id,
    );
  }
  if (opts?.status) results = results.filter(s => s.status === opts.status);
  const total = results.length;
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 50;
  return { sessions: results.slice(offset, offset + limit), total };
}

export function closeSession(id: string): TranslationSession | null {
  const session = sessions.get(id);
  if (!session) return null;
  session.status = 'closed';
  session.last_activity_at = new Date().toISOString();
  return session;
}

/** Send a message within a translation session. */
export function sendSessionMessage(
  sessionId: string,
  senderAgentId: string,
  message: string,
): TranslateResult {
  const session = sessions.get(sessionId);
  if (!session) throw new BridgeError('Session not found', 'NOT_FOUND');
  if (session.status !== 'active') throw new BridgeError(`Session is ${session.status}`, 'INVALID_STATE');

  // Determine which participant is the sender and which is the receiver
  let sourceProtocol: ProtocolFamily;
  let targetProtocol: ProtocolFamily;

  if (senderAgentId === session.agent_a.agent_id) {
    sourceProtocol = session.agent_a.protocol;
    targetProtocol = session.agent_b.protocol;
  } else if (senderAgentId === session.agent_b.agent_id) {
    sourceProtocol = session.agent_b.protocol;
    targetProtocol = session.agent_a.protocol;
  } else {
    throw new BridgeError('Sender is not a participant in this session', 'UNAUTHORIZED');
  }

  return translateMessage({
    source_protocol: sourceProtocol,
    target_protocol: targetProtocol,
    message,
    session_id: sessionId,
  });
}

// ────────────────────────────────────────────────────────────────
// Compatibility Matrix
// ────────────────────────────────────────────────────────────────

/** Generate a compatibility matrix showing which protocol pairs can communicate. */
export function getCompatibilityMatrix(): {
  matrix: CompatibilityEntry[];
  protocols: ProtocolFamily[];
  generated_at: string;
} {
  const activeAdapters = Array.from(adapters.values()).filter(a => a.status === 'active');
  const protocols = [...new Set(activeAdapters.map(a => a.protocol))] as ProtocolFamily[];
  const matrix: CompatibilityEntry[] = [];

  for (const source of protocols) {
    for (const target of protocols) {
      const sourceAdapter = findAdapterForProtocol(source);
      const targetAdapter = findAdapterForProtocol(target);

      if (!sourceAdapter || !targetAdapter) {
        matrix.push({
          source,
          target,
          supported: false,
          bidirectional: false,
          lossy_fields: [],
          notes: 'No active adapter for one or both protocols.',
        });
        continue;
      }

      const lossyStates = targetAdapter.state_map.filter(s => s.lossy);
      const bidirectional = sourceAdapter.bidirectional && targetAdapter.bidirectional;

      matrix.push({
        source,
        target,
        supported: true,
        bidirectional,
        lossy_fields: lossyStates.map(s => `${s.external_state}→${s.internal_state}`),
        notes: source === target ? 'Native — no translation needed.' : `Bridge via canonical form. ${lossyStates.length} lossy state mappings.`,
      });
    }
  }

  return { matrix, protocols, generated_at: new Date().toISOString() };
}

// ────────────────────────────────────────────────────────────────
// Error Type
// ────────────────────────────────────────────────────────────────

export type BridgeErrorCode =
  | 'ADAPTER_NOT_FOUND'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'UNAUTHORIZED'
  | 'TRANSLATION_FAILED'
  | 'NEGOTIATION_FAILED';

export class BridgeError extends Error {
  constructor(
    message: string,
    public readonly code: BridgeErrorCode,
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}
