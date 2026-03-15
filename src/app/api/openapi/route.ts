import { NextResponse } from "next/server";
import { generateOpenApiSpec } from "@/lib/openapi-generator";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Remaining": "100",
};

export async function GET() {
  const spec = generateOpenApiSpec();

  return new NextResponse(spec, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/yaml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
