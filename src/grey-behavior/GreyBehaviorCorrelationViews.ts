/**
 * GreyBehaviorCorrelationViews.ts
 *
 * Read-only views for behavior correlation analysis.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - READ-ONLY: All functions return derived views, never modify state
 * - PURE FUNCTIONS: Same inputs produce same outputs
 * - NO SIDE EFFECTS: Does not modify any external state
 * - PASSIVE: Views only, no triggers or actions
 *
 * SEMANTIC BOUNDARIES:
 * - Views are always derived from existing data
 * - Views cannot create new persistent records
 * - Views cannot trigger any actions or side effects
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot modify registry data
 * - Cannot create persistent records
 * - Cannot trigger actions or effects
 * - Cannot promise or guarantee any outcomes
 */

import {
  type SignalRecord,
  type CorrelationRecord,
  type CorrelationMetric,
  type ActorId,
  type ContextId,
  type PeriodId,
  SignalKind,
  ActorType,
  ContextType,
} from './GreyBehaviorSignalTypes';

import {
  calculateActorSignalProfile,
  calculateContextSignalDistribution,
  calculatePeriodCorrelationSummary,
  calculateCorrelationMetrics,
  calculateTrendAnalysis,
  type ActorSignalProfile,
  type ContextSignalDistribution,
  type PeriodCorrelationSummary,
  type TrendAnalysis,
} from './GreyCorrelationAnalyzer';

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * CorrelationBySignalView - correlations grouped by signal kind.
 */
export interface CorrelationBySignalView {
  /** Signal kind */
  readonly kind: SignalKind;
  /** Total signal count */
  readonly signalCount: number;
  /** Average intensity */
  readonly averageIntensity: number;
  /** Total duration exposed */
  readonly totalDurationMs: number;
  /** Correlation metrics */
  readonly metrics: readonly CorrelationMetric[];
  /** Actor count */
  readonly actorCount: number;
  /** Context count */
  readonly contextCount: number;
}

/**
 * CorrelationByActorView - correlations for a specific actor.
 */
export interface CorrelationByActorView {
  /** Actor ID */
  readonly actorId: ActorId;
  /** Actor type */
  readonly actorType: ActorType;
  /** Signal profile */
  readonly profile: ActorSignalProfile;
  /** Correlation metrics by signal kind */
  readonly metricsByKind: ReadonlyMap<SignalKind, readonly CorrelationMetric[]>;
  /** Trend analyses by signal kind */
  readonly trendsByKind: ReadonlyMap<SignalKind, TrendAnalysis>;
  /** Total observation count */
  readonly totalObservations: number;
}

/**
 * CorrelationByContextView - correlations for a specific context.
 */
export interface CorrelationByContextView {
  /** Context ID */
  readonly contextId: ContextId;
  /** Context type */
  readonly contextType: ContextType;
  /** Signal distribution */
  readonly distribution: ContextSignalDistribution;
  /** Top signal kinds in this context */
  readonly topSignalKinds: readonly { kind: SignalKind; count: number; share: number }[];
  /** Actor diversity (unique actors) */
  readonly actorDiversity: number;
  /** Intensity variance */
  readonly intensityVariance: number;
}

/**
 * CorrelationByPeriodView - correlations for a time period.
 */
export interface CorrelationByPeriodView {
  /** Period ID */
  readonly periodId: PeriodId;
  /** Summary statistics */
  readonly summary: PeriodCorrelationSummary;
  /** Signal trends */
  readonly signalTrends: ReadonlyMap<SignalKind, { count: number; avgIntensity: number }>;
  /** Active actors */
  readonly activeActors: readonly ActorId[];
  /** Active contexts */
  readonly activeContexts: readonly ContextId[];
  /** Period start timestamp */
  readonly periodStart: number | null;
  /** Period end timestamp */
  readonly periodEnd: number | null;
}

/**
 * CorrelationTraceView - trace of correlations over time for an entity.
 */
export interface CorrelationTraceView {
  /** Entity ID */
  readonly entityId: string;
  /** Entity type description */
  readonly entityType: 'actor' | 'context';
  /** Time-ordered observations */
  readonly observations: readonly {
    timestamp: number;
    kind: SignalKind;
    intensity: number;
    durationMs: number;
  }[];
  /** Trend summary */
  readonly trendSummary: {
    readonly overallDirection: -1 | 0 | 1;
    readonly dominantKind: SignalKind | null;
    readonly volatilityIndex: number;
  };
  /** Observation span in milliseconds */
  readonly observationSpanMs: number;
}

// ============================================================================
// VIEW BUILDER FUNCTIONS
// ============================================================================

/**
 * Build correlation view by signal kind.
 *
 * PURE FUNCTION: Returns derived view.
 */
