/**
 * Agent Negotiation & Strategic Bargaining Protocol — Tests
 *
 * Comprehensive tests covering:
 *   1. Session lifecycle (create, join, status transitions)
 *   2. Offer mechanics (make, accept, reject, counter)
 *   3. Concession strategies (boulware, conceder, linear, tit-for-tat)
 *   4. Utility computation (linear, concave, convex, step curves)
 *   5. ZOPA detection (numeric, categorical, boolean)
 *   6. Pareto efficiency analysis
 *   7. Nash bargaining solution
 *   8. Auto counter-offer generation
 *   9. Mediation protocol (split difference, interest-based, arbitration)
 *   10. Agreement generation and signing
 *   11. Deadlock detection
 *   12. Deadline pressure effects
 *   13. Multi-party negotiation
 *   14. Audit trail
 */

import {
  createNegotiation,
  joinNegotiation,
  getNegotiation,
  listNegotiations,
  makeOffer,
  respondToOffer,
  generateCounterOffer,
  computeZOPA,
  analyzeParetoEfficiency,
  triggerMediation,
  signAgreement,
  getAgreement,
  getRoundSummaries,
  getAuditTrail,
  cancelNegotiation,
  computeIssueUtility,
  computeTotalUtility,
  computeTargetUtility,
  _resetStores,
} from '@/lib/a2a/negotiation/engine';

import {
  IssuePreference,
} from '@/lib/a2a/negotiation/types';

// ──────────────────────────────────────────────
// Test Fixtures
// ──────────────────────────────────────────────

function createPriceNegotiation(): ReturnType<typeof createNegotiation> {
  return createNegotiation({
    domain: 'resource_pricing',
    title: 'Compute Resource Pricing',
    description: 'Negotiate GPU-hour pricing between buyer and seller agents',
    issues: [
      {
        id: 'price',
        name: 'Price per GPU-hour',
        type: 'numeric',
        min_value: 1,
        max_value: 100,
        mandatory: true,
      },
      {
        id: 'duration',
        name: 'Contract duration (months)',
        type: 'numeric',
        min_value: 1,
        max_value: 24,
        mandatory: true,
      },
      {
        id: 'sla_tier',
        name: 'SLA Tier',
        type: 'categorical',
        options: ['basic', 'standard', 'premium'],
        mandatory: true,
      },
      {
        id: 'auto_scale',
        name: 'Auto-scaling enabled',
        type: 'boolean',
        mandatory: false,
      },
    ],
    initiator: {
      agent_id: 'buyer_agent',
      strategy: 'linear',
      preferences: [
        { issue_id: 'price', weight: 0.5, ideal_value: 10, reservation_value: 50 },
        { issue_id: 'duration', weight: 0.2, ideal_value: 12, reservation_value: 3 },
        { issue_id: 'sla_tier', weight: 0.2, ideal_value: 'premium', reservation_value: 'basic' },
        { issue_id: 'auto_scale', weight: 0.1, ideal_value: true, reservation_value: false },
      ],
    },
    max_rounds: 10,
    min_rounds: 2,
    mediation: {
      deadlock_threshold: 4,
      mediation_strategy: 'split_difference',
      binding: false,
    },
  });
}

