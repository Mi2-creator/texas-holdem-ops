/**
 * FutureUsdtAdapter.ts
 *
 * PLACEHOLDER for future USDT adapter
 *
 * This file is a PLACEHOLDER ONLY.
 * No USDT logic is implemented in OPS-0.
 *
 * IMPORTANT: This adapter will be implemented in a future phase.
 * It will follow the same reference-only, deterministic design.
 */

import { AdapterType } from '../../ops-config';
import type { RechargeAdapter } from '../manual-admin';

// ============================================================================
// PLACEHOLDER DECLARATION
// ============================================================================

/**
 * Future USDT Adapter Placeholder
 *
 * This is a PLACEHOLDER ONLY. No actual implementation.
 */
export const FUTURE_USDT_PLACEHOLDER = Object.freeze({
  adapterType: AdapterType.FUTURE_USDT,
  name: 'future-usdt',
  status: 'NOT_IMPLEMENTED',
  plannedFeatures: Object.freeze([
    'USDT reference tracking (reference only, not actual USDT)',
    'External blockchain event ingestion',
    'Reference mapping to Grey system',
    'Deterministic reference generation',
  ]),
  constraints: Object.freeze([
    'Reference-only (no actual USDT handling)',
    'Integer amounts only',
    'Manual confirmation required',
    'No direct blockchain writes',
    'Read-only external data access',
  ]),
}) as {
  readonly adapterType: AdapterType;
  readonly name: string;
  readonly status: 'NOT_IMPLEMENTED';
  readonly plannedFeatures: readonly string[];
  readonly constraints: readonly string[];
};

/**
 * Future USDT Adapter Stub
 *
 * PLACEHOLDER: Always returns not implemented error.
 */
export class FutureUsdtAdapterStub implements RechargeAdapter {
  readonly adapterType = AdapterType.FUTURE_USDT;
  readonly name = 'future-usdt';

  isEnabled(): boolean {
    return false; // Not implemented
  }

  getStatus(): string {
    return 'NOT_IMPLEMENTED';
  }

  getInfo(): Readonly<{ adapterType: AdapterType; name: string; enabled: boolean; status: string }> {
    return Object.freeze({
      adapterType: this.adapterType,
      name: this.name,
      enabled: this.isEnabled(),
      status: this.getStatus(),
    });
  }
}

/**
 * Create a future USDT adapter stub.
 */
export function createFutureUsdtAdapter(): FutureUsdtAdapterStub {
  return new FutureUsdtAdapterStub();
}
