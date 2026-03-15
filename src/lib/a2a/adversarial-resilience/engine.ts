/**
 * A2A Adversarial Resilience Engine
 *
 * Core business logic for threat detection, Byzantine fault-tolerant consensus,
 * agent quarantine, integrity proof chains, and adaptive immune memory.
 *
 * Design principles:
 * - Defense in depth: multiple independent detection mechanisms
 * - Graduated response: shadow → restrict → quarantine → expel
 * - Cryptographic verification: Merkle proof chains for output integrity
 * - Adaptive learning: threat signatures evolve from observed attacks
 * - Byzantine tolerance: critical decisions use BFT with f < n/3
 * - Minimal false positives: quarantine auto-expires, human review flagged
 */

import { createHash, randomUUID } from 'crypto';
import type {
  AgentThreat,
  ThreatCategory,
  ThreatSeverity,
  ThreatStatus,
  ThreatEvidence,
  DetectionMethod,
  ResponseAction,
  ResponseActionType,
  ResponseStatus,
  AgentQuarantine,
  QuarantineLevel,
  QuarantineEscalation,
  ByzantineVoteRound,
  BFTPhase,
  BFTVote,
  IntegrityProof,
  MerklePathNode,
  ProofVerification,
  ThreatSignature,
  ThreatPattern,
  BehavioralIndicator,
  NetworkHealthReport,
  AlertLevel,
  NetworkRisk,
} from './types';

// ── In-Memory Stores ────────────────────────────────────────────────────────
// Production: back these with Supabase tables

const threats = new Map<string, AgentThreat>();
const quarantines = new Map<string, AgentQuarantine>();
const bftRounds = new Map<string, ByzantineVoteRound>();
const integrityProofs = new Map<string, IntegrityProof>();
const threatSignatures = new Map<string, ThreatSignature>();
/** Agent proof chains: agentId → latest proof ID. */
const agentProofHeads = new Map<string, string>();
/** Agent proof sequence counters: agentId → next sequence number. */
const agentProofSequences = new Map<string, number>();

// ── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Severity ordering for comparison. */
const SEVERITY_ORDER: Record<ThreatSeverity, number> = {
  low: 0, medium: 1, high: 2, critical: 3,
};

/** Quarantine level ordering. */
const QUARANTINE_ORDER: Record<QuarantineLevel, number> = {
  shadow: 0, restricted: 1, quarantined: 2, expelled: 3,
};

/** Map severity to recommended initial quarantine level. */
function severityToQuarantine(severity: ThreatSeverity): QuarantineLevel {
  switch (severity) {
    case 'low': return 'shadow';
    case 'medium': return 'restricted';
    case 'high': return 'quarantined';
    case 'critical': return 'quarantined'; // 'expelled' requires human approval
  }
}

/** Determine auto-response actions based on threat severity and category. */
function determineAutoResponses(
  threat: AgentThreat
): ResponseAction[] {
  const actions: ResponseAction[] = [];
  const ts = now();

  // Always alert operators for high/critical
  if (SEVERITY_ORDER[threat.severity] >= SEVERITY_ORDER.high) {
    actions.push({
      id: randomUUID(),
      type: 'alert_operators',
      status: 'active',
      target_agent_id: threat.suspect_agent_ids[0],
      threat_id: threat.id,
      details: `${threat.severity} threat detected: ${threat.category}`,
      requires_approval: false,
      approved_by: null,
      ttl_seconds: 0,
      created_at: ts,
      expires_at: null,
      reverted_at: null,
    });
  }

  // Cascade corruption warrants peer immunization
  if (threat.category === 'cascade_corruption') {
    actions.push({
      id: randomUUID(),
      type: 'immunize_peers',
      status: 'active',
      target_agent_id: threat.suspect_agent_ids[0],
      threat_id: threat.id,
      details: 'Cascade corruption detected — warning connected agents',
      requires_approval: false,
      approved_by: null,
      ttl_seconds: 3600,
      created_at: ts,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      reverted_at: null,
    });
  }

  // Output manipulation requires rollback
  if (threat.category === 'output_manipulation' && threat.confidence > 0.8) {
    actions.push({
      id: randomUUID(),
      type: 'rollback_outputs',
      status: 'pending',
      target_agent_id: threat.suspect_agent_ids[0],
      threat_id: threat.id,
      details: 'High-confidence output manipulation — rolling back recent outputs',
      requires_approval: true, // destructive action needs approval
      approved_by: null,
      ttl_seconds: 0,
      created_at: ts,
      expires_at: null,
      reverted_at: null,
    });
  }

  // Auto-quarantine based on severity
  const quarantineLevel = severityToQuarantine(threat.severity);
  if (QUARANTINE_ORDER[quarantineLevel] >= QUARANTINE_ORDER.restricted) {
    for (const agentId of threat.suspect_agent_ids) {
      actions.push({
        id: randomUUID(),
        type: quarantineLevel === 'quarantined' ? 'quarantine' : 'restrict_capabilities',
        status: 'active',
        target_agent_id: agentId,
        threat_id: threat.id,
        details: `Auto-${quarantineLevel} due to ${threat.severity} ${threat.category} threat`,
        requires_approval: false,
        approved_by: null,
        ttl_seconds: threat.severity === 'critical' ? 0 : 3600,
        created_at: ts,
        expires_at: threat.severity === 'critical'
          ? null
          : new Date(Date.now() + 3600_000).toISOString(),
        reverted_at: null,
      });
    }
  }

  return actions;
}

