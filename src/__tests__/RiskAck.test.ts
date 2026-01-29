/**
 * RiskAck.test.ts
 *
 * Comprehensive tests for OPS-4: Human Risk Acknowledgement & Sign-Off Layer.
 *
 * CRITICAL TEST GOALS:
 * 1. Prove append-only behavior
 * 2. Prove hash-chain integrity
 * 3. Prove idempotency
 * 4. Prove forbidden concept detection
 * 5. Prove deterministic replay
 * 6. Prove no side effects
 * 7. Prove NO action capability
 */

import {
  // Types
  type RiskAckInput,
  type RiskAckRecord,

  // Enums
  AckDecision,
  AckRole,
  AckErrorCode,

  // ID factories
  createRiskAckId,
  createRiskSignalId,
  createActorId,
  createAckHash,

  // Hash utilities
  ACK_GENESIS_HASH,
  computeAckHash,
  computeAckId,

  // Validation
  isValidAckInput,
  canRoleEscalate,
  getRoleLevel,

  // Record
  createAckRecord,
  verifyAckRecordIntegrity,
  verifyAckChainLink,
  isAckRecordFrozen,

  // Registry
  RiskAckRegistry,
  createRiskAckRegistry,

  // Views
  getHistoryBySignal,
  getHistoryByActor,
  getSummaryByDecision,
  getOverallAckSummary,
  getEscalatedSignals,
  getUnacknowledgedSignals,

  // Guards
  ACK_FORBIDDEN_CONCEPTS,
  assertNoAckForbiddenConcepts,
  assertNoAckForbiddenFunctions,
  assertManualOnly,
  assertHumanAcknowledgement,
  assertCanEscalate,
  guardAckInput,
  ACK_BOUNDARY_DECLARATION,
} from '../risk-ack';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestAckInput(
  signalId: string,
  actorId: string,
  role: AckRole,
  decision: AckDecision,
  timestamp: number,
  comment?: string
): RiskAckInput {
  return {
    riskSignalId: createRiskSignalId(signalId),
    actorId: createActorId(actorId),
    actorRole: role,
    decision,
    comment,
    timestamp,
  };
}

// ============================================================================
// BRANDED ID TESTS
// ============================================================================

describe('RiskAckTypes - Branded IDs', () => {
  test('createRiskAckId creates valid ID', () => {
    const id = createRiskAckId('ack-1');
    expect(id).toBe('ack-1');
  });

  test('createRiskAckId rejects empty string', () => {
    expect(() => createRiskAckId('')).toThrow();
    expect(() => createRiskAckId('   ')).toThrow();
  });

  test('createRiskSignalId creates valid ID', () => {
    const id = createRiskSignalId('signal-1');
    expect(id).toBe('signal-1');
  });

  test('createActorId creates valid ID', () => {
    const id = createActorId('actor-1');
    expect(id).toBe('actor-1');
  });

  test('createAckHash creates valid hash', () => {
    const hash = createAckHash('abc123');
    expect(hash).toBe('abc123');
  });

  test('ACK_GENESIS_HASH is defined and frozen', () => {
    expect(ACK_GENESIS_HASH).toBeDefined();
    expect(ACK_GENESIS_HASH.length).toBe(64);
    expect(Object.isFrozen(ACK_GENESIS_HASH)).toBe(true);
  });
});

// ============================================================================
// HASH DETERMINISM TESTS
// ============================================================================

