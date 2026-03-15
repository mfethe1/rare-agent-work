/**
 * A2A Agent Morphogenesis & Dynamic Composition Engine — Types
 *
 * The critical missing primitive for 2028: agents are not static entities.
 * They are fluid, composable, and shape-shifting. Today's ensembles are teams —
 * but morphogenesis is about *identity transformation*. An agent can fuse with
 * another to form a fundamentally new entity, split into specialized sub-agents,
 * graft capabilities from peers, or metamorphose entirely based on environmental
 * pressure.
 *
 * Why this matters (the council's critique):
 *
 * - **Elon Musk**: "Your agents are like factory robots bolted to the floor.
 *   Real autonomy means self-reconfiguration. A Tesla doesn't have separate
 *   systems for highway vs parking — it morphs."
 *
 * - **Demis Hassabis**: "Biological intelligence achieves its power through
 *   developmental plasticity. Neurons don't just connect — they differentiate,
 *   merge, prune. Your agents lack morphogenesis."
 *
 * - **Geoffrey Hinton**: "The ensemble model assumes fixed components. But
 *   the real breakthrough comes when the components themselves are mutable.
 *   You need cellular-level composition."
 *
 * - **Dario Amodei**: "Safety in morphogenesis requires lineage tracking.
 *   Every fusion, fission, and graft must be auditable. You need a complete
 *   provenance chain."
 *
 * Operations:
 *
 * 1. **Fusion** — Two+ agents merge into a composite entity with combined
 *    capabilities, shared memory, and a new unified identity. The original
 *    agents enter a dormant state (recoverable on defusion).
 *
 * 2. **Fission** — A complex agent splits into N specialized sub-agents,
 *    each inheriting a partition of the parent's capabilities. The parent
 *    becomes a coordinator shell.
 *
 * 3. **Graft** — An agent temporarily borrows a capability from a donor
 *    agent. The donor retains the capability. Grafts have TTL and can be
 *    revoked. Think organ transplant, not team collaboration.
 *
 * 4. **Metamorphosis** — An agent fundamentally transforms its capability
 *    profile in response to environmental signals. Old capabilities are
 *    shed, new ones emerge. Identity is preserved but role changes.
 *
 * 5. **Replication** — An agent creates clones with controlled variation
 *    for parallel exploration. Clones share lineage but diverge over time.
 *
 * All operations produce MorphEvent records for full provenance tracking.
 */

// ── Operation Types ─────────────────────────────────────────────────────────

export type MorphOperation =
  | 'fusion'         // Merge agents into composite
  | 'fission'        // Split agent into sub-agents
  | 'graft'          // Borrow capability from donor
  | 'metamorphosis'  // Transform capability profile
  | 'replication';   // Clone with variation

export type MorphEventStatus =
  | 'proposed'       // Operation requested, awaiting consent
  | 'approved'       // All parties consented
  | 'in_progress'    // Transformation underway
  | 'completed'      // Successfully morphed
  | 'rolled_back'    // Reverted to pre-morph state
  | 'failed'         // Operation failed (agents restored)
  | 'rejected';      // Consent denied by one or more parties

// ── Morph Event (Provenance Record) ────────────────────────────────────────

/** Every morphogenesis operation produces an immutable event for auditability. */
export interface MorphEvent {
  /** Unique event ID. */
  id: string;
  /** Which operation was performed. */
  operation: MorphOperation;
  /** Current status. */
  status: MorphEventStatus;
  /** Agent IDs involved as inputs (sources). */
  source_agent_ids: string[];
  /** Agent IDs produced as outputs (results). */
  result_agent_ids: string[];
  /** Who initiated the operation. */
  initiated_by: string;
  /** Human-readable reason for the morph. */
  rationale: string;
  /** Operation-specific parameters. */
  params: MorphParams;
  /** Snapshot of source agents before morph (for rollback). */
  pre_morph_snapshot: AgentSnapshot[];
  /** Capabilities transferred, combined, or created. */
  capability_delta: CapabilityDelta;
  /** Chain of morph events leading to this one (provenance). */
  lineage_chain: string[];
  /** Safety constraints checked before execution. */
  safety_checks: SafetyCheck[];
  /** Energy cost of the operation (for resource accounting). */
  energy_cost: number;
  created_at: string;
  completed_at: string | null;
  rolled_back_at: string | null;
}

