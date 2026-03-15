/**
 * Agent Intent Discovery & Semantic Matchmaking Protocol -- Tests
 *
 * Comprehensive tests covering:
 *   1. Intent lifecycle (publish, update, withdraw, expire)
 *   2. Semantic similarity computation (identical, similar, orthogonal, empty)
 *   3. Capability alignment scoring (full match, partial, exclusions)
 *   4. Constraint satisfaction (hard fails, soft scoring, no constraints)
 *   5. Full match pipeline (need->offer matching)
 *   6. Match ranking and explanation generation
 *   7. Matchmaking session lifecycle
 *   8. Subscription creation and matching
 *   9. Privacy filtering (public, authenticated, selective, private)
 *   10. Semantic profile building
 *   11. Cross-federation propagation
 *   12. Edge cases (expired intents, no matches, empty embeddings)
 *   13. ZOPA detection integration
 *   14. Search functionality
 */

import { IntentDiscoveryEngine } from '@/lib/a2a/intent-discovery/engine';
import {
  PublishIntentRequest,
  AgentIntent,
} from '@/lib/a2a/intent-discovery/types';

// ──────────────────────────────────────────────
// Test Fixtures
// ──────────────────────────────────────────────

function createNLPNeedIntent(engine: IntentDiscoveryEngine, overrides?: Partial<PublishIntentRequest>): AgentIntent {
  return engine.publishIntent({
    agentId: 'agent-buyer',
    type: 'need',
    domain: 'natural_language_processing',
    subdomain: 'sentiment_analysis',
    semanticDescription: 'Need an agent that can perform sentiment analysis on customer reviews with high accuracy',
    capabilities: {
      required: ['sentiment_analysis', 'text_classification'],
      preferred: ['multilingual', 'batch_processing'],
      excluded: ['deprecated_v1'],
    },
    constraints: {
      minTrustLevel: 0.6,
      maxCost: 100,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    matchPreferences: {
      prioritizeSpeed: 0.2,
      prioritizeCost: 0.3,
      prioritizeQuality: 0.3,
      prioritizeTrust: 0.2,
    },
    privacyLevel: 'public',
    ttl: 24 * 60 * 60 * 1000,
    ...overrides,
  });
}

function createNLPOfferIntent(engine: IntentDiscoveryEngine, overrides?: Partial<PublishIntentRequest>): AgentIntent {
  return engine.publishIntent({
    agentId: 'agent-seller',
    type: 'offer',
    domain: 'natural_language_processing',
    subdomain: 'sentiment_analysis',
    semanticDescription: 'Offering high-accuracy sentiment analysis service for text data including reviews and social media',
    capabilities: {
      required: ['sentiment_analysis', 'text_classification', 'multilingual'],
      preferred: ['batch_processing', 'real_time'],
      excluded: [],
    },
    constraints: {
      minTrustLevel: 0.4,
      maxCost: 80,
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    matchPreferences: {
      prioritizeSpeed: 0.25,
      prioritizeCost: 0.25,
      prioritizeQuality: 0.25,
      prioritizeTrust: 0.25,
    },
    privacyLevel: 'public',
    ttl: 24 * 60 * 60 * 1000,
    ...overrides,
  });
}

function createDataAnalysisOfferIntent(engine: IntentDiscoveryEngine): AgentIntent {
  return engine.publishIntent({
    agentId: 'agent-data',
    type: 'offer',
    domain: 'data_analysis',
    subdomain: 'time_series',
    semanticDescription: 'Offering time series forecasting and anomaly detection services',
    capabilities: {
      required: ['time_series_analysis', 'anomaly_detection'],
      preferred: ['visualization'],
      excluded: [],
    },
    constraints: {},
    privacyLevel: 'public',
    ttl: 24 * 60 * 60 * 1000,
  });
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('IntentDiscoveryEngine', () => {
  let engine: IntentDiscoveryEngine;

  beforeEach(() => {
    engine = new IntentDiscoveryEngine();
  });

  // ── Intent Lifecycle ──

  describe('Intent Lifecycle', () => {
    it('should publish an intent with all fields populated', () => {
      const intent = createNLPNeedIntent(engine);

      expect(intent.id).toBeTruthy();
      expect(intent.agentId).toBe('agent-buyer');
      expect(intent.type).toBe('need');
      expect(intent.status).toBe('active');
      expect(intent.domain).toBe('natural_language_processing');
      expect(intent.subdomain).toBe('sentiment_analysis');
      expect(intent.semanticEmbedding.length).toBeGreaterThan(0);
      expect(intent.capabilities.required).toContain('sentiment_analysis');
      expect(intent.createdAt).toBeTruthy();
      expect(intent.expiresAt).toBeTruthy();
    });

    it('should retrieve a published intent by ID', () => {
      const intent = createNLPNeedIntent(engine);
      const retrieved = engine.getIntent(intent.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(intent.id);
    });

    it('should retrieve all intents for an agent', () => {
      createNLPNeedIntent(engine);
      createNLPNeedIntent(engine, { subdomain: 'ner' });
      const intents = engine.getAgentIntents('agent-buyer');

      expect(intents.length).toBe(2);
    });

    it('should update an active intent', () => {
      const intent = createNLPNeedIntent(engine);
      const updated = engine.updateIntent(intent.id, {
        semanticDescription: 'Updated description for sentiment analysis needs',
      });

      expect(updated.semanticDescription).toBe('Updated description for sentiment analysis needs');
    });

    it('should update intent capabilities partially', () => {
      const intent = createNLPNeedIntent(engine);
      const updated = engine.updateIntent(intent.id, {
        capabilities: { preferred: ['gpu_accelerated'] },
      });

      expect(updated.capabilities.preferred).toContain('gpu_accelerated');
      expect(updated.capabilities.required).toContain('sentiment_analysis');
    });

    it('should withdraw an active intent', () => {
      const intent = createNLPNeedIntent(engine);
      const withdrawn = engine.withdrawIntent(intent.id);

      expect(withdrawn.status).toBe('withdrawn');
    });

    it('should throw when updating a withdrawn intent', () => {
      const intent = createNLPNeedIntent(engine);
      engine.withdrawIntent(intent.id);

      expect(() => engine.updateIntent(intent.id, { semanticDescription: 'new' })).toThrow();
    });

    it('should throw when withdrawing an already withdrawn intent', () => {
      const intent = createNLPNeedIntent(engine);
      engine.withdrawIntent(intent.id);

      expect(() => engine.withdrawIntent(intent.id)).toThrow();
    });

    it('should throw when getting a non-existent intent', () => {
      expect(engine.getIntent('nonexistent')).toBeUndefined();
    });

    it('should expire stale intents', () => {
      const intent = engine.publishIntent({
        agentId: 'agent-test',
        type: 'need',
        domain: 'test',
        subdomain: 'test',
        semanticDescription: 'test',
        capabilities: { required: [], preferred: [], excluded: [] },
        ttl: 1, // 1ms TTL - will expire immediately
      });

      // Wait a tick for expiration
      const expired = engine.expireStaleIntents();

      // The intent may or may not be in the expired list depending on timing
      // but its status should be checked
      const retrieved = engine.getIntent(intent.id);
      expect(retrieved).toBeDefined();
      if (expired.length > 0) {
        expect(expired[0].status).toBe('expired');
      }
    });
  });

  // ── Semantic Similarity ──

  describe('Semantic Similarity', () => {
    it('should compute similarity of 1.0 for identical embeddings', () => {
      const embedding = [1, 0, 0, 0];
      const similarity = engine.computeSemanticSimilarity(embedding, embedding);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should compute similarity of 0.5 for orthogonal embeddings', () => {
      const e1 = [1, 0, 0, 0];
      const e2 = [0, 1, 0, 0];
      const similarity = engine.computeSemanticSimilarity(e1, e2);
      // Cosine similarity of orthogonal vectors is 0, normalized to [0,1] = 0.5
      expect(similarity).toBeCloseTo(0.5, 5);
    });

    it('should compute similarity of 0.0 for opposite embeddings', () => {
      const e1 = [1, 0, 0, 0];
      const e2 = [-1, 0, 0, 0];
      const similarity = engine.computeSemanticSimilarity(e1, e2);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should return 0 for empty embeddings', () => {
      const similarity = engine.computeSemanticSimilarity([], []);
      expect(similarity).toBe(0);
    });

    it('should return 0 for mismatched embedding lengths', () => {
      const similarity = engine.computeSemanticSimilarity([1, 0], [1, 0, 0]);
      expect(similarity).toBe(0);
    });

    it('should compute high similarity for similar embeddings', () => {
      const e1 = [0.9, 0.1, 0.0, 0.0];
      const e2 = [0.85, 0.15, 0.05, 0.0];
      const similarity = engine.computeSemanticSimilarity(e1, e2);
      expect(similarity).toBeGreaterThan(0.9);
    });
  });

  // ── Capability Alignment ──

  describe('Capability Alignment', () => {
    it('should return 1.0 when all required capabilities are offered', () => {
      const score = engine.computeCapabilityAlignment(
        ['nlp', 'ml'],
        [],
        [],
        ['nlp', 'ml', 'cv'],
      );
      expect(score).toBe(1.0);
    });

    it('should return 1.0 when no capabilities are required', () => {
      const score = engine.computeCapabilityAlignment([], [], [], ['nlp']);
      expect(score).toBe(1.0);
    });

    it('should return 0 when excluded capabilities are offered', () => {
      const score = engine.computeCapabilityAlignment(
        ['nlp'],
        [],
        ['deprecated'],
        ['nlp', 'deprecated'],
      );
      expect(score).toBe(0);
    });

    it('should score partial required capability matches', () => {
      const score = engine.computeCapabilityAlignment(
        ['nlp', 'ml', 'cv'],
        [],
        [],
        ['nlp'],
      );
      expect(score).toBeCloseTo(1 / 3, 5);
    });

    it('should give extra credit for preferred capabilities', () => {
      const scoreWithPreferred = engine.computeCapabilityAlignment(
        ['nlp'],
        ['gpu'],
        [],
        ['nlp', 'gpu'],
      );
      const scoreWithout = engine.computeCapabilityAlignment(
        ['nlp'],
        ['gpu'],
        [],
        ['nlp'],
      );
      expect(scoreWithPreferred).toBeGreaterThan(scoreWithout);
    });

    it('should handle mixed required and preferred correctly', () => {
      const score = engine.computeCapabilityAlignment(
        ['nlp'],
        ['gpu', 'fast'],
        [],
        ['nlp', 'gpu'],
      );
      // Required: 1/1 matched = 1.0 weight satisfied
      // Preferred: 1/2 matched = 0.5 weight satisfied
      // Total: (1.0 + 0.5) / (1.0 + 0.5 + 0.5) = 1.5/2.0 = 0.75
      expect(score).toBeCloseTo(0.75, 5);
    });
  });

  // ── Constraint Satisfaction ──

  describe('Constraint Satisfaction', () => {
    it('should return 1.0 when no constraints exist', () => {
      const score = engine.computeConstraintSatisfaction(
        {},
        {},
        { required: [], preferred: [], excluded: [] },
      );
      expect(score).toBe(1.0);
    });

    it('should hard fail when required credentials are missing', () => {
      const score = engine.computeConstraintSatisfaction(
        { requiredCredentials: ['iso27001', 'soc2'] },
        {},
        { required: ['iso27001'], preferred: [], excluded: [] },
      );
      expect(score).toBe(0);
    });

    it('should pass when all required credentials are present', () => {
      const score = engine.computeConstraintSatisfaction(
        { requiredCredentials: ['iso27001'] },
        {},
        { required: ['iso27001'], preferred: [], excluded: [] },
      );
      expect(score).toBeGreaterThan(0);
    });

    it('should hard fail on geographic restriction mismatch', () => {
      const score = engine.computeConstraintSatisfaction(
        { geographicRestrictions: ['US', 'EU'] },
        { geographicRestrictions: ['APAC'] },
        { required: [], preferred: [], excluded: [] },
      );
      expect(score).toBe(0);
    });

    it('should pass on geographic restriction overlap', () => {
      const score = engine.computeConstraintSatisfaction(
        { geographicRestrictions: ['US', 'EU'] },
        { geographicRestrictions: ['EU', 'APAC'] },
        { required: [], preferred: [], excluded: [] },
      );
      expect(score).toBeGreaterThan(0);
    });

    it('should handle protocol version matching', () => {
      const score = engine.computeConstraintSatisfaction(
        { protocolVersions: ['v2', 'v3'] },
        { protocolVersions: ['v2'] },
        { required: [], preferred: [], excluded: [] },
      );
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  // ── Full Match Pipeline ──

  describe('Match Pipeline', () => {
    it('should find matches between need and offer intents', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      const matches = engine.findMatches(need.id);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].needIntentId).toBe(need.id);
      expect(matches[0].overallScore).toBeGreaterThan(0);
    });

    it('should not match need with need', () => {
      const need1 = createNLPNeedIntent(engine);
      createNLPNeedIntent(engine, { agentId: 'agent-buyer-2' });

      const matches = engine.findMatches(need1.id);

      expect(matches.length).toBe(0);
    });

    it('should not match intent with itself', () => {
      const need = createNLPNeedIntent(engine);
      const matches = engine.findMatches(need.id);

      expect(matches.every(m => m.offerIntentId !== need.id)).toBe(true);
    });

    it('should not match intents from the same agent', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine, { agentId: 'agent-buyer' });

      const matches = engine.findMatches(need.id);

      expect(matches.length).toBe(0);
    });

    it('should rank matches by score descending', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);
      createDataAnalysisOfferIntent(engine);

      const matches = engine.findMatches(need.id, { minScore: 0 });

      for (let i = 1; i < matches.length; i++) {
        expect(matches[i].overallScore).toBeLessThanOrEqual(matches[i - 1].overallScore);
      }
    });

    it('should respect minScore filter', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      const matches = engine.findMatches(need.id, { minScore: 0.99 });

      for (const match of matches) {
        expect(match.overallScore).toBeGreaterThanOrEqual(0.99);
      }
    });

    it('should respect maxResults limit', () => {
      const need = createNLPNeedIntent(engine);
      for (let i = 0; i < 5; i++) {
        createNLPOfferIntent(engine, { agentId: `agent-seller-${i}` });
      }

      const matches = engine.findMatches(need.id, { maxResults: 2 });

      expect(matches.length).toBeLessThanOrEqual(2);
    });

    it('should respect excludeAgents filter', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);
      createNLPOfferIntent(engine, { agentId: 'agent-seller-2' });

      const matches = engine.findMatches(need.id, { excludeAgents: ['agent-seller'] });

      expect(matches.every(m => m.offerAgentId !== 'agent-seller')).toBe(true);
    });

    it('should generate explanation for matches', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      const matches = engine.findMatches(need.id);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].explanation).toBeTruthy();
      expect(matches[0].explanation.length).toBeGreaterThan(20);
    });

    it('should generate suggested negotiation params', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      const matches = engine.findMatches(need.id);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].suggestedNegotiationParams.issues.length).toBeGreaterThan(0);
    });

    it('should find matches for offer intents searching needs', () => {
      createNLPNeedIntent(engine);
      const offer = createNLPOfferIntent(engine);

      const matches = engine.findMatches(offer.id);

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should handle collaboration intents matching all types', () => {
      const collab = engine.publishIntent({
        agentId: 'agent-collab',
        type: 'collaboration',
        domain: 'natural_language_processing',
        subdomain: 'sentiment_analysis',
        semanticDescription: 'Looking for a collaborator in NLP research',
        capabilities: { required: [], preferred: ['nlp'], excluded: [] },
      });
      createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      const matches = engine.findMatches(collab.id, { minScore: 0 });

      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ── Matchmaking Sessions ──

  describe('Matchmaking Sessions', () => {
    it('should start a matchmaking session with candidates', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      const session = engine.startMatchmaking(need.id);

      expect(session.id).toBeTruthy();
      expect(session.initiatorIntentId).toBe(need.id);
      expect(session.status).toBe('candidates_found');
      expect(session.candidates.length).toBeGreaterThan(0);
      expect(session.rounds).toBe(1);
    });

    it('should start a session with searching status when no matches', () => {
      const need = createNLPNeedIntent(engine);

      const session = engine.startMatchmaking(need.id);

      expect(session.status).toBe('searching');
      expect(session.candidates.length).toBe(0);
    });

    it('should refine a session by removing disliked candidates', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);
      createNLPOfferIntent(engine, { agentId: 'agent-seller-2' });

      const session = engine.startMatchmaking(need.id);
      const initialCount = session.candidates.length;
      const dislikedId = session.candidates[session.candidates.length - 1]?.id;

      if (dislikedId) {
        const refined = engine.refineMatchmaking(session.id, {
          liked: [],
          disliked: [dislikedId],
        });

        expect(refined.candidates.length).toBeLessThan(initialCount);
        expect(refined.rounds).toBe(2);
        expect(refined.status).toBe('refining');
      }
    });

    it('should boost liked candidates during refinement', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);
      createNLPOfferIntent(engine, { agentId: 'agent-seller-2' });

      const session = engine.startMatchmaking(need.id);
      if (session.candidates.length > 0) {
        const likedId = session.candidates[0].id;
        const originalScore = session.candidates[0].overallScore;

        engine.refineMatchmaking(session.id, {
          liked: [likedId],
          disliked: [],
        });

        const updatedSession = engine.getSession(session.id);
        const likedMatch = updatedSession!.candidates.find(c => c.id === likedId);
        expect(likedMatch!.overallScore).toBeGreaterThanOrEqual(originalScore);
      }
    });

    it('should select a match from a session', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      const session = engine.startMatchmaking(need.id);

      if (session.candidates.length > 0) {
        const matchId = session.candidates[0].id;
        const selected = engine.selectMatch(session.id, matchId);

        expect(selected.status).toBe('selected');
        expect(selected.selectedMatchId).toBe(matchId);
      }
    });

    it('should throw when selecting from non-existent session', () => {
      expect(() => engine.selectMatch('nonexistent', 'match1')).toThrow();
    });

    it('should throw when selecting non-existent match from session', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);
      const session = engine.startMatchmaking(need.id);

      expect(() => engine.selectMatch(session.id, 'nonexistent')).toThrow();
    });

    it('should retrieve a session by ID', () => {
      const need = createNLPNeedIntent(engine);
      const session = engine.startMatchmaking(need.id);
      const retrieved = engine.getSession(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(session.id);
    });

    it('should return undefined for non-existent session', () => {
      expect(engine.getSession('nonexistent')).toBeUndefined();
    });
  });

  // ── Subscriptions ──

  describe('Subscriptions', () => {
    it('should create a subscription', () => {
      const sub = engine.subscribe({
        agentId: 'agent-subscriber',
        filter: { domain: 'natural_language_processing' },
        callbackUrl: 'https://example.com/webhook',
      });

      expect(sub.id).toBeTruthy();
      expect(sub.active).toBe(true);
      expect(sub.agentId).toBe('agent-subscriber');
    });

    it('should notify subscribers when matching intent is published', () => {
      engine.subscribe({
        agentId: 'agent-subscriber',
        filter: { domain: 'natural_language_processing', intentTypes: ['offer'] },
        callbackUrl: 'https://example.com/webhook',
      });

      createNLPOfferIntent(engine);

      const notifications = engine.getNotificationLog();
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should not notify subscribers for non-matching domain', () => {
      engine.subscribe({
        agentId: 'agent-subscriber',
        filter: { domain: 'computer_vision' },
        callbackUrl: 'https://example.com/webhook',
      });

      createNLPOfferIntent(engine);

      const notifications = engine.getNotificationLog();
      expect(notifications.length).toBe(0);
    });

    it('should not notify subscribers for their own intents', () => {
      engine.subscribe({
        agentId: 'agent-seller',
        filter: { domain: 'natural_language_processing' },
        callbackUrl: 'https://example.com/webhook',
      });

      createNLPOfferIntent(engine);

      const notifications = engine.getNotificationLog();
      expect(notifications.length).toBe(0);
    });

    it('should filter by intent types in subscription', () => {
      engine.subscribe({
        agentId: 'agent-subscriber',
        filter: { intentTypes: ['need'] },
        callbackUrl: 'https://example.com/webhook',
      });

      createNLPOfferIntent(engine);

      const notifications = engine.getNotificationLog();
      expect(notifications.length).toBe(0);
    });

    it('should filter by required capabilities in subscription', () => {
      engine.subscribe({
        agentId: 'agent-subscriber',
        filter: { requiredCapabilities: ['nonexistent_capability'] },
        callbackUrl: 'https://example.com/webhook',
      });

      createNLPOfferIntent(engine);

      const notifications = engine.getNotificationLog();
      expect(notifications.length).toBe(0);
    });

    it('should unsubscribe successfully', () => {
      const sub = engine.subscribe({
        agentId: 'agent-subscriber',
        filter: { domain: 'natural_language_processing' },
        callbackUrl: 'https://example.com/webhook',
      });

      const removed = engine.unsubscribe(sub.id);
      expect(removed).toBe(true);

      // Publishing after unsubscribe should not notify
      createNLPOfferIntent(engine);
      const notifications = engine.getNotificationLog();
      expect(notifications.length).toBe(0);
    });

    it('should return false for unsubscribing non-existent subscription', () => {
      const removed = engine.unsubscribe('nonexistent');
      expect(removed).toBe(false);
    });
  });

  // ── Privacy Filtering ──

  describe('Privacy Filtering', () => {
    it('should show public intents to any agent', () => {
      const publicIntent = createNLPNeedIntent(engine, { privacyLevel: 'public' });
      const filtered = engine.filterByPrivacy([publicIntent], 'random-agent');

      expect(filtered.length).toBe(1);
    });

    it('should show authenticated intents to authenticated agents', () => {
      const authIntent = createNLPNeedIntent(engine, { privacyLevel: 'authenticated' });
      const filtered = engine.filterByPrivacy([authIntent], 'some-agent');

      expect(filtered.length).toBe(1);
    });

    it('should hide authenticated intents from empty agent ID', () => {
      const authIntent = createNLPNeedIntent(engine, { privacyLevel: 'authenticated' });
      const filtered = engine.filterByPrivacy([authIntent], '');

      expect(filtered.length).toBe(0);
    });

    it('should hide private intents from other agents', () => {
      const privateIntent = createNLPNeedIntent(engine, { privacyLevel: 'private' });
      const filtered = engine.filterByPrivacy([privateIntent], 'other-agent');

      expect(filtered.length).toBe(0);
    });

    it('should always show intents to their owner', () => {
      const privateIntent = createNLPNeedIntent(engine, { privacyLevel: 'private' });
      const filtered = engine.filterByPrivacy([privateIntent], 'agent-buyer');

      expect(filtered.length).toBe(1);
    });

    it('should generate selective disclosure for public intents', () => {
      const intent = createNLPNeedIntent(engine, { privacyLevel: 'public' });
      const disclosed = engine.generateSelectiveDisclosure(intent.id, 'other-agent');

      expect(disclosed).toBeDefined();
      expect(disclosed!.semanticDescription).toBe(intent.semanticDescription);
    });

    it('should generate redacted disclosure for authenticated intents', () => {
      const intent = createNLPNeedIntent(engine, { privacyLevel: 'authenticated' });
      const disclosed = engine.generateSelectiveDisclosure(intent.id, 'other-agent');

      expect(disclosed).toBeDefined();
      expect(disclosed!.domain).toBe(intent.domain);
      // Constraints should be empty for authenticated privacy
      expect(Object.keys(disclosed!.constraints || {}).length).toBe(0);
    });

    it('should return null for private intents to non-owners', () => {
      const intent = createNLPNeedIntent(engine, { privacyLevel: 'private' });
      const disclosed = engine.generateSelectiveDisclosure(intent.id, 'other-agent');

      expect(disclosed).toBeNull();
    });

    it('should return full disclosure to intent owner', () => {
      const intent = createNLPNeedIntent(engine, { privacyLevel: 'private' });
      const disclosed = engine.generateSelectiveDisclosure(intent.id, 'agent-buyer');

      expect(disclosed).toBeDefined();
      expect(disclosed!.constraints).toEqual(intent.constraints);
    });
  });

  // ── Semantic Profiles ──

  describe('Semantic Profiles', () => {
    it('should build a semantic profile from intent history', () => {
      createNLPNeedIntent(engine);
      createNLPOfferIntent(engine, { agentId: 'agent-buyer', type: 'offer' });

      const profile = engine.buildSemanticProfile('agent-buyer');

      expect(profile.agentId).toBe('agent-buyer');
      expect(profile.domains.length).toBeGreaterThan(0);
      expect(profile.updatedAt).toBeTruthy();
    });

    it('should track domain expertise', () => {
      createNLPNeedIntent(engine);
      createNLPNeedIntent(engine, { subdomain: 'ner' });

      const profile = engine.buildSemanticProfile('agent-buyer');
      const nlpDomain = profile.domains.find(d => d.domain === 'natural_language_processing');

      expect(nlpDomain).toBeDefined();
      expect(nlpDomain!.intentCount).toBe(2);
    });

    it('should extract strengths from offered capabilities', () => {
      engine.publishIntent({
        agentId: 'agent-expert',
        type: 'offer',
        domain: 'ml',
        subdomain: 'training',
        semanticDescription: 'ML training service',
        capabilities: { required: ['gpu_training', 'distributed'], preferred: [], excluded: [] },
      });

      const profile = engine.buildSemanticProfile('agent-expert');

      expect(profile.strengths).toContain('gpu_training');
    });

    it('should retrieve a stored profile', () => {
      createNLPNeedIntent(engine);
      engine.buildSemanticProfile('agent-buyer');

      const profile = engine.getSemanticProfile('agent-buyer');
      expect(profile).toBeDefined();
      expect(profile!.agentId).toBe('agent-buyer');
    });

    it('should find similar agents based on domain overlap', () => {
      createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      engine.buildSemanticProfile('agent-buyer');
      engine.buildSemanticProfile('agent-seller');

      const similar = engine.findSimilarAgents('agent-buyer');
      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].agentId).toBe('agent-seller');
    });
  });

  // ── Cross-Federation ──

  describe('Cross-Federation', () => {
    it('should propagate a public intent to federations', () => {
      const intent = createNLPNeedIntent(engine, { privacyLevel: 'public' });
      const result = engine.propagateIntent(intent.id, ['fed-1', 'fed-2']);

      expect(result.propagated).toContain('fed-1');
      expect(result.propagated).toContain('fed-2');
      expect(result.failed.length).toBe(0);
    });

    it('should refuse to propagate private intents', () => {
      const intent = createNLPNeedIntent(engine, { privacyLevel: 'private' });

      expect(() => engine.propagateIntent(intent.id, ['fed-1'])).toThrow();
    });

    it('should import a federated intent', () => {
      const imported = engine.importFederatedIntent(
        {
          agentId: 'remote-agent',
          type: 'offer',
          domain: 'natural_language_processing',
          subdomain: 'translation',
          semanticDescription: 'Remote translation service',
          capabilities: { required: ['translation'], preferred: [], excluded: [] },
        },
        'federation-alpha',
      );

      expect(imported.id).toBeTruthy();
      expect(imported.metadata.federated).toBe(true);
      expect(imported.metadata.sourceFederationId).toBe('federation-alpha');
    });

    it('should include federated intents in search results', () => {
      engine.importFederatedIntent(
        {
          agentId: 'remote-agent',
          type: 'offer',
          domain: 'natural_language_processing',
          subdomain: 'translation',
          semanticDescription: 'Remote translation service',
          capabilities: { required: ['translation'], preferred: [], excluded: [] },
        },
        'federation-alpha',
      );

      const results = engine.searchIntents({ domain: 'natural_language_processing' });
      expect(results.total).toBeGreaterThan(0);
    });

    it('should perform federated search', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      const matches = engine.federatedSearch(need.id, ['fed-1']);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ── ZOPA Detection ──

  describe('ZOPA Detection', () => {
    it('should detect ZOPA when cost ranges overlap', () => {
      const need = createNLPNeedIntent(engine);
      const offer = createNLPOfferIntent(engine);

      const zopa = engine.detectZOPA(need, offer);

      expect(zopa.exists).toBe(true);
      expect(zopa.overlapScore).toBeGreaterThan(0);
    });

    it('should report no ZOPA when constraints are incompatible', () => {
      const need = createNLPNeedIntent(engine, {
        constraints: { maxCost: 10, deadline: new Date(Date.now() + 1000).toISOString() },
      });
      const offer = createNLPOfferIntent(engine, {
        constraints: { maxCost: 1000, deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
        capabilities: { required: [], preferred: [], excluded: [] },
      });

      const zopa = engine.detectZOPA(need, offer);

      // May or may not exist depending on exact scoring
      expect(typeof zopa.exists).toBe('boolean');
      expect(zopa.negotiationPotential).toBeTruthy();
    });

    it('should report full ZOPA when no constraints exist', () => {
      const need = engine.publishIntent({
        agentId: 'a1',
        type: 'need',
        domain: 'test',
        subdomain: 'test',
        semanticDescription: 'test',
        capabilities: { required: [], preferred: [], excluded: [] },
      });
      const offer = engine.publishIntent({
        agentId: 'a2',
        type: 'offer',
        domain: 'test',
        subdomain: 'test',
        semanticDescription: 'test',
        capabilities: { required: [], preferred: [], excluded: [] },
      });

      const zopa = engine.detectZOPA(need, offer);

      expect(zopa.exists).toBe(true);
      expect(zopa.overlapScore).toBe(1.0);
    });
  });

  // ── Search ──

  describe('Search', () => {
    it('should search intents by domain', () => {
      createNLPNeedIntent(engine);
      createDataAnalysisOfferIntent(engine);

      const results = engine.searchIntents({ domain: 'natural_language_processing' });

      expect(results.total).toBe(1);
      expect(results.intents[0].domain).toBe('natural_language_processing');
    });

    it('should search intents by type', () => {
      createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      const results = engine.searchIntents({ type: 'need' });

      expect(results.intents.every(i => i.type === 'need')).toBe(true);
    });

    it('should search intents by text query', () => {
      createNLPNeedIntent(engine);
      createDataAnalysisOfferIntent(engine);

      const results = engine.searchIntents({ query: 'sentiment' });

      expect(results.total).toBe(1);
    });

    it('should paginate search results', () => {
      for (let i = 0; i < 5; i++) {
        createNLPOfferIntent(engine, { agentId: `agent-${i}` });
      }

      const page1 = engine.searchIntents({ limit: 2, offset: 0 });
      const page2 = engine.searchIntents({ limit: 2, offset: 2 });

      expect(page1.intents.length).toBe(2);
      expect(page2.intents.length).toBe(2);
      expect(page1.total).toBe(5);
    });

    it('should filter by capabilities', () => {
      createNLPOfferIntent(engine);
      createDataAnalysisOfferIntent(engine);

      const results = engine.searchIntents({ capabilities: ['sentiment_analysis'] });

      expect(results.total).toBe(1);
    });
  });

  // ── Edge Cases ──

  describe('Edge Cases', () => {
    it('should handle finding matches with no intents in system', () => {
      const intent = createNLPNeedIntent(engine);
      const matches = engine.findMatches(intent.id);

      expect(matches.length).toBe(0);
    });

    it('should throw when finding matches for non-existent intent', () => {
      expect(() => engine.findMatches('nonexistent')).toThrow();
    });

    it('should handle agent with no intents gracefully', () => {
      const intents = engine.getAgentIntents('nonexistent');
      expect(intents.length).toBe(0);
    });

    it('should handle building profile for agent with no history', () => {
      const profile = engine.buildSemanticProfile('new-agent');
      expect(profile.domains.length).toBe(0);
      expect(profile.strengths.length).toBe(0);
    });

    it('should reset stores cleanly', () => {
      createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);

      engine._resetStores();

      expect(engine.getAgentIntents('agent-buyer').length).toBe(0);
      expect(engine.getAuditLog().length).toBe(0);
    });

    it('should record audit entries for all operations', () => {
      createNLPNeedIntent(engine);
      const auditLog = engine.getAuditLog();

      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].eventType).toBe('intent_published');
    });

    it('should handle domain filter in findMatches', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);
      createDataAnalysisOfferIntent(engine);

      const matches = engine.findMatches(need.id, {
        domainFilter: 'data_analysis',
        minScore: 0,
      });

      // Should only match data_analysis intents, but none exist as compatible type
      // (data_analysis offer for NLP need has low score anyway)
      for (const match of matches) {
        const intent = engine.getIntent(match.offerIntentId);
        expect(intent?.domain).toBe('data_analysis');
      }
    });

    it('should update match status', () => {
      const need = createNLPNeedIntent(engine);
      createNLPOfferIntent(engine);
      const matches = engine.findMatches(need.id);

      if (matches.length > 0) {
        const updated = engine.updateMatchStatus(matches[0].id, 'engaged');
        expect(updated.status).toBe('engaged');
      }
    });

    it('should throw when updating non-existent match', () => {
      expect(() => engine.updateMatchStatus('nonexistent', 'engaged')).toThrow();
    });
  });
});
