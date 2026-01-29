/**
 * ExecutionReportRegistry.ts
 *
 * Append-only registry for execution report records.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - APPEND-ONLY: Records are never modified or deleted
 * - HASH-CHAINED: Each record links to the previous for audit integrity
 * - PASSIVE: This registry stores data, it does NOT execute anything
 * - PULL-BASED: External systems query this registry, we never push
 * - NO VERIFICATION: We store human assertions, we do NOT verify them
 * - NO STATE MACHINES: No status transitions, no lifecycles
 *
 * WHAT THIS REGISTRY DOES:
 * - Stores immutable report records (human-asserted outcomes)
 * - Maintains hash chain integrity
 * - Provides query methods for external consumption
 *
 * WHAT THIS REGISTRY CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot push notifications or emit events
 * - Cannot modify or delete existing records
 * - Cannot verify reported outcomes against external state
 */

import {
  type ReportId,
  type ReportHash,
  type ExecutionReportInput,
  type ExecutionReportRecord,
  type ReportResult,
  ReportedOutcome,
  ReportErrorCode,
  REPORT_GENESIS_HASH,
  computeReportId,
  computeReportRecordHash,
  reportSuccess,
  reportFailure,
  createReportError,
  isValidReportInput,
} from './ExecutionReportTypes';
import { type IntentId, type OperatorId } from './ExecutionIntentTypes';

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Registry State - read-only snapshot
 */
export interface ReportRegistryState {
  /** All records in order */
  readonly records: readonly ExecutionReportRecord[];
  /** Current chain head hash */
  readonly headHash: ReportHash;
  /** Current sequence number */
  readonly currentSequence: number;
  /** Record count */
  readonly recordCount: number;
}

/**
 * Query options for filtering records
 */
export interface ReportQueryOptions {
  /** Filter by intent ID */
  readonly intentId?: IntentId;
  /** Filter by outcome */
  readonly reportedOutcome?: ReportedOutcome;
  /** Filter by reporter */
  readonly reportedBy?: OperatorId;
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
// EXECUTION REPORT REGISTRY
// ============================================================================

/**
 * Execution Report Registry
 *
 * A passive, append-only data store for execution report records.
 *
 * This registry:
 * - Stores report records as human-asserted outcomes
 * - Maintains hash chain for audit integrity
 * - Provides read-only query methods
 *
 * This registry DOES NOT:
 * - Execute or trigger any action
 * - Push notifications or emit events
 * - Modify or delete existing records
 * - Verify reported outcomes
 */
export class ExecutionReportRegistry {
  private readonly records: ExecutionReportRecord[] = [];
  private readonly recordsById: Map<string, ExecutionReportRecord> = new Map();
  private readonly recordsByIntent: Map<string, ExecutionReportRecord[]> = new Map();
  private readonly recordsByReporter: Map<string, ExecutionReportRecord[]> = new Map();
  private readonly recordsByOutcome: Map<string, ExecutionReportRecord[]> = new Map();
  private headHash: ReportHash = REPORT_GENESIS_HASH;
  private currentSequence: number = 0;

  /**
   * Record a new report.
   *
   * APPEND-ONLY: Creates new record, never modifies existing.
   * PASSIVE: This does NOT trigger any action, it only stores data.
   * NO VERIFICATION: We store what the human asserts, we do NOT verify it.
   */
  recordReport(input: ExecutionReportInput): ReportResult<ExecutionReportRecord> {
    // Validate input
    if (!isValidReportInput(input)) {
      return reportFailure(
        createReportError(
          ReportErrorCode.INVALID_INPUT,
          'Invalid report input',
          { input }
        )
      );
    }

    // Generate report ID
    const sequenceNumber = this.currentSequence + 1;
    const reportId = computeReportId(input.intentId, input.reportedBy, input.timestamp);

    // Check for duplicate
    if (this.recordsById.has(reportId)) {
      return reportFailure(
        createReportError(
          ReportErrorCode.DUPLICATE_REPORT,
          `Report with ID "${reportId}" already exists`,
          { reportId }
        )
      );
    }

    // Build record without hash
    const recordWithoutHash: Omit<ExecutionReportRecord, 'recordHash'> = {
      reportId,
      intentId: input.intentId,
      reportedOutcome: input.reportedOutcome,
      notes: input.notes,
      reportedBy: input.reportedBy,
      sequenceNumber,
      previousHash: this.headHash,
      createdAt: input.timestamp,
      externalRef: input.externalRef,
    };

    // Compute hash
    const recordHash = computeReportRecordHash(recordWithoutHash);

    // Create final frozen record
    const record: ExecutionReportRecord = Object.freeze({
      ...recordWithoutHash,
      recordHash,
    });

    // Append to registry (APPEND-ONLY)
    this.records.push(record);
    this.recordsById.set(record.reportId, record);

    // Index by intent
    if (!this.recordsByIntent.has(record.intentId)) {
      this.recordsByIntent.set(record.intentId, []);
    }
    this.recordsByIntent.get(record.intentId)!.push(record);

    // Index by reporter
    if (!this.recordsByReporter.has(record.reportedBy)) {
      this.recordsByReporter.set(record.reportedBy, []);
    }
    this.recordsByReporter.get(record.reportedBy)!.push(record);

    // Index by outcome
    if (!this.recordsByOutcome.has(record.reportedOutcome)) {
      this.recordsByOutcome.set(record.reportedOutcome, []);
    }
    this.recordsByOutcome.get(record.reportedOutcome)!.push(record);

    // Update chain state
    this.headHash = recordHash;
    this.currentSequence = sequenceNumber;

    return reportSuccess(record);
  }

