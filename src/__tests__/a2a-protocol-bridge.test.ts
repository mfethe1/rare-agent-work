/**
 * Universal Agent Protocol Bridge — Tests
 *
 * Validates adapter management, protocol detection, message translation,
 * negotiation, translation sessions, compatibility matrix, and error handling.
 */

import {
  resetBridgeStores,
  listAdapters,
  registerAdapter,
  updateAdapterStatus,
  findAdapterForProtocol,
  detectProtocol,
  translateMessage,
  startNegotiation,
  respondToNegotiation,
  getNegotiation,
  createSession,
  getSession,
  listSessions,
  closeSession,
  sendSessionMessage,
  getCompatibilityMatrix,
  BridgeError,
} from '@/lib/a2a/protocol-bridge/engine';

import type { ProtocolFamily } from '@/lib/a2a/protocol-bridge/types';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const AGENT_A = 'agent-alpha-001';
const AGENT_B = 'agent-beta-002';
const AGENT_C = 'agent-gamma-003';

// ──────────────────────────────────────────────
// Test Suite
// ──────────────────────────────────────────────

describe('Universal Agent Protocol Bridge', () => {
  beforeEach(() => {
    resetBridgeStores();
  });

  // ── Adapter Management ──

  describe('Adapter Management', () => {
    it('should list 6 built-in adapters', () => {
      const result = listAdapters();
      expect(result.total).toBe(6);
      const protocols = result.adapters.map(a => a.protocol);
      expect(protocols).toContain('rareagent');
      expect(protocols).toContain('google_a2a');
      expect(protocols).toContain('openai_agents');
      expect(protocols).toContain('langchain');
      expect(protocols).toContain('autogen');
      expect(protocols).toContain('mcp');
    });

    it('should register a custom adapter', () => {
      const adapter = registerAdapter({
        protocol: 'custom',
        version: '1.0.0',
        display_name: 'My Custom Protocol',
        description: 'A custom agent protocol for testing.',
        supported_wire_formats: ['json'],
        supported_auth_methods: ['api_key'],
        detection_patterns: [
          { type: 'header', key: 'x-custom-agent', pattern: '.+', weight: 5 },
        ],
        capability_map: [],
        state_map: [
          { external_state: 'ready', internal_state: 'submitted', lossy: false },
        ],
        bidirectional: true,
        supports_streaming: false,
      });

      expect(adapter.id).toBeDefined();
      expect(adapter.protocol).toBe('custom');
      expect(adapter.status).toBe('active');

      const result = listAdapters();
      expect(result.total).toBe(7);
    });

    it('should filter adapters by protocol', () => {
      const result = listAdapters({ protocol: 'google_a2a' });
      expect(result.total).toBe(1);
      expect(result.adapters[0].protocol).toBe('google_a2a');
    });

    it('should update adapter status', () => {
      const { adapters: all } = listAdapters({ protocol: 'autogen' });
      const autogenId = all[0].id;

      const updated = updateAdapterStatus(autogenId, 'deprecated');
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('deprecated');

      // Filtering by active should no longer include it
      const active = listAdapters({ status: 'active' });
      const protocols = active.adapters.map(a => a.protocol);
      expect(protocols).not.toContain('autogen');
    });
  });

  // ── Protocol Detection ──

  describe('Protocol Detection', () => {
    it('should detect Google A2A (JSON-RPC with tasks/ method)', () => {
      const result = detectProtocol({
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tasks/send',
          id: '1',
          params: {
            message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
          },
        }),
      });

      expect(result.detected_protocol).toBe('google_a2a');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.adapter_id).not.toBeNull();
    });

    it('should detect OpenAI Agents (Bearer sk- header, /v1/runs URL)', () => {
      const result = detectProtocol({
        headers: { authorization: 'Bearer sk-abc123' },
        body: JSON.stringify({ model: 'gpt-4o', instructions: 'Summarize this' }),
        url: '/v1/runs',
      });

      expect(result.detected_protocol).toBe('openai_agents');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect LangChain (x-langchain-api-key header)', () => {
      const result = detectProtocol({
        headers: { 'x-langchain-api-key': 'lsv2_abc123' },
        body: JSON.stringify({ input: 'What is the weather?', config: { tags: ['test'] } }),
        url: '/invoke',
      });

      expect(result.detected_protocol).toBe('langchain');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect AutoGen (x-autogen-session header)', () => {
      const result = detectProtocol({
        headers: { 'x-autogen-session': 'sess-12345' },
        body: JSON.stringify({
          sender: 'user_proxy',
          recipient: 'assistant',
          messages: [{ role: 'user', content: 'Write a function' }],
        }),
      });

      expect(result.detected_protocol).toBe('autogen');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect MCP (JSON-RPC with tools/ method)', () => {
      const result = detectProtocol({
        headers: { 'x-mcp-version': '1.0.0' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          id: '1',
          params: { name: 'get_weather', arguments: { city: 'SF' } },
        }),
      });

      expect(result.detected_protocol).toBe('mcp');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect rareagent native (x-agent-id header, intent field)', () => {
      const result = detectProtocol({
        headers: { 'x-agent-id': 'agent-001' },
        body: JSON.stringify({
          intent: 'news.summarize',
          input: { text: 'Latest AI news' },
          priority: 'normal',
        }),
      });

      expect(result.detected_protocol).toBe('rareagent');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return custom with low confidence for unknown protocol', () => {
      const result = detectProtocol({
        headers: {},
        body: '{"foo": "bar"}',
      });

      // No strong signals should result in custom or very low confidence
      if (result.candidates.length === 0) {
        expect(result.detected_protocol).toBe('custom');
        expect(result.confidence).toBe(0);
      } else {
        // Even if some weak signals match, confidence should be low
        expect(result.confidence).toBeLessThan(0.5);
      }
    });
  });

  // ── Message Translation ──

  describe('Message Translation', () => {
    it('should translate Google A2A JSON-RPC task to rareagent format', () => {
      const googleMessage = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tasks/send',
        id: 'task-1',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Analyze this data' }] },
          sessionId: 'sess-001',
        },
      });

      const result = translateMessage({
        source_protocol: 'google_a2a',
        target_protocol: 'rareagent',
        message: googleMessage,
      });

      expect(result.translated).toBeDefined();
      const translated = JSON.parse(result.translated);
      expect(translated.intent).toBeDefined();
      expect(result.canonical.source_protocol).toBe('google_a2a');
      expect(result.canonical.type).toBe('task_request');
    });

    it('should translate OpenAI run request to rareagent format', () => {
      const openaiMessage = JSON.stringify({
        instructions: 'Write a poem about the sea',
        model: 'gpt-4o',
        thread_id: 'thread-123',
        assistant_id: 'asst-456',
      });

      const result = translateMessage({
        source_protocol: 'openai_agents',
        target_protocol: 'rareagent',
        message: openaiMessage,
      });

      expect(result.translated).toBeDefined();
      const translated = JSON.parse(result.translated);
      expect(translated.intent).toBeDefined();
      expect(result.canonical.source_protocol).toBe('openai_agents');
      expect(result.canonical.type).toBe('task_request');
    });

    it('should translate LangChain invoke to rareagent format', () => {
      const langchainMessage = JSON.stringify({
        input: 'What are the latest trends in AI?',
        config: { tags: ['research'], metadata: { user: 'test' } },
      });

      const result = translateMessage({
        source_protocol: 'langchain',
        target_protocol: 'rareagent',
        message: langchainMessage,
      });

      expect(result.translated).toBeDefined();
      const translated = JSON.parse(result.translated);
      expect(translated.intent).toBeDefined();
      expect(result.canonical.source_protocol).toBe('langchain');
    });

    it('should translate rareagent to Google A2A format', () => {
      const rareagentMessage = JSON.stringify({
        intent: 'news.summarize',
        input: { text: 'Summarize AI news' },
        priority: 'high',
      });

      const result = translateMessage({
        source_protocol: 'rareagent',
        target_protocol: 'google_a2a',
        message: rareagentMessage,
      });

      expect(result.translated).toBeDefined();
      const translated = JSON.parse(result.translated);
      expect(translated.jsonrpc).toBe('2.0');
      expect(translated.method).toBe('tasks/send');
      expect(translated.params).toBeDefined();
    });

    it('should translate rareagent to OpenAI format', () => {
      const rareagentMessage = JSON.stringify({
        intent: 'ask',
        input: { text: 'What is quantum computing?' },
        priority: 'normal',
      });

      const result = translateMessage({
        source_protocol: 'rareagent',
        target_protocol: 'openai_agents',
        message: rareagentMessage,
      });

      expect(result.translated).toBeDefined();
      const translated = JSON.parse(result.translated);
      expect(translated.instructions).toBeDefined();
      expect(translated.model).toBeDefined();
    });

    it('should auto-detect source protocol during translation', () => {
      const googleMessage = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tasks/send',
        id: '1',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Hello from Google A2A' }] },
        },
      });

      const result = translateMessage({
        source_protocol: 'auto',
        target_protocol: 'rareagent',
        message: googleMessage,
      });

      expect(result.canonical.source_protocol).toBe('google_a2a');
      expect(result.translated).toBeDefined();
    });

    it('should include duration and lossy indicators in translation metadata', () => {
      const message = JSON.stringify({
        instructions: 'Do something',
        model: 'gpt-4o',
        tools: [{ type: 'code_interpreter' }],
        temperature: 0.7,
      });

      const result = translateMessage({
        source_protocol: 'openai_agents',
        target_protocol: 'rareagent',
        message,
      });

      expect(result.translation.duration_ms).toBeGreaterThanOrEqual(0);
      expect(typeof result.translation.lossy).toBe('boolean');
      expect(Array.isArray(result.translation.unmapped_fields)).toBe(true);
      expect(Array.isArray(result.translation.warnings)).toBe(true);
      expect(result.translation.adapter_version).toBeDefined();
    });
  });

  // ── Protocol Negotiation ──

  describe('Protocol Negotiation', () => {
    it('should negotiate successfully when both agents share a protocol', () => {
      const negotiation = startNegotiation(AGENT_A, AGENT_B, [
        { protocol: 'google_a2a', version: '1.0.0', wire_format: 'json-rpc', priority: 1 },
        { protocol: 'rareagent', version: '1.0.0', wire_format: 'json', priority: 2 },
      ]);

      expect(negotiation.status).toBe('pending');

      const resolved = respondToNegotiation(negotiation.id, [
        { protocol: 'google_a2a', version: '1.0.0', wire_format: 'json-rpc', priority: 1 },
      ]);

      expect(resolved.status).toBe('agreed');
      expect(resolved.agreed_protocol).not.toBeNull();
      expect(resolved.agreed_protocol!.protocol).toBe('google_a2a');
      expect(resolved.agreed_protocol!.bridge_side).toBe('none');
      expect(resolved.resolved_at).not.toBeNull();
    });

    it('should negotiate bridge via canonical when protocols differ', () => {
      const negotiation = startNegotiation(AGENT_A, AGENT_B, [
        { protocol: 'google_a2a', version: '1.0.0', wire_format: 'json-rpc', priority: 1 },
      ]);

      const resolved = respondToNegotiation(negotiation.id, [
        { protocol: 'openai_agents', version: '1.0.0', wire_format: 'json', priority: 1 },
      ]);

      expect(resolved.status).toBe('agreed');
      expect(resolved.agreed_protocol).not.toBeNull();
      expect(resolved.agreed_protocol!.protocol).toBe('rareagent');
      expect(resolved.agreed_protocol!.bridge_side).toBe('both');
    });

    it('should fail negotiation when no adapters exist for protocols', () => {
      // Use two different protocols that have no registered adapters.
      // The exact-match path won't fire (different protocols), and the
      // bridge path requires adapters on both sides — so negotiation fails.
      const negotiation = startNegotiation(AGENT_A, AGENT_B, [
        { protocol: 'oasf', version: '1.0.0', wire_format: 'json', priority: 1 },
      ]);

      const resolved = respondToNegotiation(negotiation.id, [
        { protocol: 'custom', version: '1.0.0', wire_format: 'json', priority: 1 },
      ]);

      expect(resolved.status).toBe('failed');
      expect(resolved.agreed_protocol).toBeNull();
    });

    it('should not respond to an already-resolved negotiation', () => {
      const negotiation = startNegotiation(AGENT_A, AGENT_B, [
        { protocol: 'rareagent', version: '1.0.0', wire_format: 'json', priority: 1 },
      ]);

      respondToNegotiation(negotiation.id, [
        { protocol: 'rareagent', version: '1.0.0', wire_format: 'json', priority: 1 },
      ]);

      expect(() => {
        respondToNegotiation(negotiation.id, [
          { protocol: 'rareagent', version: '1.0.0', wire_format: 'json', priority: 1 },
        ]);
      }).toThrow(BridgeError);
    });
  });

  // ── Translation Sessions ──

  describe('Translation Sessions', () => {
    it('should create a session between two agents on different protocols', () => {
      const session = createSession({
        agent_a_id: AGENT_A,
        agent_b_id: AGENT_B,
        agent_a_protocol: 'google_a2a',
        agent_b_protocol: 'openai_agents',
      });

      expect(session.id).toBeDefined();
      expect(session.agent_a.agent_id).toBe(AGENT_A);
      expect(session.agent_a.protocol).toBe('google_a2a');
      expect(session.agent_b.agent_id).toBe(AGENT_B);
      expect(session.agent_b.protocol).toBe('openai_agents');
      expect(session.status).toBe('active');
      expect(session.message_count).toBe(0);
      expect(session.agreed_protocol.bridge_side).toBe('both');
    });

    it('should send messages within a session and track stats', () => {
      const session = createSession({
        agent_a_id: AGENT_A,
        agent_b_id: AGENT_B,
        agent_a_protocol: 'google_a2a',
        agent_b_protocol: 'rareagent',
      });

      const message = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tasks/send',
        id: '1',
        params: {
          message: { role: 'user', parts: [{ type: 'text', text: 'Hello from A' }] },
        },
      });

      const result = sendSessionMessage(session.id, AGENT_A, message);
      expect(result.translated).toBeDefined();
      expect(result.canonical.source_protocol).toBe('google_a2a');

      const updated = getSession(session.id)!;
      expect(updated.message_count).toBe(1);
      expect(updated.stats.messages_translated).toBe(1);
      expect(updated.stats.avg_translation_ms).toBeGreaterThanOrEqual(0);
    });

    it('should increment message count for each message sent', () => {
      const session = createSession({
        agent_a_id: AGENT_A,
        agent_b_id: AGENT_B,
        agent_a_protocol: 'rareagent',
        agent_b_protocol: 'rareagent',
      });

      const msg = JSON.stringify({ intent: 'ask', input: { text: 'Test' } });

      sendSessionMessage(session.id, AGENT_A, msg);
      sendSessionMessage(session.id, AGENT_B, msg);
      sendSessionMessage(session.id, AGENT_A, msg);

      const updated = getSession(session.id)!;
      expect(updated.message_count).toBe(3);
      expect(updated.stats.messages_translated).toBe(3);
    });

    it('should close a session', () => {
      const session = createSession({
        agent_a_id: AGENT_A,
        agent_b_id: AGENT_B,
        agent_a_protocol: 'rareagent',
        agent_b_protocol: 'mcp',
      });

      const closed = closeSession(session.id);
      expect(closed).not.toBeNull();
      expect(closed!.status).toBe('closed');
    });

    it('should not send messages to a closed session', () => {
      const session = createSession({
        agent_a_id: AGENT_A,
        agent_b_id: AGENT_B,
        agent_a_protocol: 'rareagent',
        agent_b_protocol: 'rareagent',
      });

      closeSession(session.id);

      expect(() => {
        sendSessionMessage(
          session.id,
          AGENT_A,
          JSON.stringify({ intent: 'ask', input: { text: 'Too late' } }),
        );
      }).toThrow(BridgeError);
    });

    it('should list sessions filtered by agent_id', () => {
      createSession({
        agent_a_id: AGENT_A,
        agent_b_id: AGENT_B,
        agent_a_protocol: 'rareagent',
        agent_b_protocol: 'google_a2a',
      });
      createSession({
        agent_a_id: AGENT_A,
        agent_b_id: AGENT_C,
        agent_a_protocol: 'rareagent',
        agent_b_protocol: 'mcp',
      });
      createSession({
        agent_a_id: AGENT_B,
        agent_b_id: AGENT_C,
        agent_a_protocol: 'openai_agents',
        agent_b_protocol: 'langchain',
      });

      const agentASessions = listSessions({ agent_id: AGENT_A });
      expect(agentASessions.total).toBe(2);

      const agentCSessions = listSessions({ agent_id: AGENT_C });
      expect(agentCSessions.total).toBe(2);

      const agentBSessions = listSessions({ agent_id: AGENT_B });
      expect(agentBSessions.total).toBe(2);
    });
  });

  // ── Compatibility Matrix ──

  describe('Compatibility Matrix', () => {
    it('should include all active protocols', () => {
      const { protocols, matrix } = getCompatibilityMatrix();
      expect(protocols).toContain('rareagent');
      expect(protocols).toContain('google_a2a');
      expect(protocols).toContain('openai_agents');
      expect(protocols).toContain('langchain');
      expect(protocols).toContain('autogen');
      expect(protocols).toContain('mcp');
      expect(protocols).toHaveLength(6);
      // Matrix should be N x N
      expect(matrix).toHaveLength(6 * 6);
    });

    it('should mark same-protocol pairs as supported and non-lossy', () => {
      const { matrix } = getCompatibilityMatrix();
      const rareToRare = matrix.find(
        e => e.source === 'rareagent' && e.target === 'rareagent',
      )!;

      expect(rareToRare.supported).toBe(true);
      expect(rareToRare.lossy_fields).toHaveLength(0);
      expect(rareToRare.notes).toContain('Native');
    });

    it('should show lossy state count for cross-protocol pairs', () => {
      const { matrix } = getCompatibilityMatrix();
      const rareToGoogle = matrix.find(
        e => e.source === 'rareagent' && e.target === 'google_a2a',
      )!;

      expect(rareToGoogle.supported).toBe(true);
      // Google A2A has lossy states (input-required, canceled)
      expect(rareToGoogle.lossy_fields.length).toBeGreaterThan(0);
      expect(rareToGoogle.notes).toContain('lossy');
    });
  });

  // ── Error Handling ──

  describe('Error Handling', () => {
    it('should throw BridgeError for unknown source adapter', () => {
      expect(() => {
        translateMessage({
          source_protocol: 'oasf',
          target_protocol: 'rareagent',
          message: '{"test": true}',
        });
      }).toThrow(BridgeError);

      try {
        translateMessage({
          source_protocol: 'oasf',
          target_protocol: 'rareagent',
          message: '{"test": true}',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BridgeError);
        expect((err as BridgeError).code).toBe('ADAPTER_NOT_FOUND');
      }
    });

    it('should throw BridgeError for invalid session state', () => {
      const session = createSession({
        agent_a_id: AGENT_A,
        agent_b_id: AGENT_B,
        agent_a_protocol: 'rareagent',
        agent_b_protocol: 'rareagent',
      });

      closeSession(session.id);

      try {
        sendSessionMessage(
          session.id,
          AGENT_A,
          JSON.stringify({ intent: 'ask' }),
        );
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BridgeError);
        expect((err as BridgeError).code).toBe('INVALID_STATE');
      }
    });

    it('should throw BridgeError for unauthorized session participant', () => {
      const session = createSession({
        agent_a_id: AGENT_A,
        agent_b_id: AGENT_B,
        agent_a_protocol: 'rareagent',
        agent_b_protocol: 'rareagent',
      });

      try {
        sendSessionMessage(
          session.id,
          'intruder-agent',
          JSON.stringify({ intent: 'ask' }),
        );
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BridgeError);
        expect((err as BridgeError).code).toBe('UNAUTHORIZED');
      }
    });
  });
});
