/**
 * GreyFlowRegistry.ts
 *
 * Append-only registry for grey flow records.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - APPEND-ONLY: Records are never modified or deleted
 * - HASH-CHAINED: Each record links to the previous for audit integrity
 * - PASSIVE: This registry stores data, it does NOT execute anything
 * - PULL-BASED: External systems query this registry, we never push
 * - NO STATE MACHINES: No status transitions, no lifecycles
 *
 * SEMANTIC BOUNDARIES:
 * - "Flow" is count and ratio, NOT money amount
 * - Unit counts are reference values, NOT monetary values
 *
 * WHAT THIS REGISTRY CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot push notifications or emit events
 * - Cannot modify or delete existing records
 * - Cannot process money, balances, or settlements
 */

import {
  type GreyFlowRecordId,
  type FlowHash,
  type EntityId,
  type FlowOperatorId,
  type GreyFlowInput,
  type GreyFlowRecord,
  type FlowResult,
  FlowDirection,
  FlowSource,
  EntityType,
  FlowErrorCode,
  FLOW_GENESIS_HASH,
  computeFlowId,
  computeFlowRecordHash,
  flowSuccess,
  flowFailure,
  createFlowError,
  isValidFlowInput,
} from './GreyFlowTypes';

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Registry State - read-only snapshot
 */
export interface FlowRegistryState {
  /** All records in order */
  readonly records: readonly GreyFlowRecord[];
  /** Current chain head hash */
  readonly headHash: FlowHash;
  /** Current sequence number */
  readonly currentSequence: number;
  /** Record count */
  readonly recordCount: number;
}

/**
 * Query options for filtering records
 */
export interface FlowQueryOptions {
  /** Filter by direction */
  readonly direction?: FlowDirection;
  /** Filter by source */
  readonly source?: FlowSource;
  /** Filter by source entity ID */
  readonly sourceEntityId?: EntityId;
  /** Filter by source entity type */
  readonly sourceEntityType?: EntityType;
  /** Filter by target entity ID */
  readonly targetEntityId?: EntityId;
  /** Filter by creator */
  readonly createdBy?: FlowOperatorId;
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
// GREY FLOW REGISTRY
// ============================================================================

/**
 * Grey Flow Registry
 *
 * A passive, append-only data store for grey flow records.
 *
 * This registry:
 * - Stores flow records as reference data
 * - Maintains hash chain for audit integrity
 * - Provides read-only query methods
 *
 * This registry DOES NOT:
 * - Execute or trigger any action
 * - Push notifications or emit events
 * - Modify or delete existing records
 * - Process money, balances, or settlements
 */
export class GreyFlowRegistry {
  private readonly records: GreyFlowRecord[] = [];
  private readonly recordsById: Map<string, GreyFlowRecord> = new Map();
  private readonly recordsBySource: Map<string, GreyFlowRecord[]> = new Map();
  private readonly recordsBySourceEntity: Map<string, GreyFlowRecord[]> = new Map();
  private readonly recordsByTargetEntity: Map<string, GreyFlowRecord[]> = new Map();
  private readonly recordsByOperator: Map<string, GreyFlowRecord[]> = new Map();
  private headHash: FlowHash = FLOW_GENESIS_HASH;
  private currentSequence: number = 0;

