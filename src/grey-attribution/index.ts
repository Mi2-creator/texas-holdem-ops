/**
 * grey-attribution/index.ts
 *
 * OPS-7: Grey Revenue Attribution & Exposure Analysis
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PASSIVE DATA LAYER: Stores data, does NOT execute anything
 * - PULL-BASED: External systems query this data, we never push
 * - REFERENCE-ONLY: Attribution records are references, not monetary values
 * - EXPOSURE-ONLY: All metrics are exposure/ratio/share/index, NOT revenue
 * - APPEND-ONLY: Records are never modified or deleted
 * - HASH-CHAINED: Each record links to the previous for audit integrity
 * - NO STATE MACHINES: No status transitions, no lifecycles, no workflows
 * - NO ENGINE IMPORTS: No dependencies on engine or execution modules
 *
 * SEMANTIC BOUNDARIES:
 * - "Attribution" explains WHY a ratio is considered related
 * - "Exposure" is risk/impact exposure, NOT revenue or earnings
 * - All outputs are analysis results, no side effects
 */

// ============================================================================
// ATTRIBUTION TYPES
// ============================================================================
export {
  // Branded ID types
  type AttributionId,
  type SourceId,
  type TargetId,
  type PeriodId,
  type AttributionHash,
  type AttributionOperatorId,
  // ID factories
  createAttributionId,
  createSourceId,
  createTargetId,
  createPeriodId,
  createAttributionHash,
  createAttributionOperatorId,
  // Enums (classification only, NOT status)
  AttributionKind,
  ExposureMetricType,
  AttributionEntityType,
  AttributionErrorCode,
  // Error types
  type AttributionError,
  type AttributionResult,
  // Result helpers
  attributionSuccess,
  attributionFailure,
  createAttributionError,
  // Core types
  type ExposureMetric,
  type AttributionInput,
  type AttributionRecord,
  // Hash utilities
  ATTRIBUTION_GENESIS_HASH,
  computeAttributionHash,
  computeAttributionRecordHash,
  computeAttributionId,
  // Validation
  isValidExposureMetric,
  isValidAttributionInput,
} from './GreyAttributionTypes';

// ============================================================================
// ATTRIBUTION REGISTRY
// ============================================================================
export {
  // Registry class
  GreyAttributionRegistry,
  // Registry types
  type AttributionRegistryState,
  type AttributionQueryOptions,
  // Factory functions
  createGreyAttributionRegistry,
  createTestAttributionRegistry,
} from './GreyAttributionRegistry';

// ============================================================================
// EXPOSURE CALCULATOR
// ============================================================================
export {
  // Calculation types
  type ExposureSummary,
  type ExposureDistribution,
  type ExposureTrendPoint,
  type ExposureTrend,
  type FlowExposureInput,
  // Calculation functions
  calculateExposureSummary,
  calculateAllExposureSummaries,
  calculateExposureDistribution,
  calculateExposureTrend,
  calculateExposureFromFlows,
  calculateWeightedExposure,
  compareExposure,
} from './GreyExposureCalculator';

// ============================================================================
// ATTRIBUTION LINKING
// ============================================================================
export {
  // Link types
  type AttributionLinkId,
  AttributionLinkTargetType,
  // ID factory
  createAttributionLinkId,
  // Input/Record types
  type AttributionLinkInput,
  type AttributionLinkRecord,
  type AttributionLinkRegistryState,
  type AttributionLinksSummary,
  // Validation
  isValidAttributionLinkInput,
  // Linker class
  GreyAttributionLinker,
  // Factory functions
  createGreyAttributionLinker,
  createTestAttributionLinker,
} from './GreyAttributionLinking';

// ============================================================================
// EXPOSURE VIEWS
// ============================================================================
export {
  // View types
  type ExposureByAgentView,
  type ExposureByClubView,
  type ExposureByTableView,
  type ExposureByPeriodView,
  type ExposureTraceView,
  type OverallExposureSummaryView,
  // Agent views
  getExposureByAgent,
  getAllAgentExposures,
  // Club views
  getExposureByClub,
  getAllClubExposures,
  // Table views
  getExposureByTable,
  // Period views
  getExposureByPeriod,
  // Trace views
  getExposureTrace,
  getAllExposureTraces,
  // Overall views
  getOverallExposureSummary,
  // Trend views
  getExposureTrendView,
  // Filtered views
  getHighExposureAttributions,
  getAttributionsByKind,
} from './GreyExposureViews';

// ============================================================================
// BOUNDARY GUARDS
// ============================================================================
export {
  // Forbidden keyword lists
  ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_EXECUTION_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_PUSH_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_STATE_MACHINE_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_IMPORT_SOURCES,
  // Types
  type AttributionBoundaryViolation,
  type AttributionBoundaryCheckResult,
  // Check functions
  checkForAttributionFinancialKeywords,
  checkForAttributionRevenueKeywords,
  checkForAttributionExecutionKeywords,
  checkForAttributionPushKeywords,
  checkForAttributionStateMachineKeywords,
  checkForAttributionForbiddenImport,
  checkAllAttributionBoundaries,
  // Assertion functions
  assertNoAttributionFinancialKeywords,
  assertNoAttributionRevenueKeywords,
  assertNoAttributionExecutionKeywords,
  assertNoAttributionPushKeywords,
  assertNoAttributionStateMachineKeywords,
  assertNoAttributionForbiddenImport,
  assertAllAttributionBoundaries,
  assertIsExposureMetric,
  assertIsShareValue,
  // Documentation
  ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS,
} from './GreyAttributionBoundaryGuards';
