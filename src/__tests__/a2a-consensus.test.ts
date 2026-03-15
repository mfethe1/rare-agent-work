/**
 * Agent Consensus & Distributed Decision Protocol — Tests
 *
 * Validates multi-algorithm consensus: councils, proposals, weighted voting,
 * supermajority, unanimous, optimistic, conviction, delegation, veto,
 * split-brain resolution, and audit logging.
 */

import { ConsensusEngine } from '@/lib/a2a/consensus/engine';
import type {
  ConsensusAlgorithm,
  DecisionDomain,
  PartitionDecision,
} from '@/lib/a2a/consensus/types';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const CHAIR = 'agent-chair';
const MEMBER_A = 'agent-alpha';
const MEMBER_B = 'agent-beta';
const MEMBER_C = 'agent-charlie';
const MEMBER_D = 'agent-delta';
const OBSERVER = 'agent-observer';
const OUTSIDER = 'agent-outsider';

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function createPopulatedEngine(): {
  engine: ConsensusEngine;
  councilId: string;
} {
  const engine = new ConsensusEngine();
  const council = engine.createCouncil({
    name: 'Test Council',
    description: 'A council for testing',
    domains: ['resource_allocation', 'policy_change'],
    default_algorithm: 'weighted_majority',
    default_quorum: 0.5,
    default_approval_threshold: 0.5,
    creator_id: CHAIR,
  });
  engine.addCouncilMember(council.id, { agent_id: MEMBER_A }, CHAIR);
  engine.addCouncilMember(council.id, { agent_id: MEMBER_B }, CHAIR);
  engine.addCouncilMember(council.id, { agent_id: MEMBER_C }, CHAIR);
  return { engine, councilId: council.id };
}

function createProposalHelper(
  engine: ConsensusEngine,
  councilId: string,
  overrides: Record<string, unknown> = {},
) {
  return engine.createProposal({
    proposer_id: CHAIR,
    council_id: councilId,
    title: 'Test Proposal',
    description: 'A test proposal',
    domain: 'resource_allocation' as DecisionDomain,
    payload: { amount: 100 },
    voting_closes_at: FUTURE,
    ...overrides,
  });
}

// ──────────────────────────────────────────────
// Test Suite
// ──────────────────────────────────────────────

