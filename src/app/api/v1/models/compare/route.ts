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

  const idsParam = searchParams.get("ids");
  if (!idsParam || idsParam.trim().length === 0) {
    return errorResponse(
      "Query parameter 'ids' is required (comma-separated model names)",
      "MISSING_IDS",
      400,
    );
  }

  const requestedIds = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (requestedIds.length < 2) {
    return errorResponse(
      "At least 2 model IDs are required for comparison",
      "TOO_FEW_MODELS",
      400,
    );
  }

  if (requestedIds.length > 10) {
    return errorResponse(
      "Maximum 10 models can be compared at once",
      "TOO_MANY_MODELS",
      400,
    );
  }

  const allModels = loadModels();

  // Match models case-insensitively
  const found: RawModelItem[] = [];
  const notFound: string[] = [];

  for (const id of requestedIds) {
    const match = allModels.find(
      (m) => m.model_name.toLowerCase() === id.toLowerCase(),
    );
    if (match) {
      found.push(match);
    } else {
      notFound.push(id);
    }
  }

  if (found.length < 2) {
    return errorResponse(
      `Could not find enough matching models. Not found: ${notFound.join(", ")}`,
      "MODELS_NOT_FOUND",
      404,
    );
  }

  // Collect all unique capabilities across compared models
  const allCapabilities = [...new Set(found.flatMap((m) => m.capabilities))].sort();

  // Build comparison table
  const comparisonRows = found.map((m) => {
    const capabilityMap: Record<string, boolean> = {};
    for (const cap of allCapabilities) {
      capabilityMap[cap] = m.capabilities.includes(cap);
    }

    return {
      model_name: m.model_name,
      provider: m.provider,
      ranking_score: m.ranking_score,
      last_verified_at: m.last_verified_at,
      capabilities: capabilityMap,
      source_urls: m.source_urls ?? [],
    };
  });

  // Sort by ranking score for easy reading
  comparisonRows.sort((a, b) => b.ranking_score - a.ranking_score);

  // Determine winner per dimension
  const winner = {
    overall: comparisonRows[0].model_name,
    highest_score: comparisonRows[0].ranking_score,
    most_capabilities: (() => {
      let best = comparisonRows[0];
      for (const row of comparisonRows) {
        const count = Object.values(row.capabilities).filter(Boolean).length;
        const bestCount = Object.values(best.capabilities).filter(Boolean).length;
        if (count > bestCount) best = row;
      }
      return best.model_name;
    })(),
  };

  return NextResponse.json(
    {
      models: comparisonRows,
      dimensions: allCapabilities,
      winner,
      not_found: notFound.length > 0 ? notFound : undefined,
      meta: {
        compared: found.length,
        generated_at: new Date().toISOString(),
      },
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
