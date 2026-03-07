import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const FILE_PATH = path.join(process.cwd(), "data/reports/reports.json");

type ReportItem = {
  slug: string;
  title: string;
  status: "draft" | "pending_review" | "approved" | "published";
  updated_at: string;
  summary: string;
  content: string;
  approved_by?: string;
  approved_at?: string;
};

function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "michael.fethe@protelynx.ai")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function readReports(): ReportItem[] {
  return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
}

function writeReports(items: ReportItem[]) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(items, null, 2));
}

export async function POST(req: Request) {
  const actor = (req.headers.get("x-user-email") ?? "").trim().toLowerCase();
  if (!ownerEmails().includes(actor)) {
    return NextResponse.json({ error: "Owner-only endpoint" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const slug = String(body?.slug ?? "");
  const action = String(body?.action ?? "");

  if (!slug || !["approve", "reject", "publish"].includes(action)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const items = readReports();
  const idx = items.findIndex((r) => r.slug === slug);
  if (idx === -1) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  if (action === "approve") {
    items[idx].status = "approved";
    items[idx].approved_by = actor;
    items[idx].approved_at = new Date().toISOString();
  }

  if (action === "reject") {
    items[idx].status = "draft";
  }

  if (action === "publish") {
    if (items[idx].status !== "approved") {
      return NextResponse.json({ error: "Must be approved before publish" }, { status: 409 });
    }
    items[idx].status = "published";
  }

  items[idx].updated_at = new Date().toISOString();
  writeReports(items);

  return NextResponse.json({ ok: true, report: items[idx] });
}
