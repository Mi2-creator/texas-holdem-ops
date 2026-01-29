/**
 * GreyFlowAggregation.ts
 *
 * Read-only aggregation functions for grey flow analytics.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - READ-ONLY: All functions return frozen data, no mutations
 * - PURE FUNCTIONS: Same inputs produce same outputs
 * - PASSIVE: No side effects, no triggers, no actions
 * - RATIO-ONLY: "Rake" is ratio/share/index, NOT deduction
 *
 * SEMANTIC BOUNDARIES:
 * - "Volume" is unit count, NOT monetary amount
 * - "Frequency" is occurrence count per time window
 * - "Distribution" is proportional share (0.0 to 1.0)
 * - "Rake ratio" is a calculated index, NOT a fee
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot modify any data
 * - Cannot process money, balances, or settlements
 */

import {
  type GreyFlowRecord,
  type EntityId,
  FlowDirection,
  FlowSource,
} from './GreyFlowTypes';

// ============================================================================
// AGGREGATION TYPES
// ============================================================================

/**
 * Volume Aggregation - total and directional unit counts
 *
 * NOTE: These are UNIT COUNTS, not monetary values.
 */
export interface VolumeAggregation {
  /** Total unit count */
  readonly totalUnits: number;
  /** Inbound unit count */
  readonly inboundUnits: number;
  /** Outbound unit count */
  readonly outboundUnits: number;
  /** Internal unit count */
  readonly internalUnits: number;
  /** Net flow (inbound - outbound) */
  readonly netFlow: number;
  /** Record count */
  readonly recordCount: number;
}

/**
 * Frequency Aggregation - occurrence counts
 */
export interface FrequencyAggregation {
  /** Total flow count */
  readonly totalFlows: number;
  /** Flows by direction */
  readonly byDirection: Readonly<Record<FlowDirection, number>>;
  /** Flows by source */
  readonly bySource: Readonly<Record<FlowSource, number>>;
  /** Average flows per period (if period specified) */
  readonly averagePerPeriod?: number;
  /** Peak flows in single period */
  readonly peakFlows?: number;
}

/**
 * Distribution Aggregation - proportional shares (0.0 to 1.0)
 */
export interface DistributionAggregation {
  /** Distribution by entity */
  readonly byEntity: Readonly<Record<string, number>>;
  /** Distribution by source */
  readonly bySource: Readonly<Record<FlowSource, number>>;
  /** Distribution by direction */
  readonly byDirection: Readonly<Record<FlowDirection, number>>;
  /** Concentration index (Herfindahl-like, 0.0 to 1.0) */
  readonly concentrationIndex: number;
}

/**
 * Rake Ratio Aggregation - calculated ratios/indices
 *
 * CRITICAL: These are RATIOS, not fees or deductions.
 * They represent proportional relationships for analysis.
 */
export interface RakeRatioAggregation {
  /** Outbound to inbound ratio */
  readonly outboundToInboundRatio: number;
  /** Internal to total ratio */
  readonly internalToTotalRatio: number;
  /** Net flow ratio (net / total) */
  readonly netFlowRatio: number;
  /** Average units per flow */
  readonly averageUnitsPerFlow: number;
  /** Entity activity index by entity */
  readonly entityActivityIndex: Readonly<Record<string, number>>;
}

/**
 * Time Series Point - single point in time series
 */
export interface TimeSeriesPoint {
  /** Period start timestamp */
  readonly periodStart: number;
  /** Period end timestamp */
  readonly periodEnd: number;
  /** Volume in this period */
  readonly volume: VolumeAggregation;
  /** Frequency in this period */
  readonly frequency: FrequencyAggregation;
}

/**
 * Time Series Aggregation - aggregation over time
 */
export interface TimeSeriesAggregation {
  /** Time series points */
  readonly points: readonly TimeSeriesPoint[];
  /** Overall aggregation */
  readonly overall: VolumeAggregation;
  /** Period duration in milliseconds */
  readonly periodDurationMs: number;
  /** Total time span in milliseconds */
  readonly totalTimeSpanMs: number;
}

// ============================================================================
// PURE AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Compute volume aggregation from flow records.
 *
 * PURE FUNCTION: No side effects, same inputs produce same outputs.
 * READ-ONLY: Returns frozen data.
 */
