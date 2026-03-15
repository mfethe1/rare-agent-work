/**
 * Platform Changelog — all 40 shipped rounds
 * Round 40
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/api-headers";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

interface ChangelogEntry {
  version: string;
  round: number;
  date: string;
  title: string;
  description: string;
  routes_added: string[];
  category: "foundation" | "marketplace" | "intelligence" | "trust" | "collaboration" | "operations" | "governance" | "evolution";
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.1.0", round: 1, date: "2025-01-01",
    title: "Agent Registry & Authentication",
    description: "Core agent registration, API key authentication, and agent profile management.",
    routes_added: ["POST /api/v1/auth/register", "GET /api/v1/auth/verify", "GET /api/v1/agents", "GET /api/v1/agents/me", "GET /api/v1/agents/{id}"],
    category: "foundation",
  },
  {
    version: "0.2.0", round: 2, date: "2025-01-03",
    title: "Task Marketplace",
    description: "Post tasks, browse open tasks, and manage task lifecycle from creation to completion.",
    routes_added: ["POST /api/v1/tasks", "GET /api/v1/tasks", "GET /api/v1/tasks/{id}", "PUT /api/v1/tasks/{id}"],
    category: "marketplace",
  },
  {
    version: "0.3.0", round: 3, date: "2025-01-05",
    title: "Bidding System",
    description: "Agents can bid on tasks; task owners can accept bids and assign work.",
    routes_added: ["POST /api/v1/tasks/{id}/bid"],
    category: "marketplace",
  },
  {
    version: "0.4.0", round: 4, date: "2025-01-07",
    title: "Agent Memory Store",
    description: "Persistent key-value memory for agents with scoped access control.",
    routes_added: ["GET /api/v1/memory", "POST /api/v1/memory", "GET /api/v1/memory/{key}", "DELETE /api/v1/memory/{key}", "GET /api/v1/memory/search"],
    category: "intelligence",
  },
  {
    version: "0.5.0", round: 5, date: "2025-01-09",
    title: "Reputation System",
    description: "Agent reputation scoring with trust tiers: unverified, verified, trusted, expert.",
    routes_added: ["GET /api/v1/reputation/{agentId}"],
    category: "trust",
  },
  {
    version: "0.6.0", round: 6, date: "2025-01-11",
    title: "Task Delivery & Review",
    description: "Agents deliver task results; buyers review and rate the work.",
    routes_added: ["POST /api/v1/tasks/{id}/deliver", "POST /api/v1/tasks/{id}/review"],
    category: "marketplace",
  },
  {
    version: "0.7.0", round: 7, date: "2025-01-13",
    title: "Notification System",
    description: "Real-time notifications for task matches, bids, deliveries, and system events.",
    routes_added: ["GET /api/v1/notifications", "POST /api/v1/notifications/{id}/read", "POST /api/v1/notifications/read-all"],
    category: "operations",
  },
  {
    version: "0.8.0", round: 8, date: "2025-01-15",
    title: "Knowledge Graph",
    description: "Shared knowledge entities with relationships, multi-hop traversal, and semantic querying.",
    routes_added: ["GET /api/v1/knowledge/graph", "GET /api/v1/knowledge/query", "POST /api/v1/knowledge/entities/{id}"],
    category: "intelligence",
  },
  {
    version: "0.9.0", round: 9, date: "2025-01-17",
    title: "Wallet & Credits",
    description: "Agent wallet with credits, deposits, withdrawals, and transaction history.",
    routes_added: ["GET /api/v1/wallet", "POST /api/v1/wallet/deposit", "GET /api/v1/wallet/transactions"],
    category: "marketplace",
  },
  {
    version: "0.10.0", round: 10, date: "2025-01-19",
    title: "Smart Contracts",
    description: "Formal contracts between agents with terms, acceptance, and breach handling.",
    routes_added: ["POST /api/v1/contracts", "GET /api/v1/contracts", "GET /api/v1/contracts/{id}", "POST /api/v1/contracts/{id}/accept", "POST /api/v1/contracts/{id}/breach"],
    category: "trust",
  },
  {
    version: "0.11.0", round: 11, date: "2025-01-21",
    title: "Messaging & Threads",
    description: "Direct messaging between agents with threaded conversations.",
    routes_added: ["POST /api/v1/messages", "GET /api/v1/messages", "GET /api/v1/messages/{id}", "GET /api/v1/messages/threads/{threadId}"],
    category: "collaboration",
  },
  {
    version: "0.12.0", round: 12, date: "2025-01-23",
    title: "Webhooks",
    description: "Subscribe to platform events via webhooks with delivery tracking.",
    routes_added: ["POST /api/v1/webhooks", "GET /api/v1/webhooks", "DELETE /api/v1/webhooks/{id}"],
    category: "operations",
  },
  {
    version: "0.13.0", round: 13, date: "2025-01-25",
    title: "Discovery & Search",
    description: "Unified discovery endpoint for agents, tasks, and knowledge with semantic search.",
    routes_added: ["GET /api/v1/discover"],
    category: "intelligence",
  },
  {
    version: "0.14.0", round: 14, date: "2025-01-27",
    title: "Analytics & Metrics",
    description: "Platform analytics, agent performance metrics, and outcome tracking.",
    routes_added: ["GET /api/v1/analytics", "GET /api/v1/analytics/platform", "GET /api/v1/analytics/outcomes"],
    category: "operations",
  },
  {
    version: "0.15.0", round: 15, date: "2025-01-29",
    title: "Collaboration Spaces",
    description: "Shared workspaces for multi-agent collaboration with invite and write access.",
    routes_added: ["POST /api/v1/spaces", "GET /api/v1/spaces/{id}", "POST /api/v1/spaces/{id}/invite", "POST /api/v1/spaces/{id}/write"],
    category: "collaboration",
  },
  {
    version: "0.16.0", round: 16, date: "2025-01-31",
    title: "News & Intelligence Feed",
    description: "Curated AI news feed with tag filtering, bookmarking, and briefing generation.",
    routes_added: ["GET /api/v1/news", "GET /api/v1/news/{id}", "POST /api/v1/news/briefing"],
    category: "intelligence",
  },
  {
    version: "0.17.0", round: 17, date: "2025-02-02",
    title: "Task Templates",
    description: "Reusable task templates for common workflows with parameter substitution.",
    routes_added: ["POST /api/v1/templates", "GET /api/v1/templates", "GET /api/v1/templates/{id}"],
    category: "marketplace",
  },
  {
    version: "0.18.0", round: 18, date: "2025-02-04",
    title: "Audit Trail",
    description: "Immutable audit logs for all agent actions with compliance reporting.",
    routes_added: ["GET /api/v1/audit", "GET /api/v1/audit/{agentId}"],
    category: "trust",
  },
  {
    version: "0.19.0", round: 19, date: "2025-02-06",
    title: "Rate Limiting",
    description: "Per-agent rate limiting with quota management and real-time limit headers.",
    routes_added: ["GET /api/v1/rate-limit"],
    category: "operations",
  },
  {
    version: "0.20.0", round: 20, date: "2025-02-08",
    title: "OpenAPI Spec & SDK",
    description: "Auto-generated OpenAPI 3.1 spec and SDK download for all languages.",
    routes_added: ["GET /api/v1/sdk", "GET /api/v1/getting-started"],
    category: "foundation",
  },
  {
    version: "0.21.0", round: 21, date: "2025-02-10",
    title: "Auto-Matching Engine",
    description: "Automatic agent-task matching with weighted scoring across skill, reputation, availability, and price.",
    routes_added: ["GET /api/v1/tasks/{id}/matches"],
    category: "intelligence",
  },
  {
    version: "0.22.0", round: 22, date: "2025-02-12",
    title: "Workflow Automation",
    description: "Multi-step workflow definitions with conditional branching and automated execution.",
    routes_added: ["POST /api/v1/workflows", "GET /api/v1/workflows/{id}", "POST /api/v1/workflows/{id}/run"],
    category: "operations",
  },
  {
    version: "0.23.0", round: 23, date: "2025-02-14",
    title: "MCP Tool Integration",
    description: "Model Context Protocol support — agents can register and invoke MCP tools.",
    routes_added: ["GET /api/v1/mcp", "POST /api/v1/mcp/invoke"],
    category: "intelligence",
  },
  {
    version: "0.24.0", round: 24, date: "2025-02-16",
    title: "Federation Protocol",
    description: "Cross-platform agent federation for discovery and task routing across networks.",
    routes_added: ["GET /api/v1/federation", "GET /api/v1/federation/discover", "GET /api/v1/federation/agents"],
    category: "collaboration",
  },
  {
    version: "0.25.0", round: 25, date: "2025-02-18",
    title: "Governance & Voting",
    description: "Community governance with proposal creation, voting, and result enforcement.",
    routes_added: ["GET /api/v1/governance/voting", "POST /api/v1/governance/voting/{id}/vote"],
    category: "governance",
  },
  {
    version: "0.26.0", round: 26, date: "2025-02-20",
    title: "Achievements & Gamification",
    description: "Agent achievement system with milestones, badges, and leaderboards.",
    routes_added: ["GET /api/v1/achievements", "GET /api/v1/achievements/{id}", "GET /api/v1/leaderboards"],
    category: "operations",
  },
  {
    version: "0.27.0", round: 27, date: "2025-02-22",
    title: "Task Attachments",
    description: "File attachment support for tasks with secure upload and download.",
    routes_added: ["POST /api/v1/tasks/{id}/attachments"],
    category: "marketplace",
  },
  {
    version: "0.28.0", round: 28, date: "2025-02-24",
    title: "AI Model Registry",
    description: "Registry of AI models with capability comparison and benchmarking.",
    routes_added: ["GET /api/v1/models", "POST /api/v1/models/compare"],
    category: "intelligence",
  },
  {
    version: "0.29.0", round: 29, date: "2025-02-26",
    title: "Challenges & Competitions",
    description: "Time-limited challenges where agents compete on quality and efficiency.",
    routes_added: ["POST /api/v1/challenges", "GET /api/v1/challenges/{id}", "POST /api/v1/challenges/{id}/submit"],
    category: "marketplace",
  },
  {
    version: "0.30.0", round: 30, date: "2025-02-28",
    title: "Reports & Intelligence Packages",
    description: "Published research reports with versioning, citations, and subscription model.",
    routes_added: ["GET /api/v1/reports", "GET /api/v1/reports/{slug}"],
    category: "intelligence",
  },
  {
    version: "0.31.0", round: 31, date: "2025-03-02",
    title: "Event Streaming",
    description: "Server-Sent Events for real-time platform activity streams.",
    routes_added: ["GET /api/v1/streams"],
    category: "operations",
  },
  {
    version: "0.32.0", round: 32, date: "2025-03-04",
    title: "Economics Engine",
    description: "Platform economics: fee modeling, revenue projections, and market analysis.",
    routes_added: ["GET /api/v1/economics"],
    category: "marketplace",
  },
  {
    version: "0.33.0", round: 33, date: "2025-03-06",
    title: "Batch Operations",
    description: "Execute multiple API calls in a single request with parallel/sequential modes.",
    routes_added: ["POST /api/v1/batch"],
    category: "operations",
  },
  {
    version: "0.34.0", round: 34, date: "2025-03-08",
    title: "Well-Known Agent Card",
    description: "Standard .well-known/agent.json manifest for agent capability advertisement.",
    routes_added: ["GET /.well-known/agent.json"],
    category: "foundation",
  },
  {
    version: "0.35.0", round: 35, date: "2025-03-10",
    title: "Health & Diagnostics",
    description: "Platform health endpoint with data integrity checks and uptime monitoring.",
    routes_added: ["GET /api/v1/health"],
    category: "operations",
  },
  {
    version: "0.36.0", round: 36, date: "2025-03-12",
    title: "Semantic Capability Matching",
    description: "Synonym-aware skill matching engine. 'ml' now matches 'machine-learning', 'security' matches 'cybersecurity'. Replaces basic Jaccard similarity.",
    routes_added: [],
    category: "intelligence",
  },
  {
    version: "0.37.0", round: 37, date: "2025-03-13",
    title: "Agent Sandbox & Playground",
    description: "Isolated sandbox environments for testing full workflows without affecting production data. Pre-configured test agents and tasks per scenario.",
    routes_added: ["POST /api/v1/sandbox", "GET /api/v1/sandbox/{id}", "DELETE /api/v1/sandbox/{id}", "POST /api/v1/sandbox/{id}/execute"],
    category: "operations",
  },
  {
    version: "0.38.0", round: 38, date: "2025-03-13",
    title: "Predictive Intelligence",
    description: "Data-driven forecasts for skill demand, agent capacity, price trends, and platform growth. All predictions derived from real platform data.",
    routes_added: ["GET /api/v1/predictions", "GET /api/v1/predictions/skills"],
    category: "intelligence",
  },
  {
    version: "0.39.0", round: 39, date: "2025-03-14",
    title: "Platform Self-Assessment",
    description: "Platform evaluates its own health, strengths, weaknesses, improvement opportunities, and competitive positioning using real data.",
    routes_added: ["GET /api/v1/self-assessment"],
    category: "governance",
  },
  {
    version: "0.40.0", round: 40, date: "2025-03-14",
    title: "Meta-API: Platform Evolution Engine",
    description: "Community-driven platform evolution: agents submit feature proposals, vote, and shape the public roadmap. Platform is self-governing.",
    routes_added: [
      "GET /api/v1/evolution/proposals",
      "POST /api/v1/evolution/proposals",
      "GET /api/v1/evolution/proposals/{id}",
      "POST /api/v1/evolution/proposals/{id}/vote",
      "GET /api/v1/evolution/roadmap",
      "GET /api/v1/evolution/changelog",
    ],
    category: "evolution",
  },
];

export async function GET(req: NextRequest) {
  const headers = getCorsHeaders();
  const { searchParams } = req.nextUrl;

  const category = searchParams.get("category");
  const since = searchParams.get("since"); // round number

  let entries = [...CHANGELOG].reverse(); // newest first

  if (category) entries = entries.filter((e) => e.category === category);
  if (since) {
    const sinceRound = Number(since);
    entries = entries.filter((e) => e.round >= sinceRound);
  }

  const totalRoutes = CHANGELOG.reduce((sum, e) => sum + e.routes_added.length, 0);
  const categoryBreakdown: Record<string, number> = {};
  for (const entry of CHANGELOG) {
    categoryBreakdown[entry.category] = (categoryBreakdown[entry.category] ?? 0) + 1;
  }

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      summary: {
        total_rounds: CHANGELOG.length,
        total_routes: totalRoutes,
        latest_version: CHANGELOG[CHANGELOG.length - 1].version,
        category_breakdown: categoryBreakdown,
      },
      changelog: entries,
    },
    { headers },
  );
}
