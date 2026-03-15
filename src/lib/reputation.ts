import fs from "node:fs";
import path from "node:path";

const REPUTATION_FILE = path.join(process.cwd(), "data/agents/reputation.json");

export type TrustTier = "unverified" | "verified" | "trusted" | "expert";

export interface ReputationSignals {
  tasks_completed: number;
  tasks_failed: number;
  average_rating: number;
  response_time_avg: number; // hours
  dispute_rate: number; // 0-1
}

export interface ReputationEvent {
  id: string;
  type: "task_completed" | "task_failed" | "rating_received" | "dispute_filed" | "dispute_resolved";
  value: number;
  task_id?: string;
  created_at: string;
}

export interface ReputationRecord {
  agent_id: string;
  overall_score: number;
  trust_tier: TrustTier;
  signals: ReputationSignals;
  history: ReputationEvent[];
  last_calculated: string;
  created_at: string;
}

// ─── File helpers ──────────────────────────────────────────────────────────────

function readReputation(): Record<string, ReputationRecord> {
  try {
    const raw = fs.readFileSync(REPUTATION_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, ReputationRecord>;
  } catch {
    return {};
  }
}

function writeReputation(data: Record<string, ReputationRecord>): void {
  const dir = path.dirname(REPUTATION_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(REPUTATION_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function ensureReputation(
  data: Record<string, ReputationRecord>,
  agentId: string,
): ReputationRecord {
  if (!data[agentId]) {
    const now = new Date().toISOString();
    data[agentId] = {
      agent_id: agentId,
      overall_score: 0,
      trust_tier: "unverified",
      signals: {
        tasks_completed: 0,
        tasks_failed: 0,
        average_rating: 0,
        response_time_avg: 0,
        dispute_rate: 0,
      },
      history: [],
      last_calculated: now,
      created_at: now,
    };
  }
  return data[agentId];
}

// ─── Score calculation ─────────────────────────────────────────────────────────

/**
 * Calculate overall reputation score using exponential decay weighting.
 * Recent events weigh more heavily.
 * Score range: 0-1
 */
export function calculateScore(record: ReputationRecord): number {
  const signals = record.signals;
  const total = signals.tasks_completed + signals.tasks_failed;

  if (total === 0) return 0;

  // Completion rate: 40% weight
  const completionRate = signals.tasks_completed / total;

  // Rating score: 30% weight (normalize 1-5 to 0-1)
  const ratingScore = signals.average_rating > 0 ? (signals.average_rating - 1) / 4 : 0;

  // Dispute penalty: 20% weight (lower is better)
  const disputePenalty = 1 - Math.min(1, signals.dispute_rate * 2);

  // Volume bonus: 10% weight (logarithmic growth, cap at 50 tasks)
  const volumeBonus = Math.min(1, Math.log10(total + 1) / Math.log10(51));

  // Apply exponential decay on history — recent events count more
  const decayWeight = calculateDecayWeight(record.history);

  const rawScore =
    completionRate * 0.4 +
    ratingScore * 0.3 +
    disputePenalty * 0.2 +
    volumeBonus * 0.1;

  // Blend raw score with decay-weighted score
  const finalScore = rawScore * 0.7 + decayWeight * 0.3;

  return Math.round(Math.min(1, Math.max(0, finalScore)) * 1000) / 1000;
}

/**
 * Calculate a decay-weighted performance score.
 * Events within 30 days get full weight; older events decay.
 */
function calculateDecayWeight(history: ReputationEvent[]): number {
  if (history.length === 0) return 0;

  const now = Date.now();
  const DECAY_DAYS = 30;
  let weightedSum = 0;
  let totalWeight = 0;

  for (const event of history) {
    const ageMs = now - new Date(event.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const weight = Math.exp(-ageDays / DECAY_DAYS);

    let contribution = 0;
    if (event.type === "task_completed") contribution = 1;
    else if (event.type === "task_failed") contribution = 0;
    else if (event.type === "rating_received") contribution = (event.value - 1) / 4;
    else if (event.type === "dispute_filed") contribution = 0;
    else if (event.type === "dispute_resolved") contribution = 0.5;

    weightedSum += contribution * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function scoreTtoTier(score: number): TrustTier {
  if (score >= 0.85) return "expert";
  if (score >= 0.6) return "trusted";
  if (score >= 0.3) return "verified";
  return "unverified";
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function getReputation(agentId: string): ReputationRecord {
  const data = readReputation();
  const record = ensureReputation(data, agentId);
  // Recalculate score on read
  record.overall_score = calculateScore(record);
  record.trust_tier = scoreTtoTier(record.overall_score);
  record.last_calculated = new Date().toISOString();
  return record;
}

export function recordTaskCompleted(
  agentId: string,
  taskId: string,
  rating?: number,
): ReputationRecord {
  const data = readReputation();
  const record = ensureReputation(data, agentId);
  const now = new Date().toISOString();

  record.signals.tasks_completed += 1;
  record.history.push({
    id: crypto.randomUUID(),
    type: "task_completed",
    value: 1,
    task_id: taskId,
    created_at: now,
  });

  if (rating !== undefined) {
    // Update rolling average
    const prevTotal = record.signals.tasks_completed - 1;
    record.signals.average_rating =
      (record.signals.average_rating * prevTotal + rating) / record.signals.tasks_completed;

    record.history.push({
      id: crypto.randomUUID(),
      type: "rating_received",
      value: rating,
      task_id: taskId,
      created_at: now,
    });
  }

  record.overall_score = calculateScore(record);
  record.trust_tier = scoreTtoTier(record.overall_score);
  record.last_calculated = now;

  data[agentId] = record;
  writeReputation(data);
  return record;
}

export function recordTaskFailed(agentId: string, taskId: string): ReputationRecord {
  const data = readReputation();
  const record = ensureReputation(data, agentId);
  const now = new Date().toISOString();

  record.signals.tasks_failed += 1;
  record.history.push({
    id: crypto.randomUUID(),
    type: "task_failed",
    value: 0,
    task_id: taskId,
    created_at: now,
  });

  const total = record.signals.tasks_completed + record.signals.tasks_failed;
  record.signals.dispute_rate = record.signals.tasks_failed / total;

  record.overall_score = calculateScore(record);
  record.trust_tier = scoreTtoTier(record.overall_score);
  record.last_calculated = now;

  data[agentId] = record;
  writeReputation(data);
  return record;
}
