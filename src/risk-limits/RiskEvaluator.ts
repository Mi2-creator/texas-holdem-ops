/**
 * RiskEvaluator.ts
 *
 * Pure functions for risk analysis.
 *
 * ANALYSIS-ONLY: These functions observe and flag, NEVER enforce or block.
 * PURE FUNCTIONS: No side effects, no mutations.
 * DETERMINISTIC: Same inputs produce same outputs.
 * READ-ONLY: Does not modify any data.
 *
 * CRITICAL: This module CANNOT block, execute, auto-adjust, or mutate anything.
 * All outputs are FLAGS for human review, not automated actions.
 */

import {
  type RiskRule,
  type RiskFlag,
  RiskCategory,
  RiskSeverity,
  ThresholdType,
  computeFlagId,
} from './RiskLimitTypes';

import { type RiskRuleRegistry } from './RiskRuleRegistry';

// ============================================================================
// ANALYSIS INPUT TYPES
// ============================================================================

/**
 * Timestamped Event - generic event with timestamp
 */
export interface TimestampedEvent {
  readonly timestamp: number;
  readonly subjectId: string;
}

/**
 * Recharge Analysis Input
 */
export interface RechargeAnalysisInput {
  /** All recharge events to analyze */
  readonly events: readonly TimestampedEvent[];
  /** Current analysis timestamp (must be injected) */
  readonly analysisTimestamp: number;
}

/**
 * Approval Analysis Input
 */
export interface ApprovalAnalysisInput {
  /** All approval events to analyze */
  readonly events: readonly TimestampedEvent[];
  /** Current analysis timestamp (must be injected) */
  readonly analysisTimestamp: number;
}

/**
 * Actor Analysis Input
 */
export interface ActorAnalysisInput {
  /** Actor ID */
  readonly actorId: string;
  /** Events by this actor */
  readonly events: readonly TimestampedEvent[];
  /** Total events across all actors */
  readonly totalEvents: number;
  /** Current analysis timestamp (must be injected) */
  readonly analysisTimestamp: number;
}

/**
 * Club/Agent Skew Analysis Input
 */
export interface SkewAnalysisInput {
  /** Subject ID (club or agent) */
  readonly subjectId: string;
  /** Subject type ('club' or 'agent') */
  readonly subjectType: 'club' | 'agent';
  /** Events for this subject */
  readonly subjectEvents: number;
  /** Total events */
  readonly totalEvents: number;
  /** Current analysis timestamp (must be injected) */
  readonly analysisTimestamp: number;
}

/**
 * Pending Pattern Analysis Input
 */
export interface PendingPatternInput {
  /** Actor ID */
  readonly actorId: string;
  /** Pending events (not yet resolved) */
  readonly pendingEvents: readonly TimestampedEvent[];
  /** Current analysis timestamp (must be injected) */
  readonly analysisTimestamp: number;
}

// ============================================================================
// ANALYSIS OUTPUT TYPE
// ============================================================================

/**
 * Analysis Result - read-only collection of flags
 *
 * CRITICAL: These are FLAGS for human review, NOT automated actions.
 */
export interface AnalysisResult {
  /** Generated flags */
  readonly flags: readonly RiskFlag[];
  /** Analysis timestamp */
  readonly analyzedAt: number;
  /** Rules evaluated */
  readonly rulesEvaluated: number;
  /** Whether any HIGH severity flags were generated */
  readonly hasHighSeverity: boolean;
}

// ============================================================================
// PURE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Evaluate frequency-based risk.
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce.
 * PURE FUNCTION: No side effects.
 */
export function evaluateFrequency(
  rule: RiskRule,
  events: readonly TimestampedEvent[],
  subjectType: string,
  subjectId: string,
  analysisTimestamp: number
): RiskFlag | null {
  if (rule.category !== RiskCategory.FREQUENCY) {
    return null;
  }

  const threshold = rule.threshold;
  let exceeded = false;
  let observedValue = 0;
  let thresholdValue = 0;

  if (threshold.type === ThresholdType.COUNT) {
    observedValue = events.length;
    thresholdValue = threshold.maxCount;
    exceeded = observedValue > thresholdValue;
  } else if (threshold.type === ThresholdType.RATE) {
    // Count events within window
    const windowStart = analysisTimestamp - threshold.windowMs;
    const eventsInWindow = events.filter(e => e.timestamp >= windowStart);
    observedValue = eventsInWindow.length;
    thresholdValue = threshold.maxCount;
    exceeded = observedValue > thresholdValue;
  }

  if (!exceeded) {
    return null;
  }

  return createFlag(rule, subjectType, subjectId, observedValue, thresholdValue, analysisTimestamp);
}

/**
 * Evaluate velocity-based risk (speed of operations).
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce.
 * PURE FUNCTION: No side effects.
 */
