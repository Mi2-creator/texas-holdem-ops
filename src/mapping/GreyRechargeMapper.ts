/**
 * GreyRechargeMapper.ts
 *
 * Maps recharge references to Grey Recharge format.
 *
 * This mapper READS Grey types and produces references
 * compatible with GreyRecharge system.
 *
 * IMPORTANT:
 * - Ops MAY read GreyRechargeTypes
 * - Ops MAY emit GreyRechargeReference
 * - Ops MAY NOT compute balances
 * - Ops MAY NOT affect GreyFlow directly
 *
 * REFERENCE-ONLY: All values are references, not money.
 */

import {
  type RechargeReferenceRecord,
  type OpsResult,
  ReferenceStatus,
  opsSuccess,
  opsFailure,
  createOpsError,
  OpsErrorCode,
} from '../ops-config';

// ============================================================================
// GREY RECHARGE REFERENCE TYPES
// ============================================================================

/**
 * Grey Recharge Reference
 *
 * This is a REFERENCE structure compatible with Grey Recharge system.
 * It does NOT represent actual money or value.
 *
 * NOTE: In production, these types would be imported from Grey system.
 * For OPS-0, we define compatible interfaces here.
 */
export interface GreyRechargeReference {
  /** External reference ID for idempotency */
  readonly externalReferenceId: string;
  /** Club ID */
  readonly clubId: string;
  /** Player ID */
  readonly playerId: string;
  /** Reference amount (integer, NOT money) */
  readonly referenceAmount: number;
  /** Source identifier */
  readonly source: string;
  /** Timestamp when declared */
  readonly declaredAt: number;
  /** Timestamp when confirmed */
  readonly confirmedAt: number;
  /** Operator who confirmed */
  readonly confirmedBy: string;
  /** Optional metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Mapping Result
 */
export interface MappingResult {
  readonly reference: GreyRechargeReference;
  readonly sourceRecord: RechargeReferenceRecord;
  readonly mappedAt: number;
}

// ============================================================================
// MAPPER
// ============================================================================

/**
 * Grey Recharge Mapper
 *
 * Maps confirmed recharge references to Grey format.
 */
export class GreyRechargeMapper {
  /**
   * Map a confirmed recharge reference to Grey format.
   *
   * Only CONFIRMED references can be mapped.
   */
  mapToGreyReference(
    record: RechargeReferenceRecord,
    timestamp: number
  ): OpsResult<MappingResult> {
    // Only confirmed references can be mapped
    if (record.status !== ReferenceStatus.CONFIRMED) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.INVALID_STATUS_TRANSITION,
          `Cannot map reference with status "${record.status}". Only CONFIRMED references can be mapped.`
        )
      );
    }

    // Confirmation must exist
    if (!record.confirmation) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.CONFIRMATION_REQUIRED,
          'Confirmation details are required for mapping'
        )
      );
    }

    // Create Grey reference
    const greyReference: GreyRechargeReference = Object.freeze({
      externalReferenceId: record.input.externalReferenceId,
      clubId: record.input.clubId,
      playerId: record.input.playerId,
      referenceAmount: record.input.referenceAmount,
      source: `ops:${record.input.adapterType}`,
      declaredAt: record.input.declaredAt,
      confirmedAt: record.confirmation.confirmedAt,
      confirmedBy: record.confirmation.operatorId,
      metadata: record.input.metadata,
    });

    const result: MappingResult = Object.freeze({
      reference: greyReference,
      sourceRecord: record,
      mappedAt: timestamp,
    });

    return opsSuccess(result);
  }

  /**
   * Map multiple confirmed references.
   */
  mapMultiple(
    records: readonly RechargeReferenceRecord[],
    timestamp: number
  ): OpsResult<readonly MappingResult[]> {
    const results: MappingResult[] = [];

    for (const record of records) {
      const mapResult = this.mapToGreyReference(record, timestamp);
      if (!mapResult.success) {
        return mapResult as OpsResult<readonly MappingResult[]>;
      }
      results.push(mapResult.value);
    }

    return opsSuccess(Object.freeze(results));
  }

  /**
   * Validate Grey reference format.
   */
  validateGreyReference(reference: GreyRechargeReference): OpsResult<GreyRechargeReference> {
    if (!reference.externalReferenceId) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'externalReferenceId is required')
      );
    }

    if (!reference.clubId) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'clubId is required')
      );
    }

    if (!reference.playerId) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'playerId is required')
      );
    }

    if (!Number.isInteger(reference.referenceAmount) || reference.referenceAmount <= 0) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'referenceAmount must be a positive integer')
      );
    }

    return opsSuccess(reference);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a Grey recharge mapper.
 */
export function createGreyRechargeMapper(): GreyRechargeMapper {
  return new GreyRechargeMapper();
}