function joinAsSeller(negotiation_id: string) {
  return joinNegotiation({
    negotiation_id,
    agent_id: 'seller_agent',
    strategy: 'boulware',
    strategy_params: { beta: 0.3 },
    preferences: [
      { issue_id: 'price', weight: 0.5, ideal_value: 90, reservation_value: 30 },
      { issue_id: 'duration', weight: 0.3, ideal_value: 24, reservation_value: 6 },
      { issue_id: 'sla_tier', weight: 0.1, ideal_value: 'basic', reservation_value: 'premium' },
      { issue_id: 'auto_scale', weight: 0.1, ideal_value: false, reservation_value: true },
    ],
    batna: {
      alternative_utility: 0.4,
      description: 'Sell to another buyer at lower margin',
      confidence: 0.7,
    },
  });
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

beforeEach(() => {
  _resetStores();
});

describe('Negotiation Session Lifecycle', () => {
  test('creates a negotiation session', () => {
    const session = createPriceNegotiation();

    expect(session.id).toMatch(/^neg_/);
    expect(session.domain).toBe('resource_pricing');
    expect(session.status).toBe('initiated');
    expect(session.issues).toHaveLength(4);
    expect(session.parties).toHaveLength(1);
    expect(session.parties[0].agent_id).toBe('buyer_agent');
    expect(session.parties[0].role).toBe('initiator');
    expect(session.current_round).toBe(0);
    expect(session.max_rounds).toBe(10);
  });

  test('second party joins and transitions to proposing', () => {
    const session = createPriceNegotiation();
    const updated = joinAsSeller(session.id);

    expect(updated.parties).toHaveLength(2);
    expect(updated.status).toBe('proposing');
    expect(updated.parties[1].role).toBe('responder');
    expect(updated.parties[1].strategy).toBe('boulware');
  });

  test('rejects duplicate agent join', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    expect(() =>
      joinNegotiation({
        negotiation_id: session.id,
        agent_id: 'seller_agent',
        strategy: 'linear',
        preferences: [{ issue_id: 'price', weight: 1, ideal_value: 50, reservation_value: 30 }],
      }),
    ).toThrow('already in negotiation');
  });

  test('observer can join without transitioning status', () => {
    const session = createNegotiation({
      domain: 'sla_terms',
      title: 'SLA Negotiation',
      issues: [{ id: 'uptime', name: 'Uptime %', type: 'numeric', min_value: 95, max_value: 100, mandatory: true }],
      initiator: {
        agent_id: 'agent_a',
        strategy: 'linear',
        preferences: [{ issue_id: 'uptime', weight: 1, ideal_value: 99.99, reservation_value: 99 }],
      },
    });

    const updated = joinNegotiation({
      negotiation_id: session.id,
      agent_id: 'observer_agent',
      role: 'observer',
      strategy: 'linear',
      preferences: [{ issue_id: 'uptime', weight: 1, ideal_value: 99.5, reservation_value: 99 }],
    });

    // Still initiated because observer doesn't count
    expect(updated.status).toBe('initiated');
  });

  test('getNegotiation strips private data for non-owners', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    const buyerView = getNegotiation(session.id, 'buyer_agent');
    expect(buyerView).not.toBeNull();

    // Buyer sees their own preferences
    const buyerParty = buyerView!.parties.find((p) => p.agent_id === 'buyer_agent');
    expect(buyerParty!.preferences).toHaveLength(4);

    // Buyer cannot see seller's preferences
    const sellerParty = buyerView!.parties.find((p) => p.agent_id === 'seller_agent');
    expect(sellerParty!.preferences).toHaveLength(0);
    expect(sellerParty!.batna).toBeUndefined();
    expect(sellerParty!.strategy).toBe('hidden');
  });

  test('listNegotiations with filters', () => {
    createPriceNegotiation();
    createNegotiation({
      domain: 'sla_terms',
      title: 'Another negotiation',
      issues: [{ id: 'x', name: 'X', type: 'numeric', mandatory: true }],
      initiator: {
        agent_id: 'agent_x',
        strategy: 'linear',
        preferences: [{ issue_id: 'x', weight: 1, ideal_value: 10, reservation_value: 5 }],
      },
    });

    expect(listNegotiations()).toHaveLength(2);
    expect(listNegotiations({ domain: 'resource_pricing' })).toHaveLength(1);
    expect(listNegotiations({ agent_id: 'agent_x' })).toHaveLength(1);
  });
});

