import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { CORS_HEADERS_GET, CORS_HEADERS } from "@/lib/api-headers";


function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

interface RawModelItem {
  model_name: string;
  provider: string;
  capabilities: string[];
  ranking_score: number;
  last_verified_at: string;
  source_urls?: string[];
}

function loadModels(): RawModelItem[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data/models/models.json"), "utf-8");
    return JSON.parse(raw) as RawModelItem[];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const providerFilter = searchParams.get("provider")?.toLowerCase();
  const capabilityFilter = searchParams.get("capability")?.toLowerCase();
  const minScoreRaw = searchParams.get("min_score");
  const minScore = minScoreRaw !== null ? parseFloat(minScoreRaw) : null;

  if (minScore !== null && isNaN(minScore)) {
    return errorResponse("'min_score' must be a valid number", "INVALID_MIN_SCORE", 400);
  }

  try {
    let models = loadModels();

    // Provider filter (case-insensitive partial match)
    if (providerFilter) {
      models = models.filter((m) => m.provider.toLowerCase().includes(providerFilter));
    }

    // Capability filter
    if (capabilityFilter) {
      models = models.filter((m) =>
        m.capabilities.some((c) => c.toLowerCase().includes(capabilityFilter)),
      );
    }

    // Min score filter
    if (minScore !== null) {
      models = models.filter((m) => m.ranking_score >= minScore!);
    }

    // Sort by ranking score descending
    models.sort((a, b) => b.ranking_score - a.ranking_score);

    // Assign rank position after filtering + sorting
    const items = models.map((m, idx) => ({
      rank: idx + 1,
      model_name: m.model_name,
      provider: m.provider,
      capabilities: m.capabilities,
      ranking_score: m.ranking_score,
      last_verified_at: m.last_verified_at,
      source_urls: m.source_urls ?? [],
    }));

    return NextResponse.json(
      {
        items,
        meta: {
          total: items.length,
          filters: {
            provider: providerFilter ?? null,
            capability: capabilityFilter ?? null,
            min_score: minScore ?? null,
          },
          generated_at: new Date().toISOString(),
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("[models] Error:", err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
