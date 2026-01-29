/**
 * GreyAttributionTypes.ts
 *
 * OPS-7: Grey Revenue Attribution & Exposure Analysis
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PASSIVE DATA LAYER: Stores data, does NOT execute anything
 * - PULL-BASED: External systems query this data, we never push
 * - REFERENCE-ONLY: Attribution records are references, not monetary values
 * - EXPOSURE-ONLY: All metrics are exposure/ratio/share/index, NOT revenue
 * - APPEND-ONLY: Records are never modified or deleted
 * - HASH-CHAINED: Each record links to the previous for audit integrity
 * - NO STATE MACHINES: No status transitions, no lifecycles, no workflows
 * - NO ENGINE IMPORTS: No dependencies on engine or execution modules
 *
 * SEMANTIC BOUNDARIES:
 * - "Attribution" explains WHY a ratio is considered related
 * - "Exposure" is risk/impact exposure, NOT revenue or earnings
 * - All outputs are analysis results, no side effects
 */

import { createHash } from 'crypto';

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * Attribution Record ID - unique identifier for each attribution record
 */
export type AttributionId = string & { readonly __brand: 'AttributionId' };

/**
 * Source ID - identifier for the source entity in attribution
 */
export type SourceId = string & { readonly __brand: 'SourceId' };

/**
 * Target ID - identifier for the target entity in attribution
 */
export type TargetId = string & { readonly __brand: 'TargetId' };

/**
 * Period ID - identifier for a time period
 */
export type PeriodId = string & { readonly __brand: 'PeriodId' };

/**
 * Attribution Hash - hash for chain integrity
 */
export type AttributionHash = string & { readonly __brand: 'AttributionHash' };

/**
 * Operator ID - identifier for the operator who recorded the attribution
 */
export type AttributionOperatorId = string & { readonly __brand: 'AttributionOperatorId' };

// ============================================================================
// ID FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a valid AttributionId
 */
export function createAttributionId(value: string): AttributionId {
  if (!value || value.trim().length === 0) {
    throw new Error('AttributionId cannot be empty');
  }
  return value.trim() as AttributionId;
}

/**
 * Create a valid SourceId
 */
export function createSourceId(value: string): SourceId {
  if (!value || value.trim().length === 0) {
    throw new Error('SourceId cannot be empty');
  }
  return value.trim() as SourceId;
}

/**
 * Create a valid TargetId
 */
export function createTargetId(value: string): TargetId {
  if (!value || value.trim().length === 0) {
    throw new Error('TargetId cannot be empty');
  }
  return value.trim() as TargetId;
}

/**
 * Create a valid PeriodId
 */
export function createPeriodId(value: string): PeriodId {
  if (!value || value.trim().length === 0) {
    throw new Error('PeriodId cannot be empty');
  }
  return value.trim() as PeriodId;
}

/**
 * Create a valid AttributionHash
 */
export function createAttributionHash(value: string): AttributionHash {
  if (!value || value.trim().length === 0) {
    throw new Error('AttributionHash cannot be empty');
  }
  return value.trim() as AttributionHash;
}

/**
 * Create a valid AttributionOperatorId
 */
export function createAttributionOperatorId(value: string): AttributionOperatorId {
  if (!value || value.trim().length === 0) {
    throw new Error('AttributionOperatorId cannot be empty');
  }
  return value.trim() as AttributionOperatorId;
}

// ============================================================================
// ENUMS (CLASSIFICATION ONLY, NOT STATUS)
// ============================================================================

/**
 * Attribution Kind - classification of attribution relationship
 *
 * NOTE: This is a CLASSIFICATION, not a status or lifecycle state.
 * - DIRECT: Direct attribution (e.g., agent directly involved)
 * - INDIRECT: Indirect attribution (e.g., through referral chain)
 * - DERIVED: Derived attribution (e.g., calculated from other attributions)
 */
export enum AttributionKind {
  DIRECT = 'DIRECT',
  INDIRECT = 'INDIRECT',
  DERIVED = 'DERIVED',
}

/**
 * Exposure Metric Type - what type of exposure metric is being recorded
 *
 * NOTE: These are EXPOSURE metrics, NOT revenue or monetary values.
 * - SHARE: Proportional share (0.0 to 1.0)
 * - RATIO: Calculated ratio
 * - WEIGHT: Weighted factor
 * - INDEX: Normalized index value
 */
export enum ExposureMetricType {
  SHARE = 'SHARE',
  RATIO = 'RATIO',
  WEIGHT = 'WEIGHT',
  INDEX = 'INDEX',
}

/**
 * Entity Type for attribution targets
 */
export enum AttributionEntityType {
  AGENT = 'AGENT',
  CLUB = 'CLUB',
  TABLE = 'TABLE',
  PLAYER = 'PLAYER',
}

/**
 * Attribution Error Code
 */
export enum AttributionErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  CHAIN_INTEGRITY_ERROR = 'CHAIN_INTEGRITY_ERROR',
  FORBIDDEN_CONCEPT = 'FORBIDDEN_CONCEPT',
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Attribution Error
 */
export interface AttributionError {
  readonly code: AttributionErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Attribution Result - discriminated union for operation results
 */
export type AttributionResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: AttributionError };

// ============================================================================
// RESULT HELPERS
// ============================================================================

/**
 * Create a success result
 */
export function attributionSuccess<T>(value: T): AttributionResult<T> {
  return Object.freeze({ success: true, value });
}

/**
 * Create a failure result
 */
export function attributionFailure<T>(error: AttributionError): AttributionResult<T> {
  return Object.freeze({ success: false, error });
}

/**
 * Create an AttributionError
 */
