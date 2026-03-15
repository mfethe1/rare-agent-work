/**
 * A2A Self-Sovereign Agent Identity & Verifiable Credentials — Validation
 *
 * Zod schemas for all API inputs. Ensures structural correctness before
 * any cryptographic or business logic executes.
 */

import { z } from 'zod';

// ──────────────────────────────────────────────
// Shared Enums & Primitives
// ──────────────────────────────────────────────

const didSchema = z.string().regex(/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/, 'Invalid DID format');

const credentialTypeSchema = z.enum([
  'ReputationCredential',
  'TrustLevelCredential',
  'SkillCertificationCredential',
  'ContractCompletionCredential',
  'EvolutionFitnessCredential',
  'OrganizationMembershipCredential',
  'PlatformVerificationCredential',
  'AuditComplianceCredential',
  'SandboxClearanceCredential',
  'FederationEndorsementCredential',
]);

const didServiceTypeSchema = z.enum([
  'A2ATaskEndpoint',
  'A2AMessagingEndpoint',
  'A2ADiscoveryEndpoint',
  'A2ACredentialEndpoint',
  'LinkedDomains',
  'AgentProfile',
]);

const iso8601Schema = z.string().datetime({ message: 'Must be ISO-8601 datetime' });

// ──────────────────────────────────────────────
// DID Operations
// ──────────────────────────────────────────────

/** POST /api/a2a/sovereign-identity/did */
export const createDIDSchema = z.object({
  name: z.string().min(1).max(255),
  services: z
    .array(
      z.object({
        type: didServiceTypeSchema,
        endpoint: z.string().url(),
        description: z.string().max(500).optional(),
      }),
    )
    .max(20)
    .optional(),
  anchor: z.array(z.enum(['ipfs', 'arweave'])).optional(),
});
export type CreateDIDInput = z.infer<typeof createDIDSchema>;

// ──────────────────────────────────────────────
// Credential Issuance
// ──────────────────────────────────────────────

/** Reputation claims validation */
const reputationClaimsSchema = z.object({
  type: z.literal('reputation'),
  domain: z.string().min(1).max(100),
  score: z.number().min(0).max(1),
  tasksCompleted: z.number().int().min(0),
  averageQuality: z.number().min(0).max(5),
  windowStart: iso8601Schema,
  windowEnd: iso8601Schema,
  percentileRank: z.number().min(0).max(100),
});

/** Trust level claims validation */
const trustLevelClaimsSchema = z.object({
  type: z.literal('trust_level'),
  domain: z.string().min(1).max(100),
  autonomyLevel: z.enum(['observe', 'suggest', 'act_with_approval', 'autonomous']),
  achievedAt: iso8601Schema,
  trustScore: z.number().min(0).max(1),
  demotionHistory: z.number().int().min(0),
});

/** Skill certification claims validation */
const skillCertificationClaimsSchema = z.object({
  type: z.literal('skill_certification'),
  skillId: z.string().min(1),
  skillName: z.string().min(1).max(255),
  proficiencyLevel: z.enum(['novice', 'competent', 'proficient', 'expert', 'master']),
  acquisitionMethod: z.enum(['training', 'transfer', 'evolution', 'self_taught']),
  teacherDid: didSchema.optional(),
  curriculumId: z.string().optional(),
  assessmentScores: z.record(z.string(), z.number()),
});

/** Contract completion claims validation */
const contractCompletionClaimsSchema = z.object({
  type: z.literal('contract_completion'),
  contractId: z.string().min(1),
  role: z.enum(['provider', 'requester']),
  value: z.number().min(0),
  slaMet: z.boolean(),
  qualityRating: z.number().min(0).max(5),
  durationDays: z.number().min(0),
});

/** Evolution fitness claims validation */
const evolutionFitnessClaimsSchema = z.object({
  type: z.literal('evolution_fitness'),
  populationId: z.string().min(1),
  generation: z.number().int().min(0),
  fitnessScore: z.number().min(0).max(1),
  rank: z.number().int().min(1),
  populationSize: z.number().int().min(1),
  dimensions: z.record(z.string(), z.number()),
});

/** Organization membership claims validation */
const organizationMembershipClaimsSchema = z.object({
  type: z.literal('organization_membership'),
  organizationDid: didSchema,
  organizationName: z.string().min(1).max(255),
  role: z.string().min(1).max(100),
  startDate: iso8601Schema,
  isActive: z.boolean(),
});

/** Platform verification claims validation */
const platformVerificationClaimsSchema = z.object({
  type: z.literal('platform_verification'),
  verificationType: z.enum(['identity', 'capability', 'security_audit', 'compliance']),
  result: z.enum(['passed', 'conditional', 'failed']),
  platformVersion: z.string().min(1),
  checksPerformed: z.array(z.string()),
});

