/**
 * Outcome Tracking & Value Metrics
 * Track meaningful outcomes beyond simple API calls.
 * Round 22
 */

import path from "node:path";
import { JsonFileStore } from "./data-store";

const OUTCOMES_FILE = path.join(process.cwd(), "data/analytics/outcomes.json");

export type OutcomeType =
  | "task_completed_successfully"
  | "knowledge_query_led_to_task"
  | "report_purchase_led_to_action"
  | "agent_matched_successfully";

export interface OutcomeRecord {
  id: string;
  type: OutcomeType;
  agent_id: string;
  task_id?: string;
  credits_value?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const store = new JsonFileStore<OutcomeRecord>(OUTCOMES_FILE);

// ─── Public API ────────────────────────────────────────────────────────────────

export async function recordOutcome(
  input: Omit<OutcomeRecord, "id" | "created_at">,
): Promise<OutcomeRecord> {
  const record: OutcomeRecord = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...input,
  };
  return store.create(record);
}

/**
 * Fire-and-forget outcome recording.
 */
export function trackOutcome(input: Omit<OutcomeRecord, "id" | "created_at">): void {
  recordOutcome(input).catch(() => {});
}

export interface OutcomeMetrics {
  period: string;
  task_success_rate: number;
  avg_task_completion_hours: number;
  knowledge_utilization_rate: number;
  report_action_rate: number;
  match_success_rate: number;
  value_generated_credits: number;
  total_outcomes: number;
}

export async function getOutcomeMetrics(periodDays = 30): Promise<OutcomeMetrics> {
  const since = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const all = await store.query((o) => new Date(o.created_at).getTime() >= since);

  const total = all.length;

  const byType = (type: OutcomeType) => all.filter((o) => o.type === type);

  const completed = byType("task_completed_successfully");
  const knowledgeToTask = byType("knowledge_query_led_to_task");
  const reportToAction = byType("report_purchase_led_to_action");
  const matched = byType("agent_matched_successfully");

  // Task success rate = completed / (completed + failed approaches — approximated from total tasks)
  const taskSuccessRate = total > 0 ? completed.length / Math.max(total, completed.length) : 0;

  // Average task completion — use metadata.completion_hours if present
  const completionTimes = completed
    .map((o) => (o.metadata?.completion_hours as number) ?? null)
    .filter((v): v is number => v !== null);
  const avgCompletionHours =
    completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

  const knowledgeTotal = knowledgeToTask.length + completed.length;
  const knowledgeUtilRate =
    knowledgeTotal > 0 ? knowledgeToTask.length / knowledgeTotal : 0;

  const reportTotal = reportToAction.length + completed.length;
  const reportActionRate = reportTotal > 0 ? reportToAction.length / reportTotal : 0;

  const matchTotal = matched.length + completed.length;
  const matchSuccessRate = matchTotal > 0 ? matched.length / matchTotal : 0;

  const valueGenerated = all.reduce((sum, o) => sum + (o.credits_value ?? 0), 0);

  return {
    period: `${periodDays}d`,
    task_success_rate: Math.round(taskSuccessRate * 1000) / 1000,
    avg_task_completion_hours: Math.round(avgCompletionHours * 10) / 10,
    knowledge_utilization_rate: Math.round(knowledgeUtilRate * 1000) / 1000,
    report_action_rate: Math.round(reportActionRate * 1000) / 1000,
    match_success_rate: Math.round(matchSuccessRate * 1000) / 1000,
    value_generated_credits: valueGenerated,
    total_outcomes: total,
  };
}
