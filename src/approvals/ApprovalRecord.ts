/**
 * ApprovalRecord.ts
 *
 * Immutable record creation and management for OPS-2 approvals.
 *
 * IMMUTABLE: Records cannot be modified after creation.
 * APPEND-ONLY: New records are appended, never mutated.
 * HASH-CHAINED: Each record links to the previous for audit integrity.
 */

import {
  type ApprovalHash,
  type ApprovalRequestInput,
  type ApprovalDecisionInput,
  type ApprovalRequestRecord,
  type ApprovalDecisionDetails,
  type ApprovalResult,
  ApprovalStatus,
  ApprovalDecision,
  ApprovalErrorCode,
  createApprovalId,
  computeApprovalRecordHash,
  approvalSuccess,
  approvalFailure,
  createApprovalError,
  isValidApprovalRequestInput,
  isValidApprovalDecisionInput,
  isTerminalStatus,
  APPROVAL_GENESIS_HASH,
} from './ApprovalTypes';

// ============================================================================
// RECORD CREATION
// ============================================================================

/**
 * Create a new approval request record.
 *
 * IMMUTABLE: The returned record is frozen and cannot be modified.
 */
export function createApprovalRequestRecord(
  input: ApprovalRequestInput,
  sequenceNumber: number,
  previousHash: ApprovalHash
): ApprovalResult<ApprovalRequestRecord> {
  // Validate input
  if (!isValidApprovalRequestInput(input)) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'Invalid approval request input',
        { input }
      )
    );
  }

  // Validate sequence number
  if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'Sequence number must be a positive integer',
        { sequenceNumber }
      )
    );
  }

  // Generate approval ID
  const approvalId = createApprovalId(
    `approval-${input.rechargeReferenceId}-${input.requestedAt}-${sequenceNumber}`
  );

  // Build record without hash
  const recordWithoutHash: Omit<ApprovalRequestRecord, 'recordHash'> = {
    approvalId,
    rechargeReferenceId: input.rechargeReferenceId,
    creatorActorId: input.creatorActorId,
    status: ApprovalStatus.PENDING,
    requestedAt: input.requestedAt,
    notes: input.notes,
    sequenceNumber,
    previousHash,
  };

  // Compute hash
  const recordHash = computeApprovalRecordHash(recordWithoutHash);

  // Create final frozen record
  const record: ApprovalRequestRecord = Object.freeze({
    ...recordWithoutHash,
    recordHash,
  });

  return approvalSuccess(record);
}

/**
 * Create a new record with decision applied.
 *
 * This creates a NEW record (append-only), not modifying the original.
 * IMMUTABLE: The returned record is frozen and cannot be modified.
 */
export function createApprovalDecisionRecord(
  originalRecord: ApprovalRequestRecord,
  input: ApprovalDecisionInput,
  sequenceNumber: number,
  previousHash: ApprovalHash
): ApprovalResult<ApprovalRequestRecord> {
  // Validate input
  if (!isValidApprovalDecisionInput(input)) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'Invalid approval decision input',
        { input }
      )
    );
  }

  // Check if already terminal
  if (isTerminalStatus(originalRecord.status)) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.ALREADY_TERMINAL,
        `Cannot decide on record in terminal status: ${originalRecord.status}`,
        { approvalId: originalRecord.approvalId, status: originalRecord.status }
      )
    );
  }

  // TWO-MAN RULE: Check for self-approval
  if (input.decisionActorId === originalRecord.creatorActorId) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.SELF_APPROVAL_FORBIDDEN,
        'Self-approval is forbidden (TWO-MAN RULE violation)',
        {
          creatorActorId: originalRecord.creatorActorId,
          decisionActorId: input.decisionActorId,
        }
      )
    );
  }

  // Determine new status
  const newStatus = input.decision === ApprovalDecision.CONFIRM
    ? ApprovalStatus.CONFIRMED
    : ApprovalStatus.REJECTED;

  // Create decision details
  const decision: ApprovalDecisionDetails = Object.freeze({
    decisionActorId: input.decisionActorId,
    decision: input.decision,
    decidedAt: input.decidedAt,
    reason: input.reason,
  });

  // Build record without hash
  const recordWithoutHash: Omit<ApprovalRequestRecord, 'recordHash'> = {
    approvalId: originalRecord.approvalId,
    rechargeReferenceId: originalRecord.rechargeReferenceId,
    creatorActorId: originalRecord.creatorActorId,
    status: newStatus,
    requestedAt: originalRecord.requestedAt,
    notes: originalRecord.notes,
    sequenceNumber,
    previousHash,
    decision,
  };

  // Compute hash
  const recordHash = computeApprovalRecordHash(recordWithoutHash);

  // Create final frozen record
  const record: ApprovalRequestRecord = Object.freeze({
    ...recordWithoutHash,
    recordHash,
  });

  return approvalSuccess(record);
}

// ============================================================================
// RECORD VALIDATION
// ============================================================================

/**
 * Verify record integrity.
 */
export function verifyRecordIntegrity(record: ApprovalRequestRecord): ApprovalResult<boolean> {
  // Recompute hash
  const recordWithoutHash: Omit<ApprovalRequestRecord, 'recordHash'> = {
    approvalId: record.approvalId,
    rechargeReferenceId: record.rechargeReferenceId,
    creatorActorId: record.creatorActorId,
    status: record.status,
    requestedAt: record.requestedAt,
    notes: record.notes,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    decision: record.decision,
  };

  const computedHash = computeApprovalRecordHash(recordWithoutHash);

  if (computedHash !== record.recordHash) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.HASH_MISMATCH,
        'Record hash mismatch',
        {
          approvalId: record.approvalId,
          expected: record.recordHash,
          computed: computedHash,
        }
      )
    );
  }

  return approvalSuccess(true);
}

/**
 * Verify chain link between two records.
 */
export function verifyChainLink(
  currentRecord: ApprovalRequestRecord,
  previousRecord: ApprovalRequestRecord | null
): ApprovalResult<boolean> {
  if (previousRecord === null) {
    // First record should link to genesis
    if (currentRecord.previousHash !== APPROVAL_GENESIS_HASH) {
      return approvalFailure(
        createApprovalError(
          ApprovalErrorCode.CHAIN_BROKEN,
          'First record does not link to genesis hash',
          { approvalId: currentRecord.approvalId }
        )
      );
    }
  } else {
    // Should link to previous record's hash
    if (currentRecord.previousHash !== previousRecord.recordHash) {
      return approvalFailure(
        createApprovalError(
          ApprovalErrorCode.CHAIN_BROKEN,
          'Chain link broken',
          {
            currentApprovalId: currentRecord.approvalId,
            previousApprovalId: previousRecord.approvalId,
            expectedHash: previousRecord.recordHash,
            actualHash: currentRecord.previousHash,
          }
        )
      );
    }
  }

  return approvalSuccess(true);
}

/**
 * Check if a record is frozen (immutable).
 */
export function isRecordFrozen(record: ApprovalRequestRecord): boolean {
  if (!Object.isFrozen(record)) return false;
  if (record.decision && !Object.isFrozen(record.decision)) return false;
  return true;
}
