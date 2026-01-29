/**
 * RiskAckRegistry.ts
 *
 * Append-only registry for risk acknowledgements.
 *
 * APPEND-ONLY: Records are never modified or deleted.
 * HASH-CHAINED: Each record links to the previous for audit integrity.
 * IDEMPOTENT: Same (riskSignalId, actorId) cannot be recorded twice with same decision.
 * MANUAL-ONLY: Records human acknowledgements only.
 *
 * CRITICAL: This registry CANNOT execute, block, or trigger any action.
 * It ONLY stores frozen records of human acknowledgements.
 */

import {
  type RiskAckId,
  type RiskSignalId,
  type ActorId,
  type AckHash,
  type RiskAckInput,
  type RiskAckRecord,
  type AckResult,
  AckDecision,
  AckErrorCode,
  ACK_GENESIS_HASH,
  computeAckRecordHash,
  ackSuccess,
  ackFailure,
  createAckError,
  isValidAckInput,
} from './RiskAckTypes';

import { createAckRecord } from './RiskAckRecord';

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Registry State - read-only snapshot
 */
export interface AckRegistryState {
  /** All records in order */
  readonly records: readonly RiskAckRecord[];
  /** Current chain head hash */
  readonly headHash: AckHash;
  /** Current sequence number */
  readonly currentSequence: number;
  /** Record count */
  readonly recordCount: number;
}

/**
 * Query options for filtering records
 */
export interface AckQueryOptions {
  /** Filter by signal ID */
  readonly signalId?: RiskSignalId;
  /** Filter by actor ID */
  readonly actorId?: ActorId;
  /** Filter by decision */
  readonly decision?: AckDecision;
  /** Filter by time range start (inclusive) */
  readonly fromTimestamp?: number;
  /** Filter by time range end (inclusive) */
  readonly toTimestamp?: number;
  /** Pagination: skip first N records */
  readonly offset?: number;
  /** Pagination: limit to N records */
  readonly limit?: number;
}

// ============================================================================
// RISK ACK REGISTRY
// ============================================================================

/**
 * Risk Acknowledgement Registry
 *
 * Manages risk acknowledgement records with:
 * - APPEND-ONLY semantics
 * - HASH-CHAINED integrity
 * - IDEMPOTENT operations
 * - MANUAL-ONLY records (no automation)
 */
export class RiskAckRegistry {
  private readonly records: RiskAckRecord[] = [];
  private readonly recordsByAckId: Map<string, RiskAckRecord> = new Map();
  private readonly recordsBySignal: Map<string, RiskAckRecord[]> = new Map();
  private readonly recordsByActor: Map<string, RiskAckRecord[]> = new Map();
  // Track (signalId, actorId, decision) combinations for idempotency
  private readonly ackKeys: Set<string> = new Set();
  private headHash: AckHash = ACK_GENESIS_HASH;
  private currentSequence: number = 0;

  /**
   * Record a new acknowledgement.
   *
   * APPEND-ONLY: Creates new record, never modifies existing.
   * IDEMPOTENT: Same (signalId, actorId, decision) cannot be recorded twice.
   */
  recordAcknowledgement(input: RiskAckInput): AckResult<RiskAckRecord> {
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

    // Check for duplicate (idempotency check)
    const ackKey = this.computeAckKey(input.riskSignalId, input.actorId, input.decision);
    if (this.ackKeys.has(ackKey)) {
      return ackFailure(
        createAckError(
          AckErrorCode.DUPLICATE_ACK,
          `Duplicate acknowledgement: actor "${input.actorId}" has already made decision "${input.decision}" on signal "${input.riskSignalId}"`,
          { signalId: input.riskSignalId, actorId: input.actorId, decision: input.decision }
        )
      );
    }

    // Check for conflicting decisions (same actor cannot ACK and ESCALATE same signal)
    const conflictResult = this.checkConflictingDecisions(input);
    if (!conflictResult.success) {
      return conflictResult;
    }

    // Create record
    const sequenceNumber = this.currentSequence + 1;
    const recordResult = createAckRecord(input, sequenceNumber, this.headHash);

    if (!recordResult.success) {
      return recordResult;
    }

    const record = recordResult.value;

    // Append to registry
    this.records.push(record);
    this.recordsByAckId.set(record.ackId, record);

    // Index by signal
    if (!this.recordsBySignal.has(record.riskSignalId)) {
      this.recordsBySignal.set(record.riskSignalId, []);
    }
    this.recordsBySignal.get(record.riskSignalId)!.push(record);

    // Index by actor
    if (!this.recordsByActor.has(record.actorId)) {
      this.recordsByActor.set(record.actorId, []);
    }
    this.recordsByActor.get(record.actorId)!.push(record);

    // Mark ack key as used
    this.ackKeys.add(ackKey);

    // Update chain state
    this.headHash = record.recordHash;
    this.currentSequence = sequenceNumber;

    return ackSuccess(record);
  }

  /**
   * Check for conflicting decisions.
   *
   * Same actor cannot both ACK and ESCALATE same signal.
   */
  private checkConflictingDecisions(input: RiskAckInput): AckResult<void> {
    const existingRecords = this.recordsBySignal.get(input.riskSignalId) || [];
    const actorRecords = existingRecords.filter(r => r.actorId === input.actorId);

    for (const existing of actorRecords) {
      // Check for ACK + ESCALATE conflict
      if (
        (existing.decision === AckDecision.ACKNOWLEDGED && input.decision === AckDecision.ESCALATED) ||
        (existing.decision === AckDecision.ESCALATED && input.decision === AckDecision.ACKNOWLEDGED)
      ) {
        return ackFailure(
          createAckError(
            AckErrorCode.CONFLICTING_DECISION,
            `Conflicting decision: actor "${input.actorId}" cannot both ACKNOWLEDGE and ESCALATE signal "${input.riskSignalId}"`,
            {
              signalId: input.riskSignalId,
              actorId: input.actorId,
              existingDecision: existing.decision,
              newDecision: input.decision,
            }
          )
        );
      }
    }

    return ackSuccess(undefined);
  }

