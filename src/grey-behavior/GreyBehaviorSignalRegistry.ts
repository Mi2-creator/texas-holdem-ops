/**
 * GreyBehaviorSignalRegistry.ts
 *
 * Append-only, hash-chained registry for behavior signals.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - APPEND-ONLY: Records can only be added, never modified or deleted
 * - HASH-CHAINED: Each record links to previous via hash
 * - DETERMINISTIC: Same inputs produce same outputs
 * - PASSIVE: Registry only stores observations, never triggers actions
 *
 * SEMANTIC BOUNDARIES:
 * - Registry stores signals, which are passive observations
 * - No signal can trigger, execute, or dispatch anything
 * - Signals represent WHAT was observed, NOT what should happen
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot trigger actions based on signals
 * - Cannot modify existing records
 * - Cannot delete records
 * - Cannot execute or dispatch anything
 */

import {
  type SignalId,
  type SignalHash,
  type SignalRecord,
  type SignalInput,
  type SignalResult,
  type CorrelationId,
  type CorrelationRecord,
  type CorrelationInput,
  type PeriodId,
  type ActorId,
  type ContextId,
  SignalKind,
  ActorType,
  ContextType,
  SIGNAL_GENESIS_HASH,
  createSignalId,
  createCorrelationId,
  computeSignalHash,
  computeCorrelationHash,
  signalSuccess,
  signalError,
  isValidIntensity,
  isValidDuration,
  isValidCorrelationMetric,
} from './GreyBehaviorSignalTypes';

// ============================================================================
// SIGNAL REGISTRY
// ============================================================================

/**
 * GreyBehaviorSignalRegistry - append-only registry for behavior signals.
 *
 * IMPORTANT: This registry is PASSIVE. It only stores observations.
 * Signals in this registry do NOT trigger any actions.
 */
export class GreyBehaviorSignalRegistry {
  private readonly signals: SignalRecord[] = [];
  private readonly signalsById: Map<SignalId, SignalRecord> = new Map();
  private latestSignalHash: SignalHash = SIGNAL_GENESIS_HASH;
  private signalSequence = 0;

  private readonly correlations: CorrelationRecord[] = [];
  private readonly correlationsById: Map<CorrelationId, CorrelationRecord> = new Map();
  private latestCorrelationHash: SignalHash = SIGNAL_GENESIS_HASH;
  private correlationSequence = 0;

  /**
   * Record a new behavior signal.
   *
   * APPEND-ONLY: Creates a new immutable record in the chain.
   */
  recordSignal(input: SignalInput): SignalResult<SignalRecord> {
    // Validate input
    if (!Object.values(SignalKind).includes(input.kind)) {
      return signalError(`Invalid signal kind: ${input.kind}`);
    }

    if (!Object.values(ActorType).includes(input.actorType)) {
      return signalError(`Invalid actor type: ${input.actorType}`);
    }

    if (!Object.values(ContextType).includes(input.contextType)) {
      return signalError(`Invalid context type: ${input.contextType}`);
    }

    if (!isValidIntensity(input.intensity)) {
      return signalError(`Invalid intensity: ${input.intensity}. Must be 0.0 to 1.0`);
    }

    if (!isValidDuration(input.durationMs)) {
      return signalError(`Invalid duration: ${input.durationMs}. Must be >= 0`);
    }

    const timestamp = Date.now();
    const sequenceNumber = ++this.signalSequence;

    const recordHash = computeSignalHash(
      input,
      this.latestSignalHash,
      sequenceNumber,
      timestamp
    );

    const signalId = createSignalId(`sig_${sequenceNumber}_${timestamp}`);

    const record: SignalRecord = Object.freeze({
      signalId,
      kind: input.kind,
      actorId: input.actorId,
      actorType: input.actorType,
      contextId: input.contextId,
      contextType: input.contextType,
      periodId: input.periodId,
      timestamp,
      intensity: input.intensity,
      durationMs: input.durationMs,
      previousHash: this.latestSignalHash,
      recordHash,
      sequenceNumber,
    });

    this.signals.push(record);
    this.signalsById.set(signalId, record);
    this.latestSignalHash = recordHash;

    return signalSuccess(record);
  }

  /**
   * Record a new correlation analysis result.
   *
   * APPEND-ONLY: Creates a new immutable record in the chain.
   */
  recordCorrelation(input: CorrelationInput): SignalResult<CorrelationRecord> {
    // Validate input
    if (!Object.values(SignalKind).includes(input.signalKind)) {
      return signalError(`Invalid signal kind: ${input.signalKind}`);
    }

    if (input.observationCount <= 0) {
      return signalError(`Invalid observation count: ${input.observationCount}`);
    }

    for (const metric of input.metrics) {
      if (!isValidCorrelationMetric(metric)) {
        return signalError(`Invalid correlation metric: ${JSON.stringify(metric)}`);
      }
    }

    const timestamp = Date.now();
    const sequenceNumber = ++this.correlationSequence;

    const recordHash = computeCorrelationHash(
      input,
      this.latestCorrelationHash,
      sequenceNumber,
      timestamp
    );

    const correlationId = createCorrelationId(`cor_${sequenceNumber}_${timestamp}`);

    const record: CorrelationRecord = Object.freeze({
      correlationId,
      signalKind: input.signalKind,
      actorId: input.actorId,
      contextId: input.contextId,
      periodId: input.periodId,
      metrics: Object.freeze([...input.metrics]),
      calculatedAt: timestamp,
      observationCount: input.observationCount,
      previousHash: this.latestCorrelationHash,
      recordHash,
      sequenceNumber,
    });

    this.correlations.push(record);
    this.correlationsById.set(correlationId, record);
    this.latestCorrelationHash = recordHash;

    return signalSuccess(record);
  }

