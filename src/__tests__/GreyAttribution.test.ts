/**
 * GreyAttribution.test.ts
 *
 * Tests for OPS-7: Grey Revenue Attribution & Exposure Analysis
 *
 * Tests verify:
 * - Append-only, hash-chained registry behavior
 * - Immutable record creation
 * - Reference-based linking (no validation)
 * - Read-only exposure calculations
 * - Read-only views
 * - Boundary guard validation
 * - NO financial concepts (money, balance, etc.)
 * - NO revenue concepts (use EXPOSURE instead)
 * - NO execution, push, or blocking behavior
 * - Exposure-only semantics (NOT revenue)
 */

// Attribution Types
import {
  createAttributionId,
  createSourceId,
  createTargetId,
  createPeriodId,
  createAttributionOperatorId,
  AttributionKind,
  ExposureMetricType,
  AttributionEntityType,
  AttributionErrorCode,
  ATTRIBUTION_GENESIS_HASH,
  computeAttributionHash,
  computeAttributionId,
  isValidExposureMetric,
  isValidAttributionInput,
  type AttributionInput,
  type ExposureMetric,
} from '../grey-attribution/GreyAttributionTypes';

// Attribution Registry
import {
  GreyAttributionRegistry,
  createTestAttributionRegistry,
} from '../grey-attribution/GreyAttributionRegistry';

// Exposure Calculator
import {
  calculateExposureSummary,
  calculateAllExposureSummaries,
  calculateExposureDistribution,
  calculateExposureTrend,
  calculateExposureFromFlows,
  calculateWeightedExposure,
  compareExposure,
  type FlowExposureInput,
} from '../grey-attribution/GreyExposureCalculator';

// Attribution Linking
import {
  AttributionLinkTargetType,
  GreyAttributionLinker,
  createTestAttributionLinker,
  isValidAttributionLinkInput,
} from '../grey-attribution/GreyAttributionLinking';

// Exposure Views
import {
  getExposureByAgent,
  getAllAgentExposures,
  getExposureByClub,
  getExposureByPeriod,
  getExposureTrace,
  getAllExposureTraces,
  getOverallExposureSummary,
  getHighExposureAttributions,
  getAttributionsByKind,
} from '../grey-attribution/GreyExposureViews';

// Boundary Guards
import {
  ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_EXECUTION_KEYWORDS,
  ATTRIBUTION_FORBIDDEN_PUSH_KEYWORDS,
  checkForAttributionFinancialKeywords,
  checkForAttributionRevenueKeywords,
  checkForAttributionExecutionKeywords,
  checkForAttributionPushKeywords,
  checkAllAttributionBoundaries,
  assertNoAttributionFinancialKeywords,
  assertNoAttributionRevenueKeywords,
  assertIsExposureMetric,
  assertIsShareValue,
  ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS,
} from '../grey-attribution/GreyAttributionBoundaryGuards';

// ============================================================================
// TEST DATA HELPERS
// ============================================================================

const baseTimestamp = 1700000000000;

function createTestInput(overrides: Partial<AttributionInput> = {}): AttributionInput {
  return {
    sourceId: createSourceId('source-001'),
    targetId: createTargetId('agent-001'),
    sourceType: AttributionEntityType.TABLE,
    targetType: AttributionEntityType.AGENT,
    kind: AttributionKind.DIRECT,
    exposureMetrics: [
      { metricType: ExposureMetricType.SHARE, value: 0.15 },
      { metricType: ExposureMetricType.RATIO, value: 0.25 },
    ],
    evidenceRefs: ['flow-001', 'flow-002'],
    periodId: createPeriodId('2024-01'),
    timestamp: baseTimestamp,
    operatorId: createAttributionOperatorId('operator-001'),
    notes: 'Test attribution',
    ...overrides,
  };
}

// ============================================================================
// ATTRIBUTION TYPES TESTS
// ============================================================================