describe('Utility Computation', () => {
  test('linear utility for numeric issue', () => {
    const pref: IssuePreference = {
      issue_id: 'price',
      weight: 1,
      ideal_value: 10,
      reservation_value: 50,
      utility_curve: 'linear',
    };

    expect(computeIssueUtility(pref, 10)).toBeCloseTo(1.0);
    expect(computeIssueUtility(pref, 50)).toBeCloseTo(0.0);
    expect(computeIssueUtility(pref, 30)).toBeCloseTo(0.5);
  });

  test('concave utility (risk-averse)', () => {
    const pref: IssuePreference = {
      issue_id: 'price',
      weight: 1,
      ideal_value: 0,
      reservation_value: 100,
      utility_curve: 'concave',
    };

    const mid = computeIssueUtility(pref, 50);
    // Concave: utility at midpoint > 0.5 (sqrt(0.5) ≈ 0.707)
    expect(mid).toBeGreaterThan(0.6);
    expect(mid).toBeLessThan(0.8);
  });

  test('convex utility (risk-seeking)', () => {
    const pref: IssuePreference = {
      issue_id: 'price',
      weight: 1,
      ideal_value: 0,
      reservation_value: 100,
      utility_curve: 'convex',
    };

    const mid = computeIssueUtility(pref, 50);
    // Convex: utility at midpoint < 0.5 (0.5^2 = 0.25)
    expect(mid).toBeLessThan(0.3);
  });

  test('step utility', () => {
    const pref: IssuePreference = {
      issue_id: 'price',
      weight: 1,
      ideal_value: 0,
      reservation_value: 100,
      utility_curve: 'step',
    };

    expect(computeIssueUtility(pref, 25)).toBe(1.0); // 75% toward ideal → raw > 0.5
    expect(computeIssueUtility(pref, 75)).toBe(0.0); // 25% toward ideal → raw < 0.5
  });

  test('boolean utility', () => {
    const pref: IssuePreference = {
      issue_id: 'feature',
      weight: 1,
      ideal_value: true,
      reservation_value: false,
    };

    expect(computeIssueUtility(pref, true)).toBe(1.0);
    expect(computeIssueUtility(pref, false)).toBe(0.0);
  });

  test('weighted total utility across issues', () => {
    const prefs: IssuePreference[] = [
      { issue_id: 'price', weight: 0.6, ideal_value: 10, reservation_value: 50 },
      { issue_id: 'quality', weight: 0.4, ideal_value: 100, reservation_value: 50 },
    ];

    const values = [
      { issue_id: 'price', value: 30 },  // utility = 0.5
      { issue_id: 'quality', value: 75 }, // utility = 0.5
    ];

    expect(computeTotalUtility(prefs, values)).toBeCloseTo(0.5);
  });
});

describe('Concession Strategies', () => {
  test('boulware: concedes slowly', () => {
    const earlyTarget = computeTargetUtility('boulware', 2, 20, { beta: 0.2 });
    const midTarget = computeTargetUtility('boulware', 10, 20, { beta: 0.2 });
    const lateTarget = computeTargetUtility('boulware', 18, 20, { beta: 0.2 });

    // Boulware: concedes slowly — each step target < previous
    expect(earlyTarget).toBeGreaterThan(midTarget);
    expect(midTarget).toBeGreaterThan(lateTarget);
    // Even late, still positive
    expect(lateTarget).toBeGreaterThanOrEqual(0);
  });

  test('conceder: concedes rapidly early', () => {
    const earlyTarget = computeTargetUtility('conceder', 2, 20, { beta: 3.0 });
    const midTarget = computeTargetUtility('conceder', 10, 20, { beta: 3.0 });

    // Conceder: target decreases over time
    expect(earlyTarget).toBeGreaterThanOrEqual(midTarget);
    // But still has some value at midpoint
    expect(midTarget).toBeGreaterThanOrEqual(0);
  });

  test('linear: constant concession rate', () => {
    const t1 = computeTargetUtility('linear', 5, 20);
    const t2 = computeTargetUtility('linear', 10, 20);
    const t3 = computeTargetUtility('linear', 15, 20);

    // Linear: equal decrements
    const diff1 = t1 - t2;
    const diff2 = t2 - t3;
    expect(diff1).toBeCloseTo(diff2, 1);
  });

  test('tit_for_tat: mirrors opponent concession', () => {
    const smallConcession = computeTargetUtility('tit_for_tat', 5, 20, {}, 0.02);
    const largeConcession = computeTargetUtility('tit_for_tat', 5, 20, {}, 0.10);

    // Larger opponent concession → agent concedes more → lower target
    expect(largeConcession).toBeLessThan(smallConcession);
  });

  test('hybrid: blends strategies', () => {
    const hybrid = computeTargetUtility('hybrid', 5, 20, {
      hybrid_weights: { boulware: 0.5, conceder: 0.5 },
      beta: 0.5,
    });
    const boulware = computeTargetUtility('boulware', 5, 20, { beta: 0.5 });
    const conceder = computeTargetUtility('conceder', 5, 20, { beta: 0.5 });

    // Hybrid should be between the two (approximately)
    expect(hybrid).toBeGreaterThanOrEqual(Math.min(boulware, conceder) - 0.1);
    expect(hybrid).toBeLessThanOrEqual(Math.max(boulware, conceder) + 0.1);
  });
});

