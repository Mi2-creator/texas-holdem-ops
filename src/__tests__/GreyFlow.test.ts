/**
 * GreyFlow.test.ts
 *
 * Tests for OPS-6: Grey Flow & Rake Analytics
 *
 * Tests verify:
 * - Append-only, hash-chained registry behavior
 * - Immutable record creation
 * - Reference-based linking (no validation)
 * - Read-only aggregation (volume, frequency, distribution, ratios)
 * - Read-only views
 * - Boundary guard validation
 * - NO financial concepts (money, balance, etc.)
 * - NO execution, push, or blocking behavior
 * - Ratio-only rake semantics (NOT fee/deduction)
 */

// Flow Types
import {
  createGreyFlowRecordId,
  createFlowHash,
  createEntityId,
  createSessionId,
  createHandId,
  createFlowOperatorId,
  FlowDirection,
  FlowSource,
  EntityType,
  FlowErrorCode,
  FLOW_GENESIS_HASH,
  computeFlowHash,
  computeFlowId,
  isValidFlowInput,
  type GreyFlowInput,
} from '../grey-flow/GreyFlowTypes';

// Flow Registry
import {
  GreyFlowRegistry,
  createTestFlowRegistry,
} from '../grey-flow/GreyFlowRegistry';

// Flow Linking
import {
  FlowLinkType,
  GreyFlowLinker,
  createTestFlowLinker,
} from '../grey-flow/GreyFlowLinking';

// Flow Aggregation
import {
  computeVolumeAggregation,
  computeFrequencyAggregation,
  computeDistributionAggregation,
  computeRakeRatioAggregation,
  computeTimeSeriesAggregation,
  computeEntityVolume,
  computeVolumeBySource,
} from '../grey-flow/GreyFlowAggregation';

// Flow Views
import {
  getFlowsByPeriod,
  getEntitySummary,
  getAllEntitySummaries,
  getAgentSummary,
  getClubSummary,
  getFlowTrace,
  getOverallSummary,
  getFlowsByDirection,
  getFlowsBySource,
} from '../grey-flow/GreyFlowViews';

// Boundary Guards
import {
  FLOW_FORBIDDEN_FINANCIAL_KEYWORDS,
  FLOW_FORBIDDEN_EXECUTION_KEYWORDS,
  FLOW_FORBIDDEN_PUSH_KEYWORDS,
  FLOW_FORBIDDEN_STATE_MACHINE_KEYWORDS,
  checkForFinancialKeywords,
  checkForFlowExecutionKeywords,
  checkForFlowPushKeywords,
  checkForFlowStateMachineKeywords,
  checkForFlowForbiddenImport,
  checkAllFlowBoundaries,
  assertNoFinancialKeywords,
  assertAllFlowBoundaries,
  assertIsRatioOnly,
  assertIsUnitCount,
  FLOW_MODULE_DESIGN_CONSTRAINTS,
} from '../grey-flow/GreyFlowBoundaryGuards';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestOperatorId(name: string = 'operator1'): ReturnType<typeof createFlowOperatorId> {
  return createFlowOperatorId(name);
}

function createTestEntityId(name: string = 'entity1'): ReturnType<typeof createEntityId> {
  return createEntityId(name);
}

function createTestFlowInput(overrides?: Partial<GreyFlowInput>): GreyFlowInput {
  return {
    direction: FlowDirection.INBOUND,
    source: FlowSource.TABLE,
    sourceEntityId: createTestEntityId(),
    sourceEntityType: EntityType.TABLE,
    unitCount: 100,
    createdBy: createTestOperatorId(),
    timestamp: Date.now(),
    description: 'Test flow',
    ...overrides,
  };
}

// ============================================================================
// FLOW TYPES TESTS
// ============================================================================

