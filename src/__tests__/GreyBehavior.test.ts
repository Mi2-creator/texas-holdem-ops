/**
 * GreyBehavior.test.ts
 *
 * Tests for OPS-8: Grey Incentive & Behavior Correlation Analysis
 */

import {
  // Types
  type SignalRecord,
  type CorrelationRecord,
  type CorrelationMetric,

  // Enums
  SignalKind,
  ActorType,
  ContextType,
  CorrelationMetricType,

  // ID Creators
  createSignalId,
  createActorId,
  createContextId,
  createPeriodId,

  // Validation
  isValidIntensity,
  isValidDuration,
  isValidConfidence,
  isValidSampleSize,
  isValidCorrelationMetric,

  // Registry
  GreyBehaviorSignalRegistry,

  // Analyzer
  calculateSignalSummary,
  calculateAllSignalSummaries,
  calculateActorSignalProfile,
  calculateContextSignalDistribution,
  calculatePeriodCorrelationSummary,
  calculateSignalCoOccurrence,
  calculateAllCoOccurrences,
  calculateTrendAnalysis,
  calculateCorrelationMetrics,
  calculateIntensityElasticity,

  // Views
  buildCorrelationBySignalView,
  buildAllCorrelationBySignalViews,
  buildCorrelationByActorView,
  buildCorrelationByContextView,
  buildCorrelationByPeriodView,
  buildCorrelationTraceView,
  buildCorrelationSummaryView,
  buildTopActorsView,
  buildTopContextsView,

  // Boundary Guards
  FORBIDDEN_FINANCIAL_KEYWORDS,
  FORBIDDEN_REVENUE_KEYWORDS,
  FORBIDDEN_ACTION_KEYWORDS,
  containsForbiddenFinancialKeywords,
  containsForbiddenRevenueKeywords,
  containsForbiddenActionKeywords,
  containsAnyForbiddenKeywords,
  findForbiddenKeywords,
  validateSemanticSafety,
  MODULE_BOUNDARIES,
  getModuleBoundariesText,
} from '../grey-behavior';

// ============================================================================
// TYPE TESTS
// ============================================================================