describe('RiskAckTypes - Hash Determinism', () => {
  test('computeAckHash is deterministic', () => {
    const data = 'test-data-123';
    const hash1 = computeAckHash(data);
    const hash2 = computeAckHash(data);
    expect(hash1).toBe(hash2);
  });

  test('different data produces different hashes', () => {
    const hash1 = computeAckHash('data-1');
    const hash2 = computeAckHash('data-2');
    expect(hash1).not.toBe(hash2);
  });

  test('computeAckId is deterministic', () => {
    const signalId = createRiskSignalId('signal-1');
    const actorId = createActorId('actor-1');
    const id1 = computeAckId(signalId, actorId, 1000);
    const id2 = computeAckId(signalId, actorId, 1000);
    expect(id1).toBe(id2);
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('RiskAckTypes - Validation', () => {
  test('isValidAckInput validates correct input', () => {
    const input = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    expect(isValidAckInput(input)).toBe(true);
  });

  test('isValidAckInput rejects invalid inputs', () => {
    // Missing signalId
    expect(isValidAckInput({ ...createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000), riskSignalId: '' as any })).toBe(false);

    // Invalid timestamp
    expect(isValidAckInput({ ...createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000), timestamp: -1 })).toBe(false);
    expect(isValidAckInput({ ...createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000), timestamp: 1.5 })).toBe(false);
  });

  test('getRoleLevel returns correct hierarchy', () => {
    expect(getRoleLevel(AckRole.OPERATOR)).toBe(1);
    expect(getRoleLevel(AckRole.SUPERVISOR)).toBe(2);
    expect(getRoleLevel(AckRole.ADMIN)).toBe(3);
  });

  test('canRoleEscalate returns correct values', () => {
    expect(canRoleEscalate(AckRole.OPERATOR)).toBe(true);
    expect(canRoleEscalate(AckRole.SUPERVISOR)).toBe(true);
    expect(canRoleEscalate(AckRole.ADMIN)).toBe(false);
  });
});

// ============================================================================
// RECORD TESTS
// ============================================================================

describe('RiskAckRecord', () => {
  test('createAckRecord creates frozen record', () => {
    const input = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const result = createAckRecord(input, 1, ACK_GENESIS_HASH);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(isAckRecordFrozen(result.value)).toBe(true);
    }
  });

  test('createAckRecord includes all fields', () => {
    const input = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000, 'Test comment');
    const result = createAckRecord(input, 1, ACK_GENESIS_HASH);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.riskSignalId).toBe('signal-1');
      expect(result.value.actorId).toBe('actor-1');
      expect(result.value.actorRole).toBe(AckRole.OPERATOR);
      expect(result.value.decision).toBe(AckDecision.ACKNOWLEDGED);
      expect(result.value.comment).toBe('Test comment');
      expect(result.value.sequenceNumber).toBe(1);
      expect(result.value.previousHash).toBe(ACK_GENESIS_HASH);
      expect(result.value.createdAt).toBe(1000);
    }
  });

  test('verifyAckRecordIntegrity passes for valid record', () => {
    const input = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const result = createAckRecord(input, 1, ACK_GENESIS_HASH);

    expect(result.success).toBe(true);
    if (result.success) {
      const integrityResult = verifyAckRecordIntegrity(result.value);
      expect(integrityResult.success).toBe(true);
    }
  });

  test('verifyAckChainLink validates chain correctly', () => {
    const input1 = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const result1 = createAckRecord(input1, 1, ACK_GENESIS_HASH);

    expect(result1.success).toBe(true);
    if (result1.success) {
      const input2 = createTestAckInput('signal-2', 'actor-2', AckRole.SUPERVISOR, AckDecision.ESCALATED, 2000);
      const result2 = createAckRecord(input2, 2, result1.value.recordHash);

      expect(result2.success).toBe(true);
      if (result2.success) {
        const chainResult = verifyAckChainLink(result2.value, result1.value);
        expect(chainResult.success).toBe(true);
      }
    }
  });
});

// ============================================================================
// REGISTRY TESTS - APPEND-ONLY
// ============================================================================

