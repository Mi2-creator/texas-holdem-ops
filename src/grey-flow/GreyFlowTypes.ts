/**
 * GreyFlowTypes.ts
 *
 * Types for OPS-6: Grey Flow & Rake Analytics.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PASSIVE DATA LAYER: Stores data, does NOT execute anything
 * - PULL-BASED: External systems query this data, we never push
 * - REFERENCE-ONLY: Flow records are references, not monetary values
 * - RATIO-ONLY: Rake is a ratio/index, NOT a deduction or settlement
 * - APPEND-ONLY: Records are never modified or deleted
 * - NO STATE MACHINES: No status transitions, no lifecycles
 *
 * SEMANTIC BOUNDARIES:
 * - "Flow" is count and ratio, NOT money amount
 * - "Rake" is ratio/share/index, NOT deduction or settlement
 * - All outputs are analysis results, no side effects
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot process money, balances, or settlements
 * - Cannot execute, trigger, dispatch, or cause any action
 * - Cannot push notifications or emit events
 */

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * Grey Flow ID - unique identifier for a grey flow record
 */
export type GreyFlowRecordId = string & { readonly __brand: 'GreyFlowRecordId' };

/**
 * Flow Hash - hash value for chain integrity
 */
export type FlowHash = string & { readonly __brand: 'FlowHash' };

/**
 * Entity ID - identifies an entity (agent, table, club)
 */
export type EntityId = string & { readonly __brand: 'EntityId' };

/**
 * Session ID - identifies a session
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Hand ID - identifies a hand
 */
export type HandId = string & { readonly __brand: 'HandId' };

/**
 * Operator ID - identifies the operator who created the record
 */
export type FlowOperatorId = string & { readonly __brand: 'FlowOperatorId' };

// ============================================================================
// ID FACTORIES
// ============================================================================

export function createGreyFlowRecordId(id: string): GreyFlowRecordId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('GreyFlowRecordId must be a non-empty string');
  }
  return id as GreyFlowRecordId;
}

export function createFlowHash(hash: string): FlowHash {
  if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
    throw new Error('FlowHash must be a non-empty string');
  }
  return hash as FlowHash;
}

export function createEntityId(id: string): EntityId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('EntityId must be a non-empty string');
  }
  return id as EntityId;
}

export function createSessionId(id: string): SessionId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('SessionId must be a non-empty string');
  }
  return id as SessionId;
}

export function createHandId(id: string): HandId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('HandId must be a non-empty string');
  }
  return id as HandId;
}

export function createFlowOperatorId(id: string): FlowOperatorId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('FlowOperatorId must be a non-empty string');
  }
  return id as FlowOperatorId;
}

// ============================================================================
// ENUMS (CLASSIFICATION ONLY - NO STATUS/LIFECYCLE)
// ============================================================================

/**
 * Flow Direction - classification of flow direction
 *
 * These are categories, NOT status transitions.
 */
export const FlowDirection = {
  /** Inbound flow (into entity) */
  INBOUND: 'INBOUND',
  /** Outbound flow (out of entity) */
  OUTBOUND: 'OUTBOUND',
  /** Internal flow (within entity) */
  INTERNAL: 'INTERNAL',
} as const;

export type FlowDirection = (typeof FlowDirection)[keyof typeof FlowDirection];

/**
 * Flow Source - classification of flow source
 *
 * These are categories, NOT status transitions.
 */
export const FlowSource = {
  /** Flow from table activity */
  TABLE: 'TABLE',
  /** Flow from agent activity */
  AGENT: 'AGENT',
  /** Flow from club activity */
  CLUB: 'CLUB',
  /** Flow from player activity */
  PLAYER: 'PLAYER',
  /** Flow from external source */
  EXTERNAL: 'EXTERNAL',
} as const;

export type FlowSource = (typeof FlowSource)[keyof typeof FlowSource];

/**
 * Entity Type - classification of entity
 */
