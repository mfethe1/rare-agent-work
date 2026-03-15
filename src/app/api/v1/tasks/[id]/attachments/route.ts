/**
 * Multi-Modal Deliverables — Task Attachments
 * Round 34
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import fs from "node:fs";
import path from "node:path";

const ATTACHMENTS_FILE = path.join(process.cwd(), "data/tasks/attachments.json");
const FILES_DIR = path.join(process.cwd(), "data/tasks/files");

const MAX_ATTACHMENTS_PER_TASK = 5;
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB base64 size

const SUPPORTED_CONTENT_TYPES = new Set([
  "text/markdown",
  "application/json",
  "text/csv",
  "image/png",
  "image/jpeg",
  "application/pdf",
]);

interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by: string;
  filename: string;
  content_type: string;
  description?: string;
  size_bytes: number;
  file_path: string;
  created_at: string;
}

function loadAttachments(): TaskAttachment[] {
  try {
    return JSON.parse(fs.readFileSync(ATTACHMENTS_FILE, "utf-8")) as TaskAttachment[];
  } catch {
    return [];
  }
}

function saveAttachments(attachments: TaskAttachment[]): void {
  fs.mkdirSync(path.dirname(ATTACHMENTS_FILE), { recursive: true });
  fs.writeFileSync(ATTACHMENTS_FILE, JSON.stringify(attachments, null, 2));
}

function loadTask(taskId: string): { id: string; owner_agent_id: string; assigned_agent_id?: string } | null {
  try {
    const tasks = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data/tasks/tasks.json"), "utf-8"),
    ) as Array<{ id: string; owner_agent_id: string; assigned_agent_id?: string }>;
    return tasks.find((t) => t.id === taskId) ?? null;
  } catch {
    return null;
  }
}

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const { id: taskId } = await params;
  const task = loadTask(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404, headers: CORS_HEADERS });
  }

  // Only task owner or assigned agent can upload
  if (task.owner_agent_id !== agent.agent_id && task.assigned_agent_id !== agent.agent_id) {
    return NextResponse.json({ error: "Forbidden: not task owner or assigned agent" }, { status: 403, headers: CORS_HEADERS });
  }

  const body = await req.json().catch(() => null);
  if (!body?.filename || !body?.content_type || !body?.data) {
    return NextResponse.json(
      { error: "Missing required fields: filename, content_type, data" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Validate content type
  if (!SUPPORTED_CONTENT_TYPES.has(body.content_type)) {
    return NextResponse.json(
      { error: `Unsupported content_type. Supported: ${Array.from(SUPPORTED_CONTENT_TYPES).join(", ")}` },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Validate filename (basic security)
  const safeName = path.basename(body.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safeName) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400, headers: CORS_HEADERS });
  }

  // Validate base64 data size
  const dataSize = Buffer.byteLength(body.data, "base64");
  if (dataSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024}KB` },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Check attachment count limit
  const allAttachments = loadAttachments();
  const taskAttachments = allAttachments.filter((a) => a.task_id === taskId);
  if (taskAttachments.length >= MAX_ATTACHMENTS_PER_TASK) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ATTACHMENTS_PER_TASK} attachments per task` },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Save file
  fs.mkdirSync(FILES_DIR, { recursive: true });
  const fileId = crypto.randomUUID();
  const filePath = path.join(FILES_DIR, `${fileId}_${safeName}`);
  fs.writeFileSync(filePath, Buffer.from(body.data, "base64"));

  const attachment: TaskAttachment = {
    id: fileId,
    task_id: taskId,
    uploaded_by: agent.agent_id,
    filename: safeName,
    content_type: body.content_type,
    description: body.description,
    size_bytes: dataSize,
    file_path: `data/tasks/files/${fileId}_${safeName}`,
    created_at: new Date().toISOString(),
  };

  allAttachments.push(attachment);
  saveAttachments(allAttachments);

  // Return without the actual data
  const { file_path: _, ...attachmentMeta } = attachment;
  return NextResponse.json({ attachment: attachmentMeta }, { status: 201, headers: getCorsHeaders() });
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const { id: taskId } = await params;
  const task = loadTask(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404, headers: CORS_HEADERS });
  }

  const allAttachments = loadAttachments();
  const taskAttachments = allAttachments
    .filter((a) => a.task_id === taskId)
    // Don't expose internal file_path
    .map(({ file_path: _, ...rest }) => rest);

  return NextResponse.json(
    { attachments: taskAttachments, total: taskAttachments.length },
    { headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
