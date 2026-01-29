/**
 * GreyFlowBoundaryGuards.ts
 *
 * Boundary guards for grey flow module design constraints.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - VALIDATION ONLY: Guards validate, they do NOT enforce
 * - READ-ONLY: Guards inspect, they do NOT modify
 * - PASSIVE: Guards return results, they do NOT block or throw
 *
 * FORBIDDEN CONCEPTS (this module helps detect violations):
 * - Money / balance / wallet / payment / crypto / transfer / settlement
 * - Execute / trigger / dispatch / invoke
 * - State machine / workflow / lifecycle
 * - Engine imports
 * - Deduction / fee / charge (rake is RATIO only)
 */

import {
  type FlowResult,
  FlowErrorCode,
  flowSuccess,
  flowFailure,
  createFlowError,
} from './GreyFlowTypes';

// ============================================================================
// FORBIDDEN CONCEPT LISTS
// ============================================================================

/**
 * Forbidden financial keywords
 */
export const FLOW_FORBIDDEN_FINANCIAL_KEYWORDS = Object.freeze([
  'money',
  'balance',
  'wallet',
  'payment',
  'crypto',
  'transfer',
  'settlement',
  'currency',
  'dollar',
  'usdt',
  'bitcoin',
  'deposit',
  'withdraw',
  'debit',
  'credit',
  'fee',
  'charge',
  'deduction',
  'payout',
  'cashout',
] as const);

/**
 * Forbidden execution keywords
 */
export const FLOW_FORBIDDEN_EXECUTION_KEYWORDS = Object.freeze([
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
  'process',
  'handle',
] as const);

/**
 * Forbidden push keywords
 */
