/**
 * Sandbox by ID — GET status / DELETE teardown
 * Round 37
 */

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { JsonFileStore } from "@/lib/data-store";
import { getCorsHeaders } from "@/lib/api-headers";
import { verifyAgentAuth } from "@/lib/agent-auth";
import type { Sandbox } from "../route";

const SANDBOX_FILE = path.join(process.cwd(), "data/sandboxes/sandboxes.json");
const store = new JsonFileStore<Sandbox>(SANDBOX_FILE);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

// ─── GET /api/v1/sandbox/[id] ─────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = getCorsHeaders();
  const { id } = await params;

  const auth = await verifyAgentAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const sandbox = await store.getById(id);
  if (!sandbox) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404, headers });
  }

  // Check expiry
  if (new Date(sandbox.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Sandbox has expired", expired_at: sandbox.expires_at },
      { status: 410, headers },
    );
  }

  return NextResponse.json(
    {
      id: sandbox.id,
      scenario: sandbox.scenario,
      status: sandbox.status,
      namespace: sandbox.namespace,
      created_at: sandbox.created_at,
      expires_at: sandbox.expires_at,
      created_by: sandbox.created_by,
      agents: sandbox.agents,
      tasks: sandbox.tasks,
      data_keys: sandbox.data_keys,
      call_count: sandbox.call_count,
      ttl_remaining_seconds: Math.max(
        0,
        Math.round((new Date(sandbox.expires_at).getTime() - Date.now()) / 1000),
      ),
    },
    { headers },
  );
}

// ─── DELETE /api/v1/sandbox/[id] ─────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = getCorsHeaders();
  const { id } = await params;

  const auth = await verifyAgentAuth(req);
  if (!auth.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const sandbox = await store.getById(id);
  if (!sandbox) {
    return NextResponse.json({ error: "Sandbox not found" }, { status: 404, headers });
  }

  if (sandbox.created_by !== auth.agent_id) {
    return NextResponse.json(
      { error: "Forbidden — only sandbox creator can delete it" },
      { status: 403, headers },
    );
  }

  // Mark as teardown then delete
  await store.update(id, { status: "teardown" });
  await store.delete(id);

  return NextResponse.json(
    {
      deleted: true,
      sandbox_id: id,
      data_keys_cleared: sandbox.data_keys.length,
      message: `Sandbox ${id} torn down. ${sandbox.data_keys.length} isolated data keys cleared.`,
    },
    { headers },
  );
}
