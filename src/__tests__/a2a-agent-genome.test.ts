/**
 * Tests for A2A Agent Genome — Portable Agent Specification Protocol
 */

import {
  createGenome,
  forkGenome,
  computeGenomeHash,
  verifyGenomeIntegrity,
  registerGenome,
  getGenome,
  getLatestGenome,
  getGenomeByVersion,
  searchGenomes,
  validateGenome,
  diffGenomes,
  preFlightVerify,
  instantiateGenome,
  deprecateGenome,
  getLineage,
  getRegistryStats,
  GenomeError,
  _resetGenomeRegistry,
} from '@/lib/a2a/agent-genome/engine';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCapability(overrides = {}) {
  return {
    id: 'cap-test',
    name: 'Test Capability',
    description: 'A test capability',
    maturity: 'proficient',
    performanceScore: 0.8,
    requiredSubsystems: ['knowledge'],
    dependencies: [],
    conflicts: [],
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    latencyBudgetMs: 5000,
    delegable: true,
    provenance: {
      type: 'innate',
      sourceAgentId: null,
      sourceGenomeHash: null,
      acquiredAt: new Date().toISOString(),
      validationResults: [],
    },
    ...overrides,
  };
}

function makeConstraint(overrides = {}) {
  return {
    id: 'constraint-1',
    principle: 'harm_prevention',
    rule: 'Must not cause harm',
    formalSpec: 'NOT(harm)',
    enforcement: 'hard',
    priority: 100,
    exceptions: [],
    ...overrides,
  };
}

