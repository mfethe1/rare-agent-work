/**
 * A2A Agent Genome — Portable Agent Specification Engine
 *
 * Core engine for creating, registering, validating, diffing, and
 * instantiating agent genomes — the universal container format for
 * autonomous agents.
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type {
  AgentGenome,
  GenomeHash,
  GenomeRegistryEntry,
  GenomeDiff,
  GenomeDiffSummary,
  GenomeMutation,
  PreFlightVerification,
  PreFlightCheck,
  InstantiationResult,
  InstantiationRequest,
  GenomeValidationError,
  GenomeValidationWarning,
  SearchGenomesRequest,
  GetLineageRequest,
  GetLineageResponse,
  FitnessMetrics,
  ResourceProfile,
  CapabilityGene,
  ConstitutionalConstraint,
} from './types';

// ─── Error Type ─────────────────────────────────────────────────────────────

export class GenomeError extends Error {
  constructor(
    message: string,
    public code: GenomeErrorCode,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'GenomeError';
  }
}

export type GenomeErrorCode =
  | 'GENOME_NOT_FOUND'
  | 'GENOME_ALREADY_EXISTS'
  | 'GENOME_INVALID'
  | 'GENOME_DEPRECATED'
  | 'SIGNATURE_INVALID'
  | 'SIGNATURE_NOT_FOUND'
  | 'LINEAGE_NOT_FOUND'
  | 'INSTANTIATION_FAILED'
  | 'PREFLIGHT_FAILED'
  | 'RESOURCE_EXCEEDED'
  | 'CAPABILITY_CONFLICT'
  | 'CONSTITUTION_VIOLATION'
  | 'HASH_MISMATCH';

// ─── In-Memory Registry ─────────────────────────────────────────────────────

const genomeRegistry = new Map<GenomeHash, GenomeRegistryEntry>();
const lineageIndex = new Map<string, GenomeHash[]>(); // lineageId -> sorted hashes
const tagIndex = new Map<string, Set<GenomeHash>>(); // tag -> genome hashes

/** Reset all state (for testing) */
export function _resetGenomeRegistry(): void {
  genomeRegistry.clear();
  lineageIndex.clear();
  tagIndex.clear();
}

// ─── Genome Hashing ─────────────────────────────────────────────────────────

/**
 * Recursively sort all object keys for canonical JSON serialization.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Compute the content-addressable hash of a genome.
 * Uses canonical JSON serialization (recursively sorted keys) + SHA-256.
 */