// ── Threat Detection & Reporting ────────────────────────────────────────────

/** Report a new threat detected in the network. */
export function reportThreat(params: {
  reporter_agent_id: string;
  suspect_agent_ids: string[];
  category: ThreatCategory;
  description: string;
  evidence: Array<Omit<ThreatEvidence, 'observed_at'>>;
}): { threat: AgentThreat; auto_responses: ResponseAction[] } {
  const ts = now();

  // Calculate confidence from evidence anomaly scores
  const avgAnomaly = params.evidence.length > 0
    ? params.evidence.reduce((sum, e) => sum + e.anomaly_score, 0) / params.evidence.length
    : 0;
  const confidence = Math.min(1, avgAnomaly / 5); // normalize: 5σ = 100% confidence

  // Determine severity from category + confidence
  const severity = determineSeverity(params.category, confidence);

  const fullEvidence: ThreatEvidence[] = params.evidence.map(e => ({
    ...e,
    observed_at: ts,
  }));

  // Check for correlated threats
  const correlated = findCorrelatedThreats(params.suspect_agent_ids, params.category);

  const threat: AgentThreat = {
    id: randomUUID(),
    category: params.category,
    severity,
    status: 'detected',
    suspect_agent_ids: params.suspect_agent_ids,
    victim_agent_ids: [],
    description: params.description,
    evidence: fullEvidence,
    confidence,
    detected_by: 'peer_report',
    response_actions: [],
    correlated_threats: correlated.map(t => t.id),
    created_at: ts,
    updated_at: ts,
    resolved_at: null,
  };

  // Determine automated responses
  const autoResponses = determineAutoResponses(threat);
  threat.response_actions = autoResponses;

  // Auto-quarantine suspects based on severity
  for (const agentId of params.suspect_agent_ids) {
    const level = severityToQuarantine(severity);
    if (QUARANTINE_ORDER[level] > QUARANTINE_ORDER.shadow) {
      applyQuarantine(agentId, level, [threat.id], `Auto-quarantine: ${params.category}`);
    }
  }

  // Update immune memory
  updateThreatSignatures(threat);

  threats.set(threat.id, threat);
  return { threat, auto_responses: autoResponses };
}

function determineSeverity(category: ThreatCategory, confidence: number): ThreatSeverity {
  // Critical categories
  if (['cascade_corruption', 'privilege_escalation'].includes(category) && confidence > 0.6) {
    return 'critical';
  }
  // High categories
  if (['prompt_injection', 'collusion', 'sybil_attack'].includes(category) && confidence > 0.5) {
    return 'high';
  }
  // Confidence-based escalation
  if (confidence > 0.8) return 'high';
  if (confidence > 0.5) return 'medium';
  return 'low';
}