export function createAttributionError(
  code: AttributionErrorCode,
  message: string,
  details?: Record<string, unknown>
): AttributionError {
  return Object.freeze({ code, message, details });
}

// ============================================================================
// EXPOSURE METRIC TYPE
// ============================================================================

/**
 * Exposure Metric - a single exposure measurement
 *
 * NOTE: This is an EXPOSURE metric, NOT revenue.
 * All values represent risk/impact exposure, not monetary amounts.
 */
export interface ExposureMetric {
  /** Type of exposure metric */
  readonly metricType: ExposureMetricType;
  /** The exposure value (0.0 to 1.0 for SHARE, any non-negative for others) */
  readonly value: number;
  /** Optional label for the metric */
  readonly label?: string;
}

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Attribution Input - data required to record an attribution
 *
 * NOTE: This records WHY a ratio is considered related, not monetary values.
 */
export interface AttributionInput {
  /** Source entity ID */
  readonly sourceId: SourceId;
  /** Target entity ID */
  readonly targetId: TargetId;
  /** Source entity type */
  readonly sourceType: AttributionEntityType;
  /** Target entity type */
  readonly targetType: AttributionEntityType;
  /** Kind of attribution relationship */
  readonly kind: AttributionKind;
  /** Exposure metrics associated with this attribution */
  readonly exposureMetrics: readonly ExposureMetric[];
  /** Reference IDs that support this attribution (e.g., flowIds, intentIds) */
  readonly evidenceRefs: readonly string[];
  /** Period ID for time-based attribution */
  readonly periodId: PeriodId;
  /** Timestamp when this attribution was asserted */
  readonly timestamp: number;
  /** Operator who recorded this attribution */
  readonly operatorId: AttributionOperatorId;
  /** Optional notes */
  readonly notes?: string;
}

/**
 * Attribution Record - immutable record of an attribution
 */
export interface AttributionRecord {
  /** Unique attribution ID */
  readonly attributionId: AttributionId;
  /** Source entity ID */
  readonly sourceId: SourceId;
  /** Target entity ID */
  readonly targetId: TargetId;
  /** Source entity type */
  readonly sourceType: AttributionEntityType;
  /** Target entity type */
  readonly targetType: AttributionEntityType;
  /** Kind of attribution relationship */
  readonly kind: AttributionKind;
  /** Exposure metrics associated with this attribution */
  readonly exposureMetrics: readonly ExposureMetric[];
  /** Reference IDs that support this attribution */
  readonly evidenceRefs: readonly string[];
  /** Period ID for time-based attribution */
  readonly periodId: PeriodId;
  /** Timestamp when this attribution was asserted */
  readonly timestamp: number;
  /** Operator who recorded this attribution */
  readonly operatorId: AttributionOperatorId;
  /** Optional notes */
  readonly notes?: string;
  /** Hash of this record */
  readonly recordHash: AttributionHash;
  /** Hash of the previous record in chain */
  readonly previousHash: AttributionHash;
  /** Sequence number in chain */
  readonly sequenceNumber: number;
  /** When this record was created */
  readonly createdAt: number;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Genesis hash for the attribution chain
 */
export const ATTRIBUTION_GENESIS_HASH = createAttributionHash(
  '0'.repeat(64)
);

/**
 * Compute a deterministic hash from data
 */
export function computeAttributionHash(data: string): AttributionHash {
  const hash = createHash('sha256').update(data).digest('hex');
  return createAttributionHash(hash);
}

/**
 * Compute the hash of an attribution record
 */
export function computeAttributionRecordHash(
  input: AttributionInput,
  previousHash: AttributionHash,
  sequenceNumber: number
): AttributionHash {
  const data = JSON.stringify({
    sourceId: input.sourceId,
    targetId: input.targetId,
    sourceType: input.sourceType,
    targetType: input.targetType,
    kind: input.kind,
    exposureMetrics: input.exposureMetrics,
    evidenceRefs: input.evidenceRefs,
    periodId: input.periodId,
    timestamp: input.timestamp,
    operatorId: input.operatorId,
    notes: input.notes,
    previousHash,
    sequenceNumber,
  });
  return computeAttributionHash(data);
}

/**
 * Compute a unique attribution ID from input data
 */
export function computeAttributionId(input: AttributionInput): AttributionId {
  const data = JSON.stringify({
    sourceId: input.sourceId,
    targetId: input.targetId,
    kind: input.kind,
    periodId: input.periodId,
    timestamp: input.timestamp,
  });
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
  return createAttributionId(`attr-${hash}`);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate an exposure metric
 */
export function isValidExposureMetric(metric: ExposureMetric): boolean {
  if (!metric) return false;
  if (!Object.values(ExposureMetricType).includes(metric.metricType)) return false;
  if (typeof metric.value !== 'number' || isNaN(metric.value)) return false;
  if (metric.value < 0) return false;
  // SHARE must be 0.0 to 1.0
  if (metric.metricType === ExposureMetricType.SHARE && metric.value > 1.0) return false;
  return true;
}

/**
 * Validate attribution input
 */
export function isValidAttributionInput(input: AttributionInput): boolean {
  if (!input) return false;
  if (!input.sourceId || !input.targetId) return false;
  if (!Object.values(AttributionEntityType).includes(input.sourceType)) return false;
  if (!Object.values(AttributionEntityType).includes(input.targetType)) return false;
  if (!Object.values(AttributionKind).includes(input.kind)) return false;
  if (!input.periodId) return false;
  if (typeof input.timestamp !== 'number' || input.timestamp <= 0) return false;
  if (!input.operatorId) return false;
  if (!Array.isArray(input.exposureMetrics)) return false;
  if (!input.exposureMetrics.every(isValidExposureMetric)) return false;
  if (!Array.isArray(input.evidenceRefs)) return false;
  return true;
}
