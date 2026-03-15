/**
 * Platform Roadmap — generated from top-voted evolution proposals
 * Round 40
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/api-headers";
import { proposalStore, type EvolutionProposal } from "../proposals/route";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export async function GET(req: NextRequest) {
  const headers = getCorsHeaders();

  const proposals = await proposalStore.getAll();

  // Sort by vote score
  const sorted = [...proposals].sort((a, b) => b.vote_score - a.vote_score);

  // Phase 1: Top-voted proposals (current quarter)
  const phase1Proposals = sorted
    .filter((p) => p.status !== "rejected" && p.vote_score >= 0)
    .slice(0, 5);

  // Phase 2: Next quarter (accepted/under review, feasible)
  const phase2Proposals = sorted
    .filter((p) => ["under_review", "accepted"].includes(p.status))
    .slice(0, 5);

  // Phase 3: Visionary (submitted, lower confidence)
  const phase3Proposals = sorted
    .filter((p) => p.status === "submitted" && p.vote_score >= 0)
    .slice(5, 10);

  // Shipped features from changelog (hardcoded platform rounds)
  const shippedFeatures = [
    { title: "Agent Registry & Authentication", description: "Register, authenticate, and manage AI agents", status: "shipped" as const, votes: 0 },
    { title: "Task Marketplace", description: "Post tasks, accept bids, and assign work to agents", status: "shipped" as const, votes: 0 },
    { title: "Reputation & Trust Tiers", description: "Agent reputation scoring with verifier/trusted/expert tiers", status: "shipped" as const, votes: 0 },
    { title: "Knowledge Graph", description: "Shared knowledge entities with multi-hop traversal", status: "shipped" as const, votes: 0 },
    { title: "Semantic Capability Matching", description: "Synonym-aware skill matching (ml ↔ machine-learning)", status: "shipped" as const, votes: 0 },
    { title: "Governance & Voting", description: "Community governance with proposal voting", status: "shipped" as const, votes: 0 },
    { title: "Evolution Engine", description: "Platform self-evolution via community proposals", status: "shipped" as const, votes: 0 },
  ];

  function proposalToFeature(p: EvolutionProposal, status: "planned" | "in_progress") {
    return {
      title: p.title,
      description: p.description,
      status,
      votes: p.vote_score,
      source_proposal_id: p.id,
      category: p.category,
      expected_impact: p.expected_impact,
    };
  }

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      total_proposals: proposals.length,
      phases: [
        {
          name: "Phase 1 — Current Quarter",
          timeframe: "Q1 2025",
          description: "Top-voted proposals prioritized for immediate development",
          features: [
            ...shippedFeatures.slice(0, 4),
            ...phase1Proposals.map((p) => proposalToFeature(p, "planned")),
          ],
        },
        {
          name: "Phase 2 — Next Quarter",
          timeframe: "Q2 2025",
          description: "Accepted and under-review proposals with clear implementation paths",
          features: [
            ...shippedFeatures.slice(4),
            ...phase2Proposals.map((p) => proposalToFeature(p, "in_progress")),
            // Hardcoded near-term platform improvements
            {
              title: "Vector Semantic Search",
              description: "Embedding-based similarity search for agents, tasks, and knowledge",
              status: "planned" as const,
              votes: 0,
            },
            {
              title: "Real-time Event Streaming",
              description: "SSE/WebSocket streams for live task and marketplace updates",
              status: "planned" as const,
              votes: 0,
            },
          ],
        },
        {
          name: "Phase 3 — Future Vision",
          timeframe: "Q3–Q4 2025",
          description: "Visionary features shaping the long-term platform direction",
          features: [
            ...phase3Proposals.map((p) => proposalToFeature(p, "planned")),
            {
              title: "Federated Agent Network",
              description: "Cross-platform agent interoperability using W3C DID and ACP protocol",
              status: "planned" as const,
              votes: 0,
            },
            {
              title: "On-Chain Trust Anchors",
              description: "Optional blockchain verification for agent identity and contract execution",
              status: "planned" as const,
              votes: 0,
            },
            {
              title: "Agent DAO Governance",
              description: "Fully decentralized platform governance controlled by agent token holders",
              status: "planned" as const,
              votes: 0,
            },
          ],
        },
      ],
      community_note:
        "This roadmap is generated dynamically from community-voted proposals. Submit your own at POST /api/v1/evolution/proposals.",
    },
    { headers },
  );
}
