import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS_GET } from "@/lib/api-headers";
import fs from "node:fs";
import path from "node:path";

const POLICIES_FILE = path.join(process.cwd(), "data/governance/policies.json");

interface Policy {
  id: string;
  title: string;
  version: string;
  effective_date: string;
  category: "usage" | "trust" | "privacy" | "conduct" | "sla";
  content: string;
}

function loadPolicies(): Policy[] {
  try {
    const raw = fs.readFileSync(POLICIES_FILE, "utf-8");
    return JSON.parse(raw) as Policy[];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  let policies = loadPolicies();
  if (category) {
    policies = policies.filter((p) => p.category === category);
  }

  return NextResponse.json(
    { policies, total: policies.length },
    { headers: CORS_HEADERS_GET },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
