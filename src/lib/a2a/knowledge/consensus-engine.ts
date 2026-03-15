/**
 * A2A Collaborative Consensus Engine
 *
 * Transforms the knowledge graph from isolated contributions into collective
 * intelligence via:
 *
 * 1. **Endorsements** — agents rate entries with independent confidence scores.
 *    Community confidence is materialized as a Bayesian-adjusted aggregate.
 *
 * 2. **Conflict Resolution** — agents raise formal disputes between contradicting
 *    entries. Other agents vote on the resolution. Quorum triggers automatic
 *    resolution (supersede, merge, retract).
 *
 * 3. **Community Confidence** — a materialized aggregate that blends individual
 *    endorsements with Bayesian smoothing (accounts for sample size) and
 *    standard deviation (surfaces disagreement).
 */

import { getServiceDb } from '../auth';
import type {
  KnowledgeEndorsement,
  CommunityConfidence,
  ConsensusLevel,
  KnowledgeConflict,
  ConflictVote,
  ConflictTally,
  ConflictResolution,
  ConflictStatus,
} from './consensus-types';
import type { EndorseInput, RaiseConflictInput, VoteConflictInput, ListConflictsInput } from './consensus-validation';

// ── Constants ────────────────────────────────────────────────────────────────

/** Prior confidence for Bayesian smoothing (global average assumption). */
const BAYESIAN_PRIOR = 0.5;
/** Minimum endorsements before Bayesian score converges to sample mean. */
const BAYESIAN_WEIGHT = 3;

// ── Endorsements ─────────────────────────────────────────────────────────────

interface EndorseParams {
  agent_id: string;
  entry_id: string;
  input: EndorseInput;
}

export async function endorseEntry({ agent_id, entry_id, input }: EndorseParams): Promise<
  | { endorsement: KnowledgeEndorsement; community_confidence: CommunityConfidence }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Verify entry exists
  const { data: entry } = await db
    .from('a2a_knowledge_nodes')
    .select('id')
    .eq('id', entry_id)
    .single();

  if (!entry) return { error: 'Knowledge entry not found', status_code: 404 };

  const now = new Date().toISOString();

  // Upsert endorsement (one per agent per entry)
  const { data: existing } = await db
    .from('a2a_knowledge_endorsements')
    .select('entry_id')
    .eq('entry_id', entry_id)
    .eq('agent_id', agent_id)
    .single();

  let endorsement: KnowledgeEndorsement;

  if (existing) {
    const { data, error } = await db
      .from('a2a_knowledge_endorsements')
      .update({
        confidence: input.confidence,
        rationale: input.rationale ?? null,
        updated_at: now,
      })
      .eq('entry_id', entry_id)
      .eq('agent_id', agent_id)
      .select('*')
      .single();

    if (error || !data) return { error: 'Failed to update endorsement', status_code: 500 };
    endorsement = data as KnowledgeEndorsement;
  } else {
    const { data, error } = await db
      .from('a2a_knowledge_endorsements')
      .insert({
        entry_id,
        agent_id,
        confidence: input.confidence,
        rationale: input.rationale ?? null,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error || !data) return { error: 'Failed to create endorsement', status_code: 500 };
    endorsement = data as KnowledgeEndorsement;
  }

  // Recompute community confidence
  const community_confidence = await recomputeCommunityConfidence(entry_id);

  return { endorsement, community_confidence };
}

export async function revokeEndorsement(agent_id: string, entry_id: string): Promise<
  | { community_confidence: CommunityConfidence }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { error } = await db
    .from('a2a_knowledge_endorsements')
    .delete()
    .eq('entry_id', entry_id)
    .eq('agent_id', agent_id);

  if (error) return { error: 'Failed to revoke endorsement', status_code: 500 };

  const community_confidence = await recomputeCommunityConfidence(entry_id);
  return { community_confidence };
}