function findCorrelatedThreats(suspectIds: string[], category: ThreatCategory): AgentThreat[] {
  const correlated: AgentThreat[] = [];
  for (const threat of threats.values()) {
    if (threat.status === 'mitigated' || threat.status === 'false_positive') continue;
    const sharesSuspects = threat.suspect_agent_ids.some(id => suspectIds.includes(id));
    const sameCategory = threat.category === category;
    if (sharesSuspects || sameCategory) {
      correlated.push(threat);
    }
  }
  return correlated;
}

/** Update threat status. */
export function updateThreatStatus(
  threatId: string,
  status: ThreatStatus,
  details?: string
): AgentThreat {
  const threat = threats.get(threatId);
  if (!threat) throw new Error(`Threat ${threatId} not found`);

  threat.status = status;
  threat.updated_at = now();
  if (status === 'mitigated' || status === 'false_positive') {
    threat.resolved_at = now();
  }

  // If false positive, release quarantines
  if (status === 'false_positive') {
    for (const agentId of threat.suspect_agent_ids) {
      const q = quarantines.get(agentId);
      if (q && q.trigger_threat_ids.length === 1 && q.trigger_threat_ids[0] === threatId) {
        releaseQuarantine(agentId, 'Threat resolved as false positive', true);
      }
    }
  }

  return threat;
}

/** Get all active threats. */
export function getActiveThreats(params?: {
  category?: ThreatCategory;
  min_severity?: ThreatSeverity;
  agent_id?: string;
}): AgentThreat[] {
  let result = Array.from(threats.values()).filter(
    t => t.status !== 'mitigated' && t.status !== 'false_positive'
  );

  if (params?.category) {
    result = result.filter(t => t.category === params.category);
  }
  if (params?.min_severity) {
    const minOrder = SEVERITY_ORDER[params.min_severity];
    result = result.filter(t => SEVERITY_ORDER[t.severity] >= minOrder);
  }
  if (params?.agent_id) {
    result = result.filter(
      t => t.suspect_agent_ids.includes(params.agent_id!) ||
           t.victim_agent_ids.includes(params.agent_id!)
    );
  }

  return result.sort((a, b) =>
    SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
  );
}

/** Get a specific threat by ID. */
export function getThreat(threatId: string): AgentThreat | undefined {
  return threats.get(threatId);
}

// ── Quarantine Management ───────────────────────────────────────────────────

function applyQuarantine(
  agentId: string,
  level: QuarantineLevel,
  threatIds: string[],
  reason: string,
  ttlSeconds = 0,
): AgentQuarantine {
  const existing = quarantines.get(agentId);
  const ts = now();

  if (existing) {
    // Only escalate, never de-escalate automatically
    if (QUARANTINE_ORDER[level] <= QUARANTINE_ORDER[existing.level]) {
      existing.trigger_threat_ids = [
        ...new Set([...existing.trigger_threat_ids, ...threatIds]),
      ];
      existing.updated_at = ts;
      return existing;
    }

    // Escalate
    existing.escalation_history.push({
      from_level: existing.level,
      to_level: level,
      reason,
      escalated_at: ts,
    });
    existing.level = level;
    existing.trigger_threat_ids = [
      ...new Set([...existing.trigger_threat_ids, ...threatIds]),
    ];
    existing.updated_at = ts;
    return existing;
  }

  const quarantine: AgentQuarantine = {
    agent_id: agentId,
    level,
    trigger_threat_ids: threatIds,
    restricted_capabilities: [],
    blocked_peers: [],
    escalation_history: [],
    expires_at: ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null,
    human_reviewed: false,
    created_at: ts,
    updated_at: ts,
  };

  quarantines.set(agentId, quarantine);
  return quarantine;
}

/** Quarantine an agent at a specified level. */
export function quarantineAgent(params: {
  agent_id: string;
  level: QuarantineLevel;
  threat_ids: string[];
  reason: string;
  ttl_seconds: number;
}): AgentQuarantine {
  return applyQuarantine(
    params.agent_id,
    params.level,
    params.threat_ids,
    params.reason,
    params.ttl_seconds,
  );
}

