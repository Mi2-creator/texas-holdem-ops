/**
 * RiskBoundaryGuards.ts
 *
 * Boundary guards for OPS-3 risk analysis operations.
 *
 * ANALYSIS-ONLY: This module observes and flags, NEVER enforces or blocks.
 * READ-ONLY: No modifications to any data.
 * NO ENFORCEMENT: No automated blocking, no auto-adjust, no side effects.
 * NO ENGINE IMPORTS: Completely isolated from engine internals.
 * NO MUTATIONS: All operations are read-only analysis.
 *
 * CRITICAL GUARANTEES:
 * - OPS-3 CANNOT block anything
 * - OPS-3 CANNOT execute anything
 * - OPS-3 CANNOT auto-adjust anything
 * - OPS-3 CANNOT mutate anything
 * - OPS-3 can ONLY observe, analyze, and flag for human review
 */

import {
  type RiskRule,
  type RiskRuleInput,
  type RiskResult,
  RiskErrorCode,
  riskSuccess,
  riskFailure,
  createRiskError,
  isValidThreshold,
} from './RiskLimitTypes';

// ============================================================================
// FORBIDDEN CONCEPTS
// ============================================================================

/**
 * Forbidden concepts in risk operations.
 *
 * These terms MUST NOT appear in any risk-related code, data, or output.
 */
export const RISK_FORBIDDEN_CONCEPTS = Object.freeze([
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

  // Enforcement-related (CRITICAL: OPS-3 cannot enforce)
  'execute',
  'auto-adjust',
  'auto-block',
  'enforce',
  'block',
  'reject',
  'deny',
  'prevent',
  'stop',
  'halt',
  'disable',
  'suspend',
  'terminate',
  'kill',
] as const);

export type RiskForbiddenConcept = (typeof RISK_FORBIDDEN_CONCEPTS)[number];

/**
 * Forbidden function patterns in risk operations.
 */
export const RISK_FORBIDDEN_FUNCTION_PATTERNS = Object.freeze([
  /^execute[A-Z]/,
  /^block[A-Z]/,
  /^enforce[A-Z]/,
  /^autoAdjust/,
  /^autoBlock/,
  /^reject[A-Z]/,
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
] as const);

// ============================================================================
// FORBIDDEN CONCEPT GUARDS
// ============================================================================

/**
 * Assert no forbidden concepts in text.
 */
export function assertNoRiskForbiddenConcepts(text: string): RiskResult<void> {
  const textLower = text.toLowerCase();

  for (const concept of RISK_FORBIDDEN_CONCEPTS) {
    // Handle hyphenated concepts
    const conceptNormalized = concept.replace('-', '');
    if (textLower.includes(concept) || textLower.includes(conceptNormalized)) {
      return riskFailure(
        createRiskError(
          RiskErrorCode.FORBIDDEN_CONCEPT,
          `Forbidden concept detected: "${concept}"`,
          { concept, location: findConceptLocation(text, concept) }
        )
      );
    }
  }

  return riskSuccess(undefined);
}

/**
 * Assert no forbidden function names.
 */
export function assertNoRiskForbiddenFunctions(
  functionNames: readonly string[]
): RiskResult<void> {
  for (const name of functionNames) {
    for (const pattern of RISK_FORBIDDEN_FUNCTION_PATTERNS) {
      if (pattern.test(name)) {
        return riskFailure(
          createRiskError(
            RiskErrorCode.FORBIDDEN_CONCEPT,
            `Forbidden function pattern detected: "${name}"`,
            { functionName: name, pattern: pattern.source }
          )
        );
      }
    }
  }

  return riskSuccess(undefined);
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
// ENFORCEMENT PREVENTION GUARDS
// ============================================================================

/**
 * Assert that an operation is analysis-only (no enforcement).
 *
 * CRITICAL: OPS-3 CANNOT enforce, block, or execute anything.
 */
export function assertAnalysisOnly(operationDescription: string): RiskResult<void> {
  const enforcementTerms = [
    'enforce', 'block', 'reject', 'deny', 'prevent', 'stop', 'halt',
    'disable', 'suspend', 'terminate', 'execute', 'auto-adjust', 'auto-block',
  ];

  const descLower = operationDescription.toLowerCase();

  for (const term of enforcementTerms) {
    if (descLower.includes(term)) {
      return riskFailure(
        createRiskError(
          RiskErrorCode.ENFORCEMENT_FORBIDDEN,
          `Enforcement operation forbidden: "${term}" detected in "${operationDescription}"`,
          { term, operation: operationDescription }
        )
      );
    }
  }

  return riskSuccess(undefined);
}

/**
 * Assert that a flag is output-only (not an action).
 *
 * Flags are for human review, not automated actions.
 */
export function assertFlagIsOutputOnly(flagDescription: string): RiskResult<void> {
  // Check that the flag description doesn't imply action
  const actionTerms = ['will block', 'will reject', 'will prevent', 'will stop', 'blocking', 'rejecting'];

  const descLower = flagDescription.toLowerCase();

  for (const term of actionTerms) {
    if (descLower.includes(term)) {
      return riskFailure(
        createRiskError(
          RiskErrorCode.ENFORCEMENT_FORBIDDEN,
          `Flag description implies action: "${term}". Flags are for observation only.`,
          { term, description: flagDescription }
        )
      );
    }
  }

  return riskSuccess(undefined);
}

// ============================================================================
// INPUT VALIDATION GUARDS
// ============================================================================

/**
 * Assert valid risk rule input.
 */
export function assertValidRiskRuleInput(input: RiskRuleInput): RiskResult<void> {
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    return riskFailure(
      createRiskError(RiskErrorCode.INVALID_INPUT, 'Rule name must be a non-empty string')
    );
  }

  if (!input.description || typeof input.description !== 'string') {
    return riskFailure(
      createRiskError(RiskErrorCode.INVALID_INPUT, 'Rule description must be a string')
    );
  }

  // Check description for forbidden concepts
  const descResult = assertNoRiskForbiddenConcepts(input.description);
  if (!descResult.success) {
    return descResult;
  }

  // Check description for enforcement language
  const analysisResult = assertAnalysisOnly(input.description);
  if (!analysisResult.success) {
    return analysisResult;
  }

  if (!isValidThreshold(input.threshold)) {
    return riskFailure(
      createRiskError(RiskErrorCode.INVALID_THRESHOLD, 'Invalid threshold definition')
    );
  }

  if (!Number.isInteger(input.timestamp) || input.timestamp <= 0) {
    return riskFailure(
      createRiskError(RiskErrorCode.INVALID_INPUT, 'Timestamp must be a positive integer')
    );
  }

  return riskSuccess(undefined);
}

