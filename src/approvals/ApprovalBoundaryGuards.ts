/**
 * ApprovalBoundaryGuards.ts
 *
 * Boundary guards for OPS-2 approval operations.
 *
 * FORBIDDEN CONCEPTS: balance, money, payment, wallet, crypto, settlement, execute
 * NO MUTATION: All operations are append-only
 * NO CLOCK: Timestamps must be provided externally
 * NO ASYNC: All operations are synchronous
 * NO ENGINE IMPORTS: Completely isolated from engine internals
 */

import {
  type ActorId,
  type ApprovalRequestInput,
  type ApprovalDecisionInput,
  type ApprovalRequestRecord,
  type ApprovalResult,
  ApprovalStatus,
  ApprovalDecision,
  ApprovalErrorCode,
  approvalSuccess,
  approvalFailure,
  createApprovalError,
  isTerminalStatus,
} from './ApprovalTypes';

// ============================================================================
// FORBIDDEN CONCEPTS
// ============================================================================

/**
 * Forbidden concepts in approval operations.
 */
export const APPROVAL_FORBIDDEN_CONCEPTS = Object.freeze([
  'balance',
  'money',
  'payment',
  'wallet',
  'crypto',
  'settlement',
  'execute',
  'transfer',
  'deposit',
  'withdraw',
  'fund',
  'currency',
  'coin',
  'debit',
  'credit',
  'transaction',
] as const);

export type ApprovalForbiddenConcept = (typeof APPROVAL_FORBIDDEN_CONCEPTS)[number];

// ============================================================================
// TWO-MAN RULE GUARDS
// ============================================================================

/**
 * Assert two-man rule: decision actor must be different from creator.
 */
export function assertTwoManRule(
  creatorActorId: ActorId,
  decisionActorId: ActorId
): ApprovalResult<void> {
  if (creatorActorId === decisionActorId) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.SELF_APPROVAL_FORBIDDEN,
        'TWO-MAN RULE VIOLATION: Same actor cannot create and approve',
        { creatorActorId, decisionActorId }
      )
    );
  }
  return approvalSuccess(undefined);
}

/**
 * Assert actor can make decision on record.
 */
export function assertActorCanDecide(
  record: ApprovalRequestRecord,
  decisionActorId: ActorId
): ApprovalResult<void> {
  // Check terminal status
  if (isTerminalStatus(record.status)) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.ALREADY_TERMINAL,
        `Record is in terminal status: ${record.status}`,
        { approvalId: record.approvalId, status: record.status }
      )
    );
  }

  // Check two-man rule
  return assertTwoManRule(record.creatorActorId, decisionActorId);
}

// ============================================================================
// INPUT VALIDATION GUARDS
// ============================================================================

/**
 * Assert valid approval request input.
 */
export function assertValidApprovalRequestInput(
  input: ApprovalRequestInput
): ApprovalResult<void> {
  if (!input.rechargeReferenceId || typeof input.rechargeReferenceId !== 'string') {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'rechargeReferenceId must be a non-empty string'
      )
    );
  }

  if (!input.creatorActorId || typeof input.creatorActorId !== 'string') {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'creatorActorId must be a non-empty string'
      )
    );
  }

  if (!Number.isInteger(input.requestedAt) || input.requestedAt <= 0) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'requestedAt must be a positive integer timestamp'
      )
    );
  }

  // Check notes for forbidden concepts
  if (input.notes) {
    const forbiddenResult = assertNoForbiddenConcepts(input.notes);
    if (!forbiddenResult.success) {
      return forbiddenResult;
    }
  }

  return approvalSuccess(undefined);
}

/**
 * Assert valid approval decision input.
 */
export function assertValidApprovalDecisionInput(
  input: ApprovalDecisionInput
): ApprovalResult<void> {
  if (!input.approvalId || typeof input.approvalId !== 'string') {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'approvalId must be a non-empty string'
      )
    );
  }

  if (!input.decisionActorId || typeof input.decisionActorId !== 'string') {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'decisionActorId must be a non-empty string'
      )
    );
  }

  if (!input.decision || !Object.values(ApprovalDecision).includes(input.decision)) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        `decision must be one of: ${Object.values(ApprovalDecision).join(', ')}`
      )
    );
  }

  if (!Number.isInteger(input.decidedAt) || input.decidedAt <= 0) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'decidedAt must be a positive integer timestamp'
      )
    );
  }

  // Reason required for rejection
  if (input.decision === ApprovalDecision.REJECT) {
    if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length === 0) {
      return approvalFailure(
        createApprovalError(
          ApprovalErrorCode.INVALID_INPUT,
          'reason is required for rejection'
        )
      );
    }
  }

  // Check reason for forbidden concepts
  if (input.reason) {
    const forbiddenResult = assertNoForbiddenConcepts(input.reason);
    if (!forbiddenResult.success) {
      return forbiddenResult;
    }
  }

  return approvalSuccess(undefined);
}

// ============================================================================
// FORBIDDEN CONCEPT GUARDS
// ============================================================================