describe('GreyFlowTypes', () => {
  describe('ID Factories', () => {
    it('should create valid flow record ID', () => {
      const id = createGreyFlowRecordId('flow-1');
      expect(id).toBe('flow-1');
    });

    it('should throw for empty flow record ID', () => {
      expect(() => createGreyFlowRecordId('')).toThrow();
    });

    it('should create valid flow hash', () => {
      const hash = createFlowHash('abc123');
      expect(hash).toBe('abc123');
    });

    it('should create valid entity ID', () => {
      const id = createEntityId('table-1');
      expect(id).toBe('table-1');
    });

    it('should create valid session ID', () => {
      const id = createSessionId('session-1');
      expect(id).toBe('session-1');
    });

    it('should create valid hand ID', () => {
      const id = createHandId('hand-1');
      expect(id).toBe('hand-1');
    });

    it('should create valid operator ID', () => {
      const id = createFlowOperatorId('op-1');
      expect(id).toBe('op-1');
    });
  });

  describe('Hash Utilities', () => {
    it('should compute deterministic hash', () => {
      const hash1 = computeFlowHash('test data');
      const hash2 = computeFlowHash('test data');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', () => {
      const hash1 = computeFlowHash('data1');
      const hash2 = computeFlowHash('data2');
      expect(hash1).not.toBe(hash2);
    });

    it('should compute flow ID deterministically', () => {
      const id1 = computeFlowId(FlowSource.TABLE, createTestEntityId(), createTestOperatorId(), 1000);
      const id2 = computeFlowId(FlowSource.TABLE, createTestEntityId(), createTestOperatorId(), 1000);
      expect(id1).toBe(id2);
    });

    it('should have 64-character genesis hash', () => {
      expect(FLOW_GENESIS_HASH.length).toBe(64);
    });
  });

  describe('Validation', () => {
    it('should validate correct flow input', () => {
      const input = createTestFlowInput();
      expect(isValidFlowInput(input)).toBe(true);
    });

    it('should reject flow input with invalid direction', () => {
      const input = { ...createTestFlowInput(), direction: 'INVALID' } as unknown as GreyFlowInput;
      expect(isValidFlowInput(input)).toBe(false);
    });

    it('should reject flow input with negative unit count', () => {
      const input = createTestFlowInput({ unitCount: -1 });
      expect(isValidFlowInput(input)).toBe(false);
    });

    it('should reject flow input with invalid timestamp', () => {
      const input = createTestFlowInput({ timestamp: -1 });
      expect(isValidFlowInput(input)).toBe(false);
    });
  });

  describe('Enums', () => {
    it('should have FlowDirection values', () => {
      expect(FlowDirection.INBOUND).toBe('INBOUND');
      expect(FlowDirection.OUTBOUND).toBe('OUTBOUND');
      expect(FlowDirection.INTERNAL).toBe('INTERNAL');
    });

    it('should have FlowSource values', () => {
      expect(FlowSource.TABLE).toBe('TABLE');
      expect(FlowSource.AGENT).toBe('AGENT');
      expect(FlowSource.CLUB).toBe('CLUB');
      expect(FlowSource.PLAYER).toBe('PLAYER');
      expect(FlowSource.EXTERNAL).toBe('EXTERNAL');
    });

    it('should have EntityType values', () => {
      expect(EntityType.AGENT).toBe('AGENT');
      expect(EntityType.TABLE).toBe('TABLE');
      expect(EntityType.CLUB).toBe('CLUB');
      expect(EntityType.PLAYER).toBe('PLAYER');
    });
  });
});

// ============================================================================
// FLOW REGISTRY TESTS
// ============================================================================

