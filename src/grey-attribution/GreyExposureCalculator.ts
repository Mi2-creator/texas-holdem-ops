/**
 * GreyExposureCalculator.ts
 *
 * Pure functions for calculating exposure metrics from grey flow data.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PURE FUNCTIONS: Same inputs produce same outputs
 * - READ-ONLY: Does NOT create new data, only returns derived views
 * - NO SIDE EFFECTS: Does not modify any state
 * - EXPOSURE-ONLY: All outputs are exposure metrics, NOT revenue
 * - PASSIVE: No triggers, no actions, no push
 *
 * SEMANTIC BOUNDARIES:
 * - "Exposure" is risk/impact exposure, NOT revenue or earnings
 * - All calculations are derived views, not new data
 * - Results can be used for analysis, but cannot affect any system
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot create persistent records
 * - Cannot process money, balances, or settlements
 */

import {
  type SourceId,
  type TargetId,
  type PeriodId,
  type ExposureMetric,
  type AttributionRecord,
  ExposureMetricType,
  AttributionEntityType,
  AttributionKind,
  createSourceId,
  createTargetId,
} from './GreyAttributionTypes';

// ============================================================================
// EXPOSURE CALCULATION TYPES
// ============================================================================

/**
 * Exposure Summary - aggregated exposure metrics for an entity
 */
export interface ExposureSummary {
  /** Entity ID */
  readonly entityId: string;
  /** Entity type */
  readonly entityType: AttributionEntityType;
  /** Total exposure share (0.0 to 1.0) */
  readonly totalShare: number;
  /** Total exposure ratio */
  readonly totalRatio: number;
  /** Total exposure weight */
  readonly totalWeight: number;
  /** Total exposure index */
  readonly totalIndex: number;
  /** Count of attributions */
  readonly attributionCount: number;
  /** Direct attribution count */
  readonly directCount: number;
  /** Indirect attribution count */
  readonly indirectCount: number;
  /** Derived attribution count */
  readonly derivedCount: number;
}

/**
 * Exposure Distribution - how exposure is distributed across entities
 */
export interface ExposureDistribution {
  /** Period ID */
  readonly periodId: PeriodId;
  /** Total records analyzed */
  readonly totalRecords: number;
  /** Distribution by entity type */
  readonly byEntityType: ReadonlyMap<AttributionEntityType, number>;
  /** Distribution by kind */
  readonly byKind: ReadonlyMap<AttributionKind, number>;
  /** Top sources by exposure */
  readonly topSources: readonly { sourceId: SourceId; exposure: number }[];
  /** Top targets by exposure */
  readonly topTargets: readonly { targetId: TargetId; exposure: number }[];
  /** Concentration index (0.0 = even, 1.0 = concentrated) */
  readonly concentrationIndex: number;
}

/**
 * Exposure Trend Point - exposure at a point in time
 */
export interface ExposureTrendPoint {
  /** Timestamp */
  readonly timestamp: number;
  /** Total exposure share */
  readonly totalShare: number;
  /** Record count */
  readonly recordCount: number;
}

/**
 * Exposure Trend - exposure over time
 */
export interface ExposureTrend {
  /** Entity ID */
  readonly entityId: string;
  /** Time series data points */
  readonly dataPoints: readonly ExposureTrendPoint[];
  /** Average exposure */
  readonly averageExposure: number;
  /** Max exposure */
  readonly maxExposure: number;
  /** Min exposure */
  readonly minExposure: number;
  /** Trend direction (-1: decreasing, 0: stable, 1: increasing) */
  readonly trendDirection: -1 | 0 | 1;
}

/**
 * Flow Exposure Input - input from grey flow for exposure calculation
 */
export interface FlowExposureInput {
  /** Flow record ID */
  readonly flowId: string;
  /** Entity ID */
  readonly entityId: string;
  /** Entity type */
  readonly entityType: AttributionEntityType;
  /** Unit count (NOT monetary) */
  readonly unitCount: number;
  /** Timestamp */
  readonly timestamp: number;
}

// ============================================================================
// PURE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate exposure summary for a target entity.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculateExposureSummary(
  records: readonly AttributionRecord[],
  targetId: TargetId
): ExposureSummary {
  const targetRecords = records.filter(r => r.targetId === targetId);

  let totalShare = 0;
  let totalRatio = 0;
  let totalWeight = 0;
  let totalIndex = 0;
  let directCount = 0;
  let indirectCount = 0;
  let derivedCount = 0;

  for (const record of targetRecords) {
    for (const metric of record.exposureMetrics) {
      switch (metric.metricType) {
        case ExposureMetricType.SHARE:
          totalShare += metric.value;
          break;
        case ExposureMetricType.RATIO:
          totalRatio += metric.value;
          break;
        case ExposureMetricType.WEIGHT:
          totalWeight += metric.value;
          break;
        case ExposureMetricType.INDEX:
          totalIndex += metric.value;
          break;
      }
    }

    switch (record.kind) {
      case AttributionKind.DIRECT:
        directCount += 1;
        break;
      case AttributionKind.INDIRECT:
        indirectCount += 1;
        break;
      case AttributionKind.DERIVED:
        derivedCount += 1;
        break;
    }
  }

  // Find entity type from first record or default to AGENT
  const entityType = targetRecords.length > 0
    ? targetRecords[0].targetType
    : AttributionEntityType.AGENT;

  return Object.freeze({
    entityId: targetId,
    entityType,
    totalShare,
    totalRatio,
    totalWeight,
    totalIndex,
    attributionCount: targetRecords.length,
    directCount,
    indirectCount,
    derivedCount,
  });
}