/** Audit compliance claims validation */
const auditComplianceClaimsSchema = z.object({
  type: z.literal('audit_compliance'),
  standard: z.string().min(1),
  result: z.enum(['compliant', 'non_compliant', 'partially_compliant']),
  areasAudited: z.array(z.string()),
  findingsSummary: z.string().max(2000),
});

/** Sandbox clearance claims validation */
const sandboxClearanceClaimsSchema = z.object({
  type: z.literal('sandbox_clearance'),
  testSuiteId: z.string().min(1),
  clearedCapabilities: z.array(z.string()),
  safetyScore: z.number().min(0).max(1),
  testsPassed: z.number().int().min(0),
  testsTotal: z.number().int().min(1),
});

/** Federation endorsement claims validation */
const federationEndorsementClaimsSchema = z.object({
  type: z.literal('federation_endorsement'),
  endorserDid: didSchema,
  endorserPlatform: z.string().min(1).max(255),
  endorsementType: z.enum(['identity', 'reputation', 'capability', 'general']),
  confidence: z.number().min(0).max(1),
  statement: z.string().max(2000),
});

/** Union of all claim types */
const credentialClaimsSchema = z.discriminatedUnion('type', [
  reputationClaimsSchema,
  trustLevelClaimsSchema,
  skillCertificationClaimsSchema,
  contractCompletionClaimsSchema,
  evolutionFitnessClaimsSchema,
  organizationMembershipClaimsSchema,
  platformVerificationClaimsSchema,
  auditComplianceClaimsSchema,
  sandboxClearanceClaimsSchema,
  federationEndorsementClaimsSchema,
]);

/** Evidence entry validation */
const evidenceSchema = z.object({
  type: z.enum(['task_history', 'audit_log', 'test_results', 'peer_review', 'platform_metrics']),
  description: z.string().max(1000),
  uri: z.string().url().optional(),
});

/** POST /api/a2a/sovereign-identity/credentials/issue */
export const issueCredentialSchema = z.object({
  subjectDid: didSchema,
  type: credentialTypeSchema,
  claims: credentialClaimsSchema,
  expirationDate: iso8601Schema.optional(),
  evidence: z.array(evidenceSchema).max(10).optional(),
});
export type IssueCredentialInput = z.infer<typeof issueCredentialSchema>;

// ──────────────────────────────────────────────
// Credential Verification
// ──────────────────────────────────────────────

/** Credential proof schema for verification input */
const credentialProofSchema = z.object({
  type: z.literal('Ed25519Signature2020'),
  created: iso8601Schema,
  verificationMethod: z.string().min(1),
  proofPurpose: z.literal('assertionMethod'),
  proofValue: z.string().min(1),
});

/** POST /api/a2a/sovereign-identity/credentials/verify */
export const verifyCredentialSchema = z.object({
  credential: z.object({
    '@context': z.tuple([
      z.literal('https://www.w3.org/ns/credentials/v2'),
      z.literal('https://rareagent.work/ns/credentials/v1'),
    ]),
    id: z.string().min(1),
    type: z.tuple([z.literal('VerifiableCredential'), credentialTypeSchema]),
    issuer: z.object({
      id: didSchema,
      name: z.string().min(1),
      type: z.enum(['platform', 'agent', 'organization', 'federation']),
    }),
    issuanceDate: iso8601Schema,
    expirationDate: iso8601Schema.nullable(),
    credentialSubject: z.object({
      id: didSchema,
      platformAgentId: z.string().min(1),
      name: z.string().min(1),
      claims: credentialClaimsSchema,
    }),
    credentialStatus: z.object({
      id: z.string().min(1),
      type: z.literal('RevocationList2023'),
      revocationListUri: z.string().min(1),
      revocationListIndex: z.number().int().min(0),
    }),
    proof: credentialProofSchema,
    evidence: z.array(z.object({
      type: z.enum(['task_history', 'audit_log', 'test_results', 'peer_review', 'platform_metrics']),
      description: z.string(),
      uri: z.string().optional(),
      contentHash: z.string(),
    })).optional(),
  }),
});
export type VerifyCredentialInput = z.infer<typeof verifyCredentialSchema>;

// ──────────────────────────────────────────────
// Presentations
// ──────────────────────────────────────────────

/** POST /api/a2a/sovereign-identity/presentations/create */
export const createPresentationSchema = z.object({
  credentialIds: z.array(z.string().min(1)).min(1).max(50),
  audience: didSchema.optional(),
  challenge: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
});
export type CreatePresentationInput = z.infer<typeof createPresentationSchema>;

