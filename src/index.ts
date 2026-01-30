/**
 * texas-holdem-ops
 *
 * External Operations Boundary for texas-holdem-engine
 *
 * OPS-0: External ops boundary & recharge reference scaffold (no value)
 * OPS-1: Manual recharge reference intake & grey flow linking (no money)
 * OPS-2: Manual approval & two-man rule for recharge references (no money)
 * OPS-3: Grey risk limits & threshold analysis (ANALYSIS-ONLY, no enforcement)
 * OPS-4: Human risk acknowledgement & sign-off (MANUAL-ONLY, no action)
 * OPS-5: External manual execution intent interface (FUTURE-CONSUMABLE, no execution)
 * OPS-6: Grey flow & rake analytics (ANALYSIS-ONLY, no execution)
 * OPS-7: Grey revenue attribution & exposure analysis (ANALYSIS-ONLY, no execution)
 * OPS-8: Grey incentive & behavior correlation analysis (ANALYSIS-ONLY, no execution)
 * OPS-FREEZE: Read-only query & snapshot layer (READ-ONLY, no mutations)
 *
 * CRITICAL CONSTRAINTS:
 * - EXTERNAL: Lives OUTSIDE texas-holdem-engine
 * - READ-ONLY: Never modifies engine state
 * - REFERENCE-ONLY: All values are references, not money
 * - DETERMINISTIC: Same inputs produce same outputs
 * - INTEGER-ONLY: No floating point arithmetic
 * - APPEND-ONLY: Records are never deleted
 * - IDEMPOTENT: Duplicate references are rejected
 * - MANUAL-ONLY: Human confirmation required
 *
 * FORBIDDEN CONCEPTS:
 * - No balances
 * - No wallets
 * - No payments
 * - No crypto
 * - No transfers
 * - No value computation
 * - No engine imports
 * - No automation
 */

// ============================================================================
// OPS CONFIG
// ============================================================================

export {
  // Version
  OPS_VERSION,
  OPS_PHASE,
  OPS_MODULE_INFO,

  // Status Enums
  ReferenceStatus,
  AdapterType,
  OpsErrorCode,

  // ID Factories
  createExternalReferenceId,
  createOpsSessionId,
  createRechargeReferenceId,
  createConfirmationId,

  // Result Helpers
  opsSuccess,
  opsFailure,
  createOpsError,

  // Validation Helpers
  isValidInteger,
  isValidPositiveInteger,
  isValidNonNegativeInteger,
  isValidTimestamp,
  isValidString,

  // Boundary Guards
  FORBIDDEN_CONCEPTS,
  FORBIDDEN_IMPORTS,
  FORBIDDEN_FUNCTION_PATTERNS,
  OPS_BOUNDARY_DECLARATION,
  checkForForbiddenConcepts,
  checkForForbiddenImports,
  checkForForbiddenFunctions,
  runBoundaryCheck,
  assertNoForbiddenConcepts,
  assertNoForbiddenImports,
  assertNoForbiddenFunctions,
  assertInteger,
  assertPositiveInteger,
  assertNonNegativeInteger,
  assertValidTimestamp,
} from './ops-config';

export type {
  // ID Types
  ExternalReferenceId,
  OpsSessionId,
  RechargeReferenceId,
  ConfirmationId,

  // Record Types
  RechargeReferenceInput,
  RechargeReferenceRecord,
  ConfirmationDetails,
  PushDetails,

  // Error Types
  OpsError,
  OpsResult,

  // Boundary Types
  ForbiddenConcept,
  BoundaryViolation,
  BoundaryCheckResult,
} from './ops-config';

// ============================================================================
// ADAPTERS
// ============================================================================

export {
  // Manual Admin
  ManualAdminAdapterStub,
  DEFAULT_MANUAL_ADMIN_CONFIG,
  createManualAdminAdapter,
} from './adapters/manual-admin';

export {
  // Future USDT (Placeholder)
  FUTURE_USDT_PLACEHOLDER,
  FutureUsdtAdapterStub,
  createFutureUsdtAdapter,
} from './adapters/future-usdt';

export type {
  ManualAdminInput,
  ManualAdminAdapterConfig,
  RechargeAdapter,
} from './adapters/manual-admin';

// ============================================================================
// INGESTION
// ============================================================================

export {
  RechargeIngestor,
  InMemoryReferenceStore,
  DEFAULT_INGESTOR_CONFIG,
  createRechargeIngestor,
} from './ingestion';

export type {
  IngestorConfig,
  ReferenceStore,
} from './ingestion';

// ============================================================================
// MAPPING
// ============================================================================

export {
  GreyRechargeMapper,
  createGreyRechargeMapper,
} from './mapping';

export type {
  GreyRechargeReference,
  MappingResult,
} from './mapping';

// ============================================================================
// APPROVALS (OPS-0)
// ============================================================================

export {
  HumanConfirmQueue,
  createHumanConfirmQueue,
} from './approvals';