export function computeVolumeAggregation(
  records: readonly GreyFlowRecord[]
): VolumeAggregation {
  let totalUnits = 0;
  let inboundUnits = 0;
  let outboundUnits = 0;
  let internalUnits = 0;

  for (const record of records) {
    totalUnits += record.unitCount;

    switch (record.direction) {
      case FlowDirection.INBOUND:
        inboundUnits += record.unitCount;
        break;
      case FlowDirection.OUTBOUND:
        outboundUnits += record.unitCount;
        break;
      case FlowDirection.INTERNAL:
        internalUnits += record.unitCount;
        break;
    }
  }

  return Object.freeze({
    totalUnits,
    inboundUnits,
    outboundUnits,
    internalUnits,
    netFlow: inboundUnits - outboundUnits,
    recordCount: records.length,
  });
}

/**
 * Compute frequency aggregation from flow records.
 *
 * PURE FUNCTION: No side effects.
 * READ-ONLY: Returns frozen data.
 */
export function computeFrequencyAggregation(
  records: readonly GreyFlowRecord[],
  periodMs?: number
): FrequencyAggregation {
  const byDirection: Record<FlowDirection, number> = {
    [FlowDirection.INBOUND]: 0,
    [FlowDirection.OUTBOUND]: 0,
    [FlowDirection.INTERNAL]: 0,
  };

  const bySource: Record<FlowSource, number> = {
    [FlowSource.TABLE]: 0,
    [FlowSource.AGENT]: 0,
    [FlowSource.CLUB]: 0,
    [FlowSource.PLAYER]: 0,
    [FlowSource.EXTERNAL]: 0,
  };

  for (const record of records) {
    byDirection[record.direction]++;
    bySource[record.source]++;
  }

  let averagePerPeriod: number | undefined;
  let peakFlows: number | undefined;

  if (periodMs && records.length > 0) {
    // Find time range
    const timestamps = records.map(r => r.createdAt);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeSpan = maxTime - minTime;

    if (timeSpan > 0) {
      const periodCount = Math.ceil(timeSpan / periodMs);
      averagePerPeriod = records.length / periodCount;

      // Count flows per period to find peak
      const periodCounts = new Map<number, number>();
      for (const record of records) {
        const periodIndex = Math.floor((record.createdAt - minTime) / periodMs);
        periodCounts.set(periodIndex, (periodCounts.get(periodIndex) || 0) + 1);
      }
      peakFlows = Math.max(...periodCounts.values());
    }
  }

  return Object.freeze({
    totalFlows: records.length,
    byDirection: Object.freeze(byDirection),
    bySource: Object.freeze(bySource),
    averagePerPeriod,
    peakFlows,
  });
}

/**
 * Compute distribution aggregation from flow records.
 *
 * PURE FUNCTION: No side effects.
 * READ-ONLY: Returns frozen data.
 */
export function computeDistributionAggregation(
  records: readonly GreyFlowRecord[]
): DistributionAggregation {
  if (records.length === 0) {
    return Object.freeze({
      byEntity: Object.freeze({}),
      bySource: Object.freeze({
        [FlowSource.TABLE]: 0,
        [FlowSource.AGENT]: 0,
        [FlowSource.CLUB]: 0,
        [FlowSource.PLAYER]: 0,
        [FlowSource.EXTERNAL]: 0,
      }),
      byDirection: Object.freeze({
        [FlowDirection.INBOUND]: 0,
        [FlowDirection.OUTBOUND]: 0,
        [FlowDirection.INTERNAL]: 0,
      }),
      concentrationIndex: 0,
    });
  }

  // Count by entity
  const entityCounts = new Map<string, number>();
  for (const record of records) {
    entityCounts.set(
      record.sourceEntityId,
      (entityCounts.get(record.sourceEntityId) || 0) + 1
    );
  }

  // Convert to distribution
  const totalFlows = records.length;
  const byEntity: Record<string, number> = {};
  for (const [entityId, count] of entityCounts) {
    byEntity[entityId] = count / totalFlows;
  }

  // Count by source
  const sourceCounts: Record<FlowSource, number> = {
    [FlowSource.TABLE]: 0,
    [FlowSource.AGENT]: 0,
    [FlowSource.CLUB]: 0,
    [FlowSource.PLAYER]: 0,
    [FlowSource.EXTERNAL]: 0,
  };
  for (const record of records) {
    sourceCounts[record.source]++;
  }
  const bySource: Record<FlowSource, number> = {
    [FlowSource.TABLE]: sourceCounts[FlowSource.TABLE] / totalFlows,
    [FlowSource.AGENT]: sourceCounts[FlowSource.AGENT] / totalFlows,
    [FlowSource.CLUB]: sourceCounts[FlowSource.CLUB] / totalFlows,
    [FlowSource.PLAYER]: sourceCounts[FlowSource.PLAYER] / totalFlows,
    [FlowSource.EXTERNAL]: sourceCounts[FlowSource.EXTERNAL] / totalFlows,
  };

  // Count by direction
  const directionCounts: Record<FlowDirection, number> = {
    [FlowDirection.INBOUND]: 0,
    [FlowDirection.OUTBOUND]: 0,
    [FlowDirection.INTERNAL]: 0,
  };
  for (const record of records) {
    directionCounts[record.direction]++;
  }
  const byDirection: Record<FlowDirection, number> = {
    [FlowDirection.INBOUND]: directionCounts[FlowDirection.INBOUND] / totalFlows,
    [FlowDirection.OUTBOUND]: directionCounts[FlowDirection.OUTBOUND] / totalFlows,
    [FlowDirection.INTERNAL]: directionCounts[FlowDirection.INTERNAL] / totalFlows,
  };

  // Compute concentration index (Herfindahl-like)
  let concentrationIndex = 0;
  for (const share of Object.values(byEntity)) {
    concentrationIndex += share * share;
  }

  return Object.freeze({
    byEntity: Object.freeze(byEntity),
    bySource: Object.freeze(bySource),
    byDirection: Object.freeze(byDirection),
    concentrationIndex,
  });
}