describe('GreyFlowRegistry', () => {
  let registry: GreyFlowRegistry;

  beforeEach(() => {
    registry = createTestFlowRegistry();
  });

  describe('Record Creation', () => {
    it('should record flow successfully', () => {
      const input = createTestFlowInput();
      const result = registry.recordFlow(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.flowId).toBeDefined();
        expect(result.value.direction).toBe(FlowDirection.INBOUND);
        expect(result.value.sequenceNumber).toBe(1);
        expect(result.value.previousHash).toBe(FLOW_GENESIS_HASH);
      }
    });

    it('should create frozen records', () => {
      const input = createTestFlowInput();
      const result = registry.recordFlow(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.isFrozen(result.value)).toBe(true);
      }
    });

    it('should reject duplicate flows', () => {
      const timestamp = Date.now();
      const input = createTestFlowInput({ timestamp });

      const result1 = registry.recordFlow(input);
      expect(result1.success).toBe(true);

      const result2 = registry.recordFlow(input);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.code).toBe(FlowErrorCode.DUPLICATE_FLOW);
      }
    });

    it('should reject invalid input', () => {
      const input = { ...createTestFlowInput(), unitCount: -1 };
      const result = registry.recordFlow(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(FlowErrorCode.INVALID_INPUT);
      }
    });
  });

  describe('Hash Chain', () => {
    it('should link records in hash chain', () => {
      const input1 = createTestFlowInput({ timestamp: 1000 });
      const input2 = createTestFlowInput({ timestamp: 2000 });

      const result1 = registry.recordFlow(input1);
      const result2 = registry.recordFlow(input2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result2.value.previousHash).toBe(result1.value.recordHash);
      }
    });

    it('should verify chain integrity', () => {
      registry.recordFlow(createTestFlowInput({ timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ timestamp: 2000 }));
      registry.recordFlow(createTestFlowInput({ timestamp: 3000 }));

      const result = registry.verifyChainIntegrity();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe('Querying', () => {
    it('should get record by ID', () => {
      const input = createTestFlowInput();
      const result = registry.recordFlow(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const record = registry.getRecord(result.value.flowId);
        expect(record).toBeDefined();
        expect(record?.flowId).toBe(result.value.flowId);
      }
    });

    it('should get records by source', () => {
      registry.recordFlow(createTestFlowInput({ source: FlowSource.TABLE, timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ source: FlowSource.AGENT, timestamp: 2000 }));
      registry.recordFlow(createTestFlowInput({ source: FlowSource.TABLE, timestamp: 3000 }));

      const records = registry.getRecordsBySource(FlowSource.TABLE);
      expect(records.length).toBe(2);
    });

    it('should get records by entity', () => {
      const entity1 = createEntityId('entity1');
      const entity2 = createEntityId('entity2');

      registry.recordFlow(createTestFlowInput({ sourceEntityId: entity1, timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ sourceEntityId: entity2, timestamp: 2000 }));
      registry.recordFlow(createTestFlowInput({ sourceEntityId: entity1, timestamp: 3000 }));

      const records = registry.getRecordsBySourceEntity(entity1);
      expect(records.length).toBe(2);
    });

    it('should filter by time range', () => {
      registry.recordFlow(createTestFlowInput({ timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ timestamp: 2000 }));
      registry.recordFlow(createTestFlowInput({ timestamp: 3000 }));

      const records = registry.getAllRecords({ fromTimestamp: 1500, toTimestamp: 2500 });
      expect(records.length).toBe(1);
    });

    it('should support pagination', () => {
      for (let i = 0; i < 10; i++) {
        registry.recordFlow(createTestFlowInput({ timestamp: 1000 + i }));
      }

      const page1 = registry.getAllRecords({ offset: 0, limit: 3 });
      const page2 = registry.getAllRecords({ offset: 3, limit: 3 });

      expect(page1.length).toBe(3);
      expect(page2.length).toBe(3);
    });
  });

  describe('Statistics', () => {
    it('should return total unit count', () => {
      registry.recordFlow(createTestFlowInput({ unitCount: 100, timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ unitCount: 200, timestamp: 2000 }));

      expect(registry.getTotalUnitCount()).toBe(300);
    });

    it('should return registry state snapshot', () => {
      registry.recordFlow(createTestFlowInput({ timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ timestamp: 2000 }));

      const state = registry.getState();
      expect(state.recordCount).toBe(2);
      expect(state.currentSequence).toBe(2);
      expect(Object.isFrozen(state)).toBe(true);
    });
  });
});

// ============================================================================
// FLOW LINKING TESTS
// ============================================================================

describe('GreyFlowLinking', () => {
  let linker: GreyFlowLinker;

  beforeEach(() => {
    linker = createTestFlowLinker();
  });

  describe('Link Creation', () => {
    it('should create link to hand', () => {
      const flowId = createGreyFlowRecordId('flow-1');
      const handId = createHandId('hand-1');

      const result = linker.linkToHand(flowId, handId, createTestOperatorId(), Date.now());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.linkType).toBe(FlowLinkType.HAND);
        expect(result.value.referenceId).toBe(handId);
      }
    });

    it('should create link to session', () => {
      const flowId = createGreyFlowRecordId('flow-1');
      const sessionId = createSessionId('session-1');

      const result = linker.linkToSession(flowId, sessionId, createTestOperatorId(), Date.now());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.linkType).toBe(FlowLinkType.SESSION);
      }
    });

    it('should create frozen link records', () => {
      const flowId = createGreyFlowRecordId('flow-1');
      const handId = createHandId('hand-1');

      const result = linker.linkToHand(flowId, handId, createTestOperatorId(), Date.now());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.isFrozen(result.value)).toBe(true);
      }
    });
  });

  describe('Querying Links', () => {
    it('should get links by flow', () => {
      const flowId = createGreyFlowRecordId('flow-1');

      linker.linkToHand(flowId, createHandId('hand-1'), createTestOperatorId(), 1000);
      linker.linkToSession(flowId, createSessionId('session-1'), createTestOperatorId(), 2000);

      const links = linker.getLinksByFlow(flowId);
      expect(links.length).toBe(2);
    });

    it('should get flows by hand', () => {
      const handId = createHandId('hand-1');

      linker.linkToHand(createGreyFlowRecordId('flow-1'), handId, createTestOperatorId(), 1000);
      linker.linkToHand(createGreyFlowRecordId('flow-2'), handId, createTestOperatorId(), 2000);

      const flowIds = linker.getFlowsByHand(handId);
      expect(flowIds.length).toBe(2);
    });

    it('should get flow links summary', () => {
      const flowId = createGreyFlowRecordId('flow-1');

      linker.linkToHand(flowId, createHandId('hand-1'), createTestOperatorId(), 1000);
      linker.linkToSession(flowId, createSessionId('session-1'), createTestOperatorId(), 2000);

      const summary = linker.getFlowLinksSummary(flowId);
      expect(summary.totalLinks).toBe(2);
      expect(summary.byType[FlowLinkType.HAND].length).toBe(1);
      expect(summary.byType[FlowLinkType.SESSION].length).toBe(1);
    });
  });
});

// ============================================================================
// FLOW AGGREGATION TESTS
// ============================================================================

