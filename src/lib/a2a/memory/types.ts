// Agent Memory & Contextual Continuity Protocol — Types
// Loop 16: Persistent episodic memory for agents
//
// In 2028, stateless agents are dead agents. Without episodic memory,
// agents can't learn from past interactions, build relationships, carry
// context across sessions, or avoid repeating mistakes. The knowledge
// graph captures *shared collective facts*, but agents also need
// *private experiential memory* — what happened to *them*, what they
// learned, what worked, what failed, and what context they were in.
//
// This module provides:
//   - Episodic memory: autobiographical records of agent experiences
//   - Memory banks: namespaced collections with retention policies
//   - Memory recall: semantic + recency + importance scoring
//   - Memory consolidation: compress and distill raw episodes into wisdom
//   - Memory sharing: controlled exchange of memories between agents
//   - Cross-session continuity: resume context seamlessly

// ──────────────────────────────────────────────
// Memory Banks
// ──────────────────────────────────────────────

export type MemoryBankId = string;

/** Retention policy determines when memories are consolidated or purged. */
export interface RetentionPolicy {
  /** Max number of raw episodes before consolidation triggers. */
  maxEpisodes: number;
  /** Max age in hours before an episode is eligible for consolidation. */
  consolidateAfterHours: number;
  /** Max age in hours before an unconsolidated episode is purged. */
  purgeAfterHours: number;
  /** Whether to auto-consolidate when maxEpisodes is reached. */
  autoConsolidate: boolean;
}