  // ==========================================================================
  // READ-ONLY ACCESSORS
  // ==========================================================================

  /**
   * Get signal by ID.
   */
  getSignalById(signalId: SignalId): SignalRecord | undefined {
    return this.signalsById.get(signalId);
  }

  /**
   * Get correlation by ID.
   */
  getCorrelationById(correlationId: CorrelationId): CorrelationRecord | undefined {
    return this.correlationsById.get(correlationId);
  }

  /**
   * Get all signals (frozen copy).
   */
  getAllSignals(): readonly SignalRecord[] {
    return Object.freeze([...this.signals]);
  }

  /**
   * Get all correlations (frozen copy).
   */
  getAllCorrelations(): readonly CorrelationRecord[] {
    return Object.freeze([...this.correlations]);
  }

  /**
   * Get signals by actor.
   */
  getSignalsByActor(actorId: ActorId): readonly SignalRecord[] {
    return Object.freeze(
      this.signals.filter(s => s.actorId === actorId)
    );
  }

  /**
   * Get signals by context.
   */
  getSignalsByContext(contextId: ContextId): readonly SignalRecord[] {
    return Object.freeze(
      this.signals.filter(s => s.contextId === contextId)
    );
  }

  /**
   * Get signals by period.
   */
  getSignalsByPeriod(periodId: PeriodId): readonly SignalRecord[] {
    return Object.freeze(
      this.signals.filter(s => s.periodId === periodId)
    );
  }

  /**
   * Get signals by kind.
   */
  getSignalsByKind(kind: SignalKind): readonly SignalRecord[] {
    return Object.freeze(
      this.signals.filter(s => s.kind === kind)
    );
  }

  /**
   * Get correlations by signal kind.
   */
  getCorrelationsBySignalKind(kind: SignalKind): readonly CorrelationRecord[] {
    return Object.freeze(
      this.correlations.filter(c => c.signalKind === kind)
    );
  }

  /**
   * Get correlations by actor.
   */
  getCorrelationsByActor(actorId: ActorId): readonly CorrelationRecord[] {
    return Object.freeze(
      this.correlations.filter(c => c.actorId === actorId)
    );
  }

  /**
   * Get correlations by period.
   */
  getCorrelationsByPeriod(periodId: PeriodId): readonly CorrelationRecord[] {
    return Object.freeze(
      this.correlations.filter(c => c.periodId === periodId)
    );
  }

  /**
   * Get signals in time range.
   */
  getSignalsInTimeRange(startMs: number, endMs: number): readonly SignalRecord[] {
    return Object.freeze(
      this.signals.filter(s => s.timestamp >= startMs && s.timestamp <= endMs)
    );
  }

  /**
   * Get total signal count.
   */
  getSignalCount(): number {
    return this.signals.length;
  }

  /**
   * Get total correlation count.
   */
  getCorrelationCount(): number {
    return this.correlations.length;
  }

  /**
   * Get latest signal hash.
   */
  getLatestSignalHash(): SignalHash {
    return this.latestSignalHash;
  }

  /**
   * Get latest correlation hash.
   */
  getLatestCorrelationHash(): SignalHash {
    return this.latestCorrelationHash;
  }

  /**
   * Verify signal chain integrity.
   */
  verifySignalChainIntegrity(): SignalResult<boolean> {
    if (this.signals.length === 0) {
      return signalSuccess(true);
    }

    // Verify first record links to genesis
    if (this.signals[0].previousHash !== SIGNAL_GENESIS_HASH) {
      return signalError('First signal does not link to genesis hash');
    }

    // Verify chain continuity
    for (let i = 1; i < this.signals.length; i++) {
      if (this.signals[i].previousHash !== this.signals[i - 1].recordHash) {
        return signalError(`Signal chain broken at index ${i}`);
      }
    }

    // Verify sequence numbers
    for (let i = 0; i < this.signals.length; i++) {
      if (this.signals[i].sequenceNumber !== i + 1) {
        return signalError(`Invalid sequence number at index ${i}`);
      }
    }

    return signalSuccess(true);
  }

  /**
   * Verify correlation chain integrity.
   */
  verifyCorrelationChainIntegrity(): SignalResult<boolean> {
    if (this.correlations.length === 0) {
      return signalSuccess(true);
    }

    // Verify first record links to genesis
    if (this.correlations[0].previousHash !== SIGNAL_GENESIS_HASH) {
      return signalError('First correlation does not link to genesis hash');
    }

    // Verify chain continuity
    for (let i = 1; i < this.correlations.length; i++) {
      if (this.correlations[i].previousHash !== this.correlations[i - 1].recordHash) {
        return signalError(`Correlation chain broken at index ${i}`);
      }
    }

    // Verify sequence numbers
    for (let i = 0; i < this.correlations.length; i++) {
      if (this.correlations[i].sequenceNumber !== i + 1) {
        return signalError(`Invalid correlation sequence number at index ${i}`);
      }
    }

    return signalSuccess(true);
  }
}
