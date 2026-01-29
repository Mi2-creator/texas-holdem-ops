/**
 * GreyAttributionBoundaryGuards.ts
 *
 * Boundary guards for grey attribution module design constraints.
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
 * - Revenue / earnings / profit / income (use EXPOSURE instead)
 * - Fee / charge / deduction (use RATIO/SHARE instead)
 */

import {
  type AttributionResult,
  AttributionErrorCode,
  attributionSuccess,
  attributionFailure,
  createAttributionError,
} from './GreyAttributionTypes';

// ============================================================================
// FORBIDDEN CONCEPT LISTS
// ============================================================================

/**
 * Forbidden financial keywords
 */
export const ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS = Object.freeze([
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
 * Forbidden revenue keywords (use EXPOSURE instead)
 */
export const ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS = Object.freeze([
  'revenue',
  'earnings',
  'profit',
  'income',
  'proceeds',
  'returns',
  'yield',
  'dividend',
  'commission',
  'bonus',
] as const);

/**
 * Forbidden execution keywords
 */
export const ATTRIBUTION_FORBIDDEN_EXECUTION_KEYWORDS = Object.freeze([
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
export const ATTRIBUTION_FORBIDDEN_PUSH_KEYWORDS = Object.freeze([
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
export const ATTRIBUTION_FORBIDDEN_STATE_MACHINE_KEYWORDS = Object.freeze([
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
export const ATTRIBUTION_FORBIDDEN_IMPORT_SOURCES = Object.freeze([
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
export interface AttributionBoundaryViolation {
  /** Type of violation */
  readonly violationType: 'FINANCIAL' | 'REVENUE' | 'EXECUTION' | 'PUSH' | 'STATE_MACHINE' | 'FORBIDDEN_IMPORT';
  /** The offending keyword or concept */
  readonly keyword: string;
  /** Location or context of the violation */
  readonly context?: string;
}

/**
 * Boundary Check Result
 */
export interface AttributionBoundaryCheckResult {
  /** Whether the check passed (no violations) */
  readonly passed: boolean;
  /** List of violations found */
  readonly violations: readonly AttributionBoundaryViolation[];
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
export function checkForAttributionFinancialKeywords(text: string): AttributionBoundaryCheckResult {
  const violations: AttributionBoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS) {
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
 * Check text for forbidden revenue keywords.
 *
 * READ-ONLY: Returns result, does not throw or block.
 */
export function checkForAttributionRevenueKeywords(text: string): AttributionBoundaryCheckResult {
  const violations: AttributionBoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      violations.push({
        violationType: 'REVENUE',
        keyword,
        context: `Found "${keyword}" in text - use EXPOSURE instead`,
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
export function checkForAttributionExecutionKeywords(text: string): AttributionBoundaryCheckResult {
  const violations: AttributionBoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of ATTRIBUTION_FORBIDDEN_EXECUTION_KEYWORDS) {
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
export function checkForAttributionPushKeywords(text: string): AttributionBoundaryCheckResult {
  const violations: AttributionBoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of ATTRIBUTION_FORBIDDEN_PUSH_KEYWORDS) {
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
export function checkForAttributionStateMachineKeywords(text: string): AttributionBoundaryCheckResult {
  const violations: AttributionBoundaryViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of ATTRIBUTION_FORBIDDEN_STATE_MACHINE_KEYWORDS) {
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
export function checkForAttributionForbiddenImport(importPath: string): AttributionBoundaryCheckResult {
  const violations: AttributionBoundaryViolation[] = [];
  const lowerPath = importPath.toLowerCase();

  for (const source of ATTRIBUTION_FORBIDDEN_IMPORT_SOURCES) {
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
export function checkAllAttributionBoundaries(text: string): AttributionBoundaryCheckResult {
  const allViolations: AttributionBoundaryViolation[] = [];

  const financialResult = checkForAttributionFinancialKeywords(text);
  const revenueResult = checkForAttributionRevenueKeywords(text);
  const executionResult = checkForAttributionExecutionKeywords(text);
  const pushResult = checkForAttributionPushKeywords(text);
  const stateMachineResult = checkForAttributionStateMachineKeywords(text);

  allViolations.push(...financialResult.violations);
  allViolations.push(...revenueResult.violations);
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
 * Returns AttributionResult for consistent error handling.
 */
export function assertNoAttributionFinancialKeywords(text: string): AttributionResult<boolean> {
  const result = checkForAttributionFinancialKeywords(text);
  if (!result.passed) {
    return attributionFailure(
      createAttributionError(
        AttributionErrorCode.FORBIDDEN_CONCEPT,
        'Financial keywords detected',
        { violations: result.violations }
      )
    );
  }
  return attributionSuccess(true);
}

/**
 * Assert no revenue keywords.
 *
 * Returns AttributionResult for consistent error handling.
 */
export function assertNoAttributionRevenueKeywords(text: string): AttributionResult<boolean> {
  const result = checkForAttributionRevenueKeywords(text);
  if (!result.passed) {
    return attributionFailure(
      createAttributionError(
        AttributionErrorCode.FORBIDDEN_CONCEPT,
        'Revenue keywords detected - use EXPOSURE instead',
        { violations: result.violations }
      )
    );
  }
  return attributionSuccess(true);
}

/**
 * Assert no execution keywords.
 *
 * Returns AttributionResult for consistent error handling.
 */
export function assertNoAttributionExecutionKeywords(text: string): AttributionResult<boolean> {
  const result = checkForAttributionExecutionKeywords(text);
  if (!result.passed) {
    return attributionFailure(
      createAttributionError(
        AttributionErrorCode.FORBIDDEN_CONCEPT,
        'Execution keywords detected',
        { violations: result.violations }
      )
    );
  }
  return attributionSuccess(true);
}

/**
 * Assert no push keywords.
 *
 * Returns AttributionResult for consistent error handling.
 */
export function assertNoAttributionPushKeywords(text: string): AttributionResult<boolean> {
  const result = checkForAttributionPushKeywords(text);
  if (!result.passed) {
    return attributionFailure(
      createAttributionError(
        AttributionErrorCode.FORBIDDEN_CONCEPT,
        'Push keywords detected',
        { violations: result.violations }
      )
    );
  }
  return attributionSuccess(true);
}

/**
 * Assert no state machine keywords.
 *
 * Returns AttributionResult for consistent error handling.
 */
export function assertNoAttributionStateMachineKeywords(text: string): AttributionResult<boolean> {
  const result = checkForAttributionStateMachineKeywords(text);
  if (!result.passed) {
    return attributionFailure(
      createAttributionError(
        AttributionErrorCode.FORBIDDEN_CONCEPT,
        'State machine keywords detected',
        { violations: result.violations }
      )
    );
  }
  return attributionSuccess(true);
}

/**
 * Assert no forbidden imports.
 *
 * Returns AttributionResult for consistent error handling.
 */
export function assertNoAttributionForbiddenImport(importPath: string): AttributionResult<boolean> {
  const result = checkForAttributionForbiddenImport(importPath);
  if (!result.passed) {
    return attributionFailure(
      createAttributionError(
        AttributionErrorCode.FORBIDDEN_CONCEPT,
        'Forbidden import source detected',
        { violations: result.violations }
      )
    );
  }
  return attributionSuccess(true);
}

/**
 * Assert all boundaries are respected.
 *
 * Returns AttributionResult for consistent error handling.
 */
export function assertAllAttributionBoundaries(text: string): AttributionResult<boolean> {
  const result = checkAllAttributionBoundaries(text);
  if (!result.passed) {
    return attributionFailure(
      createAttributionError(
        AttributionErrorCode.FORBIDDEN_CONCEPT,
        'Boundary violations detected',
        { violations: result.violations }
      )
    );
  }
  return attributionSuccess(true);
}

/**
 * Assert that a value is a valid exposure metric (non-negative).
 *
 * Ensures "exposure" semantics, not monetary values.
 */
export function assertIsExposureMetric(
  value: number,
  fieldName: string
): AttributionResult<boolean> {
  if (value < 0) {
    return attributionFailure(
      createAttributionError(
        AttributionErrorCode.INVALID_INPUT,
        `${fieldName} must be non-negative (exposure semantics)`,
        { value, fieldName }
      )
    );
  }
  return attributionSuccess(true);
}

/**
 * Assert that a share value is between 0.0 and 1.0.
 *
 * Ensures "share" semantics - proportional, not absolute.
 */
export function assertIsShareValue(
  value: number,
  fieldName: string
): AttributionResult<boolean> {
  if (value < 0 || value > 1.0) {
    return attributionFailure(
      createAttributionError(
        AttributionErrorCode.INVALID_INPUT,
        `${fieldName} must be between 0.0 and 1.0 (share semantics)`,
        { value, fieldName }
      )
    );
  }
  return attributionSuccess(true);
}

// ============================================================================
// DESIGN CONSTRAINT DOCUMENTATION
// ============================================================================

/**
 * Module design constraints - for documentation and testing
 */
export const ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS = Object.freeze({
  name: 'grey-attribution',
  version: 'OPS-7',
  constraints: Object.freeze([
    'PASSIVE DATA LAYER: Stores data, does NOT execute anything',
    'PULL-BASED: External systems query this data, we never push',
    'REFERENCE-ONLY: Attribution records are references, not monetary values',
    'EXPOSURE-ONLY: All metrics are exposure/ratio/share/index, NOT revenue',
    'APPEND-ONLY: Records are never modified or deleted',
    'HASH-CHAINED: Each record links to the previous for audit integrity',
    'NO STATE MACHINES: No status transitions, no lifecycles, no workflows',
    'NO ENGINE IMPORTS: No dependencies on engine or execution modules',
    'NO EXECUTION: Cannot execute, trigger, dispatch, or cause any action',
    'NO PUSH: Cannot push notifications or emit events',
    'NO FINANCIAL CONCEPTS: No money, balance, wallet, payment, crypto, transfer, settlement',
    'NO REVENUE CONCEPTS: No revenue, earnings, profit, income (use EXPOSURE)',
    'EXPOSURE SEMANTICS: Attribution explains WHY ratios are related',
    'EXPOSURE SEMANTICS: Exposure is risk/impact, NOT revenue or earnings',
  ] as const),
  forbiddenConcepts: Object.freeze({
    financial: ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS,
    revenue: ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS,
    execution: ATTRIBUTION_FORBIDDEN_EXECUTION_KEYWORDS,
    push: ATTRIBUTION_FORBIDDEN_PUSH_KEYWORDS,
    stateMachine: ATTRIBUTION_FORBIDDEN_STATE_MACHINE_KEYWORDS,
    imports: ATTRIBUTION_FORBIDDEN_IMPORT_SOURCES,
  }),
  semanticBoundaries: Object.freeze({
    attribution: 'explains WHY a ratio is considered related',
    exposure: 'risk/impact exposure, NOT revenue or earnings',
    share: 'proportional share (0.0 to 1.0)',
    ratio: 'calculated ratio (non-negative)',
    weight: 'weighted factor (non-negative)',
    index: 'normalized index value (non-negative)',
  }),
});
