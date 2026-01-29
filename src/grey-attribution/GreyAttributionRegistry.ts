/**
 * GreyAttributionRegistry.ts
 *
 * Append-only, hash-chained registry for grey attribution records.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - APPEND-ONLY: Records are never modified or deleted
 * - HASH-CHAINED: Each record links to the previous for audit integrity
 * - PULL-BASED: External systems query this data, we never push
 * - NO EXECUTION: Registry does NOT trigger any action
 * - PASSIVE: Pure data storage and retrieval
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot modify or delete records
 * - Cannot process money, balances, or settlements
 * - Cannot push notifications or emit events
 */

import {
  type AttributionId,
  type SourceId,
  type TargetId,
  type PeriodId,
  type AttributionHash,
  type AttributionInput,
  type AttributionRecord,
  type AttributionResult,
  AttributionKind,
  AttributionEntityType,
  AttributionErrorCode,
  ATTRIBUTION_GENESIS_HASH,
  computeAttributionRecordHash,
  computeAttributionId,
  attributionSuccess,
  attributionFailure,
  createAttributionError,
  isValidAttributionInput,
} from './GreyAttributionTypes';

// ============================================================================
// REGISTRY STATE TYPE
// ============================================================================

/**
 * Registry State - snapshot of the registry
 */
export interface AttributionRegistryState {
  /** All records in order */
  readonly records: readonly AttributionRecord[];
  /** Total record count */
  readonly recordCount: number;
  /** Latest hash in chain */
  readonly latestHash: AttributionHash;
  /** Chain is valid */
  readonly chainValid: boolean;
}

/**
 * Query options for filtering records
 */
export interface AttributionQueryOptions {
  /** Filter by source ID */
  readonly sourceId?: SourceId;
  /** Filter by target ID */
  readonly targetId?: TargetId;
  /** Filter by source type */
  readonly sourceType?: AttributionEntityType;
  /** Filter by target type */
  readonly targetType?: AttributionEntityType;
  /** Filter by kind */
  readonly kind?: AttributionKind;
  /** Filter by period ID */
  readonly periodId?: PeriodId;
  /** Filter by time range start (inclusive) */
  readonly startTime?: number;
  /** Filter by time range end (exclusive) */
  readonly endTime?: number;
  /** Pagination: skip first N records */
  readonly offset?: number;
  /** Pagination: limit results */
  readonly limit?: number;
}

// ============================================================================
// REGISTRY CLASS
// ============================================================================

/**
 * Grey Attribution Registry
 *
 * Append-only, hash-chained registry for attribution records.
 * All records are immutable and linked for audit integrity.
 */
export class GreyAttributionRegistry {
  private readonly records: AttributionRecord[] = [];
  private readonly recordsById: Map<AttributionId, AttributionRecord> = new Map();
  private latestHash: AttributionHash = ATTRIBUTION_GENESIS_HASH;
  private sequenceNumber = 0;

  /**
   * Record a new attribution.
   *
   * APPEND-ONLY: Creates a new record, never modifies existing.
   */
  recordAttribution(input: AttributionInput): AttributionResult<AttributionRecord> {
    // Validate input
    if (!isValidAttributionInput(input)) {
      return attributionFailure(
        createAttributionError(
          AttributionErrorCode.INVALID_INPUT,
          'Invalid attribution input',
          { input }
        )
      );
    }

    // Compute attribution ID
    const attributionId = computeAttributionId(input);

    // Check for duplicate
    if (this.recordsById.has(attributionId)) {
      return attributionFailure(
        createAttributionError(
          AttributionErrorCode.DUPLICATE_RECORD,
          'Attribution with this ID already exists',
          { attributionId }
        )
      );
    }

    // Compute record hash
    const recordHash = computeAttributionRecordHash(
      input,
      this.latestHash,
      this.sequenceNumber + 1
    );

    // Create frozen record
    const record: AttributionRecord = Object.freeze({
      attributionId,
      sourceId: input.sourceId,
      targetId: input.targetId,
      sourceType: input.sourceType,
      targetType: input.targetType,
      kind: input.kind,
      exposureMetrics: Object.freeze([...input.exposureMetrics]),
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      periodId: input.periodId,
      timestamp: input.timestamp,
      operatorId: input.operatorId,
      notes: input.notes,
      recordHash,
      previousHash: this.latestHash,
      sequenceNumber: this.sequenceNumber + 1,
      createdAt: Date.now(),
    });

    // Append to chain
    this.records.push(record);
    this.recordsById.set(attributionId, record);
    this.latestHash = recordHash;
    this.sequenceNumber += 1;

    return attributionSuccess(record);
  }

  /**
   * Get a record by ID.
   *
   * READ-ONLY: Returns frozen data.
   */
  getRecord(attributionId: AttributionId): AttributionRecord | undefined {
    return this.recordsById.get(attributionId);
  }

