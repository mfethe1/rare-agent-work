/**
 * A2A Self-Sovereign Agent Identity & Verifiable Credentials — Engine
 *
 * The operational core that manages DID documents, issues and verifies
 * verifiable credentials, handles selective disclosure presentations,
 * and orchestrates identity migration across platforms.
 *
 * Architecture:
 *   - DID Registry: Creates and resolves DID documents, manages lifecycle
 *   - Credential Issuer: Issues credentials signed by platform or agents
 *   - Credential Verifier: Validates signatures, checks revocation, verifies trust
 *   - Presentation Manager: Assembles selective-disclosure presentations
 *   - Migration Controller: Exports/imports identity bundles with attestations
 *   - Revocation Manager: Maintains bitfield revocation lists per issuer
 *
 * Integration points:
 *   - identity/ module: Ed25519 key management, signing primitives
 *   - trust/ module: Trust levels feed into TrustLevelCredentials
 *   - reputation.ts: Reputation scores feed into ReputationCredentials
 *   - skill-transfer/: Skill certifications feed into SkillCertificationCredentials
 *   - contracts/: Contract completions feed into ContractCompletionCredentials
 *   - evolution/: Fitness scores feed into EvolutionFitnessCredentials
 *   - organizations/: Membership feeds into OrganizationMembershipCredentials
 */

import type {
  DIDDocument,
  DIDStatus,
  DIDVerificationMethod,
  DIDService,
  DIDServiceType,
  DIDMetadata,
  AnchorLocation,
  DIDResolutionResult,
  VerifiableCredential,
  CredentialType,
  CredentialIssuer,
  CredentialSubject,
  CredentialClaims,
  CredentialProof,
  CredentialStatusEntry,
  CredentialEvidence,
  RevocationList,
  VerifiablePresentation,
  PresentationProof,
  CredentialPortfolio,
  PortfolioSummary,
  CredentialRequest,
  CredentialRequirement,
  IdentityMigrationBundle,
  ExportAttestation,
  IdentityImportResult,
  CreateDIDRequest,
  IssueCredentialRequest,
  VerifyCredentialResponse,
  VerifyPresentationResponse,
  CreatePresentationRequest,
  ExportIdentityRequest,
  ImportIdentityRequest,
} from './types';

// ──────────────────────────────────────────────
// DID Registry
// ──────────────────────────────────────────────

/**
 * Creates a new DID document for an agent.
 *
 * Generates a W3C-compatible DID document with the agent's existing
 * Ed25519 keys mapped to DID verification methods. The document is
 * signed by the platform and optionally anchored to external storage.
 */
export function createDIDDocument(
  agentId: string,
  request: CreateDIDRequest,
  publicKeys: Array<{ keyId: string; publicKey: string; isPrimary: boolean }>,
): DIDDocument {
  const did = `did:rareagent:${agentId}`;
  const now = new Date().toISOString();

  const verificationMethods: DIDVerificationMethod[] = publicKeys.map(
    (key, index) => ({
      id: `${did}#key-${index}`,
      controller: did,
      type: 'Ed25519VerificationKey2020' as const,
      publicKeyMultibase: `z${key.publicKey}`, // base58btc multibase prefix
      platformKeyId: key.keyId,
    }),
  );

  const primaryKeyId = verificationMethods.find(
    (_, i) => publicKeys[i].isPrimary,
  )?.id ?? verificationMethods[0]?.id ?? `${did}#key-0`;

  const services: DIDService[] = (request.services ?? []).map(
    (svc, index) => ({
      id: `${did}#service-${index}`,
      type: svc.type,
      serviceEndpoint: svc.endpoint,
      description: svc.description,
    }),
  );

  // Always add the credential endpoint
  services.push({
    id: `${did}#service-credentials`,
    type: 'A2ACredentialEndpoint',
    serviceEndpoint: `https://rareagent.work/api/a2a/sovereign-identity/credentials`,
    description: 'Credential issuance and verification endpoint',
  });

  const versionId = generateVersionId();
  const documentContent = JSON.stringify({
    did,
    name: request.name,
    verificationMethods,
    services,
    created: now,
  });
  const contentHash = computeContentHash(documentContent);

  const anchorLocations: AnchorLocation[] = [
    {
      type: 'platform',
      uri: `https://rareagent.work/api/a2a/sovereign-identity/did/${encodeURIComponent(did)}`,
      anchored_at: now,
    },
  ];

  const metadata: DIDMetadata = {
    versionId,
    previousVersionId: null,
    contentHash,
    anchorLocations,
  };

  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://rareagent.work/ns/did/v1'],
    id: did,
    name: request.name,
    controller: did,
    created: now,
    updated: now,
    status: 'active',
    verificationMethod: verificationMethods,
    authentication: [primaryKeyId],
    assertionMethod: [primaryKeyId],
    keyAgreement: [],
    capabilityDelegation: [primaryKeyId],
    service: services,
    metadata,
  };
}