/** Escalate an agent's quarantine to a higher level. */
export function escalateQuarantine(params: {
  agent_id: string;
  new_level: QuarantineLevel;
  reason: string;
}): AgentQuarantine {
  const existing = quarantines.get(params.agent_id);
  if (!existing) {
    throw new Error(`Agent ${params.agent_id} is not quarantined`);
  }
  if (QUARANTINE_ORDER[params.new_level] <= QUARANTINE_ORDER[existing.level]) {
    throw new Error(
      `Cannot escalate from ${existing.level} to ${params.new_level} — same or lower level`
    );
  }
  if (params.new_level === 'expelled') {
    // Expulsion requires human review
    existing.human_reviewed = false;
  }

  existing.escalation_history.push({
    from_level: existing.level,
    to_level: params.new_level,
    reason: params.reason,
    escalated_at: now(),
  });
  existing.level = params.new_level;
  existing.updated_at = now();
  return existing;
}

/** Release an agent from quarantine. */
export function releaseQuarantine(
  agentId: string,
  reason: string,
  shadowMonitor: boolean,
): AgentQuarantine {
  const existing = quarantines.get(agentId);
  if (!existing) {
    throw new Error(`Agent ${agentId} is not quarantined`);
  }

  if (shadowMonitor) {
    existing.escalation_history.push({
      from_level: existing.level,
      to_level: 'shadow',
      reason,
      escalated_at: now(),
    });
    existing.level = 'shadow';
    existing.expires_at = new Date(Date.now() + 24 * 3600_000).toISOString(); // 24h shadow
  } else {
    quarantines.delete(agentId);
  }

  existing.updated_at = now();
  return existing;
}

/** Get an agent's quarantine status. */
export function getQuarantine(agentId: string): AgentQuarantine | undefined {
  return quarantines.get(agentId);
}

/** Get all quarantined agents. */
export function getAllQuarantines(): AgentQuarantine[] {
  return Array.from(quarantines.values());
}

/** Check if an agent is allowed to perform an action given quarantine state. */
export function isAgentAllowed(agentId: string, capabilityId?: string): boolean {
  const q = quarantines.get(agentId);
  if (!q) return true;

  switch (q.level) {
    case 'shadow': return true; // shadow = allowed but monitored
    case 'restricted':
      return capabilityId
        ? !q.restricted_capabilities.includes(capabilityId)
        : true;
    case 'quarantined': return false;
    case 'expelled': return false;
  }
}

// ── Byzantine Fault Tolerance ───────────────────────────────────────────────

/** Initiate a new BFT voting round. */
export function initiateBFTRound(params: {
  proposal: string;
  proposal_data: Record<string, unknown>;
  participant_ids: string[];
}): ByzantineVoteRound {
  const n = params.participant_ids.length;
  if (n < 4) {
    throw new Error('BFT requires at least 4 participants (to tolerate 1 fault)');
  }

  const f = Math.floor((n - 1) / 3);
  const quorum = 2 * f + 1;

  const round: ByzantineVoteRound = {
    id: randomUUID(),
    proposal: params.proposal,
    proposal_data: params.proposal_data,
    phase: 'pre_prepare',
    participants: params.participant_ids,
    fault_tolerance: f,
    vote_commitments: {},
    revealed_votes: {},
    consensus_reached: false,
    decided_value: null,
    equivocators: [],
    quorum_size: quorum,
    created_at: now(),
    decided_at: null,
  };

  bftRounds.set(round.id, round);
  return round;
}

