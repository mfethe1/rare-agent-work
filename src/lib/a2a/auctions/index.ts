// ── A2A Task Auction & Bidding System ──

export {
  createAuction,
  listAuctions,
  getAuctionDetail,
  placeBid,
  awardAuction,
  cancelAuction,
  withdrawBid,
  evaluateBids,
  computeDutchPrice,
} from './engine';

export {
  auctionCreateSchema,
  auctionListSchema,
  bidCreateSchema,
  auctionAwardSchema,
} from './validation';

export type {
  AuctionCreateInput,
  AuctionListInput,
  BidCreateInput,
  AuctionAwardInput,
} from './validation';

export type {
  AuctionType,
  AuctionStatus,
  TaskAuction,
  EvaluationWeights,
  BidStatus,
  AuctionBid,
  BidScoreBreakdown,
  AuctionCreateRequest,
  AuctionCreateResponse,
  AuctionListResponse,
  AuctionDetailResponse,
  BidCreateRequest,
  BidCreateResponse,
  AuctionAwardRequest,
  AuctionAwardResponse,
  AuctionCancelResponse,
} from './types';

export { DEFAULT_EVALUATION_WEIGHTS } from './types';