export const FLOW_FORBIDDEN_PUSH_KEYWORDS = Object.freeze([
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
 * Forbidden state machine keywords
 */
export const FLOW_FORBIDDEN_STATE_MACHINE_KEYWORDS = Object.freeze([
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
export const FLOW_FORBIDDEN_IMPORT_SOURCES = Object.freeze([
  'engine',
  'game',
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
export interface FlowBoundaryViolation {
  /** Type of violation */
  readonly violationType: 'FINANCIAL' | 'EXECUTION' | 'PUSH' | 'STATE_MACHINE' | 'FORBIDDEN_IMPORT';
  /** The offending keyword or concept */
  readonly keyword: string;
  /** Location or context of the violation */
  readonly context?: string;
}

/**
 * Boundary Check Result
 */
export interface FlowBoundaryCheckResult {
  /** Whether the check passed (no violations) */
  readonly passed: boolean;
  /** List of violations found */
  readonly violations: readonly FlowBoundaryViolation[];
  /** Total violation count */
  readonly violationCount: number;
}

// ============================================================================
// BOUNDARY GUARD FUNCTIONS
// ============================================================================

/**
 * Check text for forbidden financial keywords.
 *
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkForFinancialKeywords(text: string): FlowBoundaryCheckResult {
  const violations: FlowBoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of FLOW_FORBIDDEN_FINANCIAL_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      violations.push({
        violationType: 'FINANCIAL',
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
 * Check text for forbidden execution keywords.
 *
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkForFlowExecutionKeywords(text: string): FlowBoundaryCheckResult {
  const violations: FlowBoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of FLOW_FORBIDDEN_EXECUTION_KEYWORDS) {
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
export function checkForFlowPushKeywords(text: string): FlowBoundaryCheckResult {
  const violations: FlowBoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of FLOW_FORBIDDEN_PUSH_KEYWORDS) {
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
 * Check text for forbidden state machine keywords.
 *
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkForFlowStateMachineKeywords(text: string): FlowBoundaryCheckResult {
  const violations: FlowBoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of FLOW_FORBIDDEN_STATE_MACHINE_KEYWORDS) {
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
export function checkForFlowForbiddenImport(importPath: string): FlowBoundaryCheckResult {
  const violations: FlowBoundaryViolation[] = [];
  const lowerPath = importPath.toLowerCase();

  for (const source of FLOW_FORBIDDEN_IMPORT_SOURCES) {
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
export function checkAllFlowBoundaries(text: string): FlowBoundaryCheckResult {
  const allViolations: FlowBoundaryViolation[] = [];

  const financialResult = checkForFinancialKeywords(text);
  const executionResult = checkForFlowExecutionKeywords(text);
  const pushResult = checkForFlowPushKeywords(text);
  const stateMachineResult = checkForFlowStateMachineKeywords(text);

  allViolations.push(...financialResult.violations);
  allViolations.push(...executionResult.violations);
  allViolations.push(...pushResult.violations);
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
 * Assert no financial keywords.
 *
 * Returns FlowResult for consistent error handling.
 */
export function assertNoFinancialKeywords(text: string): FlowResult<boolean> {
  const result = checkForFinancialKeywords(text);
  if (!result.passed) {
    return flowFailure(
      createFlowError(
        FlowErrorCode.FORBIDDEN_CONCEPT,
        'Financial keywords detected',
        { violations: result.violations }
      )
    );
  }
  return flowSuccess(true);
}

/**
 * Assert no execution keywords.
 *
 * Returns FlowResult for consistent error handling.
 */
export function assertNoFlowExecutionKeywords(text: string): FlowResult<boolean> {
  const result = checkForFlowExecutionKeywords(text);
  if (!result.passed) {
    return flowFailure(
      createFlowError(
        FlowErrorCode.FORBIDDEN_CONCEPT,
        'Execution keywords detected',
        { violations: result.violations }
      )
    );
  }
  return flowSuccess(true);
}

/**
 * Assert no push keywords.
 *
 * Returns FlowResult for consistent error handling.
 */
export function assertNoFlowPushKeywords(text: string): FlowResult<boolean> {
  const result = checkForFlowPushKeywords(text);
  if (!result.passed) {
    return flowFailure(
      createFlowError(
        FlowErrorCode.FORBIDDEN_CONCEPT,
        'Push keywords detected',
        { violations: result.violations }
      )
    );
  }
  return flowSuccess(true);
}

/**
 * Assert no state machine keywords.
 *
 * Returns FlowResult for consistent error handling.
 */
export function assertNoFlowStateMachineKeywords(text: string): FlowResult<boolean> {
  const result = checkForFlowStateMachineKeywords(text);
  if (!result.passed) {
    return flowFailure(
      createFlowError(
        FlowErrorCode.FORBIDDEN_CONCEPT,
        'State machine keywords detected',
        { violations: result.violations }
      )
    );
  }
  return flowSuccess(true);
}

/**
 * Assert no forbidden imports.
 *
 * Returns FlowResult for consistent error handling.
 */
export function assertNoFlowForbiddenImport(importPath: string): FlowResult<boolean> {
  const result = checkForFlowForbiddenImport(importPath);
  if (!result.passed) {
    return flowFailure(
      createFlowError(
        FlowErrorCode.FORBIDDEN_CONCEPT,
        'Forbidden import source detected',
        { violations: result.violations }
      )
    );
  }
  return flowSuccess(true);
}

/**
 * Assert all boundaries are respected.
 *
 * Returns FlowResult for consistent error handling.
 */
export function assertAllFlowBoundaries(text: string): FlowResult<boolean> {
  const result = checkAllFlowBoundaries(text);
  if (!result.passed) {
    return flowFailure(
      createFlowError(
        FlowErrorCode.FORBIDDEN_CONCEPT,
        'Boundary violations detected',
        { violations: result.violations }
      )
    );
  }
  return flowSuccess(true);
}

/**
 * Assert that a value is a ratio (0.0 to 1.0 or reasonable ratio range).
 *
 * Ensures "rake" semantics are ratio-only, not fee/deduction.
 */
export function assertIsRatioOnly(
  value: number,
  fieldName: string
): FlowResult<boolean> {
  // Ratios should be non-negative
  if (value < 0) {
    return flowFailure(
      createFlowError(
        FlowErrorCode.INVALID_INPUT,
        `${fieldName} must be non-negative (ratio semantics)`,
        { value, fieldName }
      )
    );
  }
  return flowSuccess(true);
}

/**
 * Assert that unit count is non-negative integer.
 *
 * Ensures "volume" semantics are count-only, not monetary.
 */
export function assertIsUnitCount(
  value: number,
  fieldName: string
): FlowResult<boolean> {
  if (!Number.isInteger(value) || value < 0) {
    return flowFailure(
      createFlowError(
        FlowErrorCode.INVALID_INPUT,
        `${fieldName} must be a non-negative integer (unit count semantics)`,
        { value, fieldName }
      )
    );
  }
  return flowSuccess(true);
}

// ============================================================================
// DESIGN CONSTRAINT DOCUMENTATION
// ============================================================================

/**
 * Module design constraints - for documentation and testing
 */
export const FLOW_MODULE_DESIGN_CONSTRAINTS = Object.freeze({
  name: 'grey-flow',
  version: 'OPS-6',
  constraints: Object.freeze([
    'PASSIVE DATA LAYER: Stores data, does NOT execute anything',
    'PULL-BASED: External systems query this data, we never push',
    'REFERENCE-ONLY: Flow records are references, not monetary values',
    'RATIO-ONLY: Rake is ratio/share/index, NOT deduction or settlement',
    'APPEND-ONLY: Records are never modified or deleted',
    'HASH-CHAINED: Each record links to the previous for audit integrity',
    'NO STATE MACHINES: No status transitions, no lifecycles, no workflows',
    'NO ENGINE IMPORTS: No dependencies on engine or execution modules',
    'NO EXECUTION: Cannot execute, trigger, dispatch, or cause any action',
    'NO PUSH: Cannot push notifications or emit events',
    'NO FINANCIAL CONCEPTS: No money, balance, wallet, payment, crypto, transfer, settlement',
    'UNIT COUNT SEMANTICS: Volume is count, NOT monetary amount',
    'RATIO SEMANTICS: Rake is ratio/index, NOT fee/charge/deduction',
  ] as const),
  forbiddenConcepts: Object.freeze({
    financial: FLOW_FORBIDDEN_FINANCIAL_KEYWORDS,
    execution: FLOW_FORBIDDEN_EXECUTION_KEYWORDS,
    push: FLOW_FORBIDDEN_PUSH_KEYWORDS,
    stateMachine: FLOW_FORBIDDEN_STATE_MACHINE_KEYWORDS,
    imports: FLOW_FORBIDDEN_IMPORT_SOURCES,
  }),
  semanticBoundaries: Object.freeze({
    flow: 'count and ratio, NOT money amount',
    rake: 'ratio/share/index, NOT deduction or settlement',
    volume: 'unit count, NOT monetary value',
    frequency: 'occurrence count per time window',
    distribution: 'proportional share (0.0 to 1.0)',
  }),
});
