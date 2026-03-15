import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";

interface BatchOperation {
  id: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

interface BatchResult {
  id: string;
  status: number;
  data?: unknown;
  error?: string;
}

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: getCorsHeaders() });
}

/**
 * Execute a single operation against the internal Next.js route handlers.
 * We construct a Request object and use fetch to hit the same origin.
 */
async function executeOperation(op: BatchOperation, baseUrl: string): Promise<BatchResult> {
  const url = `${baseUrl}${op.path}`;

  try {
    const options: RequestInit = {
      method: op.method,
      headers: { "Content-Type": "application/json" },
    };

    if (op.method === "POST" && op.body !== undefined) {
      options.body = JSON.stringify(op.body);
    }

    const res = await fetch(url, options);
    let data: unknown;

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return { id: op.id, status: res.status, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Operation failed";
    return { id: op.id, status: 500, error: msg };
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", "INVALID_JSON", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Request body must be a JSON object", "INVALID_BODY", 400);
  }

  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.operations)) {
    return errorResponse("Field 'operations' must be an array", "MISSING_OPERATIONS", 400);
  }

  const operations = b.operations as BatchOperation[];

  if (operations.length === 0) {
    return errorResponse("operations array must not be empty", "EMPTY_OPERATIONS", 400);
  }

  if (operations.length > 10) {
    return errorResponse("Maximum 10 operations per batch", "TOO_MANY_OPERATIONS", 400);
  }

  // Validate operations
  for (const op of operations) {
    if (!op.id || typeof op.id !== "string") {
      return errorResponse("Each operation must have a string 'id'", "INVALID_OPERATION", 400);
    }
    if (!["GET", "POST"].includes(op.method)) {
      return errorResponse(
        `Operation '${op.id}': method must be GET or POST`,
        "INVALID_METHOD",
        400,
      );
    }
    if (!op.path || typeof op.path !== "string" || !op.path.startsWith("/api/")) {
      return errorResponse(
        `Operation '${op.id}': path must be a string starting with /api/`,
        "INVALID_PATH",
        400,
      );
    }
  }

  // Determine base URL
  const host = req.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  // Execute operations in parallel
  const results = await Promise.all(
    operations.map((op) => executeOperation(op, baseUrl)),
  );

  const successCount = results.filter((r) => r.status >= 200 && r.status < 300).length;
  const failureCount = results.length - successCount;

  return NextResponse.json(
    {
      results,
      meta: {
        total: operations.length,
        succeeded: successCount,
        failed: failureCount,
        executed_at: new Date().toISOString(),
      },
    },
    { headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
