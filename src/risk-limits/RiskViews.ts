/**
 * RiskViews.ts
 *
 * Read-only aggregated views for risk analysis data.
 *
 * READ-ONLY: No modifications, only queries.
 * ANALYSIS-ONLY: Views are for observation, not enforcement.
 * AGGREGATION: Views aggregate flags for reporting.
 * DETERMINISTIC: Same inputs produce same outputs.
 *
 * CRITICAL: This module CANNOT block, execute, or mutate anything.
 */

import {
  type RiskFlag,
  RiskCategory,
  RiskSeverity,
} from './RiskLimitTypes';

import { type AnalysisResult } from './RiskEvaluator';

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * Risk Summary by Period
 */
export interface RiskSummaryByPeriod {
  /** Period start timestamp */
  readonly periodStart: number;
  /** Period end timestamp */
  readonly periodEnd: number;
  /** Total flags in period */
  readonly totalFlags: number;
  /** Flags by severity */
  readonly bySeverity: Readonly<Record<RiskSeverity, number>>;
  /** Flags by category */
  readonly byCategory: Readonly<Record<RiskCategory, number>>;
  /** High severity flag count */
  readonly highSeverityCount: number;
  /** Flags in this period */
  readonly flags: readonly RiskFlag[];
}

/**
 * Risk Summary by Actor
 */
export interface RiskSummaryByActor {
  /** Actor ID */
  readonly actorId: string;
  /** Total flags for this actor */
  readonly totalFlags: number;
  /** Flags by severity */
  readonly bySeverity: Readonly<Record<RiskSeverity, number>>;
  /** Flags by category */
  readonly byCategory: Readonly<Record<RiskCategory, number>>;
  /** Has high severity flags */
  readonly hasHighSeverity: boolean;
  /** Flags for this actor */
  readonly flags: readonly RiskFlag[];
}

/**
 * Risk Summary by Club
 */
export interface RiskSummaryByClub {
  /** Club ID */
  readonly clubId: string;
  /** Total flags for this club */
  readonly totalFlags: number;
  /** Flags by severity */
  readonly bySeverity: Readonly<Record<RiskSeverity, number>>;
  /** Flags by category */
  readonly byCategory: Readonly<Record<RiskCategory, number>>;
  /** Has high severity flags */
  readonly hasHighSeverity: boolean;
  /** Flags for this club */
  readonly flags: readonly RiskFlag[];
}

/**
 * High Risk Flag List
 */
export interface HighRiskFlagList {
  /** Analysis timestamp */
  readonly analyzedAt: number;
  /** Total high severity flags */
  readonly totalHighSeverity: number;
  /** High severity flags */
  readonly highSeverityFlags: readonly RiskFlag[];
  /** Medium severity flags */
  readonly mediumSeverityFlags: readonly RiskFlag[];
  /** Actors with high severity flags */
  readonly affectedActors: readonly string[];
  /** Subjects with high severity flags */
  readonly affectedSubjects: readonly string[];
}

/**
 * Overall Risk Summary
 */
export interface OverallRiskSummary {
  /** Analysis timestamp */
  readonly analyzedAt: number;
  /** Total flags */
  readonly totalFlags: number;
  /** Flags by severity */
  readonly bySeverity: Readonly<Record<RiskSeverity, number>>;
  /** Flags by category */
  readonly byCategory: Readonly<Record<RiskCategory, number>>;
  /** Rules evaluated */
  readonly rulesEvaluated: number;
  /** Has high severity flags */
  readonly hasHighSeverity: boolean;
  /** Unique subjects flagged */
  readonly uniqueSubjectsFlagged: number;
  /** Risk score (integer 0-100, informational only) */
  readonly riskScore: number;
}

// ============================================================================
// VIEW FUNCTIONS
// ============================================================================

/**
 * Get risk summary by period.
 *
 * READ-ONLY: Does not modify data.
 */
