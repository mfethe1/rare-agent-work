import { NextRequest, NextResponse } from "next/server";
import { getSubgraph } from "@/lib/knowledge";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const rootId = searchParams.get("root_id");
  if (!rootId || rootId.trim().length === 0) {
    return errorResponse("Query param 'root_id' is required", "MISSING_ROOT_ID", 400);
  }

  const depthRaw = parseInt(searchParams.get("depth") ?? "1", 10);
  if (![1, 2, 3].includes(depthRaw)) {
    return errorResponse("Query param 'depth' must be 1, 2, or 3", "INVALID_DEPTH", 400);
  }
  const depth = depthRaw as 1 | 2 | 3;

  const { nodes, edges } = await getSubgraph(rootId, depth);

  if (nodes.length === 0) {
    return errorResponse("Root entity not found", "NOT_FOUND", 404);
  }

  return NextResponse.json(
    {
      root_id: rootId,
      depth,
      nodes,
      edges,
      node_count: nodes.length,
      edge_count: edges.length,
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
