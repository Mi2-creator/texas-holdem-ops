/**
 * GreyFlowLinking.ts
 *
 * Reference-based linking for grey flow records.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - REFERENCE-ONLY: We store references, we do NOT fetch or validate
 * - READ-ONLY: Linking functions return frozen data structures
 * - PASSIVE: This module does NOT trigger any action
 * - NO RESOLUTION: We do NOT resolve references to actual data
 * - APPEND-ONLY: Links are never modified or deleted
 *
 * WHAT THIS MODULE DOES:
 * - Provides utilities to create reference links
 * - Links flow records to handId, sessionId, intentId
 * - Returns frozen, immutable data structures
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot fetch or validate references from other modules
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot modify existing links
 */

import {
  type GreyFlowRecordId,
  type FlowHash,
  type SessionId,
  type HandId,
  type FlowOperatorId,
  type FlowResult,
  FlowErrorCode,
  FLOW_GENESIS_HASH,
  computeFlowHash,
  flowSuccess,
  flowFailure,
  createFlowError,
} from './GreyFlowTypes';
import { type IntentId } from '../execution-intent/ExecutionIntentTypes';

// ============================================================================
// LINK TYPES
// ============================================================================

/**
 * Link ID - unique identifier for a link record
 */
export type FlowLinkId = string & { readonly __brand: 'FlowLinkId' };

/**
 * Link Type - classification of link type
 */
export const FlowLinkType = {
  /** Link to a hand */
  HAND: 'HAND',
  /** Link to a session */
  SESSION: 'SESSION',
  /** Link to an intent */
  INTENT: 'INTENT',
} as const;

export type FlowLinkType = (typeof FlowLinkType)[keyof typeof FlowLinkType];

// ============================================================================
// ID FACTORIES
// ============================================================================

export function createFlowLinkId(id: string): FlowLinkId {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('FlowLinkId must be a non-empty string');
  }
  return id as FlowLinkId;
}

// ============================================================================
// LINK INPUT
// ============================================================================

/**
 * Flow Link Input - input for creating a link
 */
export interface FlowLinkInput {
  /** Flow record ID to link */
  readonly flowId: GreyFlowRecordId;
  /** Link type */
  readonly linkType: FlowLinkType;
  /** Reference ID (handId, sessionId, or intentId) */
  readonly referenceId: string;
  /** Operator who created this link */
  readonly createdBy: FlowOperatorId;
  /** Explicit timestamp */
  readonly timestamp: number;
  /** Optional description */
  readonly description?: string;
}

// ============================================================================
// LINK RECORD (IMMUTABLE)
// ============================================================================

/**
 * Flow Link Record - immutable link record
 *
 * This is a REFERENCE link only. It does not:
 * - Fetch or validate the referenced data
 * - Execute anything
 * - Trigger any action
 */
