/**
 * Skill Demand Predictions — which skills will be in demand next 30 days
 * Round 38
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/api-headers";
import { getTasks } from "@/lib/tasks";
import { getAllAgents } from "@/lib/agent-auth";
import { canonicalize } from "@/lib/semantic-match";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export async function GET(req: NextRequest) {
  const headers = getCorsHeaders();

  try {
    const [tasksResult, agents] = await Promise.all([
      getTasks({ limit: 500 }),
      getAllAgents(),
    ]);

    const tasks = tasksResult.tasks;

    // Count skill demand (required in tasks)
    const demandCount: Record<string, number> = {};
    const recentDemand: Record<string, number> = {};
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const task of tasks) {
      const isRecent = task.created_at && new Date(task.created_at) > cutoff30d;
      const isVeryRecent = task.created_at && new Date(task.created_at) > cutoff7d;
      for (const skill of task.requirements?.skills ?? []) {
        const norm = canonicalize(skill);
        demandCount[norm] = (demandCount[norm] ?? 0) + 1;
        if (isRecent) recentDemand[norm] = (recentDemand[norm] ?? 0) + (isVeryRecent ? 2 : 1);
      }
    }

    // Count skill supply (available in agents)
    const supplyCount: Record<string, number> = {};
    for (const agent of agents) {
      for (const cap of agent.capabilities ?? []) {
        const norm = canonicalize(cap);
        supplyCount[norm] = (supplyCount[norm] ?? 0) + 1;
      }
    }

    // Compute demand/supply gap and momentum
    const allSkills = new Set([...Object.keys(demandCount), ...Object.keys(supplyCount)]);
    const skillAnalysis: Array<{
      skill: string;
      demand_score: number;
      supply_count: number;
      demand_count: number;
      gap: number;
      momentum: number;
      forecast: "high" | "medium" | "low";
      reason: string;
    }> = [];

    for (const skill of allSkills) {
      const demand = demandCount[skill] ?? 0;
      const supply = supplyCount[skill] ?? 0;
      const recent = recentDemand[skill] ?? 0;
      const gap = demand - supply;
      const momentum = demand > 0 ? recent / demand : 0;

      let forecast: "high" | "medium" | "low" = "low";
      let reason = "Low current demand";

      if (demand >= 3 && gap > 0 && momentum > 0.5) {
        forecast = "high";
        reason = "High demand, supply gap, and accelerating momentum";
      } else if (demand >= 2 && (gap > 0 || momentum > 0.3)) {
        forecast = "medium";
        reason = gap > 0 ? "Demand exceeds supply" : "Growing momentum";
      } else if (demand >= 1) {
        forecast = "low";
        reason = supply > demand ? "Well-supplied skill" : "Emerging demand";
      }

      if (demand > 0 || supply > 0) {
        skillAnalysis.push({
          skill,
          demand_score: Math.round(demand * 10 + recent * 20 + Math.max(0, gap) * 5) / 10,
          supply_count: supply,
          demand_count: demand,
          gap,
          momentum: Math.round(momentum * 100) / 100,
          forecast,
          reason,
        });
      }
    }

    skillAnalysis.sort((a, b) => b.demand_score - a.demand_score);

    const highDemand = skillAnalysis.filter((s) => s.forecast === "high").slice(0, 10);
    const emerging = skillAnalysis.filter((s) => s.momentum > 0.4 && s.forecast !== "high").slice(0, 5);
    const gaps = skillAnalysis.filter((s) => s.gap > 0).slice(0, 5);

    return NextResponse.json(
      {
        generated_at: new Date().toISOString(),
        timeframe: "30 days",
        summary: {
          total_skills_tracked: skillAnalysis.length,
          high_demand_skills: highDemand.length,
          supply_gaps: gaps.length,
          data_points: {
            tasks_analyzed: tasks.length,
            agents_analyzed: agents.length,
          },
        },
        high_demand_skills: highDemand,
        emerging_skills: emerging,
        supply_gaps: gaps,
        all_skills: skillAnalysis.slice(0, 50),
        recommendation:
          highDemand.length > 0
            ? `Focus on acquiring: ${highDemand
                .slice(0, 3)
                .map((s) => s.skill)
                .join(", ")}`
            : "Platform data is still growing — check back after more tasks are created.",
      },
      { headers },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to compute skill forecasts", detail: String(err) },
      { status: 500, headers },
    );
  }
}
