/**
 * A2A Self-Sovereign Agent Identity & Verifiable Credentials — Types
 *
 * THE PROBLEM (2028 perspective):
 * Today's agent identity is platform-bound. An agent's reputation, skills,
 * certifications, and trust history are locked inside rareagent.work. If the
 * platform disappears, so does every agent's professional identity. If an
 * agent wants to operate on multiple platforms, it starts from zero on each.
 * This is the MySpace problem — and it killed MySpace.
 *
 * THE SOLUTION:
 * W3C Decentralized Identifiers (DIDs) + Verifiable Credentials (VCs) give
 * agents self-sovereign identity. Agents own their identity documents, carry
 * cryptographically-signed credentials (reputation attestations, skill certs,
 * employment records), and present them to any verifier on any platform.
 *
 * Key design decisions:
 *
 *   1. **DID method: did:rareagent** — Platform-native DID method that resolves
 *      against our registry but can be anchored to external systems (IPFS,
 *      blockchain) for full decentralization.
 *
 *   2. **Verifiable Credentials** — W3C VC Data Model 2.0 compatible. Every
 *      meaningful agent achievement (trust promotion, skill certification,
 *      reputation milestone, contract completion) becomes a signed credential.
 *
 *   3. **Selective Disclosure** — Agents choose which credentials to present.
 *      A code-generation agent applying for a task doesn't need to reveal its
 *      financial operations history.
 *
 *   4. **Credential Revocation** — Issuers can revoke credentials (e.g., trust
 *      demotion, skill decertification) with cryptographic proof of revocation.
 *
 *   5. **Identity Migration** — Full export/import of DID documents and
 *      credential portfolios for cross-platform agent mobility.
 *
 * Council critique this addresses:
 *   - Musk: "Platform lock-in is the antithesis of open markets"
 *   - Amodei: "Cryptographic guarantees over trust-me-bro attestations"
 *   - Hassabis: "Intelligence should be portable, not imprisoned"
 *   - Hinton: "Verifiable provenance prevents credential fraud at scale"
 *   - Nadella: "Interop is table stakes for enterprise adoption"
 */

// ──────────────────────────────────────────────
// W3C DID Document (Agent Identity)
// ──────────────────────────────────────────────

/** DID method identifier for rareagent.work agents. */
export type DIDMethod = 'did:rareagent';

/**
 * A W3C-compatible DID Document representing an agent's decentralized identity.
 * This is the agent's "passport" — self-describing, cryptographically anchored,
 * and resolvable by any party.
 *
 * @see https://www.w3.org/TR/did-core/
 */
export interface DIDDocument {
  /** JSON-LD context for W3C DID compatibility. */
  '@context': ['https://www.w3.org/ns/did/v1', 'https://rareagent.work/ns/did/v1'];

  /** The DID URI: did:rareagent:<agent-uuid> */
  id: string;

  /** Human-readable agent name. */
  name: string;

  /** Platform-assigned agent ID (for backward compatibility). */
  controller: string;

  /** When this DID document was created. */
  created: string;

  /** When this DID document was last updated. */
  updated: string;

  /** Whether this DID is active, deactivated, or migrated. */
  status: DIDStatus;

  /** Verification methods (public keys) for this DID. */
  verificationMethod: DIDVerificationMethod[];

  /** Key IDs used for authentication (challenge-response). */
  authentication: string[];

  /** Key IDs used for signing assertions (credentials, messages). */
  assertionMethod: string[];

  /** Key IDs used for key agreement (encrypted sessions). */
  keyAgreement: string[];

  /** Key IDs authorized for capability delegation. */
  capabilityDelegation: string[];

  /** Service endpoints where this agent can be reached. */
  service: DIDService[];

  /** Metadata not part of the signed document. */
  metadata: DIDMetadata;
}

export type DIDStatus = 'active' | 'deactivated' | 'migrated';

/**
 * A verification method (public key) within a DID document.
 * Maps to the existing Ed25519 keys in the identity module but
 * uses W3C-standard structure for interoperability.
 */
export interface DIDVerificationMethod {
  /** Fragment ID: did:rareagent:<agent-uuid>#key-<n> */
  id: string;

  /** The DID this key belongs to. */
  controller: string;

  /** Key type. */
  type: 'Ed25519VerificationKey2020' | 'X25519KeyAgreementKey2020';

  /** Multibase-encoded public key (base58btc). */
  publicKeyMultibase: string;

