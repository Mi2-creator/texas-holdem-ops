/**
 * ExecutionReportTypes.ts
 *
 * Types for human-asserted execution reports.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - HUMAN-ASSERTED: Reports are human-stated outcomes, NOT verified truth
 * - PASSIVE DATA LAYER: This module stores data, it does NOT execute anything
 * - APPEND-ONLY: Reports are never modified or deleted
 * - PULL-BASED: External systems query this data, we never push
 * - NO VERIFICATION: We do NOT verify that reported outcomes are accurate
 * - NO STATE MACHINES: No status transitions, no lifecycles, no workflows
 *
 * WHAT THIS MODULE STORES:
 * - Human-asserted execution reports (what a human CLAIMS they did)
 * - Links to the intents they report against
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot verify reports against external state
 * - Cannot execute, trigger, dispatch, or cause any action
 * - Cannot push notifications or emit events
 * - Cannot enforce or block anything
 */

import { type IntentId, type OperatorId } from './ExecutionIntentTypes';

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * Report ID - unique identifier for an execution report record
 */
export type ReportId = string & { readonly __brand: 'ReportId' };

/**
 * Report Hash - hash value for chain integrity
 */
export type ReportHash = string & { readonly __brand: 'ReportHash' };

// ============================================================================
// ID FACTORIES
// ============================================================================

export function createReportId(id: string): ReportId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('ReportId must be a non-empty string');
  }
  return id as ReportId;
}

export function createReportHash(hash: string): ReportHash {
  if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
    throw new Error('ReportHash must be a non-empty string');
  }
  return hash as ReportHash;
}

// ============================================================================
// ENUMS (CLASSIFICATION ONLY - NO STATUS/LIFECYCLE)
// ============================================================================

/**
 * Reported Outcome - human-asserted outcome classification
 *
 * These are CLAIMS about what happened, NOT verified truth.
 * We record what the human asserts, we do NOT verify it.
 */
export const ReportedOutcome = {
  /** Human asserts they completed the recommended action */
  COMPLETED: 'COMPLETED',
  /** Human asserts they partially completed the action */
  PARTIAL: 'PARTIAL',
  /** Human asserts they could not complete the action */
  BLOCKED: 'BLOCKED',
  /** Human asserts action was not needed (external resolution) */
  NOT_NEEDED: 'NOT_NEEDED',
  /** Human asserts they deferred to another operator */
  DEFERRED: 'DEFERRED',
} as const;

export type ReportedOutcome = (typeof ReportedOutcome)[keyof typeof ReportedOutcome];

/**
 * Report Error Codes
 */
export const ReportErrorCode = {
  /** Invalid input data */
  INVALID_INPUT: 'INVALID_INPUT',
  /** Duplicate report */
  DUPLICATE_REPORT: 'DUPLICATE_REPORT',
  /** Referenced intent not found */
  INTENT_NOT_FOUND: 'INTENT_NOT_FOUND',
  /** Hash chain integrity violation */
  CHAIN_BROKEN: 'CHAIN_BROKEN',
  /** Hash mismatch */
  HASH_MISMATCH: 'HASH_MISMATCH',
  /** Forbidden concept detected */
  FORBIDDEN_CONCEPT: 'FORBIDDEN_CONCEPT',
} as const;

export type ReportErrorCode = (typeof ReportErrorCode)[keyof typeof ReportErrorCode];

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Report Error
 */
export interface ReportError {
  readonly code: ReportErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Report Result
 */
export type ReportResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: ReportError };

// ============================================================================
// RESULT HELPERS
// ============================================================================

export function reportSuccess<T>(value: T): ReportResult<T> {
  return { success: true, value };
}

export function reportFailure<T>(error: ReportError): ReportResult<T> {
  return { success: false, error };
}

export function createReportError(
  code: ReportErrorCode,
  message: string,
  details?: Record<string, unknown>
): ReportError {
  return Object.freeze({
    code,
    message,
    details: details ? Object.freeze({ ...details }) : undefined,
  });
}

