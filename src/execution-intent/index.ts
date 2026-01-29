/**
 * execution-intent/index.ts
 *
 * OPS-5: External Manual Execution Intent Interface
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PASSIVE DATA LAYER: Stores data, does NOT execute anything
 * - PULL-BASED: External systems query this data, we never push
 * - RECOMMENDATION ONLY: Intents are recommendations, not orders
 * - HUMAN-ASSERTED: Reports are human-stated outcomes, not verified truth
 * - APPEND-ONLY: Records are never modified or deleted
 * - HASH-CHAINED: Each record links to the previous for audit integrity
 * - NO STATE MACHINES: No status transitions, no lifecycles, no workflows
 * - NO ENGINE IMPORTS: No dependencies on engine or execution modules
 */

// ============================================================================
// INTENT TYPES
// ============================================================================
export {
  // Branded ID types
  type IntentId,
  type EvidenceId,
  type IntentHash,
  type OperatorId,
  // ID factories
  createIntentId,
  createEvidenceId,
  createIntentHash,
  createOperatorId,
  // Enums (classification only, NOT status)
  IntentType,
  EvidenceType,
  IntentErrorCode,
  // Error types
  type IntentError,
  type IntentResult,
  // Result helpers
  intentSuccess,
  intentFailure,
  createIntentError,
  // Core types
  type EvidenceReference,
  type ExecutionIntentInput,
  type ExecutionIntentRecord,
  // Hash utilities
  INTENT_GENESIS_HASH,
  computeIntentHash,
  computeIntentRecordHash,
  computeIntentId,
  // Validation
  isValidEvidenceReference,
  isValidIntentInput,
} from './ExecutionIntentTypes';

// ============================================================================
// INTENT REGISTRY
// ============================================================================
export {
  // Registry class
  ExecutionIntentRegistry,
  // Registry types
  type IntentRegistryState,
  type IntentQueryOptions,
  // Factory functions
  createExecutionIntentRegistry,
  createTestIntentRegistry,
} from './ExecutionIntentRegistry';

// ============================================================================
// EVIDENCE BINDER
// ============================================================================
export {
  // Types
  type EvidenceBindingSummary,
  type CrossReferenceSummary,
  // Reference factories
  createRiskSignalRef,
  createRiskAckRef,
  createApprovalRef,
  createRechargeRef,
  createGreyFlowRef,
  // Query functions
  getEvidenceBindingSummary,
  getCrossReferenceSummary,
  getAllCrossReferences,
  filterIntentsByEvidenceType,
  getUniqueEvidenceIds,
  countEvidenceByType,
} from './ExecutionEvidenceBinder';

// ============================================================================
// REPORT TYPES
// ============================================================================
export {
  // Branded ID types
  type ReportId,
  type ReportHash,
  // ID factories
  createReportId,
  createReportHash,
  // Enums
  ReportedOutcome,
  ReportErrorCode,
  // Error types
  type ReportError,
  type ReportResult,
  // Result helpers
  reportSuccess,
  reportFailure,
  createReportError,
  // Core types
  type ExecutionReportInput,
  type ExecutionReportRecord,
  // Hash utilities
  REPORT_GENESIS_HASH,
  computeReportHash,
  computeReportRecordHash,
  computeReportId,
  // Validation
  isValidReportInput,
} from './ExecutionReportTypes';

// ============================================================================
// REPORT REGISTRY
// ============================================================================
export {
  // Registry class
  ExecutionReportRegistry,
  // Registry types
  type ReportRegistryState,
  type ReportQueryOptions,
  // Factory functions
  createExecutionReportRegistry,
  createTestReportRegistry,
} from './ExecutionReportRegistry';

// ============================================================================
// VIEWS (READ-ONLY)
// ============================================================================
export {
  // View types
  type IntentWithReportsView,
  type IntentSummaryView,
  type OperatorActivityView,
  type RegistryStatisticsView,
  // View functions
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
} from './ExecutionIntentViews';

// ============================================================================
// BOUNDARY GUARDS
// ============================================================================
export {
  // Forbidden keyword lists
  FORBIDDEN_EXECUTION_KEYWORDS,
  FORBIDDEN_PUSH_KEYWORDS,
  FORBIDDEN_BLOCKING_KEYWORDS,
  FORBIDDEN_STATE_MACHINE_KEYWORDS,
  FORBIDDEN_IMPORT_SOURCES,
  // Types
  type BoundaryViolation,
  type BoundaryCheckResult,
  // Check functions
  checkForExecutionKeywords,
  checkForPushKeywords,
  checkForBlockingKeywords,
  checkForStateMachineKeywords,
  checkForForbiddenImport,
  checkAllBoundaries,
  // Assertion functions
  assertNoExecutionKeywords,
  assertNoPushKeywords,
  assertNoBlockingKeywords,
  assertNoStateMachineKeywords,
  assertNoForbiddenImport,
  assertAllBoundaries,
  // Documentation
  MODULE_DESIGN_CONSTRAINTS,
} from './ExecutionIntentBoundaryGuards';
