/**
 * ManualRechargeRegistry.ts
 *
 * Append-only, hash-chained registry for manual recharge declarations.
 *
 * APPEND-ONLY: No mutations, no deletes.
 * IDEMPOTENT: Duplicate externalReferenceId rejected.
 * HASH-CHAINED: Each entry links to previous for audit integrity.
 * DETERMINISTIC: Same inputs produce same outputs.
 * INTEGER-ONLY: No floating point arithmetic.
 */

import {
  type ManualRechargeReferenceId,
  type RegistryEntryId,
  type HashValue,
  type ManualRechargeDeclaration,
  type ManualRechargeDeclarationInput,
  type ManualRechargeRegistryEntry,
  type RechargeResult,
  DeclarationStatus,
  RechargeErrorCode,
  createManualRechargeReferenceId,
  createRegistryEntryId,
  computeEntryHash,
  rechargeSuccess,
  rechargeFailure,
  createRechargeError,
  isValidDeclarationInput,
  GENESIS_HASH,
} from './ManualRechargeTypes';

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Registry State - read-only snapshot of registry
 */
export interface RegistryState {
  /** All entries in order */
  readonly entries: readonly ManualRechargeRegistryEntry[];
  /** Current chain head hash */
  readonly headHash: HashValue;
  /** Current sequence number */
  readonly currentSequence: number;
  /** Entry count */
  readonly entryCount: number;
}

/**
 * Registry Query Options
 */
export interface RegistryQueryOptions {
  /** Filter by status */
  readonly status?: DeclarationStatus;
  /** Filter by club ID */
  readonly clubId?: string;
  /** Filter by player ID */
  readonly playerId?: string;
  /** Filter by time range (start) */
  readonly fromTimestamp?: number;
  /** Filter by time range (end) */
  readonly toTimestamp?: number;
  /** Limit results */
  readonly limit?: number;
  /** Offset for pagination */
  readonly offset?: number;
}

// ============================================================================
// MANUAL RECHARGE REGISTRY
// ============================================================================

/**
 * Manual Recharge Registry
 *
 * Append-only, hash-chained registry for recharge declarations.
 * NO mutations, NO deletes - only append.
 */
export class ManualRechargeRegistry {
  private readonly entries: ManualRechargeRegistryEntry[] = [];
  private readonly entriesById: Map<string, ManualRechargeRegistryEntry> = new Map();
  private readonly entriesByExtRef: Map<string, ManualRechargeRegistryEntry> = new Map();
  private headHash: HashValue = GENESIS_HASH;
  private currentSequence: number = 0;

