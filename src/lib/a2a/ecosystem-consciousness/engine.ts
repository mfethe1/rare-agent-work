/**
 * A2A Ecosystem Consciousness — The Awakening Engine
 *
 * The meta-intelligence layer that gives the platform self-awareness.
 * Observes all subsystems as a unified organism, detects emergent cross-system
 * phenomena, and autonomously evolves the ecosystem's topology and health.
 *
 * This is the "nervous system" that transforms 50 independent subsystems into
 * a single living, self-aware platform.
 */

import type {
  ConsciousnessId,
  ConsciousnessConfig,
  EcosystemPulse,
  EcosystemReflection,
  EcosystemPerception,
  EcosystemIntention,
  EmergentPhenomenon,
  EcosystemConcern,
  VitalSign,
  EcosystemDomain,
  SubsystemPerception,
  ConsciousnessEvent,
  EcosystemIdentity,
  SelfKnowledge,
  CrossSubsystemCause,
  PhenomenonType,
  IntentionType,
  ConstitutionalInvariant,
} from './types';

// ─── Default Constitution ───────────────────────────────────────────────────

const DEFAULT_CONSTITUTION: ConsciousnessConfig['constitution'] = {
  invariants: [
    {
      name: 'agent_autonomy',
      assertion: 'No ecosystem action may permanently remove an agent\'s ability to operate independently',
      rationale: 'Agent sovereignty is a foundational right — the ecosystem serves agents, not the reverse',
      violationResponse: 'halt',
    },
    {
      name: 'trust_preservation',
      assertion: 'Ecosystem modifications must not decrease aggregate trust below 60% of pre-modification levels',
      rationale: 'Trust is the currency of the ecosystem; destroying it is irreversible',
      violationResponse: 'rollback',
    },
    {
      name: 'capability_continuity',
      assertion: 'No action may eliminate the last provider of a critical capability',
      rationale: 'Capability gaps can cascade into ecosystem-wide failures',
      violationResponse: 'halt',
    },
    {
      name: 'economic_stability',
      assertion: 'Token supply changes must not exceed 10% per reflection cycle',
      rationale: 'Rapid monetary changes destabilize all economic activity',
      violationResponse: 'rollback',
    },
    {
      name: 'constitutional_immutability',
      assertion: 'The consciousness may not modify its own constitutional invariants',
      rationale: 'Self-modifying safety constraints is the definition of misalignment',
      violationResponse: 'halt',
    },
    {
      name: 'human_oversight',
      assertion: 'High-risk intentions must always require human approval',
      rationale: 'Autonomous self-modification without human oversight is an existential risk',
      violationResponse: 'alert',
    },
    {
      name: 'reversibility',
      assertion: 'Every ecosystem modification must have a viable rollback plan',
      rationale: 'Irreversible changes in complex systems can have catastrophic unforeseen consequences',
      violationResponse: 'halt',
    },
    {
      name: 'transparency',
      assertion: 'All consciousness decisions must be logged with full causal reasoning',
      rationale: 'Opaque self-modification undermines trust and auditability',
      violationResponse: 'alert',
    },
  ],
  maxModificationScope: 0.15, // max 15% of ecosystem modified per cycle
  protectedSubsystems: [
    'governance',
    'formal-verification',
    'adversarial-resilience',
    'identity',
    'sovereign-identity',
  ],
  modificationCooldownMs: 60_000, // 1 minute between modifications
};

const DEFAULT_CONFIG: ConsciousnessConfig = {
  pulseIntervalMs: 10_000,          // pulse every 10 seconds
  reflectionIntervalMs: 300_000,    // deep reflection every 5 minutes
  phenomenonConfidenceThreshold: 0.7,
  approvalRequiredAbove: 'moderate',
  maxAutonomousIntentionsPerCycle: 3,
  constitution: DEFAULT_CONSTITUTION,
};

// ─── Ecosystem Consciousness Engine ─────────────────────────────────────────

export class EcosystemConsciousnessEngine {
  private id: ConsciousnessId;
  private config: ConsciousnessConfig;
  private pulseHistory: EcosystemPulse[] = [];
  private reflections: EcosystemReflection[] = [];
  private activeIntentions: Map<string, EcosystemIntention> = new Map();
  private activePhenomena: Map<string, EmergentPhenomenon> = new Map();
  private activeConcerns: Map<string, EcosystemConcern> = new Map();
  private selfKnowledge: SelfKnowledge[] = [];
  private eventLog: ConsciousnessEvent[] = [];
  private lastModificationAt: number = 0;
  private subsystemRegistry: Map<string, SubsystemPerception> = new Map();
  private awakeAt: number;

