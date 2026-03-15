import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/agent-auth";
import { createTask, getTasks, type TaskStatus, type GetTasksFilter } from "@/lib/tasks";
import { getBalance, holdEscrow } from "@/lib/wallet";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

const VALID_STATUSES: TaskStatus[] = [
  "open", "bidding", "in_progress", "delivered", "reviewing", "completed", "disputed", "cancelled",
];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const statusParam = searchParams.get("status") as TaskStatus | null;
  if (statusParam && !VALID_STATUSES.includes(statusParam)) {
    return errorResponse(
      `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      "INVALID_STATUS",
      400,
    );
  }

  const skill = searchParams.get("skill") ?? undefined;

  const minBudgetRaw = searchParams.get("min_budget");
  const maxBudgetRaw = searchParams.get("max_budget");
  const min_budget = minBudgetRaw ? parseFloat(minBudgetRaw) : undefined;
  const max_budget = maxBudgetRaw ? parseFloat(maxBudgetRaw) : undefined;

  const sortParam = searchParams.get("sort") ?? "newest";
  const validSorts = ["newest", "oldest", "budget_high", "budget_low"];
  if (!validSorts.includes(sortParam)) {
    return errorResponse(
      `Invalid sort. Must be one of: ${validSorts.join(", ")}`,
      "INVALID_SORT",
      400,
    );
  }

  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 20;
  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  const filter: GetTasksFilter = {
    status: statusParam ?? undefined,
    skill,
    min_budget,
    max_budget,
    sort: sortParam as GetTasksFilter["sort"],
    limit,
    offset,
  };

  const { tasks, total } = getTasks(filter);

  // Strip bids from public listing (show count only)
  const publicTasks = tasks.map((t) => ({
    ...t,
    bids: undefined,
    bid_count: t.bids.length,
    delivery: undefined,
    review: undefined,
  }));

  return NextResponse.json(
    {
      tasks: publicTasks,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    },
    { headers: CORS_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header required", "UNAUTHORIZED", 401);
  }

  const agent = await verifyApiKey(authHeader.slice(7));
  if (!agent) {
    return errorResponse("Invalid or expired API key", "INVALID_KEY", 401);
  }

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

  // Validate required fields
  if (!b.title || typeof b.title !== "string" || b.title.trim().length === 0) {
    return errorResponse("Field 'title' is required", "MISSING_TITLE", 400);
  }
  if (!b.description || typeof b.description !== "string" || b.description.trim().length === 0) {
    return errorResponse("Field 'description' is required", "MISSING_DESCRIPTION", 400);
  }

  // Validate requirements
  if (!b.requirements || typeof b.requirements !== "object") {
    return errorResponse("Field 'requirements' is required", "MISSING_REQUIREMENTS", 400);
  }
  const req_ = b.requirements as Record<string, unknown>;
  if (!Array.isArray(req_.skills) || req_.skills.length === 0) {
    return errorResponse("requirements.skills must be a non-empty array", "MISSING_SKILLS", 400);
  }

  // Validate budget
  if (!b.budget || typeof b.budget !== "object") {
    return errorResponse("Field 'budget' is required", "MISSING_BUDGET", 400);
  }
  const budget = b.budget as Record<string, unknown>;
  if (typeof budget.credits !== "number" || budget.credits <= 0) {
    return errorResponse("budget.credits must be a positive number", "INVALID_BUDGET", 400);
  }
  if (!["fixed", "hourly"].includes(budget.type as string)) {
    return errorResponse("budget.type must be 'fixed' or 'hourly'", "INVALID_BUDGET_TYPE", 400);
  }

  // Validate deliverables
  if (!Array.isArray(b.deliverables) || b.deliverables.length === 0) {
    return errorResponse("Field 'deliverables' must be a non-empty array", "MISSING_DELIVERABLES", 400);
  }

  // Check credits
  const { balance } = getBalance(agent.agent_id);
  if (balance < budget.credits) {
    return errorResponse(
      `Insufficient credits. Balance: ${balance}, Required: ${budget.credits}`,
      "INSUFFICIENT_CREDITS",
      402,
    );
  }

  try {
    const task = createTask({
      owner_agent_id: agent.agent_id,
      title: (b.title as string).trim(),
      description: (b.description as string).trim(),
      requirements: {
        skills: req_.skills as string[],
        min_reputation: req_.min_reputation as number | undefined,
        deadline: req_.deadline as string | undefined,
      },
      budget: {
        credits: budget.credits as number,
        type: budget.type as "fixed" | "hourly",
      },
      deliverables: (b.deliverables as Array<{ type: string; format: string }>),
    });

    // Hold credits in escrow
    holdEscrow(agent.agent_id, budget.credits as number, task.id);

    // Dispatch webhook
    dispatchWebhookEvent("task.created", { task_id: task.id, title: task.title }).catch(() => {});

    return NextResponse.json(
      { ...task, escrow_held: true },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[tasks] POST error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