  /**
   * Record a new flow.
   *
   * APPEND-ONLY: Creates new record, never modifies existing.
   * PASSIVE: This does NOT trigger any action, it only stores data.
   */
  recordFlow(input: GreyFlowInput): FlowResult<GreyFlowRecord> {
    // Validate input
    if (!isValidFlowInput(input)) {
      return flowFailure(
        createFlowError(
          FlowErrorCode.INVALID_INPUT,
          'Invalid flow input',
          { input }
        )
      );
    }

    // Generate flow ID
    const sequenceNumber = this.currentSequence + 1;
    const flowId = computeFlowId(input.source, input.sourceEntityId, input.createdBy, input.timestamp);

    // Check for duplicate
    if (this.recordsById.has(flowId)) {
      return flowFailure(
        createFlowError(
          FlowErrorCode.DUPLICATE_FLOW,
          `Flow with ID "${flowId}" already exists`,
          { flowId }
        )
      );
    }

    // Build record without hash
    const recordWithoutHash: Omit<GreyFlowRecord, 'recordHash'> = {
      flowId,
      direction: input.direction,
      source: input.source,
      sourceEntityId: input.sourceEntityId,
      sourceEntityType: input.sourceEntityType,
      targetEntityId: input.targetEntityId,
      targetEntityType: input.targetEntityType,
      unitCount: input.unitCount,
      createdBy: input.createdBy,
      sequenceNumber,
      previousHash: this.headHash,
      createdAt: input.timestamp,
      description: input.description,
    };

    // Compute hash
    const recordHash = computeFlowRecordHash(recordWithoutHash);

    // Create final frozen record
    const record: GreyFlowRecord = Object.freeze({
      ...recordWithoutHash,
      recordHash,
    });

    // Append to registry (APPEND-ONLY)
    this.records.push(record);
    this.recordsById.set(record.flowId, record);

    // Index by source
    if (!this.recordsBySource.has(record.source)) {
      this.recordsBySource.set(record.source, []);
    }
    this.recordsBySource.get(record.source)!.push(record);

    // Index by source entity
    if (!this.recordsBySourceEntity.has(record.sourceEntityId)) {
      this.recordsBySourceEntity.set(record.sourceEntityId, []);
    }
    this.recordsBySourceEntity.get(record.sourceEntityId)!.push(record);

    // Index by target entity (if present)
    if (record.targetEntityId) {
      if (!this.recordsByTargetEntity.has(record.targetEntityId)) {
        this.recordsByTargetEntity.set(record.targetEntityId, []);
      }
      this.recordsByTargetEntity.get(record.targetEntityId)!.push(record);
    }

    // Index by operator
    if (!this.recordsByOperator.has(record.createdBy)) {
      this.recordsByOperator.set(record.createdBy, []);
    }
    this.recordsByOperator.get(record.createdBy)!.push(record);

    // Update chain state
    this.headHash = recordHash;
    this.currentSequence = sequenceNumber;

    return flowSuccess(record);
  }

  // ============================================================================
  // QUERYING (READ-ONLY)
  // ============================================================================

  /**
   * Get record by flow ID.
   */
  getRecord(flowId: GreyFlowRecordId): GreyFlowRecord | undefined {
    return this.recordsById.get(flowId);
  }

