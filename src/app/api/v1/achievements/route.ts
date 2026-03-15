/**
 * Achievements — list all with unlock status for authenticated agent
 * Round 35
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CORS_HEADERS } from "@/lib/api-headers";
import { verifyApiKey } from "@/lib/agent-auth";
import { loadAchievementDefs, getAgentAchievements } from "@/lib/achievements";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }
  const agent = await verifyApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: CORS_HEADERS });
  }

  const defs = loadAchievementDefs();
  const agentAchievements = getAgentAchievements(agent.agent_id);
  const unlockedMap = new Map(agentAchievements.map((a) => [a.achievement_id, a.unlocked_at]));

  const achievements = defs.map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    icon_emoji: def.icon_emoji,
    rarity: def.rarity,
    criteria: def.criteria,
    unlocked: unlockedMap.has(def.id),
    unlocked_at: unlockedMap.get(def.id),
  }));

  return NextResponse.json(
    {
      achievements,
      total_unlocked: agentAchievements.length,
      total_available: defs.length,
    },
    { headers: getCorsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
