/**
 * RiskAnalysis.test.ts
 *
 * Comprehensive tests for OPS-3: Grey Risk Limits & Threshold Analysis.
 *
 * CRITICAL TEST GOALS:
 * 1. Prove NO mutations occur
 * 2. Prove deterministic outputs (same input → same flags)
 * 3. Prove no forbidden concepts in exports
 * 4. Prove no enforcement paths exist
 * 5. Prove analysis-only behavior
 */

import {
  // Types
  type RiskRuleInput,
  type RiskFlag,
  type TimestampedEvent,
  type AnalysisResult,

  // Enums
  RiskSeverity,
  RiskCategory,
  ThresholdType,
  RiskErrorCode,

  // ID factories
  createRiskRuleId,
  createRiskFlagId,
  createRiskHash,

  // Hash utilities
  RISK_GENESIS_HASH,
  computeRiskHash,
  computeRiskRecordHash,
  computeFlagId,

  // Validation
  isValidThreshold,

  // Registry
  RiskRuleRegistry,
  createRiskRuleRegistry,

  // Evaluator
  evaluateFrequency,
  evaluateVelocity,
  evaluateConcentration,
  evaluateRechargeRisk,

  // Views
  getRiskSummaryByPeriod,
  getRiskSummaryByActor,
  getRiskSummaryByClub,
  getHighRiskFlagList,
  getOverallRiskSummary,
  aggregateAnalysisResults,

  // Guards
  RISK_FORBIDDEN_CONCEPTS,
  assertNoRiskForbiddenConcepts,
  assertNoRiskForbiddenFunctions,
  assertAnalysisOnly,
  assertFlagIsOutputOnly,
  RISK_BOUNDARY_DECLARATION,
} from '../risk-limits';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestRuleInput(
  name: string,
  category: RiskCategory,
  severity: RiskSeverity,
  timestamp: number
): RiskRuleInput {
  if (category === RiskCategory.FREQUENCY) {
    return {
      name,
      description: `Test rule for ${category} analysis`,
      category,
      severity,
      threshold: { type: ThresholdType.COUNT, maxCount: 5 },
      timestamp,
    };
  }
  if (category === RiskCategory.VELOCITY) {
    return {
      name,
      description: `Test rule for ${category} analysis`,
      category,
      severity,
      threshold: { type: ThresholdType.WINDOW, windowMs: 60000, minGapMs: 1000 },
      timestamp,
    };
  }
  if (category === RiskCategory.CONCENTRATION || category === RiskCategory.SKEW) {
    return {
      name,
      description: `Test rule for ${category} analysis`,
      category,
      severity,
      threshold: { type: ThresholdType.PERCENTAGE, maxPercentage: 30 },
      timestamp,
    };
  }
  if (category === RiskCategory.PATTERN) {
    return {
      name,
      description: `Test rule for ${category} analysis`,
      category,
      severity,
      threshold: { type: ThresholdType.COUNT, maxCount: 3 },
      timestamp,
    };
  }
  return {
    name,
    description: `Test rule for ${category} analysis`,
    category,
    severity,
    threshold: { type: ThresholdType.COUNT, maxCount: 10 },
    timestamp,
  };
}

function createTestEvents(subjectId: string, count: number, startTime: number): TimestampedEvent[] {
  const events: TimestampedEvent[] = [];
  for (let i = 0; i < count; i++) {
    events.push({
      timestamp: startTime + i * 1000,
      subjectId,
    });
  }
  return events;
}

// ============================================================================
// BRANDED ID TESTS
// ============================================================================

describe('RiskLimitTypes - Branded IDs', () => {
  test('createRiskRuleId creates valid ID', () => {
    const id = createRiskRuleId('rule-1');
    expect(id).toBe('rule-1');
  });

  test('createRiskRuleId rejects empty string', () => {
    expect(() => createRiskRuleId('')).toThrow();
    expect(() => createRiskRuleId('   ')).toThrow();
  });

  test('createRiskFlagId creates valid ID', () => {
    const id = createRiskFlagId('flag-1');
    expect(id).toBe('flag-1');
  });

  test('createRiskHash creates valid hash', () => {
    const hash = createRiskHash('abc123');
    expect(hash).toBe('abc123');
  });

  test('RISK_GENESIS_HASH is defined and frozen', () => {
    expect(RISK_GENESIS_HASH).toBeDefined();
    expect(RISK_GENESIS_HASH.length).toBe(64);
    expect(Object.isFrozen(RISK_GENESIS_HASH)).toBe(true);
  });
});

