import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS_GET, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import fs from "node:fs";
import path from "node:path";
import { ownerEmails } from "@/lib/auth";

const VIOLATIONS_FILE = path.join(process.cwd(), "data/governance/violations/violations.json");

interface Violation {
  id: string;
  reporter_agent_id: string;
  policy_id: string;
  violator_agent_id: string;
  description: string;
  evidence?: string;
  status: "open" | "under_review" | "resolved" | "dismissed";
  created_at: string;
}

function loadViolations(): Violation[] {
  try {
    const raw = fs.readFileSync(VIOLATIONS_FILE, "utf-8");
    return JSON.parse(raw) as Violation[];
  } catch {
    return [];
  }
}

function saveViolations(violations: Violation[]): void {
  fs.mkdirSync(path.dirname(VIOLATIONS_FILE), { recursive: true });
  fs.writeFileSync(VIOLATIONS_FILE, JSON.stringify(violations, null, 2));
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const body = await req.json().catch(() => null);
  if (!body?.policy_id || !body?.violator_agent_id || !body?.description) {
    return NextResponse.json(
      { error: "Missing required fields: policy_id, violator_agent_id, description" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const violation: Violation = {
    id: crypto.randomUUID(),
    reporter_agent_id: agent.agent_id,
    policy_id: body.policy_id,
    violator_agent_id: body.violator_agent_id,
    description: body.description,
    evidence: body.evidence,
    status: "open",
    created_at: new Date().toISOString(),
  };

  const violations = loadViolations();
  violations.push(violation);
  saveViolations(violations);

  return NextResponse.json({ violation }, { status: 201, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  // Admin only
  const userEmail = req.headers.get("x-user-email")?.trim().toLowerCase();
  const admins = ownerEmails();
  if (!userEmail || !admins.includes(userEmail)) {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403, headers: CORS_HEADERS_GET });
  }

  const violations = loadViolations();
  return NextResponse.json({ violations, total: violations.length }, { headers: CORS_HEADERS_GET });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
