/**
 * RiskAckBoundaryGuards.ts
 *
 * Boundary guards for OPS-4 risk acknowledgement operations.
 *
 * MANUAL-ONLY: This module records human acknowledgements only.
 * REFERENCE-ONLY: No money or value processing.
 * NO EXECUTION: Cannot block, execute, or trigger any action.
 * NO MUTATIONS: All operations are read-only analysis.
 * NO ENGINE IMPORTS: Completely isolated from engine internals.
 *
 * CRITICAL GUARANTEES:
 * - OPS-4 CANNOT block anything
 * - OPS-4 CANNOT execute anything
 * - OPS-4 CANNOT auto-adjust anything
 * - OPS-4 CANNOT mutate engine or ops data
 * - OPS-4 can ONLY record human acknowledgements
 */

import {
  type RiskAckInput,
  type RiskAckRecord,
  type AckResult,
  AckDecision,
  AckRole,
  AckErrorCode,
  ackSuccess,
  ackFailure,
  createAckError,
  isValidAckInput,
  canRoleEscalate,
} from './RiskAckTypes';

// ============================================================================
// FORBIDDEN CONCEPTS
// ============================================================================

/**
 * Forbidden concepts in acknowledgement operations.
 *
 * These terms MUST NOT appear in any ack-related code, data, or output.
 */
export const ACK_FORBIDDEN_CONCEPTS = Object.freeze([
  // Money-related
  'balance',
  'money',
  'payment',
  'wallet',
  'crypto',
  'transfer',
  'currency',
  'fund',
  'deposit',
  'withdraw',
  'debit',
  'credit',
  'transaction',
  'settlement',

  // Execution-related (CRITICAL: OPS-4 cannot execute)
  'execute',
  'auto-adjust',
  'auto-block',
  'enforce',
  'block',
  'reject-action', // Note: 'reject' as acknowledgement decision is OK
  'deny',
  'prevent',
  'stop',
  'halt',
  'disable',
  'suspend',
  'terminate',
  'kill',
  'trigger',
  'fire',
  'dispatch',
  'emit-action',
] as const);

export type AckForbiddenConcept = (typeof ACK_FORBIDDEN_CONCEPTS)[number];

/**
 * Forbidden function patterns in acknowledgement operations.
 */
export const ACK_FORBIDDEN_FUNCTION_PATTERNS = Object.freeze([
  /^execute[A-Z]/,
  /^block[A-Z]/,
  /^enforce[A-Z]/,
  /^autoAdjust/,
  /^autoBlock/,
  /^deny[A-Z]/,
  /^prevent[A-Z]/,
  /^stop[A-Z]/,
  /^halt[A-Z]/,
  /^disable[A-Z]/,
  /^suspend[A-Z]/,
  /^terminate[A-Z]/,
  /^updateBalance/,
  /^setBalance/,
  /^processPayment/,
  /^transferFunds/,
  /^trigger[A-Z]/,
  /^dispatch[A-Z]/,
  /^fireAction/,
] as const);

// ============================================================================
// FORBIDDEN CONCEPT GUARDS
// ============================================================================

/**
 * Assert no forbidden concepts in text.
 */
export function assertNoAckForbiddenConcepts(text: string): AckResult<void> {
  const textLower = text.toLowerCase();

  for (const concept of ACK_FORBIDDEN_CONCEPTS) {
    // Handle hyphenated concepts
    const conceptNormalized = concept.replace('-', '');
    if (textLower.includes(concept) || textLower.includes(conceptNormalized)) {
      return ackFailure(
        createAckError(
          AckErrorCode.FORBIDDEN_CONCEPT,
          `Forbidden concept detected: "${concept}"`,
          { concept, location: findConceptLocation(text, concept) }
        )
      );
    }
  }

  return ackSuccess(undefined);
}

/**
 * Assert no forbidden function names.
 */