describe('GreyBehaviorSignalTypes', () => {
  describe('ID creation', () => {
    it('should create valid signal ID', () => {
      const id = createSignalId('sig_123');
      expect(id).toBe('sig_123');
    });

    it('should create valid actor ID', () => {
      const id = createActorId('actor_456');
      expect(id).toBe('actor_456');
    });

    it('should create valid context ID', () => {
      const id = createContextId('ctx_789');
      expect(id).toBe('ctx_789');
    });

    it('should create valid period ID', () => {
      const id = createPeriodId('2024-01');
      expect(id).toBe('2024-01');
    });
  });

  describe('Enums', () => {
    it('should have all SignalKind values', () => {
      expect(SignalKind.PROMOTION_EXPOSURE).toBe('PROMOTION_EXPOSURE');
      expect(SignalKind.TABLE_ASSIGNMENT).toBe('TABLE_ASSIGNMENT');
      expect(SignalKind.AGENT_INTERVENTION).toBe('AGENT_INTERVENTION');
      expect(SignalKind.UI_NUDGE).toBe('UI_NUDGE');
    });

    it('should have all ActorType values', () => {
      expect(ActorType.PLAYER).toBe('PLAYER');
      expect(ActorType.AGENT).toBe('AGENT');
      expect(ActorType.CLUB).toBe('CLUB');
      expect(ActorType.TABLE).toBe('TABLE');
      expect(ActorType.SYSTEM).toBe('SYSTEM');
    });

    it('should have all ContextType values', () => {
      expect(ContextType.SESSION).toBe('SESSION');
      expect(ContextType.HAND).toBe('HAND');
      expect(ContextType.TABLE).toBe('TABLE');
      expect(ContextType.CLUB).toBe('CLUB');
      expect(ContextType.PLATFORM).toBe('PLATFORM');
    });

    it('should have all CorrelationMetricType values', () => {
      expect(CorrelationMetricType.LIFT).toBe('LIFT');
      expect(CorrelationMetricType.DELTA).toBe('DELTA');
      expect(CorrelationMetricType.SKEW).toBe('SKEW');
      expect(CorrelationMetricType.ELASTICITY).toBe('ELASTICITY');
      expect(CorrelationMetricType.INDEX).toBe('INDEX');
    });
  });

  describe('Validation', () => {
    it('should validate intensity correctly', () => {
      expect(isValidIntensity(0)).toBe(true);
      expect(isValidIntensity(0.5)).toBe(true);
      expect(isValidIntensity(1)).toBe(true);
      expect(isValidIntensity(-0.1)).toBe(false);
      expect(isValidIntensity(1.1)).toBe(false);
      expect(isValidIntensity(NaN)).toBe(false);
    });

    it('should validate duration correctly', () => {
      expect(isValidDuration(0)).toBe(true);
      expect(isValidDuration(1000)).toBe(true);
      expect(isValidDuration(-1)).toBe(false);
      expect(isValidDuration(NaN)).toBe(false);
    });

    it('should validate confidence correctly', () => {
      expect(isValidConfidence(0)).toBe(true);
      expect(isValidConfidence(0.5)).toBe(true);
      expect(isValidConfidence(1)).toBe(true);
      expect(isValidConfidence(-0.1)).toBe(false);
      expect(isValidConfidence(1.1)).toBe(false);
    });

    it('should validate sample size correctly', () => {
      expect(isValidSampleSize(1)).toBe(true);
      expect(isValidSampleSize(100)).toBe(true);
      expect(isValidSampleSize(0)).toBe(false);
      expect(isValidSampleSize(-1)).toBe(false);
      expect(isValidSampleSize(1.5)).toBe(false);
    });

    it('should validate correlation metric correctly', () => {
      const validMetric: CorrelationMetric = {
        metricType: CorrelationMetricType.LIFT,
        value: 1.5,
        confidence: 0.8,
        sampleSize: 100,
      };
      expect(isValidCorrelationMetric(validMetric)).toBe(true);

      const invalidMetric: CorrelationMetric = {
        metricType: CorrelationMetricType.LIFT,
        value: 1.5,
        confidence: 1.5, // Invalid
        sampleSize: 100,
      };
      expect(isValidCorrelationMetric(invalidMetric)).toBe(false);
    });
  });
});

// ============================================================================
// REGISTRY TESTS
// ============================================================================

