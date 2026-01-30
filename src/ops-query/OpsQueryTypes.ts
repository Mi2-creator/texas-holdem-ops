/**
 * OpsQueryTypes.ts
 *
 * Public query contracts, scopes, and selectors for the OPS query layer.
 *
 * CRITICAL CONSTRAINTS:
 * - READ-ONLY: All types define query contracts, NOT mutations
 * - NO ANALYTICS: No new calculations, correlations, or metrics
 * - NO TRANSFORMS: No semantic transformations of underlying data
 * - PULL-BASED: All queries are synchronous, deterministic pulls
 * - FROZEN: All outputs are immutable
 *
 * WHAT THIS MODULE DEFINES:
 * - Query scope types (time bounds, entity bounds)
 * - Selector types (what data to retrieve)
 * - Result wrapper types (frozen outputs)
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot define mutation operations
 * - Cannot define new analytics or metrics
 * - Cannot define triggers, events, or callbacks
 * - Cannot define state machines or workflows
 */

// ============================================================================
// QUERY SCOPE TYPES
// ============================================================================

/**
 * Time-bounded query scope.
 * Defines a time window for filtering results.
 */
export interface TimeScope {
  /** Start timestamp (inclusive) */
  readonly startMs: number;
  /** End timestamp (inclusive) */
  readonly endMs: number;
}

/**
 * Period-bounded query scope.
 * Uses period identifiers (e.g., "2024-01") for filtering.
 */
export interface PeriodScope {
  /** Period identifier */
  readonly periodId: string;
}

/**
 * Entity-bounded query scope.
 * Filters by entity identifiers.
 */
export interface EntityScope {
  /** Entity type */
  readonly entityType: 'club' | 'agent' | 'player' | 'table' | 'actor' | 'context';
  /** Entity identifier */
  readonly entityId: string;
}

/**
 * Combined query scope.
 * All fields are optional - omit to skip that filter.
 */
export interface QueryScope {
  /** Time bounds (optional) */
  readonly time?: TimeScope;
  /** Period bounds (optional) */
  readonly period?: PeriodScope;
  /** Entity bounds (optional) */
  readonly entity?: EntityScope;
  /** Maximum results to return (optional) */
  readonly limit?: number;
}

// ============================================================================
// SELECTOR TYPES
// ============================================================================

/**
 * OPS module identifiers for query selection.
 */
export type OpsModule =
  | 'recharge'      // OPS-1
  | 'approval'      // OPS-2
  | 'risk'          // OPS-3
  | 'ack'           // OPS-4
  | 'intent'        // OPS-5
  | 'flow'          // OPS-6
  | 'attribution'   // OPS-7
  | 'behavior';     // OPS-8

/**
 * Query selector - specifies which module and view to query.
 */
export interface QuerySelector {
  /** Target OPS module */
  readonly module: OpsModule;
  /** View type within the module */
  readonly view: string;
  /** Query scope */
  readonly scope?: QueryScope;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Query result wrapper.
 * All results are frozen and include metadata.
 */
export interface QueryResult<T> {
  /** Whether the query succeeded */
  readonly ok: true;
  /** Query result data (frozen) */
  readonly data: T;
  /** Query metadata */
  readonly meta: QueryMetadata;
}

/**
 * Query error wrapper.
 */
export interface QueryError {
  /** Query failed */
  readonly ok: false;
  /** Error code */
  readonly code: QueryErrorCode;
  /** Error message */
  readonly message: string;
}

/**
 * Query response - success or error.
 */
export type QueryResponse<T> = QueryResult<T> | QueryError;

/**
 * Query metadata.
 */
export interface QueryMetadata {
  /** Timestamp when query was executed */
  readonly queriedAt: number;
  /** Module that was queried */
  readonly module: OpsModule;
  /** View that was queried */
  readonly view: string;
  /** Applied scope (if any) */
  readonly scope: QueryScope | null;
  /** Result count */
  readonly resultCount: number;
}

/**
 * Query error codes.
 */
export enum QueryErrorCode {
  /** Invalid module specified */
  INVALID_MODULE = 'INVALID_MODULE',
  /** Invalid view specified */
  INVALID_VIEW = 'INVALID_VIEW',
  /** Invalid scope parameters */
  INVALID_SCOPE = 'INVALID_SCOPE',
  /** No data available */
  NO_DATA = 'NO_DATA',
  /** Query timeout */
  TIMEOUT = 'TIMEOUT',
}

// ============================================================================
// RESULT HELPERS
// ============================================================================

/**
 * Create a successful query result.
 */
export function querySuccess<T>(
  data: T,
  meta: Omit<QueryMetadata, 'resultCount'>,
  resultCount: number
): QueryResult<T> {
  return Object.freeze({
    ok: true as const,
    data: Object.freeze(data) as T,
    meta: Object.freeze({
      ...meta,
      resultCount,
    }),
  });
}

/**
 * Create a query error.
 */
export function queryError(code: QueryErrorCode, message: string): QueryError {
  return Object.freeze({
    ok: false as const,
    code,
    message,
  });
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate time scope.
 */
export function isValidTimeScope(scope: TimeScope): boolean {
  return (
    typeof scope.startMs === 'number' &&
    typeof scope.endMs === 'number' &&
    scope.startMs >= 0 &&
    scope.endMs >= scope.startMs
  );
}

/**
 * Validate period scope.
 */
export function isValidPeriodScope(scope: PeriodScope): boolean {
  return typeof scope.periodId === 'string' && scope.periodId.length > 0;
}

/**
 * Validate entity scope.
 */
export function isValidEntityScope(scope: EntityScope): boolean {
  const validTypes = ['club', 'agent', 'player', 'table', 'actor', 'context'];
  return (
    validTypes.includes(scope.entityType) &&
    typeof scope.entityId === 'string' &&
    scope.entityId.length > 0
  );
}

/**
 * Validate query scope.
 */
export function isValidQueryScope(scope: QueryScope): boolean {
  if (scope.time && !isValidTimeScope(scope.time)) return false;
  if (scope.period && !isValidPeriodScope(scope.period)) return false;
  if (scope.entity && !isValidEntityScope(scope.entity)) return false;
  if (scope.limit !== undefined && (scope.limit < 0 || !Number.isInteger(scope.limit))) {
    return false;
  }
  return true;
}

/**
 * Validate OPS module identifier.
 */
export function isValidOpsModule(module: string): module is OpsModule {
  const validModules: OpsModule[] = [
    'recharge', 'approval', 'risk', 'ack',
    'intent', 'flow', 'attribution', 'behavior',
  ];
  return validModules.includes(module as OpsModule);
}

// ============================================================================
// SNAPSHOT TYPES
// ============================================================================

/**
 * Snapshot identifier.
 */
export type SnapshotId = string & { readonly __brand: 'SnapshotId' };

/**
 * Create snapshot ID.
 */
export function createSnapshotId(id: string): SnapshotId {
  return id as SnapshotId;
}

/**
 * Snapshot metadata.
 */
export interface SnapshotMetadata {
  /** Snapshot ID */
  readonly snapshotId: SnapshotId;
  /** When snapshot was created */
  readonly createdAt: number;
  /** Modules included in snapshot */
  readonly modules: readonly OpsModule[];
  /** Whether snapshot is complete */
  readonly isComplete: boolean;
}

/**
 * Snapshot state - read-only assembly of OPS data.
 */
export interface SnapshotState {
  /** Snapshot metadata */
  readonly metadata: SnapshotMetadata;
  /** Snapshot is frozen */
  readonly isFrozen: true;
}
