/**
 * HumanConfirmQueue.ts
 *
 * Human Confirmation Queue for texas-holdem-ops
 *
 * Manages references pending human confirmation.
 * All confirmations must be manual - NO automation.
 *
 * MANUAL-ONLY: Human confirmation required for all operations.
 * NO AUTOMATION: No auto-approve, no auto-reject.
 */

import {
  type RechargeReferenceId,
  type RechargeReferenceRecord,
  type ConfirmationDetails,
  type OpsResult,
  ReferenceStatus,
  createConfirmationId,
  opsSuccess,
  opsFailure,
  createOpsError,
  OpsErrorCode,
  isValidTimestamp,
  isValidString,
} from '../ops-config';

// ============================================================================
// QUEUE TYPES
// ============================================================================

/**
 * Confirmation Request
 */
export interface ConfirmationRequest {
  /** Reference to confirm */
  readonly referenceId: RechargeReferenceId;
  /** Operator ID */
  readonly operatorId: string;
  /** Timestamp of confirmation (must be provided) */
  readonly timestamp: number;
  /** Optional notes */
  readonly notes?: string;
}

/**
 * Rejection Request
 */
export interface RejectionRequest {
  /** Reference to reject */
  readonly referenceId: RechargeReferenceId;
  /** Operator ID */
  readonly operatorId: string;
  /** Timestamp of rejection (must be provided) */
  readonly timestamp: number;
  /** Rejection reason (required) */
  readonly reason: string;
}

/**
 * Queue Item - a reference pending confirmation
 */
export interface QueueItem {
  readonly record: RechargeReferenceRecord;
  readonly queuedAt: number;
}

// ============================================================================
// HUMAN CONFIRM QUEUE
// ============================================================================

/**
 * Human Confirm Queue
 *
 * Manages references pending human confirmation.
 * NO automation - all confirmations must be explicit.
 */
export class HumanConfirmQueue {
  private readonly pendingItems: Map<string, QueueItem> = new Map();
  private confirmationCounter: number = 0;

  /**
   * Add a reference to the confirmation queue.
   */
  enqueue(record: RechargeReferenceRecord, timestamp: number): OpsResult<QueueItem> {
    // Only DECLARED references can be queued
    if (record.status !== ReferenceStatus.DECLARED) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.INVALID_STATUS_TRANSITION,
          `Cannot enqueue reference with status "${record.status}". Only DECLARED references can be queued.`
        )
      );
    }

    // Check for duplicate
    if (this.pendingItems.has(record.referenceId)) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.DUPLICATE_REFERENCE,
          `Reference "${record.referenceId}" is already in the queue`
        )
      );
    }

    const item: QueueItem = Object.freeze({
      record,
      queuedAt: timestamp,
    });

    this.pendingItems.set(record.referenceId, item);

    return opsSuccess(item);
  }

  /**
   * Confirm a reference.
   *
   * MANUAL-ONLY: This must be called by a human operator.
   * NO AUTOMATION.
   */
  confirm(request: ConfirmationRequest): OpsResult<RechargeReferenceRecord> {
    // Validate request
    const validation = this.validateConfirmationRequest(request);
    if (!validation.success) {
      return validation as OpsResult<RechargeReferenceRecord>;
    }

    // Get pending item
    const item = this.pendingItems.get(request.referenceId);
    if (!item) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.REFERENCE_NOT_FOUND,
          `Reference "${request.referenceId}" not found in queue`
        )
      );
    }

    // Generate confirmation ID
    this.confirmationCounter++;
    const confirmationId = createConfirmationId(
      `confirm-${request.operatorId}-${request.timestamp}-${this.confirmationCounter}`
    );

    // Create confirmation details
    const confirmation: ConfirmationDetails = Object.freeze({
      confirmationId,
      operatorId: request.operatorId,
      confirmedAt: request.timestamp,
      notes: request.notes,
    });

    // Create updated record
    const confirmedRecord: RechargeReferenceRecord = Object.freeze({
      ...item.record,
      status: ReferenceStatus.CONFIRMED,
      confirmation,
      updatedAt: request.timestamp,
    });

    // Remove from queue
    this.pendingItems.delete(request.referenceId);

    return opsSuccess(confirmedRecord);
  }

  /**
   * Reject a reference.
   *
   * MANUAL-ONLY: This must be called by a human operator.
   * NO AUTOMATION.
   */
  reject(request: RejectionRequest): OpsResult<RechargeReferenceRecord> {
    // Validate request
    const validation = this.validateRejectionRequest(request);
    if (!validation.success) {
      return validation as OpsResult<RechargeReferenceRecord>;
    }

    // Get pending item
    const item = this.pendingItems.get(request.referenceId);
    if (!item) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.REFERENCE_NOT_FOUND,
          `Reference "${request.referenceId}" not found in queue`
        )
      );
    }

    // Create updated record
    const rejectedRecord: RechargeReferenceRecord = Object.freeze({
      ...item.record,
      status: ReferenceStatus.REJECTED,
      updatedAt: request.timestamp,
    });

    // Remove from queue
    this.pendingItems.delete(request.referenceId);

    return opsSuccess(rejectedRecord);
  }

  /**
   * Get pending items.
   */
  getPendingItems(): readonly QueueItem[] {
    return Object.freeze(Array.from(this.pendingItems.values()));
  }

  /**
   * Get pending count.
   */
  getPendingCount(): number {
    return this.pendingItems.size;
  }

  /**
   * Check if reference is pending.
   */
  isPending(referenceId: RechargeReferenceId): boolean {
    return this.pendingItems.has(referenceId);
  }

  /**
   * Validate confirmation request.
   */
  private validateConfirmationRequest(request: ConfirmationRequest): OpsResult<void> {
    if (!request.referenceId) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'referenceId is required')
      );
    }

    if (!isValidString(request.operatorId)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'operatorId must be a non-empty string')
      );
    }

    if (!isValidTimestamp(request.timestamp)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'timestamp must be a valid timestamp')
      );
    }

    return opsSuccess(undefined);
  }

  /**
   * Validate rejection request.
   */
  private validateRejectionRequest(request: RejectionRequest): OpsResult<void> {
    if (!request.referenceId) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'referenceId is required')
      );
    }

    if (!isValidString(request.operatorId)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'operatorId must be a non-empty string')
      );
    }

    if (!isValidTimestamp(request.timestamp)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'timestamp must be a valid timestamp')
      );
    }

    if (!isValidString(request.reason)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'reason must be a non-empty string')
      );
    }

    return opsSuccess(undefined);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a human confirm queue.
 */
export function createHumanConfirmQueue(): HumanConfirmQueue {
  return new HumanConfirmQueue();
}