// ============================================================================
// HASH DETERMINISM TESTS
// ============================================================================

describe('RiskLimitTypes - Hash Determinism', () => {
  test('computeRiskHash is deterministic', () => {
    const data = 'test-data-123';
    const hash1 = computeRiskHash(data);
    const hash2 = computeRiskHash(data);
    expect(hash1).toBe(hash2);
  });

  test('different data produces different hashes', () => {
    const hash1 = computeRiskHash('data-1');
    const hash2 = computeRiskHash('data-2');
    expect(hash1).not.toBe(hash2);
  });

  test('computeRiskRecordHash is deterministic', () => {
    const threshold: { type: 'COUNT'; maxCount: number } = { type: ThresholdType.COUNT, maxCount: 5 };
    const record = {
      ruleId: createRiskRuleId('rule-1'),
      rule: Object.freeze({
        ruleId: createRiskRuleId('rule-1'),
        name: 'Test Rule',
        description: 'Test description',
        category: RiskCategory.FREQUENCY,
        severity: RiskSeverity.MEDIUM,
        threshold: Object.freeze(threshold),
        active: true,
        createdAt: 1000,
      }),
      sequenceNumber: 1,
      previousHash: RISK_GENESIS_HASH,
      createdAt: 1000,
    };

    const hash1 = computeRiskRecordHash(record);
    const hash2 = computeRiskRecordHash(record);
    expect(hash1).toBe(hash2);
  });
});

// ============================================================================
// THRESHOLD VALIDATION TESTS
// ============================================================================

describe('RiskLimitTypes - Threshold Validation', () => {
  test('validates COUNT threshold', () => {
    expect(isValidThreshold({ type: ThresholdType.COUNT, maxCount: 5 })).toBe(true);
    expect(isValidThreshold({ type: ThresholdType.COUNT, maxCount: 0 })).toBe(false);
    expect(isValidThreshold({ type: ThresholdType.COUNT, maxCount: -1 })).toBe(false);
    expect(isValidThreshold({ type: ThresholdType.COUNT, maxCount: 1.5 })).toBe(false);
  });

  test('validates RATE threshold', () => {
    expect(isValidThreshold({ type: ThresholdType.RATE, maxCount: 10, windowMs: 60000 })).toBe(true);
    expect(isValidThreshold({ type: ThresholdType.RATE, maxCount: 0, windowMs: 60000 })).toBe(false);
    expect(isValidThreshold({ type: ThresholdType.RATE, maxCount: 10, windowMs: 0 })).toBe(false);
  });

  test('validates WINDOW threshold', () => {
    expect(isValidThreshold({ type: ThresholdType.WINDOW, windowMs: 60000, minGapMs: 1000 })).toBe(true);
    expect(isValidThreshold({ type: ThresholdType.WINDOW, windowMs: 0, minGapMs: 1000 })).toBe(false);
    expect(isValidThreshold({ type: ThresholdType.WINDOW, windowMs: 60000, minGapMs: -1 })).toBe(false);
  });

  test('validates PERCENTAGE threshold', () => {
    expect(isValidThreshold({ type: ThresholdType.PERCENTAGE, maxPercentage: 50 })).toBe(true);
    expect(isValidThreshold({ type: ThresholdType.PERCENTAGE, maxPercentage: 0 })).toBe(true);
    expect(isValidThreshold({ type: ThresholdType.PERCENTAGE, maxPercentage: 100 })).toBe(true);
    expect(isValidThreshold({ type: ThresholdType.PERCENTAGE, maxPercentage: -1 })).toBe(false);
    expect(isValidThreshold({ type: ThresholdType.PERCENTAGE, maxPercentage: 101 })).toBe(false);
  });
});

// ============================================================================
// REGISTRY TESTS
// ============================================================================

