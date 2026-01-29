/**
 * ApprovalViews.ts
 *
 * Read-only views for OPS-2 approval data.
 *
 * READ-ONLY: No modifications, only queries.
 * AGGREGATION: Views aggregate data for reporting.
 * DETERMINISTIC: Same inputs produce same outputs.
 */

import {
  type ActorId,
  type ApprovalRequestRecord,
  type ApprovalHash,
  ApprovalStatus,
  ApprovalDecision,
} from './ApprovalTypes';

import { type ApprovalRegistry } from './ApprovalRegistry';

import { type ManualRechargeReferenceId } from '../recharge/ManualRechargeTypes';

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * Pending Approvals by Period
 */
export interface PendingApprovalsByPeriod {
  /** Period start timestamp */
  readonly periodStart: number;
  /** Period end timestamp */
  readonly periodEnd: number;
  /** Count of pending approvals */
  readonly pendingCount: number;
  /** Pending approval records */
  readonly pendingApprovals: readonly ApprovalRequestRecord[];
  /** Average age of pending approvals (in ms) */
  readonly averageAgeMs: number;
  /** Oldest pending approval age (in ms) */
  readonly oldestAgeMs: number;
}

/**
 * Approval History for a Recharge Reference
 */
export interface ApprovalHistoryByRecharge {
  /** The recharge reference ID */
  readonly rechargeReferenceId: ManualRechargeReferenceId;
  /** All approval records for this reference */
  readonly records: readonly ApprovalRequestRecord[];
  /** Current status */
  readonly currentStatus: ApprovalStatus;
  /** Creator actor ID */
  readonly creatorActorId: ActorId;
  /** Decision actor ID (if decided) */
  readonly decisionActorId?: ActorId;
  /** Decision (if decided) */
  readonly decision?: ApprovalDecision;
  /** Time from request to decision (if decided) */
  readonly decisionTimeMs?: number;
  /** Chain hashes for audit trail */
  readonly chainHashes: readonly ApprovalHash[];
}

/**
 * Approval Summary by Actor
 */
export interface ApprovalSummaryByActor {
  /** The actor ID */
  readonly actorId: ActorId;
  /** Number of approvals created by this actor */
  readonly createdCount: number;
  /** Number of decisions made by this actor */
  readonly decisionsCount: number;
  /** Confirmations made */
  readonly confirmationsCount: number;
  /** Rejections made */
  readonly rejectionsCount: number;
  /** Pending approvals created by this actor */
  readonly pendingCreatedCount: number;
  /** Average decision time for this actor (in ms) */
  readonly averageDecisionTimeMs: number;
}

/**
 * Overall Approval Summary
 */
export interface OverallApprovalSummary {
  /** Total records */
  readonly totalRecords: number;
  /** Unique approval IDs */
  readonly uniqueApprovals: number;
  /** By status */
  readonly byStatus: Readonly<Record<ApprovalStatus, number>>;
  /** Pending count */
  readonly pendingCount: number;
  /** Confirmed count */
  readonly confirmedCount: number;
  /** Rejected count */
  readonly rejectedCount: number;
  /** Unique creators */
  readonly uniqueCreators: number;
  /** Unique decision makers */
  readonly uniqueDecisionMakers: number;
  /** Chain integrity verified */
  readonly chainIntegrity: boolean;
  /** Average decision time (in ms) */
  readonly averageDecisionTimeMs: number;
}

// ============================================================================
// PENDING APPROVALS BY PERIOD
// ============================================================================

/**
 * Get pending approvals within a time period.
 */
export function getPendingApprovalsByPeriod(
  registry: ApprovalRegistry,
  periodStart: number,
  periodEnd: number,
  currentTimestamp: number
): PendingApprovalsByPeriod {
  const allPending = registry.query({
    status: ApprovalStatus.PENDING,
    fromTimestamp: periodStart,
    toTimestamp: periodEnd,
  });

  let totalAgeMs = 0;
  let oldestAgeMs = 0;

  for (const record of allPending) {
    const ageMs = currentTimestamp - record.requestedAt;
    totalAgeMs += ageMs;
    if (ageMs > oldestAgeMs) {
      oldestAgeMs = ageMs;
    }
  }

  const averageAgeMs = allPending.length > 0 ? Math.floor(totalAgeMs / allPending.length) : 0;

  return Object.freeze({
    periodStart,
    periodEnd,
    pendingCount: allPending.length,
    pendingApprovals: allPending,
    averageAgeMs,
    oldestAgeMs,
  });
}