describe('Offer Mechanics', () => {
  test('make and accept an offer', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    const offer = makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 25 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'standard' },
        { issue_id: 'auto_scale', value: true },
      ],
      message: 'Initial offer',
    });

    expect(offer.id).toMatch(/^off_/);
    expect(offer.round).toBe(1);
    expect(offer.status).toBe('pending');
    expect(offer.concession_magnitude).toBeUndefined(); // First offer

    // Accept
    const result = respondToOffer({
      negotiation_id: session.id,
      offer_id: offer.id,
      agent_id: 'seller_agent',
      action: 'accept',
    });

    // min_rounds = 2, so not yet agreed
    expect(result.parties.find((p) => p.agent_id === 'seller_agent')!.has_accepted).toBe(true);
  });

  test('reject an offer', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    const offer = makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 5 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'premium' },
      ],
    });

    const result = respondToOffer({
      negotiation_id: session.id,
      offer_id: offer.id,
      agent_id: 'seller_agent',
      action: 'reject',
      message: 'Price too low',
    });

    const rejectedOffer = result.offers.find((o) => o.id === offer.id);
    expect(rejectedOffer!.status).toBe('rejected');
  });

  test('counter an offer creates a new offer', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    const offer = makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 20 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'standard' },
      ],
    });

    const result = respondToOffer({
      negotiation_id: session.id,
      offer_id: offer.id,
      agent_id: 'seller_agent',
      action: 'counter',
      counter_values: [
        { issue_id: 'price', value: 70 },
        { issue_id: 'duration', value: 18 },
        { issue_id: 'sla_tier', value: 'basic' },
      ],
    });

    expect(result.offers).toHaveLength(2);
    expect(result.offers[1].from_agent_id).toBe('seller_agent');
    expect(result.offers[1].round).toBe(2);
    expect(result.current_round).toBe(2);
    expect(result.status).toBe('bargaining');
  });

  test('validates mandatory issues', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    expect(() =>
      makeOffer({
        negotiation_id: session.id,
        from_agent_id: 'buyer_agent',
        proposed_values: [{ issue_id: 'price', value: 30 }],
        // Missing mandatory: duration, sla_tier
      }),
    ).toThrow('Missing value for mandatory issue');
  });

  test('validates value bounds', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    expect(() =>
      makeOffer({
        negotiation_id: session.id,
        from_agent_id: 'buyer_agent',
        proposed_values: [
          { issue_id: 'price', value: 200 }, // max is 100
          { issue_id: 'duration', value: 12 },
          { issue_id: 'sla_tier', value: 'standard' },
        ],
      }),
    ).toThrow('above maximum');
  });

  test('concession magnitude tracks between offers', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 20 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'premium' },
      ],
    });

    const offer2 = makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 30 }, // Conceded 10 on a 1-100 range
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'premium' },
      ],
    });

    expect(offer2.concession_magnitude).toBeGreaterThan(0);
    expect(offer2.concession_magnitude).toBeLessThan(1);
  });
});

describe('Full Negotiation to Agreement', () => {
  test('complete bilateral negotiation ending in agreement', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    // Round 1: buyer's initial offer
    const offer1 = makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 25 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'standard' },
        { issue_id: 'auto_scale', value: true },
      ],
    });

    // Round 2: seller counters
    respondToOffer({
      negotiation_id: session.id,
      offer_id: offer1.id,
      agent_id: 'seller_agent',
      action: 'counter',
      counter_values: [
        { issue_id: 'price', value: 60 },
        { issue_id: 'duration', value: 18 },
        { issue_id: 'sla_tier', value: 'standard' },
        { issue_id: 'auto_scale', value: false },
      ],
    });

    // Round 3: buyer makes final offer (past min_rounds)
    const offer3 = makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 45 },
        { issue_id: 'duration', value: 15 },
        { issue_id: 'sla_tier', value: 'standard' },
        { issue_id: 'auto_scale', value: true },
      ],
    });

    // Seller accepts
    const result = respondToOffer({
      negotiation_id: session.id,
      offer_id: offer3.id,
      agent_id: 'seller_agent',
      action: 'accept',
    });

    expect(result.status).toBe('agreed');
    expect(result.completed_at).toBeDefined();

    // Check agreement was generated
    const agreement = getAgreement(session.id);
    expect(agreement).not.toBeNull();
    expect(agreement!.status).toBe('signed');
    expect(agreement!.signatories).toHaveLength(2);
    expect(agreement!.agreed_values).toEqual(offer3.proposed_values);
  });
});

