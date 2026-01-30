/**
 * OPS Query Layer
 *
 * FINAL FREEZE: Read-only Query & Snapshot Layer
 *
 * This module provides a unified, read-only query interface
 * for all OPS-1 through OPS-8 modules.
 *
 * CRITICAL CONSTRAINTS:
 * - READ-ONLY: Cannot write, trigger, execute, or acknowledge
 * - NO ANALYTICS: Does not compute new metrics or correlations
 * - NO TRANSFORMS: Passes through data without semantic changes
 * - PULL-BASED: All queries are synchronous pulls
 * - FROZEN: All outputs are immutable
 * - DETERMINISTIC: Same input always produces same output
 *
 * WHAT THIS MODULE DOES:
 * - Re-exports read-only views from OPS-1 through OPS-8
 * - Provides snapshot-style query functions
 * - Exposes time-bounded and scope-bounded selectors
 * - Enforces query layer boundary guards
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot write to any OPS registry
 * - Cannot trigger any actions or effects
 * - Cannot compute new analytics
 * - Cannot use callbacks, events, or async patterns
 * - Cannot import or depend on engine modules
 */

// ============================================================================
// QUERY TYPES
// ============================================================================

export type {
  TimeScope,
  PeriodScope,
  EntityScope,
  QueryScope,
  OpsModule,
  QuerySelector,
  QueryResult,
  QueryError,
  QueryResponse,
  QueryMetadata,
  SnapshotId,
  SnapshotMetadata,
  SnapshotState,
} from './OpsQueryTypes';

export {
  QueryErrorCode,
  querySuccess,
  queryError,
  isValidTimeScope,
  isValidPeriodScope,
  isValidEntityScope,
  isValidQueryScope,
  isValidOpsModule,
  createSnapshotId,
} from './OpsQueryTypes';

// ============================================================================
// QUERY REGISTRY
// ============================================================================

export {
  OpsQueryRegistry,
  createOpsQueryRegistry,
  createTestOpsQueryRegistry,
} from './OpsQueryRegistry';

// ============================================================================
// QUERY VIEWS (RE-EXPORTS FROM OPS MODULES)
// ============================================================================

// OPS-1: Recharge Views
export {
  getRechargesByPeriod,
  getRechargesByClub,
  getAllClubSummaries,
  getRechargesByAgent,
  getAllAgentSummaries,
  getRechargeTrace,
  getAllRechargeTraces,
  getOverallSummary,
} from './OpsQueryViews';

export type {
  PeriodSummary,
  ClubSummary,
  PlayerBreakdown,
  AgentSummary,
  ClubBreakdownForAgent,
  TraceEntry,
  RechargeTrace,
  OverallSummary,
} from './OpsQueryViews';

// OPS-2: Approval Views
export {
  getPendingApprovalsByPeriod,
  getAllPendingApprovals,
  getApprovalHistoryByRecharge,
  getAllApprovalHistories,
  getApprovalSummaryByActor,
  getAllApprovalActorSummaries,
  getOverallApprovalSummary,
} from './OpsQueryViews';

export type {
  PendingApprovalsByPeriod,
  ApprovalHistoryByRecharge,
  ApprovalSummaryByActor,
  OverallApprovalSummary,
} from './OpsQueryViews';

// OPS-3: Risk Views
export {
  getRiskSummaryByPeriod,
  getRiskSummaryByActor,
  getRiskSummaryByClub,
  getHighRiskFlagList,
  getOverallRiskSummary,
  getAllRiskActorSummaries,
  getAllRiskClubSummaries,
  aggregateAnalysisResults,
} from './OpsQueryViews';

export type {
  RiskSummaryByPeriod,
  RiskSummaryByActor,
  RiskSummaryByClub,
  HighRiskFlagList,
  OverallRiskSummary,
} from './OpsQueryViews';

// OPS-4: Ack Views
export {
  getPendingByPeriod,
  getHistoryBySignal,
  getHistoryByActor,
  getSummaryByDecision,
  getOverallAckSummary,
  getAllSignalHistories,
  getAllActorHistories,
  getEscalatedSignals,
  getUnacknowledgedSignals,
} from './OpsQueryViews';