/**
 * Get all pending approvals.
 */
export function getAllPendingApprovals(
  registry: ApprovalRegistry,
  currentTimestamp: number
): PendingApprovalsByPeriod {
  const allPending = registry.getPendingApprovals();

  let totalAgeMs = 0;
  let oldestAgeMs = 0;
  let earliestTimestamp = currentTimestamp;
  let latestTimestamp = 0;

  for (const record of allPending) {
    const ageMs = currentTimestamp - record.requestedAt;
    totalAgeMs += ageMs;
    if (ageMs > oldestAgeMs) {
      oldestAgeMs = ageMs;
    }
    if (record.requestedAt < earliestTimestamp) {
      earliestTimestamp = record.requestedAt;
    }
    if (record.requestedAt > latestTimestamp) {
      latestTimestamp = record.requestedAt;
    }
  }

  const averageAgeMs = allPending.length > 0 ? Math.floor(totalAgeMs / allPending.length) : 0;

  return Object.freeze({
    periodStart: earliestTimestamp,
    periodEnd: latestTimestamp || currentTimestamp,
    pendingCount: allPending.length,
    pendingApprovals: allPending,
    averageAgeMs,
    oldestAgeMs,
  });
}

// ============================================================================
// APPROVAL HISTORY BY RECHARGE
// ============================================================================

/**
 * Get approval history for a recharge reference.
 */
export function getApprovalHistoryByRecharge(
  registry: ApprovalRegistry,
  rechargeReferenceId: ManualRechargeReferenceId
): ApprovalHistoryByRecharge | undefined {
  const records = registry.getRecordsForReference(rechargeReferenceId);

  if (records.length === 0) {
    return undefined;
  }

  // Sort by sequence number
  const sortedRecords = [...records].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const firstRecord = sortedRecords[0];
  const latestRecord = sortedRecords[sortedRecords.length - 1];

  const chainHashes: ApprovalHash[] = sortedRecords.map(r => r.recordHash);

  let decisionTimeMs: number | undefined;
  if (latestRecord.decision) {
    decisionTimeMs = latestRecord.decision.decidedAt - firstRecord.requestedAt;
  }

  return Object.freeze({
    rechargeReferenceId,
    records: Object.freeze(sortedRecords),
    currentStatus: latestRecord.status,
    creatorActorId: firstRecord.creatorActorId,
    decisionActorId: latestRecord.decision?.decisionActorId,
    decision: latestRecord.decision?.decision,
    decisionTimeMs,
    chainHashes: Object.freeze(chainHashes),
  });
}

/**
 * Get approval histories for all recharge references.
 */
export function getAllApprovalHistories(
  registry: ApprovalRegistry
): readonly ApprovalHistoryByRecharge[] {
  const allRecords = registry.getAllRecords();
  const referenceIds = new Set<ManualRechargeReferenceId>();

  for (const record of allRecords) {
    referenceIds.add(record.rechargeReferenceId);
  }

  const histories: ApprovalHistoryByRecharge[] = [];
  for (const refId of referenceIds) {
    const history = getApprovalHistoryByRecharge(registry, refId);
    if (history) {
      histories.push(history);
    }
  }

  return Object.freeze(histories);
}

// ============================================================================
// APPROVAL SUMMARY BY ACTOR
// ============================================================================

/**
 * Get approval summary for an actor.
 */
