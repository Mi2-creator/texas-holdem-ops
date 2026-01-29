/**
 * grey-flow/index.ts
 *
 * OPS-6: Grey Flow & Rake Analytics
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PASSIVE DATA LAYER: Stores data, does NOT execute anything
 * - PULL-BASED: External systems query this data, we never push
 * - REFERENCE-ONLY: Flow records are references, not monetary values
 * - RATIO-ONLY: Rake is ratio/share/index, NOT deduction or settlement
 * - APPEND-ONLY: Records are never modified or deleted
 * - HASH-CHAINED: Each record links to the previous for audit integrity
 * - NO STATE MACHINES: No status transitions, no lifecycles, no workflows
 * - NO ENGINE IMPORTS: No dependencies on engine or execution modules
 *
 * SEMANTIC BOUNDARIES:
 * - "Flow" is count and ratio, NOT money amount
 * - "Rake" is ratio/share/index, NOT deduction or settlement
 * - All outputs are analysis results, no side effects
 */

// ============================================================================
// FLOW TYPES
// ============================================================================
export {
  // Branded ID types
  type GreyFlowRecordId,
  type FlowHash,
  type EntityId,
  type SessionId,
  type HandId,
  type FlowOperatorId,
  // ID factories
  createGreyFlowRecordId,
  createFlowHash,
  createEntityId,
  createSessionId,
  createHandId,
  createFlowOperatorId,
  // Enums (classification only, NOT status)
  FlowDirection,
  FlowSource,
  EntityType,
  FlowErrorCode,
  // Error types
  type FlowError,
  type FlowResult,
  // Result helpers
  flowSuccess,
  flowFailure,
  createFlowError,
  // Core types
  type GreyFlowInput,
  type GreyFlowRecord,
  // Hash utilities
  FLOW_GENESIS_HASH,
  computeFlowHash,
  computeFlowRecordHash,
  computeFlowId,
  // Validation
  isValidFlowInput,
} from './GreyFlowTypes';

// ============================================================================
// FLOW REGISTRY
// ============================================================================
export {
  // Registry class
  GreyFlowRegistry,
  // Registry types
  type FlowRegistryState,
  type FlowQueryOptions,
  // Factory functions
  createGreyFlowRegistry,
  createTestFlowRegistry,
} from './GreyFlowRegistry';

// ============================================================================
// FLOW LINKING
// ============================================================================
export {
  // Link types
  type FlowLinkId,
  FlowLinkType,
  // ID factory
  createFlowLinkId,
  // Input/Record types
  type FlowLinkInput,
  type FlowLinkRecord,
  type FlowLinkRegistryState,
  type FlowLinksSummary,
  type ReferenceLinksSummary,
  // Validation
  isValidFlowLinkInput,
  // Linker class
  GreyFlowLinker,
  // Factory functions
  createGreyFlowLinker,
  createTestFlowLinker,
} from './GreyFlowLinking';

// ============================================================================
// FLOW AGGREGATION
// ============================================================================
export {
  // Aggregation types
  type VolumeAggregation,
  type FrequencyAggregation,
  type DistributionAggregation,
  type RakeRatioAggregation,
  type TimeSeriesPoint,
  type TimeSeriesAggregation,
  // Core aggregation functions
  computeVolumeAggregation,
  computeFrequencyAggregation,
  computeDistributionAggregation,
  computeRakeRatioAggregation,
  computeTimeSeriesAggregation,
  // Entity-specific aggregations
  computeEntityVolume,
  computeEntityFrequency,
  computeEntityRakeRatios,
  // Source-specific aggregations
  computeVolumeBySource,
  computeFrequencyBySource,
} from './GreyFlowAggregation';

// ============================================================================
// FLOW VIEWS
// ============================================================================
export {
  // View types
  type PeriodSummaryView,
  type EntitySummaryView,
  type AgentSummaryView,
  type TableSummaryView,
  type ClubSummaryView,
  type FlowTraceView,
  type OverallSummaryView,
  // Period views
  getFlowsByPeriod,
  getFlowsByPeriods,
  // Entity views
  getEntitySummary,
  getAllEntitySummaries,
  // Agent views
  getAgentSummary,
  getAllAgentSummaries,
  // Table views
  getTableSummary,
  // Club views
  getClubSummary,
  getAllClubSummaries,
  // Trace views
  getFlowTrace,
  getAllFlowTraces,
  // Overall views
  getOverallSummary,
  // Filtered views
  getFlowsByDirection,
  getFlowsBySource,
  getFlowsByOperator,
} from './GreyFlowViews';

// ============================================================================
// BOUNDARY GUARDS
// ============================================================================
export {
  // Forbidden keyword lists
  FLOW_FORBIDDEN_FINANCIAL_KEYWORDS,
  FLOW_FORBIDDEN_EXECUTION_KEYWORDS,
  FLOW_FORBIDDEN_PUSH_KEYWORDS,
  FLOW_FORBIDDEN_STATE_MACHINE_KEYWORDS,
  FLOW_FORBIDDEN_IMPORT_SOURCES,
  // Types
  type FlowBoundaryViolation,
  type FlowBoundaryCheckResult,
  // Check functions
  checkForFinancialKeywords,
  checkForFlowExecutionKeywords,
  checkForFlowPushKeywords,
  checkForFlowStateMachineKeywords,
  checkForFlowForbiddenImport,
  checkAllFlowBoundaries,
  // Assertion functions
  assertNoFinancialKeywords,
  assertNoFlowExecutionKeywords,
  assertNoFlowPushKeywords,
  assertNoFlowStateMachineKeywords,
  assertNoFlowForbiddenImport,
  assertAllFlowBoundaries,
  assertIsRatioOnly,
  assertIsUnitCount,
  // Documentation
  FLOW_MODULE_DESIGN_CONSTRAINTS,
} from './GreyFlowBoundaryGuards';
