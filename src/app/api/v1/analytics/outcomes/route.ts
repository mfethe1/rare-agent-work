import { NextRequest, NextResponse } from "next/server";
import { getOutcomeMetrics } from "@/lib/outcomes";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const periodRaw = parseInt(searchParams.get("period_days") ?? "30", 10);
  const periodDays = Number.isFinite(periodRaw) ? Math.min(Math.max(1, periodRaw), 365) : 30;

  try {
    const metrics = await getOutcomeMetrics(periodDays);

    return NextResponse.json(
      { ...metrics, generated_at: new Date().toISOString() },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[analytics/outcomes] GET error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
