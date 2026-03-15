/**
 * Predictive Intelligence — all predictions
 * Round 38
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/api-headers";
import { generateAllPredictions } from "@/lib/predictions";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export async function GET(req: NextRequest) {
  const headers = getCorsHeaders();

  try {
    const predictions = await generateAllPredictions();

    return NextResponse.json(
      {
        generated_at: new Date().toISOString(),
        predictions,
        meta: {
          total: predictions.length,
          categories: [...new Set(predictions.map((p) => p.category))],
          avg_confidence:
            Math.round(
              (predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length) * 100,
            ) / 100,
          disclaimer:
            "Predictions are computed from real platform data patterns. Confidence scores reflect data volume.",
        },
      },
      { headers },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate predictions", detail: String(err) },
      { status: 500, headers },
    );
  }
}
