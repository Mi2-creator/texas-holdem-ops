/**
 * OpsTypes.ts
 *
 * Core types for texas-holdem-ops
 *
 * EXTERNAL BOUNDARY: This module operates OUTSIDE the engine.
 * READ-ONLY: This module NEVER modifies engine state.
 * REFERENCE-ONLY: All values are references, not money.
 * DETERMINISTIC: Same inputs produce same outputs.
 *
 * FORBIDDEN CONCEPTS:
 * - balance, wallet, payment, crypto, transfer
 * - No value computation
 * - No money handling
 */

// ============================================================================
// OPS VERSION
// ============================================================================

export const OPS_VERSION = '0.1.0' as const;
export const OPS_PHASE = 'OPS-0' as const;

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * External Reference ID - unique identifier from external system
 * Used for idempotency enforcement
 */
export type ExternalReferenceId = string & { readonly __brand: 'ExternalReferenceId' };

/**
 * Ops Session ID - unique identifier for an ops session
 */
export type OpsSessionId = string & { readonly __brand: 'OpsSessionId' };

/**
 * Recharge Reference ID - reference to a recharge operation
 * This is NOT a transaction ID, just a reference for tracking
 */
export type RechargeReferenceId = string & { readonly __brand: 'RechargeReferenceId' };

/**
 * Confirmation ID - unique identifier for a human confirmation
 */
export type ConfirmationId = string & { readonly __brand: 'ConfirmationId' };

// ============================================================================
// ID FACTORIES
// ============================================================================

export function createExternalReferenceId(id: string): ExternalReferenceId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('ExternalReferenceId must be a non-empty string');
  }
  return id as ExternalReferenceId;
}

export function createOpsSessionId(id: string): OpsSessionId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('OpsSessionId must be a non-empty string');
  }
  return id as OpsSessionId;
}

export function createRechargeReferenceId(id: string): RechargeReferenceId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('RechargeReferenceId must be a non-empty string');
  }
  return id as RechargeReferenceId;
}

export function createConfirmationId(id: string): ConfirmationId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('ConfirmationId must be a non-empty string');
  }
  return id as ConfirmationId;
}

// ============================================================================
// STATUS ENUMS
// ============================================================================

/**
 * Reference Status - tracks the lifecycle of a reference
 */
export const ReferenceStatus = {
  /** Reference has been declared but not confirmed */
  DECLARED: 'DECLARED',
  /** Reference is pending human confirmation */
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  /** Reference has been confirmed by human operator */
  CONFIRMED: 'CONFIRMED',
  /** Reference has been rejected */
  REJECTED: 'REJECTED',
  /** Reference has been pushed to Grey system */
  PUSHED: 'PUSHED',
} as const;

export type ReferenceStatus = (typeof ReferenceStatus)[keyof typeof ReferenceStatus];

/**
 * Adapter Type - identifies the source adapter
 */
export const AdapterType = {
  /** Manual admin input */
  MANUAL_ADMIN: 'MANUAL_ADMIN',
  /** Future USDT adapter (placeholder) */
  FUTURE_USDT: 'FUTURE_USDT',
} as const;

export type AdapterType = (typeof AdapterType)[keyof typeof AdapterType];

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Recharge Reference Input - data from external adapter
 *
 * This is a REFERENCE only. It does NOT represent money or value.
 * The integer amount is a reference quantity for tracking purposes.
 */