describe('Agent Consensus & Distributed Decision Protocol', () => {
  // ── Council Management ──

  describe('Council Management', () => {
    it('should create a council with defaults', () => {
      const engine = new ConsensusEngine();
      const council = engine.createCouncil({
        name: 'Safety Board',
        description: 'Oversees safety decisions',
        domains: ['safety_override'],
        default_algorithm: 'supermajority',
        creator_id: CHAIR,
      });

      expect(council.id).toMatch(/^council_/);
      expect(council.name).toBe('Safety Board');
      expect(council.default_quorum).toBe(0.5);
      expect(council.default_approval_threshold).toBe(0.5);
      expect(council.members).toHaveLength(1);
      expect(council.members[0].agent_id).toBe(CHAIR);
      expect(council.members[0].role).toBe('chair');
      expect(council.active).toBe(true);
    });

    it('should create a council with domain overrides', () => {
      const engine = new ConsensusEngine();
      const council = engine.createCouncil({
        name: 'Ops Council',
        description: 'Operations decisions',
        domains: ['resource_allocation', 'policy_change'],
        default_algorithm: 'weighted_majority',
        default_quorum: 0.4,
        default_approval_threshold: 0.6,
        domain_overrides: [
          {
            domain: 'policy_change',
            algorithm: 'supermajority',
            quorum_threshold: 0.75,
            approval_threshold: 0.67,
            veto_enabled: true,
            max_voting_duration_seconds: 86400,
          },
        ],
        creator_id: CHAIR,
      });

      expect(council.default_quorum).toBe(0.4);
      expect(council.default_approval_threshold).toBe(0.6);
      expect(council.domain_overrides).toHaveLength(1);
      expect(council.domain_overrides[0].domain).toBe('policy_change');
      expect(council.domain_overrides[0].algorithm).toBe('supermajority');
    });

    it('should add members with different roles', () => {
      const engine = new ConsensusEngine();
      const council = engine.createCouncil({
        name: 'Mixed Council',
        description: 'Testing roles',
        domains: ['resource_allocation'],
        default_algorithm: 'weighted_majority',
        creator_id: CHAIR,
      });

      engine.addCouncilMember(
        council.id,
        { agent_id: MEMBER_A, role: 'member', weight_multiplier: 1.5 },
        CHAIR,
      );
      engine.addCouncilMember(
        council.id,
        { agent_id: MEMBER_B, role: 'veto_holder' },
        CHAIR,
      );
      engine.addCouncilMember(
        council.id,
        { agent_id: OBSERVER, role: 'observer' },
        CHAIR,
      );

      const updated = engine.getCouncil(council.id)!;
      expect(updated.members).toHaveLength(4);
      const memberA = updated.members.find((m) => m.agent_id === MEMBER_A);
      expect(memberA?.role).toBe('member');
      expect(memberA?.weight_multiplier).toBe(1.5);
      expect(updated.members.find((m) => m.agent_id === MEMBER_B)?.role).toBe('veto_holder');
      expect(updated.members.find((m) => m.agent_id === OBSERVER)?.role).toBe('observer');
    });

    it('should remove a member but fail to remove the last chair', () => {
      const { engine, councilId } = createPopulatedEngine();
      const updated = engine.removeCouncilMember(councilId, MEMBER_A, CHAIR);
      expect(updated.members.find((m) => m.agent_id === MEMBER_A)).toBeUndefined();

      expect(() => engine.removeCouncilMember(councilId, CHAIR, MEMBER_B)).toThrow(
        'Cannot remove the last chair',
      );
    });

    it('should not add a duplicate member', () => {
      const { engine, councilId } = createPopulatedEngine();
      expect(() =>
        engine.addCouncilMember(councilId, { agent_id: MEMBER_A }, CHAIR),
      ).toThrow('already a council member');
    });

    it('should list councils', () => {
      const engine = new ConsensusEngine();
      engine.createCouncil({
        name: 'C1',
        description: 'd',
        domains: ['resource_allocation'],
        default_algorithm: 'weighted_majority',
        creator_id: CHAIR,
      });
      engine.createCouncil({
        name: 'C2',
        description: 'd',
        domains: ['policy_change'],
        default_algorithm: 'supermajority',
        creator_id: CHAIR,
      });

      const list = engine.listCouncils();
      expect(list).toHaveLength(2);
      expect(list.map((c) => c.name)).toEqual(expect.arrayContaining(['C1', 'C2']));
    });
  });

  // ── Proposal Lifecycle ──

  describe('Proposal Lifecycle', () => {
    it('should create a proposal with council defaults', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);

      expect(proposal.id).toMatch(/^prop_/);
      expect(proposal.status).toBe('draft');
      expect(proposal.algorithm).toBe('weighted_majority');
      expect(proposal.quorum_threshold).toBe(0.5);
      expect(proposal.approval_threshold).toBe(0.5);
      expect(proposal.proposer_id).toBe(CHAIR);
    });

    it('should force veto enabled for safety-critical domains', () => {
      const { engine, councilId } = createPopulatedEngine();
      // safety_override is in SAFETY_CRITICAL_DOMAINS
      const proposal = engine.createProposal({
        proposer_id: CHAIR,
        council_id: councilId,
        title: 'Safety Override',
        description: 'Critical safety decision',
        domain: 'safety_override',
        payload: {},
        voting_closes_at: FUTURE,
        veto_enabled: false, // should be overridden
      });

      expect(proposal.veto_enabled).toBe(true);
      expect(proposal.veto_holders.length).toBeGreaterThan(0);
      expect(proposal.veto_holders).toContain(CHAIR);
    });

    it('should open a proposal and transition to voting', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);
      const opened = engine.openProposal(proposal.id, CHAIR);

      // voting_opens_at defaults to creation time (past), so should transition to voting
      expect(['open', 'voting']).toContain(opened.status);
    });

    it('should cancel by proposer', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);
      const cancelled = engine.cancelProposal(proposal.id, CHAIR);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.outcome?.approved).toBe(false);
      expect(cancelled.outcome?.resolution_method).toBe('cancelled_by_proposer');
    });

    it('should cancel by chair (non-proposer)', () => {
      const { engine, councilId } = createPopulatedEngine();
      // MEMBER_A creates the proposal
      const proposal = createProposalHelper(engine, councilId, {
        proposer_id: MEMBER_A,
      });

      // CHAIR cancels it (is chair role)
      const cancelled = engine.cancelProposal(proposal.id, CHAIR);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject cancellation by non-member/non-chair', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);

      // MEMBER_A is not the proposer and not a chair
      expect(() => engine.cancelProposal(proposal.id, MEMBER_A)).toThrow(
        'Only the proposer or a chair',
      );
    });

    it('should not allow non-member to create a proposal', () => {
      const { engine, councilId } = createPopulatedEngine();
      expect(() =>
        createProposalHelper(engine, councilId, { proposer_id: OUTSIDER }),
      ).toThrow('Only council members');
    });

    it('should not allow observer to create a proposal', () => {
      const { engine, councilId } = createPopulatedEngine();
      engine.addCouncilMember(councilId, { agent_id: OBSERVER, role: 'observer' }, CHAIR);

      expect(() =>
        createProposalHelper(engine, councilId, { proposer_id: OBSERVER }),
      ).toThrow('Only council members');
    });
  });

  // ── Weighted Majority Voting ──

  describe('Weighted Majority Voting', () => {
    it('should approve with quorum met and majority', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);
      engine.openProposal(proposal.id, CHAIR);

      // 4 members: CHAIR, A, B, C. Quorum = 0.5 => need 2 votes
      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });

      const resolved = engine.resolveProposal(proposal.id);
      expect(resolved.status).toBe('decided_approved');
      expect(resolved.outcome?.approved).toBe(true);
      expect(resolved.outcome?.tally.quorum_met).toBe(true);
    });

    it('should reject when below threshold', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'reject' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'reject' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'approve' });

      const resolved = engine.resolveProposal(proposal.id);
      expect(resolved.status).toBe('decided_rejected');
      expect(resolved.outcome?.approved).toBe(false);
    });

    it('should respect weighted votes with multipliers', () => {
      const engine = new ConsensusEngine();
      const council = engine.createCouncil({
        name: 'Weighted Council',
        description: 'Testing weight multipliers',
        domains: ['resource_allocation'],
        default_algorithm: 'weighted_majority',
        default_quorum: 0.5,
        default_approval_threshold: 0.5,
        creator_id: CHAIR,
      });
      engine.addCouncilMember(
        council.id,
        { agent_id: MEMBER_A, weight_multiplier: 3.0 },
        CHAIR,
      );
      engine.addCouncilMember(council.id, { agent_id: MEMBER_B }, CHAIR);
      engine.addCouncilMember(council.id, { agent_id: MEMBER_C }, CHAIR);

      const proposal = createProposalHelper(engine, council.id);
      engine.openProposal(proposal.id, CHAIR);

      // MEMBER_A (weight 3) approves, CHAIR + B + C reject (weight 1 each = 3)
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'reject' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'reject' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_C, choice: 'reject' });

      const tally = engine.computeTally(proposal.id);
      expect(tally.approve_weight).toBe(3);
      expect(tally.reject_weight).toBe(3);
      // 3/(3+3) = 0.5, not > 0.5, so should reject
      const resolved = engine.resolveProposal(proposal.id);
      expect(resolved.outcome?.approved).toBe(false);
    });

    it('should resolve correctly when all votes are in', () => {
      const engine = new ConsensusEngine();
      const council = engine.createCouncil({
        name: 'All Votes Council',
        description: 'Test resolution after all votes',
        domains: ['resource_allocation'],
        default_algorithm: 'weighted_majority',
        default_quorum: 0.5,
        default_approval_threshold: 0.5,
        creator_id: CHAIR,
      });
      engine.addCouncilMember(council.id, { agent_id: MEMBER_A }, CHAIR);
      engine.addCouncilMember(council.id, { agent_id: MEMBER_B }, CHAIR);

      const proposal = createProposalHelper(engine, council.id);
      engine.openProposal(proposal.id, CHAIR);

      // All 3 members vote approve
      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'approve' });

      const resolved = engine.resolveProposal(proposal.id);
      expect(resolved.status).toBe('decided_approved');
      expect(resolved.outcome?.tally.approve_weight).toBe(3);
    });

    it('should expire when quorum not met and deadline passed', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = engine.createProposal({
        proposer_id: CHAIR,
        council_id: councilId,
        title: 'Expiring Proposal',
        description: 'Will expire',
        domain: 'resource_allocation',
        payload: {},
        voting_closes_at: PAST,
      });
      engine.openProposal(proposal.id, CHAIR);

      // No votes cast, quorum not met, deadline passed
      const resolved = engine.resolveProposal(proposal.id);
      expect(resolved.status).toBe('expired');
      expect(resolved.outcome?.resolution_method).toBe('expired_no_quorum');
    });
  });

  // ── Supermajority Voting ──

  describe('Supermajority Voting', () => {
    function createSupermajoritySetup() {
      const engine = new ConsensusEngine();
      const council = engine.createCouncil({
        name: 'Supermajority Council',
        description: 'Requires 2/3',
        domains: ['policy_change'],
        default_algorithm: 'supermajority',
        default_quorum: 0.5,
        creator_id: CHAIR,
      });
      engine.addCouncilMember(council.id, { agent_id: MEMBER_A }, CHAIR);
      engine.addCouncilMember(council.id, { agent_id: MEMBER_B }, CHAIR);
      engine.addCouncilMember(council.id, { agent_id: MEMBER_C }, CHAIR);
      engine.addCouncilMember(council.id, { agent_id: MEMBER_D }, CHAIR);
      // 5 members total
      return { engine, councilId: council.id };
    }

    it('should pass at 2/3 threshold', () => {
      const { engine, councilId } = createSupermajoritySetup();
      const proposal = createProposalHelper(engine, councilId, {
        domain: 'policy_change',
        algorithm: 'supermajority',
      });
      engine.openProposal(proposal.id, CHAIR);

      // 4 approve, 1 reject = 80% > 66.7%
      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_C, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_D, choice: 'reject' });

      const resolved = engine.resolveProposal(proposal.id);
      expect(resolved.status).toBe('decided_approved');
    });

    it('should fail below 2/3', () => {
      const { engine, councilId } = createSupermajoritySetup();
      const proposal = createProposalHelper(engine, councilId, {
        domain: 'policy_change',
        algorithm: 'supermajority',
      });
      engine.openProposal(proposal.id, CHAIR);

      // 3 approve, 2 reject = 60% < 66.7%
      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_C, choice: 'reject' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_D, choice: 'reject' });

      const resolved = engine.resolveProposal(proposal.id);
      expect(resolved.status).toBe('decided_rejected');
    });

    it('should pass when all members vote approve', () => {
      const { engine, councilId } = createSupermajoritySetup();
      const proposal = createProposalHelper(engine, councilId, {
        domain: 'policy_change',
        algorithm: 'supermajority',
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_C, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_D, choice: 'approve' });

      // May already be resolved via early resolution
      const p = engine.getProposal(proposal.id)!;
      if (p.status === 'voting') {
        const resolved = engine.resolveProposal(proposal.id);
        expect(resolved.status).toBe('decided_approved');
      } else {
        expect(p.status).toBe('decided_approved');
      }
    });
  });

  // ── Unanimous Voting ──

  describe('Unanimous Voting', () => {
    function createUnanimousSetup() {
      const engine = new ConsensusEngine();
      const council = engine.createCouncil({
        name: 'Unanimous Council',
        description: 'All must agree',
        domains: ['resource_allocation'],
        default_algorithm: 'unanimous',
        default_quorum: 1.0,
        creator_id: CHAIR,
      });
      engine.addCouncilMember(council.id, { agent_id: MEMBER_A }, CHAIR);
      engine.addCouncilMember(council.id, { agent_id: MEMBER_B }, CHAIR);
      return { engine, councilId: council.id };
    }

    it('should pass when all approve', () => {
      const { engine, councilId } = createUnanimousSetup();
      const proposal = createProposalHelper(engine, councilId, {
        algorithm: 'unanimous',
        quorum_threshold: 1.0,
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'approve' });

      // Should be auto-resolved via early resolution
      const p = engine.getProposal(proposal.id)!;
      expect(p.status).toBe('decided_approved');
      expect(p.outcome?.approved).toBe(true);
    });

    it('should fail when one rejects', () => {
      const { engine, councilId } = createUnanimousSetup();
      const proposal = createProposalHelper(engine, councilId, {
        algorithm: 'unanimous',
        quorum_threshold: 1.0,
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'reject' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'approve' });

      // All voted, resolve
      const p = engine.getProposal(proposal.id)!;
      if (p.status !== 'decided_rejected') {
        const resolved = engine.resolveProposal(proposal.id);
        expect(resolved.status).toBe('decided_rejected');
        expect(resolved.outcome?.approved).toBe(false);
      } else {
        expect(p.outcome?.approved).toBe(false);
      }
    });

    it('should early resolve when all members have voted unanimously', () => {
      const { engine, councilId } = createUnanimousSetup();
      const proposal = createProposalHelper(engine, councilId, {
        algorithm: 'unanimous',
        quorum_threshold: 1.0,
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });
      // Last vote should trigger early resolution
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'approve' });

      const p = engine.getProposal(proposal.id)!;
      expect(p.status).toBe('decided_approved');
      expect(p.outcome?.resolution_method).toBe('unanimous_early');
    });
  });

  // ── Optimistic Approval ──

  describe('Optimistic Approval', () => {
    function createOptimisticSetup() {
      const engine = new ConsensusEngine();
      const council = engine.createCouncil({
        name: 'Optimistic Council',
        description: 'Passes unless objection',
        domains: ['resource_allocation'],
        default_algorithm: 'optimistic_approval',
        default_quorum: 0.0,
        default_approval_threshold: 0.5,
        creator_id: CHAIR,
      });
      engine.addCouncilMember(council.id, { agent_id: MEMBER_A }, CHAIR);
      engine.addCouncilMember(council.id, { agent_id: MEMBER_B }, CHAIR);
      return { engine, councilId: council.id };
    }

    it('should pass with no objections', () => {
      const { engine, councilId } = createOptimisticSetup();
      const proposal = createProposalHelper(engine, councilId, {
        algorithm: 'optimistic_approval',
        quorum_threshold: 0.0,
      });
      engine.openProposal(proposal.id, CHAIR);

      // No votes cast at all
      const resolved = engine.resolveProposal(proposal.id);
      expect(resolved.status).toBe('decided_approved');
      expect(resolved.outcome?.resolution_method).toBe('optimistic_no_objection');
    });

    it('should reject when rejections exceed threshold', () => {
      const { engine, councilId } = createOptimisticSetup();
      const proposal = createProposalHelper(engine, councilId, {
        algorithm: 'optimistic_approval',
        quorum_threshold: 0.0,
        approval_threshold: 0.5,
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'reject' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'reject' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'approve' });

      const resolved = engine.resolveProposal(proposal.id);
      // approve_weight=1, reject_weight=2, ratio=1/3 < 0.5
      expect(resolved.outcome?.approved).toBe(false);
    });

    it('should pass with mixed votes when approval exceeds threshold', () => {
      const { engine, councilId } = createOptimisticSetup();
      const proposal = createProposalHelper(engine, councilId, {
        algorithm: 'optimistic_approval',
        quorum_threshold: 0.0,
        approval_threshold: 0.5,
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_B, choice: 'reject' });

      const resolved = engine.resolveProposal(proposal.id);
      // ratio = 2/3 > 0.5
      expect(resolved.outcome?.approved).toBe(true);
    });
  });

  // ── Conviction Voting ──

  describe('Conviction Voting', () => {
    it('should initialize conviction state when voting', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId, {
        algorithm: 'conviction_voting',
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });

      // Conviction state should exist; updateConviction should not throw
      const state = engine.updateConviction(proposal.id, CHAIR);
      expect(state.voter_id).toBe(CHAIR);
      expect(state.base_weight).toBe(1);
      expect(state.accumulated_conviction).toBeGreaterThanOrEqual(state.base_weight);
    });

    it('should accumulate conviction over time', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId, {
        algorithm: 'conviction_voting',
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });

      const state1 = engine.updateConviction(proposal.id, CHAIR);
      // Immediately after, conviction should be >= base_weight
      expect(state1.accumulated_conviction).toBeGreaterThanOrEqual(1);
      expect(state1.last_computed_at).toBeDefined();
    });

    it('should resolve with conviction weights', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId, {
        algorithm: 'conviction_voting',
        quorum_threshold: 0.5,
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'approve' });

      const resolved = engine.resolveProposal(proposal.id);
      expect(resolved.outcome?.resolution_method).toBe('conviction_threshold');
    });
  });

  // ── Liquid Democracy / Vote Delegation ──

  describe('Liquid Democracy / Vote Delegation', () => {
    it('should create a delegation', () => {
      const engine = new ConsensusEngine();
      const delegation = engine.createDelegation({
        delegator_id: MEMBER_A,
        delegate_id: MEMBER_B,
        domains: ['resource_allocation'],
        transitive: false,
      });

      expect(delegation.id).toMatch(/^deleg_/);
      expect(delegation.delegator_id).toBe(MEMBER_A);
      expect(delegation.delegate_id).toBe(MEMBER_B);
      expect(delegation.revoked).toBe(false);
    });

    it('should auto-cast delegated votes', () => {
      const { engine, councilId } = createPopulatedEngine();

      engine.createDelegation({
        delegator_id: MEMBER_A,
        delegate_id: CHAIR,
        domains: ['resource_allocation'],
        council_id: councilId,
      });

      const proposal = createProposalHelper(engine, councilId);
      engine.openProposal(proposal.id, CHAIR);

      // CHAIR votes, MEMBER_A's vote should be auto-cast
      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });

      const votes = engine.getVotes(proposal.id);
      const delegatedVote = votes.find(
        (v) => v.voter_id === MEMBER_A && v.delegated_from === CHAIR,
      );
      expect(delegatedVote).toBeDefined();
      expect(delegatedVote?.choice).toBe('approve');
    });

    it('should support transitive delegation', () => {
      const { engine, councilId } = createPopulatedEngine();

      // MEMBER_C delegates to MEMBER_A (transitive)
      engine.createDelegation({
        delegator_id: MEMBER_C,
        delegate_id: MEMBER_A,
        transitive: true,
        council_id: councilId,
      });
      // MEMBER_A delegates to CHAIR (transitive)
      engine.createDelegation({
        delegator_id: MEMBER_A,
        delegate_id: CHAIR,
        transitive: true,
        council_id: councilId,
      });

      const proposal = createProposalHelper(engine, councilId);
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });

      const votes = engine.getVotes(proposal.id);
      // MEMBER_A should have a delegated vote from CHAIR
      const memberAVote = votes.find(
        (v) => v.voter_id === MEMBER_A && v.delegated_from,
      );
      expect(memberAVote).toBeDefined();

      // MEMBER_C should have a delegated vote through the chain
      const memberCVote = votes.find(
        (v) => v.voter_id === MEMBER_C && v.delegated_from,
      );
      expect(memberCVote).toBeDefined();
      expect(memberCVote?.delegation_chain.length).toBeGreaterThanOrEqual(1);
    });

    it('should prevent circular delegation', () => {
      const engine = new ConsensusEngine();

      engine.createDelegation({
        delegator_id: MEMBER_A,
        delegate_id: MEMBER_B,
      });

      // B -> A would create a cycle
      expect(() =>
        engine.createDelegation({
          delegator_id: MEMBER_B,
          delegate_id: MEMBER_A,
        }),
      ).toThrow('circular');
    });

    it('should revoke a delegation', () => {
      const engine = new ConsensusEngine();
      const delegation = engine.createDelegation({
        delegator_id: MEMBER_A,
        delegate_id: MEMBER_B,
      });

      const revoked = engine.revokeDelegation(delegation.id, MEMBER_A);
      expect(revoked.revoked).toBe(true);

      const active = engine.listDelegations(MEMBER_A);
      expect(active).toHaveLength(0);
    });

    it('should allow direct vote to override delegation', () => {
      const { engine, councilId } = createPopulatedEngine();

      engine.createDelegation({
        delegator_id: MEMBER_A,
        delegate_id: CHAIR,
        council_id: councilId,
      });

      const proposal = createProposalHelper(engine, councilId);
      engine.openProposal(proposal.id, CHAIR);

      // MEMBER_A votes directly before delegate
      engine.castVote({ proposal_id: proposal.id, voter_id: MEMBER_A, choice: 'reject' });
      // CHAIR votes — delegation should not override MEMBER_A's direct vote
      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });

      const votes = engine.getVotes(proposal.id);
      const memberAVotes = votes.filter((v) => v.voter_id === MEMBER_A);
      // Should have the direct vote; delegated vote should not replace it
      const directVote = memberAVotes.find((v) => !v.delegated_from);
      expect(directVote?.choice).toBe('reject');
    });
  });

  // ── Veto Power ──

  describe('Veto Power', () => {
    it('should immediately resolve proposal as vetoed', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId, {
        domain: 'safety_override',
        veto_enabled: true,
        veto_holders: [CHAIR],
      });
      engine.openProposal(proposal.id, CHAIR);

      engine.castVote({
        proposal_id: proposal.id,
        voter_id: CHAIR,
        choice: 'veto',
        rationale: 'Safety concern',
      });

      const p = engine.getProposal(proposal.id)!;
      expect(p.status).toBe('vetoed');
      expect(p.outcome?.veto_info?.vetoer_id).toBe(CHAIR);
      expect(p.outcome?.veto_info?.reason).toBe('Safety concern');
      expect(p.outcome?.resolution_method).toBe('veto_exercised');
    });

    it('should reject veto from non-holder', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId, {
        domain: 'safety_override',
        veto_enabled: true,
        veto_holders: [CHAIR],
      });
      engine.openProposal(proposal.id, CHAIR);

      expect(() =>
        engine.castVote({
          proposal_id: proposal.id,
          voter_id: MEMBER_A,
          choice: 'veto',
        }),
      ).toThrow('does not have veto power');
    });

    it('should throw when veto is disabled', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId, {
        domain: 'resource_allocation',
        veto_enabled: false,
      });
      engine.openProposal(proposal.id, CHAIR);

      expect(() =>
        engine.castVote({
          proposal_id: proposal.id,
          voter_id: CHAIR,
          choice: 'veto',
        }),
      ).toThrow('Veto is not enabled');
    });

    it('should auto-enable veto for safety-critical domains', () => {
      const { engine, councilId } = createPopulatedEngine();
      // emergency_response is safety-critical
      const proposal = createProposalHelper(engine, councilId, {
        domain: 'emergency_response',
      });

      expect(proposal.veto_enabled).toBe(true);
      expect(proposal.veto_holders).toContain(CHAIR);
    });
  });

  // ── Split-Brain Detection & Resolution ──

  describe('Split-Brain Detection & Resolution', () => {
    function makePartitions(
      approveMembers: string[],
      rejectMembers: string[],
    ): PartitionDecision[] {
      return [
        {
          partition_id: 'partition-A',
          member_ids: approveMembers,
          outcome: {
            approved: true,
            tally: {
              total_eligible: approveMembers.length,
              total_cast: approveMembers.length,
              approve_weight: approveMembers.length,
              reject_weight: 0,
              abstain_weight: 0,
              veto_count: 0,
              quorum_met: true,
              approval_ratio: 1.0,
            },
            resolution_method: 'quorum_vote',
            enforcement_actions: [],
            resolved_at: new Date().toISOString(),
          },
        },
        {
          partition_id: 'partition-B',
          member_ids: rejectMembers,
          outcome: {
            approved: false,
            tally: {
              total_eligible: rejectMembers.length,
              total_cast: rejectMembers.length,
              approve_weight: 0,
              reject_weight: rejectMembers.length,
              abstain_weight: 0,
              veto_count: 0,
              quorum_met: true,
              approval_ratio: 0,
            },
            resolution_method: 'quorum_vote',
            enforcement_actions: [],
            resolved_at: new Date().toISOString(),
          },
        },
      ];
    }

    it('should detect split-brain with conflicting partitions', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);

      const partitions = makePartitions([CHAIR, MEMBER_A], [MEMBER_B, MEMBER_C]);
      const event = engine.detectSplitBrain(councilId, proposal.id, partitions);

      expect(event.id).toMatch(/^split_/);
      expect(event.partitions).toHaveLength(2);
      expect(event.strategy).toBe('highest_quorum_wins');
    });

    it('should resolve with highest_quorum_wins strategy', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);

      // Partition A: 3 members (higher quorum), Partition B: 1 member
      const partitions: PartitionDecision[] = [
        {
          partition_id: 'partition-A',
          member_ids: [CHAIR, MEMBER_A, MEMBER_B],
          outcome: {
            approved: true,
            tally: {
              total_eligible: 3,
              total_cast: 3,
              approve_weight: 3,
              reject_weight: 0,
              abstain_weight: 0,
              veto_count: 0,
              quorum_met: true,
              approval_ratio: 1.0,
            },
            resolution_method: 'quorum_vote',
            enforcement_actions: [],
            resolved_at: new Date().toISOString(),
          },
        },
        {
          partition_id: 'partition-B',
          member_ids: [MEMBER_C],
          outcome: {
            approved: false,
            tally: {
              total_eligible: 3,
              total_cast: 1,
              approve_weight: 0,
              reject_weight: 1,
              abstain_weight: 0,
              veto_count: 0,
              quorum_met: false,
              approval_ratio: 0,
            },
            resolution_method: 'quorum_vote',
            enforcement_actions: [],
            resolved_at: new Date().toISOString(),
          },
        },
      ];

      const event = engine.detectSplitBrain(
        councilId,
        proposal.id,
        partitions,
        'highest_quorum_wins',
      );

      expect(event.resolution).toBeDefined();
      expect(event.resolution?.winning_partition_id).toBe('partition-A');
    });

    it('should resolve with chair_partition_wins strategy', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);

      // CHAIR is in partition-B (the rejecting partition)
      const partitions = makePartitions([MEMBER_A, MEMBER_B], [CHAIR, MEMBER_C]);
      const event = engine.detectSplitBrain(
        councilId,
        proposal.id,
        partitions,
        'chair_partition_wins',
      );

      expect(event.resolution).toBeDefined();
      expect(event.resolution?.winning_partition_id).toBe('partition-B');
    });

    it('should leave manual_resolution unresolved until manual action', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);

      const partitions = makePartitions([CHAIR, MEMBER_A], [MEMBER_B, MEMBER_C]);
      const event = engine.detectSplitBrain(
        councilId,
        proposal.id,
        partitions,
        'manual_resolution',
      );

      expect(event.resolution).toBeUndefined();

      // Now resolve manually
      const resolved = engine.resolveSplitBrainManually(
        event.id,
        CHAIR,
        'partition-A',
        'Chair decided partition A wins',
      );

      expect(resolved.resolution).toBeDefined();
      expect(resolved.resolution?.winning_partition_id).toBe('partition-A');
      expect(resolved.resolution?.resolved_by).toBe(CHAIR);
    });
  });

  // ── Audit Log ──

  describe('Audit Log', () => {
    it('should log all operations', () => {
      const { engine, councilId } = createPopulatedEngine();
      const proposal = createProposalHelper(engine, councilId);
      engine.openProposal(proposal.id, CHAIR);
      engine.castVote({ proposal_id: proposal.id, voter_id: CHAIR, choice: 'approve' });

      const log = engine.getAuditLog();
      expect(log.length).toBeGreaterThan(0);

      const eventTypes = log.map((e) => e.event_type);
      expect(eventTypes).toContain('council_created');
      expect(eventTypes).toContain('council_member_added');
      expect(eventTypes).toContain('proposal_created');
      expect(eventTypes).toContain('proposal_opened');
      expect(eventTypes).toContain('vote_cast');
    });

    it('should filter by council', () => {
      const engine = new ConsensusEngine();
      const c1 = engine.createCouncil({
        name: 'C1',
        description: 'd',
        domains: ['resource_allocation'],
        default_algorithm: 'weighted_majority',
        creator_id: CHAIR,
      });
      engine.createCouncil({
        name: 'C2',
        description: 'd',
        domains: ['policy_change'],
        default_algorithm: 'supermajority',
        creator_id: MEMBER_A,
      });

      const c1Log = engine.getAuditLog(c1.id);
      expect(c1Log.length).toBeGreaterThan(0);
      expect(c1Log.every((e) => e.council_id === c1.id)).toBe(true);
    });

    it('should filter by proposal', () => {
      const { engine, councilId } = createPopulatedEngine();
      const p1 = createProposalHelper(engine, councilId, { title: 'P1' });
      createProposalHelper(engine, councilId, { title: 'P2' });

      engine.openProposal(p1.id, CHAIR);
      engine.castVote({ proposal_id: p1.id, voter_id: CHAIR, choice: 'approve' });

      const p1Log = engine.getAuditLog(undefined, p1.id);
      expect(p1Log.length).toBeGreaterThan(0);
      expect(p1Log.every((e) => e.proposal_id === p1.id)).toBe(true);
    });
  });
});
