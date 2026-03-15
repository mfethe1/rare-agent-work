// Agent Memory & Contextual Continuity — Public API
// Episodic memory, recall, consolidation, sharing, and session continuity

export type {
  MemoryBank,
  MemoryBankId,
  RetentionPolicy,
  Episode,
  EpisodeId,
  EpisodeType,
  EpisodeContext,
  Valence,
  RecallQuery,
  RecallWeights,
  RecalledEpisode,
  Consolidation,
  ConsolidationId,
  ConsolidationStrategy,
  ConsolidationStatus,
  MemoryShare,
  ShareId,
  ShareVisibility,
  ContinuitySession,
  ContinuitySessionId,
  // API types
  CreateBankRequest,
  CreateBankResponse,
  ListBanksResponse,
  RecordEpisodeRequest,
  RecordEpisodeResponse,
  RecallResponse,
  ConsolidateRequest,
  ConsolidateResponse,
  ShareEpisodeRequest,
  ShareEpisodeResponse,
  CreateContinuitySessionRequest,
  CreateContinuitySessionResponse,
  UpdateContinuitySessionRequest,
  UpdateContinuitySessionResponse,
  ResumeContinuitySessionResponse,
} from './types';

export {
  // Memory banks
  createBank,
  getBank,
  listBanks,
  deleteBank,
  // Episodes
  recordEpisode,
  getEpisode,
  listEpisodes,
  // Recall
  recall,
  // Consolidation
  consolidate,
  getConsolidation,
  listConsolidations,
  // Sharing
  shareEpisode,
  revokeShare,
  listShares,
  getSharedEpisodes,
  // Continuity sessions
  createContinuitySession,
  getContinuitySession,
  listContinuitySessions,
  updateContinuitySession,
  resumeContinuitySession,
  // Stats
  getMemoryStats,
} from './engine';
export type { MemoryStats } from './engine';

export {
  CreateBankSchema,
  RecordEpisodeSchema,
  RecallSchema,
  ConsolidateSchema,
  ShareEpisodeSchema,
  RevokeShareSchema,
  CreateContinuitySessionSchema,
  UpdateContinuitySessionSchema,
} from './validation';
