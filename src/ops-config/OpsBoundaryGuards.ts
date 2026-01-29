/**
 * OpsBoundaryGuards.ts
 *
 * Boundary enforcement for texas-holdem-ops
 *
 * EXTERNAL BOUNDARY: This module operates OUTSIDE the engine.
 * FORBIDDEN CONCEPTS: Enforced globally across all ops modules.
 */

import {
  type OpsResult,
  OpsErrorCode,
  opsSuccess,
  opsFailure,
  createOpsError,
} from './OpsTypes';

// ============================================================================
// FORBIDDEN CONCEPTS
// ============================================================================

/**
 * Forbidden concepts in the ops system.
 * These terms MUST NOT appear in any ops code, data, or output.
 */
export const FORBIDDEN_CONCEPTS = Object.freeze([
  'balance',
  'wallet',
  'payment',
  'crypto',
  'transfer',
  'money',
  'currency',
  'fund',
  'deposit',
  'withdraw',
  'debit',
  'credit',
  'transaction',
  'settlement',
  'execute',
  'auto-adjust',
  'auto-block',
] as const);

export type ForbiddenConcept = (typeof FORBIDDEN_CONCEPTS)[number];

/**
 * Forbidden import patterns.
 * Ops MUST NOT import from these sources.
 */
export const FORBIDDEN_IMPORTS = Object.freeze([
  'engine/core',
  'engine/internals',
  'engine/mutations',
  'engine/state',
  'grey-flow',
  'greyFlowEngine',
  'paymentService',
  'walletService',
  'cryptoService',
] as const);

/**
 * Forbidden function patterns.
 * These patterns indicate mutation or execution.
 */
export const FORBIDDEN_FUNCTION_PATTERNS = Object.freeze([
  /^execute[A-Z]/,
  /^process[A-Z]/,
  /^transfer[A-Z]/,
  /^send[A-Z]/,
  /^pay[A-Z]/,
  /^deduct[A-Z]/,
  /^withdraw[A-Z]/,
  /^deposit[A-Z]/,
  /^updateBalance/,
  /^setBalance/,
  /^getBalance/,
  /^autoAdjust/,
  /^autoBlock/,
] as const);

// ============================================================================
// BOUNDARY CHECK TYPES
// ============================================================================

export interface BoundaryViolation {
  readonly type: 'FORBIDDEN_CONCEPT' | 'FORBIDDEN_IMPORT' | 'FORBIDDEN_FUNCTION' | 'ENGINE_ACCESS';
  readonly location: string;
  readonly detail: string;
}

export interface BoundaryCheckResult {
  readonly passed: boolean;
  readonly violations: readonly BoundaryViolation[];
}

// ============================================================================
// BOUNDARY CHECK FUNCTIONS
// ============================================================================

/**
 * Check if text contains forbidden concepts.
 */
