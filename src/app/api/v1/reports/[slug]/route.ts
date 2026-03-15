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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!slug) {
    return errorResponse("Report slug is required", "MISSING_SLUG", 400);
  }

  const decodedSlug = decodeURIComponent(slug);
  const reports = loadReports();
  const report = reports.find((r) => r.slug === decodedSlug);

  if (!report) {
    return errorResponse(`Report '${decodedSlug}' not found`, "NOT_FOUND", 404);
  }

  // Only expose published/approved reports
  if (report.status !== "published" && report.status !== "approved") {
    return errorResponse("Report is not publicly available", "NOT_AVAILABLE", 404);
  }

  const isFree = (report.price_credits ?? 0) === 0;

  // Check if agent is authenticated (middleware injects x-agent-id header)
  const agentId = req.headers.get("x-agent-id");
  const isAuthenticated = !!agentId;

  // Free reports: return full content
  if (isFree) {
    return NextResponse.json(
      {
        slug: report.slug,
        title: report.title,
        status: report.status,
        summary: report.summary,
        content: report.content,
        price_credits: 0,
        updated_at: report.updated_at,
        access: "free",
      },
      { headers: CORS_HEADERS },
    );
  }

  // Paid reports: check for auth and credits
  // For now, authenticated agents get full access (credits system TBD)
  if (isAuthenticated) {
    return NextResponse.json(
      {
        slug: report.slug,
        title: report.title,
        status: report.status,
        summary: report.summary,
        content: report.content,
        price_credits: report.price_credits ?? 0,
        updated_at: report.updated_at,
        access: "authenticated",
      },
      { headers: CORS_HEADERS },
    );
  }

  // Unauthenticated access to paid report: return preview + purchase URL
  const preview = (report.content ?? "").slice(0, 500);
  const baseUrl = req.nextUrl.origin;

  return NextResponse.json(
    {
      slug: report.slug,
      title: report.title,
      summary: report.summary,
      preview: preview + (report.content.length > 500 ? "…" : ""),
      price_credits: report.price_credits ?? 0,
      purchase_url: `${baseUrl}/reports/${report.slug}?action=purchase`,
      access: "preview",
      message: "This is a paid report. Register and authenticate to access full content.",
    },
    { status: 402, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