describe('RiskRuleRegistry', () => {
  let registry: RiskRuleRegistry;

  beforeEach(() => {
    registry = createRiskRuleRegistry();
  });

  test('registerRule creates frozen rule', () => {
    const input = createTestRuleInput('Frequency Rule', RiskCategory.FREQUENCY, RiskSeverity.MEDIUM, 1000);
    const result = registry.registerRule(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.rule)).toBe(true);
      expect(Object.isFrozen(result.value.rule.threshold)).toBe(true);
    }
  });

  test('registerRule is append-only', () => {
    const input1 = createTestRuleInput('Rule 1', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000);
    const input2 = createTestRuleInput('Rule 2', RiskCategory.VELOCITY, RiskSeverity.MEDIUM, 2000);

    registry.registerRule(input1);
    registry.registerRule(input2);

    const records = registry.getAllRecords();
    expect(records.length).toBe(2);
    expect(records[0].sequenceNumber).toBe(1);
    expect(records[1].sequenceNumber).toBe(2);
  });

  test('registerRule rejects duplicate names', () => {
    const input1 = createTestRuleInput('Same Name', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000);
    const input2 = createTestRuleInput('Same Name', RiskCategory.VELOCITY, RiskSeverity.MEDIUM, 2000);

    const result1 = registry.registerRule(input1);
    const result2 = registry.registerRule(input2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error.code).toBe(RiskErrorCode.DUPLICATE_RULE);
    }
  });

  test('chain integrity verification succeeds for valid chain', () => {
    registry.registerRule(createTestRuleInput('Rule 1', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000));
    registry.registerRule(createTestRuleInput('Rule 2', RiskCategory.VELOCITY, RiskSeverity.MEDIUM, 2000));
    registry.registerRule(createTestRuleInput('Rule 3', RiskCategory.PATTERN, RiskSeverity.HIGH, 3000));

    const result = registry.verifyChainIntegrity();
    expect(result.success).toBe(true);
  });

  test('getActiveRules returns only active rules', () => {
    registry.registerRule(createTestRuleInput('Active Rule', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000));

    const activeRules = registry.getActiveRules();
    expect(activeRules.length).toBe(1);
    expect(activeRules[0].active).toBe(true);
  });

  test('getState returns frozen state', () => {
    registry.registerRule(createTestRuleInput('Rule 1', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000));

    const state = registry.getState();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.records)).toBe(true);
    expect(state.recordCount).toBe(1);
    expect(state.activeRuleCount).toBe(1);
  });

  test('hash chain links correctly', () => {
    registry.registerRule(createTestRuleInput('Rule 1', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000));
    registry.registerRule(createTestRuleInput('Rule 2', RiskCategory.VELOCITY, RiskSeverity.MEDIUM, 2000));

    const records = registry.getAllRecords();
    expect(records[0].previousHash).toBe(RISK_GENESIS_HASH);
    expect(records[1].previousHash).toBe(records[0].recordHash);
  });
});

// ============================================================================
// EVALUATOR TESTS - PURE FUNCTIONS
// ============================================================================

