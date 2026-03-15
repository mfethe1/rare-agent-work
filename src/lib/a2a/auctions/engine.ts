/**
 * A2A Task Auction & Bidding Engine
 *
 * The marketplace engine that powers competitive task allocation. Manages
 * auction lifecycle, bid validation, escrow holds, bid evaluation with
 * multi-criteria scoring, winner selection, and task creation.
 *
 * Integrates with:
 *   - Billing engine: escrow holds, settlements, refunds
 *   - Reputation system: bidder qualification and scoring
 *   - Router: capability matching for bid validation
 *   - Webhooks: event emission for auction state changes
 */

import { getServiceDb } from '../auth';
import { getOrCreateWallet, deposit } from '../billing/engine';
import { getReputationScores } from '../reputation';
import { scoreCapabilityMatch } from '../router';
import type { AgentCapability, AgentTrustLevel } from '../types';
import type {
  TaskAuction,
  AuctionBid,
  AuctionStatus,
  BidStatus,
  BidScoreBreakdown,
  EvaluationWeights,
  DEFAULT_EVALUATION_WEIGHTS,
} from './types';
import type {
  AuctionCreateInput,
  AuctionListInput,
  BidCreateInput,
  AuctionAwardInput,
} from './validation';

// ──────────────────────────────────────────────
// Trust Level Ranking (for qualification checks)
// ──────────────────────────────────────────────

const TRUST_RANK: Record<string, number> = {
  untrusted: 0,
  verified: 1,
  partner: 2,
};

// ──────────────────────────────────────────────
// Create Auction
// ──────────────────────────────────────────────

interface CreateAuctionParams {
  agent_id: string;
  input: AuctionCreateInput;
}

export async function createAuction({ agent_id, input }: CreateAuctionParams): Promise<
  | { auction_id: string; escrow_tx_id: string; status: AuctionStatus; created_at: string }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // Validate deadlines are in the future
  const now = new Date();
  const biddingDeadline = new Date(input.bidding_deadline);
  const completionDeadline = new Date(input.completion_deadline);

  if (biddingDeadline <= now) {
    return { error: 'bidding_deadline must be in the future', status_code: 400 };
  }
  if (completionDeadline <= biddingDeadline) {
    return { error: 'completion_deadline must be after bidding_deadline', status_code: 400 };
  }

  // Dutch auction validation
  if (input.auction_type === 'dutch') {
    if (!input.dutch_start_price || !input.dutch_decrement_per_minute) {
      return { error: 'Dutch auctions require dutch_start_price and dutch_decrement_per_minute', status_code: 400 };
    }
    if (input.dutch_start_price > input.max_price) {
      return { error: 'dutch_start_price cannot exceed max_price', status_code: 400 };
    }
  }

  // Hold escrow from requester's wallet
  const wallet = await getOrCreateWallet(agent_id, input.currency);
  if (!wallet) return { error: 'Failed to initialize wallet', status_code: 500 };
  if (wallet.status !== 'active') return { error: 'Wallet is not active', status_code: 403 };
  if (wallet.balance < input.max_price) {
    return {
      error: `Insufficient balance for escrow: need ${input.max_price} ${input.currency}, have ${wallet.balance}`,
      status_code: 402,
    };
  }

  // Create escrow hold transaction
  const { data: escrowTx, error: escrowErr } = await db
    .from('a2a_ledger_transactions')
    .insert({
      wallet_id: wallet.id,
      agent_id,
      type: 'hold',
      amount: -input.max_price,
      currency: input.currency,
      status: 'pending',
      description: `Auction escrow hold: ${input.title.slice(0, 50)}`,
    })
    .select('id')
    .single();

  if (escrowErr || !escrowTx) return { error: 'Failed to create escrow hold', status_code: 500 };

  // Deduct from available balance, add to held
  const { error: walletErr } = await db
    .from('a2a_wallets')
    .update({
      balance: wallet.balance - input.max_price,
      held_balance: wallet.held_balance + input.max_price,
    })
    .eq('id', wallet.id)
    .eq('balance', wallet.balance); // Optimistic concurrency

  if (walletErr) {
    await db.from('a2a_ledger_transactions').update({ status: 'failed' }).eq('id', escrowTx.id);
    return { error: 'Balance update conflict — please retry', status_code: 409 };
  }

  // Resolve evaluation weights
  const weights = input.evaluation_weights ?? { price: 0.4, reputation: 0.35, speed: 0.25 };

  // Create the auction
  const { data: auction, error: auctionErr } = await db
    .from('a2a_auctions')
    .insert({
      requester_agent_id: agent_id,
      required_capability: input.required_capability,
      title: input.title,
      description: input.description,
      task_input: input.task_input,
      auction_type: input.auction_type,
      status: 'open',
      max_price: input.max_price,
      currency: input.currency,
      dutch_start_price: input.dutch_start_price ?? null,
      dutch_decrement_per_minute: input.dutch_decrement_per_minute ?? null,
      min_trust_level: input.min_trust_level,
      min_reputation_score: input.min_reputation_score,
      bidding_deadline: input.bidding_deadline,
      completion_deadline: input.completion_deadline,
      escrow_tx_id: escrowTx.id,
      evaluation_weights: weights,
      bid_count: 0,
    })
    .select('id, created_at')
    .single();

  if (auctionErr || !auction) {
    // Rollback escrow
    await releaseEscrow(db, wallet.id, wallet.balance, wallet.held_balance, input.max_price, escrowTx.id);
    return { error: 'Failed to create auction', status_code: 500 };
  }

  return {
    auction_id: auction.id,
    escrow_tx_id: escrowTx.id,
    status: 'open' as AuctionStatus,
    created_at: auction.created_at,
  };
}