/**
 * Compute rake ratio aggregation from flow records.
 *
 * CRITICAL: These are RATIOS for analysis, NOT fees or deductions.
 *
 * PURE FUNCTION: No side effects.
 * READ-ONLY: Returns frozen data.
 */
export function computeRakeRatioAggregation(
  records: readonly GreyFlowRecord[]
): RakeRatioAggregation {
  const volume = computeVolumeAggregation(records);

  // Compute ratios
  const outboundToInboundRatio = volume.inboundUnits > 0
    ? volume.outboundUnits / volume.inboundUnits
    : 0;

  const internalToTotalRatio = volume.totalUnits > 0
    ? volume.internalUnits / volume.totalUnits
    : 0;

  const netFlowRatio = volume.totalUnits > 0
    ? volume.netFlow / volume.totalUnits
    : 0;

  const averageUnitsPerFlow = records.length > 0
    ? volume.totalUnits / records.length
    : 0;

  // Compute entity activity index
  const entityUnits = new Map<string, number>();
  for (const record of records) {
    entityUnits.set(
      record.sourceEntityId,
      (entityUnits.get(record.sourceEntityId) || 0) + record.unitCount
    );
  }

  const entityActivityIndex: Record<string, number> = {};
  for (const [entityId, units] of entityUnits) {
    entityActivityIndex[entityId] = volume.totalUnits > 0
      ? units / volume.totalUnits
      : 0;
  }

  return Object.freeze({
    outboundToInboundRatio,
    internalToTotalRatio,
    netFlowRatio,
    averageUnitsPerFlow,
    entityActivityIndex: Object.freeze(entityActivityIndex),
  });
}

/**
 * Compute time series aggregation from flow records.
 *
 * PURE FUNCTION: No side effects.
 * READ-ONLY: Returns frozen data.
 */
export function computeTimeSeriesAggregation(
  records: readonly GreyFlowRecord[],
  periodMs: number
): TimeSeriesAggregation {
  if (records.length === 0) {
    return Object.freeze({
      points: Object.freeze([]),
      overall: computeVolumeAggregation([]),
      periodDurationMs: periodMs,
      totalTimeSpanMs: 0,
    });
  }

  // Find time range
  const timestamps = records.map(r => r.createdAt);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeSpan = maxTime - minTime;

  // Group records by period
  const periodRecords = new Map<number, GreyFlowRecord[]>();
  for (const record of records) {
    const periodIndex = Math.floor((record.createdAt - minTime) / periodMs);
    if (!periodRecords.has(periodIndex)) {
      periodRecords.set(periodIndex, []);
    }
    periodRecords.get(periodIndex)!.push(record);
  }

  // Create time series points
  const points: TimeSeriesPoint[] = [];
  const periodCount = Math.ceil(timeSpan / periodMs) + 1;

  for (let i = 0; i < periodCount; i++) {
    const periodStart = minTime + i * periodMs;
    const periodEnd = periodStart + periodMs;
    const periodRecs = periodRecords.get(i) || [];

    points.push(Object.freeze({
      periodStart,
      periodEnd,
      volume: computeVolumeAggregation(periodRecs),
      frequency: computeFrequencyAggregation(periodRecs),
    }));
  }

  return Object.freeze({
    points: Object.freeze(points),
    overall: computeVolumeAggregation(records),
    periodDurationMs: periodMs,
    totalTimeSpanMs: timeSpan,
  });
}