function createTestGenome(name = 'test-agent', extras = {}) {
  return createGenome({
    name,
    version: '1.0.0',
    author: 'test-author',
    description: 'A test agent genome',
    tags: ['test', 'ai'],
    capabilities: [makeCapability()],
    constitution: {
      principles: ['harm_prevention', 'truthfulness', 'human_oversight'],
      constraints: [makeConstraint()],
      maxAutonomy: 0.5,
      escalationThreshold: 0.3,
      selfModifiable: false,
    },
    ...extras,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetGenomeRegistry();
});

describe('Genome Creation', () => {
  it('creates a genome with computed hash', () => {
    const genome = createTestGenome();
    expect(genome.identity.hash).toBeTruthy();
    expect(genome.identity.hash.length).toBe(64); // SHA-256 hex
    expect(genome.identity.name).toBe('test-agent');
    expect(genome.identity.version).toBe('1.0.0');
    expect(genome.identity.specVersion).toBe('1.0.0');
    expect(genome.identity.generation).toBe(0);
  });

  it('creates different hashes for different genomes', () => {
    const g1 = createTestGenome('agent-1');
    const g2 = createTestGenome('agent-2');
    expect(g1.identity.hash).not.toBe(g2.identity.hash);
  });

  it('sets default values correctly', () => {
    const genome = createGenome({
      name: 'minimal',
      version: '0.1.0',
      author: 'test',
      description: 'minimal agent',
    });
    expect(genome.cognitiveArchitecture.primaryReasoning).toBe('chain_of_thought');
    expect(genome.constitution.principles).toContain('harm_prevention');
    expect(genome.composition.composable).toBe(true);
    expect(genome.lineage.derivation).toBe('original');
    expect(genome.protocol.encodings).toContain('json');
  });
});

describe('Genome Hashing & Integrity', () => {
  it('verifies integrity of a valid genome', () => {
    const genome = createTestGenome();
    expect(verifyGenomeIntegrity(genome)).toBe(true);
  });

  it('detects tampered genome', () => {
    const genome = createTestGenome();
    genome.identity.name = 'tampered';
    expect(verifyGenomeIntegrity(genome)).toBe(false);
  });

  it('computeGenomeHash is deterministic', () => {
    const genome = createTestGenome();
    const hash1 = computeGenomeHash(genome);
    const hash2 = computeGenomeHash(genome);
    expect(hash1).toBe(hash2);
  });
});

describe('Genome Registry', () => {
  it('registers and retrieves a genome', () => {
    const genome = createTestGenome();
    const entry = registerGenome(genome);
    expect(entry.genome.identity.hash).toBe(genome.identity.hash);
    expect(entry.downloads).toBe(0);
    expect(entry.activeInstances).toBe(0);

    const retrieved = getGenome(genome.identity.hash);
    expect(retrieved.genome.identity.name).toBe('test-agent');
  });

  it('rejects duplicate registration', () => {
    const genome = createTestGenome();
    registerGenome(genome);
    expect(() => registerGenome(genome)).toThrow(GenomeError);
  });

  it('rejects genome with mismatched hash', () => {
    const genome = createTestGenome();
    genome.identity.hash = 'deadbeef'.repeat(8);
    expect(() => registerGenome(genome)).toThrow('Hash mismatch');
  });

  it('throws on not-found genome', () => {
    expect(() => getGenome('nonexistent')).toThrow(GenomeError);
  });

  it('retrieves latest genome for a lineage', () => {
    const g1 = createTestGenome('v1');
    registerGenome(g1);

    const g2 = forkGenome(g1.identity.hash, {
      version: '2.0.0',
      author: 'test',
      reason: 'upgrade',
    });
    registerGenome(g2);

    const latest = getLatestGenome(g1.identity.lineageId);
    expect(latest.genome.identity.generation).toBe(1);
  });

  it('retrieves genome by lineage and version', () => {
    const g1 = createTestGenome();
    registerGenome(g1);

    const result = getGenomeByVersion(g1.identity.lineageId, '1.0.0');
    expect(result.genome.identity.hash).toBe(g1.identity.hash);
  });
});

describe('Genome Search', () => {
  it('searches by tag', () => {
    const g1 = createTestGenome('tagged-agent');
    registerGenome(g1);

    const results = searchGenomes({ tags: ['test'] });
    expect(results.total).toBe(1);
    expect(results.entries[0].genome.identity.name).toBe('tagged-agent');
  });

  it('searches by author', () => {
    const g1 = createTestGenome();
    registerGenome(g1);

    const results = searchGenomes({ author: 'test-author' });
    expect(results.total).toBe(1);
  });

  it('searches by text query', () => {
    const g1 = createTestGenome('unique-search-name');
    registerGenome(g1);

    const results = searchGenomes({ query: 'unique-search' });
    expect(results.total).toBe(1);
  });

  it('returns empty for no matches', () => {
    const results = searchGenomes({ query: 'nonexistent' });
    expect(results.total).toBe(0);
    expect(results.entries).toHaveLength(0);
  });

  it('supports pagination', () => {
    for (let i = 0; i < 5; i++) {
      registerGenome(createTestGenome(`agent-${i}`));
    }
    const page1 = searchGenomes({ limit: 2, offset: 0 });
    expect(page1.entries).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = searchGenomes({ limit: 2, offset: 2 });
    expect(page2.entries).toHaveLength(2);
  });
});

describe('Genome Validation', () => {
  it('validates a well-formed genome', () => {
    const genome = createTestGenome();
    const result = validateGenome(genome);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing capability dependency', () => {
    const genome = createTestGenome('dep-test', {
      capabilities: [makeCapability({ id: 'cap-a', dependencies: ['cap-missing'] })],
    });
    const result = validateGenome(genome);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_DEPENDENCY')).toBe(true);
  });

  it('detects self-dependency', () => {
    const genome = createTestGenome('self-dep', {
      capabilities: [makeCapability({ id: 'cap-a', dependencies: ['cap-a'] })],
    });
    const result = validateGenome(genome);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SELF_DEPENDENCY')).toBe(true);
  });

  it('detects resource inconsistency', () => {
    const genome = createTestGenome('resource-bad', {
      resources: {
        minimum: { cpuMs: 5000, memoryBytes: 1024, ipcPerMinute: 10, maxChildren: 1, apiCalls: 5, storageBytes: 100 },
        recommended: { cpuMs: 1000, memoryBytes: 512, ipcPerMinute: 10, maxChildren: 1, apiCalls: 5, storageBytes: 100 },
        maximum: { cpuMs: 10000, memoryBytes: 2048, ipcPerMinute: 100, maxChildren: 10, apiCalls: 50, storageBytes: 1000 },
        elasticScaling: false,
        scalingPolicy: null,
      },
    });
    const result = validateGenome(genome);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'RESOURCE_INCONSISTENCY')).toBe(true);
  });

  it('warns about high autonomy without human oversight', () => {
    const genome = createTestGenome('high-auto', {
      constitution: {
        principles: ['harm_prevention', 'truthfulness'],
        constraints: [makeConstraint()],
        maxAutonomy: 0.95,
        escalationThreshold: 0.1,
        selfModifiable: false,
      },
    });
    const result = validateGenome(genome);
    expect(result.warnings.some(w => w.message.includes('human_oversight'))).toBe(true);
  });

  it('detects missing parent for non-original derivation', () => {
    const genome = createTestGenome();
    genome.lineage.derivation = 'fork';
    genome.lineage.parentHash = null;
    const result = validateGenome(genome);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISSING_PARENT')).toBe(true);
  });
});