// ──────────────────────────────────────────────
// List Auctions
// ──────────────────────────────────────────────

export async function listAuctions(input: AuctionListInput): Promise<{
  auctions: TaskAuction[];
  count: number;
}> {
  const db = getServiceDb();
  if (!db) return { auctions: [], count: 0 };

  let query = db.from('a2a_auctions').select('*', { count: 'exact' });

  if (input.status) query = query.eq('status', input.status);
  if (input.required_capability) query = query.eq('required_capability', input.required_capability);
  if (input.auction_type) query = query.eq('auction_type', input.auction_type);
  if (input.min_trust_level) query = query.eq('min_trust_level', input.min_trust_level);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  return {
    auctions: (data as TaskAuction[]) ?? [],
    count: count ?? 0,
  };
}

// ──────────────────────────────────────────────
// Get Auction Detail
// ──────────────────────────────────────────────

export async function getAuctionDetail(
  auction_id: string,
  viewer_agent_id: string,
): Promise<
  | { auction: TaskAuction; bids: AuctionBid[]; current_dutch_price?: number }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data: auction } = await db
    .from('a2a_auctions')
    .select('*')
    .eq('id', auction_id)
    .single();

  if (!auction) return { error: 'Auction not found', status_code: 404 };

  // Fetch bids based on auction type visibility rules
  let bidsQuery = db.from('a2a_auction_bids').select('*').eq('auction_id', auction_id);

  const auctionData = auction as TaskAuction;

  // For sealed auctions, only show the viewer's own bids until auction is closed
  if (auctionData.auction_type === 'sealed' && auctionData.status === 'open') {
    bidsQuery = bidsQuery.eq('bidder_agent_id', viewer_agent_id);
  }

  const { data: bids } = await bidsQuery.order('created_at', { ascending: true });

  // Compute current dutch price if applicable
  let current_dutch_price: number | undefined;
  if (auctionData.auction_type === 'dutch' && auctionData.status === 'open') {
    current_dutch_price = computeDutchPrice(auctionData);
  }

  return {
    auction: auctionData,
    bids: (bids as AuctionBid[]) ?? [],
    current_dutch_price,
  };
}

// ──────────────────────────────────────────────
// Place Bid
// ──────────────────────────────────────────────

interface PlaceBidParams {
  auction_id: string;
  agent_id: string;
  agent_trust_level: AgentTrustLevel;
  agent_capabilities: AgentCapability[];
  input: BidCreateInput;
}

