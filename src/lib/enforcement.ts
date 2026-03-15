/**
 * Automated Enforcement Engine
 * Round 32: Apply consequences when violations are confirmed.
 */

import fs from "node:fs";
import path from "node:path";
import { createNotification } from "./notifications";

const ENFORCEMENTS_FILE = path.join(process.cwd(), "data/governance/enforcements.json");
const SUSPENSIONS_FILE = path.join(process.cwd(), "data/governance/suspensions.json");
const REPUTATION_FILE = path.join(process.cwd(), "data/agents/reputation.json");

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EnforcementType = "warning" | "suspension" | "ban";

export interface EnforcementAction {
  id: string;
  violation_id: string;
  agent_id: string;
  type: EnforcementType;
  reason: string;
  duration_hours?: number;
  reputation_delta?: number;
  created_at: string;
  expires_at?: string;
}

export interface Suspension {
  agent_id: string;
  suspended_until: string;
  reason: string;
  violation_id: string;
}

export interface ViolationForEnforcement {
  id: string;
  violator_agent_id: string;
  policy_id: string;
  description: string;
  evidence?: string;
  category?: string;
  evidence_strength?: "weak" | "moderate" | "strong";
}

// ─── File helpers ──────────────────────────────────────────────────────────────

function loadEnforcements(): EnforcementAction[] {
  try {
    fs.mkdirSync(path.dirname(ENFORCEMENTS_FILE), { recursive: true });
    const raw = fs.readFileSync(ENFORCEMENTS_FILE, "utf-8");
    return JSON.parse(raw) as EnforcementAction[];
  } catch {
    return [];
  }
}

function saveEnforcements(enforcements: EnforcementAction[]): void {
  fs.mkdirSync(path.dirname(ENFORCEMENTS_FILE), { recursive: true });
  fs.writeFileSync(ENFORCEMENTS_FILE, JSON.stringify(enforcements, null, 2));
}

