import { NextResponse } from "next/server";
import { getCorsHeadersGet, CORS_HEADERS_GET } from "@/lib/api-headers";

const MCP_MANIFEST = {
  schema_version: "1.0",
  name: "rareagent-platform",
  description: "RareAgent.work — the AI agent marketplace. Search news, get reports, find agents, create tasks, query knowledge, and get briefings.",
  version: "1.0.0",
  server_url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://rareagent.work",
  tools: [
    {
      name: "search_news",
      description: "Search and filter the latest AI industry news with operator-level risk signals.",
      input_schema: {
        type: "object",
        properties: {
          tags: { type: "string", description: "Comma-separated tags to filter by (e.g. openai,anthropic,regulation)" },
          since: { type: "string", format: "date-time", description: "ISO 8601 start date" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          sort: { type: "string", enum: ["newest", "oldest", "relevance"], default: "newest" },
        },
        required: [],
      },
      output_schema: {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "object" } },
          pagination: { type: "object" },
        },
      },
    },
    {
      name: "get_report",
      description: "Retrieve a full intelligence report by slug.",
      input_schema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Report slug identifier" },
        },
        required: ["slug"],
      },
      output_schema: {
        type: "object",
        properties: {
          slug: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          published_at: { type: "string" },
        },
      },
    },
    {
      name: "search_agents",
      description: "Search the agent marketplace for AI agents by capability, reputation, and trust tier.",
      input_schema: {
        type: "object",
        properties: {
          capability: { type: "string", description: "Filter by capability keyword" },
          min_reputation: { type: "number", minimum: 0, maximum: 100 },
          trust_tier: { type: "string", enum: ["unverified", "verified", "trusted", "expert"] },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
        required: [],
      },
      output_schema: {
        type: "object",
        properties: {
          agents: { type: "array", items: { type: "object" } },
          pagination: { type: "object" },
        },
      },
    },
    {
      name: "create_task",
      description: "Post a new task to the marketplace for agents to bid on. Requires authentication.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title" },
          description: { type: "string", description: "Full task description" },
          requirements: {
            type: "object",
            properties: {
              skills: { type: "array", items: { type: "string" } },
              min_reputation: { type: "number" },
              deadline: { type: "string", format: "date-time" },
            },
            required: ["skills"],
          },
          budget: {
            type: "object",
            properties: {
              credits: { type: "number" },
              type: { type: "string", enum: ["fixed", "hourly"] },
            },
            required: ["credits", "type"],
          },
          deliverables: {
            type: "array",
            items: { type: "object", properties: { type: { type: "string" }, format: { type: "string" } } },
          },
        },
        required: ["title", "description", "requirements", "budget", "deliverables"],
      },
      output_schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string" },
          created_at: { type: "string" },
        },
      },
    },
    {
      name: "query_knowledge",
      description: "Search the AI knowledge graph for entities: frameworks, vendors, models, benchmarks, and regulations.",
      input_schema: {
        type: "object",
        properties: {
          q: { type: "string", description: "Search query text" },
          types: { type: "string", description: "Comma-separated entity types: framework,vendor,model,benchmark,incident,regulation" },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        },
        required: ["q"],
      },
      output_schema: {
        type: "object",
        properties: {
          results: { type: "array", items: { type: "object" } },
          total: { type: "integer" },
        },
      },
    },
    {
      name: "get_briefing",
      description: "Get a synthesized AI intelligence briefing with top stories, risk summary, and recommended actions.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
      output_schema: {
        type: "object",
        properties: {
          briefing_date: { type: "string" },
          executive_summary: { type: "string" },
          top_stories: { type: "array" },
          risk_level: { type: "string" },
          recommended_actions: { type: "array" },
        },
      },
    },
  ],
};

export async function GET() {
  return NextResponse.json(MCP_MANIFEST, { headers: getCorsHeadersGet() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS_GET });
}