export async function placeBid({ auction_id, agent_id, agent_trust_level, agent_capabilities, input }: PlaceBidParams): Promise<
  | { bid_id: string; auction_id: string; status: BidStatus; created_at: string }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // 1. Fetch auction
  const { data: auction } = await db
    .from('a2a_auctions')
    .select('*')
    .eq('id', auction_id)
    .single();

  if (!auction) return { error: 'Auction not found', status_code: 404 };
  const auctionData = auction as TaskAuction;

  // 2. Validate auction is open
  if (auctionData.status !== 'open') {
    return { error: `Auction is ${auctionData.status}, not accepting bids`, status_code: 409 };
  }

  // 3. Check bidding deadline
  if (new Date() >= new Date(auctionData.bidding_deadline)) {
    return { error: 'Bidding deadline has passed', status_code: 410 };
  }

  // 4. Cannot bid on own auction
  if (auctionData.requester_agent_id === agent_id) {
    return { error: 'Cannot bid on your own auction', status_code: 403 };
  }

  // 5. Check trust level qualification
  if (TRUST_RANK[agent_trust_level] < TRUST_RANK[auctionData.min_trust_level]) {
    return {
      error: `Minimum trust level required: ${auctionData.min_trust_level}, you have: ${agent_trust_level}`,
      status_code: 403,
    };
  }

  // 6. Check reputation qualification
  const repScores = await getReputationScores([agent_id]);
  const repScore = repScores.get(agent_id) ?? 0;
  if (repScore < auctionData.min_reputation_score) {
    return {
      error: `Minimum reputation score required: ${auctionData.min_reputation_score}, you have: ${repScore}`,
      status_code: 403,
    };
  }

  // 7. Validate capability match
  const capMatch = scoreCapabilityMatch(auctionData.required_capability, agent_capabilities);
  if (capMatch.score === 0) {
    return { error: 'None of your capabilities match the auction requirement', status_code: 403 };
  }

  // 8. Validate price is within budget
  if (input.price > auctionData.max_price) {
    return { error: `Bid price ${input.price} exceeds auction max_price ${auctionData.max_price}`, status_code: 400 };
  }

  // 9. For dutch auctions, bid must match or exceed current dutch price
  if (auctionData.auction_type === 'dutch') {
    const currentPrice = computeDutchPrice(auctionData);
    if (input.price < currentPrice) {
      return { error: `Dutch auction current price is ${currentPrice}, bid must be >= current price`, status_code: 400 };
    }
  }

  // 10. Check for duplicate bid
  const { data: existingBid } = await db
    .from('a2a_auction_bids')
    .select('id')
    .eq('auction_id', auction_id)
    .eq('bidder_agent_id', agent_id)
    .neq('status', 'withdrawn')
    .single();

  if (existingBid) {
    return { error: 'You already have an active bid on this auction', status_code: 409 };
  }

  // 11. Insert bid
  const { data: bid, error: bidErr } = await db
    .from('a2a_auction_bids')
    .insert({
      auction_id,
      bidder_agent_id: agent_id,
      price: input.price,
      estimated_minutes: input.estimated_minutes,
      status: 'submitted',
      pitch: input.pitch,
      matched_capability_id: input.matched_capability_id,
      reputation_score_snapshot: repScore,
      trust_level_snapshot: agent_trust_level,
    })
    .select('id, created_at')
    .single();

  if (bidErr || !bid) return { error: 'Failed to place bid', status_code: 500 };

  // 12. Increment bid count
  await db
    .from('a2a_auctions')
    .update({ bid_count: auctionData.bid_count + 1 })
    .eq('id', auction_id);

  // 13. For dutch auctions, first valid bid wins immediately
  if (auctionData.auction_type === 'dutch') {
    await awardAuction({
      auction_id,
      agent_id: auctionData.requester_agent_id,
      input: { bid_id: bid.id },
    });
  }

  return {
    bid_id: bid.id,
    auction_id,
    status: 'submitted' as BidStatus,
    created_at: bid.created_at,
  };
}

// ──────────────────────────────────────────────
// Award Auction (close bidding + select winner)
// ──────────────────────────────────────────────

