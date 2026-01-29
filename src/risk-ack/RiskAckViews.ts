/**
 * RiskAckViews.ts
 *
 * Read-only aggregated views for risk acknowledgement data.
 *
 * READ-ONLY: No modifications, only queries.
 * ANALYSIS-ONLY: Views are for observation, not enforcement.
 * AGGREGATION: Views aggregate records for reporting.
 * DETERMINISTIC: Same inputs produce same outputs.
 *
 * CRITICAL: This module CANNOT block, execute, or trigger any action.
 * Views are purely for human observation and audit.
 */

import {
  type RiskSignalId,
  type ActorId,
  type RiskAckRecord,
  AckDecision,
  AckRole,
} from './RiskAckTypes';

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * Pending signals by period - signals with no acknowledgement
 *
 * NOTE: "Pending" means NO human has acknowledged yet.
 * This does NOT imply any automated action.
 */
export interface PendingByPeriod {
  /** Period start timestamp */
  readonly periodStart: number;
  /** Period end timestamp */
  readonly periodEnd: number;
  /** Total signals in period */
  readonly totalSignals: number;
  /** Signals with at least one ACK */
  readonly acknowledgedCount: number;
  /** Signals with at least one ESCALATION */
  readonly escalatedCount: number;
  /** Signals with at least one REJECTION */
  readonly rejectedCount: number;
  /** Signals with no response yet */
  readonly pendingCount: number;
  /** Records in this period */
  readonly records: readonly RiskAckRecord[];
}

/**
 * History by signal - all acknowledgements for a specific signal
 */
export interface HistoryBySignal {
  /** Signal ID */
  readonly signalId: RiskSignalId;
  /** Total acknowledgement records */
  readonly totalRecords: number;
  /** Count by decision */
  readonly byDecision: Readonly<Record<AckDecision, number>>;
  /** Count by role */
  readonly byRole: Readonly<Record<AckRole, number>>;
  /** Unique actors who responded */
  readonly uniqueActors: readonly ActorId[];
  /** Has at least one acknowledgement */
  readonly isAcknowledged: boolean;
  /** Has at least one escalation */
  readonly isEscalated: boolean;
  /** Has at least one rejection */
  readonly isRejected: boolean;
  /** All records for this signal */
  readonly records: readonly RiskAckRecord[];
}

/**
 * History by actor - all acknowledgements made by a specific actor
 */
export interface HistoryByActor {
  /** Actor ID */
  readonly actorId: ActorId;
  /** Total acknowledgement records */
  readonly totalRecords: number;
  /** Count by decision */
  readonly byDecision: Readonly<Record<AckDecision, number>>;
  /** Unique signals responded to */
  readonly uniqueSignals: readonly RiskSignalId[];
  /** All records by this actor */
  readonly records: readonly RiskAckRecord[];
}

/**
 * Summary by decision - overall statistics
 */
export interface SummaryByDecision {
  /** Analysis timestamp */
  readonly analyzedAt: number;
  /** Total records */
  readonly totalRecords: number;
  /** Count by decision */
  readonly byDecision: Readonly<Record<AckDecision, number>>;
  /** Count by role */
  readonly byRole: Readonly<Record<AckRole, number>>;
  /** Unique signals */
  readonly uniqueSignalCount: number;
  /** Unique actors */
  readonly uniqueActorCount: number;
}

/**
 * Overall Ack Summary
 */
export interface OverallAckSummary {
  /** Analysis timestamp */
  readonly analyzedAt: number;
  /** Total records */
  readonly totalRecords: number;
  /** Count by decision */
  readonly byDecision: Readonly<Record<AckDecision, number>>;
  /** Count by role */
  readonly byRole: Readonly<Record<AckRole, number>>;
  /** Unique signals */
  readonly uniqueSignalCount: number;
  /** Unique actors */
  readonly uniqueActorCount: number;
  /** Escalation rate (percentage, integer 0-100) */
  readonly escalationRatePercent: number;
  /** Acknowledgement rate (percentage, integer 0-100) */
  readonly ackRatePercent: number;
}

// ============================================================================
// VIEW FUNCTIONS
// ============================================================================

