/**
 * GreyBehaviorBoundaryGuards.ts
 *
 * Boundary guards to enforce semantic constraints on behavior signal module.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PASSIVE ENFORCEMENT: Guards only validate, never execute
 * - NO SIDE EFFECTS: Guards do not modify any state
 * - SEMANTIC BOUNDARIES: Enforce separation from forbidden concepts
 *
 * FORBIDDEN CONCEPTS:
 * - Money, balance, wallet, payment, transaction, crypto
 * - Revenue, profit, earnings, income, bonus, reward
 * - Incentive (as action), trigger, action, effect, cause
 * - State machine, workflow, lifecycle, status
 * - Engine, execution, processing, settlement
 */

// ============================================================================
// FORBIDDEN KEYWORD LISTS
// ============================================================================

/**
 * Financial/monetary keywords that must NEVER appear.
 */
export const FORBIDDEN_FINANCIAL_KEYWORDS = Object.freeze([
  'money',
  'balance',
  'wallet',
  'payment',
  'transaction',
  'crypto',
  'currency',
  'dollar',
  'cent',
  'chip', // in monetary context
  'bank',
  'deposit',
  'withdraw',
  'transfer',
  'settlement',
  'payout',
  'cashout',
]);

/**
 * Revenue/profit keywords that must NEVER appear.
 */
export const FORBIDDEN_REVENUE_KEYWORDS = Object.freeze([
  'revenue',
  'profit',
  'earnings',
  'income',
  'bonus',
  'reward',
  'commission',
  'fee',
  'rake', // as revenue
  'cut',
  'margin',
  'return',
]);

/**
 * Action/trigger keywords that must NEVER appear.
 */
export const FORBIDDEN_ACTION_KEYWORDS = Object.freeze([
  'trigger',
  'execute',
  'dispatch',
  'action',
  'effect',
  'cause',
  'invoke',
  'call',
  'run',
  'start',
  'stop',
  'activate',
  'deactivate',
  'enable',
  'disable',
  'process',
  'handle',
]);

/**
 * State/workflow keywords that must NEVER appear.
 */
