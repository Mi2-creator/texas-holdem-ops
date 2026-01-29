/**
 * ExecutionIntent.test.ts
 *
 * Tests for OPS-5: External Manual Execution Intent Interface
 *
 * Tests verify:
 * - Append-only, hash-chained registry behavior
 * - Immutable record creation
 * - Evidence binding (reference-only)
 * - Report recording (human-asserted)
 * - Read-only views
 * - Boundary guard validation
 * - NO execution, push, or blocking behavior
 */

// Intent Types
import {
  createIntentId,
  createEvidenceId,
  createOperatorId,
  IntentType,
  EvidenceType,
  IntentErrorCode,
  INTENT_GENESIS_HASH,
  computeIntentHash,
  computeIntentId,
  isValidEvidenceReference,
  isValidIntentInput,
  type ExecutionIntentInput,
  type EvidenceReference,
} from '../execution-intent/ExecutionIntentTypes';

// Intent Registry
import {
  ExecutionIntentRegistry,
  createTestIntentRegistry,
} from '../execution-intent/ExecutionIntentRegistry';

// Evidence Binder
import {
  createRiskSignalRef,
  createRiskAckRef,
  createApprovalRef,
  createRechargeRef,
  createGreyFlowRef,
  getEvidenceBindingSummary,
  getCrossReferenceSummary,
  getAllCrossReferences,
  filterIntentsByEvidenceType,
  getUniqueEvidenceIds,
  countEvidenceByType,
} from '../execution-intent/ExecutionEvidenceBinder';

// Report Types
import {
  createReportId,
  createReportHash,
  ReportedOutcome,
  ReportErrorCode,
  REPORT_GENESIS_HASH,
  computeReportHash,
  isValidReportInput,
  type ExecutionReportInput,
} from '../execution-intent/ExecutionReportTypes';

// Report Registry
import {
  ExecutionReportRegistry,
  createTestReportRegistry,
} from '../execution-intent/ExecutionReportRegistry';

// Views
import {
  getIntentWithReports,
  getAllIntentsWithReports,
  getIntentSummary,
  getOperatorActivity,
  getRegistryStatistics,
  getIntentsWithoutReports,
  getIntentsWithCompletedReports,
} from '../execution-intent/ExecutionIntentViews';

// Boundary Guards
import {
  FORBIDDEN_EXECUTION_KEYWORDS,
  FORBIDDEN_PUSH_KEYWORDS,
  FORBIDDEN_BLOCKING_KEYWORDS,
  FORBIDDEN_STATE_MACHINE_KEYWORDS,
  checkForExecutionKeywords,
  checkForPushKeywords,
  checkForBlockingKeywords,
  checkForStateMachineKeywords,
  checkForForbiddenImport,
  checkAllBoundaries,
  assertNoExecutionKeywords,
  assertAllBoundaries,
  MODULE_DESIGN_CONSTRAINTS,
} from '../execution-intent/ExecutionIntentBoundaryGuards';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestOperatorId(name: string = 'operator1'): ReturnType<typeof createOperatorId> {
  return createOperatorId(name);
}

function createTestEvidenceRef(): EvidenceReference {
  return createRiskSignalRef('signal-123', 'Test risk signal');
}

function createTestIntentInput(overrides?: Partial<ExecutionIntentInput>): ExecutionIntentInput {
  return {
    intentType: IntentType.REVIEW,
    recommendation: 'Review this flagged transaction',
    evidenceRefs: [createTestEvidenceRef()],
    createdBy: createTestOperatorId(),
    timestamp: Date.now(),
    context: 'Test context',
    ...overrides,
  };
}

function createTestReportInput(
  intentId: ReturnType<typeof createIntentId>,
  overrides?: Partial<ExecutionReportInput>
): ExecutionReportInput {
  return {
    intentId,
    reportedOutcome: ReportedOutcome.COMPLETED,
    notes: 'Completed the recommended action',
    reportedBy: createTestOperatorId(),
    timestamp: Date.now(),
    externalRef: 'TICKET-123',
    ...overrides,
  };
}

// ============================================================================
// INTENT TYPES TESTS
// ============================================================================