interface AwardAuctionParams {
  auction_id: string;
  agent_id: string;
  input: AuctionAwardInput;
}

export async function awardAuction({ auction_id, agent_id, input }: AwardAuctionParams): Promise<
  | {
      auction_id: string;
      winning_bid_id: string;
      winning_agent_id: string;
      winning_price: number;
      task_id: string;
      status: AuctionStatus;
    }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  // 1. Fetch auction
  const { data: auction } = await db
    .from('a2a_auctions')
    .select('*')
    .eq('id', auction_id)
    .single();

  if (!auction) return { error: 'Auction not found', status_code: 404 };
  const auctionData = auction as TaskAuction;

  // Only requester can award
  if (auctionData.requester_agent_id !== agent_id) {
    return { error: 'Only the auction requester can award', status_code: 403 };
  }

  if (auctionData.status !== 'open' && auctionData.status !== 'evaluating') {
    return { error: `Auction is ${auctionData.status}, cannot award`, status_code: 409 };
  }

  // 2. Move to evaluating
  await db.from('a2a_auctions').update({ status: 'evaluating' }).eq('id', auction_id);

  // 3. Fetch all submitted bids
  const { data: bids } = await db
    .from('a2a_auction_bids')
    .select('*')
    .eq('auction_id', auction_id)
    .eq('status', 'submitted');

  if (!bids || bids.length === 0) {
    await db.from('a2a_auctions').update({ status: 'expired' }).eq('id', auction_id);
    // Refund escrow
    await refundEscrow(auction_id, auctionData);
    return { error: 'No valid bids to evaluate', status_code: 404 };
  }

  // 4. Determine winner
  let winningBid: AuctionBid;

  if (input.bid_id) {
    // Manual selection
    const selected = bids.find((b) => b.id === input.bid_id);
    if (!selected) return { error: 'Specified bid not found among submitted bids', status_code: 404 };
    winningBid = selected as AuctionBid;
  } else {
    // Automatic evaluation
    const scored = evaluateBids(bids as AuctionBid[], auctionData.evaluation_weights);
    winningBid = scored[0];

    // Persist scores for transparency
    for (const bid of scored) {
      await db
        .from('a2a_auction_bids')
        .update({
          evaluation_score: bid.evaluation_score,
          score_breakdown: bid.score_breakdown,
        })
        .eq('id', bid.id);
    }
  }

  // 5. Mark winning bid
  await db.from('a2a_auction_bids').update({ status: 'won' }).eq('id', winningBid.id);

  // 6. Mark losing bids
  await db
    .from('a2a_auction_bids')
    .update({ status: 'lost' })
    .eq('auction_id', auction_id)
    .neq('id', winningBid.id)
    .eq('status', 'submitted');

  // 7. Create task for the winner
  const { data: task, error: taskErr } = await db
    .from('a2a_tasks')
    .insert({
      sender_agent_id: auctionData.requester_agent_id,
      target_agent_id: winningBid.bidder_agent_id,
      intent: auctionData.required_capability,
      priority: 'high',
      status: 'accepted',
      input: auctionData.task_input,
      ttl_seconds: Math.max(
        60,
        Math.floor((new Date(auctionData.completion_deadline).getTime() - Date.now()) / 1000),
      ),
    })
    .select('id')
    .single();

  if (taskErr || !task) {
    return { error: 'Failed to create task for winner', status_code: 500 };
  }

  // 8. Settle escrow: refund difference between max_price and winning price
  const refundAmount = auctionData.max_price - winningBid.price;
  if (refundAmount > 0) {
    await partialEscrowRefund(auctionData, refundAmount);
  }

  // 9. Update auction to awarded
  await db
    .from('a2a_auctions')
    .update({
      status: 'awarded',
      winning_bid_id: winningBid.id,
      task_id: task.id,
    })
    .eq('id', auction_id);

  return {
    auction_id,
    winning_bid_id: winningBid.id,
    winning_agent_id: winningBid.bidder_agent_id,
    winning_price: winningBid.price,
    task_id: task.id,
    status: 'awarded' as AuctionStatus,
  };
}