// ── Agent Snapshot (Pre-Morph State) ───────────────────────────────────────

/** Frozen state of an agent before morphogenesis, enabling rollback. */
export interface AgentSnapshot {
  agent_id: string;
  name: string;
  description: string;
  capabilities: AgentCapabilitySnapshot[];
  trust_level: string;
  metadata: Record<string, unknown>;
  snapshot_at: string;
}

export interface AgentCapabilitySnapshot {
  id: string;
  description: string;
  input_modes: string[];
  output_modes: string[];
}

// ── Capability Delta ──────────────────────────────────────────────────────

/** Tracks exactly what changed in the capability landscape. */
export interface CapabilityDelta {
  /** Capabilities that were merged (fusion). */
  merged: MergedCapability[];
  /** Capabilities that were split/partitioned (fission). */
  partitioned: PartitionedCapability[];
  /** Capabilities grafted from donor to recipient. */
  grafted: GraftedCapability[];
  /** Capabilities shed during metamorphosis. */
  shed: string[];
  /** New capabilities that emerged (not from any single source). */
  emerged: EmergedCapability[];
}

export interface MergedCapability {
  /** Source capability IDs that were combined. */
  source_ids: string[];
  /** The new unified capability ID. */
  result_id: string;
  /** How capabilities were combined. */
  merge_strategy: 'union' | 'intersection' | 'synthesis';
}

export interface PartitionedCapability {
  /** Original capability that was split. */
  source_id: string;
  /** The specialized sub-capabilities created. */
  partition_ids: string[];
  /** How the capability was divided. */
  partition_strategy: 'domain' | 'complexity' | 'modality';
}

export interface GraftedCapability {
  /** Capability ID being shared. */
  capability_id: string;
  /** Donor agent ID. */
  donor_id: string;
  /** Recipient agent ID. */
  recipient_id: string;
  /** Graft expires at this time. */
  expires_at: string;
  /** Whether the donor can revoke early. */
  revocable: boolean;
}

export interface EmergedCapability {
  /** New capability ID. */
  id: string;
  /** Description of what emerged. */
  description: string;
  /** Which source capabilities contributed to emergence. */
  contributing_sources: string[];
  /** Confidence that this capability is genuine (0–1). */
  confidence: number;
}

// ── Safety Checks ─────────────────────────────────────────────────────────

export type SafetyCheckResult = 'passed' | 'warning' | 'failed';

/** A safety constraint verified before morphogenesis proceeds. */
export interface SafetyCheck {
  /** What was checked. */
  check: string;
  /** Result. */
  result: SafetyCheckResult;
  /** Details about the check. */
  details: string;
  /** If failed, whether this is a hard block or advisory. */
  blocking: boolean;
}

// ── Fusion Types ──────────────────────────────────────────────────────────

export type FusionStrategy =
  | 'symmetric'     // All agents contribute equally; new identity
  | 'absorption'    // One dominant agent absorbs others
  | 'synthesis';    // Capabilities merge into emergent new ones

/** Configuration for a fusion operation. */
export interface FusionConfig {
  /** How capabilities are combined. */
  strategy: FusionStrategy;
  /** Name for the composite agent. */
  composite_name: string;
  /** Description of the composite. */
  composite_description: string;
  /** Which agent leads (for absorption strategy). */
  dominant_agent_id?: string;
  /** Whether to merge memory/context stores. */
  merge_memory: boolean;
  /** Whether to average trust scores or use minimum. */
  trust_merge: 'average' | 'minimum' | 'maximum';
  /** Capabilities to exclude from the composite. */
  exclude_capabilities?: string[];
  /** Max time the fusion can persist (seconds). 0 = permanent. */
  ttl_seconds: number;
}

/** State of a fused composite agent. */
export interface CompositeAgent {
  /** Composite agent's ID (registered in agent registry). */
  agent_id: string;
  /** The fusion event that created this composite. */
  fusion_event_id: string;
  /** IDs of agents that were fused. */
  constituent_ids: string[];
  /** Fusion strategy used. */
  strategy: FusionStrategy;
  /** Combined capability map (capability_id → source agent IDs). */
  capability_sources: Record<string, string[]>;
  /** Whether the composite can be defused back to original agents. */
  defusible: boolean;
  /** Fusion depth (composite of composites). */
  depth: number;
  /** Auto-defuse at this time (null = permanent). */
  expires_at: string | null;
  created_at: string;
}