/**
 * Get pending signals by period.
 *
 * READ-ONLY: Does not modify data.
 *
 * NOTE: This counts signals, not records.
 * A signal is "acknowledged" if ANY record with ACKNOWLEDGED decision exists.
 */
export function getPendingByPeriod(
  records: readonly RiskAckRecord[],
  periodStart: number,
  periodEnd: number,
  allSignalIds: readonly RiskSignalId[]
): PendingByPeriod {
  // Filter records in period
  const periodRecords = records.filter(
    r => r.createdAt >= periodStart && r.createdAt <= periodEnd
  );

  // Track signal statuses
  const acknowledgedSignals = new Set<string>();
  const escalatedSignals = new Set<string>();
  const rejectedSignals = new Set<string>();
  const respondedSignals = new Set<string>();

  for (const record of periodRecords) {
    respondedSignals.add(record.riskSignalId);
    if (record.decision === AckDecision.ACKNOWLEDGED) {
      acknowledgedSignals.add(record.riskSignalId);
    } else if (record.decision === AckDecision.ESCALATED) {
      escalatedSignals.add(record.riskSignalId);
    } else if (record.decision === AckDecision.REJECTED) {
      rejectedSignals.add(record.riskSignalId);
    }
  }

  // Count pending (signals with no response)
  const pendingCount = allSignalIds.filter(id => !respondedSignals.has(id)).length;

  return Object.freeze({
    periodStart,
    periodEnd,
    totalSignals: allSignalIds.length,
    acknowledgedCount: acknowledgedSignals.size,
    escalatedCount: escalatedSignals.size,
    rejectedCount: rejectedSignals.size,
    pendingCount,
    records: Object.freeze(periodRecords),
  });
}

/**
 * Get history by signal.
 *
 * READ-ONLY: Does not modify data.
 */
export function getHistoryBySignal(
  records: readonly RiskAckRecord[],
  signalId: RiskSignalId
): HistoryBySignal {
  const signalRecords = records.filter(r => r.riskSignalId === signalId);

  const byDecision = countByDecision(signalRecords);
  const byRole = countByRole(signalRecords);

  const uniqueActors = new Set<ActorId>();
  for (const record of signalRecords) {
    uniqueActors.add(record.actorId);
  }

  return Object.freeze({
    signalId,
    totalRecords: signalRecords.length,
    byDecision: Object.freeze(byDecision),
    byRole: Object.freeze(byRole),
    uniqueActors: Object.freeze(Array.from(uniqueActors)),
    isAcknowledged: byDecision[AckDecision.ACKNOWLEDGED] > 0,
    isEscalated: byDecision[AckDecision.ESCALATED] > 0,
    isRejected: byDecision[AckDecision.REJECTED] > 0,
    records: Object.freeze(signalRecords),
  });
}

/**
 * Get history by actor.
 *
 * READ-ONLY: Does not modify data.
 */
export function getHistoryByActor(
  records: readonly RiskAckRecord[],
  actorId: ActorId
): HistoryByActor {
  const actorRecords = records.filter(r => r.actorId === actorId);

  const byDecision = countByDecision(actorRecords);

  const uniqueSignals = new Set<RiskSignalId>();
  for (const record of actorRecords) {
    uniqueSignals.add(record.riskSignalId);
  }

  return Object.freeze({
    actorId,
    totalRecords: actorRecords.length,
    byDecision: Object.freeze(byDecision),
    uniqueSignals: Object.freeze(Array.from(uniqueSignals)),
    records: Object.freeze(actorRecords),
  });
}

/**
 * Get summary by decision.
 *
 * READ-ONLY: Does not modify data.
 */
export function getSummaryByDecision(
  records: readonly RiskAckRecord[],
  analysisTimestamp: number
): SummaryByDecision {
  const byDecision = countByDecision(records);
  const byRole = countByRole(records);

  const uniqueSignals = new Set<string>();
  const uniqueActors = new Set<string>();

  for (const record of records) {
    uniqueSignals.add(record.riskSignalId);
    uniqueActors.add(record.actorId);
  }

  return Object.freeze({
    analyzedAt: analysisTimestamp,
    totalRecords: records.length,
    byDecision: Object.freeze(byDecision),
    byRole: Object.freeze(byRole),
    uniqueSignalCount: uniqueSignals.size,
    uniqueActorCount: uniqueActors.size,
  });
}