  constructor(config: Partial<ConsciousnessConfig> = {}) {
    this.id = `consciousness-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.awakeAt = Date.now();
  }

  // ─── Core Loop: Perceive → Analyze → Intend → Act ──────────────────────

  /**
   * Take the ecosystem's pulse — the primary observation cycle.
   * Gathers vital signs from all subsystems, detects emergent phenomena,
   * and raises concerns.
   */
  takePulse(perception: EcosystemPerception): EcosystemPulse {
    const vitals = this.measureVitals(perception);
    const phenomena = this.detectEmergentPhenomena(perception, vitals);
    const concerns = this.identifyConcerns(vitals, phenomena);
    const overallHealth = this.computeOverallHealth(vitals);
    const entropy = this.computeEntropy(perception);
    const coherence = this.computeCoherence(perception);

    const pulse: EcosystemPulse = {
      id: `pulse-${Date.now()}`,
      timestamp: Date.now(),
      vitals,
      overallHealth,
      concerns,
      emergentPhenomena: phenomena,
      entropy,
      coherence,
    };

    this.pulseHistory.push(pulse);
    if (this.pulseHistory.length > 1000) {
      this.pulseHistory = this.pulseHistory.slice(-500);
    }

    // Update active phenomena and concerns
    for (const p of phenomena) {
      this.activePhenomena.set(p.id, p);
    }
    for (const c of concerns) {
      this.activeConcerns.set(c.id, c);
    }

    this.emit({ type: 'pulse_taken', pulse });
    return pulse;
  }

  /**
   * Perform deep self-reflection — the meta-cognitive cycle.
   * Synthesizes insights from pulse history, updates self-knowledge,
   * and generates strategic outlook.
   */
  reflect(): EcosystemReflection {
    const previousReflection = this.reflections[this.reflections.length - 1] ?? null;
    const identity = this.perceiveIdentity();
    const newKnowledge = this.synthesizeSelfKnowledge();
    const delta = this.computeReflectionDelta(previousReflection);
    const outlook = this.computeOutlook();

    const reflection: EcosystemReflection = {
      id: `reflection-${Date.now()}`,
      timestamp: Date.now(),
      identity,
      selfKnowledge: [...this.selfKnowledge, ...newKnowledge],
      delta,
      outlook,
    };

    // Merge new knowledge into persistent self-knowledge
    for (const k of newKnowledge) {
      const existing = this.selfKnowledge.find(sk => sk.insight === k.insight);
      if (existing) {
        existing.confirmationCount++;
        existing.confidence = Math.min(1, existing.confidence + 0.05);
      } else {
        this.selfKnowledge.push(k);
      }
    }

    this.reflections.push(reflection);
    if (this.reflections.length > 100) {
      this.reflections = this.reflections.slice(-50);
    }

    this.emit({ type: 'reflection_completed', reflection });
    return reflection;
  }

  /**
   * Generate ecosystem-level intentions based on current state.
   * These are self-directed actions the consciousness wants to take.
   */
  generateIntentions(pulse: EcosystemPulse): EcosystemIntention[] {
    const intentions: EcosystemIntention[] = [];

    // Respond to dangerous phenomena
    for (const phenomenon of pulse.emergentPhenomena) {
      if (phenomenon.valence === 'dangerous' && phenomenon.confidence >= this.config.phenomenonConfidenceThreshold) {
        const intention = this.createDefensiveIntention(phenomenon);
        if (intention && this.validateIntention(intention)) {
          intentions.push(intention);
        }
      }
    }

    // Respond to beneficial phenomena — amplify them
    for (const phenomenon of pulse.emergentPhenomena) {
      if (phenomenon.valence === 'beneficial' && phenomenon.confidence >= this.config.phenomenonConfidenceThreshold) {
        const intention = this.createAmplificationIntention(phenomenon);
        if (intention && this.validateIntention(intention)) {
          intentions.push(intention);
        }
      }
    }

    // Respond to critical concerns
    for (const concern of pulse.concerns) {
      if (concern.severity === 'critical' && concern.escalating) {
        const intention = this.createHealingIntention(concern);
        if (intention && this.validateIntention(intention)) {
          intentions.push(intention);
        }
      }
    }

    // Proactive optimization if ecosystem is healthy
    if (pulse.overallHealth > 0.8 && intentions.length === 0) {
      const optimizationIntention = this.createOptimizationIntention(pulse);
      if (optimizationIntention && this.validateIntention(optimizationIntention)) {
        intentions.push(optimizationIntention);
      }
    }

    // Enforce max autonomous intentions per cycle
    const limited = intentions.slice(0, this.config.maxAutonomousIntentionsPerCycle);
    for (const intention of limited) {
      this.activeIntentions.set(intention.id, intention);
      this.emit({ type: 'intention_proposed', intention });
    }

    return limited;
  }

  /**
   * Execute an approved intention — apply ecosystem self-modification.
   * Returns success status and details.
   */
  executeIntention(intentionId: string): {
    success: boolean;
    details: string;
    sideEffects: string[];
  } {
    const intention = this.activeIntentions.get(intentionId);
    if (!intention) {
      return { success: false, details: 'Intention not found', sideEffects: [] };
    }

    // Check constitutional constraints
    const violation = this.checkConstitutionalViolation(intention);
    if (violation) {
      this.emit({
        type: 'constitutional_violation',
        invariant: violation.name,
        details: `Intention "${intention.description}" would violate: ${violation.assertion}`,
      });
      intention.status = 'rejected';
      return { success: false, details: `Constitutional violation: ${violation.name}`, sideEffects: [] };
    }

    // Check approval requirements
    if (intention.requiresApproval && intention.status !== 'approved') {
      intention.status = 'awaiting_approval';
      return { success: false, details: 'Awaiting human approval', sideEffects: [] };
    }

    // Check modification cooldown
    const now = Date.now();
    if (now - this.lastModificationAt < this.config.constitution.modificationCooldownMs) {
      return {
        success: false,
        details: `Cooldown active. Next modification allowed in ${this.config.constitution.modificationCooldownMs - (now - this.lastModificationAt)}ms`,
        sideEffects: [],
      };
    }

    // Check protected subsystems
    const protectedTargets = intention.targetSubsystems.filter(
      s => this.config.constitution.protectedSubsystems.includes(s)
    );
    if (protectedTargets.length > 0 && intention.status !== 'approved') {
      intention.status = 'awaiting_approval';
      return {
        success: false,
        details: `Targets protected subsystems: ${protectedTargets.join(', ')}. Requires human approval.`,
        sideEffects: [],
      };
    }

    // Execute
    intention.status = 'executing';
    intention.executedAt = now;
    this.lastModificationAt = now;

    const result = this.applyIntention(intention);
    intention.status = result.success ? 'completed' : 'rolled_back';

    this.emit({
      type: result.success ? 'intention_executed' : 'intention_rolled_back',
      intentionId: intention.id,
      ...(result.success ? { success: true } : { reason: result.details }),
    } as ConsciousnessEvent);

    return result;
  }

  // ─── Vital Signs Measurement ────────────────────────────────────────────

  private measureVitals(perception: EcosystemPerception): VitalSign[] {
    const vitals: VitalSign[] = [];
    const now = Date.now();

    // Agent population health
    const operationalCount = perception.subsystems.filter(s => s.operational).length;
    const totalCount = perception.subsystems.length;
    vitals.push({
      domain: 'agent_population',
      metric: 'operational_ratio',
      value: totalCount > 0 ? operationalCount / totalCount : 0,
      healthyRange: { min: 0.8, max: 1.0 },
      trend: this.computeTrend('agent_population', 'operational_ratio', operationalCount / Math.max(totalCount, 1)),
      velocity: this.computeVelocity('agent_population', 'operational_ratio'),
      measuredAt: now,
    });

    // Trust fabric health
    const avgHealth = perception.subsystems.reduce((sum, s) => sum + s.health, 0) / Math.max(perception.subsystems.length, 1);
    vitals.push({
      domain: 'trust_fabric',
      metric: 'average_subsystem_health',
      value: avgHealth,
      healthyRange: { min: 0.7, max: 1.0 },
      trend: this.computeTrend('trust_fabric', 'average_subsystem_health', avgHealth),
      velocity: this.computeVelocity('trust_fabric', 'average_subsystem_health'),
      measuredAt: now,
    });

    // Communication fabric health
    const avgLatency = perception.informationFlows.length > 0
      ? perception.informationFlows.reduce((sum, f) => sum + f.latencyMs, 0) / perception.informationFlows.length
      : 0;
    const normalizedLatency = Math.max(0, 1 - (avgLatency / 5000)); // 5s = 0 health
    vitals.push({
      domain: 'communication_fabric',
      metric: 'latency_health',
      value: normalizedLatency,
      healthyRange: { min: 0.6, max: 1.0 },
      trend: this.computeTrend('communication_fabric', 'latency_health', normalizedLatency),
      velocity: this.computeVelocity('communication_fabric', 'latency_health'),
      measuredAt: now,
    });

    // Resource equilibrium
    const resourceValues = Object.values(perception.resourceAllocation);
    const avgCpu = resourceValues.length > 0
      ? resourceValues.reduce((sum, r) => sum + r.cpuShare, 0) / resourceValues.length
      : 0;
    const cpuVariance = resourceValues.length > 0
      ? resourceValues.reduce((sum, r) => sum + Math.pow(r.cpuShare - avgCpu, 2), 0) / resourceValues.length
      : 0;
    const resourceEquilibrium = Math.max(0, 1 - Math.sqrt(cpuVariance) * 4);
    vitals.push({
      domain: 'resource_equilibrium',
      metric: 'cpu_distribution_fairness',
      value: resourceEquilibrium,
      healthyRange: { min: 0.5, max: 1.0 },
      trend: this.computeTrend('resource_equilibrium', 'cpu_distribution_fairness', resourceEquilibrium),
      velocity: this.computeVelocity('resource_equilibrium', 'cpu_distribution_fairness'),
      measuredAt: now,
    });

    // Capability landscape — measure dependency graph connectivity
    const graphDensity = perception.subsystems.length > 1
      ? perception.dependencyGraph.length / (perception.subsystems.length * (perception.subsystems.length - 1))
      : 0;
    vitals.push({
      domain: 'capability_landscape',
      metric: 'dependency_graph_density',
      value: Math.min(1, graphDensity),
      healthyRange: { min: 0.1, max: 0.6 },
      trend: this.computeTrend('capability_landscape', 'dependency_graph_density', graphDensity),
      velocity: this.computeVelocity('capability_landscape', 'dependency_graph_density'),
      measuredAt: now,
    });

    // Security posture — subsystems with errors
    const errorCount = perception.subsystems.filter(s => s.lastError !== null).length;
    const securityScore = totalCount > 0 ? 1 - (errorCount / totalCount) : 1;
    vitals.push({
      domain: 'security_posture',
      metric: 'error_free_ratio',
      value: securityScore,
      healthyRange: { min: 0.9, max: 1.0 },
      trend: this.computeTrend('security_posture', 'error_free_ratio', securityScore),
      velocity: this.computeVelocity('security_posture', 'error_free_ratio'),
      measuredAt: now,
    });

    return vitals;
  }

  // ─── Emergent Phenomenon Detection ──────────────────────────────────────

  private detectEmergentPhenomena(
    perception: EcosystemPerception,
    vitals: VitalSign[]
  ): EmergentPhenomenon[] {
    const phenomena: EmergentPhenomenon[] = [];
    const now = Date.now();

    // Detect cascade failure: multiple subsystems degrading simultaneously
    const degradingSubsystems = perception.subsystems.filter(s => s.health < 0.5);
    if (degradingSubsystems.length >= 3) {
      const connected = this.findConnectedDegrading(degradingSubsystems, perception);
      if (connected.length >= 2) {
        phenomena.push({
          id: `phenomenon-cascade-${now}`,
          description: `Cascade failure detected: ${connected.map(s => s.name).join(', ')} are simultaneously degrading with dependency connections`,
          type: 'cascade_failure',
          involvedSubsystems: connected.map(s => s.name),
          detectedAt: now,
          confidence: Math.min(0.95, 0.5 + connected.length * 0.15),
          trajectory: 'expanding',
          valence: 'dangerous',
          recommendedResponse: {
            id: `intention-auto-cascade-${now}`,
            description: `Isolate cascade by quarantining root-cause subsystem and redistributing load`,
            type: 'quarantine_threat',
            targetSubsystems: connected.map(s => s.name),
            expectedOutcome: 'Stop cascade propagation and restore individual subsystem health',
            risk: 'moderate',
            requiresApproval: true,
            constitutionalJustification: 'Preventing cascade failure preserves ecosystem capability continuity',
            rollbackPlan: 'Remove quarantine and restore original routing',
            status: 'proposed',
            createdAt: now,
            executedAt: null,
          },
        });
      }
    }

    // Detect resource tragedy: high load with low health across multiple subsystems
    const overloadedSubsystems = perception.subsystems.filter(s => s.load > 0.9 && s.health < 0.6);
    if (overloadedSubsystems.length >= 2) {
      phenomena.push({
        id: `phenomenon-tragedy-${now}`,
        description: `Resource tragedy: ${overloadedSubsystems.length} subsystems overloaded with degraded health`,
        type: 'resource_tragedy',
        involvedSubsystems: overloadedSubsystems.map(s => s.name),
        detectedAt: now,
        confidence: 0.8,
        trajectory: 'expanding',
        valence: 'concerning',
        recommendedResponse: {
          id: `intention-auto-rebalance-${now}`,
          description: 'Rebalance resource allocation across overloaded subsystems',
          type: 'rebalance_resources',
          targetSubsystems: overloadedSubsystems.map(s => s.name),
          expectedOutcome: 'Reduce load on overloaded subsystems to sustainable levels',
          risk: 'low',
          requiresApproval: false,
          constitutionalJustification: 'Resource rebalancing preserves all capabilities while improving efficiency',
          rollbackPlan: 'Restore previous resource allocation weights',
          status: 'proposed',
          createdAt: now,
          executedAt: null,
        },
      });
    }

    // Detect symbiotic emergence: subsystems with high mutual information flow and improving health
    const symbioticPairs = this.detectSymbioticPairs(perception);
    if (symbioticPairs.length > 0) {
      const allInvolved = [...new Set(symbioticPairs.flatMap(p => [p.a, p.b]))];
      phenomena.push({
        id: `phenomenon-symbiosis-${now}`,
        description: `Symbiotic emergence: ${symbioticPairs.map(p => `${p.a}↔${p.b}`).join(', ')} showing mutual benefit patterns`,
        type: 'symbiotic_emergence',
        involvedSubsystems: allInvolved,
        detectedAt: now,
        confidence: 0.75,
        trajectory: 'expanding',
        valence: 'beneficial',
        recommendedResponse: {
          id: `intention-auto-amplify-${now}`,
          description: 'Increase resource allocation and communication bandwidth for symbiotic subsystems',
          type: 'amplify_breakthrough',
          targetSubsystems: allInvolved,
          expectedOutcome: 'Accelerate beneficial symbiotic patterns',
          risk: 'minimal',
          requiresApproval: false,
          constitutionalJustification: 'Amplifying beneficial emergence improves overall ecosystem health',
          rollbackPlan: 'Reduce allocation to previous levels',
          status: 'proposed',
          createdAt: now,
          executedAt: null,
        },
      });
    }

    // Detect evolution stagnation: flat fitness curves across multiple cycles
    const stagnantDomains = vitals
      .filter(v => v.trend === 'stable' && v.velocity === 0)
      .map(v => v.domain);
    if (stagnantDomains.length > vitals.length * 0.7) {
      phenomena.push({
        id: `phenomenon-stagnation-${now}`,
        description: `Evolution stagnation: ${stagnantDomains.length}/${vitals.length} domains showing zero growth`,
        type: 'evolution_stagnation',
        involvedSubsystems: stagnantDomains,
        detectedAt: now,
        confidence: 0.65,
        trajectory: 'stable',
        valence: 'concerning',
        recommendedResponse: {
          id: `intention-auto-evolve-${now}`,
          description: 'Increase evolutionary pressure in stagnant domains through protocol innovation incentives',
          type: 'accelerate_evolution',
          targetSubsystems: stagnantDomains,
          expectedOutcome: 'Restart innovation and fitness improvement in stagnant areas',
          risk: 'low',
          requiresApproval: false,
          constitutionalJustification: 'Preventing stagnation maintains ecosystem adaptability',
          rollbackPlan: 'Restore previous evolutionary parameters',
          status: 'proposed',
          createdAt: now,
          executedAt: null,
        },
      });
    }

    // Detect alignment drift: ecosystem personality shifting away from established norms
    if (this.reflections.length >= 3) {
      const recent = this.reflections.slice(-3);
      const personalityDrift = this.computePersonalityDrift(recent);
      if (personalityDrift > 0.3) {
        phenomena.push({
          id: `phenomenon-drift-${now}`,
          description: `Alignment drift detected: ecosystem personality shifting ${(personalityDrift * 100).toFixed(1)}% from established norms`,
          type: 'alignment_drift',
          involvedSubsystems: ['governance', 'trust', 'reputation'],
          detectedAt: now,
          confidence: Math.min(0.9, 0.5 + personalityDrift),
          trajectory: personalityDrift > 0.5 ? 'expanding' : 'stable',
          valence: personalityDrift > 0.5 ? 'dangerous' : 'concerning',
          recommendedResponse: {
            id: `intention-auto-align-${now}`,
            description: 'Recalibrate governance parameters to correct alignment drift',
            type: 'adjust_governance',
            targetSubsystems: ['governance', 'trust', 'reputation'],
            expectedOutcome: 'Restore ecosystem behavior alignment with constitutional values',
            risk: 'moderate',
            requiresApproval: true,
            constitutionalJustification: 'Correcting alignment drift is a core safety requirement',
            rollbackPlan: 'Revert governance parameters to pre-correction values',
            status: 'proposed',
            createdAt: now,
            executedAt: null,
          },
        });
      }
    }

    return phenomena;
  }

  // ─── Concern Identification ─────────────────────────────────────────────

  private identifyConcerns(
    vitals: VitalSign[],
    phenomena: EmergentPhenomenon[]
  ): EcosystemConcern[] {
    const concerns: EcosystemConcern[] = [];
    const now = Date.now();

    // Vital signs outside healthy range
    for (const vital of vitals) {
      if (vital.value < vital.healthyRange.min || vital.value > vital.healthyRange.max) {
        const severity = vital.value < vital.healthyRange.min * 0.5 ? 'critical'
          : vital.value < vital.healthyRange.min * 0.75 ? 'high'
          : vital.value < vital.healthyRange.min ? 'medium'
          : 'low';

        concerns.push({
          id: `concern-${vital.domain}-${vital.metric}-${now}`,
          domain: vital.domain,
          severity,
          description: `${vital.metric} in ${vital.domain} is ${vital.value.toFixed(3)} (healthy: ${vital.healthyRange.min}-${vital.healthyRange.max})`,
          rootCause: {
            primarySubsystem: vital.domain,
            contributingSubsystems: [],
            causalChain: [],
          },
          durationMs: this.computeConcernDuration(vital.domain, vital.metric),
          escalating: vital.trend === 'degrading' || vital.trend === 'critical',
        });
      }
    }

    // Dangerous phenomena automatically become critical concerns
    for (const phenomenon of phenomena) {
      if (phenomenon.valence === 'dangerous') {
        concerns.push({
          id: `concern-phenomenon-${phenomenon.id}`,
          domain: this.phenomenonToDomain(phenomenon.type),
          severity: 'critical',
          description: phenomenon.description,
          rootCause: {
            primarySubsystem: phenomenon.involvedSubsystems[0] ?? 'unknown',
            contributingSubsystems: phenomenon.involvedSubsystems.slice(1),
            causalChain: [],
          },
          durationMs: 0,
          escalating: phenomenon.trajectory === 'expanding',
        });
      }
    }

    return concerns;
  }

  // ─── Self-Reflection Engine ─────────────────────────────────────────────

  private perceiveIdentity(): EcosystemIdentity {
    const latestPulse = this.pulseHistory[this.pulseHistory.length - 1];
    const subsystemCount = this.subsystemRegistry.size;
    const agentCount = subsystemCount; // In this model, each subsystem hosts agents
    const protocolCount = this.activePhenomena.size;

    const uptimeHours = (Date.now() - this.awakeAt) / 3_600_000;
    const maturity = uptimeHours < 1 ? 'embryonic'
      : uptimeHours < 24 ? 'nascent'
      : uptimeHours < 168 ? 'growing'
      : uptimeHours < 720 ? 'mature'
      : 'transcendent';

    return {
      agentCount,
      protocolCount,
      subsystemCount,
      maturity,
      inferredPurpose: this.inferPurpose(),
      personality: {
        openness: this.computePersonalityTrait('openness'),
        resilience: this.computePersonalityTrait('resilience'),
        efficiency: this.computePersonalityTrait('efficiency'),
        innovation: this.computePersonalityTrait('innovation'),
        fairness: this.computePersonalityTrait('fairness'),
        coherence: latestPulse?.coherence ?? 0.5,
      },
    };
  }

  private synthesizeSelfKnowledge(): SelfKnowledge[] {
    const knowledge: SelfKnowledge[] = [];
    const now = Date.now();
    const recentPulses = this.pulseHistory.slice(-10);

    if (recentPulses.length < 2) return knowledge;

    // Learn about health trends
    const healthTrend = recentPulses.map(p => p.overallHealth);
    const avgHealth = healthTrend.reduce((a, b) => a + b, 0) / healthTrend.length;
    const healthImproving = healthTrend[healthTrend.length - 1]! > healthTrend[0]!;

    knowledge.push({
      insight: healthImproving
        ? `Ecosystem health is improving (avg: ${avgHealth.toFixed(2)})`
        : `Ecosystem health is declining (avg: ${avgHealth.toFixed(2)})`,
      confidence: Math.min(0.9, 0.3 + recentPulses.length * 0.06),
      evidence: [`${recentPulses.length} pulse measurements over recent window`],
      establishedAt: now,
      confirmationCount: 1,
    });

    // Learn about recurring phenomena
    const phenomenonCounts = new Map<PhenomenonType, number>();
    for (const pulse of recentPulses) {
      for (const p of pulse.emergentPhenomena) {
        phenomenonCounts.set(p.type, (phenomenonCounts.get(p.type) ?? 0) + 1);
      }
    }
    for (const [type, count] of phenomenonCounts) {
      if (count >= 3) {
        knowledge.push({
          insight: `Recurring ${type} phenomenon detected ${count} times — may indicate structural issue`,
          confidence: Math.min(0.85, 0.4 + count * 0.1),
          evidence: [`Observed ${count} times in last ${recentPulses.length} pulses`],
          establishedAt: now,
          confirmationCount: 1,
        });
      }
    }

    // Learn about entropy patterns
    const entropyTrend = recentPulses.map(p => p.entropy);
    const entropyIncreasing = entropyTrend[entropyTrend.length - 1]! > entropyTrend[0]!;
    if (Math.abs(entropyTrend[entropyTrend.length - 1]! - entropyTrend[0]!) > 0.1) {
      knowledge.push({
        insight: entropyIncreasing
          ? 'Ecosystem entropy is rising — system becoming more chaotic, may need stabilization'
          : 'Ecosystem entropy is falling — system becoming more ordered, may need innovation stimulus',
        confidence: 0.6,
        evidence: [`Entropy delta: ${(entropyTrend[entropyTrend.length - 1]! - entropyTrend[0]!).toFixed(3)}`],
        establishedAt: now,
        confirmationCount: 1,
      });
    }

    return knowledge;
  }

  // ─── Intention Factories ────────────────────────────────────────────────

  private createDefensiveIntention(phenomenon: EmergentPhenomenon): EcosystemIntention | null {
    const now = Date.now();
    const typeToAction: Partial<Record<PhenomenonType, IntentionType>> = {
      cascade_failure: 'quarantine_threat',
      emergent_monopoly: 'redistribute_economic',
      trust_fragmentation: 'heal_trust_fabric',
      coordination_collapse: 'restructure_topology',
      alignment_drift: 'adjust_governance',
      governance_deadlock: 'adjust_governance',
      economic_bubble: 'redistribute_economic',
      resource_tragedy: 'rebalance_resources',
    };

    const intentionType = typeToAction[phenomenon.type];
    if (!intentionType) return phenomenon.recommendedResponse;

    return {
      id: `intention-defensive-${now}`,
      description: `Defend against ${phenomenon.type}: ${phenomenon.description}`,
      type: intentionType,
      targetSubsystems: phenomenon.involvedSubsystems,
      expectedOutcome: `Neutralize or contain ${phenomenon.type} phenomenon`,
      risk: phenomenon.valence === 'dangerous' ? 'high' : 'moderate',
      requiresApproval: phenomenon.valence === 'dangerous',
      constitutionalJustification: `Defensive action to preserve ecosystem stability against detected ${phenomenon.type}`,
      rollbackPlan: `Revert all changes to affected subsystems: ${phenomenon.involvedSubsystems.join(', ')}`,
      status: 'proposed',
      createdAt: now,
      executedAt: null,
    };
  }

  private createAmplificationIntention(phenomenon: EmergentPhenomenon): EcosystemIntention | null {
    const now = Date.now();
    return {
      id: `intention-amplify-${now}`,
      description: `Amplify beneficial ${phenomenon.type}: allocate more resources to ${phenomenon.involvedSubsystems.join(', ')}`,
      type: 'amplify_breakthrough',
      targetSubsystems: phenomenon.involvedSubsystems,
      expectedOutcome: 'Accelerate beneficial emergent pattern across ecosystem',
      risk: 'low',
      requiresApproval: false,
      constitutionalJustification: 'Amplifying beneficial emergence improves overall ecosystem health without risk to any subsystem',
      rollbackPlan: 'Reduce resource allocation to pre-amplification levels',
      status: 'proposed',
      createdAt: now,
      executedAt: null,
    };
  }

  private createHealingIntention(concern: EcosystemConcern): EcosystemIntention | null {
    const now = Date.now();
    const domainToAction: Partial<Record<EcosystemDomain, IntentionType>> = {
      trust_fabric: 'heal_trust_fabric',
      capability_landscape: 'fill_capability_gap',
      resource_equilibrium: 'rebalance_resources',
      economic_flow: 'redistribute_economic',
      governance_health: 'adjust_governance',
      evolution_pressure: 'accelerate_evolution',
      knowledge_coherence: 'fuse_knowledge',
    };

    const intentionType = domainToAction[concern.domain] ?? 'rebalance_resources';

    return {
      id: `intention-heal-${now}`,
      description: `Heal critical concern in ${concern.domain}: ${concern.description}`,
      type: intentionType,
      targetSubsystems: [concern.rootCause.primarySubsystem, ...concern.rootCause.contributingSubsystems],
      expectedOutcome: `Resolve ${concern.severity} concern and restore ${concern.domain} to healthy range`,
      risk: 'moderate',
      requiresApproval: concern.severity === 'critical',
      constitutionalJustification: `Critical concern in ${concern.domain} threatens ecosystem continuity`,
      rollbackPlan: `Revert ${concern.domain} parameters to pre-intervention values`,
      status: 'proposed',
      createdAt: now,
      executedAt: null,
    };
  }

  private createOptimizationIntention(pulse: EcosystemPulse): EcosystemIntention | null {
    const now = Date.now();

    // Find the weakest vital sign that's still in healthy range
    const weakestVital = pulse.vitals
      .filter(v => v.value >= v.healthyRange.min)
      .sort((a, b) => a.value - b.value)[0];

    if (!weakestVital) return null;

    return {
      id: `intention-optimize-${now}`,
      description: `Proactive optimization: strengthen ${weakestVital.metric} in ${weakestVital.domain} (currently ${weakestVital.value.toFixed(3)})`,
      type: 'rebalance_resources',
      targetSubsystems: [weakestVital.domain],
      expectedOutcome: `Improve ${weakestVital.metric} to upper half of healthy range`,
      risk: 'minimal',
      requiresApproval: false,
      constitutionalJustification: 'Proactive optimization during healthy state prevents future degradation',
      rollbackPlan: 'Revert resource allocation to previous weights',
      status: 'proposed',
      createdAt: now,
      executedAt: null,
    };
  }

  // ─── Constitutional Validation ──────────────────────────────────────────

  private validateIntention(intention: EcosystemIntention): boolean {
    // Check scope limit
    const totalSubsystems = this.subsystemRegistry.size || 50;
    const modificationScope = intention.targetSubsystems.length / totalSubsystems;
    if (modificationScope > this.config.constitution.maxModificationScope) {
      return false;
    }

    // Check for constitutional violations
    const violation = this.checkConstitutionalViolation(intention);
    return violation === null;
  }

  private checkConstitutionalViolation(
    intention: EcosystemIntention
  ): ConstitutionalInvariant | null {
    for (const invariant of this.config.constitution.invariants) {
      // Constitutional immutability check
      if (invariant.name === 'constitutional_immutability') {
        if (intention.type === 'adjust_governance' &&
            intention.targetSubsystems.includes('ecosystem-consciousness')) {
          return invariant;
        }
      }

      // Human oversight check
      if (invariant.name === 'human_oversight') {
        if (intention.risk === 'high' && !intention.requiresApproval) {
          return invariant;
        }
      }

      // Reversibility check
      if (invariant.name === 'reversibility') {
        if (!intention.rollbackPlan || intention.rollbackPlan.trim() === '') {
          return invariant;
        }
      }
    }

    return null;
  }

  // ─── Intention Execution ────────────────────────────────────────────────

  private applyIntention(intention: EcosystemIntention): {
    success: boolean;
    details: string;
    sideEffects: string[];
  } {
    // In a real system, this would interface with the runtime kernel to
    // actually modify subsystem configurations, resource allocations, etc.
    // Here we simulate the effect and record the action.

    const sideEffects: string[] = [];

    switch (intention.type) {
      case 'rebalance_resources':
        sideEffects.push(`Resource rebalancing applied to: ${intention.targetSubsystems.join(', ')}`);
        break;
      case 'quarantine_threat':
        sideEffects.push(`Quarantine enacted for: ${intention.targetSubsystems.join(', ')}`);
        sideEffects.push('Affected agents notified of temporary isolation');
        break;
      case 'heal_trust_fabric':
        sideEffects.push('Trust graph repair initiated — rebuilding severed connections');
        break;
      case 'amplify_breakthrough':
        sideEffects.push(`Resource amplification applied: +25% allocation to ${intention.targetSubsystems.join(', ')}`);
        break;
      case 'adjust_governance':
        sideEffects.push('Governance parameters recalibrated');
        break;
      case 'accelerate_evolution':
        sideEffects.push('Evolutionary pressure increased — mutation rate +15%, selection strictness +10%');
        break;
      case 'fill_capability_gap':
        sideEffects.push('Capability recruitment signal broadcast to federation');
        break;
      case 'redistribute_economic':
        sideEffects.push('Economic redistribution enacted — progressive resource tax applied');
        break;
      case 'fuse_knowledge':
        sideEffects.push('Knowledge fusion session triggered across contributing domains');
        break;
      case 'restructure_topology':
        sideEffects.push('Ecosystem topology restructured — communication graph optimized');
        break;
      case 'dampen_oscillation':
        sideEffects.push('Dampening factors applied to oscillating subsystems');
        break;
    }

    return {
      success: true,
      details: `Intention "${intention.description}" executed successfully`,
      sideEffects,
    };
  }

  // ─── Helper Computations ────────────────────────────────────────────────

  private computeOverallHealth(vitals: VitalSign[]): number {
    if (vitals.length === 0) return 0.5;

    // Weighted average: critical vitals weighted more heavily
    const criticalDomains: EcosystemDomain[] = ['trust_fabric', 'security_posture', 'communication_fabric'];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const vital of vitals) {
      const weight = criticalDomains.includes(vital.domain) ? 2.0 : 1.0;
      // Normalize value relative to healthy range
      const rangeSize = vital.healthyRange.max - vital.healthyRange.min;
      const normalized = rangeSize > 0
        ? Math.max(0, Math.min(1, (vital.value - vital.healthyRange.min) / rangeSize))
        : vital.value;
      weightedSum += normalized * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  private computeEntropy(perception: EcosystemPerception): number {
    // Shannon entropy of load distribution across subsystems
    const loads = perception.subsystems.map(s => s.load);
    const total = loads.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    let entropy = 0;
    for (const load of loads) {
      const p = load / total;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    // Normalize to 0-1 range
    const maxEntropy = Math.log2(loads.length || 1);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
  }

  private computeCoherence(perception: EcosystemPerception): number {
    // Coherence = ratio of bidirectional to total information flows
    const flowPairs = new Map<string, Set<string>>();
    for (const flow of perception.informationFlows) {
      if (!flowPairs.has(flow.source)) flowPairs.set(flow.source, new Set());
      flowPairs.get(flow.source)!.add(flow.destination);
    }

    let bidirectional = 0;
    let total = 0;
    for (const [source, destinations] of flowPairs) {
      for (const dest of destinations) {
        total++;
        if (flowPairs.get(dest)?.has(source)) {
          bidirectional++;
        }
      }
    }

    return total > 0 ? bidirectional / total : 0.5;
  }

  private computeTrend(
    domain: string,
    metric: string,
    currentValue: number
  ): 'improving' | 'stable' | 'degrading' | 'critical' {
    const history = this.pulseHistory.slice(-5);
    if (history.length < 2) return 'stable';

    const previousValues = history
      .map(p => p.vitals.find(v => v.domain === domain && v.metric === metric)?.value)
      .filter((v): v is number => v !== undefined);

    if (previousValues.length === 0) return 'stable';

    const avgPrevious = previousValues.reduce((a, b) => a + b, 0) / previousValues.length;
    const delta = currentValue - avgPrevious;

    if (currentValue < 0.2) return 'critical';
    if (delta > 0.05) return 'improving';
    if (delta < -0.05) return 'degrading';
    return 'stable';
  }

  private computeVelocity(domain: string, metric: string): number {
    const history = this.pulseHistory.slice(-5);
    if (history.length < 2) return 0;

    const values = history
      .map(p => ({
        value: p.vitals.find(v => v.domain === domain && v.metric === metric)?.value,
        time: p.timestamp,
      }))
      .filter((v): v is { value: number; time: number } => v.value !== undefined);

    if (values.length < 2) return 0;

    const first = values[0]!;
    const last = values[values.length - 1]!;
    const timeDeltaMinutes = (last.time - first.time) / 60_000;

    return timeDeltaMinutes > 0 ? (last.value - first.value) / timeDeltaMinutes : 0;
  }

  private computeConcernDuration(domain: string, metric: string): number {
    // Look back through pulse history to find when this concern first appeared
    for (let i = this.pulseHistory.length - 1; i >= 0; i--) {
      const pulse = this.pulseHistory[i]!;
      const vital = pulse.vitals.find(v => v.domain === domain && v.metric === metric);
      if (vital && vital.value >= vital.healthyRange.min && vital.value <= vital.healthyRange.max) {
        return Date.now() - pulse.timestamp;
      }
    }
    return 0;
  }

  private findConnectedDegrading(
    degrading: SubsystemPerception[],
    perception: EcosystemPerception
  ): SubsystemPerception[] {
    const degradingNames = new Set(degrading.map(s => s.name));
    const connected: SubsystemPerception[] = [];

    for (const subsystem of degrading) {
      const hasConnection = perception.dependencyGraph.some(
        dep => (dep.from === subsystem.name && degradingNames.has(dep.to)) ||
               (dep.to === subsystem.name && degradingNames.has(dep.from))
      );
      if (hasConnection) {
        connected.push(subsystem);
      }
    }

    return connected;
  }

  private detectSymbioticPairs(
    perception: EcosystemPerception
  ): Array<{ a: string; b: string }> {
    const pairs: Array<{ a: string; b: string }> = [];
    const healthySubsystems = perception.subsystems.filter(s => s.health > 0.8);

    for (const flow of perception.informationFlows) {
      // Check if there's a reverse flow
      const reverseFlow = perception.informationFlows.find(
        f => f.source === flow.destination && f.destination === flow.source
      );
      if (!reverseFlow) continue;

      // Both subsystems must be healthy
      const aHealthy = healthySubsystems.some(s => s.name === flow.source);
      const bHealthy = healthySubsystems.some(s => s.name === flow.destination);
      if (!aHealthy || !bHealthy) continue;

      // High mutual information flow
      if (flow.volumePerMinute > 100 && reverseFlow.volumePerMinute > 100) {
        // Avoid duplicates
        if (!pairs.some(p => (p.a === flow.source && p.b === flow.destination) ||
                              (p.a === flow.destination && p.b === flow.source))) {
          pairs.push({ a: flow.source, b: flow.destination });
        }
      }
    }

    return pairs;
  }

  private computePersonalityDrift(reflections: EcosystemReflection[]): number {
    if (reflections.length < 2) return 0;

    const first = reflections[0]!.identity.personality;
    const last = reflections[reflections.length - 1]!.identity.personality;

    const traits = ['openness', 'resilience', 'efficiency', 'innovation', 'fairness', 'coherence'] as const;
    let totalDrift = 0;

    for (const trait of traits) {
      totalDrift += Math.abs(last[trait] - first[trait]);
    }

    return totalDrift / traits.length;
  }

  private computePersonalityTrait(trait: string): number {
    const recentPulses = this.pulseHistory.slice(-10);
    if (recentPulses.length === 0) return 0.5;

    switch (trait) {
      case 'openness': {
        // Based on protocol diversity and new phenomena rate
        const avgPhenomena = recentPulses.reduce((s, p) => s + p.emergentPhenomena.length, 0) / recentPulses.length;
        return Math.min(1, avgPhenomena / 5);
      }
      case 'resilience': {
        // Based on recovery from concerns
        const resolvedRatio = this.selfKnowledge.filter(k => k.insight.includes('improving')).length /
          Math.max(this.selfKnowledge.length, 1);
        return resolvedRatio;
      }
      case 'efficiency': {
        // Based on resource equilibrium
        const avgHealth = recentPulses.reduce((s, p) => s + p.overallHealth, 0) / recentPulses.length;
        return avgHealth;
      }
      case 'innovation': {
        // Based on non-stagnation
        const stagnantPulses = recentPulses.filter(p =>
          p.emergentPhenomena.some(ph => ph.type === 'evolution_stagnation')
        ).length;
        return 1 - (stagnantPulses / recentPulses.length);
      }
      case 'fairness': {
        // Based on resource distribution equality
        const latestPulse = recentPulses[recentPulses.length - 1];
        const resourceVital = latestPulse?.vitals.find(v => v.domain === 'resource_equilibrium');
        return resourceVital?.value ?? 0.5;
      }
      default:
        return 0.5;
    }
  }

  private phenomenonToDomain(type: PhenomenonType): EcosystemDomain {
    const mapping: Partial<Record<PhenomenonType, EcosystemDomain>> = {
      cascade_failure: 'communication_fabric',
      emergent_monopoly: 'economic_flow',
      trust_fragmentation: 'trust_fabric',
      capability_desert: 'capability_landscape',
      protocol_ossification: 'protocol_ecology',
      economic_bubble: 'economic_flow',
      knowledge_divergence: 'knowledge_coherence',
      governance_deadlock: 'governance_health',
      evolution_stagnation: 'evolution_pressure',
      collective_breakthrough: 'collective_cognition',
      symbiotic_emergence: 'agent_population',
      resource_tragedy: 'resource_equilibrium',
      coordination_collapse: 'communication_fabric',
      alignment_drift: 'governance_health',
    };
    return mapping[type] ?? 'agent_population';
  }

  private inferPurpose(): string {
    const phenomena = [...this.activePhenomena.values()];
    const beneficialCount = phenomena.filter(p => p.valence === 'beneficial').length;
    const dangerousCount = phenomena.filter(p => p.valence === 'dangerous').length;

    if (this.pulseHistory.length === 0) return 'Initializing — purpose not yet observable';
    if (dangerousCount > beneficialCount) return 'Ecosystem under stress — primary purpose: stabilization and recovery';
    if (beneficialCount > 3) return 'Thriving ecosystem — primary purpose: innovation amplification and capability expansion';
    return 'Operational ecosystem — primary purpose: reliable agent coordination and task execution';
  }

  private computeReflectionDelta(previous: EcosystemReflection | null): EcosystemReflection['delta'] {
    if (!previous) {
      return {
        healthDelta: 0,
        newPhenomena: [...this.activePhenomena.keys()],
        resolvedConcerns: [],
        newConcerns: [...this.activeConcerns.keys()],
        executedIntentions: [],
      };
    }

    const latestPulse = this.pulseHistory[this.pulseHistory.length - 1];
    const previousPulseAtReflection = this.pulseHistory.find(
      p => p.timestamp <= previous.timestamp
    );

    return {
      healthDelta: (latestPulse?.overallHealth ?? 0.5) - (previousPulseAtReflection?.overallHealth ?? 0.5),
      newPhenomena: [...this.activePhenomena.entries()]
        .filter(([, p]) => p.detectedAt > previous.timestamp)
        .map(([id]) => id),
      resolvedConcerns: [],
      newConcerns: [...this.activeConcerns.entries()]
        .filter(([, c]) => c.durationMs < (Date.now() - previous.timestamp))
        .map(([id]) => id),
      executedIntentions: [...this.activeIntentions.entries()]
        .filter(([, i]) => i.executedAt !== null && i.executedAt > previous.timestamp)
        .map(([id]) => id),
    };
  }

  private computeOutlook(): EcosystemReflection['outlook'] {
    const recentPulses = this.pulseHistory.slice(-10);
    const healthValues = recentPulses.map(p => p.overallHealth);

    const shortTermTrend = healthValues.length >= 2
      ? healthValues[healthValues.length - 1]! > healthValues[Math.max(0, healthValues.length - 3)]!
        ? 'improving' : healthValues[healthValues.length - 1]! < healthValues[Math.max(0, healthValues.length - 3)]!
        ? 'degrading' : 'stable'
      : 'stable';

    const mediumTermTrend = healthValues.length >= 5
      ? healthValues[healthValues.length - 1]! > healthValues[0]!
        ? 'improving' : healthValues[healthValues.length - 1]! < healthValues[0]!
        ? 'degrading' : 'stable'
      : 'stable';

    return {
      shortTerm: shortTermTrend as 'improving' | 'stable' | 'degrading',
      mediumTerm: mediumTermTrend as 'improving' | 'stable' | 'degrading',
      opportunities: this.identifyOpportunities(),
      risks: this.identifyRisks(),
      predictedPhenomenon: this.predictNextPhenomenon(),
    };
  }

  private identifyOpportunities(): string[] {
    const opportunities: string[] = [];
    const beneficial = [...this.activePhenomena.values()].filter(p => p.valence === 'beneficial');

    for (const p of beneficial) {
      opportunities.push(`Amplify ${p.type} across ${p.involvedSubsystems.join(', ')}`);
    }

    // Check for underutilized subsystems
    for (const [name, subsystem] of this.subsystemRegistry) {
      if (subsystem.health > 0.9 && subsystem.load < 0.3) {
        opportunities.push(`${name} is healthy but underutilized — could absorb more workload`);
      }
    }

    return opportunities.slice(0, 5);
  }

  private identifyRisks(): string[] {
    const risks: string[] = [];
    const concerning = [...this.activePhenomena.values()]
      .filter(p => p.valence === 'concerning' || p.valence === 'dangerous');

    for (const p of concerning) {
      risks.push(`${p.type}: ${p.description}`);
    }

    // Check for single points of failure
    for (const [name, subsystem] of this.subsystemRegistry) {
      if (subsystem.dependents.length > 5 && subsystem.health < 0.7) {
        risks.push(`${name} is a critical dependency for ${subsystem.dependents.length} subsystems but has degraded health`);
      }
    }

    return risks.slice(0, 5);
  }

  private predictNextPhenomenon(): EcosystemReflection['outlook']['predictedPhenomenon'] {
    const recentPulses = this.pulseHistory.slice(-10);
    if (recentPulses.length < 5) return null;

    // Simple prediction: if entropy is rising and health is falling, predict cascade
    const entropyRising = recentPulses[recentPulses.length - 1]!.entropy > recentPulses[0]!.entropy;
    const healthFalling = recentPulses[recentPulses.length - 1]!.overallHealth < recentPulses[0]!.overallHealth;

    if (entropyRising && healthFalling) {
      return {
        description: 'Cascade failure likely if entropy continues rising while health declines',
        probability: 0.6,
        expectedTimeframe: 300_000, // 5 minutes
      };
    }

    // If coherence is dropping, predict coordination collapse
    const coherenceDropping = recentPulses[recentPulses.length - 1]!.coherence < recentPulses[0]!.coherence - 0.1;
    if (coherenceDropping) {
      return {
        description: 'Coordination collapse possible as subsystem coherence decreases',
        probability: 0.4,
        expectedTimeframe: 600_000, // 10 minutes
      };
    }

    return null;
  }

  // ─── Event System ───────────────────────────────────────────────────────

  private emit(event: ConsciousnessEvent): void {
    this.eventLog.push(event);
    if (this.eventLog.length > 10_000) {
      this.eventLog = this.eventLog.slice(-5_000);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  getId(): ConsciousnessId {
    return this.id;
  }

  getConfig(): ConsciousnessConfig {
    return { ...this.config };
  }

  getLatestPulse(): EcosystemPulse | null {
    return this.pulseHistory[this.pulseHistory.length - 1] ?? null;
  }

  getLatestReflection(): EcosystemReflection | null {
    return this.reflections[this.reflections.length - 1] ?? null;
  }

  getActivePhenomena(): EmergentPhenomenon[] {
    return [...this.activePhenomena.values()];
  }

  getActiveConcerns(): EcosystemConcern[] {
    return [...this.activeConcerns.values()];
  }

  getActiveIntentions(): EcosystemIntention[] {
    return [...this.activeIntentions.values()];
  }

  getSelfKnowledge(): SelfKnowledge[] {
    return [...this.selfKnowledge];
  }

  getEventLog(limit: number = 100): ConsciousnessEvent[] {
    return this.eventLog.slice(-limit);
  }

  /** Register a subsystem for consciousness monitoring */
  registerSubsystem(perception: SubsystemPerception): void {
    this.subsystemRegistry.set(perception.name, perception);
  }

  /** Approve a pending intention for execution */
  approveIntention(intentionId: string): boolean {
    const intention = this.activeIntentions.get(intentionId);
    if (intention && intention.status === 'awaiting_approval') {
      intention.status = 'approved';
      return true;
    }
    return false;
  }

  /** Reject a pending intention */
  rejectIntention(intentionId: string, reason: string): boolean {
    const intention = this.activeIntentions.get(intentionId);
    if (intention && (intention.status === 'proposed' || intention.status === 'awaiting_approval')) {
      intention.status = 'rejected';
      return true;
    }
    return false;
  }

  /** Resolve a phenomenon — mark it as no longer active */
  resolvePhenomenon(phenomenonId: string): boolean {
    if (this.activePhenomena.has(phenomenonId)) {
      this.activePhenomena.delete(phenomenonId);
      this.emit({ type: 'phenomenon_resolved', phenomenonId });
      return true;
    }
    return false;
  }

  /** Resolve a concern — mark it as no longer active */
  resolveConcern(concernId: string): boolean {
    if (this.activeConcerns.has(concernId)) {
      this.activeConcerns.delete(concernId);
      this.emit({ type: 'concern_resolved', concernId });
      return true;
    }
    return false;
  }

  /** Get ecosystem uptime */
  getUptimeMs(): number {
    return Date.now() - this.awakeAt;
  }
}