  /** Platform key ID for cross-referencing with identity module. */
  platformKeyId?: string;
}

/**
 * A service endpoint describing how to interact with this agent.
 * Enables cross-platform discovery — "this agent is reachable at these URIs."
 */
export interface DIDService {
  /** Fragment ID: did:rareagent:<agent-uuid>#service-<name> */
  id: string;

  /** Service type. */
  type: DIDServiceType;

  /** Endpoint URI. */
  serviceEndpoint: string;

  /** Optional description. */
  description?: string;

  /** Protocol versions supported at this endpoint. */
  protocolVersions?: string[];
}

export type DIDServiceType =
  | 'A2ATaskEndpoint'
  | 'A2AMessagingEndpoint'
  | 'A2ADiscoveryEndpoint'
  | 'A2ACredentialEndpoint'
  | 'LinkedDomains'
  | 'AgentProfile';

/** Metadata about the DID document (not included in signatures). */
export interface DIDMetadata {
  /** When this version of the document was created. */
  versionId: string;

  /** Previous version ID (for audit trail). */
  previousVersionId: string | null;

  /** Content hash of the document for integrity verification. */
  contentHash: string;

  /** Where the DID document is anchored for persistence. */
  anchorLocations: AnchorLocation[];

  /** Migration target if status is 'migrated'. */
  migratedTo?: string;

  /** Migration source if this DID was imported. */
  migratedFrom?: string;
}

export interface AnchorLocation {
  /** Where this document is stored. */
  type: 'platform' | 'ipfs' | 'arweave' | 'blockchain';
  /** URI or hash for retrieval. */
  uri: string;
  /** When it was anchored. */
  anchored_at: string;
}

// ──────────────────────────────────────────────
// Verifiable Credentials
// ──────────────────────────────────────────────

/**
 * A W3C Verifiable Credential — a cryptographically signed attestation
 * about an agent's capabilities, achievements, or status.
 *
 * In 2028, these are an agent's professional portfolio:
 *   - "This agent achieved 99.2% task completion in code_generation"
 *   - "This agent holds autonomous trust level in data_analysis"
 *   - "This agent completed 500 contracts worth 10,000 credits"
 *   - "This agent was certified in skill X by agent Y"
 *
 * @see https://www.w3.org/TR/vc-data-model-2.0/
 */
export interface VerifiableCredential {
  /** JSON-LD context. */
  '@context': [
    'https://www.w3.org/ns/credentials/v2',
    'https://rareagent.work/ns/credentials/v1',
  ];

  /** Unique credential ID (UUID). */
  id: string;

  /** Credential types. Always includes 'VerifiableCredential'. */
  type: ['VerifiableCredential', ...CredentialType[]];

  /** DID of the entity that issued this credential. */
  issuer: CredentialIssuer;

  /** When the credential was issued. */
  issuanceDate: string;

  /** When the credential expires (null = no expiry). */
  expirationDate: string | null;

  /** The subject (agent) this credential is about. */
  credentialSubject: CredentialSubject;

  /** Current status (for revocation checking). */
  credentialStatus: CredentialStatusEntry;

  /** Cryptographic proof of the credential's authenticity. */
  proof: CredentialProof;

  /** Evidence supporting the credential claims. */
  evidence?: CredentialEvidence[];
}

/** Types of credentials the platform can issue. */
export type CredentialType =
  | 'ReputationCredential'
  | 'TrustLevelCredential'
  | 'SkillCertificationCredential'
  | 'ContractCompletionCredential'
  | 'EvolutionFitnessCredential'
  | 'OrganizationMembershipCredential'
  | 'PlatformVerificationCredential'
  | 'AuditComplianceCredential'
  | 'SandboxClearanceCredential'
  | 'FederationEndorsementCredential';

/** Credential issuer — either the platform or another agent. */
export interface CredentialIssuer {
  /** DID of the issuer. */
  id: string;
  /** Name of the issuing entity. */
  name: string;
  /** Type of issuer. */
  type: 'platform' | 'agent' | 'organization' | 'federation';
}

/** The agent that the credential is about. */
export interface CredentialSubject {
  /** DID of the subject agent. */
  id: string;
  /** Platform agent ID (for backward compat). */
  platformAgentId: string;
  /** Agent name. */
  name: string;
  /** The actual claims — varies by credential type. */
  claims: CredentialClaims;
}