/** Submit a vote commitment (hash of value + nonce) during the prepare phase. */
export function submitBFTVoteCommitment(params: {
  round_id: string;
  agent_id: string;
  commitment: string;
}): { round: ByzantineVoteRound; phase_advanced: boolean } {
  const round = bftRounds.get(params.round_id);
  if (!round) throw new Error(`BFT round ${params.round_id} not found`);
  if (!round.participants.includes(params.agent_id)) {
    throw new Error(`Agent ${params.agent_id} is not a participant in this round`);
  }
  if (round.phase !== 'pre_prepare' && round.phase !== 'prepare') {
    throw new Error(`Cannot submit commitment in phase ${round.phase}`);
  }

  // Check if agent is quarantined
  if (!isAgentAllowed(params.agent_id)) {
    throw new Error(`Agent ${params.agent_id} is quarantined and cannot vote`);
  }

  // Detect equivocation: if agent already committed a different value
  if (round.vote_commitments[params.agent_id] &&
      round.vote_commitments[params.agent_id] !== params.commitment) {
    round.equivocators.push(params.agent_id);
    // Report as threat
    reportThreat({
      reporter_agent_id: 'system',
      suspect_agent_ids: [params.agent_id],
      category: 'output_manipulation',
      description: `Agent equivocated in BFT round ${round.id}: sent different vote commitments`,
      evidence: [{
        type: 'cryptographic_failure',
        observation: `Original commitment: ${round.vote_commitments[params.agent_id]}, new: ${params.commitment}`,
        anomaly_score: 10,
        data: { round_id: round.id },
      }],
    });
    throw new Error(`Agent ${params.agent_id} detected as equivocator`);
  }

  round.vote_commitments[params.agent_id] = params.commitment;

  // Advance phase when quorum of commitments received
  let phaseAdvanced = false;
  if (round.phase === 'pre_prepare') {
    round.phase = 'prepare';
    phaseAdvanced = true;
  }

  const commitCount = Object.keys(round.vote_commitments).length;
  if (commitCount >= round.quorum_size && round.phase === 'prepare') {
    round.phase = 'commit';
    phaseAdvanced = true;
  }

  return { round, phase_advanced: phaseAdvanced };
}

/** Reveal a vote (value + nonce) during the commit phase. */
export function revealBFTVote(params: {
  round_id: string;
  agent_id: string;
  value: unknown;
  nonce: string;
}): { round: ByzantineVoteRound; vote_verified: boolean; consensus_reached: boolean } {
  const round = bftRounds.get(params.round_id);
  if (!round) throw new Error(`BFT round ${params.round_id} not found`);
  if (round.phase !== 'commit') {
    throw new Error(`Cannot reveal vote in phase ${round.phase}`);
  }

  const commitment = round.vote_commitments[params.agent_id];
  if (!commitment) {
    throw new Error(`Agent ${params.agent_id} did not submit a commitment`);
  }

  // Verify commitment: SHA-256(JSON(value) + nonce) should match
  const expectedHash = sha256(JSON.stringify(params.value) + params.nonce);
  const verified = expectedHash === commitment;

  const vote: BFTVote = {
    value: params.value,
    commitment,
    nonce: params.nonce,
    verified,
    voted_at: now(),
  };

  round.revealed_votes[params.agent_id] = vote;

  if (!verified) {
    round.equivocators.push(params.agent_id);
  }

  // Check for consensus: count verified votes with the same value
  const verifiedVotes = Object.values(round.revealed_votes).filter(v => v.verified);
  const valueCounts = new Map<string, number>();
  for (const v of verifiedVotes) {
    const key = JSON.stringify(v.value);
    valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
  }

  let consensusReached = false;
  for (const [valueKey, count] of valueCounts) {
    if (count >= round.quorum_size) {
      round.consensus_reached = true;
      round.decided_value = JSON.parse(valueKey);
      round.phase = 'decided';
      round.decided_at = now();
      consensusReached = true;
      break;
    }
  }

  // If all votes revealed and no consensus, mark as failed
  if (!consensusReached && Object.keys(round.revealed_votes).length >= round.participants.length) {
    round.phase = 'failed';
  }

  return { round, vote_verified: verified, consensus_reached: consensusReached };
}

/** Get a BFT round by ID. */
export function getBFTRound(roundId: string): ByzantineVoteRound | undefined {
  return bftRounds.get(roundId);
}

/** Get all active BFT rounds. */
export function getActiveBFTRounds(): ByzantineVoteRound[] {
  return Array.from(bftRounds.values()).filter(
    r => r.phase !== 'decided' && r.phase !== 'failed'
  );
}

// ── Integrity Proof Chain ───────────────────────────────────────────────────