export const EntityType = {
  /** Agent entity */
  AGENT: 'AGENT',
  /** Table entity */
  TABLE: 'TABLE',
  /** Club entity */
  CLUB: 'CLUB',
  /** Player entity */
  PLAYER: 'PLAYER',
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

/**
 * Flow Error Codes
 */
export const FlowErrorCode = {
  /** Invalid input data */
  INVALID_INPUT: 'INVALID_INPUT',
  /** Duplicate flow record */
  DUPLICATE_FLOW: 'DUPLICATE_FLOW',
  /** Hash chain integrity violation */
  CHAIN_BROKEN: 'CHAIN_BROKEN',
  /** Hash mismatch */
  HASH_MISMATCH: 'HASH_MISMATCH',
  /** Forbidden concept detected */
  FORBIDDEN_CONCEPT: 'FORBIDDEN_CONCEPT',
  /** Invalid reference */
  INVALID_REFERENCE: 'INVALID_REFERENCE',
} as const;

export type FlowErrorCode = (typeof FlowErrorCode)[keyof typeof FlowErrorCode];

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Flow Error
 */
export interface FlowError {
  readonly code: FlowErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Flow Result
 */
export type FlowResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: FlowError };

// ============================================================================
// RESULT HELPERS
// ============================================================================

export function flowSuccess<T>(value: T): FlowResult<T> {
  return { success: true, value };
}

export function flowFailure<T>(error: FlowError): FlowResult<T> {
  return { success: false, error };
}

export function createFlowError(
  code: FlowErrorCode,
  message: string,
  details?: Record<string, unknown>
): FlowError {
  return Object.freeze({
    code,
    message,
    details: details ? Object.freeze({ ...details }) : undefined,
  });
}

// ============================================================================
// FLOW INPUT (FOR CREATING RECORDS)
// ============================================================================

/**
 * Grey Flow Input - input for creating a flow record
 *
 * NOTE: A flow record is a REFERENCE only. It does NOT represent money.
 * The "count" field is a unit count (e.g., number of chips, hands, actions),
 * NOT a monetary amount.
 */
export interface GreyFlowInput {
  /** Flow direction */
  readonly direction: FlowDirection;
  /** Flow source */
  readonly source: FlowSource;
  /** Source entity ID */
  readonly sourceEntityId: EntityId;
  /** Source entity type */
  readonly sourceEntityType: EntityType;
  /** Target entity ID (optional for some flows) */
  readonly targetEntityId?: EntityId;
  /** Target entity type (optional for some flows) */
  readonly targetEntityType?: EntityType;
  /** Unit count (NOT money - just a count) */
  readonly unitCount: number;
  /** Operator who created this record */
  readonly createdBy: FlowOperatorId;
  /** Explicit timestamp (must be injected, no internal clocks) */
  readonly timestamp: number;
  /** Optional description */
  readonly description?: string;
}

// ============================================================================
// FLOW RECORD (IMMUTABLE)
// ============================================================================

/**
 * Grey Flow Record - immutable flow record
 *
 * CRITICAL: This is a DATA RECORD only. It does not:
 * - Represent money or monetary value
 * - Execute anything
 * - Trigger any action
 * - Push any notification
 *
 * It is a passive, queryable reference stored for analysis.
 */
export interface GreyFlowRecord {
  /** Unique flow record ID */
  readonly flowId: GreyFlowRecordId;
  /** Flow direction */
  readonly direction: FlowDirection;
  /** Flow source */
  readonly source: FlowSource;
  /** Source entity ID */
  readonly sourceEntityId: EntityId;
  /** Source entity type */
  readonly sourceEntityType: EntityType;
  /** Target entity ID (optional) */
  readonly targetEntityId?: EntityId;
  /** Target entity type (optional) */
  readonly targetEntityType?: EntityType;
  /** Unit count (NOT money) */
  readonly unitCount: number;
  /** Operator who created this record */
  readonly createdBy: FlowOperatorId;
  /** Sequence number in registry */
  readonly sequenceNumber: number;
  /** Hash of this record */
  readonly recordHash: FlowHash;
  /** Hash of previous record */
  readonly previousHash: FlowHash;
  /** Creation timestamp */
  readonly createdAt: number;
  /** Optional description */
  readonly description?: string;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Genesis hash for the first entry in the flow chain
 */
export const FLOW_GENESIS_HASH = createFlowHash(
  '0000000000000000000000000000000000000000000000000000000000000000'
);

/**
 * Simple deterministic hash function for flow records
 *
 * INTEGER-ONLY: Uses only integer arithmetic
 * DETERMINISTIC: Same input produces same output
 */
export function computeFlowHash(data: string): FlowHash {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(16, '0');
  return createFlowHash(hex.repeat(4)); // 64 char hash
}

/**
 * Compute record hash for chain integrity
 *
 * DETERMINISTIC: Same record produces same hash
 */
export function computeFlowRecordHash(
  record: Omit<GreyFlowRecord, 'recordHash'>
): FlowHash {
  const data = JSON.stringify({
    flowId: record.flowId,
    direction: record.direction,
    source: record.source,
    sourceEntityId: record.sourceEntityId,
    sourceEntityType: record.sourceEntityType,
    targetEntityId: record.targetEntityId,
    targetEntityType: record.targetEntityType,
    unitCount: record.unitCount,
    createdBy: record.createdBy,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    createdAt: record.createdAt,
    description: record.description,
  });
  return computeFlowHash(data);
}

/**
 * Compute flow ID deterministically
 */
export function computeFlowId(
  source: FlowSource,
  sourceEntityId: EntityId,
  createdBy: FlowOperatorId,
  timestamp: number
): GreyFlowRecordId {
  return createGreyFlowRecordId(`flow-${source}-${sourceEntityId}-${createdBy}-${timestamp}`);
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidFlowInput(input: GreyFlowInput): boolean {
  if (!input.direction || !Object.values(FlowDirection).includes(input.direction)) return false;
  if (!input.source || !Object.values(FlowSource).includes(input.source)) return false;
  if (!input.sourceEntityId || typeof input.sourceEntityId !== 'string') return false;
  if (!input.sourceEntityType || !Object.values(EntityType).includes(input.sourceEntityType)) return false;
  if (input.targetEntityId !== undefined && typeof input.targetEntityId !== 'string') return false;
  if (input.targetEntityType !== undefined && !Object.values(EntityType).includes(input.targetEntityType)) return false;
  if (!Number.isInteger(input.unitCount) || input.unitCount < 0) return false;
  if (!input.createdBy || typeof input.createdBy !== 'string') return false;
  if (!Number.isInteger(input.timestamp) || input.timestamp <= 0) return false;
  if (input.description !== undefined && typeof input.description !== 'string') return false;
  return true;
}
