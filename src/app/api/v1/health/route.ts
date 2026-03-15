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

export async function GET() {
  const newsFile = path.join(process.cwd(), "data/news/news.json");
  const modelsFile = path.join(process.cwd(), "data/models/models.json");
  const reportsFile = path.join(process.cwd(), "data/reports/reports.json");

  const uptime_seconds = Math.floor((Date.now() - START_TIME) / 1000);

  return NextResponse.json(
    {
      status: "ok",
      version: "1.0.0",
      uptime_seconds,
      data_freshness: {
        news: getFileLastModified(newsFile),
        models: getFileLastModified(modelsFile),
        reports: getFileLastModified(reportsFile),
      },
      endpoints_available: 20,
      agents_registered: countAgents(),
    },
    { headers: CORS_HEADERS_GET },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
