/**
 * GreyFlowViews.ts
 *
 * Read-only views for grey flow data.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - READ-ONLY: All views are frozen, no mutations
 * - PULL-BASED: External systems query these views, we never push
 * - NO EXECUTION: Views do NOT trigger any action
 * - PASSIVE: Pure query functions, no side effects
 *
 * SEMANTIC BOUNDARIES:
 * - All values are counts and ratios, NOT monetary amounts
 * - Views are for analysis output only
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot push notifications or emit events
 * - Cannot modify any data
 */

import {
  type GreyFlowRecord,
  type EntityId,
  type FlowOperatorId,
  FlowDirection,
  FlowSource,
  EntityType,
} from './GreyFlowTypes';
import { type GreyFlowRegistry } from './GreyFlowRegistry';
import { type GreyFlowLinker, type FlowLinkRecord, FlowLinkType } from './GreyFlowLinking';
import {
  computeVolumeAggregation,
  computeFrequencyAggregation,
  computeDistributionAggregation,
  computeRakeRatioAggregation,
  type VolumeAggregation,
  type FrequencyAggregation,
  type DistributionAggregation,
  type RakeRatioAggregation,
} from './GreyFlowAggregation';

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * Period Summary View - summary for a time period
 */
export interface PeriodSummaryView {
  /** Period start timestamp */
  readonly periodStart: number;
  /** Period end timestamp */
  readonly periodEnd: number;
  /** Volume aggregation */
  readonly volume: VolumeAggregation;
  /** Frequency aggregation */
  readonly frequency: FrequencyAggregation;
  /** Distribution aggregation */
  readonly distribution: DistributionAggregation;
  /** Rake ratio aggregation */
  readonly rakeRatios: RakeRatioAggregation;
  /** Records in this period */
  readonly recordCount: number;
}

/**
 * Entity Summary View - summary for an entity
 */
export interface EntitySummaryView {
  /** Entity ID */
  readonly entityId: EntityId;
  /** Entity type */
  readonly entityType: EntityType;
  /** Volume aggregation */
  readonly volume: VolumeAggregation;
  /** Frequency aggregation */
  readonly frequency: FrequencyAggregation;
  /** Rake ratios */
  readonly rakeRatios: RakeRatioAggregation;
  /** First activity timestamp */
  readonly firstActivityAt: number;
  /** Last activity timestamp */
  readonly lastActivityAt: number;
}

/**
 * Agent Summary View - summary for an agent
 */
export interface AgentSummaryView extends EntitySummaryView {
  /** Tables associated with this agent */
  readonly associatedTables: readonly EntityId[];
  /** Clubs associated with this agent */
  readonly associatedClubs: readonly EntityId[];
}

/**
 * Table Summary View - summary for a table
 */
export interface TableSummaryView extends EntitySummaryView {
  /** Players who participated */
  readonly playerCount: number;
  /** Sessions at this table */
  readonly sessionCount: number;
}

/**
 * Club Summary View - summary for a club
 */
export interface ClubSummaryView extends EntitySummaryView {
  /** Tables in this club */
  readonly tableCount: number;
  /** Agents associated with this club */
  readonly agentCount: number;
}

/**
 * Trace View - trace of a specific flow
 */
export interface FlowTraceView {
  /** Flow record */
  readonly flow: GreyFlowRecord;
  /** All links for this flow */
  readonly links: readonly FlowLinkRecord[];
  /** Hand IDs linked */
  readonly linkedHands: readonly string[];
  /** Session IDs linked */
  readonly linkedSessions: readonly string[];
  /** Intent IDs linked */
  readonly linkedIntents: readonly string[];
}

/**
 * Overall Summary View - overall statistics
 */
export interface OverallSummaryView {
  /** Total volume */
  readonly totalVolume: VolumeAggregation;
  /** Total frequency */
  readonly totalFrequency: FrequencyAggregation;
  /** Overall distribution */
  readonly distribution: DistributionAggregation;
  /** Overall rake ratios */
  readonly rakeRatios: RakeRatioAggregation;
  /** Unique entity count */
  readonly uniqueEntityCount: number;
  /** Unique operator count */
  readonly uniqueOperatorCount: number;
  /** Time span (ms) */
  readonly timeSpanMs: number;
}

// ============================================================================
// PERIOD VIEWS
// ============================================================================

