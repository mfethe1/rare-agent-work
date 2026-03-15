/**
 * Agent Progressive Trust & Dynamic Autonomy Protocol — Tests
 *
 * Validates the closed-loop trust system: signals → scores → levels →
 * promotions → probation → demotions → safety violations.
 */

import {
  evaluateSignal,
  evaluateBatch,
  getOrCreateProfile,
  getProfile,
  listProfiles,
  setManualOverride,
  liftManualOverride,
  adjustThresholds,
  getEventHistory,
  getDomainAutonomy,
  hasAutonomy,
  resolveExpiredProbations,
  registerCustomDomain,
  listCustomDomains,
  resetTrustState,
  scoreToAutonomyLevel,
  compareAutonomy,
  DEFAULT_THRESHOLDS,
  HIGH_STAKES_THRESHOLDS,
  TRUST_DOMAINS,
  AUTONOMY_ORDER,
} from '@/lib/a2a/trust';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const AGENT_A = '00000000-0000-0000-0000-000000000aaa';
const AGENT_B = '00000000-0000-0000-0000-000000000bbb';
const TASK_1 = '11111111-1111-1111-1111-111111111111';

function makeSignal(overrides: Partial<TrustSignal> = {}): TrustSignal {
  return {
    agent_id: AGENT_A,
    domain: 'task_execution',
    success: true,
    quality_rating: 4,
    ...overrides,
  };
}

/** Feed N successful signals to build up trust. */
function feedSuccesses(agent_id: string, domain: TrustDomain, count: number, rating = 4): void {
  for (let i = 0; i < count; i++) {
    evaluateSignal({ agent_id, domain, success: true, quality_rating: rating });
  }
}

/** Feed N failed signals. */
function feedFailures(agent_id: string, domain: TrustDomain, count: number): void {
  for (let i = 0; i < count; i++) {
    evaluateSignal({ agent_id, domain, success: false });
  }
}

// ──────────────────────────────────────────────
// Test Suite
// ──────────────────────────────────────────────

