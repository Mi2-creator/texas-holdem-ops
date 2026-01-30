/**
 * OpsQueryViews.ts
 *
 * Composed read-only views across OPS layers.
 *
 * CRITICAL CONSTRAINTS:
 * - READ-ONLY: Only re-exports existing views
 * - NO ANALYTICS: Does not compute new metrics
 * - NO TRANSFORMS: Does not change data semantics
 * - PASS-THROUGH: Directly exposes underlying OPS views
 * - FROZEN: All outputs are immutable
 *
 * WHAT THIS MODULE DOES:
 * - Re-exports read-only views from OPS-1 through OPS-8
 * - Provides unified access to existing views
 * - Returns frozen, immutable results
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot compute new analytics or metrics
 * - Cannot transform underlying data
 * - Cannot trigger any actions
 * - Cannot write to any registry
 */

// ============================================================================
// OPS-1: RECHARGE VIEWS (RE-EXPORT)
// ============================================================================

export {
  // Period Views
  getRechargesByPeriod,

  // Club Views
  getRechargesByClub,
  getAllClubSummaries,

  // Agent Views
  getRechargesByAgent,
  getAllAgentSummaries,

  // Trace Views
  getRechargeTrace,
  getAllRechargeTraces,

  // Aggregate Views
  getOverallSummary,
} from '../views';

export type {
  PeriodSummary,
  ClubSummary,
  PlayerBreakdown,
  AgentSummary,
  ClubBreakdownForAgent,
  TraceEntry,
  RechargeTrace,
  OverallSummary,
} from '../views';

// ============================================================================
// OPS-2: APPROVAL VIEWS (RE-EXPORT)
// ============================================================================

export {
  getPendingApprovalsByPeriod,
  getAllPendingApprovals,
  getApprovalHistoryByRecharge,
  getAllApprovalHistories,
  getApprovalSummaryByActor,
  getAllActorSummaries as getAllApprovalActorSummaries,
  getOverallApprovalSummary,
} from '../approvals';

export type {
  PendingApprovalsByPeriod,
  ApprovalHistoryByRecharge,
  ApprovalSummaryByActor,
  OverallApprovalSummary,
} from '../approvals';

// ============================================================================
// OPS-3: RISK VIEWS (RE-EXPORT)
// ============================================================================

export {
  getRiskSummaryByPeriod,
  getRiskSummaryByActor,
  getRiskSummaryByClub,
  getHighRiskFlagList,
  getOverallRiskSummary,
  getAllActorSummaries as getAllRiskActorSummaries,
  getAllClubSummaries as getAllRiskClubSummaries,
  aggregateAnalysisResults,
} from '../risk-limits';

export type {
  RiskSummaryByPeriod,
  RiskSummaryByActor,
  RiskSummaryByClub,
  HighRiskFlagList,
  OverallRiskSummary,
} from '../risk-limits';

// ============================================================================
// OPS-4: ACK VIEWS (RE-EXPORT)
// ============================================================================

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
} from '../risk-ack';

export type {
  PendingByPeriod,
  HistoryBySignal,
  HistoryByActor,
  SummaryByDecision,
  OverallAckSummary,
} from '../risk-ack';

// ============================================================================
// OPS-5: INTENT VIEWS (RE-EXPORT)
// ============================================================================

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
} from '../execution-intent';

export type {
  IntentWithReportsView,
  IntentSummaryView,
  OperatorActivityView,
  RegistryStatisticsView,
} from '../execution-intent';

// ============================================================================
// OPS-6: FLOW VIEWS (RE-EXPORT)
// ============================================================================

export {
  // Period Views
  getFlowsByPeriod,
  getFlowsByPeriods,

  // Entity Views
  getEntitySummary as getFlowEntitySummary,
  getAllEntitySummaries as getAllFlowEntitySummaries,

  // Agent Views
  getAgentSummary as getFlowAgentSummary,
  getAllAgentSummaries as getAllFlowAgentSummaries,

  // Table Views
  getTableSummary as getFlowTableSummary,

  // Club Views
  getClubSummary as getFlowClubSummary,
  getAllClubSummaries as getAllFlowClubSummaries,

  // Trace Views
  getFlowTrace,
  getAllFlowTraces,

  // Overall
  getOverallSummary as getFlowOverallSummary,

  // Filtered
  getFlowsByDirection,
  getFlowsBySource,
  getFlowsByOperator,
} from '../grey-flow';

