/**
 * ExecutionIntentViews.ts
 *
 * Read-only views for execution intent and report data.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - READ-ONLY: All views are frozen, no mutations
 * - PULL-BASED: External systems query these views, we never push
 * - NO EXECUTION: Views do NOT trigger any action
 * - PASSIVE: Pure query functions, no side effects
 * - NO STATE MACHINES: Views show data, not lifecycle states
 *
 * WHAT THIS MODULE DOES:
 * - Provides read-only combined views of intents and reports
 * - Provides statistics and summaries
 * - Returns frozen, immutable data structures
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot push notifications or emit events
 * - Cannot modify any data
 */

import {
  type IntentId,
  type OperatorId,
  type ExecutionIntentRecord,
  IntentType,
} from './ExecutionIntentTypes';
import {
  type ReportId,
  type ExecutionReportRecord,
  ReportedOutcome,
} from './ExecutionReportTypes';
import { type ExecutionIntentRegistry } from './ExecutionIntentRegistry';
import { type ExecutionReportRegistry } from './ExecutionReportRegistry';

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * Intent with Reports View - shows an intent with all its reports
 *
 * READ-ONLY: Frozen structure for external consumption.
 */
export interface IntentWithReportsView {
  /** The intent record */
  readonly intent: ExecutionIntentRecord;
  /** All reports for this intent */
  readonly reports: readonly ExecutionReportRecord[];
  /** Latest report (if any) */
  readonly latestReport: ExecutionReportRecord | undefined;
  /** Total report count */
  readonly reportCount: number;
  /** Has at least one report */
  readonly hasReports: boolean;
}

/**
 * Intent Summary View - condensed intent information
 */
export interface IntentSummaryView {
  /** Intent ID */
  readonly intentId: IntentId;
  /** Intent type */
  readonly intentType: IntentType;
  /** Recommendation text (truncated if long) */
  readonly recommendationPreview: string;
  /** Creator */
  readonly createdBy: OperatorId;
  /** Creation time */
  readonly createdAt: number;
  /** Evidence count */
  readonly evidenceCount: number;
  /** Report count */
  readonly reportCount: number;
  /** Latest reported outcome (if any) */
  readonly latestOutcome: ReportedOutcome | undefined;
}

/**
 * Operator Activity View - shows operator's intent and report activity
 */
export interface OperatorActivityView {
  /** Operator ID */
  readonly operatorId: OperatorId;
  /** Intents created by this operator */
  readonly intentsCreated: readonly IntentId[];
  /** Reports filed by this operator */
  readonly reportsFiled: readonly ReportId[];
  /** Intent count */
  readonly intentCount: number;
  /** Report count */
  readonly reportCount: number;
}

/**
 * Registry Statistics View
 */
export interface RegistryStatisticsView {
  /** Total intent count */
  readonly totalIntents: number;
  /** Total report count */
  readonly totalReports: number;
  /** Unique operator count */
  readonly uniqueOperators: number;
  /** Intents by type */
  readonly intentsByType: Readonly<Record<IntentType, number>>;
  /** Reports by outcome */
  readonly reportsByOutcome: Readonly<Record<ReportedOutcome, number>>;
  /** Intents with at least one report */
  readonly intentsWithReports: number;
  /** Intents without any report */
  readonly intentsWithoutReports: number;
}

// ============================================================================
// VIEW FUNCTIONS (READ-ONLY)
// ============================================================================

