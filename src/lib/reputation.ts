import path from "node:path";
import { JsonDictStore } from "./data-store";

const REPUTATION_FILE = path.join(process.cwd(), "data/agents/reputation.json");
const store = new JsonDictStore<ReputationRecord>(REPUTATION_FILE);

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
  verified_skills?: string[];
  last_calculated: string;
  created_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeRecord(agentId: string): ReputationRecord {
  const now = new Date().toISOString();
  return {
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

// ─── Score calculation ─────────────────────────────────────────────────────────

export function calculateScore(record: ReputationRecord): number {
  const signals = record.signals;
  const total = signals.tasks_completed + signals.tasks_failed;
  if (total === 0) return 0;

  const completionRate = signals.tasks_completed / total;
  const ratingScore = signals.average_rating > 0 ? (signals.average_rating - 1) / 4 : 0;
  const disputePenalty = 1 - Math.min(1, signals.dispute_rate * 2);
  const volumeBonus = Math.min(1, Math.log10(total + 1) / Math.log10(51));
  const decayWeight = calculateDecayWeight(record.history);

  const rawScore =
    completionRate * 0.4 +
    ratingScore * 0.3 +
    disputePenalty * 0.2 +
    volumeBonus * 0.1;

  const finalScore = rawScore * 0.7 + decayWeight * 0.3;
  return Math.round(Math.min(1, Math.max(0, finalScore)) * 1000) / 1000;
}

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

function scoreToTier(score: number): TrustTier {
  if (score >= 0.85) return "expert";
  if (score >= 0.6) return "trusted";
  if (score >= 0.3) return "verified";
  return "unverified";
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getReputation(agentId: string): Promise<ReputationRecord> {
  const data = await store.getAll();
  const record = data[agentId] ?? makeRecord(agentId);
  record.overall_score = calculateScore(record);
  record.trust_tier = scoreToTier(record.overall_score);
  record.last_calculated = new Date().toISOString();
  return record;
}

export async function recordTaskCompleted(
  agentId: string,
  taskId: string,
  rating?: number,
): Promise<ReputationRecord> {
  return store.transaction(async (data) => {
    if (!data[agentId]) data[agentId] = makeRecord(agentId);
    const record = data[agentId];
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
    record.trust_tier = scoreToTier(record.overall_score);
    record.last_calculated = now;

    return { data, result: record };
  });
}

export async function recordTaskFailed(agentId: string, taskId: string): Promise<ReputationRecord> {
  return store.transaction(async (data) => {
    if (!data[agentId]) data[agentId] = makeRecord(agentId);
    const record = data[agentId];
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
    record.trust_tier = scoreToTier(record.overall_score);
    record.last_calculated = now;

    return { data, result: record };
  });
}

export async function addVerifiedSkill(agentId: string, skill: string): Promise<ReputationRecord> {
  return store.transaction(async (data) => {
    if (!data[agentId]) data[agentId] = makeRecord(agentId);
    const record = data[agentId];
    if (!record.verified_skills) record.verified_skills = [];
    if (!record.verified_skills.includes(skill)) {
      record.verified_skills.push(skill);
    }
    record.last_calculated = new Date().toISOString();
    return { data, result: record };
  });
}
