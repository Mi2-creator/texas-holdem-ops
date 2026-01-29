/**
 * ExecutionIntentTypes.ts
 *
 * Types for OPS-5 External Manual Execution Intent Interface.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PASSIVE DATA LAYER: This module stores data, it does NOT execute anything
 * - PULL-BASED: External systems query this data, we never push or dispatch
 * - RECOMMENDATION ONLY: Intents are recommendations, not orders
 * - HUMAN-ASSERTED: All reports are human-asserted facts, not verified truth
 * - APPEND-ONLY: Records are never modified or deleted
 * - NO STATE MACHINES: No status transitions, no lifecycles, no workflows
 *
 * WHAT THIS MODULE STORES:
 * - Intent records (what a human is advised to do)
 * - Evidence bindings (references to signals, approvals, flows)
 * - Execution reports (human-asserted outcomes)
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot execute, trigger, dispatch, or cause any action
 * - Cannot push notifications or emit events
 * - Cannot enforce or block anything
 * - Cannot access engine internals
 * - Cannot process money, balances, or settlements
 */

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * Intent ID - unique identifier for an execution intent record
 */
export type IntentId = string & { readonly __brand: 'IntentId' };

/**
 * Evidence ID - reference to external evidence (signals, approvals, flows)
 */
export type EvidenceId = string & { readonly __brand: 'EvidenceId' };

/**
 * Intent Hash - hash value for chain integrity
 */
export type IntentHash = string & { readonly __brand: 'IntentHash' };

/**
 * Operator ID - identifies the human operator who created the intent
 */
export type OperatorId = string & { readonly __brand: 'OperatorId' };

// ============================================================================
// ID FACTORIES
// ============================================================================

export function createIntentId(id: string): IntentId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('IntentId must be a non-empty string');
  }
  return id as IntentId;
}

export function createEvidenceId(id: string): EvidenceId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('EvidenceId must be a non-empty string');
  }
  return id as EvidenceId;
}

export function createIntentHash(hash: string): IntentHash {
  if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
    throw new Error('IntentHash must be a non-empty string');
  }
  return hash as IntentHash;
}

export function createOperatorId(id: string): OperatorId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('OperatorId must be a non-empty string');
  }
  return id as OperatorId;
}

// ============================================================================
// ENUMS (NO STATUS/LIFECYCLE - ONLY CLASSIFICATION)
// ============================================================================

/**
 * Intent Type - classification of intent (NOT a status or lifecycle state)
 *
 * These are categories of recommendations, NOT workflow states.
 */
export const IntentType = {
  /** Recommendation to review a flagged item */
  REVIEW: 'REVIEW',
  /** Recommendation to take corrective action outside system */
  CORRECTIVE: 'CORRECTIVE',
  /** Recommendation to escalate to higher authority */
  ESCALATE: 'ESCALATE',
  /** Recommendation to investigate further */
  INVESTIGATE: 'INVESTIGATE',
  /** Recommendation to acknowledge and document */
  DOCUMENT: 'DOCUMENT',
} as const;

export type IntentType = (typeof IntentType)[keyof typeof IntentType];

/**
 * Evidence Type - classification of evidence sources
 */
export const EvidenceType = {
  /** Reference to a risk signal (from OPS-3) */
  RISK_SIGNAL: 'RISK_SIGNAL',
  /** Reference to a risk acknowledgement (from OPS-4) */
  RISK_ACK: 'RISK_ACK',
  /** Reference to an approval record (from OPS-2) */
  APPROVAL: 'APPROVAL',
  /** Reference to a recharge record (from OPS-1) */
  RECHARGE: 'RECHARGE',
  /** Reference to a grey flow link (from OPS-1) */
  GREY_FLOW: 'GREY_FLOW',
} as const;

export type EvidenceType = (typeof EvidenceType)[keyof typeof EvidenceType];

/**
 * Intent Error Codes
 */
export const IntentErrorCode = {
  /** Invalid input data */
  INVALID_INPUT: 'INVALID_INPUT',
  /** Duplicate intent */
  DUPLICATE_INTENT: 'DUPLICATE_INTENT',
  /** Missing evidence */
  MISSING_EVIDENCE: 'MISSING_EVIDENCE',
  /** Hash chain integrity violation */
  CHAIN_BROKEN: 'CHAIN_BROKEN',
  /** Hash mismatch */
  HASH_MISMATCH: 'HASH_MISMATCH',
  /** Forbidden concept detected */
  FORBIDDEN_CONCEPT: 'FORBIDDEN_CONCEPT',
} as const;

export type IntentErrorCode = (typeof IntentErrorCode)[keyof typeof IntentErrorCode];

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Intent Error
 */
export interface IntentError {
  readonly code: IntentErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Intent Result
 */
export type IntentResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: IntentError };

// ============================================================================
// RESULT HELPERS
// ============================================================================

export function intentSuccess<T>(value: T): IntentResult<T> {
  return { success: true, value };
}

export function intentFailure<T>(error: IntentError): IntentResult<T> {
  return { success: false, error };
}

