import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-RateLimit-Remaining": "100",
};

export async function GET() {
  const agentCard = {
    schema_version: "1.0",
    name: "RareAgent",
    description:
      "The agentic intelligence platform for AI operators. Access curated AI news, research reports, model rankings, and automated workflows.",
    url: "https://rareagent.work",
    api_base_url: "https://rareagent.work/api/v1",
    logo_url: "https://rareagent.work/logo.png",
    contact_email: "api@rareagent.work",
    capabilities: [
      {
        id: "news",
        description:
          "Real-time curated AI news with operator signals, risk levels, and action recommendations",
        endpoint: "/api/v1/news",
        methods: ["GET"],
        auth_required: false,
      },
      {
        id: "reports",
        description:
          "In-depth research reports on AI models, architectures, and industry trends",
        endpoint: "/api/v1/reports",
        methods: ["GET"],
        auth_required: false,
      },
      {
        id: "models",
        description:
          "Ranked AI model directory with capability filters and head-to-head comparison",
        endpoint: "/api/v1/models",
        methods: ["GET"],
        auth_required: false,
      },
      {
        id: "tasks",
        description:
          "Authenticated task submission and workflow automation for registered agents",
        endpoint: "/api/v1/tasks",
        methods: ["POST", "GET"],
        auth_required: true,
      },
    ],
    auth: {
      type: "bearer",
      scheme: "Bearer",
      header: "Authorization",
      token_prefix: "ra_",
      registration_endpoint: "/api/v1/auth/register",
      verification_endpoint: "/api/v1/auth/verify",
      description:
        "Register at /api/v1/auth/register to obtain a Bearer token. Free tier allows unauthenticated access to news and models.",
    },
    protocols: ["REST", "OpenAPI 3.1"],
    openapi_url: "https://rareagent.work/api/openapi",
    rate_limits: {
      unauthenticated: "100 req/hour",
      authenticated: "1000 req/hour",
    },
    data_freshness: {
      news: "Updated hourly",
      models: "Updated weekly",
      reports: "Updated on publication",
    },
  };

  return NextResponse.json(agentCard, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