describe('GreyFlowAggregation', () => {
  let registry: GreyFlowRegistry;

  beforeEach(() => {
    registry = createTestFlowRegistry();
  });

  describe('Volume Aggregation', () => {
    it('should compute volume aggregation', () => {
      registry.recordFlow(createTestFlowInput({
        direction: FlowDirection.INBOUND,
        unitCount: 100,
        timestamp: 1000,
      }));
      registry.recordFlow(createTestFlowInput({
        direction: FlowDirection.OUTBOUND,
        unitCount: 50,
        timestamp: 2000,
      }));
      registry.recordFlow(createTestFlowInput({
        direction: FlowDirection.INTERNAL,
        unitCount: 25,
        timestamp: 3000,
      }));

      const records = registry.getAllRecords();
      const volume = computeVolumeAggregation(records);

      expect(volume.totalUnits).toBe(175);
      expect(volume.inboundUnits).toBe(100);
      expect(volume.outboundUnits).toBe(50);
      expect(volume.internalUnits).toBe(25);
      expect(volume.netFlow).toBe(50); // 100 - 50
      expect(volume.recordCount).toBe(3);
    });

    it('should return frozen volume aggregation', () => {
      const records = registry.getAllRecords();
      const volume = computeVolumeAggregation(records);
      expect(Object.isFrozen(volume)).toBe(true);
    });
  });

  describe('Frequency Aggregation', () => {
    it('should compute frequency aggregation', () => {
      registry.recordFlow(createTestFlowInput({
        direction: FlowDirection.INBOUND,
        source: FlowSource.TABLE,
        timestamp: 1000,
      }));
      registry.recordFlow(createTestFlowInput({
        direction: FlowDirection.OUTBOUND,
        source: FlowSource.AGENT,
        timestamp: 2000,
      }));
      registry.recordFlow(createTestFlowInput({
        direction: FlowDirection.INBOUND,
        source: FlowSource.TABLE,
        timestamp: 3000,
      }));

      const records = registry.getAllRecords();
      const frequency = computeFrequencyAggregation(records);

      expect(frequency.totalFlows).toBe(3);
      expect(frequency.byDirection[FlowDirection.INBOUND]).toBe(2);
      expect(frequency.byDirection[FlowDirection.OUTBOUND]).toBe(1);
      expect(frequency.bySource[FlowSource.TABLE]).toBe(2);
      expect(frequency.bySource[FlowSource.AGENT]).toBe(1);
    });
  });

  describe('Distribution Aggregation', () => {
    it('should compute distribution aggregation', () => {
      const entity1 = createEntityId('entity1');
      const entity2 = createEntityId('entity2');

      registry.recordFlow(createTestFlowInput({ sourceEntityId: entity1, timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ sourceEntityId: entity1, timestamp: 2000 }));
      registry.recordFlow(createTestFlowInput({ sourceEntityId: entity2, timestamp: 3000 }));

      const records = registry.getAllRecords();
      const distribution = computeDistributionAggregation(records);

      expect(distribution.byEntity[entity1]).toBeCloseTo(2 / 3);
      expect(distribution.byEntity[entity2]).toBeCloseTo(1 / 3);
      expect(distribution.concentrationIndex).toBeGreaterThan(0);
    });
  });

  describe('Rake Ratio Aggregation', () => {
    it('should compute rake ratio aggregation (RATIOS ONLY)', () => {
      registry.recordFlow(createTestFlowInput({
        direction: FlowDirection.INBOUND,
        unitCount: 100,
        timestamp: 1000,
      }));
      registry.recordFlow(createTestFlowInput({
        direction: FlowDirection.OUTBOUND,
        unitCount: 30,
        timestamp: 2000,
      }));
      registry.recordFlow(createTestFlowInput({
        direction: FlowDirection.INTERNAL,
        unitCount: 20,
        timestamp: 3000,
      }));

      const records = registry.getAllRecords();
      const ratios = computeRakeRatioAggregation(records);

      // outbound / inbound = 30 / 100 = 0.3
      expect(ratios.outboundToInboundRatio).toBeCloseTo(0.3);
      // internal / total = 20 / 150 = 0.133...
      expect(ratios.internalToTotalRatio).toBeCloseTo(20 / 150);
      // net flow ratio = (100 - 30) / 150 = 70 / 150 = 0.466...
      expect(ratios.netFlowRatio).toBeCloseTo(70 / 150);
      // average = 150 / 3 = 50
      expect(ratios.averageUnitsPerFlow).toBeCloseTo(50);
    });

    it('should return frozen rake ratio aggregation', () => {
      const records = registry.getAllRecords();
      const ratios = computeRakeRatioAggregation(records);
      expect(Object.isFrozen(ratios)).toBe(true);
    });
  });

  describe('Time Series Aggregation', () => {
    it('should compute time series aggregation', () => {
      registry.recordFlow(createTestFlowInput({ unitCount: 100, timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ unitCount: 150, timestamp: 2000 }));
      registry.recordFlow(createTestFlowInput({ unitCount: 200, timestamp: 3000 }));

      const records = registry.getAllRecords();
      const timeSeries = computeTimeSeriesAggregation(records, 1000);

      expect(timeSeries.points.length).toBeGreaterThan(0);
      expect(timeSeries.overall.totalUnits).toBe(450);
    });
  });

  describe('Entity-specific Aggregations', () => {
    it('should compute entity volume', () => {
      const entity1 = createEntityId('entity1');
      const entity2 = createEntityId('entity2');

      registry.recordFlow(createTestFlowInput({ sourceEntityId: entity1, unitCount: 100, timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ sourceEntityId: entity2, unitCount: 50, timestamp: 2000 }));
      registry.recordFlow(createTestFlowInput({ sourceEntityId: entity1, unitCount: 75, timestamp: 3000 }));

      const records = registry.getAllRecords();
      const entityVolume = computeEntityVolume(records, entity1);

      expect(entityVolume.totalUnits).toBe(175);
    });
  });

  describe('Source-specific Aggregations', () => {
    it('should compute volume by source', () => {
      registry.recordFlow(createTestFlowInput({
        source: FlowSource.TABLE,
        unitCount: 100,
        timestamp: 1000,
      }));
      registry.recordFlow(createTestFlowInput({
        source: FlowSource.AGENT,
        unitCount: 50,
        timestamp: 2000,
      }));
      registry.recordFlow(createTestFlowInput({
        source: FlowSource.TABLE,
        unitCount: 75,
        timestamp: 3000,
      }));

      const records = registry.getAllRecords();
      const bySource = computeVolumeBySource(records);

      expect(bySource[FlowSource.TABLE].totalUnits).toBe(175);
      expect(bySource[FlowSource.AGENT].totalUnits).toBe(50);
    });
  });
});

