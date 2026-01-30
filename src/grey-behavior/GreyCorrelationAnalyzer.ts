/**
 * GreyCorrelationAnalyzer.ts
 *
 * Pure functions for calculating correlation metrics from behavior signals.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PURE FUNCTIONS: Same inputs produce same outputs
 * - READ-ONLY: Does NOT create new data, only returns derived views
 * - NO SIDE EFFECTS: Does not modify any state
 * - CORRELATION ONLY: All outputs are statistical correlations, NOT causation
 * - PASSIVE: No triggers, no actions, no push
 *
 * SEMANTIC BOUNDARIES:
 * - "Correlation" is statistical observation, NOT effect promise
 * - All calculations are derived views, not new data
 * - Results can be used for analysis, but cannot affect any system
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot create persistent records
 * - Cannot process money, balances, or settlements
 * - Cannot promise or guarantee any effect
 */

import {
  type SignalRecord,
  type CorrelationMetric,
  type ActorId,
  type ContextId,
  type PeriodId,
  SignalKind,
  ActorType,
  ContextType,
  CorrelationMetricType,
} from './GreyBehaviorSignalTypes';

// ============================================================================
// CORRELATION ANALYSIS TYPES
// ============================================================================

/**
 * Signal Summary - aggregated statistics for signals.
 */
export interface SignalSummary {
  /** Signal kind */
  readonly kind: SignalKind;
  /** Total signal count */
  readonly count: number;
  /** Total exposure duration */
  readonly totalDurationMs: number;
  /** Average intensity */
  readonly averageIntensity: number;
  /** Max intensity */
  readonly maxIntensity: number;
  /** Min intensity */
  readonly minIntensity: number;
}

/**
 * Actor Signal Profile - signal profile for an actor.
 */
export interface ActorSignalProfile {
  /** Actor ID */
  readonly actorId: ActorId;
  /** Actor type */
  readonly actorType: ActorType;
  /** Signal summaries by kind */
  readonly signalsByKind: ReadonlyMap<SignalKind, SignalSummary>;
  /** Total exposure duration */
  readonly totalExposureDurationMs: number;
  /** Dominant signal kind (most frequent) */
  readonly dominantSignalKind: SignalKind | null;
  /** Observation count */
  readonly observationCount: number;
}

/**
 * Context Signal Distribution - signal distribution within a context.
 */
export interface ContextSignalDistribution {
  /** Context ID */
  readonly contextId: ContextId;
  /** Context type */
  readonly contextType: ContextType;
  /** Distribution by signal kind */
  readonly distributionByKind: ReadonlyMap<SignalKind, number>;
  /** Concentration index (0.0 = even, 1.0 = concentrated) */
  readonly concentrationIndex: number;
  /** Total observations */
  readonly totalObservations: number;
}

/**
 * Period Correlation Summary - correlation summary for a period.
 */
export interface PeriodCorrelationSummary {
  /** Period ID */
  readonly periodId: PeriodId;
  /** Signal count by kind */
  readonly signalCountByKind: ReadonlyMap<SignalKind, number>;
  /** Average intensity by kind */
  readonly averageIntensityByKind: ReadonlyMap<SignalKind, number>;
  /** Actor count */
  readonly actorCount: number;
  /** Context count */
  readonly contextCount: number;
  /** Total observations */
  readonly totalObservations: number;
}

/**
 * Signal Co-occurrence - how often signals co-occur.
 */
export interface SignalCoOccurrence {
  /** First signal kind */
  readonly kindA: SignalKind;
  /** Second signal kind */
  readonly kindB: SignalKind;
  /** Co-occurrence count */
  readonly coOccurrenceCount: number;
  /** Lift value (observed / expected) */
  readonly lift: number;
  /** Confidence level */
  readonly confidence: number;
}

/**
 * Trend Analysis Result - trend analysis for signals.
 */