export type {
  PeriodSummaryView,
  EntitySummaryView,
  AgentSummaryView,
  TableSummaryView,
  ClubSummaryView,
  FlowTraceView,
  OverallSummaryView,
} from '../grey-flow';

// ============================================================================
// OPS-7: ATTRIBUTION/EXPOSURE VIEWS (RE-EXPORT)
// ============================================================================

export {
  // Agent Views
  getExposureByAgent,
  getAllAgentExposures,

  // Club Views
  getExposureByClub,
  getAllClubExposures,

  // Table Views
  getExposureByTable,

  // Period Views
  getExposureByPeriod,

  // Trace Views
  getExposureTrace,
  getAllExposureTraces,

  // Overall
  getOverallExposureSummary,

  // Trend
  getExposureTrendView,

  // Filtered
  getHighExposureAttributions,
  getAttributionsByKind,
} from '../grey-attribution';

export type {
  ExposureByAgentView,
  ExposureByClubView,
  ExposureByTableView,
  ExposureByPeriodView,
  ExposureTraceView,
  OverallExposureSummaryView,
} from '../grey-attribution';

// ============================================================================
// OPS-8: BEHAVIOR/CORRELATION VIEWS (RE-EXPORT)
// ============================================================================

export {
  // Signal Views
  buildCorrelationBySignalView,
  buildAllCorrelationBySignalViews,

  // Actor Views
  buildCorrelationByActorView,

  // Context Views
  buildCorrelationByContextView,

  // Period Views
  buildCorrelationByPeriodView,

  // Trace Views
  buildCorrelationTraceView,

  // Summary Views
  buildCorrelationSummaryView,

  // Top Views
  buildTopActorsView,
  buildTopContextsView,
} from '../grey-behavior';

export type {
  CorrelationBySignalView,
  CorrelationByActorView,
  CorrelationByContextView,
  CorrelationByPeriodView,
  CorrelationTraceView,
} from '../grey-behavior';

// ============================================================================
// VIEW CATALOG (READ-ONLY METADATA)
// ============================================================================

/**
 * View catalog entry.
 */
export interface ViewCatalogEntry {
  /** Module name */
  readonly module: string;
  /** View name */
  readonly view: string;
  /** Description */
  readonly description: string;
  /** Is read-only */
  readonly isReadOnly: true;
}

/**
 * Get complete view catalog.
 * READ-ONLY: Returns frozen catalog of available views.
 */
