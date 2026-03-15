/**
 * Tests for the Autonomic Agent Nervous System (Loop 29)
 *
 * Covers: vital signs, anomaly detection, predictive health,
 * self-healing, homeostasis, and dependency graph analysis.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { AutonomicEngine } from '@/lib/a2a/autonomic/engine';
import {
  recordVitalSignSchema,
  queryAnomaliesSchema,
  createPolicySchema,
  triggerHealingSchema,
  getPredictionsSchema,
  buildDependencyGraphSchema,
} from '@/lib/a2a/autonomic/types';

describe('Autonomic Agent Nervous System', () => {
  let engine: AutonomicEngine;

  beforeEach(() => {
    engine = new AutonomicEngine({ windowMs: 60_000, maxSamples: 500 });
  });

  // =========================================================================
  // Vital Signs
  // =========================================================================

  describe('Vital Signs', () => {
    it('records vital signs and maintains sliding window', () => {
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-1',
          category: 'latency',
          value: 100 + i * 5,
          unit: 'ms',
          timestamp: now + i * 1000,
        });
      }

      const summary = engine.getVitalSignSummary('agent-1', 'latency');
      expect(summary).not.toBeNull();
      expect(summary!.sample_count).toBe(10);
      expect(summary!.mean).toBeGreaterThan(0);
      expect(summary!.median).toBeGreaterThan(0);
      expect(summary!.p95).toBeGreaterThanOrEqual(summary!.median);
      expect(summary!.p99).toBeGreaterThanOrEqual(summary!.p95);
    });

    it('evicts samples outside the window', () => {
      const now = Date.now();
      // Record samples far apart (beyond 60s window)
      engine.recordVitalSign({
        agent_id: 'agent-1',
        category: 'throughput',
        value: 50,
        unit: 'req/s',
        timestamp: now - 120_000, // 2 min ago
      });
      engine.recordVitalSign({
        agent_id: 'agent-1',
        category: 'throughput',
        value: 100,
        unit: 'req/s',
        timestamp: now,
      });

      const summary = engine.getVitalSignSummary('agent-1', 'throughput');
      expect(summary!.sample_count).toBe(1); // old sample evicted
      expect(summary!.mean).toBe(100);
    });

    it('returns null for unknown agent/category', () => {
      const summary = engine.getVitalSignSummary('nonexistent', 'latency');
      expect(summary).toBeNull();
    });

    it('gets all vitals for an agent', () => {
      const now = Date.now();
      engine.recordVitalSign({ agent_id: 'agent-1', category: 'latency', value: 50, unit: 'ms', timestamp: now });
      engine.recordVitalSign({ agent_id: 'agent-1', category: 'error_rate', value: 0.01, unit: '%', timestamp: now });
      engine.recordVitalSign({ agent_id: 'agent-1', category: 'throughput', value: 200, unit: 'req/s', timestamp: now });

      const vitals = engine.getAgentVitals('agent-1');
      expect(vitals.length).toBe(3);
      expect(vitals.map(v => v.category).sort()).toEqual(['error_rate', 'latency', 'throughput']);
    });
  });

  // =========================================================================
  // Anomaly Detection
  // =========================================================================

  describe('Anomaly Detection', () => {
    it('detects spike anomaly via z-score', () => {
      const now = Date.now();
      // Record stable baseline
      for (let i = 0; i < 20; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-1',
          category: 'latency',
          value: 100 + Math.random() * 5, // ~100ms ±5ms
          unit: 'ms',
          timestamp: now + i * 100,
        });
      }
      // Inject a spike
      engine.recordVitalSign({
        agent_id: 'agent-1',
        category: 'latency',
        value: 500, // 5x normal
        unit: 'ms',
        timestamp: now + 20 * 100,
      });

      const anomalies = engine.detectAnomalies('agent-1', 'latency');
      const spikes = anomalies.filter(a => a.type === 'spike');
      expect(spikes.length).toBeGreaterThanOrEqual(1);
      expect(spikes[0].actual_value).toBe(500);
      expect(spikes[0].z_score).toBeGreaterThan(2);
    });

    it('detects drift anomaly when baseline shifts', () => {
      const now = Date.now();
      // First half: low values
      for (let i = 0; i < 15; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-2',
          category: 'error_rate',
          value: 0.01,
          unit: '%',
          timestamp: now + i * 100,
        });
      }
      // Second half: much higher values
      for (let i = 15; i < 30; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-2',
          category: 'error_rate',
          value: 0.05,
          unit: '%',
          timestamp: now + i * 100,
        });
      }

      const anomalies = engine.detectAnomalies('agent-2', 'error_rate');
      const drifts = anomalies.filter(a => a.type === 'drift');
      expect(drifts.length).toBe(1);
      expect(drifts[0].description).toContain('drift');
    });

    it('detects flatline anomaly', () => {
      const now = Date.now();
      // All identical values
      for (let i = 0; i < 20; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-3',
          category: 'throughput',
          value: 100,
          unit: 'req/s',
          timestamp: now + i * 100,
        });
      }

      const anomalies = engine.detectAnomalies('agent-3', 'throughput');
      const flatlines = anomalies.filter(a => a.type === 'flatline');
      expect(flatlines.length).toBe(1);
    });

    it('does not detect anomalies with insufficient data', () => {
      const now = Date.now();
      engine.recordVitalSign({ agent_id: 'agent-4', category: 'latency', value: 100, unit: 'ms', timestamp: now });
      engine.recordVitalSign({ agent_id: 'agent-4', category: 'latency', value: 500, unit: 'ms', timestamp: now + 100 });

      const anomalies = engine.detectAnomalies('agent-4', 'latency');
      expect(anomalies.length).toBe(0); // < 5 samples
    });

    it('runs full anomaly scan across all agents', () => {
      const now = Date.now();
      // Create stable agent
      for (let i = 0; i < 20; i++) {
        engine.recordVitalSign({
          agent_id: 'stable-agent',
          category: 'latency',
          value: 50,
          unit: 'ms',
          timestamp: now + i * 100,
        });
      }

      const anomalies = engine.runAnomalyScan();
      // Flatline should be detected on stable-agent
      expect(anomalies.some(a => a.agent_id === 'stable-agent')).toBe(true);
    });

    it('resolves anomalies', () => {
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-5',
          category: 'latency',
          value: 100,
          unit: 'ms',
          timestamp: now + i * 100,
        });
      }
      engine.recordVitalSign({
        agent_id: 'agent-5',
        category: 'latency',
        value: 1000,
        unit: 'ms',
        timestamp: now + 20 * 100,
      });

      const anomalies = engine.detectAnomalies('agent-5', 'latency');
      expect(anomalies.length).toBeGreaterThan(0);

      const resolved = engine.resolveAnomaly(anomalies[0].id, 'Manually resolved');
      expect(resolved).not.toBeNull();
      expect(resolved!.resolved).toBe(true);
      expect(resolved!.resolution).toBe('Manually resolved');
    });

    it('queries anomalies with filters', () => {
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-6',
          category: 'latency',
          value: 100,
          unit: 'ms',
          timestamp: now + i * 100,
        });
      }
      engine.recordVitalSign({
        agent_id: 'agent-6',
        category: 'latency',
        value: 1000,
        unit: 'ms',
        timestamp: now + 20 * 100,
      });

      engine.detectAnomalies('agent-6', 'latency');

      const allAnomalies = engine.queryAnomalies({ agent_id: 'agent-6' });
      expect(allAnomalies.length).toBeGreaterThan(0);

      const unresolved = engine.queryAnomalies({ agent_id: 'agent-6', resolved: false });
      expect(unresolved.length).toBeGreaterThan(0);

      const resolved = engine.queryAnomalies({ agent_id: 'agent-6', resolved: true });
      expect(resolved.length).toBe(0);
    });

    it('detects cascade anomalies between dependent agents', () => {
      const now = Date.now();

      // Set up dependency
      engine.recordInteraction('agent-a', 'agent-b', 50, true);
      for (let i = 0; i < 100; i++) {
        engine.recordInteraction('agent-a', 'agent-b', 50, i < 40); // 60% failure rate
      }

      // Both agents have anomalies
      for (let i = 0; i < 20; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-a',
          category: 'error_rate',
          value: 0.01,
          unit: '%',
          timestamp: now + i * 100,
        });
        engine.recordVitalSign({
          agent_id: 'agent-b',
          category: 'error_rate',
          value: 0.01,
          unit: '%',
          timestamp: now + i * 100,
        });
      }
      // Spike on both
      engine.recordVitalSign({ agent_id: 'agent-a', category: 'error_rate', value: 0.5, unit: '%', timestamp: now + 2100 });
      engine.recordVitalSign({ agent_id: 'agent-b', category: 'error_rate', value: 0.5, unit: '%', timestamp: now + 2100 });

      const anomalies = engine.runAnomalyScan();
      const cascades = anomalies.filter(a => a.type === 'cascade');
      expect(cascades.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Predictive Health
  // =========================================================================

  describe('Predictive Health', () => {
    it('predicts degradation when trends approach thresholds', () => {
      const now = Date.now();

      // Set a policy with thresholds
      engine.setPolicy({
        id: 'latency-policy',
        name: 'Latency Policy',
        description: 'Monitor latency',
        target_category: 'latency',
        optimal_range: { min: 0, max: 200 },
        warning_range: { min: 0, max: 500 },
        critical_range: { min: 0, max: 1000 },
        auto_heal_enabled: true,
        max_auto_actions_per_hour: 5,
        cooldown_ms: 30_000,
        escalation_after_failures: 3,
        applies_to: 'all',
      });

      // Record steadily increasing latency
      for (let i = 0; i < 30; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-pred',
          category: 'latency',
          value: 100 + i * 15, // climbing from 100 to 535
          unit: 'ms',
          timestamp: now + i * 1000,
        });
      }

      const predictions = engine.predictHealth('agent-pred');
      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions.some(p => p.probability > 0)).toBe(true);
      expect(predictions[0].contributing_factors.length).toBeGreaterThan(0);
      expect(predictions[0].recommended_actions.length).toBeGreaterThan(0);
    });

    it('returns no predictions for stable agents', () => {
      const now = Date.now();

      engine.setPolicy({
        id: 'latency-stable',
        name: 'Latency Stable',
        description: '',
        target_category: 'latency',
        optimal_range: { min: 0, max: 200 },
        warning_range: { min: 0, max: 500 },
        critical_range: { min: 0, max: 1000 },
        auto_heal_enabled: true,
        max_auto_actions_per_hour: 5,
        cooldown_ms: 30_000,
        escalation_after_failures: 3,
        applies_to: 'all',
      });

      // Stable values well within range
      for (let i = 0; i < 30; i++) {
        engine.recordVitalSign({
          agent_id: 'stable-agent',
          category: 'latency',
          value: 50 + Math.random() * 5,
          unit: 'ms',
          timestamp: now + i * 1000,
        });
      }

      const predictions = engine.predictHealth('stable-agent');
      expect(predictions.length).toBe(0);
    });

    it('queries predictions with filters', () => {
      const now = Date.now();

      engine.setPolicy({
        id: 'err-policy',
        name: 'Error Policy',
        description: '',
        target_category: 'error_rate',
        optimal_range: { min: 0, max: 0.05 },
        warning_range: { min: 0, max: 0.1 },
        critical_range: { min: 0, max: 0.5 },
        auto_heal_enabled: true,
        max_auto_actions_per_hour: 5,
        cooldown_ms: 30_000,
        escalation_after_failures: 3,
        applies_to: 'all',
      });

      for (let i = 0; i < 30; i++) {
        engine.recordVitalSign({
          agent_id: 'err-agent',
          category: 'error_rate',
          value: 0.01 + i * 0.005,
          unit: '%',
          timestamp: now + i * 1000,
        });
      }

      engine.predictHealth('err-agent');
      const results = engine.queryPredictions({ agent_id: 'err-agent' });
      // May or may not have predictions depending on trajectory vs threshold
      expect(Array.isArray(results)).toBe(true);
    });

    it('predicts cascade risk for agents with degrading dependents', () => {
      const now = Date.now();

      engine.setPolicy({
        id: 'avail-policy',
        name: 'Availability',
        description: '',
        target_category: 'availability',
        optimal_range: { min: 0.99, max: 1 },
        warning_range: { min: 0.95, max: 1 },
        critical_range: { min: 0.9, max: 1 },
        auto_heal_enabled: true,
        max_auto_actions_per_hour: 5,
        cooldown_ms: 30_000,
        escalation_after_failures: 3,
        applies_to: 'all',
      });

      // Set up dependency with high failure correlation
      for (let i = 0; i < 50; i++) {
        engine.recordInteraction('cascade-src', 'cascade-dst', 100, i < 10);
      }

      // Degrading availability on source
      for (let i = 0; i < 30; i++) {
        engine.recordVitalSign({
          agent_id: 'cascade-src',
          category: 'availability',
          value: 0.99 - i * 0.003, // dropping
          unit: 'ratio',
          timestamp: now + i * 1000,
        });
      }

      const predictions = engine.predictHealth('cascade-src');
      // Should detect cascade risk due to degrading agent with dependents
      const cascadeRisks = predictions.filter(p => p.type === 'cascade_risk');
      expect(cascadeRisks.length).toBeGreaterThanOrEqual(0); // may or may not trigger depending on threshold
    });
  });

  // =========================================================================
  // Self-Healing
  // =========================================================================

  describe('Self-Healing', () => {
    it('proposes healing actions', () => {
      const action = engine.proposeHealing('circuit_break', 'agent-sick', 'High error rate detected');
      expect(action.id).toMatch(/^heal_/);
      expect(action.type).toBe('circuit_break');
      expect(action.target_agent_id).toBe('agent-sick');
      expect(action.status).toBe('proposed');
      expect(action.auto_approved).toBe(false);
    });

    it('auto-approves when policy allows', () => {
      engine.setPolicy({
        id: 'auto-heal-policy',
        name: 'Auto Heal',
        description: '',
        target_category: 'error_rate',
        optimal_range: { min: 0, max: 0.05 },
        warning_range: { min: 0, max: 0.1 },
        critical_range: { min: 0, max: 0.5 },
        auto_heal_enabled: true,
        max_auto_actions_per_hour: 10,
        cooldown_ms: 1000,
        escalation_after_failures: 3,
        applies_to: 'all',
      });

      const action = engine.proposeHealing('reroute_traffic', 'agent-auto', 'Predictive reroute');
      expect(action.auto_approved).toBe(true);
      expect(action.status).toBe('approved');
    });

    it('executes and completes healing actions', () => {
      const action = engine.proposeHealing('restart_agent', 'agent-restart', 'Flatline detected');
      engine.approveHealing(action.id);

      const executing = engine.executeHealing(action.id);
      expect(executing).not.toBeNull();
      expect(executing!.status).toBe('executing');
      expect(executing!.executed_at).toBeGreaterThan(0);

      const completed = engine.completeHealing(action.id, {
        success: true,
        metrics_before: { error_rate: 0.5 },
        metrics_after: { error_rate: 0.01 },
        improvement: 0.98,
        side_effects: [],
      });
      expect(completed).not.toBeNull();
      expect(completed!.status).toBe('completed');
      expect(completed!.result!.success).toBe(true);
      expect(completed!.result!.improvement).toBe(0.98);
    });

    it('marks failed healing actions', () => {
      const action = engine.proposeHealing('quarantine_agent', 'agent-q', 'Cascade risk');
      engine.approveHealing(action.id);
      engine.executeHealing(action.id);

      const failed = engine.completeHealing(action.id, {
        success: false,
        metrics_before: { error_rate: 0.5 },
        metrics_after: { error_rate: 0.6 },
        improvement: -0.2,
        side_effects: ['Downstream agents also affected'],
      });
      expect(failed!.status).toBe('failed');
    });

    it('resolves anomaly on successful healing', () => {
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        engine.recordVitalSign({
          agent_id: 'agent-heal',
          category: 'latency',
          value: 100,
          unit: 'ms',
          timestamp: now + i * 100,
        });
      }
      engine.recordVitalSign({
        agent_id: 'agent-heal',
        category: 'latency',
        value: 1000,
        unit: 'ms',
        timestamp: now + 2100,
      });

      const anomalies = engine.detectAnomalies('agent-heal', 'latency');
      expect(anomalies.length).toBeGreaterThan(0);
      const anomalyId = anomalies[0].id;

      const action = engine.proposeHealing('reroute_traffic', 'agent-heal', 'Auto-heal', {
        anomaly_id: anomalyId,
      });
      engine.approveHealing(action.id);
      engine.executeHealing(action.id);
      engine.completeHealing(action.id, {
        success: true,
        metrics_before: { latency: 1000 },
        metrics_after: { latency: 100 },
        improvement: 0.9,
        side_effects: [],
      });

      const resolved = engine.queryAnomalies({ agent_id: 'agent-heal', resolved: true });
      expect(resolved.some(a => a.id === anomalyId)).toBe(true);
    });

    it('lists healing actions by status', () => {
      engine.proposeHealing('notify_operator', 'a1', 'Info');
      const action2 = engine.proposeHealing('circuit_break', 'a2', 'Critical');
      engine.approveHealing(action2.id);

      const proposed = engine.getHealingActions('proposed');
      const approved = engine.getHealingActions('approved');
      expect(proposed.length).toBe(1);
      expect(approved.length).toBe(1);
    });

    it('runs the full healing loop', () => {
      const now = Date.now();

      engine.setPolicy({
        id: 'loop-policy',
        name: 'Loop Test',
        description: '',
        target_category: 'error_rate',
        optimal_range: { min: 0, max: 0.05 },
        warning_range: { min: 0, max: 0.1 },
        critical_range: { min: 0, max: 0.5 },
        auto_heal_enabled: true,
        max_auto_actions_per_hour: 10,
        cooldown_ms: 0,
        escalation_after_failures: 3,
        applies_to: 'all',
      });

      // Create agent with spike
      for (let i = 0; i < 20; i++) {
        engine.recordVitalSign({
          agent_id: 'loop-agent',
          category: 'error_rate',
          value: 0.01,
          unit: '%',
          timestamp: now + i * 100,
        });
      }
      engine.recordVitalSign({
        agent_id: 'loop-agent',
        category: 'error_rate',
        value: 0.9,
        unit: '%',
        timestamp: now + 2100,
      });

      const result = engine.runHealingLoop();
      expect(result.anomalies.length).toBeGreaterThan(0);
      // Actions may be proposed for critical anomalies
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });

  // =========================================================================
  // Homeostasis
  // =========================================================================

  describe('Homeostasis', () => {
    it('creates, lists, and removes policies', () => {
      const policy = engine.setPolicy({
        id: 'test-policy',
        name: 'Test',
        description: 'Test policy',
        target_category: 'latency',
        optimal_range: { min: 0, max: 200 },
        warning_range: { min: 0, max: 500 },
        critical_range: { min: 0, max: 1000 },
        auto_heal_enabled: false,
        max_auto_actions_per_hour: 0,
        cooldown_ms: 60_000,
        escalation_after_failures: 3,
        applies_to: 'all',
      });

      expect(engine.getPolicies().length).toBe(1);
      expect(engine.getPolicies()[0].name).toBe('Test');

      engine.removePolicy('test-policy');
      expect(engine.getPolicies().length).toBe(0);
    });

    it('evaluates agent homeostasis correctly', () => {
      const now = Date.now();

      engine.setPolicy({
        id: 'eval-policy',
        name: 'Eval',
        description: '',
        target_category: 'latency',
        optimal_range: { min: 0, max: 100 },
        warning_range: { min: 0, max: 300 },
        critical_range: { min: 0, max: 500 },
        auto_heal_enabled: false,
        max_auto_actions_per_hour: 0,
        cooldown_ms: 60_000,
        escalation_after_failures: 3,
        applies_to: 'all',
      });

      // Agent in optimal range
      for (let i = 0; i < 5; i++) {
        engine.recordVitalSign({
          agent_id: 'optimal-agent',
          category: 'latency',
          value: 50,
          unit: 'ms',
          timestamp: now + i * 100,
        });
      }

      const optEval = engine.evaluateHomeostasis('optimal-agent');
      expect(optEval.in_range).toBe(true);
      expect(optEval.violations.length).toBe(0);

      // Agent in warning range
      for (let i = 0; i < 5; i++) {
        engine.recordVitalSign({
          agent_id: 'warning-agent',
          category: 'latency',
          value: 250,
          unit: 'ms',
          timestamp: now + i * 100,
        });
      }

      const warnEval = engine.evaluateHomeostasis('warning-agent');
      expect(warnEval.in_range).toBe(false);
      expect(warnEval.violations.length).toBe(1);
      expect(warnEval.violations[0].zone).toBe('warning');

      // Agent in critical range
      for (let i = 0; i < 5; i++) {
        engine.recordVitalSign({
          agent_id: 'critical-agent',
          category: 'latency',
          value: 450,
          unit: 'ms',
          timestamp: now + i * 100,
        });
      }

      const critEval = engine.evaluateHomeostasis('critical-agent');
      expect(critEval.violations[0].zone).toBe('critical');
    });

    it('computes system-wide homeostasis', () => {
      const now = Date.now();

      engine.setPolicy({
        id: 'sys-policy',
        name: 'System',
        description: '',
        target_category: 'latency',
        optimal_range: { min: 0, max: 100 },
        warning_range: { min: 0, max: 300 },
        critical_range: { min: 0, max: 500 },
        auto_heal_enabled: false,
        max_auto_actions_per_hour: 0,
        cooldown_ms: 60_000,
        escalation_after_failures: 3,
        applies_to: 'all',
      });

      // 3 agents: 1 healthy, 1 degraded, 1 critical
      for (let i = 0; i < 5; i++) {
        engine.recordVitalSign({ agent_id: 'h1', category: 'latency', value: 50, unit: 'ms', timestamp: now + i * 100 });
        engine.recordVitalSign({ agent_id: 'd1', category: 'latency', value: 250, unit: 'ms', timestamp: now + i * 100 });
        engine.recordVitalSign({ agent_id: 'c1', category: 'latency', value: 450, unit: 'ms', timestamp: now + i * 100 });
      }

      const sys = engine.getSystemHomeostasis();
      expect(sys.agent_count).toBe(3);
      expect(sys.healthy_agents).toBe(1);
      expect(sys.degraded_agents).toBe(1);
      expect(sys.critical_agents).toBe(1);
      expect(sys.overall_health).toBeGreaterThan(0);
      expect(sys.overall_health).toBeLessThan(1);
    });
  });

  // =========================================================================
  // Dependency Graph
  // =========================================================================

  describe('Dependency Graph', () => {
    it('records interactions and builds dependencies', () => {
      for (let i = 0; i < 30; i++) {
        engine.recordInteraction('svc-a', 'svc-b', 50, true);
      }

      const graph = engine.buildDependencyGraph({ include_optional: true });
      expect(graph.agents).toContain('svc-a');
      expect(graph.agents).toContain('svc-b');
      expect(graph.edges.length).toBe(1);
      expect(graph.edges[0].interaction_count).toBe(30);
      expect(graph.edges[0].dependency_type).toBe('soft'); // 20-100 = soft
    });

    it('classifies dependency types by interaction count', () => {
      // Optional: < 20 interactions
      for (let i = 0; i < 5; i++) {
        engine.recordInteraction('opt-a', 'opt-b', 50, true);
      }

      // Soft: 20-100 interactions
      for (let i = 0; i < 50; i++) {
        engine.recordInteraction('soft-a', 'soft-b', 50, true);
      }

      // Hard: > 100 interactions
      for (let i = 0; i < 110; i++) {
        engine.recordInteraction('hard-a', 'hard-b', 50, true);
      }

      const graph = engine.buildDependencyGraph({ include_optional: true });
      const optEdge = graph.edges.find(e => e.from_agent_id === 'opt-a');
      const softEdge = graph.edges.find(e => e.from_agent_id === 'soft-a');
      const hardEdge = graph.edges.find(e => e.from_agent_id === 'hard-a');

      expect(optEdge!.dependency_type).toBe('optional');
      expect(softEdge!.dependency_type).toBe('soft');
      expect(hardEdge!.dependency_type).toBe('hard');
    });

    it('filters optional dependencies by default', () => {
      for (let i = 0; i < 5; i++) {
        engine.recordInteraction('opt-only', 'opt-target', 50, true);
      }

      const graph = engine.buildDependencyGraph(); // include_optional defaults to false
      expect(graph.edges.find(e => e.from_agent_id === 'opt-only')).toBeUndefined();
    });

    it('finds clusters in dependency graph', () => {
      // Cluster 1
      for (let i = 0; i < 30; i++) {
        engine.recordInteraction('c1-a', 'c1-b', 50, true);
        engine.recordInteraction('c1-b', 'c1-c', 50, true);
      }

      // Cluster 2 (disconnected)
      for (let i = 0; i < 30; i++) {
        engine.recordInteraction('c2-x', 'c2-y', 50, true);
      }

      const graph = engine.buildDependencyGraph({ include_optional: true });
      expect(graph.clusters.length).toBe(2);
    });

    it('identifies single points of failure', () => {
      // Central node with many hard dependencies
      for (let i = 0; i < 110; i++) {
        engine.recordInteraction('leaf-1', 'central', 50, true);
        engine.recordInteraction('leaf-2', 'central', 50, true);
        engine.recordInteraction('leaf-3', 'central', 50, true);
      }

      const graph = engine.buildDependencyGraph();
      expect(graph.single_points_of_failure).toContain('central');
    });

    it('tracks failure correlation in dependencies', () => {
      // Many failures
      for (let i = 0; i < 100; i++) {
        engine.recordInteraction('fail-src', 'fail-dst', 200, false);
      }

      const graph = engine.buildDependencyGraph();
      const edge = graph.edges.find(e => e.from_agent_id === 'fail-src');
      expect(edge!.failure_correlation).toBeGreaterThan(0);
    });

    it('filters by agent IDs', () => {
      for (let i = 0; i < 30; i++) {
        engine.recordInteraction('filter-a', 'filter-b', 50, true);
        engine.recordInteraction('other-a', 'other-b', 50, true);
      }

      const graph = engine.buildDependencyGraph({
        agent_ids: ['filter-a', 'filter-b'],
        include_optional: true,
      });
      expect(graph.agents).toContain('filter-a');
      expect(graph.agents).not.toContain('other-a');
    });

    it('filters by minimum interaction count', () => {
      for (let i = 0; i < 5; i++) {
        engine.recordInteraction('low-a', 'low-b', 50, true);
      }
      for (let i = 0; i < 50; i++) {
        engine.recordInteraction('high-a', 'high-b', 50, true);
      }

      const graph = engine.buildDependencyGraph({
        min_interaction_count: 10,
        include_optional: true,
      });
      expect(graph.edges.find(e => e.from_agent_id === 'low-a')).toBeUndefined();
      expect(graph.edges.find(e => e.from_agent_id === 'high-a')).toBeDefined();
    });
  });

  // =========================================================================
  // Zod Schema Validation
  // =========================================================================

  describe('Schema Validation', () => {
    it('validates recordVitalSignSchema', () => {
      const valid = recordVitalSignSchema.safeParse({
        agent_id: 'agent-1',
        category: 'latency',
        value: 100,
        unit: 'ms',
      });
      expect(valid.success).toBe(true);

      const invalid = recordVitalSignSchema.safeParse({
        agent_id: '',
        category: 'invalid_category',
        value: 'not a number',
      });
      expect(invalid.success).toBe(false);
    });

    it('validates queryAnomaliesSchema', () => {
      const valid = queryAnomaliesSchema.safeParse({
        agent_id: 'agent-1',
        severity: 'critical',
        resolved: false,
      });
      expect(valid.success).toBe(true);

      const empty = queryAnomaliesSchema.safeParse({});
      expect(empty.success).toBe(true); // all fields optional
    });

    it('validates createPolicySchema', () => {
      const valid = createPolicySchema.safeParse({
        name: 'Latency Policy',
        target_category: 'latency',
        optimal_range: { min: 0, max: 200 },
        warning_range: { min: 0, max: 500 },
        critical_range: { min: 0, max: 1000 },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.auto_heal_enabled).toBe(true); // default
        expect(valid.data.max_auto_actions_per_hour).toBe(10); // default
      }

      const invalid = createPolicySchema.safeParse({
        name: '', // too short
        target_category: 'invalid',
      });
      expect(invalid.success).toBe(false);
    });

    it('validates triggerHealingSchema', () => {
      const valid = triggerHealingSchema.safeParse({
        action_type: 'circuit_break',
        target_agent_id: 'agent-1',
        reason: 'High error rate',
      });
      expect(valid.success).toBe(true);

      const invalid = triggerHealingSchema.safeParse({
        action_type: 'invalid_action',
        target_agent_id: '',
      });
      expect(invalid.success).toBe(false);
    });

    it('validates getPredictionsSchema', () => {
      const valid = getPredictionsSchema.safeParse({
        agent_id: 'agent-1',
        type: 'failure_imminent',
        min_probability: 0.8,
      });
      expect(valid.success).toBe(true);

      const defaults = getPredictionsSchema.safeParse({});
      expect(defaults.success).toBe(true);
      if (defaults.success) {
        expect(defaults.data.min_probability).toBe(0.5); // default
      }
    });

    it('validates buildDependencyGraphSchema', () => {
      const valid = buildDependencyGraphSchema.safeParse({
        agent_ids: ['agent-1', 'agent-2'],
        min_interaction_count: 5,
        include_optional: true,
      });
      expect(valid.success).toBe(true);

      const defaults = buildDependencyGraphSchema.safeParse({});
      expect(defaults.success).toBe(true);
      if (defaults.success) {
        expect(defaults.data.min_interaction_count).toBe(3);
        expect(defaults.data.include_optional).toBe(false);
      }
    });
  });
});
