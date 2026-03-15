import { NextRequest, NextResponse } from "next/server";
import { getChallengeById } from "@/lib/challenges";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const challenge = await getChallengeById(id);
  if (!challenge) {
    return errorResponse("Challenge not found", "NOT_FOUND", 404);
  }

  return NextResponse.json(challenge, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