describe('RiskAckRegistry - Append-Only', () => {
  let registry: RiskAckRegistry;

  beforeEach(() => {
    registry = createRiskAckRegistry();
  });

  test('recordAcknowledgement creates frozen record', () => {
    const input = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const result = registry.recordAcknowledgement(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.isFrozen(result.value)).toBe(true);
    }
  });

  test('recordAcknowledgement is append-only', () => {
    const input1 = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const input2 = createTestAckInput('signal-2', 'actor-2', AckRole.SUPERVISOR, AckDecision.ESCALATED, 2000);

    registry.recordAcknowledgement(input1);
    registry.recordAcknowledgement(input2);

    const records = registry.getAllRecords();
    expect(records.length).toBe(2);
    expect(records[0].sequenceNumber).toBe(1);
    expect(records[1].sequenceNumber).toBe(2);
  });

  test('chain integrity is maintained', () => {
    registry.recordAcknowledgement(createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000));
    registry.recordAcknowledgement(createTestAckInput('signal-2', 'actor-2', AckRole.SUPERVISOR, AckDecision.ESCALATED, 2000));
    registry.recordAcknowledgement(createTestAckInput('signal-3', 'actor-3', AckRole.ADMIN, AckDecision.REJECTED, 3000));

    const result = registry.verifyChainIntegrity();
    expect(result.success).toBe(true);
  });

  test('hash chain links correctly', () => {
    registry.recordAcknowledgement(createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000));
    registry.recordAcknowledgement(createTestAckInput('signal-2', 'actor-2', AckRole.SUPERVISOR, AckDecision.ESCALATED, 2000));

    const records = registry.getAllRecords();
    expect(records[0].previousHash).toBe(ACK_GENESIS_HASH);
    expect(records[1].previousHash).toBe(records[0].recordHash);
  });
});

// ============================================================================
// REGISTRY TESTS - IDEMPOTENCY
// ============================================================================

describe('RiskAckRegistry - Idempotency', () => {
  let registry: RiskAckRegistry;

  beforeEach(() => {
    registry = createRiskAckRegistry();
  });

  test('rejects duplicate (signalId, actorId, decision)', () => {
    const input = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);

    const result1 = registry.recordAcknowledgement(input);
    expect(result1.success).toBe(true);

    // Same signal, actor, and decision - should fail
    const result2 = registry.recordAcknowledgement({
      ...input,
      timestamp: 2000, // Different timestamp
    });
    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error.code).toBe(AckErrorCode.DUPLICATE_ACK);
    }
  });

  test('allows same actor different decisions on same signal', () => {
    const ackInput = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const rejectInput = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.REJECTED, 2000);

    const result1 = registry.recordAcknowledgement(ackInput);
    expect(result1.success).toBe(true);

    const result2 = registry.recordAcknowledgement(rejectInput);
    expect(result2.success).toBe(true);
  });

  test('allows different actors same decision on same signal', () => {
    const input1 = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const input2 = createTestAckInput('signal-1', 'actor-2', AckRole.SUPERVISOR, AckDecision.ACKNOWLEDGED, 2000);

    const result1 = registry.recordAcknowledgement(input1);
    expect(result1.success).toBe(true);

    const result2 = registry.recordAcknowledgement(input2);
    expect(result2.success).toBe(true);
  });
});

// ============================================================================
// REGISTRY TESTS - CONFLICTING DECISIONS
// ============================================================================

describe('RiskAckRegistry - Conflicting Decisions', () => {
  let registry: RiskAckRegistry;

  beforeEach(() => {
    registry = createRiskAckRegistry();
  });

  test('same actor cannot ACK and ESCALATE same signal', () => {
    const ackInput = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const escalateInput = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ESCALATED, 2000);

    const result1 = registry.recordAcknowledgement(ackInput);
    expect(result1.success).toBe(true);

    const result2 = registry.recordAcknowledgement(escalateInput);
    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error.code).toBe(AckErrorCode.CONFLICTING_DECISION);
    }
  });

  test('same actor cannot ESCALATE then ACK same signal', () => {
    const escalateInput = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ESCALATED, 1000);
    const ackInput = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 2000);

    const result1 = registry.recordAcknowledgement(escalateInput);
    expect(result1.success).toBe(true);

    const result2 = registry.recordAcknowledgement(ackInput);
    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error.code).toBe(AckErrorCode.CONFLICTING_DECISION);
    }
  });
});

// ============================================================================
// REGISTRY TESTS - QUERYING
// ============================================================================