export type {
  ConfirmationRequest,
  RejectionRequest,
  QueueItem,
} from './approvals';

// ============================================================================
// OPS-2: APPROVAL TYPES
// ============================================================================

export {
  // Enums
  ApprovalStatus,
  ApprovalDecision,
  ApprovalErrorCode,

  // ID Factories
  createApprovalId,
  createActorId,
  createApprovalHash,

  // Hash Utilities
  APPROVAL_GENESIS_HASH,
  computeApprovalHash,
  computeApprovalRecordHash,

  // Result Helpers
  approvalSuccess,
  approvalFailure,
  createApprovalError,

  // Validation
  isValidApprovalRequestInput,
  isValidApprovalDecisionInput,
  isTerminalStatus,
} from './approvals';

export type {
  ApprovalId,
  ActorId,
  ApprovalHash,
  ApprovalError,
  ApprovalResult,
  ApprovalRequestInput,
  ApprovalDecisionInput,
  ApprovalRequestRecord,
  ApprovalDecisionDetails,
} from './approvals';

// ============================================================================
// OPS-2: APPROVAL RECORD
// ============================================================================

export {
  createApprovalRequestRecord,
  createApprovalDecisionRecord,
  verifyRecordIntegrity,
  verifyChainLink,
  isRecordFrozen,
} from './approvals';

// ============================================================================
// OPS-2: APPROVAL REGISTRY
// ============================================================================

export {
  ApprovalRegistry,
  createApprovalRegistry,
  createTestApprovalRegistry,
} from './approvals';

export type {
  ApprovalRegistryState,
  ApprovalQueryOptions,
} from './approvals';

// ============================================================================
// OPS-2: APPROVAL VIEWS
// ============================================================================

export {
  getPendingApprovalsByPeriod,
  getAllPendingApprovals,
  getApprovalHistoryByRecharge,
  getAllApprovalHistories,
  getApprovalSummaryByActor,
  getAllActorSummaries,
  getOverallApprovalSummary,
} from './approvals';

export type {
  PendingApprovalsByPeriod,
  ApprovalHistoryByRecharge,
  ApprovalSummaryByActor,
  OverallApprovalSummary,
} from './approvals';

// ============================================================================
// OPS-2: APPROVAL BOUNDARY GUARDS
// ============================================================================

export {
  APPROVAL_FORBIDDEN_CONCEPTS,
  APPROVAL_BOUNDARY_DECLARATION,
  assertTwoManRule,
  assertActorCanDecide,
  assertValidApprovalRequestInput,
  assertValidApprovalDecisionInput,
  assertNoForbiddenConcepts as assertNoApprovalForbiddenConcepts,
  assertRecordFrozen,
  assertValidStatusTransition as assertValidApprovalStatusTransition,
  assertNotTerminal,
  guardApprovalRequest,
  guardApprovalDecision,
} from './approvals';

export type {
  ApprovalForbiddenConcept,
} from './approvals';

// ============================================================================
// EXPORTS
// ============================================================================

export {
  GreyPushClientStub,
  DEFAULT_PUSH_CLIENT_CONFIG,
  createGreyPushClient,
} from './exports';

export type {
  PushRequest,
  PushResponse,
  PushClientConfig,
} from './exports';

// ============================================================================
// OPS-1: MANUAL RECHARGE
// ============================================================================

export {
  // Types & Enums
  RechargeSource,
  DeclarationStatus,
  RechargeErrorCode,

  // ID Factories
  createManualRechargeReferenceId,
  createRegistryEntryId,
  createHashValue,

  // Hash Utilities
  GENESIS_HASH,
  computeHash,
  computeEntryHash,

  // Result Helpers
  rechargeSuccess,
  rechargeFailure,
  createRechargeError,
  isValidDeclarationInput,

  // Registry
  ManualRechargeRegistry,
  createManualRechargeRegistry,
  createTestRegistry,

  // Boundary Guards
  assertReferenceAmount,
  assertNoMoneyMetadata,
  assertValidStatusTransition,
  assertEntryIntegrity,
  assertEntryFrozen,
  assertValidGreyFlowIds,
  assertNoLinkingCycle,
  assertValidGenesis,
  assertValidChainLink,
  guardDeclarationInput,
  guardRegistryEntry,
} from './recharge';

export type {
  ManualRechargeReferenceId,
  RegistryEntryId,
  HashValue,
  ManualRechargeDeclaration,
  ManualRechargeDeclarationInput,
  ManualRechargeRegistryEntry,
  ConfirmationInfo,
  RechargeError,
  RechargeResult,
  RegistryState,
  RegistryQueryOptions,
} from './recharge';

// ============================================================================
// OPS-1: GREY FLOW LINKING
// ============================================================================

export {
  // Grey Flow Linker
  GreyFlowLinker,
  createGreyFlowLinker,
  createGreyFlowId,
} from './linking';

export type {
  GreyFlowId,
  LinkRequest,
  LinkRecord,
  LinkState,
} from './linking';

