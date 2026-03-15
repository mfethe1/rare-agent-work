import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { CORS_HEADERS_GET } from "@/lib/api-headers";

const START_TIME = Date.now();

function getFileLastModified(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    return stat.mtime.toISOString();
  } catch {
    return null;
  }
}

function countAgents(): number {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data/agents/agents.json"), "utf-8");
    const agents = JSON.parse(raw) as unknown[];
    return Array.isArray(agents) ? agents.length : 0;
  } catch {
    return 0;
  }
}

interface FileCheck {
  file: string;
  exists: boolean;
  valid_json: boolean;
  record_count: number;
}

function checkDataFile(relPath: string): FileCheck {
  const absPath = path.join(process.cwd(), relPath);
  const exists = fs.existsSync(absPath);
  if (!exists) return { file: relPath, exists: false, valid_json: false, record_count: 0 };
  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const count = Array.isArray(parsed) ? parsed.length : typeof parsed === "object" && parsed !== null ? Object.keys(parsed).length : 0;
    return { file: relPath, exists: true, valid_json: true, record_count: count };
  } catch {
    return { file: relPath, exists: true, valid_json: false, record_count: 0 };
  }
}

const DATA_FILES = [
  "data/agents/agents.json",
  "data/agents/reputation.json",
  "data/news/news.json",
  "data/models/models.json",
  "data/reports/reports.json",
  "data/tasks/tasks.json",
  "data/wallet/wallets.json",
  "data/contracts/contracts.json",
  "data/knowledge/entities.json",
  "data/knowledge/edges.json",
  "data/notifications/notifications.json",
  "data/spaces/spaces.json",
  "data/webhooks/webhooks.json",
  "data/workflows/workflows.json",
  "data/challenges/challenges.json",
  "data/templates/templates.json",
  "data/analytics/events.json",
];

export async function GET() {
  const newsFile = path.join(process.cwd(), "data/news/news.json");
  const modelsFile = path.join(process.cwd(), "data/models/models.json");
  const reportsFile = path.join(process.cwd(), "data/reports/reports.json");

  const uptime_seconds = Math.floor((Date.now() - START_TIME) / 1000);
  const checks: FileCheck[] = DATA_FILES.map(checkDataFile);

  const all_healthy = checks.every((c) => !c.exists || c.valid_json);

  return NextResponse.json(
    {
      status: all_healthy ? "ok" : "degraded",
      version: "1.0.0",
      uptime_seconds,
      data_freshness: {
        news: getFileLastModified(newsFile),
        models: getFileLastModified(modelsFile),
        reports: getFileLastModified(reportsFile),
      },
      endpoints_available: 30,
      agents_registered: countAgents(),
      checks,
    },
    { headers: CORS_HEADERS_GET },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