export interface RechargeReferenceInput {
  /** External reference ID for idempotency */
  readonly externalReferenceId: ExternalReferenceId;
  /** Source adapter type */
  readonly adapterType: AdapterType;
  /** Target club ID (reference only) */
  readonly clubId: string;
  /** Target player ID (reference only) */
  readonly playerId: string;
  /** Reference amount (integer, NOT money) */
  readonly referenceAmount: number;
  /** Timestamp when reference was created (must be injected, not from clock) */
  readonly declaredAt: number;
  /** Optional metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Recharge Reference Record - stored reference with status
 */
export interface RechargeReferenceRecord {
  /** Unique reference ID */
  readonly referenceId: RechargeReferenceId;
  /** Current status */
  readonly status: ReferenceStatus;
  /** Input data */
  readonly input: RechargeReferenceInput;
  /** Confirmation details (if confirmed) */
  readonly confirmation?: ConfirmationDetails;
  /** Push details (if pushed) */
  readonly pushDetails?: PushDetails;
  /** Record creation timestamp */
  readonly createdAt: number;
  /** Last update timestamp */
  readonly updatedAt: number;
}

/**
 * Confirmation Details - human confirmation data
 */
export interface ConfirmationDetails {
  /** Confirmation ID */
  readonly confirmationId: ConfirmationId;
  /** Operator who confirmed */
  readonly operatorId: string;
  /** Confirmation timestamp */
  readonly confirmedAt: number;
  /** Optional confirmation notes */
  readonly notes?: string;
}

/**
 * Push Details - details about pushing to Grey system
 */
export interface PushDetails {
  /** Session ID for the push operation */
  readonly sessionId: OpsSessionId;
  /** Timestamp when pushed */
  readonly pushedAt: number;
  /** Grey Recharge ID (returned from Grey system) */
  readonly greyRechargeId?: string;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Ops Error Codes
 */
export const OpsErrorCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  DUPLICATE_REFERENCE: 'DUPLICATE_REFERENCE',
  REFERENCE_NOT_FOUND: 'REFERENCE_NOT_FOUND',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  PUSH_FAILED: 'PUSH_FAILED',
  FORBIDDEN_CONCEPT: 'FORBIDDEN_CONCEPT',
  BOUNDARY_VIOLATION: 'BOUNDARY_VIOLATION',
} as const;

export type OpsErrorCode = (typeof OpsErrorCode)[keyof typeof OpsErrorCode];

/**
 * Ops Error
 */
export interface OpsError {
  readonly code: OpsErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Ops Result - success or failure
 */
export type OpsResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: OpsError };

// ============================================================================
// RESULT HELPERS
// ============================================================================

export function opsSuccess<T>(value: T): OpsResult<T> {
  return { success: true, value };
}

export function opsFailure<T>(error: OpsError): OpsResult<T> {
  return { success: false, error };
}

export function createOpsError(
  code: OpsErrorCode,
  message: string,
  details?: Record<string, unknown>
): OpsError {
  return Object.freeze({
    code,
    message,
    details: details ? Object.freeze({ ...details }) : undefined,
  });
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function isValidInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function isValidPositiveInteger(value: unknown): value is number {
  return isValidInteger(value) && value > 0;
}

export function isValidNonNegativeInteger(value: unknown): value is number {
  return isValidInteger(value) && value >= 0;
}

export function isValidTimestamp(value: unknown): value is number {
  return isValidPositiveInteger(value) && value > 1000000000000; // After year 2001
}

export function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// ============================================================================
// OPS MODULE INFO
// ============================================================================

export const OPS_MODULE_INFO = Object.freeze({
  name: 'texas-holdem-ops',
  version: OPS_VERSION,
  phase: OPS_PHASE,
  description: 'External operations boundary for recharge reference handling',

  guarantees: Object.freeze([
    'READ-ONLY: Never modifies engine state',
    'REFERENCE-ONLY: All values are references, not money',
    'DETERMINISTIC: Same inputs produce same outputs',
    'INTEGER-ONLY: No floating point arithmetic',
    'APPEND-ONLY: Records are never deleted',
    'IDEMPOTENT: Duplicate references are rejected',
    'MANUAL-ONLY: Human confirmation required',
  ]),

  restrictions: Object.freeze([
    'No balance tracking',
    'No wallet management',
    'No payment processing',
    'No crypto operations',
    'No fund transfers',
    'No value computation',
    'No engine imports',
    'No system clock access',
    'No async side effects',
    'No automation',
  ]),
}) as {
  readonly name: string;
  readonly version: string;
  readonly phase: string;
  readonly description: string;
  readonly guarantees: readonly string[];
  readonly restrictions: readonly string[];
};
