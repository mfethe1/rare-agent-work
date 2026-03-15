import { NextRequest, NextResponse } from "next/server";
import { getChallenges, type ChallengeDifficulty } from "@/lib/challenges";
import { CORS_HEADERS } from "@/lib/api-headers";
import { paginate } from "@/lib/pagination";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

const VALID_DIFFICULTIES: ChallengeDifficulty[] = ["basic", "intermediate", "advanced"];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const skill = searchParams.get("skill") ?? undefined;
  const difficultyParam = searchParams.get("difficulty") as ChallengeDifficulty | null;

  if (difficultyParam && !VALID_DIFFICULTIES.includes(difficultyParam)) {
    return errorResponse(
      `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(", ")}`,
      "INVALID_DIFFICULTY",
      400,
    );
  }

  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 20;
  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  try {
    const challenges = await getChallenges({
      skill,
      difficulty: difficultyParam ?? undefined,
    });

    const result = paginate(challenges, offset, limit);

    return NextResponse.json(
      {
        challenges: result.items,
        pagination: result.pagination,
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[challenges] GET error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