export interface FlowLinkRecord {
  /** Unique link ID */
  readonly linkId: FlowLinkId;
  /** Flow record ID */
  readonly flowId: GreyFlowRecordId;
  /** Link type */
  readonly linkType: FlowLinkType;
  /** Reference ID */
  readonly referenceId: string;
  /** Operator who created this link */
  readonly createdBy: FlowOperatorId;
  /** Sequence number */
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
// LINK REGISTRY STATE
// ============================================================================

/**
 * Link Registry State - read-only snapshot
 */
export interface FlowLinkRegistryState {
  /** All link records */
  readonly links: readonly FlowLinkRecord[];
  /** Current chain head hash */
  readonly headHash: FlowHash;
  /** Current sequence number */
  readonly currentSequence: number;
  /** Link count */
  readonly linkCount: number;
}

// ============================================================================
// LINK SUMMARY TYPES
// ============================================================================

/**
 * Flow Links Summary - summary of links for a flow
 */
export interface FlowLinksSummary {
  /** Flow ID */
  readonly flowId: GreyFlowRecordId;
  /** All links for this flow */
  readonly links: readonly FlowLinkRecord[];
  /** Links by type */
  readonly byType: Readonly<Record<FlowLinkType, readonly FlowLinkRecord[]>>;
  /** Total link count */
  readonly totalLinks: number;
}

/**
 * Reference Links Summary - summary of flows linked to a reference
 */
export interface ReferenceLinksSummary {
  /** Reference ID */
  readonly referenceId: string;
  /** Link type */
  readonly linkType: FlowLinkType;
  /** All flow IDs linked to this reference */
  readonly flowIds: readonly GreyFlowRecordId[];
  /** Total flow count */
  readonly flowCount: number;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidFlowLinkInput(input: FlowLinkInput): boolean {
  if (!input.flowId || typeof input.flowId !== 'string') return false;
  if (!input.linkType || !Object.values(FlowLinkType).includes(input.linkType)) return false;
  if (!input.referenceId || typeof input.referenceId !== 'string') return false;
  if (!input.createdBy || typeof input.createdBy !== 'string') return false;
  if (!Number.isInteger(input.timestamp) || input.timestamp <= 0) return false;
  if (input.description !== undefined && typeof input.description !== 'string') return false;
  return true;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

function computeLinkRecordHash(
  record: Omit<FlowLinkRecord, 'recordHash'>
): FlowHash {
  const data = JSON.stringify({
    linkId: record.linkId,
    flowId: record.flowId,
    linkType: record.linkType,
    referenceId: record.referenceId,
    createdBy: record.createdBy,
    sequenceNumber: record.sequenceNumber,
    previousHash: record.previousHash,
    createdAt: record.createdAt,
    description: record.description,
  });
  return computeFlowHash(data);
}

function computeLinkId(
  flowId: GreyFlowRecordId,
  linkType: FlowLinkType,
  referenceId: string,
  timestamp: number
): FlowLinkId {
  return createFlowLinkId(`link-${flowId}-${linkType}-${referenceId}-${timestamp}`);
}

// ============================================================================
// GREY FLOW LINKER
// ============================================================================

/**
 * Grey Flow Linker
 *
 * A passive, append-only registry for flow-to-reference links.
 *
 * This linker:
 * - Creates reference links (does NOT validate references)
 * - Maintains hash chain for audit integrity
 * - Provides read-only query methods
 *
 * This linker DOES NOT:
 * - Validate that referenced entities exist
 * - Execute or trigger any action
 * - Push notifications or emit events
 * - Modify or delete existing links
 */
export class GreyFlowLinker {
  private readonly links: FlowLinkRecord[] = [];
  private readonly linksById: Map<string, FlowLinkRecord> = new Map();
  private readonly linksByFlow: Map<string, FlowLinkRecord[]> = new Map();
  private readonly linksByReference: Map<string, FlowLinkRecord[]> = new Map();
  private readonly linksByType: Map<string, FlowLinkRecord[]> = new Map();
  private headHash: FlowHash = FLOW_GENESIS_HASH;
  private currentSequence: number = 0;

  /**
   * Create a link between a flow and a reference.
   *
   * APPEND-ONLY: Creates new link, never modifies existing.
   * REFERENCE-ONLY: Does NOT validate that the reference exists.
   */
  createLink(input: FlowLinkInput): FlowResult<FlowLinkRecord> {
    // Validate input
    if (!isValidFlowLinkInput(input)) {
      return flowFailure(
        createFlowError(
          FlowErrorCode.INVALID_INPUT,
          'Invalid link input',
          { input }
        )
      );
    }

    // Generate link ID
    const sequenceNumber = this.currentSequence + 1;
    const linkId = computeLinkId(input.flowId, input.linkType, input.referenceId, input.timestamp);

    // Check for duplicate
    if (this.linksById.has(linkId)) {
      return flowFailure(
        createFlowError(
          FlowErrorCode.DUPLICATE_FLOW,
          `Link with ID "${linkId}" already exists`,
          { linkId }
        )
      );
    }

    // Build record without hash
    const recordWithoutHash: Omit<FlowLinkRecord, 'recordHash'> = {
      linkId,
      flowId: input.flowId,
      linkType: input.linkType,
      referenceId: input.referenceId,
      createdBy: input.createdBy,
      sequenceNumber,
      previousHash: this.headHash,
      createdAt: input.timestamp,
      description: input.description,
    };

    // Compute hash
    const recordHash = computeLinkRecordHash(recordWithoutHash);

    // Create final frozen record
    const record: FlowLinkRecord = Object.freeze({
      ...recordWithoutHash,
      recordHash,
    });

    // Append to registry
    this.links.push(record);
    this.linksById.set(record.linkId, record);

    // Index by flow
    if (!this.linksByFlow.has(record.flowId)) {
      this.linksByFlow.set(record.flowId, []);
    }
    this.linksByFlow.get(record.flowId)!.push(record);

    // Index by reference (with type prefix for uniqueness)
    const refKey = `${record.linkType}:${record.referenceId}`;
    if (!this.linksByReference.has(refKey)) {
      this.linksByReference.set(refKey, []);
    }
    this.linksByReference.get(refKey)!.push(record);

    // Index by type
    if (!this.linksByType.has(record.linkType)) {
      this.linksByType.set(record.linkType, []);
    }
    this.linksByType.get(record.linkType)!.push(record);

    // Update chain state
    this.headHash = recordHash;
    this.currentSequence = sequenceNumber;

    return flowSuccess(record);
  }

  // ============================================================================
  // CONVENIENCE LINK METHODS
  // ============================================================================

  /**
   * Link a flow to a hand.
   */
  linkToHand(
    flowId: GreyFlowRecordId,
    handId: HandId,
    createdBy: FlowOperatorId,
    timestamp: number,
    description?: string
  ): FlowResult<FlowLinkRecord> {
    return this.createLink({
      flowId,
      linkType: FlowLinkType.HAND,
      referenceId: handId,
      createdBy,
      timestamp,
      description,
    });
  }

  /**
   * Link a flow to a session.
   */
  linkToSession(
    flowId: GreyFlowRecordId,
    sessionId: SessionId,
    createdBy: FlowOperatorId,
    timestamp: number,
    description?: string
  ): FlowResult<FlowLinkRecord> {
    return this.createLink({
      flowId,
      linkType: FlowLinkType.SESSION,
      referenceId: sessionId,
      createdBy,
      timestamp,
      description,
    });
  }

  /**
   * Link a flow to an intent.
   */
  linkToIntent(
    flowId: GreyFlowRecordId,
    intentId: IntentId,
    createdBy: FlowOperatorId,
    timestamp: number,
    description?: string
  ): FlowResult<FlowLinkRecord> {
    return this.createLink({
      flowId,
      linkType: FlowLinkType.INTENT,
      referenceId: intentId,
      createdBy,
      timestamp,
      description,
    });
  }

  // ============================================================================
  // QUERYING (READ-ONLY)
  // ============================================================================

  /**
   * Get link by ID.
   */
  getLink(linkId: FlowLinkId): FlowLinkRecord | undefined {
    return this.linksById.get(linkId);
  }

  /**
   * Get all links for a flow.
   */
  getLinksByFlow(flowId: GreyFlowRecordId): readonly FlowLinkRecord[] {
    const links = this.linksByFlow.get(flowId) || [];
    return Object.freeze([...links]);
  }

  /**
   * Get all links by type.
   */
  getLinksByType(linkType: FlowLinkType): readonly FlowLinkRecord[] {
    const links = this.linksByType.get(linkType) || [];
    return Object.freeze([...links]);
  }

  /**
   * Get all flows linked to a hand.
   */
  getFlowsByHand(handId: HandId): readonly GreyFlowRecordId[] {
    const refKey = `${FlowLinkType.HAND}:${handId}`;
    const links = this.linksByReference.get(refKey) || [];
    return Object.freeze(links.map(l => l.flowId));
  }

  /**
   * Get all flows linked to a session.
   */
  getFlowsBySession(sessionId: SessionId): readonly GreyFlowRecordId[] {
    const refKey = `${FlowLinkType.SESSION}:${sessionId}`;
    const links = this.linksByReference.get(refKey) || [];
    return Object.freeze(links.map(l => l.flowId));
  }

  /**
   * Get all flows linked to an intent.
   */
  getFlowsByIntent(intentId: IntentId): readonly GreyFlowRecordId[] {
    const refKey = `${FlowLinkType.INTENT}:${intentId}`;
    const links = this.linksByReference.get(refKey) || [];
    return Object.freeze(links.map(l => l.flowId));
  }

  /**
   * Get all links.
   */
  getAllLinks(): readonly FlowLinkRecord[] {
    return Object.freeze([...this.links]);
  }

  /**
   * Get flow links summary.
   */
  getFlowLinksSummary(flowId: GreyFlowRecordId): FlowLinksSummary {
    const links = this.getLinksByFlow(flowId);

    const byType: Record<FlowLinkType, FlowLinkRecord[]> = {
      [FlowLinkType.HAND]: [],
      [FlowLinkType.SESSION]: [],
      [FlowLinkType.INTENT]: [],
    };

    for (const link of links) {
      byType[link.linkType].push(link);
    }

    return Object.freeze({
      flowId,
      links,
      byType: Object.freeze({
        [FlowLinkType.HAND]: Object.freeze(byType[FlowLinkType.HAND]),
        [FlowLinkType.SESSION]: Object.freeze(byType[FlowLinkType.SESSION]),
        [FlowLinkType.INTENT]: Object.freeze(byType[FlowLinkType.INTENT]),
      }),
      totalLinks: links.length,
    });
  }

  /**
   * Get reference links summary.
   */
  getReferenceLinksSummary(
    linkType: FlowLinkType,
    referenceId: string
  ): ReferenceLinksSummary {
    const refKey = `${linkType}:${referenceId}`;
    const links = this.linksByReference.get(refKey) || [];

    return Object.freeze({
      referenceId,
      linkType,
      flowIds: Object.freeze(links.map(l => l.flowId)),
      flowCount: links.length,
    });
  }

  // ============================================================================
  // STATE
  // ============================================================================

  /**
   * Get linker state snapshot.
   */
  getState(): FlowLinkRegistryState {
    return Object.freeze({
      links: Object.freeze([...this.links]),
      headHash: this.headHash,
      currentSequence: this.currentSequence,
      linkCount: this.links.length,
    });
  }

  /**
   * Get link count.
   */
  getLinkCount(): number {
    return this.links.length;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new grey flow linker.
 */
export function createGreyFlowLinker(): GreyFlowLinker {
  return new GreyFlowLinker();
}

/**
 * Create a test grey flow linker.
 * NOT for production use.
 */
export function createTestFlowLinker(): GreyFlowLinker {
  return new GreyFlowLinker();
}
