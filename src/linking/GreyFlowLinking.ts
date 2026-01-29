/**
 * GreyFlowLinking.ts
 *
 * Links manual recharge references to Grey flow IDs.
 *
 * REFERENCE-ONLY: Links references, does not move money.
 * NO EXECUTION: No balance changes, no transactions.
 * DETERMINISTIC: Same inputs produce same outputs.
 * AUDITABLE: All links are recorded.
 */

import {
  type ManualRechargeReferenceId,
  type RechargeResult,
  DeclarationStatus,
  RechargeErrorCode,
  rechargeSuccess,
  rechargeFailure,
  createRechargeError,
} from '../recharge/ManualRechargeTypes';

import {
  type ManualRechargeRegistry,
} from '../recharge/ManualRechargeRegistry';

// ============================================================================
// LINKING TYPES
// ============================================================================

/**
 * Grey Flow ID (reference to a flow in the Grey system)
 */
export type GreyFlowId = string & { readonly __brand: 'GreyFlowId' };

/**
 * Create a Grey Flow ID
 */
export function createGreyFlowId(id: string): GreyFlowId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('GreyFlowId must be a non-empty string');
  }
  return id as GreyFlowId;
}

/**
 * Link Request - request to link a recharge reference to Grey flows
 */
export interface LinkRequest {
  /** Reference ID to link */
  readonly referenceId: ManualRechargeReferenceId;
  /** Grey flow IDs to link */
  readonly greyFlowIds: readonly GreyFlowId[];
  /** Timestamp of linking operation */
  readonly timestamp: number;
  /** Operator ID performing the link */
  readonly operatorId: string;
  /** Optional notes */
  readonly notes?: string;
}

/**
 * Link Record - record of a linking operation
 */
export interface LinkRecord {
  /** Reference ID that was linked */
  readonly referenceId: ManualRechargeReferenceId;
  /** Grey flow IDs linked */
  readonly greyFlowIds: readonly GreyFlowId[];
  /** When the link was created */
  readonly linkedAt: number;
  /** Who created the link */
  readonly linkedBy: string;
  /** Notes */
  readonly notes?: string;
}

/**
 * Link State - current linking state
 */
export interface LinkState {
  /** All link records */
  readonly links: readonly LinkRecord[];
  /** References by Grey flow ID */
  readonly referencesByFlow: ReadonlyMap<string, readonly ManualRechargeReferenceId[]>;
  /** Grey flows by reference ID */
  readonly flowsByReference: ReadonlyMap<string, readonly GreyFlowId[]>;
}

// ============================================================================
// GREY FLOW LINKER
// ============================================================================

/**
 * Grey Flow Linker
 *
 * Links recharge references to Grey flow IDs.
 * NO execution - only reference linking.
 */
export class GreyFlowLinker {
  private readonly links: LinkRecord[] = [];
  private readonly referencesByFlow: Map<string, ManualRechargeReferenceId[]> = new Map();
  private readonly flowsByReference: Map<string, GreyFlowId[]> = new Map();
  private readonly registry: ManualRechargeRegistry;

  constructor(registry: ManualRechargeRegistry) {
    this.registry = registry;
  }