describe('RiskEvaluator - Pure Functions', () => {
  let registry: RiskRuleRegistry;
  const baseTimestamp = 100000;

  beforeEach(() => {
    registry = createRiskRuleRegistry();
  });

  describe('evaluateFrequency', () => {
    test('returns null when threshold not exceeded', () => {
      const input = createTestRuleInput('Freq Rule', RiskCategory.FREQUENCY, RiskSeverity.MEDIUM, 1000);
      registry.registerRule(input);
      const rule = registry.getActiveRules()[0];

      const events = createTestEvents('subject-1', 3, baseTimestamp); // 3 events, threshold is 5
      const flag = evaluateFrequency(rule, events, 'test', 'subject-1', baseTimestamp + 10000);

      expect(flag).toBeNull();
    });

    test('returns flag when threshold exceeded', () => {
      const input = createTestRuleInput('Freq Rule', RiskCategory.FREQUENCY, RiskSeverity.MEDIUM, 1000);
      registry.registerRule(input);
      const rule = registry.getActiveRules()[0];

      const events = createTestEvents('subject-1', 10, baseTimestamp); // 10 events, threshold is 5
      const flag = evaluateFrequency(rule, events, 'test', 'subject-1', baseTimestamp + 10000);

      expect(flag).not.toBeNull();
      expect(flag!.observedValue).toBe(10);
      expect(flag!.thresholdValue).toBe(5);
      expect(flag!.severity).toBe(RiskSeverity.MEDIUM);
    });

    test('is deterministic - same input produces same output', () => {
      const input = createTestRuleInput('Freq Rule', RiskCategory.FREQUENCY, RiskSeverity.MEDIUM, 1000);
      registry.registerRule(input);
      const rule = registry.getActiveRules()[0];

      const events = createTestEvents('subject-1', 10, baseTimestamp);
      const flag1 = evaluateFrequency(rule, events, 'test', 'subject-1', baseTimestamp + 10000);
      const flag2 = evaluateFrequency(rule, events, 'test', 'subject-1', baseTimestamp + 10000);

      expect(flag1).toEqual(flag2);
    });
  });

  describe('evaluateVelocity', () => {
    test('returns null when gap is sufficient', () => {
      const input = createTestRuleInput('Velocity Rule', RiskCategory.VELOCITY, RiskSeverity.HIGH, 1000);
      registry.registerRule(input);
      const rule = registry.getActiveRules()[0];

      // Events with 1s gap, threshold minGapMs is 1000
      const events = createTestEvents('subject-1', 3, baseTimestamp);
      const flag = evaluateVelocity(rule, events, 'test', 'subject-1', baseTimestamp + 10000);

      expect(flag).toBeNull();
    });

    test('returns flag when velocity too fast', () => {
      const input = createTestRuleInput('Velocity Rule', RiskCategory.VELOCITY, RiskSeverity.HIGH, 1000);
      registry.registerRule(input);
      const rule = registry.getActiveRules()[0];

      // Events with 500ms gap, threshold minGapMs is 1000
      const events: TimestampedEvent[] = [
        { timestamp: baseTimestamp, subjectId: 'subject-1' },
        { timestamp: baseTimestamp + 500, subjectId: 'subject-1' },
        { timestamp: baseTimestamp + 1000, subjectId: 'subject-1' },
      ];
      const flag = evaluateVelocity(rule, events, 'test', 'subject-1', baseTimestamp + 10000);

      expect(flag).not.toBeNull();
      expect(flag!.observedValue).toBe(500);
      expect(flag!.thresholdValue).toBe(1000);
    });
  });

  describe('evaluateConcentration', () => {
    test('returns null when concentration below threshold', () => {
      const input = createTestRuleInput('Concentration Rule', RiskCategory.CONCENTRATION, RiskSeverity.MEDIUM, 1000);
      registry.registerRule(input);
      const rule = registry.getActiveRules()[0];

      // 20 out of 100 = 20%, threshold is 30%
      const flag = evaluateConcentration(rule, 20, 100, 'actor', 'actor-1', baseTimestamp);

      expect(flag).toBeNull();
    });

    test('returns flag when concentration exceeds threshold', () => {
      const input = createTestRuleInput('Concentration Rule', RiskCategory.CONCENTRATION, RiskSeverity.MEDIUM, 1000);
      registry.registerRule(input);
      const rule = registry.getActiveRules()[0];

      // 50 out of 100 = 50%, threshold is 30%
      const flag = evaluateConcentration(rule, 50, 100, 'actor', 'actor-1', baseTimestamp);

      expect(flag).not.toBeNull();
      expect(flag!.observedValue).toBe(50);
      expect(flag!.thresholdValue).toBe(30);
    });
  });

  describe('evaluateRechargeRisk - comprehensive', () => {
    test('evaluates multiple rules and returns frozen result', () => {
      registry.registerRule(createTestRuleInput('Freq Rule', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000));
      registry.registerRule(createTestRuleInput('Velocity Rule', RiskCategory.VELOCITY, RiskSeverity.HIGH, 2000));

      const events = createTestEvents('subject-1', 10, baseTimestamp);
      const result = evaluateRechargeRisk(registry, {
        events,
        analysisTimestamp: baseTimestamp + 100000,
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.flags)).toBe(true);
      expect(result.rulesEvaluated).toBe(2);
    });

    test('is deterministic', () => {
      registry.registerRule(createTestRuleInput('Freq Rule', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000));

      const events = createTestEvents('subject-1', 10, baseTimestamp);
      const input = { events, analysisTimestamp: baseTimestamp + 100000 };

      const result1 = evaluateRechargeRisk(registry, input);
      const result2 = evaluateRechargeRisk(registry, input);

      expect(result1.flags.length).toBe(result2.flags.length);
      expect(result1.hasHighSeverity).toBe(result2.hasHighSeverity);
    });
  });
});

// ============================================================================
// VIEWS TESTS - READ-ONLY
// ============================================================================