  // ============================================================================
  // QUERYING (READ-ONLY)
  // ============================================================================

  /**
   * Get report by report ID.
   */
  getReport(reportId: ReportId): ExecutionReportRecord | undefined {
    return this.recordsById.get(reportId);
  }

  /**
   * Get all reports for an intent.
   *
   * NOTE: Multiple reports may exist for the same intent (e.g., partial then complete).
   */
  getReportsByIntent(intentId: IntentId): readonly ExecutionReportRecord[] {
    const records = this.recordsByIntent.get(intentId) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all reports by a reporter.
   */
  getReportsByReporter(reportedBy: OperatorId): readonly ExecutionReportRecord[] {
    const records = this.recordsByReporter.get(reportedBy) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all reports by outcome.
   */
  getReportsByOutcome(outcome: ReportedOutcome): readonly ExecutionReportRecord[] {
    const records = this.recordsByOutcome.get(outcome) || [];
    return Object.freeze([...records]);
  }

  /**
   * Get all reports with optional filtering.
   */
  getAllReports(options?: ReportQueryOptions): readonly ExecutionReportRecord[] {
    let result = [...this.records];

    if (options) {
      // Filter by intent ID
      if (options.intentId) {
        result = result.filter(r => r.intentId === options.intentId);
      }

      // Filter by outcome
      if (options.reportedOutcome) {
        result = result.filter(r => r.reportedOutcome === options.reportedOutcome);
      }

      // Filter by reporter
      if (options.reportedBy) {
        result = result.filter(r => r.reportedBy === options.reportedBy);
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
   * Get latest report for an intent.
   *
   * Returns the most recent report for the given intent, or undefined if none.
   */
  getLatestReportForIntent(intentId: IntentId): ExecutionReportRecord | undefined {
    const reports = this.recordsByIntent.get(intentId);
    if (!reports || reports.length === 0) {
      return undefined;
    }
    return reports[reports.length - 1];
  }

  // ============================================================================
  // CHAIN INTEGRITY
  // ============================================================================

  /**
   * Verify chain integrity.
   */
  verifyChainIntegrity(): ReportResult<boolean> {
    if (this.records.length === 0) {
      return reportSuccess(true);
    }

    // Verify first record links to genesis
    if (this.records[0].previousHash !== REPORT_GENESIS_HASH) {
      return reportFailure(
        createReportError(
          ReportErrorCode.CHAIN_BROKEN,
          'First record does not link to genesis hash',
          { reportId: this.records[0].reportId }
        )
      );
    }

    // Verify each record's hash and chain
    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];

      // Recompute hash
      const recordWithoutHash: Omit<ExecutionReportRecord, 'recordHash'> = {
        reportId: record.reportId,
        intentId: record.intentId,
        reportedOutcome: record.reportedOutcome,
        notes: record.notes,
        reportedBy: record.reportedBy,
        sequenceNumber: record.sequenceNumber,
        previousHash: record.previousHash,
        createdAt: record.createdAt,
        externalRef: record.externalRef,
      };
      const computedHash = computeReportRecordHash(recordWithoutHash);

      if (computedHash !== record.recordHash) {
        return reportFailure(
          createReportError(
            ReportErrorCode.HASH_MISMATCH,
            `Hash mismatch at record ${i}`,
            { reportId: record.reportId, expected: record.recordHash, computed: computedHash }
          )
        );
      }

      // Verify chain link (except first)
      if (i > 0 && record.previousHash !== this.records[i - 1].recordHash) {
        return reportFailure(
          createReportError(
            ReportErrorCode.CHAIN_BROKEN,
            `Chain broken at record ${i}`,
            { reportId: record.reportId }
          )
        );
      }
    }

    return reportSuccess(true);
  }

  /**
   * Get registry state snapshot.
   */
  getState(): ReportRegistryState {
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
   * Get unique reporter count.
   */
  getReporterCount(): number {
    return this.recordsByReporter.size;
  }

  /**
   * Get count of intents with at least one report.
   */
  getReportedIntentCount(): number {
    return this.recordsByIntent.size;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new execution report registry.
 */
export function createExecutionReportRegistry(): ExecutionReportRegistry {
  return new ExecutionReportRegistry();
}

/**
 * Create a test execution report registry.
 * NOT for production use.
 */
export function createTestReportRegistry(): ExecutionReportRegistry {
  return new ExecutionReportRegistry();
}