/**
 * Calculate exposure summaries for all targets.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculateAllExposureSummaries(
  records: readonly AttributionRecord[]
): readonly ExposureSummary[] {
  const targetIds = new Set<TargetId>();
  for (const record of records) {
    targetIds.add(record.targetId);
  }

  const summaries: ExposureSummary[] = [];
  for (const targetId of targetIds) {
    summaries.push(calculateExposureSummary(records, targetId));
  }

  return Object.freeze(summaries);
}

/**
 * Calculate exposure distribution for a period.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculateExposureDistribution(
  records: readonly AttributionRecord[],
  periodId: PeriodId,
  topN: number = 10
): ExposureDistribution {
  const periodRecords = records.filter(r => r.periodId === periodId);

  // Count by entity type
  const byEntityType = new Map<AttributionEntityType, number>();
  for (const type of Object.values(AttributionEntityType)) {
    byEntityType.set(type, 0);
  }

  // Count by kind
  const byKind = new Map<AttributionKind, number>();
  for (const kind of Object.values(AttributionKind)) {
    byKind.set(kind, 0);
  }

  // Aggregate by source and target
  const sourceExposures = new Map<string, number>();
  const targetExposures = new Map<string, number>();

  for (const record of periodRecords) {
    // Count by entity type
    const currentTypeCount = byEntityType.get(record.targetType) || 0;
    byEntityType.set(record.targetType, currentTypeCount + 1);

    // Count by kind
    const currentKindCount = byKind.get(record.kind) || 0;
    byKind.set(record.kind, currentKindCount + 1);

    // Sum exposure for sources and targets
    const shareMetric = record.exposureMetrics.find((m: ExposureMetric) => m.metricType === ExposureMetricType.SHARE);
    const exposure = shareMetric?.value || 0;

    const currentSourceExposure = sourceExposures.get(record.sourceId) || 0;
    sourceExposures.set(record.sourceId, currentSourceExposure + exposure);

    const currentTargetExposure = targetExposures.get(record.targetId) || 0;
    targetExposures.set(record.targetId, currentTargetExposure + exposure);
  }

  // Get top sources
  const topSources = Array.from(sourceExposures.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([sourceId, exposure]) => ({
      sourceId: createSourceId(sourceId),
      exposure,
    }));

  // Get top targets
  const topTargets = Array.from(targetExposures.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([targetId, exposure]) => ({
      targetId: createTargetId(targetId),
      exposure,
    }));

  // Calculate concentration index (Herfindahl-Hirschman Index normalized)
  const totalExposure = Array.from(targetExposures.values()).reduce((sum, v) => sum + v, 0);
  let concentrationIndex = 0;
  if (totalExposure > 0) {
    for (const exposure of targetExposures.values()) {
      const share = exposure / totalExposure;
      concentrationIndex += share * share;
    }
  }

  return Object.freeze({
    periodId,
    totalRecords: periodRecords.length,
    byEntityType: Object.freeze(byEntityType) as ReadonlyMap<AttributionEntityType, number>,
    byKind: Object.freeze(byKind) as ReadonlyMap<AttributionKind, number>,
    topSources: Object.freeze(topSources),
    topTargets: Object.freeze(topTargets),
    concentrationIndex,
  });
}

/**
 * Calculate exposure trend for an entity over time.
 *
 * PURE FUNCTION: No side effects, returns derived view.
 */
