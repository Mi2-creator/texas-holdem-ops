/**
 * GreyPushClient.ts
 *
 * Grey Push Client for texas-holdem-ops
 *
 * NO-OP PLACEHOLDER in OPS-0.
 *
 * This client will eventually push confirmed references to Grey system.
 * In OPS-0, it only provides the interface - no actual push operations.
 *
 * IMPORTANT:
 * - Ops MAY emit GreyRechargeReference
 * - Ops MAY NOT affect GreyFlow directly
 * - All pushes require human confirmation first
 */

import {
  type OpsSessionId,
  type OpsResult,
  type PushDetails,
  createOpsSessionId,
  opsSuccess,
  opsFailure,
  createOpsError,
  OpsErrorCode,
} from '../ops-config';
import type { GreyRechargeReference, MappingResult } from '../mapping';

// ============================================================================
// PUSH CLIENT TYPES
// ============================================================================

/**
 * Push Request
 */
export interface PushRequest {
  /** Mapping result to push */
  readonly mappingResult: MappingResult;
  /** Session ID (optional, will be generated if not provided) */
  readonly sessionId?: OpsSessionId;
  /** Timestamp for push (must be provided) */
  readonly timestamp: number;
}

/**
 * Push Response
 */
export interface PushResponse {
  /** Push details */
  readonly pushDetails: PushDetails;
  /** Pushed reference */
  readonly reference: GreyRechargeReference;
}

/**
 * Push Client Configuration
 */
export interface PushClientConfig {
  /** Client name */
  readonly name: string;
  /** Enabled flag */
  readonly enabled: boolean;
  /** Target Grey system identifier */
  readonly targetSystem: string;
}

/**
 * Default push client configuration
 */
export const DEFAULT_PUSH_CLIENT_CONFIG: PushClientConfig = Object.freeze({
  name: 'grey-push-client',
  enabled: false, // Disabled in OPS-0
  targetSystem: 'grey-recharge',
});

// ============================================================================
// GREY PUSH CLIENT (NO-OP PLACEHOLDER)
// ============================================================================

/**
 * Grey Push Client
 *
 * NO-OP PLACEHOLDER: In OPS-0, this does NOT perform actual pushes.
 * It only validates inputs and simulates the push workflow.
 */
export class GreyPushClientStub {
  private readonly config: PushClientConfig;
  private sessionCounter: number = 0;

  constructor(config: PushClientConfig = DEFAULT_PUSH_CLIENT_CONFIG) {
    this.config = config;
  }

  /**
   * Check if client is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Push a reference to Grey system.
   *
   * NO-OP in OPS-0: Returns simulated push details.
   */
  push(request: PushRequest): OpsResult<PushResponse> {
    // Check if enabled
    if (!this.isEnabled()) {
      return opsFailure(
        createOpsError(
          OpsErrorCode.PUSH_FAILED,
          'Grey Push Client is disabled in OPS-0. This is a placeholder.'
        )
      );
    }

    // Validate request
    const validation = this.validatePushRequest(request);
    if (!validation.success) {
      return validation as OpsResult<PushResponse>;
    }

    // Generate session ID if not provided
    this.sessionCounter++;
    const sessionId = request.sessionId ?? createOpsSessionId(
      `session-${request.timestamp}-${this.sessionCounter}`
    );

    // Create push details (NO-OP - simulated)
    const pushDetails: PushDetails = Object.freeze({
      sessionId,
      pushedAt: request.timestamp,
      // greyRechargeId would be returned from actual Grey system
    });

    const response: PushResponse = Object.freeze({
      pushDetails,
      reference: request.mappingResult.reference,
    });

    return opsSuccess(response);
  }

  /**
   * Simulate a push (for testing).
   *
   * This ALWAYS succeeds, regardless of enabled state.
   * Used for testing the push workflow.
   */
  simulatePush(request: PushRequest): OpsResult<PushResponse> {
    // Validate request
    const validation = this.validatePushRequest(request);
    if (!validation.success) {
      return validation as OpsResult<PushResponse>;
    }

    // Generate session ID if not provided
    this.sessionCounter++;
    const sessionId = request.sessionId ?? createOpsSessionId(
      `sim-session-${request.timestamp}-${this.sessionCounter}`
    );

    // Create simulated push details
    const pushDetails: PushDetails = Object.freeze({
      sessionId,
      pushedAt: request.timestamp,
      greyRechargeId: `sim-grey-${request.timestamp}-${this.sessionCounter}`,
    });

    const response: PushResponse = Object.freeze({
      pushDetails,
      reference: request.mappingResult.reference,
    });

    return opsSuccess(response);
  }

  /**
   * Get client info.
   */
  getInfo(): Readonly<PushClientConfig & { status: string }> {
    return Object.freeze({
      ...this.config,
      status: this.isEnabled() ? 'ENABLED' : 'DISABLED (OPS-0 PLACEHOLDER)',
    });
  }

  /**
   * Validate push request.
   */
  private validatePushRequest(request: PushRequest): OpsResult<void> {
    if (!request.mappingResult) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'mappingResult is required')
      );
    }

    if (!request.mappingResult.reference) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'reference is required in mappingResult')
      );
    }

    if (!Number.isInteger(request.timestamp) || request.timestamp <= 0) {
      return opsFailure(
        createOpsError(OpsErrorCode.INVALID_INPUT, 'timestamp must be a positive integer')
      );
    }

    return opsSuccess(undefined);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a Grey push client stub.
 */
export function createGreyPushClient(
  config?: Partial<PushClientConfig>
): GreyPushClientStub {
  const fullConfig: PushClientConfig = {
    ...DEFAULT_PUSH_CLIENT_CONFIG,
    ...config,
  };
  return new GreyPushClientStub(fullConfig);
}