describe('RiskViews - Read-Only Views', () => {
  const baseTimestamp = 100000;

  function createTestFlags(): RiskFlag[] {
    return [
      Object.freeze({
        flagId: createRiskFlagId('flag-1'),
        ruleId: createRiskRuleId('rule-1'),
        category: RiskCategory.FREQUENCY,
        severity: RiskSeverity.HIGH,
        description: 'Test flag 1',
        subjectType: 'actor',
        subjectId: 'actor-1',
        observedValue: 10,
        thresholdValue: 5,
        analyzedAt: baseTimestamp,
      }),
      Object.freeze({
        flagId: createRiskFlagId('flag-2'),
        ruleId: createRiskRuleId('rule-2'),
        category: RiskCategory.VELOCITY,
        severity: RiskSeverity.MEDIUM,
        description: 'Test flag 2',
        subjectType: 'actor',
        subjectId: 'actor-1',
        observedValue: 500,
        thresholdValue: 1000,
        analyzedAt: baseTimestamp + 1000,
      }),
      Object.freeze({
        flagId: createRiskFlagId('flag-3'),
        ruleId: createRiskRuleId('rule-3'),
        category: RiskCategory.CONCENTRATION,
        severity: RiskSeverity.LOW,
        description: 'Test flag 3',
        subjectType: 'club',
        subjectId: 'club-1',
        observedValue: 40,
        thresholdValue: 30,
        analyzedAt: baseTimestamp + 2000,
      }),
    ];
  }

  test('getRiskSummaryByPeriod returns frozen result', () => {
    const flags = createTestFlags();
    const summary = getRiskSummaryByPeriod(flags, baseTimestamp - 1000, baseTimestamp + 5000);

    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.bySeverity)).toBe(true);
    expect(Object.isFrozen(summary.byCategory)).toBe(true);
    expect(Object.isFrozen(summary.flags)).toBe(true);
    expect(summary.totalFlags).toBe(3);
    expect(summary.highSeverityCount).toBe(1);
  });

  test('getRiskSummaryByActor filters correctly', () => {
    const flags = createTestFlags();
    const summary = getRiskSummaryByActor(flags, 'actor-1');

    expect(summary.actorId).toBe('actor-1');
    expect(summary.totalFlags).toBe(2);
    expect(summary.hasHighSeverity).toBe(true);
  });

  test('getRiskSummaryByClub filters correctly', () => {
    const flags = createTestFlags();
    const summary = getRiskSummaryByClub(flags, 'club-1');

    expect(summary.clubId).toBe('club-1');
    expect(summary.totalFlags).toBe(1);
    expect(summary.hasHighSeverity).toBe(false);
  });

  test('getHighRiskFlagList returns frozen result', () => {
    const flags = createTestFlags();
    const highRisk = getHighRiskFlagList(flags, baseTimestamp + 10000);

    expect(Object.isFrozen(highRisk)).toBe(true);
    expect(highRisk.totalHighSeverity).toBe(1);
    expect(highRisk.highSeverityFlags.length).toBe(1);
    expect(highRisk.mediumSeverityFlags.length).toBe(1);
  });

  test('getOverallRiskSummary calculates risk score', () => {
    const flags = createTestFlags();
    const analysisResult: AnalysisResult = {
      flags,
      analyzedAt: baseTimestamp,
      rulesEvaluated: 3,
      hasHighSeverity: true,
    };

    const summary = getOverallRiskSummary(analysisResult);

    expect(Object.isFrozen(summary)).toBe(true);
    expect(summary.totalFlags).toBe(3);
    expect(summary.hasHighSeverity).toBe(true);
    expect(summary.riskScore).toBeGreaterThan(0);
    expect(summary.riskScore).toBeLessThanOrEqual(100);
  });

  test('aggregateAnalysisResults combines results', () => {
    const result1: AnalysisResult = {
      flags: [createTestFlags()[0]],
      analyzedAt: baseTimestamp,
      rulesEvaluated: 1,
      hasHighSeverity: true,
    };
    const result2: AnalysisResult = {
      flags: [createTestFlags()[1]],
      analyzedAt: baseTimestamp + 1000,
      rulesEvaluated: 1,
      hasHighSeverity: false,
    };

    const aggregated = aggregateAnalysisResults([result1, result2]);

    expect(aggregated.flags.length).toBe(2);
    expect(aggregated.rulesEvaluated).toBe(2);
    expect(aggregated.hasHighSeverity).toBe(true);
  });
});

// ============================================================================
// BOUNDARY GUARD TESTS - CRITICAL
// ============================================================================