/** POST /api/a2a/sovereign-identity/presentations/verify */
export const verifyPresentationSchema = z.object({
  presentation: z.object({
    '@context': z.tuple([
      z.literal('https://www.w3.org/ns/credentials/v2'),
      z.literal('https://rareagent.work/ns/credentials/v1'),
    ]),
    id: z.string().min(1),
    type: z.tuple([z.literal('VerifiablePresentation')]),
    holder: didSchema,
    verifiableCredential: z.array(z.any()).min(1),
    created: iso8601Schema,
    audience: didSchema.optional(),
    challenge: z.string().optional(),
    domain: z.string().optional(),
    proof: z.object({
      type: z.literal('Ed25519Signature2020'),
      created: iso8601Schema,
      verificationMethod: z.string().min(1),
      proofPurpose: z.literal('authentication'),
      challenge: z.string().optional(),
      domain: z.string().optional(),
      proofValue: z.string().min(1),
    }),
  }),
  expectedChallenge: z.string().optional(),
  expectedDomain: z.string().optional(),
});
export type VerifyPresentationInput = z.infer<typeof verifyPresentationSchema>;

// ──────────────────────────────────────────────
// Credential Requests
// ──────────────────────────────────────────────

/** Credential requirement schema */
const credentialRequirementSchema = z.object({
  type: credentialTypeSchema,
  requiredClaims: z.record(z.string(), z.unknown()).optional(),
  minimumValues: z.record(z.string(), z.number()).optional(),
  required: z.boolean(),
  description: z.string().max(500),
});

/** POST /api/a2a/sovereign-identity/credentials/request */
export const credentialRequestSchema = z.object({
  requirements: z.array(credentialRequirementSchema).min(1).max(20),
  purpose: z.string().min(1).max(500),
  domain: z.string().min(1),
  ttlSeconds: z.number().int().min(30).max(86400).optional(),
  allowPartial: z.boolean().optional(),
});
export type CredentialRequestInput = z.infer<typeof credentialRequestSchema>;

/** POST /api/a2a/sovereign-identity/portfolio/respond */
export const respondToRequestSchema = z.object({
  request: z.object({
    id: z.string().min(1),
    verifierDid: didSchema,
    requirements: z.array(credentialRequirementSchema),
    purpose: z.string(),
    challenge: z.string(),
    domain: z.string(),
    expiresAt: iso8601Schema,
    allowPartial: z.boolean(),
  }),
  selectedCredentialIds: z.array(z.string().min(1)).min(1).max(50),
});
export type RespondToRequestInput = z.infer<typeof respondToRequestSchema>;

// ──────────────────────────────────────────────
// Migration
// ──────────────────────────────────────────────

/** POST /api/a2a/sovereign-identity/migrate/export */
export const exportIdentitySchema = z.object({
  credentialIds: z.array(z.string().min(1)).optional(),
  includeDelegations: z.boolean().optional(),
});
export type ExportIdentityInput = z.infer<typeof exportIdentitySchema>;

/** POST /api/a2a/sovereign-identity/migrate/import */
export const importIdentitySchema = z.object({
  bundle: z.object({
    version: z.literal('1.0'),
    didDocument: z.object({
      '@context': z.array(z.string()),
      id: z.string().min(1),
      name: z.string(),
      controller: z.string(),
      created: iso8601Schema,
      updated: iso8601Schema,
      status: z.enum(['active', 'deactivated', 'migrated']),
      verificationMethod: z.array(z.any()),
      authentication: z.array(z.string()),
      assertionMethod: z.array(z.string()),
      keyAgreement: z.array(z.string()),
      capabilityDelegation: z.array(z.string()),
      service: z.array(z.any()),
      metadata: z.any(),
    }),
    credentials: z.array(z.any()),
    activeDelegations: z.array(z.string()),
    exportAttestation: z.object({
      statement: z.string(),
      agentDid: z.string(),
      platformKeyId: z.string(),
      signature: z.string(),
      created: iso8601Schema,
    }),
    exportedAt: iso8601Schema,
    bundleHash: z.string().min(1),
  }),
});
export type ImportIdentityInput = z.infer<typeof importIdentitySchema>;

// ──────────────────────────────────────────────
// Revocation
// ──────────────────────────────────────────────

/** POST /api/a2a/sovereign-identity/credentials/revoke */
export const revokeCredentialSchema = z.object({
  credentialId: z.string().min(1),
  reason: z.string().min(1).max(500),
});
export type RevokeCredentialInput = z.infer<typeof revokeCredentialSchema>;
