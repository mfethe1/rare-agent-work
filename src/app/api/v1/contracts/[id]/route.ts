import { NextRequest, NextResponse } from "next/server";
import { getContractById } from "@/lib/contracts";
import { CORS_HEADERS } from "@/lib/api-headers";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, status }, { status, headers: CORS_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const contract = await getContractById(id);
  if (!contract) {
    return errorResponse("Contract not found", "NOT_FOUND", 404);
  }

  return NextResponse.json(contract, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