export function buildCorrelationBySignalView(
  signals: readonly SignalRecord[],
  kind: SignalKind
): CorrelationBySignalView {
  const kindSignals = signals.filter(s => s.kind === kind);

  if (kindSignals.length === 0) {
    return Object.freeze({
      kind,
      signalCount: 0,
      averageIntensity: 0,
      totalDurationMs: 0,
      metrics: Object.freeze([]),
      actorCount: 0,
      contextCount: 0,
    });
  }

  const actors = new Set<string>();
  const contexts = new Set<string>();
  let totalIntensity = 0;
  let totalDuration = 0;

  for (const signal of kindSignals) {
    actors.add(signal.actorId);
    contexts.add(signal.contextId);
    totalIntensity += signal.intensity;
    totalDuration += signal.durationMs;
  }

  const metrics = calculateCorrelationMetrics(signals, kind);

  return Object.freeze({
    kind,
    signalCount: kindSignals.length,
    averageIntensity: totalIntensity / kindSignals.length,
    totalDurationMs: totalDuration,
    metrics,
    actorCount: actors.size,
    contextCount: contexts.size,
  });
}

/**
 * Build all correlation views by signal kind.
 *
 * PURE FUNCTION: Returns derived views.
 */
export function buildAllCorrelationBySignalViews(
  signals: readonly SignalRecord[]
): readonly CorrelationBySignalView[] {
  const views: CorrelationBySignalView[] = [];

  for (const kind of Object.values(SignalKind)) {
    views.push(buildCorrelationBySignalView(signals, kind));
  }

  return Object.freeze(views);
}

/**
 * Build correlation view by actor.
 *
 * PURE FUNCTION: Returns derived view.
 */
export function buildCorrelationByActorView(
  signals: readonly SignalRecord[],
  actorId: ActorId
): CorrelationByActorView {
  const actorSignals = signals.filter(s => s.actorId === actorId);

  const actorType = actorSignals.length > 0
    ? actorSignals[0].actorType
    : ActorType.PLAYER;

  const profile = calculateActorSignalProfile(signals, actorId);

  const metricsByKind = new Map<SignalKind, readonly CorrelationMetric[]>();
  const trendsByKind = new Map<SignalKind, TrendAnalysis>();

  for (const kind of Object.values(SignalKind)) {
    metricsByKind.set(kind, calculateCorrelationMetrics(actorSignals, kind));
    trendsByKind.set(kind, calculateTrendAnalysis(signals, actorId, kind));
  }

  return Object.freeze({
    actorId,
    actorType,
    profile,
    metricsByKind: Object.freeze(metricsByKind) as ReadonlyMap<SignalKind, readonly CorrelationMetric[]>,
    trendsByKind: Object.freeze(trendsByKind) as ReadonlyMap<SignalKind, TrendAnalysis>,
    totalObservations: actorSignals.length,
  });
}

/**
 * Build correlation view by context.
 *
 * PURE FUNCTION: Returns derived view.
 */
