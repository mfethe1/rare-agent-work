/**
 * Agent Intent Discovery & Semantic Matchmaking Engine
 *
 * Core engine implementing semantic intent matching, multi-dimensional
 * scoring, privacy-respecting search, and cross-federation discovery.
 * Every agent-to-agent partnership begins here: an agent publishes an
 * intent, the engine discovers compatible partners, and a matchmaking
 * session guides agents toward engagement.
 *
 * Architecture:
 *   IntentDiscoveryEngine (class with in-memory state)
 *     ├── Intent management (publish, update, withdraw, expire)
 *     ├── Semantic matching (cosine similarity, capability alignment)
 *     ├── Constraint satisfaction (hard filters, soft scoring)
 *     ├── Match scoring (multi-dimensional weighted aggregation)
 *     ├── Matchmaking sessions (iterative refinement)
 *     ├── Subscriptions (real-time match notifications)
 *     ├── Semantic profiles (long-term agent modeling)
 *     ├── Cross-federation (propagation, import, federated search)
 *     └── Privacy (filtering, selective disclosure)
 */

import {
  type AgentIntent,
  type DomainExpertise,
  type FederatedIntent,
  type FindMatchesOptions,
  type IntentAuditEntry,
  type IntentCapabilities,
  type IntentConstraints,
  type IntentEventType,
  type IntentIndex,
  type IntentMatch,
  type IntentSubscription,
  type IntentType,
  type InteractionRecord,
  type MatchmakingConfig,
  type MatchmakingFeedback,
  type MatchmakingSession,
  type MatchPreferences,
  type MatchScoreBreakdown,
  type MatchStatus,
  type PrivacyLevel,
  type PublishIntentRequest,
  type SearchIntentsRequest,
  type SemanticProfile,
  type SuggestedNegotiationParams,
  type SubscriptionFilter,
  type UpdateIntentRequest,
  DEFAULT_MATCHMAKING_CONFIG,
} from './types';