export function evaluateVelocity(
  rule: RiskRule,
  events: readonly TimestampedEvent[],
  subjectType: string,
  subjectId: string,
  analysisTimestamp: number
): RiskFlag | null {
  if (rule.category !== RiskCategory.VELOCITY) {
    return null;
  }

  const threshold = rule.threshold;

  if (threshold.type !== ThresholdType.WINDOW || events.length < 2) {
    return null;
  }

  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Find minimum gap between consecutive events
  let minGap = Infinity;
  for (let i = 1; i < sortedEvents.length; i++) {
    const gap = sortedEvents[i].timestamp - sortedEvents[i - 1].timestamp;
    if (gap < minGap) {
      minGap = gap;
    }
  }

  if (minGap === Infinity || minGap >= threshold.minGapMs) {
    return null;
  }

  // Observed value is the actual minimum gap, threshold is the required minimum
  return createFlag(
    rule,
    subjectType,
    subjectId,
    minGap,
    threshold.minGapMs,
    analysisTimestamp,
    { minGapObserved: minGap }
  );
}

/**
 * Evaluate concentration-based risk (actor concentration).
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce.
 * PURE FUNCTION: No side effects.
 */
export function evaluateConcentration(
  rule: RiskRule,
  actorEvents: number,
  totalEvents: number,
  subjectType: string,
  subjectId: string,
  analysisTimestamp: number
): RiskFlag | null {
  if (rule.category !== RiskCategory.CONCENTRATION) {
    return null;
  }

  const threshold = rule.threshold;

  if (threshold.type !== ThresholdType.PERCENTAGE || totalEvents === 0) {
    return null;
  }

  // Calculate percentage (integer arithmetic, multiply by 100 first)
  const percentage = Math.floor((actorEvents * 100) / totalEvents);

  if (percentage <= threshold.maxPercentage) {
    return null;
  }

  return createFlag(
    rule,
    subjectType,
    subjectId,
    percentage,
    threshold.maxPercentage,
    analysisTimestamp,
    { actorEvents, totalEvents }
  );
}

/**
 * Evaluate skew-based risk (distribution imbalance).
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce.
 * PURE FUNCTION: No side effects.
 */
export function evaluateSkew(
  rule: RiskRule,
  input: SkewAnalysisInput
): RiskFlag | null {
  if (rule.category !== RiskCategory.SKEW) {
    return null;
  }

  const threshold = rule.threshold;

  if (threshold.type !== ThresholdType.PERCENTAGE || input.totalEvents === 0) {
    return null;
  }

  // Calculate percentage
  const percentage = Math.floor((input.subjectEvents * 100) / input.totalEvents);

  if (percentage <= threshold.maxPercentage) {
    return null;
  }

  return createFlag(
    rule,
    input.subjectType,
    input.subjectId,
    percentage,
    threshold.maxPercentage,
    input.analysisTimestamp,
    { subjectEvents: input.subjectEvents, totalEvents: input.totalEvents }
  );
}

/**
 * Evaluate pattern-based risk (repeated pending patterns).
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce.
 * PURE FUNCTION: No side effects.
 */
export function evaluateRepeatedPending(
  rule: RiskRule,
  input: PendingPatternInput
): RiskFlag | null {
  if (rule.category !== RiskCategory.PATTERN) {
    return null;
  }

  const threshold = rule.threshold;

  if (threshold.type !== ThresholdType.COUNT) {
    return null;
  }

  const pendingCount = input.pendingEvents.length;

  if (pendingCount <= threshold.maxCount) {
    return null;
  }

  return createFlag(
    rule,
    'actor',
    input.actorId,
    pendingCount,
    threshold.maxCount,
    input.analysisTimestamp,
    { pendingEvents: pendingCount }
  );
}

// ============================================================================
// COMPREHENSIVE EVALUATION
// ============================================================================

/**
 * Evaluate all rules against recharge data.
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce or block.
 * PURE FUNCTION: No side effects.
 * DETERMINISTIC: Same inputs produce same outputs.
 */
export function evaluateRechargeRisk(
  registry: RiskRuleRegistry,
  input: RechargeAnalysisInput
): AnalysisResult {
  const flags: RiskFlag[] = [];
  const activeRules = registry.getActiveRules();

  // Group events by subject
  const eventsBySubject = groupEventsBySubject(input.events);

  for (const rule of activeRules) {
    // Evaluate frequency for each subject
    if (rule.category === RiskCategory.FREQUENCY) {
      for (const [subjectId, events] of eventsBySubject) {
        const flag = evaluateFrequency(
          rule,
          events,
          'recharge',
          subjectId,
          input.analysisTimestamp
        );
        if (flag) {
          flags.push(flag);
        }
      }
    }

    // Evaluate velocity for each subject
    if (rule.category === RiskCategory.VELOCITY) {
      for (const [subjectId, events] of eventsBySubject) {
        const flag = evaluateVelocity(
          rule,
          events,
          'recharge',
          subjectId,
          input.analysisTimestamp
        );
        if (flag) {
          flags.push(flag);
        }
      }
    }
  }

  return createAnalysisResult(flags, input.analysisTimestamp, activeRules.length);
}

