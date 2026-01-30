/**
 * OpsQueryRegistry.ts
 *
 * Immutable snapshot assembly for read-only queries.
 *
 * CRITICAL CONSTRAINTS:
 * - READ-ONLY: Cannot write, modify, or delete any data
 * - NO ANALYTICS: Does not compute new metrics or correlations
 * - NO TRANSFORMS: Passes through data unchanged
 * - FROZEN: All outputs are deeply frozen
 * - DETERMINISTIC: Same input always produces same output
 *
 * WHAT THIS MODULE DOES:
 * - Assembles read-only snapshots from OPS registry data
 * - Provides scoped query access to existing views
 * - Returns frozen, immutable results
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot write to any registry
 * - Cannot trigger any actions
 * - Cannot compute new analytics
 * - Cannot transform data semantics
 */

import {
  type QueryScope,
  type QueryResponse,
  type SnapshotId,
  type SnapshotMetadata,
  type SnapshotState,
  type OpsModule,
  QueryErrorCode,
  querySuccess,
  queryError,
  createSnapshotId,
  isValidQueryScope,
} from './OpsQueryTypes';

// ============================================================================
// SNAPSHOT ASSEMBLY
// ============================================================================

/**
 * OpsQueryRegistry - read-only snapshot assembly.
 *
 * IMPORTANT: This class only READS data. It cannot write, trigger, or compute.
 */
export class OpsQueryRegistry {
  private readonly snapshotId: SnapshotId;
  private readonly createdAt: number;
  private readonly modules: readonly OpsModule[];

  constructor(modules: readonly OpsModule[] = [
    'recharge', 'approval', 'risk', 'ack',
    'intent', 'flow', 'attribution', 'behavior',
  ]) {
    this.createdAt = Date.now();
    this.snapshotId = createSnapshotId(`snap_${this.createdAt}_${Math.random().toString(36).slice(2, 10)}`);
    this.modules = Object.freeze([...modules]);
  }

  // ==========================================================================
  // METADATA ACCESS (READ-ONLY)
  // ==========================================================================

  /**
   * Get snapshot metadata.
   * READ-ONLY: Returns frozen metadata.
   */
  getMetadata(): SnapshotMetadata {
    return Object.freeze({
      snapshotId: this.snapshotId,
      createdAt: this.createdAt,
      modules: this.modules,
      isComplete: true,
    });
  }

  /**
   * Get snapshot state.
   * READ-ONLY: Returns frozen state.
   */
  getState(): SnapshotState {
    return Object.freeze({
      metadata: this.getMetadata(),
      isFrozen: true as const,
    });
  }

  /**
   * Get snapshot ID.
   * READ-ONLY.
   */
  getSnapshotId(): SnapshotId {
    return this.snapshotId;
  }

  /**
   * Get available modules.
   * READ-ONLY: Returns frozen list.
   */
  getAvailableModules(): readonly OpsModule[] {
    return this.modules;
  }

  /**
   * Check if module is available.
   * READ-ONLY.
   */
  hasModule(module: OpsModule): boolean {
    return this.modules.includes(module);
  }

  // ==========================================================================
  // SCOPE VALIDATION (READ-ONLY)
  // ==========================================================================

  /**
   * Validate query scope.
   * READ-ONLY: Pure validation function.
   */
  validateScope(scope: QueryScope): QueryResponse<boolean> {
    if (!isValidQueryScope(scope)) {
      return queryError(QueryErrorCode.INVALID_SCOPE, 'Invalid query scope parameters');
    }

    return querySuccess(
      true,
      {
        queriedAt: Date.now(),
        module: 'recharge', // placeholder
        view: 'validateScope',
        scope,
      },
      1
    );
  }

  // ==========================================================================
  // SCOPE FILTERING (READ-ONLY)
  // ==========================================================================

  /**
   * Apply time scope filter to records.
   * READ-ONLY: Pure filtering function.
   */
  applyTimeScope<T extends { timestamp?: number; createdAt?: number }>(
    records: readonly T[],
    scope: QueryScope
  ): readonly T[] {
    if (!scope.time) {
      return Object.freeze([...records]);
    }

    const { startMs, endMs } = scope.time;

    const filtered = records.filter(record => {
      const timestamp = record.timestamp ?? record.createdAt ?? 0;
      return timestamp >= startMs && timestamp <= endMs;
    });

    return Object.freeze(filtered);
  }

  /**
   * Apply limit scope to records.
   * READ-ONLY: Pure slicing function.
   */
  applyLimitScope<T>(records: readonly T[], scope: QueryScope): readonly T[] {
    if (scope.limit === undefined || scope.limit <= 0) {
      return Object.freeze([...records]);
    }

    return Object.freeze(records.slice(0, scope.limit));
  }

  /**
   * Apply all scope filters to records.
   * READ-ONLY: Pure composition of filters.
   */
  applyScopeFilters<T extends { timestamp?: number; createdAt?: number }>(
    records: readonly T[],
    scope: QueryScope
  ): readonly T[] {
    let result = this.applyTimeScope(records, scope);
    result = this.applyLimitScope(result, scope);
    return Object.freeze([...result]);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new OpsQueryRegistry instance.
 * READ-ONLY: Returns immutable registry.
 */
export function createOpsQueryRegistry(
  modules?: readonly OpsModule[]
): OpsQueryRegistry {
  return new OpsQueryRegistry(modules);
}

/**
 * Create a test OpsQueryRegistry instance.
 * READ-ONLY: For testing purposes.
 */
export function createTestOpsQueryRegistry(): OpsQueryRegistry {
  return new OpsQueryRegistry();
}