// ============================================================================
// REPORT INPUT (FOR CREATING RECORDS)
// ============================================================================

/**
 * Execution Report Input - input for creating a report record
 *
 * NOTE: A report is a HUMAN ASSERTION only. It does NOT verify truth.
 * The system records what the human claims, without validation.
 */
export interface ExecutionReportInput {
  /** Intent ID this report is for */
  readonly intentId: IntentId;
  /** Human-asserted outcome */
  readonly reportedOutcome: ReportedOutcome;
  /** Human-provided notes about the outcome */
  readonly notes: string;
  /** Operator who created this report */
  readonly reportedBy: OperatorId;
  /** Explicit timestamp (must be injected, no internal clocks) */
  readonly timestamp: number;
  /** Optional external reference (e.g., ticket number) */
  readonly externalRef?: string;
}

// ============================================================================
// REPORT RECORD (IMMUTABLE)
// ============================================================================

/**
 * Execution Report Record - immutable human-asserted report
 *
 * CRITICAL: This is a DATA RECORD only. It does not:
 * - Execute anything
 * - Verify the reported outcome
 * - Trigger any action
 * - Push any notification
 *
 * It is a passive, queryable assertion stored for audit.
 */
export interface ExecutionReportRecord {
  /** Unique report ID */
  readonly reportId: ReportId;
  /** Intent ID this report is for */
  readonly intentId: IntentId;
  /** Human-asserted outcome */
  readonly reportedOutcome: ReportedOutcome;
  /** Human-provided notes about the outcome */
  readonly notes: string;
  /** Operator who created this report */
  readonly reportedBy: OperatorId;
  /** Sequence number in registry */
  readonly sequenceNumber: number;
  /** Hash of this record */
  readonly recordHash: ReportHash;
  /** Hash of previous record */
  readonly previousHash: ReportHash;
  /** Creation timestamp */
  readonly createdAt: number;
  /** Optional external reference */
  readonly externalRef?: string;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Genesis hash for the first entry in the report chain
 */
export const REPORT_GENESIS_HASH = createReportHash(
  '0000000000000000000000000000000000000000000000000000000000000000'
);

/**
 * Simple deterministic hash function for report records
 *
 * INTEGER-ONLY: Uses only integer arithmetic
 * DETERMINISTIC: Same input produces same output
 */
export function computeReportHash(data: string): ReportHash {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(16, '0');
  return createReportHash(hex.repeat(4)); // 64 char hash
}

/**
 * Compute record hash for chain integrity
 *
 * DETERMINISTIC: Same record produces same hash
 */
export function computeReportRecordHash(
  record: Omit<ExecutionReportRecord, 'recordHash'>
): ReportHash {
  const data = JSON.stringify({
    reportId: record.reportId,
    intentId: record.intentId,
    reportedOutcome: record.reportedOutcome,
    notes: record.notes,
    reportedBy: record.reportedBy,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    createdAt: record.createdAt,
    externalRef: record.externalRef,
  });
  return computeReportHash(data);
}

/**
 * Compute report ID deterministically
 */
export function computeReportId(
  intentId: IntentId,
  reportedBy: OperatorId,
  timestamp: number
): ReportId {
  return createReportId(`report-${intentId}-${reportedBy}-${timestamp}`);
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidReportInput(input: ExecutionReportInput): boolean {
  if (!input.intentId || typeof input.intentId !== 'string') return false;
  if (!input.reportedOutcome || !Object.values(ReportedOutcome).includes(input.reportedOutcome)) return false;
  if (!input.notes || typeof input.notes !== 'string' || input.notes.trim().length === 0) return false;
  if (!input.reportedBy || typeof input.reportedBy !== 'string') return false;
  if (!Number.isInteger(input.timestamp) || input.timestamp <= 0) return false;
  if (input.externalRef !== undefined && typeof input.externalRef !== 'string') return false;
  return true;
}