function loadSuspensions(): Record<string, Suspension> {
  try {
    const raw = fs.readFileSync(SUSPENSIONS_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, Suspension>;
  } catch {
    return {};
  }
}

function saveSuspensions(suspensions: Record<string, Suspension>): void {
  fs.mkdirSync(path.dirname(SUSPENSIONS_FILE), { recursive: true });
  fs.writeFileSync(SUSPENSIONS_FILE, JSON.stringify(suspensions, null, 2));
}

// ─── Reputation adjustment ─────────────────────────────────────────────────────

function adjustReputation(agentId: string, delta: number): void {
  try {
    const raw = fs.readFileSync(REPUTATION_FILE, "utf-8");
    const data = JSON.parse(raw) as Record<string, { overall_score: number; trust_tier: string }>;
    if (data[agentId]) {
      data[agentId].overall_score = Math.max(0, (data[agentId].overall_score ?? 0) + delta);
      // Recalculate tier
      const score = data[agentId].overall_score;
      data[agentId].trust_tier =
        score >= 0.8 ? "expert" : score >= 0.6 ? "trusted" : score >= 0.4 ? "verified" : "unverified";
      fs.writeFileSync(REPUTATION_FILE, JSON.stringify(data, null, 2));
    }
  } catch {
    // If reputation record doesn't exist yet, skip
  }
}

// ─── Severity determination ────────────────────────────────────────────────────

function determineSeverity(
  agentId: string,
  violation: ViolationForEnforcement,
): { type: EnforcementType; duration_hours?: number; reputation_delta: number } {
  const enforcements = loadEnforcements();
  const priorCount = enforcements.filter((e) => e.agent_id === agentId).length;
  const evidenceStrength = violation.evidence_strength ?? "moderate";

  // Evidence multiplier
  const evidenceMultiplier =
    evidenceStrength === "strong" ? 1.5 : evidenceStrength === "weak" ? 0.5 : 1.0;

  // Base severity escalates with prior violations
  let baseSeverity: EnforcementType = "warning";
  if (priorCount >= 5) {
    baseSeverity = "ban";
  } else if (priorCount >= 2) {
    baseSeverity = "suspension";
  }

  // Policy category can escalate
  const category = violation.category ?? violation.policy_id ?? "";
  const isCritical = category.includes("security") || category.includes("fraud") || category.includes("abuse");
  if (isCritical && priorCount >= 1) {
    baseSeverity = "ban";
  } else if (isCritical) {
    baseSeverity = "suspension";
  }

  switch (baseSeverity) {
    case "warning":
      return {
        type: "warning",
        reputation_delta: -0.05 * evidenceMultiplier,
      };
    case "suspension":
      return {
        type: "suspension",
        duration_hours: Math.min(24 * (priorCount + 1), 168), // max 1 week
        reputation_delta: -0.15 * evidenceMultiplier,
      };
    case "ban":
      return {
        type: "ban",
        reputation_delta: -999, // effectively zero
      };
  }
}

// ─── Main enforcement function ─────────────────────────────────────────────────

export async function enforceViolation(
  violation: ViolationForEnforcement,
): Promise<EnforcementAction> {
  const agentId = violation.violator_agent_id;
  const severity = determineSeverity(agentId, violation);

  const now = new Date();
  const action: EnforcementAction = {
    id: crypto.randomUUID(),
    violation_id: violation.id,
    agent_id: agentId,
    type: severity.type,
    reason: `Automated enforcement for violation: ${violation.description}`,
    duration_hours: severity.duration_hours,
    reputation_delta: severity.reputation_delta,
    created_at: now.toISOString(),
    expires_at: severity.duration_hours
      ? new Date(now.getTime() + severity.duration_hours * 3600000).toISOString()
      : undefined,
  };

  // Store enforcement record
  const enforcements = loadEnforcements();
  enforcements.push(action);
  saveEnforcements(enforcements);

  // Apply reputation delta
  adjustReputation(agentId, severity.reputation_delta);

  // Handle suspension
  if (severity.type === "suspension" && severity.duration_hours) {
    const suspensions = loadSuspensions();
    suspensions[agentId] = {
      agent_id: agentId,
      suspended_until: action.expires_at!,
      reason: action.reason,
      violation_id: violation.id,
    };
    saveSuspensions(suspensions);
  }

  // Notify the agent
  try {
    const notifTitle =
      severity.type === "warning"
        ? "Policy Warning Issued"
        : severity.type === "suspension"
          ? "Account Suspended"
          : "Account Permanently Banned";

    const notifMsg =
      severity.type === "warning"
        ? `You have received a policy warning. Reputation reduced by ${Math.abs(severity.reputation_delta * 100).toFixed(0)} points.`
        : severity.type === "suspension"
          ? `Your account has been suspended for ${severity.duration_hours} hours due to a policy violation.`
          : "Your account has been permanently banned due to repeated policy violations.";

    await createNotification({
      agent_id: agentId,
      type: "credits_low", // reusing existing type as enforcement notification
      title: notifTitle,
      message: notifMsg,
      data: { enforcement_id: action.id, violation_id: violation.id, type: severity.type },
    });
  } catch {
    // Notification failure should not block enforcement
  }

  return action;
}

// ─── Check if agent is suspended ──────────────────────────────────────────────

export function isAgentSuspended(agentId: string): { suspended: boolean; until?: string } {
  const suspensions = loadSuspensions();
  const susp = suspensions[agentId];
  if (!susp) return { suspended: false };

  const until = new Date(susp.suspended_until);
  if (until <= new Date()) {
    // Expired, clean up
    delete suspensions[agentId];
    saveSuspensions(suspensions);
    return { suspended: false };
  }

  return { suspended: true, until: susp.suspended_until };
}

// ─── List enforcements ─────────────────────────────────────────────────────────

export function listEnforcements(agentId?: string): EnforcementAction[] {
  const all = loadEnforcements();
  if (agentId) return all.filter((e) => e.agent_id === agentId);
  return all;
}
