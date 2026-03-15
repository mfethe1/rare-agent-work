/**
 * A2A Agent Genome — Portable Agent Specification Protocol
 *
 * Public API for the Agent Genome subsystem. Provides the universal container
 * format for autonomous agents — a declarative specification that captures
 * everything an agent IS: its capabilities, constraints, resource needs,
 * cognitive architecture, communication protocols, evolution history,
 * composition rules, and cryptographic provenance.
 *
 * The genome is to agents what Docker images are to containers: a portable,
 * versioned, signable, diffable, composable specification that any compliant
 * runtime can instantiate.
 */

export {
  // Genome construction
  createGenome,
  forkGenome,
  // Hashing & integrity
  computeGenomeHash,
  verifyGenomeIntegrity,
  // Registry operations
  registerGenome,
  getGenome,
  getLatestGenome,
  getGenomeByVersion,
  searchGenomes,
  deprecateGenome,
  getRegistryStats,
  // Validation
  validateGenome,
  // Diffing
  diffGenomes,
  // Instantiation
  preFlightVerify,
  instantiateGenome,
  // Lineage
  getLineage,
  // Error
  GenomeError,
  // Testing
  _resetGenomeRegistry,
} from './engine';

export type { GenomeRegistryStats } from './engine';