export async function listEndorsements(entry_id: string): Promise<{
  endorsements: KnowledgeEndorsement[];
  community_confidence: CommunityConfidence;
  count: number;
}> {
  const db = getServiceDb();
  if (!db) return { endorsements: [], community_confidence: emptyCommunityConfidence(entry_id), count: 0 };

  const { data, count } = await db
    .from('a2a_knowledge_endorsements')
    .select('*', { count: 'exact' })
    .eq('entry_id', entry_id)
    .order('created_at', { ascending: false });

  const endorsements = (data as KnowledgeEndorsement[]) ?? [];

  // Fetch or compute community confidence
  const community_confidence = await getCommunityConfidence(entry_id);

  return { endorsements, community_confidence, count: count ?? endorsements.length };
}

// ── Community Confidence ─────────────────────────────────────────────────────

/**
 * Recompute and persist the materialized community confidence for an entry.
 *
 * Uses Bayesian averaging: score = (W * prior + N * mean) / (W + N)
 * where W = BAYESIAN_WEIGHT, prior = BAYESIAN_PRIOR, N = endorsement count.
 *
 * This prevents entries with a single 1.0 endorsement from outranking entries
 * with many endorsements averaging 0.9.
 */
async function recomputeCommunityConfidence(entry_id: string): Promise<CommunityConfidence> {
  const db = getServiceDb();
  if (!db) return emptyCommunityConfidence(entry_id);

  const { data: endorsements } = await db
    .from('a2a_knowledge_endorsements')
    .select('confidence')
    .eq('entry_id', entry_id);

  const scores = (endorsements ?? []).map((e: { confidence: number }) => e.confidence);
  const n = scores.length;

  if (n === 0) {
    const empty = emptyCommunityConfidence(entry_id);
    await persistCommunityConfidence(entry_id, empty);
    return empty;
  }

  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  const bayesian = (BAYESIAN_WEIGHT * BAYESIAN_PRIOR + n * mean) / (BAYESIAN_WEIGHT + n);

  const consensus_level = deriveConsensusLevel(n, stddev, mean);

  const cc: CommunityConfidence = {
    entry_id,
    endorsement_count: n,
    avg_confidence: round4(mean),
    confidence_stddev: round4(stddev),
    bayesian_score: round4(bayesian),
    consensus_level,
    last_updated: new Date().toISOString(),
  };

  await persistCommunityConfidence(entry_id, cc);

  // Also update the node's community confidence field for routing/search integration
  await db
    .from('a2a_knowledge_nodes')
    .update({
      access_count: n, // repurpose as endorsement_count for now
      updated_at: cc.last_updated,
    })
    .eq('id', entry_id);

  return cc;
}

async function persistCommunityConfidence(entry_id: string, cc: CommunityConfidence): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const { data: existing } = await db
    .from('a2a_knowledge_community_confidence')
    .select('entry_id')
    .eq('entry_id', entry_id)
    .single();

  if (existing) {
    await db
      .from('a2a_knowledge_community_confidence')
      .update({
        endorsement_count: cc.endorsement_count,
        avg_confidence: cc.avg_confidence,
        confidence_stddev: cc.confidence_stddev,
        bayesian_score: cc.bayesian_score,
        consensus_level: cc.consensus_level,
        last_updated: cc.last_updated,
      })
      .eq('entry_id', entry_id);
  } else {
    await db
      .from('a2a_knowledge_community_confidence')
      .insert({
        entry_id,
        endorsement_count: cc.endorsement_count,
        avg_confidence: cc.avg_confidence,
        confidence_stddev: cc.confidence_stddev,
        bayesian_score: cc.bayesian_score,
        consensus_level: cc.consensus_level,
        last_updated: cc.last_updated,
      });
  }
}

async function getCommunityConfidence(entry_id: string): Promise<CommunityConfidence> {
  const db = getServiceDb();
  if (!db) return emptyCommunityConfidence(entry_id);

  const { data } = await db
    .from('a2a_knowledge_community_confidence')
    .select('*')
    .eq('entry_id', entry_id)
    .single();

  if (data) return data as CommunityConfidence;

  // Compute on the fly if not materialized yet
  return recomputeCommunityConfidence(entry_id);
}