export function checkForForbiddenConcepts(text: string): BoundaryCheckResult {
  const violations: BoundaryViolation[] = [];
  const textLower = text.toLowerCase();

  for (const concept of FORBIDDEN_CONCEPTS) {
    if (textLower.includes(concept)) {
      violations.push({
        type: 'FORBIDDEN_CONCEPT',
        location: findLocation(text, concept),
        detail: `Forbidden concept "${concept}" detected`,
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Check if code contains forbidden imports.
 */
export function checkForForbiddenImports(code: string): BoundaryCheckResult {
  const violations: BoundaryViolation[] = [];

  for (const forbidden of FORBIDDEN_IMPORTS) {
    if (code.includes(forbidden)) {
      violations.push({
        type: 'FORBIDDEN_IMPORT',
        location: forbidden,
        detail: `Forbidden import "${forbidden}" detected`,
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Check if function names contain forbidden patterns.
 */
export function checkForForbiddenFunctions(functionNames: readonly string[]): BoundaryCheckResult {
  const violations: BoundaryViolation[] = [];

  for (const name of functionNames) {
    for (const pattern of FORBIDDEN_FUNCTION_PATTERNS) {
      if (pattern.test(name)) {
        violations.push({
          type: 'FORBIDDEN_FUNCTION',
          location: name,
          detail: `Forbidden function pattern "${pattern.source}" matched by "${name}"`,
        });
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Run comprehensive boundary check.
 */
export function runBoundaryCheck(
  code: string,
  functionNames: readonly string[]
): BoundaryCheckResult {
  const conceptCheck = checkForForbiddenConcepts(code);
  const importCheck = checkForForbiddenImports(code);
  const functionCheck = checkForForbiddenFunctions(functionNames);

  const allViolations = [
    ...conceptCheck.violations,
    ...importCheck.violations,
    ...functionCheck.violations,
  ];

  return {
    passed: allViolations.length === 0,
    violations: allViolations,
  };
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert no forbidden concepts in text.
 */
export function assertNoForbiddenConcepts(text: string, label: string = 'text'): OpsResult<void> {
  const result = checkForForbiddenConcepts(text);
  if (!result.passed) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.FORBIDDEN_CONCEPT,
        `Forbidden concepts in ${label}: ${result.violations.map(v => v.detail).join(', ')}`
      )
    );
  }
  return opsSuccess(undefined);
}

/**
 * Assert no forbidden imports in code.
 */
export function assertNoForbiddenImports(code: string, label: string = 'code'): OpsResult<void> {
  const result = checkForForbiddenImports(code);
  if (!result.passed) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.BOUNDARY_VIOLATION,
        `Forbidden imports in ${label}: ${result.violations.map(v => v.detail).join(', ')}`
      )
    );
  }
  return opsSuccess(undefined);
}

/**
 * Assert no forbidden function names.
 */
export function assertNoForbiddenFunctions(
  functionNames: readonly string[],
  label: string = 'module'
): OpsResult<void> {
  const result = checkForForbiddenFunctions(functionNames);
  if (!result.passed) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.BOUNDARY_VIOLATION,
        `Forbidden functions in ${label}: ${result.violations.map(v => v.detail).join(', ')}`
      )
    );
  }
  return opsSuccess(undefined);
}

/**
 * Assert integer value.
 */
export function assertInteger(value: number, label: string = 'value'): OpsResult<number> {
  if (!Number.isInteger(value)) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.INVALID_INPUT,
        `${label} must be an integer, got ${value}`
      )
    );
  }
  return opsSuccess(value);
}

/**
 * Assert positive integer value.
 */
export function assertPositiveInteger(value: number, label: string = 'value'): OpsResult<number> {
  if (!Number.isInteger(value) || value <= 0) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.INVALID_INPUT,
        `${label} must be a positive integer, got ${value}`
      )
    );
  }
  return opsSuccess(value);
}

/**
 * Assert non-negative integer value.
 */
export function assertNonNegativeInteger(value: number, label: string = 'value'): OpsResult<number> {
  if (!Number.isInteger(value) || value < 0) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.INVALID_INPUT,
        `${label} must be a non-negative integer, got ${value}`
      )
    );
  }
  return opsSuccess(value);
}

/**
 * Assert valid timestamp.
 */
export function assertValidTimestamp(value: number, label: string = 'timestamp'): OpsResult<number> {
  if (!Number.isInteger(value) || value <= 1000000000000) {
    return opsFailure(
      createOpsError(
        OpsErrorCode.INVALID_INPUT,
        `${label} must be a valid timestamp (after year 2001), got ${value}`
      )
    );
  }
  return opsSuccess(value);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findLocation(text: string, concept: string): string {
  const index = text.toLowerCase().indexOf(concept);
  if (index === -1) return concept;

  const start = Math.max(0, index - 15);
  const end = Math.min(text.length, index + concept.length + 15);
  return `...${text.slice(start, end)}...`;
}

// ============================================================================
// BOUNDARY DECLARATION
// ============================================================================

/**
 * Ops boundary declaration.
 */
export const OPS_BOUNDARY_DECLARATION = Object.freeze({
  name: 'texas-holdem-ops',
  mode: 'EXTERNAL',
  isReadOnly: true,
  isReferenceOnly: true,
  allowsEngineAccess: false,
  allowsValueComputation: false,
  allowsAutomation: false,
  forbiddenConcepts: FORBIDDEN_CONCEPTS,
  forbiddenImports: FORBIDDEN_IMPORTS,
  boundaryVersion: '1.0.0',
}) as {
  readonly name: string;
  readonly mode: 'EXTERNAL';
  readonly isReadOnly: true;
  readonly isReferenceOnly: true;
  readonly allowsEngineAccess: false;
  readonly allowsValueComputation: false;
  readonly allowsAutomation: false;
  readonly forbiddenConcepts: typeof FORBIDDEN_CONCEPTS;
  readonly forbiddenImports: typeof FORBIDDEN_IMPORTS;
  readonly boundaryVersion: string;
};