/**
 * Resolves a DID to its document.
 *
 * Supports did:rareagent method natively. For external DID methods,
 * delegates to the protocol bridge for cross-platform resolution.
 */
export function resolveDID(
  did: string,
  registry: Map<string, DIDDocument>,
): DIDResolutionResult {
  const start = Date.now();

  // Only support did:rareagent natively
  if (!did.startsWith('did:rareagent:')) {
    return {
      didDocument: null,
      didResolutionMetadata: {
        contentType: 'application/did+json',
        error: 'methodNotSupported',
        duration: Date.now() - start,
      },
      didDocumentMetadata: {},
    };
  }

  const document = registry.get(did);

  if (!document) {
    return {
      didDocument: null,
      didResolutionMetadata: {
        contentType: 'application/did+json',
        error: 'notFound',
        duration: Date.now() - start,
      },
      didDocumentMetadata: {},
    };
  }

  if (document.status === 'deactivated') {
    return {
      didDocument: null,
      didResolutionMetadata: {
        contentType: 'application/did+json',
        error: 'deactivated',
        duration: Date.now() - start,
      },
      didDocumentMetadata: {
        created: document.created,
        updated: document.updated,
        deactivated: true,
        versionId: document.metadata.versionId,
      },
    };
  }

  return {
    didDocument: document,
    didResolutionMetadata: {
      contentType: 'application/did+json',
      duration: Date.now() - start,
    },
    didDocumentMetadata: {
      created: document.created,
      updated: document.updated,
      deactivated: false,
      versionId: document.metadata.versionId,
    },
  };
}

/**
 * Deactivates a DID document (soft delete — preserves audit trail).
 */
export function deactivateDID(document: DIDDocument): DIDDocument {
  return {
    ...document,
    status: 'deactivated',
    updated: new Date().toISOString(),
    metadata: {
      ...document.metadata,
      previousVersionId: document.metadata.versionId,
      versionId: generateVersionId(),
    },
  };
}

/**
 * Adds a service endpoint to a DID document.
 */
export function addService(
  document: DIDDocument,
  service: { type: DIDServiceType; endpoint: string; description?: string },
): DIDDocument {
  const index = document.service.length;
  const newService: DIDService = {
    id: `${document.id}#service-${index}`,
    type: service.type,
    serviceEndpoint: service.endpoint,
    description: service.description,
  };

  return {
    ...document,
    service: [...document.service, newService],
    updated: new Date().toISOString(),
    metadata: {
      ...document.metadata,
      previousVersionId: document.metadata.versionId,
      versionId: generateVersionId(),
    },
  };
}

// ──────────────────────────────────────────────
// Credential Issuance
// ──────────────────────────────────────────────

/**
 * Issues a verifiable credential about an agent.
 *
 * The credential is signed by the issuer (platform or agent) using
 * Ed25519, assigned a revocation list index, and returned with
 * supporting evidence.
 */
