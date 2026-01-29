/**
 * ExecutionIntentBoundaryGuards.ts
 *
 * Boundary guards for execution intent module design constraints.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - VALIDATION ONLY: Guards validate, they do NOT enforce
 * - READ-ONLY: Guards inspect, they do NOT modify
 * - PASSIVE: Guards return results, they do NOT block or throw
 *
 * FORBIDDEN CONCEPTS (this module helps detect violations):
 * - Status transitions / state machines
 * - Execution / trigger / dispatch / invoke
 * - Push / emit / notify / broadcast
 * - Block / enforce / prevent
 * - Workflow / lifecycle / pipeline
 * - Engine imports
 */

import {
  type IntentResult,
  IntentErrorCode,
  intentSuccess,
  intentFailure,
  createIntentError,
} from './ExecutionIntentTypes';

// ============================================================================
// FORBIDDEN CONCEPT LISTS
// ============================================================================

/**
 * Forbidden keywords that indicate execution semantics
 */
export const FORBIDDEN_EXECUTION_KEYWORDS = Object.freeze([
  'execute',
  'trigger',
  'dispatch',
  'invoke',
  'run',
  'start',
  'launch',
  'fire',
  'activate',
  'initiate',
] as const);

/**
 * Forbidden keywords that indicate push semantics
 */
export const FORBIDDEN_PUSH_KEYWORDS = Object.freeze([
  'push',
  'emit',
  'notify',
  'broadcast',
  'send',
  'publish',
  'signal',
  'alert',
] as const);

/**
 * Forbidden keywords that indicate blocking semantics
 */
export const FORBIDDEN_BLOCKING_KEYWORDS = Object.freeze([
  'block',
  'prevent',
  'enforce',
  'restrict',
  'deny',
  'reject',
  'forbid',
  'halt',
  'stop',
] as const);

/**
 * Forbidden keywords that indicate state machine semantics
 */
export const FORBIDDEN_STATE_MACHINE_KEYWORDS = Object.freeze([
  'status',
  'state',
  'transition',
  'lifecycle',
  'workflow',
  'pipeline',
  'stage',
  'phase',
  'pending',
  'processing',
  'failed',
  'success',
] as const);

/**
 * Forbidden import sources
 */
export const FORBIDDEN_IMPORT_SOURCES = Object.freeze([
  'engine',
  'game',
  'execution',
  'processor',
  'handler',
  'controller',
  'service',
  'worker',
] as const);

// ============================================================================
// BOUNDARY GUARD TYPES
// ============================================================================

/**
 * Boundary Violation - describes a design constraint violation
 */
export interface BoundaryViolation {
  /** Type of violation */
  readonly violationType: 'EXECUTION' | 'PUSH' | 'BLOCKING' | 'STATE_MACHINE' | 'FORBIDDEN_IMPORT';
  /** The offending keyword or concept */
  readonly keyword: string;
  /** Location or context of the violation */
  readonly context?: string;
}

/**
 * Boundary Check Result
 */
export interface BoundaryCheckResult {
  /** Whether the check passed (no violations) */
  readonly passed: boolean;
  /** List of violations found */
  readonly violations: readonly BoundaryViolation[];
  /** Total violation count */
  readonly violationCount: number;
}

// ============================================================================
// BOUNDARY GUARD FUNCTIONS
// ============================================================================

/**
 * Check text for forbidden execution keywords.
 *
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkForExecutionKeywords(text: string): BoundaryCheckResult {
  const violations: BoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of FORBIDDEN_EXECUTION_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      violations.push({
        violationType: 'EXECUTION',
        keyword,
        context: `Found "${keyword}" in text`,
      });
    }
  }

  return Object.freeze({
    passed: violations.length === 0,
    violations: Object.freeze(violations),
    violationCount: violations.length,
  });
}

/**
 * Check text for forbidden push keywords.
 *
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkForPushKeywords(text: string): BoundaryCheckResult {
  const violations: BoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of FORBIDDEN_PUSH_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      violations.push({
        violationType: 'PUSH',
        keyword,
        context: `Found "${keyword}" in text`,
      });
    }
  }

  return Object.freeze({
    passed: violations.length === 0,
    violations: Object.freeze(violations),
    violationCount: violations.length,
  });
}

/**
 * Check text for forbidden blocking keywords.
 *
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkForBlockingKeywords(text: string): BoundaryCheckResult {
  const violations: BoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of FORBIDDEN_BLOCKING_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      violations.push({
        violationType: 'BLOCKING',
        keyword,
        context: `Found "${keyword}" in text`,
      });
    }
  }

  return Object.freeze({
    passed: violations.length === 0,
    violations: Object.freeze(violations),
    violationCount: violations.length,
  });
}

/**
 * Check text for forbidden state machine keywords.
 *
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkForStateMachineKeywords(text: string): BoundaryCheckResult {
  const violations: BoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of FORBIDDEN_STATE_MACHINE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      violations.push({
        violationType: 'STATE_MACHINE',
        keyword,
        context: `Found "${keyword}" in text`,
      });
    }
  }

  return Object.freeze({
    passed: violations.length === 0,
    violations: Object.freeze(violations),
    violationCount: violations.length,
  });
}

/**
 * Check import path for forbidden sources.
 *
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkForForbiddenImport(importPath: string): BoundaryCheckResult {
  const violations: BoundaryViolation[] = [];
  const lowerPath = importPath.toLowerCase();

  for (const source of FORBIDDEN_IMPORT_SOURCES) {
    if (lowerPath.includes(source)) {
      violations.push({
        violationType: 'FORBIDDEN_IMPORT',
        keyword: source,
        context: `Found forbidden import source "${source}" in "${importPath}"`,
      });
    }
  }

  return Object.freeze({
    passed: violations.length === 0,
    violations: Object.freeze(violations),
    violationCount: violations.length,
  });
}

/**
 * Comprehensive boundary check.
 *
 * Checks text for all forbidden concepts.
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkAllBoundaries(text: string): BoundaryCheckResult {
  const allViolations: BoundaryViolation[] = [];

  const executionResult = checkForExecutionKeywords(text);
  const pushResult = checkForPushKeywords(text);
  const blockingResult = checkForBlockingKeywords(text);
  const stateMachineResult = checkForStateMachineKeywords(text);

  allViolations.push(...executionResult.violations);
  allViolations.push(...pushResult.violations);
  allViolations.push(...blockingResult.violations);
  allViolations.push(...stateMachineResult.violations);

  return Object.freeze({
    passed: allViolations.length === 0,
    violations: Object.freeze(allViolations),
    violationCount: allViolations.length,
  });
}

// ============================================================================
// ASSERTION HELPERS (FOR TESTING/VALIDATION)
// ============================================================================

/**
 * Assert no execution keywords.
 *
 * Returns IntentResult for consistent error handling.
 */