  /**
   * Link a recharge reference to Grey flow IDs.
   *
   * REFERENCE-ONLY: Does not execute any money operations.
   * Updates the registry entry status to LINKED.
   */
  link(request: LinkRequest): RechargeResult<LinkRecord> {
    // Validate request
    const validation = this.validateLinkRequest(request);
    if (!validation.success) {
      return validation as RechargeResult<LinkRecord>;
    }

    // Find the registry entry
    const entry = this.registry.findByReferenceId(request.referenceId);
    if (!entry) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.ENTRY_NOT_FOUND,
          `Entry not found for reference: ${request.referenceId}`,
          { referenceId: request.referenceId }
        )
      );
    }

    // Verify entry is in DECLARED status
    if (entry.status !== DeclarationStatus.DECLARED) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.INVALID_STATUS,
          `Cannot link reference with status "${entry.status}". Only DECLARED references can be linked.`,
          { referenceId: request.referenceId, status: entry.status }
        )
      );
    }

    // Create link record
    const linkRecord: LinkRecord = Object.freeze({
      referenceId: request.referenceId,
      greyFlowIds: Object.freeze([...request.greyFlowIds]),
      linkedAt: request.timestamp,
      linkedBy: request.operatorId,
      notes: request.notes,
    });

    // Store link record
    this.links.push(linkRecord);

    // Update indices
    for (const flowId of request.greyFlowIds) {
      if (!this.referencesByFlow.has(flowId)) {
        this.referencesByFlow.set(flowId, []);
      }
      this.referencesByFlow.get(flowId)!.push(request.referenceId);
    }

    if (!this.flowsByReference.has(request.referenceId)) {
      this.flowsByReference.set(request.referenceId, []);
    }
    this.flowsByReference.get(request.referenceId)!.push(...request.greyFlowIds);

    // Update registry entry status to LINKED
    const updateResult = this.registry.updateStatus(
      request.referenceId,
      DeclarationStatus.LINKED,
      request.timestamp,
      request.greyFlowIds.map(id => id as string)
    );

    if (!updateResult.success) {
      // Rollback link record on failure
      this.links.pop();
      for (const flowId of request.greyFlowIds) {
        const refs = this.referencesByFlow.get(flowId);
        if (refs) {
          refs.pop();
        }
      }
      const flows = this.flowsByReference.get(request.referenceId);
      if (flows) {
        flows.splice(flows.length - request.greyFlowIds.length);
      }
      return updateResult as RechargeResult<LinkRecord>;
    }

    return rechargeSuccess(linkRecord);
  }

  /**
   * Get references linked to a Grey flow.
   */
  getReferencesByFlow(flowId: GreyFlowId): readonly ManualRechargeReferenceId[] {
    const refs = this.referencesByFlow.get(flowId);
    return refs ? Object.freeze([...refs]) : Object.freeze([]);
  }

  /**
   * Get Grey flows linked to a reference.
   */
  getFlowsByReference(referenceId: ManualRechargeReferenceId): readonly GreyFlowId[] {
    const flows = this.flowsByReference.get(referenceId);
    return flows ? Object.freeze([...flows]) : Object.freeze([]);
  }

  /**
   * Get all link records.
   */
  getAllLinks(): readonly LinkRecord[] {
    return Object.freeze([...this.links]);
  }

  /**
   * Get link state snapshot.
   */
  getState(): LinkState {
    const referencesByFlowSnapshot = new Map<string, readonly ManualRechargeReferenceId[]>();
    for (const [flowId, refs] of this.referencesByFlow) {
      referencesByFlowSnapshot.set(flowId, Object.freeze([...refs]));
    }

    const flowsByReferenceSnapshot = new Map<string, readonly GreyFlowId[]>();
    for (const [refId, flows] of this.flowsByReference) {
      flowsByReferenceSnapshot.set(refId, Object.freeze([...flows]));
    }

    return Object.freeze({
      links: Object.freeze([...this.links]),
      referencesByFlow: referencesByFlowSnapshot,
      flowsByReference: flowsByReferenceSnapshot,
    });
  }

  /**
   * Check if a reference is linked.
   */
  isLinked(referenceId: ManualRechargeReferenceId): boolean {
    return this.flowsByReference.has(referenceId) &&
           this.flowsByReference.get(referenceId)!.length > 0;
  }

  /**
   * Check if a Grey flow has linked references.
   */
  hasLinkedReferences(flowId: GreyFlowId): boolean {
    return this.referencesByFlow.has(flowId) &&
           this.referencesByFlow.get(flowId)!.length > 0;
  }

  /**
   * Validate link request.
   */
  private validateLinkRequest(request: LinkRequest): RechargeResult<void> {
    if (!request.referenceId) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.INVALID_INPUT,
          'referenceId is required'
        )
      );
    }

    if (!request.greyFlowIds || request.greyFlowIds.length === 0) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.INVALID_INPUT,
          'At least one greyFlowId is required'
        )
      );
    }

    if (!Number.isInteger(request.timestamp) || request.timestamp <= 0) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.INVALID_INPUT,
          'timestamp must be a positive integer'
        )
      );
    }

    if (!request.operatorId || typeof request.operatorId !== 'string' || request.operatorId.trim().length === 0) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.INVALID_INPUT,
          'operatorId must be a non-empty string'
        )
      );
    }

    return rechargeSuccess(undefined);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a Grey flow linker.
 */
export function createGreyFlowLinker(registry: ManualRechargeRegistry): GreyFlowLinker {
  return new GreyFlowLinker(registry);
}