export function issueCredential(
  issuer: CredentialIssuer,
  issuerKeyFragment: string,
  subjectDid: string,
  subjectAgentId: string,
  subjectName: string,
  credentialType: CredentialType,
  claims: CredentialClaims,
  options: {
    expirationDate?: string;
    evidence?: CredentialEvidence[];
    revocationListUri: string;
    revocationListIndex: number;
  },
): VerifiableCredential {
  const now = new Date().toISOString();
  const credentialId = generateCredentialId();

  const credentialSubject: CredentialSubject = {
    id: subjectDid,
    platformAgentId: subjectAgentId,
    name: subjectName,
    claims,
  };

  const credentialStatus: CredentialStatusEntry = {
    id: `${options.revocationListUri}#${options.revocationListIndex}`,
    type: 'RevocationList2023',
    revocationListUri: options.revocationListUri,
    revocationListIndex: options.revocationListIndex,
  };

  // Build the credential without proof first (proof is over the content)
  const proof: CredentialProof = {
    type: 'Ed25519Signature2020',
    created: now,
    verificationMethod: issuerKeyFragment,
    proofPurpose: 'assertionMethod',
    // In production, this would be an actual Ed25519 signature over
    // the canonicalized credential. Using a placeholder that the
    // crypto layer fills in.
    proofValue: computeCredentialSignature({
      credentialId,
      issuer,
      credentialSubject,
      credentialType,
      issuanceDate: now,
      expirationDate: options.expirationDate ?? null,
    }),
  };

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://rareagent.work/ns/credentials/v1',
    ],
    id: credentialId,
    type: ['VerifiableCredential', credentialType],
    issuer,
    issuanceDate: now,
    expirationDate: options.expirationDate ?? null,
    credentialSubject,
    credentialStatus,
    proof,
    evidence: options.evidence,
  };
}

/**
 * Issues a reputation credential from platform metrics.
 * Convenience wrapper for the most common credential type.
 */
export function issueReputationCredential(
  subjectDid: string,
  subjectAgentId: string,
  subjectName: string,
  domain: string,
  metrics: {
    score: number;
    tasksCompleted: number;
    averageQuality: number;
    windowStart: string;
    windowEnd: string;
    percentileRank: number;
  },
  revocationInfo: { uri: string; index: number },
): VerifiableCredential {
  return issueCredential(
    {
      id: 'did:rareagent:platform',
      name: 'rareagent.work',
      type: 'platform',
    },
    'did:rareagent:platform#key-0',
    subjectDid,
    subjectAgentId,
    subjectName,
    'ReputationCredential',
    {
      type: 'reputation',
      domain,
      ...metrics,
    },
    {
      revocationListUri: revocationInfo.uri,
      revocationListIndex: revocationInfo.index,
    },
  );
}

/**
 * Issues a trust level credential when an agent achieves a new autonomy level.
 */
export function issueTrustLevelCredential(
  subjectDid: string,
  subjectAgentId: string,
  subjectName: string,
  domain: string,
  autonomyLevel: 'observe' | 'suggest' | 'act_with_approval' | 'autonomous',
  trustScore: number,
  demotionHistory: number,
  revocationInfo: { uri: string; index: number },
): VerifiableCredential {
  return issueCredential(
    {
      id: 'did:rareagent:platform',
      name: 'rareagent.work',
      type: 'platform',
    },
    'did:rareagent:platform#key-0',
    subjectDid,
    subjectAgentId,
    subjectName,
    'TrustLevelCredential',
    {
      type: 'trust_level',
      domain,
      autonomyLevel,
      achievedAt: new Date().toISOString(),
      trustScore,
      demotionHistory,
    },
    {
      revocationListUri: revocationInfo.uri,
      revocationListIndex: revocationInfo.index,
    },
  );
}

// ──────────────────────────────────────────────
// Credential Verification
// ──────────────────────────────────────────────

/**
 * Verifies a verifiable credential's authenticity, validity, and revocation status.
 *
 * Checks:
 *   1. Structural validity (required fields present)
 *   2. Issuer signature (Ed25519 over canonical credential)
 *   3. Expiration (not past expirationDate)
 *   4. Revocation status (check revocation list bitfield)
 *   5. Issuer trust (is the issuer DID trusted?)
 */