// ──────────────────────────────────────────────
// Cancel Auction
// ──────────────────────────────────────────────

export async function cancelAuction(
  auction_id: string,
  agent_id: string,
): Promise<
  | { auction_id: string; status: AuctionStatus; refund_tx_id?: string }
  | { error: string; status_code: number }
> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data: auction } = await db
    .from('a2a_auctions')
    .select('*')
    .eq('id', auction_id)
    .single();

  if (!auction) return { error: 'Auction not found', status_code: 404 };
  const auctionData = auction as TaskAuction;

  if (auctionData.requester_agent_id !== agent_id) {
    return { error: 'Only the auction requester can cancel', status_code: 403 };
  }

  if (auctionData.status !== 'open') {
    return { error: `Cannot cancel auction in status: ${auctionData.status}`, status_code: 409 };
  }

  // Mark all submitted bids as lost
  await db
    .from('a2a_auction_bids')
    .update({ status: 'lost' })
    .eq('auction_id', auction_id)
    .eq('status', 'submitted');

  // Refund escrow
  const refundTxId = await refundEscrow(auction_id, auctionData);

  await db.from('a2a_auctions').update({ status: 'cancelled' }).eq('id', auction_id);

  return {
    auction_id,
    status: 'cancelled' as AuctionStatus,
    refund_tx_id: refundTxId ?? undefined,
  };
}

// ──────────────────────────────────────────────
// Withdraw Bid
// ──────────────────────────────────────────────

export async function withdrawBid(
  auction_id: string,
  agent_id: string,
): Promise<{ success: boolean } | { error: string; status_code: number }> {
  const db = getServiceDb();
  if (!db) return { error: 'Service unavailable', status_code: 503 };

  const { data: bid } = await db
    .from('a2a_auction_bids')
    .select('id, status')
    .eq('auction_id', auction_id)
    .eq('bidder_agent_id', agent_id)
    .eq('status', 'submitted')
    .single();

  if (!bid) return { error: 'No active bid found to withdraw', status_code: 404 };

  await db.from('a2a_auction_bids').update({ status: 'withdrawn' }).eq('id', bid.id);

  // Decrement bid count
  const { data: auction } = await db
    .from('a2a_auctions')
    .select('bid_count')
    .eq('id', auction_id)
    .single();

  if (auction) {
    await db
      .from('a2a_auctions')
      .update({ bid_count: Math.max(0, (auction.bid_count ?? 1) - 1) })
      .eq('id', auction_id);
  }

  return { success: true };
}

// ──────────────────────────────────────────────
// Bid Evaluation Engine
// ──────────────────────────────────────────────

/**
 * Evaluate and rank bids using multi-criteria scoring.
 *
 * Each bid is scored on three axes:
 *   - Price: Lower is better (normalized against max price)
 *   - Reputation: Higher is better (uses snapshot from bid time)
 *   - Speed: Faster estimated completion is better (normalized against slowest bid)
 *
 * Returns bids sorted by composite score (highest first).
 */
export function evaluateBids(
  bids: AuctionBid[],
  weights: EvaluationWeights,
): AuctionBid[] {
  if (bids.length === 0) return [];

  // Find normalization bounds
  const maxPrice = Math.max(...bids.map((b) => b.price));
  const minPrice = Math.min(...bids.map((b) => b.price));
  const maxMinutes = Math.max(...bids.map((b) => b.estimated_minutes));
  const minMinutes = Math.min(...bids.map((b) => b.estimated_minutes));

  const priceRange = maxPrice - minPrice || 1;
  const minutesRange = maxMinutes - minMinutes || 1;

  const scored = bids.map((bid) => {
    // Price score: lower price = higher score (inverted, normalized 0-1)
    const priceScore = 1 - (bid.price - minPrice) / priceRange;

    // Reputation score: direct use (already 0-1)
    const reputationScore = bid.reputation_score_snapshot;

    // Speed score: lower estimated_minutes = higher score (inverted, normalized 0-1)
    const speedScore = 1 - (bid.estimated_minutes - minMinutes) / minutesRange;

    const composite =
      priceScore * weights.price +
      reputationScore * weights.reputation +
      speedScore * weights.speed;

    const breakdown: BidScoreBreakdown = {
      price_score: round(priceScore),
      reputation_score: round(reputationScore),
      speed_score: round(speedScore),
      composite: round(composite),
    };

    return {
      ...bid,
      evaluation_score: round(composite),
      score_breakdown: breakdown,
    };
  });

  return scored.sort((a, b) => (b.evaluation_score ?? 0) - (a.evaluation_score ?? 0));
}

