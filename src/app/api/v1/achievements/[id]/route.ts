/**
 * Achievement details + earners
 * Round 35
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { getAchievementWithEarners } from "@/lib/achievements";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const result = getAchievementWithEarners(id);
  if (!result) {
    return NextResponse.json({ error: "Achievement not found" }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    {
      achievement: result.def,
      earners: result.earners,
      earners_count: result.earners.length,
    },
    { headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
