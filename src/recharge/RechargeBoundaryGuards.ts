/**
 * RechargeBoundaryGuards.ts
 *
 * Additional boundary guards specific to manual recharge operations.
 *
 * REFERENCE-ONLY: All guards enforce reference-only operations.
 * NO MONEY: Guards prevent any money-related operations.
 * APPEND-ONLY: Guards enforce immutability.
 */

import {
  type OpsResult,
  OpsErrorCode,
  opsSuccess,
  opsFailure,
  createOpsError,
} from '../ops-config';

import {
  type ManualRechargeDeclarationInput,
  type ManualRechargeRegistryEntry,
  DeclarationStatus,
} from './ManualRechargeTypes';

// ============================================================================
// RECHARGE-SPECIFIC GUARDS
// ============================================================================

/**
 * Assert that declaredAmount is a reference, not money.
 * This is a semantic guard - the value must be treated as a reference quantity.
 */
export function assertReferenceAmount(
  amount: number,
  label: string = 'declaredAmount'
): OpsResult<number> {
  // Must be a positive integer
  if (!Number.isInteger(amount) || amount <= 0) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.INVALID_INPUT,
        `${label} must be a positive integer reference, got ${amount}`
      )
    );
  }

  // Warn about large values (but don't fail)
  // This is a sanity check, not a hard limit
  if (amount > 999999999) {
    // Log or track unusually large reference amounts
    // but don't fail - this is just a safety measure
  }

  return opsSuccess(amount);
}

/**
 * Assert that input has no money-related metadata.
 */
export function assertNoMoneyMetadata(
  input: ManualRechargeDeclarationInput,
  label: string = 'input'
): OpsResult<void> {
  const notes = input.notes?.toLowerCase() || '';

  const moneyTerms = [
    'usd', 'usdt', 'usdc', 'dollar', 'cent', 'euro', 'eur',
    'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'coin',
    'payment', 'pay', 'transfer', 'send', 'deposit', 'withdraw',
  ];

  for (const term of moneyTerms) {
    if (notes.includes(term)) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.FORBIDDEN_CONCEPT,
          `${label} notes contain forbidden money term: "${term}"`
        )
      );
    }
  }

  return opsSuccess(undefined);
}

/**
 * Assert that a status transition is valid.
 */
export function assertValidStatusTransition(
  from: DeclarationStatus,
  to: DeclarationStatus
): OpsResult<void> {
  const validTransitions: Record<DeclarationStatus, DeclarationStatus[]> = {
    [DeclarationStatus.DECLARED]: [DeclarationStatus.LINKED, DeclarationStatus.REJECTED],
    [DeclarationStatus.LINKED]: [DeclarationStatus.CONFIRMED, DeclarationStatus.REJECTED],
    [DeclarationStatus.CONFIRMED]: [], // Terminal state
    [DeclarationStatus.REJECTED]: [],  // Terminal state
  };

  if (!validTransitions[from].includes(to)) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.INVALID_STATUS_TRANSITION,
        `Invalid status transition: ${from} -> ${to}. Valid transitions from ${from}: ${validTransitions[from].join(', ') || 'none'}`
      )
    );
  }

  return opsSuccess(undefined);
}

/**
 * Assert that an entry has not been mutated.
 */
export function assertEntryIntegrity(
  entry: ManualRechargeRegistryEntry,
  label: string = 'entry'
): OpsResult<void> {
  // All required fields must be present
  if (!entry.entryId) {
    return opsFailure(
      createOpsError(OpsErrorCode.INVALID_INPUT, `${label} missing entryId`)
    );
  }

  if (!entry.referenceId) {
    return opsFailure(
      createOpsError(OpsErrorCode.INVALID_INPUT, `${label} missing referenceId`)
    );
  }

  if (!entry.declaration) {
    return opsFailure(
      createOpsError(OpsErrorCode.INVALID_INPUT, `${label} missing declaration`)
    );
  }

  if (!entry.entryHash) {
    return opsFailure(
      createOpsError(OpsErrorCode.INVALID_INPUT, `${label} missing entryHash`)
    );
  }

  if (!entry.previousHash) {
    return opsFailure(
      createOpsError(OpsErrorCode.INVALID_INPUT, `${label} missing previousHash`)
    );
  }

  // Sequence number must be positive
  if (!Number.isInteger(entry.sequenceNumber) || entry.sequenceNumber <= 0) {
    return opsFailure(
      createOpsError(OpsErrorCode.INVALID_INPUT, `${label} has invalid sequenceNumber`)
    );
  }

  return opsSuccess(undefined);
}

