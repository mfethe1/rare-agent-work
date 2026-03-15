import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { CORS_HEADERS_GET, CORS_HEADERS } from "@/lib/api-headers";


function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

interface RawReport {
  slug: string;
  title: string;
  status: "draft" | "pending_review" | "approved" | "published";
  updated_at: string;
  summary: string;
  content: string;
  price_credits?: number;
}

function loadReports(): RawReport[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data/reports/reports.json"), "utf-8");
    return JSON.parse(raw) as RawReport[];
  } catch {
    return [];
  }
}

export async function GET(_req: NextRequest) {
  try {
    const reports = loadReports();

    // Only expose published and approved reports
    const visible = reports.filter(
      (r) => r.status === "published" || r.status === "approved",
    );

    const items = visible.map((r) => ({
      slug: r.slug,
      title: r.title,
      status: r.status,
      summary: r.summary ?? "",
      preview: (r.content ?? "").slice(0, 500),
      price_credits: r.price_credits ?? 0,
      updated_at: r.updated_at,
    }));

    return NextResponse.json(
      {
        items,
        meta: {
          total: items.length,
          generated_at: new Date().toISOString(),
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[reports] Error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