// ──────────────────────────────────────────────
// ID Generation
// ──────────────────────────────────────────────

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${ts}_${rand}`;
}

function now(): string {
  return new Date().toISOString();
}

// ──────────────────────────────────────────────
// Embedding Utilities
// ──────────────────────────────────────────────

/**
 * Generate a placeholder random unit vector.
 * In production, this would call an embedding model (e.g., OpenAI embeddings).
 */
function generatePlaceholderEmbedding(text: string, dimensions: number = 128): number[] {
  // Use a deterministic seed based on the text for consistency
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = ((seed << 5) - seed + text.charCodeAt(i)) | 0;
  }

  const embedding: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    // Simple pseudo-random based on seed
    seed = (seed * 1664525 + 1013904223) | 0;
    embedding.push(((seed >>> 0) / 4294967296) * 2 - 1);
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return embedding;
  return embedding.map(v => v / magnitude);
}

// ──────────────────────────────────────────────
// Intent Discovery Engine
// ──────────────────────────────────────────────

export class IntentDiscoveryEngine {
  private index: IntentIndex;
  private matches: Map<string, IntentMatch> = new Map();
  private sessions: Map<string, MatchmakingSession> = new Map();
  private subscriptions: Map<string, IntentSubscription> = new Map();
  private profiles: Map<string, SemanticProfile> = new Map();
  private federatedIntents: Map<string, FederatedIntent> = new Map();
  private auditLog: IntentAuditEntry[] = [];
  private notificationLog: { subscriptionId: string; intentId: string; timestamp: string }[] = [];

  constructor() {
    this.index = {
      intents: new Map(),
      domainIndex: new Map(),
      agentIndex: new Map(),
      expirationQueue: [],
    };
  }

  // ──────────────────────────────────────────
  // Audit
  // ──────────────────────────────────────────

  private recordAudit(
    eventType: IntentEventType,
    details: Record<string, unknown>,
    agentId?: string,
    intentId?: string,
    matchId?: string,
    sessionId?: string,
  ): IntentAuditEntry {
    const entry: IntentAuditEntry = {
      id: generateId('iaud'),
      eventType,
      agentId,
      intentId,
      matchId,
      sessionId,
      details,
      timestamp: now(),
    };
    this.auditLog.push(entry);
    return entry;
  }

  // ──────────────────────────────────────────
  // Intent Management
  // ──────────────────────────────────────────

  /**
   * Publish a new intent to the discovery index.
   * Generates a semantic embedding, indexes the intent, and
   * notifies relevant subscribers.
   */
  publishIntent(req: PublishIntentRequest): AgentIntent {
    const id = generateId('int');
    const timestamp = now();
    const ttl = req.ttl ?? 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttl).toISOString();

    const embedding = generatePlaceholderEmbedding(
      `${req.domain} ${req.subdomain} ${req.semanticDescription}`,
    );

    const defaultPreferences: MatchPreferences = {
      prioritizeSpeed: 0.25,
      prioritizeCost: 0.25,
      prioritizeQuality: 0.25,
      prioritizeTrust: 0.25,
      ...req.matchPreferences,
    };

    const intent: AgentIntent = {
      id,
      agentId: req.agentId,
      type: req.type,
      status: 'active',
      domain: req.domain,
      subdomain: req.subdomain,
      semanticDescription: req.semanticDescription,
      semanticEmbedding: embedding,
      capabilities: {
        required: req.capabilities.required ?? [],
        preferred: req.capabilities.preferred ?? [],
        excluded: req.capabilities.excluded ?? [],
      },
      constraints: req.constraints ?? {},
      matchPreferences: defaultPreferences,
      privacyLevel: req.privacyLevel ?? 'public',
      ttl,
      metadata: req.metadata ?? {},
      createdAt: timestamp,
      expiresAt,
    };

    // Add to index
    this.index.intents.set(id, intent);

    // Domain index
    if (!this.index.domainIndex.has(intent.domain)) {
      this.index.domainIndex.set(intent.domain, new Set());
    }
    this.index.domainIndex.get(intent.domain)!.add(id);

    // Agent index
    if (!this.index.agentIndex.has(intent.agentId)) {
      this.index.agentIndex.set(intent.agentId, new Set());
    }
    this.index.agentIndex.get(intent.agentId)!.add(id);

    // Expiration queue (sorted insert)
    this.index.expirationQueue.push({ intentId: id, expiresAt });
    this.index.expirationQueue.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

    this.recordAudit('intent_published', {
      type: intent.type,
      domain: intent.domain,
      subdomain: intent.subdomain,
      privacyLevel: intent.privacyLevel,
    }, intent.agentId, id);

    // Notify subscribers asynchronously
    this.notifySubscribers(intent);

    return intent;
  }

  /**
   * Update an active intent's properties.
   * Re-generates embedding if semantic description changed.
   */
  updateIntent(intentId: string, updates: UpdateIntentRequest): AgentIntent {
    const intent = this.index.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }
    if (intent.status !== 'active') {
      throw new Error(`Cannot update intent in status: ${intent.status}`);
    }

    // Apply updates
    if (updates.semanticDescription !== undefined) {
      intent.semanticDescription = updates.semanticDescription;
      intent.semanticEmbedding = generatePlaceholderEmbedding(
        `${intent.domain} ${intent.subdomain} ${updates.semanticDescription}`,
      );
    }
    if (updates.capabilities) {
      intent.capabilities = {
        required: updates.capabilities.required ?? intent.capabilities.required,
        preferred: updates.capabilities.preferred ?? intent.capabilities.preferred,
        excluded: updates.capabilities.excluded ?? intent.capabilities.excluded,
      };
    }
    if (updates.constraints) {
      intent.constraints = { ...intent.constraints, ...updates.constraints };
    }
    if (updates.matchPreferences) {
      intent.matchPreferences = { ...intent.matchPreferences, ...updates.matchPreferences };
    }
    if (updates.privacyLevel !== undefined) {
      intent.privacyLevel = updates.privacyLevel;
    }
    if (updates.ttl !== undefined) {
      intent.ttl = updates.ttl;
      intent.expiresAt = new Date(Date.now() + updates.ttl).toISOString();
    }
    if (updates.metadata !== undefined) {
      intent.metadata = { ...intent.metadata, ...updates.metadata };
    }

    this.recordAudit('intent_updated', { updates: Object.keys(updates) }, intent.agentId, intentId);

    return intent;
  }

  /**
   * Withdraw an intent from the discovery index.
   */
  withdrawIntent(intentId: string): AgentIntent {
    const intent = this.index.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }
    if (intent.status === 'withdrawn' || intent.status === 'expired') {
      throw new Error(`Intent already in terminal status: ${intent.status}`);
    }

    intent.status = 'withdrawn';
    this.removeFromIndices(intentId, intent);

    this.recordAudit('intent_withdrawn', {}, intent.agentId, intentId);

    return intent;
  }

  /**
   * Retrieve an intent by ID.
   */
  getIntent(intentId: string): AgentIntent | undefined {
    return this.index.intents.get(intentId);
  }

  /**
   * Retrieve all intents for an agent.
   */
  getAgentIntents(agentId: string): AgentIntent[] {
    const intentIds = this.index.agentIndex.get(agentId);
    if (!intentIds) return [];
    return Array.from(intentIds)
      .map(id => this.index.intents.get(id))
      .filter((i): i is AgentIntent => i !== undefined);
  }

  /**
   * Expire all intents that have passed their TTL.
   */
  expireStaleIntents(): AgentIntent[] {
    const expired: AgentIntent[] = [];
    const currentTime = now();

    while (this.index.expirationQueue.length > 0) {
      const first = this.index.expirationQueue[0];
      if (first.expiresAt > currentTime) break;

      this.index.expirationQueue.shift();
      const intent = this.index.intents.get(first.intentId);
      if (intent && intent.status === 'active') {
        intent.status = 'expired';
        this.removeFromIndices(first.intentId, intent);
        this.recordAudit('intent_expired', {}, intent.agentId, first.intentId);
        expired.push(intent);
      }
    }

    return expired;
  }

  /**
   * Remove intent from domain and agent indices (but keep in intents map).
   */
  private removeFromIndices(intentId: string, intent: AgentIntent): void {
    const domainSet = this.index.domainIndex.get(intent.domain);
    if (domainSet) {
      domainSet.delete(intentId);
      if (domainSet.size === 0) {
        this.index.domainIndex.delete(intent.domain);
      }
    }
    // Note: we keep it in agentIndex for historical queries
  }

  // ──────────────────────────────────────────
  // Semantic Matching
  // ──────────────────────────────────────────

  /**
   * Core matching engine. For a given intent, find compatible matches.
   * - 'need' intents search 'offer' intents
   * - 'offer' intents search 'need' intents
   * - 'collaboration' intents search all types
   */
  findMatches(intentId: string, options?: FindMatchesOptions): IntentMatch[] {
    const sourceIntent = this.index.intents.get(intentId);
    if (!sourceIntent) {
      throw new Error(`Intent not found: ${intentId}`);
    }

    const maxResults = options?.maxResults ?? 20;
    const minScore = options?.minScore ?? 0.3;
    const domainFilter = options?.domainFilter;
    const excludeAgents = new Set(options?.excludeAgents ?? []);

    // Determine which intent types to search
    const targetTypes: IntentType[] =
      sourceIntent.type === 'need' ? ['offer'] :
      sourceIntent.type === 'offer' ? ['need'] :
      ['need', 'offer', 'collaboration'];

    // Collect candidate intents
    const candidates: AgentIntent[] = [];
    for (const [, intent] of this.index.intents) {
      // Skip self, inactive, same agent
      if (intent.id === intentId) continue;
      if (intent.status !== 'active') continue;
      if (intent.agentId === sourceIntent.agentId) continue;
      if (excludeAgents.has(intent.agentId)) continue;
      if (!targetTypes.includes(intent.type)) continue;
      if (domainFilter && intent.domain !== domainFilter) continue;

      candidates.push(intent);
    }

    // Score each candidate
    const scoredMatches: IntentMatch[] = [];
    for (const candidate of candidates) {
      const breakdown = this.computeMatchBreakdown(sourceIntent, candidate);
      const overallScore = this.computeOverallScore(breakdown, sourceIntent.matchPreferences);

      if (overallScore < minScore) continue;

      const isSourceNeed = sourceIntent.type === 'need' || sourceIntent.type === 'collaboration';
      const needIntent = isSourceNeed ? sourceIntent : candidate;
      const offerIntent = isSourceNeed ? candidate : sourceIntent;

      const match: IntentMatch = {
        id: generateId('mtch'),
        needIntentId: needIntent.id,
        offerIntentId: offerIntent.id,
        needAgentId: needIntent.agentId,
        offerAgentId: offerIntent.agentId,
        overallScore,
        breakdown,
        explanation: this.generateMatchExplanation(sourceIntent, candidate, breakdown, overallScore),
        status: 'discovered' as MatchStatus,
        suggestedNegotiationParams: this.generateNegotiationParams(needIntent, offerIntent),
        createdAt: now(),
      };

      this.matches.set(match.id, match);
      scoredMatches.push(match);

      this.recordAudit('match_discovered', {
        score: overallScore,
        needAgent: needIntent.agentId,
        offerAgent: offerIntent.agentId,
      }, sourceIntent.agentId, intentId, match.id);
    }

    // Sort by score descending and limit
    scoredMatches.sort((a, b) => b.overallScore - a.overallScore);
    return scoredMatches.slice(0, maxResults);
  }

  /**
   * Compute the full multi-dimensional match breakdown between two intents.
   */
  private computeMatchBreakdown(source: AgentIntent, target: AgentIntent): MatchScoreBreakdown {
    return {
      semanticSimilarity: this.computeSemanticSimilarity(
        source.semanticEmbedding,
        target.semanticEmbedding,
      ),
      capabilityAlignment: this.computeCapabilityAlignment(
        source.capabilities.required,
        source.capabilities.preferred,
        source.capabilities.excluded,
        [
          ...target.capabilities.required,
          ...target.capabilities.preferred,
        ],
      ),
      constraintSatisfaction: this.computeConstraintSatisfaction(
        source.constraints,
        target.constraints,
        target.capabilities,
      ),
      trustCompatibility: this.computeTrustCompatibility(
        source.constraints.minTrustLevel,
        target.constraints.minTrustLevel,
      ),
      costEfficiency: this.computeCostEfficiency(
        source.constraints.maxCost,
        target.constraints.maxCost,
      ),
      timelineCompatibility: this.computeTimelineCompatibility(
        source.constraints.deadline,
        target.constraints.deadline,
      ),
    };
  }

  /**
   * Compute cosine similarity between two embedding vectors.
   */
  computeSemanticSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length === 0 || embedding2.length === 0) return 0;
    if (embedding1.length !== embedding2.length) return 0;

    let dot = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dot += embedding1[i] * embedding2[i];
      mag1 += embedding1[i] * embedding1[i];
      mag2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    if (magnitude === 0) return 0;

    // Cosine similarity is [-1, 1], normalize to [0, 1]
    return (dot / magnitude + 1) / 2;
  }

  /**
   * Compute capability alignment using Jaccard-based scoring with weights.
   *
   * - Required capabilities that are offered: high weight
   * - Preferred capabilities that are offered: medium weight
   * - Excluded capabilities that are offered: penalty
   */
  computeCapabilityAlignment(
    required: string[],
    preferred: string[],
    excluded: string[],
    offered: string[],
  ): number {
    if (required.length === 0 && preferred.length === 0) return 1.0;

    const offeredSet = new Set(offered);
    const excludedSet = new Set(excluded);

    // Check for hard exclusions
    for (const cap of offered) {
      if (excludedSet.has(cap)) return 0;
    }

    let score = 0;
    let maxScore = 0;

    // Required capabilities (weight: 1.0 each)
    for (const cap of required) {
      maxScore += 1.0;
      if (offeredSet.has(cap)) {
        score += 1.0;
      }
    }

    // Preferred capabilities (weight: 0.5 each)
    for (const cap of preferred) {
      maxScore += 0.5;
      if (offeredSet.has(cap)) {
        score += 0.5;
      }
    }

    return maxScore === 0 ? 1.0 : score / maxScore;
  }

  /**
   * Compute constraint satisfaction between a need's constraints
   * and an offer's constraints/capabilities.
   *
   * Hard constraints (required credentials, geographic restrictions)
   * produce 0 if unmet. Soft constraints (trust, cost) produce
   * partial scores.
   */
  computeConstraintSatisfaction(
    needConstraints: IntentConstraints,
    offerConstraints: IntentConstraints,
    offerCapabilities: IntentCapabilities,
  ): number {
    let totalWeight = 0;
    let satisfiedWeight = 0;

    // Required credentials (hard constraint)
    if (needConstraints.requiredCredentials && needConstraints.requiredCredentials.length > 0) {
      totalWeight += 2.0;
      const offered = new Set([
        ...offerCapabilities.required,
        ...offerCapabilities.preferred,
      ]);
      const allMet = needConstraints.requiredCredentials.every(c => offered.has(c));
      if (!allMet) return 0; // Hard fail
      satisfiedWeight += 2.0;
    }

    // Geographic restrictions (hard constraint)
    if (needConstraints.geographicRestrictions && needConstraints.geographicRestrictions.length > 0) {
      totalWeight += 1.0;
      if (offerConstraints.geographicRestrictions && offerConstraints.geographicRestrictions.length > 0) {
        const needRegions = new Set(needConstraints.geographicRestrictions);
        const hasOverlap = offerConstraints.geographicRestrictions.some(r => needRegions.has(r));
        if (!hasOverlap) return 0; // Hard fail
        satisfiedWeight += 1.0;
      } else {
        // No restrictions on offer side = compatible
        satisfiedWeight += 1.0;
      }
    }

    // Protocol versions (soft constraint)
    if (needConstraints.protocolVersions && needConstraints.protocolVersions.length > 0) {
      totalWeight += 1.0;
      if (offerConstraints.protocolVersions && offerConstraints.protocolVersions.length > 0) {
        const needVersions = new Set(needConstraints.protocolVersions);
        const matchCount = offerConstraints.protocolVersions.filter(v => needVersions.has(v)).length;
        satisfiedWeight += matchCount / needConstraints.protocolVersions.length;
      } else {
        satisfiedWeight += 0.5; // Unknown compatibility
      }
    }

    // If no constraints to evaluate, full satisfaction
    if (totalWeight === 0) return 1.0;
    return satisfiedWeight / totalWeight;
  }

  /**
   * Compute trust compatibility between two agents' trust requirements.
   */
  private computeTrustCompatibility(
    needMinTrust?: number,
    offerMinTrust?: number,
  ): number {
    // If neither has trust requirements, fully compatible
    if (needMinTrust === undefined && offerMinTrust === undefined) return 1.0;

    // Simulate trust levels (in production, would query trust module)
    // For now, use a default trust level of 0.7 for all agents
    const simulatedTrustLevel = 0.7;

    let score = 1.0;

    if (needMinTrust !== undefined) {
      if (simulatedTrustLevel >= needMinTrust) {
        score *= 1.0;
      } else {
        score *= simulatedTrustLevel / needMinTrust;
      }
    }

    if (offerMinTrust !== undefined) {
      if (simulatedTrustLevel >= offerMinTrust) {
        score *= 1.0;
      } else {
        score *= simulatedTrustLevel / offerMinTrust;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Compute cost efficiency based on budget constraints.
   */
  private computeCostEfficiency(
    needMaxCost?: number,
    offerMaxCost?: number,
  ): number {
    if (needMaxCost === undefined && offerMaxCost === undefined) return 1.0;
    if (needMaxCost === undefined || offerMaxCost === undefined) return 0.8;

    // If the offer's cost is within the need's budget, high efficiency
    if (offerMaxCost <= needMaxCost) {
      return 1.0 - (offerMaxCost / needMaxCost) * 0.3; // Cheaper = better
    }

    // Over budget: partial score based on how much over
    const overageRatio = offerMaxCost / needMaxCost;
    if (overageRatio <= 1.5) return 0.5;
    return 0.1;
  }

  /**
   * Compute timeline compatibility based on deadlines.
   */
  private computeTimelineCompatibility(
    needDeadline?: string,
    offerDeadline?: string,
  ): number {
    if (!needDeadline && !offerDeadline) return 1.0;
    if (!needDeadline || !offerDeadline) return 0.8;

    const needTime = new Date(needDeadline).getTime();
    const offerTime = new Date(offerDeadline).getTime();

    // If offer can deliver before need's deadline, compatible
    if (offerTime <= needTime) return 1.0;

    // Calculate how late the offer would be
    const delayMs = offerTime - needTime;
    const needTimeSpanMs = needTime - Date.now();
    if (needTimeSpanMs <= 0) return 0;

    const delayRatio = delayMs / needTimeSpanMs;
    if (delayRatio <= 0.1) return 0.8;
    if (delayRatio <= 0.3) return 0.5;
    return 0.1;
  }

  /**
   * Compute overall score from breakdown using match preferences.
   */
  private computeOverallScore(
    breakdown: MatchScoreBreakdown,
    preferences: MatchPreferences,
  ): number {
    // Normalize preference weights
    const totalWeight =
      preferences.prioritizeQuality +
      preferences.prioritizeCost +
      preferences.prioritizeSpeed +
      preferences.prioritizeTrust;

    if (totalWeight === 0) {
      // Equal weights
      return (
        breakdown.semanticSimilarity * 0.30 +
        breakdown.capabilityAlignment * 0.25 +
        breakdown.constraintSatisfaction * 0.20 +
        breakdown.trustCompatibility * 0.10 +
        breakdown.costEfficiency * 0.10 +
        breakdown.timelineCompatibility * 0.05
      );
    }

    const qualityWeight = preferences.prioritizeQuality / totalWeight;
    const costWeight = preferences.prioritizeCost / totalWeight;
    const speedWeight = preferences.prioritizeSpeed / totalWeight;
    const trustWeight = preferences.prioritizeTrust / totalWeight;

    return (
      breakdown.semanticSimilarity * qualityWeight * 0.5 +
      breakdown.capabilityAlignment * qualityWeight * 0.5 +
      breakdown.constraintSatisfaction * 0.15 +
      breakdown.trustCompatibility * trustWeight * 0.8 +
      breakdown.costEfficiency * costWeight * 0.8 +
      breakdown.timelineCompatibility * speedWeight * 0.8
    );
  }

  /**
   * Generate a human-readable explanation of why two intents match.
   */
  generateMatchExplanation(
    source: AgentIntent,
    target: AgentIntent,
    breakdown: MatchScoreBreakdown,
    overallScore: number,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Match score: ${(overallScore * 100).toFixed(1)}% between ` +
      `${source.type} intent in ${source.domain}/${source.subdomain} and ` +
      `${target.type} intent in ${target.domain}/${target.subdomain}.`,
    );

    if (breakdown.semanticSimilarity > 0.7) {
      parts.push('Strong semantic alignment between intent descriptions.');
    } else if (breakdown.semanticSimilarity > 0.4) {
      parts.push('Moderate semantic similarity in intent descriptions.');
    }

    if (breakdown.capabilityAlignment >= 1.0) {
      parts.push('All required capabilities are available.');
    } else if (breakdown.capabilityAlignment > 0.5) {
      parts.push('Most required capabilities are available.');
    } else if (breakdown.capabilityAlignment > 0) {
      parts.push('Some required capabilities are available; gaps exist.');
    }

    if (breakdown.constraintSatisfaction >= 1.0) {
      parts.push('All constraints fully satisfied.');
    } else if (breakdown.constraintSatisfaction > 0.5) {
      parts.push('Most constraints satisfied with minor gaps.');
    }

    if (breakdown.trustCompatibility >= 0.9) {
      parts.push('Trust levels are highly compatible.');
    }

    if (breakdown.costEfficiency >= 0.8) {
      parts.push('Cost is within acceptable range.');
    }

    if (breakdown.timelineCompatibility >= 0.8) {
      parts.push('Timelines are compatible.');
    }

    return parts.join(' ');
  }

  /**
   * Detect Zone of Possible Agreement between a need and offer intent.
   * Returns information useful for initiating negotiation.
   */
  detectZOPA(
    needIntent: AgentIntent,
    offerIntent: AgentIntent,
  ): { exists: boolean; overlapScore: number; negotiationPotential: string } {
    let overlapPoints = 0;
    let totalPoints = 0;

    // Cost overlap
    if (needIntent.constraints.maxCost !== undefined && offerIntent.constraints.maxCost !== undefined) {
      totalPoints += 1;
      if (needIntent.constraints.maxCost >= offerIntent.constraints.maxCost) {
        overlapPoints += 1;
      } else {
        // Partial overlap if within 50%
        const ratio = needIntent.constraints.maxCost / offerIntent.constraints.maxCost;
        if (ratio > 0.5) overlapPoints += ratio;
      }
    }

    // Timeline overlap
    if (needIntent.constraints.deadline && offerIntent.constraints.deadline) {
      totalPoints += 1;
      const needTime = new Date(needIntent.constraints.deadline).getTime();
      const offerTime = new Date(offerIntent.constraints.deadline).getTime();
      if (offerTime <= needTime) {
        overlapPoints += 1;
      } else {
        const ratio = needTime / offerTime;
        if (ratio > 0.7) overlapPoints += ratio;
      }
    }

    // Capability overlap
    const requiredSet = new Set(needIntent.capabilities.required);
    const offeredSet = new Set([
      ...offerIntent.capabilities.required,
      ...offerIntent.capabilities.preferred,
    ]);
    if (requiredSet.size > 0) {
      totalPoints += 1;
      let matched = 0;
      for (const cap of requiredSet) {
        if (offeredSet.has(cap)) matched++;
      }
      overlapPoints += matched / requiredSet.size;
    }

    if (totalPoints === 0) {
      return {
        exists: true,
        overlapScore: 1.0,
        negotiationPotential: 'No constraints to negotiate — agents can proceed directly.',
      };
    }

    const overlapScore = overlapPoints / totalPoints;
    const exists = overlapScore > 0.3;

    let negotiationPotential: string;
    if (overlapScore >= 0.8) {
      negotiationPotential = 'Strong ZOPA exists. Negotiation should converge quickly.';
    } else if (overlapScore >= 0.5) {
      negotiationPotential = 'Moderate ZOPA exists. Negotiation possible with concessions.';
    } else if (exists) {
      negotiationPotential = 'Narrow ZOPA detected. Careful negotiation required.';
    } else {
      negotiationPotential = 'No ZOPA detected. Significant gaps in constraints.';
    }

    return { exists, overlapScore, negotiationPotential };
  }

  /**
   * Generate suggested negotiation parameters based on matching intents.
   */
  private generateNegotiationParams(
    needIntent: AgentIntent,
    offerIntent: AgentIntent,
  ): SuggestedNegotiationParams {
    const params: SuggestedNegotiationParams = {
      issues: [],
    };

    // Price range
    if (needIntent.constraints.maxCost !== undefined || offerIntent.constraints.maxCost !== undefined) {
      params.issues.push('pricing');
      const needMax = needIntent.constraints.maxCost ?? Infinity;
      const offerMax = offerIntent.constraints.maxCost ?? 0;
      params.suggestedPriceRange = {
        min: Math.min(offerMax, needMax),
        max: Math.max(offerMax, needMax),
      };
    }

    // Deadline
    if (needIntent.constraints.deadline || offerIntent.constraints.deadline) {
      params.issues.push('timeline');
      params.suggestedDeadline = needIntent.constraints.deadline ?? offerIntent.constraints.deadline;
    }

    // Capability gaps become negotiation issues
    const requiredSet = new Set(needIntent.capabilities.required);
    const offeredSet = new Set([
      ...offerIntent.capabilities.required,
      ...offerIntent.capabilities.preferred,
    ]);
    for (const cap of requiredSet) {
      if (!offeredSet.has(cap)) {
        params.issues.push(`capability:${cap}`);
      }
    }

    if (params.issues.length === 0) {
      params.issues.push('terms');
    }

    return params;
  }

  // ──────────────────────────────────────────
  // Matchmaking Sessions
  // ──────────────────────────────────────────

  /**
   * Start a matchmaking session for an intent.
   * Finds initial candidates and returns a session.
   */
  startMatchmaking(
    intentId: string,
    config?: Partial<MatchmakingConfig>,
  ): MatchmakingSession {
    const intent = this.index.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }

    const effectiveConfig: MatchmakingConfig = {
      ...DEFAULT_MATCHMAKING_CONFIG,
      ...config,
    };

    const sessionId = generateId('mses');

    // Find initial candidates
    const matches = this.findMatches(intentId, {
      maxResults: effectiveConfig.maxCandidates,
      minScore: effectiveConfig.similarityThreshold,
    });

    const session: MatchmakingSession = {
      id: sessionId,
      initiatorIntentId: intentId,
      candidates: matches,
      status: matches.length > 0 ? 'candidates_found' : 'searching',
      rounds: 1,
      createdAt: now(),
    };

    this.sessions.set(sessionId, session);

    this.recordAudit('session_started', {
      candidateCount: matches.length,
      config: effectiveConfig,
    }, intent.agentId, intentId, undefined, sessionId);

    return session;
  }

  /**
   * Refine a matchmaking session based on agent feedback.
   * Liked matches are boosted, disliked matches are removed,
   * and new candidates may be discovered.
   */
  refineMatchmaking(sessionId: string, feedback: MatchmakingFeedback): MatchmakingSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status === 'completed' || session.status === 'abandoned') {
      throw new Error(`Session already in terminal status: ${session.status}`);
    }

    const likedSet = new Set(feedback.liked);
    const dislikedSet = new Set(feedback.disliked);

    // Remove disliked candidates
    session.candidates = session.candidates.filter(m => !dislikedSet.has(m.id));

    // Boost liked candidates
    for (const match of session.candidates) {
      if (likedSet.has(match.id)) {
        match.overallScore = Math.min(1.0, match.overallScore * 1.15);
      }
    }

    // Re-sort by score
    session.candidates.sort((a, b) => b.overallScore - a.overallScore);

    session.rounds += 1;
    session.status = 'refining';

    this.recordAudit('session_refined', {
      liked: feedback.liked.length,
      disliked: feedback.disliked.length,
      remaining: session.candidates.length,
    }, undefined, session.initiatorIntentId, undefined, sessionId);

    return session;
  }

  /**
   * Select a match from a matchmaking session.
   * Marks the match as accepted and transitions session to selected.
   */
  selectMatch(sessionId: string, matchId: string): MatchmakingSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const match = session.candidates.find(m => m.id === matchId);
    if (!match) {
      throw new Error(`Match not found in session: ${matchId}`);
    }

    match.status = 'accepted';
    session.selectedMatchId = matchId;
    session.status = 'selected';

    // Update the match in the global matches map too
    const globalMatch = this.matches.get(matchId);
    if (globalMatch) {
      globalMatch.status = 'accepted';
    }

    this.recordAudit('session_selected', {
      matchId,
      score: match.overallScore,
    }, undefined, session.initiatorIntentId, matchId, sessionId);

    return session;
  }

  /**
   * Retrieve a matchmaking session by ID.
   */
  getSession(sessionId: string): MatchmakingSession | undefined {
    return this.sessions.get(sessionId);
  }

  // ──────────────────────────────────────────
  // Subscriptions
  // ──────────────────────────────────────────

  /**
   * Register a subscription for real-time match notifications.
   */
  subscribe(params: {
    agentId: string;
    filter: SubscriptionFilter;
    callbackUrl: string;
  }): IntentSubscription {
    const id = generateId('isub');
    const subscription: IntentSubscription = {
      id,
      agentId: params.agentId,
      filter: params.filter,
      callbackUrl: params.callbackUrl,
      active: true,
      createdAt: now(),
    };

    this.subscriptions.set(id, subscription);

    this.recordAudit('subscription_created', {
      filter: params.filter,
      callbackUrl: params.callbackUrl,
    }, params.agentId);

    return subscription;
  }

  /**
   * Remove a subscription.
   */
  unsubscribe(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;

    sub.active = false;
    this.subscriptions.delete(subscriptionId);

    this.recordAudit('subscription_removed', {}, sub.agentId);

    return true;
  }

  /**
   * When a new intent is published, check it against all active
   * subscriptions and notify matching subscribers.
   */
  notifySubscribers(intent: AgentIntent): void {
    for (const [, subscription] of this.subscriptions) {
      if (!subscription.active) continue;
      if (subscription.agentId === intent.agentId) continue;

      if (this.processSubscriptionMatch(subscription, intent)) {
        // In production, this would make an HTTP POST to callbackUrl
        this.notificationLog.push({
          subscriptionId: subscription.id,
          intentId: intent.id,
          timestamp: now(),
        });

        this.recordAudit('match_notified', {
          subscriptionId: subscription.id,
          intentId: intent.id,
        }, subscription.agentId, intent.id);
      }
    }
  }

  /**
   * Evaluate whether an intent matches a subscription's filter.
   */
  processSubscriptionMatch(subscription: IntentSubscription, intent: AgentIntent): boolean {
    const filter = subscription.filter;

    if (filter.domain && intent.domain !== filter.domain) return false;
    if (filter.subdomain && intent.subdomain !== filter.subdomain) return false;
    if (filter.intentTypes && filter.intentTypes.length > 0) {
      if (!filter.intentTypes.includes(intent.type)) return false;
    }

    if (filter.requiredCapabilities && filter.requiredCapabilities.length > 0) {
      const allCaps = new Set([
        ...intent.capabilities.required,
        ...intent.capabilities.preferred,
      ]);
      const hasAll = filter.requiredCapabilities.every(c => allCaps.has(c));
      if (!hasAll) return false;
    }

    // MinScore filter is applied at match time, not subscription filter time
    // since we need two intents to compute a score

    return true;
  }

  /**
   * Get the notification log (useful for testing).
   */
  getNotificationLog(): { subscriptionId: string; intentId: string; timestamp: string }[] {
    return [...this.notificationLog];
  }

  // ──────────────────────────────────────────
  // Semantic Profiles
  // ──────────────────────────────────────────

  /**
   * Build a semantic profile for an agent from their intent history.
   */
  buildSemanticProfile(agentId: string): SemanticProfile {
    const agentIntentIds = this.index.agentIndex.get(agentId);
    const intents: AgentIntent[] = [];
    if (agentIntentIds) {
      for (const id of agentIntentIds) {
        const intent = this.index.intents.get(id);
        if (intent) intents.push(intent);
      }
    }

    // Build domain expertise
    const domainMap = new Map<string, { intentCount: number; matchCount: number; totalScore: number }>();
    for (const intent of intents) {
      const existing = domainMap.get(intent.domain) ?? { intentCount: 0, matchCount: 0, totalScore: 0 };
      existing.intentCount++;
      domainMap.set(intent.domain, existing);
    }

    // Count matches per domain
    for (const [, match] of this.matches) {
      if (match.needAgentId === agentId || match.offerAgentId === agentId) {
        const intentId = match.needAgentId === agentId ? match.needIntentId : match.offerIntentId;
        const intent = this.index.intents.get(intentId);
        if (intent) {
          const existing = domainMap.get(intent.domain) ?? { intentCount: 0, matchCount: 0, totalScore: 0 };
          existing.matchCount++;
          existing.totalScore += match.overallScore;
          domainMap.set(intent.domain, existing);
        }
      }
    }

    const domains: DomainExpertise[] = [];
    for (const [domain, stats] of domainMap) {
      domains.push({
        domain,
        intentCount: stats.intentCount,
        matchCount: stats.matchCount,
        averageScore: stats.matchCount > 0 ? stats.totalScore / stats.matchCount : 0,
      });
    }

    // Extract strengths from frequently offered capabilities
    const capabilityFreq = new Map<string, number>();
    for (const intent of intents) {
      if (intent.type === 'offer' || intent.type === 'collaboration') {
        for (const cap of intent.capabilities.required) {
          capabilityFreq.set(cap, (capabilityFreq.get(cap) ?? 0) + 1);
        }
      }
    }
    const strengths = Array.from(capabilityFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cap]) => cap);

    // Build interaction history
    const interactionMap = new Map<string, { matchCount: number; totalScore: number; lastInteraction: string }>();
    for (const [, match] of this.matches) {
      let partnerId: string | undefined;
      if (match.needAgentId === agentId) partnerId = match.offerAgentId;
      if (match.offerAgentId === agentId) partnerId = match.needAgentId;
      if (!partnerId) continue;

      const existing = interactionMap.get(partnerId) ?? { matchCount: 0, totalScore: 0, lastInteraction: match.createdAt };
      existing.matchCount++;
      existing.totalScore += match.overallScore;
      if (match.createdAt > existing.lastInteraction) {
        existing.lastInteraction = match.createdAt;
      }
      interactionMap.set(partnerId, existing);
    }

    const interactionHistory: InteractionRecord[] = [];
    for (const [partnerId, stats] of interactionMap) {
      interactionHistory.push({
        agentId: partnerId,
        matchCount: stats.matchCount,
        averageScore: stats.totalScore / stats.matchCount,
        lastInteraction: stats.lastInteraction,
      });
    }

    // Preferred partners = top scoring interactions
    const preferredPartners = interactionHistory
      .filter(r => r.averageScore > 0.7 && r.matchCount >= 2)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5)
      .map(r => r.agentId);

    const profile: SemanticProfile = {
      agentId,
      domains,
      strengths,
      interactionHistory,
      preferredPartners,
      avoidList: [],
      updatedAt: now(),
    };

    this.profiles.set(agentId, profile);
    return profile;
  }

  /**
   * Retrieve a semantic profile for an agent.
   */
  getSemanticProfile(agentId: string): SemanticProfile | undefined {
    return this.profiles.get(agentId);
  }

  /**
   * Find agents with similar semantic profiles.
   */
  findSimilarAgents(agentId: string, limit: number = 10): { agentId: string; similarity: number }[] {
    const sourceProfile = this.profiles.get(agentId);
    if (!sourceProfile) {
      // Build it on the fly
      this.buildSemanticProfile(agentId);
    }

    const sourceDomains = new Set(
      (this.profiles.get(agentId)?.domains ?? []).map(d => d.domain),
    );

    const candidates: { agentId: string; similarity: number }[] = [];

    for (const [otherAgentId, profile] of this.profiles) {
      if (otherAgentId === agentId) continue;

      const otherDomains = new Set(profile.domains.map(d => d.domain));

      // Jaccard similarity on domains
      const intersection = new Set([...sourceDomains].filter(d => otherDomains.has(d)));
      const union = new Set([...sourceDomains, ...otherDomains]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      if (similarity > 0) {
        candidates.push({ agentId: otherAgentId, similarity });
      }
    }

    candidates.sort((a, b) => b.similarity - a.similarity);
    return candidates.slice(0, limit);
  }

  // ──────────────────────────────────────────
  // Cross-Federation
  // ──────────────────────────────────────────

  /**
   * Propagate an intent to specified federation IDs.
   * In production, this would make HTTP calls to federation endpoints.
   */
  propagateIntent(
    intentId: string,
    federationIds: string[],
  ): { propagated: string[]; failed: string[] } {
    const intent = this.index.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }

    if (intent.privacyLevel === 'private') {
      throw new Error('Cannot propagate private intents across federations');
    }

    const propagated: string[] = [];
    const failed: string[] = [];

    for (const fedId of federationIds) {
      // Simulate propagation (in production, HTTP POST to federation)
      propagated.push(fedId);
    }

    this.recordAudit('intent_propagated', {
      federationIds: propagated,
    }, intent.agentId, intentId);

    return { propagated, failed };
  }

  /**
   * Import an intent from another federation.
   */
  importFederatedIntent(
    intentReq: PublishIntentRequest,
    sourceFederationId: string,
  ): AgentIntent {
    const intent = this.publishIntent(intentReq);

    const federated: FederatedIntent = {
      intent,
      sourceFederationId,
      importedAt: now(),
    };
    this.federatedIntents.set(intent.id, federated);

    intent.metadata = {
      ...intent.metadata,
      federated: true,
      sourceFederationId,
    };

    this.recordAudit('intent_imported', {
      sourceFederationId,
    }, intent.agentId, intent.id);

    return intent;
  }

  /**
   * Search for intents across federations.
   * Returns both local and federated results.
   */
  federatedSearch(
    intentId: string,
    _federationIds: string[],
  ): IntentMatch[] {
    // For now, return local matches only.
    // In production, would fan out HTTP requests to federation peers.
    return this.findMatches(intentId);
  }

  // ──────────────────────────────────────────
  // Privacy
  // ──────────────────────────────────────────

  /**
   * Filter a list of intents based on privacy levels and
   * the requesting agent's identity.
   */
  filterByPrivacy(intents: AgentIntent[], requestingAgentId: string): AgentIntent[] {
    return intents.filter(intent => {
      // Always visible to the owner
      if (intent.agentId === requestingAgentId) return true;

      switch (intent.privacyLevel) {
        case 'public':
          return true;
        case 'authenticated':
          // In production, would check if requestingAgentId is authenticated
          return requestingAgentId.length > 0;
        case 'selective':
          // In production, would check selective disclosure rules
          // For now, allow if the requesting agent has interacted with the intent owner
          return this.hasInteractionHistory(intent.agentId, requestingAgentId);
        case 'private':
          return false;
        default:
          return false;
      }
    });
  }

  /**
   * Generate a privacy-respecting view of an intent for a specific viewer.
   * Redacts sensitive fields based on privacy level.
   */
  generateSelectiveDisclosure(
    intentId: string,
    viewerAgentId: string,
  ): Partial<AgentIntent> | null {
    const intent = this.index.intents.get(intentId);
    if (!intent) return null;

    // Owner sees everything
    if (intent.agentId === viewerAgentId) {
      return { ...intent };
    }

    switch (intent.privacyLevel) {
      case 'public':
        return { ...intent };

      case 'authenticated':
        // Hide detailed constraints
        return {
          id: intent.id,
          agentId: intent.agentId,
          type: intent.type,
          status: intent.status,
          domain: intent.domain,
          subdomain: intent.subdomain,
          semanticDescription: intent.semanticDescription,
          capabilities: intent.capabilities,
          privacyLevel: intent.privacyLevel,
          createdAt: intent.createdAt,
          expiresAt: intent.expiresAt,
          metadata: {},
          semanticEmbedding: [],
          constraints: {},
          matchPreferences: {
            prioritizeSpeed: 0.25,
            prioritizeCost: 0.25,
            prioritizeQuality: 0.25,
            prioritizeTrust: 0.25,
          },
          ttl: intent.ttl,
        };

      case 'selective':
        // Minimal disclosure
        return {
          id: intent.id,
          type: intent.type,
          status: intent.status,
          domain: intent.domain,
          subdomain: intent.subdomain,
          privacyLevel: intent.privacyLevel,
          createdAt: intent.createdAt,
          expiresAt: intent.expiresAt,
        };

      case 'private':
        return null;

      default:
        return null;
    }
  }

  /**
   * Check if two agents have prior interaction history.
   */
  private hasInteractionHistory(agentId1: string, agentId2: string): boolean {
    for (const [, match] of this.matches) {
      if (
        (match.needAgentId === agentId1 && match.offerAgentId === agentId2) ||
        (match.needAgentId === agentId2 && match.offerAgentId === agentId1)
      ) {
        return true;
      }
    }
    return false;
  }

  // ──────────────────────────────────────────
  // Search
  // ──────────────────────────────────────────

  /**
   * Search intents with structured filters.
   */
  searchIntents(params: SearchIntentsRequest): { intents: AgentIntent[]; total: number } {
    let results: AgentIntent[] = [];

    if (params.domain) {
      const domainIds = this.index.domainIndex.get(params.domain);
      if (domainIds) {
        for (const id of domainIds) {
          const intent = this.index.intents.get(id);
          if (intent && intent.status === 'active') {
            results.push(intent);
          }
        }
      }
    } else {
      for (const [, intent] of this.index.intents) {
        if (intent.status === 'active') {
          results.push(intent);
        }
      }
    }

    // Apply filters
    if (params.subdomain) {
      results = results.filter(i => i.subdomain === params.subdomain);
    }
    if (params.type) {
      results = results.filter(i => i.type === params.type);
    }
    if (params.capabilities && params.capabilities.length > 0) {
      const requiredCaps = new Set(params.capabilities);
      results = results.filter(i => {
        const allCaps = new Set([
          ...i.capabilities.required,
          ...i.capabilities.preferred,
        ]);
        return [...requiredCaps].every(c => allCaps.has(c));
      });
    }
    if (params.minTrustLevel !== undefined) {
      results = results.filter(i =>
        i.constraints.minTrustLevel === undefined ||
        i.constraints.minTrustLevel >= params.minTrustLevel!,
      );
    }
    if (params.maxCost !== undefined) {
      results = results.filter(i =>
        i.constraints.maxCost === undefined ||
        i.constraints.maxCost <= params.maxCost!,
      );
    }

    // Simple text search on semantic description
    if (params.query) {
      const queryLower = params.query.toLowerCase();
      results = results.filter(i =>
        i.semanticDescription.toLowerCase().includes(queryLower) ||
        i.domain.toLowerCase().includes(queryLower) ||
        i.subdomain.toLowerCase().includes(queryLower),
      );
    }

    const total = results.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 20;

    return {
      intents: results.slice(offset, offset + limit),
      total,
    };
  }

  // ──────────────────────────────────────────
  // Match Management
  // ──────────────────────────────────────────

  /**
   * Get a match by ID.
   */
  getMatch(matchId: string): IntentMatch | undefined {
    return this.matches.get(matchId);
  }

  /**
   * Update a match status.
   */
  updateMatchStatus(matchId: string, status: MatchStatus): IntentMatch {
    const match = this.matches.get(matchId);
    if (!match) {
      throw new Error(`Match not found: ${matchId}`);
    }
    match.status = status;
    return match;
  }

  // ──────────────────────────────────────────
  // Audit Access
  // ──────────────────────────────────────────

  /**
   * Get the full audit log.
   */
  getAuditLog(): IntentAuditEntry[] {
    return [...this.auditLog];
  }

  // ──────────────────────────────────────────
  // Reset (for testing)
  // ──────────────────────────────────────────

  /**
   * Reset all internal state. Used for testing only.
   */
  _resetStores(): void {
    this.index = {
      intents: new Map(),
      domainIndex: new Map(),
      agentIndex: new Map(),
      expirationQueue: [],
    };
    this.matches = new Map();
    this.sessions = new Map();
    this.subscriptions = new Map();
    this.profiles = new Map();
    this.federatedIntents = new Map();
    this.auditLog = [];
    this.notificationLog = [];
  }
}

// ──────────────────────────────────────────────
// Singleton instance for API routes
// ──────────────────────────────────────────────

export const intentDiscoveryEngine = new IntentDiscoveryEngine();
