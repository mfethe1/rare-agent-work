import { NextRequest, NextResponse } from "next/server";
import { queryEntities, type EntityType } from "@/lib/knowledge";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

const VALID_TYPES: EntityType[] = ["framework", "vendor", "model", "benchmark", "incident", "regulation"];

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

  if (!b.query || typeof b.query !== "string" || b.query.trim().length === 0) {
    return errorResponse("Field 'query' is required", "MISSING_QUERY", 400);
  }

  if (b.types !== undefined) {
    if (!Array.isArray(b.types)) {
      return errorResponse("Field 'types' must be an array", "INVALID_TYPES", 400);
    }
    const invalid = (b.types as string[]).filter((t) => !VALID_TYPES.includes(t as EntityType));
    if (invalid.length > 0) {
      return errorResponse(
        `Invalid types: ${invalid.join(", ")}. Valid: ${VALID_TYPES.join(", ")}`,
        "INVALID_TYPES",
        400,
      );
    }
  }

  const limitRaw = typeof b.limit === "number" ? b.limit : 10;
  const limit = Math.min(Math.max(1, limitRaw), 50);

  const results = await queryEntities(
    (b.query as string).trim(),
    b.types as EntityType[] | undefined,
    limit,
  );

  return NextResponse.json(
    {
      query: b.query,
      results,
      total: results.length,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