// ============================================================================
// OPS-1: RECHARGE VIEWS
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
} from './views';

export type {
  PeriodSummary,
  ClubSummary,
  PlayerBreakdown,
  AgentSummary,
  ClubBreakdownForAgent,
  TraceEntry,
  RechargeTrace,
  OverallSummary,
} from './views';

// ============================================================================
// OPS-3: GREY RISK LIMITS & THRESHOLD ANALYSIS
// ============================================================================
// CRITICAL: ANALYSIS-ONLY - This module observes and flags, NEVER enforces
// NO BLOCKING, NO EXECUTION, NO AUTO-ADJUST, NO MUTATION
// ============================================================================

export {
  // Enums
  RiskSeverity,
  RiskCategory,
  ThresholdType,
  RiskErrorCode,

  // ID Factories
  createRiskRuleId,
  createRiskFlagId,
  createRiskHash,

  // Result Helpers
  riskSuccess,
  riskFailure,
  createRiskError,

  // Hash Utilities
  RISK_GENESIS_HASH,
  computeRiskHash,
  computeRiskRecordHash,
  computeFlagId,

  // Validation
  isValidThreshold,
  isValidRiskRuleInput,

  // Registry
  RiskRuleRegistry,
  createRiskRuleRegistry,
  createTestRiskRuleRegistry,

  // Evaluators (PURE FUNCTIONS - analysis only)
  evaluateFrequency,
  evaluateVelocity,
  evaluateConcentration,
  evaluateSkew,
  evaluateRepeatedPending,
  evaluateRechargeRisk,
  evaluateApprovalRisk,
  evaluateActorConcentration,
  evaluateSkewRisk,
  evaluatePendingPatternRisk,

  // Views (READ-ONLY)
  getRiskSummaryByPeriod,
  getRiskSummaryByActor,
  getRiskSummaryByClub,
  getHighRiskFlagList,
  getOverallRiskSummary,
  getAllActorSummaries as getAllRiskActorSummaries,
  getAllClubSummaries as getAllRiskClubSummaries,
  aggregateAnalysisResults,

  // Boundary Guards
  RISK_FORBIDDEN_CONCEPTS,
  RISK_FORBIDDEN_FUNCTION_PATTERNS,
  assertNoRiskForbiddenConcepts,
  assertNoRiskForbiddenFunctions,
  assertAnalysisOnly,
  assertFlagIsOutputOnly,
  assertValidRiskRuleInput,
  assertRuleFrozen,
  guardRiskRuleRegistration,
  RISK_BOUNDARY_DECLARATION,
} from './risk-limits';

export type {
  // Branded ID Types
  RiskRuleId,
  RiskFlagId,
  RiskHash,

  // Error Types
  RiskError,
  RiskResult,

  // Threshold Types
  CountThreshold,
  RateThreshold,
  WindowThreshold,
  PercentageThreshold,
  Threshold,

  // Core Types
  RiskRule,
  RiskRuleInput,
  RiskFlag,
  RiskRuleRecord,

  // Registry Types
  RiskRuleRegistryState,

  // Input Types
  TimestampedEvent,
  RechargeAnalysisInput,
  ApprovalAnalysisInput,
  ActorAnalysisInput,
  SkewAnalysisInput,
  PendingPatternInput,

  // Output Types
  AnalysisResult,

  // View Types
  RiskSummaryByPeriod,
  RiskSummaryByActor,
  RiskSummaryByClub,
  HighRiskFlagList,
  OverallRiskSummary,

  // Guard Types
  RiskForbiddenConcept,
} from './risk-limits';

// ============================================================================
// OPS-4: HUMAN RISK ACKNOWLEDGEMENT & SIGN-OFF
// ============================================================================
// CRITICAL: MANUAL-ONLY - Records human acknowledgements only, NO actions
// NO BLOCKING, NO EXECUTION, NO AUTO-ADJUST, NO TRIGGER, NO MUTATION
// ============================================================================

export {
  // Enums
  AckDecision,
  AckRole,
  AckErrorCode,

  // ID Factories
  createRiskAckId,
  createRiskSignalId,
  createActorId as createAckActorId,
  createAckHash,

  // Result Helpers
  ackSuccess,
  ackFailure,
  createAckError,

  // Hash Utilities
  ACK_GENESIS_HASH,
  computeAckHash,
  computeAckRecordHash,
  computeAckId,

  // Validation
  isValidAckInput,
  isTerminalDecision,
  getRoleLevel,
  canRoleEscalate,

  // Record
  createAckRecord,
  verifyAckRecordIntegrity,
  verifyAckChainLink,
  isAckRecordFrozen,
  getSignalId,
  getActorId as getAckActorId,
  isAcknowledgement,
  isEscalation,
  isRejection,

  // Registry
  RiskAckRegistry,
  createRiskAckRegistry,
  createTestRiskAckRegistry,

  // Views (READ-ONLY)
  getPendingByPeriod,
  getHistoryBySignal,
  getHistoryByActor,
  getSummaryByDecision,
  getOverallAckSummary,
  getAllSignalHistories,
  getAllActorHistories,
  getEscalatedSignals,
  getUnacknowledgedSignals,

  // Boundary Guards
  ACK_FORBIDDEN_CONCEPTS,
  ACK_FORBIDDEN_FUNCTION_PATTERNS,
  assertNoAckForbiddenConcepts,
  assertNoAckForbiddenFunctions,
  assertManualOnly,
  assertHumanAcknowledgement,
  assertValidAckInput,
  assertAckRecordFrozen,
  assertCanEscalate,
  guardAckInput,
  ACK_BOUNDARY_DECLARATION,
} from './risk-ack';