export const FORBIDDEN_STATE_KEYWORDS = Object.freeze([
  'state machine',
  'workflow',
  'lifecycle',
  'status',
  'phase',
  'stage',
  'step',
  'progress',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

/**
 * Engine/execution keywords that must NEVER appear.
 */
export const FORBIDDEN_ENGINE_KEYWORDS = Object.freeze([
  'engine',
  'processor',
  'handler',
  'executor',
  'runner',
  'worker',
  'job',
  'queue',
  'pipeline',
  'orchestrator',
]);

/**
 * Incentive/reward-as-action keywords that must NEVER appear.
 */
export const FORBIDDEN_INCENTIVE_ACTION_KEYWORDS = Object.freeze([
  'give bonus',
  'award',
  'grant',
  'distribute',
  'allocate reward',
  'issue',
  'pay out',
  'compensate',
  'reimburse',
]);

/**
 * All forbidden keywords combined.
 */
export const ALL_FORBIDDEN_KEYWORDS = Object.freeze([
  ...FORBIDDEN_FINANCIAL_KEYWORDS,
  ...FORBIDDEN_REVENUE_KEYWORDS,
  ...FORBIDDEN_ACTION_KEYWORDS,
  ...FORBIDDEN_STATE_KEYWORDS,
  ...FORBIDDEN_ENGINE_KEYWORDS,
  ...FORBIDDEN_INCENTIVE_ACTION_KEYWORDS,
]);

// ============================================================================
// ALLOWED KEYWORDS (FOR REFERENCE)
// ============================================================================

/**
 * Signal-related keywords that ARE allowed.
 */
export const ALLOWED_SIGNAL_KEYWORDS = Object.freeze([
  'signal',
  'observation',
  'exposure',
  'detection',
  'pattern',
  'indicator',
  'marker',
  'trace',
  'footprint',
]);

/**
 * Correlation-related keywords that ARE allowed.
 */
export const ALLOWED_CORRELATION_KEYWORDS = Object.freeze([
  'correlation',
  'correlation coefficient',
  'lift',
  'delta',
  'skew',
  'elasticity',
  'index',
  'association',
  'relationship',
  'co-occurrence',
  'trend',
]);

/**
 * Analysis-related keywords that ARE allowed.
 */
export const ALLOWED_ANALYSIS_KEYWORDS = Object.freeze([
  'analysis',
  'calculation',
  'aggregation',
  'summary',
  'view',
  'distribution',
  'profile',
  'statistics',
  'metrics',
]);

/**
 * Behavior-related keywords that ARE allowed.
 */
export const ALLOWED_BEHAVIOR_KEYWORDS = Object.freeze([
  'behavior',
  'pattern',
  'tendency',
  'frequency',
  'intensity',
  'duration',
  'occurrence',
  'observation',
]);

// ============================================================================
// GUARD FUNCTIONS
// ============================================================================

/**
 * Check if text contains forbidden financial keywords.
 */
export function containsForbiddenFinancialKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_FINANCIAL_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check if text contains forbidden revenue keywords.
 */
export function containsForbiddenRevenueKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_REVENUE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check if text contains forbidden action keywords.
 */
export function containsForbiddenActionKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_ACTION_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check if text contains forbidden state keywords.
 */
export function containsForbiddenStateKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_STATE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check if text contains forbidden engine keywords.
 */
export function containsForbiddenEngineKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_ENGINE_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check if text contains forbidden incentive-as-action keywords.
 */
export function containsForbiddenIncentiveActionKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_INCENTIVE_ACTION_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Check if text contains any forbidden keywords.
 */
export function containsAnyForbiddenKeywords(text: string): boolean {
  return (
    containsForbiddenFinancialKeywords(text) ||
    containsForbiddenRevenueKeywords(text) ||
    containsForbiddenActionKeywords(text) ||
    containsForbiddenStateKeywords(text) ||
    containsForbiddenEngineKeywords(text) ||
    containsForbiddenIncentiveActionKeywords(text)
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

/**
 * Validate that text is semantically safe for behavior signal module.
 */
export function validateSemanticSafety(text: string): {
  readonly isValid: boolean;
  readonly violations: readonly string[];
} {
  const violations = findForbiddenKeywords(text);
  return Object.freeze({
    isValid: violations.length === 0,
    violations,
  });
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Validate that an object does not contain forbidden concepts in its keys.
 */
export function validateObjectKeys(obj: Record<string, unknown>): {
  readonly isValid: boolean;
  readonly forbiddenKeys: readonly string[];
} {
  const forbiddenKeys: string[] = [];

  for (const key of Object.keys(obj)) {
    if (containsAnyForbiddenKeywords(key)) {
      forbiddenKeys.push(key);
    }
  }

  return Object.freeze({
    isValid: forbiddenKeys.length === 0,
    forbiddenKeys: Object.freeze(forbiddenKeys),
  });
}

/**
 * Assert that text is semantically safe.
 * Throws if violations found.
 */
export function assertSemanticSafety(text: string, context: string): void {
  const result = validateSemanticSafety(text);
  if (!result.isValid) {
    throw new Error(
      `Semantic boundary violation in ${context}: ` +
      `Found forbidden keywords: ${result.violations.join(', ')}`
    );
  }
}

// ============================================================================
// BOUNDARY DEFINITIONS
// ============================================================================

/**
 * Module boundaries documentation.
 */
export const MODULE_BOUNDARIES = Object.freeze({
  /**
   * This module MUST:
   */
  MUST: Object.freeze([
    'Only store passive observations (signals)',
    'Only compute statistical correlations',
    'Only return derived views',
    'Use frozen/immutable data structures',
    'Maintain append-only, hash-chained records',
  ]),

  /**
   * This module CANNOT:
   */
  CANNOT: Object.freeze([
    'Execute, trigger, or dispatch anything',
    'Create persistent records outside its registry',
    'Process money, balances, or settlements',
    'Promise or guarantee any effect',
    'Define incentive, reward, or bonus structures',
    'Implement state machines or workflows',
    'Import or depend on engine modules',
  ]),

  /**
   * Semantic clarifications:
   */
  SEMANTICS: Object.freeze({
    SIGNAL: 'Passively observed environmental/operational exposure, NOT trigger',
    CORRELATION: 'Statistical correlation between variables, NOT causation',
    BEHAVIOR: 'Observed pattern of activity, NOT induced action',
    INTENSITY: 'Observed strength of signal, NOT value or worth',
    EXPOSURE: 'Duration/frequency of observation, NOT risk or revenue',
  }),
});

/**
 * Get module boundaries as readable text.
 */
export function getModuleBoundariesText(): string {
  const lines: string[] = [];

  lines.push('=== GREY BEHAVIOR SIGNAL MODULE BOUNDARIES ===');
  lines.push('');
  lines.push('THIS MODULE MUST:');
  for (const must of MODULE_BOUNDARIES.MUST) {
    lines.push(`  - ${must}`);
  }
  lines.push('');
  lines.push('THIS MODULE CANNOT:');
  for (const cannot of MODULE_BOUNDARIES.CANNOT) {
    lines.push(`  - ${cannot}`);
  }
  lines.push('');
  lines.push('SEMANTIC DEFINITIONS:');
  for (const [term, definition] of Object.entries(MODULE_BOUNDARIES.SEMANTICS)) {
    lines.push(`  - ${term}: ${definition}`);
  }

  return lines.join('\n');
}
