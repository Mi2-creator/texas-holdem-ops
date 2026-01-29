/**
 * RiskAckRecord.ts
 *
 * Immutable acknowledgement record creation for OPS-4.
 *
 * IMMUTABLE: Records are frozen immediately upon creation.
 * APPEND-ONLY: Records are never modified or deleted.
 * HASH-CHAINED: Each record links to the previous for audit integrity.
 * MANUAL-ONLY: Records human acknowledgements, not automated actions.
 *
 * CRITICAL: This module CANNOT execute, block, or trigger any action.
 * It ONLY creates frozen records of human acknowledgements.
 */

import {
  type RiskSignalId,
  type ActorId,
  type AckHash,
  type RiskAckInput,
  type RiskAckRecord,
  type AckResult,
  AckErrorCode,
  computeAckId,
  computeAckRecordHash,
  ackSuccess,
  ackFailure,
  createAckError,
  isValidAckInput,
} from './RiskAckTypes';

// ============================================================================
// RECORD CREATION
// ============================================================================

/**
 * Create an immutable acknowledgement record.
 *
 * IMMUTABLE: Record is frozen immediately upon creation.
 * DETERMINISTIC: Same inputs produce same outputs.
 * NO SIDE EFFECTS: Pure function, no mutations.
 */
export function createAckRecord(
  input: RiskAckInput,
  sequenceNumber: number,
  previousHash: AckHash
): AckResult<RiskAckRecord> {
  // Validate input
  if (!isValidAckInput(input)) {
    return ackFailure(
      createAckError(
        AckErrorCode.INVALID_INPUT,
        'Invalid acknowledgement input',
        { input }
      )
    );
  }

  // Validate sequence number
  if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
    return ackFailure(
      createAckError(
        AckErrorCode.INVALID_INPUT,
        'Sequence number must be a positive integer',
        { sequenceNumber }
      )
    );
  }

  // Generate ack ID
  const ackId = computeAckId(input.riskSignalId, input.actorId, input.timestamp);

  // Build record without hash
  const recordWithoutHash: Omit<RiskAckRecord, 'recordHash'> = {
    ackId,
    riskSignalId: input.riskSignalId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    decision: input.decision,
    comment: input.comment,
    sequenceNumber,
    previousHash,
    createdAt: input.timestamp,
  };

  // Compute hash
  const recordHash = computeAckRecordHash(recordWithoutHash);

  // Create final frozen record
  const record: RiskAckRecord = Object.freeze({
    ...recordWithoutHash,
    recordHash,
  });

  return ackSuccess(record);
}

// ============================================================================
// RECORD VERIFICATION
// ============================================================================

/**
 * Verify record integrity (hash matches content).
 *
 * DETERMINISTIC: Same record always produces same verification result.
 * READ-ONLY: Does not modify the record.
 */
export function verifyAckRecordIntegrity(record: RiskAckRecord): AckResult<boolean> {
  const recordWithoutHash: Omit<RiskAckRecord, 'recordHash'> = {
    ackId: record.ackId,
    riskSignalId: record.riskSignalId,
    actorId: record.actorId,
    actorRole: record.actorRole,
    decision: record.decision,
    comment: record.comment,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    createdAt: record.createdAt,
  };

  const computedHash = computeAckRecordHash(recordWithoutHash);

  if (computedHash !== record.recordHash) {
    return ackFailure(
      createAckError(
        AckErrorCode.HASH_MISMATCH,
        'Record hash does not match computed hash',
        { expected: record.recordHash, computed: computedHash }
      )
    );
  }

  return ackSuccess(true);
}

/**
 * Verify chain link (current record links to previous).
 *
 * DETERMINISTIC: Same inputs always produce same result.
 * READ-ONLY: Does not modify records.
 */
export function verifyAckChainLink(
  current: RiskAckRecord,
  previous: RiskAckRecord
): AckResult<boolean> {
  if (current.previousHash !== previous.recordHash) {
    return ackFailure(
      createAckError(
        AckErrorCode.CHAIN_BROKEN,
        'Chain link broken: current.previousHash does not match previous.recordHash',
        {
          currentAckId: current.ackId,
          previousAckId: previous.ackId,
          expectedHash: previous.recordHash,
          actualHash: current.previousHash,
        }
      )
    );
  }

  return ackSuccess(true);
}

/**
 * Check if record is frozen (immutable).
 *
 * READ-ONLY: Does not modify the record.
 */
export function isAckRecordFrozen(record: RiskAckRecord): boolean {
  return Object.isFrozen(record);
}

// ============================================================================
// RECORD HELPERS
// ============================================================================

/**
 * Extract signal ID from record.
 *
 * READ-ONLY: Pure accessor.
 */
export function getSignalId(record: RiskAckRecord): RiskSignalId {
  return record.riskSignalId;
}

/**
 * Extract actor ID from record.
 *
 * READ-ONLY: Pure accessor.
 */
export function getActorId(record: RiskAckRecord): ActorId {
  return record.actorId;
}

/**
 * Check if record is an acknowledgement (vs rejection or escalation).
 *
 * READ-ONLY: Pure function.
 */
export function isAcknowledgement(record: RiskAckRecord): boolean {
  return record.decision === 'ACKNOWLEDGED';
}

/**
 * Check if record is an escalation.
 *
 * READ-ONLY: Pure function.
 */
export function isEscalation(record: RiskAckRecord): boolean {
  return record.decision === 'ESCALATED';
}

/**
 * Check if record is a rejection.
 *
 * READ-ONLY: Pure function.
 */
export function isRejection(record: RiskAckRecord): boolean {
  return record.decision === 'REJECTED';
}