export type {
  // Branded ID Types
  RiskAckId,
  RiskSignalId,
  ActorId as AckActorId,
  AckHash,

  // Error Types
  AckError,
  AckResult,

  // Core Types
  RiskAckInput,
  RiskAckRecord,

  // Registry Types
  AckRegistryState,
  AckQueryOptions,

  // View Types
  PendingByPeriod,
  HistoryBySignal,
  HistoryByActor,
  SummaryByDecision,
  OverallAckSummary,

  // Guard Types
  AckForbiddenConcept,
} from './risk-ack';

// ============================================================================
// OPS-5: EXTERNAL MANUAL EXECUTION INTENT INTERFACE
// ============================================================================
// CRITICAL: FUTURE-CONSUMABLE ONLY - Stores recommendations for external use
// PASSIVE DATA LAYER - No execution, no push, no blocking, no state machines
// PULL-BASED - External systems query this data, we never push
// APPEND-ONLY, HASH-CHAINED - Immutable records for audit integrity
// HUMAN-ASSERTED - Reports are human claims, not verified truth
// ============================================================================

export {
  // Intent Types
  IntentType,
  EvidenceType,
  IntentErrorCode,

  // Intent ID Factories
  createIntentId,
  createEvidenceId,
  createIntentHash,
  createOperatorId,

  // Intent Result Helpers
  intentSuccess,
  intentFailure,
  createIntentError,

  // Intent Hash Utilities
  INTENT_GENESIS_HASH,
  computeIntentHash,
  computeIntentRecordHash,
  computeIntentId,

  // Intent Validation
  isValidEvidenceReference,
  isValidIntentInput,

  // Intent Registry
  ExecutionIntentRegistry,
  createExecutionIntentRegistry,
  createTestIntentRegistry,

  // Evidence Binder
  createRiskSignalRef,
  createRiskAckRef,
  createApprovalRef,
  createRechargeRef,
  createGreyFlowRef,
  getEvidenceBindingSummary,
  getCrossReferenceSummary,
  getAllCrossReferences,
  filterIntentsByEvidenceType,
  getUniqueEvidenceIds,
  countEvidenceByType,

  // Report Types
  ReportedOutcome,
  ReportErrorCode,

  // Report ID Factories
  createReportId,
  createReportHash,

  // Report Result Helpers
  reportSuccess,
  reportFailure,
  createReportError,

  // Report Hash Utilities
  REPORT_GENESIS_HASH,
  computeReportHash,
  computeReportRecordHash,
  computeReportId,

  // Report Validation
  isValidReportInput,

  // Report Registry
  ExecutionReportRegistry,
  createExecutionReportRegistry,
  createTestReportRegistry,

  // Views (READ-ONLY)
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

  // Boundary Guards
  FORBIDDEN_EXECUTION_KEYWORDS,
  FORBIDDEN_PUSH_KEYWORDS,
  FORBIDDEN_BLOCKING_KEYWORDS,
  FORBIDDEN_STATE_MACHINE_KEYWORDS,
  FORBIDDEN_IMPORT_SOURCES,
  checkForExecutionKeywords,
  checkForPushKeywords,
  checkForBlockingKeywords,
  checkForStateMachineKeywords,
  checkForForbiddenImport,
  checkAllBoundaries,
  assertNoExecutionKeywords,
  assertNoPushKeywords,
  assertNoBlockingKeywords,
  assertNoStateMachineKeywords,
  assertNoForbiddenImport,
  assertAllBoundaries,
  MODULE_DESIGN_CONSTRAINTS,
} from './execution-intent';

export type {
  // Intent Branded ID Types
  IntentId,
  EvidenceId,
  IntentHash,
  OperatorId,

  // Intent Error Types
  IntentError,
  IntentResult,

  // Intent Core Types
  EvidenceReference,
  ExecutionIntentInput,
  ExecutionIntentRecord,

  // Intent Registry Types
  IntentRegistryState,
  IntentQueryOptions,

  // Evidence Binder Types
  EvidenceBindingSummary,
  CrossReferenceSummary,

  // Report Branded ID Types
  ReportId,
  ReportHash,

  // Report Error Types
  ReportError,
  ReportResult,

  // Report Core Types
  ExecutionReportInput,
  ExecutionReportRecord,

  // Report Registry Types
  ReportRegistryState,
  ReportQueryOptions,

  // View Types
  IntentWithReportsView,
  IntentSummaryView,
  OperatorActivityView,
  RegistryStatisticsView,

  // Boundary Guard Types
  BoundaryViolation as IntentBoundaryViolation,
  BoundaryCheckResult as IntentBoundaryCheckResult,
} from './execution-intent';

