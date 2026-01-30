/**
 * OpsQueryGuards.ts
 *
 * Boundary guards for the OPS query layer.
 *
 * CRITICAL CONSTRAINTS:
 * - FORBID MUTATION: No write, update, delete operations
 * - FORBID EXECUTION: No execute, trigger, dispatch operations
 * - FORBID ENGINE: No engine imports or dependencies
 * - FORBID ANALYTICS: No new computations or metrics
 * - ENFORCE READ-ONLY: All operations must be pure reads
 *
 * WHAT THIS MODULE DOES:
 * - Defines forbidden keywords and patterns
 * - Provides validation functions for query layer compliance
 * - Enforces read-only, pull-based semantics
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot allow any mutation operations
 * - Cannot allow any execution or trigger operations
 * - Cannot allow any engine dependencies
 */

// ============================================================================
// FORBIDDEN KEYWORD LISTS
// ============================================================================

/**
 * Mutation keywords - operations that modify state.
 */
export const FORBIDDEN_MUTATION_KEYWORDS = Object.freeze([
  'write',
  'update',
  'delete',
  'remove',
  'modify',
  'mutate',
  'set',
  'put',
  'patch',
  'insert',
  'append',
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'clear',
  'reset',
]);

/**
 * Execution keywords - operations that trigger actions.
 */
export const FORBIDDEN_EXECUTION_KEYWORDS = Object.freeze([
  'execute',
  'trigger',
  'dispatch',
  'emit',
  'fire',
  'invoke',
  'call',
  'run',
  'start',
  'stop',
  'process',
  'handle',
  'perform',
  'action',
  'command',
]);

/**
 * Engine keywords - forbidden dependencies.
 */
export const FORBIDDEN_ENGINE_KEYWORDS = Object.freeze([
  'engine',
  'core',
  'internals',
  'mutations',
  'state',
  'greyFlowEngine',
  'paymentService',
  'walletService',
  'balanceService',
]);

/**
 * Financial keywords - forbidden concepts.
 */
export const FORBIDDEN_FINANCIAL_KEYWORDS = Object.freeze([
  'money',
  'balance',
  'wallet',
  'payment',
  'transaction',
  'crypto',
  'currency',
  'transfer',
  'deposit',
  'withdraw',
  'settlement',
]);

/**
 * State machine keywords - forbidden patterns.
 */
export const FORBIDDEN_STATE_KEYWORDS = Object.freeze([
  'state machine',
  'workflow',
  'lifecycle',
  'transition',
  'status change',
  'phase',
  'stage',
]);

/**
 * Callback/event keywords - forbidden async patterns.
 */
export const FORBIDDEN_ASYNC_KEYWORDS = Object.freeze([
  'callback',
  'event',
  'listener',
  'subscribe',
  'publish',
  'notify',
  'observer',
  'webhook',
  'socket',
]);

/**
 * All forbidden keywords combined.
 */
export const ALL_FORBIDDEN_KEYWORDS = Object.freeze([
  ...FORBIDDEN_MUTATION_KEYWORDS,
  ...FORBIDDEN_EXECUTION_KEYWORDS,
  ...FORBIDDEN_ENGINE_KEYWORDS,
  ...FORBIDDEN_FINANCIAL_KEYWORDS,
  ...FORBIDDEN_STATE_KEYWORDS,
  ...FORBIDDEN_ASYNC_KEYWORDS,
]);

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

/**
 * Check for mutation keywords.
 */
export function containsMutationKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_MUTATION_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check for execution keywords.
 */
export function containsExecutionKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_EXECUTION_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check for engine keywords.
 */
export function containsEngineKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_ENGINE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check for financial keywords.
 */
export function containsFinancialKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_FINANCIAL_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check for state machine keywords.
 */
export function containsStateKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_STATE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check for async/callback keywords.
 */
export function containsAsyncKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_ASYNC_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check for any forbidden keywords.
 */
export function containsAnyForbiddenKeywords(text: string): boolean {
  return (
    containsMutationKeywords(text) ||
    containsExecutionKeywords(text) ||
    containsEngineKeywords(text) ||
    containsFinancialKeywords(text) ||
    containsStateKeywords(text) ||
    containsAsyncKeywords(text)
  );
}

/**
 * Find all forbidden keywords in text.
 */
export function findForbiddenKeywords(text: string): readonly string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const keyword of ALL_FORBIDDEN_KEYWORDS) {
    if (lower.includes(keyword)) {
      found.push(keyword);
    }
  }

  return Object.freeze(found);
}

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

/**
 * Validation result.
 */
export interface ValidationResult {
  /** Whether validation passed */
  readonly isValid: boolean;
  /** Violations found */
  readonly violations: readonly string[];
  /** Violation category */
  readonly category: string | null;
}

/**
 * Create validation success.
 */
export function validationSuccess(): ValidationResult {
  return Object.freeze({
    isValid: true,
    violations: Object.freeze([]),
    category: null,
  });
}

/**
 * Create validation failure.
 */