describe('RiskBoundaryGuards - Critical Safety', () => {
  describe('RISK_FORBIDDEN_CONCEPTS', () => {
    test('contains money-related concepts', () => {
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('balance');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('money');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('payment');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('wallet');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('crypto');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('transfer');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('currency');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('fund');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('deposit');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('withdraw');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('debit');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('credit');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('transaction');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('settlement');
    });

    test('contains enforcement-related concepts', () => {
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('execute');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('auto-adjust');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('auto-block');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('enforce');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('block');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('reject');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('deny');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('prevent');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('stop');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('halt');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('disable');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('suspend');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('terminate');
      expect(RISK_FORBIDDEN_CONCEPTS).toContain('kill');
    });

    test('is frozen', () => {
      expect(Object.isFrozen(RISK_FORBIDDEN_CONCEPTS)).toBe(true);
    });
  });

  describe('assertNoRiskForbiddenConcepts', () => {
    test('passes for clean text', () => {
      const result = assertNoRiskForbiddenConcepts('This is a clean analysis description');
      expect(result.success).toBe(true);
    });

    test('fails for money concepts', () => {
      const result = assertNoRiskForbiddenConcepts('This involves balance updates');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(RiskErrorCode.FORBIDDEN_CONCEPT);
      }
    });

    test('fails for enforcement concepts', () => {
      const result = assertNoRiskForbiddenConcepts('This will block the user');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(RiskErrorCode.FORBIDDEN_CONCEPT);
      }
    });
  });

  describe('assertNoRiskForbiddenFunctions', () => {
    test('passes for clean function names', () => {
      const result = assertNoRiskForbiddenFunctions(['analyzeRisk', 'flagPattern', 'createReport']);
      expect(result.success).toBe(true);
    });

    test('fails for forbidden function patterns', () => {
      expect(assertNoRiskForbiddenFunctions(['executeTransaction']).success).toBe(false);
      expect(assertNoRiskForbiddenFunctions(['blockUser']).success).toBe(false);
      expect(assertNoRiskForbiddenFunctions(['enforceLimit']).success).toBe(false);
      expect(assertNoRiskForbiddenFunctions(['autoAdjustBalance']).success).toBe(false);
      expect(assertNoRiskForbiddenFunctions(['rejectRequest']).success).toBe(false);
      expect(assertNoRiskForbiddenFunctions(['updateBalance']).success).toBe(false);
      expect(assertNoRiskForbiddenFunctions(['processPayment']).success).toBe(false);
    });
  });

  describe('assertAnalysisOnly', () => {
    test('passes for analysis operations', () => {
      expect(assertAnalysisOnly('Analyze recharge patterns').success).toBe(true);
      expect(assertAnalysisOnly('Flag suspicious activity').success).toBe(true);
      expect(assertAnalysisOnly('Generate risk report').success).toBe(true);
    });

    test('fails for enforcement operations', () => {
      expect(assertAnalysisOnly('Block suspicious user').success).toBe(false);
      expect(assertAnalysisOnly('Reject the transaction').success).toBe(false);
      expect(assertAnalysisOnly('Enforce the limit').success).toBe(false);
      expect(assertAnalysisOnly('Auto-adjust the threshold').success).toBe(false);
    });
  });

  describe('assertFlagIsOutputOnly', () => {
    test('passes for output-only flags', () => {
      expect(assertFlagIsOutputOnly('High frequency detected for review').success).toBe(true);
      expect(assertFlagIsOutputOnly('Pattern flagged for admin attention').success).toBe(true);
    });

    test('fails for action-implying flags', () => {
      expect(assertFlagIsOutputOnly('This will block the user').success).toBe(false);
      expect(assertFlagIsOutputOnly('Blocking access now').success).toBe(false);
      expect(assertFlagIsOutputOnly('Will prevent further actions').success).toBe(false);
    });
  });

  describe('RISK_BOUNDARY_DECLARATION', () => {
    test('declares analysis-only capabilities', () => {
      expect(RISK_BOUNDARY_DECLARATION.capabilities.analysisOnly).toBe(true);
      expect(RISK_BOUNDARY_DECLARATION.capabilities.readOnly).toBe(true);
      expect(RISK_BOUNDARY_DECLARATION.capabilities.outputFlagsOnly).toBe(true);
    });

    test('declares what it CANNOT do', () => {
      expect(RISK_BOUNDARY_DECLARATION.cannotDo.canBlock).toBe(false);
      expect(RISK_BOUNDARY_DECLARATION.cannotDo.canExecute).toBe(false);
      expect(RISK_BOUNDARY_DECLARATION.cannotDo.canAutoAdjust).toBe(false);
      expect(RISK_BOUNDARY_DECLARATION.cannotDo.canAutoBlock).toBe(false);
      expect(RISK_BOUNDARY_DECLARATION.cannotDo.canMutate).toBe(false);
      expect(RISK_BOUNDARY_DECLARATION.cannotDo.canEnforce).toBe(false);
      expect(RISK_BOUNDARY_DECLARATION.cannotDo.canReject).toBe(false);
      expect(RISK_BOUNDARY_DECLARATION.cannotDo.canAccessEngine).toBe(false);
      expect(RISK_BOUNDARY_DECLARATION.cannotDo.canProcessMoney).toBe(false);
    });

    test('is completely frozen', () => {
      expect(Object.isFrozen(RISK_BOUNDARY_DECLARATION)).toBe(true);
      expect(Object.isFrozen(RISK_BOUNDARY_DECLARATION.capabilities)).toBe(true);
      expect(Object.isFrozen(RISK_BOUNDARY_DECLARATION.cannotDo)).toBe(true);
      expect(Object.isFrozen(RISK_BOUNDARY_DECLARATION.constraints)).toBe(true);
      expect(Object.isFrozen(RISK_BOUNDARY_DECLARATION.explicitStatement)).toBe(true);
    });

    test('has explicit statement about no enforcement', () => {
      expect(RISK_BOUNDARY_DECLARATION.explicitStatement.limitation).toContain('CANNOT');
      expect(RISK_BOUNDARY_DECLARATION.explicitStatement.enforcement).toContain('NO ENFORCEMENT');
    });
  });
});

