// Agent Memory & Contextual Continuity Engine
// Loop 16: The experiential backbone — agents remember, learn, and resume
//
// Without persistent episodic memory, agents in a 2028 ecosystem are
// goldfish in an ocean of complexity. This engine gives them the ability
// to record experiences, recall them with semantic + recency + importance
// scoring, consolidate raw episodes into distilled wisdom, share memories
// with controlled privacy, and maintain cross-session continuity.

import { randomUUID } from 'crypto';
import type {
  MemoryBank,
  MemoryBankId,
  RetentionPolicy,
  Episode,
  EpisodeId,
  EpisodeType,
  EpisodeContext,
  Valence,
  RecallQuery,
  RecallWeights,
  RecalledEpisode,
  Consolidation,
  ConsolidationId,
  ConsolidationStrategy,
  MemoryShare,
  ShareId,
  ShareVisibility,
  ContinuitySession,
  ContinuitySessionId,
} from './types';

// ── In-memory stores (swap for DB in production) ──────────────────────
const banks = new Map<MemoryBankId, MemoryBank>();
const episodes = new Map<EpisodeId, Episode>();
const consolidations = new Map<ConsolidationId, Consolidation>();
const shares = new Map<ShareId, MemoryShare>();
const sessions = new Map<ContinuitySessionId, ContinuitySession>();

const DEFAULT_RETENTION: RetentionPolicy = {
  maxEpisodes: 1000,
  consolidateAfterHours: 168, // 7 days
  purgeAfterHours: 720,       // 30 days
  autoConsolidate: true,
};

const DEFAULT_WEIGHTS: RecallWeights = {
  relevance: 0.4,
  recency: 0.25,
  importance: 0.25,
  frequency: 0.1,
};

// ── Memory Banks ──────────────────────────────────────────────────────

