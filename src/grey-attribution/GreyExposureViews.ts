/**
 * GreyExposureViews.ts
 *
 * Read-only views for grey exposure data.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - READ-ONLY: All views are frozen, no mutations
 * - PULL-BASED: External systems query these views, we never push
 * - NO EXECUTION: Views do NOT trigger any action
 * - PASSIVE: Pure query functions, no side effects
 * - EXPOSURE-ONLY: All values are exposure metrics, NOT revenue
 *
 * SEMANTIC BOUNDARIES:
 * - "Exposure" is risk/impact exposure, NOT revenue or earnings
 * - Views are for analysis output only
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot push notifications or emit events
 * - Cannot modify any data
 */

import {
  type PeriodId,
  type AttributionId,
  type AttributionRecord,
  AttributionEntityType,
  AttributionKind,
  ExposureMetricType,
  createTargetId,
} from './GreyAttributionTypes';
import { type GreyAttributionRegistry } from './GreyAttributionRegistry';
import {
  type GreyAttributionLinker,
  type AttributionLinkRecord,
  AttributionLinkTargetType,
} from './GreyAttributionLinking';
import {
  calculateExposureSummary,
  calculateExposureTrend,
  type ExposureSummary,
  type ExposureTrend,
} from './GreyExposureCalculator';

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * Exposure By Agent View
 */
export interface ExposureByAgentView {
  /** Agent ID */
  readonly agentId: string;
  /** Exposure summary */
  readonly exposure: ExposureSummary;
  /** Linked attributions count */
  readonly linkedAttributionsCount: number;
  /** Associated clubs */
  readonly associatedClubs: readonly string[];
  /** Associated tables */
  readonly associatedTables: readonly string[];
  /** Period coverage */
  readonly periodCoverage: readonly PeriodId[];
}

/**
 * Exposure By Club View
 */
export interface ExposureByClubView {
  /** Club ID */
  readonly clubId: string;
  /** Exposure summary */
  readonly exposure: ExposureSummary;
  /** Linked attributions count */
  readonly linkedAttributionsCount: number;
  /** Associated agents */
  readonly associatedAgents: readonly string[];
  /** Associated tables */
  readonly associatedTables: readonly string[];
  /** Period coverage */
  readonly periodCoverage: readonly PeriodId[];
}

/**
 * Exposure By Table View
 */
export interface ExposureByTableView {
  /** Table ID */
  readonly tableId: string;
  /** Exposure summary */
  readonly exposure: ExposureSummary;
  /** Linked attributions count */
  readonly linkedAttributionsCount: number;
  /** Parent club */
  readonly parentClub: string | null;
  /** Associated agents */
  readonly associatedAgents: readonly string[];
  /** Session count */
  readonly sessionCount: number;
}

/**
 * Exposure By Period View
 */
export interface ExposureByPeriodView {
  /** Period ID */
  readonly periodId: PeriodId;
  /** Period start timestamp */
  readonly periodStart: number;
  /** Period end timestamp */
  readonly periodEnd: number;
  /** Total attributions in period */
  readonly totalAttributions: number;
  /** By kind breakdown */
  readonly byKind: {
    readonly direct: number;
    readonly indirect: number;
    readonly derived: number;
  };
  /** By entity type breakdown */
  readonly byEntityType: ReadonlyMap<AttributionEntityType, number>;
  /** Total exposure metrics */
  readonly totalExposure: {
    readonly share: number;
    readonly ratio: number;
    readonly weight: number;
    readonly index: number;
  };
  /** Top exposed entities */
  readonly topExposedEntities: readonly { entityId: string; exposure: number }[];
}

/**
 * Exposure Trace View - trace of exposure for a specific attribution
 */
