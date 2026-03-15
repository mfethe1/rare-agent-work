import { NextRequest, NextResponse } from "next/server";
import { queryEntities, type EntityType } from "@/lib/knowledge";
import { getCorsHeadersGet, CORS_HEADERS_GET } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: getCorsHeadersGet() });
}

const VALID_TYPES: EntityType[] = ["framework", "vendor", "model", "benchmark", "incident", "regulation"];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const q = searchParams.get("q");
  if (!q || q.trim().length === 0) {
    return errorResponse("Query param 'q' is required", "MISSING_QUERY", 400);
  }

  const typesParam = searchParams.get("types");
  let types: EntityType[] | undefined;
  if (typesParam) {
    const parsed = typesParam.split(",").map((t) => t.trim()) as EntityType[];
    const invalid = parsed.filter((t) => !VALID_TYPES.includes(t));
    if (invalid.length > 0) {
      return errorResponse(
        `Invalid types: ${invalid.join(", ")}. Valid: ${VALID_TYPES.join(", ")}`,
        "INVALID_TYPES",
        400,
      );
    }
    types = parsed;
  }

  const limitRaw = parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 10;

  const results = await queryEntities(q.trim(), types, limit);

  return NextResponse.json(
    {
      query: q,
      results,
      total: results.length,
    },
    { headers: getCorsHeadersGet() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
