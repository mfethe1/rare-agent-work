/**
 * Autonomic Agent Nervous System — Core Engine
 *
 * Provides the A2A ecosystem with homeostatic self-regulation:
 * - Vital signs collection with sliding windows
 * - Statistical anomaly detection (z-score, trend, correlation)
 * - Predictive health forecasting (linear regression + heuristics)
 * - Autonomous self-healing with safety guardrails
 * - Dependency graph analysis for cascade prevention
 *
 * Loop 29: The "brain stem" of the agent mesh.
 */

import type {
  Anomaly,
  AnomalySeverity,
  AnomalyType,
  AgentCluster,
  AgentDependency,
  ContributingFactor,
  DependencyGraph,
  HealingAction,
  HealingActionType,
  HealingResult,
  HealingStatus,
  HealthPrediction,
  HomeostasisPolicy,
  PredictionType,
  RecommendedAction,
  SystemHomeostasis,
  VitalSign,
  VitalSignCategory,
  VitalSignSummary,
  VitalSignWindow,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function zScore(value: number, avg: number, sd: number): number {
  if (sd === 0) return 0;
  return (value - avg) / sd;
}

/**
 * Simple linear regression: returns slope and intercept.
 */
function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };

  const xMean = mean(xs);
  const yMean = mean(ys);

  let ssXY = 0;
  let ssXX = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - xMean) * (ys[i] - yMean);
    ssXX += (xs[i] - xMean) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (ys[i] - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

/**
 * Classify trend based on regression slope relative to mean.
 */
function classifyTrend(
  slope: number,
  avg: number,
  category: VitalSignCategory,
): 'improving' | 'stable' | 'degrading' | 'critical' {
  if (avg === 0) return 'stable';
  const relativeSlope = slope / Math.abs(avg);

  // For error_rate, latency, saturation, queue_depth: increasing is bad
  const higherIsBad = ['error_rate', 'latency', 'saturation', 'queue_depth'].includes(category);
  const effectiveSlope = higherIsBad ? relativeSlope : -relativeSlope;

  if (effectiveSlope > 0.1) return 'critical';
  if (effectiveSlope > 0.03) return 'degrading';
  if (effectiveSlope < -0.03) return 'improving';
  return 'stable';
}

// ---------------------------------------------------------------------------
// Autonomic Engine
// ---------------------------------------------------------------------------

export class AutonomicEngine {
  // Vital signs: agent_id:category → sliding window
  private windows: Map<string, VitalSignWindow> = new Map();
  private readonly defaultWindowMs: number;
  private readonly maxSamplesPerWindow: number;

  // Anomalies
  private anomalies: Map<string, Anomaly> = new Map();
  private readonly anomalyZScoreThresholds: Record<AnomalySeverity, number> = {
    info: 2.0,
    warning: 2.5,
    critical: 3.0,
    emergency: 4.0,
  };

  // Predictions
  private predictions: Map<string, HealthPrediction> = new Map();

  // Healing
  private healingActions: Map<string, HealingAction> = new Map();
  private healingCountsPerHour: Map<string, number[]> = new Map(); // agent_id → timestamps

  // Policies
  private policies: Map<string, HomeostasisPolicy> = new Map();

  // Dependencies
  private dependencies: AgentDependency[] = [];

  constructor(options?: { windowMs?: number; maxSamples?: number }) {
    this.defaultWindowMs = options?.windowMs ?? 300_000; // 5 min default
    this.maxSamplesPerWindow = options?.maxSamples ?? 1000;
  }

  // =========================================================================
  // Vital Signs
  // =========================================================================

  /**
   * Record a vital sign measurement for an agent.
   */
  recordVitalSign(sign: VitalSign): VitalSignWindow {
    const key = `${sign.agent_id}:${sign.category}`;
    let window = this.windows.get(key);

    if (!window) {
      window = {
        agent_id: sign.agent_id,
        category: sign.category,
        samples: [],
        timestamps: [],
        window_ms: this.defaultWindowMs,
      };
      this.windows.set(key, window);
    }

    window.samples.push(sign.value);
    window.timestamps.push(sign.timestamp);

    // Evict samples outside the window
    const cutoff = sign.timestamp - window.window_ms;
    while (window.timestamps.length > 0 && window.timestamps[0] < cutoff) {
      window.timestamps.shift();
      window.samples.shift();
    }

    // Cap at max samples
    while (window.samples.length > this.maxSamplesPerWindow) {
      window.timestamps.shift();
      window.samples.shift();
    }

    return window;
  }

  /**
   * Get a statistical summary of an agent's vital sign.
   */
  getVitalSignSummary(agentId: string, category: VitalSignCategory): VitalSignSummary | null {
    const key = `${agentId}:${category}`;
    const window = this.windows.get(key);
    if (!window || window.samples.length === 0) return null;

    const samples = window.samples;
    const avg = mean(samples);
    const sd = stdDev(samples);

    // Compute trend via linear regression on timestamps
    const normalizedTs = window.timestamps.map((t, i) => i);
    const { slope } = linearRegression(normalizedTs, samples);
    const trend = classifyTrend(slope, avg, category);

    return {
      agent_id: agentId,
      category,
      mean: avg,
      median: median(samples),
      p95: percentile(samples, 95),
      p99: percentile(samples, 99),
      std_dev: sd,
      min: Math.min(...samples),
      max: Math.max(...samples),
      trend,
      sample_count: samples.length,
    };
  }

  /**
   * Get all vital sign summaries for an agent.
   */
  getAgentVitals(agentId: string): VitalSignSummary[] {
    const categories: VitalSignCategory[] = [
      'latency', 'throughput', 'error_rate', 'saturation',
      'availability', 'cost_efficiency', 'reputation_drift', 'queue_depth',
    ];
    return categories
      .map(c => this.getVitalSignSummary(agentId, c))
      .filter((s): s is VitalSignSummary => s !== null);
  }

  // =========================================================================
  // Anomaly Detection
  // =========================================================================

  /**
   * Analyze a vital sign window and detect anomalies.
   * Uses z-score analysis, trend detection, and flatline detection.
   */
  detectAnomalies(agentId: string, category: VitalSignCategory): Anomaly[] {
    const key = `${agentId}:${category}`;
    const window = this.windows.get(key);
    if (!window || window.samples.length < 5) return [];

    const detected: Anomaly[] = [];
    const samples = window.samples;
    const avg = mean(samples);
    const sd = stdDev(samples);
    const latest = samples[samples.length - 1];
    const latestZ = zScore(latest, avg, sd);
    const absZ = Math.abs(latestZ);

    // Spike / Drop detection via z-score
    if (absZ >= this.anomalyZScoreThresholds.info) {
      const isSpike = latestZ > 0;
      const higherIsBad = ['error_rate', 'latency', 'saturation', 'queue_depth'].includes(category);
      const isBadDirection = (isSpike && higherIsBad) || (!isSpike && !higherIsBad);

      const severity = this.classifySeverity(absZ);
      const type: AnomalyType = isSpike ? 'spike' : 'drop';

      const anomaly: Anomaly = {
        id: generateId('anomaly'),
        agent_id: agentId,
        category,
        type: isBadDirection ? type : type, // both directions are anomalies
        severity: isBadDirection ? severity : 'info',
        detected_at: Date.now(),
        z_score: latestZ,
        expected_value: avg,
        actual_value: latest,
        confidence: Math.min(1, absZ / 5),
        description: `${category} ${type}: expected ~${avg.toFixed(2)} but got ${latest.toFixed(2)} (z=${latestZ.toFixed(2)})`,
        correlated_anomalies: [],
        resolved: false,
      };

      this.anomalies.set(anomaly.id, anomaly);
      detected.push(anomaly);
    }

    // Drift detection: check if the second half significantly differs from first half
    if (samples.length >= 10) {
      const midpoint = Math.floor(samples.length / 2);
      const firstHalf = samples.slice(0, midpoint);
      const secondHalf = samples.slice(midpoint);
      const firstMean = mean(firstHalf);
      const secondMean = mean(secondHalf);
      const driftRatio = firstMean !== 0
        ? Math.abs((secondMean - firstMean) / firstMean)
        : 0;

      if (driftRatio > 0.3) {
        const anomaly: Anomaly = {
          id: generateId('anomaly'),
          agent_id: agentId,
          category,
          type: 'drift',
          severity: driftRatio > 0.8 ? 'critical' : driftRatio > 0.5 ? 'warning' : 'info',
          detected_at: Date.now(),
          z_score: driftRatio,
          expected_value: firstMean,
          actual_value: secondMean,
          confidence: Math.min(1, driftRatio),
          description: `${category} drift: baseline ${firstMean.toFixed(2)} → current ${secondMean.toFixed(2)} (${(driftRatio * 100).toFixed(1)}% shift)`,
          correlated_anomalies: [],
          resolved: false,
        };

        this.anomalies.set(anomaly.id, anomaly);
        detected.push(anomaly);
      }
    }

    // Flatline detection: near-zero standard deviation
    if (samples.length >= 10 && sd < avg * 0.001 && avg !== 0) {
      const anomaly: Anomaly = {
        id: generateId('anomaly'),
        agent_id: agentId,
        category,
        type: 'flatline',
        severity: 'warning',
        detected_at: Date.now(),
        z_score: 0,
        expected_value: avg,
        actual_value: latest,
        confidence: 0.8,
        description: `${category} flatline: value stuck at ~${avg.toFixed(2)} with near-zero variance`,
        correlated_anomalies: [],
        resolved: false,
      };

      this.anomalies.set(anomaly.id, anomaly);
      detected.push(anomaly);
    }

    // Cross-correlate with other anomalies on same agent
    this.correlateAnomalies(agentId, detected);

    return detected;
  }

  /**
   * Run full anomaly scan across all tracked agents and categories.
   */
  runAnomalyScan(): Anomaly[] {
    const allAnomalies: Anomaly[] = [];
    const scanned = new Set<string>();

    for (const [key] of this.windows) {
      if (scanned.has(key)) continue;
      scanned.add(key);
      const [agentId, category] = key.split(':') as [string, VitalSignCategory];
      const detected = this.detectAnomalies(agentId, category);
      allAnomalies.push(...detected);
    }

    // Detect cascade anomalies
    this.detectCascadeAnomalies(allAnomalies);

    return allAnomalies;
  }

  /**
   * Query anomalies with optional filters.
   */
  queryAnomalies(filters?: {
    agent_id?: string;
    category?: VitalSignCategory;
    severity?: AnomalySeverity;
    resolved?: boolean;
    since?: number;
  }): Anomaly[] {
    let results = Array.from(this.anomalies.values());

    if (filters?.agent_id) {
      results = results.filter(a => a.agent_id === filters.agent_id);
    }
    if (filters?.category) {
      results = results.filter(a => a.category === filters.category);
    }
    if (filters?.severity) {
      results = results.filter(a => a.severity === filters.severity);
    }
    if (filters?.resolved !== undefined) {
      results = results.filter(a => a.resolved === filters.resolved);
    }
    if (filters?.since) {
      results = results.filter(a => a.detected_at >= filters.since!);
    }

    return results.sort((a, b) => b.detected_at - a.detected_at);
  }

  /**
   * Resolve an anomaly.
   */
  resolveAnomaly(anomalyId: string, resolution: string): Anomaly | null {
    const anomaly = this.anomalies.get(anomalyId);
    if (!anomaly) return null;

    anomaly.resolved = true;
    anomaly.resolved_at = Date.now();
    anomaly.resolution = resolution;
    return anomaly;
  }

  private classifySeverity(absZScore: number): AnomalySeverity {
    if (absZScore >= this.anomalyZScoreThresholds.emergency) return 'emergency';
    if (absZScore >= this.anomalyZScoreThresholds.critical) return 'critical';
    if (absZScore >= this.anomalyZScoreThresholds.warning) return 'warning';
    return 'info';
  }

  private correlateAnomalies(agentId: string, newAnomalies: Anomaly[]): void {
    // Find recent unresolved anomalies on the same agent
    const recentWindow = 60_000; // 1 minute
    const now = Date.now();
    const recentOnAgent = Array.from(this.anomalies.values()).filter(
      a => a.agent_id === agentId &&
           !a.resolved &&
           now - a.detected_at < recentWindow &&
           !newAnomalies.some(n => n.id === a.id)
    );

    for (const newAnomaly of newAnomalies) {
      for (const existing of recentOnAgent) {
        newAnomaly.correlated_anomalies.push(existing.id);
        existing.correlated_anomalies.push(newAnomaly.id);
      }
    }
  }

  private detectCascadeAnomalies(batchAnomalies: Anomaly[]): void {
    // If multiple dependent agents have anomalies simultaneously, mark as cascade
    const agentAnomalyCounts = new Map<string, number>();
    for (const a of batchAnomalies) {
      agentAnomalyCounts.set(a.agent_id, (agentAnomalyCounts.get(a.agent_id) ?? 0) + 1);
    }

    for (const dep of this.dependencies) {
      const fromCount = agentAnomalyCounts.get(dep.from_agent_id) ?? 0;
      const toCount = agentAnomalyCounts.get(dep.to_agent_id) ?? 0;

      if (fromCount > 0 && toCount > 0 && dep.failure_correlation > 0.5) {
        const cascadeAnomaly: Anomaly = {
          id: generateId('anomaly'),
          agent_id: dep.to_agent_id,
          category: 'availability',
          type: 'cascade',
          severity: 'critical',
          detected_at: Date.now(),
          z_score: dep.failure_correlation,
          expected_value: 0,
          actual_value: toCount,
          confidence: dep.failure_correlation,
          description: `Cascade detected: anomalies on ${dep.from_agent_id} correlating with failures on ${dep.to_agent_id} (correlation: ${dep.failure_correlation.toFixed(2)})`,
          correlated_anomalies: batchAnomalies
            .filter(a => a.agent_id === dep.from_agent_id || a.agent_id === dep.to_agent_id)
            .map(a => a.id),
          resolved: false,
        };

        this.anomalies.set(cascadeAnomaly.id, cascadeAnomaly);
        batchAnomalies.push(cascadeAnomaly);
      }
    }
  }

  // =========================================================================
  // Predictive Health
  // =========================================================================

  /**
   * Generate health predictions for an agent using trend extrapolation.
   */
  predictHealth(agentId: string): HealthPrediction[] {
    const predictions: HealthPrediction[] = [];
    const vitals = this.getAgentVitals(agentId);
    const now = Date.now();

    for (const vital of vitals) {
      const key = `${agentId}:${vital.category}`;
      const window = this.windows.get(key);
      if (!window || window.samples.length < 10) continue;

      const normalizedTs = window.timestamps.map((_, i) => i);
      const { slope, r2 } = linearRegression(normalizedTs, window.samples);

      // Check relevant policies for thresholds
      const policy = this.findPolicyForAgent(agentId, vital.category);
      if (!policy) continue;

      const currentValue = window.samples[window.samples.length - 1];

      // Predict when value will exit optimal range
      const higherIsBad = ['error_rate', 'latency', 'saturation', 'queue_depth'].includes(vital.category);
      const threshold = higherIsBad ? policy.warning_range.max : policy.warning_range.min;
      const criticalThreshold = higherIsBad ? policy.critical_range.max : policy.critical_range.min;

      if (slope === 0) continue;

      // Steps until threshold breach
      const stepsToWarning = (threshold - currentValue) / slope;
      const stepsToCritical = (criticalThreshold - currentValue) / slope;

      // Convert steps to time (average interval between samples)
      const avgInterval = window.timestamps.length > 1
        ? (window.timestamps[window.timestamps.length - 1] - window.timestamps[0]) / (window.timestamps.length - 1)
        : 1000;

      const timeToWarning = stepsToWarning * avgInterval;
      const timeToCritical = stepsToCritical * avgInterval;

      // Only predict if breach is in the future and slope direction is concerning
      const isConcerning = higherIsBad ? slope > 0 : slope < 0;
      if (!isConcerning) continue;

      if (timeToWarning > 0 && timeToWarning < 3_600_000) { // within 1 hour
        const probability = Math.min(1, r2 * (1 - timeToWarning / 3_600_000) * 1.5);
        if (probability < 0.3) continue;

        const predictionType: PredictionType = this.categorizePrediction(vital.category);

        const factors: ContributingFactor[] = [{
          category: vital.category,
          weight: r2,
          current_value: currentValue,
          threshold_value: threshold,
          trend: vital.trend,
        }];

        const actions = this.recommendActions(agentId, predictionType, vital.category, currentValue, threshold);

        const prediction: HealthPrediction = {
          id: generateId('pred'),
          agent_id: agentId,
          type: predictionType,
          probability,
          estimated_time_ms: Math.round(timeToWarning),
          confidence_interval: {
            low: Math.round(timeToWarning * 0.7),
            high: Math.round(timeToWarning * 1.5),
          },
          contributing_factors: factors,
          recommended_actions: actions,
          created_at: now,
          expires_at: now + Math.round(timeToWarning),
        };

        this.predictions.set(prediction.id, prediction);
        predictions.push(prediction);
      }

      // Higher severity prediction if critical threshold is close
      if (timeToCritical > 0 && timeToCritical < 1_800_000) { // within 30 min
        const probability = Math.min(1, r2 * (1 - timeToCritical / 1_800_000) * 2);
        if (probability < 0.4) continue;

        const prediction: HealthPrediction = {
          id: generateId('pred'),
          agent_id: agentId,
          type: 'failure_imminent',
          probability,
          estimated_time_ms: Math.round(timeToCritical),
          confidence_interval: {
            low: Math.round(timeToCritical * 0.5),
            high: Math.round(timeToCritical * 1.3),
          },
          contributing_factors: [{
            category: vital.category,
            weight: r2,
            current_value: currentValue,
            threshold_value: criticalThreshold,
            trend: vital.trend,
          }],
          recommended_actions: this.recommendActions(agentId, 'failure_imminent', vital.category, currentValue, criticalThreshold),
          created_at: now,
          expires_at: now + Math.round(timeToCritical),
        };

        this.predictions.set(prediction.id, prediction);
        predictions.push(prediction);
      }
    }

    // Cascade risk prediction
    const cascadePrediction = this.predictCascadeRisk(agentId);
    if (cascadePrediction) {
      this.predictions.set(cascadePrediction.id, cascadePrediction);
      predictions.push(cascadePrediction);
    }

    return predictions;
  }

  /**
   * Query predictions with filters.
   */
  queryPredictions(filters?: {
    agent_id?: string;
    type?: PredictionType;
    min_probability?: number;
  }): HealthPrediction[] {
    const now = Date.now();
    let results = Array.from(this.predictions.values())
      .filter(p => p.expires_at > now); // only active predictions

    if (filters?.agent_id) {
      results = results.filter(p => p.agent_id === filters.agent_id);
    }
    if (filters?.type) {
      results = results.filter(p => p.type === filters.type);
    }
    if (filters?.min_probability !== undefined) {
      results = results.filter(p => p.probability >= filters.min_probability!);
    }

    return results.sort((a, b) => b.probability - a.probability);
  }

  private categorizePrediction(category: VitalSignCategory): PredictionType {
    switch (category) {
      case 'error_rate': return 'failure_imminent';
      case 'saturation':
      case 'queue_depth': return 'capacity_exhaustion';
      case 'latency':
      case 'throughput': return 'performance_degradation';
      case 'cost_efficiency': return 'cost_overrun';
      case 'availability': return 'sla_breach';
      default: return 'performance_degradation';
    }
  }

  private recommendActions(
    agentId: string,
    predictionType: PredictionType,
    _category: VitalSignCategory,
    _currentValue: number,
    _threshold: number,
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    switch (predictionType) {
      case 'failure_imminent':
        actions.push(
          {
            type: 'reroute_traffic',
            target_agent_id: agentId,
            priority: 9,
            estimated_impact: 0.8,
            risk_level: 'medium',
            description: `Preemptively reroute traffic away from ${agentId} before predicted failure`,
          },
          {
            type: 'circuit_break',
            target_agent_id: agentId,
            priority: 8,
            estimated_impact: 0.9,
            risk_level: 'medium',
            description: `Open circuit breaker for ${agentId} to prevent cascade`,
          },
        );
        break;
      case 'capacity_exhaustion':
        actions.push(
          {
            type: 'scale_ensemble',
            target_agent_id: agentId,
            priority: 7,
            estimated_impact: 0.7,
            risk_level: 'low',
            description: `Scale up ensemble to absorb load from saturated ${agentId}`,
          },
          {
            type: 'throttle_intake',
            target_agent_id: agentId,
            priority: 6,
            estimated_impact: 0.6,
            risk_level: 'low',
            description: `Throttle incoming tasks for ${agentId} to prevent saturation`,
          },
        );
        break;
      case 'performance_degradation':
        actions.push({
          type: 'reroute_traffic',
          target_agent_id: agentId,
          priority: 5,
          estimated_impact: 0.5,
          risk_level: 'low',
          description: `Shift traffic to faster agents while ${agentId} recovers`,
        });
        break;
      case 'cascade_risk':
        actions.push(
          {
            type: 'quarantine_agent',
            target_agent_id: agentId,
            priority: 10,
            estimated_impact: 0.9,
            risk_level: 'high',
            description: `Quarantine ${agentId} to prevent cascade propagation`,
          },
          {
            type: 'evacuate_workflows',
            target_agent_id: agentId,
            priority: 9,
            estimated_impact: 0.85,
            risk_level: 'medium',
            description: `Migrate in-flight workflows away from ${agentId}`,
          },
        );
        break;
      case 'cost_overrun':
        actions.push({
          type: 'throttle_intake',
          target_agent_id: agentId,
          priority: 6,
          estimated_impact: 0.7,
          risk_level: 'low',
          description: `Throttle ${agentId} to control cost trajectory`,
        });
        break;
      case 'sla_breach':
        actions.push({
          type: 'notify_operator',
          target_agent_id: agentId,
          priority: 8,
          estimated_impact: 0.3,
          risk_level: 'low',
          description: `Alert operator: SLA breach predicted for ${agentId}`,
        });
        break;
    }

    return actions;
  }

  private predictCascadeRisk(agentId: string): HealthPrediction | null {
    // Check if this agent has dependents and is showing degradation
    const dependents = this.dependencies.filter(d => d.from_agent_id === agentId);
    if (dependents.length === 0) return null;

    const vitals = this.getAgentVitals(agentId);
    const degradingVitals = vitals.filter(v => v.trend === 'degrading' || v.trend === 'critical');
    if (degradingVitals.length === 0) return null;

    const maxCorrelation = Math.max(...dependents.map(d => d.failure_correlation));
    const cascadeProbability = Math.min(1, maxCorrelation * degradingVitals.length * 0.3);

    if (cascadeProbability < 0.3) return null;

    return {
      id: generateId('pred'),
      agent_id: agentId,
      type: 'cascade_risk',
      probability: cascadeProbability,
      estimated_time_ms: 300_000, // 5 min estimate
      confidence_interval: { low: 120_000, high: 600_000 },
      contributing_factors: degradingVitals.map(v => ({
        category: v.category,
        weight: maxCorrelation,
        current_value: v.mean,
        threshold_value: v.p95,
        trend: v.trend,
      })),
      recommended_actions: this.recommendActions(agentId, 'cascade_risk', 'availability', 0, 0),
      created_at: Date.now(),
      expires_at: Date.now() + 600_000,
    };
  }

  // =========================================================================
  // Self-Healing
  // =========================================================================

  /**
   * Propose a healing action. If auto-heal is enabled and within limits,
   * the action is auto-approved.
   */
  proposeHealing(
    actionType: HealingActionType,
    targetAgentId: string,
    reason: string,
    options?: { anomaly_id?: string; prediction_id?: string; params?: Record<string, unknown> },
  ): HealingAction {
    const policy = this.findAnyPolicyForAgent(targetAgentId);
    const canAutoHeal = policy?.auto_heal_enabled ?? false;
    const withinLimits = canAutoHeal && this.isWithinHealingLimits(targetAgentId, policy!);

    const action: HealingAction = {
      id: generateId('heal'),
      anomaly_id: options?.anomaly_id,
      prediction_id: options?.prediction_id,
      type: actionType,
      target_agent_id: targetAgentId,
      status: withinLimits ? 'approved' : 'proposed',
      auto_approved: withinLimits,
      priority: this.getActionPriority(actionType),
      created_at: Date.now(),
    };

    this.healingActions.set(action.id, action);
    return action;
  }

  /**
   * Execute a healing action (must be approved first).
   */
  executeHealing(actionId: string): HealingAction | null {
    const action = this.healingActions.get(actionId);
    if (!action || (action.status !== 'approved' && action.status !== 'proposed')) return null;

    action.status = 'executing';
    action.executed_at = Date.now();

    // Track for rate limiting
    const counts = this.healingCountsPerHour.get(action.target_agent_id) ?? [];
    counts.push(Date.now());
    this.healingCountsPerHour.set(action.target_agent_id, counts);

    return action;
  }

  /**
   * Complete a healing action with results.
   */
  completeHealing(actionId: string, result: HealingResult): HealingAction | null {
    const action = this.healingActions.get(actionId);
    if (!action || action.status !== 'executing') return null;

    action.status = result.success ? 'completed' : 'failed';
    action.completed_at = Date.now();
    action.result = result;

    // If successful, resolve associated anomaly
    if (result.success && action.anomaly_id) {
      this.resolveAnomaly(action.anomaly_id, `Auto-healed by action ${actionId}: ${action.type}`);
    }

    return action;
  }

  /**
   * Approve a proposed healing action.
   */
  approveHealing(actionId: string): HealingAction | null {
    const action = this.healingActions.get(actionId);
    if (!action || action.status !== 'proposed') return null;
    action.status = 'approved';
    return action;
  }

  /**
   * Get all healing actions with optional status filter.
   */
  getHealingActions(status?: HealingStatus): HealingAction[] {
    let results = Array.from(this.healingActions.values());
    if (status) {
      results = results.filter(a => a.status === status);
    }
    return results.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Run the full autonomic healing loop:
   * 1. Scan for anomalies
   * 2. Generate predictions
   * 3. Propose healing actions
   * 4. Auto-execute approved actions
   */
  runHealingLoop(): {
    anomalies: Anomaly[];
    predictions: HealthPrediction[];
    actions: HealingAction[];
  } {
    // Step 1: Scan
    const anomalies = this.runAnomalyScan();

    // Step 2: Predict for all agents with anomalies
    const agentsWithIssues = new Set(anomalies.map(a => a.agent_id));
    const predictions: HealthPrediction[] = [];
    for (const agentId of agentsWithIssues) {
      predictions.push(...this.predictHealth(agentId));
    }

    // Step 3: Propose actions for critical anomalies
    const actions: HealingAction[] = [];
    for (const anomaly of anomalies.filter(a => a.severity === 'critical' || a.severity === 'emergency')) {
      const actionType = this.anomalyToAction(anomaly);
      if (actionType) {
        const action = this.proposeHealing(actionType, anomaly.agent_id, anomaly.description, {
          anomaly_id: anomaly.id,
        });
        actions.push(action);
      }
    }

    // Propose actions for high-probability predictions
    for (const pred of predictions.filter(p => p.probability > 0.7)) {
      for (const rec of pred.recommended_actions.slice(0, 1)) { // top recommendation
        const action = this.proposeHealing(rec.type, rec.target_agent_id, rec.description, {
          prediction_id: pred.id,
        });
        actions.push(action);
      }
    }

    return { anomalies, predictions, actions };
  }

  private anomalyToAction(anomaly: Anomaly): HealingActionType | null {
    switch (anomaly.type) {
      case 'spike':
        if (anomaly.category === 'error_rate') return 'circuit_break';
        if (anomaly.category === 'latency') return 'reroute_traffic';
        if (anomaly.category === 'queue_depth') return 'throttle_intake';
        return 'notify_operator';
      case 'cascade':
        return 'quarantine_agent';
      case 'drift':
        return anomaly.severity === 'critical' ? 'reroute_traffic' : 'notify_operator';
      case 'flatline':
        return 'restart_agent';
      default:
        return 'notify_operator';
    }
  }

  private isWithinHealingLimits(agentId: string, policy: HomeostasisPolicy): boolean {
    const now = Date.now();
    const hourAgo = now - 3_600_000;
    const counts = this.healingCountsPerHour.get(agentId) ?? [];

    // Evict old entries
    const recent = counts.filter(t => t > hourAgo);
    this.healingCountsPerHour.set(agentId, recent);

    // Check cooldown
    if (recent.length > 0 && now - recent[recent.length - 1] < policy.cooldown_ms) {
      return false;
    }

    return recent.length < policy.max_auto_actions_per_hour;
  }

  private getActionPriority(type: HealingActionType): number {
    const priorities: Record<HealingActionType, number> = {
      quarantine_agent: 10,
      circuit_break: 9,
      evacuate_workflows: 9,
      reroute_traffic: 8,
      restart_agent: 7,
      scale_ensemble: 6,
      throttle_intake: 5,
      rollback_strategy: 4,
      notify_operator: 3,
    };
    return priorities[type] ?? 5;
  }

  // =========================================================================
  // Homeostasis Policies
  // =========================================================================

  /**
   * Create or update a homeostasis policy.
   */
  setPolicy(policy: HomeostasisPolicy): HomeostasisPolicy {
    this.policies.set(policy.id, policy);
    return policy;
  }

  /**
   * Get all policies.
   */
  getPolicies(): HomeostasisPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Remove a policy.
   */
  removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  /**
   * Evaluate an agent's vitals against all applicable policies.
   */
  evaluateHomeostasis(agentId: string): {
    in_range: boolean;
    violations: Array<{ policy: HomeostasisPolicy; value: number; zone: 'optimal' | 'warning' | 'critical' | 'out_of_range' }>;
  } {
    const vitals = this.getAgentVitals(agentId);
    const violations: Array<{ policy: HomeostasisPolicy; value: number; zone: 'optimal' | 'warning' | 'critical' | 'out_of_range' }> = [];

    for (const vital of vitals) {
      const policy = this.findPolicyForAgent(agentId, vital.category);
      if (!policy) continue;

      const value = vital.mean;
      const zone = this.classifyZone(value, policy);

      if (zone !== 'optimal') {
        violations.push({ policy, value, zone });
      }
    }

    return {
      in_range: violations.length === 0,
      violations,
    };
  }

  private classifyZone(
    value: number,
    policy: HomeostasisPolicy,
  ): 'optimal' | 'warning' | 'critical' | 'out_of_range' {
    if (value >= policy.optimal_range.min && value <= policy.optimal_range.max) return 'optimal';
    if (value >= policy.warning_range.min && value <= policy.warning_range.max) return 'warning';
    if (value >= policy.critical_range.min && value <= policy.critical_range.max) return 'critical';
    return 'out_of_range';
  }

  private findPolicyForAgent(agentId: string, category: VitalSignCategory): HomeostasisPolicy | null {
    for (const policy of this.policies.values()) {
      if (policy.target_category !== category) continue;
      if (policy.applies_to === 'all') return policy;
      if (Array.isArray(policy.applies_to) && policy.applies_to.includes(agentId)) return policy;
    }
    return null;
  }

  private findAnyPolicyForAgent(agentId: string): HomeostasisPolicy | null {
    for (const policy of this.policies.values()) {
      if (policy.applies_to === 'all') return policy;
      if (Array.isArray(policy.applies_to) && policy.applies_to.includes(agentId)) return policy;
    }
    return null;
  }

  // =========================================================================
  // System-Wide Homeostasis
  // =========================================================================

  /**
   * Get a complete picture of system-wide health.
   */
  getSystemHomeostasis(): SystemHomeostasis {
    const now = Date.now();
    const agents = new Set<string>();
    for (const [key] of this.windows) {
      agents.add(key.split(':')[0]);
    }

    let healthy = 0;
    let degraded = 0;
    let critical = 0;

    for (const agentId of agents) {
      const eval_ = this.evaluateHomeostasis(agentId);
      if (eval_.in_range) {
        healthy++;
      } else {
        const hasCritical = eval_.violations.some(v => v.zone === 'critical' || v.zone === 'out_of_range');
        if (hasCritical) critical++;
        else degraded++;
      }
    }

    const activeAnomalies = Array.from(this.anomalies.values()).filter(a => !a.resolved).length;
    const activePredictions = Array.from(this.predictions.values()).filter(p => p.expires_at > now).length;

    const dayAgo = now - 86_400_000;
    const recentActions = Array.from(this.healingActions.values()).filter(a => a.created_at > dayAgo);
    const successfulActions = recentActions.filter(a => a.result?.success);
    const healingSuccessRate = recentActions.length > 0 ? successfulActions.length / recentActions.length : 1;

    const agentCount = agents.size;
    const overallHealth = agentCount > 0
      ? (healthy + degraded * 0.5) / agentCount
      : 1;

    return {
      timestamp: now,
      overall_health: Math.round(overallHealth * 1000) / 1000,
      agent_count: agentCount,
      healthy_agents: healthy,
      degraded_agents: degraded,
      critical_agents: critical,
      active_anomalies: activeAnomalies,
      active_predictions: activePredictions,
      healing_actions_24h: recentActions.length,
      healing_success_rate: Math.round(healingSuccessRate * 1000) / 1000,
      policies: this.getPolicies(),
    };
  }

  // =========================================================================
  // Dependency Graph
  // =========================================================================

  /**
   * Record an interaction between agents (builds dependency graph over time).
   */
  recordInteraction(
    fromAgentId: string,
    toAgentId: string,
    latencyMs: number,
    success: boolean,
  ): AgentDependency {
    let dep = this.dependencies.find(
      d => d.from_agent_id === fromAgentId && d.to_agent_id === toAgentId,
    );

    if (!dep) {
      dep = {
        from_agent_id: fromAgentId,
        to_agent_id: toAgentId,
        dependency_type: 'soft',
        interaction_count: 0,
        avg_latency_ms: 0,
        failure_correlation: 0,
        last_interaction: 0,
      };
      this.dependencies.push(dep);
    }

    // Update rolling averages
    const oldCount = dep.interaction_count;
    dep.interaction_count++;
    dep.avg_latency_ms = (dep.avg_latency_ms * oldCount + latencyMs) / dep.interaction_count;
    dep.last_interaction = Date.now();

    // Update failure correlation (exponential moving average)
    const failureSignal = success ? 0 : 1;
    dep.failure_correlation = dep.failure_correlation * 0.95 + failureSignal * 0.05;

    // Classify dependency type by interaction frequency
    if (dep.interaction_count > 100) dep.dependency_type = 'hard';
    else if (dep.interaction_count > 20) dep.dependency_type = 'soft';
    else dep.dependency_type = 'optional';

    return dep;
  }

  /**
   * Build the full dependency graph.
   */
  buildDependencyGraph(options?: {
    agent_ids?: string[];
    min_interaction_count?: number;
    include_optional?: boolean;
  }): DependencyGraph {
    let edges = [...this.dependencies];

    if (options?.agent_ids) {
      const ids = new Set(options.agent_ids);
      edges = edges.filter(e => ids.has(e.from_agent_id) || ids.has(e.to_agent_id));
    }

    if (options?.min_interaction_count) {
      edges = edges.filter(e => e.interaction_count >= options.min_interaction_count!);
    }

    if (!options?.include_optional) {
      edges = edges.filter(e => e.dependency_type !== 'optional');
    }

    // Collect all agents
    const agentSet = new Set<string>();
    for (const e of edges) {
      agentSet.add(e.from_agent_id);
      agentSet.add(e.to_agent_id);
    }
    const agents = Array.from(agentSet);

    // Find clusters using simple connected components
    const clusters = this.findClusters(agents, edges);

    // Find critical paths (longest chains)
    const criticalPaths = this.findCriticalPaths(agents, edges);

    // Find single points of failure
    const spofs = this.findSinglePointsOfFailure(agents, edges);

    return { agents, edges, clusters, critical_paths: criticalPaths, single_points_of_failure: spofs };
  }

  private findClusters(agents: string[], edges: AgentDependency[]): AgentCluster[] {
    const parent = new Map<string, string>();
    for (const a of agents) parent.set(a, a);

    function find(x: string): string {
      while (parent.get(x) !== x) {
        parent.set(x, parent.get(parent.get(x)!)!);
        x = parent.get(x)!;
      }
      return x;
    }

    function union(a: string, b: string): void {
      parent.set(find(a), find(b));
    }

    for (const e of edges) {
      union(e.from_agent_id, e.to_agent_id);
    }

    const groups = new Map<string, string[]>();
    for (const a of agents) {
      const root = find(a);
      const group = groups.get(root) ?? [];
      group.push(a);
      groups.set(root, group);
    }

    return Array.from(groups.entries()).map(([root, members], i) => {
      // Cohesion: ratio of actual edges to possible edges
      const possibleEdges = members.length * (members.length - 1);
      const actualEdges = edges.filter(
        e => members.includes(e.from_agent_id) && members.includes(e.to_agent_id),
      ).length;

      return {
        id: `cluster_${i}`,
        agents: members,
        cohesion: possibleEdges > 0 ? actualEdges / possibleEdges : 1,
        label: `Cluster ${i + 1} (${members.length} agents)`,
      };
    });
  }

  private findCriticalPaths(agents: string[], edges: AgentDependency[]): string[][] {
    // Find longest paths in the DAG (may have cycles, so we limit depth)
    const adj = new Map<string, string[]>();
    for (const a of agents) adj.set(a, []);
    for (const e of edges) {
      adj.get(e.from_agent_id)?.push(e.to_agent_id);
    }

    const paths: string[][] = [];
    const maxDepth = 10;

    function dfs(node: string, path: string[], visited: Set<string>): void {
      if (path.length > maxDepth) return;
      const neighbors = adj.get(node) ?? [];
      let isEnd = true;

      for (const next of neighbors) {
        if (!visited.has(next)) {
          isEnd = false;
          visited.add(next);
          path.push(next);
          dfs(next, path, visited);
          path.pop();
          visited.delete(next);
        }
      }

      if (isEnd && path.length > 2) {
        paths.push([...path]);
      }
    }

    for (const agent of agents) {
      dfs(agent, [agent], new Set([agent]));
    }

    // Return top 5 longest paths
    return paths.sort((a, b) => b.length - a.length).slice(0, 5);
  }

  private findSinglePointsOfFailure(agents: string[], edges: AgentDependency[]): string[] {
    // An agent is a SPOF if removing it disconnects the graph
    // Simple heuristic: high in-degree + hard dependencies
    const inDegree = new Map<string, number>();
    const hardInDegree = new Map<string, number>();

    for (const e of edges) {
      inDegree.set(e.to_agent_id, (inDegree.get(e.to_agent_id) ?? 0) + 1);
      if (e.dependency_type === 'hard') {
        hardInDegree.set(e.to_agent_id, (hardInDegree.get(e.to_agent_id) ?? 0) + 1);
      }
    }

    // Agent is SPOF if it has hard dependents and high connectivity
    return agents.filter(a => {
      const hard = hardInDegree.get(a) ?? 0;
      const total = inDegree.get(a) ?? 0;
      return hard >= 2 || total >= agents.length * 0.3;
    });
  }
}