export function getRiskSummaryByPeriod(
  flags: readonly RiskFlag[],
  periodStart: number,
  periodEnd: number
): RiskSummaryByPeriod {
  const periodFlags = flags.filter(
    f => f.analyzedAt >= periodStart && f.analyzedAt <= periodEnd
  );

  const bySeverity = countBySeverity(periodFlags);
  const byCategory = countByCategory(periodFlags);

  return Object.freeze({
    periodStart,
    periodEnd,
    totalFlags: periodFlags.length,
    bySeverity: Object.freeze(bySeverity),
    byCategory: Object.freeze(byCategory),
    highSeverityCount: bySeverity[RiskSeverity.HIGH],
    flags: Object.freeze(periodFlags),
  });
}

/**
 * Get risk summary by actor.
 *
 * READ-ONLY: Does not modify data.
 */
export function getRiskSummaryByActor(
  flags: readonly RiskFlag[],
  actorId: string
): RiskSummaryByActor {
  const actorFlags = flags.filter(
    f => f.subjectType === 'actor' && f.subjectId === actorId
  );

  const bySeverity = countBySeverity(actorFlags);
  const byCategory = countByCategory(actorFlags);

  return Object.freeze({
    actorId,
    totalFlags: actorFlags.length,
    bySeverity: Object.freeze(bySeverity),
    byCategory: Object.freeze(byCategory),
    hasHighSeverity: bySeverity[RiskSeverity.HIGH] > 0,
    flags: Object.freeze(actorFlags),
  });
}

/**
 * Get risk summary by club.
 *
 * READ-ONLY: Does not modify data.
 */
export function getRiskSummaryByClub(
  flags: readonly RiskFlag[],
  clubId: string
): RiskSummaryByClub {
  const clubFlags = flags.filter(
    f => f.subjectType === 'club' && f.subjectId === clubId
  );

  const bySeverity = countBySeverity(clubFlags);
  const byCategory = countByCategory(clubFlags);

  return Object.freeze({
    clubId,
    totalFlags: clubFlags.length,
    bySeverity: Object.freeze(bySeverity),
    byCategory: Object.freeze(byCategory),
    hasHighSeverity: bySeverity[RiskSeverity.HIGH] > 0,
    flags: Object.freeze(clubFlags),
  });
}

/**
 * Get high risk flag list.
 *
 * READ-ONLY: Does not modify data.
 * ANALYSIS-ONLY: For observation, not enforcement.
 */
export function getHighRiskFlagList(
  flags: readonly RiskFlag[],
  analysisTimestamp: number
): HighRiskFlagList {
  const highSeverityFlags = flags.filter(f => f.severity === RiskSeverity.HIGH);
  const mediumSeverityFlags = flags.filter(f => f.severity === RiskSeverity.MEDIUM);

  const affectedActors = new Set<string>();
  const affectedSubjects = new Set<string>();

  for (const flag of highSeverityFlags) {
    if (flag.subjectType === 'actor') {
      affectedActors.add(flag.subjectId);
    }
    affectedSubjects.add(`${flag.subjectType}:${flag.subjectId}`);
  }

  return Object.freeze({
    analyzedAt: analysisTimestamp,
    totalHighSeverity: highSeverityFlags.length,
    highSeverityFlags: Object.freeze(highSeverityFlags),
    mediumSeverityFlags: Object.freeze(mediumSeverityFlags),
    affectedActors: Object.freeze(Array.from(affectedActors)),
    affectedSubjects: Object.freeze(Array.from(affectedSubjects)),
  });
}

/**
 * Get overall risk summary.
 *
 * READ-ONLY: Does not modify data.
 * ANALYSIS-ONLY: For observation, not enforcement.
 */
export function getOverallRiskSummary(
  result: AnalysisResult
): OverallRiskSummary {
  const bySeverity = countBySeverity(result.flags);
  const byCategory = countByCategory(result.flags);

  // Count unique subjects
  const uniqueSubjects = new Set<string>();
  for (const flag of result.flags) {
    uniqueSubjects.add(`${flag.subjectType}:${flag.subjectId}`);
  }

  // Calculate risk score (integer 0-100, informational only)
  // This is NOT for enforcement, just a summary metric
  const riskScore = calculateRiskScore(result.flags);

  return Object.freeze({
    analyzedAt: result.analyzedAt,
    totalFlags: result.flags.length,
    bySeverity: Object.freeze(bySeverity),
    byCategory: Object.freeze(byCategory),
    rulesEvaluated: result.rulesEvaluated,
    hasHighSeverity: result.hasHighSeverity,
    uniqueSubjectsFlagged: uniqueSubjects.size,
    riskScore,
  });
}