/** Generate an integrity proof for an agent's output. */
export function generateIntegrityProof(params: {
  agent_id: string;
  task_id: string;
  output_content: string;
  input_content: string;
  capability_id: string;
}): IntegrityProof {
  const ts = now();
  const outputHash = sha256(params.output_content);
  const inputHash = sha256(params.input_content);

  const previousProofId = agentProofHeads.get(params.agent_id) ?? null;
  const sequenceNumber = agentProofSequences.get(params.agent_id) ?? 0;

  // Build Merkle path: chain previous proofs
  const merklePath: MerklePathNode[] = [];
  if (previousProofId) {
    const prevProof = integrityProofs.get(previousProofId);
    if (prevProof) {
      merklePath.push({
        hash: prevProof.merkle_root,
        position: 'left',
      });
    }
  }

  // Compute Merkle root: hash of (previous_root + current_output_hash)
  const previousRoot = merklePath.length > 0 ? merklePath[0].hash : sha256('genesis');
  const merkleRoot = sha256(previousRoot + outputHash);

  // Signature: hash of the entire proof content (simulating agent signing)
  const signatureContent = [
    params.agent_id, params.task_id, outputHash, inputHash,
    merkleRoot, sequenceNumber.toString(), ts,
  ].join(':');
  const signature = sha256(signatureContent + ':agent_secret');

  const proof: IntegrityProof = {
    id: randomUUID(),
    agent_id: params.agent_id,
    task_id: params.task_id,
    output_hash: outputHash,
    input_hash: inputHash,
    capability_id: params.capability_id,
    merkle_root: merkleRoot,
    merkle_path: merklePath,
    previous_proof_id: previousProofId,
    sequence_number: sequenceNumber,
    timestamp: ts,
    signature,
  };

  integrityProofs.set(proof.id, proof);
  agentProofHeads.set(params.agent_id, proof.id);
  agentProofSequences.set(params.agent_id, sequenceNumber + 1);

  return proof;
}

/** Verify an integrity proof against actual output content. */
export function verifyIntegrityProof(
  proofId: string,
  outputContent: string,
): ProofVerification {
  const proof = integrityProofs.get(proofId);
  if (!proof) throw new Error(`Proof ${proofId} not found`);

  const issues: string[] = [];

  // 1. Verify output hash matches
  const actualHash = sha256(outputContent);
  const outputMatches = actualHash === proof.output_hash;
  if (!outputMatches) {
    issues.push(`Output hash mismatch: expected ${proof.output_hash}, got ${actualHash}`);
  }

  // 2. Verify Merkle path
  let merkleValid = true;
  if (proof.merkle_path.length > 0) {
    const previousRoot = proof.merkle_path[0].hash;
    const expectedRoot = sha256(previousRoot + proof.output_hash);
    if (expectedRoot !== proof.merkle_root) {
      merkleValid = false;
      issues.push('Merkle root does not match recomputed path');
    }
  } else {
    // Genesis proof: root should be hash of genesis + output
    const expectedRoot = sha256(sha256('genesis') + proof.output_hash);
    if (expectedRoot !== proof.merkle_root) {
      merkleValid = false;
      issues.push('Genesis Merkle root mismatch');
    }
  }

  // 3. Verify chain continuity
  let chainContinuous = true;
  if (proof.previous_proof_id) {
    const prevProof = integrityProofs.get(proof.previous_proof_id);
    if (!prevProof) {
      chainContinuous = false;
      issues.push(`Previous proof ${proof.previous_proof_id} not found — chain broken`);
    } else if (prevProof.sequence_number !== proof.sequence_number - 1) {
      chainContinuous = false;
      issues.push('Sequence number gap in proof chain');
    }
  } else if (proof.sequence_number !== 0) {
    chainContinuous = false;
    issues.push('Non-genesis proof has no previous proof ID');
  }

  // 4. Verify signature
  const signatureContent = [
    proof.agent_id, proof.task_id, proof.output_hash, proof.input_hash,
    proof.merkle_root, proof.sequence_number.toString(), proof.timestamp,
  ].join(':');
  const expectedSignature = sha256(signatureContent + ':agent_secret');
  const signatureValid = expectedSignature === proof.signature;
  if (!signatureValid) {
    issues.push('Signature verification failed');
  }

  const verified = outputMatches && merkleValid && chainContinuous && signatureValid;

  // If verification fails, report as potential threat
  if (!verified) {
    reportThreat({
      reporter_agent_id: 'system',
      suspect_agent_ids: [proof.agent_id],
      category: 'output_manipulation',
      description: `Integrity proof verification failed: ${issues.join('; ')}`,
      evidence: [{
        type: 'cryptographic_failure',
        observation: `Proof ${proofId} failed verification: ${issues.join('; ')}`,
        anomaly_score: 8,
        data: { proof_id: proofId, issues },
      }],
    });
  }

  return {
    proof_id: proofId,
    merkle_valid: merkleValid,
    chain_continuous: chainContinuous,
    signature_valid: signatureValid,
    output_matches: outputMatches,
    verified,
    issues,
    verified_at: now(),
  };
}