describe('GreyAttributionTypes', () => {
  describe('ID Factories', () => {
    it('should create valid attribution ID', () => {
      const id = createAttributionId('attr-001');
      expect(id).toBe('attr-001');
    });

    it('should throw for empty attribution ID', () => {
      expect(() => createAttributionId('')).toThrow();
      expect(() => createAttributionId('   ')).toThrow();
    });

    it('should create valid source ID', () => {
      const id = createSourceId('source-001');
      expect(id).toBe('source-001');
    });

    it('should create valid target ID', () => {
      const id = createTargetId('target-001');
      expect(id).toBe('target-001');
    });

    it('should create valid period ID', () => {
      const id = createPeriodId('2024-01');
      expect(id).toBe('2024-01');
    });

    it('should create valid operator ID', () => {
      const id = createAttributionOperatorId('operator-001');
      expect(id).toBe('operator-001');
    });
  });

  describe('Hash Utilities', () => {
    it('should compute deterministic hash', () => {
      const hash1 = computeAttributionHash('test-data');
      const hash2 = computeAttributionHash('test-data');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', () => {
      const hash1 = computeAttributionHash('data-1');
      const hash2 = computeAttributionHash('data-2');
      expect(hash1).not.toBe(hash2);
    });

    it('should compute attribution ID deterministically', () => {
      const input = createTestInput();
      const id1 = computeAttributionId(input);
      const id2 = computeAttributionId(input);
      expect(id1).toBe(id2);
    });

    it('should have 64-character genesis hash', () => {
      expect(ATTRIBUTION_GENESIS_HASH).toHaveLength(64);
    });
  });

  describe('Validation', () => {
    it('should validate correct exposure metric', () => {
      const metric: ExposureMetric = {
        metricType: ExposureMetricType.SHARE,
        value: 0.5,
      };
      expect(isValidExposureMetric(metric)).toBe(true);
    });

    it('should reject exposure metric with negative value', () => {
      const metric: ExposureMetric = {
        metricType: ExposureMetricType.SHARE,
        value: -0.1,
      };
      expect(isValidExposureMetric(metric)).toBe(false);
    });

    it('should reject SHARE metric above 1.0', () => {
      const metric: ExposureMetric = {
        metricType: ExposureMetricType.SHARE,
        value: 1.5,
      };
      expect(isValidExposureMetric(metric)).toBe(false);
    });

    it('should validate correct attribution input', () => {
      const input = createTestInput();
      expect(isValidAttributionInput(input)).toBe(true);
    });

    it('should reject attribution input with invalid timestamp', () => {
      const input = createTestInput({ timestamp: 0 });
      expect(isValidAttributionInput(input)).toBe(false);
    });
  });

  describe('Enums', () => {
    it('should have AttributionKind values', () => {
      expect(AttributionKind.DIRECT).toBe('DIRECT');
      expect(AttributionKind.INDIRECT).toBe('INDIRECT');
      expect(AttributionKind.DERIVED).toBe('DERIVED');
    });

    it('should have ExposureMetricType values', () => {
      expect(ExposureMetricType.SHARE).toBe('SHARE');
      expect(ExposureMetricType.RATIO).toBe('RATIO');
      expect(ExposureMetricType.WEIGHT).toBe('WEIGHT');
      expect(ExposureMetricType.INDEX).toBe('INDEX');
    });

    it('should have AttributionEntityType values', () => {
      expect(AttributionEntityType.AGENT).toBe('AGENT');
      expect(AttributionEntityType.CLUB).toBe('CLUB');
      expect(AttributionEntityType.TABLE).toBe('TABLE');
      expect(AttributionEntityType.PLAYER).toBe('PLAYER');
    });
  });
});

// ============================================================================
// ATTRIBUTION REGISTRY TESTS
// ============================================================================

