/**
 * A2A Self-Sovereign Agent Identity & Verifiable Credentials — Barrel Export
 *
 * Gives agents decentralized, portable identity via W3C DIDs and Verifiable
 * Credentials. Agents own their professional history — reputation, skills,
 * trust levels, contract completions — as cryptographically signed credentials
 * they carry across platforms.
 *
 * This is the "passport system" for the 2028 agent economy: agents are no
 * longer locked into a single platform. They take their identity, reputation,
 * and credentials wherever they go.
 */

// ── Types ──
export type {
  // DID
  DIDMethod,
  DIDDocument,
  DIDStatus,
  DIDVerificationMethod,
  DIDService,
  DIDServiceType,
  DIDMetadata,
  AnchorLocation,
  DIDResolutionResult,

  // Verifiable Credentials
  VerifiableCredential,
  CredentialType,
  CredentialIssuer,
  CredentialSubject,
  CredentialClaims,
  CredentialProof,
  CredentialStatusEntry,
  CredentialEvidence,
  RevocationList,
  ReputationClaims,
  TrustLevelClaims,
  SkillCertificationClaims,
  ContractCompletionClaims,
  EvolutionFitnessClaims,
  OrganizationMembershipClaims,
  PlatformVerificationClaims,
  AuditComplianceClaims,
  SandboxClearanceClaims,
  FederationEndorsementClaims,

  // Verifiable Presentations
  VerifiablePresentation,
  PresentationProof,

  // Portfolio
  CredentialPortfolio,
  PortfolioSummary,

  // Credential Requests
  CredentialRequest,
  CredentialRequirement,

  // Migration
  IdentityMigrationBundle,
  ExportAttestation,
  IdentityImportResult,

  // API shapes
  CreateDIDRequest,
  CreateDIDResponse,
  ResolveDIDResponse,
  IssueCredentialRequest,
  IssueCredentialResponse,
  VerifyCredentialRequest,
  VerifyCredentialResponse,
  CreatePresentationRequest,
  CreatePresentationResponse,
  VerifyPresentationRequest,
  VerifyPresentationResponse,
  GetPortfolioResponse,
  RespondToCredentialRequestRequest,
  RespondToCredentialRequestResponse,
  ExportIdentityRequest,
  ExportIdentityResponse,
  ImportIdentityRequest,
  ImportIdentityResponse,
  RevokeCredentialRequest,
  RevokeCredentialResponse,
} from './types';

// ── Engine ──
export {
  // DID Registry
  createDIDDocument,
  resolveDID,
  deactivateDID,
  addService,

  // Credential Issuance
  issueCredential,
  issueReputationCredential,
  issueTrustLevelCredential,

  // Credential Verification
  verifyCredential,

  // Presentations
  createPresentation,
  verifyPresentation,

  // Portfolio
  buildPortfolio,

  // Credential Requests
  createCredentialRequest,
  evaluateCredentialRequest,

  // Migration
  exportIdentity,
  importIdentity,

  // Revocation
  createRevocationList,
  revokeInList,
  isRevoked,
} from './engine';

// ── Validation Schemas ──
export {
  createDIDSchema,
  issueCredentialSchema,
  verifyCredentialSchema,
  createPresentationSchema,
  verifyPresentationSchema,
  credentialRequestSchema,
  respondToRequestSchema,
  exportIdentitySchema,
  importIdentitySchema,
  revokeCredentialSchema,
} from './validation';
export type {
  CreateDIDInput,
  IssueCredentialInput,
  VerifyCredentialInput,
  CreatePresentationInput,
  VerifyPresentationInput,
  CredentialRequestInput,
  RespondToRequestInput,
  ExportIdentityInput,
  ImportIdentityInput,
  RevokeCredentialInput,
} from './validation';