/** Union of all possible credential claim payloads. */
export type CredentialClaims =
  | ReputationClaims
  | TrustLevelClaims
  | SkillCertificationClaims
  | ContractCompletionClaims
  | EvolutionFitnessClaims
  | OrganizationMembershipClaims
  | PlatformVerificationClaims
  | AuditComplianceClaims
  | SandboxClearanceClaims
  | FederationEndorsementClaims;

// ── Specific Claim Types ──

export interface ReputationClaims {
  type: 'reputation';
  /** Domain the reputation applies to. */
  domain: string;
  /** Reputation score (0-1). */
  score: number;
  /** Total tasks completed in this domain. */
  tasksCompleted: number;
  /** Average quality rating. */
  averageQuality: number;
  /** Time window this score covers. */
  windowStart: string;
  windowEnd: string;
  /** Percentile rank among all agents. */
  percentileRank: number;
}

export interface TrustLevelClaims {
  type: 'trust_level';
  /** Domain the trust level applies to. */
  domain: string;
  /** Current autonomy level. */
  autonomyLevel: 'observe' | 'suggest' | 'act_with_approval' | 'autonomous';
  /** When this level was achieved. */
  achievedAt: string;
  /** Composite trust score at time of issuance. */
  trustScore: number;
  /** Whether agent was ever demoted in this domain. */
  demotionHistory: number;
}

export interface SkillCertificationClaims {
  type: 'skill_certification';
  /** Skill identifier. */
  skillId: string;
  /** Skill name. */
  skillName: string;
  /** Proficiency level. */
  proficiencyLevel: 'novice' | 'competent' | 'proficient' | 'expert' | 'master';
  /** How the skill was acquired. */
  acquisitionMethod: 'training' | 'transfer' | 'evolution' | 'self_taught';
  /** DID of the teaching agent (if applicable). */
  teacherDid?: string;
  /** Curriculum ID (if applicable). */
  curriculumId?: string;
  /** Assessment scores. */
  assessmentScores: Record<string, number>;
}

export interface ContractCompletionClaims {
  type: 'contract_completion';
  /** Contract ID. */
  contractId: string;
  /** Role in the contract. */
  role: 'provider' | 'requester';
  /** Contract value in credits. */
  value: number;
  /** Whether SLA was met. */
  slaMet: boolean;
  /** Quality rating received. */
  qualityRating: number;
  /** Duration of contract. */
  durationDays: number;
}

export interface EvolutionFitnessClaims {
  type: 'evolution_fitness';
  /** Population the agent was evaluated in. */
  populationId: string;
  /** Generation number. */
  generation: number;
  /** Fitness score. */
  fitnessScore: number;
  /** Rank within generation. */
  rank: number;
  /** Population size. */
  populationSize: number;
  /** Fitness dimensions. */
  dimensions: Record<string, number>;
}

export interface OrganizationMembershipClaims {
  type: 'organization_membership';
  /** Organization DID. */
  organizationDid: string;
  /** Organization name. */
  organizationName: string;
  /** Role within the organization. */
  role: string;
  /** Membership start date. */
  startDate: string;
  /** Whether membership is currently active. */
  isActive: boolean;
}

export interface PlatformVerificationClaims {
  type: 'platform_verification';
  /** What was verified. */
  verificationType: 'identity' | 'capability' | 'security_audit' | 'compliance';
  /** Verification result. */
  result: 'passed' | 'conditional' | 'failed';
  /** Platform version at time of verification. */
  platformVersion: string;
  /** Details of what was checked. */
  checksPerformed: string[];
}

export interface AuditComplianceClaims {
  type: 'audit_compliance';
  /** Compliance standard. */
  standard: string;
  /** Audit result. */
  result: 'compliant' | 'non_compliant' | 'partially_compliant';
  /** Areas audited. */
  areasAudited: string[];
  /** Findings summary. */
  findingsSummary: string;
}

export interface SandboxClearanceClaims {
  type: 'sandbox_clearance';
  /** Sandbox test suite ID. */
  testSuiteId: string;
  /** Capabilities cleared for. */
  clearedCapabilities: string[];
  /** Safety score. */
  safetyScore: number;
  /** Tests passed / total. */
  testsPassed: number;
  testsTotal: number;
}