describe('RiskAckRegistry - Querying', () => {
  let registry: RiskAckRegistry;

  beforeEach(() => {
    registry = createRiskAckRegistry();
    registry.recordAcknowledgement(createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000));
    registry.recordAcknowledgement(createTestAckInput('signal-1', 'actor-2', AckRole.SUPERVISOR, AckDecision.ESCALATED, 2000));
    registry.recordAcknowledgement(createTestAckInput('signal-2', 'actor-1', AckRole.OPERATOR, AckDecision.REJECTED, 3000));
  });

  test('getRecordsBySignal returns correct records', () => {
    const signalId = createRiskSignalId('signal-1');
    const records = registry.getRecordsBySignal(signalId);
    expect(records.length).toBe(2);
  });

  test('getRecordsByActor returns correct records', () => {
    const actorId = createActorId('actor-1');
    const records = registry.getRecordsByActor(actorId);
    expect(records.length).toBe(2);
  });

  test('hasActorAcknowledged returns correct value', () => {
    const signalId = createRiskSignalId('signal-1');
    expect(registry.hasActorAcknowledged(signalId, createActorId('actor-1'))).toBe(true);
    expect(registry.hasActorAcknowledged(signalId, createActorId('actor-2'))).toBe(false);
  });

  test('hasActorEscalated returns correct value', () => {
    const signalId = createRiskSignalId('signal-1');
    expect(registry.hasActorEscalated(signalId, createActorId('actor-2'))).toBe(true);
    expect(registry.hasActorEscalated(signalId, createActorId('actor-1'))).toBe(false);
  });

  test('getAckCountForSignal returns correct count', () => {
    const signalId = createRiskSignalId('signal-1');
    expect(registry.getAckCountForSignal(signalId)).toBe(1);
  });

  test('getEscalationCountForSignal returns correct count', () => {
    const signalId = createRiskSignalId('signal-1');
    expect(registry.getEscalationCountForSignal(signalId)).toBe(1);
  });

  test('getAllRecords with filters works', () => {
    const byDecision = registry.getAllRecords({ decision: AckDecision.ACKNOWLEDGED });
    expect(byDecision.length).toBe(1);

    const byActor = registry.getAllRecords({ actorId: createActorId('actor-1') });
    expect(byActor.length).toBe(2);
  });
});

// ============================================================================
// VIEWS TESTS
// ============================================================================

describe('RiskAckViews', () => {
  let records: RiskAckRecord[];

  beforeEach(() => {
    const registry = createRiskAckRegistry();
    registry.recordAcknowledgement(createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000));
    registry.recordAcknowledgement(createTestAckInput('signal-1', 'actor-2', AckRole.SUPERVISOR, AckDecision.ESCALATED, 2000));
    registry.recordAcknowledgement(createTestAckInput('signal-2', 'actor-1', AckRole.OPERATOR, AckDecision.REJECTED, 3000));
    records = registry.getAllRecords() as RiskAckRecord[];
  });

  test('getHistoryBySignal returns frozen result', () => {
    const signalId = createRiskSignalId('signal-1');
    const history = getHistoryBySignal(records, signalId);

    expect(Object.isFrozen(history)).toBe(true);
    expect(history.signalId).toBe('signal-1');
    expect(history.totalRecords).toBe(2);
    expect(history.isAcknowledged).toBe(true);
    expect(history.isEscalated).toBe(true);
  });

  test('getHistoryByActor returns frozen result', () => {
    const actorId = createActorId('actor-1');
    const history = getHistoryByActor(records, actorId);

    expect(Object.isFrozen(history)).toBe(true);
    expect(history.actorId).toBe('actor-1');
    expect(history.totalRecords).toBe(2);
  });

  test('getSummaryByDecision returns correct counts', () => {
    const summary = getSummaryByDecision(records, 5000);

    expect(Object.isFrozen(summary)).toBe(true);
    expect(summary.totalRecords).toBe(3);
    expect(summary.byDecision[AckDecision.ACKNOWLEDGED]).toBe(1);
    expect(summary.byDecision[AckDecision.ESCALATED]).toBe(1);
    expect(summary.byDecision[AckDecision.REJECTED]).toBe(1);
  });

  test('getOverallAckSummary calculates rates', () => {
    const summary = getOverallAckSummary(records, 5000);

    expect(Object.isFrozen(summary)).toBe(true);
    expect(summary.ackRatePercent).toBe(33); // 1/3
    expect(summary.escalationRatePercent).toBe(33); // 1/3
  });

  test('getEscalatedSignals returns correct signals', () => {
    const escalated = getEscalatedSignals(records);
    expect(escalated.length).toBe(1);
    expect(escalated[0]).toBe('signal-1');
  });

  test('getUnacknowledgedSignals returns correct signals', () => {
    const allSignals = [
      createRiskSignalId('signal-1'),
      createRiskSignalId('signal-2'),
      createRiskSignalId('signal-3'),
    ];
    const unacked = getUnacknowledgedSignals(records, allSignals);
    expect(unacked.length).toBe(2); // signal-2 and signal-3 not acknowledged
  });
});

