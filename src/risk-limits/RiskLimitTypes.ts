/**
 * RiskLimitTypes.ts
 *
 * Types for OPS-3 Grey Risk Limits & Threshold Analysis.
 *
 * ANALYSIS-ONLY: This module observes and flags, NEVER enforces or blocks.
 * REFERENCE-ONLY: All values are references, not money.
 * INTEGER-ONLY: No floating point arithmetic.
 * DETERMINISTIC: Same inputs produce same outputs.
 *
 * CRITICAL: This module CANNOT block, execute, or mutate anything.
 */

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * Risk Rule ID - unique identifier for a risk rule
 */
export type RiskRuleId = string & { readonly __brand: 'RiskRuleId' };

/**
 * Risk Flag ID - unique identifier for a risk flag
 */
export type RiskFlagId = string & { readonly __brand: 'RiskFlagId' };

/**
 * Risk Hash - hash value for chain integrity
 */
export type RiskHash = string & { readonly __brand: 'RiskHash' };

// ============================================================================
// ID FACTORIES
// ============================================================================

export function createRiskRuleId(id: string): RiskRuleId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('RiskRuleId must be a non-empty string');
  }
  return id as RiskRuleId;
}

export function createRiskFlagId(id: string): RiskFlagId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('RiskFlagId must be a non-empty string');
  }
  return id as RiskFlagId;
}

export function createRiskHash(hash: string): RiskHash {
  if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
    throw new Error('RiskHash must be a non-empty string');
  }
  return hash as RiskHash;
}

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Risk Severity - severity level of a risk flag
 *
 * NOTE: This is for ANALYSIS/FLAGGING only, NOT for enforcement.
 */
export const RiskSeverity = {
  /** Informational - no concern */
  INFO: 'INFO',
  /** Low - minor pattern detected */
  LOW: 'LOW',
  /** Medium - notable pattern detected */
  MEDIUM: 'MEDIUM',
  /** High - significant pattern detected */
  HIGH: 'HIGH',
} as const;

export type RiskSeverity = (typeof RiskSeverity)[keyof typeof RiskSeverity];

/**
 * Risk Category - type of risk being analyzed
 */
export const RiskCategory = {
  /** Frequency - rate of operations */
  FREQUENCY: 'FREQUENCY',
  /** Concentration - actor/club/agent concentration */
  CONCENTRATION: 'CONCENTRATION',
  /** Velocity - speed of operations */
  VELOCITY: 'VELOCITY',
  /** Pattern - repeated behavior patterns */
  PATTERN: 'PATTERN',
  /** Skew - distribution imbalance */
  SKEW: 'SKEW',
} as const;

export type RiskCategory = (typeof RiskCategory)[keyof typeof RiskCategory];

/**
 * Threshold Type - type of threshold comparison
 */
export const ThresholdType = {
  /** Count-based - absolute count threshold */
  COUNT: 'COUNT',
  /** Rate-based - rate per time window */
  RATE: 'RATE',
  /** Window-based - within time window */
  WINDOW: 'WINDOW',
  /** Percentage-based - percentage threshold (integer, e.g., 50 = 50%) */
  PERCENTAGE: 'PERCENTAGE',
} as const;

export type ThresholdType = (typeof ThresholdType)[keyof typeof ThresholdType];

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Risk Error Codes
 */
export const RiskErrorCode = {
  /** Invalid input data */
  INVALID_INPUT: 'INVALID_INPUT',
  /** Rule not found */
  RULE_NOT_FOUND: 'RULE_NOT_FOUND',
  /** Duplicate rule */
  DUPLICATE_RULE: 'DUPLICATE_RULE',
  /** Invalid threshold */
  INVALID_THRESHOLD: 'INVALID_THRESHOLD',
  /** Hash chain integrity violation */
  CHAIN_BROKEN: 'CHAIN_BROKEN',
  /** Hash mismatch */
  HASH_MISMATCH: 'HASH_MISMATCH',
  /** Forbidden concept detected */
  FORBIDDEN_CONCEPT: 'FORBIDDEN_CONCEPT',
  /** Enforcement attempted (FORBIDDEN) */
  ENFORCEMENT_FORBIDDEN: 'ENFORCEMENT_FORBIDDEN',
} as const;