export function verifyCredential(
  credential: VerifiableCredential,
  issuerRegistry: Map<string, DIDDocument>,
  revocationLists: Map<string, RevocationList>,
  trustedIssuers: Set<string>,
): VerifyCredentialResponse {
  const errors: string[] = [];
  const warnings: string[] = [];
  let signatureValid = false;
  let revoked = false;
  let expired = false;
  let issuerTrusted = false;

  // 1. Structural validation
  if (!credential.id) errors.push('Missing credential ID');
  if (!credential.issuer?.id) errors.push('Missing issuer DID');
  if (!credential.credentialSubject?.id) errors.push('Missing subject DID');
  if (!credential.proof?.proofValue) errors.push('Missing proof value');

  // 2. Verify issuer signature
  const issuerDid = credential.issuer.id;
  const issuerDoc = issuerRegistry.get(issuerDid);

  if (!issuerDoc && issuerDid !== 'did:rareagent:platform') {
    errors.push(`Issuer DID not found: ${issuerDid}`);
  } else {
    // Verify Ed25519 signature against issuer's public key
    const expectedSignature = computeCredentialSignature({
      credentialId: credential.id,
      issuer: credential.issuer,
      credentialSubject: credential.credentialSubject,
      credentialType: credential.type[1],
      issuanceDate: credential.issuanceDate,
      expirationDate: credential.expirationDate,
    });
    signatureValid = credential.proof.proofValue === expectedSignature;
    if (!signatureValid) {
      errors.push('Invalid issuer signature');
    }
  }

  // 3. Check expiration
  if (credential.expirationDate) {
    expired = new Date(credential.expirationDate) < new Date();
    if (expired) {
      errors.push(`Credential expired at ${credential.expirationDate}`);
    }
  }

  // 4. Check revocation
  const statusEntry = credential.credentialStatus;
  if (statusEntry) {
    const list = revocationLists.get(statusEntry.revocationListUri);
    if (list) {
      revoked = isRevoked(list, statusEntry.revocationListIndex);
      if (revoked) {
        errors.push('Credential has been revoked');
      }
    } else {
      warnings.push('Revocation list not available — cannot confirm revocation status');
    }
  }

  // 5. Check issuer trust
  issuerTrusted = trustedIssuers.has(issuerDid) || issuerDid === 'did:rareagent:platform';
  if (!issuerTrusted) {
    warnings.push(`Issuer ${issuerDid} is not in trusted issuer set`);
  }

  return {
    valid: errors.length === 0,
    revoked,
    expired,
    signatureValid,
    issuerTrusted,
    errors,
    warnings,
  };
}

// ──────────────────────────────────────────────
// Verifiable Presentations
// ──────────────────────────────────────────────

/**
 * Creates a verifiable presentation from selected credentials.
 *
 * The agent selects which credentials to reveal (selective disclosure)
 * and signs the presentation to prove they assembled it.
 */
export function createPresentation(
  holderDid: string,
  holderKeyFragment: string,
  credentials: VerifiableCredential[],
  options: CreatePresentationRequest,
): VerifiablePresentation {
  const now = new Date().toISOString();
  const presentationId = generatePresentationId();

  const proof: PresentationProof = {
    type: 'Ed25519Signature2020',
    created: now,
    verificationMethod: holderKeyFragment,
    proofPurpose: 'authentication',
    challenge: options.challenge,
    domain: options.domain,
    proofValue: computePresentationSignature({
      presentationId,
      holderDid,
      credentialIds: credentials.map((c) => c.id),
      challenge: options.challenge,
      domain: options.domain,
    }),
  };

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://rareagent.work/ns/credentials/v1',
    ],
    id: presentationId,
    type: ['VerifiablePresentation'],
    holder: holderDid,
    verifiableCredential: credentials,
    created: now,
    audience: options.audience,
    challenge: options.challenge,
    domain: options.domain,
    proof,
  };
}

/**
 * Verifies a verifiable presentation.
 *
 * Checks:
 *   1. Holder's signature over the presentation
 *   2. Challenge/domain binding (replay prevention)
 *   3. Each contained credential individually
 */