describe('GreyAttributionRegistry', () => {
  let registry: GreyAttributionRegistry;

  beforeEach(() => {
    registry = createTestAttributionRegistry();
  });

  describe('Record Creation', () => {
    it('should record attribution successfully', () => {
      const input = createTestInput();
      const result = registry.recordAttribution(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.sourceId).toBe(input.sourceId);
        expect(result.value.targetId).toBe(input.targetId);
        expect(result.value.kind).toBe(AttributionKind.DIRECT);
      }
    });

    it('should create frozen records', () => {
      const input = createTestInput();
      const result = registry.recordAttribution(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.isFrozen(result.value)).toBe(true);
        expect(Object.isFrozen(result.value.exposureMetrics)).toBe(true);
      }
    });

    it('should reject duplicate attributions', () => {
      const input = createTestInput();
      registry.recordAttribution(input);
      const result = registry.recordAttribution(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AttributionErrorCode.DUPLICATE_RECORD);
      }
    });

    it('should reject invalid input', () => {
      const input = createTestInput({ timestamp: 0 });
      const result = registry.recordAttribution(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AttributionErrorCode.INVALID_INPUT);
      }
    });
  });

  describe('Hash Chain', () => {
    it('should link records in hash chain', () => {
      const input1 = createTestInput({ timestamp: baseTimestamp });
      const input2 = createTestInput({
        targetId: createTargetId('agent-002'),
        timestamp: baseTimestamp + 1000,
      });

      const result1 = registry.recordAttribution(input1);
      const result2 = registry.recordAttribution(input2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        expect(result2.value.previousHash).toBe(result1.value.recordHash);
      }
    });

    it('should verify chain integrity', () => {
      registry.recordAttribution(createTestInput({ timestamp: baseTimestamp }));
      registry.recordAttribution(createTestInput({
        targetId: createTargetId('agent-002'),
        timestamp: baseTimestamp + 1000,
      }));

      const result = registry.verifyChainIntegrity();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe('Querying', () => {
    beforeEach(() => {
      registry.recordAttribution(createTestInput({
        targetId: createTargetId('agent-001'),
        timestamp: baseTimestamp,
      }));
      registry.recordAttribution(createTestInput({
        targetId: createTargetId('agent-002'),
        timestamp: baseTimestamp + 1000,
      }));
      registry.recordAttribution(createTestInput({
        targetId: createTargetId('agent-001'),
        kind: AttributionKind.INDIRECT,
        timestamp: baseTimestamp + 2000,
      }));
    });

    it('should get record by ID', () => {
      const records = registry.getAllRecords();
      const record = registry.getRecord(records[0].attributionId);
      expect(record).toBeDefined();
      expect(record?.sequenceNumber).toBe(1);
    });

    it('should get records by target', () => {
      const records = registry.getRecordsByTarget(createTargetId('agent-001'));
      expect(records).toHaveLength(2);
    });

    it('should get records by kind', () => {
      const records = registry.getRecordsByKind(AttributionKind.INDIRECT);
      expect(records).toHaveLength(1);
    });

    it('should filter by time range', () => {
      const records = registry.getRecords({
        startTime: baseTimestamp + 500,
        endTime: baseTimestamp + 1500,
      });
      expect(records).toHaveLength(1);
    });

    it('should support pagination', () => {
      const records = registry.getRecords({ offset: 1, limit: 1 });
      expect(records).toHaveLength(1);
      expect(records[0].sequenceNumber).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should return total exposure for target', () => {
      registry.recordAttribution(createTestInput({
        targetId: createTargetId('agent-001'),
        exposureMetrics: [
          { metricType: ExposureMetricType.SHARE, value: 0.1 },
        ],
        timestamp: baseTimestamp,
      }));
      registry.recordAttribution(createTestInput({
        targetId: createTargetId('agent-001'),
        exposureMetrics: [
          { metricType: ExposureMetricType.SHARE, value: 0.2 },
        ],
        timestamp: baseTimestamp + 1000,
      }));

      const totals = registry.getTotalExposureForTarget(createTargetId('agent-001'));
      const shareTot = totals.find(t => t.metricType === 'SHARE');
      expect(shareTot?.totalValue).toBeCloseTo(0.3);
    });

    it('should return registry state snapshot', () => {
      registry.recordAttribution(createTestInput());
      const state = registry.getState();

      expect(Object.isFrozen(state)).toBe(true);
      expect(state.recordCount).toBe(1);
      expect(state.chainValid).toBe(true);
    });
  });
});

// ============================================================================
// EXPOSURE CALCULATOR TESTS
// ============================================================================

describe('GreyExposureCalculator', () => {
  let registry: GreyAttributionRegistry;

  beforeEach(() => {
    registry = createTestAttributionRegistry();
    // Add test data
    registry.recordAttribution(createTestInput({
      targetId: createTargetId('agent-001'),
      kind: AttributionKind.DIRECT,
      exposureMetrics: [
        { metricType: ExposureMetricType.SHARE, value: 0.2 },
        { metricType: ExposureMetricType.RATIO, value: 0.3 },
      ],
      timestamp: baseTimestamp,
    }));
    registry.recordAttribution(createTestInput({
      targetId: createTargetId('agent-001'),
      kind: AttributionKind.INDIRECT,
      exposureMetrics: [
        { metricType: ExposureMetricType.SHARE, value: 0.1 },
      ],
      timestamp: baseTimestamp + 1000,
    }));
    registry.recordAttribution(createTestInput({
      targetId: createTargetId('agent-002'),
      kind: AttributionKind.DIRECT,
      exposureMetrics: [
        { metricType: ExposureMetricType.SHARE, value: 0.3 },
      ],
      timestamp: baseTimestamp + 2000,
    }));
  });

  describe('Exposure Summary', () => {
    it('should calculate exposure summary for target', () => {
      const summary = calculateExposureSummary(
        registry.getAllRecords(),
        createTargetId('agent-001')
      );

      expect(summary.entityId).toBe('agent-001');
      expect(summary.totalShare).toBeCloseTo(0.3);
      expect(summary.totalRatio).toBeCloseTo(0.3);
      expect(summary.attributionCount).toBe(2);
      expect(summary.directCount).toBe(1);
      expect(summary.indirectCount).toBe(1);
    });

    it('should return frozen exposure summary', () => {
      const summary = calculateExposureSummary(
        registry.getAllRecords(),
        createTargetId('agent-001')
      );
      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe('All Exposure Summaries', () => {
    it('should calculate summaries for all targets', () => {
      const summaries = calculateAllExposureSummaries(registry.getAllRecords());
      expect(summaries).toHaveLength(2);
    });
  });

  describe('Exposure Distribution', () => {
    it('should calculate distribution for period', () => {
      const distribution = calculateExposureDistribution(
        registry.getAllRecords(),
        createPeriodId('2024-01')
      );

      expect(distribution.periodId).toBe('2024-01');
      expect(distribution.totalRecords).toBe(3);
      expect(distribution.topTargets.length).toBeGreaterThan(0);
    });
  });

  describe('Exposure Trend', () => {
    it('should calculate exposure trend', () => {
      const trend = calculateExposureTrend(
        registry.getAllRecords(),
        'agent-001',
        1000
      );

      expect(trend.entityId).toBe('agent-001');
      expect(trend.dataPoints.length).toBeGreaterThan(0);
      expect(Object.isFrozen(trend)).toBe(true);
    });
  });

  describe('Flow Exposure', () => {
    it('should calculate exposure from flows', () => {
      const flows: FlowExposureInput[] = [
        { flowId: 'f1', entityId: 'e1', entityType: AttributionEntityType.AGENT, unitCount: 100, timestamp: baseTimestamp },
        { flowId: 'f2', entityId: 'e2', entityType: AttributionEntityType.AGENT, unitCount: 200, timestamp: baseTimestamp },
        { flowId: 'f3', entityId: 'e1', entityType: AttributionEntityType.AGENT, unitCount: 100, timestamp: baseTimestamp },
      ];

      const result = calculateExposureFromFlows(flows);
      expect(result).toHaveLength(2);

      const e1 = result.find(r => r.entityId === 'e1');
      expect(e1?.exposureShare).toBeCloseTo(0.5);

      const e2 = result.find(r => r.entityId === 'e2');
      expect(e2?.exposureShare).toBeCloseTo(0.5);
    });
  });

  describe('Weighted Exposure', () => {
    it('should calculate weighted exposure', () => {
      const metrics: ExposureMetric[] = [
        { metricType: ExposureMetricType.SHARE, value: 0.4 },
        { metricType: ExposureMetricType.RATIO, value: 0.2 },
      ];

      const weighted = calculateWeightedExposure(metrics);
      expect(weighted).toBeGreaterThan(0);
    });
  });

  describe('Compare Exposure', () => {
    it('should compare exposure between entities', () => {
      const summaryA = calculateExposureSummary(
        registry.getAllRecords(),
        createTargetId('agent-001')
      );
      const summaryB = calculateExposureSummary(
        registry.getAllRecords(),
        createTargetId('agent-002')
      );

      const comparison = compareExposure(summaryA, summaryB);
      expect(comparison.shareDiff).toBeDefined();
      expect(comparison.relativeShare).toBeDefined();
    });
  });
});

// ============================================================================
// ATTRIBUTION LINKING TESTS
// ============================================================================

describe('GreyAttributionLinking', () => {
  let registry: GreyAttributionRegistry;
  let linker: GreyAttributionLinker;

  beforeEach(() => {
    registry = createTestAttributionRegistry();
    linker = createTestAttributionLinker();

    // Add test attribution
    registry.recordAttribution(createTestInput());
  });

  describe('Link Creation', () => {
    it('should create link to agent', () => {
      const records = registry.getAllRecords();
      const attrId = records[0].attributionId;

      const result = linker.linkToAgent(
        attrId,
        'agent-linked-001',
        baseTimestamp,
        'operator-001'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.targetType).toBe(AttributionLinkTargetType.AGENT);
        expect(result.value.targetRefId).toBe('agent-linked-001');
      }
    });

    it('should create link to club', () => {
      const records = registry.getAllRecords();
      const attrId = records[0].attributionId;

      const result = linker.linkToClub(
        attrId,
        'club-001',
        baseTimestamp,
        'operator-001'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.targetType).toBe(AttributionLinkTargetType.CLUB);
      }
    });

    it('should create link to flow', () => {
      const records = registry.getAllRecords();
      const attrId = records[0].attributionId;

      const result = linker.linkToFlow(
        attrId,
        'flow-001',
        baseTimestamp,
        'operator-001'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.targetType).toBe(AttributionLinkTargetType.FLOW);
      }
    });

    it('should create frozen link records', () => {
      const records = registry.getAllRecords();
      const attrId = records[0].attributionId;

      const result = linker.linkToAgent(
        attrId,
        'agent-linked-001',
        baseTimestamp,
        'operator-001'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.isFrozen(result.value)).toBe(true);
      }
    });
  });

  describe('Querying Links', () => {
    beforeEach(() => {
      const records = registry.getAllRecords();
      const attrId = records[0].attributionId;

      linker.linkToAgent(attrId, 'agent-linked-001', baseTimestamp, 'operator-001');
      linker.linkToClub(attrId, 'club-001', baseTimestamp + 1, 'operator-001');
      linker.linkToFlow(attrId, 'flow-001', baseTimestamp + 2, 'operator-001');
    });

    it('should get links by attribution', () => {
      const records = registry.getAllRecords();
      const attrId = records[0].attributionId;

      const links = linker.getLinksByAttribution(attrId);
      expect(links).toHaveLength(3);
    });

    it('should get attributions by agent', () => {
      const links = linker.getAttributionsByAgent('agent-linked-001');
      expect(links).toHaveLength(1);
    });

    it('should get attribution links summary', () => {
      const records = registry.getAllRecords();
      const attrId = records[0].attributionId;

      const summary = linker.getAttributionLinksSummary(attrId);
      expect(summary.totalLinks).toBe(3);
      expect(summary.linksByType.get(AttributionLinkTargetType.AGENT)).toBe(1);
      expect(summary.linksByType.get(AttributionLinkTargetType.CLUB)).toBe(1);
    });
  });

  describe('Validation', () => {
    it('should validate link input', () => {
      const records = registry.getAllRecords();
      const validInput = {
        attributionId: records[0].attributionId,
        targetType: AttributionLinkTargetType.AGENT,
        targetRefId: 'agent-001',
        timestamp: baseTimestamp,
        operatorId: 'operator-001',
      };
      expect(isValidAttributionLinkInput(validInput)).toBe(true);
    });

    it('should reject invalid link input', () => {
      const invalidInput = {
        attributionId: '' as any,
        targetType: AttributionLinkTargetType.AGENT,
        targetRefId: 'agent-001',
        timestamp: baseTimestamp,
        operatorId: 'operator-001',
      };
      expect(isValidAttributionLinkInput(invalidInput)).toBe(false);
    });
  });
});

// ============================================================================
// EXPOSURE VIEWS TESTS
// ============================================================================

describe('GreyExposureViews', () => {
  let registry: GreyAttributionRegistry;
  let linker: GreyAttributionLinker;

  beforeEach(() => {
    registry = createTestAttributionRegistry();
    linker = createTestAttributionLinker();

    // Add test data
    const result1 = registry.recordAttribution(createTestInput({
      targetId: createTargetId('agent-001'),
      targetType: AttributionEntityType.AGENT,
      exposureMetrics: [{ metricType: ExposureMetricType.SHARE, value: 0.2 }],
      timestamp: baseTimestamp,
    }));

    const result2 = registry.recordAttribution(createTestInput({
      targetId: createTargetId('club-001'),
      targetType: AttributionEntityType.CLUB,
      exposureMetrics: [{ metricType: ExposureMetricType.SHARE, value: 0.3 }],
      timestamp: baseTimestamp + 1000,
    }));

    // Add links
    if (result1.success) {
      linker.linkToClub(result1.value.attributionId, 'club-001', baseTimestamp, 'op-001');
      linker.linkToFlow(result1.value.attributionId, 'flow-001', baseTimestamp, 'op-001');
    }
    if (result2.success) {
      linker.linkToAgent(result2.value.attributionId, 'agent-001', baseTimestamp, 'op-001');
    }
  });

  describe('Agent Views', () => {
    it('should get exposure by agent', () => {
      const view = getExposureByAgent(registry, linker, 'agent-001');
      expect(view.agentId).toBe('agent-001');
      expect(view.exposure).toBeDefined();
    });

    it('should get all agent exposures', () => {
      const views = getAllAgentExposures(registry, linker);
      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe('Club Views', () => {
    it('should get exposure by club', () => {
      const view = getExposureByClub(registry, linker, 'club-001');
      expect(view.clubId).toBe('club-001');
      expect(view.exposure).toBeDefined();
    });
  });

  describe('Period Views', () => {
    it('should get exposure by period', () => {
      const view = getExposureByPeriod(
        registry,
        createPeriodId('2024-01'),
        baseTimestamp - 1000,
        baseTimestamp + 10000
      );

      expect(view.periodId).toBe('2024-01');
      expect(view.totalAttributions).toBe(2);
      expect(view.totalExposure.share).toBeCloseTo(0.5);
    });
  });

  describe('Trace Views', () => {
    it('should get exposure trace', () => {
      const records = registry.getAllRecords();
      const trace = getExposureTrace(registry, linker, records[0].attributionId);

      expect(trace.attributionId).toBe(records[0].attributionId);
      expect(trace.attribution).not.toBeNull();
      expect(trace.links.length).toBeGreaterThan(0);
    });

    it('should get all exposure traces', () => {
      const traces = getAllExposureTraces(registry, linker);
      expect(traces).toHaveLength(2);
    });
  });

  describe('Overall Views', () => {
    it('should get overall exposure summary', () => {
      const summary = getOverallExposureSummary(registry, linker);

      expect(summary.totalAttributions).toBe(2);
      expect(summary.totalLinks).toBe(3);
      expect(summary.chainIntegrity).toBe(true);
    });
  });

  describe('Filtered Views', () => {
    it('should get high exposure attributions', () => {
      const records = getHighExposureAttributions(registry, 0.25);
      expect(records).toHaveLength(1);
    });

    it('should get attributions by kind', () => {
      const records = getAttributionsByKind(registry, AttributionKind.DIRECT);
      expect(records).toHaveLength(2);
    });
  });
});

// ============================================================================
// BOUNDARY GUARDS TESTS
// ============================================================================

describe('GreyAttributionBoundaryGuards', () => {
  describe('Forbidden Financial Keywords', () => {
    it('should have forbidden financial keywords', () => {
      expect(ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('money');
      expect(ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('balance');
      expect(ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('wallet');
      expect(ATTRIBUTION_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('payment');
    });

    it('should detect financial keywords', () => {
      const result = checkForAttributionFinancialKeywords('This involves money transfer');
      expect(result.passed).toBe(false);
      expect(result.violationCount).toBeGreaterThan(0);
    });

    it('should pass for clean text', () => {
      const result = checkForAttributionFinancialKeywords('This is exposure analysis');
      expect(result.passed).toBe(true);
    });
  });

  describe('Forbidden Revenue Keywords', () => {
    it('should have forbidden revenue keywords', () => {
      expect(ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS).toContain('revenue');
      expect(ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS).toContain('earnings');
      expect(ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS).toContain('profit');
      expect(ATTRIBUTION_FORBIDDEN_REVENUE_KEYWORDS).toContain('income');
    });

    it('should detect revenue keywords', () => {
      const result = checkForAttributionRevenueKeywords('Calculate revenue share');
      expect(result.passed).toBe(false);
    });

    it('should suggest EXPOSURE instead', () => {
      const result = checkForAttributionRevenueKeywords('Track earnings');
      expect(result.passed).toBe(false);
      expect(result.violations[0].context).toContain('EXPOSURE');
    });
  });

  describe('Forbidden Execution Keywords', () => {
    it('should have forbidden execution keywords', () => {
      expect(ATTRIBUTION_FORBIDDEN_EXECUTION_KEYWORDS).toContain('execute');
      expect(ATTRIBUTION_FORBIDDEN_EXECUTION_KEYWORDS).toContain('trigger');
    });

    it('should detect execution keywords', () => {
      const result = checkForAttributionExecutionKeywords('Execute the transfer');
      expect(result.passed).toBe(false);
    });
  });

  describe('Forbidden Push Keywords', () => {
    it('should have forbidden push keywords', () => {
      expect(ATTRIBUTION_FORBIDDEN_PUSH_KEYWORDS).toContain('push');
      expect(ATTRIBUTION_FORBIDDEN_PUSH_KEYWORDS).toContain('emit');
      expect(ATTRIBUTION_FORBIDDEN_PUSH_KEYWORDS).toContain('notify');
    });

    it('should detect push keywords', () => {
      const result = checkForAttributionPushKeywords('Push notification');
      expect(result.passed).toBe(false);
    });
  });

  describe('Comprehensive Boundary Check', () => {
    it('should check all boundaries', () => {
      const result = checkAllAttributionBoundaries('Execute money transfer and emit event');
      expect(result.passed).toBe(false);
      expect(result.violationCount).toBeGreaterThan(2);
    });

    it('should pass for compliant text', () => {
      const result = checkAllAttributionBoundaries('Analyze exposure metrics');
      expect(result.passed).toBe(true);
    });
  });

  describe('Assertion Functions', () => {
    it('should assert no financial keywords', () => {
      const result = assertNoAttributionFinancialKeywords('clean text');
      expect(result.success).toBe(true);
    });

    it('should fail for financial keywords', () => {
      const result = assertNoAttributionFinancialKeywords('involves money');
      expect(result.success).toBe(false);
    });

    it('should assert no revenue keywords', () => {
      const result = assertNoAttributionRevenueKeywords('exposure analysis');
      expect(result.success).toBe(true);
    });

    it('should fail for revenue keywords', () => {
      const result = assertNoAttributionRevenueKeywords('revenue calculation');
      expect(result.success).toBe(false);
    });
  });

  describe('Exposure/Share Assertions', () => {
    it('should assert valid exposure metric', () => {
      const result = assertIsExposureMetric(0.5, 'testMetric');
      expect(result.success).toBe(true);
    });

    it('should reject negative exposure metric', () => {
      const result = assertIsExposureMetric(-0.1, 'testMetric');
      expect(result.success).toBe(false);
    });

    it('should assert valid share value', () => {
      const result = assertIsShareValue(0.5, 'testShare');
      expect(result.success).toBe(true);
    });

    it('should reject share above 1.0', () => {
      const result = assertIsShareValue(1.5, 'testShare');
      expect(result.success).toBe(false);
    });

    it('should reject negative share', () => {
      const result = assertIsShareValue(-0.1, 'testShare');
      expect(result.success).toBe(false);
    });
  });

  describe('Module Constraints Documentation', () => {
    it('should document module constraints', () => {
      expect(ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS.name).toBe('grey-attribution');
      expect(ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS.version).toBe('OPS-7');
      expect(ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS.constraints.length).toBeGreaterThan(0);
    });

    it('should document semantic boundaries', () => {
      expect(ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS.semanticBoundaries.attribution).toContain('WHY');
      expect(ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS.semanticBoundaries.exposure).toContain('NOT revenue');
    });

    it('should list all forbidden concepts', () => {
      expect(ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.financial).toBeDefined();
      expect(ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.revenue).toBeDefined();
      expect(ATTRIBUTION_MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.execution).toBeDefined();
    });
  });
});

// ============================================================================
// DESIGN CONSTRAINT VERIFICATION TESTS
// ============================================================================

describe('Design Constraint Verification', () => {
  it('should NOT have any execution methods in registries', () => {
    const registry = createTestAttributionRegistry();
    const linker = createTestAttributionLinker();

    const registryMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(registry));
    const linkerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(linker));

    const executionPatterns = ['execute', 'trigger', 'dispatch', 'invoke', 'run'];

    for (const method of registryMethods) {
      for (const pattern of executionPatterns) {
        expect(method.toLowerCase()).not.toContain(pattern);
      }
    }

    for (const method of linkerMethods) {
      for (const pattern of executionPatterns) {
        expect(method.toLowerCase()).not.toContain(pattern);
      }
    }
  });

  it('should NOT have any push/emit methods in registries', () => {
    const registry = createTestAttributionRegistry();
    const linker = createTestAttributionLinker();

    const registryMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(registry));
    const linkerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(linker));

    const pushPatterns = ['push', 'emit', 'notify', 'broadcast', 'send'];

    for (const method of registryMethods) {
      for (const pattern of pushPatterns) {
        expect(method.toLowerCase()).not.toContain(pattern);
      }
    }

    for (const method of linkerMethods) {
      for (const pattern of pushPatterns) {
        expect(method.toLowerCase()).not.toContain(pattern);
      }
    }
  });

  it('should NOT have any delete/modify methods in registries', () => {
    const registry = createTestAttributionRegistry();
    const linker = createTestAttributionLinker();

    const registryMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(registry));
    const linkerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(linker));

    const deletePatterns = ['delete', 'remove', 'update', 'modify', 'set'];

    for (const method of registryMethods) {
      for (const pattern of deletePatterns) {
        expect(method.toLowerCase()).not.toContain(pattern);
      }
    }

    for (const method of linkerMethods) {
      for (const pattern of deletePatterns) {
        expect(method.toLowerCase()).not.toContain(pattern);
      }
    }
  });

  it('should return frozen data from all query methods', () => {
    const registry = createTestAttributionRegistry();
    const linker = createTestAttributionLinker();

    registry.recordAttribution(createTestInput());

    const allRecords = registry.getAllRecords();
    expect(Object.isFrozen(allRecords)).toBe(true);

    const state = registry.getState();
    expect(Object.isFrozen(state)).toBe(true);

    const allLinks = linker.getAllLinks();
    expect(Object.isFrozen(allLinks)).toBe(true);

    const linkState = linker.getState();
    expect(Object.isFrozen(linkState)).toBe(true);
  });

  it('should use AttributionKind as classification, not status', () => {
    // AttributionKind should describe the TYPE of attribution, not its lifecycle state
    expect(AttributionKind.DIRECT).toBeDefined();
    expect(AttributionKind.INDIRECT).toBeDefined();
    expect(AttributionKind.DERIVED).toBeDefined();

    // Should NOT have status-like values
    const kindValues = Object.values(AttributionKind);
    expect(kindValues).not.toContain('PENDING');
    expect(kindValues).not.toContain('PROCESSING');
    expect(kindValues).not.toContain('COMPLETED');
    expect(kindValues).not.toContain('FAILED');
  });

  it('should use ExposureMetricType as classification, not monetary type', () => {
    expect(ExposureMetricType.SHARE).toBeDefined();
    expect(ExposureMetricType.RATIO).toBeDefined();
    expect(ExposureMetricType.WEIGHT).toBeDefined();
    expect(ExposureMetricType.INDEX).toBeDefined();

    // Should NOT have monetary values
    const metricValues = Object.values(ExposureMetricType);
    expect(metricValues).not.toContain('AMOUNT');
    expect(metricValues).not.toContain('MONEY');
    expect(metricValues).not.toContain('CURRENCY');
    expect(metricValues).not.toContain('FEE');
  });

  it('should use exposure metrics, NOT revenue or monetary values', () => {
    const input = createTestInput({
      exposureMetrics: [
        { metricType: ExposureMetricType.SHARE, value: 0.15 },
        { metricType: ExposureMetricType.RATIO, value: 0.25 },
      ],
    });

    // Validate that all metrics are exposure-type, not monetary
    for (const metric of input.exposureMetrics) {
      expect(Object.values(ExposureMetricType)).toContain(metric.metricType);
      expect(metric.value).toBeGreaterThanOrEqual(0);
      if (metric.metricType === ExposureMetricType.SHARE) {
        expect(metric.value).toBeLessThanOrEqual(1.0);
      }
    }
  });
});

// ============================================================================
// SEMANTIC BOUNDARY VERIFICATION TESTS
// ============================================================================

describe('Semantic Boundary Verification', () => {
  it('"Attribution" explains WHY ratios are related, NOT what money to move', () => {
    const input = createTestInput();
    const registry = createTestAttributionRegistry();
    const result = registry.recordAttribution(input);

    expect(result.success).toBe(true);
    if (result.success) {
      // Attribution has evidenceRefs explaining WHY
      expect(result.value.evidenceRefs.length).toBeGreaterThan(0);
      // Attribution has kind explaining relationship TYPE
      expect(result.value.kind).toBeDefined();
      // Attribution does NOT have monetary fields
      expect((result.value as any).amount).toBeUndefined();
      expect((result.value as any).money).toBeUndefined();
      expect((result.value as any).currency).toBeUndefined();
    }
  });

  it('"Exposure" is risk/impact, NOT revenue or earnings', () => {
    const registry = createTestAttributionRegistry();
    registry.recordAttribution(createTestInput({
      exposureMetrics: [{ metricType: ExposureMetricType.SHARE, value: 0.2 }],
    }));

    const summary = calculateExposureSummary(
      registry.getAllRecords(),
      createTargetId('agent-001')
    );

    // Exposure summary has share/ratio/weight/index
    expect(summary.totalShare).toBeDefined();
    expect(summary.totalRatio).toBeDefined();
    expect(summary.totalWeight).toBeDefined();
    expect(summary.totalIndex).toBeDefined();

    // Exposure summary does NOT have revenue/earnings/profit
    expect((summary as any).revenue).toBeUndefined();
    expect((summary as any).earnings).toBeUndefined();
    expect((summary as any).profit).toBeUndefined();
    expect((summary as any).income).toBeUndefined();
  });

  it('All outputs are analysis results, no side effects', () => {
    const registry = createTestAttributionRegistry();
    const linker = createTestAttributionLinker();

    // Record some data
    registry.recordAttribution(createTestInput());

    // All view functions should return frozen data
    const overall = getOverallExposureSummary(registry, linker);
    expect(Object.isFrozen(overall)).toBe(true);

    // Views should NOT modify registry state
    const stateBefore = registry.getState();
    getOverallExposureSummary(registry, linker);
    const stateAfter = registry.getState();

    expect(stateAfter.recordCount).toBe(stateBefore.recordCount);
  });
});
