/**
 * OPS-3: Grey Risk Limits & Threshold Analysis
 *
 * Public exports for risk analysis module.
 *
 * CRITICAL GUARANTEES:
 * - ANALYSIS-ONLY: This module observes and flags, NEVER enforces or blocks
 * - READ-ONLY: No modifications to any data
 * - REFERENCE-ONLY: All values are references, not money
 * - INTEGER-ONLY: No floating point arithmetic
 * - DETERMINISTIC: Same inputs produce same outputs
 * - NO ENGINE IMPORTS: Completely isolated from engine internals
 * - NO MUTATIONS: All operations are read-only analysis
 *
 * WHAT THIS MODULE CANNOT DO:
 * - CANNOT block any operation
 * - CANNOT execute any action
 * - CANNOT auto-adjust anything
 * - CANNOT auto-block anything
 * - CANNOT mutate any data
 * - CANNOT enforce any rules
 * - CANNOT reject any operations
 */

// ============================================================================
// TYPES
// ============================================================================

export {
  // Branded ID types
  type RiskRuleId,
  type RiskFlagId,
  type RiskHash,

  // ID factories
  createRiskRuleId,
  createRiskFlagId,
  createRiskHash,

  // Enums
  RiskSeverity,
  RiskCategory,
  ThresholdType,
  RiskErrorCode,

  // Error types
  type RiskError,
  type RiskResult,

  // Result helpers
  riskSuccess,
  riskFailure,
  createRiskError,

  // Threshold types
  type CountThreshold,
  type RateThreshold,
  type WindowThreshold,
  type PercentageThreshold,
  type Threshold,

  // Core types
  type RiskRule,
  type RiskRuleInput,
  type RiskFlag,
  type RiskRuleRecord,

  // Hash utilities
  RISK_GENESIS_HASH,
  computeRiskHash,
  computeRiskRecordHash,
  computeFlagId,

  // Validation
  isValidThreshold,
  isValidRiskRuleInput,
} from './RiskLimitTypes';

// ============================================================================
// REGISTRY
// ============================================================================

export {
  type RiskRuleRegistryState,
  RiskRuleRegistry,
  createRiskRuleRegistry,
  createTestRiskRuleRegistry,
} from './RiskRuleRegistry';

// ============================================================================
// EVALUATOR (PURE ANALYSIS FUNCTIONS)
// ============================================================================

export {
  // Input types
  type TimestampedEvent,
  type RechargeAnalysisInput,
  type ApprovalAnalysisInput,
  type ActorAnalysisInput,
  type SkewAnalysisInput,
  type PendingPatternInput,

  // Output type
  type AnalysisResult,

  // Individual evaluators (pure functions)
  evaluateFrequency,
  evaluateVelocity,
  evaluateConcentration,
  evaluateSkew,
  evaluateRepeatedPending,

  // Comprehensive evaluators (pure functions)
  evaluateRechargeRisk,
  evaluateApprovalRisk,
  evaluateActorConcentration,
  evaluateSkewRisk,
  evaluatePendingPatternRisk,
} from './RiskEvaluator';

// ============================================================================
// VIEWS (READ-ONLY)
// ============================================================================

export {
  // View types
  type RiskSummaryByPeriod,
  type RiskSummaryByActor,
  type RiskSummaryByClub,
  type HighRiskFlagList,
  type OverallRiskSummary,

  // View functions (read-only)
  getRiskSummaryByPeriod,
  getRiskSummaryByActor,
  getRiskSummaryByClub,
  getHighRiskFlagList,
  getOverallRiskSummary,
  getAllActorSummaries,
  getAllClubSummaries,
  aggregateAnalysisResults,
} from './RiskViews';

// ============================================================================
// BOUNDARY GUARDS
// ============================================================================

export {
  // Forbidden concepts
  RISK_FORBIDDEN_CONCEPTS,
  type RiskForbiddenConcept,
  RISK_FORBIDDEN_FUNCTION_PATTERNS,

  // Guards
  assertNoRiskForbiddenConcepts,
  assertNoRiskForbiddenFunctions,
  assertAnalysisOnly,
  assertFlagIsOutputOnly,
  assertValidRiskRuleInput,
  assertRuleFrozen,
  guardRiskRuleRegistration,

  // Boundary declaration
  RISK_BOUNDARY_DECLARATION,
} from './RiskBoundaryGuards';
