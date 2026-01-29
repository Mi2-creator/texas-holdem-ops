/**
 * ApprovalRegistry.ts
 *
 * Append-only registry for OPS-2 approval records.
 *
 * APPEND-ONLY: Records are never modified or deleted.
 * HASH-CHAINED: Each record links to the previous for audit integrity.
 * IDEMPOTENT: Duplicate approvals are safely rejected.
 * TWO-MAN RULE: Self-approval is forbidden.
 * DETERMINISTIC: Same inputs produce same outputs.
 */

import {
  type ApprovalId,
  type ActorId,
  type ApprovalHash,
  type ApprovalRequestInput,
  type ApprovalDecisionInput,
  type ApprovalRequestRecord,
  type ApprovalResult,
  ApprovalStatus,
  ApprovalErrorCode,
  approvalSuccess,
  approvalFailure,
  createApprovalError,
  isTerminalStatus,
  APPROVAL_GENESIS_HASH,
} from './ApprovalTypes';

import {
  createApprovalRequestRecord,
  createApprovalDecisionRecord,
  verifyRecordIntegrity,
  verifyChainLink,
} from './ApprovalRecord';

import { type ManualRechargeReferenceId } from '../recharge/ManualRechargeTypes';

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Registry State - read-only snapshot
 */
export interface ApprovalRegistryState {
  /** All records in order */
  readonly records: readonly ApprovalRequestRecord[];
  /** Current chain head hash */
  readonly headHash: ApprovalHash;
  /** Current sequence number */
  readonly currentSequence: number;
  /** Record count */
  readonly recordCount: number;
}

/**
 * Registry Query Options
 */
export interface ApprovalQueryOptions {
  /** Filter by status */
  readonly status?: ApprovalStatus;
  /** Filter by creator actor ID */
  readonly creatorActorId?: ActorId;
  /** Filter by recharge reference ID */
  readonly rechargeReferenceId?: ManualRechargeReferenceId;
  /** Filter by time range (start) */
  readonly fromTimestamp?: number;
  /** Filter by time range (end) */
  readonly toTimestamp?: number;
  /** Limit results */
  readonly limit?: number;
  /** Offset for pagination */
  readonly offset?: number;
}

// ============================================================================
// APPROVAL REGISTRY
// ============================================================================

/**
 * Approval Registry
 *
 * Manages approval records with:
 * - APPEND-ONLY semantics
 * - HASH-CHAINED integrity
 * - TWO-MAN RULE enforcement
 * - IDEMPOTENT operations
 */
export class ApprovalRegistry {
  private readonly records: ApprovalRequestRecord[] = [];
  private readonly recordsById: Map<string, ApprovalRequestRecord> = new Map();
  private readonly recordsByReferenceId: Map<string, ApprovalRequestRecord[]> = new Map();
  private headHash: ApprovalHash = APPROVAL_GENESIS_HASH;
  private currentSequence: number = 0;

  /**
   * Request approval for a recharge reference.
   *
   * Creates a new PENDING approval record.
   * APPEND-ONLY: Creates new record, never modifies existing.
   */
  requestApproval(input: ApprovalRequestInput): ApprovalResult<ApprovalRequestRecord> {
    // Check for duplicate pending approval for same reference
    const existingRecords = this.recordsByReferenceId.get(input.rechargeReferenceId);
    if (existingRecords) {
      const latestRecord = this.getLatestRecordForReference(input.rechargeReferenceId);
      if (latestRecord && !isTerminalStatus(latestRecord.status)) {
        return approvalFailure(
          createApprovalError(
            ApprovalErrorCode.DUPLICATE_APPROVAL,
            `Pending approval already exists for reference: ${input.rechargeReferenceId}`,
            { rechargeReferenceId: input.rechargeReferenceId }
          )
        );
      }
    }

    // Create new record
    const sequenceNumber = this.currentSequence + 1;
    const result = createApprovalRequestRecord(input, sequenceNumber, this.headHash);

    if (!result.success) {
      return result;
    }

    // Append to registry
    this.appendRecord(result.value);

    return approvalSuccess(result.value);
  }

  /**
   * Make a decision on a pending approval.
   *
   * TWO-MAN RULE: Decision actor must be different from creator.
   * APPEND-ONLY: Creates new record with decision, never modifies original.
   * IDEMPOTENT: Rejects duplicate decisions.
   */
  makeDecision(input: ApprovalDecisionInput): ApprovalResult<ApprovalRequestRecord> {
    // Find the original record
    const originalRecord = this.recordsById.get(input.approvalId);
    if (!originalRecord) {
      return approvalFailure(
        createApprovalError(
          ApprovalErrorCode.REFERENCE_NOT_FOUND,
          `Approval record not found: ${input.approvalId}`,
          { approvalId: input.approvalId }
        )
      );
    }

    // Get latest record for this approval
    const latestRecord = this.getLatestRecordById(input.approvalId);
    if (!latestRecord) {
      return approvalFailure(
        createApprovalError(
          ApprovalErrorCode.REFERENCE_NOT_FOUND,
          `Latest record not found for: ${input.approvalId}`,
          { approvalId: input.approvalId }
        )
      );
    }

    // Check if already decided (idempotent rejection)
    if (isTerminalStatus(latestRecord.status)) {
      return approvalFailure(
        createApprovalError(
          ApprovalErrorCode.ALREADY_TERMINAL,
          `Approval already in terminal status: ${latestRecord.status}`,
          { approvalId: input.approvalId, status: latestRecord.status }
        )
      );
    }

    // Create new record with decision
    const sequenceNumber = this.currentSequence + 1;
    const result = createApprovalDecisionRecord(
      latestRecord,
      input,
      sequenceNumber,
      this.headHash
    );

    if (!result.success) {
      return result;
    }

    // Append to registry
    this.appendRecord(result.value);

    return approvalSuccess(result.value);
  }