describe('ExecutionIntentTypes', () => {
  describe('ID Factories', () => {
    it('should create valid intent ID', () => {
      const id = createIntentId('test-intent-1');
      expect(id).toBe('test-intent-1');
    });

    it('should throw for empty intent ID', () => {
      expect(() => createIntentId('')).toThrow();
    });

    it('should create valid evidence ID', () => {
      const id = createEvidenceId('evidence-1');
      expect(id).toBe('evidence-1');
    });

    it('should create valid operator ID', () => {
      const id = createOperatorId('operator-1');
      expect(id).toBe('operator-1');
    });
  });

  describe('Hash Utilities', () => {
    it('should compute deterministic hash', () => {
      const hash1 = computeIntentHash('test data');
      const hash2 = computeIntentHash('test data');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', () => {
      const hash1 = computeIntentHash('data1');
      const hash2 = computeIntentHash('data2');
      expect(hash1).not.toBe(hash2);
    });

    it('should compute intent ID deterministically', () => {
      const id1 = computeIntentId(IntentType.REVIEW, createTestOperatorId(), 1000);
      const id2 = computeIntentId(IntentType.REVIEW, createTestOperatorId(), 1000);
      expect(id1).toBe(id2);
    });

    it('should have 64-character genesis hash', () => {
      expect(INTENT_GENESIS_HASH.length).toBe(64);
    });
  });

  describe('Validation', () => {
    it('should validate correct evidence reference', () => {
      const ref = createTestEvidenceRef();
      expect(isValidEvidenceReference(ref)).toBe(true);
    });

    it('should reject invalid evidence reference', () => {
      const ref = { evidenceId: '', evidenceType: 'INVALID' } as unknown as EvidenceReference;
      expect(isValidEvidenceReference(ref)).toBe(false);
    });

    it('should validate correct intent input', () => {
      const input = createTestIntentInput();
      expect(isValidIntentInput(input)).toBe(true);
    });

    it('should reject intent input without evidence', () => {
      const input = createTestIntentInput({ evidenceRefs: [] });
      expect(isValidIntentInput(input)).toBe(false);
    });

    it('should reject intent input with invalid timestamp', () => {
      const input = createTestIntentInput({ timestamp: -1 });
      expect(isValidIntentInput(input)).toBe(false);
    });
  });
});

// ============================================================================
// INTENT REGISTRY TESTS
// ============================================================================