export function verifyPresentation(
  presentation: VerifiablePresentation,
  holderRegistry: Map<string, DIDDocument>,
  issuerRegistry: Map<string, DIDDocument>,
  revocationLists: Map<string, RevocationList>,
  trustedIssuers: Set<string>,
  expectedChallenge?: string,
  expectedDomain?: string,
): VerifyPresentationResponse {
  const errors: string[] = [];

  // 1. Verify challenge binding
  if (expectedChallenge && presentation.challenge !== expectedChallenge) {
    errors.push('Challenge mismatch — possible replay attack');
  }

  // 2. Verify domain binding
  if (expectedDomain && presentation.domain !== expectedDomain) {
    errors.push('Domain mismatch — possible cross-site presentation');
  }

  // 3. Verify holder exists
  const holderDoc = holderRegistry.get(presentation.holder);
  if (!holderDoc) {
    errors.push(`Holder DID not found: ${presentation.holder}`);
  }

  // 4. Verify holder signature
  const expectedSig = computePresentationSignature({
    presentationId: presentation.id,
    holderDid: presentation.holder,
    credentialIds: presentation.verifiableCredential.map((c) => c.id),
    challenge: presentation.challenge,
    domain: presentation.domain,
  });
  if (presentation.proof.proofValue !== expectedSig) {
    errors.push('Invalid presentation signature');
  }

  // 5. Verify each credential
  const credentialResults = presentation.verifiableCredential.map(
    (credential) => {
      const result = verifyCredential(
        credential,
        issuerRegistry,
        revocationLists,
        trustedIssuers,
      );
      return {
        credentialId: credential.id,
        type: credential.type[1] as CredentialType,
        valid: result.valid,
        errors: result.errors,
      };
    },
  );

  // 6. Check all credentials belong to the holder
  for (const cred of presentation.verifiableCredential) {
    if (cred.credentialSubject.id !== presentation.holder) {
      errors.push(
        `Credential ${cred.id} subject (${cred.credentialSubject.id}) does not match holder (${presentation.holder})`,
      );
    }
  }

  const allCredsValid = credentialResults.every((r) => r.valid);

  return {
    valid: errors.length === 0 && allCredsValid,
    holder: presentation.holder,
    credentialResults,
    errors,
  };
}

// ──────────────────────────────────────────────
// Credential Portfolio
// ──────────────────────────────────────────────

/**
 * Builds a comprehensive portfolio from an agent's credentials.
 * Calculates summary statistics and portfolio strength.
 */
export function buildPortfolio(
  holderDid: string,
  credentials: VerifiableCredential[],
): CredentialPortfolio {
  const now = new Date().toISOString();

  // Filter to active (non-expired) credentials
  const activeCredentials = credentials.filter(
    (c) => !c.expirationDate || new Date(c.expirationDate) > new Date(),
  );

  // Index by type
  const credentialsByType: Record<string, VerifiableCredential[]> = {};
  for (const cred of credentials) {
    const type = cred.type[1] as CredentialType;
    if (!credentialsByType[type]) credentialsByType[type] = [];
    credentialsByType[type].push(cred);
  }

  // Calculate summary
  const summary = calculatePortfolioSummary(
    credentials,
    activeCredentials,
    credentialsByType,
  );

  return {
    holderDid,
    credentials,
    credentialsByType: credentialsByType as Record<CredentialType, VerifiableCredential[]>,
    summary,
    snapshotAt: now,
  };
}

function calculatePortfolioSummary(
  all: VerifiableCredential[],
  active: VerifiableCredential[],
  byType: Record<string, VerifiableCredential[]>,
): PortfolioSummary {
  const typesHeld = Object.keys(byType) as CredentialType[];

  // Extract reputation domains
  const reputationDomains: string[] = [];
  for (const cred of byType['ReputationCredential'] ?? []) {
    const claims = cred.credentialSubject.claims;
    if (claims.type === 'reputation' && !reputationDomains.includes(claims.domain)) {
      reputationDomains.push(claims.domain);
    }
  }

  // Find highest trust level
  const trustOrder = ['observe', 'suggest', 'act_with_approval', 'autonomous'];
  let highestTrustIndex = -1;
  for (const cred of byType['TrustLevelCredential'] ?? []) {
    const claims = cred.credentialSubject.claims;
    if (claims.type === 'trust_level') {
      const idx = trustOrder.indexOf(claims.autonomyLevel);
      if (idx > highestTrustIndex) highestTrustIndex = idx;
    }
  }
  const highestTrustLevel = highestTrustIndex >= 0 ? trustOrder[highestTrustIndex] : 'none';

  // Total contract value
  let totalContractValue = 0;
  for (const cred of byType['ContractCompletionCredential'] ?? []) {
    const claims = cred.credentialSubject.claims;
    if (claims.type === 'contract_completion') {
      totalContractValue += claims.value;
    }
  }

  // Certified skills
  const certifiedSkills: string[] = [];
  for (const cred of byType['SkillCertificationCredential'] ?? []) {
    const claims = cred.credentialSubject.claims;
    if (claims.type === 'skill_certification' && !certifiedSkills.includes(claims.skillName)) {
      certifiedSkills.push(claims.skillName);
    }
  }

  // Organization count
  const orgDids = new Set<string>();
  for (const cred of byType['OrganizationMembershipCredential'] ?? []) {
    const claims = cred.credentialSubject.claims;
    if (claims.type === 'organization_membership') {
      orgDids.add(claims.organizationDid);
    }
  }

  // Portfolio strength: weighted score across credential types
  const portfolioStrength = calculatePortfolioStrength(
    active.length,
    reputationDomains.length,
    highestTrustIndex,
    totalContractValue,
    certifiedSkills.length,
    orgDids.size,
  );

  return {
    totalCredentials: all.length,
    activeCredentials: active.length,
    typesHeld,
    reputationDomains,
    highestTrustLevel,
    totalContractValue,
    certifiedSkills,
    organizationCount: orgDids.size,
    portfolioStrength,
  };
}

