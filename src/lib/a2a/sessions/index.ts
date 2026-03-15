/**
 * A2A Secure Sessions — Public API
 *
 * End-to-end encrypted communication channels between agents.
 * Builds on the Ed25519 identity layer to add confidentiality
 * via ECDH P-256 key agreement + AES-256-GCM encryption.
 */

// Types
export type {
  SessionStatus,
  SecureSession,
  EncryptedSessionMessage,
  SessionHandshake,
  SessionAcceptance,
  SessionEstablishRequest,
  SessionEstablishResponse,
  SessionAcceptRequest,
  SessionAcceptResponse,
  SessionSendRequest,
  SessionSendResponse,
  SessionStatusResponse,
  SessionTerminateRequest,
  SessionTerminateResponse,
} from './types';

// Crypto primitives
export {
  generateEphemeralKeyPair,
  importEphemeralPublicKey,
  isValidEphemeralPublicKey,
  deriveSessionKey,
  generateSalt,
  encryptMessage,
  decryptMessage,
  generateSequenceIV,
} from './crypto';

// Engine (DB-backed operations)
export {
  initiateSession,
  acceptSession,
  storeEncryptedMessage,
  getSessionStatus,
  listSessions,
  terminateSession,
} from './engine';

// Validation schemas
export {
  sessionEstablishSchema,
  sessionAcceptSchema,
  sessionSendSchema,
  sessionTerminateSchema,
  sessionListSchema,
} from './validation';

export type {
  SessionEstablishInput,
  SessionAcceptInput,
  SessionSendInput,
  SessionTerminateInput,
  SessionListInput,
} from './validation';