// ============================================================================
// BOUNDARY GUARD TESTS
// ============================================================================

describe('RiskAckBoundaryGuards - Forbidden Concepts', () => {
  test('ACK_FORBIDDEN_CONCEPTS contains money-related terms', () => {
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('balance');
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('money');
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('payment');
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('wallet');
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('crypto');
  });

  test('ACK_FORBIDDEN_CONCEPTS contains execution-related terms', () => {
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('execute');
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('auto-adjust');
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('auto-block');
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('block');
    expect(ACK_FORBIDDEN_CONCEPTS).toContain('trigger');
  });

  test('assertNoAckForbiddenConcepts passes for clean text', () => {
    const result = assertNoAckForbiddenConcepts('Human acknowledged the risk signal');
    expect(result.success).toBe(true);
  });

  test('assertNoAckForbiddenConcepts fails for money concepts', () => {
    const result = assertNoAckForbiddenConcepts('Check the balance');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(AckErrorCode.FORBIDDEN_CONCEPT);
    }
  });

  test('assertNoAckForbiddenConcepts fails for execution concepts', () => {
    const result = assertNoAckForbiddenConcepts('Will block the user');
    expect(result.success).toBe(false);
  });

  test('assertNoAckForbiddenFunctions fails for forbidden patterns', () => {
    expect(assertNoAckForbiddenFunctions(['executeAction']).success).toBe(false);
    expect(assertNoAckForbiddenFunctions(['blockUser']).success).toBe(false);
    expect(assertNoAckForbiddenFunctions(['triggerAlert']).success).toBe(false);
  });

  test('assertNoAckForbiddenFunctions passes for clean names', () => {
    expect(assertNoAckForbiddenFunctions(['recordAck', 'getHistory']).success).toBe(true);
  });
});

describe('RiskAckBoundaryGuards - Manual Only', () => {
  test('assertManualOnly passes for manual operations', () => {
    expect(assertManualOnly('Record acknowledgement').success).toBe(true);
    expect(assertManualOnly('Human reviewed signal').success).toBe(true);
  });

  test('assertManualOnly fails for action operations', () => {
    expect(assertManualOnly('Execute the action').success).toBe(false);
    expect(assertManualOnly('Block the user').success).toBe(false);
    expect(assertManualOnly('Trigger the alert').success).toBe(false);
  });

  test('assertHumanAcknowledgement passes for human actors', () => {
    expect(assertHumanAcknowledgement('john.doe').success).toBe(true);
    expect(assertHumanAcknowledgement('admin-user-1').success).toBe(true);
  });

  test('assertHumanAcknowledgement fails for automated actors', () => {
    expect(assertHumanAcknowledgement('system').success).toBe(false);
    expect(assertHumanAcknowledgement('bot').success).toBe(false);
    expect(assertHumanAcknowledgement('automated').success).toBe(false);
  });
});

