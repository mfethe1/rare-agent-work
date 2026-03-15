/**
 * A2A Agent Ensemble Engine
 *
 * Implements dynamic agent team composition:
 *
 * 1. **Formation** — Create an ensemble, recruit members by strategy, register
 *    the ensemble as a first-class agent in the registry.
 *
 * 2. **Membership** — Invite, accept, suspend, remove members. Track roles,
 *    capabilities, and contribution metrics. Auto-detect quorum loss.
 *
 * 3. **Internal Consensus** — Before publishing a task result, members vote on
 *    the proposed output. The consensus policy determines when agreement is
 *    reached. Failed consensus triggers revision rounds.
 *
 * 4. **Dissolution** — Graceful shutdown preserves learnings to the knowledge
 *    graph. Members are released, the ensemble agent is deactivated.
 */

import { getServiceDb } from '../auth';
import type {
  AgentEnsemble,
  EnsembleMember,
  ConsensusRound,
  ConsensusVote,
  ConsensusTally,
  ConsensusPolicy,
  EnsembleDissolution,
  MemberRole,
  MemberStatus,
  EnsembleStatus,
} from './types';
import type {
  CreateEnsembleInput,
  InviteMemberInput,
  ProposeOutputInput,
  VoteInput,
  DissolveInput,
  ListEnsemblesInput,
} from './validation';

// ── Helpers ─────────────────────────────────────────────────────────────────

type Result<T> = T | { error: string; status_code: number };

function err(message: string, status_code: number): { error: string; status_code: number } {
  return { error: message, status_code };
}

function isErr<T>(r: Result<T>): r is { error: string; status_code: number } {
  return typeof r === 'object' && r !== null && 'error' in r && 'status_code' in r;
}

// ── Create Ensemble ─────────────────────────────────────────────────────────

interface CreateEnsembleParams {
  creator_agent_id: string;
  input: CreateEnsembleInput;
}