export function assertNoExecutionKeywords(text: string): IntentResult<boolean> {
  const result = checkForExecutionKeywords(text);
  if (!result.passed) {
    return intentFailure(
      createIntentError(
        IntentErrorCode.FORBIDDEN_CONCEPT,
        'Execution keywords detected',
        { violations: result.violations }
      )
    );
  }
  return intentSuccess(true);
}

/**
 * Assert no push keywords.
 *
 * Returns IntentResult for consistent error handling.
 */
export function assertNoPushKeywords(text: string): IntentResult<boolean> {
  const result = checkForPushKeywords(text);
  if (!result.passed) {
    return intentFailure(
      createIntentError(
        IntentErrorCode.FORBIDDEN_CONCEPT,
        'Push keywords detected',
        { violations: result.violations }
      )
    );
  }
  return intentSuccess(true);
}

/**
 * Assert no blocking keywords.
 *
 * Returns IntentResult for consistent error handling.
 */
export function assertNoBlockingKeywords(text: string): IntentResult<boolean> {
  const result = checkForBlockingKeywords(text);
  if (!result.passed) {
    return intentFailure(
      createIntentError(
        IntentErrorCode.FORBIDDEN_CONCEPT,
        'Blocking keywords detected',
        { violations: result.violations }
      )
    );
  }
  return intentSuccess(true);
}

/**
 * Assert no state machine keywords.
 *
 * Returns IntentResult for consistent error handling.
 */
export function assertNoStateMachineKeywords(text: string): IntentResult<boolean> {
  const result = checkForStateMachineKeywords(text);
  if (!result.passed) {
    return intentFailure(
      createIntentError(
        IntentErrorCode.FORBIDDEN_CONCEPT,
        'State machine keywords detected',
        { violations: result.violations }
      )
    );
  }
  return intentSuccess(true);
}

/**
 * Assert no forbidden imports.
 *
 * Returns IntentResult for consistent error handling.
 */
export function assertNoForbiddenImport(importPath: string): IntentResult<boolean> {
  const result = checkForForbiddenImport(importPath);
  if (!result.passed) {
    return intentFailure(
      createIntentError(
        IntentErrorCode.FORBIDDEN_CONCEPT,
        'Forbidden import source detected',
        { violations: result.violations }
      )
    );
  }
  return intentSuccess(true);
}

/**
 * Assert all boundaries are respected.
 *
 * Returns IntentResult for consistent error handling.
 */
export function assertAllBoundaries(text: string): IntentResult<boolean> {
  const result = checkAllBoundaries(text);
  if (!result.passed) {
    return intentFailure(
      createIntentError(
        IntentErrorCode.FORBIDDEN_CONCEPT,
        'Boundary violations detected',
        { violations: result.violations }
      )
    );
  }
  return intentSuccess(true);
}

// ============================================================================
// DESIGN CONSTRAINT DOCUMENTATION
// ============================================================================

/**
 * Module design constraints - for documentation and testing
 */
export const MODULE_DESIGN_CONSTRAINTS = Object.freeze({
  name: 'execution-intent',
  version: 'OPS-5',
  constraints: Object.freeze([
    'PASSIVE DATA LAYER: Stores data, does NOT execute anything',
    'PULL-BASED: External systems query this data, we never push',
    'RECOMMENDATION ONLY: Intents are recommendations, not orders',
    'HUMAN-ASSERTED: Reports are human-stated outcomes, not verified truth',
    'APPEND-ONLY: Records are never modified or deleted',
    'HASH-CHAINED: Each record links to the previous for audit integrity',
    'NO STATE MACHINES: No status transitions, no lifecycles, no workflows',
    'NO ENGINE IMPORTS: No dependencies on engine or execution modules',
    'NO EXECUTION: Cannot execute, trigger, dispatch, or cause any action',
    'NO PUSH: Cannot push notifications or emit events',
    'NO BLOCKING: Cannot enforce or block anything',
  ] as const),
  forbiddenConcepts: Object.freeze({
    execution: FORBIDDEN_EXECUTION_KEYWORDS,
    push: FORBIDDEN_PUSH_KEYWORDS,
    blocking: FORBIDDEN_BLOCKING_KEYWORDS,
    stateMachine: FORBIDDEN_STATE_MACHINE_KEYWORDS,
    imports: FORBIDDEN_IMPORT_SOURCES,
  }),
});