/**
 * Evaluate all rules against approval data.
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce or block.
 * PURE FUNCTION: No side effects.
 */
export function evaluateApprovalRisk(
  registry: RiskRuleRegistry,
  input: ApprovalAnalysisInput
): AnalysisResult {
  const flags: RiskFlag[] = [];
  const activeRules = registry.getActiveRules();

  const eventsBySubject = groupEventsBySubject(input.events);

  for (const rule of activeRules) {
    if (rule.category === RiskCategory.VELOCITY) {
      for (const [subjectId, events] of eventsBySubject) {
        const flag = evaluateVelocity(
          rule,
          events,
          'approval',
          subjectId,
          input.analysisTimestamp
        );
        if (flag) {
          flags.push(flag);
        }
      }
    }
  }

  return createAnalysisResult(flags, input.analysisTimestamp, activeRules.length);
}

/**
 * Evaluate actor concentration risk.
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce or block.
 * PURE FUNCTION: No side effects.
 */
export function evaluateActorConcentration(
  registry: RiskRuleRegistry,
  input: ActorAnalysisInput
): AnalysisResult {
  const flags: RiskFlag[] = [];
  const activeRules = registry.getActiveRules();

  for (const rule of activeRules) {
    if (rule.category === RiskCategory.CONCENTRATION) {
      const flag = evaluateConcentration(
        rule,
        input.events.length,
        input.totalEvents,
        'actor',
        input.actorId,
        input.analysisTimestamp
      );
      if (flag) {
        flags.push(flag);
      }
    }
  }

  return createAnalysisResult(flags, input.analysisTimestamp, activeRules.length);
}

/**
 * Evaluate club/agent skew risk.
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce or block.
 * PURE FUNCTION: No side effects.
 */
export function evaluateSkewRisk(
  registry: RiskRuleRegistry,
  input: SkewAnalysisInput
): AnalysisResult {
  const flags: RiskFlag[] = [];
  const activeRules = registry.getActiveRules();

  for (const rule of activeRules) {
    if (rule.category === RiskCategory.SKEW) {
      const flag = evaluateSkew(rule, input);
      if (flag) {
        flags.push(flag);
      }
    }
  }

  return createAnalysisResult(flags, input.analysisTimestamp, activeRules.length);
}

/**
 * Evaluate pending pattern risk.
 *
 * ANALYSIS-ONLY: Returns flags, does not enforce or block.
 * PURE FUNCTION: No side effects.
 */
export function evaluatePendingPatternRisk(
  registry: RiskRuleRegistry,
  input: PendingPatternInput
): AnalysisResult {
  const flags: RiskFlag[] = [];
  const activeRules = registry.getActiveRules();

  for (const rule of activeRules) {
    if (rule.category === RiskCategory.PATTERN) {
      const flag = evaluateRepeatedPending(rule, input);
      if (flag) {
        flags.push(flag);
      }
    }
  }

  return createAnalysisResult(flags, input.analysisTimestamp, activeRules.length);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a risk flag.
 */
function createFlag(
  rule: RiskRule,
  subjectType: string,
  subjectId: string,
  observedValue: number,
  thresholdValue: number,
  analysisTimestamp: number,
  context?: Record<string, unknown>
): RiskFlag {
  const flagId = computeFlagId(rule.ruleId, subjectType, subjectId, analysisTimestamp);

  return Object.freeze({
    flagId,
    ruleId: rule.ruleId,
    category: rule.category,
    severity: rule.severity,
    description: `${rule.name}: ${rule.description}`,
    subjectType,
    subjectId,
    observedValue,
    thresholdValue,
    analyzedAt: analysisTimestamp,
    context: context ? Object.freeze({ ...context }) : undefined,
  });
}

/**
 * Create analysis result.
 */
function createAnalysisResult(
  flags: RiskFlag[],
  analyzedAt: number,
  rulesEvaluated: number
): AnalysisResult {
  const hasHighSeverity = flags.some(f => f.severity === RiskSeverity.HIGH);

  return Object.freeze({
    flags: Object.freeze(flags),
    analyzedAt,
    rulesEvaluated,
    hasHighSeverity,
  });
}

/**
 * Group events by subject ID.
 */
function groupEventsBySubject(
  events: readonly TimestampedEvent[]
): Map<string, TimestampedEvent[]> {
  const grouped = new Map<string, TimestampedEvent[]>();

  for (const event of events) {
    if (!grouped.has(event.subjectId)) {
      grouped.set(event.subjectId, []);
    }
    grouped.get(event.subjectId)!.push(event);
  }

  return grouped;
}