export interface TrendAnalysis {
  /** Entity ID (actor or context) */
  readonly entityId: string;
  /** Signal kind */
  readonly kind: SignalKind;
  /** Trend direction (-1 = decreasing, 0 = stable, 1 = increasing) */
  readonly direction: -1 | 0 | 1;
  /** Slope of trend line */
  readonly slope: number;
  /** R-squared (coefficient of determination) */
  readonly rSquared: number;
  /** Data points count */
  readonly dataPointCount: number;
}

// ============================================================================
// PURE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate signal summary for a set of signals.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculateSignalSummary(
  signals: readonly SignalRecord[],
  kind: SignalKind
): SignalSummary {
  const filtered = signals.filter(s => s.kind === kind);

  if (filtered.length === 0) {
    return Object.freeze({
      kind,
      count: 0,
      totalDurationMs: 0,
      averageIntensity: 0,
      maxIntensity: 0,
      minIntensity: 0,
    });
  }

  let totalDuration = 0;
  let totalIntensity = 0;
  let maxIntensity = -Infinity;
  let minIntensity = Infinity;

  for (const signal of filtered) {
    totalDuration += signal.durationMs;
    totalIntensity += signal.intensity;
    if (signal.intensity > maxIntensity) maxIntensity = signal.intensity;
    if (signal.intensity < minIntensity) minIntensity = signal.intensity;
  }

  return Object.freeze({
    kind,
    count: filtered.length,
    totalDurationMs: totalDuration,
    averageIntensity: totalIntensity / filtered.length,
    maxIntensity,
    minIntensity,
  });
}

