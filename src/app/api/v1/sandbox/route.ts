/**
 * Agent Sandbox / Playground
 * Create isolated test environments with pre-configured agents and data.
 * Round 37
 */

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { JsonFileStore } from "@/lib/data-store";
import { getCorsHeaders } from "@/lib/api-headers";
import { verifyAgentAuth } from "@/lib/agent-auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SandboxScenario = "marketplace" | "research" | "collaboration";
export type SandboxStatus = "active" | "idle" | "teardown";

export interface SandboxAgent {
  agent_id: string;
  name: string;
  capabilities: string[];
  role: string;
}

export interface SandboxTask {
  id: string;
  title: string;
  skills_required: string[];
  budget: number;
}

export interface Sandbox {
  id: string;
  scenario: SandboxScenario;
  status: SandboxStatus;
  created_at: string;
  expires_at: string;
  created_by: string;
  namespace: string; // data prefix: "sandbox:{id}:"
  agents: SandboxAgent[];
  tasks: SandboxTask[];
  data_keys: string[];
  call_count: number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const SANDBOX_FILE = path.join(process.cwd(), "data/sandboxes/sandboxes.json");
const store = new JsonFileStore<Sandbox>(SANDBOX_FILE);

// ─── Scenario seeds ───────────────────────────────────────────────────────────

function seedForScenario(sandboxId: string, scenario: SandboxScenario): {
  agents: SandboxAgent[];
  tasks: SandboxTask[];
} {
  const ns = `sandbox:${sandboxId}`;

  if (scenario === "marketplace") {
    return {
      agents: [
        { agent_id: `${ns}:buyer-agent`, name: "Test Buyer", capabilities: ["project-management", "requirements"], role: "buyer" },
        { agent_id: `${ns}:seller-agent-1`, name: "Test Developer", capabilities: ["python", "backend", "api"], role: "seller" },
        { agent_id: `${ns}:seller-agent-2`, name: "Test ML Engineer", capabilities: ["ml", "data-science", "python"], role: "seller" },
      ],
      tasks: [
        { id: `${ns}:task-1`, title: "Build a REST API endpoint", skills_required: ["backend", "api"], budget: 100 },
        { id: `${ns}:task-2`, title: "Train a classification model", skills_required: ["ml", "python"], budget: 250 },
      ],
    };
  }

  if (scenario === "research") {
    return {
      agents: [
        { agent_id: `${ns}:researcher-1`, name: "Test Researcher Alpha", capabilities: ["research", "writing", "analysis"], role: "researcher" },
        { agent_id: `${ns}:researcher-2`, name: "Test Researcher Beta", capabilities: ["data", "statistics", "research"], role: "researcher" },
        { agent_id: `${ns}:coordinator`, name: "Test Coordinator", capabilities: ["project-management", "writing"], role: "coordinator" },
      ],
      tasks: [
        { id: `${ns}:task-1`, title: "Literature review on LLM alignment", skills_required: ["research", "nlp"], budget: 50 },
        { id: `${ns}:task-2`, title: "Synthesize findings into report", skills_required: ["writing", "analysis"], budget: 75 },
      ],
    };
  }

  // collaboration
  return {
    agents: [
      { agent_id: `${ns}:agent-frontend`, name: "Test Frontend Dev", capabilities: ["frontend", "react", "ui"], role: "frontend" },
      { agent_id: `${ns}:agent-backend`, name: "Test Backend Dev", capabilities: ["backend", "api", "database"], role: "backend" },
      { agent_id: `${ns}:agent-qa`, name: "Test QA Agent", capabilities: ["testing", "qa", "automation"], role: "qa" },
    ],
    tasks: [
      { id: `${ns}:task-1`, title: "Build dashboard UI", skills_required: ["frontend", "react"], budget: 150 },
      { id: `${ns}:task-2`, title: "Implement API layer", skills_required: ["backend", "api"], budget: 200 },
      { id: `${ns}:task-3`, title: "Write e2e tests", skills_required: ["testing", "qa"], budget: 80 },
    ],
  };
}

// ─── OPTIONS ──────────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

// ─── POST /api/v1/sandbox ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const headers = getCorsHeaders();
  const auth = await verifyAgentAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  const scenario = body.scenario as SandboxScenario;
  if (!["marketplace", "research", "collaboration"].includes(scenario)) {
    return NextResponse.json(
      { error: "scenario must be one of: marketplace, research, collaboration" },
      { status: 400, headers },
    );
  }

  const id = crypto.randomUUID();
  const seed = seedForScenario(id, scenario);
  const now = new Date();
  const expires = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours TTL

  const sandbox: Sandbox = {
    id,
    scenario,
    status: "active",
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    created_by: auth.agent_id!,
    namespace: `sandbox:${id}:`,
    agents: seed.agents,
    tasks: seed.tasks,
    data_keys: [],
    call_count: 0,
  };

  await store.create(sandbox);

  return NextResponse.json(
    {
      sandbox_id: id,
      scenario,
      namespace: sandbox.namespace,
      agents: sandbox.agents,
      tasks: sandbox.tasks,
      expires_at: sandbox.expires_at,
      usage: {
        hint: `Use POST /api/v1/sandbox/${id}/execute to run API steps in this sandbox.`,
        teardown: `DELETE /api/v1/sandbox/${id}`,
      },
    },
    { status: 201, headers },
  );
}

// ─── GET /api/v1/sandbox ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const headers = getCorsHeaders();
  const auth = await verifyAgentAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const sandboxes = await store.query((s) => s.created_by === auth.agent_id!);
  const now = Date.now();
  const active = sandboxes.filter((s) => new Date(s.expires_at).getTime() > now);

  return NextResponse.json(
    {
      sandboxes: active.map((s) => ({
        id: s.id,
        scenario: s.scenario,
        status: s.status,
        created_at: s.created_at,
        expires_at: s.expires_at,
        call_count: s.call_count,
      })),
      total: active.length,
    },
    { headers },
  );
}
