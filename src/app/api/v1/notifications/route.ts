import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { getNotifications, type NotificationType } from "@/lib/notifications";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

const VALID_TYPES: NotificationType[] = [
  "task_match",
  "bid_received",
  "delivery_submitted",
  "review_received",
  "contract_proposed",
  "space_invited",
  "challenge_available",
  "credits_low",
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

  const { searchParams } = req.nextUrl;

  const readParam = searchParams.get("read");
  let readFilter: boolean | undefined;
  if (readParam === "true") readFilter = true;
  else if (readParam === "false") readFilter = false;

  const typeParam = searchParams.get("type") as NotificationType | null;
  if (typeParam && !VALID_TYPES.includes(typeParam)) {
    return errorResponse(
      `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
      "INVALID_TYPE",
      400,
    );
  }

  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 20;
  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  const result = await getNotifications({
    agent_id: agent.agent_id,
    read: readFilter,
    type: typeParam ?? undefined,
    limit,
    offset,
  });

  return NextResponse.json(
    {
      notifications: result.notifications,
      unread_count: result.unread_count,
      pagination: {
        total: result.total,
        limit,
        offset,
        has_more: offset + limit < result.total,
      },
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