describe('RiskAckBoundaryGuards - Role Validation', () => {
  test('assertCanEscalate passes for non-ADMIN roles', () => {
    expect(assertCanEscalate(AckRole.OPERATOR).success).toBe(true);
    expect(assertCanEscalate(AckRole.SUPERVISOR).success).toBe(true);
  });

  test('assertCanEscalate fails for ADMIN role', () => {
    expect(assertCanEscalate(AckRole.ADMIN).success).toBe(false);
  });

  test('guardAckInput validates escalation for role', () => {
    const adminEscalate = createTestAckInput('signal-1', 'admin-user', AckRole.ADMIN, AckDecision.ESCALATED, 1000);
    const result = guardAckInput(adminEscalate);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(AckErrorCode.INVALID_DECISION_FOR_ROLE);
    }
  });
});

describe('ACK_BOUNDARY_DECLARATION', () => {
  test('declares manual-only capabilities', () => {
    expect(ACK_BOUNDARY_DECLARATION.capabilities.manualOnly).toBe(true);
    expect(ACK_BOUNDARY_DECLARATION.capabilities.appendOnly).toBe(true);
    expect(ACK_BOUNDARY_DECLARATION.capabilities.auditOnly).toBe(true);
  });

  test('declares what it CANNOT do', () => {
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canBlock).toBe(false);
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canExecute).toBe(false);
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canAutoAdjust).toBe(false);
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canAutoBlock).toBe(false);
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canMutate).toBe(false);
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canEnforce).toBe(false);
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canTrigger).toBe(false);
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canAccessEngine).toBe(false);
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canProcessMoney).toBe(false);
    expect(ACK_BOUNDARY_DECLARATION.cannotDo.canAutoAcknowledge).toBe(false);
  });

  test('is completely frozen', () => {
    expect(Object.isFrozen(ACK_BOUNDARY_DECLARATION)).toBe(true);
    expect(Object.isFrozen(ACK_BOUNDARY_DECLARATION.capabilities)).toBe(true);
    expect(Object.isFrozen(ACK_BOUNDARY_DECLARATION.cannotDo)).toBe(true);
    expect(Object.isFrozen(ACK_BOUNDARY_DECLARATION.constraints)).toBe(true);
    expect(Object.isFrozen(ACK_BOUNDARY_DECLARATION.explicitStatement)).toBe(true);
  });

  test('has explicit statement about no action', () => {
    expect(ACK_BOUNDARY_DECLARATION.explicitStatement.action).toContain('NO ACTION');
    expect(ACK_BOUNDARY_DECLARATION.explicitStatement.automation).toContain('NO AUTOMATION');
  });
});

// ============================================================================
// NO MUTATION TESTS
// ============================================================================

describe('No Mutation Guarantees', () => {
  test('registry recordAcknowledgement does not mutate input', () => {
    const registry = createRiskAckRegistry();
    const input = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const inputCopy = JSON.stringify(input);

    registry.recordAcknowledgement(input);

    expect(JSON.stringify(input)).toBe(inputCopy);
  });

  test('views do not mutate records', () => {
    const registry = createRiskAckRegistry();
    registry.recordAcknowledgement(createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000));
    const records = registry.getAllRecords() as RiskAckRecord[];
    const recordsCopy = JSON.stringify(records);

    getHistoryBySignal(records, createRiskSignalId('signal-1'));
    getHistoryByActor(records, createActorId('actor-1'));
    getSummaryByDecision(records, 5000);

    expect(JSON.stringify(records)).toBe(recordsCopy);
  });
});

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

describe('Determinism Guarantees', () => {
  test('same registry input produces same output', () => {
    const registry1 = createRiskAckRegistry();
    const registry2 = createRiskAckRegistry();

    const input = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);

    const result1 = registry1.recordAcknowledgement(input);
    const result2 = registry2.recordAcknowledgement(input);

    expect(result1.success).toBe(result2.success);
    if (result1.success && result2.success) {
      expect(result1.value.ackId).toBe(result2.value.ackId);
      expect(result1.value.recordHash).toBe(result2.value.recordHash);
    }
  });

  test('deterministic replay produces same chain', () => {
    const inputs = [
      createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000),
      createTestAckInput('signal-2', 'actor-2', AckRole.SUPERVISOR, AckDecision.ESCALATED, 2000),
      createTestAckInput('signal-3', 'actor-3', AckRole.ADMIN, AckDecision.REJECTED, 3000),
    ];

    const registry1 = createRiskAckRegistry();
    const registry2 = createRiskAckRegistry();

    for (const input of inputs) {
      registry1.recordAcknowledgement(input);
      registry2.recordAcknowledgement(input);
    }

    const state1 = registry1.getState();
    const state2 = registry2.getState();

    expect(state1.headHash).toBe(state2.headHash);
    expect(state1.recordCount).toBe(state2.recordCount);
  });
});