export type {
  PendingByPeriod,
  HistoryBySignal,
  HistoryByActor,
  SummaryByDecision,
  OverallAckSummary,
} from './OpsQueryViews';

// OPS-5: Intent Views
export {
  getIntentWithReports,
  getAllIntentsWithReports,
  getIntentSummary,
  getAllIntentSummaries,
  getOperatorActivity,
  getRegistryStatistics,
  getIntentsWithoutReports,
  getIntentsWithCompletedReports,
  filterIntentsByType,
  filterReportsByOutcome,
} from './OpsQueryViews';

export type {
  IntentWithReportsView,
  IntentSummaryView,
  OperatorActivityView,
  RegistryStatisticsView,
} from './OpsQueryViews';

// OPS-6: Flow Views
export {
  getFlowsByPeriod,
  getFlowsByPeriods,
  getFlowEntitySummary,
  getAllFlowEntitySummaries,
  getFlowAgentSummary,
  getAllFlowAgentSummaries,
  getFlowTableSummary,
  getFlowClubSummary,
  getAllFlowClubSummaries,
  getFlowTrace,
  getAllFlowTraces,
  getFlowOverallSummary,
  getFlowsByDirection,
  getFlowsBySource,
  getFlowsByOperator,
} from './OpsQueryViews';

export type {
  PeriodSummaryView,
  EntitySummaryView,
  AgentSummaryView,
  TableSummaryView,
  ClubSummaryView,
  FlowTraceView,
  OverallSummaryView,
} from './OpsQueryViews';

// OPS-7: Attribution Views
export {
  getExposureByAgent,
  getAllAgentExposures,
  getExposureByClub,
  getAllClubExposures,
  getExposureByTable,
  getExposureByPeriod,
  getExposureTrace,
  getAllExposureTraces,
  getOverallExposureSummary,
  getExposureTrendView,
  getHighExposureAttributions,
  getAttributionsByKind,
} from './OpsQueryViews';

export type {
  ExposureByAgentView,
  ExposureByClubView,
  ExposureByTableView,
  ExposureByPeriodView,
  ExposureTraceView,
  OverallExposureSummaryView,
} from './OpsQueryViews';

// OPS-8: Behavior Views
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
} from './OpsQueryViews';

export type {
  CorrelationBySignalView,
  CorrelationByActorView,
  CorrelationByContextView,
  CorrelationByPeriodView,
  CorrelationTraceView,
} from './OpsQueryViews';

// View Catalog
export {
  getViewCatalog,
  getViewsForModule,
  viewExists,
} from './OpsQueryViews';

export type {
  ViewCatalogEntry,
} from './OpsQueryViews';

// ============================================================================
// QUERY GUARDS
// ============================================================================

export {
  // Forbidden keyword lists
  FORBIDDEN_MUTATION_KEYWORDS,
  FORBIDDEN_EXECUTION_KEYWORDS,
  FORBIDDEN_ENGINE_KEYWORDS,
  FORBIDDEN_FINANCIAL_KEYWORDS,
  FORBIDDEN_STATE_KEYWORDS,
  FORBIDDEN_ASYNC_KEYWORDS,
  ALL_FORBIDDEN_KEYWORDS,

  // Check functions
  containsMutationKeywords,
  containsExecutionKeywords,
  containsEngineKeywords,
  containsFinancialKeywords,
  containsStateKeywords,
  containsAsyncKeywords,
  containsAnyForbiddenKeywords,
  findForbiddenKeywords,

  // Validation functions
  validateNoMutation,
  validateNoExecution,
  validateNoEngine,
  validateNoFinancial,
  validateNoAsync,
  validateQueryLayerCompliance,
  validationSuccess,
  validationFailure,

  // Assertion functions
  assertNoMutation,
  assertNoExecution,
  assertNoEngine,
  assertQueryLayerCompliance,

  // Constraints documentation
  QUERY_LAYER_CONSTRAINTS,
  getQueryLayerConstraintsText,
} from './OpsQueryGuards';

export type {
  ValidationResult,
} from './OpsQueryGuards';