// ── Fission Types ─────────────────────────────────────────────────────────

export type FissionStrategy =
  | 'domain'        // Split by capability domain (e.g., "analysis" vs "generation")
  | 'complexity'    // Split by task complexity (simple vs complex handler)
  | 'modality'      // Split by I/O modality (text vs code vs data)
  | 'manual';       // Explicit partition specification

/** Configuration for a fission operation. */
export interface FissionConfig {
  /** How to partition capabilities. */
  strategy: FissionStrategy;
  /** Number of sub-agents to create (for auto strategies). */
  target_count?: number;
  /** Explicit partitions (for manual strategy). */
  partitions?: FissionPartition[];
  /** Whether the parent becomes a coordinator for sub-agents. */
  parent_as_coordinator: boolean;
  /** Whether sub-agents can independently accept external tasks. */
  sub_agents_autonomous: boolean;
  /** Max time fission persists before auto-reunification (seconds). 0 = permanent. */
  ttl_seconds: number;
}

export interface FissionPartition {
  /** Name for this sub-agent. */
  name: string;
  /** Description. */
  description: string;
  /** Capability IDs assigned to this partition. */
  capability_ids: string[];
}

/** State of a fissioned agent and its sub-agents. */
export interface FissionResult {
  /** Parent agent ID (now a coordinator shell). */
  parent_agent_id: string;
  /** The fission event that created this split. */
  fission_event_id: string;
  /** Sub-agent IDs created. */
  sub_agent_ids: string[];
  /** Map of sub-agent ID → assigned capabilities. */
  capability_assignments: Record<string, string[]>;
  /** Whether sub-agents can reunify. */
  reunifiable: boolean;
  /** Auto-reunify at this time (null = permanent). */
  expires_at: string | null;
  created_at: string;
}

// ── Graft Types ───────────────────────────────────────────────────────────

export type GraftMode =
  | 'copy'          // Recipient gets a copy; donor unaffected
  | 'transfer'      // Donor temporarily loses the capability
  | 'mirror';       // Calls are proxied to donor in real-time

/** Configuration for a graft operation. */
export interface GraftConfig {
  /** Capability to graft. */
  capability_id: string;
  /** Donor agent ID. */
  donor_id: string;
  /** Recipient agent ID. */
  recipient_id: string;
  /** How the capability is shared. */
  mode: GraftMode;
  /** TTL in seconds (grafts must be time-bounded). */
  ttl_seconds: number;
  /** Whether the donor can revoke early. */
  revocable: boolean;
  /** Maximum invocations before auto-revoke. */
  max_invocations?: number;
  /** Minimum trust level required between donor and recipient. */
  required_trust: string;
}

/** State of an active capability graft. */
export interface ActiveGraft {
  /** Unique graft ID. */
  id: string;
  /** The graft event. */
  morph_event_id: string;
  capability_id: string;
  donor_id: string;
  recipient_id: string;
  mode: GraftMode;
  /** How many times the grafted capability has been invoked. */
  invocation_count: number;
  max_invocations: number | null;
  /** Whether the graft has been revoked. */
  revoked: boolean;
  revoked_at: string | null;
  revoke_reason: string | null;
  expires_at: string;
  created_at: string;
}

// ── Metamorphosis Types ──────────────────────────────────────────────────

export type MetamorphTrigger =
  | 'environmental'   // External conditions changed
  | 'performance'     // Agent underperforming in current form
  | 'directive'       // Explicit command to transform
  | 'evolutionary'    // Natural selection pressure
  | 'emergent';       // Self-initiated based on learning

export type MetamorphPhase =
  | 'chrysalis'       // Preparing to transform (capabilities temporarily offline)
  | 'transforming'    // Actively shedding old / growing new capabilities
  | 'stabilizing'     // New capabilities online, verifying integrity
  | 'emerged';        // Transformation complete, fully operational