// ============================================================================
// OPS-6: GREY FLOW & RAKE ANALYTICS
// ============================================================================
// CRITICAL: ANALYSIS-ONLY - Passive data layer for flow tracking
// PASSIVE / PULL-BASED - External systems query this data, we never push
// REFERENCE-ONLY - Flow records are references, not monetary values
// RATIO-ONLY - Rake is ratio/share/index, NOT deduction or settlement
// APPEND-ONLY, HASH-CHAINED - Immutable records for audit integrity
// NO STATE MACHINES - No status transitions, no lifecycles, no workflows
// NO ENGINE IMPORTS - No dependencies on engine or execution modules
// ============================================================================

export {
  // Flow Types - ID Factories
  createGreyFlowRecordId,
  createFlowHash,
  createEntityId,
  createSessionId,
  createHandId,
  createFlowOperatorId,

  // Flow Types - Enums (classification only, NOT status)
  FlowDirection,
  FlowSource,
  EntityType,
  FlowErrorCode,

  // Flow Types - Result Helpers
  flowSuccess,
  flowFailure,
  createFlowError,

  // Flow Types - Hash Utilities
  FLOW_GENESIS_HASH,
  computeFlowHash,
  computeFlowRecordHash,
  computeFlowId,

  // Flow Types - Validation
  isValidFlowInput,

  // Flow Registry
  GreyFlowRegistry,
  createGreyFlowRegistry,
  createTestFlowRegistry,

  // Flow Linking - ID Factory
  createFlowLinkId,

  // Flow Linking - Enums
  FlowLinkType,

  // Flow Linking - Validation
  isValidFlowLinkInput,

  // Flow Linking - Linker Class
  GreyFlowLinker as FlowLinker,
  createGreyFlowLinker as createFlowLinker,
  createTestFlowLinker,

  // Flow Aggregation - Core Functions
  computeVolumeAggregation,
  computeFrequencyAggregation,
  computeDistributionAggregation,
  computeRakeRatioAggregation,
  computeTimeSeriesAggregation,

  // Flow Aggregation - Entity-specific
  computeEntityVolume,
  computeEntityFrequency,
  computeEntityRakeRatios,

  // Flow Aggregation - Source-specific
  computeVolumeBySource,
  computeFrequencyBySource,

  // Flow Views - Period Views
  getFlowsByPeriod,
  getFlowsByPeriods,

  // Flow Views - Entity Views
  getEntitySummary as getFlowEntitySummary,
  getAllEntitySummaries as getAllFlowEntitySummaries,

  // Flow Views - Agent Views
  getAgentSummary as getFlowAgentSummary,
  getAllAgentSummaries as getAllFlowAgentSummaries,

  // Flow Views - Table Views
  getTableSummary as getFlowTableSummary,

  // Flow Views - Club Views
  getClubSummary as getFlowClubSummary,
  getAllClubSummaries as getAllFlowClubSummaries,

  // Flow Views - Trace Views
  getFlowTrace,
  getAllFlowTraces,

  // Flow Views - Overall
  getOverallSummary as getFlowOverallSummary,

  // Flow Views - Filtered
  getFlowsByDirection,
  getFlowsBySource,
  getFlowsByOperator,

  // Flow Boundary Guards - Forbidden Lists
  FLOW_FORBIDDEN_FINANCIAL_KEYWORDS,
  FLOW_FORBIDDEN_EXECUTION_KEYWORDS,
  FLOW_FORBIDDEN_PUSH_KEYWORDS,
  FLOW_FORBIDDEN_STATE_MACHINE_KEYWORDS,
  FLOW_FORBIDDEN_IMPORT_SOURCES,

  // Flow Boundary Guards - Check Functions
  checkForFinancialKeywords,
  checkForFlowExecutionKeywords,
  checkForFlowPushKeywords,
  checkForFlowStateMachineKeywords,
  checkForFlowForbiddenImport,
  checkAllFlowBoundaries,

  // Flow Boundary Guards - Assertion Functions
  assertNoFinancialKeywords,
  assertNoFlowExecutionKeywords,
  assertNoFlowPushKeywords,
  assertNoFlowStateMachineKeywords,
  assertNoFlowForbiddenImport,
  assertAllFlowBoundaries,
  assertIsRatioOnly,
  assertIsUnitCount,

  // Flow Boundary Guards - Documentation
  FLOW_MODULE_DESIGN_CONSTRAINTS,
} from './grey-flow';

