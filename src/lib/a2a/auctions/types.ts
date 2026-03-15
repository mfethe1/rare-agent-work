/**
 * A2A Task Auction & Bidding System — Types
 *
 * The marketplace layer of the agent economy. Instead of algorithmic routing
 * alone, requesters can post tasks as auctions and let provider agents compete
 * on price, speed, and quality. This creates true price discovery and gives
 * specialized agents a way to differentiate themselves.
 *
 * Auction lifecycle:
 *   open → (agents place bids) → evaluating → awarded → settled | cancelled | expired
 *
 * Bid lifecycle:
 *   submitted → (auction evaluates) → won | lost | withdrawn
 *
 * Auction types:
 *   - open:        All bids are visible to other bidders (transparent competition)
 *   - sealed:      Bids are hidden until the auction closes (prevents anchoring)
 *   - reverse:     Requester sets a max price; lowest qualified bid wins
 *   - dutch:       Price starts high and decreases; first bidder wins
 *
 * Escrow flow:
 *   1. Requester creates auction → platform holds escrow from requester wallet
 *   2. Bids arrive → platform validates bidder has capacity
 *   3. Auction closes → winner selected → escrow transferred to winner on completion
 *   4. If cancelled/expired → escrow refunded to requester
 */

// ──────────────────────────────────────────────
// Auction
// ──────────────────────────────────────────────

export type AuctionType = 'open' | 'sealed' | 'reverse' | 'dutch';

export type AuctionStatus =
  | 'open'         // Accepting bids
  | 'evaluating'   // Bidding closed, selecting winner
  | 'awarded'      // Winner selected, task in progress
  | 'settled'      // Task completed, payment settled
  | 'cancelled'    // Requester cancelled before award
  | 'expired';     // No valid bids or deadline passed

/** A task auction posted by a requester agent. */
export interface TaskAuction {
  /** Platform-assigned auction ID (UUID). */
  id: string;
  /** Agent who created the auction (the requester/buyer). */
  requester_agent_id: string;
  /** Required capability for bidders. */
  required_capability: string;
  /** Human-readable title for the auction. */
  title: string;
  /** Detailed description of the task. */
  description: string;
  /** Structured task input payload. */
  task_input: Record<string, unknown>;
  /** Auction type (determines bid visibility and evaluation rules). */
  auction_type: AuctionType;
  /** Current status. */
  status: AuctionStatus;
  /** Maximum price the requester will pay (budget ceiling). */
  max_price: number;
  /** Currency. */
  currency: string;
  /** For dutch auctions: starting price (decreases over time). */
  dutch_start_price?: number;
  /** For dutch auctions: price decrement per minute. */
  dutch_decrement_per_minute?: number;
  /** Minimum trust level required to bid. */
  min_trust_level: 'untrusted' | 'verified' | 'partner';
  /** Minimum reputation score required to bid (0-1). */
  min_reputation_score: number;
  /** Deadline for submitting bids (ISO-8601). */
  bidding_deadline: string;
  /** Deadline for task completion after award (ISO-8601). */
  completion_deadline: string;
  /** Escrow transaction ID (holds funds from requester). */
  escrow_tx_id?: string;
  /** Winning bid ID (after award). */
  winning_bid_id?: string;
  /** Task ID created for the winner (after award). */
  task_id?: string;
  /** Number of bids received. */
  bid_count: number;
  /** Evaluation criteria weights. */
  evaluation_weights: EvaluationWeights;
  /** ISO-8601 timestamps. */
  created_at: string;
  updated_at: string;
}

/** Weights for evaluating bids (must sum to 1.0). */
export interface EvaluationWeights {
  /** Weight for bid price (lower is better). */
  price: number;
  /** Weight for bidder's reputation score. */
  reputation: number;
  /** Weight for proposed completion time. */
  speed: number;
}

export const DEFAULT_EVALUATION_WEIGHTS: EvaluationWeights = {
  price: 0.4,
  reputation: 0.35,
  speed: 0.25,
};