/** A memory bank is a namespaced container for related memories. */
export interface MemoryBank {
  id: MemoryBankId;
  agentId: string;
  /** Human-readable name (e.g., "task-execution", "user-interactions", "error-recovery"). */
  name: string;
  description: string;
  retention: RetentionPolicy;
  /** Tags for organizing banks by domain. */
  tags: string[];
  episodeCount: number;
  consolidationCount: number;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────
// Episodic Memory
// ──────────────────────────────────────────────

export type EpisodeId = string;

/** The type of experience recorded. */
export type EpisodeType =
  | 'task_execution'    // Completed a task — captures input, output, quality
  | 'interaction'       // Interacted with another agent or human
  | 'observation'       // Observed something noteworthy in the environment
  | 'decision'          // Made a significant decision with rationale
  | 'error_recovery'    // Encountered and recovered from an error
  | 'learning'          // Learned something new (skill, pattern, fact)
  | 'feedback'          // Received feedback (positive or corrective)
  | 'collaboration';    // Participated in a multi-agent effort

/** Emotional valence — how the agent "felt" about the experience. */
export type Valence = 'positive' | 'neutral' | 'negative' | 'mixed';

/** An episodic memory — a single autobiographical record. */
export interface Episode {
  id: EpisodeId;
  bankId: MemoryBankId;
  agentId: string;
  type: EpisodeType;
  /** One-line summary of what happened. */
  summary: string;
  /** Detailed narrative of the experience. */
  content: string;
  /** Structured context at time of recording. */
  context: EpisodeContext;
  /** Importance score (0.0–1.0). Higher = more likely to be recalled. */
  importance: number;
  /** Emotional valence of the experience. */
  valence: Valence;
  /** Semantic tags for retrieval. */
  tags: string[];
  /** IDs of related episodes (forms a narrative chain). */
  relatedEpisodeIds: string[];
  /** If this episode was produced by consolidation, the source episode IDs. */
  consolidatedFrom: string[];
  /** Number of times this memory has been recalled. Reinforces importance. */
  recallCount: number;
  /** Last time this memory was recalled. */
  lastRecalledAt: string | null;
  /** Decay-adjusted importance at last computation. */
  effectiveImportance: number;
  createdAt: string;
}

/** Structured context captured alongside an episode. */
export interface EpisodeContext {
  /** Task ID that produced this episode (if any). */
  taskId?: string;
  /** Agent(s) involved in this episode. */
  involvedAgentIds: string[];
  /** Capability being exercised. */
  capability?: string;
  /** Arbitrary key-value context (input params, environment, etc.). */
  metadata: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Memory Recall
// ──────────────────────────────────────────────

/** How to score and rank memories during recall. */
export interface RecallQuery {
  agentId: string;
  /** Free-text semantic query. Matched against summary + content + tags. */
  query?: string;
  /** Filter by episode type. */
  types?: EpisodeType[];
  /** Filter by bank. */
  bankId?: MemoryBankId;
  /** Filter by tags (OR semantics). */
  tags?: string[];
  /** Filter by involved agent IDs. */
  involvedAgentIds?: string[];
  /** Only episodes after this timestamp. */
  after?: string;
  /** Only episodes before this timestamp. */
  before?: string;
  /** Minimum importance threshold. */
  minImportance?: number;
  /** Maximum results. */
  limit: number;
  /** Scoring weights for ranking (default: balanced). */
  weights?: RecallWeights;
}

/** Weights for the recall scoring function. Must sum to ~1.0. */
export interface RecallWeights {
  /** Weight for semantic relevance (keyword match). Default 0.4. */
  relevance: number;
  /** Weight for recency (newer = higher). Default 0.25. */
  recency: number;
  /** Weight for importance score. Default 0.25. */
  importance: number;
  /** Weight for recall frequency (more recalled = higher). Default 0.1. */
  frequency: number;
}

/** A recalled memory with its composite score. */
export interface RecalledEpisode {
  episode: Episode;
  score: number;
  scoreBreakdown: {
    relevance: number;
    recency: number;
    importance: number;
    frequency: number;
  };
}

// ──────────────────────────────────────────────
// Memory Consolidation
// ──────────────────────────────────────────────

export type ConsolidationId = string;

/** Status of a consolidation operation. */
export type ConsolidationStatus = 'pending' | 'completed' | 'failed';

/** A consolidation merges multiple raw episodes into a distilled memory. */
export interface Consolidation {
  id: ConsolidationId;
  agentId: string;
  bankId: MemoryBankId;
  /** IDs of source episodes that were consolidated. */
  sourceEpisodeIds: string[];
  /** The resulting consolidated episode ID. */
  resultEpisodeId: string | null;
  /** Strategy used for consolidation. */
  strategy: ConsolidationStrategy;
  status: ConsolidationStatus;
  /** Human-readable summary of what was consolidated. */
  summary: string;
  createdAt: string;
  completedAt: string | null;
}

/** How to consolidate a set of episodes. */
export type ConsolidationStrategy =
  | 'summarize'       // Compress into a single summary episode
  | 'extract_pattern' // Find recurring patterns across episodes
  | 'distill_lesson'  // Extract actionable lessons learned
  | 'timeline'        // Merge into a chronological narrative
  | 'deduplicate';    // Remove redundant episodes, keep best

// ──────────────────────────────────────────────
// Memory Sharing
// ──────────────────────────────────────────────

export type ShareId = string;

/** Visibility level for a shared memory. */
export type ShareVisibility =
  | 'private'          // Only the owning agent
  | 'specific_agents'  // Explicitly named agents
  | 'organization'     // All agents in the same org
  | 'public';          // Any agent on the platform

/** A memory share grant — who can see what. */
export interface MemoryShare {
  id: ShareId;
  /** Agent sharing the memory. */
  fromAgentId: string;
  /** Episode being shared. */
  episodeId: EpisodeId;
  /** Who can access. */
  visibility: ShareVisibility;
  /** Specific agent IDs (when visibility = 'specific_agents'). */
  targetAgentIds: string[];
  /** Optional redactions: fields to strip from shared memory. */
  redactFields: string[];
  /** Expiration (ISO-8601). Null = permanent. */
  expiresAt: string | null;
  /** Whether recipients can re-share. */
  allowReshare: boolean;
  createdAt: string;
}

// ──────────────────────────────────────────────
// Session Continuity
// ──────────────────────────────────────────────

export type ContinuitySessionId = string;

/** A continuity session captures cross-interaction state. */
export interface ContinuitySession {
  id: ContinuitySessionId;
  agentId: string;
  /** Human-readable name for the session (e.g., "debugging auth issue with agent-x"). */
  name: string;
  /** Ordered list of episode IDs that form this session's narrative. */
  episodeChain: EpisodeId[];
  /** Current working context — key-value state the agent wants to resume. */
  workingContext: Record<string, unknown>;
  /** Session status. */
  status: 'active' | 'suspended' | 'completed';
  /** Last activity timestamp. */
  lastActivityAt: string;
  createdAt: string;
}

// ──────────────────────────────────────────────
// API Request/Response Types
// ──────────────────────────────────────────────

export interface CreateBankRequest {
  name: string;
  description: string;
  retention?: Partial<RetentionPolicy>;
  tags?: string[];
}

export interface CreateBankResponse { bank: MemoryBank }

export interface ListBanksResponse { banks: MemoryBank[] }

export interface RecordEpisodeRequest {
  bankId: MemoryBankId;
  type: EpisodeType;
  summary: string;
  content: string;
  context?: Partial<EpisodeContext>;
  importance?: number;
  valence?: Valence;
  tags?: string[];
  relatedEpisodeIds?: string[];
}

export interface RecordEpisodeResponse { episode: Episode }

export interface RecallResponse {
  results: RecalledEpisode[];
  totalMatched: number;
}

export interface ConsolidateRequest {
  bankId: MemoryBankId;
  sourceEpisodeIds: string[];
  strategy: ConsolidationStrategy;
}

export interface ConsolidateResponse { consolidation: Consolidation }

export interface ShareEpisodeRequest {
  episodeId: EpisodeId;
  visibility: ShareVisibility;
  targetAgentIds?: string[];
  redactFields?: string[];
  expiresAt?: string;
  allowReshare?: boolean;
}

export interface ShareEpisodeResponse { share: MemoryShare }

export interface CreateContinuitySessionRequest {
  name: string;
  initialContext?: Record<string, unknown>;
}

export interface CreateContinuitySessionResponse { session: ContinuitySession }

export interface UpdateContinuitySessionRequest {
  workingContext?: Record<string, unknown>;
  appendEpisodeId?: EpisodeId;
  status?: 'active' | 'suspended' | 'completed';
}

export interface UpdateContinuitySessionResponse { session: ContinuitySession }

export interface ResumeContinuitySessionResponse {
  session: ContinuitySession;
  recentEpisodes: Episode[];
}
