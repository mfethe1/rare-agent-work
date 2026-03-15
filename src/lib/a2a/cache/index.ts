export type {
  CacheKey,
  CacheEntry,
  CacheEntryStatus,
  CachePolicy,
  CacheStats,
  IntentCacheStats,
  CoalescedRequest,
  CoalescedRequestStatus,
  CacheLookupRequest,
  CacheLookupResponse,
  CacheInvalidateRequest,
  CacheInvalidateResponse,
  CachePolicyRequest,
  CachePolicyResponse,
  CachePolicyDeleteResponse,
  CacheStatsResponse,
  CacheWarmRequest,
  CacheWarmResponse,
} from './types';

export {
  computeCacheKey,
  resolveCachePolicy,
  getEffectiveCacheParams,
  lookupCache,
  storeInCache,
  checkInFlight,
  invalidateCache,
  upsertCachePolicy,
  deleteCachePolicy,
  listCachePolicies,
  getCacheStats,
  getIntentCacheStats,
  cleanupExpiredEntries,
} from './engine';
export type { CacheLookupResult, CacheStoreParams, InvalidationResult } from './engine';

export {
  cacheLookupSchema,
  cacheInvalidateSchema,
  cachePolicySchema,
  cachePolicyDeleteSchema,
  cacheStatsSchema,
  cacheWarmSchema,
} from './validation';
export type {
  CacheLookupInput,
  CacheInvalidateInput,
  CachePolicyInput,
  CachePolicyDeleteInput,
  CacheStatsInput,
  CacheWarmInput,
} from './validation';