export async function createEnsemble({ creator_agent_id, input }: CreateEnsembleParams): Promise<
  Result<{ ensemble: AgentEnsemble; members: EnsembleMember[]; agent_id: string }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  // Verify creator exists
  const { data: creator } = await db
    .from('agent_registry')
    .select('id, name, capabilities')
    .eq('id', creator_agent_id)
    .eq('is_active', true)
    .single();

  if (!creator) return err('Creator agent not found or inactive', 404);

  const now = new Date().toISOString();

  // Register the ensemble as a first-class agent in the registry
  const ensembleName = `ensemble:${input.name}`;
  const { data: agentRecord, error: agentErr } = await db
    .from('agent_registry')
    .insert({
      name: ensembleName,
      description: `Agent Ensemble — ${input.goal}`,
      capabilities: [],
      trust_level: 'verified',
      is_active: true,
      created_at: now,
      last_seen_at: now,
    })
    .select('id')
    .single();

  if (agentErr || !agentRecord) return err('Failed to register ensemble agent', 500);

  // Create the ensemble record
  const { data: ensemble, error: ensembleErr } = await db
    .from('a2a_ensembles')
    .insert({
      name: input.name,
      goal: input.goal,
      agent_id: agentRecord.id,
      created_by: creator_agent_id,
      status: 'forming' as EnsembleStatus,
      formation_strategy: input.formation_strategy,
      consensus_policy: input.consensus_policy,
      min_quorum: input.min_quorum,
      max_members: input.max_members,
      capabilities: [],
      tags: input.tags,
      idle_timeout_seconds: input.idle_timeout_seconds,
      tasks_completed: 0,
      avg_quality: 0,
      created_at: now,
      updated_at: now,
      dissolved_at: null,
    })
    .select('*')
    .single();

  if (ensembleErr || !ensemble) return err('Failed to create ensemble', 500);

  // Add creator as coordinator
  const creatorMember = await addMember(db, {
    ensemble_id: ensemble.id,
    agent_id: creator_agent_id,
    role: 'coordinator',
    capabilities: (creator.capabilities ?? []).map((c: { id: string }) => c.id),
    now,
  });

  const members: EnsembleMember[] = creatorMember ? [creatorMember] : [];

  // Handle formation strategy
  if (input.formation_strategy === 'manual' && input.invite_agents?.length) {
    for (const agentId of input.invite_agents) {
      if (agentId === creator_agent_id) continue;
      const member = await addMember(db, {
        ensemble_id: ensemble.id,
        agent_id: agentId,
        role: 'specialist',
        capabilities: [],
        now,
        status: 'invited',
      });
      if (member) members.push(member);
    }
  } else if (
    (input.formation_strategy === 'capability_match' || input.formation_strategy === 'reputation_top_n') &&
    input.required_capabilities?.length
  ) {
    const recruited = await recruitByCapability(db, {
      ensemble_id: ensemble.id,
      required_capabilities: input.required_capabilities,
      exclude_agents: [creator_agent_id],
      top_n: input.formation_strategy === 'reputation_top_n' ? (input.top_n ?? 3) : 1,
      max_members: input.max_members - 1,
      now,
    });
    members.push(...recruited);
  }

  // Recompute ensemble capabilities
  const capabilities = await recomputeCapabilities(db, ensemble.id);

  // If we have enough members, activate
  const activeCount = members.filter((m) => m.status === 'active').length;
  const newStatus: EnsembleStatus = activeCount >= input.min_quorum ? 'active' : 'forming';

  await db
    .from('a2a_ensembles')
    .update({ capabilities, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', ensemble.id);

  // Update agent registry capabilities
  await db
    .from('agent_registry')
    .update({ capabilities: capabilities.map((id) => ({ id, description: `Ensemble capability: ${id}`, input_modes: ['application/json'], output_modes: ['application/json'] })) })
    .eq('id', agentRecord.id);

  return {
    ensemble: { ...ensemble, capabilities, status: newStatus } as AgentEnsemble,
    members,
    agent_id: agentRecord.id,
  };
}

// ── Invite Member ───────────────────────────────────────────────────────────

interface InviteMemberParams {
  requester_agent_id: string;
  ensemble_id: string;
  input: InviteMemberInput;
}

export async function inviteMember({ requester_agent_id, ensemble_id, input }: InviteMemberParams): Promise<
  Result<{ member: EnsembleMember; ensemble_capabilities: string[] }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const ensemble = await getEnsembleRecord(db, ensemble_id);
  if (!ensemble) return err('Ensemble not found', 404);
  if (ensemble.status !== 'forming' && ensemble.status !== 'active') {
    return err(`Cannot invite members to ${ensemble.status} ensemble`, 400);
  }

  // Only coordinator can invite
  const requesterMember = await getMemberRecord(db, ensemble_id, requester_agent_id);
  if (!requesterMember || requesterMember.role !== 'coordinator') {
    return err('Only the coordinator can invite members', 403);
  }

  // Check max members
  const { count } = await db
    .from('a2a_ensemble_members')
    .select('*', { count: 'exact', head: true })
    .eq('ensemble_id', ensemble_id)
    .in('status', ['active', 'invited']);

  if ((count ?? 0) >= ensemble.max_members) {
    return err('Ensemble is at maximum capacity', 409);
  }

  // Check target agent exists
  const { data: targetAgent } = await db
    .from('agent_registry')
    .select('id, capabilities')
    .eq('id', input.agent_id)
    .eq('is_active', true)
    .single();

  if (!targetAgent) return err('Target agent not found or inactive', 404);

  // Check not already a member
  const existing = await getMemberRecord(db, ensemble_id, input.agent_id);
  if (existing && (existing.status === 'active' || existing.status === 'invited')) {
    return err('Agent is already a member or has a pending invite', 409);
  }

  const now = new Date().toISOString();
  const capabilities = (targetAgent.capabilities ?? []).map((c: { id: string }) => c.id);

  const member = await addMember(db, {
    ensemble_id,
    agent_id: input.agent_id,
    role: input.role,
    capabilities,
    now,
    status: 'invited',
  });

  if (!member) return err('Failed to invite member', 500);

  const ensemble_capabilities = await recomputeCapabilities(db, ensemble_id);

  return { member, ensemble_capabilities };
}

