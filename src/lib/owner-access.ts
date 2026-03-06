import { cookies } from "next/headers";

/**
 * Check if the current request has owner-level free access.
 * Works via:
 *   1. ?access=owner query param (pass searchParams from page)
 *   2. owner_access=true cookie
 */
export async function hasOwnerAccess(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<boolean> {
  // Check query param
  if (searchParams?.access === "owner") {
    return true;
  }

  // Check cookie
  const cookieStore = await cookies();
  const ownerCookie = cookieStore.get("owner_access");
  if (ownerCookie?.value === "true") {
    return true;
  }

  return false;
}