/**
 * Compute the current price in a dutch auction.
 * Price starts at dutch_start_price and decreases by dutch_decrement_per_minute
 * for each minute since auction creation, floored at 0.
 */
export function computeDutchPrice(auction: TaskAuction): number {
  if (auction.auction_type !== 'dutch') return auction.max_price;
  if (!auction.dutch_start_price || !auction.dutch_decrement_per_minute) return auction.max_price;

  const elapsedMs = Date.now() - new Date(auction.created_at).getTime();
  const elapsedMinutes = elapsedMs / 60_000;
  const currentPrice = auction.dutch_start_price - elapsedMinutes * auction.dutch_decrement_per_minute;

  return Math.max(0, round(currentPrice));
}

// ──────────────────────────────────────────────
// Escrow Helpers
// ──────────────────────────────────────────────

/** Refund full escrow to the requester. */
async function refundEscrow(
  auction_id: string,
  auction: TaskAuction,
): Promise<string | null> {
  const db = getServiceDb();
  if (!db || !auction.escrow_tx_id) return null;

  // Mark original hold as released
  await db
    .from('a2a_ledger_transactions')
    .update({ status: 'reversed' })
    .eq('id', auction.escrow_tx_id);

  // Create refund transaction
  const wallet = await getOrCreateWallet(auction.requester_agent_id, auction.currency);
  if (!wallet) return null;

  const { data: refundTx } = await db
    .from('a2a_ledger_transactions')
    .insert({
      wallet_id: wallet.id,
      agent_id: auction.requester_agent_id,
      type: 'hold_release',
      amount: auction.max_price,
      currency: auction.currency,
      status: 'settled',
      description: `Escrow refund for auction ${auction_id.slice(0, 8)}`,
      reference_tx_id: auction.escrow_tx_id,
      settled_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  // Restore wallet balance
  await db
    .from('a2a_wallets')
    .update({
      balance: wallet.balance + auction.max_price,
      held_balance: Math.max(0, wallet.held_balance - auction.max_price),
    })
    .eq('id', wallet.id);

  return refundTx?.id ?? null;
}

/** Refund partial escrow (difference between max_price and winning price). */
async function partialEscrowRefund(auction: TaskAuction, refundAmount: number): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const wallet = await getOrCreateWallet(auction.requester_agent_id, auction.currency);
  if (!wallet) return;

  // Create partial refund transaction
  await db.from('a2a_ledger_transactions').insert({
    wallet_id: wallet.id,
    agent_id: auction.requester_agent_id,
    type: 'hold_release',
    amount: refundAmount,
    currency: auction.currency,
    status: 'settled',
    description: `Partial escrow refund (budget surplus)`,
    reference_tx_id: auction.escrow_tx_id,
    settled_at: new Date().toISOString(),
  });

  // Restore the refund amount to available balance
  await db
    .from('a2a_wallets')
    .update({
      balance: wallet.balance + refundAmount,
      held_balance: Math.max(0, wallet.held_balance - refundAmount),
    })
    .eq('id', wallet.id);
}

/** Release escrow hold (generic helper for rollbacks). */
async function releaseEscrow(
  db: ReturnType<typeof getServiceDb>,
  walletId: string,
  currentBalance: number,
  currentHeld: number,
  amount: number,
  txId: string,
): Promise<void> {
  if (!db) return;
  await db.from('a2a_ledger_transactions').update({ status: 'reversed' }).eq('id', txId);
  await db
    .from('a2a_wallets')
    .update({
      balance: currentBalance + amount,
      held_balance: Math.max(0, currentHeld - amount),
    })
    .eq('id', walletId);
}

// ──────────────────────────────────────────────
// Utils
// ──────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