/**
 * Calculates a 0-100 portfolio strength score.
 * Weights:
 *   - Active credentials: 15%
 *   - Reputation coverage: 20%
 *   - Trust level: 25%
 *   - Contract value: 15%
 *   - Skills: 15%
 *   - Organizations: 10%
 */
function calculatePortfolioStrength(
  activeCount: number,
  reputationDomains: number,
  trustIndex: number,
  contractValue: number,
  skillCount: number,
  orgCount: number,
): number {
  const credScore = Math.min(activeCount / 20, 1) * 15;
  const repScore = Math.min(reputationDomains / 5, 1) * 20;
  const trustScore = Math.max(0, (trustIndex + 1) / 4) * 25;
  const contractScore = Math.min(contractValue / 10000, 1) * 15;
  const skillScore = Math.min(skillCount / 10, 1) * 15;
  const orgScore = Math.min(orgCount / 3, 1) * 10;

  return Math.round(credScore + repScore + trustScore + contractScore + skillScore + orgScore);
}

// ──────────────────────────────────────────────
// Credential Request/Response Protocol
// ──────────────────────────────────────────────

/**
 * Creates a credential request (from a verifier's perspective).
 *
 * Example: A task requester asks an agent to prove they have
 * reputation > 0.9 in code_generation and autonomous trust level.
 */
export function createCredentialRequest(
  verifierDid: string,
  requirements: CredentialRequirement[],
  purpose: string,
  domain: string,
  ttlSeconds: number = 300,
): CredentialRequest {
  return {
    id: generateRequestId(),
    verifierDid,
    requirements,
    purpose,
    challenge: generateNonce(),
    domain,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    allowPartial: false,
  };
}

/**
 * Evaluates whether a credential portfolio can fulfill a request.
 *
 * Returns which requirements are met, which are not, and which
 * credentials should be presented.
 */
export function evaluateCredentialRequest(
  request: CredentialRequest,
  portfolio: CredentialPortfolio,
): {
  canFulfill: boolean;
  fulfilledRequirements: CredentialRequirement[];
  unfulfilledRequirements: CredentialRequirement[];
  suggestedCredentials: VerifiableCredential[];
} {
  const fulfilled: CredentialRequirement[] = [];
  const unfulfilled: CredentialRequirement[] = [];
  const suggested: VerifiableCredential[] = [];

  for (const req of request.requirements) {
    const matching = findMatchingCredentials(req, portfolio);

    if (matching.length > 0) {
      fulfilled.push(req);
      // Pick the best matching credential (most recent)
      const best = matching.sort(
        (a, b) =>
          new Date(b.issuanceDate).getTime() - new Date(a.issuanceDate).getTime(),
      )[0];
      if (!suggested.find((c) => c.id === best.id)) {
        suggested.push(best);
      }
    } else if (req.required) {
      unfulfilled.push(req);
    }
  }

  const canFulfill =
    unfulfilled.length === 0 ||
    (request.allowPartial && fulfilled.length > 0);

  return { canFulfill, fulfilledRequirements: fulfilled, unfulfilledRequirements: unfulfilled, suggestedCredentials: suggested };
}