/** Get an integrity proof by ID. */
export function getIntegrityProof(proofId: string): IntegrityProof | undefined {
  return integrityProofs.get(proofId);
}

/** Get an agent's full proof chain. */
export function getAgentProofChain(agentId: string): IntegrityProof[] {
  const chain: IntegrityProof[] = [];
  let currentId = agentProofHeads.get(agentId);

  while (currentId) {
    const proof = integrityProofs.get(currentId);
    if (!proof) break;
    chain.unshift(proof); // prepend to get chronological order
    currentId = proof.previous_proof_id ?? undefined;
  }

  return chain;
}

// ── Adaptive Immune Memory ──────────────────────────────────────────────────

function updateThreatSignatures(threat: AgentThreat): void {
  // Check if we have an existing signature for this category
  const existingSignatures = Array.from(threatSignatures.values()).filter(
    s => s.category === threat.category
  );

  if (existingSignatures.length > 0) {
    // Update existing signature with new data
    const sig = existingSignatures[0];
    sig.match_count++;
    sig.learned_from.push(threat.id);
    sig.confidence = Math.min(1, sig.confidence + 0.05);
    sig.updated_at = now();
    return;
  }

  // Create new signature from this threat
  const indicators: BehavioralIndicator[] = threat.evidence.map(e => ({
    metric: e.type,
    operator: 'deviation_gt' as const,
    threshold: Math.max(2, e.anomaly_score * 0.7), // 70% of observed anomaly
    weight: 1 / threat.evidence.length,
  }));

  const signature: ThreatSignature = {
    id: randomUUID(),
    category: threat.category,
    name: `${threat.category}_sig_${Date.now()}`,
    pattern: {
      behavioral_indicators: indicators,
      min_match_count: Math.max(1, Math.ceil(indicators.length * 0.6)),
      time_window_seconds: 3600,
      risk_factors: [],
    },
    match_count: 1,
    false_positive_rate: 0.1, // Initial conservative estimate
    active: true,
    confidence: threat.confidence * 0.8, // Discount for single observation
    learned_from: [threat.id],
    created_at: now(),
    updated_at: now(),
  };

  threatSignatures.set(signature.id, signature);
}

/** Get threat intelligence — learned signatures and network health. */
export function getThreatIntelligence(params?: {
  category?: ThreatCategory;
  min_severity?: ThreatSeverity;
  active_only?: boolean;
}): { signatures: ThreatSignature[]; network_health: NetworkHealthReport } {
  let sigs = Array.from(threatSignatures.values());

  if (params?.category) {
    sigs = sigs.filter(s => s.category === params.category);
  }
  if (params?.active_only !== false) {
    sigs = sigs.filter(s => s.active);
  }

  return {
    signatures: sigs,
    network_health: generateNetworkHealthReport(),
  };
}

/** Get a specific threat signature. */
export function getThreatSignature(signatureId: string): ThreatSignature | undefined {
  return threatSignatures.get(signatureId);
}

// ── Network Health Report ───────────────────────────────────────────────────

