/**
 * ManualAdminAdapter.ts
 *
 * Manual Admin Adapter for texas-holdem-ops
 *
 * This adapter handles manual recharge reference input from admin operators.
 * It is a STUB in OPS-0 - no real operations, only type definitions.
 *
 * REFERENCE-ONLY: All values are references, not money.
 * MANUAL-ONLY: Human confirmation required for all operations.
 */

import {
  type RechargeReferenceInput,
  type OpsResult,
  AdapterType,
  createExternalReferenceId,
  opsSuccess,
  opsFailure,
  createOpsError,
  OpsErrorCode,
  isValidPositiveInteger,
  isValidString,
  isValidTimestamp,
} from '../../ops-config';

// ============================================================================
// ADAPTER TYPES
// ============================================================================

/**
 * Manual Admin Input - raw input from admin operator
 */
export interface ManualAdminInput {
  /** Club ID (reference) */
  readonly clubId: string;
  /** Player ID (reference) */
  readonly playerId: string;
  /** Reference amount (integer, NOT money) */
  readonly referenceAmount: number;
  /** Operator ID who created this input */
  readonly operatorId: string;
  /** Timestamp (must be provided, not from clock) */
  readonly timestamp: number;
  /** Optional notes */
  readonly notes?: string;
}

/**
 * Manual Admin Adapter Configuration
 */
export interface ManualAdminAdapterConfig {
  /** Adapter name */
  readonly name: string;
  /** Enabled flag */
  readonly enabled: boolean;
  /** Required operator role */
  readonly requiredRole: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_MANUAL_ADMIN_CONFIG: ManualAdminAdapterConfig = Object.freeze({
  name: 'manual-admin',
  enabled: true,
  requiredRole: 'ADMIN',
});

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * Adapter Interface - all adapters must implement this
 */
export interface RechargeAdapter {
  /** Adapter type */
  readonly adapterType: AdapterType;
  /** Adapter name */
  readonly name: string;
  /** Check if adapter is enabled */
  isEnabled(): boolean;
}

// ============================================================================
// MANUAL ADMIN ADAPTER
// ============================================================================

/**
 * Manual Admin Adapter
 *
 * STUB: In OPS-0, this only provides type validation and reference creation.
 * No actual recharge operations are performed.
 */
export class ManualAdminAdapterStub implements RechargeAdapter {
  readonly adapterType = AdapterType.MANUAL_ADMIN;
  readonly name: string;
  private readonly config: ManualAdminAdapterConfig;
  private referenceCounter: number = 0;

  constructor(config: ManualAdminAdapterConfig = DEFAULT_MANUAL_ADMIN_CONFIG) {
    this.config = config;
    this.name = config.name;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Validate manual admin input.
   */
  validateInput(input: ManualAdminInput): OpsResult<ManualAdminInput> {
    if (!isValidString(input.clubId)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'clubId must be a non-empty string')
      );
    }

    if (!isValidString(input.playerId)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'playerId must be a non-empty string')
      );
    }

    if (!isValidPositiveInteger(input.referenceAmount)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'referenceAmount must be a positive integer')
      );
    }

    if (!isValidString(input.operatorId)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'operatorId must be a non-empty string')
      );
    }

    if (!isValidTimestamp(input.timestamp)) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'timestamp must be a valid timestamp')
      );
    }

    return opsSuccess(input);
  }

  /**
   * Create a recharge reference input from manual admin input.
   *
   * STUB: This only creates the reference structure.
   * No actual recharge is performed.
   */
  createReferenceInput(input: ManualAdminInput): OpsResult<RechargeReferenceInput> {
    const validationResult = this.validateInput(input);
    if (!validationResult.success) {
      return validationResult as OpsResult<RechargeReferenceInput>;
    }

    // Generate deterministic external reference ID
    this.referenceCounter++;
    const externalRefId = createExternalReferenceId(
      `manual-${input.operatorId}-${input.timestamp}-${this.referenceCounter}`
    );

    const referenceInput: RechargeReferenceInput = Object.freeze({
      externalReferenceId: externalRefId,
      adapterType: this.adapterType,
      clubId: input.clubId,
      playerId: input.playerId,
      referenceAmount: input.referenceAmount,
      declaredAt: input.timestamp,
      metadata: input.notes ? Object.freeze({ notes: input.notes, operatorId: input.operatorId }) : Object.freeze({ operatorId: input.operatorId }),
    });

    return opsSuccess(referenceInput);
  }

  /**
   * Get adapter info.
   */
  getInfo(): Readonly<{ adapterType: AdapterType; name: string; enabled: boolean }> {
    return Object.freeze({
      adapterType: this.adapterType,
      name: this.name,
      enabled: this.isEnabled(),
    });
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a manual admin adapter stub.
 */
export function createManualAdminAdapter(
  config?: Partial<ManualAdminAdapterConfig>
): ManualAdminAdapterStub {
  const fullConfig: ManualAdminAdapterConfig = {
    ...DEFAULT_MANUAL_ADMIN_CONFIG,
    ...config,
  };
  return new ManualAdminAdapterStub(fullConfig);
}