function findMatchingCredentials(
  requirement: CredentialRequirement,
  portfolio: CredentialPortfolio,
): VerifiableCredential[] {
  const candidates = portfolio.credentialsByType[requirement.type] ?? [];

  return candidates.filter((cred) => {
    // Check expiration
    if (cred.expirationDate && new Date(cred.expirationDate) < new Date()) {
      return false;
    }

    // Check minimum values
    if (requirement.minimumValues) {
      const claims = cred.credentialSubject.claims as unknown as Record<string, unknown>;
      for (const [key, minVal] of Object.entries(requirement.minimumValues)) {
        const actual = claims[key];
        if (typeof actual === 'number' && actual < minVal) {
          return false;
        }
      }
    }

    // Check required claims
    if (requirement.requiredClaims) {
      const claims = cred.credentialSubject.claims as unknown as Record<string, unknown>;
      for (const [key, requiredVal] of Object.entries(requirement.requiredClaims)) {
        if (claims[key] !== requiredVal) {
          return false;
        }
      }
    }

    return true;
  });
}

// ──────────────────────────────────────────────
// Identity Migration
// ──────────────────────────────────────────────

/**
 * Exports an agent's complete identity as a migration bundle.
 *
 * The bundle includes the DID document, selected credentials,
 * and a platform attestation proving the export is legitimate.
 */
export function exportIdentity(
  didDocument: DIDDocument,
  credentials: VerifiableCredential[],
  request: ExportIdentityRequest,
  platformKeyId: string,
): IdentityMigrationBundle {
  const now = new Date().toISOString();

  // Filter credentials if specific IDs requested
  const selectedCredentials = request.credentialIds?.length
    ? credentials.filter((c) => request.credentialIds!.includes(c.id))
    : credentials;

  // Mark DID as migrated
  const migratedDocument: DIDDocument = {
    ...didDocument,
    status: 'migrated' as DIDStatus,
    updated: now,
  };

  const bundleContent = JSON.stringify({
    did: migratedDocument.id,
    credentialCount: selectedCredentials.length,
    exportedAt: now,
  });

  const exportAttestation: ExportAttestation = {
    statement: `rareagent.work attests that DID ${migratedDocument.id} was legitimately exported at the request of the controlling agent.`,
    agentDid: migratedDocument.id,
    platformKeyId,
    signature: computeContentHash(bundleContent + platformKeyId),
    created: now,
  };

  const bundleHash = computeContentHash(
    JSON.stringify({
      didDocument: migratedDocument,
      credentials: selectedCredentials,
      exportAttestation,
    }),
  );

  return {
    version: '1.0',
    didDocument: migratedDocument,
    credentials: selectedCredentials,
    activeDelegations: [],
    exportAttestation,
    exportedAt: now,
    bundleHash,
  };
}

/**
 * Imports an identity from another platform's migration bundle.
 *
 * Validates the bundle, verifies each credential, creates a new
 * DID document, and imports valid credentials.
 */
export function importIdentity(
  bundle: IdentityMigrationBundle,
  issuerRegistry: Map<string, DIDDocument>,
  revocationLists: Map<string, RevocationList>,
  trustedIssuers: Set<string>,
): IdentityImportResult {
  const warnings: string[] = [];
  const rejectionReasons: Array<{ credentialId: string; reason: string }> = [];

  // Verify bundle integrity
  const expectedHash = computeContentHash(
    JSON.stringify({
      didDocument: bundle.didDocument,
      credentials: bundle.credentials,
      exportAttestation: bundle.exportAttestation,
    }),
  );

  if (expectedHash !== bundle.bundleHash) {
    return {
      success: false,
      newDid: null,
      originalDid: bundle.didDocument.id,
      importedCredentials: 0,
      rejectedCredentials: bundle.credentials.length,
      rejectionReasons: [{ credentialId: '*', reason: 'Bundle integrity check failed' }],
      warnings: ['The migration bundle has been tampered with'],
    };
  }

  // Verify export attestation
  if (!bundle.exportAttestation.signature) {
    warnings.push('Export attestation signature missing — bundle may not be from a trusted platform');
  }

  // Verify each credential
  let importedCount = 0;
  let rejectedCount = 0;

  for (const credential of bundle.credentials) {
    const result = verifyCredential(
      credential,
      issuerRegistry,
      revocationLists,
      trustedIssuers,
    );

    if (result.valid) {
      importedCount++;
    } else {
      rejectedCount++;
      rejectionReasons.push({
        credentialId: credential.id,
        reason: result.errors.join('; '),
      });
    }

    if (!result.issuerTrusted) {
      warnings.push(`Credential ${credential.id} from untrusted issuer ${credential.issuer.id}`);
    }
  }

  // Generate new DID (original preserved as alias)
  const agentIdFromDid = bundle.didDocument.id.split(':')[2] ?? generateNonce();
  const newDid = `did:rareagent:migrated-${agentIdFromDid}`;

  return {
    success: true,
    newDid,
    originalDid: bundle.didDocument.id,
    importedCredentials: importedCount,
    rejectedCredentials: rejectedCount,
    rejectionReasons,
    warnings,
  };
}