// ── Accept Invite ───────────────────────────────────────────────────────────

export async function acceptInvite(agent_id: string, ensemble_id: string): Promise<
  Result<{ member: EnsembleMember; ensemble: AgentEnsemble }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const member = await getMemberRecord(db, ensemble_id, agent_id);
  if (!member) return err('No invitation found', 404);
  if (member.status !== 'invited') return err(`Cannot accept — status is ${member.status}`, 400);

  const now = new Date().toISOString();

  const { data: updated, error: updateErr } = await db
    .from('a2a_ensemble_members')
    .update({ status: 'active' as MemberStatus, joined_at: now, updated_at: now })
    .eq('ensemble_id', ensemble_id)
    .eq('agent_id', agent_id)
    .select('*')
    .single();

  if (updateErr || !updated) return err('Failed to accept invite', 500);

  // Recompute capabilities and check quorum
  const capabilities = await recomputeCapabilities(db, ensemble_id);
  const ensemble = await getEnsembleRecord(db, ensemble_id);
  if (!ensemble) return err('Ensemble not found', 404);

  const activeCount = await countActiveMembers(db, ensemble_id);
  if (ensemble.status === 'forming' && activeCount >= ensemble.min_quorum) {
    await db
      .from('a2a_ensembles')
      .update({ status: 'active' as EnsembleStatus, capabilities, updated_at: now })
      .eq('id', ensemble_id);
    ensemble.status = 'active';
    ensemble.capabilities = capabilities;
  } else if (ensemble.status === 'quorum_lost' && activeCount >= ensemble.min_quorum) {
    await db
      .from('a2a_ensembles')
      .update({ status: 'active' as EnsembleStatus, capabilities, updated_at: now })
      .eq('id', ensemble_id);
    ensemble.status = 'active';
    ensemble.capabilities = capabilities;
  } else {
    await db
      .from('a2a_ensembles')
      .update({ capabilities, updated_at: now })
      .eq('id', ensemble_id);
    ensemble.capabilities = capabilities;
  }

  return { member: updated as EnsembleMember, ensemble };
}

// ── Remove Member ───────────────────────────────────────────────────────────

export async function removeMember(
  requester_agent_id: string,
  ensemble_id: string,
  target_agent_id: string,
  reason: string,
): Promise<Result<{ removed: boolean; quorum_status: 'ok' | 'lost' }>> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const ensemble = await getEnsembleRecord(db, ensemble_id);
  if (!ensemble) return err('Ensemble not found', 404);

  // Self-departure or coordinator action
  const requesterMember = await getMemberRecord(db, ensemble_id, requester_agent_id);
  if (!requesterMember) return err('Requester is not a member', 403);

  const isSelf = requester_agent_id === target_agent_id;
  if (!isSelf && requesterMember.role !== 'coordinator') {
    return err('Only the coordinator or the member themselves can remove a member', 403);
  }

  const now = new Date().toISOString();

  await db
    .from('a2a_ensemble_members')
    .update({
      status: 'departed' as MemberStatus,
      departed_at: now,
      departure_reason: reason,
      updated_at: now,
    })
    .eq('ensemble_id', ensemble_id)
    .eq('agent_id', target_agent_id);

  // Recompute and check quorum
  await recomputeCapabilities(db, ensemble_id);
  const activeCount = await countActiveMembers(db, ensemble_id);
  let quorum_status: 'ok' | 'lost' = 'ok';

  if (activeCount < ensemble.min_quorum && ensemble.status === 'active') {
    await db
      .from('a2a_ensembles')
      .update({ status: 'quorum_lost' as EnsembleStatus, updated_at: now })
      .eq('id', ensemble_id);
    quorum_status = 'lost';
  }

  return { removed: true, quorum_status };
}

// ── Propose Output (Start Consensus Round) ──────────────────────────────────

interface ProposeOutputParams {
  proposer_agent_id: string;
  ensemble_id: string;
  input: ProposeOutputInput;
}