/**
 * Get flow summary by time period.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getFlowsByPeriod(
  registry: GreyFlowRegistry,
  periodStart: number,
  periodEnd: number
): PeriodSummaryView {
  const records = registry.getAllRecords({
    fromTimestamp: periodStart,
    toTimestamp: periodEnd,
  });

  return Object.freeze({
    periodStart,
    periodEnd,
    volume: computeVolumeAggregation(records),
    frequency: computeFrequencyAggregation(records),
    distribution: computeDistributionAggregation(records),
    rakeRatios: computeRakeRatioAggregation(records),
    recordCount: records.length,
  });
}

/**
 * Get multiple period summaries.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getFlowsByPeriods(
  registry: GreyFlowRegistry,
  periodDurationMs: number,
  startTime: number,
  endTime: number
): readonly PeriodSummaryView[] {
  const periods: PeriodSummaryView[] = [];
  let currentStart = startTime;

  while (currentStart < endTime) {
    const currentEnd = Math.min(currentStart + periodDurationMs, endTime);
    periods.push(getFlowsByPeriod(registry, currentStart, currentEnd));
    currentStart = currentEnd;
  }

  return Object.freeze(periods);
}

// ============================================================================
// ENTITY VIEWS
// ============================================================================

/**
 * Get entity summary.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getEntitySummary(
  registry: GreyFlowRegistry,
  entityId: EntityId,
  entityType: EntityType
): EntitySummaryView {
  const records = registry.getRecordsByEntity(entityId);

  let firstActivityAt = 0;
  let lastActivityAt = 0;

  if (records.length > 0) {
    const timestamps = records.map(r => r.createdAt);
    firstActivityAt = Math.min(...timestamps);
    lastActivityAt = Math.max(...timestamps);
  }

  return Object.freeze({
    entityId,
    entityType,
    volume: computeVolumeAggregation(records),
    frequency: computeFrequencyAggregation(records),
    rakeRatios: computeRakeRatioAggregation(records),
    firstActivityAt,
    lastActivityAt,
  });
}

/**
 * Get all entity summaries.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getAllEntitySummaries(
  registry: GreyFlowRegistry
): readonly EntitySummaryView[] {
  const records = registry.getAllRecords();
  const entityMap = new Map<string, { type: EntityType; records: GreyFlowRecord[] }>();

  // Group by entity
  for (const record of records) {
    if (!entityMap.has(record.sourceEntityId)) {
      entityMap.set(record.sourceEntityId, {
        type: record.sourceEntityType,
        records: [],
      });
    }
    entityMap.get(record.sourceEntityId)!.records.push(record);

    if (record.targetEntityId && record.targetEntityType) {
      if (!entityMap.has(record.targetEntityId)) {
        entityMap.set(record.targetEntityId, {
          type: record.targetEntityType,
          records: [],
        });
      }
      entityMap.get(record.targetEntityId)!.records.push(record);
    }
  }

  // Create summaries
  const summaries: EntitySummaryView[] = [];
  for (const [entityId, data] of entityMap) {
    const entityRecords = data.records;
    let firstActivityAt = 0;
    let lastActivityAt = 0;

    if (entityRecords.length > 0) {
      const timestamps = entityRecords.map(r => r.createdAt);
      firstActivityAt = Math.min(...timestamps);
      lastActivityAt = Math.max(...timestamps);
    }

    summaries.push(Object.freeze({
      entityId: entityId as EntityId,
      entityType: data.type,
      volume: computeVolumeAggregation(entityRecords),
      frequency: computeFrequencyAggregation(entityRecords),
      rakeRatios: computeRakeRatioAggregation(entityRecords),
      firstActivityAt,
      lastActivityAt,
    }));
  }

  return Object.freeze(summaries);
}

// ============================================================================
// AGENT VIEWS
// ============================================================================

/**
 * Get agent summary with associated entities.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getAgentSummary(
  registry: GreyFlowRegistry,
  agentId: EntityId
): AgentSummaryView {
  const records = registry.getRecordsByEntity(agentId);

  // Find associated tables and clubs
  const associatedTables = new Set<EntityId>();
  const associatedClubs = new Set<EntityId>();

  for (const record of records) {
    if (record.sourceEntityType === EntityType.TABLE && record.sourceEntityId !== agentId) {
      associatedTables.add(record.sourceEntityId);
    }
    if (record.targetEntityType === EntityType.TABLE && record.targetEntityId) {
      associatedTables.add(record.targetEntityId);
    }
    if (record.sourceEntityType === EntityType.CLUB && record.sourceEntityId !== agentId) {
      associatedClubs.add(record.sourceEntityId);
    }
    if (record.targetEntityType === EntityType.CLUB && record.targetEntityId) {
      associatedClubs.add(record.targetEntityId);
    }
  }

  let firstActivityAt = 0;
  let lastActivityAt = 0;

  if (records.length > 0) {
    const timestamps = records.map(r => r.createdAt);
    firstActivityAt = Math.min(...timestamps);
    lastActivityAt = Math.max(...timestamps);
  }

  return Object.freeze({
    entityId: agentId,
    entityType: EntityType.AGENT,
    volume: computeVolumeAggregation(records),
    frequency: computeFrequencyAggregation(records),
    rakeRatios: computeRakeRatioAggregation(records),
    firstActivityAt,
    lastActivityAt,
    associatedTables: Object.freeze(Array.from(associatedTables)),
    associatedClubs: Object.freeze(Array.from(associatedClubs)),
  });
}

/**
 * Get all agent summaries.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getAllAgentSummaries(
  registry: GreyFlowRegistry
): readonly AgentSummaryView[] {
  const records = registry.getAllRecords({ source: FlowSource.AGENT });
  const agentIds = new Set<EntityId>();

  for (const record of records) {
    if (record.sourceEntityType === EntityType.AGENT) {
      agentIds.add(record.sourceEntityId);
    }
    if (record.targetEntityType === EntityType.AGENT && record.targetEntityId) {
      agentIds.add(record.targetEntityId);
    }
  }

  const summaries: AgentSummaryView[] = [];
  for (const agentId of agentIds) {
    summaries.push(getAgentSummary(registry, agentId));
  }

  return Object.freeze(summaries);
}

// ============================================================================
// TABLE VIEWS
// ============================================================================

/**
 * Get table summary.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getTableSummary(
  registry: GreyFlowRegistry,
  linker: GreyFlowLinker,
  tableId: EntityId
): TableSummaryView {
  const records = registry.getRecordsByEntity(tableId);

  // Count unique players
  const playerIds = new Set<string>();
  for (const record of records) {
    if (record.sourceEntityType === EntityType.PLAYER) {
      playerIds.add(record.sourceEntityId);
    }
    if (record.targetEntityType === EntityType.PLAYER && record.targetEntityId) {
      playerIds.add(record.targetEntityId);
    }
  }

  // Count unique sessions
  const sessionIds = new Set<string>();
  for (const record of records) {
    const links = linker.getLinksByFlow(record.flowId);
    for (const link of links) {
      if (link.linkType === FlowLinkType.SESSION) {
        sessionIds.add(link.referenceId);
      }
    }
  }

  let firstActivityAt = 0;
  let lastActivityAt = 0;

  if (records.length > 0) {
    const timestamps = records.map(r => r.createdAt);
    firstActivityAt = Math.min(...timestamps);
    lastActivityAt = Math.max(...timestamps);
  }

  return Object.freeze({
    entityId: tableId,
    entityType: EntityType.TABLE,
    volume: computeVolumeAggregation(records),
    frequency: computeFrequencyAggregation(records),
    rakeRatios: computeRakeRatioAggregation(records),
    firstActivityAt,
    lastActivityAt,
    playerCount: playerIds.size,
    sessionCount: sessionIds.size,
  });
}

// ============================================================================
// CLUB VIEWS
// ============================================================================

/**
 * Get club summary.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getClubSummary(
  registry: GreyFlowRegistry,
  clubId: EntityId
): ClubSummaryView {
  const records = registry.getRecordsByEntity(clubId);

  // Count unique tables and agents
  const tableIds = new Set<string>();
  const agentIds = new Set<string>();

  for (const record of records) {
    if (record.sourceEntityType === EntityType.TABLE) {
      tableIds.add(record.sourceEntityId);
    }
    if (record.targetEntityType === EntityType.TABLE && record.targetEntityId) {
      tableIds.add(record.targetEntityId);
    }
    if (record.sourceEntityType === EntityType.AGENT) {
      agentIds.add(record.sourceEntityId);
    }
    if (record.targetEntityType === EntityType.AGENT && record.targetEntityId) {
      agentIds.add(record.targetEntityId);
    }
  }

  let firstActivityAt = 0;
  let lastActivityAt = 0;

  if (records.length > 0) {
    const timestamps = records.map(r => r.createdAt);
    firstActivityAt = Math.min(...timestamps);
    lastActivityAt = Math.max(...timestamps);
  }

  return Object.freeze({
    entityId: clubId,
    entityType: EntityType.CLUB,
    volume: computeVolumeAggregation(records),
    frequency: computeFrequencyAggregation(records),
    rakeRatios: computeRakeRatioAggregation(records),
    firstActivityAt,
    lastActivityAt,
    tableCount: tableIds.size,
    agentCount: agentIds.size,
  });
}

/**
 * Get all club summaries.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getAllClubSummaries(
  registry: GreyFlowRegistry
): readonly ClubSummaryView[] {
  const records = registry.getAllRecords({ source: FlowSource.CLUB });
  const clubIds = new Set<EntityId>();

  for (const record of records) {
    if (record.sourceEntityType === EntityType.CLUB) {
      clubIds.add(record.sourceEntityId);
    }
    if (record.targetEntityType === EntityType.CLUB && record.targetEntityId) {
      clubIds.add(record.targetEntityId);
    }
  }

  const summaries: ClubSummaryView[] = [];
  for (const clubId of clubIds) {
    summaries.push(getClubSummary(registry, clubId));
  }

  return Object.freeze(summaries);
}

// ============================================================================
// TRACE VIEWS
// ============================================================================

/**
 * Get flow trace with all links.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getFlowTrace(
  registry: GreyFlowRegistry,
  linker: GreyFlowLinker,
  flowId: string
): FlowTraceView | undefined {
  const flow = registry.getRecord(flowId as any);
  if (!flow) {
    return undefined;
  }

  const links = linker.getLinksByFlow(flow.flowId);

  const linkedHands: string[] = [];
  const linkedSessions: string[] = [];
  const linkedIntents: string[] = [];

  for (const link of links) {
    switch (link.linkType) {
      case FlowLinkType.HAND:
        linkedHands.push(link.referenceId);
        break;
      case FlowLinkType.SESSION:
        linkedSessions.push(link.referenceId);
        break;
      case FlowLinkType.INTENT:
        linkedIntents.push(link.referenceId);
        break;
    }
  }

  return Object.freeze({
    flow,
    links,
    linkedHands: Object.freeze(linkedHands),
    linkedSessions: Object.freeze(linkedSessions),
    linkedIntents: Object.freeze(linkedIntents),
  });
}

/**
 * Get all flow traces.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getAllFlowTraces(
  registry: GreyFlowRegistry,
  linker: GreyFlowLinker
): readonly FlowTraceView[] {
  const records = registry.getAllRecords();
  const traces: FlowTraceView[] = [];

  for (const record of records) {
    const trace = getFlowTrace(registry, linker, record.flowId);
    if (trace) {
      traces.push(trace);
    }
  }

  return Object.freeze(traces);
}

// ============================================================================
// OVERALL VIEWS
// ============================================================================

/**
 * Get overall summary statistics.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getOverallSummary(
  registry: GreyFlowRegistry
): OverallSummaryView {
  const records = registry.getAllRecords();

  // Count unique entities and operators
  const entityIds = new Set<string>();
  const operatorIds = new Set<string>();
  let minTime = Infinity;
  let maxTime = 0;

  for (const record of records) {
    entityIds.add(record.sourceEntityId);
    if (record.targetEntityId) {
      entityIds.add(record.targetEntityId);
    }
    operatorIds.add(record.createdBy);

    if (record.createdAt < minTime) minTime = record.createdAt;
    if (record.createdAt > maxTime) maxTime = record.createdAt;
  }

  const timeSpanMs = records.length > 0 ? maxTime - minTime : 0;

  return Object.freeze({
    totalVolume: computeVolumeAggregation(records),
    totalFrequency: computeFrequencyAggregation(records),
    distribution: computeDistributionAggregation(records),
    rakeRatios: computeRakeRatioAggregation(records),
    uniqueEntityCount: entityIds.size,
    uniqueOperatorCount: operatorIds.size,
    timeSpanMs,
  });
}

// ============================================================================
// FILTERED VIEWS
// ============================================================================

/**
 * Get flows filtered by direction.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getFlowsByDirection(
  registry: GreyFlowRegistry,
  direction: FlowDirection
): readonly GreyFlowRecord[] {
  return registry.getAllRecords({ direction });
}

/**
 * Get flows filtered by source.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getFlowsBySource(
  registry: GreyFlowRegistry,
  source: FlowSource
): readonly GreyFlowRecord[] {
  return registry.getAllRecords({ source });
}

/**
 * Get flows filtered by operator.
 *
 * READ-ONLY: Returns frozen data.
 */
export function getFlowsByOperator(
  registry: GreyFlowRegistry,
  operatorId: FlowOperatorId
): readonly GreyFlowRecord[] {
  return registry.getRecordsByOperator(operatorId);
}