export function assertNoAckForbiddenFunctions(
  functionNames: readonly string[]
): AckResult<void> {
  for (const name of functionNames) {
    for (const pattern of ACK_FORBIDDEN_FUNCTION_PATTERNS) {
      if (pattern.test(name)) {
        return ackFailure(
          createAckError(
            AckErrorCode.FORBIDDEN_CONCEPT,
            `Forbidden function pattern detected: "${name}"`,
            { functionName: name, pattern: pattern.source }
          )
        );
      }
    }
  }

  return ackSuccess(undefined);
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
// ACTION PREVENTION GUARDS
// ============================================================================

/**
 * Assert that an operation is manual-only (no automated action).
 *
 * CRITICAL: OPS-4 CANNOT execute, block, or trigger any action.
 */
export function assertManualOnly(operationDescription: string): AckResult<void> {
  const actionTerms = [
    'execute', 'block', 'deny', 'prevent', 'stop', 'halt',
    'disable', 'suspend', 'terminate', 'trigger', 'auto-adjust', 'auto-block',
    'enforce', 'dispatch', 'fire',
  ];

  const descLower = operationDescription.toLowerCase();

  for (const term of actionTerms) {
    if (descLower.includes(term)) {
      return ackFailure(
        createAckError(
          AckErrorCode.ACTION_FORBIDDEN,
          `Action operation forbidden: "${term}" detected in "${operationDescription}"`,
          { term, operation: operationDescription }
        )
      );
    }
  }

  return ackSuccess(undefined);
}

/**
 * Assert that acknowledgement is human-made (not automated).
 *
 * Acknowledgements must be from human actors, not automated systems.
 */
export function assertHumanAcknowledgement(actorId: string): AckResult<void> {
  const automatedPatterns = [
    /^system$/i,
    /^auto$/i,
    /^bot$/i,
    /^automated$/i,
    /^script$/i,
    /^cron$/i,
    /^scheduler$/i,
  ];

  for (const pattern of automatedPatterns) {
    if (pattern.test(actorId)) {
      return ackFailure(
        createAckError(
          AckErrorCode.ACTION_FORBIDDEN,
          `Automated acknowledgement forbidden: actorId "${actorId}" appears to be automated`,
          { actorId }
        )
      );
    }
  }

  return ackSuccess(undefined);
}

// ============================================================================
// INPUT VALIDATION GUARDS
// ============================================================================

/**
 * Assert valid acknowledgement input.
 */
export function assertValidAckInput(input: RiskAckInput): AckResult<void> {
  if (!isValidAckInput(input)) {
    return ackFailure(
      createAckError(AckErrorCode.INVALID_INPUT, 'Invalid acknowledgement input')
    );
  }

  // Check comment for forbidden concepts (if present)
  if (input.comment) {
    const conceptResult = assertNoAckForbiddenConcepts(input.comment);
    if (!conceptResult.success) {
      return conceptResult;
    }
  }

  // Assert human acknowledgement
  const humanResult = assertHumanAcknowledgement(input.actorId);
  if (!humanResult.success) {
    return humanResult;
  }

  return ackSuccess(undefined);
}

/**
 * Assert record is frozen (immutable).
 */
export function assertAckRecordFrozen(record: RiskAckRecord): AckResult<void> {
  if (!Object.isFrozen(record)) {
    return ackFailure(
      createAckError(
        AckErrorCode.INVALID_INPUT,
        'Record must be frozen/immutable',
        { ackId: record.ackId }
      )
    );
  }

  return ackSuccess(undefined);
}

/**
 * Assert escalation is valid for role.
 *
 * Only non-ADMIN roles can escalate.
 */
export function assertCanEscalate(role: AckRole): AckResult<void> {
  if (!canRoleEscalate(role)) {
    return ackFailure(
      createAckError(
        AckErrorCode.INVALID_DECISION_FOR_ROLE,
        `Role "${role}" cannot escalate (highest authority level)`,
        { role }
      )
    );
  }

  return ackSuccess(undefined);
}

// ============================================================================
// COMPOSITE GUARDS
// ============================================================================

/**
 * Guard acknowledgement input.
 */
export function guardAckInput(input: RiskAckInput): AckResult<void> {
  // Validate basic input
  const validResult = assertValidAckInput(input);
  if (!validResult.success) {
    return validResult;
  }

  // Check escalation validity
  if (input.decision === AckDecision.ESCALATED) {
    const escalateResult = assertCanEscalate(input.actorRole);
    if (!escalateResult.success) {
      return escalateResult;
    }
  }

  return ackSuccess(undefined);
}

// ============================================================================
// BOUNDARY DECLARATION
// ============================================================================

/**
 * OPS-4 Risk Acknowledgement Boundary Declaration
 *
 * CRITICAL GUARANTEES:
 * - manualOnly: TRUE - This module records ONLY human acknowledgements
 * - canBlock: FALSE - This module CANNOT block anything
 * - canExecute: FALSE - This module CANNOT execute anything
 * - canAutoAdjust: FALSE - This module CANNOT auto-adjust anything
 * - canMutate: FALSE - This module CANNOT mutate anything
 */
export const ACK_BOUNDARY_DECLARATION = Object.freeze({
  module: 'OPS-4: Risk Acknowledgement',
  version: '1.0.0',

  // CRITICAL CAPABILITY DECLARATIONS
  capabilities: Object.freeze({
    /** This module records ONLY human acknowledgements */
    manualOnly: true,
    /** This module can ONLY read and append, never mutate */
    appendOnly: true,
    /** Output is acknowledgement records for audit only */
    auditOnly: true,
  }),

  // CRITICAL NEGATIVE DECLARATIONS (what this module CANNOT do)
  cannotDo: Object.freeze({
    /** CANNOT block any operation */
    canBlock: false,
    /** CANNOT execute any action */
    canExecute: false,
    /** CANNOT auto-adjust anything */
    canAutoAdjust: false,
    /** CANNOT auto-block anything */
    canAutoBlock: false,
    /** CANNOT mutate any data */
    canMutate: false,
    /** CANNOT enforce any rules */
    canEnforce: false,
    /** CANNOT trigger any actions */
    canTrigger: false,
    /** CANNOT access engine internals */
    canAccessEngine: false,
    /** CANNOT process any money concepts */
    canProcessMoney: false,
    /** CANNOT make automated acknowledgements */
    canAutoAcknowledge: false,
  }),

  // Constraints
  constraints: Object.freeze({
    referenceOnly: true,
    appendOnly: true,
    hashChained: true,
    deterministic: true,
    integerOnly: true,
    noMutation: true,
    noImplicitTime: true,
    noEngineImports: true,
    noSideEffects: true,
    noNetworkCalls: true,
    noAsyncEffects: true,
  }),

  // Forbidden concepts
  forbiddenConcepts: ACK_FORBIDDEN_CONCEPTS,
  forbiddenFunctionPatterns: ACK_FORBIDDEN_FUNCTION_PATTERNS,

  // Explicit statement
  explicitStatement: Object.freeze({
    purpose: 'Record human acknowledgement of risk signals for audit',
    limitation: 'This module CANNOT block, execute, auto-adjust, trigger, or mutate anything',
    output: 'Frozen acknowledgement records for audit trail only',
    action: 'NO ACTION CAPABILITY - records are purely observational',
    automation: 'NO AUTOMATION - all acknowledgements must be from human actors',
  }),
}) as {
  readonly module: string;
  readonly version: string;
  readonly capabilities: Readonly<{
    readonly manualOnly: true;
    readonly appendOnly: true;
    readonly auditOnly: true;
  }>;
  readonly cannotDo: Readonly<{
    readonly canBlock: false;
    readonly canExecute: false;
    readonly canAutoAdjust: false;
    readonly canAutoBlock: false;
    readonly canMutate: false;
    readonly canEnforce: false;
    readonly canTrigger: false;
    readonly canAccessEngine: false;
    readonly canProcessMoney: false;
    readonly canAutoAcknowledge: false;
  }>;
  readonly constraints: Readonly<{
    readonly referenceOnly: true;
    readonly appendOnly: true;
    readonly hashChained: true;
    readonly deterministic: true;
    readonly integerOnly: true;
    readonly noMutation: true;
    readonly noImplicitTime: true;
    readonly noEngineImports: true;
    readonly noSideEffects: true;
    readonly noNetworkCalls: true;
    readonly noAsyncEffects: true;
  }>;
  readonly forbiddenConcepts: typeof ACK_FORBIDDEN_CONCEPTS;
  readonly forbiddenFunctionPatterns: typeof ACK_FORBIDDEN_FUNCTION_PATTERNS;
  readonly explicitStatement: Readonly<{
    readonly purpose: string;
    readonly limitation: string;
    readonly output: string;
    readonly action: string;
    readonly automation: string;
  }>;
};