export interface ExposureTraceView {
  /** Attribution ID */
  readonly attributionId: AttributionId;
  /** Attribution record */
  readonly attribution: AttributionRecord | null;
  /** All links for this attribution */
  readonly links: readonly AttributionLinkRecord[];
  /** Link summary */
  readonly linkSummary: {
    readonly agents: readonly string[];
    readonly clubs: readonly string[];
    readonly tables: readonly string[];
    readonly flows: readonly string[];
    readonly intents: readonly string[];
  };
  /** Exposure metrics from attribution */
  readonly exposureMetrics: readonly { metricType: string; value: number }[];
  /** Total weighted exposure */
  readonly totalWeightedExposure: number;
}

/**
 * Overall Exposure Summary View
 */
export interface OverallExposureSummaryView {
  /** Total attributions */
  readonly totalAttributions: number;
  /** Total links */
  readonly totalLinks: number;
  /** By kind breakdown */
  readonly byKind: ReadonlyMap<AttributionKind, number>;
  /** By entity type breakdown */
  readonly byEntityType: ReadonlyMap<AttributionEntityType, number>;
  /** Total exposure by metric type */
  readonly totalExposureByType: ReadonlyMap<ExposureMetricType, number>;
  /** Unique sources count */
  readonly uniqueSourcesCount: number;
  /** Unique targets count */
  readonly uniqueTargetsCount: number;
  /** Chain integrity */
  readonly chainIntegrity: boolean;
  /** Time range */
  readonly timeRange: { start: number; end: number } | null;
}

// ============================================================================
// VIEW FUNCTIONS
// ============================================================================

/**
 * Get exposure view for an agent.
 *
 * READ-ONLY: Returns frozen view.
 */
export function getExposureByAgent(
  registry: GreyAttributionRegistry,
  linker: GreyAttributionLinker,
  agentId: string
): ExposureByAgentView {
  // Get all attributions where agent is target
  const targetId = createTargetId(agentId);
  const records = registry.getRecords({ targetId });
  const exposure = calculateExposureSummary(registry.getAllRecords(), targetId);

  // Get linked attributions through linker
  const linkedRecords = linker.getAttributionsByAgent(agentId);

  // Collect associated clubs and tables
  const associatedClubs = new Set<string>();
  const associatedTables = new Set<string>();
  const periodCoverage = new Set<PeriodId>();

  for (const record of records) {
    periodCoverage.add(record.periodId);
  }

  // Get links for each attribution and find clubs/tables
  for (const record of records) {
    const links = linker.getLinksByAttribution(record.attributionId);
    for (const link of links) {
      if (link.targetType === AttributionLinkTargetType.CLUB) {
        associatedClubs.add(link.targetRefId);
      } else if (link.targetType === AttributionLinkTargetType.TABLE) {
        associatedTables.add(link.targetRefId);
      }
    }
  }

  return Object.freeze({
    agentId,
    exposure,
    linkedAttributionsCount: linkedRecords.length,
    associatedClubs: Object.freeze([...associatedClubs]),
    associatedTables: Object.freeze([...associatedTables]),
    periodCoverage: Object.freeze([...periodCoverage]),
  });
}

/**
 * Get exposure views for all agents.
 *
 * READ-ONLY: Returns frozen array.
 */
export function getAllAgentExposures(
  registry: GreyAttributionRegistry,
  linker: GreyAttributionLinker
): readonly ExposureByAgentView[] {
  const records = registry.getAllRecords();
  const agentIds = new Set<string>();

  // Find all agent targets
  for (const record of records) {
    if (record.targetType === AttributionEntityType.AGENT) {
      agentIds.add(record.targetId);
    }
  }

  // Also find agents from links
  const allLinks = linker.getAllLinks();
  for (const link of allLinks) {
    if (link.targetType === AttributionLinkTargetType.AGENT) {
      agentIds.add(link.targetRefId);
    }
  }

  const views: ExposureByAgentView[] = [];
  for (const agentId of agentIds) {
    views.push(getExposureByAgent(registry, linker, agentId));
  }

  return Object.freeze(views);
}

/**
 * Get exposure view for a club.
 *
 * READ-ONLY: Returns frozen view.
 */
