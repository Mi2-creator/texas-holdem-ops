/**
 * Ops Config Module
 *
 * Core types, interfaces, and boundary guards for texas-holdem-ops.
 */

// Types
export {
  OPS_VERSION,
  OPS_PHASE,
  OPS_MODULE_INFO,
  ReferenceStatus,
  AdapterType,
  OpsErrorCode,
  createExternalReferenceId,
  createOpsSessionId,
  createRechargeReferenceId,
  createConfirmationId,
  opsSuccess,
  opsFailure,
  createOpsError,
  isValidInteger,
  isValidPositiveInteger,
  isValidNonNegativeInteger,
  isValidTimestamp,
  isValidString,
} from './OpsTypes';

export type {
  ExternalReferenceId,
  OpsSessionId,
  RechargeReferenceId,
  ConfirmationId,
  RechargeReferenceInput,
  RechargeReferenceRecord,
  ConfirmationDetails,
  PushDetails,
  OpsError,
  OpsResult,
} from './OpsTypes';

// Boundary Guards
export {
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
} from './OpsBoundaryGuards';

export type {
  ForbiddenConcept,
  BoundaryViolation,
  BoundaryCheckResult,
} from './OpsBoundaryGuards';