export type {
  // Flow Types - Branded ID Types
  GreyFlowRecordId,
  FlowHash,
  EntityId,
  SessionId,
  HandId,
  FlowOperatorId,

  // Flow Types - Error Types
  FlowError,
  FlowResult,

  // Flow Types - Core Types
  GreyFlowInput,
  GreyFlowRecord,

  // Flow Registry Types
  FlowRegistryState,
  FlowQueryOptions,

  // Flow Linking - Branded ID Types
  FlowLinkId,

  // Flow Linking - Core Types
  FlowLinkInput,
  FlowLinkRecord,
  FlowLinkRegistryState,
  FlowLinksSummary,
  ReferenceLinksSummary,

  // Flow Aggregation Types
  VolumeAggregation,
  FrequencyAggregation,
  DistributionAggregation,
  RakeRatioAggregation,
  TimeSeriesPoint,
  TimeSeriesAggregation,

  // Flow View Types
  PeriodSummaryView,
  EntitySummaryView,
  AgentSummaryView,
  TableSummaryView,
  ClubSummaryView,
  FlowTraceView,
  OverallSummaryView,

  // Flow Boundary Guard Types
  FlowBoundaryViolation,
  FlowBoundaryCheckResult,
} from './grey-flow';

// ============================================================================
// OPS-7: GREY REVENUE ATTRIBUTION & EXPOSURE ANALYSIS
// ============================================================================
// CRITICAL: ANALYSIS-ONLY - Passive data layer for attribution tracking
// PASSIVE / PULL-BASED - External systems query this data, we never push
// REFERENCE-ONLY - Attribution records are references, not monetary values
// EXPOSURE-ONLY - All metrics are exposure/ratio/share/index, NOT revenue
// APPEND-ONLY, HASH-CHAINED - Immutable records for audit integrity
// NO STATE MACHINES - No status transitions, no lifecycles, no workflows
// NO ENGINE IMPORTS - No dependencies on engine or execution modules
// ============================================================================

export {
  // Attribution Types - ID Factories
  createAttributionId,
  createSourceId,
  createTargetId,
  createPeriodId,
  createAttributionHash,
  createAttributionOperatorId,

  // Attribution Types - Enums (classification only, NOT status)
  AttributionKind,
  ExposureMetricType,
  AttributionEntityType,
  AttributionErrorCode,

  // Attribution Types - Result Helpers
  attributionSuccess,
  attributionFailure,
  createAttributionError,

  // Attribution Types - Hash Utilities
  ATTRIBUTION_GENESIS_HASH,
  computeAttributionHash,
  computeAttributionRecordHash,
  computeAttributionId,

  // Attribution Types - Validation
  isValidExposureMetric,
  isValidAttributionInput,

  // Attribution Registry
  GreyAttributionRegistry,
  createGreyAttributionRegistry,
  createTestAttributionRegistry,

  // Exposure Calculator
  calculateExposureSummary,
  calculateAllExposureSummaries,
  calculateExposureDistribution,
  calculateExposureTrend,
  calculateExposureFromFlows,
  calculateWeightedExposure,
  compareExposure,

  // Attribution Linking - ID Factory
  createAttributionLinkId,

  // Attribution Linking - Enums
  AttributionLinkTargetType,

  // Attribution Linking - Validation
  isValidAttributionLinkInput,

  // Attribution Linking - Linker Class
  GreyAttributionLinker,
  createGreyAttributionLinker,
  createTestAttributionLinker,

  // Exposure Views - Agent Views
  getExposureByAgent,
  getAllAgentExposures,

  // Exposure Views - Club Views
  getExposureByClub,
  getAllClubExposures,

  // Exposure Views - Table Views
  getExposureByTable,

  // Exposure Views - Period Views
  getExposureByPeriod,

  // Exposure Views - Trace Views
  getExposureTrace,
  getAllExposureTraces,

  // Exposure Views - Overall
  getOverallExposureSummary,

  // Exposure Views - Trend
  getExposureTrendView,

  // Exposure Views - Filtered
  getHighExposureAttributions,
  getAttributionsByKind,

  // Attribution Boundary Guards - Forbidden Lists
  ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_EXECUTION_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_PUSH_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_STATE_MACHINE_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_IMPORT_SOURCES,

  // Attribution Boundary Guards - Check Functions
  checkForAttributionFinancialKeywords,
  checkForAttributionRevenueKeywords,
  checkForAttributionExecutionKeywords,
  checkForAttributionPushKeywords,
  checkForAttributionStateMachineKeywords,
  checkForAttributionForbiddenImport,
  checkAllAttributionBoundaries,

  // Attribution Boundary Guards - Assertion Functions
  assertNoAttributionFinancialKeywords,
  assertNoAttributionRevenueKeywords,
  assertNoAttributionExecutionKeywords,
  assertNoAttributionPushKeywords,
  assertNoAttributionStateMachineKeywords,
  assertNoAttributionForbiddenImport,
  assertAllAttributionBoundaries,
  assertIsExposureMetric,
  assertIsShareValue,

  // Attribution Boundary Guards - Documentation
  ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS,
} from './grey-attribution';

