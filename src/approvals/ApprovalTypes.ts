/**
 * ApprovalTypes.ts
 *
 * Types for OPS-2 Manual Approval / Two-Man Rule.
 *
 * REFERENCE-ONLY: All values are references, not money.
 * DETERMINISTIC: Same inputs produce same outputs.
 * INTEGER-ONLY: No floating point arithmetic.
 * TWO-MAN RULE: No self-approval allowed.
 */

import { type ManualRechargeReferenceId } from '../recharge/ManualRechargeTypes';

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * Approval ID - unique identifier for an approval record
 */
export type ApprovalId = string & { readonly __brand: 'ApprovalId' };

/**
 * Actor ID - unique identifier for an actor (operator/admin)
 */
export type ActorId = string & { readonly __brand: 'ActorId' };

/**
 * Approval Hash - hash value for chain integrity
 */
export type ApprovalHash = string & { readonly __brand: 'ApprovalHash' };

// ============================================================================
// ID FACTORIES
// ============================================================================

export function createApprovalId(id: string): ApprovalId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('ApprovalId must be a non-empty string');
  }
  return id as ApprovalId;
}

export function createActorId(id: string): ActorId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('ActorId must be a non-empty string');
  }
  return id as ActorId;
}

export function createApprovalHash(hash: string): ApprovalHash {
  if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
    throw new Error('ApprovalHash must be a non-empty string');
  }
  return hash as ApprovalHash;
}

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Approval Status
 */
export const ApprovalStatus = {
  /** Pending approval from second actor */
  PENDING: 'PENDING',
  /** Confirmed by second actor */
  CONFIRMED: 'CONFIRMED',
  /** Rejected by second actor */
  REJECTED: 'REJECTED',
} as const;

export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

/**
 * Approval Decision - the action taken by the approving actor
 */
export const ApprovalDecision = {
  /** Approve/confirm the reference */
  CONFIRM: 'CONFIRM',
  /** Reject the reference */
  REJECT: 'REJECT',
} as const;

export type ApprovalDecision = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Approval Error Codes
 */
export const ApprovalErrorCode = {
  /** Invalid input data */
  INVALID_INPUT: 'INVALID_INPUT',
  /** Reference not found */
  REFERENCE_NOT_FOUND: 'REFERENCE_NOT_FOUND',
  /** Self-approval attempted (TWO-MAN RULE violation) */
  SELF_APPROVAL_FORBIDDEN: 'SELF_APPROVAL_FORBIDDEN',
  /** Duplicate approval attempted */
  DUPLICATE_APPROVAL: 'DUPLICATE_APPROVAL',
  /** Invalid status transition */
  INVALID_STATUS: 'INVALID_STATUS',
  /** Reference already in terminal state */
  ALREADY_TERMINAL: 'ALREADY_TERMINAL',
  /** Hash chain integrity violation */
  CHAIN_BROKEN: 'CHAIN_BROKEN',
  /** Hash mismatch */
  HASH_MISMATCH: 'HASH_MISMATCH',
  /** Forbidden concept detected */
  FORBIDDEN_CONCEPT: 'FORBIDDEN_CONCEPT',
} as const;

export type ApprovalErrorCode = (typeof ApprovalErrorCode)[keyof typeof ApprovalErrorCode];

/**
 * Approval Error
 */
export interface ApprovalError {
  readonly code: ApprovalErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Approval Result
 */
export type ApprovalResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: ApprovalError };

// ============================================================================
// RESULT HELPERS
// ============================================================================

export function approvalSuccess<T>(value: T): ApprovalResult<T> {
  return { success: true, value };
}

export function approvalFailure<T>(error: ApprovalError): ApprovalResult<T> {
  return { success: false, error };
}