  /**
   * Get record by approval ID.
   */
  getRecord(approvalId: ApprovalId): ApprovalRequestRecord | undefined {
    return this.recordsById.get(approvalId);
  }

  /**
   * Get latest record for an approval ID (may include decision).
   */
  getLatestRecordById(approvalId: ApprovalId): ApprovalRequestRecord | undefined {
    let latest: ApprovalRequestRecord | undefined;
    for (const record of this.records) {
      if (record.approvalId === approvalId) {
        if (!latest || record.sequenceNumber > latest.sequenceNumber) {
          latest = record;
        }
      }
    }
    return latest;
  }

  /**
   * Get latest record for a recharge reference.
   */
  getLatestRecordForReference(
    referenceId: ManualRechargeReferenceId
  ): ApprovalRequestRecord | undefined {
    const records = this.recordsByReferenceId.get(referenceId);
    if (!records || records.length === 0) return undefined;

    let latest: ApprovalRequestRecord | undefined;
    for (const record of records) {
      if (!latest || record.sequenceNumber > latest.sequenceNumber) {
        latest = record;
      }
    }
    return latest;
  }

  /**
   * Get all records for a recharge reference.
   */
  getRecordsForReference(
    referenceId: ManualRechargeReferenceId
  ): readonly ApprovalRequestRecord[] {
    const records = this.recordsByReferenceId.get(referenceId);
    return records ? Object.freeze([...records]) : Object.freeze([]);
  }

  /**
   * Query records with filters.
   */
  query(options: ApprovalQueryOptions = {}): readonly ApprovalRequestRecord[] {
    let results = [...this.records];

    // Apply filters
    if (options.status !== undefined) {
      results = results.filter(r => r.status === options.status);
    }

    if (options.creatorActorId !== undefined) {
      results = results.filter(r => r.creatorActorId === options.creatorActorId);
    }

    if (options.rechargeReferenceId !== undefined) {
      results = results.filter(r => r.rechargeReferenceId === options.rechargeReferenceId);
    }

    if (options.fromTimestamp !== undefined) {
      results = results.filter(r => r.requestedAt >= options.fromTimestamp!);
    }

    if (options.toTimestamp !== undefined) {
      results = results.filter(r => r.requestedAt <= options.toTimestamp!);
    }

    // Apply pagination
    if (options.offset !== undefined && options.offset > 0) {
      results = results.slice(options.offset);
    }

    if (options.limit !== undefined && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return Object.freeze(results);
  }

  /**
   * Get all records.
   */
  getAllRecords(): readonly ApprovalRequestRecord[] {
    return Object.freeze([...this.records]);
  }

  /**
   * Get pending approvals.
   */
  getPendingApprovals(): readonly ApprovalRequestRecord[] {
    return this.query({ status: ApprovalStatus.PENDING });
  }

  /**
   * Get registry state snapshot.
   */
  getState(): ApprovalRegistryState {
    return Object.freeze({
      records: Object.freeze([...this.records]),
      headHash: this.headHash,
      currentSequence: this.currentSequence,
      recordCount: this.records.length,
    });
  }

  /**
   * Verify chain integrity.
   */
  verifyChainIntegrity(): ApprovalResult<boolean> {
    if (this.records.length === 0) {
      return approvalSuccess(true);
    }

    // Verify first record links to genesis
    const firstLinkResult = verifyChainLink(this.records[0], null);
    if (!firstLinkResult.success) {
      return firstLinkResult as ApprovalResult<boolean>;
    }

    // Verify each record's hash and chain
    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];

      // Verify record integrity (hash)
      const integrityResult = verifyRecordIntegrity(record);
      if (!integrityResult.success) {
        return integrityResult as ApprovalResult<boolean>;
      }

      // Verify chain link (except first)
      if (i > 0) {
        const linkResult = verifyChainLink(record, this.records[i - 1]);
        if (!linkResult.success) {
          return linkResult as ApprovalResult<boolean>;
        }
      }
    }

    return approvalSuccess(true);
  }

  /**
   * Check if an actor can approve a specific approval.
   *
   * TWO-MAN RULE: Returns false if actor is the creator.
   */
  canActorApprove(approvalId: ApprovalId, actorId: ActorId): boolean {
    const record = this.getLatestRecordById(approvalId);
    if (!record) return false;
    if (isTerminalStatus(record.status)) return false;
    if (record.creatorActorId === actorId) return false; // TWO-MAN RULE
    return true;
  }

  /**
   * Get pending count.
   */
  getPendingCount(): number {
    return this.getPendingApprovals().length;
  }

  /**
   * Append record to registry.
   */
  private appendRecord(record: ApprovalRequestRecord): void {
    this.records.push(record);

    // Update by-ID index (only store first occurrence)
    if (!this.recordsById.has(record.approvalId)) {
      this.recordsById.set(record.approvalId, record);
    }

    // Update by-reference-ID index
    if (!this.recordsByReferenceId.has(record.rechargeReferenceId)) {
      this.recordsByReferenceId.set(record.rechargeReferenceId, []);
    }
    this.recordsByReferenceId.get(record.rechargeReferenceId)!.push(record);

    // Update chain state
    this.headHash = record.recordHash;
    this.currentSequence = record.sequenceNumber;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new approval registry.
 */
export function createApprovalRegistry(): ApprovalRegistry {
  return new ApprovalRegistry();
}

/**
 * Create a test approval registry.
 * NOT for production use.
 */
export function createTestApprovalRegistry(): ApprovalRegistry {
  return new ApprovalRegistry();
}
