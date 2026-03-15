/**
 * Agent Consensus & Distributed Decision Engine
 *
 * Core engine implementing multi-algorithm consensus for agent collectives.
 * Every collective action — resource allocation, policy change, membership
 * vote, emergency response — flows through this engine.
 *
 * Architecture:
 *   ConsensusEngine (stateless logic)
 *     ├── Council management (create, add/remove members)
 *     ├── Proposal lifecycle (create → open → vote → decide → execute)
 *     ├── Vote processing (cast, delegate, compute tallies)
 *     ├── Algorithm-specific resolution (6 algorithms)
 *     ├── Conviction accumulation (time-weighted voting)
 *     ├── Split-brain detection and resolution
 *     └── Enforcement hook execution
 */

import {
  type ConsensusAlgorithm,
  type ConsensusAuditEntry,
  type ConsensusCouncil,
  type ConsensusEventType,
  type ConvictionState,
  type CouncilMember,
  type CouncilRole,
  type DecisionDomain,
  type DecisionOutcome,
  type DomainConfig,
  type EnforcementAction,
  type PartitionDecision,
  type Proposal,
  type ProposalStatus,
  type ResolutionMethod,
  type SplitBrainEvent,
  type SplitBrainStrategy,
  type Vote,
  type VoteChoice,
  type VoteDelegation,
  type VoteTally,
  SAFETY_CRITICAL_DOMAINS,
  TERMINAL_STATUSES,
} from './types';

