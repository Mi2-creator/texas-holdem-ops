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