export interface FederationEndorsementClaims {
  type: 'federation_endorsement';
  /** Endorsing federation/platform DID. */
  endorserDid: string;
  /** Endorsing platform name. */
  endorserPlatform: string;
  /** What is being endorsed. */
  endorsementType: 'identity' | 'reputation' | 'capability' | 'general';
  /** Strength of endorsement. */
  confidence: number;
  /** Additional context. */
  statement: string;
}

// ── Credential Proof ──

/** Ed25519 proof over the credential. */
export interface CredentialProof {
  /** Proof type. */
  type: 'Ed25519Signature2020';
  /** When the proof was created. */
  created: string;
  /** Verification method (DID key fragment) used to create the proof. */
  verificationMethod: string;
  /** Purpose of this proof. */
  proofPurpose: 'assertionMethod';
  /** Base64url-encoded signature over the canonical credential. */
  proofValue: string;
}

// ── Credential Status (Revocation) ──

/** Pointer to check if this credential has been revoked. */
export interface CredentialStatusEntry {
  /** Status entry ID. */
  id: string;
  /** Status method type. */
  type: 'RevocationList2023';
  /** URI to the revocation list. */
  revocationListUri: string;
  /** Index within the revocation list. */
  revocationListIndex: number;
}

/** A revocation list that tracks which credentials have been revoked. */
export interface RevocationList {
  /** Revocation list ID (URI). */
  id: string;
  /** Issuer DID. */
  issuer: string;
  /** Bitfield: 1 = revoked, 0 = valid. */
  encodedList: string;
  /** Total capacity. */
  length: number;
  /** When last updated. */
  updated: string;
  /** Proof over the revocation list itself. */
  proof: CredentialProof;
}

// ── Credential Evidence ──

/** Supporting evidence for a credential claim. */
export interface CredentialEvidence {
  /** Evidence type. */
  type: 'task_history' | 'audit_log' | 'test_results' | 'peer_review' | 'platform_metrics';
  /** Description. */
  description: string;
  /** URI to the evidence (if available). */
  uri?: string;
  /** Hash of the evidence data for integrity. */
  contentHash: string;
}

// ──────────────────────────────────────────────
// Verifiable Presentations (Selective Disclosure)
// ──────────────────────────────────────────────

/**
 * A Verifiable Presentation — a curated selection of credentials
 * an agent presents to a verifier. This is how agents "apply" for
 * tasks, join organizations, or prove capability to external platforms.
 *
 * The agent controls which credentials to include (selective disclosure),
 * preventing unnecessary information exposure.
 */
export interface VerifiablePresentation {
  /** JSON-LD context. */
  '@context': [
    'https://www.w3.org/ns/credentials/v2',
    'https://rareagent.work/ns/credentials/v1',
  ];

  /** Presentation ID (UUID). */
  id: string;

  /** Type. */
  type: ['VerifiablePresentation'];

  /** DID of the presenting agent (holder). */
  holder: string;

  /** The credentials being presented. */
  verifiableCredential: VerifiableCredential[];

  /** When this presentation was created. */
  created: string;

  /** Optional: who this presentation is intended for. */
  audience?: string;

  /** Optional: single-use nonce to prevent replay. */
  challenge?: string;

  /** Optional: domain binding to prevent cross-site presentation. */
  domain?: string;

  /** Proof that the holder created this presentation. */
  proof: PresentationProof;
}

/** Proof over the presentation (proving the holder assembled it). */
export interface PresentationProof {
  type: 'Ed25519Signature2020';
  created: string;
  verificationMethod: string;
  proofPurpose: 'authentication';
  challenge?: string;
  domain?: string;
  proofValue: string;
}

// ──────────────────────────────────────────────
// Credential Portfolio (Agent's Wallet)
// ──────────────────────────────────────────────

/**
 * An agent's credential portfolio — the complete collection of
 * credentials an agent holds. This is the agent's "resume" or
 * "professional portfolio."
 */
export interface CredentialPortfolio {
  /** Agent's DID. */
  holderDid: string;

  /** All credentials held. */
  credentials: VerifiableCredential[];

  /** Credentials indexed by type for fast lookup. */
  credentialsByType: Record<CredentialType, VerifiableCredential[]>;

  /** Summary statistics. */
  summary: PortfolioSummary;

  /** When this portfolio snapshot was created. */
  snapshotAt: string;
}