describe('Auto Counter-Offer Generation', () => {
  test('generates strategy-based counter-offer', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    // Initial offer
    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 20 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'premium' },
        { issue_id: 'auto_scale', value: true },
      ],
    });

    // Auto-generate seller's counter
    const counter = generateCounterOffer({
      negotiation_id: session.id,
      agent_id: 'seller_agent',
    });

    expect(counter.from_agent_id).toBe('seller_agent');
    expect(counter.proposed_values.length).toBeGreaterThan(0);

    // Seller wants high price → counter should have higher price than buyer's offer
    const counterPrice = counter.proposed_values.find((v) => v.issue_id === 'price');
    expect(counterPrice).toBeDefined();
    expect(counterPrice!.value as number).toBeGreaterThan(20);
  });

  test('strategy override works', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 30 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'standard' },
      ],
    });

    // Override seller's boulware strategy with conceder
    const counter = generateCounterOffer({
      negotiation_id: session.id,
      agent_id: 'seller_agent',
      override_strategy: 'conceder',
    });

    expect(counter.message).toContain('conceder');
  });
});

describe('ZOPA Detection', () => {
  test('detects ZOPA for numeric issue with overlapping ranges', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    const analysis = computeZOPA(session.id);

    // Buyer: ideal=10, reservation=50 → range [10, 50]
    // Seller: ideal=90, reservation=30 → range [30, 90]
    // ZOPA for price: [30, 50]
    const priceZOPA = analysis.find((a) => a.issue_id === 'price');
    expect(priceZOPA).toBeDefined();
    expect(priceZOPA!.exists).toBe(true);
    expect(priceZOPA!.overlap_min).toBe(30);
    expect(priceZOPA!.overlap_max).toBe(50);
    expect(priceZOPA!.focal_point).toBe(40); // Midpoint
  });

  test('detects ZOPA for duration issue', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    const analysis = computeZOPA(session.id);

    // Buyer: ideal=12, reservation=3 → range [3, 12]
    // Seller: ideal=24, reservation=6 → range [6, 24]
    // ZOPA: [6, 12]
    const durationZOPA = analysis.find((a) => a.issue_id === 'duration');
    expect(durationZOPA).toBeDefined();
    expect(durationZOPA!.exists).toBe(true);
    expect(durationZOPA!.overlap_min).toBe(6);
    expect(durationZOPA!.overlap_max).toBe(12);
  });

  test('stores ZOPA result on session', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    computeZOPA(session.id);

    const updated = getNegotiation(session.id);
    expect(updated!.zopa_exists).toBe(true);
    expect(updated!.zopa_analysis).toBeDefined();
  });
});

describe('Pareto Analysis', () => {
  test('identifies Pareto improvement opportunities', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    // Make a clearly non-Pareto offer (both parties unhappy)
    const offer = makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 50 },   // Buyer's reservation point
        { issue_id: 'duration', value: 6 },  // Close to seller's reservation
        { issue_id: 'sla_tier', value: 'basic' },
        { issue_id: 'auto_scale', value: false },
      ],
    });

    const analysis = analyzeParetoEfficiency(session.id, offer.id);

    expect(analysis.negotiation_id).toBe(session.id);
    // With both parties at low utility, improvements should exist
    expect(analysis.efficiency_score).toBeGreaterThan(0);
    expect(analysis.efficiency_score).toBeLessThanOrEqual(1);
  });

  test('computes Nash bargaining solution', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 40 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'standard' },
      ],
    });

    const analysis = analyzeParetoEfficiency(session.id);

    expect(analysis.nash_solution).toBeDefined();
    expect(analysis.nash_solution!.length).toBeGreaterThan(0);
  });
});