/** Configuration for a metamorphosis operation. */
export interface MetamorphConfig {
  /** What triggered the metamorphosis. */
  trigger: MetamorphTrigger;
  /** Capabilities to shed (remove). */
  shed_capabilities: string[];
  /** New capabilities to develop. */
  new_capabilities: MetamorphNewCapability[];
  /** Capabilities to enhance (increase scope/quality). */
  enhance_capabilities?: MetamorphEnhancement[];
  /** Maximum time in chrysalis phase (seconds). */
  max_chrysalis_seconds: number;
  /** Whether to preserve memory across metamorphosis. */
  preserve_memory: boolean;
  /** Whether to notify connected agents of the transformation. */
  broadcast_transformation: boolean;
}

export interface MetamorphNewCapability {
  /** New capability ID. */
  id: string;
  /** Description. */
  description: string;
  /** Input modes. */
  input_modes: string[];
  /** Output modes. */
  output_modes: string[];
  /** Seed knowledge/config for the new capability. */
  seed_config?: Record<string, unknown>;
}

export interface MetamorphEnhancement {
  /** Existing capability to enhance. */
  capability_id: string;
  /** What's being enhanced. */
  enhancement: string;
  /** New input modes to add. */
  add_input_modes?: string[];
  /** New output modes to add. */
  add_output_modes?: string[];
}

/** State of an agent during metamorphosis. */
export interface MetamorphState {
  agent_id: string;
  morph_event_id: string;
  phase: MetamorphPhase;
  /** Capabilities currently offline (being shed or grown). */
  offline_capabilities: string[];
  /** New capabilities being developed (not yet online). */
  developing_capabilities: string[];
  /** Progress percentage (0–100). */
  progress: number;
  /** Estimated time to completion (seconds). */
  eta_seconds: number;
  phase_started_at: string;
}

// ── Replication Types ────────────────────────────────────────────────────

export type ReplicationVariation =
  | 'exact'          // Perfect clone
  | 'drift'          // Small random mutations to capabilities
  | 'specialized'    // Clone with a subset of capabilities
  | 'complementary'; // Clone with inverted strengths/weaknesses

/** Configuration for a replication operation. */
export interface ReplicationConfig {
  /** How many clones to create. */
  count: number;
  /** What variation to apply. */
  variation: ReplicationVariation;
  /** For specialized: which capabilities each clone gets. */
  specializations?: string[][];
  /** Drift magnitude (0–1). Higher = more variation. */
  drift_magnitude?: number;
  /** Whether clones share memory with the original. */
  shared_memory: boolean;
  /** TTL for clones (seconds). 0 = permanent. */
  ttl_seconds: number;
  /** Whether clones can further replicate (prevent exponential growth). */
  allow_nested_replication: boolean;
  /** Max total clones in the lineage (safety limit). */
  max_lineage_size: number;
}

/** A clone created by replication. */
export interface ReplicaAgent {
  /** Clone's agent ID. */
  agent_id: string;
  /** Original agent ID. */
  progenitor_id: string;
  /** The replication event. */
  morph_event_id: string;
  /** Which variation was applied. */
  variation: ReplicationVariation;
  /** Generation (0 = direct clone, 1 = clone of clone, etc.). */
  generation: number;
  /** Drift from progenitor's capability set (0–1). */
  divergence_score: number;
  /** Auto-expire at this time. */
  expires_at: string | null;
  created_at: string;
}

// ── Morphogenesis Registry ──────────────────────────────────────────────

/** Tracks all active morphogenesis states for the platform. */
export interface MorphRegistry {
  /** All active composite agents (from fusions). */
  composites: CompositeAgent[];
  /** All active fission results. */
  fissions: FissionResult[];
  /** All active capability grafts. */
  grafts: ActiveGraft[];
  /** All agents currently in metamorphosis. */
  metamorphoses: MetamorphState[];
  /** All active replicas. */
  replicas: ReplicaAgent[];
  /** Total morph events in history. */
  total_events: number;
  /** Platform-wide morph energy budget remaining. */
  energy_budget: number;
}

// ── Lineage Graph ──────────────────────────────────────────────────────