export function createApprovalError(
  code: ApprovalErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApprovalError {
  return Object.freeze({
    code,
    message,
    details: details ? Object.freeze({ ...details }) : undefined,
  });
}

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Approval Request Input
 */
export interface ApprovalRequestInput {
  /** The recharge reference ID to approve */
  readonly rechargeReferenceId: ManualRechargeReferenceId;
  /** The actor who created the original recharge (for two-man rule check) */
  readonly creatorActorId: ActorId;
  /** Timestamp when approval was requested */
  readonly requestedAt: number;
  /** Notes */
  readonly notes?: string;
}

/**
 * Approval Decision Input
 */
export interface ApprovalDecisionInput {
  /** The approval ID to decide on */
  readonly approvalId: ApprovalId;
  /** The actor making the decision (must be different from creator) */
  readonly decisionActorId: ActorId;
  /** The decision */
  readonly decision: ApprovalDecision;
  /** Timestamp of decision */
  readonly decidedAt: number;
  /** Reason (required for rejection) */
  readonly reason?: string;
}

/**
 * Approval Request Record - immutable record of an approval request
 */
export interface ApprovalRequestRecord {
  /** Unique approval ID */
  readonly approvalId: ApprovalId;
  /** The recharge reference being approved */
  readonly rechargeReferenceId: ManualRechargeReferenceId;
  /** Actor who created the original recharge */
  readonly creatorActorId: ActorId;
  /** Current approval status */
  readonly status: ApprovalStatus;
  /** When approval was requested */
  readonly requestedAt: number;
  /** Notes */
  readonly notes?: string;
  /** Sequence number in the registry */
  readonly sequenceNumber: number;
  /** Hash of this record */
  readonly recordHash: ApprovalHash;
  /** Hash of previous record (for chain integrity) */
  readonly previousHash: ApprovalHash;
  /** Decision details (if decided) */
  readonly decision?: ApprovalDecisionDetails;
}

/**
 * Approval Decision Details
 */
export interface ApprovalDecisionDetails {
  /** Actor who made the decision */
  readonly decisionActorId: ActorId;
  /** The decision made */
  readonly decision: ApprovalDecision;
  /** When decision was made */
  readonly decidedAt: number;
  /** Reason (especially for rejection) */
  readonly reason?: string;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Genesis hash for the first entry in the approval chain
 */
export const APPROVAL_GENESIS_HASH = createApprovalHash(
  '0000000000000000000000000000000000000000000000000000000000000000'
);

/**
 * Simple deterministic hash function for approvals
 */
export function computeApprovalHash(data: string): ApprovalHash {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(16, '0');
  return createApprovalHash(hex.repeat(4)); // 64 char hash
}

/**
 * Compute record hash for chain integrity
 */
export function computeApprovalRecordHash(
  record: Omit<ApprovalRequestRecord, 'recordHash'>
): ApprovalHash {
  const data = JSON.stringify({
    approvalId: record.approvalId,
    rechargeReferenceId: record.rechargeReferenceId,
    creatorActorId: record.creatorActorId,
    status: record.status,
    requestedAt: record.requestedAt,
    notes: record.notes,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    decision: record.decision,
  });
  return computeApprovalHash(data);
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidApprovalRequestInput(input: ApprovalRequestInput): boolean {
  if (!input.rechargeReferenceId || typeof input.rechargeReferenceId !== 'string') return false;
  if (!input.creatorActorId || typeof input.creatorActorId !== 'string') return false;
  if (!Number.isInteger(input.requestedAt) || input.requestedAt <= 0) return false;
  return true;
}

export function isValidApprovalDecisionInput(input: ApprovalDecisionInput): boolean {
  if (!input.approvalId || typeof input.approvalId !== 'string') return false;
  if (!input.decisionActorId || typeof input.decisionActorId !== 'string') return false;
  if (!input.decision || !Object.values(ApprovalDecision).includes(input.decision)) return false;
  if (!Number.isInteger(input.decidedAt) || input.decidedAt <= 0) return false;
  // Reason is required for rejection
  if (input.decision === ApprovalDecision.REJECT) {
    if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length === 0) {
      return false;
    }
  }
  return true;
}

/**
 * Check if approval status is terminal (no more changes allowed)
 */
export function isTerminalStatus(status: ApprovalStatus): boolean {
  return status === ApprovalStatus.CONFIRMED || status === ApprovalStatus.REJECTED;
}
