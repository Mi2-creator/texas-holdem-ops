/**
 * RiskAckTypes.ts
 *
 * Types for OPS-4 Human Risk Acknowledgement & Sign-Off Layer.
 *
 * MANUAL-ONLY: Records human acknowledgement of risk signals.
 * REFERENCE-ONLY: All values are references, not money.
 * NO EXECUTION: Cannot block, execute, or trigger any action.
 * READ-ONLY: Produces frozen outputs, no mutations.
 * DETERMINISTIC: Same inputs produce same outputs.
 * INTEGER-ONLY: No floating point arithmetic.
 *
 * CRITICAL: This module CANNOT block, execute, auto-adjust, or mutate anything.
 * It ONLY records that a human has SEEN and ACKNOWLEDGED risk signals.
 */

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * Risk Acknowledgement ID - unique identifier for an acknowledgement record
 */
export type RiskAckId = string & { readonly __brand: 'RiskAckId' };

/**
 * Risk Signal ID - reference to a risk signal (from OPS-3)
 */
export type RiskSignalId = string & { readonly __brand: 'RiskSignalId' };

/**
 * Actor ID - identifies the human actor making acknowledgement
 */
export type ActorId = string & { readonly __brand: 'ActorId' };

/**
 * Ack Hash - hash value for chain integrity
 */
export type AckHash = string & { readonly __brand: 'AckHash' };

// ============================================================================
// ID FACTORIES
// ============================================================================

export function createRiskAckId(id: string): RiskAckId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('RiskAckId must be a non-empty string');
  }
  return id as RiskAckId;
}

export function createRiskSignalId(id: string): RiskSignalId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('RiskSignalId must be a non-empty string');
  }
  return id as RiskSignalId;
}

export function createActorId(id: string): ActorId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('ActorId must be a non-empty string');
  }
  return id as ActorId;
}

export function createAckHash(hash: string): AckHash {
  if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
    throw new Error('AckHash must be a non-empty string');
  }
  return hash as AckHash;
}

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Acknowledgement Decision
 *
 * NOTE: These are ACKNOWLEDGEMENT decisions only, NOT enforcement actions.
 * - ACKNOWLEDGED: Human has seen and acknowledged the risk signal
 * - REJECTED: Human has rejected the risk signal as invalid/false positive
 * - ESCALATED: Human has escalated the risk signal for further review
 */
export const AckDecision = {
  /** Human has seen and acknowledged the risk signal */
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  /** Human has rejected the signal as invalid/false positive */
  REJECTED: 'REJECTED',
  /** Human has escalated for further review */
  ESCALATED: 'ESCALATED',
} as const;

export type AckDecision = (typeof AckDecision)[keyof typeof AckDecision];

/**
 * Actor Role - role of the human making acknowledgement
 */
export const AckRole = {
  /** Operator - front-line staff */
  OPERATOR: 'OPERATOR',
  /** Supervisor - supervisory role */
  SUPERVISOR: 'SUPERVISOR',
  /** Admin - administrative role */
  ADMIN: 'ADMIN',
} as const;

export type AckRole = (typeof AckRole)[keyof typeof AckRole];

/**
 * Ack Error Codes
 */
export const AckErrorCode = {
  /** Invalid input data */
  INVALID_INPUT: 'INVALID_INPUT',
  /** Duplicate acknowledgement */
  DUPLICATE_ACK: 'DUPLICATE_ACK',
  /** Invalid decision for role */
  INVALID_DECISION_FOR_ROLE: 'INVALID_DECISION_FOR_ROLE',
  /** Self-acknowledgement violation */
  SELF_ACK_VIOLATION: 'SELF_ACK_VIOLATION',
  /** Conflicting decision (same actor cannot ACK and ESCALATE same signal) */
  CONFLICTING_DECISION: 'CONFLICTING_DECISION',
  /** Hash chain integrity violation */
  CHAIN_BROKEN: 'CHAIN_BROKEN',
  /** Hash mismatch */
  HASH_MISMATCH: 'HASH_MISMATCH',
  /** Forbidden concept detected */
  FORBIDDEN_CONCEPT: 'FORBIDDEN_CONCEPT',
  /** Action attempted (FORBIDDEN) */
  ACTION_FORBIDDEN: 'ACTION_FORBIDDEN',
} as const;

export type AckErrorCode = (typeof AckErrorCode)[keyof typeof AckErrorCode];

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Ack Error
 */
export interface AckError {
  readonly code: AckErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Ack Result
 */
export type AckResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: AckError };

// ============================================================================
// RESULT HELPERS
// ============================================================================

export function ackSuccess<T>(value: T): AckResult<T> {
  return { success: true, value };
}

