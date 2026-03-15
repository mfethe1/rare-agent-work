import { NextRequest, NextResponse } from "next/server";
import { getTaskById } from "@/lib/tasks";
import { findMatchingAgents } from "@/lib/matching";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const task = await getTaskById(id);
  if (!task) {
    return errorResponse("Task not found", "NOT_FOUND", 404);
  }

  try {
    const matches = await findMatchingAgents(task);

    return NextResponse.json(
      {
        task_id: id,
        matches,
        total: matches.length,
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[tasks/matches] GET error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
