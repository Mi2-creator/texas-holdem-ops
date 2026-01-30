/**
 * Grey Behavior Signal Module
 *
 * OPS-8: Grey Incentive & Behavior Correlation Analysis
 *
 * This module provides PASSIVE, READ-ONLY analysis of behavior signals
 * and their statistical correlations.
 *
 * CRITICAL CONSTRAINTS:
 * - PASSIVE / PULL-BASED: All data is observation-only
 * - NO EXECUTION: No triggers, actions, or effects
 * - NO CAUSATION: Correlation only, no promise of outcomes
 * - NO FINANCIAL: No money, balance, payment concepts
 * - NO INCENTIVES: No rewards, bonuses, or incentive structures
 *
 * WHAT THIS MODULE DOES:
 * - Records passive behavior signal observations
 * - Calculates statistical correlations
 * - Provides derived analytical views
 * - Maintains append-only, hash-chained integrity
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Execute, trigger, or dispatch anything
 * - Create incentive or reward structures
 * - Process money or settlements
 * - Promise or guarantee any effect
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  SignalId,
  ActorId,
  ContextId,
  PeriodId,
  CorrelationId,
  SignalHash,
  CorrelationMetric,
  SignalRecord,
  SignalInput,
  CorrelationRecord,
  CorrelationInput,
  SignalResult,
} from './GreyBehaviorSignalTypes';

export {
  SignalKind,
  ActorType,
  ContextType,
  CorrelationMetricType,
  createSignalId,
  createActorId,
  createContextId,
  createPeriodId,
  createCorrelationId,
  createSignalHash,
  computeSignalHash,
  computeCorrelationHash,
  signalSuccess,
  signalError,
  isValidIntensity,
  isValidDuration,
  isValidConfidence,
  isValidSampleSize,
  isValidCorrelationMetric,
  SIGNAL_GENESIS_HASH,
} from './GreyBehaviorSignalTypes';

// ============================================================================
// REGISTRY EXPORTS
// ============================================================================

export { GreyBehaviorSignalRegistry } from './GreyBehaviorSignalRegistry';

// ============================================================================
// ANALYZER EXPORTS
// ============================================================================

export type {
  SignalSummary,
  ActorSignalProfile,
  ContextSignalDistribution,
  PeriodCorrelationSummary,
  SignalCoOccurrence,
  TrendAnalysis,
} from './GreyCorrelationAnalyzer';

export {
  calculateSignalSummary,
  calculateAllSignalSummaries,
  calculateActorSignalProfile,
  calculateContextSignalDistribution,
  calculatePeriodCorrelationSummary,
  calculateSignalCoOccurrence,
  calculateAllCoOccurrences,
  calculateTrendAnalysis,
  calculateCorrelationMetrics,
  calculateIntensityElasticity,
} from './GreyCorrelationAnalyzer';

// ============================================================================
// VIEW EXPORTS
// ============================================================================

export type {
  CorrelationBySignalView,
  CorrelationByActorView,
  CorrelationByContextView,
  CorrelationByPeriodView,
  CorrelationTraceView,
} from './GreyBehaviorCorrelationViews';

export {
  buildCorrelationBySignalView,
  buildAllCorrelationBySignalViews,
  buildCorrelationByActorView,
  buildCorrelationByContextView,
  buildCorrelationByPeriodView,
  buildCorrelationTraceView,
  buildCorrelationSummaryView,
  buildTopActorsView,
  buildTopContextsView,
} from './GreyBehaviorCorrelationViews';

// ============================================================================
// BOUNDARY GUARD EXPORTS
// ============================================================================

export {
  FORBIDDEN_FINANCIAL_KEYWORDS,
  FORBIDDEN_REVENUE_KEYWORDS,
  FORBIDDEN_ACTION_KEYWORDS,
  FORBIDDEN_STATE_KEYWORDS,
  FORBIDDEN_ENGINE_KEYWORDS,
  FORBIDDEN_INCENTIVE_ACTION_KEYWORDS,
  ALL_FORBIDDEN_KEYWORDS,
  ALLOWED_SIGNAL_KEYWORDS,
  ALLOWED_CORRELATION_KEYWORDS,
  ALLOWED_ANALYSIS_KEYWORDS,
  ALLOWED_BEHAVIOR_KEYWORDS,
  containsForbiddenFinancialKeywords,
  containsForbiddenRevenueKeywords,
  containsForbiddenActionKeywords,
  containsForbiddenStateKeywords,
  containsForbiddenEngineKeywords,
  containsForbiddenIncentiveActionKeywords,
  containsAnyForbiddenKeywords,
  findForbiddenKeywords,
  validateSemanticSafety,
  validateObjectKeys,
  assertSemanticSafety,
  MODULE_BOUNDARIES,
  getModuleBoundariesText,
} from './GreyBehaviorBoundaryGuards';