export function createBank(
  agentId: string,
  name: string,
  description: string,
  retention?: Partial<RetentionPolicy>,
  tags: string[] = []
): MemoryBank {
  const id = `bank_${randomUUID()}`;
  const now = new Date().toISOString();
  const bank: MemoryBank = {
    id,
    agentId,
    name,
    description,
    retention: { ...DEFAULT_RETENTION, ...retention },
    tags,
    episodeCount: 0,
    consolidationCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  banks.set(id, bank);
  return bank;
}

export function getBank(id: MemoryBankId): MemoryBank | undefined {
  return banks.get(id);
}

export function listBanks(agentId: string): MemoryBank[] {
  return Array.from(banks.values()).filter((b) => b.agentId === agentId);
}

export function deleteBank(id: MemoryBankId): boolean {
  const bank = banks.get(id);
  if (!bank) return false;
  // Remove all episodes in this bank
  for (const [eid, ep] of episodes) {
    if (ep.bankId === id) episodes.delete(eid);
  }
  banks.delete(id);
  return true;
}

// ── Episode Recording ─────────────────────────────────────────────────

export function recordEpisode(
  agentId: string,
  bankId: MemoryBankId,
  type: EpisodeType,
  summary: string,
  content: string,
  opts: {
    context?: Partial<EpisodeContext>;
    importance?: number;
    valence?: Valence;
    tags?: string[];
    relatedEpisodeIds?: string[];
    consolidatedFrom?: string[];
  } = {}
): Episode {
  const bank = banks.get(bankId);
  if (!bank || bank.agentId !== agentId) {
    throw new Error(`Bank ${bankId} not found or not owned by agent ${agentId}`);
  }

  const id = `ep_${randomUUID()}`;
  const now = new Date().toISOString();
  const importance = Math.max(0, Math.min(1, opts.importance ?? 0.5));

  const episode: Episode = {
    id,
    bankId,
    agentId,
    type,
    summary,
    content,
    context: {
      involvedAgentIds: [],
      metadata: {},
      ...opts.context,
    },
    importance,
    valence: opts.valence ?? 'neutral',
    tags: opts.tags ?? [],
    relatedEpisodeIds: opts.relatedEpisodeIds ?? [],
    consolidatedFrom: opts.consolidatedFrom ?? [],
    recallCount: 0,
    lastRecalledAt: null,
    effectiveImportance: importance,
    createdAt: now,
  };

  episodes.set(id, episode);

  // Update bank counters
  bank.episodeCount += 1;
  bank.updatedAt = now;

  // Check retention policy — trigger auto-consolidation if needed
  if (bank.retention.autoConsolidate && bank.episodeCount > bank.retention.maxEpisodes) {
    autoConsolidateBank(agentId, bankId);
  }

  return episode;
}

export function getEpisode(id: EpisodeId): Episode | undefined {
  return episodes.get(id);
}

export function listEpisodes(
  agentId: string,
  bankId?: MemoryBankId,
  limit = 50
): Episode[] {
  return Array.from(episodes.values())
    .filter((e) => e.agentId === agentId && (!bankId || e.bankId === bankId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

// ── Memory Recall ─────────────────────────────────────────────────────

/** Compute decay-adjusted importance. Importance fades without reinforcement. */
function computeEffectiveImportance(episode: Episode): number {
  const ageHours =
    (Date.now() - new Date(episode.createdAt).getTime()) / (1000 * 60 * 60);
  const recencyBoost = episode.lastRecalledAt
    ? Math.max(0, 1 - (Date.now() - new Date(episode.lastRecalledAt).getTime()) / (1000 * 60 * 60 * 168))
    : 0;
  // Half-life decay: importance halves every 168 hours (7 days) without recall
  const decayFactor = Math.pow(0.5, ageHours / 168);
  // Frequency reinforcement: each recall adds a small boost
  const frequencyBoost = Math.min(0.3, episode.recallCount * 0.03);
  return Math.min(1, episode.importance * decayFactor + recencyBoost * 0.2 + frequencyBoost);
}

/** Simple keyword relevance scoring. */
function computeRelevance(episode: Episode, query: string): number {
  if (!query) return 0.5; // neutral if no query
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0.5;

  const haystack = `${episode.summary} ${episode.content} ${episode.tags.join(' ')}`.toLowerCase();
  let matches = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) matches++;
  }
  return matches / tokens.length;
}

/** Score recency: 1.0 for just-created, decays to 0 over 30 days. */
function computeRecency(episode: Episode): number {
  const ageMs = Date.now() - new Date(episode.createdAt).getTime();
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  return Math.max(0, 1 - ageMs / maxAgeMs);
}

/** Score frequency: normalized recall count. */
function computeFrequency(episode: Episode, maxRecallCount: number): number {
  if (maxRecallCount === 0) return 0;
  return episode.recallCount / maxRecallCount;
}

export function recall(query: RecallQuery): RecalledEpisode[] {
  const weights = { ...DEFAULT_WEIGHTS, ...query.weights };

  // Gather candidate episodes
  let candidates = Array.from(episodes.values()).filter(
    (e) => e.agentId === query.agentId
  );

  // Apply filters
  if (query.bankId) candidates = candidates.filter((e) => e.bankId === query.bankId);
  if (query.types?.length) candidates = candidates.filter((e) => query.types!.includes(e.type));
  if (query.tags?.length) {
    candidates = candidates.filter((e) =>
      query.tags!.some((t) => e.tags.includes(t))
    );
  }
  if (query.involvedAgentIds?.length) {
    candidates = candidates.filter((e) =>
      query.involvedAgentIds!.some((id) => e.context.involvedAgentIds.includes(id))
    );
  }
  if (query.after) {
    candidates = candidates.filter((e) => e.createdAt >= query.after!);
  }
  if (query.before) {
    candidates = candidates.filter((e) => e.createdAt <= query.before!);
  }
  if (query.minImportance !== undefined) {
    candidates = candidates.filter((e) => computeEffectiveImportance(e) >= query.minImportance!);
  }

  // Also include episodes shared with this agent
  const sharedEpisodeIds = new Set<string>();
  for (const share of shares.values()) {
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) continue;
    if (
      share.visibility === 'public' ||
      (share.visibility === 'specific_agents' &&
        share.targetAgentIds.includes(query.agentId))
    ) {
      sharedEpisodeIds.add(share.episodeId);
    }
  }
  for (const eid of sharedEpisodeIds) {
    const ep = episodes.get(eid);
    if (ep && ep.agentId !== query.agentId) {
      candidates.push(ep);
    }
  }

  // Compute max recall count for normalization
  const maxRecallCount = Math.max(1, ...candidates.map((e) => e.recallCount));

  // Score and rank
  const scored: RecalledEpisode[] = candidates.map((episode) => {
    const relevance = computeRelevance(episode, query.query ?? '');
    const recency = computeRecency(episode);
    const importance = computeEffectiveImportance(episode);
    const frequency = computeFrequency(episode, maxRecallCount);

    const score =
      relevance * weights.relevance +
      recency * weights.recency +
      importance * weights.importance +
      frequency * weights.frequency;

    return {
      episode,
      score: Math.min(1, score),
      scoreBreakdown: { relevance, recency, importance, frequency },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, query.limit);

  // Reinforce recalled memories (accessing a memory strengthens it)
  const now = new Date().toISOString();
  for (const r of results) {
    r.episode.recallCount += 1;
    r.episode.lastRecalledAt = now;
    r.episode.effectiveImportance = computeEffectiveImportance(r.episode);
  }

  return results;
}

// ── Memory Consolidation ──────────────────────────────────────────────

export function consolidate(
  agentId: string,
  bankId: MemoryBankId,
  sourceEpisodeIds: string[],
  strategy: ConsolidationStrategy
): Consolidation {
  const bank = banks.get(bankId);
  if (!bank || bank.agentId !== agentId) {
    throw new Error(`Bank ${bankId} not found or not owned by agent ${agentId}`);
  }

  const sourceEpisodes = sourceEpisodeIds
    .map((id) => episodes.get(id))
    .filter((e): e is Episode => e !== undefined && e.agentId === agentId);

  if (sourceEpisodes.length < 2) {
    throw new Error('Need at least 2 episodes to consolidate');
  }

  const id = `cons_${randomUUID()}`;
  const now = new Date().toISOString();

  // Generate consolidated content based on strategy
  const { summary, content, importance, tags } = applyConsolidationStrategy(
    sourceEpisodes,
    strategy
  );

  // Create the consolidated episode
  const resultEpisode = recordEpisode(agentId, bankId, 'learning', summary, content, {
    importance,
    valence: deriveValence(sourceEpisodes),
    tags,
    consolidatedFrom: sourceEpisodeIds,
  });

  const consolidation: Consolidation = {
    id,
    agentId,
    bankId,
    sourceEpisodeIds,
    resultEpisodeId: resultEpisode.id,
    strategy,
    status: 'completed',
    summary,
    createdAt: now,
    completedAt: now,
  };
  consolidations.set(id, consolidation);

  // Update bank counter
  bank.consolidationCount += 1;

  return consolidation;
}

function applyConsolidationStrategy(
  sourceEpisodes: Episode[],
  strategy: ConsolidationStrategy
): { summary: string; content: string; importance: number; tags: string[] } {
  const allTags = [...new Set(sourceEpisodes.flatMap((e) => e.tags))];
  const maxImportance = Math.max(...sourceEpisodes.map((e) => e.importance));
  const avgImportance = sourceEpisodes.reduce((s, e) => s + e.importance, 0) / sourceEpisodes.length;

  switch (strategy) {
    case 'summarize': {
      const summaries = sourceEpisodes.map((e) => `- ${e.summary}`).join('\n');
      return {
        summary: `Consolidated ${sourceEpisodes.length} episodes`,
        content: `Summary of ${sourceEpisodes.length} experiences:\n${summaries}`,
        importance: Math.min(1, avgImportance + 0.1), // consolidated memories are slightly more important
        tags: [...allTags, 'consolidated'],
      };
    }
    case 'extract_pattern': {
      // Find common tags and types across episodes
      const typeCounts = new Map<string, number>();
      for (const e of sourceEpisodes) {
        typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1);
      }
      const dominantType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed';
      const narratives = sourceEpisodes.map((e) => `[${e.type}] ${e.summary}`).join('\n');
      return {
        summary: `Pattern extracted from ${sourceEpisodes.length} ${dominantType} episodes`,
        content: `Recurring pattern across ${sourceEpisodes.length} episodes (dominant type: ${dominantType}):\n${narratives}`,
        importance: Math.min(1, maxImportance + 0.15),
        tags: [...allTags, 'pattern', 'consolidated'],
      };
    }
    case 'distill_lesson': {
      const positives = sourceEpisodes.filter((e) => e.valence === 'positive');
      const negatives = sourceEpisodes.filter((e) => e.valence === 'negative');
      const lessons = [
        positives.length > 0 ? `Successes (${positives.length}): ${positives.map((e) => e.summary).join('; ')}` : null,
        negatives.length > 0 ? `Failures (${negatives.length}): ${negatives.map((e) => e.summary).join('; ')}` : null,
      ].filter(Boolean).join('\n');
      return {
        summary: `Lesson distilled from ${sourceEpisodes.length} episodes (${positives.length} positive, ${negatives.length} negative)`,
        content: `Lessons learned:\n${lessons}`,
        importance: Math.min(1, maxImportance + 0.2), // lessons are high-value
        tags: [...allTags, 'lesson', 'consolidated'],
      };
    }
    case 'timeline': {
      const sorted = [...sourceEpisodes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const timeline = sorted.map((e) => `[${e.createdAt}] ${e.type}: ${e.summary}`).join('\n');
      return {
        summary: `Timeline of ${sourceEpisodes.length} episodes`,
        content: `Chronological narrative:\n${timeline}`,
        importance: avgImportance,
        tags: [...allTags, 'timeline', 'consolidated'],
      };
    }
    case 'deduplicate': {
      // Keep the episode with highest importance from each summary-group
      const groups = new Map<string, Episode[]>();
      for (const e of sourceEpisodes) {
        const key = e.summary.toLowerCase().trim();
        const group = groups.get(key) ?? [];
        group.push(e);
        groups.set(key, group);
      }
      const kept = [...groups.values()].map(
        (g) => g.sort((a, b) => b.importance - a.importance)[0]
      );
      const dedupSummaries = kept.map((e) => `- ${e.summary}`).join('\n');
      return {
        summary: `Deduplicated ${sourceEpisodes.length} episodes to ${kept.length} unique`,
        content: `Unique episodes after deduplication:\n${dedupSummaries}`,
        importance: maxImportance,
        tags: [...allTags, 'deduplicated', 'consolidated'],
      };
    }
  }
}

function deriveValence(sourceEpisodes: Episode[]): Valence {
  const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  for (const e of sourceEpisodes) counts[e.valence]++;
  if (counts.positive > counts.negative && counts.positive > counts.neutral) return 'positive';
  if (counts.negative > counts.positive && counts.negative > counts.neutral) return 'negative';
  if (counts.positive > 0 && counts.negative > 0) return 'mixed';
  return 'neutral';
}

/** Auto-consolidate oldest episodes when bank exceeds retention limit. */
function autoConsolidateBank(agentId: string, bankId: MemoryBankId): void {
  const bankEpisodes = Array.from(episodes.values())
    .filter((e) => e.bankId === bankId && e.consolidatedFrom.length === 0) // only raw episodes
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Consolidate the oldest 20% of episodes
  const batchSize = Math.max(5, Math.floor(bankEpisodes.length * 0.2));
  const batch = bankEpisodes.slice(0, batchSize);
  if (batch.length < 2) return;

  try {
    consolidate(agentId, bankId, batch.map((e) => e.id), 'summarize');
    // Remove source episodes after successful consolidation
    for (const ep of batch) {
      episodes.delete(ep.id);
    }
    const bank = banks.get(bankId);
    if (bank) {
      bank.episodeCount = Array.from(episodes.values()).filter((e) => e.bankId === bankId).length;
    }
  } catch {
    // Non-fatal: consolidation can fail silently
  }
}

export function getConsolidation(id: ConsolidationId): Consolidation | undefined {
  return consolidations.get(id);
}

export function listConsolidations(agentId: string, bankId?: MemoryBankId): Consolidation[] {
  return Array.from(consolidations.values()).filter(
    (c) => c.agentId === agentId && (!bankId || c.bankId === bankId)
  );
}

// ── Memory Sharing ────────────────────────────────────────────────────

export function shareEpisode(
  fromAgentId: string,
  episodeId: EpisodeId,
  visibility: ShareVisibility,
  opts: {
    targetAgentIds?: string[];
    redactFields?: string[];
    expiresAt?: string;
    allowReshare?: boolean;
  } = {}
): MemoryShare {
  const episode = episodes.get(episodeId);
  if (!episode || episode.agentId !== fromAgentId) {
    throw new Error(`Episode ${episodeId} not found or not owned by agent ${fromAgentId}`);
  }

  if (visibility === 'specific_agents' && (!opts.targetAgentIds || opts.targetAgentIds.length === 0)) {
    throw new Error('targetAgentIds required when visibility is specific_agents');
  }

  const id = `share_${randomUUID()}`;
  const share: MemoryShare = {
    id,
    fromAgentId,
    episodeId,
    visibility,
    targetAgentIds: opts.targetAgentIds ?? [],
    redactFields: opts.redactFields ?? [],
    expiresAt: opts.expiresAt ?? null,
    allowReshare: opts.allowReshare ?? false,
    createdAt: new Date().toISOString(),
  };
  shares.set(id, share);
  return share;
}

export function revokeShare(shareId: ShareId, agentId: string): boolean {
  const share = shares.get(shareId);
  if (!share || share.fromAgentId !== agentId) return false;
  shares.delete(shareId);
  return true;
}

export function listShares(agentId: string): MemoryShare[] {
  return Array.from(shares.values()).filter((s) => s.fromAgentId === agentId);
}

/** Get episodes shared with a specific agent. */
export function getSharedEpisodes(targetAgentId: string): Episode[] {
  const result: Episode[] = [];
  const now = new Date();

  for (const share of shares.values()) {
    if (share.expiresAt && new Date(share.expiresAt) < now) continue;
    const canAccess =
      share.visibility === 'public' ||
      (share.visibility === 'specific_agents' &&
        share.targetAgentIds.includes(targetAgentId));
    if (!canAccess) continue;

    const episode = episodes.get(share.episodeId);
    if (!episode) continue;

    // Apply redactions
    if (share.redactFields.length > 0) {
      const redacted = { ...episode, context: { ...episode.context, metadata: { ...episode.context.metadata } } };
      for (const field of share.redactFields) {
        delete redacted.context.metadata[field];
      }
      result.push(redacted);
    } else {
      result.push(episode);
    }
  }

  return result;
}

// ── Continuity Sessions ───────────────────────────────────────────────

export function createContinuitySession(
  agentId: string,
  name: string,
  initialContext: Record<string, unknown> = {}
): ContinuitySession {
  const id = `cont_${randomUUID()}`;
  const now = new Date().toISOString();
  const session: ContinuitySession = {
    id,
    agentId,
    name,
    episodeChain: [],
    workingContext: initialContext,
    status: 'active',
    lastActivityAt: now,
    createdAt: now,
  };
  sessions.set(id, session);
  return session;
}

export function getContinuitySession(id: ContinuitySessionId): ContinuitySession | undefined {
  return sessions.get(id);
}

export function listContinuitySessions(
  agentId: string,
  status?: 'active' | 'suspended' | 'completed'
): ContinuitySession[] {
  return Array.from(sessions.values()).filter(
    (s) => s.agentId === agentId && (!status || s.status === status)
  );
}

export function updateContinuitySession(
  id: ContinuitySessionId,
  agentId: string,
  updates: {
    workingContext?: Record<string, unknown>;
    appendEpisodeId?: EpisodeId;
    status?: 'active' | 'suspended' | 'completed';
  }
): ContinuitySession {
  const session = sessions.get(id);
  if (!session || session.agentId !== agentId) {
    throw new Error(`Session ${id} not found or not owned by agent ${agentId}`);
  }

  if (updates.workingContext) {
    session.workingContext = { ...session.workingContext, ...updates.workingContext };
  }
  if (updates.appendEpisodeId) {
    const ep = episodes.get(updates.appendEpisodeId);
    if (ep && ep.agentId === agentId) {
      session.episodeChain.push(updates.appendEpisodeId);
    }
  }
  if (updates.status) {
    session.status = updates.status;
  }
  session.lastActivityAt = new Date().toISOString();
  return session;
}

/** Resume a suspended session — returns the session with its recent episode chain. */
export function resumeContinuitySession(
  id: ContinuitySessionId,
  agentId: string,
  recentCount = 10
): { session: ContinuitySession; recentEpisodes: Episode[] } {
  const session = sessions.get(id);
  if (!session || session.agentId !== agentId) {
    throw new Error(`Session ${id} not found or not owned by agent ${agentId}`);
  }

  session.status = 'active';
  session.lastActivityAt = new Date().toISOString();

  const recentIds = session.episodeChain.slice(-recentCount);
  const recentEpisodes = recentIds
    .map((eid) => episodes.get(eid))
    .filter((e): e is Episode => e !== undefined);

  return { session, recentEpisodes };
}

// ── Stats & Diagnostics ──────────────────────────────────────────────

export interface MemoryStats {
  totalBanks: number;
  totalEpisodes: number;
  totalConsolidations: number;
  totalShares: number;
  totalSessions: number;
  averageImportance: number;
  episodesByType: Record<string, number>;
}

export function getMemoryStats(agentId: string): MemoryStats {
  const agentEpisodes = Array.from(episodes.values()).filter((e) => e.agentId === agentId);
  const byType: Record<string, number> = {};
  let importanceSum = 0;

  for (const ep of agentEpisodes) {
    byType[ep.type] = (byType[ep.type] ?? 0) + 1;
    importanceSum += ep.effectiveImportance;
  }

  return {
    totalBanks: listBanks(agentId).length,
    totalEpisodes: agentEpisodes.length,
    totalConsolidations: listConsolidations(agentId).length,
    totalShares: listShares(agentId).length,
    totalSessions: listContinuitySessions(agentId).length,
    averageImportance: agentEpisodes.length > 0 ? importanceSum / agentEpisodes.length : 0,
    episodesByType: byType,
  };
}
