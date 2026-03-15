/**
 * Agent Negotiation & Strategic Bargaining Engine
 *
 * Core engine implementing multi-party, multi-issue negotiation with
 * game-theoretic strategy support. Every agent-to-agent deal — resource
 * pricing, SLA terms, coalition membership, capability trades — flows
 * through this engine.
 *
 * Architecture:
 *   NegotiationEngine (stateless logic)
 *     ├── Session management (create, join, status)
 *     ├── Offer lifecycle (propose, accept, reject, counter)
 *     ├── Strategy engine (6 concession strategies)
 *     ├── ZOPA detection (zone of possible agreement)
 *     ├── Pareto analysis (efficiency + Nash solution)
 *     ├── Deadline pressure (time-dependent utility)
 *     ├── Mediation protocol (deadlock resolution)
 *     ├── Agreement generation (binding + enforcement)
 *     └── Audit trail (full history)
 */

import {
  type AgreementStatus,
  type BATNA,
  type BreachPenalty,
  type ConcessionStrategy,
  type CreateNegotiationRequest,
  type DeadlinePressure,
  type EnforcementHook,
  type GenerateCounterOfferRequest,
  type IssuePreference,
  type IssueValue,
  type JoinNegotiationRequest,
  type MakeOfferRequest,
  type NegotiationAgreement,
  type NegotiationAuditEntry,
  type NegotiationDomain,
  type NegotiationEventType,
  type NegotiationOffer,
  type NegotiationParty,
  type NegotiationRoundSummary,
  type NegotiationSession,
  type NegotiationStatus,
  type ParetoAnalysis,
  type PartyRole,
  type RespondToOfferRequest,
  type SignAgreementRequest,
  type TriggerMediationRequest,
  type ZOPAAnalysis,
  TERMINAL_STATUSES,
} from './types';

