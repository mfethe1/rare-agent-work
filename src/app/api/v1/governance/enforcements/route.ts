/**
 * Governance — Enforcement Actions
 * Round 32
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { ownerEmails } from "@/lib/auth";
import { listEnforcements } from "@/lib/enforcement";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const userEmail = req.headers.get("x-user-email")?.trim().toLowerCase();
  const admins = ownerEmails();
  const isAdmin = userEmail && admins.includes(userEmail);

  if (!isAdmin && !apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  let agentIdFilter: string | undefined;

  if (!isAdmin) {
    // Non-admin agents can only see their own enforcements
    if (!apiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }
    const agent = await verifyApiKey(apiKey);
    if (!agent) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
    }
    agentIdFilter = agent.agent_id;
  }

  const { searchParams } = new URL(req.url);
  const agent_id = searchParams.get("agent_id");
  // Admin can filter by agent_id; non-admin always filtered to self
  const filterBy = isAdmin ? agent_id ?? undefined : agentIdFilter;

  const enforcements = listEnforcements(filterBy);

  // Sort by most recent first
  enforcements.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return NextResponse.json(
    { enforcements, total: enforcements.length },
    { headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