export type RiskErrorCode = (typeof RiskErrorCode)[keyof typeof RiskErrorCode];

/**
 * Risk Error
 */
export interface RiskError {
  readonly code: RiskErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Risk Result
 */
export type RiskResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: RiskError };

// ============================================================================
// RESULT HELPERS
// ============================================================================

export function riskSuccess<T>(value: T): RiskResult<T> {
  return { success: true, value };
}

export function riskFailure<T>(error: RiskError): RiskResult<T> {
  return { success: false, error };
}

export function createRiskError(
  code: RiskErrorCode,
  message: string,
  details?: Record<string, unknown>
): RiskError {
  return Object.freeze({
    code,
    message,
    details: details ? Object.freeze({ ...details }) : undefined,
  });
}

// ============================================================================
// THRESHOLD DEFINITIONS
// ============================================================================

/**
 * Count Threshold - absolute count threshold
 */
export interface CountThreshold {
  readonly type: typeof ThresholdType.COUNT;
  /** Maximum count before flagging (integer) */
  readonly maxCount: number;
}

/**
 * Rate Threshold - rate per time window
 */
export interface RateThreshold {
  readonly type: typeof ThresholdType.RATE;
  /** Maximum count per window (integer) */
  readonly maxCount: number;
  /** Window size in milliseconds (integer) */
  readonly windowMs: number;
}

/**
 * Window Threshold - events within time window
 */
export interface WindowThreshold {
  readonly type: typeof ThresholdType.WINDOW;
  /** Window size in milliseconds (integer) */
  readonly windowMs: number;
  /** Minimum gap between events in milliseconds (integer) */
  readonly minGapMs: number;
}

/**
 * Percentage Threshold - percentage threshold (integer, e.g., 50 = 50%)
 */
export interface PercentageThreshold {
  readonly type: typeof ThresholdType.PERCENTAGE;
  /** Maximum percentage (integer, 0-100) */
  readonly maxPercentage: number;
}

/**
 * Threshold - union of all threshold types
 */
export type Threshold =
  | CountThreshold
  | RateThreshold
  | WindowThreshold
  | PercentageThreshold;

// ============================================================================
// RISK RULE DEFINITION
// ============================================================================

/**
 * Risk Rule - defines a risk pattern to analyze
 *
 * NOTE: Rules are for ANALYSIS only, not enforcement.
 */
export interface RiskRule {
  /** Unique rule ID */
  readonly ruleId: RiskRuleId;
  /** Rule name */
  readonly name: string;
  /** Rule description */
  readonly description: string;
  /** Risk category */
  readonly category: RiskCategory;
  /** Severity if threshold exceeded */
  readonly severity: RiskSeverity;
  /** Threshold definition */
  readonly threshold: Threshold;
  /** Whether rule is active */
  readonly active: boolean;
  /** Creation timestamp (must be injected) */
  readonly createdAt: number;
}

/**
 * Risk Rule Input - input for creating a risk rule
 */
export interface RiskRuleInput {
  /** Rule name */
  readonly name: string;
  /** Rule description */
  readonly description: string;
  /** Risk category */
  readonly category: RiskCategory;
  /** Severity if threshold exceeded */
  readonly severity: RiskSeverity;
  /** Threshold definition */
  readonly threshold: Threshold;
  /** Creation timestamp (must be injected) */
  readonly timestamp: number;
}

// ============================================================================
// RISK FLAG (ANALYSIS OUTPUT)
// ============================================================================

/**
 * Risk Flag - output of risk analysis
 *
 * CRITICAL: This is an ANALYSIS OUTPUT only.
 * It flags patterns but DOES NOT enforce, block, or mutate anything.
 */
