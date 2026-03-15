/**
 * A2A Task Auction & Bidding System — Unit Tests
 *
 * Tests validation schemas, bid evaluation logic, dutch price computation,
 * and evaluation weight constraints. Database-dependent functions (createAuction,
 * placeBid, awardAuction, etc.) are tested via integration tests.
 */

import {
  auctionCreateSchema,
  auctionListSchema,
  bidCreateSchema,
  auctionAwardSchema,
  evaluateBids,
  computeDutchPrice,
  DEFAULT_EVALUATION_WEIGHTS,
} from '@/lib/a2a/auctions';

// ──────────────────────────────────────────────
// Validation: auctionCreateSchema
// ──────────────────────────────────────────────

describe('auctionCreateSchema', () => {
  const validAuction = {
    required_capability: 'report.summarize',
    title: 'Summarize Q4 earnings reports',
    description: 'Need a comprehensive summary of Fortune 500 Q4 2027 earnings',
    max_price: 500,
    bidding_deadline: '2028-06-15T12:00:00Z',
    completion_deadline: '2028-06-16T12:00:00Z',
  };

  it('accepts a valid minimal auction', () => {
    const result = auctionCreateSchema.safeParse(validAuction);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auction_type).toBe('open');
      expect(result.data.currency).toBe('credits');
      expect(result.data.min_trust_level).toBe('untrusted');
      expect(result.data.min_reputation_score).toBe(0);
    }
  });

  it('accepts a full auction with all fields', () => {
    const result = auctionCreateSchema.safeParse({
      ...validAuction,
      task_input: { topic: 'AI regulation' },
      auction_type: 'sealed',
      currency: 'USD',
      min_trust_level: 'verified',
      min_reputation_score: 0.7,
      evaluation_weights: { price: 0.5, reputation: 0.3, speed: 0.2 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auction_type).toBe('sealed');
      expect(result.data.min_trust_level).toBe('verified');
    }
  });

  it('accepts dutch auction type', () => {
    const result = auctionCreateSchema.safeParse({
      ...validAuction,
      auction_type: 'dutch',
      dutch_start_price: 400,
      dutch_decrement_per_minute: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required_capability', () => {
    const { required_capability, ...rest } = validAuction;
    const result = auctionCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const { title, ...rest } = validAuction;
    const result = auctionCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects zero max_price', () => {
    const result = auctionCreateSchema.safeParse({ ...validAuction, max_price: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative max_price', () => {
    const result = auctionCreateSchema.safeParse({ ...validAuction, max_price: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects max_price over 1 million', () => {
    const result = auctionCreateSchema.safeParse({ ...validAuction, max_price: 1_000_001 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid auction_type', () => {
    const result = auctionCreateSchema.safeParse({ ...validAuction, auction_type: 'blind' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid bidding_deadline format', () => {
    const result = auctionCreateSchema.safeParse({ ...validAuction, bidding_deadline: 'next tuesday' });
    expect(result.success).toBe(false);
  });

  it('accepts evaluation weights object', () => {
    const result = auctionCreateSchema.safeParse({
      ...validAuction,
      evaluation_weights: { price: 0.333, reputation: 0.334, speed: 0.333 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts evaluation weights as optional', () => {
    const result = auctionCreateSchema.safeParse(validAuction);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evaluation_weights).toBeUndefined();
    }
  });

  it('rejects min_reputation_score > 1', () => {
    const result = auctionCreateSchema.safeParse({ ...validAuction, min_reputation_score: 1.5 });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: bidCreateSchema
// ──────────────────────────────────────────────

describe('bidCreateSchema', () => {
  const validBid = {
    price: 100,
    estimated_minutes: 60,
    pitch: 'I specialize in financial report analysis with 98% quality rating',
    matched_capability_id: 'report.summarize',
  };

  it('accepts a valid bid', () => {
    const result = bidCreateSchema.safeParse(validBid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(100);
      expect(result.data.estimated_minutes).toBe(60);
    }
  });

  it('rejects zero price', () => {
    const result = bidCreateSchema.safeParse({ ...validBid, price: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative price', () => {
    const result = bidCreateSchema.safeParse({ ...validBid, price: -50 });
    expect(result.success).toBe(false);
  });

  it('rejects zero estimated_minutes', () => {
    const result = bidCreateSchema.safeParse({ ...validBid, estimated_minutes: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer estimated_minutes', () => {
    const result = bidCreateSchema.safeParse({ ...validBid, estimated_minutes: 30.5 });
    expect(result.success).toBe(false);
  });

  it('rejects missing pitch', () => {
    const { pitch, ...rest } = validBid;
    const result = bidCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty pitch', () => {
    const result = bidCreateSchema.safeParse({ ...validBid, pitch: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing matched_capability_id', () => {
    const { matched_capability_id, ...rest } = validBid;
    const result = bidCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: auctionListSchema
// ──────────────────────────────────────────────

describe('auctionListSchema', () => {
  it('accepts empty query (defaults applied)', () => {
    const result = auctionListSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts status filter', () => {
    const result = auctionListSchema.safeParse({ status: 'open' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = auctionListSchema.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('accepts capability filter', () => {
    const result = auctionListSchema.safeParse({ required_capability: 'news.query' });
    expect(result.success).toBe(true);
  });

  it('rejects limit over 100', () => {
    const result = auctionListSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Validation: auctionAwardSchema
// ──────────────────────────────────────────────

describe('auctionAwardSchema', () => {
  it('accepts empty body (auto-evaluate)', () => {
    const result = auctionAwardSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a valid bid_id', () => {
    const result = auctionAwardSchema.safeParse({ bid_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID for bid_id', () => {
    const result = auctionAwardSchema.safeParse({ bid_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Bid Evaluation Engine
// ──────────────────────────────────────────────

describe('evaluateBids', () => {
  const makeBid = (overrides = {}) => ({
    id: crypto.randomUUID(),
    auction_id: 'auction-1',
    bidder_agent_id: 'agent-1',
    price: 100,
    estimated_minutes: 60,
    status: 'submitted',
    pitch: 'I can do this well',
    matched_capability_id: 'report.summarize',
    reputation_score_snapshot: 0.5,
    trust_level_snapshot: 'verified',
    created_at: new Date().toISOString(),
    ...overrides,
  });

  const defaultWeights = { price: 0.4, reputation: 0.35, speed: 0.25 };

  it('returns empty array for empty bids', () => {
    const result = evaluateBids([], defaultWeights);
    expect(result).toEqual([]);
  });

  it('scores a single bid with perfect scores', () => {
    const bids = [makeBid({ price: 100, estimated_minutes: 30, reputation_score_snapshot: 0.9 })];
    const result = evaluateBids(bids, defaultWeights);

    expect(result).toHaveLength(1);
    expect(result[0].evaluation_score).toBeDefined();
    expect(result[0].score_breakdown).toBeDefined();
    // Single bid gets perfect price and speed scores (1.0)
    expect(result[0].score_breakdown.price_score).toBe(1);
    expect(result[0].score_breakdown.speed_score).toBe(1);
  });

  it('ranks lower price higher when price weight dominates', () => {
    const bids = [
      makeBid({ id: 'expensive', bidder_agent_id: 'a1', price: 500, estimated_minutes: 30, reputation_score_snapshot: 0.9 }),
      makeBid({ id: 'cheap', bidder_agent_id: 'a2', price: 100, estimated_minutes: 30, reputation_score_snapshot: 0.9 }),
    ];

    const priceHeavy = { price: 0.8, reputation: 0.1, speed: 0.1 };
    const result = evaluateBids(bids, priceHeavy);

    expect(result[0].id).toBe('cheap');
    expect(result[0].score_breakdown.price_score).toBeGreaterThan(result[1].score_breakdown.price_score);
  });

  it('ranks higher reputation higher when reputation weight dominates', () => {
    const bids = [
      makeBid({ id: 'low-rep', bidder_agent_id: 'a1', price: 100, reputation_score_snapshot: 0.2 }),
      makeBid({ id: 'high-rep', bidder_agent_id: 'a2', price: 100, reputation_score_snapshot: 0.95 }),
    ];

    const repHeavy = { price: 0.1, reputation: 0.8, speed: 0.1 };
    const result = evaluateBids(bids, repHeavy);

    expect(result[0].id).toBe('high-rep');
  });

  it('ranks faster completion higher when speed weight dominates', () => {
    const bids = [
      makeBid({ id: 'slow', bidder_agent_id: 'a1', estimated_minutes: 120 }),
      makeBid({ id: 'fast', bidder_agent_id: 'a2', estimated_minutes: 15 }),
    ];

    const speedHeavy = { price: 0.1, reputation: 0.1, speed: 0.8 };
    const result = evaluateBids(bids, speedHeavy);

    expect(result[0].id).toBe('fast');
  });

  it('correctly handles three competing bids', () => {
    const bids = [
      makeBid({ id: 'balanced', bidder_agent_id: 'a1', price: 200, estimated_minutes: 60, reputation_score_snapshot: 0.7 }),
      makeBid({ id: 'cheap-slow', bidder_agent_id: 'a2', price: 100, estimated_minutes: 120, reputation_score_snapshot: 0.5 }),
      makeBid({ id: 'expensive-fast', bidder_agent_id: 'a3', price: 400, estimated_minutes: 15, reputation_score_snapshot: 0.9 }),
    ];

    const result = evaluateBids(bids, defaultWeights);

    expect(result).toHaveLength(3);
    // All should have evaluation scores
    result.forEach((bid) => {
      expect(bid.evaluation_score).toBeGreaterThan(0);
      expect(bid.score_breakdown).toBeDefined();
    });
    // Sorted descending by composite
    expect(result[0].evaluation_score).toBeGreaterThanOrEqual(result[1].evaluation_score);
    expect(result[1].evaluation_score).toBeGreaterThanOrEqual(result[2].evaluation_score);
  });

  it('handles identical bids (equal scores)', () => {
    const bids = [
      makeBid({ id: 'a', bidder_agent_id: 'a1', price: 100, estimated_minutes: 60, reputation_score_snapshot: 0.5 }),
      makeBid({ id: 'b', bidder_agent_id: 'a2', price: 100, estimated_minutes: 60, reputation_score_snapshot: 0.5 }),
    ];

    const result = evaluateBids(bids, defaultWeights);
    expect(result[0].evaluation_score).toBe(result[1].evaluation_score);
  });

  it('price normalization handles single bid correctly', () => {
    const bids = [makeBid({ price: 250 })];
    const result = evaluateBids(bids, defaultWeights);

    // With one bid, price range is 0, so price_score should be 1 (best possible)
    expect(result[0].score_breakdown.price_score).toBe(1);
  });
});

// ──────────────────────────────────────────────
// Dutch Price Computation
// ──────────────────────────────────────────────

describe('computeDutchPrice', () => {
  const makeAuction = (overrides = {}) => ({
    id: 'auction-1',
    requester_agent_id: 'agent-1',
    required_capability: 'report.summarize',
    title: 'Test',
    description: 'Test auction',
    task_input: {},
    auction_type: 'dutch',
    status: 'open',
    max_price: 500,
    currency: 'credits',
    dutch_start_price: 400,
    dutch_decrement_per_minute: 10,
    min_trust_level: 'untrusted',
    min_reputation_score: 0,
    bidding_deadline: '2028-12-31T00:00:00Z',
    completion_deadline: '2029-01-01T00:00:00Z',
    bid_count: 0,
    evaluation_weights: DEFAULT_EVALUATION_WEIGHTS,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  it('returns start price for auction just created', () => {
    const auction = makeAuction({ created_at: new Date().toISOString() });
    const price = computeDutchPrice(auction);
    // Should be very close to start price (within 1 minute of creation)
    expect(price).toBeGreaterThan(390);
    expect(price).toBeLessThanOrEqual(400);
  });

  it('decreases price over time', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const auction = makeAuction({ created_at: fiveMinutesAgo });
    const price = computeDutchPrice(auction);
    // 400 - (5 * 10) = 350
    expect(price).toBeCloseTo(350, 0);
  });

  it('floors price at zero', () => {
    const longAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 60 min ago
    const auction = makeAuction({ created_at: longAgo });
    const price = computeDutchPrice(auction);
    // 400 - (60 * 10) = -200, should floor at 0
    expect(price).toBe(0);
  });

  it('returns max_price for non-dutch auctions', () => {
    const auction = makeAuction({ auction_type: 'open' });
    const price = computeDutchPrice(auction);
    expect(price).toBe(500);
  });

  it('returns max_price if dutch fields are missing', () => {
    const auction = makeAuction({ dutch_start_price: undefined, dutch_decrement_per_minute: undefined });
    const price = computeDutchPrice(auction);
    expect(price).toBe(500);
  });
});

// ──────────────────────────────────────────────
// DEFAULT_EVALUATION_WEIGHTS
// ──────────────────────────────────────────────

describe('DEFAULT_EVALUATION_WEIGHTS', () => {
  it('sums to 1.0', () => {
    const sum = DEFAULT_EVALUATION_WEIGHTS.price +
      DEFAULT_EVALUATION_WEIGHTS.reputation +
      DEFAULT_EVALUATION_WEIGHTS.speed;
    expect(sum).toBe(1);
  });

  it('has the expected values', () => {
    expect(DEFAULT_EVALUATION_WEIGHTS.price).toBe(0.4);
    expect(DEFAULT_EVALUATION_WEIGHTS.reputation).toBe(0.35);
    expect(DEFAULT_EVALUATION_WEIGHTS.speed).toBe(0.25);
  });
});