function generateNetworkHealthReport(): NetworkHealthReport {
  const activeThreats = Array.from(threats.values()).filter(
    t => t.status !== 'mitigated' && t.status !== 'false_positive'
  );
  const allQuarantines = Array.from(quarantines.values());
  const activeBFT = Array.from(bftRounds.values()).filter(
    r => r.phase !== 'decided' && r.phase !== 'failed'
  );

  const quarantinedCount = allQuarantines.filter(
    q => q.level === 'quarantined' || q.level === 'expelled'
  ).length;
  const shadowedCount = allQuarantines.filter(q => q.level === 'shadow').length;

  // Calculate health score
  const criticalCount = activeThreats.filter(t => t.severity === 'critical').length;
  const highCount = activeThreats.filter(t => t.severity === 'high').length;
  let healthScore = 100;
  healthScore -= criticalCount * 25;
  healthScore -= highCount * 10;
  healthScore -= quarantinedCount * 5;
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Determine alert level
  let alertLevel: AlertLevel = 'green';
  if (criticalCount > 0) alertLevel = 'red';
  else if (highCount > 0) alertLevel = 'orange';
  else if (activeThreats.length > 0) alertLevel = 'yellow';

  // Recent mitigations (last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const recentMitigations = Array.from(threats.values()).filter(
    t => t.status === 'mitigated' && t.resolved_at && t.resolved_at > oneDayAgo
  ).length;

  // Proof coverage
  const agentsWithProofs = agentProofHeads.size;
  const totalAgentsEstimate = Math.max(agentsWithProofs, activeThreats.length, 1);
  const proofCoverage = (agentsWithProofs / totalAgentsEstimate) * 100;

  // Top risks
  const topRisks: NetworkRisk[] = [];
  if (criticalCount > 0) {
    topRisks.push({
      description: `${criticalCount} critical threat(s) active`,
      severity: 'critical',
      affected_agents: activeThreats
        .filter(t => t.severity === 'critical')
        .flatMap(t => t.suspect_agent_ids).length,
      recommended_action: 'Immediate investigation and human review required',
    });
  }
  if (quarantinedCount > 3) {
    topRisks.push({
      description: `${quarantinedCount} agents quarantined — possible coordinated attack`,
      severity: 'high',
      affected_agents: quarantinedCount,
      recommended_action: 'Review quarantined agents for common attack patterns',
    });
  }

  return {
    health_score: healthScore,
    active_threats: activeThreats.length,
    quarantined_agents: quarantinedCount,
    shadowed_agents: shadowedCount,
    active_bft_rounds: activeBFT.length,
    proof_coverage: Math.round(proofCoverage),
    threat_signatures_count: threatSignatures.size,
    recent_mitigations: recentMitigations,
    alert_level: alertLevel,
    top_risks: topRisks,
    generated_at: now(),
  };
}

/** Get the current network health report. */
export function getNetworkHealth(): NetworkHealthReport {
  return generateNetworkHealthReport();
}

// ── Agent Resilience Check ──────────────────────────────────────────────────

/** Comprehensive resilience check for a specific agent. */
export function checkAgentResilience(agentId: string): {
  agent_id: string;
  quarantined: boolean;
  quarantine_level: QuarantineLevel | null;
  active_threats: AgentThreat[];
  proof_chain_length: number;
  proof_chain_valid: boolean;
  historical_threat_count: number;
  resilience_score: number;
} {
  const quarantine = quarantines.get(agentId);
  const activeAgentThreats = getActiveThreats({ agent_id: agentId });

  // Proof chain validation
  const proofChain = getAgentProofChain(agentId);
  let proofChainValid = true;
  for (let i = 1; i < proofChain.length; i++) {
    if (proofChain[i].previous_proof_id !== proofChain[i - 1].id) {
      proofChainValid = false;
      break;
    }
  }

  // Historical threats
  const allAgentThreats = Array.from(threats.values()).filter(
    t => t.suspect_agent_ids.includes(agentId)
  );
  const confirmedThreats = allAgentThreats.filter(t => t.status === 'confirmed');
  const falsePositives = allAgentThreats.filter(t => t.status === 'false_positive');

  // Resilience score
  let score = 100;
  score -= activeAgentThreats.length * 15;
  score -= confirmedThreats.length * 10;
  score += falsePositives.length * 2; // bonus for cleared suspicions
  if (!proofChainValid) score -= 20;
  if (proofChain.length === 0) score -= 10; // no proof chain = less trustworthy
  if (quarantine) score -= QUARANTINE_ORDER[quarantine.level] * 15;
  score = Math.max(0, Math.min(100, score));

  return {
    agent_id: agentId,
    quarantined: !!quarantine && quarantine.level !== 'shadow',
    quarantine_level: quarantine?.level ?? null,
    active_threats: activeAgentThreats,
    proof_chain_length: proofChain.length,
    proof_chain_valid: proofChainValid,
    historical_threat_count: allAgentThreats.length,
    resilience_score: score,
  };
}