/**
 * Get overall acknowledgement summary.
 *
 * READ-ONLY: Does not modify data.
 */
export function getOverallAckSummary(
  records: readonly RiskAckRecord[],
  analysisTimestamp: number
): OverallAckSummary {
  const summary = getSummaryByDecision(records, analysisTimestamp);

  // Calculate rates (integer percentages)
  const totalResponses = records.length;
  const escalationRatePercent = totalResponses > 0
    ? Math.floor((summary.byDecision[AckDecision.ESCALATED] * 100) / totalResponses)
    : 0;
  const ackRatePercent = totalResponses > 0
    ? Math.floor((summary.byDecision[AckDecision.ACKNOWLEDGED] * 100) / totalResponses)
    : 0;

  return Object.freeze({
    ...summary,
    escalationRatePercent,
    ackRatePercent,
  });
}

/**
 * Get all signal histories.
 *
 * READ-ONLY: Does not modify data.
 */
export function getAllSignalHistories(
  records: readonly RiskAckRecord[]
): readonly HistoryBySignal[] {
  const signalIds = new Set<RiskSignalId>();
  for (const record of records) {
    signalIds.add(record.riskSignalId);
  }

  const histories: HistoryBySignal[] = [];
  for (const signalId of signalIds) {
    histories.push(getHistoryBySignal(records, signalId));
  }

  return Object.freeze(histories);
}

/**
 * Get all actor histories.
 *
 * READ-ONLY: Does not modify data.
 */
export function getAllActorHistories(
  records: readonly RiskAckRecord[]
): readonly HistoryByActor[] {
  const actorIds = new Set<ActorId>();
  for (const record of records) {
    actorIds.add(record.actorId);
  }

  const histories: HistoryByActor[] = [];
  for (const actorId of actorIds) {
    histories.push(getHistoryByActor(records, actorId));
  }

  return Object.freeze(histories);
}

/**
 * Get escalated signals.
 *
 * READ-ONLY: Does not modify data.
 */
export function getEscalatedSignals(
  records: readonly RiskAckRecord[]
): readonly RiskSignalId[] {
  const escalatedSignals = new Set<RiskSignalId>();

  for (const record of records) {
    if (record.decision === AckDecision.ESCALATED) {
      escalatedSignals.add(record.riskSignalId);
    }
  }

  return Object.freeze(Array.from(escalatedSignals));
}

/**
 * Get unacknowledged signals from a list.
 *
 * READ-ONLY: Does not modify data.
 */
export function getUnacknowledgedSignals(
  records: readonly RiskAckRecord[],
  allSignalIds: readonly RiskSignalId[]
): readonly RiskSignalId[] {
  const acknowledgedSignals = new Set<string>();

  for (const record of records) {
    if (record.decision === AckDecision.ACKNOWLEDGED) {
      acknowledgedSignals.add(record.riskSignalId);
    }
  }

  const unacknowledged = allSignalIds.filter(id => !acknowledgedSignals.has(id));
  return Object.freeze(unacknowledged);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Count records by decision.
 */
function countByDecision(records: readonly RiskAckRecord[]): Record<AckDecision, number> {
  const counts: Record<AckDecision, number> = {
    [AckDecision.ACKNOWLEDGED]: 0,
    [AckDecision.REJECTED]: 0,
    [AckDecision.ESCALATED]: 0,
  };

  for (const record of records) {
    counts[record.decision]++;
  }

  return counts;
}

/**
 * Count records by role.
 */
function countByRole(records: readonly RiskAckRecord[]): Record<AckRole, number> {
  const counts: Record<AckRole, number> = {
    [AckRole.OPERATOR]: 0,
    [AckRole.SUPERVISOR]: 0,
    [AckRole.ADMIN]: 0,
  };

  for (const record of records) {
    counts[record.actorRole]++;
  }

  return counts;
}