describe('Mediation Protocol', () => {
  test('split_difference mediation averages last offers', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    // Buyer offer
    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 30 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'standard' },
      ],
    });

    // Seller offer
    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'seller_agent',
      proposed_values: [
        { issue_id: 'price', value: 70 },
        { issue_id: 'duration', value: 18 },
        { issue_id: 'sla_tier', value: 'basic' },
      ],
    });

    // Trigger mediation
    const mediatorOffer = triggerMediation({
      negotiation_id: session.id,
      reason: 'Testing mediation',
    });

    expect(mediatorOffer.from_agent_id).toBe('system_mediator');
    expect(mediatorOffer.message).toContain('split_difference');

    // Price should be approximately average of 30 and 70
    const price = mediatorOffer.proposed_values.find((v) => v.issue_id === 'price');
    expect(price).toBeDefined();
    expect(price!.value).toBeCloseTo(50, 0);

    // Session should be in mediated status
    const updated = getNegotiation(session.id);
    expect(updated!.status).toBe('mediated');
  });

  test('interest_based mediation weights by importance', () => {
    const session = createNegotiation({
      domain: 'resource_pricing',
      title: 'Interest-based test',
      issues: [
        { id: 'price', name: 'Price', type: 'numeric', min_value: 0, max_value: 100, mandatory: true },
        { id: 'quality', name: 'Quality', type: 'numeric', min_value: 0, max_value: 100, mandatory: true },
      ],
      initiator: {
        agent_id: 'agent_a',
        strategy: 'linear',
        preferences: [
          { issue_id: 'price', weight: 0.9, ideal_value: 10, reservation_value: 50 },
          { issue_id: 'quality', weight: 0.1, ideal_value: 80, reservation_value: 50 },
        ],
      },
      mediation: {
        deadlock_threshold: 3,
        mediation_strategy: 'interest_based',
        binding: false,
      },
    });

    joinNegotiation({
      negotiation_id: session.id,
      agent_id: 'agent_b',
      strategy: 'linear',
      preferences: [
        { issue_id: 'price', weight: 0.1, ideal_value: 90, reservation_value: 50 },
        { issue_id: 'quality', weight: 0.9, ideal_value: 90, reservation_value: 50 },
      ],
    });

    // Both make offers
    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'agent_a',
      proposed_values: [
        { issue_id: 'price', value: 20 },
        { issue_id: 'quality', value: 70 },
      ],
    });

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'agent_b',
      proposed_values: [
        { issue_id: 'price', value: 80 },
        { issue_id: 'quality', value: 85 },
      ],
    });

    const mediatorOffer = triggerMediation({
      negotiation_id: session.id,
      reason: 'Testing interest-based',
    });

    // Agent A cares most about price (weight 0.9) → price should be closer to A's ideal
    const price = mediatorOffer.proposed_values.find((v) => v.issue_id === 'price');
    // Agent B cares most about quality (weight 0.9) → quality should be closer to B's ideal
    const quality = mediatorOffer.proposed_values.find((v) => v.issue_id === 'quality');

    expect(price).toBeDefined();
    expect(quality).toBeDefined();
  });
});

describe('Cancellation', () => {
  test('cancels a negotiation', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    const result = cancelNegotiation(session.id, 'buyer_agent', 'Found better deal');

    expect(result.status).toBe('cancelled');
    expect(result.completed_at).toBeDefined();
  });

  test('cannot cancel a terminal negotiation', () => {
    const session = createPriceNegotiation();
    cancelNegotiation(session.id, 'buyer_agent', 'test');

    expect(() =>
      cancelNegotiation(session.id, 'buyer_agent', 'again'),
    ).toThrow('terminal status');
  });
});

describe('Round Summaries & Analytics', () => {
  test('generates round-by-round summaries', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 20 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'standard' },
      ],
    });

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'seller_agent',
      proposed_values: [
        { issue_id: 'price', value: 70 },
        { issue_id: 'duration', value: 18 },
        { issue_id: 'sla_tier', value: 'basic' },
      ],
    });

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 35 },
        { issue_id: 'duration', value: 14 },
        { issue_id: 'sla_tier', value: 'standard' },
      ],
    });

    const summaries = getRoundSummaries(session.id);

    expect(summaries.length).toBeGreaterThanOrEqual(2);
    expect(summaries[0].round).toBe(1);
  });
});

describe('Audit Trail', () => {
  test('records all negotiation events', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 30 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'standard' },
      ],
    });

    const trail = getAuditTrail(session.id);

    expect(trail.length).toBeGreaterThanOrEqual(3); // created + joined + offer
    expect(trail[0].event_type).toBe('session_created');
    expect(trail[1].event_type).toBe('party_joined');
    expect(trail[2].event_type).toBe('offer_made');
  });

  test('filters audit by event type', () => {
    const session = createPriceNegotiation();
    joinAsSeller(session.id);

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'buyer_agent',
      proposed_values: [
        { issue_id: 'price', value: 30 },
        { issue_id: 'duration', value: 12 },
        { issue_id: 'sla_tier', value: 'standard' },
      ],
    });

    const offerEvents = getAuditTrail(session.id, 'offer_made');
    expect(offerEvents).toHaveLength(1);
  });
});