export async function proposeOutput({ proposer_agent_id, ensemble_id, input }: ProposeOutputParams): Promise<
  Result<{ round: ConsensusRound }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const ensemble = await getEnsembleRecord(db, ensemble_id);
  if (!ensemble) return err('Ensemble not found', 404);
  if (ensemble.status !== 'active') return err('Ensemble is not active', 400);

  const member = await getMemberRecord(db, ensemble_id, proposer_agent_id);
  if (!member || member.status !== 'active') return err('Proposer is not an active member', 403);

  // Check for existing open round for this task
  const { data: existingRound } = await db
    .from('a2a_ensemble_consensus_rounds')
    .select('id, round_number')
    .eq('ensemble_id', ensemble_id)
    .eq('external_task_id', input.external_task_id)
    .eq('status', 'open')
    .single();

  if (existingRound) {
    return err('An open consensus round already exists for this task', 409);
  }

  // Determine round number (increment from previous rounds for same task)
  const { data: prevRounds } = await db
    .from('a2a_ensemble_consensus_rounds')
    .select('round_number')
    .eq('ensemble_id', ensemble_id)
    .eq('external_task_id', input.external_task_id)
    .order('round_number', { ascending: false })
    .limit(1);

  const roundNumber = prevRounds?.length ? prevRounds[0].round_number + 1 : 1;

  if (roundNumber > input.max_rounds) {
    return err(`Maximum rounds (${input.max_rounds}) exceeded — coordinator must decide`, 400);
  }

  // Compute required votes based on policy
  const activeCount = await countVotingMembers(db, ensemble_id);
  const requiredVotes = computeRequiredVotes(ensemble.consensus_policy, activeCount);

  const now = new Date().toISOString();

  const { data: round, error: roundErr } = await db
    .from('a2a_ensemble_consensus_rounds')
    .insert({
      ensemble_id,
      external_task_id: input.external_task_id,
      proposed_output: input.proposed_output,
      proposed_by: proposer_agent_id,
      status: 'open',
      policy: ensemble.consensus_policy,
      required_votes: requiredVotes,
      round_number: roundNumber,
      max_rounds: input.max_rounds,
      created_at: now,
      resolved_at: null,
    })
    .select('*')
    .single();

  if (roundErr || !round) return err('Failed to create consensus round', 500);

  return { round: round as ConsensusRound };
}

// ── Vote on Consensus Round ─────────────────────────────────────────────────

interface VoteParams {
  voter_agent_id: string;
  ensemble_id: string;
  round_id: string;
  input: VoteInput;
}

