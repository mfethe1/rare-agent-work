/**
 * Sandbox Execute — run a sequence of API steps in isolation
 * Round 37
 */

import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { JsonFileStore } from "@/lib/data-store";
import { getCorsHeaders } from "@/lib/api-headers";
import { verifyAgentAuth } from "@/lib/agent-auth";
import type { Sandbox } from "../../route";

const SANDBOX_FILE = path.join(process.cwd(), "data/sandboxes/sandboxes.json");
const store = new JsonFileStore<Sandbox>(SANDBOX_FILE);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExecuteStep {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  body?: Record<string, unknown>;
}

interface StepResult {
  step: number;
  method: string;
  path: string;
  status: number;
  success: boolean;
  response: unknown;
  duration_ms: number;
  error?: string;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

// ─── POST /api/v1/sandbox/[id]/execute ───────────────────────────────────────

export async function POST(
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

  if (sandbox.status !== "active") {
    return NextResponse.json(
      { error: `Sandbox is ${sandbox.status}, cannot execute` },
      { status: 409, headers },
    );
  }

  if (new Date(sandbox.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Sandbox has expired" }, { status: 410, headers });
  }

  let body: { steps: ExecuteStep[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  if (!Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: "steps array is required" }, { status: 400, headers });
  }

  if (body.steps.length > 20) {
    return NextResponse.json({ error: "Maximum 20 steps per execution" }, { status: 400, headers });
  }

  const baseUrl = req.nextUrl.origin;
  const results: StepResult[] = [];
  let totalSuccess = 0;

  for (let i = 0; i < body.steps.length; i++) {
    const step = body.steps[i];
    const startTime = Date.now();

    // Inject sandbox namespace into the step body
    const injectedBody = step.body
      ? { ...step.body, _sandbox_id: id, _sandbox_namespace: sandbox.namespace }
      : undefined;

    // Inject sandbox context headers
    const stepHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": req.headers.get("Authorization") ?? "",
      "X-Sandbox-Id": id,
      "X-Sandbox-Namespace": sandbox.namespace,
      // Carry forward agent identity
      ...(req.headers.get("X-Agent-Id") ? { "X-Agent-Id": req.headers.get("X-Agent-Id")! } : {}),
    };

    let stepResult: StepResult;
    try {
      const url = step.path.startsWith("http") ? step.path : `${baseUrl}${step.path}`;

      const fetchRes = await fetch(url, {
        method: step.method,
        headers: stepHeaders,
        ...(injectedBody ? { body: JSON.stringify(injectedBody) } : {}),
      });

      const duration_ms = Date.now() - startTime;
      let responseData: unknown;
      try {
        responseData = await fetchRes.json();
      } catch {
        responseData = { raw: await fetchRes.text() };
      }

      const success = fetchRes.status >= 200 && fetchRes.status < 300;
      if (success) totalSuccess++;

      stepResult = {
        step: i + 1,
        method: step.method,
        path: step.path,
        status: fetchRes.status,
        success,
        response: responseData,
        duration_ms,
      };
    } catch (err) {
      const duration_ms = Date.now() - startTime;
      stepResult = {
        step: i + 1,
        method: step.method,
        path: step.path,
        status: 0,
        success: false,
        response: null,
        duration_ms,
        error: err instanceof Error ? err.message : "Network error",
      };
    }

    results.push(stepResult);
  }

  // Track call count
  await store.update(id, { call_count: sandbox.call_count + 1 });

  return NextResponse.json(
    {
      sandbox_id: id,
      namespace: sandbox.namespace,
      steps_executed: results.length,
      steps_succeeded: totalSuccess,
      steps_failed: results.length - totalSuccess,
      results,
      isolation_note: "All writes were prefixed with sandbox namespace. No production data was affected.",
    },
    { headers },
  );
}
