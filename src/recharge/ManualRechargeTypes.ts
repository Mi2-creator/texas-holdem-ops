/**
 * ManualRechargeTypes.ts
 *
 * Types for manual recharge reference declarations.
 *
 * REFERENCE-ONLY: All values are references, not money.
 * DETERMINISTIC: Same inputs produce same outputs.
 * INTEGER-ONLY: No floating point arithmetic.
 */

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * Manual Recharge Reference ID
 */
export type ManualRechargeReferenceId = string & { readonly __brand: 'ManualRechargeReferenceId' };

/**
 * Registry Entry ID
 */
export type RegistryEntryId = string & { readonly __brand: 'RegistryEntryId' };

/**
 * Hash value for chain integrity
 */
export type HashValue = string & { readonly __brand: 'HashValue' };

// ============================================================================
// ID FACTORIES
// ============================================================================

export function createManualRechargeReferenceId(id: string): ManualRechargeReferenceId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('ManualRechargeReferenceId must be a non-empty string');
  }
  return id as ManualRechargeReferenceId;
}

export function createRegistryEntryId(id: string): RegistryEntryId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('RegistryEntryId must be a non-empty string');
  }
  return id as RegistryEntryId;
}

export function createHashValue(hash: string): HashValue {
  if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
    throw new Error('HashValue must be a non-empty string');
  }
  return hash as HashValue;
}

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Recharge Source Type
 */
export const RechargeSource = {
  /** Manual admin input */
  MANUAL: 'MANUAL',
  /** External system input */
  EXTERNAL: 'EXTERNAL',
  /** Future/placeholder */
  FUTURE: 'FUTURE',
} as const;

export type RechargeSource = (typeof RechargeSource)[keyof typeof RechargeSource];

/**
 * Declaration Status
 */
export const DeclarationStatus = {
  /** Declared but not yet linked */
  DECLARED: 'DECLARED',
  /** Linked to Grey flow */
  LINKED: 'LINKED',
  /** Confirmed by operator */
  CONFIRMED: 'CONFIRMED',
  /** Rejected */
  REJECTED: 'REJECTED',
} as const;

export type DeclarationStatus = (typeof DeclarationStatus)[keyof typeof DeclarationStatus];

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Manual Recharge Declaration
 *
 * This is a REFERENCE declaration, not a money transfer.
 * The declaredAmount is an integer reference quantity, not currency.
 */
export interface ManualRechargeDeclaration {
  /** External reference ID (opaque string from source system) */
  readonly externalReferenceId: string;
  /** Source of the declaration */
  readonly source: RechargeSource;
  /** Declared amount (integer, unitless reference) */
  readonly declaredAmount: number;
  /** Timestamp when declared (must be injected) */
  readonly declaredAt: number;
  /** Admin/operator who declared this */
  readonly declaredBy: string;
  /** Target club ID (reference) */
  readonly clubId: string;
  /** Target player ID (reference) */
  readonly playerId: string;
  /** Optional notes */
  readonly notes?: string;
}

/**
 * Registry Entry - stored declaration with metadata
 */
export interface ManualRechargeRegistryEntry {
  /** Unique entry ID */
  readonly entryId: RegistryEntryId;
  /** Reference ID for this recharge */
  readonly referenceId: ManualRechargeReferenceId;
  /** Current status */
  readonly status: DeclarationStatus;
  /** The declaration data */
  readonly declaration: ManualRechargeDeclaration;
  /** Hash of this entry (for chain integrity) */
  readonly entryHash: HashValue;
  /** Hash of previous entry (for chain integrity) */
  readonly previousHash: HashValue;
  /** Sequence number in registry */
  readonly sequenceNumber: number;
  /** Timestamp when entry was created */
  readonly createdAt: number;
  /** Linked Grey Flow IDs (if any) */
  readonly linkedGreyFlowIds: readonly string[];
  /** Confirmation details (if confirmed) */
  readonly confirmation?: ConfirmationInfo;
}

/**
 * Confirmation Info
 */
export interface ConfirmationInfo {
  /** Operator who confirmed */
  readonly confirmedBy: string;
  /** Timestamp of confirmation */
  readonly confirmedAt: number;
  /** Optional notes */
  readonly notes?: string;
}

/**
 * Declaration Input - input for creating a new declaration
 */
export interface ManualRechargeDeclarationInput {
  /** External reference ID */
  readonly externalReferenceId: string;
  /** Source type */
  readonly source: RechargeSource;
  /** Declared amount (integer) */
  readonly declaredAmount: number;
  /** Timestamp (must be provided) */
  readonly timestamp: number;
  /** Declaring admin */
  readonly declaredBy: string;
  /** Club ID */
  readonly clubId: string;
  /** Player ID */
  readonly playerId: string;
  /** Optional notes */
  readonly notes?: string;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Recharge Error Codes
 */
export const RechargeErrorCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  DUPLICATE_REFERENCE: 'DUPLICATE_REFERENCE',
  ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
  INVALID_STATUS: 'INVALID_STATUS',
  HASH_MISMATCH: 'HASH_MISMATCH',
  CHAIN_BROKEN: 'CHAIN_BROKEN',
  FORBIDDEN_CONCEPT: 'FORBIDDEN_CONCEPT',
} as const;

export type RechargeErrorCode = (typeof RechargeErrorCode)[keyof typeof RechargeErrorCode];

/**
 * Recharge Error
 */
export interface RechargeError {
  readonly code: RechargeErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Recharge Result
 */
export type RechargeResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: RechargeError };

// ============================================================================
// RESULT HELPERS
// ============================================================================

export function rechargeSuccess<T>(value: T): RechargeResult<T> {
  return { success: true, value };
}

export function rechargeFailure<T>(error: RechargeError): RechargeResult<T> {
  return { success: false, error };
}

export function createRechargeError(
  code: RechargeErrorCode,
  message: string,
  details?: Record<string, unknown>
): RechargeError {
  return Object.freeze({
    code,
    message,
    details: details ? Object.freeze({ ...details }) : undefined,
  });
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidDeclarationInput(input: ManualRechargeDeclarationInput): boolean {
  if (!input.externalReferenceId || typeof input.externalReferenceId !== 'string') return false;
  if (!input.source || !Object.values(RechargeSource).includes(input.source)) return false;
  if (!Number.isInteger(input.declaredAmount) || input.declaredAmount <= 0) return false;
  if (!Number.isInteger(input.timestamp) || input.timestamp <= 0) return false;
  if (!input.declaredBy || typeof input.declaredBy !== 'string') return false;
  if (!input.clubId || typeof input.clubId !== 'string') return false;
  if (!input.playerId || typeof input.playerId !== 'string') return false;
  return true;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Genesis hash for the first entry in the chain
 */
export const GENESIS_HASH = createHashValue('0000000000000000000000000000000000000000000000000000000000000000');

/**
 * Simple deterministic hash function
 */
export function computeHash(data: string): HashValue {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(16, '0');
  return createHashValue(hex.repeat(4)); // 64 char hash
}

/**
 * Compute entry hash for chain integrity
 */
export function computeEntryHash(
  entry: Omit<ManualRechargeRegistryEntry, 'entryHash'>
): HashValue {
  const data = JSON.stringify({
    entryId: entry.entryId,
    referenceId: entry.referenceId,
    status: entry.status,
    declaration: entry.declaration,
    previousHash: entry.previousHash,
    sequenceNumber: entry.sequenceNumber,
    createdAt: entry.createdAt,
  });
  return computeHash(data);
}