/**
 * Calculate all signal summaries for a set of signals.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculateAllSignalSummaries(
  signals: readonly SignalRecord[]
): readonly SignalSummary[] {
  const summaries: SignalSummary[] = [];

  for (const kind of Object.values(SignalKind)) {
    summaries.push(calculateSignalSummary(signals, kind));
  }

  return Object.freeze(summaries);
}

/**
 * Calculate actor signal profile.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculateActorSignalProfile(
  signals: readonly SignalRecord[],
  actorId: ActorId
): ActorSignalProfile {
  const actorSignals = signals.filter(s => s.actorId === actorId);

  if (actorSignals.length === 0) {
    return Object.freeze({
      actorId,
      actorType: ActorType.PLAYER,
      signalsByKind: new Map() as ReadonlyMap<SignalKind, SignalSummary>,
      totalExposureDurationMs: 0,
      dominantSignalKind: null,
      observationCount: 0,
    });
  }

  const actorType = actorSignals[0].actorType;
  const signalsByKind = new Map<SignalKind, SignalSummary>();
  let totalDuration = 0;
  let maxCount = 0;
  let dominantKind: SignalKind | null = null;

  for (const kind of Object.values(SignalKind)) {
    const summary = calculateSignalSummary(actorSignals, kind);
    signalsByKind.set(kind, summary);
    totalDuration += summary.totalDurationMs;

    if (summary.count > maxCount) {
      maxCount = summary.count;
      dominantKind = kind;
    }
  }

  return Object.freeze({
    actorId,
    actorType,
    signalsByKind: Object.freeze(signalsByKind) as ReadonlyMap<SignalKind, SignalSummary>,
    totalExposureDurationMs: totalDuration,
    dominantSignalKind: dominantKind,
    observationCount: actorSignals.length,
  });
}

/**
 * Calculate context signal distribution.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculateContextSignalDistribution(
  signals: readonly SignalRecord[],
  contextId: ContextId
): ContextSignalDistribution {
  const contextSignals = signals.filter(s => s.contextId === contextId);

  if (contextSignals.length === 0) {
    return Object.freeze({
      contextId,
      contextType: ContextType.SESSION,
      distributionByKind: new Map() as ReadonlyMap<SignalKind, number>,
      concentrationIndex: 0,
      totalObservations: 0,
    });
  }

  const contextType = contextSignals[0].contextType;
  const countsByKind = new Map<SignalKind, number>();

  for (const kind of Object.values(SignalKind)) {
    countsByKind.set(kind, 0);
  }

  for (const signal of contextSignals) {
    const current = countsByKind.get(signal.kind) || 0;
    countsByKind.set(signal.kind, current + 1);
  }

  // Calculate distribution (proportion)
  const distributionByKind = new Map<SignalKind, number>();
  for (const [kind, count] of countsByKind) {
    distributionByKind.set(kind, count / contextSignals.length);
  }

  // Calculate concentration (Herfindahl-Hirschman Index)
  let concentrationIndex = 0;
  for (const proportion of distributionByKind.values()) {
    concentrationIndex += proportion * proportion;
  }

  return Object.freeze({
    contextId,
    contextType,
    distributionByKind: Object.freeze(distributionByKind) as ReadonlyMap<SignalKind, number>,
    concentrationIndex,
    totalObservations: contextSignals.length,
  });
}

/**
 * Calculate period correlation summary.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculatePeriodCorrelationSummary(
  signals: readonly SignalRecord[],
  periodId: PeriodId
): PeriodCorrelationSummary {
  const periodSignals = signals.filter(s => s.periodId === periodId);

  const signalCountByKind = new Map<SignalKind, number>();
  const intensitySumByKind = new Map<SignalKind, number>();
  const actors = new Set<string>();
  const contexts = new Set<string>();

  for (const kind of Object.values(SignalKind)) {
    signalCountByKind.set(kind, 0);
    intensitySumByKind.set(kind, 0);
  }

  for (const signal of periodSignals) {
    const currentCount = signalCountByKind.get(signal.kind) || 0;
    signalCountByKind.set(signal.kind, currentCount + 1);

    const currentIntensity = intensitySumByKind.get(signal.kind) || 0;
    intensitySumByKind.set(signal.kind, currentIntensity + signal.intensity);

    actors.add(signal.actorId);
    contexts.add(signal.contextId);
  }

  // Calculate average intensity
  const averageIntensityByKind = new Map<SignalKind, number>();
  for (const kind of Object.values(SignalKind)) {
    const count = signalCountByKind.get(kind) || 0;
    const sum = intensitySumByKind.get(kind) || 0;
    averageIntensityByKind.set(kind, count > 0 ? sum / count : 0);
  }

  return Object.freeze({
    periodId,
    signalCountByKind: Object.freeze(signalCountByKind) as ReadonlyMap<SignalKind, number>,
    averageIntensityByKind: Object.freeze(averageIntensityByKind) as ReadonlyMap<SignalKind, number>,
    actorCount: actors.size,
    contextCount: contexts.size,
    totalObservations: periodSignals.length,
  });
}

/**
 * Calculate signal co-occurrence.
 *
 * PURE FUNCTION: Calculates how often two signal kinds co-occur for the same actor.
 */
export function calculateSignalCoOccurrence(
  signals: readonly SignalRecord[],
  kindA: SignalKind,
  kindB: SignalKind
): SignalCoOccurrence {
  // Group signals by actor
  const actorSignals = new Map<string, Set<SignalKind>>();

  for (const signal of signals) {
    if (!actorSignals.has(signal.actorId)) {
      actorSignals.set(signal.actorId, new Set());
    }
    actorSignals.get(signal.actorId)!.add(signal.kind);
  }

  const totalActors = actorSignals.size;
  let countA = 0;
  let countB = 0;
  let countBoth = 0;

  for (const kinds of actorSignals.values()) {
    const hasA = kinds.has(kindA);
    const hasB = kinds.has(kindB);
    if (hasA) countA++;
    if (hasB) countB++;
    if (hasA && hasB) countBoth++;
  }

  // Calculate lift
  const expectedBoth = totalActors > 0
    ? (countA / totalActors) * (countB / totalActors) * totalActors
    : 0;
  const lift = expectedBoth > 0 ? countBoth / expectedBoth : 0;

  // Calculate confidence
  const confidence = countA > 0 ? countBoth / countA : 0;

  return Object.freeze({
    kindA,
    kindB,
    coOccurrenceCount: countBoth,
    lift,
    confidence,
  });
}

