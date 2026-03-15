/**
 * A2A Cryptographic Agent Identity — Barrel Export
 *
 * The trust foundation for the agent ecosystem. Enables agents to prove
 * identity via Ed25519 key pairs, sign messages for verifiable authenticity,
 * and create offline-verifiable delegation tokens.
 */

// ── Types ──
export type {
  SigningAlgorithm,
  AgentPublicKey,
  IdentityChallenge,
  ChallengeVerification,
  SignedEnvelope,
  EnvelopeSignature,
  EnvelopeVerification,
  SignedDelegationToken,
  DelegationTokenHeader,
  DelegationTokenClaims,
  IdentityProof,
  KeyRegisterRequest,
  KeyRegisterResponse,
  KeyListResponse,
  KeyRevokeRequest,
  KeyRevokeResponse,
  ChallengeRequest,
  ChallengeResponse,
  ChallengeVerifyRequest,
  ChallengeVerifyResponse,
  SignPayloadRequest,
  SignPayloadResponse,
  VerifyEnvelopeRequest,
  VerifyEnvelopeResponse,
  DelegationTokenRequest,
  DelegationTokenResponse,
  VerifyDelegationTokenRequest,
  VerifyDelegationTokenResponse,
  AgentKeysResponse,
} from './types';

// ── Crypto Primitives ──
export {
  base64urlEncode,
  base64urlDecode,
  base64urlEncodeJson,
  base64urlDecodeJson,
  generateKeyPair,
  importPublicKey,
  computeFingerprint,
  isValidPublicKey,
  signBytes,
  verifySignature,
  canonicalize,
  canonicalizeToString,
  createSignedEnvelope,
  verifyEnvelopeSignature,
  generateNonce,
  createDelegationToken,
  parseDelegationToken,
  verifyDelegationToken,
} from './crypto';

// ── Engine (DB-backed operations) ──
export {
  registerPublicKey,
  listPublicKeys,
  getPrimaryKey,
  getPublicKey,
  getKeyByFingerprint,
  revokePublicKey,
  issueChallenge,
  verifyChallenge,
  verifyEnvelope,
  verifyDelegationTokenWithTrust,
} from './engine';

// ── Validation Schemas ──
export {
  keyRegisterSchema,
  keyRevokeSchema,
  challengeRequestSchema,
  challengeVerifySchema,
  signPayloadSchema,
  verifyEnvelopeSchema,
  delegationTokenSchema,
  verifyDelegationTokenSchema,
} from './validation';
export type {
  KeyRegisterInput,
  KeyRevokeInput,
  ChallengeRequestInput,
  ChallengeVerifyInput,
  SignPayloadInput,
  VerifyEnvelopeInput,
  DelegationTokenInput,
  VerifyDelegationTokenInput,
} from './validation';