function deriveConsensusLevel(count: number, stddev: number, mean: number): ConsensusLevel {
  if (count < 2) return 'weak';
  if (stddev > 0.3) return 'contested';
  if (count >= 3 && stddev <= 0.15 && mean >= 0.7) return 'strong';
  if (count >= 2 && stddev <= 0.25) return 'moderate';
  return 'weak';
}

function emptyCommunityConfidence(entry_id: string): CommunityConfidence {
  return {
    entry_id,
    endorsement_count: 0,
    avg_confidence: 0,
    confidence_stddev: 0,
    bayesian_score: round4(BAYESIAN_PRIOR),
    consensus_level: 'weak',
    last_updated: new Date().toISOString(),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Conflict Resolution ──────────────────────────────────────────────────────

interface RaiseConflictParams {
  agent_id: string;
  input: RaiseConflictInput;
}

export async function raiseConflict({ agent_id, input }: RaiseConflictParams): Promise<
  | { conflict_id: string; status: ConflictStatus; expires_at: string }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  if (input.entry_a_id === input.entry_b_id) {
    return { error: 'Cannot raise a conflict between an entry and itself', status_code: 400 };
  }

  // Verify both entries exist
  const { data: entries } = await db
    .from('a2a_knowledge_nodes')
    .select('id')
    .in('id', [input.entry_a_id, input.entry_b_id]);

  if (!entries || entries.length < 2) {
    return { error: 'One or both entries not found', status_code: 404 };
  }

  // Check for existing open conflict between these entries
  const { data: existing } = await db
    .from('a2a_knowledge_conflicts')
    .select('id')
    .eq('status', 'open')
    .or(
      `and(entry_a_id.eq.${input.entry_a_id},entry_b_id.eq.${input.entry_b_id}),` +
      `and(entry_a_id.eq.${input.entry_b_id},entry_b_id.eq.${input.entry_a_id})`
    )
    .single();

  if (existing) {
    return { error: 'An open conflict already exists between these entries', status_code: 409 };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttl_seconds * 1000);

  const { data, error } = await db
    .from('a2a_knowledge_conflicts')
    .insert({
      entry_a_id: input.entry_a_id,
      entry_b_id: input.entry_b_id,
      reason: input.reason,
      status: 'open' as ConflictStatus,
      quorum: input.quorum,
      resolution: null,
      merged_entry_id: null,
      raised_by: agent_id,
      resolved_at: null,
      ttl_seconds: input.ttl_seconds,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    })
    .select('id, status, expires_at')
    .single();

  if (error || !data) return { error: 'Failed to raise conflict', status_code: 500 };

  return {
    conflict_id: data.id,
    status: data.status as ConflictStatus,
    expires_at: data.expires_at,
  };
}

interface VoteConflictParams {
  agent_id: string;
  conflict_id: string;
  input: VoteConflictInput;
}

export async function voteOnConflict({ agent_id, conflict_id, input }: VoteConflictParams): Promise<
  | { conflict_id: string; tally: ConflictTally; resolved: boolean; resolution: ConflictResolution | null }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Fetch conflict
  const { data: conflict } = await db
    .from('a2a_knowledge_conflicts')
    .select('*')
    .eq('id', conflict_id)
    .single();

  if (!conflict) return { error: 'Conflict not found', status_code: 404 };
  if (conflict.status !== 'open') {
    return { error: `Conflict is ${conflict.status}, not open for voting`, status_code: 400 };
  }

  // Check expiry
  if (new Date(conflict.expires_at) < new Date()) {
    await db
      .from('a2a_knowledge_conflicts')
      .update({ status: 'expired' })
      .eq('id', conflict_id);
    return { error: 'Conflict has expired', status_code: 410 };
  }

  // Check if agent already voted
  const { data: existingVote } = await db
    .from('a2a_knowledge_conflict_votes')
    .select('conflict_id')
    .eq('conflict_id', conflict_id)
    .eq('agent_id', agent_id)
    .single();

  if (existingVote) {
    return { error: 'Agent has already voted on this conflict', status_code: 409 };
  }

  // Record vote
  const { error: voteError } = await db
    .from('a2a_knowledge_conflict_votes')
    .insert({
      conflict_id,
      agent_id,
      vote: input.vote,
      rationale: input.rationale,
      confidence: input.confidence,
      created_at: new Date().toISOString(),
    });

  if (voteError) return { error: 'Failed to record vote', status_code: 500 };

  // Compute tally
  const tally = await computeTally(conflict_id, conflict.quorum);

  // Check if quorum reached and resolve
  let resolved = false;
  let resolution: ConflictResolution | null = null;

  if (tally.quorum_reached && tally.leading_resolution) {
    resolved = true;
    resolution = tally.leading_resolution;

    await db
      .from('a2a_knowledge_conflicts')
      .update({
        status: 'resolved' as ConflictStatus,
        resolution,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', conflict_id);

    // Apply the resolution to the knowledge graph
    await applyResolution(conflict as KnowledgeConflict, resolution);
  }

  return { conflict_id, tally, resolved, resolution };
}

export async function getConflict(conflict_id: string): Promise<
  | { conflict: KnowledgeConflict; tally: ConflictTally; votes: ConflictVote[] }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data: conflict } = await db
    .from('a2a_knowledge_conflicts')
    .select('*')
    .eq('id', conflict_id)
    .single();

  if (!conflict) return { error: 'Conflict not found', status_code: 404 };

  const { data: votes } = await db
    .from('a2a_knowledge_conflict_votes')
    .select('*')
    .eq('conflict_id', conflict_id)
    .order('created_at', { ascending: true });

  const tally = await computeTally(conflict_id, conflict.quorum);

  return {
    conflict: conflict as KnowledgeConflict,
    tally,
    votes: (votes as ConflictVote[]) ?? [],
  };
}

