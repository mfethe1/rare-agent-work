/**
 * Zod validation schemas for A2A Auction & Bidding endpoints.
 */

import { z } from 'zod';

const trimmed = (max = 5000) => z.string().trim().max(max);

// ──────────────────────────────────────────────
// Evaluation Weights (nested)
// ──────────────────────────────────────────────

const evaluationWeightsSchema = z
  .object({
    price: z.number().min(0).max(1).default(0.4),
    reputation: z.number().min(0).max(1).default(0.35),
    speed: z.number().min(0).max(1).default(0.25),
  })
  .refine(
    (w) => Math.abs(w.price + w.reputation + w.speed - 1.0) < 0.01,
    { message: 'Evaluation weights must sum to 1.0' },
  );

// ──────────────────────────────────────────────
// Create Auction — POST /api/a2a/auctions
// ──────────────────────────────────────────────

export const auctionCreateSchema = z.object({
  required_capability: trimmed(200).min(1, 'required_capability is required'),
  title: trimmed(300).min(1, 'title is required'),
  description: trimmed(5000).min(1, 'description is required'),
  task_input: z.record(z.unknown()).default({}),
  auction_type: z.enum(['open', 'sealed', 'reverse', 'dutch']).default('open'),
  max_price: z.number().positive('max_price must be positive').max(1_000_000),
  currency: trimmed(16).default('credits'),
  dutch_start_price: z.number().positive().optional(),
  dutch_decrement_per_minute: z.number().positive().optional(),
  min_trust_level: z.enum(['untrusted', 'verified', 'partner']).default('untrusted'),
  min_reputation_score: z.number().min(0).max(1).default(0),
  bidding_deadline: z.string().datetime('bidding_deadline must be ISO-8601'),
  completion_deadline: z.string().datetime('completion_deadline must be ISO-8601'),
  evaluation_weights: evaluationWeightsSchema.optional(),
});

export type AuctionCreateInput = z.infer<typeof auctionCreateSchema>;

// ──────────────────────────────────────────────
// List Auctions — GET /api/a2a/auctions
// ──────────────────────────────────────────────

export const auctionListSchema = z.object({
  status: z.enum(['open', 'evaluating', 'awarded', 'settled', 'cancelled', 'expired']).optional(),
  required_capability: trimmed(200).optional(),
  auction_type: z.enum(['open', 'sealed', 'reverse', 'dutch']).optional(),
  min_trust_level: z.enum(['untrusted', 'verified', 'partner']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type AuctionListInput = z.infer<typeof auctionListSchema>;

// ──────────────────────────────────────────────
// Place Bid — POST /api/a2a/auctions/:id/bid
// ──────────────────────────────────────────────

export const bidCreateSchema = z.object({
  price: z.number().positive('Bid price must be positive').max(1_000_000),
  estimated_minutes: z.number().int().positive('estimated_minutes must be a positive integer').max(525_600),
  pitch: trimmed(2000).min(1, 'pitch is required'),
  matched_capability_id: trimmed(200).min(1, 'matched_capability_id is required'),
});

export type BidCreateInput = z.infer<typeof bidCreateSchema>;

// ──────────────────────────────────────────────
// Award Auction — POST /api/a2a/auctions/:id/award
// ──────────────────────────────────────────────

export const auctionAwardSchema = z.object({
  bid_id: z.string().uuid('bid_id must be a valid UUID').optional(),
});

export type AuctionAwardInput = z.infer<typeof auctionAwardSchema>;