describe('ExecutionIntentRegistry', () => {
  let registry: ExecutionIntentRegistry;

  beforeEach(() => {
    registry = createTestIntentRegistry();
  });

  describe('Record Creation', () => {
    it('should record intent successfully', () => {
      const input = createTestIntentInput();
      const result = registry.recordIntent(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.intentId).toBeDefined();
        expect(result.value.intentType).toBe(IntentType.REVIEW);
        expect(result.value.sequenceNumber).toBe(1);
        expect(result.value.previousHash).toBe(INTENT_GENESIS_HASH);
      }
    });

    it('should create frozen records', () => {
      const input = createTestIntentInput();
      const result = registry.recordIntent(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.isFrozen(result.value)).toBe(true);
      }
    });

    it('should reject duplicate intents', () => {
      const timestamp = Date.now();
      const input = createTestIntentInput({ timestamp });

      const result1 = registry.recordIntent(input);
      expect(result1.success).toBe(true);

      const result2 = registry.recordIntent(input);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.code).toBe(IntentErrorCode.DUPLICATE_INTENT);
      }
    });

    it('should reject intent without evidence', () => {
      const input = createTestIntentInput({ evidenceRefs: [] });
      const result = registry.recordIntent(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        // Empty evidenceRefs fails validation first, so INVALID_INPUT is returned
        // If validation passes but evidenceRefs is checked separately, MISSING_EVIDENCE would be returned
        expect([IntentErrorCode.INVALID_INPUT, IntentErrorCode.MISSING_EVIDENCE]).toContain(result.error.code);
      }
    });
  });

  describe('Hash Chain', () => {
    it('should link records in hash chain', () => {
      const input1 = createTestIntentInput({ timestamp: 1000 });
      const input2 = createTestIntentInput({ timestamp: 2000 });

      const result1 = registry.recordIntent(input1);
      const result2 = registry.recordIntent(input2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result2.value.previousHash).toBe(result1.value.recordHash);
      }
    });

    it('should verify chain integrity', () => {
      registry.recordIntent(createTestIntentInput({ timestamp: 1000 }));
      registry.recordIntent(createTestIntentInput({ timestamp: 2000 }));
      registry.recordIntent(createTestIntentInput({ timestamp: 3000 }));

      const result = registry.verifyChainIntegrity();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe('Querying', () => {
    it('should get record by ID', () => {
      const input = createTestIntentInput();
      const result = registry.recordIntent(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const record = registry.getRecord(result.value.intentId);
        expect(record).toBeDefined();
        expect(record?.intentId).toBe(result.value.intentId);
      }
    });

    it('should get records by operator', () => {
      const operator = createTestOperatorId('op1');
      registry.recordIntent(createTestIntentInput({ createdBy: operator, timestamp: 1000 }));
      registry.recordIntent(createTestIntentInput({ createdBy: operator, timestamp: 2000 }));
      registry.recordIntent(createTestIntentInput({ createdBy: createTestOperatorId('op2'), timestamp: 3000 }));

      const records = registry.getRecordsByOperator(operator);
      expect(records.length).toBe(2);
    });

    it('should get records by type', () => {
      registry.recordIntent(createTestIntentInput({ intentType: IntentType.REVIEW, timestamp: 1000 }));
      registry.recordIntent(createTestIntentInput({ intentType: IntentType.ESCALATE, timestamp: 2000 }));
      registry.recordIntent(createTestIntentInput({ intentType: IntentType.REVIEW, timestamp: 3000 }));

      const records = registry.getRecordsByType(IntentType.REVIEW);
      expect(records.length).toBe(2);
    });

    it('should filter by time range', () => {
      registry.recordIntent(createTestIntentInput({ timestamp: 1000 }));
      registry.recordIntent(createTestIntentInput({ timestamp: 2000 }));
      registry.recordIntent(createTestIntentInput({ timestamp: 3000 }));

      const records = registry.getAllRecords({ fromTimestamp: 1500, toTimestamp: 2500 });
      expect(records.length).toBe(1);
    });

    it('should support pagination', () => {
      for (let i = 0; i < 10; i++) {
        registry.recordIntent(createTestIntentInput({ timestamp: 1000 + i }));
      }

      const page1 = registry.getAllRecords({ offset: 0, limit: 3 });
      const page2 = registry.getAllRecords({ offset: 3, limit: 3 });

      expect(page1.length).toBe(3);
      expect(page2.length).toBe(3);
    });
  });

  describe('State', () => {
    it('should return registry state snapshot', () => {
      registry.recordIntent(createTestIntentInput({ timestamp: 1000 }));
      registry.recordIntent(createTestIntentInput({ timestamp: 2000 }));

      const state = registry.getState();
      expect(state.recordCount).toBe(2);
      expect(state.currentSequence).toBe(2);
      expect(Object.isFrozen(state)).toBe(true);
    });
  });
});

// ============================================================================
// EVIDENCE BINDER TESTS
// ============================================================================

describe('ExecutionEvidenceBinder', () => {
  describe('Reference Factories', () => {
    it('should create risk signal reference', () => {
      const ref = createRiskSignalRef('signal-1', 'Description');
      expect(ref.evidenceType).toBe(EvidenceType.RISK_SIGNAL);
      expect(ref.evidenceId).toBe('signal-1');
      expect(Object.isFrozen(ref)).toBe(true);
    });

    it('should create risk ack reference', () => {
      const ref = createRiskAckRef('ack-1');
      expect(ref.evidenceType).toBe(EvidenceType.RISK_ACK);
    });

    it('should create approval reference', () => {
      const ref = createApprovalRef('approval-1');
      expect(ref.evidenceType).toBe(EvidenceType.APPROVAL);
    });

    it('should create recharge reference', () => {
      const ref = createRechargeRef('recharge-1');
      expect(ref.evidenceType).toBe(EvidenceType.RECHARGE);
    });

    it('should create grey flow reference', () => {
      const ref = createGreyFlowRef('flow-1');
      expect(ref.evidenceType).toBe(EvidenceType.GREY_FLOW);
    });
  });

  describe('Binding Queries', () => {
    let registry: ExecutionIntentRegistry;

    beforeEach(() => {
      registry = createTestIntentRegistry();
    });

    it('should get evidence binding summary', () => {
      const input = createTestIntentInput({
        evidenceRefs: [
          createRiskSignalRef('signal-1'),
          createRiskAckRef('ack-1'),
        ],
      });
      const result = registry.recordIntent(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const summary = getEvidenceBindingSummary(result.value);
        expect(summary.totalReferences).toBe(2);
        expect(summary.byType[EvidenceType.RISK_SIGNAL]).toBe(1);
        expect(summary.byType[EvidenceType.RISK_ACK]).toBe(1);
        expect(Object.isFrozen(summary)).toBe(true);
      }
    });

    it('should get cross references', () => {
      const sharedSignalId = createEvidenceId('shared-signal');
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [{ evidenceId: sharedSignalId, evidenceType: EvidenceType.RISK_SIGNAL }],
        timestamp: 1000,
      }));
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [{ evidenceId: sharedSignalId, evidenceType: EvidenceType.RISK_SIGNAL }],
        timestamp: 2000,
      }));

      const records = registry.getAllRecords();
      const crossRef = getCrossReferenceSummary(records, sharedSignalId);

      expect(crossRef).toBeDefined();
      expect(crossRef?.intentCount).toBe(2);
    });

    it('should get all cross references', () => {
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [createRiskSignalRef('signal-1')],
        timestamp: 1000,
      }));
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [createRiskSignalRef('signal-2')],
        timestamp: 2000,
      }));

      const records = registry.getAllRecords();
      const allRefs = getAllCrossReferences(records);

      expect(allRefs.length).toBe(2);
    });

    it('should filter intents by evidence type', () => {
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [createRiskSignalRef('signal-1')],
        timestamp: 1000,
      }));
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [createApprovalRef('approval-1')],
        timestamp: 2000,
      }));

      const records = registry.getAllRecords();
      const filtered = filterIntentsByEvidenceType(records, EvidenceType.RISK_SIGNAL);

      expect(filtered.length).toBe(1);
    });

    it('should get unique evidence IDs', () => {
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [createRiskSignalRef('signal-1'), createRiskSignalRef('signal-2')],
        timestamp: 1000,
      }));
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [createRiskSignalRef('signal-1')],
        timestamp: 2000,
      }));

      const records = registry.getAllRecords();
      const uniqueIds = getUniqueEvidenceIds(records);

      expect(uniqueIds.length).toBe(2);
    });

    it('should count evidence by type', () => {
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [createRiskSignalRef('signal-1'), createRiskAckRef('ack-1')],
        timestamp: 1000,
      }));
      registry.recordIntent(createTestIntentInput({
        evidenceRefs: [createRiskSignalRef('signal-2')],
        timestamp: 2000,
      }));

      const records = registry.getAllRecords();
      const counts = countEvidenceByType(records);

      expect(counts[EvidenceType.RISK_SIGNAL]).toBe(2);
      expect(counts[EvidenceType.RISK_ACK]).toBe(1);
    });
  });
});