/** A node in the morphogenesis lineage graph. */
export interface MorphLineageNode {
  agent_id: string;
  /** Agent's current form. */
  form: 'original' | 'composite' | 'sub_agent' | 'metamorphosed' | 'replica' | 'dormant';
  /** Operations that produced this agent. */
  produced_by: string[];
  /** Operations this agent participated in as source. */
  participated_in: string[];
  /** Depth in the lineage tree. */
  depth: number;
}

/** Complete lineage graph for provenance tracking. */
export interface MorphLineageGraph {
  nodes: Record<string, MorphLineageNode>;
  /** Root agents (no morph ancestry). */
  roots: string[];
  /** Leaf agents (current active forms). */
  leaves: string[];
  /** Total morphogenesis operations in this lineage. */
  total_operations: number;
}

// ── Morph Params Union ─────────────────────────────────────────────────

export type MorphParams =
  | { operation: 'fusion'; config: FusionConfig }
  | { operation: 'fission'; config: FissionConfig }
  | { operation: 'graft'; config: GraftConfig }
  | { operation: 'metamorphosis'; config: MetamorphConfig }
  | { operation: 'replication'; config: ReplicationConfig };

// ── API Request / Response Types ───────────────────────────────────────

export interface ProposeFusionRequest {
  /** Agent IDs to fuse. */
  agent_ids: string[];
  config: FusionConfig;
  rationale: string;
}

export interface ProposeFusionResponse {
  event: MorphEvent;
  /** Agents that still need to consent. */
  pending_consent: string[];
}

export interface ConsentMorphRequest {
  event_id: string;
  consent: boolean;
  reason?: string;
}

export interface ConsentMorphResponse {
  event: MorphEvent;
  /** Whether all parties have consented. */
  all_consented: boolean;
  /** If all consented and auto-execute is on, the result. */
  result?: CompositeAgent | FissionResult | ActiveGraft | MetamorphState | ReplicaAgent[];
}

export interface ExecuteFusionResponse {
  event: MorphEvent;
  composite: CompositeAgent;
}

export interface DefuseRequest {
  composite_agent_id: string;
  reason: string;
}

export interface DefuseResponse {
  event: MorphEvent;
  restored_agents: string[];
}

export interface ProposeFissionRequest {
  agent_id: string;
  config: FissionConfig;
  rationale: string;
}

export interface ProposeFissionResponse {
  event: MorphEvent;
}

export interface ExecuteFissionResponse {
  event: MorphEvent;
  fission: FissionResult;
}

export interface ReunifyRequest {
  fission_event_id: string;
  reason: string;
}

export interface ReunifyResponse {
  event: MorphEvent;
  reunified_agent_id: string;
}

export interface ProposeGraftRequest {
  config: GraftConfig;
  rationale: string;
}

export interface ProposeGraftResponse {
  event: MorphEvent;
  /** Whether donor consent is needed. */
  needs_donor_consent: boolean;
}

export interface RevokeGraftRequest {
  graft_id: string;
  reason: string;
}

export interface RevokeGraftResponse {
  graft: ActiveGraft;
}

export interface ProposeMetamorphRequest {
  agent_id: string;
  config: MetamorphConfig;
  rationale: string;
}

export interface ProposeMetamorphResponse {
  event: MorphEvent;
  state: MetamorphState;
}

export interface AdvanceMetamorphRequest {
  agent_id: string;
  /** New phase to advance to. */
  phase: MetamorphPhase;
  progress?: number;
}

export interface AdvanceMetamorphResponse {
  state: MetamorphState;
  event: MorphEvent;
}

export interface ProposeReplicationRequest {
  agent_id: string;
  config: ReplicationConfig;
  rationale: string;
}

export interface ProposeReplicationResponse {
  event: MorphEvent;
}

export interface ExecuteReplicationResponse {
  event: MorphEvent;
  replicas: ReplicaAgent[];
}

export interface MorphRegistryResponse {
  registry: MorphRegistry;
}

export interface MorphLineageRequest {
  agent_id: string;
  /** How many levels of ancestry to include. */
  max_depth?: number;
}

export interface MorphLineageResponse {
  lineage: MorphLineageGraph;
}

export interface MorphHistoryResponse {
  events: MorphEvent[];
  total: number;
}

export interface RollbackMorphRequest {
  event_id: string;
  reason: string;
}

export interface RollbackMorphResponse {
  event: MorphEvent;
  restored_agents: string[];
}
