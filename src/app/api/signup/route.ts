import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const FILE_PATH = path.join(process.cwd(), "data/reports/subscribers.json");

type Subscriber = { name: string; email: string; created_at: string };

function readSubscribers(): Subscriber[] {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function writeSubscribers(items: Subscriber[]) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(items, null, 2));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid name/email" }, { status: 400 });
  }

  const current = readSubscribers();
  if (!current.some((x) => x.email === email)) {
    current.push({ name, email, created_at: new Date().toISOString() });
    writeSubscribers(current);
  }

  return NextResponse.json({ ok: true });
}
