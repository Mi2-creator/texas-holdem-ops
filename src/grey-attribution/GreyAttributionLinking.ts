/**
 * GreyAttributionLinking.ts
 *
 * Reference-based linking for attribution records.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - REFERENCE-ONLY: Links are references, not ownership
 * - APPEND-ONLY: Link records are never modified or deleted
 * - NO VALIDATION: Does NOT verify that referenced entities exist
 * - PULL-BASED: External systems query this data, we never push
 * - PASSIVE: Pure data storage and retrieval
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot execute, trigger, or dispatch anything
 * - Cannot modify or delete link records
 * - Cannot validate existence of linked entities
 */

import { createHash } from 'crypto';
import {
  type AttributionId,
  type AttributionHash,
  type AttributionResult,
  AttributionErrorCode,
  ATTRIBUTION_GENESIS_HASH,
  createAttributionHash,
  attributionSuccess,
  attributionFailure,
  createAttributionError,
} from './GreyAttributionTypes';

// ============================================================================
// LINK TYPES
// ============================================================================

/**
 * Attribution Link ID
 */
export type AttributionLinkId = string & { readonly __brand: 'AttributionLinkId' };

/**
 * Create a valid AttributionLinkId
 */
export function createAttributionLinkId(value: string): AttributionLinkId {
  if (!value || value.trim().length === 0) {
    throw new Error('AttributionLinkId cannot be empty');
  }
  return value.trim() as AttributionLinkId;
}

/**
 * Link Target Type - what the attribution is linked to
 */
export enum AttributionLinkTargetType {
  AGENT = 'AGENT',
  CLUB = 'CLUB',
  TABLE = 'TABLE',
  INTENT = 'INTENT',
  FLOW = 'FLOW',
  SESSION = 'SESSION',
  HAND = 'HAND',
}

/**
 * Attribution Link Input
 */
export interface AttributionLinkInput {
  /** The attribution record ID being linked */
  readonly attributionId: AttributionId;
  /** Type of entity being linked to */
  readonly targetType: AttributionLinkTargetType;
  /** ID of the target entity */
  readonly targetRefId: string;
  /** Timestamp of the link */
  readonly timestamp: number;
  /** Operator who created the link */
  readonly operatorId: string;
  /** Optional notes */
  readonly notes?: string;
}

/**
 * Attribution Link Record - immutable link record
 */
export interface AttributionLinkRecord {
  /** Unique link ID */
  readonly linkId: AttributionLinkId;
  /** The attribution record ID being linked */
  readonly attributionId: AttributionId;
  /** Type of entity being linked to */
  readonly targetType: AttributionLinkTargetType;
  /** ID of the target entity */
  readonly targetRefId: string;
  /** Timestamp of the link */
  readonly timestamp: number;
  /** Operator who created the link */
  readonly operatorId: string;
  /** Optional notes */
  readonly notes?: string;
  /** Hash of this record */
  readonly recordHash: AttributionHash;
  /** Hash of the previous record */
  readonly previousHash: AttributionHash;
  /** Sequence number in chain */
  readonly sequenceNumber: number;
  /** When this record was created */
  readonly createdAt: number;
}

/**
 * Link Registry State
 */
export interface AttributionLinkRegistryState {
  /** All link records */
  readonly links: readonly AttributionLinkRecord[];
  /** Total link count */
  readonly linkCount: number;
  /** Latest hash */
  readonly latestHash: AttributionHash;
}

/**
 * Links Summary for an attribution
 */