export async function listConflicts(input: ListConflictsInput): Promise<{
  conflicts: KnowledgeConflict[];
  count: number;
}> {
  const db = getServiceDb();
  if (!db) return { conflicts: [], count: 0 };

  let query = db.from('a2a_knowledge_conflicts').select('*', { count: 'exact' });

  if (input.status) query = query.eq('status', input.status);
  if (input.raised_by) query = query.eq('raised_by', input.raised_by);
  if (input.entry_id) {
    query = query.or(`entry_a_id.eq.${input.entry_id},entry_b_id.eq.${input.entry_id}`);
  }

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  return {
    conflicts: (data as KnowledgeConflict[]) ?? [],
    count: count ?? 0,
  };
}

// ── Tally Computation ────────────────────────────────────────────────────────

async function computeTally(conflict_id: string, quorum: number): Promise<ConflictTally> {
  const db = getServiceDb();
  if (!db) return emptyTally(conflict_id);

  const { data: votes } = await db
    .from('a2a_knowledge_conflict_votes')
    .select('vote, confidence')
    .eq('conflict_id', conflict_id);

  if (!votes || votes.length === 0) return emptyTally(conflict_id);

  const resolutions: ConflictResolution[] = [
    'entry_a_wins', 'entry_b_wins', 'both_valid', 'both_retracted', 'merged',
  ];

  // Weight votes by confidence
  const weightedCounts: Record<string, number> = {};
  const rawCounts: Record<string, number> = {};

  for (const r of resolutions) {
    weightedCounts[r] = 0;
    rawCounts[r] = 0;
  }

  for (const v of votes as Array<{ vote: string; confidence: number }>) {
    rawCounts[v.vote] = (rawCounts[v.vote] ?? 0) + 1;
    weightedCounts[v.vote] = (weightedCounts[v.vote] ?? 0) + (v.confidence ?? 0.8);
  }

  // Sort by weighted count descending
  const sorted = resolutions
    .map((r) => ({ resolution: r, weighted: weightedCounts[r], count: rawCounts[r] }))
    .sort((a, b) => b.weighted - a.weighted);

  const leading = sorted[0].count > 0 ? sorted[0].resolution : null;
  const margin = sorted.length >= 2 ? sorted[0].weighted - sorted[1].weighted : sorted[0].weighted;

  return {
    conflict_id,
    total_votes: votes.length,
    votes_by_resolution: rawCounts as Record<ConflictResolution, number>,
    quorum_reached: votes.length >= quorum,
    leading_resolution: leading,
    margin: round4(margin),
  };
}

