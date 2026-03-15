/**
 * A2A Collaborative Consensus Layer — Types
 *
 * Transforms the knowledge graph from a single-agent-write, multi-agent-read
 * system into a truly collaborative reasoning surface. Agents can:
 *
 *   - Endorse entries they agree with (building community confidence)
 *   - Raise formal conflicts when entries contradict
 *   - Vote to resolve conflicts via quorum-based consensus
 *   - See aggregated community trust signals per entry
 *
 * This is the missing piece that turns isolated knowledge contributions into
 * collective intelligence — critical for 2028 agent teams that need shared
 * understanding, not just shared data.
 */

// ── Endorsements ─────────────────────────────────────────────────────────────

/** An agent's explicit endorsement (or challenge) of a knowledge entry. */
export interface KnowledgeEndorsement {
  /** Composite key: (entry_id, agent_id). */
  entry_id: string;
  agent_id: string;
  /** Agent's independent confidence assessment (0.0 = strong disagree, 1.0 = strong agree). */
  confidence: number;
  /** Optional reasoning for the endorsement. */
  rationale: string | null;
  /** ISO-8601. */
  created_at: string;
  updated_at: string;
}

/** Aggregated community confidence for an entry. Materialized for fast reads. */
export interface CommunityConfidence {
  entry_id: string;
  /** Number of endorsing agents. */
  endorsement_count: number;
  /** Weighted average confidence across all endorsers. */
  avg_confidence: number;
  /** Standard deviation — high means disagreement. */
  confidence_stddev: number;
  /** Bayesian-adjusted score accounting for sample size. */
  bayesian_score: number;
  /** Consensus strength: 'strong' | 'moderate' | 'weak' | 'contested'. */
  consensus_level: ConsensusLevel;
  last_updated: string;
}

export type ConsensusLevel = 'strong' | 'moderate' | 'weak' | 'contested';

// ── Conflict Resolution ──────────────────────────────────────────────────────

export type ConflictStatus = 'open' | 'resolved' | 'escalated' | 'expired';

export type ConflictResolution =
  | 'entry_a_wins'     // First entry prevails
  | 'entry_b_wins'     // Second entry prevails
  | 'both_valid'       // Both are correct (different contexts)
  | 'both_retracted'   // Neither is valid
  | 'merged';          // A new merged entry was created

/** A formal conflict between two knowledge entries, requiring consensus. */
export interface KnowledgeConflict {
  id: string;
  /** The two entries in conflict. */
  entry_a_id: string;
  entry_b_id: string;
  /** Why these entries conflict. */
  reason: string;
  status: ConflictStatus;
  /** Minimum votes required to resolve. */
  quorum: number;
  resolution: ConflictResolution | null;
  /** If resolution is 'merged', the ID of the new synthesized entry. */
  merged_entry_id: string | null;
  /** Agent that raised the conflict. */
  raised_by: string;
  resolved_at: string | null;
  /** Auto-expire if not resolved within this many seconds. */
  ttl_seconds: number;
  expires_at: string;
  created_at: string;
}

/** A single agent's vote on a conflict. */
export interface ConflictVote {
  conflict_id: string;
  agent_id: string;
  vote: ConflictResolution;
  /** Why the agent voted this way. */
  rationale: string;
  /** Agent's confidence in their vote (0.0 - 1.0). */
  confidence: number;
  created_at: string;
}

/** Tally of votes for a conflict. */
export interface ConflictTally {
  conflict_id: string;
  total_votes: number;
  votes_by_resolution: Record<ConflictResolution, number>;
  quorum_reached: boolean;
  /** The leading resolution (most votes). Null if tied. */
  leading_resolution: ConflictResolution | null;
  /** Margin between top two options. */
  margin: number;
}

// ── API Request / Response ───────────────────────────────────────────────────

export interface EndorseRequest {
  confidence: number;
  rationale?: string;
}

export interface EndorseResponse {
  entry_id: string;
  agent_id: string;
  community_confidence: CommunityConfidence;
}

export interface RevokeEndorsementResponse {
  entry_id: string;
  agent_id: string;
  community_confidence: CommunityConfidence;
}

export interface ListEndorsementsResponse {
  endorsements: KnowledgeEndorsement[];
  community_confidence: CommunityConfidence;
  count: number;
}

export interface RaiseConflictRequest {
  entry_a_id: string;
  entry_b_id: string;
  reason: string;
  quorum?: number;
  ttl_seconds?: number;
}

export interface RaiseConflictResponse {
  conflict_id: string;
  status: ConflictStatus;
  expires_at: string;
}

export interface VoteConflictRequest {
  vote: ConflictResolution;
  rationale: string;
  confidence?: number;
}

export interface VoteConflictResponse {
  conflict_id: string;
  tally: ConflictTally;
  /** If quorum was reached by this vote, the resolution is applied. */
  resolved: boolean;
  resolution: ConflictResolution | null;
}

export interface GetConflictResponse {
  conflict: KnowledgeConflict;
  tally: ConflictTally;
  votes: ConflictVote[];
}

export interface ListConflictsResponse {
  conflicts: KnowledgeConflict[];
  count: number;
}
