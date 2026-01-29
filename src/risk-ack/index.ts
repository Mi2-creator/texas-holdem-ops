/**
 * OPS-4: Human Risk Acknowledgement & Sign-Off Layer
 *
 * Public exports for risk acknowledgement module.
 *
 * CRITICAL GUARANTEES:
 * - MANUAL-ONLY: Records human acknowledgements, not automated actions
 * - REFERENCE-ONLY: All values are references, not money
 * - NO EXECUTION: Cannot block, execute, or trigger any action
 * - READ-ONLY: Produces frozen outputs, no mutations
 * - DETERMINISTIC: Same inputs produce same outputs
 * - INTEGER-ONLY: No floating point arithmetic
 * - NO ENGINE IMPORTS: Completely isolated from engine internals
 *
 * WHAT THIS MODULE CANNOT DO:
 * - CANNOT block or allow anything
 * - CANNOT execute or trigger actions
 * - CANNOT mutate engine or ops data
 * - CANNOT auto-adjust thresholds
 * - CANNOT process money or balances
 * - CANNOT access engine internals
 * - CANNOT make automated acknowledgements
 */

// ============================================================================
// TYPES
// ============================================================================

export {
  // Branded ID types
  type RiskAckId,
  type RiskSignalId,
  type ActorId,
  type AckHash,

  // ID factories
  createRiskAckId,
  createRiskSignalId,
  createActorId,
  createAckHash,

  // Enums
  AckDecision,
  AckRole,
  AckErrorCode,

  // Error types
  type AckError,
  type AckResult,

  // Result helpers
  ackSuccess,
  ackFailure,
  createAckError,

  // Core types
  type RiskAckInput,
  type RiskAckRecord,

  // Hash utilities
  ACK_GENESIS_HASH,
  computeAckHash,
  computeAckRecordHash,
  computeAckId,

  // Validation
  isValidAckInput,
  isTerminalDecision,
  getRoleLevel,
  canRoleEscalate,
} from './RiskAckTypes';

// ============================================================================
// RECORD
// ============================================================================

export {
  createAckRecord,
  verifyAckRecordIntegrity,
  verifyAckChainLink,
  isAckRecordFrozen,
  getSignalId,
  getActorId,
  isAcknowledgement,
  isEscalation,
  isRejection,
} from './RiskAckRecord';

// ============================================================================
// REGISTRY
// ============================================================================

export {
  type AckRegistryState,
  type AckQueryOptions,
  RiskAckRegistry,
  createRiskAckRegistry,
  createTestRiskAckRegistry,
} from './RiskAckRegistry';

// ============================================================================
// VIEWS (READ-ONLY)
// ============================================================================

export {
  // View types
  type PendingByPeriod,
  type HistoryBySignal,
  type HistoryByActor,
  type SummaryByDecision,
  type OverallAckSummary,

  // View functions (read-only)
  getPendingByPeriod,
  getHistoryBySignal,
  getHistoryByActor,
  getSummaryByDecision,
  getOverallAckSummary,
  getAllSignalHistories,
  getAllActorHistories,
  getEscalatedSignals,
  getUnacknowledgedSignals,
} from './RiskAckViews';

// ============================================================================
// BOUNDARY GUARDS
// ============================================================================

export {
  // Forbidden concepts
  ACK_FORBIDDEN_CONCEPTS,
  type AckForbiddenConcept,
  ACK_FORBIDDEN_FUNCTION_PATTERNS,

  // Guards
  assertNoAckForbiddenConcepts,
  assertNoAckForbiddenFunctions,
  assertManualOnly,
  assertHumanAcknowledgement,
  assertValidAckInput,
  assertAckRecordFrozen,
  assertCanEscalate,
  guardAckInput,

  // Boundary declaration
  ACK_BOUNDARY_DECLARATION,
} from './RiskAckBoundaryGuards';
