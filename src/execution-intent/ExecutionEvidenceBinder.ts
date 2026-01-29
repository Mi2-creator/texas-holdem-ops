/**
 * ExecutionEvidenceBinder.ts
 *
 * Evidence binding utilities for execution intents.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - REFERENCE-ONLY: We store references, we do NOT fetch or validate evidence
 * - READ-ONLY: Binding functions return frozen data structures
 * - PASSIVE: This module does NOT trigger any action
 * - NO RESOLUTION: We do NOT resolve evidence references to actual data
 *
 * WHAT THIS MODULE DOES:
 * - Provides utilities to create evidence references
 * - Provides utilities to query evidence bindings
 * - Returns frozen, immutable data structures
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot fetch or validate evidence from other modules
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot modify existing evidence bindings
 */

import {
  type IntentId,
  type EvidenceId,
  type EvidenceReference,
  type ExecutionIntentRecord,
  EvidenceType,
  createEvidenceId,
} from './ExecutionIntentTypes';

// ============================================================================
// EVIDENCE BINDING TYPES
// ============================================================================

/**
 * Evidence Binding Summary - read-only summary of evidence for an intent
 */
export interface EvidenceBindingSummary {
  /** Intent ID */
  readonly intentId: IntentId;
  /** Total evidence references */
  readonly totalReferences: number;
  /** Count by evidence type */
  readonly byType: Readonly<Record<EvidenceType, number>>;
  /** All evidence IDs */
  readonly evidenceIds: readonly EvidenceId[];
  /** All evidence references */
  readonly references: readonly EvidenceReference[];
}

/**
 * Cross-Reference Summary - shows intents that share evidence
 */
export interface CrossReferenceSummary {
  /** Evidence ID */
  readonly evidenceId: EvidenceId;
  /** Evidence type */
  readonly evidenceType: EvidenceType;
  /** Intent IDs that reference this evidence */
  readonly intentIds: readonly IntentId[];
  /** Total intent count */
  readonly intentCount: number;
}

// ============================================================================
// EVIDENCE REFERENCE FACTORIES
// ============================================================================

/**
 * Create a risk signal evidence reference.
 *
 * NOTE: This creates a REFERENCE only. We do NOT validate that the signal exists.
 */
export function createRiskSignalRef(
  signalId: string,
  description?: string
): EvidenceReference {
  return Object.freeze({
    evidenceId: createEvidenceId(signalId),
    evidenceType: EvidenceType.RISK_SIGNAL,
    description,
  });
}

/**
 * Create a risk acknowledgement evidence reference.
 */
export function createRiskAckRef(
  ackId: string,
  description?: string
): EvidenceReference {
  return Object.freeze({
    evidenceId: createEvidenceId(ackId),
    evidenceType: EvidenceType.RISK_ACK,
    description,
  });
}

/**
 * Create an approval evidence reference.
 */
export function createApprovalRef(
  approvalId: string,
  description?: string
): EvidenceReference {
  return Object.freeze({
    evidenceId: createEvidenceId(approvalId),
    evidenceType: EvidenceType.APPROVAL,
    description,
  });
}

/**
 * Create a recharge evidence reference.
 */
export function createRechargeRef(
  rechargeId: string,
  description?: string
): EvidenceReference {
  return Object.freeze({
    evidenceId: createEvidenceId(rechargeId),
    evidenceType: EvidenceType.RECHARGE,
    description,
  });
}

/**
 * Create a grey flow evidence reference.
 */
export function createGreyFlowRef(
  flowId: string,
  description?: string
): EvidenceReference {
  return Object.freeze({
    evidenceId: createEvidenceId(flowId),
    evidenceType: EvidenceType.GREY_FLOW,
    description,
  });
}

// ============================================================================
// EVIDENCE BINDING QUERIES (READ-ONLY)
// ============================================================================