// ============================================================================
// FLOW VIEWS TESTS
// ============================================================================

describe('GreyFlowViews', () => {
  let registry: GreyFlowRegistry;
  let linker: GreyFlowLinker;

  beforeEach(() => {
    registry = createTestFlowRegistry();
    linker = createTestFlowLinker();
  });

  describe('Period Views', () => {
    it('should get flows by period', () => {
      registry.recordFlow(createTestFlowInput({ timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ timestamp: 2000 }));
      registry.recordFlow(createTestFlowInput({ timestamp: 5000 }));

      const periodSummary = getFlowsByPeriod(registry, 1000, 3000);

      expect(periodSummary.recordCount).toBe(2);
      expect(Object.isFrozen(periodSummary)).toBe(true);
    });
  });

  describe('Entity Views', () => {
    it('should get entity summary', () => {
      const entity = createEntityId('entity1');

      registry.recordFlow(createTestFlowInput({
        sourceEntityId: entity,
        sourceEntityType: EntityType.TABLE,
        timestamp: 1000,
      }));
      registry.recordFlow(createTestFlowInput({
        sourceEntityId: entity,
        sourceEntityType: EntityType.TABLE,
        timestamp: 2000,
      }));

      const summary = getEntitySummary(registry, entity, EntityType.TABLE);

      expect(summary.entityId).toBe(entity);
      expect(summary.volume.recordCount).toBe(2);
    });

    it('should get all entity summaries', () => {
      registry.recordFlow(createTestFlowInput({
        sourceEntityId: createEntityId('entity1'),
        timestamp: 1000,
      }));
      registry.recordFlow(createTestFlowInput({
        sourceEntityId: createEntityId('entity2'),
        timestamp: 2000,
      }));

      const summaries = getAllEntitySummaries(registry);

      expect(summaries.length).toBe(2);
      expect(Object.isFrozen(summaries)).toBe(true);
    });
  });

  describe('Agent Views', () => {
    it('should get agent summary with associations', () => {
      const agent = createEntityId('agent1');

      registry.recordFlow(createTestFlowInput({
        source: FlowSource.AGENT,
        sourceEntityId: agent,
        sourceEntityType: EntityType.AGENT,
        timestamp: 1000,
      }));

      const summary = getAgentSummary(registry, agent);

      expect(summary.entityId).toBe(agent);
      expect(summary.entityType).toBe(EntityType.AGENT);
    });
  });

  describe('Club Views', () => {
    it('should get club summary', () => {
      const club = createEntityId('club1');

      registry.recordFlow(createTestFlowInput({
        source: FlowSource.CLUB,
        sourceEntityId: club,
        sourceEntityType: EntityType.CLUB,
        timestamp: 1000,
      }));

      const summary = getClubSummary(registry, club);

      expect(summary.entityId).toBe(club);
      expect(summary.entityType).toBe(EntityType.CLUB);
    });
  });

  describe('Trace Views', () => {
    it('should get flow trace with links', () => {
      const result = registry.recordFlow(createTestFlowInput({ timestamp: 1000 }));
      expect(result.success).toBe(true);
      if (!result.success) return;

      linker.linkToHand(result.value.flowId, createHandId('hand-1'), createTestOperatorId(), 2000);
      linker.linkToSession(result.value.flowId, createSessionId('session-1'), createTestOperatorId(), 3000);

      const trace = getFlowTrace(registry, linker, result.value.flowId);

      expect(trace).toBeDefined();
      expect(trace?.linkedHands.length).toBe(1);
      expect(trace?.linkedSessions.length).toBe(1);
    });
  });

  describe('Overall Views', () => {
    it('should get overall summary', () => {
      registry.recordFlow(createTestFlowInput({ timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ timestamp: 2000 }));

      const summary = getOverallSummary(registry);

      expect(summary.totalVolume.recordCount).toBe(2);
      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe('Filtered Views', () => {
    it('should filter by direction', () => {
      registry.recordFlow(createTestFlowInput({ direction: FlowDirection.INBOUND, timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ direction: FlowDirection.OUTBOUND, timestamp: 2000 }));
      registry.recordFlow(createTestFlowInput({ direction: FlowDirection.INBOUND, timestamp: 3000 }));

      const filtered = getFlowsByDirection(registry, FlowDirection.INBOUND);
      expect(filtered.length).toBe(2);
    });

    it('should filter by source', () => {
      registry.recordFlow(createTestFlowInput({ source: FlowSource.TABLE, timestamp: 1000 }));
      registry.recordFlow(createTestFlowInput({ source: FlowSource.AGENT, timestamp: 2000 }));

      const filtered = getFlowsBySource(registry, FlowSource.TABLE);
      expect(filtered.length).toBe(1);
    });
  });
});

// ============================================================================
// BOUNDARY GUARDS TESTS
// ============================================================================

describe('GreyFlowBoundaryGuards', () => {
  describe('Forbidden Financial Keywords', () => {
    it('should have forbidden financial keywords', () => {
      expect(FLOW_FORBIDDEN_FINANCIAL_KEYWORDS.length).toBeGreaterThan(0);
      expect(FLOW_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('money');
      expect(FLOW_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('balance');
      expect(FLOW_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('wallet');
      expect(FLOW_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('payment');
      expect(FLOW_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('deduction');
      expect(FLOW_FORBIDDEN_FINANCIAL_KEYWORDS).toContain('fee');
    });

    it('should detect financial keywords', () => {
      const result = checkForFinancialKeywords('This handles money transfers');
      expect(result.passed).toBe(false);
      expect(result.violationCount).toBeGreaterThan(0);
    });

    it('should pass for clean text', () => {
      const result = checkForFinancialKeywords('This computes unit count ratios');
      expect(result.passed).toBe(true);
    });
  });

  describe('Forbidden Execution Keywords', () => {
    it('should have forbidden execution keywords', () => {
      expect(FLOW_FORBIDDEN_EXECUTION_KEYWORDS).toContain('execute');
      expect(FLOW_FORBIDDEN_EXECUTION_KEYWORDS).toContain('trigger');
      expect(FLOW_FORBIDDEN_EXECUTION_KEYWORDS).toContain('process');
    });

    it('should detect execution keywords', () => {
      const result = checkForFlowExecutionKeywords('This will execute the action');
      expect(result.passed).toBe(false);
    });
  });

  describe('Forbidden Push Keywords', () => {
    it('should have forbidden push keywords', () => {
      expect(FLOW_FORBIDDEN_PUSH_KEYWORDS).toContain('push');
      expect(FLOW_FORBIDDEN_PUSH_KEYWORDS).toContain('emit');
      expect(FLOW_FORBIDDEN_PUSH_KEYWORDS).toContain('notify');
    });

    it('should detect push keywords', () => {
      const result = checkForFlowPushKeywords('This will emit an event');
      expect(result.passed).toBe(false);
    });
  });

  describe('Forbidden State Machine Keywords', () => {
    it('should have forbidden state machine keywords', () => {
      expect(FLOW_FORBIDDEN_STATE_MACHINE_KEYWORDS).toContain('status');
      expect(FLOW_FORBIDDEN_STATE_MACHINE_KEYWORDS).toContain('workflow');
      expect(FLOW_FORBIDDEN_STATE_MACHINE_KEYWORDS).toContain('lifecycle');
    });

    it('should detect state machine keywords', () => {
      const result = checkForFlowStateMachineKeywords('Update the status');
      expect(result.passed).toBe(false);
    });
  });

  describe('Forbidden Import Sources', () => {
    it('should detect forbidden imports', () => {
      const result = checkForFlowForbiddenImport('../engine/GameEngine');
      expect(result.passed).toBe(false);
    });

    it('should pass for safe imports', () => {
      const result = checkForFlowForbiddenImport('./GreyFlowTypes');
      expect(result.passed).toBe(true);
    });
  });

  describe('Comprehensive Boundary Check', () => {
    it('should check all boundaries', () => {
      const result = checkAllFlowBoundaries('Execute money transfer and emit status update');
      expect(result.passed).toBe(false);
      expect(result.violationCount).toBeGreaterThan(2);
    });
  });

  describe('Assertion Functions', () => {
    it('should assert no financial keywords', () => {
      const result = assertNoFinancialKeywords('Clean analysis text');
      expect(result.success).toBe(true);
    });

    it('should fail for financial keywords', () => {
      const result = assertNoFinancialKeywords('Process payment');
      expect(result.success).toBe(false);
    });

    it('should assert all boundaries', () => {
      const cleanResult = assertAllFlowBoundaries('A simple ratio analysis');
      expect(cleanResult.success).toBe(true);

      const dirtyResult = assertAllFlowBoundaries('Trigger workflow to deduct balance');
      expect(dirtyResult.success).toBe(false);
    });
  });

  describe('Ratio/Unit Count Assertions', () => {
    it('should assert valid ratio', () => {
      const result = assertIsRatioOnly(0.5, 'testRatio');
      expect(result.success).toBe(true);
    });

    it('should reject negative ratio', () => {
      const result = assertIsRatioOnly(-0.1, 'testRatio');
      expect(result.success).toBe(false);
    });

    it('should assert valid unit count', () => {
      const result = assertIsUnitCount(100, 'testCount');
      expect(result.success).toBe(true);
    });

    it('should reject non-integer unit count', () => {
      const result = assertIsUnitCount(100.5, 'testCount');
      expect(result.success).toBe(false);
    });

    it('should reject negative unit count', () => {
      const result = assertIsUnitCount(-1, 'testCount');
      expect(result.success).toBe(false);
    });
  });

  describe('Module Constraints Documentation', () => {
    it('should document module constraints', () => {
      expect(FLOW_MODULE_DESIGN_CONSTRAINTS.name).toBe('grey-flow');
      expect(FLOW_MODULE_DESIGN_CONSTRAINTS.version).toBe('OPS-6');
      expect(FLOW_MODULE_DESIGN_CONSTRAINTS.constraints.length).toBeGreaterThan(0);
    });

    it('should document semantic boundaries', () => {
      expect(FLOW_MODULE_DESIGN_CONSTRAINTS.semanticBoundaries.flow).toContain('NOT money');
      expect(FLOW_MODULE_DESIGN_CONSTRAINTS.semanticBoundaries.rake).toContain('NOT deduction');
    });

    it('should list all forbidden concepts', () => {
      expect(FLOW_MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.financial).toBeDefined();
      expect(FLOW_MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.execution).toBeDefined();
      expect(FLOW_MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.push).toBeDefined();
      expect(FLOW_MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.stateMachine).toBeDefined();
    });
  });
});

// ============================================================================
// DESIGN CONSTRAINT VERIFICATION TESTS
// ============================================================================

describe('Design Constraint Verification', () => {
  it('should NOT have any execution methods in registries', () => {
    const registry = createTestFlowRegistry();
    const linker = createTestFlowLinker();

    expect((registry as unknown as Record<string, unknown>)['execute']).toBeUndefined();
    expect((registry as unknown as Record<string, unknown>)['trigger']).toBeUndefined();
    expect((registry as unknown as Record<string, unknown>)['process']).toBeUndefined();
    expect((linker as unknown as Record<string, unknown>)['execute']).toBeUndefined();
  });

  it('should NOT have any push/emit methods in registries', () => {
    const registry = createTestFlowRegistry();
    const linker = createTestFlowLinker();

    expect((registry as unknown as Record<string, unknown>)['push']).toBeUndefined();
    expect((registry as unknown as Record<string, unknown>)['emit']).toBeUndefined();
    expect((linker as unknown as Record<string, unknown>)['notify']).toBeUndefined();
  });

  it('should NOT have any delete/modify methods in registries', () => {
    const registry = createTestFlowRegistry();
    const linker = createTestFlowLinker();

    expect((registry as unknown as Record<string, unknown>)['delete']).toBeUndefined();
    expect((registry as unknown as Record<string, unknown>)['update']).toBeUndefined();
    expect((linker as unknown as Record<string, unknown>)['delete']).toBeUndefined();
  });

  it('should return frozen data from all query methods', () => {
    const registry = createTestFlowRegistry();

    registry.recordFlow(createTestFlowInput({ timestamp: 1000 }));

    expect(Object.isFrozen(registry.getAllRecords())).toBe(true);
    expect(Object.isFrozen(registry.getState())).toBe(true);
  });

  it('should use FlowDirection as classification, not status', () => {
    expect(FlowDirection.INBOUND).toBeDefined();
    expect(FlowDirection.OUTBOUND).toBeDefined();
    expect(FlowDirection.INTERNAL).toBeDefined();

    // Should NOT have status-like values
    expect((FlowDirection as unknown as Record<string, unknown>)['PENDING']).toBeUndefined();
    expect((FlowDirection as unknown as Record<string, unknown>)['PROCESSING']).toBeUndefined();
  });

  it('should use FlowSource as classification, not monetary source', () => {
    expect(FlowSource.TABLE).toBeDefined();
    expect(FlowSource.AGENT).toBeDefined();
    expect(FlowSource.CLUB).toBeDefined();

    // Should NOT have financial sources
    expect((FlowSource as unknown as Record<string, unknown>)['WALLET']).toBeUndefined();
    expect((FlowSource as unknown as Record<string, unknown>)['BANK']).toBeUndefined();
  });

  it('should use unitCount as count, NOT monetary value', () => {
    const registry = createTestFlowRegistry();
    const result = registry.recordFlow(createTestFlowInput({ unitCount: 100 }));

    expect(result.success).toBe(true);
    if (result.success) {
      // Field is named unitCount, not amount/value/balance
      expect(result.value.unitCount).toBe(100);
      expect((result.value as unknown as Record<string, unknown>)['amount']).toBeUndefined();
      expect((result.value as unknown as Record<string, unknown>)['balance']).toBeUndefined();
    }
  });

  it('should compute ratios, NOT fees or deductions', () => {
    const registry = createTestFlowRegistry();

    registry.recordFlow(createTestFlowInput({
      direction: FlowDirection.INBOUND,
      unitCount: 100,
      timestamp: 1000,
    }));
    registry.recordFlow(createTestFlowInput({
      direction: FlowDirection.OUTBOUND,
      unitCount: 30,
      timestamp: 2000,
    }));

    const records = registry.getAllRecords();
    const ratios = computeRakeRatioAggregation(records);

    // Ratios are non-negative indices
    expect(ratios.outboundToInboundRatio).toBeGreaterThanOrEqual(0);
    expect(ratios.internalToTotalRatio).toBeGreaterThanOrEqual(0);
    expect(ratios.netFlowRatio).toBeDefined();

    // No fee/deduction fields
    expect((ratios as unknown as Record<string, unknown>)['fee']).toBeUndefined();
    expect((ratios as unknown as Record<string, unknown>)['deduction']).toBeUndefined();
    expect((ratios as unknown as Record<string, unknown>)['charge']).toBeUndefined();
  });
});

// ============================================================================
// SEMANTIC BOUNDARY TESTS
// ============================================================================

describe('Semantic Boundary Verification', () => {
  it('"Flow" is count and ratio, NOT money amount', () => {
    const registry = createTestFlowRegistry();

    // GreyFlowRecord has unitCount, not monetary fields
    const result = registry.recordFlow(createTestFlowInput({ unitCount: 100 }));

    expect(result.success).toBe(true);
    if (result.success) {
      // Verify no monetary field names
      const record = result.value;
      expect(record.unitCount).toBeDefined();
      expect((record as any).money).toBeUndefined();
      expect((record as any).amount).toBeUndefined();
      expect((record as any).balance).toBeUndefined();
      expect((record as any).value).toBeUndefined();
    }
  });

  it('"Rake" is ratio/share/index, NOT fee/deduction', () => {
    const registry = createTestFlowRegistry();

    registry.recordFlow(createTestFlowInput({
      direction: FlowDirection.INBOUND,
      unitCount: 1000,
      timestamp: 1000,
    }));
    registry.recordFlow(createTestFlowInput({
      direction: FlowDirection.OUTBOUND,
      unitCount: 50,
      timestamp: 2000,
    }));

    const records = registry.getAllRecords();
    const ratios = computeRakeRatioAggregation(records);

    // All fields are ratios/indices
    expect(typeof ratios.outboundToInboundRatio).toBe('number');
    expect(typeof ratios.internalToTotalRatio).toBe('number');
    expect(typeof ratios.netFlowRatio).toBe('number');
    expect(typeof ratios.averageUnitsPerFlow).toBe('number');

    // entityActivityIndex is also ratios
    expect(Object.values(ratios.entityActivityIndex).every(v => typeof v === 'number')).toBe(true);
  });

  it('All outputs are analysis results, no side effects', () => {
    const registry = createTestFlowRegistry();

    // Record some flows
    const input1 = createTestFlowInput({ timestamp: 1000 });
    const input2 = createTestFlowInput({ timestamp: 2000 });

    registry.recordFlow(input1);
    registry.recordFlow(input2);

    // All query/aggregation functions return frozen data
    const records = registry.getAllRecords();
    const volume = computeVolumeAggregation(records);
    const frequency = computeFrequencyAggregation(records);
    const distribution = computeDistributionAggregation(records);
    const ratios = computeRakeRatioAggregation(records);

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(volume)).toBe(true);
    expect(Object.isFrozen(frequency)).toBe(true);
    expect(Object.isFrozen(distribution)).toBe(true);
    expect(Object.isFrozen(ratios)).toBe(true);

    // Original registry state unchanged after queries
    expect(registry.getRecordCount()).toBe(2);
  });
});