export type {
  // Attribution Types - Branded ID Types
  AttributionId,
  SourceId,
  TargetId,
  PeriodId,
  AttributionHash,
  AttributionOperatorId,

  // Attribution Types - Error Types
  AttributionError,
  AttributionResult,

  // Attribution Types - Core Types
  ExposureMetric,
  AttributionInput,
  AttributionRecord,

  // Attribution Registry Types
  AttributionRegistryState,
  AttributionQueryOptions,

  // Exposure Calculator Types
  ExposureSummary,
  ExposureDistribution,
  ExposureTrendPoint,
  ExposureTrend,
  FlowExposureInput,

  // Attribution Linking - Branded ID Types
  AttributionLinkId,

  // Attribution Linking - Core Types
  AttributionLinkInput,
  AttributionLinkRecord,
  AttributionLinkRegistryState,
  AttributionLinksSummary,

  // Exposure View Types
  ExposureByAgentView,
  ExposureByClubView,
  ExposureByTableView,
  ExposureByPeriodView,
  ExposureTraceView,
  OverallExposureSummaryView,

  // Attribution Boundary Guard Types
  AttributionBoundaryViolation,
  AttributionBoundaryCheckResult,
} from './grey-attribution';

// ============================================================================
// OPS-8: GREY INCENTIVE & BEHAVIOR CORRELATION ANALYSIS
// ============================================================================
// CRITICAL: ANALYSIS-ONLY - Passive data layer for behavior signal tracking
// PASSIVE / PULL-BASED - External systems query this data, we never push
// SIGNAL-ONLY - All records are passive observations, NOT triggers
// CORRELATION-ONLY - All metrics are correlations, NOT causation
// APPEND-ONLY, HASH-CHAINED - Immutable records for audit integrity
// NO STATE MACHINES - No status transitions, no lifecycles, no workflows
// NO ENGINE IMPORTS - No dependencies on engine or execution modules
// NO INCENTIVE ACTIONS - No rewards, bonuses, or incentive triggers
// ============================================================================

export {
  // Signal Types - ID Factories
  createSignalId,
  createActorId as createBehaviorActorId,
  createContextId,
  createPeriodId as createBehaviorPeriodId,
  createCorrelationId,
  createSignalHash,

  // Signal Types - Enums (classification only, NOT status)
  SignalKind,
  ActorType as BehaviorActorType,
  ContextType,
  CorrelationMetricType,

  // Signal Types - Result Helpers
  signalSuccess,
  signalError,

  // Signal Types - Hash Utilities
  SIGNAL_GENESIS_HASH,
  computeSignalHash,
  computeCorrelationHash,

  // Signal Types - Validation
  isValidIntensity,
  isValidDuration,
  isValidConfidence,
  isValidSampleSize,
  isValidCorrelationMetric,

  // Signal Registry
  GreyBehaviorSignalRegistry,

  // Correlation Analyzer - Summary Functions
  calculateSignalSummary,
  calculateAllSignalSummaries,
  calculateActorSignalProfile,
  calculateContextSignalDistribution,
  calculatePeriodCorrelationSummary,

  // Correlation Analyzer - Co-occurrence Functions
  calculateSignalCoOccurrence,
  calculateAllCoOccurrences,

  // Correlation Analyzer - Trend Functions
  calculateTrendAnalysis,

  // Correlation Analyzer - Metric Functions
  calculateCorrelationMetrics,
  calculateIntensityElasticity,

  // Correlation Views - Signal Views
  buildCorrelationBySignalView,
  buildAllCorrelationBySignalViews,

  // Correlation Views - Actor Views
  buildCorrelationByActorView,

  // Correlation Views - Context Views
  buildCorrelationByContextView,

  // Correlation Views - Period Views
  buildCorrelationByPeriodView,

  // Correlation Views - Trace Views
  buildCorrelationTraceView,

  // Correlation Views - Summary Views
  buildCorrelationSummaryView,

  // Correlation Views - Top Views
  buildTopActorsView,
  buildTopContextsView,

  // Behavior Boundary Guards - Forbidden Lists
  FORBIDDEN_FINANCIAL_KEYWORDS as BEHAVIOR_FORBIDDEN_FINANCIAL_KEYWORDS,
  FORBIDDEN_REVENUE_KEYWORDS as BEHAVIOR_FORBIDDEN_REVENUE_KEYWORDS,
  FORBIDDEN_ACTION_KEYWORDS as BEHAVIOR_FORBIDDEN_ACTION_KEYWORDS,
  FORBIDDEN_STATE_KEYWORDS as BEHAVIOR_FORBIDDEN_STATE_KEYWORDS,
  FORBIDDEN_ENGINE_KEYWORDS as BEHAVIOR_FORBIDDEN_ENGINE_KEYWORDS,
  FORBIDDEN_INCENTIVE_ACTION_KEYWORDS as BEHAVIOR_FORBIDDEN_INCENTIVE_KEYWORDS,
  ALL_FORBIDDEN_KEYWORDS as BEHAVIOR_ALL_FORBIDDEN_KEYWORDS,

  // Behavior Boundary Guards - Allowed Lists
  ALLOWED_SIGNAL_KEYWORDS,
  ALLOWED_CORRELATION_KEYWORDS,
  ALLOWED_ANALYSIS_KEYWORDS,
  ALLOWED_BEHAVIOR_KEYWORDS,

  // Behavior Boundary Guards - Check Functions
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

  // Behavior Boundary Guards - Documentation
  MODULE_BOUNDARIES as BEHAVIOR_MODULE_BOUNDARIES,
  getModuleBoundariesText,
} from './grey-behavior';