/**
 * Get all actor summaries.
 *
 * READ-ONLY: Does not modify data.
 */
export function getAllActorSummaries(
  flags: readonly RiskFlag[]
): readonly RiskSummaryByActor[] {
  const actorIds = new Set<string>();

  for (const flag of flags) {
    if (flag.subjectType === 'actor') {
      actorIds.add(flag.subjectId);
    }
  }

  const summaries: RiskSummaryByActor[] = [];
  for (const actorId of actorIds) {
    summaries.push(getRiskSummaryByActor(flags, actorId));
  }

  return Object.freeze(summaries);
}

/**
 * Get all club summaries.
 *
 * READ-ONLY: Does not modify data.
 */
export function getAllClubSummaries(
  flags: readonly RiskFlag[]
): readonly RiskSummaryByClub[] {
  const clubIds = new Set<string>();

  for (const flag of flags) {
    if (flag.subjectType === 'club') {
      clubIds.add(flag.subjectId);
    }
  }

  const summaries: RiskSummaryByClub[] = [];
  for (const clubId of clubIds) {
    summaries.push(getRiskSummaryByClub(flags, clubId));
  }

  return Object.freeze(summaries);
}

/**
 * Aggregate multiple analysis results.
 *
 * READ-ONLY: Does not modify data.
 */
export function aggregateAnalysisResults(
  results: readonly AnalysisResult[]
): AnalysisResult {
  const allFlags: RiskFlag[] = [];
  let totalRulesEvaluated = 0;
  let latestTimestamp = 0;

  for (const result of results) {
    allFlags.push(...result.flags);
    totalRulesEvaluated += result.rulesEvaluated;
    if (result.analyzedAt > latestTimestamp) {
      latestTimestamp = result.analyzedAt;
    }
  }

  const hasHighSeverity = allFlags.some(f => f.severity === RiskSeverity.HIGH);

  return Object.freeze({
    flags: Object.freeze(allFlags),
    analyzedAt: latestTimestamp,
    rulesEvaluated: totalRulesEvaluated,
    hasHighSeverity,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Count flags by severity.
 */
function countBySeverity(flags: readonly RiskFlag[]): Record<RiskSeverity, number> {
  const counts: Record<RiskSeverity, number> = {
    [RiskSeverity.INFO]: 0,
    [RiskSeverity.LOW]: 0,
    [RiskSeverity.MEDIUM]: 0,
    [RiskSeverity.HIGH]: 0,
  };

  for (const flag of flags) {
    counts[flag.severity]++;
  }

  return counts;
}

/**
 * Count flags by category.
 */
function countByCategory(flags: readonly RiskFlag[]): Record<RiskCategory, number> {
  const counts: Record<RiskCategory, number> = {
    [RiskCategory.FREQUENCY]: 0,
    [RiskCategory.CONCENTRATION]: 0,
    [RiskCategory.VELOCITY]: 0,
    [RiskCategory.PATTERN]: 0,
    [RiskCategory.SKEW]: 0,
  };

  for (const flag of flags) {
    counts[flag.category]++;
  }

  return counts;
}

/**
 * Calculate risk score (integer 0-100).
 *
 * NOTE: This is an INFORMATIONAL metric only, NOT for enforcement.
 * The score is purely for human observation and has no automated effect.
 */
function calculateRiskScore(flags: readonly RiskFlag[]): number {
  if (flags.length === 0) {
    return 0;
  }

  // Weight by severity (integers only)
  const weights: Record<RiskSeverity, number> = {
    [RiskSeverity.INFO]: 1,
    [RiskSeverity.LOW]: 5,
    [RiskSeverity.MEDIUM]: 15,
    [RiskSeverity.HIGH]: 30,
  };

  let totalWeight = 0;
  for (const flag of flags) {
    totalWeight += weights[flag.severity];
  }

  // Cap at 100
  return Math.min(100, totalWeight);
}
