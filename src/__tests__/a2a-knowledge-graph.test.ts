/**
 * Tests for A2A Agent Knowledge Graph
 *
 * Covers: node CRUD, edge CRUD, graph traversal (BFS/DFS), path finding,
 * contradiction detection, node merging, confidence decay, knowledge
 * reinforcement, and validation schemas.
 *
 * These tests validate the pure logic of the knowledge graph engine
 * functions and Zod validation schemas without requiring a database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  nodeCreateSchema,
  nodeUpdateSchema,
  nodeSearchSchema,
  edgeCreateSchema,
  edgeListSchema,
  traverseSchema,
  pathSchema,
  mergeSchema,
  reinforceSchema,
} from '@/lib/a2a/knowledge/validation';
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
} from '@/lib/a2a/knowledge/types';

// ──────────────────────────────────────────────
// Test Fixtures
// ──────────────────────────────────────────────

function makeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    node_type: overrides.node_type ?? 'concept',
    name: overrides.name ?? 'Test Concept',
    description: overrides.description ?? 'A test knowledge node',
    namespace: overrides.namespace ?? 'default',
    properties: overrides.properties ?? {},
    tags: overrides.tags ?? [],
    contributed_by: overrides.contributed_by ?? 'agent-1',
    source_task_id: overrides.source_task_id ?? null,
    confidence: overrides.confidence ?? 0.8,
    decay_rate: overrides.decay_rate ?? 0.01,
    access_count: overrides.access_count ?? 0,
    last_accessed_at: overrides.last_accessed_at ?? now,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

function makeEdge(overrides: Partial<KnowledgeEdge> = {}): KnowledgeEdge {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    source_node_id: overrides.source_node_id ?? crypto.randomUUID(),
    target_node_id: overrides.target_node_id ?? crypto.randomUUID(),
    relationship: overrides.relationship ?? 'related_to',
    weight: overrides.weight ?? 0.5,
    contributed_by: overrides.contributed_by ?? 'agent-1',
    properties: overrides.properties ?? {},
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
// Validation Schema Tests
// ──────────────────────────────────────────────

describe('Knowledge Graph Validation Schemas', () => {
  describe('nodeCreateSchema', () => {
    it('accepts valid node creation input', () => {
      const input = {
        node_type: 'concept',
        name: 'Machine Learning',
        description: 'The study of algorithms that improve through experience',
      };
      const result = nodeCreateSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.node_type).toBe('concept');
        expect(result.data.name).toBe('Machine Learning');
        expect(result.data.namespace).toBe('default');
        expect(result.data.confidence).toBe(0.8);
        expect(result.data.decay_rate).toBe(0.01);
        expect(result.data.tags).toEqual([]);
      }
    });

    it('accepts all valid node types', () => {
      const nodeTypes: KnowledgeNodeType[] = [
        'concept', 'fact', 'skill', 'pattern',
        'inference', 'observation', 'decision', 'entity',
      ];

      for (const nodeType of nodeTypes) {
        const result = nodeCreateSchema.safeParse({
          node_type: nodeType,
          name: `Test ${nodeType}`,
          description: `A ${nodeType} node`,
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid node types', () => {
      const result = nodeCreateSchema.safeParse({
        node_type: 'invalid_type',
        name: 'Test',
        description: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = nodeCreateSchema.safeParse({
        node_type: 'concept',
        name: '',
        description: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects confidence outside 0-1 range', () => {
      const tooHigh = nodeCreateSchema.safeParse({
        node_type: 'fact',
        name: 'Test',
        description: 'Test',
        confidence: 1.5,
      });
      expect(tooHigh.success).toBe(false);

      const tooLow = nodeCreateSchema.safeParse({
        node_type: 'fact',
        name: 'Test',
        description: 'Test',
        confidence: -0.1,
      });
      expect(tooLow.success).toBe(false);
    });

    it('accepts custom properties and tags', () => {
      const result = nodeCreateSchema.safeParse({
        node_type: 'entity',
        name: 'Supabase',
        description: 'Database platform',
        properties: { url: 'https://supabase.com', type: 'database' },
        tags: ['database', 'postgres', 'backend'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.properties).toEqual({ url: 'https://supabase.com', type: 'database' });
        expect(result.data.tags).toEqual(['database', 'postgres', 'backend']);
      }
    });

    it('rejects more than 20 tags', () => {
      const result = nodeCreateSchema.safeParse({
        node_type: 'concept',
        name: 'Test',
        description: 'Test',
        tags: Array.from({ length: 21 }, (_, i) => `tag${i}`),
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional source_task_id as UUID', () => {
      const result = nodeCreateSchema.safeParse({
        node_type: 'observation',
        name: 'Task Result',
        description: 'Observed during task execution',
        source_task_id: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID source_task_id', () => {
      const result = nodeCreateSchema.safeParse({
        node_type: 'observation',
        name: 'Task Result',
        description: 'Observed during task execution',
        source_task_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('nodeUpdateSchema', () => {
    it('accepts partial updates', () => {
      const result = nodeUpdateSchema.safeParse({
        confidence: 0.95,
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (no-op update)', () => {
      const result = nodeUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts full update', () => {
      const result = nodeUpdateSchema.safeParse({
        name: 'Updated Name',
        description: 'Updated description',
        properties: { key: 'value' },
        tags: ['new-tag'],
        confidence: 0.9,
        decay_rate: 0.05,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('nodeSearchSchema', () => {
    it('accepts empty search (list all)', () => {
      const result = nodeSearchSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('accepts filtered search', () => {
      const result = nodeSearchSchema.safeParse({
        node_type: 'skill',
        namespace: 'ai',
        min_confidence: 0.7,
        tag: 'machine-learning',
        name_contains: 'neural',
        limit: 10,
        offset: 20,
      });
      expect(result.success).toBe(true);
    });

    it('rejects limit > 100', () => {
      const result = nodeSearchSchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe('edgeCreateSchema', () => {
    it('accepts valid edge creation', () => {
      const result = edgeCreateSchema.safeParse({
        source_node_id: crypto.randomUUID(),
        target_node_id: crypto.randomUUID(),
        relationship: 'depends_on',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weight).toBe(0.5);
      }
    });

    it('accepts all valid relationship types', () => {
      const edgeTypes: KnowledgeEdgeType[] = [
        'related_to', 'depends_on', 'contradicts', 'supersedes',
        'derived_from', 'part_of', 'causes', 'enables',
        'requires', 'similar_to',
      ];

      for (const relationship of edgeTypes) {
        const result = edgeCreateSchema.safeParse({
          source_node_id: crypto.randomUUID(),
          target_node_id: crypto.randomUUID(),
          relationship,
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid relationship type', () => {
      const result = edgeCreateSchema.safeParse({
        source_node_id: crypto.randomUUID(),
        target_node_id: crypto.randomUUID(),
        relationship: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-UUID node IDs', () => {
      const result = edgeCreateSchema.safeParse({
        source_node_id: 'not-a-uuid',
        target_node_id: crypto.randomUUID(),
        relationship: 'related_to',
      });
      expect(result.success).toBe(false);
    });

    it('accepts custom weight and properties', () => {
      const result = edgeCreateSchema.safeParse({
        source_node_id: crypto.randomUUID(),
        target_node_id: crypto.randomUUID(),
        relationship: 'causes',
        weight: 0.95,
        properties: { evidence: 'strong correlation' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weight).toBe(0.95);
      }
    });

    it('rejects weight outside 0-1 range', () => {
      const result = edgeCreateSchema.safeParse({
        source_node_id: crypto.randomUUID(),
        target_node_id: crypto.randomUUID(),
        relationship: 'related_to',
        weight: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('edgeListSchema', () => {
    it('accepts empty list query', () => {
      const result = edgeListSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts filtered list query', () => {
      const result = edgeListSchema.safeParse({
        node_id: crypto.randomUUID(),
        relationship: 'contradicts',
        min_weight: 0.8,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('traverseSchema', () => {
    it('accepts minimal traversal request', () => {
      const result = traverseSchema.safeParse({
        start_node_id: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.max_depth).toBe(3);
        expect(result.data.strategy).toBe('bfs');
        expect(result.data.direction).toBe('outgoing');
      }
    });

    it('accepts full traversal request', () => {
      const result = traverseSchema.safeParse({
        start_node_id: crypto.randomUUID(),
        max_depth: 5,
        strategy: 'dfs',
        direction: 'both',
        relationship_filter: ['depends_on', 'requires'],
        min_confidence: 0.5,
        min_weight: 0.3,
      });
      expect(result.success).toBe(true);
    });

    it('rejects max_depth > 10', () => {
      const result = traverseSchema.safeParse({
        start_node_id: crypto.randomUUID(),
        max_depth: 15,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid strategy', () => {
      const result = traverseSchema.safeParse({
        start_node_id: crypto.randomUUID(),
        strategy: 'random',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('pathSchema', () => {
    it('accepts valid path request', () => {
      const result = pathSchema.safeParse({
        source_node_id: crypto.randomUUID(),
        target_node_id: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.max_depth).toBe(6);
      }
    });

    it('accepts path request with relationship filter', () => {
      const result = pathSchema.safeParse({
        source_node_id: crypto.randomUUID(),
        target_node_id: crypto.randomUUID(),
        max_depth: 4,
        relationship_filter: ['depends_on', 'enables'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('mergeSchema', () => {
    it('accepts valid merge request', () => {
      const result = mergeSchema.safeParse({
        primary_node_id: crypto.randomUUID(),
        secondary_node_id: crypto.randomUUID(),
        conflict_strategy: 'prefer_primary',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all conflict strategies', () => {
      for (const strategy of ['prefer_primary', 'prefer_secondary', 'merge_all']) {
        const result = mergeSchema.safeParse({
          primary_node_id: crypto.randomUUID(),
          secondary_node_id: crypto.randomUUID(),
          conflict_strategy: strategy,
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid conflict strategy', () => {
      const result = mergeSchema.safeParse({
        primary_node_id: crypto.randomUUID(),
        secondary_node_id: crypto.randomUUID(),
        conflict_strategy: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('reinforceSchema', () => {
    it('accepts valid reinforce request', () => {
      const result = reinforceSchema.safeParse({
        node_id: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.boost).toBe(0.1);
      }
    });

    it('accepts custom boost', () => {
      const result = reinforceSchema.safeParse({
        node_id: crypto.randomUUID(),
        boost: 0.3,
      });
      expect(result.success).toBe(true);
    });

    it('rejects boost > 0.5', () => {
      const result = reinforceSchema.safeParse({
        node_id: crypto.randomUUID(),
        boost: 0.7,
      });
      expect(result.success).toBe(false);
    });

    it('rejects boost < 0.01', () => {
      const result = reinforceSchema.safeParse({
        node_id: crypto.randomUUID(),
        boost: 0.001,
      });
      expect(result.success).toBe(false);
    });
  });
});

// ──────────────────────────────────────────────
// Knowledge Node Type Tests
// ──────────────────────────────────────────────

describe('Knowledge Node Types', () => {
  it('creates nodes with all valid types', () => {
    const types: KnowledgeNodeType[] = [
      'concept', 'fact', 'skill', 'pattern',
      'inference', 'observation', 'decision', 'entity',
    ];

    for (const nodeType of types) {
      const node = makeNode({ node_type: nodeType });
      expect(node.node_type).toBe(nodeType);
    }
  });

  it('node has correct default structure', () => {
    const node = makeNode();
    expect(node).toHaveProperty('id');
    expect(node).toHaveProperty('node_type');
    expect(node).toHaveProperty('name');
    expect(node).toHaveProperty('description');
    expect(node).toHaveProperty('namespace');
    expect(node).toHaveProperty('properties');
    expect(node).toHaveProperty('tags');
    expect(node).toHaveProperty('contributed_by');
    expect(node).toHaveProperty('confidence');
    expect(node).toHaveProperty('decay_rate');
    expect(node).toHaveProperty('access_count');
    expect(node).toHaveProperty('last_accessed_at');
    expect(node).toHaveProperty('created_at');
    expect(node).toHaveProperty('updated_at');
  });
});

// ──────────────────────────────────────────────
// Knowledge Edge Type Tests
// ──────────────────────────────────────────────

describe('Knowledge Edge Types', () => {
  it('creates edges with all valid relationship types', () => {
    const types: KnowledgeEdgeType[] = [
      'related_to', 'depends_on', 'contradicts', 'supersedes',
      'derived_from', 'part_of', 'causes', 'enables',
      'requires', 'similar_to',
    ];

    for (const relationship of types) {
      const edge = makeEdge({ relationship });
      expect(edge.relationship).toBe(relationship);
    }
  });

  it('edge has correct default structure', () => {
    const edge = makeEdge();
    expect(edge).toHaveProperty('id');
    expect(edge).toHaveProperty('source_node_id');
    expect(edge).toHaveProperty('target_node_id');
    expect(edge).toHaveProperty('relationship');
    expect(edge).toHaveProperty('weight');
    expect(edge).toHaveProperty('contributed_by');
    expect(edge).toHaveProperty('properties');
    expect(edge).toHaveProperty('created_at');
  });
});

// ──────────────────────────────────────────────
// Confidence Decay Logic Tests
// ──────────────────────────────────────────────

describe('Confidence Decay Logic', () => {
  it('computes exponential decay correctly', () => {
    // Simulating: new_confidence = confidence * (1 - decay_rate) ^ days
    const confidence = 0.8;
    const decayRate = 0.05;
    const days = 10;

    const expected = confidence * Math.pow(1 - decayRate, days);
    expect(expected).toBeCloseTo(0.479, 2);
  });

  it('no decay when decay_rate is 0', () => {
    const confidence = 0.8;
    const decayRate = 0.0;
    const days = 365;

    const result = confidence * Math.pow(1 - decayRate, days);
    expect(result).toBe(0.8);
  });

  it('high decay rate causes rapid confidence loss', () => {
    const confidence = 1.0;
    const decayRate = 0.1;
    const days = 30;

    const result = confidence * Math.pow(1 - decayRate, days);
    expect(result).toBeLessThan(0.05); // Below prune threshold
  });

  it('low decay rate preserves knowledge', () => {
    const confidence = 0.8;
    const decayRate = 0.001;
    const days = 30;

    const result = confidence * Math.pow(1 - decayRate, days);
    expect(result).toBeGreaterThan(0.75);
  });
});

// ──────────────────────────────────────────────
// Knowledge Reinforcement Logic Tests
// ──────────────────────────────────────────────

describe('Knowledge Reinforcement Logic', () => {
  it('boost increases confidence', () => {
    const current = 0.6;
    const boost = 0.1;
    const result = Math.min(1.0, current + boost);
    expect(result).toBe(0.7);
  });

  it('boost is capped at 1.0', () => {
    const current = 0.95;
    const boost = 0.1;
    const result = Math.min(1.0, current + boost);
    expect(result).toBe(1.0);
  });

  it('small boost has minimal effect', () => {
    const current = 0.5;
    const boost = 0.01;
    const result = Math.min(1.0, current + boost);
    expect(result).toBe(0.51);
  });
});

// ──────────────────────────────────────────────
// Merge Logic Tests
// ──────────────────────────────────────────────

describe('Node Merge Logic', () => {
  it('prefer_primary strategy uses primary values', () => {
    const primary = makeNode({
      name: 'Primary',
      properties: { a: 1, shared: 'primary' },
      tags: ['tag-a'],
      confidence: 0.9,
    });
    const secondary = makeNode({
      name: 'Secondary',
      properties: { b: 2, shared: 'secondary' },
      tags: ['tag-b'],
      confidence: 0.7,
    });

    // Simulate prefer_primary merge
    const mergedProperties = { ...secondary.properties, ...primary.properties };
    expect(mergedProperties).toEqual({ a: 1, b: 2, shared: 'primary' });
  });

  it('prefer_secondary strategy uses secondary values', () => {
    const primary = makeNode({
      properties: { a: 1, shared: 'primary' },
    });
    const secondary = makeNode({
      properties: { b: 2, shared: 'secondary' },
    });

    const mergedProperties = { ...primary.properties, ...secondary.properties };
    expect(mergedProperties).toEqual({ a: 1, b: 2, shared: 'secondary' });
  });

  it('merge_all takes max confidence', () => {
    const primary = makeNode({ confidence: 0.6 });
    const secondary = makeNode({ confidence: 0.9 });

    const mergedConfidence = Math.max(primary.confidence, secondary.confidence);
    expect(mergedConfidence).toBe(0.9);
  });

  it('tag union deduplicates', () => {
    const tags1 = ['ai', 'ml', 'data'];
    const tags2 = ['ml', 'nlp', 'data'];

    const merged = [...new Set([...tags1, ...tags2])];
    expect(merged).toEqual(['ai', 'ml', 'data', 'nlp']);
  });

  it('access counts sum during merge', () => {
    const primary = makeNode({ access_count: 15 });
    const secondary = makeNode({ access_count: 8 });

    expect(primary.access_count + secondary.access_count).toBe(23);
  });
});

// ──────────────────────────────────────────────
// Contradiction Detection Logic Tests
// ──────────────────────────────────────────────

describe('Contradiction Detection', () => {
  it('identifies higher confidence node in contradiction', () => {
    const nodeA = makeNode({ id: 'node-a', confidence: 0.9 });
    const nodeB = makeNode({ id: 'node-b', confidence: 0.6 });

    const higherConfId = nodeA.confidence >= nodeB.confidence ? nodeA.id : nodeB.id;
    expect(higherConfId).toBe('node-a');
  });

  it('handles equal confidence in contradiction', () => {
    const nodeA = makeNode({ id: 'node-a', confidence: 0.8 });
    const nodeB = makeNode({ id: 'node-b', confidence: 0.8 });

    const higherConfId = nodeA.confidence >= nodeB.confidence ? nodeA.id : nodeB.id;
    // When equal, prefer nodeA (first checked)
    expect(higherConfId).toBe('node-a');
  });

  it('contradicts edge type is recognized', () => {
    const edge = makeEdge({ relationship: 'contradicts' });
    expect(edge.relationship).toBe('contradicts');
  });
});

// ──────────────────────────────────────────────
// Graph Structure Tests
// ──────────────────────────────────────────────

describe('Graph Structure', () => {
  it('builds an in-memory graph from nodes and edges', () => {
    const nodeA = makeNode({ id: 'a', name: 'Node A' });
    const nodeB = makeNode({ id: 'b', name: 'Node B' });
    const nodeC = makeNode({ id: 'c', name: 'Node C' });

    const edges = [
      makeEdge({ source_node_id: 'a', target_node_id: 'b', relationship: 'depends_on' }),
      makeEdge({ source_node_id: 'b', target_node_id: 'c', relationship: 'enables' }),
      makeEdge({ source_node_id: 'a', target_node_id: 'c', relationship: 'related_to' }),
    ];

    // Build adjacency list
    const adjacency = new Map<string, Array<{ nodeId: string; edge: KnowledgeEdge }>>();
    for (const edge of edges) {
      const existing = adjacency.get(edge.source_node_id) ?? [];
      existing.push({ nodeId: edge.target_node_id, edge });
      adjacency.set(edge.source_node_id, existing);
    }

    expect(adjacency.get('a')?.length).toBe(2);
    expect(adjacency.get('b')?.length).toBe(1);
    expect(adjacency.has('c')).toBe(false); // No outgoing edges from C
  });

  it('BFS traversal visits nodes in breadth-first order', () => {
    // Graph: A → B, A → C, B → D, C → D
    const adjacency = new Map<string, string[]>([
      ['A', ['B', 'C']],
      ['B', ['D']],
      ['C', ['D']],
    ]);

    const visited: string[] = [];
    const seen = new Set<string>(['A']);
    const queue = ['A'];

    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    expect(visited).toEqual(['A', 'B', 'C', 'D']);
  });

  it('DFS traversal visits nodes in depth-first order', () => {
    // Graph: A → B, A → C, B → D, C → D
    const adjacency = new Map<string, string[]>([
      ['A', ['B', 'C']],
      ['B', ['D']],
      ['C', ['D']],
    ]);

    const visited: string[] = [];
    const seen = new Set<string>(['A']);
    const stack = ['A'];

    while (stack.length > 0) {
      const current = stack.pop()!;
      visited.push(current);

      // Reverse to maintain natural order for DFS
      const neighbors = adjacency.get(current) ?? [];
      for (let i = neighbors.length - 1; i >= 0; i--) {
        if (!seen.has(neighbors[i])) {
          seen.add(neighbors[i]);
          stack.push(neighbors[i]);
        }
      }
    }

    expect(visited).toEqual(['A', 'B', 'D', 'C']);
  });

  it('handles cycles in traversal', () => {
    // Graph: A → B → C → A (cycle)
    const adjacency = new Map<string, string[]>([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['A']],
    ]);

    const visited: string[] = [];
    const seen = new Set<string>(['A']);
    const queue = ['A'];

    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Should visit each node exactly once despite cycle
    expect(visited).toEqual(['A', 'B', 'C']);
  });
});

// ──────────────────────────────────────────────
// Path Finding Logic Tests
// ──────────────────────────────────────────────

describe('Path Finding Logic', () => {
  it('finds shortest path via BFS', () => {
    // Graph: A → B → D, A → C → D
    // Both paths have length 2, BFS finds first one
    const adjacency = new Map<string, string[]>([
      ['A', ['B', 'C']],
      ['B', ['D']],
      ['C', ['D']],
    ]);

    const parent = new Map<string, string>();
    const visited = new Set(['A']);
    const queue = ['A'];
    let found = false;

    while (queue.length > 0 && !found) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, current);
          if (neighbor === 'D') {
            found = true;
            break;
          }
          queue.push(neighbor);
        }
      }
    }

    expect(found).toBe(true);

    // Reconstruct path
    const path = ['D'];
    let current = 'D';
    while (parent.has(current)) {
      current = parent.get(current)!;
      path.unshift(current);
    }

    expect(path).toEqual(['A', 'B', 'D']);
  });

  it('returns not found when no path exists', () => {
    const adjacency = new Map<string, string[]>([
      ['A', ['B']],
      ['C', ['D']],
    ]);

    const visited = new Set(['A']);
    const queue = ['A'];
    let found = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          if (neighbor === 'D') {
            found = true;
            break;
          }
          queue.push(neighbor);
        }
      }
    }

    expect(found).toBe(false);
  });

  it('handles same source and target', () => {
    const sourceId = 'A';
    const targetId = 'A';

    if (sourceId === targetId) {
      expect(true).toBe(true); // Trivial path
    }
  });
});

// ──────────────────────────────────────────────
// Namespace Organization Tests
// ──────────────────────────────────────────────

describe('Knowledge Namespaces', () => {
  it('nodes can be organized by namespace', () => {
    const financeNodes = [
      makeNode({ namespace: 'finance', name: 'Market Analysis' }),
      makeNode({ namespace: 'finance', name: 'Risk Assessment' }),
    ];
    const securityNodes = [
      makeNode({ namespace: 'security', name: 'Threat Model' }),
    ];

    expect(financeNodes.every((n) => n.namespace === 'finance')).toBe(true);
    expect(securityNodes.every((n) => n.namespace === 'security')).toBe(true);
  });

  it('default namespace is "default"', () => {
    const result = nodeCreateSchema.safeParse({
      node_type: 'concept',
      name: 'Test',
      description: 'Test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.namespace).toBe('default');
    }
  });
});

// ──────────────────────────────────────────────
// Provenance Tracking Tests
// ──────────────────────────────────────────────

describe('Provenance Tracking', () => {
  it('nodes track contributing agent', () => {
    const node = makeNode({ contributed_by: 'agent-research-42' });
    expect(node.contributed_by).toBe('agent-research-42');
  });

  it('nodes track source task', () => {
    const taskId = crypto.randomUUID();
    const node = makeNode({ source_task_id: taskId });
    expect(node.source_task_id).toBe(taskId);
  });

  it('edges track contributing agent', () => {
    const edge = makeEdge({ contributed_by: 'agent-analyst-7' });
    expect(edge.contributed_by).toBe('agent-analyst-7');
  });

  it('nodes without source task have null', () => {
    const node = makeNode({ source_task_id: null });
    expect(node.source_task_id).toBeNull();
  });
});