/**
 * Calculate all signal co-occurrences.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculateAllCoOccurrences(
  signals: readonly SignalRecord[]
): readonly SignalCoOccurrence[] {
  const kinds = Object.values(SignalKind);
  const results: SignalCoOccurrence[] = [];

  for (let i = 0; i < kinds.length; i++) {
    for (let j = i + 1; j < kinds.length; j++) {
      results.push(calculateSignalCoOccurrence(signals, kinds[i], kinds[j]));
    }
  }

  return Object.freeze(results);
}

/**
 * Calculate trend analysis for an entity's signals.
 *
 * PURE FUNCTION: Uses simple linear regression.
 */
export function calculateTrendAnalysis(
  signals: readonly SignalRecord[],
  entityId: string,
  kind: SignalKind,
  windowMs: number = 86400000 // 24 hours
): TrendAnalysis {
  const entitySignals = signals.filter(
    s => (s.actorId === entityId || s.contextId === entityId) && s.kind === kind
  );

  if (entitySignals.length < 2) {
    return Object.freeze({
      entityId,
      kind,
      direction: 0,
      slope: 0,
      rSquared: 0,
      dataPointCount: entitySignals.length,
    });
  }

  // Sort by timestamp
  const sorted = [...entitySignals].sort((a, b) => a.timestamp - b.timestamp);
  const minTime = sorted[0].timestamp;
  const maxTime = sorted[sorted.length - 1].timestamp;

  // Group into windows
  const windows: { time: number; intensity: number }[] = [];
  let currentStart = minTime;

  while (currentStart <= maxTime) {
    const windowEnd = currentStart + windowMs;
    const windowSignals = sorted.filter(
      s => s.timestamp >= currentStart && s.timestamp < windowEnd
    );

    if (windowSignals.length > 0) {
      const avgIntensity = windowSignals.reduce((sum, s) => sum + s.intensity, 0) / windowSignals.length;
      windows.push({ time: currentStart, intensity: avgIntensity });
    }

    currentStart = windowEnd;
  }

  if (windows.length < 2) {
    return Object.freeze({
      entityId,
      kind,
      direction: 0,
      slope: 0,
      rSquared: 0,
      dataPointCount: windows.length,
    });
  }

  // Simple linear regression
  const n = windows.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = windows[i].intensity;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const meanY = sumY / n;

  // Calculate R-squared
  let ssTotal = 0, ssResidual = 0;
  const intercept = (sumY - slope * sumX) / n;

  for (let i = 0; i < n; i++) {
    const y = windows[i].intensity;
    const yPredicted = intercept + slope * i;
    ssTotal += (y - meanY) ** 2;
    ssResidual += (y - yPredicted) ** 2;
  }

  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  // Determine direction
  let direction: -1 | 0 | 1 = 0;
  if (Math.abs(slope) > 0.01) {
    direction = slope > 0 ? 1 : -1;
  }

  return Object.freeze({
    entityId,
    kind,
    direction,
    slope,
    rSquared,
    dataPointCount: windows.length,
  });
}

/**
 * Calculate correlation metrics between signal exposure and activity.
 *
 * PURE FUNCTION: Computes statistical correlations.
 */