export function calculateExposureTrend(
  records: readonly AttributionRecord[],
  entityId: string,
  windowMs: number = 86400000 // 24 hours default
): ExposureTrend {
  const entityRecords = records.filter(
    r => r.sourceId === entityId || r.targetId === entityId
  );

  if (entityRecords.length === 0) {
    return Object.freeze({
      entityId,
      dataPoints: Object.freeze([]),
      averageExposure: 0,
      maxExposure: 0,
      minExposure: 0,
      trendDirection: 0,
    });
  }

  // Sort by timestamp
  const sorted = [...entityRecords].sort((a, b) => a.timestamp - b.timestamp);
  const minTime = sorted[0].timestamp;
  const maxTime = sorted[sorted.length - 1].timestamp;

  // Group into windows
  const dataPoints: ExposureTrendPoint[] = [];
  let currentWindowStart = minTime;

  while (currentWindowStart <= maxTime) {
    const windowEnd = currentWindowStart + windowMs;
    const windowRecords = sorted.filter(
      r => r.timestamp >= currentWindowStart && r.timestamp < windowEnd
    );

    let totalShare = 0;
    for (const record of windowRecords) {
      const shareMetric = record.exposureMetrics.find((m: ExposureMetric) => m.metricType === ExposureMetricType.SHARE);
      totalShare += shareMetric?.value || 0;
    }

    dataPoints.push({
      timestamp: currentWindowStart,
      totalShare,
      recordCount: windowRecords.length,
    });

    currentWindowStart = windowEnd;
  }

  // Calculate statistics
  const exposures = dataPoints.map(p => p.totalShare);
  const averageExposure = exposures.reduce((sum, v) => sum + v, 0) / exposures.length;
  const maxExposure = Math.max(...exposures);
  const minExposure = Math.min(...exposures);

  // Calculate trend direction
  let trendDirection: -1 | 0 | 1 = 0;
  if (dataPoints.length >= 2) {
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));
    const firstAvg = firstHalf.reduce((sum, p) => sum + p.totalShare, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.totalShare, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    if (diff > 0.01) trendDirection = 1;
    else if (diff < -0.01) trendDirection = -1;
  }

  return Object.freeze({
    entityId,
    dataPoints: Object.freeze(dataPoints),
    averageExposure,
    maxExposure,
    minExposure,
    trendDirection,
  });
}

/**
 * Calculate exposure from flow data.
 *
 * PURE FUNCTION: Derives exposure metrics from flow unit counts.
 */
export function calculateExposureFromFlows(
  flows: readonly FlowExposureInput[]
): readonly { entityId: string; entityType: AttributionEntityType; exposureShare: number }[] {
  if (flows.length === 0) {
    return Object.freeze([]);
  }

  // Sum unit counts by entity
  const entityCounts = new Map<string, { type: AttributionEntityType; count: number }>();
  let totalCount = 0;

  for (const flow of flows) {
    const current = entityCounts.get(flow.entityId);
    if (current) {
      current.count += flow.unitCount;
    } else {
      entityCounts.set(flow.entityId, { type: flow.entityType, count: flow.unitCount });
    }
    totalCount += flow.unitCount;
  }

  // Calculate share for each entity
  const results: { entityId: string; entityType: AttributionEntityType; exposureShare: number }[] = [];

  if (totalCount > 0) {
    for (const [entityId, { type, count }] of entityCounts) {
      results.push({
        entityId,
        entityType: type,
        exposureShare: count / totalCount,
      });
    }
  }

  return Object.freeze(results);
}

/**
 * Calculate weighted exposure combining multiple metrics.
 *
 * PURE FUNCTION: Combines exposure metrics with configurable weights.
 */
export function calculateWeightedExposure(
  metrics: readonly ExposureMetric[],
  weights: { share?: number; ratio?: number; weight?: number; index?: number } = {}
): number {
  const defaultWeights = {
    share: weights.share ?? 1.0,
    ratio: weights.ratio ?? 0.5,
    weight: weights.weight ?? 0.3,
    index: weights.index ?? 0.2,
  };

  let totalWeightedValue = 0;
  let totalWeight = 0;

  for (const metric of metrics) {
    let weight = 0;
    switch (metric.metricType) {
      case ExposureMetricType.SHARE:
        weight = defaultWeights.share;
        break;
      case ExposureMetricType.RATIO:
        weight = defaultWeights.ratio;
        break;
      case ExposureMetricType.WEIGHT:
        weight = defaultWeights.weight;
        break;
      case ExposureMetricType.INDEX:
        weight = defaultWeights.index;
        break;
    }
    totalWeightedValue += metric.value * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
}

/**
 * Compare exposure between two entities.
 *
 * PURE FUNCTION: Returns comparison metrics.
 */
export function compareExposure(
  summaryA: ExposureSummary,
  summaryB: ExposureSummary
): {
  readonly shareDiff: number;
  readonly ratioDiff: number;
  readonly relativeShare: number;
  readonly dominantEntity: string | null;
} {
  const shareDiff = summaryA.totalShare - summaryB.totalShare;
  const ratioDiff = summaryA.totalRatio - summaryB.totalRatio;

  const totalShare = summaryA.totalShare + summaryB.totalShare;
  const relativeShare = totalShare > 0 ? summaryA.totalShare / totalShare : 0.5;

  let dominantEntity: string | null = null;
  if (summaryA.totalShare > summaryB.totalShare * 1.1) {
    dominantEntity = summaryA.entityId;
  } else if (summaryB.totalShare > summaryA.totalShare * 1.1) {
    dominantEntity = summaryB.entityId;
  }

  return Object.freeze({
    shareDiff,
    ratioDiff,
    relativeShare,
    dominantEntity,
  });
}