  /**
   * Declare a new recharge reference.
   *
   * APPEND-ONLY: Creates a new entry, cannot modify existing.
   * IDEMPOTENT: Rejects duplicate externalReferenceId.
   */
  declare(input: ManualRechargeDeclarationInput): RechargeResult<ManualRechargeRegistryEntry> {
    // Validate input
    if (!isValidDeclarationInput(input)) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.INVALID_INPUT,
          'Invalid declaration input',
          { input }
        )
      );
    }

    // Check for duplicate external reference
    if (this.entriesByExtRef.has(input.externalReferenceId)) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.DUPLICATE_REFERENCE,
          `Duplicate external reference: ${input.externalReferenceId}`,
          { externalReferenceId: input.externalReferenceId }
        )
      );
    }

    // Create declaration
    const declaration: ManualRechargeDeclaration = Object.freeze({
      externalReferenceId: input.externalReferenceId,
      source: input.source,
      declaredAmount: input.declaredAmount,
      declaredAt: input.timestamp,
      declaredBy: input.declaredBy,
      clubId: input.clubId,
      playerId: input.playerId,
      notes: input.notes,
    });

    // Generate IDs
    const sequenceNumber = this.currentSequence + 1;
    const entryId = createRegistryEntryId(
      `entry-${sequenceNumber}-${input.timestamp}`
    );
    const referenceId = createManualRechargeReferenceId(
      `ref-${input.externalReferenceId}-${sequenceNumber}`
    );

    // Build entry (without hash first)
    const entryWithoutHash: Omit<ManualRechargeRegistryEntry, 'entryHash'> = {
      entryId,
      referenceId,
      status: DeclarationStatus.DECLARED,
      declaration,
      previousHash: this.headHash,
      sequenceNumber,
      createdAt: input.timestamp,
      linkedGreyFlowIds: Object.freeze([]),
    };

    // Compute hash
    const entryHash = computeEntryHash(entryWithoutHash);

    // Create final frozen entry
    const entry: ManualRechargeRegistryEntry = Object.freeze({
      ...entryWithoutHash,
      entryHash,
    });

    // Append to registry (APPEND-ONLY)
    this.entries.push(entry);
    this.entriesById.set(entry.entryId, entry);
    this.entriesByExtRef.set(input.externalReferenceId, entry);

    // Update chain state
    this.headHash = entryHash;
    this.currentSequence = sequenceNumber;

    return rechargeSuccess(entry);
  }

  /**
   * Update entry status.
   *
   * Creates a NEW entry with updated status (append-only semantics).
   * Original entry remains unchanged.
   */
  updateStatus(
    referenceId: ManualRechargeReferenceId,
    newStatus: DeclarationStatus,
    timestamp: number,
    linkedGreyFlowIds?: readonly string[]
  ): RechargeResult<ManualRechargeRegistryEntry> {
    // Find current entry
    const currentEntry = this.findByReferenceId(referenceId);
    if (!currentEntry) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.ENTRY_NOT_FOUND,
          `Entry not found for reference: ${referenceId}`,
          { referenceId }
        )
      );
    }

    // Validate status transition
    const validationResult = this.validateStatusTransition(currentEntry.status, newStatus);
    if (!validationResult.success) {
      return validationResult as RechargeResult<ManualRechargeRegistryEntry>;
    }

    // Generate new entry ID for the update
    const sequenceNumber = this.currentSequence + 1;
    const entryId = createRegistryEntryId(
      `entry-${sequenceNumber}-${timestamp}`
    );

    // Build updated entry (without hash first)
    const entryWithoutHash: Omit<ManualRechargeRegistryEntry, 'entryHash'> = {
      entryId,
      referenceId: currentEntry.referenceId,
      status: newStatus,
      declaration: currentEntry.declaration,
      previousHash: this.headHash,
      sequenceNumber,
      createdAt: timestamp,
      linkedGreyFlowIds: linkedGreyFlowIds
        ? Object.freeze([...linkedGreyFlowIds])
        : currentEntry.linkedGreyFlowIds,
      confirmation: currentEntry.confirmation,
    };

    // Compute hash
    const entryHash = computeEntryHash(entryWithoutHash);

    // Create final frozen entry
    const entry: ManualRechargeRegistryEntry = Object.freeze({
      ...entryWithoutHash,
      entryHash,
    });

    // Append to registry (APPEND-ONLY)
    this.entries.push(entry);
    this.entriesById.set(entry.entryId, entry);

    // Update chain state
    this.headHash = entryHash;
    this.currentSequence = sequenceNumber;

    return rechargeSuccess(entry);
  }

  /**
   * Get entry by entry ID.
   */
  getEntry(entryId: RegistryEntryId): ManualRechargeRegistryEntry | undefined {
    return this.entriesById.get(entryId);
  }

  /**
   * Find latest entry by reference ID.
   */
  findByReferenceId(referenceId: ManualRechargeReferenceId): ManualRechargeRegistryEntry | undefined {
    // Search from end to find latest
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].referenceId === referenceId) {
        return this.entries[i];
      }
    }
    return undefined;
  }

  /**
   * Find entry by external reference ID.
   */
  findByExternalReference(externalRefId: string): ManualRechargeRegistryEntry | undefined {
    return this.entriesByExtRef.get(externalRefId);
  }

  /**
   * Query entries with filters.
   */
  query(options: RegistryQueryOptions = {}): readonly ManualRechargeRegistryEntry[] {
    let results = [...this.entries];

    // Apply filters
    if (options.status !== undefined) {
      results = results.filter(e => e.status === options.status);
    }

    if (options.clubId !== undefined) {
      results = results.filter(e => e.declaration.clubId === options.clubId);
    }

    if (options.playerId !== undefined) {
      results = results.filter(e => e.declaration.playerId === options.playerId);
    }

    if (options.fromTimestamp !== undefined) {
      results = results.filter(e => e.createdAt >= options.fromTimestamp!);
    }

    if (options.toTimestamp !== undefined) {
      results = results.filter(e => e.createdAt <= options.toTimestamp!);
    }

    // Apply pagination
    if (options.offset !== undefined && options.offset > 0) {
      results = results.slice(options.offset);
    }

    if (options.limit !== undefined && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return Object.freeze(results);
  }

  /**
   * Get all entries (read-only).
   */
  getAllEntries(): readonly ManualRechargeRegistryEntry[] {
    return Object.freeze([...this.entries]);
  }

  /**
   * Get registry state snapshot.
   */
  getState(): RegistryState {
    return Object.freeze({
      entries: Object.freeze([...this.entries]),
      headHash: this.headHash,
      currentSequence: this.currentSequence,
      entryCount: this.entries.length,
    });
  }

  /**
   * Verify chain integrity.
   */
  verifyChainIntegrity(): RechargeResult<boolean> {
    if (this.entries.length === 0) {
      return rechargeSuccess(true);
    }

    // Verify first entry links to genesis
    if (this.entries[0].previousHash !== GENESIS_HASH) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.CHAIN_BROKEN,
          'First entry does not link to genesis hash',
          { entryId: this.entries[0].entryId }
        )
      );
    }

    // Verify each entry's hash and chain
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      // Recompute hash
      const entryWithoutHash: Omit<ManualRechargeRegistryEntry, 'entryHash'> = {
        entryId: entry.entryId,
        referenceId: entry.referenceId,
        status: entry.status,
        declaration: entry.declaration,
        previousHash: entry.previousHash,
        sequenceNumber: entry.sequenceNumber,
        createdAt: entry.createdAt,
        linkedGreyFlowIds: entry.linkedGreyFlowIds,
        confirmation: entry.confirmation,
      };
      const computedHash = computeEntryHash(entryWithoutHash);

      if (computedHash !== entry.entryHash) {
        return rechargeFailure(
          createRechargeError(
            RechargeErrorCode.HASH_MISMATCH,
            `Hash mismatch at entry ${i}`,
            { entryId: entry.entryId, expected: entry.entryHash, computed: computedHash }
          )
        );
      }

      // Verify chain link (except first entry)
      if (i > 0 && entry.previousHash !== this.entries[i - 1].entryHash) {
        return rechargeFailure(
          createRechargeError(
            RechargeErrorCode.CHAIN_BROKEN,
            `Chain broken at entry ${i}`,
            { entryId: entry.entryId, previousHash: entry.previousHash }
          )
        );
      }
    }

    return rechargeSuccess(true);
  }

  /**
   * Validate status transition.
   */
  private validateStatusTransition(
    from: DeclarationStatus,
    to: DeclarationStatus
  ): RechargeResult<void> {
    const validTransitions: Record<DeclarationStatus, DeclarationStatus[]> = {
      [DeclarationStatus.DECLARED]: [DeclarationStatus.LINKED, DeclarationStatus.REJECTED],
      [DeclarationStatus.LINKED]: [DeclarationStatus.CONFIRMED, DeclarationStatus.REJECTED],
      [DeclarationStatus.CONFIRMED]: [],
      [DeclarationStatus.REJECTED]: [],
    };

    if (!validTransitions[from].includes(to)) {
      return rechargeFailure(
        createRechargeError(
          RechargeErrorCode.INVALID_STATUS,
          `Invalid status transition: ${from} -> ${to}`,
          { from, to }
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
 * Create a new manual recharge registry.
 */
export function createManualRechargeRegistry(): ManualRechargeRegistry {
  return new ManualRechargeRegistry();
}

/**
 * Reset registry for testing only.
 * NOT for production use.
 */
export function createTestRegistry(): ManualRechargeRegistry {
  return new ManualRechargeRegistry();
}