export function calculateCorrelationMetrics(
  signals: readonly SignalRecord[],
  kind: SignalKind
): readonly CorrelationMetric[] {
  const kindSignals = signals.filter(s => s.kind === kind);

  if (kindSignals.length === 0) {
    return Object.freeze([]);
  }

  const metrics: CorrelationMetric[] = [];

  // Calculate lift (relative frequency vs expected)
  const totalSignals = signals.length;
  const kindCount = kindSignals.length;
  const expectedShare = 1 / Object.values(SignalKind).length;
  const actualShare = kindCount / totalSignals;
  const lift = expectedShare > 0 ? actualShare / expectedShare : 0;

  metrics.push(Object.freeze({
    metricType: CorrelationMetricType.LIFT,
    value: lift,
    confidence: Math.min(1, kindCount / 30), // confidence increases with sample size
    sampleSize: kindCount,
  }));

  // Calculate delta (difference from average intensity)
  const allIntensities = signals.map(s => s.intensity);
  const allAvgIntensity = allIntensities.reduce((sum, i) => sum + i, 0) / allIntensities.length;
  const kindIntensities = kindSignals.map(s => s.intensity);
  const kindAvgIntensity = kindIntensities.reduce((sum, i) => sum + i, 0) / kindIntensities.length;
  const delta = kindAvgIntensity - allAvgIntensity;

  metrics.push(Object.freeze({
    metricType: CorrelationMetricType.DELTA,
    value: delta,
    confidence: Math.min(1, kindCount / 30),
    sampleSize: kindCount,
  }));

  // Calculate skew (asymmetry in distribution)
  const mean = kindAvgIntensity;
  const variance = kindIntensities.reduce((sum, i) => sum + (i - mean) ** 2, 0) / kindCount;
  const stdDev = Math.sqrt(variance);
  const skew = stdDev > 0
    ? kindIntensities.reduce((sum, i) => sum + ((i - mean) / stdDev) ** 3, 0) / kindCount
    : 0;

  metrics.push(Object.freeze({
    metricType: CorrelationMetricType.SKEW,
    value: skew,
    confidence: Math.min(1, kindCount / 50),
    sampleSize: kindCount,
  }));

  // Calculate index (normalized composite score)
  const normalizedLift = Math.min(2, lift) / 2;
  const normalizedDelta = (delta + 1) / 2; // assuming delta ranges -1 to 1
  const indexValue = (normalizedLift * 0.5 + normalizedDelta * 0.3 + (1 - Math.abs(skew)) * 0.2);

  metrics.push(Object.freeze({
    metricType: CorrelationMetricType.INDEX,
    value: indexValue,
    confidence: Math.min(1, kindCount / 30),
    sampleSize: kindCount,
  }));

  return Object.freeze(metrics);
}

/**
 * Calculate elasticity of signal intensity to context changes.
 *
 * PURE FUNCTION: Measures sensitivity.
 */
export function calculateIntensityElasticity(
  signals: readonly SignalRecord[],
  kind: SignalKind
): CorrelationMetric {
  const kindSignals = signals.filter(s => s.kind === kind);

  if (kindSignals.length < 2) {
    return Object.freeze({
      metricType: CorrelationMetricType.ELASTICITY,
      value: 0,
      confidence: 0,
      sampleSize: kindSignals.length,
    });
  }

  // Group by context and calculate variance
  const contextIntensities = new Map<string, number[]>();

  for (const signal of kindSignals) {
    if (!contextIntensities.has(signal.contextId)) {
      contextIntensities.set(signal.contextId, []);
    }
    contextIntensities.get(signal.contextId)!.push(signal.intensity);
  }

  if (contextIntensities.size < 2) {
    return Object.freeze({
      metricType: CorrelationMetricType.ELASTICITY,
      value: 0,
      confidence: 0.1,
      sampleSize: kindSignals.length,
    });
  }

  // Calculate between-context variance
  const contextMeans: number[] = [];
  for (const intensities of contextIntensities.values()) {
    const mean = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    contextMeans.push(mean);
  }

  const overallMean = contextMeans.reduce((sum, m) => sum + m, 0) / contextMeans.length;
  const betweenVariance = contextMeans.reduce((sum, m) => sum + (m - overallMean) ** 2, 0) / contextMeans.length;

  // Calculate within-context variance
  let withinVariance = 0;
  let totalCount = 0;

  for (const intensities of contextIntensities.values()) {
    const mean = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    for (const intensity of intensities) {
      withinVariance += (intensity - mean) ** 2;
      totalCount++;
    }
  }
  withinVariance /= totalCount;

  // Elasticity = ratio of between to within variance
  const elasticity = withinVariance > 0 ? betweenVariance / withinVariance : 0;

  return Object.freeze({
    metricType: CorrelationMetricType.ELASTICITY,
    value: elasticity,
    confidence: Math.min(1, contextIntensities.size / 10),
    sampleSize: kindSignals.length,
  });
}