// ============================================================================
// REPORT TYPES TESTS
// ============================================================================

describe('ExecutionReportTypes', () => {
  describe('ID Factories', () => {
    it('should create valid report ID', () => {
      const id = createReportId('report-1');
      expect(id).toBe('report-1');
    });

    it('should create valid report hash', () => {
      const hash = createReportHash('abc123');
      expect(hash).toBe('abc123');
    });
  });

  describe('Hash Utilities', () => {
    it('should compute deterministic report hash', () => {
      const hash1 = computeReportHash('report data');
      const hash2 = computeReportHash('report data');
      expect(hash1).toBe(hash2);
    });

    it('should have 64-character genesis hash', () => {
      expect(REPORT_GENESIS_HASH.length).toBe(64);
    });
  });

  describe('Validation', () => {
    it('should validate correct report input', () => {
      const input = createTestReportInput(createIntentId('intent-1'));
      expect(isValidReportInput(input)).toBe(true);
    });

    it('should reject report input with empty notes', () => {
      const input = createTestReportInput(createIntentId('intent-1'), { notes: '' });
      expect(isValidReportInput(input)).toBe(false);
    });

    it('should reject report input with invalid outcome', () => {
      const input = {
        ...createTestReportInput(createIntentId('intent-1')),
        reportedOutcome: 'INVALID' as ReportedOutcome,
      };
      expect(isValidReportInput(input)).toBe(false);
    });
  });
});

// ============================================================================
// REPORT REGISTRY TESTS
// ============================================================================