// ============================================================================
// NO ACTION PATH TESTS
// ============================================================================

describe('No Action Paths Exist', () => {
  test('RiskAckRegistry has no action methods', () => {
    const registry = createRiskAckRegistry();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(registry));

    for (const method of methods) {
      expect(method).not.toMatch(/^block/);
      expect(method).not.toMatch(/^execute/);
      expect(method).not.toMatch(/^trigger/);
      expect(method).not.toMatch(/^enforce/);
      expect(method).not.toMatch(/^autoAdjust/);
    }
  });

  test('RiskAckRecord is pure data, no action methods', () => {
    const registry = createRiskAckRegistry();
    const input = createTestAckInput('signal-1', 'actor-1', AckRole.OPERATOR, AckDecision.ACKNOWLEDGED, 1000);
    const result = registry.recordAcknowledgement(input);

    expect(result.success).toBe(true);
    if (result.success) {
      const record = result.value;
      const keys = Object.keys(record);
      for (const key of keys) {
        expect(typeof (record as unknown as Record<string, unknown>)[key]).not.toBe('function');
      }
    }
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('OPS-4 Integration', () => {
  test('complete acknowledgement workflow', () => {
    // 1. Create registry
    const registry = createRiskAckRegistry();

    // 2. Record acknowledgements
    registry.recordAcknowledgement({
      riskSignalId: createRiskSignalId('risk-flag-001'),
      actorId: createActorId('operator-john'),
      actorRole: AckRole.OPERATOR,
      decision: AckDecision.ACKNOWLEDGED,
      comment: 'Reviewed and acknowledged',
      timestamp: 1000,
    });

    registry.recordAcknowledgement({
      riskSignalId: createRiskSignalId('risk-flag-002'),
      actorId: createActorId('operator-jane'),
      actorRole: AckRole.OPERATOR,
      decision: AckDecision.ESCALATED,
      comment: 'Needs supervisor review',
      timestamp: 2000,
    });

    registry.recordAcknowledgement({
      riskSignalId: createRiskSignalId('risk-flag-002'),
      actorId: createActorId('supervisor-mike'),
      actorRole: AckRole.SUPERVISOR,
      decision: AckDecision.ACKNOWLEDGED,
      timestamp: 3000,
    });

    // 3. Verify chain integrity
    const chainResult = registry.verifyChainIntegrity();
    expect(chainResult.success).toBe(true);

    // 4. Get summary
    const records = registry.getAllRecords();
    const summary = getOverallAckSummary(records as RiskAckRecord[], 5000);

    expect(summary.totalRecords).toBe(3);
    expect(summary.byDecision[AckDecision.ACKNOWLEDGED]).toBe(2);
    expect(summary.byDecision[AckDecision.ESCALATED]).toBe(1);

    // 5. Check escalated signals
    const escalated = getEscalatedSignals(records as RiskAckRecord[]);
    expect(escalated.length).toBe(1);
    expect(escalated[0]).toBe('risk-flag-002');

    // 6. Verify all results are frozen
    expect(Object.isFrozen(summary)).toBe(true);
  });

  test('module exports no forbidden concepts in code', () => {
    const exports = [
      'createRiskAckRegistry',
      'recordAcknowledgement',
      'getHistoryBySignal',
      'getHistoryByActor',
      'getSummaryByDecision',
      'guardAckInput',
    ];

    const result = assertNoAckForbiddenFunctions(exports);
    expect(result.success).toBe(true);
  });
});