describe('GreyBehaviorSignalRegistry', () => {
  let registry: GreyBehaviorSignalRegistry;

  beforeEach(() => {
    registry = new GreyBehaviorSignalRegistry();
  });

  describe('Signal recording', () => {
    it('should record a valid signal', () => {
      const result = registry.recordSignal({
        kind: SignalKind.PROMOTION_EXPOSURE,
        actorId: createActorId('player_1'),
        actorType: ActorType.PLAYER,
        contextId: createContextId('session_1'),
        contextType: ContextType.SESSION,
        periodId: createPeriodId('2024-01'),
        intensity: 0.75,
        durationMs: 5000,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(SignalKind.PROMOTION_EXPOSURE);
        expect(result.value.intensity).toBe(0.75);
        expect(result.value.sequenceNumber).toBe(1);
      }
    });

    it('should reject invalid intensity', () => {
      const result = registry.recordSignal({
        kind: SignalKind.PROMOTION_EXPOSURE,
        actorId: createActorId('player_1'),
        actorType: ActorType.PLAYER,
        contextId: createContextId('session_1'),
        contextType: ContextType.SESSION,
        periodId: createPeriodId('2024-01'),
        intensity: 1.5, // Invalid
        durationMs: 5000,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Invalid intensity');
      }
    });

    it('should maintain hash chain integrity', () => {
      // Record multiple signals
      for (let i = 0; i < 5; i++) {
        registry.recordSignal({
          kind: SignalKind.TABLE_ASSIGNMENT,
          actorId: createActorId(`player_${i}`),
          actorType: ActorType.PLAYER,
          contextId: createContextId('session_1'),
          contextType: ContextType.SESSION,
          periodId: createPeriodId('2024-01'),
          intensity: 0.5,
          durationMs: 1000,
        });
      }

      const integrityResult = registry.verifySignalChainIntegrity();
      expect(integrityResult.ok).toBe(true);
      if (integrityResult.ok) {
        expect(integrityResult.value).toBe(true);
      }
    });

    it('should get signals by actor', () => {
      const actorId = createActorId('player_test');

      registry.recordSignal({
        kind: SignalKind.PROMOTION_EXPOSURE,
        actorId,
        actorType: ActorType.PLAYER,
        contextId: createContextId('session_1'),
        contextType: ContextType.SESSION,
        periodId: createPeriodId('2024-01'),
        intensity: 0.5,
        durationMs: 1000,
      });

      registry.recordSignal({
        kind: SignalKind.UI_NUDGE,
        actorId,
        actorType: ActorType.PLAYER,
        contextId: createContextId('session_2'),
        contextType: ContextType.SESSION,
        periodId: createPeriodId('2024-01'),
        intensity: 0.8,
        durationMs: 2000,
      });

      const signals = registry.getSignalsByActor(actorId);
      expect(signals.length).toBe(2);
    });

    it('should get signals by kind', () => {
      registry.recordSignal({
        kind: SignalKind.AGENT_INTERVENTION,
        actorId: createActorId('player_1'),
        actorType: ActorType.PLAYER,
        contextId: createContextId('session_1'),
        contextType: ContextType.SESSION,
        periodId: createPeriodId('2024-01'),
        intensity: 0.6,
        durationMs: 3000,
      });

      const signals = registry.getSignalsByKind(SignalKind.AGENT_INTERVENTION);
      expect(signals.length).toBe(1);
      expect(signals[0].kind).toBe(SignalKind.AGENT_INTERVENTION);
    });
  });

  describe('Correlation recording', () => {
    it('should record a valid correlation', () => {
      const result = registry.recordCorrelation({
        signalKind: SignalKind.PROMOTION_EXPOSURE,
        actorId: null,
        contextId: null,
        periodId: createPeriodId('2024-01'),
        metrics: [
          {
            metricType: CorrelationMetricType.LIFT,
            value: 1.5,
            confidence: 0.85,
            sampleSize: 100,
          },
        ],
        observationCount: 100,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.signalKind).toBe(SignalKind.PROMOTION_EXPOSURE);
        expect(result.value.metrics.length).toBe(1);
      }
    });

    it('should reject invalid observation count', () => {
      const result = registry.recordCorrelation({
        signalKind: SignalKind.PROMOTION_EXPOSURE,
        actorId: null,
        contextId: null,
        periodId: createPeriodId('2024-01'),
        metrics: [],
        observationCount: 0, // Invalid
      });

      expect(result.ok).toBe(false);
    });

    it('should maintain correlation chain integrity', () => {
      for (let i = 0; i < 3; i++) {
        registry.recordCorrelation({
          signalKind: SignalKind.UI_NUDGE,
          actorId: null,
          contextId: null,
          periodId: createPeriodId(`2024-0${i + 1}`),
          metrics: [
            {
              metricType: CorrelationMetricType.INDEX,
              value: 0.7,
              confidence: 0.9,
              sampleSize: 50,
            },
          ],
          observationCount: 50,
        });
      }

      const integrityResult = registry.verifyCorrelationChainIntegrity();
      expect(integrityResult.ok).toBe(true);
    });
  });
});

// ============================================================================
// ANALYZER TESTS
// ============================================================================

describe('GreyCorrelationAnalyzer', () => {
  const createTestSignals = (): SignalRecord[] => {
    const signals: SignalRecord[] = [];
    const baseTimestamp = Date.now();

    // Create diverse test signals
    for (let i = 0; i < 20; i++) {
      signals.push({
        signalId: createSignalId(`sig_${i}`),
        kind: Object.values(SignalKind)[i % 4] as SignalKind,
        actorId: createActorId(`actor_${i % 5}`),
        actorType: ActorType.PLAYER,
        contextId: createContextId(`ctx_${i % 3}`),
        contextType: ContextType.SESSION,
        periodId: createPeriodId('2024-01'),
        timestamp: baseTimestamp + i * 3600000,
        intensity: 0.3 + (i % 10) * 0.07,
        durationMs: 1000 + i * 500,
        previousHash: 'prev_hash' as any,
        recordHash: `hash_${i}` as any,
        sequenceNumber: i + 1,
      });
    }

    return signals;
  };

  describe('Signal Summary', () => {
    it('should calculate signal summary', () => {
      const signals = createTestSignals();
      const summary = calculateSignalSummary(signals, SignalKind.PROMOTION_EXPOSURE);

      expect(summary.kind).toBe(SignalKind.PROMOTION_EXPOSURE);
      expect(summary.count).toBeGreaterThan(0);
      expect(summary.averageIntensity).toBeGreaterThanOrEqual(0);
      expect(summary.averageIntensity).toBeLessThanOrEqual(1);
    });

    it('should calculate all signal summaries', () => {
      const signals = createTestSignals();
      const summaries = calculateAllSignalSummaries(signals);

      expect(summaries.length).toBe(Object.values(SignalKind).length);
    });

    it('should handle empty signals', () => {
      const summary = calculateSignalSummary([], SignalKind.PROMOTION_EXPOSURE);

      expect(summary.count).toBe(0);
      expect(summary.totalDurationMs).toBe(0);
      expect(summary.averageIntensity).toBe(0);
    });
  });

  describe('Actor Profile', () => {
    it('should calculate actor signal profile', () => {
      const signals = createTestSignals();
      const actorId = createActorId('actor_0');
      const profile = calculateActorSignalProfile(signals, actorId);

      expect(profile.actorId).toBe(actorId);
      expect(profile.observationCount).toBeGreaterThan(0);
      expect(profile.signalsByKind).toBeDefined();
    });

    it('should identify dominant signal kind', () => {
      const signals = createTestSignals();
      const profile = calculateActorSignalProfile(signals, createActorId('actor_0'));

      // Dominant kind should be one of the SignalKind values or null
      if (profile.dominantSignalKind) {
        expect(Object.values(SignalKind)).toContain(profile.dominantSignalKind);
      }
    });
  });

  describe('Context Distribution', () => {
    it('should calculate context signal distribution', () => {
      const signals = createTestSignals();
      const distribution = calculateContextSignalDistribution(
        signals,
        createContextId('ctx_0')
      );

      expect(distribution.totalObservations).toBeGreaterThan(0);
      expect(distribution.concentrationIndex).toBeGreaterThanOrEqual(0);
      expect(distribution.concentrationIndex).toBeLessThanOrEqual(1);
    });
  });

  describe('Period Summary', () => {
    it('should calculate period correlation summary', () => {
      const signals = createTestSignals();
      const summary = calculatePeriodCorrelationSummary(
        signals,
        createPeriodId('2024-01')
      );

      expect(summary.periodId).toBe('2024-01');
      expect(summary.totalObservations).toBe(signals.length);
      expect(summary.actorCount).toBeGreaterThan(0);
      expect(summary.contextCount).toBeGreaterThan(0);
    });
  });

  describe('Co-occurrence', () => {
    it('should calculate signal co-occurrence', () => {
      const signals = createTestSignals();
      const coOccurrence = calculateSignalCoOccurrence(
        signals,
        SignalKind.PROMOTION_EXPOSURE,
        SignalKind.UI_NUDGE
      );

      expect(coOccurrence.kindA).toBe(SignalKind.PROMOTION_EXPOSURE);
      expect(coOccurrence.kindB).toBe(SignalKind.UI_NUDGE);
      expect(typeof coOccurrence.lift).toBe('number');
      expect(typeof coOccurrence.confidence).toBe('number');
    });

    it('should calculate all co-occurrences', () => {
      const signals = createTestSignals();
      const coOccurrences = calculateAllCoOccurrences(signals);

      // Should have n*(n-1)/2 pairs for 4 signal kinds = 6 pairs
      expect(coOccurrences.length).toBe(6);
    });
  });

  describe('Trend Analysis', () => {
    it('should calculate trend analysis', () => {
      const signals = createTestSignals();
      const trend = calculateTrendAnalysis(
        signals,
        'actor_0',
        SignalKind.PROMOTION_EXPOSURE
      );

      expect(trend.entityId).toBe('actor_0');
      expect(trend.kind).toBe(SignalKind.PROMOTION_EXPOSURE);
      expect([-1, 0, 1]).toContain(trend.direction);
    });

    it('should handle insufficient data', () => {
      const trend = calculateTrendAnalysis(
        [],
        'actor_0',
        SignalKind.PROMOTION_EXPOSURE
      );

      expect(trend.direction).toBe(0);
      expect(trend.slope).toBe(0);
      expect(trend.rSquared).toBe(0);
    });
  });

  describe('Correlation Metrics', () => {
    it('should calculate correlation metrics', () => {
      const signals = createTestSignals();
      const metrics = calculateCorrelationMetrics(signals, SignalKind.PROMOTION_EXPOSURE);

      expect(metrics.length).toBeGreaterThan(0);

      for (const metric of metrics) {
        expect(Object.values(CorrelationMetricType)).toContain(metric.metricType);
        expect(typeof metric.value).toBe('number');
        expect(metric.confidence).toBeGreaterThanOrEqual(0);
        expect(metric.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should calculate intensity elasticity', () => {
      const signals = createTestSignals();
      const elasticity = calculateIntensityElasticity(signals, SignalKind.TABLE_ASSIGNMENT);

      expect(elasticity.metricType).toBe(CorrelationMetricType.ELASTICITY);
      expect(typeof elasticity.value).toBe('number');
    });
  });
});

// ============================================================================
// VIEW TESTS
// ============================================================================

describe('GreyBehaviorCorrelationViews', () => {
  const createTestSignals = (): SignalRecord[] => {
    const signals: SignalRecord[] = [];
    const baseTimestamp = Date.now();

    for (let i = 0; i < 15; i++) {
      signals.push({
        signalId: createSignalId(`sig_${i}`),
        kind: Object.values(SignalKind)[i % 4] as SignalKind,
        actorId: createActorId(`actor_${i % 4}`),
        actorType: ActorType.PLAYER,
        contextId: createContextId(`ctx_${i % 3}`),
        contextType: ContextType.SESSION,
        periodId: createPeriodId('2024-01'),
        timestamp: baseTimestamp + i * 3600000,
        intensity: 0.4 + (i % 5) * 0.1,
        durationMs: 2000 + i * 300,
        previousHash: 'prev' as any,
        recordHash: `hash_${i}` as any,
        sequenceNumber: i + 1,
      });
    }

    return signals;
  };

  describe('Signal Views', () => {
    it('should build correlation by signal view', () => {
      const signals = createTestSignals();
      const view = buildCorrelationBySignalView(signals, SignalKind.PROMOTION_EXPOSURE);

      expect(view.kind).toBe(SignalKind.PROMOTION_EXPOSURE);
      expect(view.signalCount).toBeGreaterThanOrEqual(0);
      expect(view.metrics).toBeDefined();
    });

    it('should build all correlation by signal views', () => {
      const signals = createTestSignals();
      const views = buildAllCorrelationBySignalViews(signals);

      expect(views.length).toBe(Object.values(SignalKind).length);
    });
  });

  describe('Actor Views', () => {
    it('should build correlation by actor view', () => {
      const signals = createTestSignals();
      const view = buildCorrelationByActorView(signals, createActorId('actor_0'));

      expect(view.actorId).toBe('actor_0');
      expect(view.profile).toBeDefined();
      expect(view.metricsByKind).toBeDefined();
      expect(view.trendsByKind).toBeDefined();
    });
  });

  describe('Context Views', () => {
    it('should build correlation by context view', () => {
      const signals = createTestSignals();
      const view = buildCorrelationByContextView(signals, createContextId('ctx_0'));

      expect(view.contextId).toBe('ctx_0');
      expect(view.distribution).toBeDefined();
      expect(view.topSignalKinds).toBeDefined();
      expect(view.actorDiversity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Period Views', () => {
    it('should build correlation by period view', () => {
      const signals = createTestSignals();
      const view = buildCorrelationByPeriodView(signals, createPeriodId('2024-01'));

      expect(view.periodId).toBe('2024-01');
      expect(view.summary).toBeDefined();
      expect(view.signalTrends).toBeDefined();
      expect(view.activeActors.length).toBeGreaterThan(0);
    });
  });

  describe('Trace Views', () => {
    it('should build correlation trace view for actor', () => {
      const signals = createTestSignals();
      const trace = buildCorrelationTraceView(signals, 'actor_0', 'actor');

      expect(trace.entityId).toBe('actor_0');
      expect(trace.entityType).toBe('actor');
      expect(trace.observations.length).toBeGreaterThan(0);
      expect(trace.trendSummary).toBeDefined();
    });

    it('should build correlation trace view for context', () => {
      const signals = createTestSignals();
      const trace = buildCorrelationTraceView(signals, 'ctx_0', 'context');

      expect(trace.entityId).toBe('ctx_0');
      expect(trace.entityType).toBe('context');
    });
  });

  describe('Summary Views', () => {
    it('should build correlation summary view', () => {
      const signals = createTestSignals();
      const correlations: CorrelationRecord[] = [];
      const summary = buildCorrelationSummaryView(signals, correlations);

      expect(summary.totalSignals).toBe(signals.length);
      expect(summary.totalCorrelations).toBe(0);
      expect(summary.uniqueActors).toBeGreaterThan(0);
      expect(summary.uniqueContexts).toBeGreaterThan(0);
    });
  });

  describe('Top Views', () => {
    it('should build top actors view', () => {
      const signals = createTestSignals();
      const topActors = buildTopActorsView(signals, 5);

      expect(topActors.length).toBeLessThanOrEqual(5);
      if (topActors.length > 1) {
        expect(topActors[0].signalCount).toBeGreaterThanOrEqual(topActors[1].signalCount);
      }
    });

    it('should build top contexts view', () => {
      const signals = createTestSignals();
      const topContexts = buildTopContextsView(signals, 5);

      expect(topContexts.length).toBeLessThanOrEqual(5);
    });
  });
});

// ============================================================================
// BOUNDARY GUARD TESTS
// ============================================================================

describe('GreyBehaviorBoundaryGuards', () => {
  describe('Forbidden Keywords', () => {
    it('should have financial keywords defined', () => {
      expect(FORBIDDEN_FINANCIAL_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_FINANCIAL_KEYWORDS).toContain('money');
      expect(FORBIDDEN_FINANCIAL_KEYWORDS).toContain('wallet');
    });

    it('should have revenue keywords defined', () => {
      expect(FORBIDDEN_REVENUE_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_REVENUE_KEYWORDS).toContain('revenue');
      expect(FORBIDDEN_REVENUE_KEYWORDS).toContain('profit');
    });

    it('should have action keywords defined', () => {
      expect(FORBIDDEN_ACTION_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_ACTION_KEYWORDS).toContain('trigger');
      expect(FORBIDDEN_ACTION_KEYWORDS).toContain('execute');
    });
  });

  describe('Keyword Detection', () => {
    it('should detect financial keywords', () => {
      expect(containsForbiddenFinancialKeywords('process payment')).toBe(true);
      expect(containsForbiddenFinancialKeywords('signal observation')).toBe(false);
    });

    it('should detect revenue keywords', () => {
      expect(containsForbiddenRevenueKeywords('calculate revenue')).toBe(true);
      expect(containsForbiddenRevenueKeywords('calculate correlation')).toBe(false);
    });

    it('should detect action keywords', () => {
      expect(containsForbiddenActionKeywords('trigger action')).toBe(true);
      expect(containsForbiddenActionKeywords('observe pattern')).toBe(false);
    });

    it('should detect any forbidden keywords', () => {
      expect(containsAnyForbiddenKeywords('payment processor')).toBe(true);
      expect(containsAnyForbiddenKeywords('correlation analysis')).toBe(false);
    });

    it('should find all forbidden keywords', () => {
      const found = findForbiddenKeywords('process payment and calculate revenue');
      expect(found).toContain('payment');
      expect(found).toContain('revenue');
    });
  });

  describe('Semantic Safety', () => {
    it('should validate safe text', () => {
      const result = validateSemanticSafety('signal correlation analysis');
      expect(result.isValid).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should reject unsafe text', () => {
      const result = validateSemanticSafety('trigger payment processing');
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Module Boundaries', () => {
    it('should have MUST constraints defined', () => {
      expect(MODULE_BOUNDARIES.MUST.length).toBeGreaterThan(0);
    });

    it('should have CANNOT constraints defined', () => {
      expect(MODULE_BOUNDARIES.CANNOT.length).toBeGreaterThan(0);
    });

    it('should have SEMANTICS defined', () => {
      expect(MODULE_BOUNDARIES.SEMANTICS.SIGNAL).toBeDefined();
      expect(MODULE_BOUNDARIES.SEMANTICS.CORRELATION).toBeDefined();
      expect(MODULE_BOUNDARIES.SEMANTICS.BEHAVIOR).toBeDefined();
    });

    it('should generate readable boundaries text', () => {
      const text = getModuleBoundariesText();
      expect(text).toContain('GREY BEHAVIOR SIGNAL MODULE BOUNDARIES');
      expect(text).toContain('THIS MODULE MUST:');
      expect(text).toContain('THIS MODULE CANNOT:');
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('OPS-8 Integration', () => {
  it('should support full signal recording and analysis workflow', () => {
    const registry = new GreyBehaviorSignalRegistry();

    // Record signals
    for (let i = 0; i < 10; i++) {
      const result = registry.recordSignal({
        kind: Object.values(SignalKind)[i % 4] as SignalKind,
        actorId: createActorId(`player_${i % 3}`),
        actorType: ActorType.PLAYER,
        contextId: createContextId(`session_${i % 2}`),
        contextType: ContextType.SESSION,
        periodId: createPeriodId('2024-01'),
        intensity: 0.5 + (i % 5) * 0.1,
        durationMs: 3000 + i * 500,
      });
      expect(result.ok).toBe(true);
    }

    // Verify chain integrity
    const integrity = registry.verifySignalChainIntegrity();
    expect(integrity.ok).toBe(true);

    // Build views
    const signals = registry.getAllSignals();
    const views = buildAllCorrelationBySignalViews(signals);
    expect(views.length).toBe(4);

    // Analyze correlations
    const metrics = calculateCorrelationMetrics(signals, SignalKind.PROMOTION_EXPOSURE);
    expect(metrics.length).toBeGreaterThan(0);

    // Get top actors
    const topActors = buildTopActorsView(signals, 5);
    expect(topActors.length).toBeGreaterThan(0);
  });

  it('should maintain immutability', () => {
    const registry = new GreyBehaviorSignalRegistry();

    registry.recordSignal({
      kind: SignalKind.UI_NUDGE,
      actorId: createActorId('test_actor'),
      actorType: ActorType.PLAYER,
      contextId: createContextId('test_context'),
      contextType: ContextType.SESSION,
      periodId: createPeriodId('2024-01'),
      intensity: 0.8,
      durationMs: 5000,
    });

    const signals = registry.getAllSignals();

    // Attempt to modify should fail
    expect(() => {
      (signals as any).push({});
    }).toThrow();

    // Signal itself should be frozen
    expect(() => {
      (signals[0] as any).intensity = 0.9;
    }).toThrow();
  });

  it('should calculate meaningful correlations', () => {
    const registry = new GreyBehaviorSignalRegistry();

    // Create signals with distinct patterns
    for (let i = 0; i < 50; i++) {
      registry.recordSignal({
        kind: i < 30 ? SignalKind.PROMOTION_EXPOSURE : SignalKind.UI_NUDGE,
        actorId: createActorId(`player_${i % 10}`),
        actorType: ActorType.PLAYER,
        contextId: createContextId(`session_${i % 5}`),
        contextType: ContextType.SESSION,
        periodId: createPeriodId('2024-01'),
        intensity: i < 30 ? 0.8 : 0.4,
        durationMs: 2000,
      });
    }

    const signals = registry.getAllSignals();

    // PROMOTION_EXPOSURE should have higher lift (more common)
    const promoMetrics = calculateCorrelationMetrics(signals, SignalKind.PROMOTION_EXPOSURE);
    const nudgeMetrics = calculateCorrelationMetrics(signals, SignalKind.UI_NUDGE);

    const promoLift = promoMetrics.find(m => m.metricType === CorrelationMetricType.LIFT);
    const nudgeLift = nudgeMetrics.find(m => m.metricType === CorrelationMetricType.LIFT);

    expect(promoLift).toBeDefined();
    expect(nudgeLift).toBeDefined();
    expect(promoLift!.value).toBeGreaterThan(nudgeLift!.value);
  });
});