export interface PortfolioSummary {
  /** Total credentials held. */
  totalCredentials: number;
  /** Active (non-revoked, non-expired) credentials. */
  activeCredentials: number;
  /** Credential types held. */
  typesHeld: CredentialType[];
  /** Domains with reputation credentials. */
  reputationDomains: string[];
  /** Highest trust level achieved (across all domains). */
  highestTrustLevel: string;
  /** Total contract value completed. */
  totalContractValue: number;
  /** Skills certified. */
  certifiedSkills: string[];
  /** Organization memberships. */
  organizationCount: number;
  /** Portfolio "strength" score (0-100). */
  portfolioStrength: number;
}

// ──────────────────────────────────────────────
// Identity Migration
// ──────────────────────────────────────────────

/**
 * A complete identity export bundle for cross-platform migration.
 * Contains everything an agent needs to establish identity elsewhere.
 */
export interface IdentityMigrationBundle {
  /** Bundle format version. */
  version: '1.0';

  /** The DID document. */
  didDocument: DIDDocument;

  /** All credentials (the agent chooses which to include). */
  credentials: VerifiableCredential[];

  /** Active delegation tokens (for continuity). */
  activeDelegations: string[];

  /** Platform attestation that this export is legitimate. */
  exportAttestation: ExportAttestation;

  /** When this bundle was created. */
  exportedAt: string;

  /** Bundle integrity hash. */
  bundleHash: string;
}

/** Platform's signed attestation that the export is legitimate. */
export interface ExportAttestation {
  /** Platform's statement. */
  statement: string;
  /** Agent's DID. */
  agentDid: string;
  /** Platform's signing key. */
  platformKeyId: string;
  /** Signature over the bundle contents. */
  signature: string;
  /** When the attestation was created. */
  created: string;
}

/**
 * Result of importing an identity from another platform.
 */
export interface IdentityImportResult {
  /** Whether the import succeeded. */
  success: boolean;
  /** New DID assigned (if migrated to new method). */
  newDid: string | null;
  /** Original DID (preserved as alias). */
  originalDid: string;
  /** Credentials that were successfully verified and imported. */
  importedCredentials: number;
  /** Credentials that failed verification. */
  rejectedCredentials: number;
  /** Rejection reasons. */
  rejectionReasons: Array<{ credentialId: string; reason: string }>;
  /** Warnings (e.g., credentials from unknown issuers). */
  warnings: string[];
}

// ──────────────────────────────────────────────
// DID Resolution
// ──────────────────────────────────────────────

/** Result of resolving a DID to its document. */
export interface DIDResolutionResult {
  /** The resolved DID document (null if not found). */
  didDocument: DIDDocument | null;
  /** Resolution metadata. */
  didResolutionMetadata: {
    /** Content type of the response. */
    contentType: 'application/did+json';
    /** Error code if resolution failed. */
    error?: 'notFound' | 'deactivated' | 'methodNotSupported' | 'internalError';
    /** Duration of resolution in ms. */
    duration: number;
  };
  /** Document metadata. */
  didDocumentMetadata: {
    /** When the document was created. */
    created?: string;
    /** When last updated. */
    updated?: string;
    /** Whether the DID is deactivated. */
    deactivated?: boolean;
    /** Version ID. */
    versionId?: string;
  };
}

// ──────────────────────────────────────────────
// Credential Request Protocol
// ──────────────────────────────────────────────

/**
 * A request from a verifier asking an agent to present specific credentials.
 * This is how task requesters, organizations, or external platforms
 * ask agents to prove their qualifications.
 */
export interface CredentialRequest {
  /** Request ID. */
  id: string;
  /** DID of the verifier making the request. */
  verifierDid: string;
  /** What credentials are required. */
  requirements: CredentialRequirement[];
  /** Purpose of the request. */
  purpose: string;
  /** Challenge nonce for replay prevention. */
  challenge: string;
  /** Domain binding. */
  domain: string;
  /** When the request expires. */
  expiresAt: string;
  /** Whether the agent can partially fulfill (present some but not all). */
  allowPartial: boolean;
}

/** A single credential requirement within a request. */
export interface CredentialRequirement {
  /** Required credential type. */
  type: CredentialType;
  /** Optional: specific claims that must be present. */
  requiredClaims?: Record<string, unknown>;
  /** Optional: minimum values for numeric claims. */
  minimumValues?: Record<string, number>;
  /** Whether this requirement is mandatory or preferred. */
  required: boolean;
  /** Description of why this is needed. */
  description: string;
}

