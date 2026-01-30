/**
 * GreyBehaviorSignalTypes.ts
 *
 * Type definitions for behavior signal and correlation analysis.
 *
 * CRITICAL DESIGN PRINCIPLES:
 * - PASSIVE DATA: All types represent observed signals, not triggers
 * - NO EXECUTION: No types for actions, commands, or effects
 * - NO CAUSATION: Correlation only, NO promise of effect
 * - SEMANTIC NEUTRAL: Classification labels, NOT status or workflow
 *
 * SEMANTIC BOUNDARIES:
 * - "Signal" = passively observed environmental/operational exposure
 * - "Correlation" = statistical correlation, NOT effect promise
 * - "Behavior" = observed pattern, NOT induced action
 * - All metrics are correlation indices, NOT incentive values
 *
 * WHAT THIS MODULE CANNOT DO:
 * - Cannot define incentive, reward, or bonus structures
 * - Cannot define trigger, action, or effect types
 * - Cannot define money, balance, or payment types
 * - Cannot define state machine or workflow types
 */

// ============================================================================
// BRANDED ID TYPES
// ============================================================================

/**
 * Signal ID - unique identifier for a behavior signal record
 */
export type SignalId = string & { readonly __brand: 'SignalId' };

/**
 * Actor ID - reference to an actor (agent, player, club, etc.)
 */
export type ActorId = string & { readonly __brand: 'ActorId' };

/**
 * Context ID - reference to the context where signal was observed
 */
export type ContextId = string & { readonly __brand: 'ContextId' };

/**
 * Period ID - time period identifier for aggregation
 */
export type PeriodId = string & { readonly __brand: 'PeriodId' };

/**
 * Correlation ID - unique identifier for a correlation record
 */
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };

/**
 * Signal Hash - hash for signal chain integrity
 */
export type SignalHash = string & { readonly __brand: 'SignalHash' };

// ============================================================================
// ID CREATION FUNCTIONS
// ============================================================================

export function createSignalId(id: string): SignalId {
  return id as SignalId;
}

export function createActorId(id: string): ActorId {
  return id as ActorId;
}

export function createContextId(id: string): ContextId {
  return id as ContextId;
}

export function createPeriodId(id: string): PeriodId {
  return id as PeriodId;
}

export function createCorrelationId(id: string): CorrelationId {
  return id as CorrelationId;
}

export function createSignalHash(hash: string): SignalHash {
  return hash as SignalHash;
}

// ============================================================================
// SIGNAL KIND ENUM (SEMANTICALLY NEUTRAL)
// ============================================================================

/**
 * SignalKind - classification of observed signal types.
 *
 * IMPORTANT: These are observation labels, NOT action triggers.
 * They describe WHAT was observed, NOT what should happen.
 */
export enum SignalKind {
  /** Exposure to promotional environment observed */
  PROMOTION_EXPOSURE = 'PROMOTION_EXPOSURE',
  /** Table assignment context observed */
  TABLE_ASSIGNMENT = 'TABLE_ASSIGNMENT',
  /** Agent intervention context observed */
  AGENT_INTERVENTION = 'AGENT_INTERVENTION',
  /** UI nudge exposure observed */
  UI_NUDGE = 'UI_NUDGE',
}

// ============================================================================
// ACTOR TYPE ENUM
// ============================================================================

/**
 * ActorType - classification of actor entities.
 */
export enum ActorType {
  /** Individual player */
  PLAYER = 'PLAYER',
  /** Agent/referrer */
  AGENT = 'AGENT',
  /** Club entity */
  CLUB = 'CLUB',
  /** Table context */
  TABLE = 'TABLE',
  /** System actor */
  SYSTEM = 'SYSTEM',
}

// ============================================================================
// CONTEXT TYPE ENUM
// ============================================================================

/**
 * ContextType - classification of observation contexts.
 */