  /**
   * Compute ack key for idempotency check.
   */
  private computeAckKey(signalId: RiskSignalId, actorId: ActorId, decision: AckDecision): string {
    return `${signalId}:${actorId}:${decision}`;
  }

  // ============================================================================
  // QUERYING
  // ============================================================================

  /**
   * Get record by ack ID.
   */
  getRecord(ackId: RiskAckId): RiskAckRecord | undefined {
    return this.recordsByAckId.get(ackId);
  }

  /**
   * Get all records for a signal.
   */
  getRecordsBySignal(signalId: RiskSignalId): readonly RiskAckRecord[] {
    const records = this.recordsBySignal.get(signalId) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all records by an actor.
   */
  getRecordsByActor(actorId: ActorId): readonly RiskAckRecord[] {
    const records = this.recordsByActor.get(actorId) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all records with optional filtering.
   */
  getAllRecords(options?: AckQueryOptions): readonly RiskAckRecord[] {
    let result = [...this.records];

    if (options) {
      // Filter by signal ID
      if (options.signalId) {
        result = result.filter(r => r.riskSignalId === options.signalId);
      }

      // Filter by actor ID
      if (options.actorId) {
        result = result.filter(r => r.actorId === options.actorId);
      }

      // Filter by decision
      if (options.decision) {
        result = result.filter(r => r.decision === options.decision);
      }

      // Filter by time range
      if (options.fromTimestamp !== undefined) {
        result = result.filter(r => r.createdAt >= options.fromTimestamp!);
      }
      if (options.toTimestamp !== undefined) {
        result = result.filter(r => r.createdAt <= options.toTimestamp!);
      }

      // Pagination
      if (options.offset !== undefined && options.offset > 0) {
        result = result.slice(options.offset);
      }
      if (options.limit !== undefined && options.limit > 0) {
        result = result.slice(0, options.limit);
      }
    }

    return Object.freeze(result);
  }

  /**
   * Check if an actor has acknowledged a signal.
   */
  hasActorAcknowledged(signalId: RiskSignalId, actorId: ActorId): boolean {
    const key = this.computeAckKey(signalId, actorId, AckDecision.ACKNOWLEDGED);
    return this.ackKeys.has(key);
  }

  /**
   * Check if an actor has escalated a signal.
   */
  hasActorEscalated(signalId: RiskSignalId, actorId: ActorId): boolean {
    const key = this.computeAckKey(signalId, actorId, AckDecision.ESCALATED);
    return this.ackKeys.has(key);
  }

  /**
   * Check if an actor has rejected a signal.
   */
  hasActorRejected(signalId: RiskSignalId, actorId: ActorId): boolean {
    const key = this.computeAckKey(signalId, actorId, AckDecision.REJECTED);
    return this.ackKeys.has(key);
  }

  /**
   * Get count of acknowledgements for a signal.
   */
  getAckCountForSignal(signalId: RiskSignalId): number {
    const records = this.recordsBySignal.get(signalId) || [];
    return records.filter(r => r.decision === AckDecision.ACKNOWLEDGED).length;
  }

  /**
   * Get count of escalations for a signal.
   */
  getEscalationCountForSignal(signalId: RiskSignalId): number {
    const records = this.recordsBySignal.get(signalId) || [];
    return records.filter(r => r.decision === AckDecision.ESCALATED).length;
  }

  // ============================================================================
  // CHAIN INTEGRITY
  // ============================================================================

  /**
   * Verify chain integrity.
   */
  verifyChainIntegrity(): AckResult<boolean> {
    if (this.records.length === 0) {
      return ackSuccess(true);
    }

    // Verify first record links to genesis
    if (this.records[0].previousHash !== ACK_GENESIS_HASH) {
      return ackFailure(
        createAckError(
          AckErrorCode.CHAIN_BROKEN,
          'First record does not link to genesis hash',
          { ackId: this.records[0].ackId }
        )
      );
    }

    // Verify each record's hash and chain
    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];

      // Recompute hash
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
            `Hash mismatch at record ${i}`,
            { ackId: record.ackId, expected: record.recordHash, computed: computedHash }
          )
        );
      }

      // Verify chain link (except first)
      if (i > 0 && record.previousHash !== this.records[i - 1].recordHash) {
        return ackFailure(
          createAckError(
            AckErrorCode.CHAIN_BROKEN,
            `Chain broken at record ${i}`,
            { ackId: record.ackId }
          )
        );
      }
    }

    return ackSuccess(true);
  }

  /**
   * Get registry state snapshot.
   */
  getState(): AckRegistryState {
    return Object.freeze({
      records: Object.freeze([...this.records]),
      headHash: this.headHash,
      currentSequence: this.currentSequence,
      recordCount: this.records.length,
    });
  }

  /**
   * Get record count.
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /**
   * Get unique signal count.
   */
  getSignalCount(): number {
    return this.recordsBySignal.size;
  }

  /**
   * Get unique actor count.
   */
  getActorCount(): number {
    return this.recordsByActor.size;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new risk acknowledgement registry.
 */
export function createRiskAckRegistry(): RiskAckRegistry {
  return new RiskAckRegistry();
}

/**
 * Create a test risk acknowledgement registry.
 * NOT for production use.
 */
export function createTestRiskAckRegistry(): RiskAckRegistry {
  return new RiskAckRegistry();
}