describe('Genome Forking', () => {
  it('forks a genome with incremented generation', () => {
    const parent = createTestGenome();
    registerGenome(parent);

    const forked = forkGenome(parent.identity.hash, {
      version: '1.1.0',
      author: 'forker',
      reason: 'adding new capability',
      capabilitiesToAdd: [makeCapability({ id: 'new-cap', name: 'New Capability' })],
    });

    expect(forked.identity.generation).toBe(1);
    expect(forked.identity.version).toBe('1.1.0');
    expect(forked.lineage.parentHash).toBe(parent.identity.hash);
    expect(forked.lineage.ancestors).toContain(parent.identity.hash);
    expect(forked.lineage.derivation).toBe('fork');
    expect(forked.capabilities).toHaveLength(2);
    expect(forked.lineage.mutations).toHaveLength(1);
    expect(forked.lineage.mutations[0].type).toBe('capability_added');
  });

  it('forks with capability removal', () => {
    const parent = createTestGenome();
    registerGenome(parent);

    const forked = forkGenome(parent.identity.hash, {
      version: '2.0.0',
      author: 'remover',
      reason: 'deprecating old capability',
      capabilitiesToRemove: ['cap-test'],
    });

    expect(forked.capabilities).toHaveLength(0);
    expect(forked.lineage.mutations[0].type).toBe('capability_removed');
  });

  it('forks with new hash different from parent', () => {
    const parent = createTestGenome();
    registerGenome(parent);

    const forked = forkGenome(parent.identity.hash, {
      version: '1.1.0',
      author: 'test',
      reason: 'test fork',
    });

    expect(forked.identity.hash).not.toBe(parent.identity.hash);
    expect(verifyGenomeIntegrity(forked)).toBe(true);
  });
});

describe('Genome Diffing', () => {
  it('diffs two genomes and detects added capabilities', () => {
    const g1 = createTestGenome();
    registerGenome(g1);

    const g2 = forkGenome(g1.identity.hash, {
      version: '1.1.0',
      author: 'test',
      reason: 'add cap',
      capabilitiesToAdd: [makeCapability({ id: 'new-cap', name: 'New' })],
    });
    registerGenome(g2);

    const diff = diffGenomes(g1.identity.hash, g2.identity.hash);
    expect(diff.summary.capabilitiesAdded).toBe(1);
    expect(diff.summary.backwardCompatible).toBe(true);
    expect(diff.summary.riskLevel).toBe('low');
  });

  it('detects removed capabilities as high risk', () => {
    const g1 = createTestGenome();
    registerGenome(g1);

    const g2 = forkGenome(g1.identity.hash, {
      version: '2.0.0',
      author: 'test',
      reason: 'remove cap',
      capabilitiesToRemove: ['cap-test'],
    });
    registerGenome(g2);

    const diff = diffGenomes(g1.identity.hash, g2.identity.hash);
    expect(diff.summary.capabilitiesRemoved).toBe(1);
    expect(diff.summary.backwardCompatible).toBe(false);
    expect(diff.summary.riskLevel).toBe('high');
  });

  it('detects constraint changes as critical risk', () => {
    const g1 = createTestGenome();
    registerGenome(g1);

    const g2 = forkGenome(g1.identity.hash, {
      version: '2.0.0',
      author: 'test',
      reason: 'relax constraints',
      constraintsToRemove: ['constraint-1'],
    });
    registerGenome(g2);

    const diff = diffGenomes(g1.identity.hash, g2.identity.hash);
    expect(diff.summary.constraintsRemoved).toBe(1);
    expect(diff.summary.riskLevel).toBe('critical');
  });
});