export function getApprovalSummaryByActor(
  registry: ApprovalRegistry,
  actorId: ActorId
): ApprovalSummaryByActor {
  const allRecords = registry.getAllRecords();

  let createdCount = 0;
  let decisionsCount = 0;
  let confirmationsCount = 0;
  let rejectionsCount = 0;
  let pendingCreatedCount = 0;
  let totalDecisionTimeMs = 0;
  let decisionTimeSamples = 0;

  // Track unique approvals created by this actor
  const createdApprovalIds = new Set<string>();

  for (const record of allRecords) {
    // Count creations
    if (record.creatorActorId === actorId && !createdApprovalIds.has(record.approvalId)) {
      createdApprovalIds.add(record.approvalId);
      createdCount++;

      if (record.status === ApprovalStatus.PENDING) {
        pendingCreatedCount++;
      }
    }

    // Count decisions
    if (record.decision?.decisionActorId === actorId) {
      decisionsCount++;

      if (record.decision.decision === ApprovalDecision.CONFIRM) {
        confirmationsCount++;
      } else {
        rejectionsCount++;
      }

      // Calculate decision time
      const firstRecord = registry.getRecord(record.approvalId);
      if (firstRecord) {
        totalDecisionTimeMs += record.decision.decidedAt - firstRecord.requestedAt;
        decisionTimeSamples++;
      }
    }
  }

  const averageDecisionTimeMs = decisionTimeSamples > 0
    ? Math.floor(totalDecisionTimeMs / decisionTimeSamples)
    : 0;

  return Object.freeze({
    actorId,
    createdCount,
    decisionsCount,
    confirmationsCount,
    rejectionsCount,
    pendingCreatedCount,
    averageDecisionTimeMs,
  });
}

/**
 * Get approval summaries for all actors.
 */
export function getAllActorSummaries(
  registry: ApprovalRegistry
): readonly ApprovalSummaryByActor[] {
  const allRecords = registry.getAllRecords();
  const actorIds = new Set<ActorId>();

  for (const record of allRecords) {
    actorIds.add(record.creatorActorId);
    if (record.decision?.decisionActorId) {
      actorIds.add(record.decision.decisionActorId);
    }
  }

  const summaries: ApprovalSummaryByActor[] = [];
  for (const actorId of actorIds) {
    summaries.push(getApprovalSummaryByActor(registry, actorId));
  }

  return Object.freeze(summaries);
}

// ============================================================================
// OVERALL SUMMARY
// ============================================================================

/**
 * Get overall approval summary.
 */
export function getOverallApprovalSummary(
  registry: ApprovalRegistry
): OverallApprovalSummary {
  const allRecords = registry.getAllRecords();
  const integrityResult = registry.verifyChainIntegrity();

  const byStatus: Record<ApprovalStatus, number> = {
    [ApprovalStatus.PENDING]: 0,
    [ApprovalStatus.CONFIRMED]: 0,
    [ApprovalStatus.REJECTED]: 0,
  };

  const approvalIds = new Set<string>();
  const creators = new Set<string>();
  const decisionMakers = new Set<string>();
  let totalDecisionTimeMs = 0;
  let decisionTimeSamples = 0;

  for (const record of allRecords) {
    approvalIds.add(record.approvalId);
    creators.add(record.creatorActorId);
    byStatus[record.status]++;

    if (record.decision?.decisionActorId) {
      decisionMakers.add(record.decision.decisionActorId);

      // Calculate decision time
      const firstRecord = registry.getRecord(record.approvalId);
      if (firstRecord) {
        totalDecisionTimeMs += record.decision.decidedAt - firstRecord.requestedAt;
        decisionTimeSamples++;
      }
    }
  }

  const averageDecisionTimeMs = decisionTimeSamples > 0
    ? Math.floor(totalDecisionTimeMs / decisionTimeSamples)
    : 0;

  return Object.freeze({
    totalRecords: allRecords.length,
    uniqueApprovals: approvalIds.size,
    byStatus: Object.freeze(byStatus),
    pendingCount: byStatus[ApprovalStatus.PENDING],
    confirmedCount: byStatus[ApprovalStatus.CONFIRMED],
    rejectedCount: byStatus[ApprovalStatus.REJECTED],
    uniqueCreators: creators.size,
    uniqueDecisionMakers: decisionMakers.size,
    chainIntegrity: integrityResult.success && integrityResult.value === true,
    averageDecisionTimeMs,
  });
}