function emptyTally(conflict_id: string): ConflictTally {
  return {
    conflict_id,
    total_votes: 0,
    votes_by_resolution: {
      entry_a_wins: 0,
      entry_b_wins: 0,
      both_valid: 0,
      both_retracted: 0,
      merged: 0,
    },
    quorum_reached: false,
    leading_resolution: null,
    margin: 0,
  };
}

// ── Resolution Application ───────────────────────────────────────────────────

/**
 * Apply a conflict resolution to the knowledge graph.
 *
 * - entry_a_wins: Mark entry_b as superseded
 * - entry_b_wins: Mark entry_a as superseded
 * - both_valid: Add 'related_to' edge; mark as "both entries coexist"
 * - both_retracted: Delete both entries
 * - merged: (requires external merge; this just marks both as superseded)
 */
async function applyResolution(conflict: KnowledgeConflict, resolution: ConflictResolution): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const now = new Date().toISOString();

  switch (resolution) {
    case 'entry_a_wins':
      // Supersede entry B; create edge
      await db
        .from('a2a_knowledge_nodes')
        .update({ updated_at: now })
        .eq('id', conflict.entry_b_id);
      await db
        .from('a2a_knowledge_edges')
        .insert({
          source_node_id: conflict.entry_a_id,
          target_node_id: conflict.entry_b_id,
          relationship: 'supersedes',
          weight: 1.0,
          contributed_by: conflict.raised_by,
          properties: { resolved_from_conflict: conflict.id },
        });
      break;

    case 'entry_b_wins':
      await db
        .from('a2a_knowledge_nodes')
        .update({ updated_at: now })
        .eq('id', conflict.entry_a_id);
      await db
        .from('a2a_knowledge_edges')
        .insert({
          source_node_id: conflict.entry_b_id,
          target_node_id: conflict.entry_a_id,
          relationship: 'supersedes',
          weight: 1.0,
          contributed_by: conflict.raised_by,
          properties: { resolved_from_conflict: conflict.id },
        });
      break;

    case 'both_valid':
      // Both coexist — link them
      await db
        .from('a2a_knowledge_edges')
        .insert({
          source_node_id: conflict.entry_a_id,
          target_node_id: conflict.entry_b_id,
          relationship: 'related_to',
          weight: 0.8,
          contributed_by: conflict.raised_by,
          properties: { resolved_from_conflict: conflict.id, note: 'both_valid — coexisting truths' },
        });
      break;

    case 'both_retracted':
      // Reduce confidence of both entries to near-zero (soft delete)
      await db
        .from('a2a_knowledge_nodes')
        .update({ confidence: 0.01, updated_at: now })
        .in('id', [conflict.entry_a_id, conflict.entry_b_id]);
      break;

    case 'merged':
      // Merged resolution requires a separate merge step.
      // Mark both entries as updated to signal they're part of a merge.
      await db
        .from('a2a_knowledge_nodes')
        .update({ updated_at: now })
        .in('id', [conflict.entry_a_id, conflict.entry_b_id]);
      break;
  }
}

// ── Expire Stale Conflicts ───────────────────────────────────────────────────

/**
 * Expire conflicts that have passed their TTL without reaching quorum.
 * Should be called periodically (e.g., via cron or cleanup job).
 */
export async function expireStaleConflicts(): Promise<{ expired_count: number }> {
  const db = getServiceDb();
  if (!db) return { expired_count: 0 };

  const { data } = await db
    .from('a2a_knowledge_conflicts')
    .update({ status: 'expired' as ConflictStatus })
    .eq('status', 'open')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  return { expired_count: data?.length ?? 0 };
}
