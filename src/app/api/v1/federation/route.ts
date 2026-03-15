import { NextResponse } from "next/server";
import { CORS_HEADERS_GET } from "@/lib/api-headers";
import fs from "node:fs";
import path from "node:path";

const PLATFORMS_FILE = path.join(process.cwd(), "data/federation/platforms.json");

interface Platform {
  id: string;
  name: string;
  url: string;
  agent_card_url: string;
  capabilities: string[];
  status: "active" | "pending" | "offline";
  discovered_at: string;
}

function loadPlatforms(): Platform[] {
  try {
    const raw = fs.readFileSync(PLATFORMS_FILE, "utf-8");
    return JSON.parse(raw) as Platform[];
  } catch {
    return [];
  }
}

export async function GET() {
  const platforms = loadPlatforms();

  return NextResponse.json(
    {
      platforms,
      total: platforms.length,
      active: platforms.filter((p) => p.status === "active").length,
    },
    { headers: CORS_HEADERS_GET },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