export function getViewCatalog(): readonly ViewCatalogEntry[] {
  return Object.freeze([
    // OPS-1: Recharge
    { module: 'recharge', view: 'getRechargesByPeriod', description: 'Get recharges by period', isReadOnly: true },
    { module: 'recharge', view: 'getRechargesByClub', description: 'Get recharges by club', isReadOnly: true },
    { module: 'recharge', view: 'getRechargesByAgent', description: 'Get recharges by agent', isReadOnly: true },
    { module: 'recharge', view: 'getRechargeTrace', description: 'Get recharge trace', isReadOnly: true },
    { module: 'recharge', view: 'getOverallSummary', description: 'Get overall summary', isReadOnly: true },

    // OPS-2: Approval
    { module: 'approval', view: 'getPendingApprovalsByPeriod', description: 'Get pending approvals by period', isReadOnly: true },
    { module: 'approval', view: 'getApprovalHistoryByRecharge', description: 'Get approval history by recharge', isReadOnly: true },
    { module: 'approval', view: 'getApprovalSummaryByActor', description: 'Get approval summary by actor', isReadOnly: true },
    { module: 'approval', view: 'getOverallApprovalSummary', description: 'Get overall approval summary', isReadOnly: true },

    // OPS-3: Risk
    { module: 'risk', view: 'getRiskSummaryByPeriod', description: 'Get risk summary by period', isReadOnly: true },
    { module: 'risk', view: 'getRiskSummaryByActor', description: 'Get risk summary by actor', isReadOnly: true },
    { module: 'risk', view: 'getRiskSummaryByClub', description: 'Get risk summary by club', isReadOnly: true },
    { module: 'risk', view: 'getHighRiskFlagList', description: 'Get high risk flags', isReadOnly: true },
    { module: 'risk', view: 'getOverallRiskSummary', description: 'Get overall risk summary', isReadOnly: true },

    // OPS-4: Ack
    { module: 'ack', view: 'getPendingByPeriod', description: 'Get pending acks by period', isReadOnly: true },
    { module: 'ack', view: 'getHistoryBySignal', description: 'Get history by signal', isReadOnly: true },
    { module: 'ack', view: 'getHistoryByActor', description: 'Get history by actor', isReadOnly: true },
    { module: 'ack', view: 'getOverallAckSummary', description: 'Get overall ack summary', isReadOnly: true },

    // OPS-5: Intent
    { module: 'intent', view: 'getIntentWithReports', description: 'Get intent with reports', isReadOnly: true },
    { module: 'intent', view: 'getIntentSummary', description: 'Get intent summary', isReadOnly: true },
    { module: 'intent', view: 'getOperatorActivity', description: 'Get operator activity', isReadOnly: true },
    { module: 'intent', view: 'getRegistryStatistics', description: 'Get registry statistics', isReadOnly: true },

    // OPS-6: Flow
    { module: 'flow', view: 'getFlowsByPeriod', description: 'Get flows by period', isReadOnly: true },
    { module: 'flow', view: 'getFlowEntitySummary', description: 'Get flow entity summary', isReadOnly: true },
    { module: 'flow', view: 'getFlowAgentSummary', description: 'Get flow agent summary', isReadOnly: true },
    { module: 'flow', view: 'getFlowTrace', description: 'Get flow trace', isReadOnly: true },
    { module: 'flow', view: 'getFlowOverallSummary', description: 'Get flow overall summary', isReadOnly: true },

    // OPS-7: Attribution
    { module: 'attribution', view: 'getExposureByAgent', description: 'Get exposure by agent', isReadOnly: true },
    { module: 'attribution', view: 'getExposureByClub', description: 'Get exposure by club', isReadOnly: true },
    { module: 'attribution', view: 'getExposureByPeriod', description: 'Get exposure by period', isReadOnly: true },
    { module: 'attribution', view: 'getExposureTrace', description: 'Get exposure trace', isReadOnly: true },
    { module: 'attribution', view: 'getOverallExposureSummary', description: 'Get overall exposure summary', isReadOnly: true },

    // OPS-8: Behavior
    { module: 'behavior', view: 'buildCorrelationBySignalView', description: 'Build correlation by signal view', isReadOnly: true },
    { module: 'behavior', view: 'buildCorrelationByActorView', description: 'Build correlation by actor view', isReadOnly: true },
    { module: 'behavior', view: 'buildCorrelationByContextView', description: 'Build correlation by context view', isReadOnly: true },
    { module: 'behavior', view: 'buildCorrelationByPeriodView', description: 'Build correlation by period view', isReadOnly: true },
    { module: 'behavior', view: 'buildCorrelationSummaryView', description: 'Build correlation summary view', isReadOnly: true },
  ]);
}

/**
 * Get views for a specific module.
 * READ-ONLY: Returns frozen list of views.
 */
export function getViewsForModule(module: string): readonly ViewCatalogEntry[] {
  const catalog = getViewCatalog();
  return Object.freeze(catalog.filter(entry => entry.module === module));
}

/**
 * Check if a view exists.
 * READ-ONLY: Pure lookup function.
 */
export function viewExists(module: string, view: string): boolean {
  const catalog = getViewCatalog();
  return catalog.some(entry => entry.module === module && entry.view === view);
}