/**
 * Assert rule is frozen (immutable).
 */
export function assertRuleFrozen(rule: RiskRule): RiskResult<void> {
  if (!Object.isFrozen(rule)) {
    return riskFailure(
      createRiskError(
        RiskErrorCode.INVALID_INPUT,
        'Rule must be frozen/immutable',
        { ruleId: rule.ruleId }
      )
    );
  }

  if (!Object.isFrozen(rule.threshold)) {
    return riskFailure(
      createRiskError(
        RiskErrorCode.INVALID_INPUT,
        'Rule threshold must be frozen/immutable',
        { ruleId: rule.ruleId }
      )
    );
  }

  return riskSuccess(undefined);
}

// ============================================================================
// COMPOSITE GUARDS
// ============================================================================

/**
 * Guard risk rule registration.
 */
export function guardRiskRuleRegistration(input: RiskRuleInput): RiskResult<void> {
  return assertValidRiskRuleInput(input);
}

// ============================================================================
// BOUNDARY DECLARATION
// ============================================================================

/**
 * OPS-3 Risk Analysis Boundary Declaration
 *
 * CRITICAL GUARANTEES:
 * - analysisOnly: TRUE - This module ONLY analyzes, NEVER enforces
 * - canBlock: FALSE - This module CANNOT block anything
 * - canExecute: FALSE - This module CANNOT execute anything
 * - canAutoAdjust: FALSE - This module CANNOT auto-adjust anything
 * - canMutate: FALSE - This module CANNOT mutate anything
 */
export const RISK_BOUNDARY_DECLARATION = Object.freeze({
  module: 'OPS-3: Risk Analysis',
  version: '1.0.0',

  // CRITICAL CAPABILITY DECLARATIONS
  capabilities: Object.freeze({
    /** This module can ONLY analyze and flag */
    analysisOnly: true,
    /** This module can ONLY read, never write */
    readOnly: true,
    /** Output is flags for human review only */
    outputFlagsOnly: true,
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
    /** CANNOT reject any operations */
    canReject: false,
    /** CANNOT access engine internals */
    canAccessEngine: false,
    /** CANNOT process any money concepts */
    canProcessMoney: false,
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
  }),

  // Forbidden concepts
  forbiddenConcepts: RISK_FORBIDDEN_CONCEPTS,
  forbiddenFunctionPatterns: RISK_FORBIDDEN_FUNCTION_PATTERNS,

  // Explicit statement
  explicitStatement: Object.freeze({
    purpose: 'Risk analysis and flagging for human review',
    limitation: 'This module CANNOT block, execute, auto-adjust, or mutate anything',
    output: 'Flags and summaries for human observation only',
    enforcement: 'NO ENFORCEMENT CAPABILITY - humans must take action if needed',
  }),
}) as {
  readonly module: string;
  readonly version: string;
  readonly capabilities: Readonly<{
    readonly analysisOnly: true;
    readonly readOnly: true;
    readonly outputFlagsOnly: true;
  }>;
  readonly cannotDo: Readonly<{
    readonly canBlock: false;
    readonly canExecute: false;
    readonly canAutoAdjust: false;
    readonly canAutoBlock: false;
    readonly canMutate: false;
    readonly canEnforce: false;
    readonly canReject: false;
    readonly canAccessEngine: false;
    readonly canProcessMoney: false;
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
  }>;
  readonly forbiddenConcepts: typeof RISK_FORBIDDEN_CONCEPTS;
  readonly forbiddenFunctionPatterns: typeof RISK_FORBIDDEN_FUNCTION_PATTERNS;
  readonly explicitStatement: Readonly<{
    readonly purpose: string;
    readonly limitation: string;
    readonly output: string;
    readonly enforcement: string;
  }>;
};