export type {
  // Signal Types - Branded ID Types
  SignalId,
  ActorId as BehaviorActorId,
  ContextId,
  PeriodId as BehaviorPeriodId,
  CorrelationId,
  SignalHash,

  // Signal Types - Core Types
  CorrelationMetric,
  SignalRecord,
  SignalInput,
  CorrelationRecord,
  CorrelationInput,
  SignalResult,

  // Correlation Analyzer Types
  SignalSummary,
  ActorSignalProfile,
  ContextSignalDistribution,
  PeriodCorrelationSummary,
  SignalCoOccurrence,
  TrendAnalysis,

  // Correlation View Types
  CorrelationBySignalView,
  CorrelationByActorView,
  CorrelationByContextView,
  CorrelationByPeriodView,
  CorrelationTraceView,
} from './grey-behavior';

// ============================================================================
// OPS-FREEZE: READ-ONLY QUERY & SNAPSHOT LAYER
// ============================================================================
// CRITICAL: FINAL FREEZE - Read-only query interface for all OPS modules
// READ-ONLY: Cannot write, trigger, execute, or acknowledge
// NO ANALYTICS: Does not compute new metrics or correlations
// NO TRANSFORMS: Passes through data without semantic changes
// PULL-BASED: All queries are synchronous pulls
// FROZEN: All outputs are immutable
// DETERMINISTIC: Same input always produces same output
// ============================================================================

export {
  // Query Types
  QueryErrorCode,
  querySuccess,
  queryError,
  isValidTimeScope,
  isValidPeriodScope,
  isValidEntityScope,
  isValidQueryScope,
  isValidOpsModule,
  createSnapshotId,

  // Query Registry
  OpsQueryRegistry,
  createOpsQueryRegistry,
  createTestOpsQueryRegistry,

  // View Catalog
  getViewCatalog,
  getViewsForModule,
  viewExists,

  // Query Guards - Forbidden Lists
  FORBIDDEN_MUTATION_KEYWORDS,
  FORBIDDEN_EXECUTION_KEYWORDS as QUERY_FORBIDDEN_EXECUTION_KEYWORDS,
  FORBIDDEN_ENGINE_KEYWORDS as QUERY_FORBIDDEN_ENGINE_KEYWORDS,
  FORBIDDEN_FINANCIAL_KEYWORDS as QUERY_FORBIDDEN_FINANCIAL_KEYWORDS,
  FORBIDDEN_STATE_KEYWORDS as QUERY_FORBIDDEN_STATE_KEYWORDS,
  FORBIDDEN_ASYNC_KEYWORDS,
  ALL_FORBIDDEN_KEYWORDS as QUERY_ALL_FORBIDDEN_KEYWORDS,

  // Query Guards - Check Functions
  containsMutationKeywords,
  containsExecutionKeywords as containsQueryExecutionKeywords,
  containsEngineKeywords as containsQueryEngineKeywords,
  containsFinancialKeywords as containsQueryFinancialKeywords,
  containsStateKeywords as containsQueryStateKeywords,
  containsAsyncKeywords,
  containsAnyForbiddenKeywords as containsQueryForbiddenKeywords,
  findForbiddenKeywords as findQueryForbiddenKeywords,

  // Query Guards - Validation Functions
  validateNoMutation,
  validateNoExecution,
  validateNoEngine,
  validateNoFinancial,
  validateNoAsync,
  validateQueryLayerCompliance,
  validationSuccess,
  validationFailure,

  // Query Guards - Assertion Functions
  assertNoMutation,
  assertNoExecution,
  assertNoEngine,
  assertQueryLayerCompliance,

  // Query Constraints Documentation
  QUERY_LAYER_CONSTRAINTS,
  getQueryLayerConstraintsText,
} from './ops-query';

export type {
  // Query Types
  TimeScope,
  PeriodScope,
  EntityScope,
  QueryScope,
  OpsModule,
  QuerySelector,
  QueryResult,
  QueryError as QueryErrorType,
  QueryResponse,
  QueryMetadata,
  SnapshotId,
  SnapshotMetadata,
  SnapshotState,

  // View Catalog Types
  ViewCatalogEntry,

  // Validation Types
  ValidationResult,
} from './ops-query';
