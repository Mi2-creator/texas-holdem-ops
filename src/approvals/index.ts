/**
 * Approvals Module
 *
 * OPS-0: Human Confirm Queue
 * OPS-2: Manual Approval & Two-Man Rule
 */

// ============================================================================
// OPS-0: HUMAN CONFIRM QUEUE
// ============================================================================

export {
  HumanConfirmQueue,
  createHumanConfirmQueue,
} from './HumanConfirmQueue';

export type {
  ConfirmationRequest,
  RejectionRequest,
  QueueItem,
} from './HumanConfirmQueue';

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
} from './ApprovalTypes';

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
} from './ApprovalTypes';

// ============================================================================
// OPS-2: APPROVAL RECORD
// ============================================================================

export {
  createApprovalRequestRecord,
  createApprovalDecisionRecord,
  verifyRecordIntegrity,
  verifyChainLink,
  isRecordFrozen,
} from './ApprovalRecord';

// ============================================================================
// OPS-2: APPROVAL REGISTRY
// ============================================================================

export {
  ApprovalRegistry,
  createApprovalRegistry,
  createTestApprovalRegistry,
} from './ApprovalRegistry';

export type {
  ApprovalRegistryState,
  ApprovalQueryOptions,
} from './ApprovalRegistry';

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
} from './ApprovalViews';

export type {
  PendingApprovalsByPeriod,
  ApprovalHistoryByRecharge,
  ApprovalSummaryByActor,
  OverallApprovalSummary,
} from './ApprovalViews';

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
  assertNoForbiddenConcepts,
  assertRecordFrozen,
  assertValidStatusTransition,
  assertNotTerminal,
  guardApprovalRequest,
  guardApprovalDecision,
} from './ApprovalBoundaryGuards';

export type {
  ApprovalForbiddenConcept,
} from './ApprovalBoundaryGuards';