/**
 * Assert no forbidden concepts in text.
 */
export function assertNoForbiddenConcepts(text: string): ApprovalResult<void> {
  const textLower = text.toLowerCase();

  for (const concept of APPROVAL_FORBIDDEN_CONCEPTS) {
    if (textLower.includes(concept)) {
      return approvalFailure(
        createApprovalError(
          ApprovalErrorCode.FORBIDDEN_CONCEPT,
          `Forbidden concept detected: "${concept}"`,
          { concept, location: findConceptLocation(text, concept) }
        )
      );
    }
  }

  return approvalSuccess(undefined);
}

/**
 * Find location of concept in text.
 */
function findConceptLocation(text: string, concept: string): string {
  const index = text.toLowerCase().indexOf(concept);
  if (index === -1) return concept;

  const start = Math.max(0, index - 15);
  const end = Math.min(text.length, index + concept.length + 15);
  return `...${text.slice(start, end)}...`;
}

// ============================================================================
// IMMUTABILITY GUARDS
// ============================================================================

/**
 * Assert record is frozen (immutable).
 */
export function assertRecordFrozen(record: ApprovalRequestRecord): ApprovalResult<void> {
  if (!Object.isFrozen(record)) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'Record must be frozen/immutable',
        { approvalId: record.approvalId }
      )
    );
  }

  if (record.decision && !Object.isFrozen(record.decision)) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_INPUT,
        'Record decision must be frozen/immutable',
        { approvalId: record.approvalId }
      )
    );
  }

  return approvalSuccess(undefined);
}

// ============================================================================
// STATUS TRANSITION GUARDS
// ============================================================================

/**
 * Assert valid status transition.
 */
export function assertValidStatusTransition(
  from: ApprovalStatus,
  to: ApprovalStatus
): ApprovalResult<void> {
  const validTransitions: Record<ApprovalStatus, ApprovalStatus[]> = {
    [ApprovalStatus.PENDING]: [ApprovalStatus.CONFIRMED, ApprovalStatus.REJECTED],
    [ApprovalStatus.CONFIRMED]: [], // Terminal
    [ApprovalStatus.REJECTED]: [],  // Terminal
  };

  if (!validTransitions[from].includes(to)) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.INVALID_STATUS,
        `Invalid status transition: ${from} -> ${to}`,
        { from, to, validTargets: validTransitions[from] }
      )
    );
  }

  return approvalSuccess(undefined);
}

/**
 * Assert not terminal status.
 */
export function assertNotTerminal(status: ApprovalStatus): ApprovalResult<void> {
  if (isTerminalStatus(status)) {
    return approvalFailure(
      createApprovalError(
        ApprovalErrorCode.ALREADY_TERMINAL,
        `Cannot modify record in terminal status: ${status}`,
        { status }
      )
    );
  }

  return approvalSuccess(undefined);
}

// ============================================================================
// COMPOSITE GUARDS
// ============================================================================

/**
 * Guard approval request - run all validations.
 */
export function guardApprovalRequest(
  input: ApprovalRequestInput
): ApprovalResult<void> {
  return assertValidApprovalRequestInput(input);
}

/**
 * Guard approval decision - run all validations.
 */
export function guardApprovalDecision(
  input: ApprovalDecisionInput,
  record: ApprovalRequestRecord
): ApprovalResult<void> {
  // Validate input
  const inputResult = assertValidApprovalDecisionInput(input);
  if (!inputResult.success) {
    return inputResult;
  }

  // Check actor can decide (includes two-man rule)
  const actorResult = assertActorCanDecide(record, input.decisionActorId);
  if (!actorResult.success) {
    return actorResult;
  }

  return approvalSuccess(undefined);
}

// ============================================================================
// BOUNDARY DECLARATION
// ============================================================================

/**
 * OPS-2 Approval Boundary Declaration
 */
export const APPROVAL_BOUNDARY_DECLARATION = Object.freeze({
  module: 'OPS-2: Approval',
  version: '1.0.0',
  constraints: Object.freeze({
    referenceOnly: true,
    appendOnly: true,
    hashChained: true,
    idempotent: true,
    twoManRule: true,
    deterministic: true,
    integerOnly: true,
    noMutation: true,
    noClock: true,
    noAsync: true,
    noEngineImports: true,
  }),
  forbiddenConcepts: APPROVAL_FORBIDDEN_CONCEPTS,
}) as {
  readonly module: string;
  readonly version: string;
  readonly constraints: Readonly<{
    readonly referenceOnly: true;
    readonly appendOnly: true;
    readonly hashChained: true;
    readonly idempotent: true;
    readonly twoManRule: true;
    readonly deterministic: true;
    readonly integerOnly: true;
    readonly noMutation: true;
    readonly noClock: true;
    readonly noAsync: true;
    readonly noEngineImports: true;
  }>;
  readonly forbiddenConcepts: typeof APPROVAL_FORBIDDEN_CONCEPTS;
};
