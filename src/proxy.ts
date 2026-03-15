import { NextRequest, NextResponse } from "next/server";

// Routes under /api/v1/* that are free (unauthenticated GET allowed)
const FREE_TIER_PATHS = [
  "/api/v1/news",
  "/api/v1/models",
];

// Routes that are always public (no auth check at all)
const PUBLIC_PATHS = [
  "/api/v1/auth/register",
  "/api/openapi",
  "/.well-known/agent.json",
];

function isFreeRoute(pathname: string, method: string): boolean {
  if (method !== "GET") return false;
  return FREE_TIER_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

/**
 * Verifies a ra_ token by calling the internal verify endpoint.
 * This avoids importing Node.js fs/crypto modules in the Edge Runtime.
 */
async function verifyTokenEdge(
  token: string,
  req: NextRequest,
): Promise<{ valid: boolean; agentId?: string; agentName?: string; scopes?: string }> {
  try {
    const verifyUrl = new URL("/api/v1/auth/verify", req.url);
    const resp = await fetch(verifyUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) return { valid: false };
    const data = (await resp.json()) as { valid: boolean; agent?: { id: string; name: string; scopes: string[] } };
    if (!data.valid || !data.agent) return { valid: false };
    return {
      valid: true,
      agentId: data.agent.id,
      agentName: data.agent.name,
      scopes: data.agent.scopes.join(","),
    };
  } catch {
    return { valid: false };
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // Only apply auth logic to /api/v1/* routes
  if (!pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  // Always-public routes (no auth needed)
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Free-tier GET routes: auth is optional but enhance if present
  if (isFreeRoute(pathname, method)) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token.startsWith("ra_")) {
        const result = await verifyTokenEdge(token, req);
        if (result.valid && result.agentId) {
          const requestHeaders = new Headers(req.headers);
          requestHeaders.set("x-agent-id", result.agentId);
          if (result.agentName) requestHeaders.set("x-agent-name", result.agentName);
          return NextResponse.next({ request: { headers: requestHeaders } });
        }
      }
    }
    return NextResponse.next();
  }

  // Protected routes: require valid Bearer token
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        error: "Authentication required. Include Authorization: Bearer ra_<your_key>",
        code: "UNAUTHORIZED",
        status: 401,
      },
      {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "WWW-Authenticate": 'Bearer realm="RareAgent API"',
          "X-RateLimit-Remaining": "100",
        },
      },
    );
  }

  const token = authHeader.slice(7).trim();

  if (!token.startsWith("ra_")) {
    return NextResponse.json(
      {
        error: "Invalid token format. Token must start with ra_",
        code: "INVALID_TOKEN_FORMAT",
        status: 401,
      },
      {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "X-RateLimit-Remaining": "100",
        },
      },
    );
  }

  const result = await verifyTokenEdge(token, req);

  if (!result.valid) {
    return NextResponse.json(
      { error: "Invalid or expired API key", code: "INVALID_TOKEN", status: 401 },
      {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "WWW-Authenticate": 'Bearer realm="RareAgent API", error="invalid_token"',
          "X-RateLimit-Remaining": "100",
        },
      },
    );
  }

  // Attach agent identity to request headers for downstream handlers
  const requestHeaders = new Headers(req.headers);
  if (result.agentId) requestHeaders.set("x-agent-id", result.agentId);
  if (result.agentName) requestHeaders.set("x-agent-name", result.agentName);
  if (result.scopes) requestHeaders.set("x-agent-scopes", result.scopes);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