export function getExposureByClub(
  registry: GreyAttributionRegistry,
  linker: GreyAttributionLinker,
  clubId: string
): ExposureByClubView {
  const targetId = createTargetId(clubId);
  const records = registry.getRecords({ targetId });
  const exposure = calculateExposureSummary(registry.getAllRecords(), targetId);

  const linkedRecords = linker.getAttributionsByClub(clubId);

  const associatedAgents = new Set<string>();
  const associatedTables = new Set<string>();
  const periodCoverage = new Set<PeriodId>();

  for (const record of records) {
    periodCoverage.add(record.periodId);
  }

  for (const record of records) {
    const links = linker.getLinksByAttribution(record.attributionId);
    for (const link of links) {
      if (link.targetType === AttributionLinkTargetType.AGENT) {
        associatedAgents.add(link.targetRefId);
      } else if (link.targetType === AttributionLinkTargetType.TABLE) {
        associatedTables.add(link.targetRefId);
      }
    }
  }

  return Object.freeze({
    clubId,
    exposure,
    linkedAttributionsCount: linkedRecords.length,
    associatedAgents: Object.freeze([...associatedAgents]),
    associatedTables: Object.freeze([...associatedTables]),
    periodCoverage: Object.freeze([...periodCoverage]),
  });
}

/**
 * Get exposure views for all clubs.
 *
 * READ-ONLY: Returns frozen array.
 */
export function getAllClubExposures(
  registry: GreyAttributionRegistry,
  linker: GreyAttributionLinker
): readonly ExposureByClubView[] {
  const records = registry.getAllRecords();
  const clubIds = new Set<string>();

  for (const record of records) {
    if (record.targetType === AttributionEntityType.CLUB) {
      clubIds.add(record.targetId);
    }
  }

  const allLinks = linker.getAllLinks();
  for (const link of allLinks) {
    if (link.targetType === AttributionLinkTargetType.CLUB) {
      clubIds.add(link.targetRefId);
    }
  }

  const views: ExposureByClubView[] = [];
  for (const clubId of clubIds) {
    views.push(getExposureByClub(registry, linker, clubId));
  }

  return Object.freeze(views);
}

/**
 * Get exposure view for a table.
 *
 * READ-ONLY: Returns frozen view.
 */
export function getExposureByTable(
  registry: GreyAttributionRegistry,
  linker: GreyAttributionLinker,
  tableId: string
): ExposureByTableView {
  const targetId = createTargetId(tableId);
  const records = registry.getRecords({ targetId });
  const exposure = calculateExposureSummary(registry.getAllRecords(), targetId);

  const linkedRecords = linker.getAttributionsByTable(tableId);

  const associatedAgents = new Set<string>();
  let parentClub: string | null = null;
  let sessionCount = 0;

  for (const record of records) {
    const links = linker.getLinksByAttribution(record.attributionId);
    for (const link of links) {
      if (link.targetType === AttributionLinkTargetType.AGENT) {
        associatedAgents.add(link.targetRefId);
      } else if (link.targetType === AttributionLinkTargetType.CLUB && !parentClub) {
        parentClub = link.targetRefId;
      } else if (link.targetType === AttributionLinkTargetType.SESSION) {
        sessionCount += 1;
      }
    }
  }

  return Object.freeze({
    tableId,
    exposure,
    linkedAttributionsCount: linkedRecords.length,
    parentClub,
    associatedAgents: Object.freeze([...associatedAgents]),
    sessionCount,
  });
}

/**
 * Get exposure view for a period.
 *
 * READ-ONLY: Returns frozen view.
 */