describe('ExecutionReportRegistry', () => {
  let registry: ExecutionReportRegistry;

  beforeEach(() => {
    registry = createTestReportRegistry();
  });

  describe('Record Creation', () => {
    it('should record report successfully', () => {
      const input = createTestReportInput(createIntentId('intent-1'));
      const result = registry.recordReport(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.reportId).toBeDefined();
        expect(result.value.reportedOutcome).toBe(ReportedOutcome.COMPLETED);
        expect(result.value.sequenceNumber).toBe(1);
      }
    });

    it('should create frozen records', () => {
      const input = createTestReportInput(createIntentId('intent-1'));
      const result = registry.recordReport(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.isFrozen(result.value)).toBe(true);
      }
    });

    it('should reject duplicate reports', () => {
      const timestamp = Date.now();
      const input = createTestReportInput(createIntentId('intent-1'), { timestamp });

      const result1 = registry.recordReport(input);
      expect(result1.success).toBe(true);

      const result2 = registry.recordReport(input);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.code).toBe(ReportErrorCode.DUPLICATE_REPORT);
      }
    });
  });

  describe('Hash Chain', () => {
    it('should link reports in hash chain', () => {
      const input1 = createTestReportInput(createIntentId('intent-1'), { timestamp: 1000 });
      const input2 = createTestReportInput(createIntentId('intent-2'), { timestamp: 2000 });

      const result1 = registry.recordReport(input1);
      const result2 = registry.recordReport(input2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result2.value.previousHash).toBe(result1.value.recordHash);
      }
    });

    it('should verify chain integrity', () => {
      registry.recordReport(createTestReportInput(createIntentId('intent-1'), { timestamp: 1000 }));
      registry.recordReport(createTestReportInput(createIntentId('intent-2'), { timestamp: 2000 }));

      const result = registry.verifyChainIntegrity();
      expect(result.success).toBe(true);
    });
  });

  describe('Querying', () => {
    it('should get reports by intent', () => {
      const intentId = createIntentId('intent-1');
      registry.recordReport(createTestReportInput(intentId, { timestamp: 1000 }));
      registry.recordReport(createTestReportInput(intentId, { timestamp: 2000 }));
      registry.recordReport(createTestReportInput(createIntentId('intent-2'), { timestamp: 3000 }));

      const reports = registry.getReportsByIntent(intentId);
      expect(reports.length).toBe(2);
    });

    it('should get reports by outcome', () => {
      registry.recordReport(createTestReportInput(createIntentId('i1'), {
        reportedOutcome: ReportedOutcome.COMPLETED,
        timestamp: 1000,
      }));
      registry.recordReport(createTestReportInput(createIntentId('i2'), {
        reportedOutcome: ReportedOutcome.BLOCKED,
        timestamp: 2000,
      }));
      registry.recordReport(createTestReportInput(createIntentId('i3'), {
        reportedOutcome: ReportedOutcome.COMPLETED,
        timestamp: 3000,
      }));

      const reports = registry.getReportsByOutcome(ReportedOutcome.COMPLETED);
      expect(reports.length).toBe(2);
    });

    it('should get latest report for intent', () => {
      const intentId = createIntentId('intent-1');
      registry.recordReport(createTestReportInput(intentId, {
        reportedOutcome: ReportedOutcome.PARTIAL,
        timestamp: 1000,
      }));
      registry.recordReport(createTestReportInput(intentId, {
        reportedOutcome: ReportedOutcome.COMPLETED,
        timestamp: 2000,
      }));

      const latest = registry.getLatestReportForIntent(intentId);
      expect(latest?.reportedOutcome).toBe(ReportedOutcome.COMPLETED);
    });
  });
});

// ============================================================================
// VIEWS TESTS
// ============================================================================