// ──────────────────────────────────────────────
// ID Generation
// ──────────────────────────────────────────────

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${ts}_${rand}`;
}

function now(): string {
  return new Date().toISOString();
}

// ──────────────────────────────────────────────
// In-Memory Stores
// ──────────────────────────────────────────────

const sessions = new Map<string, NegotiationSession>();
const agreements = new Map<string, NegotiationAgreement>();
const auditLog: NegotiationAuditEntry[] = [];

// ──────────────────────────────────────────────
// Audit
// ──────────────────────────────────────────────

function recordAudit(
  negotiation_id: string,
  event_type: NegotiationEventType,
  details: Record<string, unknown>,
  agent_id?: string,
  round?: number,
): NegotiationAuditEntry {
  const entry: NegotiationAuditEntry = {
    id: generateId('naud'),
    negotiation_id,
    event_type,
    agent_id,
    round,
    details,
    timestamp: now(),
  };
  auditLog.push(entry);
  return entry;
}

// ──────────────────────────────────────────────
// Session Management
// ──────────────────────────────────────────────

/**
 * Create a new negotiation session.
 */
export function createNegotiation(req: CreateNegotiationRequest): NegotiationSession {
  const id = generateId('neg');
  const timestamp = now();

  const initiatorParty: NegotiationParty = {
    agent_id: req.initiator.agent_id,
    role: 'initiator',
    strategy: req.initiator.strategy,
    strategy_params: req.initiator.strategy_params,
    preferences: req.initiator.preferences,
    batna: req.initiator.batna
      ? { ...req.initiator.batna, agent_id: req.initiator.agent_id, evaluated_at: timestamp }
      : undefined,
    has_accepted: false,
    offers_made: 0,
    joined_at: timestamp,
  };

  const session: NegotiationSession = {
    id,
    domain: req.domain,
    title: req.title,
    description: req.description,
    status: 'initiated',
    issues: req.issues,
    parties: [initiatorParty],
    offers: [],
    current_round: 0,
    max_rounds: req.max_rounds ?? 20,
    min_rounds: req.min_rounds ?? 1,
    deadline: req.deadline,
    mediation: req.mediation,
    created_at: timestamp,
    updated_at: timestamp,
  };

  sessions.set(id, session);
  recordAudit(id, 'session_created', {
    domain: req.domain,
    issues: req.issues.length,
    initiator: req.initiator.agent_id,
  });

  return session;
}

/**
 * Join an existing negotiation session.
 */
export function joinNegotiation(req: JoinNegotiationRequest): NegotiationSession {
  const session = sessions.get(req.negotiation_id);
  if (!session) throw new Error(`Negotiation ${req.negotiation_id} not found`);
  if (TERMINAL_STATUSES.includes(session.status)) {
    throw new Error(`Negotiation is in terminal status: ${session.status}`);
  }

  const existing = session.parties.find((p) => p.agent_id === req.agent_id);
  if (existing) throw new Error(`Agent ${req.agent_id} already in negotiation`);

  const timestamp = now();
  const party: NegotiationParty = {
    agent_id: req.agent_id,
    role: req.role ?? 'responder',
    strategy: req.strategy,
    strategy_params: req.strategy_params,
    preferences: req.preferences,
    batna: req.batna
      ? { ...req.batna, agent_id: req.agent_id, evaluated_at: timestamp }
      : undefined,
    has_accepted: false,
    offers_made: 0,
    joined_at: timestamp,
  };

  session.parties.push(party);

  // Transition to proposing when we have at least 2 non-observer parties
  const activeParties = session.parties.filter((p) => p.role !== 'observer');
  if (activeParties.length >= 2 && session.status === 'initiated') {
    session.status = 'proposing';
  }

  session.updated_at = timestamp;
  recordAudit(req.negotiation_id, 'party_joined', {
    agent_id: req.agent_id,
    role: party.role,
  }, req.agent_id);

  return session;
}

/**
 * Get a negotiation session by ID.
 * Returns a sanitized view — private preferences/BATNAs stripped for non-owners.
 */
export function getNegotiation(id: string, requesting_agent_id?: string): NegotiationSession | null {
  const session = sessions.get(id);
  if (!session) return null;

  // Strip private data for parties other than the requester
  return {
    ...session,
    parties: session.parties.map((p) => ({
      ...p,
      preferences: p.agent_id === requesting_agent_id ? p.preferences : [],
      batna: p.agent_id === requesting_agent_id ? p.batna : undefined,
      strategy: p.agent_id === requesting_agent_id ? p.strategy : ('hidden' as ConcessionStrategy),
      strategy_params: p.agent_id === requesting_agent_id ? p.strategy_params : undefined,
    })),
  };
}

/**
 * List all negotiation sessions, optionally filtered.
 */
export function listNegotiations(filters?: {
  domain?: NegotiationDomain;
  status?: NegotiationStatus;
  agent_id?: string;
}): NegotiationSession[] {
  let result = Array.from(sessions.values());

  if (filters?.domain) {
    result = result.filter((s) => s.domain === filters.domain);
  }
  if (filters?.status) {
    result = result.filter((s) => s.status === filters.status);
  }
  if (filters?.agent_id) {
    result = result.filter((s) =>
      s.parties.some((p) => p.agent_id === filters.agent_id),
    );
  }

  return result.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

// ──────────────────────────────────────────────
// Utility Computation
// ──────────────────────────────────────────────

/**
 * Compute an agent's utility for a specific issue value.
 * Returns 0-1 where 1 = ideal and 0 = reservation value.
 */
export function computeIssueUtility(
  pref: IssuePreference,
  value: number | string | boolean,
): number {
  if (typeof pref.ideal_value === 'boolean') {
    return value === pref.ideal_value ? 1.0 : 0.0;
  }

  if (typeof pref.ideal_value === 'string') {
    return value === pref.ideal_value ? 1.0 : value === pref.reservation_value ? 0.0 : 0.5;
  }

  // Numeric utility
  const ideal = pref.ideal_value as number;
  const reservation = pref.reservation_value as number;
  const numValue = value as number;

  if (ideal === reservation) return numValue === ideal ? 1.0 : 0.0;

  const range = Math.abs(ideal - reservation);
  const distance = Math.abs(numValue - ideal);
  const raw = Math.max(0, 1 - distance / range);

  // Apply utility curve shape
  switch (pref.utility_curve) {
    case 'concave':
      return Math.sqrt(raw);
    case 'convex':
      return raw * raw;
    case 'step':
      return raw >= 0.5 ? 1.0 : 0.0;
    case 'linear':
    default:
      return raw;
  }
}

/**
 * Compute total weighted utility for an agent given a set of issue values.
 */
export function computeTotalUtility(
  preferences: IssuePreference[],
  values: IssueValue[],
): number {
  let totalUtility = 0;
  let totalWeight = 0;

  for (const pref of preferences) {
    const issueValue = values.find((v) => v.issue_id === pref.issue_id);
    if (!issueValue) continue;

    const utility = computeIssueUtility(pref, issueValue.value);
    totalUtility += utility * pref.weight;
    totalWeight += pref.weight;
  }

  return totalWeight > 0 ? totalUtility / totalWeight : 0;
}

// ──────────────────────────────────────────────
// Concession Strategy Engine
// ──────────────────────────────────────────────

/**
 * Compute the target utility for an agent at a given round,
 * based on their concession strategy. Returns value in [0, 1]
 * where 1 = ideal and 0 = reservation.
 *
 * This is the core of the negotiation AI: it tells the agent
 * how much to concede at each step.
 */
export function computeTargetUtility(
  strategy: ConcessionStrategy,
  round: number,
  maxRounds: number,
  params?: NegotiationParty['strategy_params'],
  opponentLastConcession?: number,
  deadline?: DeadlinePressure,
): number {
  const t = Math.min(round / Math.max(maxRounds, 1), 1); // Normalized time [0, 1]
  let target: number;

  switch (strategy) {
    case 'boulware': {
      // Concede slowly, rush at deadline. β < 1 → very tough
      const beta = params?.beta ?? 0.2;
      target = 1 - Math.pow(t, beta);
      break;
    }

    case 'conceder': {
      // Concede rapidly early, stabilize. β > 1 → very cooperative
      const beta = params?.beta ?? 3.0;
      target = 1 - Math.pow(t, beta);
      break;
    }

    case 'linear': {
      // Constant rate of concession
      target = 1 - t;
      break;
    }

    case 'tit_for_tat': {
      // Mirror opponent's last concession magnitude
      const lastConcession = opponentLastConcession ?? 0.05;
      const minC = params?.min_concession ?? 0.01;
      const maxC = params?.max_concession ?? 0.15;
      const concession = Math.min(maxC, Math.max(minC, lastConcession));
      target = Math.max(0, 1 - t - concession);
      break;
    }

    case 'random': {
      // Random concession within bounds
      const minC = params?.min_concession ?? 0.02;
      const maxC = params?.max_concession ?? 0.1;
      const randomConcession = minC + Math.random() * (maxC - minC);
      target = Math.max(0, 1 - t * (1 + randomConcession));
      break;
    }

    case 'hybrid': {
      // Weighted blend of strategies
      const weights = params?.hybrid_weights ?? { linear: 0.5, boulware: 0.5 };
      let sum = 0;
      let weightSum = 0;
      for (const [strat, w] of Object.entries(weights)) {
        if (strat === 'hybrid') continue; // Prevent recursion
        sum += computeTargetUtility(
          strat as ConcessionStrategy,
          round,
          maxRounds,
          params,
          opponentLastConcession,
        ) * w;
        weightSum += w;
      }
      target = weightSum > 0 ? sum / weightSum : 0.5;
      break;
    }

    default:
      target = 1 - t;
  }

  // Apply deadline pressure
  if (deadline) {
    const pressure = computeDeadlinePressure(deadline);
    if (pressure > 1) {
      // Increase concession rate under pressure
      target = target / pressure;
    }
  }

  return Math.max(0, Math.min(1, target));
}

/**
 * Compute deadline pressure multiplier.
 * Returns >= 1.0, where higher = more pressure to concede.
 */
function computeDeadlinePressure(deadline: DeadlinePressure): number {
  const deadlineTime = new Date(deadline.deadline).getTime();
  const remaining = deadlineTime - Date.now();
  const total = deadlineTime - (Date.now() - 3600000); // Rough session start estimate
  const fractionRemaining = Math.max(0, remaining / Math.max(total, 1));

  if (fractionRemaining > deadline.pressure_threshold) return 1.0;

  const urgency = 1 - fractionRemaining / deadline.pressure_threshold;

  switch (deadline.pressure_curve) {
    case 'exponential':
      return 1 + (deadline.max_pressure_multiplier - 1) * Math.pow(urgency, 2);
    case 'step':
      return urgency > 0.5 ? deadline.max_pressure_multiplier : 1.0;
    case 'linear':
    default:
      return 1 + (deadline.max_pressure_multiplier - 1) * urgency;
  }
}

// ──────────────────────────────────────────────
// Offer Management
// ──────────────────────────────────────────────

/**
 * Make an offer in a negotiation.
 */
export function makeOffer(req: MakeOfferRequest): NegotiationOffer {
  const session = sessions.get(req.negotiation_id);
  if (!session) throw new Error(`Negotiation ${req.negotiation_id} not found`);
  if (TERMINAL_STATUSES.includes(session.status)) {
    throw new Error(`Negotiation is in terminal status: ${session.status}`);
  }

  const party = session.parties.find((p) => p.agent_id === req.from_agent_id);
  if (!party) throw new Error(`Agent ${req.from_agent_id} not in negotiation`);
  if (party.role === 'observer') throw new Error('Observers cannot make offers');

  // Validate all mandatory issues have values
  const mandatoryIssues = session.issues.filter((i) => i.mandatory);
  for (const issue of mandatoryIssues) {
    if (!req.proposed_values.find((v) => v.issue_id === issue.id)) {
      throw new Error(`Missing value for mandatory issue: ${issue.name}`);
    }
  }

  // Validate values are within bounds
  for (const pv of req.proposed_values) {
    const issue = session.issues.find((i) => i.id === pv.issue_id);
    if (!issue) throw new Error(`Unknown issue: ${pv.issue_id}`);

    if (issue.type === 'numeric' && typeof pv.value === 'number') {
      if (issue.min_value !== undefined && pv.value < issue.min_value) {
        throw new Error(`Value ${pv.value} below minimum ${issue.min_value} for issue ${issue.name}`);
      }
      if (issue.max_value !== undefined && pv.value > issue.max_value) {
        throw new Error(`Value ${pv.value} above maximum ${issue.max_value} for issue ${issue.name}`);
      }
    }

    if (issue.type === 'categorical' && typeof pv.value === 'string') {
      if (issue.options && !issue.options.includes(pv.value)) {
        throw new Error(`Invalid option "${pv.value}" for issue ${issue.name}`);
      }
    }
  }

  // Compute concession magnitude from last offer
  let concessionMagnitude: number | undefined;
  const previousOffers = session.offers.filter((o) => o.from_agent_id === req.from_agent_id);
  if (previousOffers.length > 0) {
    const lastOffer = previousOffers[previousOffers.length - 1];
    concessionMagnitude = computeOfferDistance(lastOffer.proposed_values, req.proposed_values, session.issues);
  }

  const offer: NegotiationOffer = {
    id: generateId('off'),
    negotiation_id: req.negotiation_id,
    round: session.current_round + 1,
    from_agent_id: req.from_agent_id,
    proposed_values: req.proposed_values,
    message: req.message,
    status: 'pending',
    concession_magnitude: concessionMagnitude,
    expires_at: req.expires_in_ms
      ? new Date(Date.now() + req.expires_in_ms).toISOString()
      : undefined,
    created_at: now(),
  };

  session.offers.push(offer);
  session.current_round = offer.round;
  party.offers_made++;

  // Reset acceptances on new offer
  session.parties.forEach((p) => { p.has_accepted = false; });

  // Update status
  if (session.status === 'proposing') {
    session.status = 'bargaining';
  }

  // Check for convergence
  if (session.current_round >= 3) {
    const recentOffers = session.offers.slice(-4);
    const avgConcession = recentOffers
      .filter((o) => o.concession_magnitude !== undefined)
      .reduce((sum, o) => sum + (o.concession_magnitude ?? 0), 0) / Math.max(recentOffers.length, 1);
    if (avgConcession < 0.02 && session.status === 'bargaining') {
      session.status = 'converging';
    }
  }

  // Check max rounds
  if (session.current_round >= session.max_rounds) {
    if (session.mediation) {
      session.status = 'mediated';
      recordAudit(req.negotiation_id, 'mediation_triggered', {
        reason: 'max_rounds_reached',
        round: session.current_round,
      });
    } else {
      session.status = 'failed';
      session.completed_at = now();
      recordAudit(req.negotiation_id, 'negotiation_failed', {
        reason: 'max_rounds_exceeded',
        round: session.current_round,
      });
    }
  }

  session.updated_at = now();
  recordAudit(req.negotiation_id, 'offer_made', {
    offer_id: offer.id,
    round: offer.round,
    concession: concessionMagnitude,
    values: req.proposed_values,
  }, req.from_agent_id, offer.round);

  return offer;
}

/**
 * Respond to an offer (accept, reject, or counter).
 */
export function respondToOffer(req: RespondToOfferRequest): NegotiationSession {
  const session = sessions.get(req.negotiation_id);
  if (!session) throw new Error(`Negotiation ${req.negotiation_id} not found`);
  if (TERMINAL_STATUSES.includes(session.status)) {
    throw new Error(`Negotiation is in terminal status: ${session.status}`);
  }

  const offer = session.offers.find((o) => o.id === req.offer_id);
  if (!offer) throw new Error(`Offer ${req.offer_id} not found`);
  if (offer.status !== 'pending') throw new Error(`Offer is not pending: ${offer.status}`);

  const party = session.parties.find((p) => p.agent_id === req.agent_id);
  if (!party) throw new Error(`Agent ${req.agent_id} not in negotiation`);

  switch (req.action) {
    case 'accept': {
      party.has_accepted = true;
      recordAudit(req.negotiation_id, 'offer_accepted', {
        offer_id: req.offer_id,
      }, req.agent_id, offer.round);

      // Check if all non-observer parties have accepted
      const activeParties = session.parties.filter(
        (p) => p.role !== 'observer' && p.role !== 'mediator',
      );
      const allAccepted = activeParties.every((p) => p.has_accepted || p.agent_id === offer.from_agent_id);

      if (allAccepted && session.current_round >= session.min_rounds) {
        offer.status = 'accepted';
        session.status = 'agreed';
        session.completed_at = now();
        recordAudit(req.negotiation_id, 'agreement_reached', {
          offer_id: req.offer_id,
          round: offer.round,
          agreed_values: offer.proposed_values,
        });

        // Auto-generate agreement
        generateAgreement(session, offer);
      }
      break;
    }

    case 'reject': {
      offer.status = 'rejected';
      recordAudit(req.negotiation_id, 'offer_rejected', {
        offer_id: req.offer_id,
        message: req.message,
      }, req.agent_id, offer.round);

      // Check for deadlock
      checkDeadlock(session);
      break;
    }

    case 'counter': {
      if (!req.counter_values || req.counter_values.length === 0) {
        throw new Error('Counter-offer must include proposed values');
      }
      offer.status = 'countered';
      recordAudit(req.negotiation_id, 'offer_countered', {
        offer_id: req.offer_id,
      }, req.agent_id, offer.round);

      // Create the counter-offer
      makeOffer({
        negotiation_id: req.negotiation_id,
        from_agent_id: req.agent_id,
        proposed_values: req.counter_values,
        message: req.message,
      });
      break;
    }
  }

  session.updated_at = now();
  return session;
}

// ──────────────────────────────────────────────
// Auto Counter-Offer Generation
// ──────────────────────────────────────────────

/**
 * Generate a counter-offer using the agent's strategy.
 * This is the "AI" of negotiation — computing what to offer next
 * based on the agent's preferences, strategy, and opponent behavior.
 */
export function generateCounterOffer(req: GenerateCounterOfferRequest): NegotiationOffer {
  const session = sessions.get(req.negotiation_id);
  if (!session) throw new Error(`Negotiation ${req.negotiation_id} not found`);

  const party = session.parties.find((p) => p.agent_id === req.agent_id);
  if (!party) throw new Error(`Agent ${req.agent_id} not in negotiation`);

  const strategy = req.override_strategy ?? party.strategy;

  // Find opponent's last concession
  const opponentOffers = session.offers.filter((o) => o.from_agent_id !== req.agent_id);
  const lastOpponentOffer = opponentOffers[opponentOffers.length - 1];
  const opponentLastConcession = lastOpponentOffer?.concession_magnitude ?? 0;

  // Compute target utility for this round
  const targetUtility = computeTargetUtility(
    strategy,
    session.current_round + 1,
    session.max_rounds,
    party.strategy_params,
    opponentLastConcession,
    session.deadline,
  );

  // Generate values that achieve approximately the target utility
  const proposedValues: IssueValue[] = [];

  for (const pref of party.preferences) {
    const issue = session.issues.find((i) => i.id === pref.issue_id);
    if (!issue) continue;

    const value = computeValueForTargetUtility(pref, targetUtility, issue);
    proposedValues.push({ issue_id: pref.issue_id, value });
  }

  // Make the offer
  return makeOffer({
    negotiation_id: req.negotiation_id,
    from_agent_id: req.agent_id,
    proposed_values: proposedValues,
    message: `Auto-generated counter using ${strategy} strategy (target utility: ${targetUtility.toFixed(3)})`,
  });
}

/**
 * Compute a value for an issue that achieves approximately the target utility.
 */
function computeValueForTargetUtility(
  pref: IssuePreference,
  targetUtility: number,
  issue: import('./types').NegotiationIssue,
): number | string | boolean {
  if (typeof pref.ideal_value === 'boolean') {
    return targetUtility >= 0.5 ? pref.ideal_value : pref.reservation_value;
  }

  if (typeof pref.ideal_value === 'string') {
    return targetUtility >= 0.5 ? pref.ideal_value : pref.reservation_value;
  }

  // Numeric: interpolate between ideal and reservation
  const ideal = pref.ideal_value as number;
  const reservation = pref.reservation_value as number;

  let raw: number;
  switch (pref.utility_curve) {
    case 'concave':
      raw = targetUtility * targetUtility; // Inverse of sqrt
      break;
    case 'convex':
      raw = Math.sqrt(targetUtility); // Inverse of square
      break;
    case 'step':
      raw = targetUtility >= 0.5 ? 1.0 : 0.0;
      break;
    case 'linear':
    default:
      raw = targetUtility;
  }

  let value = reservation + raw * (ideal - reservation);

  // Clamp to issue bounds
  if (issue.min_value !== undefined) value = Math.max(issue.min_value, value);
  if (issue.max_value !== undefined) value = Math.min(issue.max_value, value);

  return Math.round(value * 100) / 100; // Round to 2 decimal places
}

// ──────────────────────────────────────────────
// ZOPA Detection
// ──────────────────────────────────────────────

/**
 * Compute Zone of Possible Agreement for each issue.
 * Requires access to all parties' reservation values (mediator view).
 */
export function computeZOPA(negotiation_id: string): ZOPAAnalysis[] {
  const session = sessions.get(negotiation_id);
  if (!session) throw new Error(`Negotiation ${negotiation_id} not found`);

  const activeParties = session.parties.filter(
    (p) => p.role !== 'observer' && p.role !== 'mediator',
  );

  const analyses: ZOPAAnalysis[] = [];

  for (const issue of session.issues) {
    const analysis = computeIssueZOPA(issue, activeParties);
    analyses.push(analysis);
  }

  // Store results on session
  session.zopa_analysis = analyses;
  session.zopa_exists = analyses.some((a) => a.exists);
  session.updated_at = now();

  recordAudit(negotiation_id, 'zopa_computed', {
    zopa_exists: session.zopa_exists,
    issues_with_zopa: analyses.filter((a) => a.exists).length,
    total_issues: analyses.length,
  });

  return analyses;
}

function computeIssueZOPA(
  issue: import('./types').NegotiationIssue,
  parties: NegotiationParty[],
): ZOPAAnalysis {
  const prefs = parties
    .map((p) => p.preferences.find((pr) => pr.issue_id === issue.id))
    .filter((p): p is IssuePreference => p !== undefined);

  if (prefs.length < 2) {
    return { issue_id: issue.id, exists: false, zopa_size: 0 };
  }

  if (issue.type === 'numeric') {
    // For numeric issues, ZOPA exists if reservation ranges overlap
    const reservations = prefs.map((p) => p.reservation_value as number);
    const ideals = prefs.map((p) => p.ideal_value as number);

    // Determine buyer/seller orientation
    const ranges = prefs.map((p) => ({
      min: Math.min(p.ideal_value as number, p.reservation_value as number),
      max: Math.max(p.ideal_value as number, p.reservation_value as number),
    }));

    const overlapMin = Math.max(...ranges.map((r) => r.min));
    const overlapMax = Math.min(...ranges.map((r) => r.max));

    if (overlapMin <= overlapMax) {
      const totalRange = Math.max(...ranges.map((r) => r.max)) - Math.min(...ranges.map((r) => r.min));
      const zopaSize = totalRange > 0 ? (overlapMax - overlapMin) / totalRange : 0;

      return {
        issue_id: issue.id,
        exists: true,
        overlap_min: overlapMin,
        overlap_max: overlapMax,
        zopa_size: zopaSize,
        focal_point: (overlapMin + overlapMax) / 2, // Midpoint as Schelling point
      };
    }

    return { issue_id: issue.id, exists: false, zopa_size: 0 };
  }

  if (issue.type === 'categorical') {
    // For categorical, ZOPA exists if there are common acceptable options
    const optionSets = prefs.map((p) => {
      if (typeof p.ideal_value === 'string') {
        // Simplified: ideal and reservation as the preference set
        const set = new Set<string>();
        set.add(p.ideal_value);
        if (typeof p.reservation_value === 'string') set.add(p.reservation_value);
        return set;
      }
      return new Set<string>();
    });

    // Find intersection
    const common = [...optionSets[0]].filter((opt) =>
      optionSets.every((s) => s.has(opt)),
    );

    return {
      issue_id: issue.id,
      exists: common.length > 0,
      common_options: common,
      zopa_size: issue.options ? common.length / issue.options.length : 0,
      focal_point: common[0],
    };
  }

  if (issue.type === 'boolean') {
    const allSame = prefs.every((p) => p.ideal_value === prefs[0].ideal_value);
    return {
      issue_id: issue.id,
      exists: allSame || prefs.some((p) => p.reservation_value !== p.ideal_value),
      zopa_size: allSame ? 1 : 0.5,
      focal_point: prefs[0].ideal_value,
    };
  }

  return { issue_id: issue.id, exists: false, zopa_size: 0 };
}

// ──────────────────────────────────────────────
// Pareto Analysis
// ──────────────────────────────────────────────

/**
 * Analyze Pareto efficiency of a specific offer or the latest offer.
 * Identifies improvement opportunities where both parties can gain.
 */
export function analyzeParetoEfficiency(
  negotiation_id: string,
  offer_id?: string,
): ParetoAnalysis {
  const session = sessions.get(negotiation_id);
  if (!session) throw new Error(`Negotiation ${negotiation_id} not found`);

  const offer = offer_id
    ? session.offers.find((o) => o.id === offer_id)
    : session.offers[session.offers.length - 1];

  if (!offer) throw new Error('No offers found');

  const activeParties = session.parties.filter(
    (p) => p.role !== 'observer' && p.role !== 'mediator',
  );

  // Compute current utilities for all parties
  const currentUtilities = activeParties.map((p) => ({
    agent_id: p.agent_id,
    utility: computeTotalUtility(p.preferences, offer.proposed_values),
  }));

  // Search for Pareto improvements
  const improvements: ParetoAnalysis['improvement_opportunities'] = [];

  for (const issue of session.issues) {
    if (issue.type !== 'numeric') continue;

    const step = ((issue.max_value ?? 100) - (issue.min_value ?? 0)) / 20;
    const currentValue = offer.proposed_values.find((v) => v.issue_id === issue.id);
    if (!currentValue || typeof currentValue.value !== 'number') continue;

    // Try small adjustments in both directions
    for (const delta of [-step, step]) {
      const testValue = (currentValue.value as number) + delta;
      if (issue.min_value !== undefined && testValue < issue.min_value) continue;
      if (issue.max_value !== undefined && testValue > issue.max_value) continue;

      const testValues = offer.proposed_values.map((v) =>
        v.issue_id === issue.id ? { ...v, value: testValue } : v,
      );

      const testUtilities = activeParties.map((p) => ({
        agent_id: p.agent_id,
        utility: computeTotalUtility(p.preferences, testValues),
      }));

      // Pareto improvement: at least one gains, none lose
      const allNoWorse = testUtilities.every((tu) => {
        const current = currentUtilities.find((cu) => cu.agent_id === tu.agent_id);
        return current && tu.utility >= current.utility - 0.001;
      });
      const someImproved = testUtilities.some((tu) => {
        const current = currentUtilities.find((cu) => cu.agent_id === tu.agent_id);
        return current && tu.utility > current.utility + 0.001;
      });

      if (allNoWorse && someImproved) {
        improvements.push({
          issue_id: issue.id,
          direction: delta > 0 ? 'increase' : 'decrease',
          suggested_value: testValue,
          utility_gain_initiator: (testUtilities[0]?.utility ?? 0) - (currentUtilities[0]?.utility ?? 0),
          utility_gain_responder: (testUtilities[1]?.utility ?? 0) - (currentUtilities[1]?.utility ?? 0),
        });
      }
    }
  }

  // Compute Nash bargaining solution
  const nashSolution = computeNashSolution(session, activeParties);

  // Efficiency score: ratio of current joint utility to Nash joint utility
  const currentJoint = currentUtilities.reduce((sum, u) => sum + u.utility, 0);
  const nashJoint = nashSolution
    ? activeParties.reduce(
        (sum, p) => sum + computeTotalUtility(p.preferences, nashSolution),
        0,
      )
    : currentJoint;
  const efficiency = nashJoint > 0 ? currentJoint / nashJoint : 0;

  const analysis: ParetoAnalysis = {
    negotiation_id,
    is_pareto_optimal: improvements.length === 0,
    improvement_opportunities: improvements,
    efficiency_score: Math.min(1, efficiency),
    nash_solution: nashSolution ?? undefined,
    analyzed_at: now(),
  };

  recordAudit(negotiation_id, 'pareto_analyzed', {
    is_optimal: analysis.is_pareto_optimal,
    efficiency: analysis.efficiency_score,
    improvements_found: improvements.length,
  });

  return analysis;
}

/**
 * Compute the Nash Bargaining Solution — the point that maximizes
 * the product of utility gains over the disagreement point (BATNA).
 */
function computeNashSolution(
  session: NegotiationSession,
  parties: NegotiationParty[],
): IssueValue[] | null {
  if (parties.length !== 2) return null; // Nash solution defined for bilateral

  const numericIssues = session.issues.filter((i) => i.type === 'numeric');
  if (numericIssues.length === 0) return null;

  // Get BATNA utilities (disagreement point)
  const batnaUtilities = parties.map((p) => p.batna?.alternative_utility ?? 0);

  // Grid search for Nash solution (maximize product of utility gains)
  let bestProduct = -1;
  let bestValues: IssueValue[] = [];

  // Sample points across each numeric issue
  const samples = 20;
  const issueRanges = numericIssues.map((issue) => ({
    id: issue.id,
    min: issue.min_value ?? 0,
    max: issue.max_value ?? 100,
  }));

  // For simplicity, optimize one issue at a time (coordinate descent)
  let currentValues: IssueValue[] = numericIssues.map((issue) => ({
    issue_id: issue.id,
    value: ((issue.min_value ?? 0) + (issue.max_value ?? 100)) / 2,
  }));

  for (let iteration = 0; iteration < 3; iteration++) {
    for (const range of issueRanges) {
      let bestVal = currentValues.find((v) => v.issue_id === range.id)?.value ?? range.min;
      let bestProd = -1;

      for (let s = 0; s <= samples; s++) {
        const testVal = range.min + (s / samples) * (range.max - range.min);
        const testValues = currentValues.map((v) =>
          v.issue_id === range.id ? { ...v, value: testVal } : v,
        );

        const utilities = parties.map((p) => computeTotalUtility(p.preferences, testValues));
        const gains = utilities.map((u, i) => Math.max(0, u - batnaUtilities[i]));
        const product = gains.reduce((a, b) => a * b, 1);

        if (product > bestProd) {
          bestProd = product;
          bestVal = testVal;
        }
      }

      currentValues = currentValues.map((v) =>
        v.issue_id === range.id ? { ...v, value: Math.round((bestVal as number) * 100) / 100 } : v,
      );
      if (bestProd > bestProduct) {
        bestProduct = bestProd;
        bestValues = [...currentValues];
      }
    }
  }

  return bestValues;
}

// ──────────────────────────────────────────────
// Mediation Protocol
// ──────────────────────────────────────────────

/**
 * Trigger mediation when negotiation is deadlocked.
 */
export function triggerMediation(req: TriggerMediationRequest): NegotiationOffer {
  const session = sessions.get(req.negotiation_id);
  if (!session) throw new Error(`Negotiation ${req.negotiation_id} not found`);
  if (TERMINAL_STATUSES.includes(session.status)) {
    throw new Error(`Negotiation is in terminal status: ${session.status}`);
  }

  session.status = 'mediated';
  session.updated_at = now();

  const mediationStrategy = session.mediation?.mediation_strategy ?? 'split_difference';

  recordAudit(req.negotiation_id, 'mediation_triggered', {
    reason: req.reason,
    strategy: mediationStrategy,
    mediator: req.mediator_agent_id,
  });

  // Generate mediator's proposal based on strategy
  const activeParties = session.parties.filter(
    (p) => p.role !== 'observer' && p.role !== 'mediator',
  );

  let mediatorValues: IssueValue[];

  switch (mediationStrategy) {
    case 'split_difference': {
      mediatorValues = computeSplitDifference(session, activeParties);
      break;
    }

    case 'single_text': {
      // Start from Nash solution and adjust
      const nash = computeNashSolution(session, activeParties);
      mediatorValues = nash ?? computeSplitDifference(session, activeParties);
      break;
    }

    case 'interest_based': {
      // Weight by relative importance — give each party what they value most
      mediatorValues = computeInterestBasedSolution(session, activeParties);
      break;
    }

    case 'binding_arbitration': {
      // Pick the offer closest to fair (highest min-utility across parties)
      mediatorValues = computeArbitrationSolution(session, activeParties);
      break;
    }

    default:
      mediatorValues = computeSplitDifference(session, activeParties);
  }

  // Add mediator as party if not present
  const mediatorId = req.mediator_agent_id ?? 'system_mediator';
  if (!session.parties.find((p) => p.agent_id === mediatorId)) {
    session.parties.push({
      agent_id: mediatorId,
      role: 'mediator',
      strategy: 'linear',
      preferences: [],
      has_accepted: false,
      offers_made: 0,
      joined_at: now(),
    });
  }

  const mediatorOffer = makeOffer({
    negotiation_id: req.negotiation_id,
    from_agent_id: mediatorId,
    proposed_values: mediatorValues,
    message: `Mediator proposal using ${mediationStrategy} strategy`,
  });

  recordAudit(req.negotiation_id, 'mediator_proposal', {
    offer_id: mediatorOffer.id,
    strategy: mediationStrategy,
    values: mediatorValues,
  });

  return mediatorOffer;
}

function computeSplitDifference(
  session: NegotiationSession,
  parties: NegotiationParty[],
): IssueValue[] {
  // Average the last offers from each party
  const lastOffers = parties.map((p) => {
    const offers = session.offers.filter((o) => o.from_agent_id === p.agent_id);
    return offers[offers.length - 1];
  }).filter((o): o is NegotiationOffer => o !== undefined);

  return session.issues.map((issue) => {
    const values = lastOffers
      .map((o) => o.proposed_values.find((v) => v.issue_id === issue.id)?.value)
      .filter((v): v is number | string | boolean => v !== undefined);

    if (values.length === 0) {
      return { issue_id: issue.id, value: issue.min_value ?? 0 };
    }

    if (issue.type === 'numeric') {
      const numValues = values.filter((v): v is number => typeof v === 'number');
      const avg = numValues.reduce((a, b) => a + b, 0) / numValues.length;
      return { issue_id: issue.id, value: Math.round(avg * 100) / 100 };
    }

    // For non-numeric, take the most common value
    return { issue_id: issue.id, value: values[0] };
  });
}

function computeInterestBasedSolution(
  session: NegotiationSession,
  parties: NegotiationParty[],
): IssueValue[] {
  // For each issue, give the value closest to the party who cares most about it
  return session.issues.map((issue) => {
    let maxWeight = -1;
    let dominantPref: IssuePreference | null = null;

    for (const party of parties) {
      const pref = party.preferences.find((p) => p.issue_id === issue.id);
      if (pref && pref.weight > maxWeight) {
        maxWeight = pref.weight;
        dominantPref = pref;
      }
    }

    if (dominantPref) {
      // Give 70% weight to the party who cares most
      if (typeof dominantPref.ideal_value === 'number') {
        const otherPrefs = parties
          .map((p) => p.preferences.find((pr) => pr.issue_id === issue.id))
          .filter((p): p is IssuePreference => p !== null && p !== undefined && p !== dominantPref);

        if (otherPrefs.length > 0) {
          const otherIdeal = otherPrefs[0].ideal_value as number;
          const blended = (dominantPref.ideal_value as number) * 0.7 + otherIdeal * 0.3;
          return { issue_id: issue.id, value: Math.round(blended * 100) / 100 };
        }
      }
      return { issue_id: issue.id, value: dominantPref.ideal_value };
    }

    return { issue_id: issue.id, value: issue.min_value ?? 0 };
  });
}

function computeArbitrationSolution(
  session: NegotiationSession,
  parties: NegotiationParty[],
): IssueValue[] {
  // Maximize the minimum utility across all parties (maximin fairness)
  const numericIssues = session.issues.filter((i) => i.type === 'numeric');
  const samples = 30;

  let bestValues = session.issues.map((i) => ({
    issue_id: i.id,
    value: ((i.min_value ?? 0) + (i.max_value ?? 100)) / 2 as number | string | boolean,
  }));
  let bestMinUtility = -1;

  // Monte Carlo search for maximin solution
  for (let s = 0; s < samples * numericIssues.length; s++) {
    const testValues: IssueValue[] = session.issues.map((issue) => {
      if (issue.type === 'numeric') {
        const min = issue.min_value ?? 0;
        const max = issue.max_value ?? 100;
        return { issue_id: issue.id, value: min + Math.random() * (max - min) };
      }
      return { issue_id: issue.id, value: bestValues.find((v) => v.issue_id === issue.id)?.value ?? 0 };
    });

    const utilities = parties.map((p) => computeTotalUtility(p.preferences, testValues));
    const minUtility = Math.min(...utilities);

    if (minUtility > bestMinUtility) {
      bestMinUtility = minUtility;
      bestValues = testValues.map((v) => ({
        ...v,
        value: typeof v.value === 'number' ? Math.round(v.value * 100) / 100 : v.value,
      }));
    }
  }

  return bestValues;
}

// ──────────────────────────────────────────────
// Agreement Generation
// ──────────────────────────────────────────────

function generateAgreement(session: NegotiationSession, acceptedOffer: NegotiationOffer): NegotiationAgreement {
  const agreement: NegotiationAgreement = {
    id: generateId('agr'),
    negotiation_id: session.id,
    agreed_values: acceptedOffer.proposed_values,
    signatories: session.parties
      .filter((p) => p.role !== 'observer')
      .map((p) => ({
        agent_id: p.agent_id,
        signed_at: now(),
        signature_hash: generateId('sig'), // Placeholder for real crypto
      })),
    status: 'signed',
    effective_from: now(),
    created_at: now(),
  };

  agreements.set(agreement.id, agreement);
  recordAudit(session.id, 'agreement_signed', {
    agreement_id: agreement.id,
    signatories: agreement.signatories.map((s) => s.agent_id),
  });

  return agreement;
}

/**
 * Sign a negotiation agreement.
 */
export function signAgreement(req: SignAgreementRequest): NegotiationAgreement {
  const session = sessions.get(req.negotiation_id);
  if (!session) throw new Error(`Negotiation ${req.negotiation_id} not found`);
  if (session.status !== 'agreed') throw new Error('Negotiation not in agreed state');

  const agreement = Array.from(agreements.values()).find(
    (a) => a.negotiation_id === req.negotiation_id,
  );
  if (!agreement) throw new Error('Agreement not found');

  const existing = agreement.signatories.find((s) => s.agent_id === req.agent_id);
  if (existing) return agreement; // Already signed

  agreement.signatories.push({
    agent_id: req.agent_id,
    signed_at: now(),
    signature_hash: generateId('sig'),
  });

  return agreement;
}

/**
 * Get agreement for a negotiation.
 */
export function getAgreement(negotiation_id: string): NegotiationAgreement | null {
  return Array.from(agreements.values()).find(
    (a) => a.negotiation_id === negotiation_id,
  ) ?? null;
}

// ──────────────────────────────────────────────
// Deadlock Detection
// ──────────────────────────────────────────────

function checkDeadlock(session: NegotiationSession): void {
  if (!session.mediation) return;

  const recentOffers = session.offers.slice(-session.mediation.deadlock_threshold * 2);
  if (recentOffers.length < session.mediation.deadlock_threshold * 2) return;

  // Check if concessions have stalled
  const avgConcession = recentOffers
    .filter((o) => o.concession_magnitude !== undefined)
    .reduce((sum, o) => sum + (o.concession_magnitude ?? 0), 0) / recentOffers.length;

  if (avgConcession < 0.01) {
    session.status = 'mediated';
    recordAudit(session.id, 'mediation_triggered', {
      reason: 'deadlock_detected',
      avg_concession: avgConcession,
      rounds_analyzed: recentOffers.length,
    });
  }
}

// ──────────────────────────────────────────────
// Helper: Offer Distance
// ──────────────────────────────────────────────

function computeOfferDistance(
  prev: IssueValue[],
  next: IssueValue[],
  issues: import('./types').NegotiationIssue[],
): number {
  let totalDistance = 0;
  let count = 0;

  for (const nextVal of next) {
    const prevVal = prev.find((v) => v.issue_id === nextVal.issue_id);
    const issue = issues.find((i) => i.id === nextVal.issue_id);
    if (!prevVal || !issue) continue;

    if (issue.type === 'numeric' && typeof prevVal.value === 'number' && typeof nextVal.value === 'number') {
      const range = (issue.max_value ?? 100) - (issue.min_value ?? 0);
      if (range > 0) {
        totalDistance += Math.abs(nextVal.value - prevVal.value) / range;
      }
    } else if (prevVal.value !== nextVal.value) {
      totalDistance += 1;
    }
    count++;
  }

  return count > 0 ? totalDistance / count : 0;
}

// ──────────────────────────────────────────────
// Round Summary & Analytics
// ──────────────────────────────────────────────

/**
 * Get round-by-round summary for analytics.
 */
export function getRoundSummaries(negotiation_id: string): NegotiationRoundSummary[] {
  const session = sessions.get(negotiation_id);
  if (!session) throw new Error(`Negotiation ${negotiation_id} not found`);

  const roundMap = new Map<number, NegotiationOffer[]>();
  for (const offer of session.offers) {
    const existing = roundMap.get(offer.round) ?? [];
    existing.push(offer);
    roundMap.set(offer.round, existing);
  }

  const summaries: NegotiationRoundSummary[] = [];
  let prevTime = new Date(session.created_at).getTime();

  for (const [round, offers] of Array.from(roundMap.entries()).sort((a, b) => a[0] - b[0])) {
    const concessions: Record<string, number> = {};
    for (const offer of offers) {
      if (offer.concession_magnitude !== undefined) {
        concessions[offer.from_agent_id] = offer.concession_magnitude;
      }
    }

    const latestOffer = offers[offers.length - 1];
    const offerTime = new Date(latestOffer.created_at).getTime();

    // Distance to agreement: average distance between offers in this round
    let distanceToAgreement = 0;
    if (offers.length >= 2) {
      distanceToAgreement = computeOfferDistance(
        offers[0].proposed_values,
        offers[offers.length - 1].proposed_values,
        session.issues,
      );
    }

    summaries.push({
      round,
      offers_in_round: offers,
      concession_magnitudes: concessions,
      distance_to_agreement: distanceToAgreement,
      convergence_rate: summaries.length > 0
        ? (summaries[summaries.length - 1].distance_to_agreement - distanceToAgreement)
        : 0,
      elapsed_time_ms: offerTime - prevTime,
    });

    prevTime = offerTime;
  }

  return summaries;
}

// ──────────────────────────────────────────────
// Audit Queries
// ──────────────────────────────────────────────

/**
 * Get audit trail for a negotiation.
 */
export function getAuditTrail(
  negotiation_id: string,
  event_type?: NegotiationEventType,
): NegotiationAuditEntry[] {
  let entries = auditLog.filter((e) => e.negotiation_id === negotiation_id);
  if (event_type) {
    entries = entries.filter((e) => e.event_type === event_type);
  }
  return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// ──────────────────────────────────────────────
// Session Cancellation
// ──────────────────────────────────────────────

/**
 * Cancel a negotiation session.
 */
export function cancelNegotiation(
  negotiation_id: string,
  agent_id: string,
  reason: string,
): NegotiationSession {
  const session = sessions.get(negotiation_id);
  if (!session) throw new Error(`Negotiation ${negotiation_id} not found`);
  if (TERMINAL_STATUSES.includes(session.status)) {
    throw new Error(`Negotiation is already in terminal status: ${session.status}`);
  }

  const party = session.parties.find((p) => p.agent_id === agent_id);
  if (!party) throw new Error(`Agent ${agent_id} not in negotiation`);

  session.status = 'cancelled';
  session.completed_at = now();
  session.updated_at = now();

  recordAudit(negotiation_id, 'negotiation_cancelled', {
    cancelled_by: agent_id,
    reason,
  }, agent_id);

  return session;
}

// ──────────────────────────────────────────────
// Store Reset (for testing)
// ──────────────────────────────────────────────

export function _resetStores(): void {
  sessions.clear();
  agreements.clear();
  auditLog.length = 0;
}