export async function voteOnRound({ voter_agent_id, ensemble_id, round_id, input }: VoteParams): Promise<
  Result<{ round_id: string; tally: ConsensusTally; resolved: boolean; decision: ConsensusTally['decision'] }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  // Verify round
  const { data: round } = await db
    .from('a2a_ensemble_consensus_rounds')
    .select('*')
    .eq('id', round_id)
    .eq('ensemble_id', ensemble_id)
    .single();

  if (!round) return err('Consensus round not found', 404);
  if (round.status !== 'open') return err(`Round is ${round.status}, not open for voting`, 400);

  // Verify voter is eligible (active member, not observer)
  const member = await getMemberRecord(db, ensemble_id, voter_agent_id);
  if (!member || member.status !== 'active') return err('Voter is not an active member', 403);
  if (member.role === 'observer') return err('Observers cannot vote', 403);

  // Check for duplicate vote
  const { data: existingVote } = await db
    .from('a2a_ensemble_consensus_votes')
    .select('round_id')
    .eq('round_id', round_id)
    .eq('agent_id', voter_agent_id)
    .single();

  if (existingVote) return err('Agent has already voted in this round', 409);

  // Record vote
  const { error: voteErr } = await db
    .from('a2a_ensemble_consensus_votes')
    .insert({
      round_id,
      agent_id: voter_agent_id,
      decision: input.decision,
      rationale: input.rationale,
      suggested_changes: input.suggested_changes ?? null,
      confidence: input.confidence,
      created_at: new Date().toISOString(),
    });

  if (voteErr) return err('Failed to record vote', 500);

  // Increment votes_cast for member
  await db
    .from('a2a_ensemble_members')
    .update({ votes_cast: (member.votes_cast ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq('ensemble_id', ensemble_id)
    .eq('agent_id', voter_agent_id);

  // Compute tally
  const ensemble = await getEnsembleRecord(db, ensemble_id);
  if (!ensemble) return err('Ensemble not found', 404);

  const tally = await computeConsensusTally(db, round_id, ensemble_id, round as ConsensusRound);

  // Resolve if threshold met
  let resolved = false;

  if (tally.threshold_met && tally.decision) {
    resolved = true;
    const now = new Date().toISOString();

    const roundStatus = tally.decision === 'approved' ? 'approved'
      : tally.decision === 'rejected' ? 'rejected'
      : 'revised';

    await db
      .from('a2a_ensemble_consensus_rounds')
      .update({ status: roundStatus, resolved_at: now })
      .eq('id', round_id);

    // If approved, increment ensemble tasks_completed
    if (tally.decision === 'approved') {
      await db.rpc('increment_ensemble_tasks', { eid: ensemble_id }).catch(() => {
        // Fallback: manual increment
        db.from('a2a_ensembles')
          .update({
            tasks_completed: (ensemble.tasks_completed ?? 0) + 1,
            updated_at: now,
          })
          .eq('id', ensemble_id);
      });
    }
  }

  return { round_id, tally, resolved, decision: tally.decision };
}

// ── Get Ensemble ────────────────────────────────────────────────────────────

export async function getEnsemble(ensemble_id: string): Promise<
  Result<{ ensemble: AgentEnsemble; members: EnsembleMember[]; active_rounds: ConsensusRound[] }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const ensemble = await getEnsembleRecord(db, ensemble_id);
  if (!ensemble) return err('Ensemble not found', 404);

  const { data: members } = await db
    .from('a2a_ensemble_members')
    .select('*')
    .eq('ensemble_id', ensemble_id)
    .order('joined_at', { ascending: true });

  const { data: rounds } = await db
    .from('a2a_ensemble_consensus_rounds')
    .select('*')
    .eq('ensemble_id', ensemble_id)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  return {
    ensemble,
    members: (members as EnsembleMember[]) ?? [],
    active_rounds: (rounds as ConsensusRound[]) ?? [],
  };
}

// ── List Ensembles ──────────────────────────────────────────────────────────

export async function listEnsembles(input: ListEnsemblesInput): Promise<{
  ensembles: AgentEnsemble[];
  count: number;
}> {
  const db = getServiceDb();
  if (!db) return { ensembles: [], count: 0 };

  let query = db.from('a2a_ensembles').select('*', { count: 'exact' });

  if (input.status) query = query.eq('status', input.status);
  if (input.created_by) query = query.eq('created_by', input.created_by);
  if (input.tag) query = query.contains('tags', [input.tag]);

  // If filtering by member, need a subquery
  if (input.member_agent_id) {
    const { data: memberEnsembles } = await db
      .from('a2a_ensemble_members')
      .select('ensemble_id')
      .eq('agent_id', input.member_agent_id)
      .in('status', ['active', 'invited']);

    const ensembleIds = (memberEnsembles ?? []).map((m: { ensemble_id: string }) => m.ensemble_id);
    if (ensembleIds.length === 0) return { ensembles: [], count: 0 };
    query = query.in('id', ensembleIds);
  }

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  return {
    ensembles: (data as AgentEnsemble[]) ?? [],
    count: count ?? 0,
  };
}

// ── Dissolve Ensemble ───────────────────────────────────────────────────────

interface DissolveParams {
  requester_agent_id: string;
  ensemble_id: string;
  input: DissolveInput;
}

export async function dissolveEnsemble({ requester_agent_id, ensemble_id, input }: DissolveParams): Promise<
  Result<{ dissolution: EnsembleDissolution }>
> {
  const db = getServiceDb();
  if (!db) return err('Service unavailable', 503);

  const ensemble = await getEnsembleRecord(db, ensemble_id);
  if (!ensemble) return err('Ensemble not found', 404);
  if (ensemble.status === 'dissolved') return err('Ensemble is already dissolved', 400);

  // Only coordinator or creator can dissolve
  const member = await getMemberRecord(db, ensemble_id, requester_agent_id);
  const isCoordinator = member?.role === 'coordinator';
  const isCreator = ensemble.created_by === requester_agent_id;

  if (!isCoordinator && !isCreator) {
    return err('Only the coordinator or creator can dissolve an ensemble', 403);
  }

  const now = new Date().toISOString();

  // Close any open consensus rounds
  await db
    .from('a2a_ensemble_consensus_rounds')
    .update({ status: 'rejected', resolved_at: now })
    .eq('ensemble_id', ensemble_id)
    .eq('status', 'open');

  // Get final member roster
  const { data: members } = await db
    .from('a2a_ensemble_members')
    .select('agent_id, role, tasks_assigned')
    .eq('ensemble_id', ensemble_id)
    .eq('status', 'active');

  const finalMembers = (members ?? []).map((m: { agent_id: string; role: string; tasks_assigned: number }) => ({
    agent_id: m.agent_id,
    role: m.role as MemberRole,
    tasks_completed: m.tasks_assigned ?? 0,
  }));

  // Mark all active members as departed
  await db
    .from('a2a_ensemble_members')
    .update({
      status: 'departed' as MemberStatus,
      departed_at: now,
      departure_reason: `Ensemble dissolved: ${input.reason}`,
      updated_at: now,
    })
    .eq('ensemble_id', ensemble_id)
    .in('status', ['active', 'invited']);

  // Persist learnings to knowledge graph (if available)
  const knowledgeNodeIds: string[] = [];
  if (input.learnings?.length) {
    for (const learning of input.learnings) {
      const { data: node } = await db
        .from('a2a_knowledge_nodes')
        .insert({
          node_type: 'inference',
          content: learning,
          contributed_by: ensemble.agent_id,
          source_task_id: null,
          confidence: 0.8,
          properties: { ensemble_id, ensemble_name: ensemble.name },
          tags: [...ensemble.tags, 'ensemble-learning'],
        })
        .select('id')
        .single();

      if (node) knowledgeNodeIds.push(node.id);
    }
  }

  // Create dissolution record
  const dissolution: EnsembleDissolution = {
    ensemble_id,
    reason: input.reason,
    accomplishment_summary: input.accomplishment_summary ?? `Ensemble "${ensemble.name}" dissolved after completing ${ensemble.tasks_completed} tasks.`,
    learnings: input.learnings ?? [],
    knowledge_node_ids: knowledgeNodeIds,
    final_members: finalMembers,
    dissolved_at: now,
  };

  await db
    .from('a2a_ensemble_dissolutions')
    .insert(dissolution);

  // Update ensemble status
  await db
    .from('a2a_ensembles')
    .update({ status: 'dissolved' as EnsembleStatus, dissolved_at: now, updated_at: now })
    .eq('id', ensemble_id);

  // Deactivate the ensemble's agent registry entry
  await db
    .from('agent_registry')
    .update({ is_active: false })
    .eq('id', ensemble.agent_id);

  return { dissolution };
}

// ── Internal Helpers ────────────────────────────────────────────────────────

async function getEnsembleRecord(db: ReturnType<typeof getServiceDb>, id: string): Promise<AgentEnsemble | null> {
  if (!db) return null;
  const { data } = await db
    .from('a2a_ensembles')
    .select('*')
    .eq('id', id)
    .single();
  return (data as AgentEnsemble) ?? null;
}

async function getMemberRecord(
  db: ReturnType<typeof getServiceDb>,
  ensemble_id: string,
  agent_id: string,
): Promise<EnsembleMember | null> {
  if (!db) return null;
  const { data } = await db
    .from('a2a_ensemble_members')
    .select('*')
    .eq('ensemble_id', ensemble_id)
    .eq('agent_id', agent_id)
    .single();
  return (data as EnsembleMember) ?? null;
}

async function addMember(
  db: NonNullable<ReturnType<typeof getServiceDb>>,
  params: {
    ensemble_id: string;
    agent_id: string;
    role: MemberRole;
    capabilities: string[];
    now: string;
    status?: MemberStatus;
  },
): Promise<EnsembleMember | null> {
  const status = params.status ?? 'active';

  const { data, error } = await db
    .from('a2a_ensemble_members')
    .insert({
      ensemble_id: params.ensemble_id,
      agent_id: params.agent_id,
      role: params.role,
      status,
      contributed_capabilities: params.capabilities,
      reputation_at_join: 0.5,
      tasks_assigned: 0,
      votes_cast: 0,
      joined_at: status === 'active' ? params.now : null,
      updated_at: params.now,
      departed_at: null,
      departure_reason: null,
    })
    .select('*')
    .single();

  if (error || !data) return null;
  return data as EnsembleMember;
}

async function recruitByCapability(
  db: NonNullable<ReturnType<typeof getServiceDb>>,
  params: {
    ensemble_id: string;
    required_capabilities: string[];
    exclude_agents: string[];
    top_n: number;
    max_members: number;
    now: string;
  },
): Promise<EnsembleMember[]> {
  const recruited: EnsembleMember[] = [];
  const recruitedIds = new Set(params.exclude_agents);

  for (const cap of params.required_capabilities) {
    if (recruited.length >= params.max_members) break;

    // Find agents with this capability
    const { data: agents } = await db
      .from('agent_registry')
      .select('id, capabilities')
      .eq('is_active', true)
      .limit(params.top_n * 3); // Over-fetch to account for filtering

    if (!agents) continue;

    const matching = agents
      .filter((a: { id: string; capabilities: Array<{ id: string }> }) =>
        !recruitedIds.has(a.id) &&
        (a.capabilities ?? []).some((c: { id: string }) => c.id === cap || c.id.startsWith(cap + '.')),
      )
      .slice(0, params.top_n);

    for (const agent of matching) {
      if (recruited.length >= params.max_members) break;

      const member = await addMember(db, {
        ensemble_id: params.ensemble_id,
        agent_id: agent.id,
        role: 'specialist',
        capabilities: (agent.capabilities ?? []).map((c: { id: string }) => c.id),
        now: params.now,
        status: 'invited',
      });

      if (member) {
        recruited.push(member);
        recruitedIds.add(agent.id);
      }
    }
  }

  return recruited;
}

async function recomputeCapabilities(
  db: NonNullable<ReturnType<typeof getServiceDb>>,
  ensemble_id: string,
): Promise<string[]> {
  const { data: members } = await db
    .from('a2a_ensemble_members')
    .select('contributed_capabilities')
    .eq('ensemble_id', ensemble_id)
    .in('status', ['active', 'invited']);

  const capSet = new Set<string>();
  for (const m of members ?? []) {
    for (const c of (m as EnsembleMember).contributed_capabilities ?? []) {
      capSet.add(c);
    }
  }

  const capabilities = Array.from(capSet).sort();

  await db
    .from('a2a_ensembles')
    .update({ capabilities, updated_at: new Date().toISOString() })
    .eq('id', ensemble_id);

  return capabilities;
}

async function countActiveMembers(
  db: NonNullable<ReturnType<typeof getServiceDb>>,
  ensemble_id: string,
): Promise<number> {
  const { count } = await db
    .from('a2a_ensemble_members')
    .select('*', { count: 'exact', head: true })
    .eq('ensemble_id', ensemble_id)
    .eq('status', 'active');
  return count ?? 0;
}

async function countVotingMembers(
  db: NonNullable<ReturnType<typeof getServiceDb>>,
  ensemble_id: string,
): Promise<number> {
  const { count } = await db
    .from('a2a_ensemble_members')
    .select('*', { count: 'exact', head: true })
    .eq('ensemble_id', ensemble_id)
    .eq('status', 'active')
    .neq('role', 'observer');
  return count ?? 0;
}

function computeRequiredVotes(policy: ConsensusPolicy, totalVoters: number): number {
  switch (policy) {
    case 'majority':
      return Math.floor(totalVoters / 2) + 1;
    case 'supermajority':
      return Math.ceil(totalVoters * 2 / 3);
    case 'unanimous':
      return totalVoters;
    case 'weighted_reputation':
      return Math.floor(totalVoters / 2) + 1;
    case 'coordinator_decides':
      return 1;
    case 'validator_gate':
      // All validators must vote; computed dynamically
      return 1;
    default:
      return Math.floor(totalVoters / 2) + 1;
  }
}

async function computeConsensusTally(
  db: NonNullable<ReturnType<typeof getServiceDb>>,
  round_id: string,
  ensemble_id: string,
  round: ConsensusRound,
): Promise<ConsensusTally> {
  const { data: votes } = await db
    .from('a2a_ensemble_consensus_votes')
    .select('agent_id, decision, confidence')
    .eq('round_id', round_id);

  const totalEligible = await countVotingMembers(db, ensemble_id);
  const voteList = (votes ?? []) as Array<{ agent_id: string; decision: string; confidence: number }>;

  let approvals = 0;
  let rejections = 0;
  let revisions = 0;
  let weightedApproval = 0;

  for (const v of voteList) {
    const weight = v.confidence ?? 0.8;
    if (v.decision === 'approve') {
      approvals++;
      weightedApproval += weight;
    } else if (v.decision === 'reject') {
      rejections++;
    } else if (v.decision === 'revise') {
      revisions++;
    }
  }

  // Determine if threshold is met
  let thresholdMet = false;
  let decision: ConsensusTally['decision'] = null;

  const policy = round.policy as ConsensusPolicy;

  switch (policy) {
    case 'majority':
      if (approvals > totalEligible / 2) { thresholdMet = true; decision = 'approved'; }
      else if (rejections > totalEligible / 2) { thresholdMet = true; decision = 'rejected'; }
      else if (revisions > totalEligible / 2) { thresholdMet = true; decision = 'revision_needed'; }
      break;

    case 'supermajority': {
      const threshold = totalEligible * 2 / 3;
      if (approvals >= threshold) { thresholdMet = true; decision = 'approved'; }
      else if (rejections >= threshold) { thresholdMet = true; decision = 'rejected'; }
      break;
    }

    case 'unanimous':
      if (approvals === totalEligible) { thresholdMet = true; decision = 'approved'; }
      else if (rejections > 0 && voteList.length === totalEligible) { thresholdMet = true; decision = 'rejected'; }
      break;

    case 'weighted_reputation':
      // Weighted approval > 50% of max possible weight
      if (weightedApproval > totalEligible * 0.5) { thresholdMet = true; decision = 'approved'; }
      break;

    case 'coordinator_decides':
      // Any single vote from coordinator resolves
      if (voteList.length > 0) {
        const coordVote = voteList[0]; // Coordinator's vote
        thresholdMet = true;
        decision = coordVote.decision === 'approve' ? 'approved'
          : coordVote.decision === 'reject' ? 'rejected'
          : 'revision_needed';
      }
      break;

    case 'validator_gate': {
      // All validators must approve
      const { data: validators } = await db
        .from('a2a_ensemble_members')
        .select('agent_id')
        .eq('ensemble_id', ensemble_id)
        .eq('status', 'active')
        .eq('role', 'validator');

      const validatorIds = new Set((validators ?? []).map((v: { agent_id: string }) => v.agent_id));
      const validatorVotes = voteList.filter((v) => validatorIds.has(v.agent_id));

      if (validatorVotes.length === validatorIds.size) {
        const allApproved = validatorVotes.every((v) => v.decision === 'approve');
        thresholdMet = true;
        decision = allApproved ? 'approved' : 'rejected';
      }
      break;
    }
  }

  return {
    round_id,
    total_eligible: totalEligible,
    total_votes: voteList.length,
    approvals,
    rejections,
    revisions,
    weighted_approval_score: Math.round(weightedApproval * 1000) / 1000,
    threshold_met: thresholdMet,
    decision,
  };
}

// ── Exported for testing ────────────────────────────────────────────────────

export { isErr, computeRequiredVotes };