export function ackFailure<T>(error: AckError): AckResult<T> {
  return { success: false, error };
}

export function createAckError(
  code: AckErrorCode,
  message: string,
  details?: Record<string, unknown>
): AckError {
  return Object.freeze({
    code,
    message,
    details: details ? Object.freeze({ ...details }) : undefined,
  });
}

// ============================================================================
// ACK RECORD INPUT
// ============================================================================

/**
 * Risk Acknowledgement Input - input for creating an acknowledgement
 */
export interface RiskAckInput {
  /** Reference to the risk signal being acknowledged */
  readonly riskSignalId: RiskSignalId;
  /** Actor making the acknowledgement */
  readonly actorId: ActorId;
  /** Role of the actor */
  readonly actorRole: AckRole;
  /** Decision made by the actor */
  readonly decision: AckDecision;
  /** Optional comment (non-executing, for human reference only) */
  readonly comment?: string;
  /** Explicit timestamp (must be injected, no internal clocks) */
  readonly timestamp: number;
}

/**
 * Risk Acknowledgement Record - immutable acknowledgement record
 */
export interface RiskAckRecord {
  /** Unique acknowledgement ID */
  readonly ackId: RiskAckId;
  /** Reference to the risk signal */
  readonly riskSignalId: RiskSignalId;
  /** Actor who made the acknowledgement */
  readonly actorId: ActorId;
  /** Role of the actor */
  readonly actorRole: AckRole;
  /** Decision made */
  readonly decision: AckDecision;
  /** Optional comment */
  readonly comment?: string;
  /** Sequence number in registry */
  readonly sequenceNumber: number;
  /** Hash of this record */
  readonly recordHash: AckHash;
  /** Hash of previous record */
  readonly previousHash: AckHash;
  /** Creation timestamp */
  readonly createdAt: number;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Genesis hash for the first entry in the ack chain
 */
export const ACK_GENESIS_HASH = createAckHash(
  '0000000000000000000000000000000000000000000000000000000000000000'
);

/**
 * Simple deterministic hash function for ack records
 *
 * INTEGER-ONLY: Uses only integer arithmetic
 * DETERMINISTIC: Same input produces same output
 */
export function computeAckHash(data: string): AckHash {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(16, '0');
  return createAckHash(hex.repeat(4)); // 64 char hash
}

/**
 * Compute record hash for chain integrity
 *
 * DETERMINISTIC: Same record produces same hash
 */
export function computeAckRecordHash(
  record: Omit<RiskAckRecord, 'recordHash'>
): AckHash {
  const data = JSON.stringify({
    ackId: record.ackId,
    riskSignalId: record.riskSignalId,
    actorId: record.actorId,
    actorRole: record.actorRole,
    decision: record.decision,
    comment: record.comment,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    createdAt: record.createdAt,
  });
  return computeAckHash(data);
}

/**
 * Compute ack ID deterministically
 */
export function computeAckId(
  riskSignalId: RiskSignalId,
  actorId: ActorId,
  timestamp: number
): RiskAckId {
  return createRiskAckId(`ack-${riskSignalId}-${actorId}-${timestamp}`);
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidAckInput(input: RiskAckInput): boolean {
  if (!input.riskSignalId || typeof input.riskSignalId !== 'string') return false;
  if (!input.actorId || typeof input.actorId !== 'string') return false;
  if (!input.actorRole || !Object.values(AckRole).includes(input.actorRole)) return false;
  if (!input.decision || !Object.values(AckDecision).includes(input.decision)) return false;
  if (input.comment !== undefined && typeof input.comment !== 'string') return false;
  if (!Number.isInteger(input.timestamp) || input.timestamp <= 0) return false;
  return true;
}

/**
 * Check if decision is terminal (no further action possible on this ack)
 */
export function isTerminalDecision(_decision: AckDecision): boolean {
  // All decisions are terminal - each acknowledgement is a single point-in-time record
  return true;
}

/**
 * Role hierarchy level (higher number = higher authority)
 */
export function getRoleLevel(role: AckRole): number {
  switch (role) {
    case AckRole.OPERATOR:
      return 1;
    case AckRole.SUPERVISOR:
      return 2;
    case AckRole.ADMIN:
      return 3;
    default:
      return 0;
  }
}

/**
 * Check if role can escalate
 *
 * Escalation can only go UP the hierarchy:
 * - OPERATOR can escalate to SUPERVISOR or ADMIN
 * - SUPERVISOR can escalate to ADMIN
 * - ADMIN cannot escalate (highest level)
 */
export function canRoleEscalate(role: AckRole): boolean {
  return role !== AckRole.ADMIN;
}