  /**
   * Get all records matching query options.
   *
   * READ-ONLY: Returns frozen array.
   */
  getRecords(options: AttributionQueryOptions = {}): readonly AttributionRecord[] {
    let filtered = [...this.records];

    if (options.sourceId) {
      filtered = filtered.filter(r => r.sourceId === options.sourceId);
    }
    if (options.targetId) {
      filtered = filtered.filter(r => r.targetId === options.targetId);
    }
    if (options.sourceType) {
      filtered = filtered.filter(r => r.sourceType === options.sourceType);
    }
    if (options.targetType) {
      filtered = filtered.filter(r => r.targetType === options.targetType);
    }
    if (options.kind) {
      filtered = filtered.filter(r => r.kind === options.kind);
    }
    if (options.periodId) {
      filtered = filtered.filter(r => r.periodId === options.periodId);
    }
    if (options.startTime !== undefined) {
      filtered = filtered.filter(r => r.timestamp >= options.startTime!);
    }
    if (options.endTime !== undefined) {
      filtered = filtered.filter(r => r.timestamp < options.endTime!);
    }

    // Pagination
    if (options.offset !== undefined && options.offset > 0) {
      filtered = filtered.slice(options.offset);
    }
    if (options.limit !== undefined && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    return Object.freeze(filtered);
  }

  /**
   * Get records by source.
   *
   * READ-ONLY: Returns frozen array.
   */
  getRecordsBySource(sourceId: SourceId): readonly AttributionRecord[] {
    return this.getRecords({ sourceId });
  }

  /**
   * Get records by target.
   *
   * READ-ONLY: Returns frozen array.
   */
  getRecordsByTarget(targetId: TargetId): readonly AttributionRecord[] {
    return this.getRecords({ targetId });
  }

  /**
   * Get records by kind.
   *
   * READ-ONLY: Returns frozen array.
   */
  getRecordsByKind(kind: AttributionKind): readonly AttributionRecord[] {
    return this.getRecords({ kind });
  }

  /**
   * Get records by period.
   *
   * READ-ONLY: Returns frozen array.
   */
  getRecordsByPeriod(periodId: PeriodId): readonly AttributionRecord[] {
    return this.getRecords({ periodId });
  }

  /**
   * Get all records.
   *
   * READ-ONLY: Returns frozen array.
   */
  getAllRecords(): readonly AttributionRecord[] {
    return Object.freeze([...this.records]);
  }

  /**
   * Verify the integrity of the hash chain.
   *
   * READ-ONLY: Returns validation result.
   */
  verifyChainIntegrity(): AttributionResult<boolean> {
    if (this.records.length === 0) {
      return attributionSuccess(true);
    }

    let expectedPreviousHash = ATTRIBUTION_GENESIS_HASH;

    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];

      // Verify previous hash link
      if (record.previousHash !== expectedPreviousHash) {
        return attributionFailure(
          createAttributionError(
            AttributionErrorCode.CHAIN_INTEGRITY_ERROR,
            `Chain broken at sequence ${record.sequenceNumber}`,
            { expected: expectedPreviousHash, actual: record.previousHash }
          )
        );
      }

      // Verify sequence number
      if (record.sequenceNumber !== i + 1) {
        return attributionFailure(
          createAttributionError(
            AttributionErrorCode.CHAIN_INTEGRITY_ERROR,
            `Sequence number mismatch at index ${i}`,
            { expected: i + 1, actual: record.sequenceNumber }
          )
        );
      }

      expectedPreviousHash = record.recordHash;
    }

    return attributionSuccess(true);
  }

  /**
   * Get registry state snapshot.
   *
   * READ-ONLY: Returns frozen state.
   */
  getState(): AttributionRegistryState {
    const integrityResult = this.verifyChainIntegrity();
    return Object.freeze({
      records: this.getAllRecords(),
      recordCount: this.records.length,
      latestHash: this.latestHash,
      chainValid: integrityResult.success && integrityResult.value,
    });
  }

  /**
   * Get total exposure for a target across all attributions.
   *
   * READ-ONLY: Returns aggregated exposure metrics.
   */
  getTotalExposureForTarget(targetId: TargetId): readonly { metricType: string; totalValue: number }[] {
    const records = this.getRecordsByTarget(targetId);
    const totals = new Map<string, number>();

    for (const record of records) {
      for (const metric of record.exposureMetrics) {
        const current = totals.get(metric.metricType) || 0;
        totals.set(metric.metricType, current + metric.value);
      }
    }

    const result = Array.from(totals.entries()).map(([metricType, totalValue]) => ({
      metricType,
      totalValue,
    }));

    return Object.freeze(result);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new GreyAttributionRegistry
 */
export function createGreyAttributionRegistry(): GreyAttributionRegistry {
  return new GreyAttributionRegistry();
}

/**
 * Create a test registry (alias for clarity in tests)
 */
export function createTestAttributionRegistry(): GreyAttributionRegistry {
  return new GreyAttributionRegistry();
}