describe('ExecutionIntentViews', () => {
  let intentRegistry: ExecutionIntentRegistry;
  let reportRegistry: ExecutionReportRegistry;

  beforeEach(() => {
    intentRegistry = createTestIntentRegistry();
    reportRegistry = createTestReportRegistry();
  });

  describe('Intent with Reports', () => {
    it('should get intent with its reports', () => {
      const intentResult = intentRegistry.recordIntent(createTestIntentInput({ timestamp: 1000 }));
      expect(intentResult.success).toBe(true);
      if (!intentResult.success) return;

      reportRegistry.recordReport(createTestReportInput(intentResult.value.intentId, { timestamp: 2000 }));

      const view = getIntentWithReports(intentRegistry, reportRegistry, intentResult.value.intentId);

      expect(view).toBeDefined();
      expect(view?.intent.intentId).toBe(intentResult.value.intentId);
      expect(view?.reports.length).toBe(1);
      expect(view?.hasReports).toBe(true);
    });

    it('should get all intents with reports', () => {
      const result1 = intentRegistry.recordIntent(createTestIntentInput({ timestamp: 1000 }));
      const result2 = intentRegistry.recordIntent(createTestIntentInput({ timestamp: 2000 }));

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (!result1.success || !result2.success) return;

      reportRegistry.recordReport(createTestReportInput(result1.value.intentId, { timestamp: 3000 }));

      const views = getAllIntentsWithReports(intentRegistry, reportRegistry);

      expect(views.length).toBe(2);
      expect(views[0].hasReports).toBe(true);
      expect(views[1].hasReports).toBe(false);
    });
  });

  describe('Intent Summary', () => {
    it('should get intent summary', () => {
      const intentResult = intentRegistry.recordIntent(createTestIntentInput({ timestamp: 1000 }));
      expect(intentResult.success).toBe(true);
      if (!intentResult.success) return;

      const summary = getIntentSummary(intentRegistry, reportRegistry, intentResult.value.intentId);

      expect(summary).toBeDefined();
      expect(summary?.intentType).toBe(IntentType.REVIEW);
      expect(summary?.evidenceCount).toBe(1);
    });

    it('should truncate long recommendations', () => {
      const longRecommendation = 'A'.repeat(200);
      const intentResult = intentRegistry.recordIntent(createTestIntentInput({
        recommendation: longRecommendation,
        timestamp: 1000,
      }));
      expect(intentResult.success).toBe(true);
      if (!intentResult.success) return;

      const summary = getIntentSummary(intentRegistry, reportRegistry, intentResult.value.intentId);

      expect(summary?.recommendationPreview.length).toBeLessThan(longRecommendation.length);
      expect(summary?.recommendationPreview.endsWith('...')).toBe(true);
    });
  });

  describe('Operator Activity', () => {
    it('should get operator activity', () => {
      const operator = createTestOperatorId('op1');

      intentRegistry.recordIntent(createTestIntentInput({ createdBy: operator, timestamp: 1000 }));
      intentRegistry.recordIntent(createTestIntentInput({ createdBy: operator, timestamp: 2000 }));

      const intentResult = intentRegistry.recordIntent(createTestIntentInput({
        createdBy: createTestOperatorId('op2'),
        timestamp: 3000,
      }));
      expect(intentResult.success).toBe(true);
      if (!intentResult.success) return;

      reportRegistry.recordReport(createTestReportInput(intentResult.value.intentId, {
        reportedBy: operator,
        timestamp: 4000,
      }));

      const activity = getOperatorActivity(intentRegistry, reportRegistry, operator);

      expect(activity.intentCount).toBe(2);
      expect(activity.reportCount).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should get registry statistics', () => {
      intentRegistry.recordIntent(createTestIntentInput({ intentType: IntentType.REVIEW, timestamp: 1000 }));
      intentRegistry.recordIntent(createTestIntentInput({ intentType: IntentType.ESCALATE, timestamp: 2000 }));

      const intentResult = intentRegistry.recordIntent(createTestIntentInput({
        intentType: IntentType.REVIEW,
        timestamp: 3000,
      }));
      expect(intentResult.success).toBe(true);
      if (!intentResult.success) return;

      reportRegistry.recordReport(createTestReportInput(intentResult.value.intentId, {
        reportedOutcome: ReportedOutcome.COMPLETED,
        timestamp: 4000,
      }));

      const stats = getRegistryStatistics(intentRegistry, reportRegistry);

      expect(stats.totalIntents).toBe(3);
      expect(stats.totalReports).toBe(1);
      expect(stats.intentsByType[IntentType.REVIEW]).toBe(2);
      expect(stats.intentsWithReports).toBe(1);
      expect(stats.intentsWithoutReports).toBe(2);
    });
  });

  describe('Filtering', () => {
    it('should get intents without reports', () => {
      const result1 = intentRegistry.recordIntent(createTestIntentInput({ timestamp: 1000 }));
      intentRegistry.recordIntent(createTestIntentInput({ timestamp: 2000 }));

      expect(result1.success).toBe(true);
      if (!result1.success) return;

      reportRegistry.recordReport(createTestReportInput(result1.value.intentId, { timestamp: 3000 }));

      const intentsWithoutReports = getIntentsWithoutReports(intentRegistry, reportRegistry);

      expect(intentsWithoutReports.length).toBe(1);
    });

    it('should get intents with completed reports', () => {
      const result1 = intentRegistry.recordIntent(createTestIntentInput({ timestamp: 1000 }));
      const result2 = intentRegistry.recordIntent(createTestIntentInput({ timestamp: 2000 }));

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (!result1.success || !result2.success) return;

      reportRegistry.recordReport(createTestReportInput(result1.value.intentId, {
        reportedOutcome: ReportedOutcome.COMPLETED,
        timestamp: 3000,
      }));
      reportRegistry.recordReport(createTestReportInput(result2.value.intentId, {
        reportedOutcome: ReportedOutcome.BLOCKED,
        timestamp: 4000,
      }));

      const completedIntents = getIntentsWithCompletedReports(intentRegistry, reportRegistry);

      expect(completedIntents.length).toBe(1);
    });
  });
});