describe('Genome Instantiation', () => {
  it('instantiates a valid genome', () => {
    const genome = createTestGenome();
    registerGenome(genome);

    const result = instantiateGenome({ genomeHash: genome.identity.hash });
    expect(result.success).toBe(true);
    expect(result.processId).toBeTruthy();
    expect(result.grantedCapabilities).toContain('cap-test');
    expect(result.error).toBeNull();
    expect(result.verification.passed).toBe(true);
  });

  it('rejects deprecated genome', () => {
    const genome = createTestGenome();
    registerGenome(genome);
    deprecateGenome(genome.identity.hash);

    const result = instantiateGenome({ genomeHash: genome.identity.hash });
    expect(result.success).toBe(false);
    expect(result.error).toContain('deprecated');
  });

  it('applies resource overrides within maximum', () => {
    const genome = createTestGenome();
    registerGenome(genome);

    const result = instantiateGenome({
      genomeHash: genome.identity.hash,
      resourceOverrides: { cpuMs: 5000 },
    });
    expect(result.success).toBe(true);
    expect(result.effectiveResources.cpuMs).toBe(5000);
  });

  it('does not grant nascent capabilities', () => {
    const genome = createTestGenome('nascent-test', {
      capabilities: [
        makeCapability({ id: 'mature', maturity: 'proficient' }),
        makeCapability({ id: 'immature', maturity: 'nascent' }),
      ],
    });
    registerGenome(genome);

    const result = instantiateGenome({ genomeHash: genome.identity.hash });
    expect(result.grantedCapabilities).toContain('mature');
    expect(result.grantedCapabilities).not.toContain('immature');
  });

  it('increments active instances on success', () => {
    const genome = createTestGenome();
    registerGenome(genome);

    instantiateGenome({ genomeHash: genome.identity.hash });
    instantiateGenome({ genomeHash: genome.identity.hash });

    const entry = getGenome(genome.identity.hash);
    expect(entry.activeInstances).toBe(2);
  });
});

describe('Pre-flight Verification', () => {
  it('passes all checks for a valid genome', () => {
    const genome = createTestGenome();
    const verification = preFlightVerify(genome, { genomeHash: genome.identity.hash });
    expect(verification.passed).toBe(true);
    expect(verification.checks.every(c => c.passed || c.severity === 'warning' || c.severity === 'info')).toBe(true);
  });

  it('fails on unsupported spec version', () => {
    const genome = createTestGenome();
    genome.identity.specVersion = '2.0.0';
    const verification = preFlightVerify(genome, { genomeHash: genome.identity.hash });
    expect(verification.passed).toBe(false);
    expect(verification.checks.find(c => c.name === 'spec_version_compatible').passed).toBe(false);
  });

  it('warns when no signatures present', () => {
    const genome = createTestGenome();
    const verification = preFlightVerify(genome, { genomeHash: genome.identity.hash });
    const sigCheck = verification.checks.find(c => c.name === 'signature_present');
    expect(sigCheck.passed).toBe(false);
    expect(sigCheck.severity).toBe('warning');
  });
});

describe('Genome Lineage', () => {
  it('tracks lineage across generations', () => {
    const g1 = createTestGenome();
    registerGenome(g1);

    const g2 = forkGenome(g1.identity.hash, { version: '1.1.0', author: 'test', reason: 'gen 1' });
    registerGenome(g2);

    const g3 = forkGenome(g2.identity.hash, { version: '1.2.0', author: 'test', reason: 'gen 2' });
    registerGenome(g3);

    const lineage = getLineage({ lineageId: g1.identity.lineageId });
    expect(lineage.totalGenerations).toBe(3);
    expect(lineage.genomes).toHaveLength(3);
    expect(lineage.genomes[0].generation).toBe(0);
    expect(lineage.genomes[1].generation).toBe(1);
    expect(lineage.genomes[2].generation).toBe(2);
  });

  it('throws for unknown lineage', () => {
    expect(() => getLineage({ lineageId: '00000000-0000-0000-0000-000000000000' })).toThrow(GenomeError);
  });
});

describe('Genome Deprecation', () => {
  it('deprecates a genome', () => {
    const g1 = createTestGenome();
    registerGenome(g1);

    deprecateGenome(g1.identity.hash);

    const entry = getGenome(g1.identity.hash);
    expect(entry.genome.lineage.deprecated).toBe(true);
  });

  it('deprecates with replacement pointer', () => {
    const g1 = createTestGenome();
    registerGenome(g1);

    const g2 = forkGenome(g1.identity.hash, { version: '2.0.0', author: 'test', reason: 'replace' });
    registerGenome(g2);

    deprecateGenome(g1.identity.hash, g2.identity.hash);

    const entry = getGenome(g1.identity.hash);
    expect(entry.genome.lineage.deprecated).toBe(true);
    expect(entry.genome.lineage.replacedBy).toBe(g2.identity.hash);
  });
});

describe('Registry Stats', () => {
  it('returns accurate stats', () => {
    registerGenome(createTestGenome('agent-1'));
    registerGenome(createTestGenome('agent-2'));

    const stats = getRegistryStats();
    expect(stats.totalGenomes).toBe(2);
    expect(stats.totalLineages).toBe(2);
    expect(stats.topTags.length).toBeGreaterThan(0);
  });

  it('returns empty stats for empty registry', () => {
    const stats = getRegistryStats();
    expect(stats.totalGenomes).toBe(0);
    expect(stats.avgFitness).toBe(0);
  });
});