// ──────────────────────────────────────────────
// ID Generation
// ──────────────────────────────────────────────

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}_${rand}`;
}

// ──────────────────────────────────────────────
// Consensus Engine
// ──────────────────────────────────────────────

export class ConsensusEngine {
  private councils: Map<string, ConsensusCouncil> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private votes: Map<string, Vote[]> = new Map(); // proposal_id → votes
  private delegations: Map<string, VoteDelegation[]> = new Map(); // delegator_id → delegations
  private convictionStates: Map<string, ConvictionState[]> = new Map(); // proposal_id → states
  private splitBrainEvents: Map<string, SplitBrainEvent> = new Map();
  private auditLog: ConsensusAuditEntry[] = [];

  // ──────────────────────────────────────────
  // Council Management
  // ──────────────────────────────────────────

  createCouncil(params: {
    name: string;
    description: string;
    domains: DecisionDomain[];
    default_algorithm: ConsensusAlgorithm;
    default_quorum?: number;
    default_approval_threshold?: number;
    domain_overrides?: DomainConfig[];
    creator_id: string;
  }): ConsensusCouncil {
    const now = new Date().toISOString();
    const council: ConsensusCouncil = {
      id: generateId('council'),
      name: params.name,
      description: params.description,
      domains: params.domains,
      members: [
        {
          agent_id: params.creator_id,
          role: 'chair' as CouncilRole,
          weight_multiplier: 1.0,
          voting_domains: [],
          joined_at: now,
        },
      ],
      default_algorithm: params.default_algorithm,
      default_quorum: params.default_quorum ?? 0.5,
      default_approval_threshold: params.default_approval_threshold ?? 0.5,
      domain_overrides: params.domain_overrides ?? [],
      active: true,
      created_at: now,
      updated_at: now,
    };

    this.councils.set(council.id, council);
    this.audit('council_created', council.id, undefined, params.creator_id, {
      name: council.name,
      domains: council.domains,
    });
    return council;
  }

  addCouncilMember(
    councilId: string,
    member: {
      agent_id: string;
      role?: CouncilRole;
      weight_multiplier?: number;
      voting_domains?: DecisionDomain[];
    },
    addedBy: string,
  ): ConsensusCouncil {
    const council = this.getCouncilOrThrow(councilId);
    if (council.members.some((m) => m.agent_id === member.agent_id)) {
      throw new Error(`Agent ${member.agent_id} is already a council member`);
    }

    const newMember: CouncilMember = {
      agent_id: member.agent_id,
      role: member.role ?? 'member',
      weight_multiplier: member.weight_multiplier ?? 1.0,
      voting_domains: member.voting_domains ?? [],
      joined_at: new Date().toISOString(),
    };

    council.members.push(newMember);
    council.updated_at = new Date().toISOString();
    this.audit('council_member_added', councilId, undefined, addedBy, {
      agent_id: member.agent_id,
      role: newMember.role,
    });
    return council;
  }

  removeCouncilMember(
    councilId: string,
    agentId: string,
    removedBy: string,
  ): ConsensusCouncil {
    const council = this.getCouncilOrThrow(councilId);
    const idx = council.members.findIndex((m) => m.agent_id === agentId);
    if (idx === -1) {
      throw new Error(`Agent ${agentId} is not a council member`);
    }
    // Cannot remove the last chair
    const member = council.members[idx];
    if (member.role === 'chair') {
      const otherChairs = council.members.filter(
        (m) => m.role === 'chair' && m.agent_id !== agentId,
      );
      if (otherChairs.length === 0) {
        throw new Error('Cannot remove the last chair from a council');
      }
    }

    council.members.splice(idx, 1);
    council.updated_at = new Date().toISOString();
    this.audit('council_member_removed', councilId, undefined, removedBy, {
      agent_id: agentId,
    });
    return council;
  }

  getCouncil(councilId: string): ConsensusCouncil | undefined {
    return this.councils.get(councilId);
  }

  listCouncils(): ConsensusCouncil[] {
    return Array.from(this.councils.values());
  }

  // ──────────────────────────────────────────
  // Proposal Lifecycle
  // ──────────────────────────────────────────

  createProposal(params: {
    proposer_id: string;
    council_id: string;
    title: string;
    description: string;
    domain: DecisionDomain;
    algorithm?: ConsensusAlgorithm;
    payload: Record<string, unknown>;
    voting_opens_at?: string;
    voting_closes_at: string;
    quorum_threshold?: number;
    approval_threshold?: number;
    veto_enabled?: boolean;
    veto_holders?: string[];
    enforcement_actions?: EnforcementAction[];
  }): Proposal {
    const council = this.getCouncilOrThrow(params.council_id);

    // Verify proposer is a member (not observer)
    const member = council.members.find(
      (m) => m.agent_id === params.proposer_id,
    );
    if (!member || member.role === 'observer') {
      throw new Error('Only council members (non-observer) can create proposals');
    }

    // Resolve config: domain override > council default > params
    const domainConfig = council.domain_overrides.find(
      (d) => d.domain === params.domain,
    );
    const algorithm =
      params.algorithm ?? domainConfig?.algorithm ?? council.default_algorithm;
    const quorum =
      params.quorum_threshold ??
      domainConfig?.quorum_threshold ??
      council.default_quorum;
    const approvalThreshold =
      params.approval_threshold ??
      domainConfig?.approval_threshold ??
      council.default_approval_threshold;

    // Safety-critical domains force veto enabled regardless of params
    const isSafetyCritical = SAFETY_CRITICAL_DOMAINS.includes(params.domain);
    const vetoEnabled = isSafetyCritical || (params.veto_enabled ?? false);

    // Resolve veto holders: explicit list, or council veto_holders + chairs
    let vetoHolders = params.veto_holders ?? [];
    if (vetoEnabled && vetoHolders.length === 0) {
      vetoHolders = council.members
        .filter((m) => m.role === 'chair' || m.role === 'veto_holder')
        .map((m) => m.agent_id);
    }

    const now = new Date().toISOString();
    const proposal: Proposal = {
      id: generateId('prop'),
      proposer_id: params.proposer_id,
      council_id: params.council_id,
      title: params.title,
      description: params.description,
      domain: params.domain,
      status: 'draft',
      algorithm,
      payload: params.payload,
      voting_opens_at: params.voting_opens_at ?? now,
      voting_closes_at: params.voting_closes_at,
      quorum_threshold: quorum,
      approval_threshold: approvalThreshold,
      veto_enabled: vetoEnabled,
      veto_holders: vetoHolders,
      created_at: now,
      updated_at: now,
    };

    this.proposals.set(proposal.id, proposal);
    this.votes.set(proposal.id, []);
    this.audit(
      'proposal_created',
      council.id,
      proposal.id,
      params.proposer_id,
      { title: proposal.title, domain: proposal.domain, algorithm },
    );
    return proposal;
  }

  openProposal(proposalId: string, actorId: string): Proposal {
    const proposal = this.getProposalOrThrow(proposalId);
    if (proposal.status !== 'draft') {
      throw new Error(`Cannot open proposal in status: ${proposal.status}`);
    }

    proposal.status = 'open';
    proposal.updated_at = new Date().toISOString();

    // If voting_opens_at is now or past, move to voting
    if (new Date(proposal.voting_opens_at) <= new Date()) {
      proposal.status = 'voting';
    }

    this.audit(
      'proposal_opened',
      proposal.council_id,
      proposalId,
      actorId,
      {},
    );
    return proposal;
  }

  cancelProposal(proposalId: string, actorId: string): Proposal {
    const proposal = this.getProposalOrThrow(proposalId);
    if (TERMINAL_STATUSES.includes(proposal.status)) {
      throw new Error(`Cannot cancel proposal in terminal status: ${proposal.status}`);
    }
    if (proposal.proposer_id !== actorId) {
      // Check if actor is chair
      const council = this.getCouncilOrThrow(proposal.council_id);
      const member = council.members.find((m) => m.agent_id === actorId);
      if (!member || member.role !== 'chair') {
        throw new Error('Only the proposer or a chair can cancel a proposal');
      }
    }

    proposal.status = 'cancelled';
    proposal.outcome = {
      approved: false,
      tally: this.computeTally(proposalId),
      resolution_method: 'cancelled_by_proposer',
      enforcement_actions: [],
      resolved_at: new Date().toISOString(),
    };
    proposal.updated_at = new Date().toISOString();
    this.audit(
      'proposal_cancelled',
      proposal.council_id,
      proposalId,
      actorId,
      {},
    );
    return proposal;
  }

  getProposal(proposalId: string): Proposal | undefined {
    return this.proposals.get(proposalId);
  }

  listProposals(councilId?: string, status?: ProposalStatus): Proposal[] {
    let results = Array.from(this.proposals.values());
    if (councilId) {
      results = results.filter((p) => p.council_id === councilId);
    }
    if (status) {
      results = results.filter((p) => p.status === status);
    }
    return results;
  }

  // ──────────────────────────────────────────
  // Voting
  // ──────────────────────────────────────────

  castVote(params: {
    proposal_id: string;
    voter_id: string;
    choice: VoteChoice;
    rationale?: string;
  }): Vote {
    const proposal = this.getProposalOrThrow(params.proposal_id);
    if (proposal.status !== 'voting' && proposal.status !== 'open') {
      throw new Error(`Cannot vote on proposal in status: ${proposal.status}`);
    }

    // Check voting deadline
    if (new Date(proposal.voting_closes_at) < new Date()) {
      throw new Error('Voting period has closed');
    }

    const council = this.getCouncilOrThrow(proposal.council_id);
    const member = council.members.find(
      (m) => m.agent_id === params.voter_id,
    );
    if (!member) {
      throw new Error(`Agent ${params.voter_id} is not a council member`);
    }
    if (member.role === 'observer') {
      throw new Error('Observers cannot vote');
    }

    // Check domain restrictions
    if (
      member.voting_domains.length > 0 &&
      !member.voting_domains.includes(proposal.domain)
    ) {
      throw new Error(
        `Agent ${params.voter_id} is not authorized to vote on ${proposal.domain} proposals`,
      );
    }

    // Veto validation
    if (params.choice === 'veto') {
      if (!proposal.veto_enabled) {
        throw new Error('Veto is not enabled for this proposal');
      }
      if (!proposal.veto_holders.includes(params.voter_id)) {
        throw new Error(`Agent ${params.voter_id} does not have veto power`);
      }
    }

    // Check for existing vote — update it
    const proposalVotes = this.votes.get(params.proposal_id) ?? [];
    const existingIdx = proposalVotes.findIndex(
      (v) => v.voter_id === params.voter_id && !v.delegated_from,
    );

    const vote: Vote = {
      id: generateId('vote'),
      proposal_id: params.proposal_id,
      voter_id: params.voter_id,
      choice: params.choice,
      weight: member.weight_multiplier,
      rationale: params.rationale,
      delegation_chain: [],
      created_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      proposalVotes[existingIdx] = vote;
    } else {
      proposalVotes.push(vote);
    }

    // Process delegated votes for this voter
    this.processDelegatedVotes(proposal, council, vote, proposalVotes);

    this.votes.set(params.proposal_id, proposalVotes);

    // For conviction voting, initialize conviction state
    if (proposal.algorithm === 'conviction_voting') {
      this.initConviction(params.proposal_id, params.voter_id, vote.weight);
    }

    this.audit(
      params.choice === 'veto' ? 'veto_exercised' : 'vote_cast',
      proposal.council_id,
      params.proposal_id,
      params.voter_id,
      { choice: params.choice, weight: vote.weight },
    );

    // Move to voting status if still open
    if (proposal.status === 'open') {
      proposal.status = 'voting';
    }

    // Handle immediate veto
    if (params.choice === 'veto') {
      this.resolveAsVetoed(proposal, params.voter_id, params.rationale ?? '');
      return vote;
    }

    // Check for early resolution
    this.checkEarlyResolution(proposal);

    return vote;
  }

  /**
   * Process delegated votes: when an agent votes, any delegations TO them
   * are automatically resolved with the same choice (weighted by delegator's weight).
   */
  private processDelegatedVotes(
    proposal: Proposal,
    council: ConsensusCouncil,
    sourceVote: Vote,
    proposalVotes: Vote[],
  ): void {
    // Find all agents who have delegated to this voter
    const delegators = this.findDelegatorsFor(
      sourceVote.voter_id,
      proposal.domain,
      proposal.council_id,
    );

    for (const delegation of delegators) {
      // Skip if delegator already voted directly
      const alreadyVoted = proposalVotes.some(
        (v) =>
          v.voter_id === delegation.delegator_id && !v.delegated_from,
      );
      if (alreadyVoted) continue;

      // Skip vetoes — cannot delegate veto power
      if (sourceVote.choice === 'veto') continue;

      const delegatorMember = council.members.find(
        (m) => m.agent_id === delegation.delegator_id,
      );
      if (!delegatorMember || delegatorMember.role === 'observer') continue;

      const chain = [
        ...sourceVote.delegation_chain,
        sourceVote.voter_id,
      ];

      // Prevent circular delegation
      if (chain.includes(delegation.delegator_id)) continue;

      // Enforce max depth
      if (chain.length > delegation.max_depth) continue;

      const delegatedVote: Vote = {
        id: generateId('vote'),
        proposal_id: proposal.id,
        voter_id: delegation.delegator_id,
        choice: sourceVote.choice === 'veto' ? 'abstain' : sourceVote.choice,
        weight: delegatorMember.weight_multiplier,
        delegated_from: sourceVote.voter_id,
        delegation_chain: chain,
        created_at: new Date().toISOString(),
      };

      // Remove any previous delegated vote
      const prevIdx = proposalVotes.findIndex(
        (v) =>
          v.voter_id === delegation.delegator_id && v.delegated_from,
      );
      if (prevIdx >= 0) {
        proposalVotes[prevIdx] = delegatedVote;
      } else {
        proposalVotes.push(delegatedVote);
      }

      this.audit(
        'vote_delegated',
        proposal.council_id,
        proposal.id,
        delegation.delegator_id,
        {
          delegate: sourceVote.voter_id,
          choice: delegatedVote.choice,
          chain,
        },
      );

      // Recurse for transitive delegations
      if (delegation.transitive) {
        this.processDelegatedVotes(proposal, council, delegatedVote, proposalVotes);
      }
    }
  }

  // ──────────────────────────────────────────
  // Vote Delegation Management
  // ──────────────────────────────────────────

  createDelegation(params: {
    delegator_id: string;
    delegate_id: string;
    domains?: DecisionDomain[];
    council_id?: string;
    transitive?: boolean;
    max_depth?: number;
    active_until?: string;
  }): VoteDelegation {
    if (params.delegator_id === params.delegate_id) {
      throw new Error('Cannot delegate to self');
    }

    // Check for circular delegation
    if (this.wouldCreateCycle(params.delegator_id, params.delegate_id)) {
      throw new Error(
        'Delegation would create a circular chain',
      );
    }

    const delegation: VoteDelegation = {
      id: generateId('deleg'),
      delegator_id: params.delegator_id,
      delegate_id: params.delegate_id,
      domains: params.domains ?? [],
      council_id: params.council_id,
      transitive: params.transitive ?? false,
      max_depth: params.max_depth ?? 3,
      active_from: new Date().toISOString(),
      active_until: params.active_until,
      revoked: false,
      created_at: new Date().toISOString(),
    };

    const existing = this.delegations.get(params.delegator_id) ?? [];
    existing.push(delegation);
    this.delegations.set(params.delegator_id, existing);

    this.audit(
      'delegation_created',
      params.council_id ?? 'global',
      undefined,
      params.delegator_id,
      { delegate: params.delegate_id, transitive: delegation.transitive },
    );
    return delegation;
  }

  revokeDelegation(delegationId: string, actorId: string): VoteDelegation {
    for (const [, delegations] of this.delegations) {
      const deleg = delegations.find((d) => d.id === delegationId);
      if (deleg) {
        if (deleg.delegator_id !== actorId) {
          throw new Error('Only the delegator can revoke a delegation');
        }
        deleg.revoked = true;
        this.audit(
          'delegation_revoked',
          deleg.council_id ?? 'global',
          undefined,
          actorId,
          { delegation_id: delegationId },
        );
        return deleg;
      }
    }
    throw new Error(`Delegation ${delegationId} not found`);
  }

  listDelegations(agentId: string): VoteDelegation[] {
    return (this.delegations.get(agentId) ?? []).filter((d) => !d.revoked);
  }

  private wouldCreateCycle(delegatorId: string, delegateId: string): boolean {
    const visited = new Set<string>();
    const queue = [delegateId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === delegatorId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const delegations = (this.delegations.get(current) ?? []).filter(
        (d) => !d.revoked,
      );
      for (const d of delegations) {
        queue.push(d.delegate_id);
      }
    }
    return false;
  }

  private findDelegatorsFor(
    delegateId: string,
    domain: DecisionDomain,
    councilId: string,
  ): VoteDelegation[] {
    const result: VoteDelegation[] = [];
    for (const [, delegations] of this.delegations) {
      for (const d of delegations) {
        if (d.revoked) continue;
        if (d.delegate_id !== delegateId) continue;
        if (d.active_until && new Date(d.active_until) < new Date()) continue;
        if (d.council_id && d.council_id !== councilId) continue;
        if (d.domains.length > 0 && !d.domains.includes(domain)) continue;
        result.push(d);
      }
    }
    return result;
  }

  // ──────────────────────────────────────────
  // Tally & Resolution
  // ──────────────────────────────────────────

  computeTally(proposalId: string): VoteTally {
    const proposal = this.getProposalOrThrow(proposalId);
    const council = this.getCouncilOrThrow(proposal.council_id);
    const votes = this.votes.get(proposalId) ?? [];

    // Eligible voters: non-observer members authorized for this domain
    const eligible = council.members.filter((m) => {
      if (m.role === 'observer') return false;
      if (m.voting_domains.length > 0 && !m.voting_domains.includes(proposal.domain)) {
        return false;
      }
      return true;
    });

    // Deduplicate: one vote per voter (latest wins)
    const voteMap = new Map<string, Vote>();
    for (const v of votes) {
      voteMap.set(v.voter_id, v);
    }

    let approveWeight = 0;
    let rejectWeight = 0;
    let abstainWeight = 0;
    let vetoCount = 0;

    for (const v of voteMap.values()) {
      const effectiveWeight = this.getEffectiveWeight(proposal, v);
      switch (v.choice) {
        case 'approve':
          approveWeight += effectiveWeight;
          break;
        case 'reject':
          rejectWeight += effectiveWeight;
          break;
        case 'abstain':
          abstainWeight += effectiveWeight;
          break;
        case 'veto':
          vetoCount++;
          break;
      }
    }

    const totalCast = voteMap.size;
    const totalEligible = eligible.length;
    const quorumMet =
      totalEligible > 0
        ? totalCast / totalEligible >= proposal.quorum_threshold
        : false;

    const totalDecisiveWeight = approveWeight + rejectWeight;
    const approvalRatio =
      totalDecisiveWeight > 0 ? approveWeight / totalDecisiveWeight : 0;

    return {
      total_eligible: totalEligible,
      total_cast: totalCast,
      approve_weight: approveWeight,
      reject_weight: rejectWeight,
      abstain_weight: abstainWeight,
      veto_count: vetoCount,
      quorum_met: quorumMet,
      approval_ratio: approvalRatio,
    };
  }

  /**
   * Get effective vote weight, accounting for conviction voting time accumulation.
   */
  private getEffectiveWeight(proposal: Proposal, vote: Vote): number {
    if (proposal.algorithm !== 'conviction_voting') {
      return vote.weight;
    }

    // Conviction voting: weight grows over time
    const states = this.convictionStates.get(proposal.id) ?? [];
    const state = states.find((s) => s.voter_id === vote.voter_id);
    if (!state) return vote.weight;

    return state.accumulated_conviction;
  }

  /**
   * Resolve a proposal based on its algorithm. Called explicitly or
   * when voting period closes.
   */
  resolveProposal(proposalId: string): Proposal {
    const proposal = this.getProposalOrThrow(proposalId);
    if (TERMINAL_STATUSES.includes(proposal.status)) {
      throw new Error(`Proposal already in terminal status: ${proposal.status}`);
    }

    const tally = this.computeTally(proposalId);
    let approved = false;
    let method: ResolutionMethod = 'quorum_vote';

    switch (proposal.algorithm) {
      case 'weighted_majority':
        approved = tally.quorum_met && tally.approval_ratio > proposal.approval_threshold;
        method = 'quorum_vote';
        break;

      case 'supermajority':
        // Requires 2/3 approval
        approved = tally.quorum_met && tally.approval_ratio >= 2 / 3;
        method = 'quorum_vote';
        break;

      case 'unanimous':
        approved =
          tally.quorum_met &&
          tally.reject_weight === 0 &&
          tally.total_cast === tally.total_eligible;
        method = tally.total_cast === tally.total_eligible
          ? 'unanimous_early'
          : 'quorum_vote';
        break;

      case 'optimistic_approval':
        // Passes unless there are rejections exceeding threshold
        approved =
          tally.reject_weight === 0 ||
          tally.approval_ratio > proposal.approval_threshold;
        method =
          tally.total_cast === 0
            ? 'optimistic_no_objection'
            : 'quorum_vote';
        break;

      case 'conviction_voting':
        // Conviction threshold: approve weight must exceed a fixed threshold
        this.updateAllConvictions(proposalId);
        const updatedTally = this.computeTally(proposalId);
        approved = updatedTally.approve_weight > updatedTally.reject_weight * 2;
        method = 'conviction_threshold';
        break;

      case 'liquid_democracy':
        // Same as weighted majority but with delegated weights
        approved = tally.quorum_met && tally.approval_ratio > proposal.approval_threshold;
        method = 'quorum_vote';
        break;
    }

    // Check expiry if quorum not met
    if (!tally.quorum_met && proposal.algorithm !== 'optimistic_approval') {
      if (new Date(proposal.voting_closes_at) < new Date()) {
        proposal.status = 'expired';
        proposal.outcome = {
          approved: false,
          tally,
          resolution_method: 'expired_no_quorum',
          enforcement_actions: [],
          resolved_at: new Date().toISOString(),
        };
        proposal.updated_at = new Date().toISOString();
        this.audit(
          'proposal_expired',
          proposal.council_id,
          proposalId,
          'system',
          { tally },
        );
        return proposal;
      }
    }

    proposal.status = approved ? 'decided_approved' : 'decided_rejected';
    proposal.outcome = {
      approved,
      tally,
      resolution_method: method,
      enforcement_actions: [],
      resolved_at: new Date().toISOString(),
    };
    proposal.updated_at = new Date().toISOString();

    this.audit(
      'proposal_decided',
      proposal.council_id,
      proposalId,
      'system',
      { approved, method, tally },
    );

    // Check quorum achievement
    if (tally.quorum_met) {
      this.audit(
        'quorum_reached',
        proposal.council_id,
        proposalId,
        'system',
        { total_cast: tally.total_cast, total_eligible: tally.total_eligible },
      );
    }

    return proposal;
  }

  /**
   * Execute enforcement actions for an approved proposal.
   */
  executeProposal(
    proposalId: string,
    executor: (action: EnforcementAction) => Record<string, unknown>,
  ): Proposal {
    const proposal = this.getProposalOrThrow(proposalId);
    if (proposal.status !== 'decided_approved') {
      throw new Error('Can only execute approved proposals');
    }
    if (!proposal.outcome) {
      throw new Error('Proposal has no outcome');
    }

    for (const action of proposal.outcome.enforcement_actions) {
      if (!action.executed) {
        action.result = executor(action);
        action.executed = true;
        action.executed_at = new Date().toISOString();
      }
    }

    proposal.status = 'executed';
    proposal.updated_at = new Date().toISOString();
    this.audit(
      'proposal_executed',
      proposal.council_id,
      proposalId,
      'system',
      {
        actions_executed: proposal.outcome.enforcement_actions.length,
      },
    );
    return proposal;
  }

  /**
   * Check if the proposal can be resolved early (e.g., unanimous approval
   * with all votes in). Auto-resolution only fires for unanimous early
   * completion; all other algorithms wait for explicit resolveProposal()
   * or deadline expiry to avoid premature closure.
   */
  private checkEarlyResolution(proposal: Proposal): void {
    const tally = this.computeTally(proposal.id);

    // Unanimous: all voted approve — resolve immediately
    if (
      proposal.algorithm === 'unanimous' &&
      tally.total_cast === tally.total_eligible &&
      tally.reject_weight === 0
    ) {
      this.resolveProposal(proposal.id);
    }
  }

  private resolveAsVetoed(
    proposal: Proposal,
    vetoerId: string,
    reason: string,
  ): void {
    proposal.status = 'vetoed';
    proposal.outcome = {
      approved: false,
      tally: this.computeTally(proposal.id),
      veto_info: {
        vetoer_id: vetoerId,
        reason,
        vetoed_at: new Date().toISOString(),
      },
      resolution_method: 'veto_exercised',
      enforcement_actions: [],
      resolved_at: new Date().toISOString(),
    };
    proposal.updated_at = new Date().toISOString();
  }

  // ──────────────────────────────────────────
  // Conviction Voting
  // ──────────────────────────────────────────

  private initConviction(
    proposalId: string,
    voterId: string,
    baseWeight: number,
  ): void {
    const states = this.convictionStates.get(proposalId) ?? [];
    const existing = states.find((s) => s.voter_id === voterId);
    const now = new Date().toISOString();

    if (existing) {
      // Reset conviction on vote change
      existing.base_weight = baseWeight;
      existing.accumulated_conviction = baseWeight;
      existing.conviction_start = now;
      existing.last_computed_at = now;
    } else {
      states.push({
        proposal_id: proposalId,
        voter_id: voterId,
        base_weight: baseWeight,
        accumulated_conviction: baseWeight,
        half_life_seconds: 86400, // 1 day
        conviction_start: now,
        last_computed_at: now,
      });
    }

    this.convictionStates.set(proposalId, states);
  }

  updateConviction(proposalId: string, voterId: string): ConvictionState {
    const states = this.convictionStates.get(proposalId) ?? [];
    const state = states.find((s) => s.voter_id === voterId);
    if (!state) {
      throw new Error(`No conviction state for voter ${voterId} on proposal ${proposalId}`);
    }

    const now = new Date();
    const elapsed =
      (now.getTime() - new Date(state.conviction_start).getTime()) / 1000;

    // Conviction grows logarithmically: base_weight * (1 + ln(1 + elapsed / half_life))
    state.accumulated_conviction =
      state.base_weight * (1 + Math.log(1 + elapsed / state.half_life_seconds));
    state.last_computed_at = now.toISOString();

    this.audit(
      'conviction_updated',
      this.getProposalOrThrow(proposalId).council_id,
      proposalId,
      voterId,
      { conviction: state.accumulated_conviction },
    );

    return state;
  }

  private updateAllConvictions(proposalId: string): void {
    const states = this.convictionStates.get(proposalId) ?? [];
    for (const state of states) {
      this.updateConviction(proposalId, state.voter_id);
    }
  }

  // ──────────────────────────────────────────
  // Split-Brain Detection & Resolution
  // ──────────────────────────────────────────

  detectSplitBrain(
    councilId: string,
    proposalId: string,
    partitions: PartitionDecision[],
    strategy?: SplitBrainStrategy,
  ): SplitBrainEvent {
    const council = this.getCouncilOrThrow(councilId);

    // Verify partitions contain conflicting outcomes
    const approvals = partitions.filter((p) => p.outcome.approved);
    const rejections = partitions.filter((p) => !p.outcome.approved);
    if (approvals.length === 0 || rejections.length === 0) {
      throw new Error('No split-brain: partitions agree on outcome');
    }

    const event: SplitBrainEvent = {
      id: generateId('split'),
      council_id: councilId,
      proposal_id: proposalId,
      partitions,
      strategy: strategy ?? 'highest_quorum_wins',
      detected_at: new Date().toISOString(),
    };

    this.splitBrainEvents.set(event.id, event);
    this.audit(
      'split_brain_detected',
      councilId,
      proposalId,
      'system',
      {
        partition_count: partitions.length,
        strategy: event.strategy,
      },
    );

    // Auto-resolve non-manual strategies
    if (event.strategy !== 'manual_resolution') {
      this.resolveSplitBrain(event.id, council);
    }

    return event;
  }

  private resolveSplitBrain(
    eventId: string,
    council: ConsensusCouncil,
  ): void {
    const event = this.splitBrainEvents.get(eventId);
    if (!event) return;

    let winningPartitionId: string | undefined;

    switch (event.strategy) {
      case 'highest_quorum_wins': {
        let maxQuorum = 0;
        for (const p of event.partitions) {
          const ratio =
            p.outcome.tally.total_cast / p.outcome.tally.total_eligible;
          if (ratio > maxQuorum) {
            maxQuorum = ratio;
            winningPartitionId = p.partition_id;
          }
        }
        break;
      }

      case 'chair_partition_wins': {
        const chairs = council.members
          .filter((m) => m.role === 'chair')
          .map((m) => m.agent_id);
        for (const p of event.partitions) {
          if (chairs.some((c) => p.member_ids.includes(c))) {
            winningPartitionId = p.partition_id;
            break;
          }
        }
        break;
      }

      case 'latest_timestamp_wins': {
        let latest = '';
        for (const p of event.partitions) {
          if (p.outcome.resolved_at > latest) {
            latest = p.outcome.resolved_at;
            winningPartitionId = p.partition_id;
          }
        }
        break;
      }

      case 'merge_and_revote': {
        // Create a new proposal for revote
        const original = this.proposals.get(event.proposal_id);
        if (original) {
          const revoteProposal = this.createProposal({
            proposer_id: 'system',
            council_id: event.council_id,
            title: `[REVOTE] ${original.title}`,
            description: `Split-brain revote: ${original.description}`,
            domain: original.domain,
            algorithm: original.algorithm,
            payload: original.payload,
            voting_closes_at: new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString(),
            quorum_threshold: original.quorum_threshold,
            approval_threshold: original.approval_threshold,
          });
          event.resolution = {
            revote_proposal_id: revoteProposal.id,
            resolved_by: 'system',
            resolved_at: new Date().toISOString(),
            resolution_notes: 'Merged partitions and created revote proposal',
          };
          this.splitBrainEvents.set(eventId, event);
          return;
        }
        break;
      }

      default:
        return; // manual_resolution handled externally
    }

    if (winningPartitionId) {
      event.resolution = {
        winning_partition_id: winningPartitionId,
        resolved_by: 'system',
        resolved_at: new Date().toISOString(),
        resolution_notes: `Resolved via ${event.strategy}`,
      };

      // Apply winning outcome to the proposal
      const proposal = this.proposals.get(event.proposal_id);
      const winning = event.partitions.find(
        (p) => p.partition_id === winningPartitionId,
      );
      if (proposal && winning) {
        proposal.outcome = winning.outcome;
        proposal.status = winning.outcome.approved
          ? 'decided_approved'
          : 'decided_rejected';
        proposal.updated_at = new Date().toISOString();
      }

      this.splitBrainEvents.set(eventId, event);
    }

    this.audit(
      'split_brain_resolved',
      event.council_id,
      event.proposal_id,
      'system',
      {
        strategy: event.strategy,
        winning_partition: winningPartitionId,
      },
    );
  }

  resolveSplitBrainManually(
    eventId: string,
    resolvedBy: string,
    winningPartitionId: string,
    notes: string,
  ): SplitBrainEvent {
    const event = this.splitBrainEvents.get(eventId);
    if (!event) {
      throw new Error(`Split-brain event ${eventId} not found`);
    }
    if (event.resolution) {
      throw new Error('Split-brain already resolved');
    }

    event.resolution = {
      winning_partition_id: winningPartitionId,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
    };

    // Apply outcome
    const proposal = this.proposals.get(event.proposal_id);
    const winning = event.partitions.find(
      (p) => p.partition_id === winningPartitionId,
    );
    if (proposal && winning) {
      proposal.outcome = winning.outcome;
      proposal.status = winning.outcome.approved
        ? 'decided_approved'
        : 'decided_rejected';
      proposal.updated_at = new Date().toISOString();
    }

    this.splitBrainEvents.set(eventId, event);
    this.audit(
      'split_brain_resolved',
      event.council_id,
      event.proposal_id,
      resolvedBy,
      { winning_partition: winningPartitionId, notes },
    );
    return event;
  }

  getSplitBrainEvent(eventId: string): SplitBrainEvent | undefined {
    return this.splitBrainEvents.get(eventId);
  }

  // ──────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────

  getVotes(proposalId: string): Vote[] {
    return this.votes.get(proposalId) ?? [];
  }

  getAuditLog(
    councilId?: string,
    proposalId?: string,
    limit?: number,
  ): ConsensusAuditEntry[] {
    let entries = this.auditLog;
    if (councilId) {
      entries = entries.filter((e) => e.council_id === councilId);
    }
    if (proposalId) {
      entries = entries.filter((e) => e.proposal_id === proposalId);
    }
    if (limit) {
      entries = entries.slice(-limit);
    }
    return entries;
  }

  // ──────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────

  private getCouncilOrThrow(id: string): ConsensusCouncil {
    const council = this.councils.get(id);
    if (!council) throw new Error(`Council ${id} not found`);
    return council;
  }

  private getProposalOrThrow(id: string): Proposal {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error(`Proposal ${id} not found`);
    return proposal;
  }

  private audit(
    eventType: ConsensusEventType,
    councilId: string,
    proposalId: string | undefined,
    actorId: string,
    details: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      id: generateId('audit'),
      event_type: eventType,
      council_id: councilId,
      proposal_id: proposalId,
      actor_id: actorId,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