export function validationFailure(violations: readonly string[], category: string): ValidationResult {
  return Object.freeze({
    isValid: false,
    violations: Object.freeze([...violations]),
    category,
  });
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate text has no mutation keywords.
 */
export function validateNoMutation(text: string): ValidationResult {
  const found = FORBIDDEN_MUTATION_KEYWORDS.filter(k => text.toLowerCase().includes(k));
  if (found.length > 0) {
    return validationFailure(found, 'mutation');
  }
  return validationSuccess();
}

/**
 * Validate text has no execution keywords.
 */
export function validateNoExecution(text: string): ValidationResult {
  const found = FORBIDDEN_EXECUTION_KEYWORDS.filter(k => text.toLowerCase().includes(k));
  if (found.length > 0) {
    return validationFailure(found, 'execution');
  }
  return validationSuccess();
}

/**
 * Validate text has no engine keywords.
 */
export function validateNoEngine(text: string): ValidationResult {
  const found = FORBIDDEN_ENGINE_KEYWORDS.filter(k => text.toLowerCase().includes(k));
  if (found.length > 0) {
    return validationFailure(found, 'engine');
  }
  return validationSuccess();
}

/**
 * Validate text has no financial keywords.
 */
export function validateNoFinancial(text: string): ValidationResult {
  const found = FORBIDDEN_FINANCIAL_KEYWORDS.filter(k => text.toLowerCase().includes(k));
  if (found.length > 0) {
    return validationFailure(found, 'financial');
  }
  return validationSuccess();
}

/**
 * Validate text has no async keywords.
 */
export function validateNoAsync(text: string): ValidationResult {
  const found = FORBIDDEN_ASYNC_KEYWORDS.filter(k => text.toLowerCase().includes(k));
  if (found.length > 0) {
    return validationFailure(found, 'async');
  }
  return validationSuccess();
}

/**
 * Validate text passes all query layer constraints.
 */
export function validateQueryLayerCompliance(text: string): ValidationResult {
  const results = [
    validateNoMutation(text),
    validateNoExecution(text),
    validateNoEngine(text),
    validateNoFinancial(text),
    validateNoAsync(text),
  ];

  const allViolations: string[] = [];
  const categories: string[] = [];

  for (const result of results) {
    if (!result.isValid) {
      allViolations.push(...result.violations);
      if (result.category) {
        categories.push(result.category);
      }
    }
  }

  if (allViolations.length > 0) {
    return validationFailure(allViolations, categories.join(', '));
  }

  return validationSuccess();
}

// ============================================================================
// ASSERTION FUNCTIONS
// ============================================================================

/**
 * Assert text has no mutation keywords.
 * Throws if violation found.
 */
export function assertNoMutation(text: string, context: string): void {
  const result = validateNoMutation(text);
  if (!result.isValid) {
    throw new Error(
      `Query layer mutation violation in ${context}: ${result.violations.join(', ')}`
    );
  }
}

/**
 * Assert text has no execution keywords.
 * Throws if violation found.
 */
export function assertNoExecution(text: string, context: string): void {
  const result = validateNoExecution(text);
  if (!result.isValid) {
    throw new Error(
      `Query layer execution violation in ${context}: ${result.violations.join(', ')}`
    );
  }
}

/**
 * Assert text has no engine keywords.
 * Throws if violation found.
 */
export function assertNoEngine(text: string, context: string): void {
  const result = validateNoEngine(text);
  if (!result.isValid) {
    throw new Error(
      `Query layer engine violation in ${context}: ${result.violations.join(', ')}`
    );
  }
}

/**
 * Assert query layer compliance.
 * Throws if any violation found.
 */
export function assertQueryLayerCompliance(text: string, context: string): void {
  const result = validateQueryLayerCompliance(text);
  if (!result.isValid) {
    throw new Error(
      `Query layer violation in ${context}: ${result.violations.join(', ')}`
    );
  }
}

// ============================================================================
// MODULE CONSTRAINTS DOCUMENTATION
// ============================================================================

/**
 * Query layer constraints.
 */
export const QUERY_LAYER_CONSTRAINTS = Object.freeze({
  /**
   * What the query layer MUST do.
   */
  MUST: Object.freeze([
    'Only read data from OPS modules',
    'Return frozen, immutable results',
    'Be deterministic (same input = same output)',
    'Be synchronous and pull-based',
    'Pass through data without transformation',
  ]),

  /**
   * What the query layer CANNOT do.
   */
  CANNOT: Object.freeze([
    'Write, update, or delete any data',
    'Execute, trigger, or dispatch any actions',
    'Import or depend on engine modules',
    'Compute new analytics or metrics',
    'Transform data semantics',
    'Use callbacks, events, or async patterns',
    'Handle money, balances, or payments',
  ]),

  /**
   * Semantic definitions.
   */
  SEMANTICS: Object.freeze({
    QUERY: 'Synchronous, read-only data retrieval',
    SNAPSHOT: 'Frozen point-in-time view of data',
    SCOPE: 'Filters for time, period, or entity bounds',
    VIEW: 'Pre-existing read-only projection from OPS modules',
  }),
});

/**
 * Get query layer constraints as readable text.
 */
export function getQueryLayerConstraintsText(): string {
  const lines: string[] = [];

  lines.push('=== OPS QUERY LAYER CONSTRAINTS ===');
  lines.push('');
  lines.push('QUERY LAYER MUST:');
  for (const must of QUERY_LAYER_CONSTRAINTS.MUST) {
    lines.push(`  - ${must}`);
  }
  lines.push('');
  lines.push('QUERY LAYER CANNOT:');
  for (const cannot of QUERY_LAYER_CONSTRAINTS.CANNOT) {
    lines.push(`  - ${cannot}`);
  }
  lines.push('');
  lines.push('SEMANTIC DEFINITIONS:');
  for (const [term, definition] of Object.entries(QUERY_LAYER_CONSTRAINTS.SEMANTICS)) {
    lines.push(`  - ${term}: ${definition}`);
  }

  return lines.join('\n');
}