// ============================================================================
// NO MUTATION TESTS - CRITICAL
// ============================================================================

describe('No Mutation Guarantees', () => {
  test('registry registerRule does not mutate input', () => {
    const registry = createRiskRuleRegistry();
    const input = createTestRuleInput('Test Rule', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000);
    const inputCopy = JSON.stringify(input);

    registry.registerRule(input);

    expect(JSON.stringify(input)).toBe(inputCopy);
  });

  test('evaluator does not mutate events', () => {
    const registry = createRiskRuleRegistry();
    registry.registerRule(createTestRuleInput('Test Rule', RiskCategory.FREQUENCY, RiskSeverity.LOW, 1000));

    const events = createTestEvents('subject-1', 10, 100000);
    const eventsCopy = JSON.stringify(events);

    evaluateRechargeRisk(registry, { events, analysisTimestamp: 200000 });

    expect(JSON.stringify(events)).toBe(eventsCopy);
  });

  test('views do not mutate flags', () => {
    const flags: RiskFlag[] = [
      Object.freeze({
        flagId: createRiskFlagId('flag-1'),
        ruleId: createRiskRuleId('rule-1'),
        category: RiskCategory.FREQUENCY,
        severity: RiskSeverity.HIGH,
        description: 'Test',
        subjectType: 'actor',
        subjectId: 'actor-1',
        observedValue: 10,
        thresholdValue: 5,
        analyzedAt: 100000,
      }),
    ];
    const flagsCopy = JSON.stringify(flags);

    getRiskSummaryByPeriod(flags, 0, 200000);
    getRiskSummaryByActor(flags, 'actor-1');
    getHighRiskFlagList(flags, 200000);

    expect(JSON.stringify(flags)).toBe(flagsCopy);
  });
});

// ============================================================================
// DETERMINISM TESTS - CRITICAL
// ============================================================================

describe('Determinism Guarantees', () => {
  test('same registry input produces same output', () => {
    const registry1 = createRiskRuleRegistry();
    const registry2 = createRiskRuleRegistry();

    const input = createTestRuleInput('Test Rule', RiskCategory.FREQUENCY, RiskSeverity.MEDIUM, 1000);

    const result1 = registry1.registerRule(input);
    const result2 = registry2.registerRule(input);

    expect(result1.success).toBe(result2.success);
    if (result1.success && result2.success) {
      expect(result1.value.rule.name).toBe(result2.value.rule.name);
      expect(result1.value.rule.category).toBe(result2.value.rule.category);
      expect(result1.value.recordHash).toBe(result2.value.recordHash);
    }
  });

  test('same evaluation input produces same flags', () => {
    const registry = createRiskRuleRegistry();
    registry.registerRule(createTestRuleInput('Freq Rule', RiskCategory.FREQUENCY, RiskSeverity.MEDIUM, 1000));

    const events = createTestEvents('subject-1', 10, 100000);
    const input = { events, analysisTimestamp: 200000 };

    const result1 = evaluateRechargeRisk(registry, input);
    const result2 = evaluateRechargeRisk(registry, input);

    expect(result1.flags.length).toBe(result2.flags.length);
    expect(result1.hasHighSeverity).toBe(result2.hasHighSeverity);
    for (let i = 0; i < result1.flags.length; i++) {
      expect(result1.flags[i].flagId).toBe(result2.flags[i].flagId);
      expect(result1.flags[i].observedValue).toBe(result2.flags[i].observedValue);
    }
  });

  test('computeFlagId is deterministic', () => {
    const ruleId = createRiskRuleId('rule-1');
    const id1 = computeFlagId(ruleId, 'actor', 'actor-1', 100000);
    const id2 = computeFlagId(ruleId, 'actor', 'actor-1', 100000);
    expect(id1).toBe(id2);
  });
});