export function createIntentError(
  code: IntentErrorCode,
  message: string,
  details?: Record<string, unknown>
): IntentError {
  return Object.freeze({
    code,
    message,
    details: details ? Object.freeze({ ...details }) : undefined,
  });
}

// ============================================================================
// EVIDENCE REFERENCE (IMMUTABLE)
// ============================================================================

/**
 * Evidence Reference - immutable reference to external evidence
 *
 * This is a REFERENCE ONLY - we do not fetch, validate, or process the evidence.
 * External systems must resolve these references themselves.
 */
export interface EvidenceReference {
  /** Unique evidence ID */
  readonly evidenceId: EvidenceId;
  /** Type of evidence */
  readonly evidenceType: EvidenceType;
  /** Optional human-readable description */
  readonly description?: string;
}

// ============================================================================
// INTENT INPUT (FOR CREATING RECORDS)
// ============================================================================

/**
 * Execution Intent Input - input for creating an intent record
 *
 * NOTE: An intent is a RECOMMENDATION only. It does NOT cause any action.
 * Human operators read intents and decide what to do OUTSIDE this system.
 */
export interface ExecutionIntentInput {
  /** Type/category of intent */
  readonly intentType: IntentType;
  /** Human-readable recommendation text */
  readonly recommendation: string;
  /** Evidence references (REQUIRED - no intent without evidence) */
  readonly evidenceRefs: readonly EvidenceReference[];
  /** Operator who created this intent */
  readonly createdBy: OperatorId;
  /** Explicit timestamp (must be injected, no internal clocks) */
  readonly timestamp: number;
  /** Optional additional context */
  readonly context?: string;
}

// ============================================================================
// INTENT RECORD (IMMUTABLE)
// ============================================================================

/**
 * Execution Intent Record - immutable intent record
 *
 * CRITICAL: This is a DATA RECORD only. It does not:
 * - Execute anything
 * - Trigger any action
 * - Dispatch any event
 * - Push any notification
 *
 * It is a passive, queryable recommendation stored for audit.
 */
export interface ExecutionIntentRecord {
  /** Unique intent ID */
  readonly intentId: IntentId;
  /** Type/category of intent */
  readonly intentType: IntentType;
  /** Human-readable recommendation text */
  readonly recommendation: string;
  /** Evidence references */
  readonly evidenceRefs: readonly EvidenceReference[];
  /** Operator who created this intent */
  readonly createdBy: OperatorId;
  /** Sequence number in registry */
  readonly sequenceNumber: number;
  /** Hash of this record */
  readonly recordHash: IntentHash;
  /** Hash of previous record */
  readonly previousHash: IntentHash;
  /** Creation timestamp */
  readonly createdAt: number;
  /** Optional additional context */
  readonly context?: string;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Genesis hash for the first entry in the intent chain
 */
export const INTENT_GENESIS_HASH = createIntentHash(
  '0000000000000000000000000000000000000000000000000000000000000000'
);

/**
 * Simple deterministic hash function for intent records
 *
 * INTEGER-ONLY: Uses only integer arithmetic
 * DETERMINISTIC: Same input produces same output
 */
export function computeIntentHash(data: string): IntentHash {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(16, '0');
  return createIntentHash(hex.repeat(4)); // 64 char hash
}

/**
 * Compute record hash for chain integrity
 *
 * DETERMINISTIC: Same record produces same hash
 */
export function computeIntentRecordHash(
  record: Omit<ExecutionIntentRecord, 'recordHash'>
): IntentHash {
  const data = JSON.stringify({
    intentId: record.intentId,
    intentType: record.intentType,
    recommendation: record.recommendation,
    evidenceRefs: record.evidenceRefs,
    createdBy: record.createdBy,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    createdAt: record.createdAt,
    context: record.context,
  });
  return computeIntentHash(data);
}

/**
 * Compute intent ID deterministically
 */
export function computeIntentId(
  intentType: IntentType,
  createdBy: OperatorId,
  timestamp: number
): IntentId {
  return createIntentId(`intent-${intentType}-${createdBy}-${timestamp}`);
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidEvidenceReference(ref: EvidenceReference): boolean {
  if (!ref.evidenceId || typeof ref.evidenceId !== 'string') return false;
  if (!ref.evidenceType || !Object.values(EvidenceType).includes(ref.evidenceType)) return false;
  if (ref.description !== undefined && typeof ref.description !== 'string') return false;
  return true;
}

export function isValidIntentInput(input: ExecutionIntentInput): boolean {
  if (!input.intentType || !Object.values(IntentType).includes(input.intentType)) return false;
  if (!input.recommendation || typeof input.recommendation !== 'string' || input.recommendation.trim().length === 0) return false;
  if (!input.evidenceRefs || !Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) return false;
  if (!input.evidenceRefs.every(isValidEvidenceReference)) return false;
  if (!input.createdBy || typeof input.createdBy !== 'string') return false;
  if (!Number.isInteger(input.timestamp) || input.timestamp <= 0) return false;
  if (input.context !== undefined && typeof input.context !== 'string') return false;
  return true;
}