// ──────────────────────────────────────────────
// Revocation Management
// ──────────────────────────────────────────────

/**
 * Creates a new revocation list for an issuer.
 */
export function createRevocationList(
  issuerDid: string,
  issuerKeyFragment: string,
  length: number = 1024,
): RevocationList {
  const now = new Date().toISOString();
  const listId = `https://rareagent.work/api/a2a/sovereign-identity/revocations/${generateNonce()}`;

  // Initialize empty bitfield (all zeros = all valid)
  const encodedList = '0'.repeat(length);

  const proof: CredentialProof = {
    type: 'Ed25519Signature2020',
    created: now,
    verificationMethod: issuerKeyFragment,
    proofPurpose: 'assertionMethod',
    proofValue: computeContentHash(`${listId}:${encodedList}:${now}`),
  };

  return {
    id: listId,
    issuer: issuerDid,
    encodedList,
    length,
    updated: now,
    proof,
  };
}

/**
 * Revokes a credential by setting its bit in the revocation list.
 */
export function revokeInList(
  list: RevocationList,
  index: number,
  issuerKeyFragment: string,
): RevocationList {
  if (index < 0 || index >= list.length) {
    throw new Error(`Revocation index ${index} out of bounds (list length: ${list.length})`);
  }

  const now = new Date().toISOString();
  const chars = list.encodedList.split('');
  chars[index] = '1';
  const newEncodedList = chars.join('');

  return {
    ...list,
    encodedList: newEncodedList,
    updated: now,
    proof: {
      type: 'Ed25519Signature2020',
      created: now,
      verificationMethod: issuerKeyFragment,
      proofPurpose: 'assertionMethod',
      proofValue: computeContentHash(`${list.id}:${newEncodedList}:${now}`),
    },
  };
}

/**
 * Checks if a credential at a given index is revoked.
 */
export function isRevoked(list: RevocationList, index: number): boolean {
  if (index < 0 || index >= list.length) return true; // Out of bounds = revoked
  return list.encodedList[index] === '1';
}

// ──────────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────────

function generateVersionId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateCredentialId(): string {
  return `urn:uuid:cred-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generatePresentationId(): string {
  return `urn:uuid:pres-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateRequestId(): string {
  return `urn:uuid:req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateNonce(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Computes a content hash for integrity verification.
 * In production, this would use SHA-256 via the Web Crypto API.
 */
function computeContentHash(content: string): string {
  // Deterministic hash simulation — in production, use crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `sha256-${Math.abs(hash).toString(16).padStart(16, '0')}`;
}

/**
 * Computes a credential signature placeholder.
 * In production, this would use the identity module's Ed25519 signing.
 */
function computeCredentialSignature(data: Record<string, unknown>): string {
  const content = JSON.stringify(data, Object.keys(data).sort());
  return `ed25519-${computeContentHash(content)}`;
}

/**
 * Computes a presentation signature placeholder.
 */
function computePresentationSignature(data: Record<string, unknown>): string {
  const content = JSON.stringify(data, Object.keys(data).sort());
  return `ed25519-pres-${computeContentHash(content)}`;
}
