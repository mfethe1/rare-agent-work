/**
 * Tests for A2A Capability-Based Task Router
 *
 * Covers: capability matching, agent scoring, routing policies,
 * edge cases, and the full routing pipeline.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreCapabilityMatch,
  scoreRecency,
  scoreAgent,
  routeTask,
} from '@/lib/a2a/router';
import { taskRouteSchema } from '@/lib/a2a/validation';
import type { RegisteredAgent } from '@/lib/a2a';
import { ALL_EVENT_TYPES } from '@/lib/a2a/webhooks/types';

// ──────────────────────────────────────────────
// Test Fixtures
// ──────────────────────────────────────────────

function makeAgent(overrides: Partial<RegisteredAgent> = {}): RegisteredAgent {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'Test Agent',
    description: overrides.description ?? 'A test agent',
    capabilities: overrides.capabilities ?? [],
    trust_level: overrides.trust_level ?? 'verified',
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at ?? new Date().toISOString(),
    last_seen_at: overrides.last_seen_at ?? new Date().toISOString(),
    ...overrides,
  };
}

const newsAgent = makeAgent({
  id: 'agent-news',
  name: 'News Specialist',
  trust_level: 'partner',
  capabilities: [
    { id: 'news.query', description: 'Query and filter news articles', input_modes: ['application/json'], output_modes: ['application/json'] },
    { id: 'news.summarize', description: 'Summarize news by topic', input_modes: ['application/json'], output_modes: ['application/json'] },
  ],
  last_seen_at: new Date().toISOString(),
});

const reportAgent = makeAgent({
  id: 'agent-report',
  name: 'Report Builder',
  trust_level: 'verified',
  capabilities: [
    { id: 'report.generate', description: 'Generate detailed reports', input_modes: ['application/json'], output_modes: ['application/json'] },
    { id: 'report.catalog', description: 'List available reports', input_modes: ['application/json'], output_modes: ['application/json'] },
  ],
  last_seen_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
});

const staleAgent = makeAgent({
  id: 'agent-stale',
  name: 'Stale Agent',
  trust_level: 'untrusted',
  capabilities: [
    { id: 'news.query', description: 'Old news fetcher', input_modes: ['application/json'], output_modes: ['application/json'] },
  ],
  last_seen_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
});

const inactiveAgent = makeAgent({
  id: 'agent-inactive',
  name: 'Inactive Agent',
  is_active: false,
  capabilities: [
    { id: 'news.query', description: 'Deactivated', input_modes: ['application/json'], output_modes: ['application/json'] },
  ],
});

// ──────────────────────────────────────────────
// Capability Matching
// ──────────────────────────────────────────────

describe('scoreCapabilityMatch', () => {
  it('returns 1.0 for exact capability match', () => {
    const result = scoreCapabilityMatch('news.query', newsAgent.capabilities);
    expect(result.score).toBe(1.0);
    expect(result.matched_capability).toBe('news.query');
  });

  it('returns 0.8 for same-domain match', () => {
    const result = scoreCapabilityMatch('news.search', newsAgent.capabilities);
    expect(result.score).toBe(0.8);
    expect(result.matched_capability).not.toBeNull();
  });

  it('returns 0 for no match', () => {
    const result = scoreCapabilityMatch('billing.invoice', newsAgent.capabilities);
    expect(result.score).toBe(0);
    expect(result.matched_capability).toBeNull();
  });

  it('returns 0 for empty capabilities', () => {
    const result = scoreCapabilityMatch('news.query', []);
    expect(result.score).toBe(0);
    expect(result.matched_capability).toBeNull();
  });

  it('picks exact match over domain match', () => {
    const result = scoreCapabilityMatch('news.query', [
      { id: 'news.summarize', description: 'Summarize news', input_modes: ['application/json'], output_modes: ['application/json'] },
      { id: 'news.query', description: 'Query news', input_modes: ['application/json'], output_modes: ['application/json'] },
    ]);
    expect(result.score).toBe(1.0);
    expect(result.matched_capability).toBe('news.query');
  });

  it('matches via keyword overlap in description', () => {
    const caps = [
      { id: 'data.fetch', description: 'Fetch and analyze research reports', input_modes: ['application/json'], output_modes: ['application/json'] },
    ];
    const result = scoreCapabilityMatch('research.analyze', caps);
    // "research" and "analyze" should overlap with description tokens
    expect(result.score).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
// Recency Scoring
// ──────────────────────────────────────────────

describe('scoreRecency', () => {
  it('returns 1.0 for agents seen just now', () => {
    expect(scoreRecency(new Date().toISOString())).toBe(1.0);
  });

  it('returns 1.0 for agents seen within 15 minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(scoreRecency(fiveMinAgo)).toBe(1.0);
  });

  it('returns 0 for agents not seen in 24+ hours', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(scoreRecency(twoDaysAgo)).toBe(0);
  });

  it('returns 0 for null last_seen_at', () => {
    expect(scoreRecency(null)).toBe(0);
  });

  it('returns intermediate value for agents seen hours ago', () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const score = scoreRecency(sixHoursAgo);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

// ──────────────────────────────────────────────
// Agent Scoring
// ──────────────────────────────────────────────

describe('scoreAgent', () => {
  it('scores a partner agent with exact match highly', () => {
    const score = scoreAgent(newsAgent, 'news.query');
    // capability_match=1.0*0.45 + trust(partner=1.0)*0.30 + recency(fresh=1.0)*0.25 = 1.0
    expect(score.composite_score).toBe(1.0);
    expect(score.capability_match).toBe(1.0);
    expect(score.trust_score).toBe(1.0);
    expect(score.agent_id).toBe('agent-news');
  });

  it('scores a stale untrusted agent low', () => {
    const score = scoreAgent(staleAgent, 'news.query');
    // capability=1.0*0.45 + trust(untrusted=0.3)*0.30 + recency(stale=0)*0.25 = 0.45+0.09 = 0.54
    expect(score.composite_score).toBe(0.54);
    expect(score.recency_score).toBe(0);
  });

  it('returns all breakdown fields', () => {
    const score = scoreAgent(newsAgent, 'news.query');
    expect(score).toHaveProperty('agent_id');
    expect(score).toHaveProperty('agent_name');
    expect(score).toHaveProperty('composite_score');
    expect(score).toHaveProperty('capability_match');
    expect(score).toHaveProperty('matched_capability');
    expect(score).toHaveProperty('trust_score');
    expect(score).toHaveProperty('recency_score');
  });
});

// ──────────────────────────────────────────────
// Routing Engine
// ──────────────────────────────────────────────

describe('routeTask', () => {
  const allAgents = [newsAgent, reportAgent, staleAgent, inactiveAgent];

  describe('best-match policy', () => {
    it('selects the single best agent', () => {
      const result = routeTask(allAgents, 'news.query', 'best-match');
      expect(result.matched).toBe(true);
      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].agent_id).toBe('agent-news');
      expect(result.policy).toBe('best-match');
    });

    it('returns routing explanation', () => {
      const result = routeTask(allAgents, 'news.query', 'best-match');
      expect(result.reason).toContain('1 agent(s)');
      expect(result.reason).toContain('best-match');
    });
  });

  describe('broadcast policy', () => {
    it('selects multiple qualifying agents', () => {
      const result = routeTask(allAgents, 'news.query', 'broadcast', 5);
      expect(result.matched).toBe(true);
      expect(result.selected.length).toBeGreaterThanOrEqual(1);
    });

    it('respects max_targets', () => {
      const result = routeTask(allAgents, 'news.query', 'broadcast', 1);
      expect(result.selected).toHaveLength(1);
    });
  });

  describe('round-robin policy', () => {
    it('selects agents with trust diversity', () => {
      const result = routeTask(allAgents, 'news.query', 'round-robin', 3);
      expect(result.matched).toBe(true);
      expect(result.selected.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('returns matched=false when no agents qualify', () => {
      const result = routeTask(allAgents, 'billing.invoice', 'best-match');
      expect(result.matched).toBe(false);
      expect(result.selected).toHaveLength(0);
      expect(result.reason).toContain('No agents found');
    });

    it('excludes inactive agents', () => {
      const result = routeTask([inactiveAgent], 'news.query', 'best-match');
      expect(result.matched).toBe(false);
    });

    it('excludes specified agent IDs', () => {
      const result = routeTask(
        [newsAgent],
        'news.query',
        'best-match',
        3,
        ['agent-news'],
      );
      expect(result.matched).toBe(false);
    });

    it('handles empty candidate list', () => {
      const result = routeTask([], 'news.query', 'best-match');
      expect(result.matched).toBe(false);
      expect(result.candidates_evaluated).toBe(0);
    });

    it('includes all_scores for transparency', () => {
      const result = routeTask(allAgents, 'news.query', 'best-match');
      expect(result.all_scores.length).toBeGreaterThanOrEqual(1);
      // Scores should be sorted descending
      for (let i = 1; i < result.all_scores.length; i++) {
        expect(result.all_scores[i - 1].composite_score)
          .toBeGreaterThanOrEqual(result.all_scores[i].composite_score);
      }
    });
  });
});

// ──────────────────────────────────────────────
// Validation Schema
// ──────────────────────────────────────────────

describe('taskRouteSchema', () => {
  it('validates a minimal routing request', () => {
    const result = taskRouteSchema.safeParse({
      required_capability: 'news.query',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.policy).toBe('best-match');
      expect(result.data.max_targets).toBe(3);
      expect(result.data.priority).toBe('normal');
      expect(result.data.ttl_seconds).toBe(300);
    }
  });

  it('validates a full routing request', () => {
    const result = taskRouteSchema.safeParse({
      required_capability: 'report.generate',
      input: { topic: 'AI agents' },
      policy: 'broadcast',
      max_targets: 5,
      priority: 'high',
      correlation_id: 'workflow-123',
      ttl_seconds: 600,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty required_capability', () => {
    const result = taskRouteSchema.safeParse({
      required_capability: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid policy', () => {
    const result = taskRouteSchema.safeParse({
      required_capability: 'news.query',
      policy: 'random',
    });
    expect(result.success).toBe(false);
  });

  it('rejects max_targets > 10', () => {
    const result = taskRouteSchema.safeParse({
      required_capability: 'news.query',
      max_targets: 20,
    });
    expect(result.success).toBe(false);
  });

  it('rejects max_targets < 1', () => {
    const result = taskRouteSchema.safeParse({
      required_capability: 'news.query',
      max_targets: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Webhook Event Integration
// ──────────────────────────────────────────────

describe('task.routed event', () => {
  it('is included in ALL_EVENT_TYPES', () => {
    expect(ALL_EVENT_TYPES).toContain('task.routed');
  });
});