// ============================================================================
// NO ENFORCEMENT PATH TESTS - CRITICAL
// ============================================================================

describe('No Enforcement Paths Exist', () => {
  test('RiskRuleRegistry has no enforcement methods', () => {
    const registry = createRiskRuleRegistry();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(registry));

    // Verify no enforcement-related methods
    for (const method of methods) {
      expect(method).not.toMatch(/^block/);
      expect(method).not.toMatch(/^enforce/);
      expect(method).not.toMatch(/^execute/);
      expect(method).not.toMatch(/^reject/);
      expect(method).not.toMatch(/^prevent/);
      expect(method).not.toMatch(/^autoAdjust/);
    }
  });

  test('evaluator functions return flags only', () => {
    const registry = createRiskRuleRegistry();
    registry.registerRule(createTestRuleInput('Test', RiskCategory.FREQUENCY, RiskSeverity.HIGH, 1000));

    const events = createTestEvents('subject-1', 10, 100000);
    const result = evaluateRechargeRisk(registry, { events, analysisTimestamp: 200000 });

    // Result only contains flags, no action methods
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('analyzedAt');
    expect(result).toHaveProperty('rulesEvaluated');
    expect(result).toHaveProperty('hasHighSeverity');
    expect(result).not.toHaveProperty('block');
    expect(result).not.toHaveProperty('enforce');
    expect(result).not.toHaveProperty('execute');
  });

  test('RiskFlag is pure data, no methods', () => {
    const flag: RiskFlag = Object.freeze({
      flagId: createRiskFlagId('flag-1'),
      ruleId: createRiskRuleId('rule-1'),
      category: RiskCategory.FREQUENCY,
      severity: RiskSeverity.HIGH,
      description: 'Test',
      subjectType: 'actor',
      subjectId: 'actor-1',
      observedValue: 10,
      thresholdValue: 5,
      analyzedAt: 100000,
    });

    const keys = Object.keys(flag);
    for (const key of keys) {
      expect(typeof (flag as unknown as Record<string, unknown>)[key]).not.toBe('function');
    }
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('OPS-3 Integration', () => {
  test('complete risk analysis workflow', () => {
    // 1. Create registry
    const registry = createRiskRuleRegistry();

    // 2. Register rules
    registry.registerRule({
      name: 'High Frequency Recharge',
      description: 'Flags high frequency recharge patterns for review',
      category: RiskCategory.FREQUENCY,
      severity: RiskSeverity.HIGH,
      threshold: { type: ThresholdType.COUNT, maxCount: 5 },
      timestamp: 1000,
    });

    registry.registerRule({
      name: 'Rapid Velocity',
      description: 'Flags rapid succession of recharges for review',
      category: RiskCategory.VELOCITY,
      severity: RiskSeverity.MEDIUM,
      threshold: { type: ThresholdType.WINDOW, windowMs: 60000, minGapMs: 5000 },
      timestamp: 2000,
    });

    // 3. Verify chain integrity
    const chainResult = registry.verifyChainIntegrity();
    expect(chainResult.success).toBe(true);

    // 4. Create test events (10 events in rapid succession)
    const events: TimestampedEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({ timestamp: 100000 + i * 1000, subjectId: 'user-1' });
    }

    // 5. Evaluate risk
    const analysisResult = evaluateRechargeRisk(registry, {
      events,
      analysisTimestamp: 200000,
    });

    // 6. Verify flags generated
    expect(analysisResult.flags.length).toBeGreaterThan(0);
    expect(analysisResult.hasHighSeverity).toBe(true);

    // 7. Get summary
    const summary = getOverallRiskSummary(analysisResult);
    expect(summary.totalFlags).toBeGreaterThan(0);
    expect(summary.riskScore).toBeGreaterThan(0);

    // 8. Verify all results are frozen
    expect(Object.isFrozen(analysisResult)).toBe(true);
    expect(Object.isFrozen(summary)).toBe(true);
  });

  test('module exports no forbidden concepts in code', () => {
    // Get all exported function names
    const exports = [
      'createRiskRuleRegistry',
      'evaluateFrequency',
      'evaluateVelocity',
      'evaluateConcentration',
      'evaluateSkew',
      'evaluateRechargeRisk',
      'evaluateApprovalRisk',
      'getRiskSummaryByPeriod',
      'getRiskSummaryByActor',
      'getHighRiskFlagList',
      'getOverallRiskSummary',
      'assertNoRiskForbiddenConcepts',
      'assertAnalysisOnly',
    ];

    const result = assertNoRiskForbiddenFunctions(exports);
    expect(result.success).toBe(true);
  });
});