export interface RiskFlag {
  /** Unique flag ID */
  readonly flagId: RiskFlagId;
  /** Rule that triggered this flag */
  readonly ruleId: RiskRuleId;
  /** Risk category */
  readonly category: RiskCategory;
  /** Severity */
  readonly severity: RiskSeverity;
  /** Description of the flagged pattern */
  readonly description: string;
  /** Subject type (actor, club, agent, recharge, approval) */
  readonly subjectType: string;
  /** Subject ID */
  readonly subjectId: string;
  /** Observed value that triggered the flag (integer) */
  readonly observedValue: number;
  /** Threshold value that was exceeded (integer) */
  readonly thresholdValue: number;
  /** Analysis timestamp (must be injected) */
  readonly analyzedAt: number;
  /** Additional context */
  readonly context?: Readonly<Record<string, unknown>>;
}

// ============================================================================
// RISK RULE RECORD (REGISTRY ENTRY)
// ============================================================================

/**
 * Risk Rule Record - immutable registry entry
 */
export interface RiskRuleRecord {
  /** Unique record ID */
  readonly ruleId: RiskRuleId;
  /** The rule definition */
  readonly rule: RiskRule;
  /** Sequence number in registry */
  readonly sequenceNumber: number;
  /** Hash of this record */
  readonly recordHash: RiskHash;
  /** Hash of previous record */
  readonly previousHash: RiskHash;
  /** Creation timestamp */
  readonly createdAt: number;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Genesis hash for the first entry in the risk chain
 */
export const RISK_GENESIS_HASH = createRiskHash(
  '0000000000000000000000000000000000000000000000000000000000000000'
);

/**
 * Simple deterministic hash function for risk records
 */
export function computeRiskHash(data: string): RiskHash {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(16, '0');
  return createRiskHash(hex.repeat(4)); // 64 char hash
}

/**
 * Compute record hash for chain integrity
 */
export function computeRiskRecordHash(
  record: Omit<RiskRuleRecord, 'recordHash'>
): RiskHash {
  const data = JSON.stringify({
    ruleId: record.ruleId,
    rule: record.rule,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    createdAt: record.createdAt,
  });
  return computeRiskHash(data);
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidThreshold(threshold: Threshold): boolean {
  if (!threshold || !threshold.type) return false;

  switch (threshold.type) {
    case ThresholdType.COUNT:
      return Number.isInteger(threshold.maxCount) && threshold.maxCount > 0;
    case ThresholdType.RATE:
      return Number.isInteger(threshold.maxCount) && threshold.maxCount > 0 &&
             Number.isInteger(threshold.windowMs) && threshold.windowMs > 0;
    case ThresholdType.WINDOW:
      return Number.isInteger(threshold.windowMs) && threshold.windowMs > 0 &&
             Number.isInteger(threshold.minGapMs) && threshold.minGapMs >= 0;
    case ThresholdType.PERCENTAGE:
      return Number.isInteger(threshold.maxPercentage) &&
             threshold.maxPercentage >= 0 && threshold.maxPercentage <= 100;
    default:
      return false;
  }
}

export function isValidRiskRuleInput(input: RiskRuleInput): boolean {
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) return false;
  if (!input.description || typeof input.description !== 'string') return false;
  if (!input.category || !Object.values(RiskCategory).includes(input.category)) return false;
  if (!input.severity || !Object.values(RiskSeverity).includes(input.severity)) return false;
  if (!isValidThreshold(input.threshold)) return false;
  if (!Number.isInteger(input.timestamp) || input.timestamp <= 0) return false;
  return true;
}

/**
 * Compute flag ID deterministically
 */
export function computeFlagId(
  ruleId: RiskRuleId,
  subjectType: string,
  subjectId: string,
  analyzedAt: number
): RiskFlagId {
  return createRiskFlagId(`flag-${ruleId}-${subjectType}-${subjectId}-${analyzedAt}`);
}