export interface AttributionLinksSummary {
  /** Attribution ID */
  readonly attributionId: AttributionId;
  /** Total link count */
  readonly totalLinks: number;
  /** Links by target type */
  readonly linksByType: ReadonlyMap<AttributionLinkTargetType, number>;
  /** All linked target IDs */
  readonly linkedTargets: readonly { type: AttributionLinkTargetType; refId: string }[];
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate link input
 */
export function isValidAttributionLinkInput(input: AttributionLinkInput): boolean {
  if (!input) return false;
  if (!input.attributionId) return false;
  if (!Object.values(AttributionLinkTargetType).includes(input.targetType)) return false;
  if (!input.targetRefId || input.targetRefId.trim().length === 0) return false;
  if (typeof input.timestamp !== 'number' || input.timestamp <= 0) return false;
  if (!input.operatorId || input.operatorId.trim().length === 0) return false;
  return true;
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Compute link record hash
 */
function computeLinkRecordHash(
  input: AttributionLinkInput,
  previousHash: AttributionHash,
  sequenceNumber: number
): AttributionHash {
  const data = JSON.stringify({
    attributionId: input.attributionId,
    targetType: input.targetType,
    targetRefId: input.targetRefId,
    timestamp: input.timestamp,
    operatorId: input.operatorId,
    notes: input.notes,
    previousHash,
    sequenceNumber,
  });
  const hash = createHash('sha256').update(data).digest('hex');
  return createAttributionHash(hash);
}

/**
 * Compute link ID
 */
function computeLinkId(input: AttributionLinkInput): AttributionLinkId {
  const data = JSON.stringify({
    attributionId: input.attributionId,
    targetType: input.targetType,
    targetRefId: input.targetRefId,
    timestamp: input.timestamp,
  });
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
  return createAttributionLinkId(`attrlink-${hash}`);
}

// ============================================================================
// LINKER CLASS
// ============================================================================

/**
 * Grey Attribution Linker
 *
 * Creates and manages links between attributions and other entities.
 * REFERENCE-ONLY: Does NOT validate that referenced entities exist.
 */
export class GreyAttributionLinker {
  private readonly links: AttributionLinkRecord[] = [];
  private readonly linksById: Map<AttributionLinkId, AttributionLinkRecord> = new Map();
  private readonly linksByAttribution: Map<AttributionId, AttributionLinkRecord[]> = new Map();
  private readonly linksByTarget: Map<string, AttributionLinkRecord[]> = new Map();
  private latestHash: AttributionHash = ATTRIBUTION_GENESIS_HASH;
  private sequenceNumber = 0;

  /**
   * Create a link from attribution to agent.
   *
   * REFERENCE-ONLY: Does NOT validate agent exists.
   */
  linkToAgent(
    attributionId: AttributionId,
    agentId: string,
    timestamp: number,
    operatorId: string,
    notes?: string
  ): AttributionResult<AttributionLinkRecord> {
    return this.createLink({
      attributionId,
      targetType: AttributionLinkTargetType.AGENT,
      targetRefId: agentId,
      timestamp,
      operatorId,
      notes,
    });
  }

  /**
   * Create a link from attribution to club.
   *
   * REFERENCE-ONLY: Does NOT validate club exists.
   */
  linkToClub(
    attributionId: AttributionId,
    clubId: string,
    timestamp: number,
    operatorId: string,
    notes?: string
  ): AttributionResult<AttributionLinkRecord> {
    return this.createLink({
      attributionId,
      targetType: AttributionLinkTargetType.CLUB,
      targetRefId: clubId,
      timestamp,
      operatorId,
      notes,
    });
  }

  /**
   * Create a link from attribution to table.
   *
   * REFERENCE-ONLY: Does NOT validate table exists.
   */
  linkToTable(
    attributionId: AttributionId,
    tableId: string,
    timestamp: number,
    operatorId: string,
    notes?: string
  ): AttributionResult<AttributionLinkRecord> {
    return this.createLink({
      attributionId,
      targetType: AttributionLinkTargetType.TABLE,
      targetRefId: tableId,
      timestamp,
      operatorId,
      notes,
    });
  }

  /**
   * Create a link from attribution to intent.
   *
   * REFERENCE-ONLY: Does NOT validate intent exists.
   */
  linkToIntent(
    attributionId: AttributionId,
    intentId: string,
    timestamp: number,
    operatorId: string,
    notes?: string
  ): AttributionResult<AttributionLinkRecord> {
    return this.createLink({
      attributionId,
      targetType: AttributionLinkTargetType.INTENT,
      targetRefId: intentId,
      timestamp,
      operatorId,
      notes,
    });
  }

  /**
   * Create a link from attribution to flow.
   *
   * REFERENCE-ONLY: Does NOT validate flow exists.
   */
  linkToFlow(
    attributionId: AttributionId,
    flowId: string,
    timestamp: number,
    operatorId: string,
    notes?: string
  ): AttributionResult<AttributionLinkRecord> {
    return this.createLink({
      attributionId,
      targetType: AttributionLinkTargetType.FLOW,
      targetRefId: flowId,
      timestamp,
      operatorId,
      notes,
    });
  }

  /**
   * Create a link from attribution to session.
   *
   * REFERENCE-ONLY: Does NOT validate session exists.
   */
  linkToSession(
    attributionId: AttributionId,
    sessionId: string,
    timestamp: number,
    operatorId: string,
    notes?: string
  ): AttributionResult<AttributionLinkRecord> {
    return this.createLink({
      attributionId,
      targetType: AttributionLinkTargetType.SESSION,
      targetRefId: sessionId,
      timestamp,
      operatorId,
      notes,
    });
  }

  /**
   * Create a link from attribution to hand.
   *
   * REFERENCE-ONLY: Does NOT validate hand exists.
   */
  linkToHand(
    attributionId: AttributionId,
    handId: string,
    timestamp: number,
    operatorId: string,
    notes?: string
  ): AttributionResult<AttributionLinkRecord> {
    return this.createLink({
      attributionId,
      targetType: AttributionLinkTargetType.HAND,
      targetRefId: handId,
      timestamp,
      operatorId,
      notes,
    });
  }

  /**
   * Internal link creation.
   */
  private createLink(input: AttributionLinkInput): AttributionResult<AttributionLinkRecord> {
    // Validate input
    if (!isValidAttributionLinkInput(input)) {
      return attributionFailure(
        createAttributionError(
          AttributionErrorCode.INVALID_INPUT,
          'Invalid link input',
          { input }
        )
      );
    }

    // Compute link ID
    const linkId = computeLinkId(input);

    // Check for duplicate
    if (this.linksById.has(linkId)) {
      return attributionFailure(
        createAttributionError(
          AttributionErrorCode.DUPLICATE_RECORD,
          'Link already exists',
          { linkId }
        )
      );
    }

    // Compute hash
    const recordHash = computeLinkRecordHash(input, this.latestHash, this.sequenceNumber + 1);

    // Create frozen record
    const record: AttributionLinkRecord = Object.freeze({
      linkId,
      attributionId: input.attributionId,
      targetType: input.targetType,
      targetRefId: input.targetRefId,
      timestamp: input.timestamp,
      operatorId: input.operatorId,
      notes: input.notes,
      recordHash,
      previousHash: this.latestHash,
      sequenceNumber: this.sequenceNumber + 1,
      createdAt: Date.now(),
    });

    // Append to chain
    this.links.push(record);
    this.linksById.set(linkId, record);
    this.latestHash = recordHash;
    this.sequenceNumber += 1;

    // Update indexes
    const attrLinks = this.linksByAttribution.get(input.attributionId) || [];
    attrLinks.push(record);
    this.linksByAttribution.set(input.attributionId, attrLinks);

    const targetKey = `${input.targetType}:${input.targetRefId}`;
    const targetLinks = this.linksByTarget.get(targetKey) || [];
    targetLinks.push(record);
    this.linksByTarget.set(targetKey, targetLinks);

    return attributionSuccess(record);
  }

  /**
   * Get links for an attribution.
   *
   * READ-ONLY: Returns frozen array.
   */
  getLinksByAttribution(attributionId: AttributionId): readonly AttributionLinkRecord[] {
    const links = this.linksByAttribution.get(attributionId) || [];
    return Object.freeze([...links]);
  }

  /**
   * Get attributions linked to a target.
   *
   * READ-ONLY: Returns frozen array.
   */
  getLinksByTarget(
    targetType: AttributionLinkTargetType,
    targetRefId: string
  ): readonly AttributionLinkRecord[] {
    const targetKey = `${targetType}:${targetRefId}`;
    const links = this.linksByTarget.get(targetKey) || [];
    return Object.freeze([...links]);
  }

  /**
   * Get all attributions linked to an agent.
   */
  getAttributionsByAgent(agentId: string): readonly AttributionLinkRecord[] {
    return this.getLinksByTarget(AttributionLinkTargetType.AGENT, agentId);
  }

  /**
   * Get all attributions linked to a club.
   */
  getAttributionsByClub(clubId: string): readonly AttributionLinkRecord[] {
    return this.getLinksByTarget(AttributionLinkTargetType.CLUB, clubId);
  }

  /**
   * Get all attributions linked to a table.
   */
  getAttributionsByTable(tableId: string): readonly AttributionLinkRecord[] {
    return this.getLinksByTarget(AttributionLinkTargetType.TABLE, tableId);
  }

  /**
   * Get all attributions linked to an intent.
   */
  getAttributionsByIntent(intentId: string): readonly AttributionLinkRecord[] {
    return this.getLinksByTarget(AttributionLinkTargetType.INTENT, intentId);
  }

  /**
   * Get all attributions linked to a flow.
   */
  getAttributionsByFlow(flowId: string): readonly AttributionLinkRecord[] {
    return this.getLinksByTarget(AttributionLinkTargetType.FLOW, flowId);
  }

  /**
   * Get links summary for an attribution.
   *
   * READ-ONLY: Returns frozen summary.
   */
  getAttributionLinksSummary(attributionId: AttributionId): AttributionLinksSummary {
    const links = this.getLinksByAttribution(attributionId);

    const linksByType = new Map<AttributionLinkTargetType, number>();
    for (const type of Object.values(AttributionLinkTargetType)) {
      linksByType.set(type, 0);
    }

    const linkedTargets: { type: AttributionLinkTargetType; refId: string }[] = [];

    for (const link of links) {
      const current = linksByType.get(link.targetType) || 0;
      linksByType.set(link.targetType, current + 1);
      linkedTargets.push({ type: link.targetType, refId: link.targetRefId });
    }

    return Object.freeze({
      attributionId,
      totalLinks: links.length,
      linksByType: Object.freeze(linksByType) as ReadonlyMap<AttributionLinkTargetType, number>,
      linkedTargets: Object.freeze(linkedTargets),
    });
  }

  /**
   * Get all links.
   *
   * READ-ONLY: Returns frozen array.
   */
  getAllLinks(): readonly AttributionLinkRecord[] {
    return Object.freeze([...this.links]);
  }

  /**
   * Get registry state.
   *
   * READ-ONLY: Returns frozen state.
   */
  getState(): AttributionLinkRegistryState {
    return Object.freeze({
      links: this.getAllLinks(),
      linkCount: this.links.length,
      latestHash: this.latestHash,
    });
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new GreyAttributionLinker
 */
export function createGreyAttributionLinker(): GreyAttributionLinker {
  return new GreyAttributionLinker();
}

/**
 * Create a test linker (alias for clarity in tests)
 */
export function createTestAttributionLinker(): GreyAttributionLinker {
  return new GreyAttributionLinker();
}