/**
 * Get evidence binding summary for an intent.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getEvidenceBindingSummary(
  record: ExecutionIntentRecord
): EvidenceBindingSummary {
  const byType: Record<EvidenceType, number> = {
    [EvidenceType.RISK_SIGNAL]: 0,
    [EvidenceType.RISK_ACK]: 0,
    [EvidenceType.APPROVAL]: 0,
    [EvidenceType.RECHARGE]: 0,
    [EvidenceType.GREY_FLOW]: 0,
  };

  const evidenceIds: EvidenceId[] = [];

  for (const ref of record.evidenceRefs) {
    byType[ref.evidenceType]++;
    evidenceIds.push(ref.evidenceId);
  }

  return Object.freeze({
    intentId: record.intentId,
    totalReferences: record.evidenceRefs.length,
    byType: Object.freeze(byType),
    evidenceIds: Object.freeze(evidenceIds),
    references: record.evidenceRefs,
  });
}

/**
 * Get cross-reference summary for an evidence ID.
 *
 * Shows all intents that reference a specific piece of evidence.
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getCrossReferenceSummary(
  records: readonly ExecutionIntentRecord[],
  evidenceId: EvidenceId
): CrossReferenceSummary | undefined {
  const matchingIntents: IntentId[] = [];
  let evidenceType: EvidenceType | undefined;

  for (const record of records) {
    for (const ref of record.evidenceRefs) {
      if (ref.evidenceId === evidenceId) {
        matchingIntents.push(record.intentId);
        evidenceType = ref.evidenceType;
        break; // Only count each intent once
      }
    }
  }

  if (matchingIntents.length === 0 || !evidenceType) {
    return undefined;
  }

  return Object.freeze({
    evidenceId,
    evidenceType,
    intentIds: Object.freeze(matchingIntents),
    intentCount: matchingIntents.length,
  });
}

/**
 * Get all cross-reference summaries.
 *
 * Returns summaries for all evidence IDs found in the records.
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getAllCrossReferences(
  records: readonly ExecutionIntentRecord[]
): readonly CrossReferenceSummary[] {
  const evidenceMap = new Map<string, { type: EvidenceType; intents: Set<IntentId> }>();

  for (const record of records) {
    for (const ref of record.evidenceRefs) {
      if (!evidenceMap.has(ref.evidenceId)) {
        evidenceMap.set(ref.evidenceId, { type: ref.evidenceType, intents: new Set() });
      }
      evidenceMap.get(ref.evidenceId)!.intents.add(record.intentId);
    }
  }

  const summaries: CrossReferenceSummary[] = [];
  for (const [evidenceId, data] of evidenceMap) {
    summaries.push(Object.freeze({
      evidenceId: evidenceId as EvidenceId,
      evidenceType: data.type,
      intentIds: Object.freeze(Array.from(data.intents)),
      intentCount: data.intents.size,
    }));
  }

  return Object.freeze(summaries);
}

/**
 * Filter intents by evidence type.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function filterIntentsByEvidenceType(
  records: readonly ExecutionIntentRecord[],
  evidenceType: EvidenceType
): readonly ExecutionIntentRecord[] {
  const result = records.filter(record =>
    record.evidenceRefs.some(ref => ref.evidenceType === evidenceType)
  );
  return Object.freeze(result);
}

/**
 * Get unique evidence IDs from intents.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function getUniqueEvidenceIds(
  records: readonly ExecutionIntentRecord[]
): readonly EvidenceId[] {
  const ids = new Set<EvidenceId>();
  for (const record of records) {
    for (const ref of record.evidenceRefs) {
      ids.add(ref.evidenceId);
    }
  }
  return Object.freeze(Array.from(ids));
}

/**
 * Count evidence references by type.
 *
 * READ-ONLY: Returns frozen data, does not modify anything.
 */
export function countEvidenceByType(
  records: readonly ExecutionIntentRecord[]
): Readonly<Record<EvidenceType, number>> {
  const counts: Record<EvidenceType, number> = {
    [EvidenceType.RISK_SIGNAL]: 0,
    [EvidenceType.RISK_ACK]: 0,
    [EvidenceType.APPROVAL]: 0,
    [EvidenceType.RECHARGE]: 0,
    [EvidenceType.GREY_FLOW]: 0,
  };

  for (const record of records) {
    for (const ref of record.evidenceRefs) {
      counts[ref.evidenceType]++;
    }
  }

  return Object.freeze(counts);
}