/**
 * Get intent with all its reports.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getIntentWithReports(
  intentRegistry: ExecutionIntentRegistry,
  reportRegistry: ExecutionReportRegistry,
  intentId: IntentId
): IntentWithReportsView | undefined {
  const intent = intentRegistry.getRecord(intentId);
  if (!intent) {
    return undefined;
  }

  const reports = reportRegistry.getReportsByIntent(intentId);
  const latestReport = reports.length > 0 ? reports[reports.length - 1] : undefined;

  return Object.freeze({
    intent,
    reports,
    latestReport,
    reportCount: reports.length,
    hasReports: reports.length > 0,
  });
}

/**
 * Get all intents with their reports.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getAllIntentsWithReports(
  intentRegistry: ExecutionIntentRegistry,
  reportRegistry: ExecutionReportRegistry
): readonly IntentWithReportsView[] {
  const intents = intentRegistry.getAllRecords();
  const views: IntentWithReportsView[] = [];

  for (const intent of intents) {
    const reports = reportRegistry.getReportsByIntent(intent.intentId);
    const latestReport = reports.length > 0 ? reports[reports.length - 1] : undefined;

    views.push(Object.freeze({
      intent,
      reports,
      latestReport,
      reportCount: reports.length,
      hasReports: reports.length > 0,
    }));
  }

  return Object.freeze(views);
}

/**
 * Get intent summary view.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getIntentSummary(
  intentRegistry: ExecutionIntentRegistry,
  reportRegistry: ExecutionReportRegistry,
  intentId: IntentId
): IntentSummaryView | undefined {
  const intent = intentRegistry.getRecord(intentId);
  if (!intent) {
    return undefined;
  }

  const reports = reportRegistry.getReportsByIntent(intentId);
  const latestReport = reports.length > 0 ? reports[reports.length - 1] : undefined;

  // Truncate recommendation for preview
  const maxLength = 100;
  const recommendationPreview = intent.recommendation.length > maxLength
    ? intent.recommendation.substring(0, maxLength) + '...'
    : intent.recommendation;

  return Object.freeze({
    intentId: intent.intentId,
    intentType: intent.intentType,
    recommendationPreview,
    createdBy: intent.createdBy,
    createdAt: intent.createdAt,
    evidenceCount: intent.evidenceRefs.length,
    reportCount: reports.length,
    latestOutcome: latestReport?.reportedOutcome,
  });
}

/**
 * Get all intent summaries.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getAllIntentSummaries(
  intentRegistry: ExecutionIntentRegistry,
  reportRegistry: ExecutionReportRegistry
): readonly IntentSummaryView[] {
  const intents = intentRegistry.getAllRecords();
  const summaries: IntentSummaryView[] = [];

  for (const intent of intents) {
    const reports = reportRegistry.getReportsByIntent(intent.intentId);
    const latestReport = reports.length > 0 ? reports[reports.length - 1] : undefined;

    const maxLength = 100;
    const recommendationPreview = intent.recommendation.length > maxLength
      ? intent.recommendation.substring(0, maxLength) + '...'
      : intent.recommendation;

    summaries.push(Object.freeze({
      intentId: intent.intentId,
      intentType: intent.intentType,
      recommendationPreview,
      createdBy: intent.createdBy,
      createdAt: intent.createdAt,
      evidenceCount: intent.evidenceRefs.length,
      reportCount: reports.length,
      latestOutcome: latestReport?.reportedOutcome,
    }));
  }

  return Object.freeze(summaries);
}

/**
 * Get operator activity view.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getOperatorActivity(
  intentRegistry: ExecutionIntentRegistry,
  reportRegistry: ExecutionReportRegistry,
  operatorId: OperatorId
): OperatorActivityView {
  const intents = intentRegistry.getRecordsByOperator(operatorId);
  const reports = reportRegistry.getReportsByReporter(operatorId);

  return Object.freeze({
    operatorId,
    intentsCreated: Object.freeze(intents.map(i => i.intentId)),
    reportsFiled: Object.freeze(reports.map(r => r.reportId)),
    intentCount: intents.length,
    reportCount: reports.length,
  });
}

/**
 * Get registry statistics.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getRegistryStatistics(
  intentRegistry: ExecutionIntentRegistry,
  reportRegistry: ExecutionReportRegistry
): RegistryStatisticsView {
  const allIntents = intentRegistry.getAllRecords();
  const allReports = reportRegistry.getAllReports();

  // Count intents by type
  const intentsByType: Record<IntentType, number> = {
    [IntentType.REVIEW]: 0,
    [IntentType.CORRECTIVE]: 0,
    [IntentType.ESCALATE]: 0,
    [IntentType.INVESTIGATE]: 0,
    [IntentType.DOCUMENT]: 0,
  };
  for (const intent of allIntents) {
    intentsByType[intent.intentType]++;
  }

  // Count reports by outcome
  const reportsByOutcome: Record<ReportedOutcome, number> = {
    [ReportedOutcome.COMPLETED]: 0,
    [ReportedOutcome.PARTIAL]: 0,
    [ReportedOutcome.BLOCKED]: 0,
    [ReportedOutcome.NOT_NEEDED]: 0,
    [ReportedOutcome.DEFERRED]: 0,
  };
  for (const report of allReports) {
    reportsByOutcome[report.reportedOutcome]++;
  }

  // Count unique operators
  const operators = new Set<string>();
  for (const intent of allIntents) {
    operators.add(intent.createdBy);
  }
  for (const report of allReports) {
    operators.add(report.reportedBy);
  }

  // Count intents with/without reports
  let intentsWithReports = 0;
  for (const intent of allIntents) {
    const reports = reportRegistry.getReportsByIntent(intent.intentId);
    if (reports.length > 0) {
      intentsWithReports++;
    }
  }

  return Object.freeze({
    totalIntents: allIntents.length,
    totalReports: allReports.length,
    uniqueOperators: operators.size,
    intentsByType: Object.freeze(intentsByType),
    reportsByOutcome: Object.freeze(reportsByOutcome),
    intentsWithReports,
    intentsWithoutReports: allIntents.length - intentsWithReports,
  });
}

/**
 * Get intents without any reports.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 * NOTE: This is a QUERY function, NOT a "pending" status check.
 */
export function getIntentsWithoutReports(
  intentRegistry: ExecutionIntentRegistry,
  reportRegistry: ExecutionReportRegistry
): readonly ExecutionIntentRecord[] {
  const allIntents = intentRegistry.getAllRecords();
  const result: ExecutionIntentRecord[] = [];

  for (const intent of allIntents) {
    const reports = reportRegistry.getReportsByIntent(intent.intentId);
    if (reports.length === 0) {
      result.push(intent);
    }
  }

  return Object.freeze(result);
}

/**
 * Get intents with completed reports.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 * NOTE: This is a QUERY function, based on human-asserted outcomes.
 */
export function getIntentsWithCompletedReports(
  intentRegistry: ExecutionIntentRegistry,
  reportRegistry: ExecutionReportRegistry
): readonly ExecutionIntentRecord[] {
  const allIntents = intentRegistry.getAllRecords();
  const result: ExecutionIntentRecord[] = [];

  for (const intent of allIntents) {
    const latestReport = reportRegistry.getLatestReportForIntent(intent.intentId);
    if (latestReport && latestReport.reportedOutcome === ReportedOutcome.COMPLETED) {
      result.push(intent);
    }
  }

  return Object.freeze(result);
}

/**
 * Filter intents by type.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function filterIntentsByType(
  intentRegistry: ExecutionIntentRegistry,
  intentType: IntentType
): readonly ExecutionIntentRecord[] {
  return intentRegistry.getRecordsByType(intentType);
}

/**
 * Filter reports by outcome.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function filterReportsByOutcome(
  reportRegistry: ExecutionReportRegistry,
  outcome: ReportedOutcome
): readonly ExecutionReportRecord[] {
  return reportRegistry.getReportsByOutcome(outcome);
}
