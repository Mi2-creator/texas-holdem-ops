/**
 * ExecutionIntentRegistry.ts
 *
 * Append-only registry for execution intent records.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - APPEND-ONLY: Records are never modified or deleted
 * - HASH-CHAINED: Each record links to the previous for audit integrity
 * - PASSIVE: This registry stores data, it does NOT execute anything
 * - PULL-BASED: External systems query this registry, we never push
 * - NO STATE MACHINES: No status transitions, no lifecycles
 *
 * WHAT THIS REGISTRY DOES:
 * - Stores immutable intent records
 * - Maintains hash chain integrity
 * - Provides query methods for external consumption
 *
 * WHAT THIS REGISTRY CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot push notifications or emit events
 * - Cannot modify or delete existing records
 */

import {
  type IntentId,
  type IntentHash,
  type OperatorId,
  type ExecutionIntentInput,
  type ExecutionIntentRecord,
  type IntentResult,
  IntentType,
  IntentErrorCode,
  INTENT_GENESIS_HASH,
  computeIntentId,
  computeIntentRecordHash,
  intentSuccess,
  intentFailure,
  createIntentError,
  isValidIntentInput,
} from './ExecutionIntentTypes';

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Registry State - read-only snapshot
 */
export interface IntentRegistryState {
  /** All records in order */
  readonly records: readonly ExecutionIntentRecord[];
  /** Current chain head hash */
  readonly headHash: IntentHash;
  /** Current sequence number */
  readonly currentSequence: number;
  /** Record count */
  readonly recordCount: number;
}

/**
 * Query options for filtering records
 */
export interface IntentQueryOptions {
  /** Filter by intent type */
  readonly intentType?: IntentType;
  /** Filter by creator */
  readonly createdBy?: OperatorId;
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
// EXECUTION INTENT REGISTRY
// ============================================================================

/**
 * Execution Intent Registry
 *
 * A passive, append-only data store for execution intent records.
 *
 * This registry:
 * - Stores intent records as immutable recommendations
 * - Maintains hash chain for audit integrity
 * - Provides read-only query methods
 *
 * This registry DOES NOT:
 * - Execute or trigger any action
 * - Push notifications or emit events
 * - Modify or delete existing records
 * - Implement any state machine or workflow
 */
export class ExecutionIntentRegistry {
  private readonly records: ExecutionIntentRecord[] = [];
  private readonly recordsById: Map<string, ExecutionIntentRecord> = new Map();
  private readonly recordsByOperator: Map<string, ExecutionIntentRecord[]> = new Map();
  private readonly recordsByType: Map<string, ExecutionIntentRecord[]> = new Map();
  private headHash: IntentHash = INTENT_GENESIS_HASH;
  private currentSequence: number = 0;

  /**
   * Record a new intent.
   *
   * APPEND-ONLY: Creates new record, never modifies existing.
   * PASSIVE: This does NOT trigger any action, it only stores data.
   */
  recordIntent(input: ExecutionIntentInput): IntentResult<ExecutionIntentRecord> {
    // Validate input
    if (!isValidIntentInput(input)) {
      return intentFailure(
        createIntentError(
          IntentErrorCode.INVALID_INPUT,
          'Invalid intent input',
          { input }
        )
      );
    }

    // Verify evidence references exist (at least one required)
    if (input.evidenceRefs.length === 0) {
      return intentFailure(
        createIntentError(
          IntentErrorCode.MISSING_EVIDENCE,
          'Intent must have at least one evidence reference',
          { evidenceRefs: input.evidenceRefs }
        )
      );
    }

    // Generate intent ID
    const sequenceNumber = this.currentSequence + 1;
    const intentId = computeIntentId(input.intentType, input.createdBy, input.timestamp);

    // Check for duplicate
    if (this.recordsById.has(intentId)) {
      return intentFailure(
        createIntentError(
          IntentErrorCode.DUPLICATE_INTENT,
          `Intent with ID "${intentId}" already exists`,
          { intentId }
        )
      );
    }

    // Build record without hash
    const recordWithoutHash: Omit<ExecutionIntentRecord, 'recordHash'> = {
      intentId,
      intentType: input.intentType,
      recommendation: input.recommendation,
      evidenceRefs: Object.freeze([...input.evidenceRefs].map(ref => Object.freeze({ ...ref }))),
      createdBy: input.createdBy,
      sequenceNumber,
      previousHash: this.headHash,
      createdAt: input.timestamp,
      context: input.context,
    };

    // Compute hash
    const recordHash = computeIntentRecordHash(recordWithoutHash);

    // Create final frozen record
    const record: ExecutionIntentRecord = Object.freeze({
      ...recordWithoutHash,
      recordHash,
    });

    // Append to registry (APPEND-ONLY)
    this.records.push(record);
    this.recordsById.set(record.intentId, record);

    // Index by operator
    if (!this.recordsByOperator.has(record.createdBy)) {
      this.recordsByOperator.set(record.createdBy, []);
    }
    this.recordsByOperator.get(record.createdBy)!.push(record);

    // Index by type
    if (!this.recordsByType.has(record.intentType)) {
      this.recordsByType.set(record.intentType, []);
    }
    this.recordsByType.get(record.intentType)!.push(record);

    // Update chain state
    this.headHash = recordHash;
    this.currentSequence = sequenceNumber;

    return intentSuccess(record);
  }