// ============================================================================
// BOUNDARY GUARDS TESTS
// ============================================================================

describe('ExecutionIntentBoundaryGuards', () => {
  describe('Forbidden Keywords', () => {
    it('should have forbidden execution keywords', () => {
      expect(FORBIDDEN_EXECUTION_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_EXECUTION_KEYWORDS).toContain('execute');
      expect(FORBIDDEN_EXECUTION_KEYWORDS).toContain('trigger');
    });

    it('should have forbidden push keywords', () => {
      expect(FORBIDDEN_PUSH_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_PUSH_KEYWORDS).toContain('push');
      expect(FORBIDDEN_PUSH_KEYWORDS).toContain('emit');
    });

    it('should have forbidden blocking keywords', () => {
      expect(FORBIDDEN_BLOCKING_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_BLOCKING_KEYWORDS).toContain('block');
      expect(FORBIDDEN_BLOCKING_KEYWORDS).toContain('prevent');
    });

    it('should have forbidden state machine keywords', () => {
      expect(FORBIDDEN_STATE_MACHINE_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_STATE_MACHINE_KEYWORDS).toContain('status');
      expect(FORBIDDEN_STATE_MACHINE_KEYWORDS).toContain('workflow');
    });
  });

  describe('Check Functions', () => {
    it('should detect execution keywords', () => {
      const result = checkForExecutionKeywords('This will execute the action');
      expect(result.passed).toBe(false);
      expect(result.violationCount).toBeGreaterThan(0);
    });

    it('should pass for clean text', () => {
      const result = checkForExecutionKeywords('This is a recommendation');
      expect(result.passed).toBe(true);
    });

    it('should detect push keywords', () => {
      const result = checkForPushKeywords('This will emit an event');
      expect(result.passed).toBe(false);
    });

    it('should detect blocking keywords', () => {
      const result = checkForBlockingKeywords('This will block the action');
      expect(result.passed).toBe(false);
    });

    it('should detect state machine keywords', () => {
      const result = checkForStateMachineKeywords('Update the status to pending');
      expect(result.passed).toBe(false);
    });

    it('should detect forbidden imports', () => {
      const result = checkForForbiddenImport('../engine/GameEngine');
      expect(result.passed).toBe(false);
    });

    it('should pass for safe imports', () => {
      // Use a path that doesn't contain any forbidden source keywords
      const result = checkForForbiddenImport('./RiskAckTypes');
      expect(result.passed).toBe(true);
    });

    it('should check all boundaries', () => {
      const result = checkAllBoundaries('Execute and emit status update');
      expect(result.passed).toBe(false);
      expect(result.violationCount).toBeGreaterThan(2);
    });
  });

  describe('Assertion Functions', () => {
    it('should return success for clean text', () => {
      const result = assertNoExecutionKeywords('Review this recommendation');
      expect(result.success).toBe(true);
    });

    it('should return failure for violations', () => {
      const result = assertNoExecutionKeywords('Execute this command');
      expect(result.success).toBe(false);
    });

    it('should assert all boundaries', () => {
      const cleanResult = assertAllBoundaries('A simple recommendation text');
      expect(cleanResult.success).toBe(true);

      const dirtyResult = assertAllBoundaries('Trigger the workflow status transition');
      expect(dirtyResult.success).toBe(false);
    });
  });

  describe('Module Constraints', () => {
    it('should document module constraints', () => {
      expect(MODULE_DESIGN_CONSTRAINTS.name).toBe('execution-intent');
      expect(MODULE_DESIGN_CONSTRAINTS.version).toBe('OPS-5');
      expect(MODULE_DESIGN_CONSTRAINTS.constraints.length).toBeGreaterThan(0);
    });

    it('should list all forbidden concepts', () => {
      expect(MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.execution).toBeDefined();
      expect(MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.push).toBeDefined();
      expect(MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.blocking).toBeDefined();
      expect(MODULE_DESIGN_CONSTRAINTS.forbiddenConcepts.stateMachine).toBeDefined();
    });
  });
});