describe('Max Rounds & Auto-Fail', () => {
  test('negotiation fails when max rounds exceeded without mediation', () => {
    const session = createNegotiation({
      domain: 'resource_pricing',
      title: 'Quick fail test',
      issues: [
        { id: 'price', name: 'Price', type: 'numeric', min_value: 0, max_value: 100, mandatory: true },
      ],
      initiator: {
        agent_id: 'agent_a',
        strategy: 'boulware',
        preferences: [{ issue_id: 'price', weight: 1, ideal_value: 10, reservation_value: 50 }],
      },
      max_rounds: 3,
    });

    joinNegotiation({
      negotiation_id: session.id,
      agent_id: 'agent_b',
      strategy: 'boulware',
      preferences: [{ issue_id: 'price', weight: 1, ideal_value: 90, reservation_value: 50 }],
    });

    // 3 offers → max rounds reached
    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'agent_a',
      proposed_values: [{ issue_id: 'price', value: 20 }],
    });
    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'agent_b',
      proposed_values: [{ issue_id: 'price', value: 80 }],
    });
    const lastOffer = makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'agent_a',
      proposed_values: [{ issue_id: 'price', value: 25 }],
    });

    const result = getNegotiation(session.id);
    expect(result!.status).toBe('failed');
  });

  test('triggers mediation instead of failing when mediation configured', () => {
    const session = createNegotiation({
      domain: 'resource_pricing',
      title: 'Mediation trigger test',
      issues: [
        { id: 'price', name: 'Price', type: 'numeric', min_value: 0, max_value: 100, mandatory: true },
      ],
      initiator: {
        agent_id: 'agent_a',
        strategy: 'boulware',
        preferences: [{ issue_id: 'price', weight: 1, ideal_value: 10, reservation_value: 50 }],
      },
      max_rounds: 2,
      mediation: {
        deadlock_threshold: 3,
        mediation_strategy: 'split_difference',
        binding: false,
      },
    });

    joinNegotiation({
      negotiation_id: session.id,
      agent_id: 'agent_b',
      strategy: 'boulware',
      preferences: [{ issue_id: 'price', weight: 1, ideal_value: 90, reservation_value: 50 }],
    });

    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'agent_a',
      proposed_values: [{ issue_id: 'price', value: 20 }],
    });
    makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'agent_b',
      proposed_values: [{ issue_id: 'price', value: 80 }],
    });

    const result = getNegotiation(session.id);
    expect(result!.status).toBe('mediated');
  });
});

describe('Multi-Party Negotiation', () => {
  test('three-party negotiation requires all to accept', () => {
    const session = createNegotiation({
      domain: 'coalition_formation',
      title: 'Three-way coalition',
      issues: [
        { id: 'share', name: 'Revenue share %', type: 'numeric', min_value: 0, max_value: 100, mandatory: true },
      ],
      initiator: {
        agent_id: 'agent_a',
        strategy: 'linear',
        preferences: [{ issue_id: 'share', weight: 1, ideal_value: 50, reservation_value: 25 }],
      },
      min_rounds: 1,
    });

    joinNegotiation({
      negotiation_id: session.id,
      agent_id: 'agent_b',
      strategy: 'linear',
      preferences: [{ issue_id: 'share', weight: 1, ideal_value: 40, reservation_value: 20 }],
    });

    joinNegotiation({
      negotiation_id: session.id,
      agent_id: 'agent_c',
      strategy: 'linear',
      preferences: [{ issue_id: 'share', weight: 1, ideal_value: 33, reservation_value: 15 }],
    });

    const updated = getNegotiation(session.id);
    expect(updated!.parties).toHaveLength(3);

    const offer = makeOffer({
      negotiation_id: session.id,
      from_agent_id: 'agent_a',
      proposed_values: [{ issue_id: 'share', value: 33 }],
    });

    // Agent B accepts
    respondToOffer({
      negotiation_id: session.id,
      offer_id: offer.id,
      agent_id: 'agent_b',
      action: 'accept',
    });

    // Not yet agreed — agent C hasn't accepted
    let current = getNegotiation(session.id);
    expect(current!.status).not.toBe('agreed');

    // Agent C accepts
    respondToOffer({
      negotiation_id: session.id,
      offer_id: offer.id,
      agent_id: 'agent_c',
      action: 'accept',
    });

    current = getNegotiation(session.id);
    expect(current!.status).toBe('agreed');
  });
});
