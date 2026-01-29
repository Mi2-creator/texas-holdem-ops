/**
 * RechargeIngestor.ts
 *
 * Recharge Reference Ingestor for texas-holdem-ops
 *
 * Ingests recharge references from adapters.
 * Enforces idempotency via externalReferenceId.
 * Produces DECLARED references only.
 *
 * REFERENCE-ONLY: All values are references, not money.
 * APPEND-ONLY: References are never deleted.
 * IDEMPOTENT: Duplicate references are rejected.
 */

import {
  type ExternalReferenceId,
  type RechargeReferenceId,
  type RechargeReferenceInput,
  type RechargeReferenceRecord,
  type OpsResult,
  ReferenceStatus,
  createRechargeReferenceId,
  opsSuccess,
  opsFailure,
  createOpsError,
  OpsErrorCode,
  isValidPositiveInteger,
  isValidTimestamp,
} from '../ops-config';

// ============================================================================
// INGESTOR TYPES
// ============================================================================

/**
 * Ingestor Configuration
 */
export interface IngestorConfig {
  /** Maximum pending references */
  readonly maxPendingReferences: number;
}

/**
 * Default ingestor configuration
 */
export const DEFAULT_INGESTOR_CONFIG: IngestorConfig = Object.freeze({
  maxPendingReferences: 1000,
});

// ============================================================================
// REFERENCE STORE (IN-MEMORY, APPEND-ONLY)
// ============================================================================

/**
 * Reference Store Interface
 *
 * Append-only store for recharge references.
 */
export interface ReferenceStore {
  /** Get reference by external reference ID */
  getByExternalId(externalId: ExternalReferenceId): RechargeReferenceRecord | undefined;
  /** Get reference by reference ID */
  getByReferenceId(referenceId: RechargeReferenceId): RechargeReferenceRecord | undefined;
  /** Append a new reference (idempotent) */
  append(record: RechargeReferenceRecord): OpsResult<RechargeReferenceRecord>;
  /** Get all references */
  getAll(): readonly RechargeReferenceRecord[];
  /** Get count */
  getCount(): number;
}

/**
 * In-memory append-only reference store
 *
 * STUB: In OPS-0, this is an in-memory implementation.
 */
export class InMemoryReferenceStore implements ReferenceStore {
  private readonly records: RechargeReferenceRecord[] = [];
  private readonly byExternalId: Map<string, RechargeReferenceRecord> = new Map();
  private readonly byReferenceId: Map<string, RechargeReferenceRecord> = new Map();

  getByExternalId(externalId: ExternalReferenceId): RechargeReferenceRecord | undefined {
    return this.byExternalId.get(externalId);
  }

  getByReferenceId(referenceId: RechargeReferenceId): RechargeReferenceRecord | undefined {
    return this.byReferenceId.get(referenceId);
  }

  append(record: RechargeReferenceRecord): OpsResult<RechargeReferenceRecord> {
    // Check for duplicate by external ID (idempotency)
    if (this.byExternalId.has(record.input.externalReferenceId)) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.DUPLICATE_REFERENCE,
          `Reference with externalReferenceId "${record.input.externalReferenceId}" already exists`
        )
      );
    }

    // Check for duplicate by reference ID
    if (this.byReferenceId.has(record.referenceId)) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.DUPLICATE_REFERENCE,
          `Reference with referenceId "${record.referenceId}" already exists`
        )
      );
    }

    // Append (immutable)
    const frozenRecord = Object.freeze({ ...record });
    this.records.push(frozenRecord);
    this.byExternalId.set(record.input.externalReferenceId, frozenRecord);
    this.byReferenceId.set(record.referenceId, frozenRecord);

    return opsSuccess(frozenRecord);
  }

  getAll(): readonly RechargeReferenceRecord[] {
    return Object.freeze([...this.records]);
  }

  getCount(): number {
    return this.records.length;
  }
}

// ============================================================================
// RECHARGE INGESTOR
// ============================================================================

/**
 * Recharge Ingestor
 *
 * Ingests recharge references from adapters.
 * Produces DECLARED references.
 */
export class RechargeIngestor {
  private readonly config: IngestorConfig;
  private readonly store: ReferenceStore;
  private referenceCounter: number = 0;

  constructor(
    store: ReferenceStore = new InMemoryReferenceStore(),
    config: IngestorConfig = DEFAULT_INGESTOR_CONFIG
  ) {
    this.store = store;
    this.config = config;
  }

  /**
   * Ingest a recharge reference input.
   *
   * Creates a DECLARED reference record.
   * Enforces idempotency by externalReferenceId.
   */
  ingest(input: RechargeReferenceInput, timestamp: number): OpsResult<RechargeReferenceRecord> {
    // Validate input
    const validationResult = this.validateInput(input, timestamp);
    if (!validationResult.success) {
      return validationResult as OpsResult<RechargeReferenceRecord>;
    }

    // Check for duplicate (idempotency)
    const existing = this.store.getByExternalId(input.externalReferenceId);
    if (existing) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.DUPLICATE_REFERENCE,
          `Reference with externalReferenceId "${input.externalReferenceId}" already exists`,
          { existingReferenceId: existing.referenceId }
        )
      );
    }

    // Check capacity
    if (this.store.getCount() >= this.config.maxPendingReferences) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.INVALID_INPUT,
          `Maximum pending references (${this.config.maxPendingReferences}) reached`
        )
      );
    }

    // Generate reference ID
    this.referenceCounter++;
    const referenceId = createRechargeReferenceId(
      `ref-${timestamp}-${this.referenceCounter}`
    );

    // Create record
    const record: RechargeReferenceRecord = Object.freeze({
      referenceId,
      status: ReferenceStatus.DECLARED,
      input: Object.freeze({ ...input }),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Append to store
    return this.store.append(record);
  }

  /**
   * Get reference by external ID.
   */
  getByExternalId(externalId: ExternalReferenceId): RechargeReferenceRecord | undefined {
    return this.store.getByExternalId(externalId);
  }

  /**
   * Get reference by reference ID.
   */
  getByReferenceId(referenceId: RechargeReferenceId): RechargeReferenceRecord | undefined {
    return this.store.getByReferenceId(referenceId);
  }

  /**
   * Get all references.
   */
  getAllReferences(): readonly RechargeReferenceRecord[] {
    return this.store.getAll();
  }

  /**
   * Get reference count.
   */
  getReferenceCount(): number {
    return this.store.getCount();
  }

  /**
   * Validate input.
   */
  private validateInput(input: RechargeReferenceInput, timestamp: number): OpsResult<void> {
    if (!input.externalReferenceId) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'externalReferenceId is required')
      );
    }

    if (!input.adapterType) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'adapterType is required')
      );
    }

    if (!input.clubId) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'clubId is required')
      );
    }

    if (!input.playerId) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'playerId is required')
      );
    }

    if (!isValidPositiveInteger(input.referenceAmount)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'referenceAmount must be a positive integer')
      );
    }

    if (!isValidTimestamp(input.declaredAt)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'declaredAt must be a valid timestamp')
      );
    }

    if (!isValidTimestamp(timestamp)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'timestamp must be a valid timestamp')
      );
    }

    return opsSuccess(undefined);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a recharge ingestor.
 */
export function createRechargeIngestor(
  store?: ReferenceStore,
  config?: Partial<IngestorConfig>
): RechargeIngestor {
  const fullConfig: IngestorConfig = {
    ...DEFAULT_INGESTOR_CONFIG,
    ...config,
  };
  return new RechargeIngestor(store, fullConfig);
}