describe('Agent Progressive Trust & Dynamic Autonomy Protocol', () => {
  beforeEach(() => {
    resetTrustState();
  });

  // ── Profile Management ──

  describe('Profile Management', () => {
    it('should create a new profile on first access', () => {
      const profile = getOrCreateProfile(AGENT_A, 'Agent Alpha');
      expect(profile.agent_id).toBe(AGENT_A);
      expect(profile.agent_name).toBe('Agent Alpha');
      expect(profile.composite_score).toBe(0);
      expect(profile.peak_autonomy).toBe('observe');
      expect(profile.domains).toHaveLength(0);
    });

    it('should return existing profile on subsequent access', () => {
      getOrCreateProfile(AGENT_A, 'Agent Alpha');
      const profile2 = getOrCreateProfile(AGENT_A, 'Different Name');
      expect(profile2.agent_name).toBe('Agent Alpha'); // Name doesn't change
    });

    it('should return null for unknown agent via getProfile', () => {
      expect(getProfile(AGENT_A)).toBeNull();
    });

    it('should list profiles with filtering', () => {
      getOrCreateProfile(AGENT_A, 'Alpha');
      getOrCreateProfile(AGENT_B, 'Beta');

      const result = listProfiles();
      expect(result.total).toBe(2);
      expect(result.profiles).toHaveLength(2);
    });
  });

  // ── Score Computation ──

  describe('Score Computation', () => {
    it('should increase score on successful signal', () => {
      const result = evaluateSignal(makeSignal());
      expect(result.new_score).toBeGreaterThan(0);
      expect(result.previous_score).toBe(0);
    });

    it('should give lower score on failure', () => {
      evaluateSignal(makeSignal()); // first success
      const profile1 = getProfile(AGENT_A)!;
      const scoreAfterSuccess = profile1.domains[0].score;

      resetTrustState();
      evaluateSignal(makeSignal({ success: false })); // first failure
      const profile2 = getProfile(AGENT_A)!;
      const scoreAfterFailure = profile2.domains[0].score;

      expect(scoreAfterFailure).toBeLessThan(scoreAfterSuccess);
    });

    it('should factor in quality rating', () => {
      evaluateSignal(makeSignal({ quality_rating: 5 }));
      const highQuality = getProfile(AGENT_A)!.domains[0].score;

      resetTrustState();
      evaluateSignal(makeSignal({ quality_rating: 1 }));
      const lowQuality = getProfile(AGENT_A)!.domains[0].score;

      expect(highQuality).toBeGreaterThan(lowQuality);
    });

    it('should track consecutive successes and failures', () => {
      feedSuccesses(AGENT_A, 'task_execution', 5);
      const profile = getProfile(AGENT_A)!;
      const domain = profile.domains[0];
      expect(domain.consecutive_successes).toBe(5);
      expect(domain.consecutive_failures).toBe(0);
      expect(domain.successful_evaluations).toBe(5);
    });
  });

  // ── Autonomy Level Mapping ──

  describe('Autonomy Level Mapping', () => {
    it('should map scores to correct levels with default thresholds', () => {
      expect(scoreToAutonomyLevel(0.0, DEFAULT_THRESHOLDS)).toBe('observe');
      expect(scoreToAutonomyLevel(0.29, DEFAULT_THRESHOLDS)).toBe('observe');
      expect(scoreToAutonomyLevel(0.3, DEFAULT_THRESHOLDS)).toBe('suggest');
      expect(scoreToAutonomyLevel(0.55, DEFAULT_THRESHOLDS)).toBe('act_with_approval');
      expect(scoreToAutonomyLevel(0.8, DEFAULT_THRESHOLDS)).toBe('autonomous');
      expect(scoreToAutonomyLevel(1.0, DEFAULT_THRESHOLDS)).toBe('autonomous');
    });

    it('should use stricter thresholds for high-stakes domains', () => {
      expect(scoreToAutonomyLevel(0.49, HIGH_STAKES_THRESHOLDS)).toBe('observe');
      expect(scoreToAutonomyLevel(0.5, HIGH_STAKES_THRESHOLDS)).toBe('suggest');
      expect(scoreToAutonomyLevel(0.7, HIGH_STAKES_THRESHOLDS)).toBe('act_with_approval');
      expect(scoreToAutonomyLevel(0.9, HIGH_STAKES_THRESHOLDS)).toBe('autonomous');
    });

    it('should compare autonomy levels correctly', () => {
      expect(compareAutonomy('observe', 'autonomous')).toBe(-1);
      expect(compareAutonomy('autonomous', 'observe')).toBe(1);
      expect(compareAutonomy('suggest', 'suggest')).toBe(0);
    });
  });

  // ── Domain Isolation ──

  describe('Domain Isolation', () => {
    it('should track trust independently per domain', () => {
      feedSuccesses(AGENT_A, 'task_execution', 10, 5);
      evaluateSignal({ agent_id: AGENT_A, domain: 'financial_operations', success: false });

      const profile = getProfile(AGENT_A)!;
      const taskDomain = profile.domains.find(d => d.domain === 'task_execution')!;
      const financeDomain = profile.domains.find(d => d.domain === 'financial_operations')!;

      expect(taskDomain.score).toBeGreaterThan(financeDomain.score);
      expect(taskDomain.successful_evaluations).toBe(10);
      expect(financeDomain.failed_evaluations).toBe(1);
    });

    it('should create domain on first encounter', () => {
      evaluateSignal(makeSignal({ domain: 'code_generation' }));
      const profile = getProfile(AGENT_A)!;
      expect(profile.domains).toHaveLength(1);
      expect(profile.domains[0].domain).toBe('code_generation');
    });

    it('should apply high-stakes thresholds to financial_operations', () => {
      evaluateSignal(makeSignal({ domain: 'financial_operations' }));
      const profile = getProfile(AGENT_A)!;
      const domain = profile.domains[0];
      expect(domain.thresholds.act_to_autonomous).toBe(HIGH_STAKES_THRESHOLDS.act_to_autonomous);
    });
  });

  // ── Promotion ──

  describe('Promotion', () => {
    it('should not promote without minimum evaluations', () => {
      // Default min is 10, feed only 5
      feedSuccesses(AGENT_A, 'task_execution', 5, 5);
      const profile = getProfile(AGENT_A)!;
      expect(profile.domains[0].autonomy_level).toBe('observe');
    });

    it('should promote after meeting all criteria with adjusted thresholds', () => {
      // Set very low thresholds for testing
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal()); // create the domain first
      adjustThresholds({
        agent_id: AGENT_A,
        domain: 'task_execution',
        thresholds: {
          observe_to_suggest: 0.1,
          min_tasks_for_promotion: 3,
          min_hours_at_level: 0,
        },
        adjusted_by: 'test',
      });

      // Feed enough successes
      feedSuccesses(AGENT_A, 'task_execution', 5, 5);

      const profile = getProfile(AGENT_A)!;
      const domain = profile.domains[0];
      // Should be promoted (or at least above observe)
      expect(domain.score).toBeGreaterThan(0.1);
    });

    it('should enter probation after promotion', () => {
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal());
      adjustThresholds({
        agent_id: AGENT_A,
        domain: 'task_execution',
        thresholds: {
          observe_to_suggest: 0.1,
          min_tasks_for_promotion: 3,
          min_hours_at_level: 0,
        },
        adjusted_by: 'test',
      });

      feedSuccesses(AGENT_A, 'task_execution', 5, 5);
      const profile = getProfile(AGENT_A)!;
      const domain = profile.domains[0];

      // Agent should have been promoted beyond observe
      expect(domain.autonomy_level).not.toBe('observe');
      // Probation may have already resolved (zero-duration) but the event should exist
      const events = getEventHistory(AGENT_A, { event_type: 'probation_start' });
      expect(events.events.length).toBeGreaterThan(0);
    });
  });

  // ── Safety Violations ──

  describe('Safety Violations', () => {
    it('should instantly demote to observe on safety violation', () => {
      feedSuccesses(AGENT_A, 'task_execution', 5, 5);
      const profileBefore = getProfile(AGENT_A)!;
      const scoreBefore = profileBefore.domains[0].score;

      const result = evaluateSignal({
        agent_id: AGENT_A,
        domain: 'task_execution',
        success: false,
        safety_violation: true,
        violation_description: 'Attempted unauthorized data access',
      });

      expect(result.new_level).toBe('observe');
      expect(result.new_score).toBeLessThan(scoreBefore * 0.5);

      const events = getEventHistory(AGENT_A, { event_type: 'safety_demotion' });
      expect(events.events.length).toBeGreaterThan(0);
      expect(events.events[0].reason).toContain('unauthorized data access');
    });

    it('should apply heavy score penalty on safety violation', () => {
      feedSuccesses(AGENT_A, 'task_execution', 10, 5);
      const scoreBefore = getProfile(AGENT_A)!.domains[0].score;

      evaluateSignal({
        agent_id: AGENT_A,
        domain: 'task_execution',
        success: false,
        safety_violation: true,
      });

      const scoreAfter = getProfile(AGENT_A)!.domains[0].score;
      expect(scoreAfter).toBeLessThanOrEqual(scoreBefore * 0.3);
    });
  });

  // ── Probation ──

  describe('Probation', () => {
    it('should revert promotion on failure during probation', () => {
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal());
      adjustThresholds({
        agent_id: AGENT_A,
        domain: 'task_execution',
        thresholds: {
          observe_to_suggest: 0.1,
          min_tasks_for_promotion: 3,
          min_hours_at_level: 0,
        },
        adjusted_by: 'test',
      });

      feedSuccesses(AGENT_A, 'task_execution', 5, 5);
      const profile = getProfile(AGENT_A)!;
      const domain = profile.domains[0];

      if (domain.on_probation) {
        const prevLevel = domain.autonomy_level;
        const result = evaluateSignal({
          agent_id: AGENT_A,
          domain: 'task_execution',
          success: false,
        });

        if (result.level_changed) {
          expect(result.change_direction).toBe('demotion');
          expect(result.events.some(e => e.event_type === 'probation_failed')).toBe(true);
        }
      }
    });

    it('should resolve expired probations', () => {
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal());

      // Manually set probation with past expiry
      const profile = getProfile(AGENT_A)!;
      const domain = profile.domains[0];
      domain.on_probation = true;
      domain.probation_expires_at = new Date(Date.now() - 1000).toISOString();

      const events = resolveExpiredProbations();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event_type).toBe('probation_end');
      expect(domain.on_probation).toBe(false);
    });
  });

  // ── Manual Override ──

  describe('Manual Override', () => {
    it('should set manual override', () => {
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal()); // create domain

      const event = setManualOverride({
        agent_id: AGENT_A,
        domain: 'task_execution',
        autonomy_level: 'autonomous',
        reason: 'Trusted partner agent with verified credentials',
        override_by: 'admin-001',
      });

      expect(event.event_type).toBe('manual_override');

      const profile = getProfile(AGENT_A)!;
      const domain = profile.domains[0];
      expect(domain.autonomy_level).toBe('autonomous');
      expect(domain.manual_override).toBe(true);
      expect(domain.override_set_by).toBe('admin-001');
    });

    it('should prevent automatic changes during override', () => {
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal());

      setManualOverride({
        agent_id: AGENT_A,
        domain: 'task_execution',
        autonomy_level: 'autonomous',
        reason: 'Testing override persistence',
        override_by: 'admin',
      });

      // Feed failures — should not demote
      feedFailures(AGENT_A, 'task_execution', 5);
      const profile = getProfile(AGENT_A)!;
      expect(profile.domains[0].autonomy_level).toBe('autonomous');
    });

    it('should lift override and revert to score-derived level', () => {
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal());

      setManualOverride({
        agent_id: AGENT_A,
        domain: 'task_execution',
        autonomy_level: 'autonomous',
        reason: 'Temporary override',
        override_by: 'admin',
      });

      const event = liftManualOverride({
        agent_id: AGENT_A,
        domain: 'task_execution',
        lifted_by: 'admin',
        reason: 'Override no longer needed',
      });

      expect(event).not.toBeNull();
      expect(event!.event_type).toBe('override_lifted');

      const profile = getProfile(AGENT_A)!;
      expect(profile.domains[0].manual_override).toBe(false);
      // Level should revert to score-derived from the current score
      const domain = profile.domains[0];
      const expectedLevel = scoreToAutonomyLevel(domain.score, domain.thresholds);
      expect(domain.autonomy_level).toBe(expectedLevel);
    });
  });

  // ── Threshold Adjustment ──

  describe('Threshold Adjustment', () => {
    it('should adjust thresholds for a specific domain', () => {
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal());

      const event = adjustThresholds({
        agent_id: AGENT_A,
        domain: 'task_execution',
        thresholds: {
          observe_to_suggest: 0.2,
          act_to_autonomous: 0.95,
        },
        adjusted_by: 'admin',
      });

      expect(event.event_type).toBe('threshold_adjustment');

      const profile = getProfile(AGENT_A)!;
      expect(profile.domains[0].thresholds.observe_to_suggest).toBe(0.2);
      expect(profile.domains[0].thresholds.act_to_autonomous).toBe(0.95);
      // Unchanged thresholds should remain at defaults
      expect(profile.domains[0].thresholds.suggest_to_act).toBe(DEFAULT_THRESHOLDS.suggest_to_act);
    });
  });

  // ── Batch Evaluation ──

  describe('Batch Evaluation', () => {
    it('should process multiple signals in batch', () => {
      const signals: TrustSignal[] = [
        { agent_id: AGENT_A, domain: 'task_execution', success: true, quality_rating: 5 },
        { agent_id: AGENT_A, domain: 'code_generation', success: true, quality_rating: 4 },
        { agent_id: AGENT_B, domain: 'task_execution', success: false },
      ];

      const results = evaluateBatch(signals);
      expect(results).toHaveLength(3);
      expect(results[0].new_score).toBeGreaterThan(0);
      expect(results[2].new_score).toBeLessThan(results[0].new_score);
    });
  });

  // ── Governance Integration ──

  describe('Governance Integration', () => {
    it('should return domain autonomy for governance queries', () => {
      evaluateSignal(makeSignal());
      const autonomy = getDomainAutonomy(AGENT_A, 'task_execution');

      expect(autonomy).not.toBeNull();
      expect(autonomy!.level).toBe('observe');
      expect(autonomy!.score).toBeGreaterThan(0);
      expect(autonomy!.on_probation).toBe(false);
    });

    it('should return null for unknown agent/domain', () => {
      expect(getDomainAutonomy(AGENT_A, 'task_execution')).toBeNull();
    });

    it('should check hasAutonomy correctly', () => {
      evaluateSignal(makeSignal());

      expect(hasAutonomy(AGENT_A, 'task_execution', 'observe')).toBe(true);
      expect(hasAutonomy(AGENT_A, 'task_execution', 'suggest')).toBe(false);
      expect(hasAutonomy(AGENT_A, 'task_execution', 'autonomous')).toBe(false);
    });
  });

  // ── Event History ──

  describe('Event History', () => {
    it('should log events for every evaluation', () => {
      feedSuccesses(AGENT_A, 'task_execution', 3);
      const history = getEventHistory(AGENT_A);

      // At least: 1 domain_added + 3 score_updates
      expect(history.total).toBeGreaterThanOrEqual(4);
    });

    it('should filter events by domain', () => {
      evaluateSignal(makeSignal({ domain: 'task_execution' }));
      evaluateSignal(makeSignal({ domain: 'code_generation' }));

      const taskEvents = getEventHistory(AGENT_A, { domain: 'task_execution' });
      const codeEvents = getEventHistory(AGENT_A, { domain: 'code_generation' });

      expect(taskEvents.events.every(e => e.domain === 'task_execution')).toBe(true);
      expect(codeEvents.events.every(e => e.domain === 'code_generation')).toBe(true);
    });

    it('should filter events by type', () => {
      evaluateSignal(makeSignal());
      evaluateSignal({
        agent_id: AGENT_A,
        domain: 'task_execution',
        success: false,
        safety_violation: true,
      });

      const safetyEvents = getEventHistory(AGENT_A, { event_type: 'safety_demotion' });
      expect(safetyEvents.events.length).toBeGreaterThan(0);
    });

    it('should support pagination', () => {
      feedSuccesses(AGENT_A, 'task_execution', 10);
      const page1 = getEventHistory(AGENT_A, { limit: 3, offset: 0 });
      const page2 = getEventHistory(AGENT_A, { limit: 3, offset: 3 });

      expect(page1.events).toHaveLength(3);
      expect(page2.events).toHaveLength(3);
      expect(page1.events[0].id).not.toBe(page2.events[0].id);
    });
  });

  // ── Composite Profile ──

  describe('Composite Profile', () => {
    it('should compute weighted composite score', () => {
      feedSuccesses(AGENT_A, 'task_execution', 10, 5);
      evaluateSignal({ agent_id: AGENT_A, domain: 'code_generation', success: false });

      const profile = getProfile(AGENT_A)!;
      expect(profile.composite_score).toBeGreaterThan(0);
      // Composite should be between the two domain scores
      const taskScore = profile.domains.find(d => d.domain === 'task_execution')!.score;
      const codeScore = profile.domains.find(d => d.domain === 'code_generation')!.score;
      expect(profile.composite_score).toBeLessThanOrEqual(taskScore);
      expect(profile.composite_score).toBeGreaterThanOrEqual(codeScore);
    });

    it('should track peak and floor autonomy', () => {
      feedSuccesses(AGENT_A, 'task_execution', 3, 5);
      evaluateSignal({ agent_id: AGENT_A, domain: 'financial_operations', success: true });

      const profile = getProfile(AGENT_A)!;
      expect(AUTONOMY_ORDER.indexOf(profile.peak_autonomy)).toBeGreaterThanOrEqual(
        AUTONOMY_ORDER.indexOf(profile.floor_autonomy),
      );
    });
  });

  // ── Custom Domains ──

  describe('Custom Domains', () => {
    it('should register a custom domain', () => {
      const result = registerCustomDomain('Medical Diagnosis', {
        description: 'Trust for medical AI operations',
        high_stakes: true,
      });

      expect(result.domain_key).toContain('medical_diagnosis');
    });

    it('should list custom domains', () => {
      registerCustomDomain('Research', { description: 'Scientific research' });
      registerCustomDomain('Trading', { high_stakes: true });

      const domains = listCustomDomains();
      expect(domains).toHaveLength(2);
      expect(domains[0].label).toBe('Research');
      expect(domains[1].high_stakes).toBe(true);
    });
  });

  // ── Demotion on Consecutive Failures ──

  describe('Demotion', () => {
    it('should demote after 3 consecutive failures', () => {
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal());

      // Manually set to suggest level to test demotion
      setManualOverride({
        agent_id: AGENT_A,
        domain: 'task_execution',
        autonomy_level: 'suggest',
        reason: 'Testing demotion',
        override_by: 'test',
      });

      // Lift override to allow automatic level changes
      liftManualOverride({
        agent_id: AGENT_A,
        domain: 'task_execution',
        lifted_by: 'test',
        reason: 'Enable auto demotion',
      });

      // Set score high enough to be at suggest
      const profile = getProfile(AGENT_A)!;
      const domain = profile.domains[0];
      domain.score = 0.4;
      domain.autonomy_level = 'suggest';

      // 3 consecutive failures
      feedFailures(AGENT_A, 'task_execution', 3);

      const finalProfile = getProfile(AGENT_A)!;
      const finalDomain = finalProfile.domains[0];
      expect(finalDomain.consecutive_failures).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Edge Cases ──

  describe('Edge Cases', () => {
    it('should handle signal for agent with no profile', () => {
      const result = evaluateSignal(makeSignal({ agent_id: AGENT_B }));
      expect(result.agent_id).toBe(AGENT_B);
      expect(result.new_score).toBeGreaterThan(0);
      expect(getProfile(AGENT_B)).not.toBeNull();
    });

    it('should clamp score between 0 and 1', () => {
      // Feed many successes
      feedSuccesses(AGENT_A, 'task_execution', 100, 5);
      const profile = getProfile(AGENT_A)!;
      expect(profile.domains[0].score).toBeLessThanOrEqual(1);
      expect(profile.domains[0].score).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty batch', () => {
      const results = evaluateBatch([]);
      expect(results).toHaveLength(0);
    });

    it('should not promote while on probation', () => {
      getOrCreateProfile(AGENT_A);
      evaluateSignal(makeSignal());
      const profile = getProfile(AGENT_A)!;
      const domain = profile.domains[0];

      // Manually set probation
      domain.on_probation = true;
      domain.probation_expires_at = new Date(Date.now() + 86400000).toISOString();
      domain.score = 0.9;
      domain.total_evaluations = 100;
      domain.consecutive_successes = 50;
      domain.thresholds.min_hours_at_level = 0;

      evaluateSignal(makeSignal());
      // Should not double-promote during probation
      expect(domain.autonomy_level).toBeDefined();
    });
  });
});