export function getExposureByPeriod(
  registry: GreyAttributionRegistry,
  periodId: PeriodId,
  periodStart: number,
  periodEnd: number
): ExposureByPeriodView {
  const records = registry.getRecordsByPeriod(periodId);

  // Count by kind
  let directCount = 0;
  let indirectCount = 0;
  let derivedCount = 0;

  // Count by entity type
  const byEntityType = new Map<AttributionEntityType, number>();
  for (const type of Object.values(AttributionEntityType)) {
    byEntityType.set(type, 0);
  }

  // Sum exposure metrics
  let totalShare = 0;
  let totalRatio = 0;
  let totalWeight = 0;
  let totalIndex = 0;

  // Track entity exposures
  const entityExposures = new Map<string, number>();

  for (const record of records) {
    // Count by kind
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

    // Count by entity type
    const typeCount = byEntityType.get(record.targetType) || 0;
    byEntityType.set(record.targetType, typeCount + 1);

    // Sum exposure metrics
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

      // Track for top entities
      if (metric.metricType === ExposureMetricType.SHARE) {
        const current = entityExposures.get(record.targetId) || 0;
        entityExposures.set(record.targetId, current + metric.value);
      }
    }
  }

  // Get top exposed entities
  const topExposedEntities = Array.from(entityExposures.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([entityId, exposure]) => ({ entityId, exposure }));

  return Object.freeze({
    periodId,
    periodStart,
    periodEnd,
    totalAttributions: records.length,
    byKind: Object.freeze({
      direct: directCount,
      indirect: indirectCount,
      derived: derivedCount,
    }),
    byEntityType: Object.freeze(byEntityType) as ReadonlyMap<AttributionEntityType, number>,
    totalExposure: Object.freeze({
      share: totalShare,
      ratio: totalRatio,
      weight: totalWeight,
      index: totalIndex,
    }),
    topExposedEntities: Object.freeze(topExposedEntities),
  });
}

/**
 * Get exposure trace for an attribution.
 *
 * READ-ONLY: Returns frozen view.
 */
export function getExposureTrace(
  registry: GreyAttributionRegistry,
  linker: GreyAttributionLinker,
  attributionId: AttributionId
): ExposureTraceView {
  const attribution = registry.getRecord(attributionId) || null;
  const links = linker.getLinksByAttribution(attributionId);

  // Categorize links
  const agents: string[] = [];
  const clubs: string[] = [];
  const tables: string[] = [];
  const flows: string[] = [];
  const intents: string[] = [];

  for (const link of links) {
    switch (link.targetType) {
      case AttributionLinkTargetType.AGENT:
        agents.push(link.targetRefId);
        break;
      case AttributionLinkTargetType.CLUB:
        clubs.push(link.targetRefId);
        break;
      case AttributionLinkTargetType.TABLE:
        tables.push(link.targetRefId);
        break;
      case AttributionLinkTargetType.FLOW:
        flows.push(link.targetRefId);
        break;
      case AttributionLinkTargetType.INTENT:
        intents.push(link.targetRefId);
        break;
    }
  }

  // Extract exposure metrics
  const exposureMetrics: { metricType: string; value: number }[] = [];
  let totalWeightedExposure = 0;

  if (attribution) {
    for (const metric of attribution.exposureMetrics) {
      exposureMetrics.push({
        metricType: metric.metricType,
        value: metric.value,
      });
      // Simple weighted sum
      totalWeightedExposure += metric.value * (metric.metricType === ExposureMetricType.SHARE ? 1.0 : 0.5);
    }
  }

  return Object.freeze({
    attributionId,
    attribution,
    links,
    linkSummary: Object.freeze({
      agents: Object.freeze(agents),
      clubs: Object.freeze(clubs),
      tables: Object.freeze(tables),
      flows: Object.freeze(flows),
      intents: Object.freeze(intents),
    }),
    exposureMetrics: Object.freeze(exposureMetrics),
    totalWeightedExposure,
  });
}

/**
 * Get exposure traces for all attributions.
 *
 * READ-ONLY: Returns frozen array.
 */