export function buildCorrelationByContextView(
  signals: readonly SignalRecord[],
  contextId: ContextId
): CorrelationByContextView {
  const contextSignals = signals.filter(s => s.contextId === contextId);

  const contextType = contextSignals.length > 0
    ? contextSignals[0].contextType
    : ContextType.SESSION;

  const distribution = calculateContextSignalDistribution(signals, contextId);

  // Calculate top signal kinds
  const kindCounts = new Map<SignalKind, number>();
  for (const kind of Object.values(SignalKind)) {
    kindCounts.set(kind, 0);
  }

  for (const signal of contextSignals) {
    const current = kindCounts.get(signal.kind) || 0;
    kindCounts.set(signal.kind, current + 1);
  }

  const topSignalKinds = Array.from(kindCounts.entries())
    .map(([kind, count]) => ({
      kind,
      count,
      share: contextSignals.length > 0 ? count / contextSignals.length : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate actor diversity
  const actors = new Set<string>();
  for (const signal of contextSignals) {
    actors.add(signal.actorId);
  }

  // Calculate intensity variance
  let intensityVariance = 0;
  if (contextSignals.length > 1) {
    const mean = contextSignals.reduce((sum, s) => sum + s.intensity, 0) / contextSignals.length;
    intensityVariance = contextSignals.reduce((sum, s) => sum + (s.intensity - mean) ** 2, 0) / contextSignals.length;
  }

  return Object.freeze({
    contextId,
    contextType,
    distribution,
    topSignalKinds: Object.freeze(topSignalKinds),
    actorDiversity: actors.size,
    intensityVariance,
  });
}

/**
 * Build correlation view by period.
 *
 * PURE FUNCTION: Returns derived view.
 */
export function buildCorrelationByPeriodView(
  signals: readonly SignalRecord[],
  periodId: PeriodId
): CorrelationByPeriodView {
  const periodSignals = signals.filter(s => s.periodId === periodId);

  const summary = calculatePeriodCorrelationSummary(signals, periodId);

  // Calculate signal trends by kind
  const signalTrends = new Map<SignalKind, { count: number; avgIntensity: number }>();

  for (const kind of Object.values(SignalKind)) {
    const kindSignals = periodSignals.filter(s => s.kind === kind);
    const avgIntensity = kindSignals.length > 0
      ? kindSignals.reduce((sum, s) => sum + s.intensity, 0) / kindSignals.length
      : 0;
    signalTrends.set(kind, { count: kindSignals.length, avgIntensity });
  }

  // Get active actors and contexts
  const actors = new Set<ActorId>();
  const contexts = new Set<ContextId>();
  let periodStart: number | null = null;
  let periodEnd: number | null = null;

  for (const signal of periodSignals) {
    actors.add(signal.actorId);
    contexts.add(signal.contextId);

    if (periodStart === null || signal.timestamp < periodStart) {
      periodStart = signal.timestamp;
    }
    if (periodEnd === null || signal.timestamp > periodEnd) {
      periodEnd = signal.timestamp;
    }
  }

  return Object.freeze({
    periodId,
    summary,
    signalTrends: Object.freeze(signalTrends) as ReadonlyMap<SignalKind, { count: number; avgIntensity: number }>,
    activeActors: Object.freeze(Array.from(actors)),
    activeContexts: Object.freeze(Array.from(contexts)),
    periodStart,
    periodEnd,
  });
}

/**
 * Build correlation trace view for an entity.
 *
 * PURE FUNCTION: Returns time-ordered trace.
 */
export function buildCorrelationTraceView(
  signals: readonly SignalRecord[],
  entityId: string,
  entityType: 'actor' | 'context'
): CorrelationTraceView {
  const entitySignals = entityType === 'actor'
    ? signals.filter(s => s.actorId === entityId)
    : signals.filter(s => s.contextId === entityId);

  if (entitySignals.length === 0) {
    return Object.freeze({
      entityId,
      entityType,
      observations: Object.freeze([]),
      trendSummary: Object.freeze({
        overallDirection: 0 as const,
        dominantKind: null,
        volatilityIndex: 0,
      }),
      observationSpanMs: 0,
    });
  }

  // Sort by timestamp
  const sorted = [...entitySignals].sort((a, b) => a.timestamp - b.timestamp);

  const observations = sorted.map(s => Object.freeze({
    timestamp: s.timestamp,
    kind: s.kind,
    intensity: s.intensity,
    durationMs: s.durationMs,
  }));

  // Calculate trend summary
  const kindCounts = new Map<SignalKind, number>();
  for (const signal of sorted) {
    const current = kindCounts.get(signal.kind) || 0;
    kindCounts.set(signal.kind, current + 1);
  }

  let dominantKind: SignalKind | null = null;
  let maxCount = 0;
  for (const [kind, count] of kindCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantKind = kind;
    }
  }

  // Calculate overall trend direction
  let overallDirection: -1 | 0 | 1 = 0;
  if (sorted.length >= 2) {
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    const firstAvg = firstHalf.reduce((sum, s) => sum + s.intensity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.intensity, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 0.05) overallDirection = 1;
    else if (diff < -0.05) overallDirection = -1;
  }

  // Calculate volatility index (coefficient of variation)
  const intensities = sorted.map(s => s.intensity);
  const mean = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
  const variance = intensities.reduce((sum, i) => sum + (i - mean) ** 2, 0) / intensities.length;
  const volatilityIndex = mean > 0 ? Math.sqrt(variance) / mean : 0;

  // Calculate observation span
  const observationSpanMs = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;

  return Object.freeze({
    entityId,
    entityType,
    observations: Object.freeze(observations),
    trendSummary: Object.freeze({
      overallDirection,
      dominantKind,
      volatilityIndex,
    }),
    observationSpanMs,
  });
}

/**
 * Build summary view of all correlations.
 *
 * PURE FUNCTION: Returns high-level summary.
 */
export function buildCorrelationSummaryView(
  signals: readonly SignalRecord[],
  correlations: readonly CorrelationRecord[]
): {
  readonly totalSignals: number;
  readonly totalCorrelations: number;
  readonly signalsByKind: ReadonlyMap<SignalKind, number>;
  readonly correlationsByKind: ReadonlyMap<SignalKind, number>;
  readonly uniqueActors: number;
  readonly uniqueContexts: number;
  readonly uniquePeriods: number;
  readonly averageIntensity: number;
  readonly averageConfidence: number;
} {
  const signalsByKind = new Map<SignalKind, number>();
  const correlationsByKind = new Map<SignalKind, number>();
  const actors = new Set<string>();
  const contexts = new Set<string>();
  const periods = new Set<string>();
  let totalIntensity = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const kind of Object.values(SignalKind)) {
    signalsByKind.set(kind, 0);
    correlationsByKind.set(kind, 0);
  }

  for (const signal of signals) {
    const current = signalsByKind.get(signal.kind) || 0;
    signalsByKind.set(signal.kind, current + 1);
    actors.add(signal.actorId);
    contexts.add(signal.contextId);
    periods.add(signal.periodId);
    totalIntensity += signal.intensity;
  }

  for (const correlation of correlations) {
    const current = correlationsByKind.get(correlation.signalKind) || 0;
    correlationsByKind.set(correlation.signalKind, current + 1);

    for (const metric of correlation.metrics) {
      totalConfidence += metric.confidence;
      confidenceCount++;
    }
  }

  return Object.freeze({
    totalSignals: signals.length,
    totalCorrelations: correlations.length,
    signalsByKind: Object.freeze(signalsByKind) as ReadonlyMap<SignalKind, number>,
    correlationsByKind: Object.freeze(correlationsByKind) as ReadonlyMap<SignalKind, number>,
    uniqueActors: actors.size,
    uniqueContexts: contexts.size,
    uniquePeriods: periods.size,
    averageIntensity: signals.length > 0 ? totalIntensity / signals.length : 0,
    averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
  });
}

/**
 * Build top actors view by signal exposure.
 *
 * PURE FUNCTION: Returns top N actors by total signal exposure.
 */
export function buildTopActorsView(
  signals: readonly SignalRecord[],
  topN: number = 10
): readonly {
  readonly actorId: ActorId;
  readonly actorType: ActorType;
  readonly signalCount: number;
  readonly totalIntensity: number;
  readonly totalDurationMs: number;
}[] {
  const actorStats = new Map<string, {
    actorType: ActorType;
    count: number;
    intensity: number;
    duration: number;
  }>();

  for (const signal of signals) {
    const existing = actorStats.get(signal.actorId);
    if (existing) {
      existing.count++;
      existing.intensity += signal.intensity;
      existing.duration += signal.durationMs;
    } else {
      actorStats.set(signal.actorId, {
        actorType: signal.actorType,
        count: 1,
        intensity: signal.intensity,
        duration: signal.durationMs,
      });
    }
  }

  const sorted = Array.from(actorStats.entries())
    .map(([actorId, stats]) => ({
      actorId: actorId as ActorId,
      actorType: stats.actorType,
      signalCount: stats.count,
      totalIntensity: stats.intensity,
      totalDurationMs: stats.duration,
    }))
    .sort((a, b) => b.signalCount - a.signalCount)
    .slice(0, topN);

  return Object.freeze(sorted.map(s => Object.freeze(s)));
}

/**
 * Build top contexts view by signal concentration.
 *
 * PURE FUNCTION: Returns top N contexts by signal concentration.
 */
export function buildTopContextsView(
  signals: readonly SignalRecord[],
  topN: number = 10
): readonly {
  readonly contextId: ContextId;
  readonly contextType: ContextType;
  readonly signalCount: number;
  readonly uniqueActors: number;
  readonly concentrationIndex: number;
}[] {
  const contextStats = new Map<string, {
    contextType: ContextType;
    signals: SignalRecord[];
    actors: Set<string>;
  }>();

  for (const signal of signals) {
    const existing = contextStats.get(signal.contextId);
    if (existing) {
      existing.signals.push(signal);
      existing.actors.add(signal.actorId);
    } else {
      contextStats.set(signal.contextId, {
        contextType: signal.contextType,
        signals: [signal],
        actors: new Set([signal.actorId]),
      });
    }
  }

  const results = Array.from(contextStats.entries())
    .map(([contextId, stats]) => {
      // Calculate concentration index
      const kindCounts = new Map<SignalKind, number>();
      for (const signal of stats.signals) {
        const current = kindCounts.get(signal.kind) || 0;
        kindCounts.set(signal.kind, current + 1);
      }

      let concentrationIndex = 0;
      for (const count of kindCounts.values()) {
        const share = count / stats.signals.length;
        concentrationIndex += share * share;
      }

      return {
        contextId: contextId as ContextId,
        contextType: stats.contextType,
        signalCount: stats.signals.length,
        uniqueActors: stats.actors.size,
        concentrationIndex,
      };
    })
    .sort((a, b) => b.signalCount - a.signalCount)
    .slice(0, topN);

  return Object.freeze(results.map(r => Object.freeze(r)));
}