/**
 * Assert that an entry is frozen (immutable).
 */
export function assertEntryFrozen(
  entry: ManualRechargeRegistryEntry,
  label: string = 'entry'
): OpsResult<void> {
  if (!Object.isFrozen(entry)) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.BOUNDARY_VIOLATION,
        `${label} must be frozen/immutable`
      )
    );
  }

  if (!Object.isFrozen(entry.declaration)) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.BOUNDARY_VIOLATION,
        `${label}.declaration must be frozen/immutable`
      )
    );
  }

  if (!Object.isFrozen(entry.linkedGreyFlowIds)) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.BOUNDARY_VIOLATION,
        `${label}.linkedGreyFlowIds must be frozen/immutable`
      )
    );
  }

  return opsSuccess(undefined);
}

// ============================================================================
// LINKING GUARDS
// ============================================================================

/**
 * Assert that Grey flow IDs are valid references.
 */
export function assertValidGreyFlowIds(
  flowIds: readonly string[],
  label: string = 'greyFlowIds'
): OpsResult<void> {
  if (!flowIds || flowIds.length === 0) {
    return opsFailure(
      createOpsError(OpsErrorCode.INVALID_INPUT, `${label} must have at least one flow ID`)
    );
  }

  for (const flowId of flowIds) {
    if (!flowId || typeof flowId !== 'string' || flowId.trim().length === 0) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, `${label} contains invalid flow ID`)
      );
    }
  }

  return opsSuccess(undefined);
}

/**
 * Assert that linking does not create a cycle.
 */
export function assertNoLinkingCycle(
  existingLinks: readonly string[],
  newFlowIds: readonly string[],
  label: string = 'linking'
): OpsResult<void> {
  const existingSet = new Set(existingLinks);

  for (const flowId of newFlowIds) {
    if (existingSet.has(flowId)) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.INVALID_INPUT,
          `${label}: flow ID "${flowId}" is already linked`
        )
      );
    }
  }

  return opsSuccess(undefined);
}

// ============================================================================
// CHAIN INTEGRITY GUARDS
// ============================================================================

/**
 * Assert that chain has valid genesis.
 */
export function assertValidGenesis(
  firstEntryPreviousHash: string,
  genesisHash: string,
  label: string = 'chain'
): OpsResult<void> {
  if (firstEntryPreviousHash !== genesisHash) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.BOUNDARY_VIOLATION,
        `${label} does not start with genesis hash`
      )
    );
  }

  return opsSuccess(undefined);
}

/**
 * Assert that chain link is valid.
 */
export function assertValidChainLink(
  currentPreviousHash: string,
  previousEntryHash: string,
  label: string = 'chain'
): OpsResult<void> {
  if (currentPreviousHash !== previousEntryHash) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.BOUNDARY_VIOLATION,
        `${label} has broken link: expected ${previousEntryHash}, got ${currentPreviousHash}`
      )
    );
  }

  return opsSuccess(undefined);
}

// ============================================================================
// COMPOSITE GUARDS
// ============================================================================

/**
 * Run all guards on a declaration input.
 */
export function guardDeclarationInput(
  input: ManualRechargeDeclarationInput
): OpsResult<void> {
  // Check reference amount
  const amountResult = assertReferenceAmount(input.declaredAmount);
  if (!amountResult.success) {
    return amountResult as OpsResult<void>;
  }

  // Check for money metadata
  const metadataResult = assertNoMoneyMetadata(input);
  if (!metadataResult.success) {
    return metadataResult;
  }

  return opsSuccess(undefined);
}

/**
 * Run all guards on a registry entry.
 */
export function guardRegistryEntry(
  entry: ManualRechargeRegistryEntry
): OpsResult<void> {
  // Check integrity
  const integrityResult = assertEntryIntegrity(entry);
  if (!integrityResult.success) {
    return integrityResult;
  }

  // Check frozen
  const frozenResult = assertEntryFrozen(entry);
  if (!frozenResult.success) {
    return frozenResult;
  }

  return opsSuccess(undefined);
}
