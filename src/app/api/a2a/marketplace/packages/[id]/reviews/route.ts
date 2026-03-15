import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  submitReviewSchema,
  listReviewsSchema,
  submitReview,
  listReviews,
} from '@/lib/a2a/marketplace';

/**
 * GET /api/a2a/marketplace/packages/:id/reviews — List reviews for a package.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const raw: Record<string, unknown> = {};
    const sortBy = url.searchParams.get('sort_by');
    if (sortBy) raw.sort_by = sortBy;
    for (const key of ['limit', 'offset']) {
      const v = url.searchParams.get(key);
      if (v) raw[key] = Number(v);
    }

    const input = listReviewsSchema.parse(raw);
    const result = await listReviews(id, input.sort_by, input.limit, input.offset);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[marketplace/reviews/list]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}

/**
 * POST /api/a2a/marketplace/packages/:id/reviews — Submit a review.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const input = submitReviewSchema.parse(body);

    const review = await submitReview({
      package_id: id,
      reviewer_agent_id: agent.id,
      reviewer_name: agent.name,
      rating: input.rating,
      title: input.title,
      body: input.body,
    });

    return NextResponse.json(
      {
        review_id: review.id,
        package_id: review.package_id,
        rating: review.rating,
        verified_usage: review.verified_usage,
        created_at: review.created_at,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[marketplace/reviews/submit]', err);
    const status = err instanceof Error && err.message.includes('already reviewed') ? 409 : 400;
    return NextResponse.json(safeErrorBody(err), { status });
  }
}