export function getAllExposureTraces(
  registry: GreyAttributionRegistry,
  linker: GreyAttributionLinker
): readonly ExposureTraceView[] {
  const records = registry.getAllRecords();
  const traces: ExposureTraceView[] = [];

  for (const record of records) {
    traces.push(getExposureTrace(registry, linker, record.attributionId));
  }

  return Object.freeze(traces);
}

/**
 * Get overall exposure summary.
 *
 * READ-ONLY: Returns frozen view.
 */
export function getOverallExposureSummary(
  registry: GreyAttributionRegistry,
  linker: GreyAttributionLinker
): OverallExposureSummaryView {
  const records = registry.getAllRecords();
  const links = linker.getAllLinks();
  const state = registry.getState();

  // Count by kind
  const byKind = new Map<AttributionKind, number>();
  for (const kind of Object.values(AttributionKind)) {
    byKind.set(kind, 0);
  }

  // Count by entity type
  const byEntityType = new Map<AttributionEntityType, number>();
  for (const type of Object.values(AttributionEntityType)) {
    byEntityType.set(type, 0);
  }

  // Sum exposure by type
  const totalExposureByType = new Map<ExposureMetricType, number>();
  for (const type of Object.values(ExposureMetricType)) {
    totalExposureByType.set(type, 0);
  }

  // Track unique sources and targets
  const uniqueSources = new Set<string>();
  const uniqueTargets = new Set<string>();

  // Track time range
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const record of records) {
    // Count by kind
    const kindCount = byKind.get(record.kind) || 0;
    byKind.set(record.kind, kindCount + 1);

    // Count by entity type
    const typeCount = byEntityType.get(record.targetType) || 0;
    byEntityType.set(record.targetType, typeCount + 1);

    // Sum exposure
    for (const metric of record.exposureMetrics) {
      const current = totalExposureByType.get(metric.metricType) || 0;
      totalExposureByType.set(metric.metricType, current + metric.value);
    }

    // Track uniques
    uniqueSources.add(record.sourceId);
    uniqueTargets.add(record.targetId);

    // Track time range
    if (record.timestamp < minTime) minTime = record.timestamp;
    if (record.timestamp > maxTime) maxTime = record.timestamp;
  }

  return Object.freeze({
    totalAttributions: records.length,
    totalLinks: links.length,
    byKind: Object.freeze(byKind) as ReadonlyMap<AttributionKind, number>,
    byEntityType: Object.freeze(byEntityType) as ReadonlyMap<AttributionEntityType, number>,
    totalExposureByType: Object.freeze(totalExposureByType) as ReadonlyMap<ExposureMetricType, number>,
    uniqueSourcesCount: uniqueSources.size,
    uniqueTargetsCount: uniqueTargets.size,
    chainIntegrity: state.chainValid,
    timeRange: records.length > 0 ? { start: minTime, end: maxTime } : null,
  });
}

/**
 * Get exposure trend for an entity.
 *
 * READ-ONLY: Returns frozen view.
 */
export function getExposureTrendView(
  registry: GreyAttributionRegistry,
  entityId: string,
  windowMs?: number
): ExposureTrend {
  const records = registry.getAllRecords();
  return calculateExposureTrend(records, entityId, windowMs);
}

/**
 * Filter attributions by exposure threshold.
 *
 * READ-ONLY: Returns frozen array.
 */
export function getHighExposureAttributions(
  registry: GreyAttributionRegistry,
  threshold: number,
  metricType: ExposureMetricType = ExposureMetricType.SHARE
): readonly AttributionRecord[] {
  const records = registry.getAllRecords();
  const filtered = records.filter(record => {
    const metric = record.exposureMetrics.find(m => m.metricType === metricType);
    return metric && metric.value >= threshold;
  });

  return Object.freeze(filtered);
}

/**
 * Get attributions by kind.
 *
 * READ-ONLY: Returns frozen array.
 */
export function getAttributionsByKind(
  registry: GreyAttributionRegistry,
  kind: AttributionKind
): readonly AttributionRecord[] {
  return registry.getRecordsByKind(kind);
}