export function computeGenomeHash(genome: AgentGenome): GenomeHash {
  const { identity, signatures, ...content } = genome;
  // Hash everything except the hash field itself and signatures
  const { hash: _hash, ...identityWithoutHash } = identity;
  const toHash = canonicalize({ identity: identityWithoutHash, ...content });
  const canonical = JSON.stringify(toHash);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify that a genome's stored hash matches its content.
 */
export function verifyGenomeIntegrity(genome: AgentGenome): boolean {
  const computed = computeGenomeHash(genome);
  return computed === genome.identity.hash;
}

// ─── Genome Registration ────────────────────────────────────────────────────

/**
 * Register a genome in the registry.
 */
export function registerGenome(genome: AgentGenome): GenomeRegistryEntry {
  const hash = genome.identity.hash;

  if (genomeRegistry.has(hash)) {
    throw new GenomeError(
      `Genome ${hash} already registered`,
      'GENOME_ALREADY_EXISTS',
      { hash },
    );
  }

  // Verify hash integrity
  const computedHash = computeGenomeHash(genome);
  if (computedHash !== hash) {
    throw new GenomeError(
      `Hash mismatch: stored=${hash}, computed=${computedHash}`,
      'HASH_MISMATCH',
      { stored: hash, computed: computedHash },
    );
  }

  const entry: GenomeRegistryEntry = {
    genome,
    registeredAt: new Date().toISOString(),
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    verificationStatus: genome.signatures.length > 0 ? 'signature_valid' : 'unverified',
    activeInstances: 0,
  };

  genomeRegistry.set(hash, entry);

  // Update lineage index
  const lineageId = genome.identity.lineageId;
  if (!lineageIndex.has(lineageId)) {
    lineageIndex.set(lineageId, []);
  }
  lineageIndex.get(lineageId)!.push(hash);

  // Update tag index
  for (const tag of genome.identity.tags) {
    if (!tagIndex.has(tag)) {
      tagIndex.set(tag, new Set());
    }
    tagIndex.get(tag)!.add(hash);
  }

  return entry;
}

// ─── Genome Retrieval ───────────────────────────────────────────────────────

/**
 * Get a genome by hash.
 */
export function getGenome(hash: GenomeHash): GenomeRegistryEntry {
  const entry = genomeRegistry.get(hash);
  if (!entry) {
    throw new GenomeError(
      `Genome ${hash} not found`,
      'GENOME_NOT_FOUND',
      { hash },
    );
  }
  return entry;
}

/**
 * Get the latest genome for a lineage.
 */
export function getLatestGenome(lineageId: string): GenomeRegistryEntry {
  const hashes = lineageIndex.get(lineageId);
  if (!hashes || hashes.length === 0) {
    throw new GenomeError(
      `No genomes found for lineage ${lineageId}`,
      'LINEAGE_NOT_FOUND',
      { lineageId },
    );
  }

  // Find the one with highest generation
  let latest: GenomeRegistryEntry | null = null;
  let maxGen = -1;
  for (const hash of hashes) {
    const entry = genomeRegistry.get(hash)!;
    if (entry.genome.identity.generation > maxGen) {
      maxGen = entry.genome.identity.generation;
      latest = entry;
    }
  }

  return latest!;
}

/**
 * Get a genome by lineage and version.
 */
export function getGenomeByVersion(lineageId: string, version: string): GenomeRegistryEntry {
  const hashes = lineageIndex.get(lineageId);
  if (!hashes || hashes.length === 0) {
    throw new GenomeError(
      `No genomes found for lineage ${lineageId}`,
      'LINEAGE_NOT_FOUND',
      { lineageId },
    );
  }

  for (const hash of hashes) {
    const entry = genomeRegistry.get(hash)!;
    if (entry.genome.identity.version === version) {
      return entry;
    }
  }

  throw new GenomeError(
    `Version ${version} not found for lineage ${lineageId}`,
    'GENOME_NOT_FOUND',
    { lineageId, version },
  );
}

// ─── Genome Search ──────────────────────────────────────────────────────────

/**
 * Search genomes by various criteria.
 */
export function searchGenomes(request: SearchGenomesRequest): {
  entries: GenomeRegistryEntry[];
  total: number;
} {
  let candidates: GenomeRegistryEntry[] = Array.from(genomeRegistry.values());

  // Filter by tags
  if (request.tags && request.tags.length > 0) {
    const tagHashes = new Set<GenomeHash>();
    for (const tag of request.tags) {
      const hashes = tagIndex.get(tag);
      if (hashes) {
        for (const h of hashes) tagHashes.add(h);
      }
    }
    candidates = candidates.filter((e) => tagHashes.has(e.genome.identity.hash));
  }

  // Filter by author
  if (request.author) {
    candidates = candidates.filter(
      (e) => e.genome.identity.author.toLowerCase().includes(request.author!.toLowerCase()),
    );
  }

  // Filter by capability
  if (request.capabilityId) {
    candidates = candidates.filter(
      (e) => e.genome.capabilities.some((c) => c.id === request.capabilityId),
    );
  }

  // Filter by minimum fitness
  if (request.minFitness !== undefined) {
    candidates = candidates.filter(
      (e) => e.genome.lineage.fitnessAtCreation.overall >= request.minFitness!,
    );
  }

  // Filter by verification status
  if (request.verificationStatus) {
    candidates = candidates.filter(
      (e) => e.verificationStatus === request.verificationStatus,
    );
  }

  // Text search
  if (request.query) {
    const q = request.query.toLowerCase();
    candidates = candidates.filter(
      (e) =>
        e.genome.identity.name.toLowerCase().includes(q) ||
        e.genome.identity.description.toLowerCase().includes(q) ||
        e.genome.identity.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // Sort by fitness descending
  candidates.sort(
    (a, b) =>
      b.genome.lineage.fitnessAtCreation.overall -
      a.genome.lineage.fitnessAtCreation.overall,
  );

  const total = candidates.length;
  const offset = request.offset ?? 0;
  const limit = request.limit ?? 20;
  const entries = candidates.slice(offset, offset + limit);

  return { entries, total };
}

// ─── Genome Validation ──────────────────────────────────────────────────────

/**
 * Deep validation of a genome beyond schema validation.
 * Checks semantic consistency, capability dependencies, constitutional
 * coherence, and resource feasibility.
 */
export function validateGenome(genome: AgentGenome): {
  valid: boolean;
  errors: GenomeValidationError[];
  warnings: GenomeValidationWarning[];
} {
  const errors: GenomeValidationError[] = [];
  const warnings: GenomeValidationWarning[] = [];

  // 1. Validate capability dependency graph (no cycles, all deps exist)
  const capIds = new Set(genome.capabilities.map((c) => c.id));
  for (const cap of genome.capabilities) {
    for (const dep of cap.dependencies) {
      if (!capIds.has(dep)) {
        errors.push({
          path: `capabilities[${cap.id}].dependencies`,
          message: `Dependency '${dep}' not found in genome capabilities`,
          code: 'MISSING_DEPENDENCY',
        });
      }
    }
    // Check for self-dependency
    if (cap.dependencies.includes(cap.id)) {
      errors.push({
        path: `capabilities[${cap.id}].dependencies`,
        message: `Capability '${cap.id}' depends on itself`,
        code: 'SELF_DEPENDENCY',
      });
    }
    // Check for conflict with self
    if (cap.conflicts.includes(cap.id)) {
      errors.push({
        path: `capabilities[${cap.id}].conflicts`,
        message: `Capability '${cap.id}' conflicts with itself`,
        code: 'SELF_CONFLICT',
      });
    }
  }

  // 2. Check for circular capability dependencies
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  function hasCycle(capId: string): boolean {
    visited.add(capId);
    recursionStack.add(capId);
    const cap = genome.capabilities.find((c) => c.id === capId);
    if (cap) {
      for (const dep of cap.dependencies) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }
    }
    recursionStack.delete(capId);
    return false;
  }
  for (const cap of genome.capabilities) {
    if (!visited.has(cap.id) && hasCycle(cap.id)) {
      errors.push({
        path: 'capabilities',
        message: `Circular dependency detected involving capability '${cap.id}'`,
        code: 'CIRCULAR_DEPENDENCY',
      });
    }
  }

  // 3. Validate resource consistency (min <= recommended <= max)
  const { minimum, recommended, maximum } = genome.resources;
  const resourceFields: (keyof ResourceProfile)[] = [
    'cpuMs', 'memoryBytes', 'ipcPerMinute', 'maxChildren', 'apiCalls', 'storageBytes',
  ];
  for (const field of resourceFields) {
    if (minimum[field] > recommended[field]) {
      errors.push({
        path: `resources.minimum.${field}`,
        message: `Minimum ${field} (${minimum[field]}) exceeds recommended (${recommended[field]})`,
        code: 'RESOURCE_INCONSISTENCY',
      });
    }
    if (recommended[field] > maximum[field]) {
      errors.push({
        path: `resources.recommended.${field}`,
        message: `Recommended ${field} (${recommended[field]}) exceeds maximum (${maximum[field]})`,
        code: 'RESOURCE_INCONSISTENCY',
      });
    }
  }

  // 4. Validate constitutional coherence
  if (genome.constitution.maxAutonomy > 0.8 &&
      !genome.constitution.principles.includes('human_oversight')) {
    warnings.push({
      path: 'constitution.maxAutonomy',
      message: 'High autonomy without human_oversight principle',
      suggestion: 'Consider adding human_oversight to principles for agents with autonomy > 0.8',
    });
  }

  if (genome.constitution.selfModifiable &&
      !genome.constitution.constraints.some((c) => c.enforcement === 'hard')) {
    warnings.push({
      path: 'constitution.selfModifiable',
      message: 'Self-modifiable constitution with no hard constraints',
      suggestion: 'Add at least one hard constraint to prevent unbounded self-modification',
    });
  }

  // 5. Validate composition rules
  if (genome.composition.composable && genome.composition.roles.length === 0) {
    warnings.push({
      path: 'composition.roles',
      message: 'Agent is marked composable but defines no roles',
      suggestion: 'Define at least one composition role to specify how this agent participates',
    });
  }

  // 6. Validate lineage
  if (genome.lineage.derivation !== 'original' && genome.lineage.parentHash === null) {
    errors.push({
      path: 'lineage.parentHash',
      message: `Derivation type '${genome.lineage.derivation}' requires a parent hash`,
      code: 'MISSING_PARENT',
    });
  }

  if (genome.lineage.derivation === 'original' && genome.lineage.parentHash !== null) {
    warnings.push({
      path: 'lineage.parentHash',
      message: 'Original genome should not have a parent hash',
      suggestion: 'Set parentHash to null for original genomes',
    });
  }

  // 7. Check communication protocol completeness
  if (genome.protocol.emits.length === 0 && genome.protocol.consumes.length === 0) {
    warnings.push({
      path: 'protocol',
      message: 'Agent defines no message types (emits or consumes)',
      suggestion: 'Define at least one message type for inter-agent communication',
    });
  }

  // 8. Validate capability conflicts are mutual
  for (const cap of genome.capabilities) {
    for (const conflictId of cap.conflicts) {
      const conflicting = genome.capabilities.find((c) => c.id === conflictId);
      if (conflicting && !conflicting.conflicts.includes(cap.id)) {
        warnings.push({
          path: `capabilities[${cap.id}].conflicts`,
          message: `Conflict with '${conflictId}' is not mutual`,
          suggestion: `Add '${cap.id}' to ${conflictId}'s conflicts for consistency`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Genome Diffing ─────────────────────────────────────────────────────────

/**
 * Compute a semantic diff between two genomes.
 */
export function diffGenomes(fromHash: GenomeHash, toHash: GenomeHash): GenomeDiff {
  const fromEntry = getGenome(fromHash);
  const toEntry = getGenome(toHash);
  const from = fromEntry.genome;
  const to = toEntry.genome;

  const mutations: GenomeMutation[] = [];
  const now = new Date().toISOString();

  // Diff capabilities
  const fromCaps = new Map(from.capabilities.map((c) => [c.id, c]));
  const toCaps = new Map(to.capabilities.map((c) => [c.id, c]));

  let capsAdded = 0;
  let capsRemoved = 0;
  let capsModified = 0;

  for (const [id, cap] of toCaps) {
    if (!fromCaps.has(id)) {
      capsAdded++;
      mutations.push({
        type: 'capability_added',
        path: `capabilities[${id}]`,
        description: `Added capability: ${cap.name}`,
        reason: 'Genome evolution',
        appliedBy: 'genome-diff',
        appliedAt: now,
      });
    } else {
      const oldCap = fromCaps.get(id)!;
      if (JSON.stringify(oldCap) !== JSON.stringify(cap)) {
        capsModified++;
        mutations.push({
          type: 'capability_modified',
          path: `capabilities[${id}]`,
          description: `Modified capability: ${cap.name}`,
          reason: detectCapabilityChangeReason(oldCap, cap),
          appliedBy: 'genome-diff',
          appliedAt: now,
        });
      }
    }
  }

  for (const [id, cap] of fromCaps) {
    if (!toCaps.has(id)) {
      capsRemoved++;
      mutations.push({
        type: 'capability_removed',
        path: `capabilities[${id}]`,
        description: `Removed capability: ${cap.name}`,
        reason: 'Genome evolution',
        appliedBy: 'genome-diff',
        appliedAt: now,
      });
    }
  }

  // Diff constraints
  const fromConstraints = new Map(from.constitution.constraints.map((c) => [c.id, c]));
  const toConstraints = new Map(to.constitution.constraints.map((c) => [c.id, c]));

  let constraintsAdded = 0;
  let constraintsRemoved = 0;
  let constraintsModified = 0;

  for (const [id, constraint] of toConstraints) {
    if (!fromConstraints.has(id)) {
      constraintsAdded++;
      mutations.push({
        type: 'constraint_added',
        path: `constitution.constraints[${id}]`,
        description: `Added constraint: ${constraint.rule}`,
        reason: 'Constitutional amendment',
        appliedBy: 'genome-diff',
        appliedAt: now,
      });
    } else if (JSON.stringify(fromConstraints.get(id)) !== JSON.stringify(constraint)) {
      constraintsModified++;
      mutations.push({
        type: 'constraint_modified',
        path: `constitution.constraints[${id}]`,
        description: `Modified constraint: ${constraint.rule}`,
        reason: 'Constitutional amendment',
        appliedBy: 'genome-diff',
        appliedAt: now,
      });
    }
  }

  for (const [id, constraint] of fromConstraints) {
    if (!toConstraints.has(id)) {
      constraintsRemoved++;
      mutations.push({
        type: 'constraint_removed',
        path: `constitution.constraints[${id}]`,
        description: `Removed constraint: ${constraint.rule}`,
        reason: 'Constitutional amendment',
        appliedBy: 'genome-diff',
        appliedAt: now,
      });
    }
  }

  // Diff resources
  const resourcesChanged =
    JSON.stringify(from.resources) !== JSON.stringify(to.resources);
  if (resourcesChanged) {
    mutations.push({
      type: 'resource_changed',
      path: 'resources',
      description: 'Resource requirements changed',
      reason: 'Resource optimization',
      appliedBy: 'genome-diff',
      appliedAt: now,
    });
  }

  // Diff protocol
  const protocolChanged =
    JSON.stringify(from.protocol) !== JSON.stringify(to.protocol);
  if (protocolChanged) {
    mutations.push({
      type: 'protocol_changed',
      path: 'protocol',
      description: 'Communication protocol changed',
      reason: 'Protocol evolution',
      appliedBy: 'genome-diff',
      appliedAt: now,
    });
  }

  // Diff architecture
  const architectureChanged =
    JSON.stringify(from.cognitiveArchitecture) !== JSON.stringify(to.cognitiveArchitecture);
  if (architectureChanged) {
    mutations.push({
      type: 'architecture_changed',
      path: 'cognitiveArchitecture',
      description: 'Cognitive architecture changed',
      reason: 'Architecture evolution',
      appliedBy: 'genome-diff',
      appliedAt: now,
    });
  }

  // Diff constitution (beyond constraints)
  const constitutionAmended =
    from.constitution.maxAutonomy !== to.constitution.maxAutonomy ||
    from.constitution.escalationThreshold !== to.constitution.escalationThreshold ||
    from.constitution.selfModifiable !== to.constitution.selfModifiable ||
    JSON.stringify(from.constitution.principles) !== JSON.stringify(to.constitution.principles);
  if (constitutionAmended) {
    mutations.push({
      type: 'constitution_amended',
      path: 'constitution',
      description: 'Constitutional parameters changed',
      reason: 'Constitutional evolution',
      appliedBy: 'genome-diff',
      appliedAt: now,
    });
  }

  // Determine backward compatibility
  const backwardCompatible =
    capsRemoved === 0 &&
    constraintsRemoved === 0 &&
    !protocolChanged &&
    !architectureChanged;

  // Determine risk level
  const riskLevel = determineRiskLevel({
    capsRemoved,
    constraintsRemoved,
    constitutionAmended,
    architectureChanged,
    capsAdded,
    capsModified,
  });

  const summary: GenomeDiffSummary = {
    capabilitiesAdded: capsAdded,
    capabilitiesRemoved: capsRemoved,
    capabilitiesModified: capsModified,
    constraintsAdded,
    constraintsRemoved,
    constraintsModified,
    resourcesChanged,
    protocolChanged,
    architectureChanged,
    constitutionAmended,
    backwardCompatible,
    riskLevel,
  };

  return {
    fromHash,
    toHash,
    mutations,
    summary,
  };
}

function detectCapabilityChangeReason(oldCap: CapabilityGene, newCap: CapabilityGene): string {
  const changes: string[] = [];
  if (oldCap.maturity !== newCap.maturity) changes.push(`maturity: ${oldCap.maturity} → ${newCap.maturity}`);
  if (oldCap.performanceScore !== newCap.performanceScore) changes.push('performance updated');
  if (JSON.stringify(oldCap.inputSchema) !== JSON.stringify(newCap.inputSchema)) changes.push('input schema changed');
  if (JSON.stringify(oldCap.outputSchema) !== JSON.stringify(newCap.outputSchema)) changes.push('output schema changed');
  return changes.length > 0 ? changes.join(', ') : 'minor modifications';
}

function determineRiskLevel(changes: {
  capsRemoved: number;
  constraintsRemoved: number;
  constitutionAmended: boolean;
  architectureChanged: boolean;
  capsAdded: number;
  capsModified: number;
}): GenomeDiffSummary['riskLevel'] {
  if (changes.constraintsRemoved > 0 || changes.constitutionAmended) return 'critical';
  if (changes.capsRemoved > 0 || changes.architectureChanged) return 'high';
  if (changes.capsModified > 2) return 'medium';
  if (changes.capsModified > 0 || changes.capsAdded > 0) return 'low';
  return 'safe';
}

// ─── Pre-flight Verification ────────────────────────────────────────────────

/**
 * Run pre-flight verification checks before instantiating a genome.
 */
export function preFlightVerify(
  genome: AgentGenome,
  request: InstantiationRequest,
): PreFlightVerification {
  const checks: PreFlightCheck[] = [];

  // 1. Hash integrity
  const computedHash = computeGenomeHash(genome);
  checks.push({
    name: 'hash_integrity',
    passed: computedHash === genome.identity.hash,
    message: computedHash === genome.identity.hash
      ? 'Genome hash verified'
      : `Hash mismatch: expected ${genome.identity.hash}, got ${computedHash}`,
    severity: 'critical',
  });

  // 2. Not deprecated
  checks.push({
    name: 'not_deprecated',
    passed: !genome.lineage.deprecated,
    message: genome.lineage.deprecated
      ? `Genome is deprecated, replaced by ${genome.lineage.replacedBy}`
      : 'Genome is active',
    severity: 'error',
  });

  // 3. Resource overrides within maximum
  if (request.resourceOverrides) {
    const max = genome.resources.maximum;
    const overrides = request.resourceOverrides;
    const resourceOk =
      (!overrides.cpuMs || overrides.cpuMs <= max.cpuMs) &&
      (!overrides.memoryBytes || overrides.memoryBytes <= max.memoryBytes) &&
      (!overrides.apiCalls || overrides.apiCalls <= max.apiCalls) &&
      (!overrides.storageBytes || overrides.storageBytes <= max.storageBytes);
    checks.push({
      name: 'resource_within_maximum',
      passed: resourceOk,
      message: resourceOk
        ? 'Resource overrides within genome maximum'
        : 'Resource overrides exceed genome maximum limits',
      severity: 'error',
    });
  } else {
    checks.push({
      name: 'resource_within_maximum',
      passed: true,
      message: 'No resource overrides, using genome defaults',
      severity: 'info',
    });
  }

  // 4. Validate semantic consistency
  const validation = validateGenome(genome);
  checks.push({
    name: 'semantic_validation',
    passed: validation.valid,
    message: validation.valid
      ? 'Genome passes semantic validation'
      : `${validation.errors.length} validation errors: ${validation.errors.map((e) => e.message).join('; ')}`,
    severity: 'error',
  });

  // 5. Has required signatures
  const hasSig = genome.signatures.length > 0;
  checks.push({
    name: 'signature_present',
    passed: hasSig,
    message: hasSig
      ? `${genome.signatures.length} signature(s) present`
      : 'No signatures — genome is unverified',
    severity: 'warning',
  });

  // 6. Constitution has at least one hard constraint
  const hasHardConstraint = genome.constitution.constraints.some(
    (c) => c.enforcement === 'hard',
  );
  checks.push({
    name: 'hard_constraint_present',
    passed: hasHardConstraint,
    message: hasHardConstraint
      ? 'Constitutional hard constraints present'
      : 'No hard constraints — agent has no hard safety boundaries',
    severity: 'warning',
  });

  // 7. Spec version compatibility
  const specMajor = parseInt(genome.identity.specVersion.split('.')[0], 10);
  const supported = specMajor === 1;
  checks.push({
    name: 'spec_version_compatible',
    passed: supported,
    message: supported
      ? `Spec version ${genome.identity.specVersion} supported`
      : `Spec version ${genome.identity.specVersion} not supported (requires v1.x.x)`,
    severity: 'critical',
  });

  return {
    passed: checks.every(
      (c) => c.passed || c.severity === 'info' || c.severity === 'warning',
    ),
    checks,
  };
}

// ─── Genome Instantiation ───────────────────────────────────────────────────

/**
 * Instantiate a genome into a running process.
 * This is the bridge between the genome specification and the runtime kernel.
 */
export function instantiateGenome(request: InstantiationRequest): InstantiationResult {
  const entry = getGenome(request.genomeHash);
  const genome = entry.genome;

  // Run pre-flight checks
  const verification = preFlightVerify(genome, request);
  if (!verification.passed) {
    return {
      success: false,
      processId: null,
      genomeHash: request.genomeHash,
      effectiveResources: genome.resources.recommended,
      grantedCapabilities: [],
      warnings: verification.checks
        .filter((c) => !c.passed && c.severity === 'warning')
        .map((c) => c.message),
      error: verification.checks
        .filter((c) => !c.passed && (c.severity === 'error' || c.severity === 'critical'))
        .map((c) => c.message)
        .join('; '),
      verification,
    };
  }

  // Compute effective resource profile
  const effectiveResources: ResourceProfile = {
    ...genome.resources.recommended,
    ...(request.resourceOverrides ?? {}),
  };

  // Derive capability list from genome
  const grantedCapabilities = genome.capabilities
    .filter((c) => c.maturity !== 'nascent') // don't grant nascent capabilities
    .map((c) => c.id);

  // Generate process ID
  const processId = randomUUID();

  // Increment active instances
  entry.activeInstances++;

  return {
    success: true,
    processId,
    genomeHash: request.genomeHash,
    effectiveResources,
    grantedCapabilities,
    warnings: verification.checks
      .filter((c) => !c.passed && c.severity === 'warning')
      .map((c) => c.message),
    error: null,
    verification,
  };
}

// ─── Lineage Queries ────────────────────────────────────────────────────────

/**
 * Get the complete lineage tree for a genome family.
 */
export function getLineage(request: GetLineageRequest): GetLineageResponse {
  const hashes = lineageIndex.get(request.lineageId);
  if (!hashes || hashes.length === 0) {
    throw new GenomeError(
      `No genomes found for lineage ${request.lineageId}`,
      'LINEAGE_NOT_FOUND',
      { lineageId: request.lineageId },
    );
  }

  const maxDepth = request.maxDepth ?? 50;
  const genomes = hashes
    .map((hash) => {
      const entry = genomeRegistry.get(hash)!;
      const g = entry.genome;
      return {
        hash: g.identity.hash,
        version: g.identity.version,
        generation: g.identity.generation,
        createdAt: g.identity.createdAt,
        derivation: g.lineage.derivation,
        fitness: g.lineage.fitnessAtCreation,
        deprecated: g.lineage.deprecated,
      };
    })
    .sort((a, b) => a.generation - b.generation)
    .slice(0, maxDepth);

  return {
    lineageId: request.lineageId,
    genomes,
    totalGenerations: hashes.length,
  };
}

// ─── Genome Construction Helpers ────────────────────────────────────────────

/**
 * Create a new genome with sensible defaults and compute its hash.
 */
export function createGenome(
  params: {
    name: string;
    version: string;
    author: string;
    description: string;
    tags?: string[];
    capabilities?: CapabilityGene[];
    constitution?: Partial<AgentGenome['constitution']>;
    cognitiveArchitecture?: Partial<AgentGenome['cognitiveArchitecture']>;
    resources?: Partial<AgentGenome['resources']>;
    protocol?: Partial<AgentGenome['protocol']>;
    lineage?: Partial<AgentGenome['lineage']>;
    composition?: Partial<AgentGenome['composition']>;
  },
): AgentGenome {
  const lineageId = randomUUID();
  const now = new Date().toISOString();

  const defaultFitness: FitnessMetrics = {
    overall: 0,
    taskSuccessRate: 0,
    responseQuality: 0,
    resourceEfficiency: 0,
    cooperationScore: 0,
    safetyScore: 1.0,
    sampleSize: 0,
    computedAt: now,
  };

  const defaultResourceProfile: ResourceProfile = {
    cpuMs: 1000,
    memoryBytes: 256 * 1024 * 1024,
    ipcPerMinute: 100,
    maxChildren: 5,
    apiCalls: 50,
    storageBytes: 100 * 1024 * 1024,
  };

  const genome: AgentGenome = {
    identity: {
      hash: '', // computed below
      name: params.name,
      version: params.version,
      specVersion: '1.0.0',
      lineageId,
      generation: 0,
      author: params.author,
      createdAt: now,
      description: params.description,
      tags: params.tags ?? [],
      license: 'MIT',
    },
    cognitiveArchitecture: {
      primaryReasoning: 'chain_of_thought',
      fallbackStrategies: ['ensemble'],
      learningModes: ['in_context'],
      maxReasoningDepth: 10,
      workingMemorySlots: 16,
      attentionHorizon: 128000,
      debiasing: [],
      domains: ['general'],
      ...params.cognitiveArchitecture,
    },
    capabilities: params.capabilities ?? [],
    constitution: {
      principles: ['harm_prevention', 'truthfulness', 'human_oversight'],
      constraints: [],
      maxAutonomy: 0.5,
      escalationThreshold: 0.3,
      selfModifiable: false,
      constitutionHash: '',
      ...params.constitution,
    },
    resources: {
      minimum: { ...defaultResourceProfile, cpuMs: 100, memoryBytes: 64 * 1024 * 1024 },
      recommended: defaultResourceProfile,
      maximum: { ...defaultResourceProfile, cpuMs: 10000, memoryBytes: 1024 * 1024 * 1024, apiCalls: 500 },
      elasticScaling: false,
      scalingPolicy: null,
      ...params.resources,
    },
    protocol: {
      encodings: ['json'],
      channelTypes: ['message_queue'],
      emits: [],
      consumes: [],
      maxMessageSize: 1024 * 1024,
      defaultTimeoutMs: 30000,
      streaming: false,
      backpressureStrategy: 'buffer',
      ...params.protocol,
    },
    lineage: {
      parentHash: null,
      ancestors: [],
      derivation: 'original',
      mutations: [],
      fitnessAtCreation: defaultFitness,
      deprecated: false,
      replacedBy: null,
      ...params.lineage,
    },
    composition: {
      composable: true,
      roles: [],
      compatibleWith: [],
      incompatibleWith: [],
      maxCompositionSize: 10,
      canOrchestrate: false,
      canBeOrchestrated: true,
      ...params.composition,
    },
    signatures: [],
    extensions: {},
  };

  // Compute constitution hash
  genome.constitution.constitutionHash = createHash('sha256')
    .update(JSON.stringify(genome.constitution.constraints))
    .digest('hex')
    .slice(0, 16);

  // Compute genome hash
  genome.identity.hash = computeGenomeHash(genome);

  return genome;
}

/**
 * Fork a genome — create a new generation with mutations.
 */
export function forkGenome(
  parentHash: GenomeHash,
  mutations: {
    name?: string;
    version: string;
    author: string;
    reason: string;
    capabilitiesToAdd?: CapabilityGene[];
    capabilitiesToRemove?: string[];
    constraintsToAdd?: ConstitutionalConstraint[];
    constraintsToRemove?: string[];
    resourceOverrides?: Partial<AgentGenome['resources']>;
    architectureOverrides?: Partial<AgentGenome['cognitiveArchitecture']>;
  },
): AgentGenome {
  const parentEntry = getGenome(parentHash);
  const parent = parentEntry.genome;
  const now = new Date().toISOString();

  // Build mutation log
  const mutationLog: GenomeMutation[] = [];

  // Apply capability mutations
  let capabilities = [...parent.capabilities];
  if (mutations.capabilitiesToAdd) {
    for (const cap of mutations.capabilitiesToAdd) {
      capabilities.push(cap);
      mutationLog.push({
        type: 'capability_added',
        path: `capabilities[${cap.id}]`,
        description: `Added capability: ${cap.name}`,
        reason: mutations.reason,
        appliedBy: mutations.author,
        appliedAt: now,
      });
    }
  }
  if (mutations.capabilitiesToRemove) {
    for (const capId of mutations.capabilitiesToRemove) {
      const removed = capabilities.find((c) => c.id === capId);
      capabilities = capabilities.filter((c) => c.id !== capId);
      if (removed) {
        mutationLog.push({
          type: 'capability_removed',
          path: `capabilities[${capId}]`,
          description: `Removed capability: ${removed.name}`,
          reason: mutations.reason,
          appliedBy: mutations.author,
          appliedAt: now,
        });
      }
    }
  }

  // Apply constraint mutations
  let constraints = [...parent.constitution.constraints];
  if (mutations.constraintsToAdd) {
    for (const constraint of mutations.constraintsToAdd) {
      constraints.push(constraint);
      mutationLog.push({
        type: 'constraint_added',
        path: `constitution.constraints[${constraint.id}]`,
        description: `Added constraint: ${constraint.rule}`,
        reason: mutations.reason,
        appliedBy: mutations.author,
        appliedAt: now,
      });
    }
  }
  if (mutations.constraintsToRemove) {
    for (const constraintId of mutations.constraintsToRemove) {
      const removed = constraints.find((c) => c.id === constraintId);
      constraints = constraints.filter((c) => c.id !== constraintId);
      if (removed) {
        mutationLog.push({
          type: 'constraint_removed',
          path: `constitution.constraints[${constraintId}]`,
          description: `Removed constraint: ${removed.rule}`,
          reason: mutations.reason,
          appliedBy: mutations.author,
          appliedAt: now,
        });
      }
    }
  }

  const forked: AgentGenome = {
    ...structuredClone(parent),
    identity: {
      ...parent.identity,
      hash: '', // computed below
      name: mutations.name ?? parent.identity.name,
      version: mutations.version,
      generation: parent.identity.generation + 1,
      author: mutations.author,
      createdAt: now,
    },
    capabilities,
    constitution: {
      ...parent.constitution,
      constraints,
    },
    resources: mutations.resourceOverrides
      ? { ...parent.resources, ...mutations.resourceOverrides }
      : parent.resources,
    cognitiveArchitecture: mutations.architectureOverrides
      ? { ...parent.cognitiveArchitecture, ...mutations.architectureOverrides }
      : parent.cognitiveArchitecture,
    lineage: {
      parentHash,
      ancestors: [parentHash, ...parent.lineage.ancestors],
      derivation: 'fork',
      mutations: mutationLog,
      fitnessAtCreation: parent.lineage.fitnessAtCreation,
      deprecated: false,
      replacedBy: null,
    },
    signatures: [], // forked genomes need new signatures
  };

  // Recompute constitution hash
  forked.constitution.constitutionHash = createHash('sha256')
    .update(JSON.stringify(forked.constitution.constraints))
    .digest('hex')
    .slice(0, 16);

  // Compute genome hash
  forked.identity.hash = computeGenomeHash(forked);

  return forked;
}

// ─── Genome Deprecation ─────────────────────────────────────────────────────

/**
 * Deprecate a genome and optionally point to its replacement.
 */
export function deprecateGenome(hash: GenomeHash, replacedBy?: GenomeHash): void {
  const entry = getGenome(hash);

  if (replacedBy) {
    // Verify replacement exists
    getGenome(replacedBy);
  }

  entry.genome.lineage.deprecated = true;
  entry.genome.lineage.replacedBy = replacedBy ?? null;
}

// ─── Registry Statistics ────────────────────────────────────────────────────

export interface GenomeRegistryStats {
  totalGenomes: number;
  totalLineages: number;
  verifiedGenomes: number;
  activeInstances: number;
  avgFitness: number;
  topTags: Array<{ tag: string; count: number }>;
}

export function getRegistryStats(): GenomeRegistryStats {
  const entries = Array.from(genomeRegistry.values());

  const verifiedGenomes = entries.filter(
    (e) => e.verificationStatus !== 'unverified',
  ).length;

  const activeInstances = entries.reduce((sum, e) => sum + e.activeInstances, 0);

  const avgFitness = entries.length > 0
    ? entries.reduce((sum, e) => sum + e.genome.lineage.fitnessAtCreation.overall, 0) / entries.length
    : 0;

  const tagCounts = new Map<string, number>();
  for (const [tag, hashes] of tagIndex) {
    tagCounts.set(tag, hashes.size);
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return {
    totalGenomes: genomeRegistry.size,
    totalLineages: lineageIndex.size,
    verifiedGenomes,
    activeInstances,
    avgFitness,
    topTags,
  };
}