// ============================================================================
// DESIGN CONSTRAINT VERIFICATION TESTS
// ============================================================================

describe('Design Constraint Verification', () => {
  it('should NOT have any execution methods in registries', () => {
    const intentRegistry = createTestIntentRegistry();
    const reportRegistry = createTestReportRegistry();

    // Verify no execute/trigger/dispatch methods exist
    expect((intentRegistry as unknown as Record<string, unknown>)['execute']).toBeUndefined();
    expect((intentRegistry as unknown as Record<string, unknown>)['trigger']).toBeUndefined();
    expect((intentRegistry as unknown as Record<string, unknown>)['dispatch']).toBeUndefined();
    expect((reportRegistry as unknown as Record<string, unknown>)['execute']).toBeUndefined();
    expect((reportRegistry as unknown as Record<string, unknown>)['trigger']).toBeUndefined();
  });

  it('should NOT have any push/emit methods in registries', () => {
    const intentRegistry = createTestIntentRegistry();
    const reportRegistry = createTestReportRegistry();

    expect((intentRegistry as unknown as Record<string, unknown>)['push']).toBeUndefined();
    expect((intentRegistry as unknown as Record<string, unknown>)['emit']).toBeUndefined();
    expect((intentRegistry as unknown as Record<string, unknown>)['notify']).toBeUndefined();
    expect((reportRegistry as unknown as Record<string, unknown>)['push']).toBeUndefined();
    expect((reportRegistry as unknown as Record<string, unknown>)['emit']).toBeUndefined();
  });

  it('should NOT have any delete/modify methods in registries', () => {
    const intentRegistry = createTestIntentRegistry();
    const reportRegistry = createTestReportRegistry();

    expect((intentRegistry as unknown as Record<string, unknown>)['delete']).toBeUndefined();
    expect((intentRegistry as unknown as Record<string, unknown>)['update']).toBeUndefined();
    expect((intentRegistry as unknown as Record<string, unknown>)['modify']).toBeUndefined();
    expect((reportRegistry as unknown as Record<string, unknown>)['delete']).toBeUndefined();
    expect((reportRegistry as unknown as Record<string, unknown>)['update']).toBeUndefined();
  });

  it('should return frozen data from all query methods', () => {
    const intentRegistry = createTestIntentRegistry();
    const reportRegistry = createTestReportRegistry();

    intentRegistry.recordIntent(createTestIntentInput({ timestamp: 1000 }));
    reportRegistry.recordReport(createTestReportInput(createIntentId('test'), { timestamp: 2000 }));

    expect(Object.isFrozen(intentRegistry.getAllRecords())).toBe(true);
    expect(Object.isFrozen(intentRegistry.getState())).toBe(true);
    expect(Object.isFrozen(reportRegistry.getAllReports())).toBe(true);
    expect(Object.isFrozen(reportRegistry.getState())).toBe(true);
  });

  it('should use IntentType as classification, not status', () => {
    // IntentType values should be action categories, not lifecycle states
    expect(IntentType.REVIEW).toBeDefined();
    expect(IntentType.CORRECTIVE).toBeDefined();
    expect(IntentType.ESCALATE).toBeDefined();
    expect(IntentType.INVESTIGATE).toBeDefined();
    expect(IntentType.DOCUMENT).toBeDefined();

    // Should NOT have status-like values
    expect((IntentType as unknown as Record<string, unknown>)['PENDING']).toBeUndefined();
    expect((IntentType as unknown as Record<string, unknown>)['PROCESSING']).toBeUndefined();
    expect((IntentType as unknown as Record<string, unknown>)['COMPLETED']).toBeUndefined();
    expect((IntentType as unknown as Record<string, unknown>)['FAILED']).toBeUndefined();
  });

  it('should use ReportedOutcome as human assertion, not verified status', () => {
    // ReportedOutcome values should be human claims
    expect(ReportedOutcome.COMPLETED).toBeDefined();
    expect(ReportedOutcome.PARTIAL).toBeDefined();
    expect(ReportedOutcome.BLOCKED).toBeDefined();
    expect(ReportedOutcome.NOT_NEEDED).toBeDefined();
    expect(ReportedOutcome.DEFERRED).toBeDefined();

    // These are CLAIMS, not verified statuses
    // The system records what humans assert, it does NOT verify
  });
});