  /**
   * Get all records by source.
   */
  getRecordsBySource(source: FlowSource): readonly GreyFlowRecord[] {
    const records = this.recordsBySource.get(source) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all records by source entity.
   */
  getRecordsBySourceEntity(entityId: EntityId): readonly GreyFlowRecord[] {
    const records = this.recordsBySourceEntity.get(entityId) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all records by target entity.
   */
  getRecordsByTargetEntity(entityId: EntityId): readonly GreyFlowRecord[] {
    const records = this.recordsByTargetEntity.get(entityId) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all records involving an entity (as source or target).
   */
  getRecordsByEntity(entityId: EntityId): readonly GreyFlowRecord[] {
    const sourceRecords = this.recordsBySourceEntity.get(entityId) || [];
    const targetRecords = this.recordsByTargetEntity.get(entityId) || [];

    // Combine and deduplicate
    const seen = new Set<string>();
    const result: GreyFlowRecord[] = [];

    for (const record of [...sourceRecords, ...targetRecords]) {
      if (!seen.has(record.flowId)) {
        seen.add(record.flowId);
        result.push(record);
      }
    }

    // Sort by sequence number
    result.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    return Object.freeze(result);
  }

  /**
   * Get all records by operator.
   */
  getRecordsByOperator(operatorId: FlowOperatorId): readonly GreyFlowRecord[] {
    const records = this.recordsByOperator.get(operatorId) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all records with optional filtering.
   */
  getAllRecords(options?: FlowQueryOptions): readonly GreyFlowRecord[] {
    let result = [...this.records];

    if (options) {
      // Filter by direction
      if (options.direction) {
        result = result.filter(r => r.direction === options.direction);
      }

      // Filter by source
      if (options.source) {
        result = result.filter(r => r.source === options.source);
      }

      // Filter by source entity ID
      if (options.sourceEntityId) {
        result = result.filter(r => r.sourceEntityId === options.sourceEntityId);
      }

      // Filter by source entity type
      if (options.sourceEntityType) {
        result = result.filter(r => r.sourceEntityType === options.sourceEntityType);
      }

      // Filter by target entity ID
      if (options.targetEntityId) {
        result = result.filter(r => r.targetEntityId === options.targetEntityId);
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

  // ============================================================================
  // CHAIN INTEGRITY
  // ============================================================================

  /**
   * Verify chain integrity.
   */
  verifyChainIntegrity(): FlowResult<boolean> {
    if (this.records.length === 0) {
      return flowSuccess(true);
    }

    // Verify first record links to genesis
    if (this.records[0].previousHash !== FLOW_GENESIS_HASH) {
      return flowFailure(
        createFlowError(
          FlowErrorCode.CHAIN_BROKEN,
          'First record does not link to genesis hash',
          { flowId: this.records[0].flowId }
        )
      );
    }

    // Verify each record's hash and chain
    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];

      // Recompute hash
      const recordWithoutHash: Omit<GreyFlowRecord, 'recordHash'> = {
        flowId: record.flowId,
        direction: record.direction,
        source: record.source,
        sourceEntityId: record.sourceEntityId,
        sourceEntityType: record.sourceEntityType,
        targetEntityId: record.targetEntityId,
        targetEntityType: record.targetEntityType,
        unitCount: record.unitCount,
        createdBy: record.createdBy,
        sequenceNumber: record.sequenceNumber,
        previousHash: record.previousHash,
        createdAt: record.createdAt,
        description: record.description,
      };
      const computedHash = computeFlowRecordHash(recordWithoutHash);

      if (computedHash !== record.recordHash) {
        return flowFailure(
          createFlowError(
            FlowErrorCode.HASH_MISMATCH,
            `Hash mismatch at record ${i}`,
            { flowId: record.flowId, expected: record.recordHash, computed: computedHash }
          )
        );
      }

      // Verify chain link (except first)
      if (i > 0 && record.previousHash !== this.records[i - 1].recordHash) {
        return flowFailure(
          createFlowError(
            FlowErrorCode.CHAIN_BROKEN,
            `Chain broken at record ${i}`,
            { flowId: record.flowId }
          )
        );
      }
    }

    return flowSuccess(true);
  }

  /**
   * Get registry state snapshot.
   */
  getState(): FlowRegistryState {
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
   * Get unique source entity count.
   */
  getSourceEntityCount(): number {
    return this.recordsBySourceEntity.size;
  }

  /**
   * Get unique target entity count.
   */
  getTargetEntityCount(): number {
    return this.recordsByTargetEntity.size;
  }

  /**
   * Get total unit count (sum of all flow unit counts).
   *
   * NOTE: This is a count total, NOT a monetary value.
   */
  getTotalUnitCount(): number {
    return this.records.reduce((sum, r) => sum + r.unitCount, 0);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new grey flow registry.
 */
export function createGreyFlowRegistry(): GreyFlowRegistry {
  return new GreyFlowRegistry();
}

/**
 * Create a test grey flow registry.
 * NOT for production use.
 */
export function createTestFlowRegistry(): GreyFlowRegistry {
  return new GreyFlowRegistry();
}