export enum ContextType {
  /** Game session context */
  SESSION = 'SESSION',
  /** Hand context */
  HAND = 'HAND',
  /** Table context */
  TABLE = 'TABLE',
  /** Club context */
  CLUB = 'CLUB',
  /** Platform-wide context */
  PLATFORM = 'PLATFORM',
}

// ============================================================================
// CORRELATION METRIC TYPES
// ============================================================================

/**
 * CorrelationMetricType - types of correlation measurements.
 *
 * IMPORTANT: These measure statistical correlation, NOT causation.
 */
export enum CorrelationMetricType {
  /** Lift: relative increase in occurrence */
  LIFT = 'LIFT',
  /** Delta: absolute difference in occurrence */
  DELTA = 'DELTA',
  /** Skew: asymmetry in distribution */
  SKEW = 'SKEW',
  /** Elasticity: sensitivity to change */
  ELASTICITY = 'ELASTICITY',
  /** Index: normalized composite score */
  INDEX = 'INDEX',
}

// ============================================================================
// CORRELATION METRIC VALUE
// ============================================================================

/**
 * CorrelationMetric - a single correlation measurement.
 */
export interface CorrelationMetric {
  /** Metric type */
  readonly metricType: CorrelationMetricType;
  /** Metric value */
  readonly value: number;
  /** Confidence level (0.0 to 1.0) */
  readonly confidence: number;
  /** Sample size used for calculation */
  readonly sampleSize: number;
}

// ============================================================================
// SIGNAL RECORD
// ============================================================================

/**
 * SignalRecord - an observed behavior signal.
 *
 * IMPORTANT: This is a passive observation record, NOT a trigger.
 */
export interface SignalRecord {
  /** Unique signal ID */
  readonly signalId: SignalId;
  /** Signal kind */
  readonly kind: SignalKind;
  /** Actor who was observed */
  readonly actorId: ActorId;
  /** Actor type */
  readonly actorType: ActorType;
  /** Context where signal was observed */
  readonly contextId: ContextId;
  /** Context type */
  readonly contextType: ContextType;
  /** Period of observation */
  readonly periodId: PeriodId;
  /** Observation timestamp */
  readonly timestamp: number;
  /** Signal intensity (0.0 to 1.0) */
  readonly intensity: number;
  /** Duration of exposure in milliseconds */
  readonly durationMs: number;
  /** Hash chain link */
  readonly previousHash: SignalHash;
  /** Record hash */
  readonly recordHash: SignalHash;
  /** Sequence number in chain */
  readonly sequenceNumber: number;
}

/**
 * SignalInput - input for recording a new signal.
 */
export interface SignalInput {
  /** Signal kind */
  readonly kind: SignalKind;
  /** Actor who was observed */
  readonly actorId: ActorId;
  /** Actor type */
  readonly actorType: ActorType;
  /** Context where signal was observed */
  readonly contextId: ContextId;
  /** Context type */
  readonly contextType: ContextType;
  /** Period of observation */
  readonly periodId: PeriodId;
  /** Signal intensity (0.0 to 1.0) */
  readonly intensity: number;
  /** Duration of exposure in milliseconds */
  readonly durationMs: number;
}

// ============================================================================
// CORRELATION RECORD
// ============================================================================

/**
 * CorrelationRecord - a calculated correlation between signals and outcomes.
 *
 * IMPORTANT: Correlation is statistical observation, NOT causation.
 */
export interface CorrelationRecord {
  /** Unique correlation ID */
  readonly correlationId: CorrelationId;
  /** Signal kind being correlated */
  readonly signalKind: SignalKind;
  /** Actor ID if actor-specific correlation */
  readonly actorId: ActorId | null;
  /** Context ID if context-specific correlation */
  readonly contextId: ContextId | null;
  /** Period of analysis */
  readonly periodId: PeriodId;
  /** Correlation metrics */
  readonly metrics: readonly CorrelationMetric[];
  /** Timestamp of calculation */
  readonly calculatedAt: number;
  /** Total observations analyzed */
  readonly observationCount: number;
  /** Hash chain link */
  readonly previousHash: SignalHash;
  /** Record hash */
  readonly recordHash: SignalHash;
  /** Sequence number in chain */
  readonly sequenceNumber: number;
}