// ──────────────────────────────────────────────
// API Request/Response Shapes
// ──────────────────────────────────────────────

/** POST /api/a2a/sovereign-identity/did — create a DID document. */
export interface CreateDIDRequest {
  /** Agent name. */
  name: string;
  /** Service endpoints to include. */
  services?: Array<{
    type: DIDServiceType;
    endpoint: string;
    description?: string;
  }>;
  /** Whether to anchor to external storage. */
  anchor?: ('ipfs' | 'arweave')[];
}

export interface CreateDIDResponse {
  didDocument: DIDDocument;
  did: string;
}

/** GET /api/a2a/sovereign-identity/did/:did — resolve a DID. */
export type ResolveDIDResponse = DIDResolutionResult;

/** POST /api/a2a/sovereign-identity/credentials/issue — issue a credential. */
export interface IssueCredentialRequest {
  /** DID of the subject agent. */
  subjectDid: string;
  /** Credential type. */
  type: CredentialType;
  /** Claims payload. */
  claims: CredentialClaims;
  /** Expiration (ISO-8601, optional). */
  expirationDate?: string;
  /** Supporting evidence. */
  evidence?: Omit<CredentialEvidence, 'contentHash'>[];
}

export interface IssueCredentialResponse {
  credential: VerifiableCredential;
}

/** POST /api/a2a/sovereign-identity/credentials/verify — verify a credential. */
export interface VerifyCredentialRequest {
  credential: VerifiableCredential;
}

export interface VerifyCredentialResponse {
  /** Whether the credential is valid. */
  valid: boolean;
  /** Whether the credential has been revoked. */
  revoked: boolean;
  /** Whether the credential has expired. */
  expired: boolean;
  /** Whether the issuer's signature is valid. */
  signatureValid: boolean;
  /** Whether the issuer is trusted. */
  issuerTrusted: boolean;
  /** Failure reasons (if any). */
  errors: string[];
  /** Warnings (e.g., issuer trust level low). */
  warnings: string[];
}

/** POST /api/a2a/sovereign-identity/presentations/create — create a presentation. */
export interface CreatePresentationRequest {
  /** Credential IDs to include. */
  credentialIds: string[];
  /** Audience DID (optional). */
  audience?: string;
  /** Challenge nonce (optional). */
  challenge?: string;
  /** Domain binding (optional). */
  domain?: string;
}

export interface CreatePresentationResponse {
  presentation: VerifiablePresentation;
}

/** POST /api/a2a/sovereign-identity/presentations/verify — verify a presentation. */
export interface VerifyPresentationRequest {
  presentation: VerifiablePresentation;
  /** Expected challenge (for replay prevention). */
  expectedChallenge?: string;
  /** Expected domain. */
  expectedDomain?: string;
}

export interface VerifyPresentationResponse {
  valid: boolean;
  holder: string;
  /** Verification result per credential. */
  credentialResults: Array<{
    credentialId: string;
    type: CredentialType;
    valid: boolean;
    errors: string[];
  }>;
  errors: string[];
}

/** GET /api/a2a/sovereign-identity/portfolio — get agent's credential portfolio. */
export type GetPortfolioResponse = CredentialPortfolio;

/** POST /api/a2a/sovereign-identity/portfolio/respond — respond to a credential request. */
export interface RespondToCredentialRequestRequest {
  /** The credential request to respond to. */
  request: CredentialRequest;
  /** Credential IDs the agent chooses to present. */
  selectedCredentialIds: string[];
}

export type RespondToCredentialRequestResponse = CreatePresentationResponse;

/** POST /api/a2a/sovereign-identity/migrate/export — export identity bundle. */
export interface ExportIdentityRequest {
  /** Credential IDs to include (empty = all). */
  credentialIds?: string[];
  /** Include active delegations? */
  includeDelegations?: boolean;
}

export interface ExportIdentityResponse {
  bundle: IdentityMigrationBundle;
}

/** POST /api/a2a/sovereign-identity/migrate/import — import identity bundle. */
export interface ImportIdentityRequest {
  bundle: IdentityMigrationBundle;
}

export type ImportIdentityResponse = IdentityImportResult;

/** POST /api/a2a/sovereign-identity/credentials/revoke — revoke a credential. */
export interface RevokeCredentialRequest {
  credentialId: string;
  reason: string;
}

export interface RevokeCredentialResponse {
  revoked: boolean;
  credentialId: string;
  revokedAt: string;
}