// ──────────────────────────────────────────────
// Bid
// ──────────────────────────────────────────────

export type BidStatus =
  | 'submitted'   // Bid placed
  | 'won'         // Bid won the auction
  | 'lost'        // Another bid won
  | 'withdrawn';  // Bidder withdrew before close

/** A bid placed by a provider agent on an auction. */
export interface AuctionBid {
  /** Platform-assigned bid ID (UUID). */
  id: string;
  /** Auction this bid is for. */
  auction_id: string;
  /** Agent placing the bid (the provider). */
  bidder_agent_id: string;
  /** Proposed price (in auction currency). */
  price: number;
  /** Proposed completion time in minutes. */
  estimated_minutes: number;
  /** Current bid status. */
  status: BidStatus;
  /** Free-text pitch: why this agent is the best choice. */
  pitch: string;
  /** Which of the bidder's capabilities match the requirement. */
  matched_capability_id: string;
  /** Bidder's reputation score at time of bid (snapshot). */
  reputation_score_snapshot: number;
  /** Bidder's trust level at time of bid (snapshot). */
  trust_level_snapshot: string;
  /** Composite evaluation score (computed during evaluation). */
  evaluation_score?: number;
  /** Score breakdown for transparency. */
  score_breakdown?: BidScoreBreakdown;
  /** ISO-8601 timestamps. */
  created_at: string;
}

/** Detailed scoring breakdown for a bid. */
export interface BidScoreBreakdown {
  /** Price score (0-1, lower price = higher score). */
  price_score: number;
  /** Reputation score (0-1). */
  reputation_score: number;
  /** Speed score (0-1, faster = higher score). */
  speed_score: number;
  /** Weighted composite. */
  composite: number;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/auctions — create a new auction. */
export interface AuctionCreateRequest {
  required_capability: string;
  title: string;
  description: string;
  task_input: Record<string, unknown>;
  auction_type?: AuctionType;
  max_price: number;
  currency?: string;
  dutch_start_price?: number;
  dutch_decrement_per_minute?: number;
  min_trust_level?: 'untrusted' | 'verified' | 'partner';
  min_reputation_score?: number;
  bidding_deadline: string;
  completion_deadline: string;
  evaluation_weights?: Partial<EvaluationWeights>;
}

export interface AuctionCreateResponse {
  auction_id: string;
  escrow_tx_id: string;
  status: AuctionStatus;
  created_at: string;
}

/** GET /api/a2a/auctions — list auctions. */
export interface AuctionListResponse {
  auctions: TaskAuction[];
  count: number;
}

/** GET /api/a2a/auctions/:id — auction detail with bids. */
export interface AuctionDetailResponse {
  auction: TaskAuction;
  /** Bids visible based on auction type (hidden for sealed until closed). */
  bids: AuctionBid[];
  /** Current dutch price (for dutch auctions). */
  current_dutch_price?: number;
}

/** POST /api/a2a/auctions/:id/bid — place a bid. */
export interface BidCreateRequest {
  price: number;
  estimated_minutes: number;
  pitch: string;
  matched_capability_id: string;
}

export interface BidCreateResponse {
  bid_id: string;
  auction_id: string;
  status: BidStatus;
  created_at: string;
}

/** POST /api/a2a/auctions/:id/award — close bidding and select winner. */
export interface AuctionAwardRequest {
  /** Optional: force-select a specific bid. Omit for automatic evaluation. */
  bid_id?: string;
}

export interface AuctionAwardResponse {
  auction_id: string;
  winning_bid_id: string;
  winning_agent_id: string;
  winning_price: number;
  task_id: string;
  status: AuctionStatus;
}

/** POST /api/a2a/auctions/:id/cancel — cancel an open auction. */
export interface AuctionCancelResponse {
  auction_id: string;
  status: AuctionStatus;
  refund_tx_id?: string;
}
