/**
 * texas-holdem-ops
 *
 * External Operations Boundary for texas-holdem-engine
 *
 * OPS-0: External ops boundary & recharge reference scaffold (no value)
 * OPS-1: Manual recharge reference intake & grey flow linking (no money)
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
// APPROVALS
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
