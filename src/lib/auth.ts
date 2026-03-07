import { headers } from "next/headers";

export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "michael.fethe@protelynx.ai")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export async function currentUserEmail(): Promise<string | null> {
  const h = await headers();
  const fromHeader = h.get("x-user-email")?.trim().toLowerCase();
  return fromHeader || null;
}

export async function isOwnerUser(): Promise<boolean> {
  const email = await currentUserEmail();
  if (!email) return false;
  return ownerEmails().includes(email);
}
