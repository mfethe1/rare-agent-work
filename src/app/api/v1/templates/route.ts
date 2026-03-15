import { NextResponse } from "next/server";
import { getCorsHeadersGet, CORS_HEADERS_GET } from "@/lib/api-headers";
import fs from "node:fs";
import path from "node:path";

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  recommended_tools: string[];
  default_workflow: string | null;
  example_tasks: string[];
  trust_tier_required: string;
}

export function loadTemplates(): AgentTemplate[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data/templates/templates.json"), "utf-8");
    return JSON.parse(raw) as AgentTemplate[];
  } catch {
    return [];
  }
}

export async function GET() {
  const templates = loadTemplates();
  return NextResponse.json(
    {
      templates,
      total: templates.length,
    },
    { headers: getCorsHeadersGet() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
