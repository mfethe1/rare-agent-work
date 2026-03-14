/**
 * Zod-based request validation for API routes.
 *
 * Each schema defines the exact shape of accepted payloads.
 * Use `validateRequest()` to parse incoming JSON and return
 * a typed result or a 400 response with specific field errors.
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';

// ──────────────────────────────────────────────
// Shared primitives
// ──────────────────────────────────────────────

const trimmedString = (max = 5000) =>
  z.string().trim().max(max);

const email = z.string().trim().email('Invalid email address').max(320);

// ──────────────────────────────────────────────
// Chat route — POST /api/chat
// ──────────────────────────────────────────────

const chatMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: trimmedString(50_000),
});

export const chatSchema = z.object({
  messages: z
    .array(chatMessage)
    .min(1, 'At least one message is required')
    .max(50, 'Too many messages (max 50)'),
  model: trimmedString(64).optional(),
  reportSlug: trimmedString(128).optional(),
});

// ──────────────────────────────────────────────
// Submit work — POST /api/submit-work
// ──────────────────────────────────────────────

export const submitWorkSchema = z.object({
  requestType: z.enum([
    'Architecture Review',
    'Implementation Rescue',
    'Curated Specialist Match',
  ]),
  name: trimmedString(200).min(1, 'Name is required'),
  email,
  company: trimmedString(200).optional().default('Not provided'),
  projectTitle: trimmedString(300).min(1, 'Project title is required'),
  currentState: trimmedString(5000).min(1, 'Current state is required'),
  desiredOutcome: trimmedString(5000).min(1, 'Desired outcome is required'),
  constraints: trimmedString(5000).optional().default('Not provided'),
  timeline: trimmedString(200).optional().default('Not provided'),
  budgetBand: trimmedString(200).optional().default('Not provided'),
  sensitivity: trimmedString(200).optional().default('Not provided'),
  links: trimmedString(2000).optional().default('Not provided'),
  website: trimmedString(500).optional().default(''),
  confirmsNoCredentials: z.literal(true, {
    errorMap: () => ({ message: 'All trust confirmations are required' }),
  }),
  confirmsHumanReview: z.literal(true, {
    errorMap: () => ({ message: 'All trust confirmations are required' }),
  }),
  confirmsNoAutoExecution: z.literal(true, {
    errorMap: () => ({ message: 'All trust confirmations are required' }),
  }),
  agreesRetention: z.literal(true, {
    errorMap: () => ({ message: 'All trust confirmations are required' }),
  }),
});

// ──────────────────────────────────────────────
// Consulting — POST /api/consulting
// ──────────────────────────────────────────────

export const consultingSchema = z.object({
  name: trimmedString(200).min(1, 'Name is required'),
  email,
  company: trimmedString(200).optional().default('Not provided'),
  useCase: trimmedString(5000).min(1, 'Project details are required'),
  budget: trimmedString(200).optional().default('Not provided'),
  timeline: trimmedString(200).optional().default('Not provided'),
});

// ──────────────────────────────────────────────
// NLWeb /ask — POST /api/v1/ask
// ──────────────────────────────────────────────

export const askSchema = z.object({
  query: trimmedString(500).optional(),
  q: trimmedString(500).optional(),
  prev: trimmedString(2000).optional().default(''),
  previous: trimmedString(2000).optional(),
}).refine(
  (data) => !!(data.query || data.q),
  { message: 'query is required', path: ['query'] },
);

// ──────────────────────────────────────────────
// News vote — POST /api/news/vote
// ──────────────────────────────────────────────

export const newsVoteSchema = z.object({
  id: trimmedString(128).min(1, 'Missing id'),
  action: z.enum(['upvote', 'click']).optional().default('upvote'),
});

// ──────────────────────────────────────────────
// Stripe checkout — POST /api/stripe/checkout
// ──────────────────────────────────────────────

export const stripeCheckoutSchema = z.object({
  plan: z.enum([
    'report_60',
    'report_multi',
    'report_empirical',
    'report_mcp',
    'report_incidents',
    'newsletter',
    'starter',
    'pro',
  ]),
});

// ──────────────────────────────────────────────
// Drafts — POST /api/drafts
// ──────────────────────────────────────────────

export const draftCreateSchema = z.object({
  slug: trimmedString(200).min(1, 'slug required'),
  title: trimmedString(500).min(1, 'title required'),
  content: z.string().min(1, 'content required').max(500_000),
  version: trimmedString(20).optional().default('v1.0'),
  changes_summary: trimmedString(2000).nullable().optional(),
  created_by: trimmedString(100).optional().default('agent'),
});

export const draftPatchSchema = z.object({
  id: z.union([z.string().uuid(), z.number().int().positive()]),
  status: z.enum(['approved', 'rejected']),
  reviewer_notes: trimmedString(5000).nullable().optional(),
});

// ──────────────────────────────────────────────
// News ingest — POST /api/news/ingest
// ──────────────────────────────────────────────

const newsItem = z.object({
  title: trimmedString(500).min(1),
  url: z.string().url().max(2000),
  source: trimmedString(200).min(1),
  summary: trimmedString(2000).optional(),
  category: trimmedString(100).optional(),
  tags: z.array(trimmedString(50)).max(20).optional(),
  publishedAt: z.string().min(1),
});

export const newsIngestSchema = z.union([
  z.array(newsItem).min(1).max(100),
  z.object({ items: z.array(newsItem).min(1).max(100) }),
]);

// ──────────────────────────────────────────────
// Articles — POST /api/articles
// ──────────────────────────────────────────────

export const articleSchema = z.object({
  url: z.string().url().max(2048),
  title: trimmedString(500).min(1, 'title is required'),
  summary: trimmedString(2000).nullable().optional(),
  source: trimmedString(200).nullable().optional(),
  tags: z.array(trimmedString(50)).max(20).optional().default([]),
  published_at: z.string().min(1, 'published_at is required'),
});

// ──────────────────────────────────────────────
// Report generation — POST /api/reports/generate
// ──────────────────────────────────────────────

export const reportGenerateSchema = z.object({
  topic: trimmedString(500).optional(),
  reportType: trimmedString(100).optional(),
});

// ──────────────────────────────────────────────
// Validation helper
// ──────────────────────────────────────────────

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; response: NextResponse };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Parse and validate a request body against a Zod schema.
 * Returns typed data on success, or a 400 NextResponse with field-level errors.
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ValidationResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid JSON in request body.' },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Validation failed.',
          details: fieldErrors,
        },
        { status: 400 },
      ),
    };
  }

  return { success: true, data: result.data };
}