/**
 * CorrelationInput - input for recording a new correlation.
 */
export interface CorrelationInput {
  /** Signal kind being correlated */
  readonly signalKind: SignalKind;
  /** Actor ID if actor-specific correlation */
  readonly actorId: ActorId | null;
  /** Context ID if context-specific correlation */
  readonly contextId: ContextId | null;
  /** Period of analysis */
  readonly periodId: PeriodId;
  /** Correlation metrics */
  readonly metrics: readonly CorrelationMetric[];
  /** Total observations analyzed */
  readonly observationCount: number;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * SignalResult - discriminated union for signal operations.
 */
export type SignalResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

/**
 * Create success result.
 */
export function signalSuccess<T>(value: T): SignalResult<T> {
  return Object.freeze({ ok: true, value });
}

/**
 * Create error result.
 */
export function signalError<T>(error: string): SignalResult<T> {
  return Object.freeze({ ok: false, error });
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/** Genesis hash for signal chain */
export const SIGNAL_GENESIS_HASH = createSignalHash('SIGNAL_GENESIS_0000000000000000');

/**
 * Compute hash for signal record.
 */
export function computeSignalHash(
  input: SignalInput,
  previousHash: SignalHash,
  sequenceNumber: number,
  timestamp: number
): SignalHash {
  const data = [
    input.kind,
    input.actorId,
    input.actorType,
    input.contextId,
    input.contextType,
    input.periodId,
    input.intensity.toFixed(6),
    input.durationMs.toString(),
    previousHash,
    sequenceNumber.toString(),
    timestamp.toString(),
  ].join('|');

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return createSignalHash(`SIG_${Math.abs(hash).toString(16).padStart(16, '0')}`);
}

/**
 * Compute hash for correlation record.
 */
export function computeCorrelationHash(
  input: CorrelationInput,
  previousHash: SignalHash,
  sequenceNumber: number,
  timestamp: number
): SignalHash {
  const metricsHash = input.metrics
    .map(m => `${m.metricType}:${m.value.toFixed(6)}:${m.confidence.toFixed(6)}:${m.sampleSize}`)
    .join(',');

  const data = [
    input.signalKind,
    input.actorId || 'NULL',
    input.contextId || 'NULL',
    input.periodId,
    metricsHash,
    input.observationCount.toString(),
    previousHash,
    sequenceNumber.toString(),
    timestamp.toString(),
  ].join('|');

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return createSignalHash(`COR_${Math.abs(hash).toString(16).padStart(16, '0')}`);
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate signal intensity is in valid range.
 */
export function isValidIntensity(intensity: number): boolean {
  return typeof intensity === 'number' &&
    !isNaN(intensity) &&
    intensity >= 0 &&
    intensity <= 1;
}

/**
 * Validate duration is non-negative.
 */
export function isValidDuration(durationMs: number): boolean {
  return typeof durationMs === 'number' &&
    !isNaN(durationMs) &&
    durationMs >= 0;
}

/**
 * Validate confidence is in valid range.
 */
export function isValidConfidence(confidence: number): boolean {
  return typeof confidence === 'number' &&
    !isNaN(confidence) &&
    confidence >= 0 &&
    confidence <= 1;
}

/**
 * Validate sample size is positive.
 */
export function isValidSampleSize(sampleSize: number): boolean {
  return typeof sampleSize === 'number' &&
    Number.isInteger(sampleSize) &&
    sampleSize > 0;
}

/**
 * Validate correlation metric.
 */
export function isValidCorrelationMetric(metric: CorrelationMetric): boolean {
  return typeof metric.value === 'number' &&
    !isNaN(metric.value) &&
    isValidConfidence(metric.confidence) &&
    isValidSampleSize(metric.sampleSize) &&
    Object.values(CorrelationMetricType).includes(metric.metricType);
}