  // ============================================================================
  // QUERYING (READ-ONLY)
  // ============================================================================

  /**
   * Get record by intent ID.
   */
  getRecord(intentId: IntentId): ExecutionIntentRecord | undefined {
    return this.recordsById.get(intentId);
  }

  /**
   * Get all records by an operator.
   */
  getRecordsByOperator(operatorId: OperatorId): readonly ExecutionIntentRecord[] {
    const records = this.recordsByOperator.get(operatorId) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all records by intent type.
   */
  getRecordsByType(intentType: IntentType): readonly ExecutionIntentRecord[] {
    const records = this.recordsByType.get(intentType) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all records with optional filtering.
   */
  getAllRecords(options?: IntentQueryOptions): readonly ExecutionIntentRecord[] {
    let result = [...this.records];

    if (options) {
      // Filter by intent type
      if (options.intentType) {
        result = result.filter(r => r.intentType === options.intentType);
      }

      // Filter by creator
      if (options.createdBy) {
        result = result.filter(r => r.createdBy === options.createdBy);
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
   * Get intents that reference a specific evidence ID.
   */
  getIntentsByEvidence(evidenceId: string): readonly ExecutionIntentRecord[] {
    const result = this.records.filter(record =>
      record.evidenceRefs.some(ref => ref.evidenceId === evidenceId)
    );
    return Object.freeze(result);
  }

  // ============================================================================
  // CHAIN INTEGRITY
  // ============================================================================

  /**
   * Verify chain integrity.
   */
  verifyChainIntegrity(): IntentResult<boolean> {
    if (this.records.length === 0) {
      return intentSuccess(true);
    }

    // Verify first record links to genesis
    if (this.records[0].previousHash !== INTENT_GENESIS_HASH) {
      return intentFailure(
        createIntentError(
          IntentErrorCode.CHAIN_BROKEN,
          'First record does not link to genesis hash',
          { intentId: this.records[0].intentId }
        )
      );
    }

    // Verify each record's hash and chain
    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];

      // Recompute hash
      const recordWithoutHash: Omit<ExecutionIntentRecord, 'recordHash'> = {
        intentId: record.intentId,
        intentType: record.intentType,
        recommendation: record.recommendation,
        evidenceRefs: record.evidenceRefs,
        createdBy: record.createdBy,
        sequenceNumber: record.sequenceNumber,
        previousHash: record.previousHash,
        createdAt: record.createdAt,
        context: record.context,
      };
      const computedHash = computeIntentRecordHash(recordWithoutHash);

      if (computedHash !== record.recordHash) {
        return intentFailure(
          createIntentError(
            IntentErrorCode.HASH_MISMATCH,
            `Hash mismatch at record ${i}`,
            { intentId: record.intentId, expected: record.recordHash, computed: computedHash }
          )
        );
      }

      // Verify chain link (except first)
      if (i > 0 && record.previousHash !== this.records[i - 1].recordHash) {
        return intentFailure(
          createIntentError(
            IntentErrorCode.CHAIN_BROKEN,
            `Chain broken at record ${i}`,
            { intentId: record.intentId }
          )
        );
      }
    }

    return intentSuccess(true);
  }

  /**
   * Get registry state snapshot.
   */
  getState(): IntentRegistryState {
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
   * Get unique operator count.
   */
  getOperatorCount(): number {
    return this.recordsByOperator.size;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new execution intent registry.
 */
export function createExecutionIntentRegistry(): ExecutionIntentRegistry {
  return new ExecutionIntentRegistry();
}

/**
 * Create a test execution intent registry.
 * NOT for production use.
 */
export function createTestIntentRegistry(): ExecutionIntentRegistry {
  return new ExecutionIntentRegistry();
}