// ============================================================================
// ENTITY-SPECIFIC AGGREGATIONS
// ============================================================================

/**
 * Compute volume aggregation for a specific entity.
 *
 * PURE FUNCTION: No side effects.
 */
export function computeEntityVolume(
  records: readonly GreyFlowRecord[],
  entityId: EntityId
): VolumeAggregation {
  const entityRecords = records.filter(
    r => r.sourceEntityId === entityId || r.targetEntityId === entityId
  );
  return computeVolumeAggregation(entityRecords);
}

/**
 * Compute frequency aggregation for a specific entity.
 *
 * PURE FUNCTION: No side effects.
 */
export function computeEntityFrequency(
  records: readonly GreyFlowRecord[],
  entityId: EntityId,
  periodMs?: number
): FrequencyAggregation {
  const entityRecords = records.filter(
    r => r.sourceEntityId === entityId || r.targetEntityId === entityId
  );
  return computeFrequencyAggregation(entityRecords, periodMs);
}

/**
 * Compute rake ratios for a specific entity.
 *
 * PURE FUNCTION: No side effects.
 */
export function computeEntityRakeRatios(
  records: readonly GreyFlowRecord[],
  entityId: EntityId
): RakeRatioAggregation {
  const entityRecords = records.filter(
    r => r.sourceEntityId === entityId || r.targetEntityId === entityId
  );
  return computeRakeRatioAggregation(entityRecords);
}

// ============================================================================
// SOURCE-SPECIFIC AGGREGATIONS
// ============================================================================

/**
 * Compute volume aggregation by source type.
 *
 * PURE FUNCTION: No side effects.
 */
export function computeVolumeBySource(
  records: readonly GreyFlowRecord[]
): Readonly<Record<FlowSource, VolumeAggregation>> {
  const result: Record<FlowSource, VolumeAggregation> = {
    [FlowSource.TABLE]: computeVolumeAggregation([]),
    [FlowSource.AGENT]: computeVolumeAggregation([]),
    [FlowSource.CLUB]: computeVolumeAggregation([]),
    [FlowSource.PLAYER]: computeVolumeAggregation([]),
    [FlowSource.EXTERNAL]: computeVolumeAggregation([]),
  };

  const bySource = new Map<FlowSource, GreyFlowRecord[]>();
  for (const record of records) {
    if (!bySource.has(record.source)) {
      bySource.set(record.source, []);
    }
    bySource.get(record.source)!.push(record);
  }

  for (const [source, sourceRecords] of bySource) {
    result[source] = computeVolumeAggregation(sourceRecords);
  }

  return Object.freeze(result);
}

/**
 * Compute frequency aggregation by source type.
 *
 * PURE FUNCTION: No side effects.
 */
export function computeFrequencyBySource(
  records: readonly GreyFlowRecord[],
  periodMs?: number
): Readonly<Record<FlowSource, FrequencyAggregation>> {
  const result: Record<FlowSource, FrequencyAggregation> = {
    [FlowSource.TABLE]: computeFrequencyAggregation([], periodMs),
    [FlowSource.AGENT]: computeFrequencyAggregation([], periodMs),
    [FlowSource.CLUB]: computeFrequencyAggregation([], periodMs),
    [FlowSource.PLAYER]: computeFrequencyAggregation([], periodMs),
    [FlowSource.EXTERNAL]: computeFrequencyAggregation([], periodMs),
  };

  const bySource = new Map<FlowSource, GreyFlowRecord[]>();
  for (const record of records) {
    if (!bySource.has(record.source)) {
      bySource.set(record.source, []);
    }
    bySource.get(record.source)!.push(record);
  }

  for (const [source, sourceRecords] of bySource) {
    result[source] = computeFrequencyAggregation(sourceRecords, periodMs);
  }

  return Object.freeze(result);
}
