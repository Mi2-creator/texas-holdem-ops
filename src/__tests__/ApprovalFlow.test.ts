/**
 * ApprovalFlow.test.ts
 *
 * Comprehensive tests for OPS-2 Manual Approval & Two-Man Rule.
 *
 * Tests:
 * - Creating PENDING approvals
 * - Second actor CONFIRM
 * - Second actor REJECT
 * - Self-approval rejection (TWO-MAN RULE)
 * - Duplicate approval rejection
 * - Hash chain integrity
 * - Deterministic behavior (same input → same output)
 */

import {
  // Types
  ApprovalStatus,
  ApprovalDecision,
  ApprovalErrorCode,
  ApprovalRequestInput,
  ApprovalDecisionInput,

  // ID Factories
  createApprovalId,
  createActorId,
  createApprovalHash,

  // Hash Utilities
  APPROVAL_GENESIS_HASH,
  computeApprovalHash,
  isTerminalStatus,

  // Record Functions
  createApprovalRequestRecord,
  createApprovalDecisionRecord,
  verifyRecordIntegrity,
  verifyChainLink,
  isRecordFrozen,

  // Registry
  ApprovalRegistry,
  createApprovalRegistry,

  // Views
  getPendingApprovalsByPeriod,
  getAllPendingApprovals,
  getApprovalHistoryByRecharge,
  getApprovalSummaryByActor,
  getOverallApprovalSummary,

  // Boundary Guards
  APPROVAL_FORBIDDEN_CONCEPTS,
  APPROVAL_BOUNDARY_DECLARATION,
  assertTwoManRule,
  assertNoApprovalForbiddenConcepts,
  assertValidApprovalStatusTransition,
  guardApprovalRequest,

  // Recharge types
  createManualRechargeReferenceId,
} from '../index';

describe('OPS-2: Approval Flow', () => {
  const baseTimestamp = 1700000000000;
  const actorCreator = createActorId('actor-creator-001');
  const actorApprover = createActorId('actor-approver-002');
  const rechargeRefId = createManualRechargeReferenceId('ref-recharge-001');

  describe('ApprovalTypes', () => {
    describe('ID Factories', () => {
      it('should create valid ApprovalId', () => {
        const id = createApprovalId('approval-001');
        expect(id).toBe('approval-001');
      });

      it('should throw for empty ApprovalId', () => {
        expect(() => createApprovalId('')).toThrow();
        expect(() => createApprovalId('   ')).toThrow();
      });

      it('should create valid ActorId', () => {
        const id = createActorId('actor-001');
        expect(id).toBe('actor-001');
      });

      it('should create valid ApprovalHash', () => {
        const hash = createApprovalHash('abc123');
        expect(hash).toBe('abc123');
      });
    });

    describe('Hash Utilities', () => {
      it('should have valid APPROVAL_GENESIS_HASH', () => {
        expect(APPROVAL_GENESIS_HASH).toBeDefined();
        expect(typeof APPROVAL_GENESIS_HASH).toBe('string');
        expect(APPROVAL_GENESIS_HASH.length).toBe(64);
      });

      it('should compute deterministic hashes', () => {
        const hash1 = computeApprovalHash('test data');
        const hash2 = computeApprovalHash('test data');
        expect(hash1).toBe(hash2);
      });

      it('should compute different hashes for different data', () => {
        const hash1 = computeApprovalHash('data 1');
        const hash2 = computeApprovalHash('data 2');
        expect(hash1).not.toBe(hash2);
      });
    });

    describe('Enums', () => {
      it('should have ApprovalStatus values', () => {
        expect(ApprovalStatus.PENDING).toBe('PENDING');
        expect(ApprovalStatus.CONFIRMED).toBe('CONFIRMED');
        expect(ApprovalStatus.REJECTED).toBe('REJECTED');
      });

      it('should have ApprovalDecision values', () => {
        expect(ApprovalDecision.CONFIRM).toBe('CONFIRM');
        expect(ApprovalDecision.REJECT).toBe('REJECT');
      });

      it('should identify terminal statuses', () => {
        expect(isTerminalStatus(ApprovalStatus.PENDING)).toBe(false);
        expect(isTerminalStatus(ApprovalStatus.CONFIRMED)).toBe(true);
        expect(isTerminalStatus(ApprovalStatus.REJECTED)).toBe(true);
      });
    });
  });

  describe('ApprovalRecord', () => {
    describe('Creating PENDING Record', () => {
      it('should create a PENDING approval request record', () => {
        const input: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
          notes: 'Test approval request',
        };

        const result = createApprovalRequestRecord(input, 1, APPROVAL_GENESIS_HASH);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.status).toBe(ApprovalStatus.PENDING);
          expect(result.value.rechargeReferenceId).toBe(rechargeRefId);
          expect(result.value.creatorActorId).toBe(actorCreator);
          expect(result.value.sequenceNumber).toBe(1);
          expect(result.value.previousHash).toBe(APPROVAL_GENESIS_HASH);
          expect(result.value.decision).toBeUndefined();
        }
      });

      it('should freeze created records (immutable)', () => {
        const input: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };

        const result = createApprovalRequestRecord(input, 1, APPROVAL_GENESIS_HASH);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(Object.isFrozen(result.value)).toBe(true);
          expect(isRecordFrozen(result.value)).toBe(true);
        }
      });
    });

    describe('Creating Decision Record', () => {
      it('should create CONFIRMED record with second actor', () => {
        // First create pending record
        const pendingInput: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const pendingResult = createApprovalRequestRecord(pendingInput, 1, APPROVAL_GENESIS_HASH);
        expect(pendingResult.success).toBe(true);
        if (!pendingResult.success) return;

        // Create decision with different actor
        const decisionInput: ApprovalDecisionInput = {
          approvalId: pendingResult.value.approvalId,
          decisionActorId: actorApprover,
          decision: ApprovalDecision.CONFIRM,
          decidedAt: baseTimestamp + 1000,
        };

        const decisionResult = createApprovalDecisionRecord(
          pendingResult.value,
          decisionInput,
          2,
          pendingResult.value.recordHash
        );

        expect(decisionResult.success).toBe(true);
        if (decisionResult.success) {
          expect(decisionResult.value.status).toBe(ApprovalStatus.CONFIRMED);
          expect(decisionResult.value.decision?.decisionActorId).toBe(actorApprover);
          expect(decisionResult.value.decision?.decision).toBe(ApprovalDecision.CONFIRM);
        }
      });

      it('should create REJECTED record with reason', () => {
        const pendingInput: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const pendingResult = createApprovalRequestRecord(pendingInput, 1, APPROVAL_GENESIS_HASH);
        expect(pendingResult.success).toBe(true);
        if (!pendingResult.success) return;

        const decisionInput: ApprovalDecisionInput = {
          approvalId: pendingResult.value.approvalId,
          decisionActorId: actorApprover,
          decision: ApprovalDecision.REJECT,
          decidedAt: baseTimestamp + 1000,
          reason: 'Invalid reference data',
        };

        const decisionResult = createApprovalDecisionRecord(
          pendingResult.value,
          decisionInput,
          2,
          pendingResult.value.recordHash
        );

        expect(decisionResult.success).toBe(true);
        if (decisionResult.success) {
          expect(decisionResult.value.status).toBe(ApprovalStatus.REJECTED);
          expect(decisionResult.value.decision?.reason).toBe('Invalid reference data');
        }
      });

      it('should REJECT self-approval (TWO-MAN RULE)', () => {
        const pendingInput: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const pendingResult = createApprovalRequestRecord(pendingInput, 1, APPROVAL_GENESIS_HASH);
        expect(pendingResult.success).toBe(true);
        if (!pendingResult.success) return;

        // Try to approve with same actor (self-approval)
        const decisionInput: ApprovalDecisionInput = {
          approvalId: pendingResult.value.approvalId,
          decisionActorId: actorCreator, // SAME as creator!
          decision: ApprovalDecision.CONFIRM,
          decidedAt: baseTimestamp + 1000,
        };

        const decisionResult = createApprovalDecisionRecord(
          pendingResult.value,
          decisionInput,
          2,
          pendingResult.value.recordHash
        );

        expect(decisionResult.success).toBe(false);
        if (!decisionResult.success) {
          expect(decisionResult.error.code).toBe(ApprovalErrorCode.SELF_APPROVAL_FORBIDDEN);
        }
      });

      it('should REJECT decision on terminal status', () => {
        // Create pending and then confirmed
        const pendingInput: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const pendingResult = createApprovalRequestRecord(pendingInput, 1, APPROVAL_GENESIS_HASH);
        expect(pendingResult.success).toBe(true);
        if (!pendingResult.success) return;

        const confirmInput: ApprovalDecisionInput = {
          approvalId: pendingResult.value.approvalId,
          decisionActorId: actorApprover,
          decision: ApprovalDecision.CONFIRM,
          decidedAt: baseTimestamp + 1000,
        };
        const confirmResult = createApprovalDecisionRecord(
          pendingResult.value,
          confirmInput,
          2,
          pendingResult.value.recordHash
        );
        expect(confirmResult.success).toBe(true);
        if (!confirmResult.success) return;

        // Try to decide again on confirmed record
        const secondActor = createActorId('actor-third-003');
        const secondDecision: ApprovalDecisionInput = {
          approvalId: confirmResult.value.approvalId,
          decisionActorId: secondActor,
          decision: ApprovalDecision.REJECT,
          decidedAt: baseTimestamp + 2000,
          reason: 'Too late',
        };

        const secondResult = createApprovalDecisionRecord(
          confirmResult.value,
          secondDecision,
          3,
          confirmResult.value.recordHash
        );

        expect(secondResult.success).toBe(false);
        if (!secondResult.success) {
          expect(secondResult.error.code).toBe(ApprovalErrorCode.ALREADY_TERMINAL);
        }
      });
    });

    describe('Record Integrity', () => {
      it('should verify record integrity', () => {
        const input: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const result = createApprovalRequestRecord(input, 1, APPROVAL_GENESIS_HASH);
        expect(result.success).toBe(true);
        if (!result.success) return;

        const integrityResult = verifyRecordIntegrity(result.value);
        expect(integrityResult.success).toBe(true);
      });

      it('should verify chain link', () => {
        const input1: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const result1 = createApprovalRequestRecord(input1, 1, APPROVAL_GENESIS_HASH);
        expect(result1.success).toBe(true);
        if (!result1.success) return;

        // Verify first links to genesis
        const link1Result = verifyChainLink(result1.value, null);
        expect(link1Result.success).toBe(true);
      });
    });
  });

  describe('ApprovalRegistry', () => {
    let registry: ApprovalRegistry;

    beforeEach(() => {
      registry = createApprovalRegistry();
    });

    describe('Request Approval', () => {
      it('should create PENDING approval', () => {
        const input: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };

        const result = registry.requestApproval(input);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.status).toBe(ApprovalStatus.PENDING);
          expect(registry.getPendingCount()).toBe(1);
        }
      });

      it('should reject duplicate pending approval (idempotent)', () => {
        const input: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };

        const result1 = registry.requestApproval(input);
        expect(result1.success).toBe(true);

        const result2 = registry.requestApproval({
          ...input,
          requestedAt: baseTimestamp + 1000,
        });

        expect(result2.success).toBe(false);
        if (!result2.success) {
          expect(result2.error.code).toBe(ApprovalErrorCode.DUPLICATE_APPROVAL);
        }
      });
    });

    describe('Make Decision', () => {
      it('should CONFIRM with second actor', () => {
        // Request approval
        const requestInput: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const requestResult = registry.requestApproval(requestInput);
        expect(requestResult.success).toBe(true);
        if (!requestResult.success) return;

        // Make decision with different actor
        const decisionInput: ApprovalDecisionInput = {
          approvalId: requestResult.value.approvalId,
          decisionActorId: actorApprover,
          decision: ApprovalDecision.CONFIRM,
          decidedAt: baseTimestamp + 1000,
        };

        const decisionResult = registry.makeDecision(decisionInput);

        expect(decisionResult.success).toBe(true);
        if (decisionResult.success) {
          expect(decisionResult.value.status).toBe(ApprovalStatus.CONFIRMED);
          // Note: APPEND-ONLY registry keeps the original PENDING record
          // The latest record for this approval is CONFIRMED
          const latestRecord = registry.getLatestRecordById(requestResult.value.approvalId);
          expect(latestRecord?.status).toBe(ApprovalStatus.CONFIRMED);
        }
      });

      it('should REJECT with reason', () => {
        const requestInput: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const requestResult = registry.requestApproval(requestInput);
        expect(requestResult.success).toBe(true);
        if (!requestResult.success) return;

        const decisionInput: ApprovalDecisionInput = {
          approvalId: requestResult.value.approvalId,
          decisionActorId: actorApprover,
          decision: ApprovalDecision.REJECT,
          decidedAt: baseTimestamp + 1000,
          reason: 'Reference data mismatch',
        };

        const decisionResult = registry.makeDecision(decisionInput);

        expect(decisionResult.success).toBe(true);
        if (decisionResult.success) {
          expect(decisionResult.value.status).toBe(ApprovalStatus.REJECTED);
        }
      });

      it('should REJECT self-approval (TWO-MAN RULE)', () => {
        const requestInput: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const requestResult = registry.requestApproval(requestInput);
        expect(requestResult.success).toBe(true);
        if (!requestResult.success) return;

        // Try self-approval
        const decisionInput: ApprovalDecisionInput = {
          approvalId: requestResult.value.approvalId,
          decisionActorId: actorCreator, // Same as creator!
          decision: ApprovalDecision.CONFIRM,
          decidedAt: baseTimestamp + 1000,
        };

        const decisionResult = registry.makeDecision(decisionInput);

        expect(decisionResult.success).toBe(false);
        if (!decisionResult.success) {
          expect(decisionResult.error.code).toBe(ApprovalErrorCode.SELF_APPROVAL_FORBIDDEN);
        }
      });

      it('should REJECT double confirmation (already terminal)', () => {
        const requestInput: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const requestResult = registry.requestApproval(requestInput);
        expect(requestResult.success).toBe(true);
        if (!requestResult.success) return;

        // First confirmation
        const confirm1: ApprovalDecisionInput = {
          approvalId: requestResult.value.approvalId,
          decisionActorId: actorApprover,
          decision: ApprovalDecision.CONFIRM,
          decidedAt: baseTimestamp + 1000,
        };
        const confirm1Result = registry.makeDecision(confirm1);
        expect(confirm1Result.success).toBe(true);

        // Try second confirmation
        const thirdActor = createActorId('actor-third-003');
        const confirm2: ApprovalDecisionInput = {
          approvalId: requestResult.value.approvalId,
          decisionActorId: thirdActor,
          decision: ApprovalDecision.CONFIRM,
          decidedAt: baseTimestamp + 2000,
        };
        const confirm2Result = registry.makeDecision(confirm2);

        expect(confirm2Result.success).toBe(false);
        if (!confirm2Result.success) {
          expect(confirm2Result.error.code).toBe(ApprovalErrorCode.ALREADY_TERMINAL);
        }
      });

      it('should check canActorApprove correctly', () => {
        const requestInput: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const requestResult = registry.requestApproval(requestInput);
        expect(requestResult.success).toBe(true);
        if (!requestResult.success) return;

        // Creator cannot approve (TWO-MAN RULE)
        expect(registry.canActorApprove(requestResult.value.approvalId, actorCreator)).toBe(false);

        // Different actor can approve
        expect(registry.canActorApprove(requestResult.value.approvalId, actorApprover)).toBe(true);
      });
    });

    describe('Chain Integrity', () => {
      it('should verify empty chain', () => {
        const result = registry.verifyChainIntegrity();
        expect(result.success).toBe(true);
      });

      it('should maintain hash chain across multiple records', () => {
        // Create multiple approvals
        for (let i = 0; i < 5; i++) {
          const refId = createManualRechargeReferenceId(`ref-chain-${i}`);
          registry.requestApproval({
            rechargeReferenceId: refId,
            creatorActorId: actorCreator,
            requestedAt: baseTimestamp + i * 1000,
          });
        }

        const result = registry.verifyChainIntegrity();
        expect(result.success).toBe(true);

        const state = registry.getState();
        expect(state.recordCount).toBe(5);
        expect(state.currentSequence).toBe(5);
        expect(state.headHash).not.toBe(APPROVAL_GENESIS_HASH);
      });
    });

    describe('Querying', () => {
      beforeEach(() => {
        // Seed test data
        const ref1 = createManualRechargeReferenceId('ref-q-001');
        const ref2 = createManualRechargeReferenceId('ref-q-002');
        const ref3 = createManualRechargeReferenceId('ref-q-003');

        registry.requestApproval({
          rechargeReferenceId: ref1,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        });

        registry.requestApproval({
          rechargeReferenceId: ref2,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp + 1000,
        });

        registry.requestApproval({
          rechargeReferenceId: ref3,
          creatorActorId: actorApprover,
          requestedAt: baseTimestamp + 2000,
        });
      });

      it('should get all records', () => {
        const records = registry.getAllRecords();
        expect(records.length).toBe(3);
        expect(Object.isFrozen(records)).toBe(true);
      });

      it('should query by status', () => {
        const pending = registry.query({ status: ApprovalStatus.PENDING });
        expect(pending.length).toBe(3);
      });

      it('should query by creator', () => {
        const byCreator = registry.query({ creatorActorId: actorCreator });
        expect(byCreator.length).toBe(2);
      });

      it('should get pending approvals', () => {
        const pending = registry.getPendingApprovals();
        expect(pending.length).toBe(3);
      });
    });
  });

  describe('ApprovalViews', () => {
    let registry: ApprovalRegistry;

    beforeEach(() => {
      registry = createApprovalRegistry();

      // Seed test data
      const ref1 = createManualRechargeReferenceId('ref-v-001');
      const ref2 = createManualRechargeReferenceId('ref-v-002');

      // First approval - confirmed
      const req1 = registry.requestApproval({
        rechargeReferenceId: ref1,
        creatorActorId: actorCreator,
        requestedAt: baseTimestamp,
      });
      if (req1.success) {
        registry.makeDecision({
          approvalId: req1.value.approvalId,
          decisionActorId: actorApprover,
          decision: ApprovalDecision.CONFIRM,
          decidedAt: baseTimestamp + 5000,
        });
      }

      // Second approval - still pending
      registry.requestApproval({
        rechargeReferenceId: ref2,
        creatorActorId: actorCreator,
        requestedAt: baseTimestamp + 1000,
      });
    });

    describe('PendingApprovalsByPeriod', () => {
      it('should get pending approvals by period', () => {
        const currentTime = baseTimestamp + 10000;
        const view = getPendingApprovalsByPeriod(
          registry,
          baseTimestamp,
          baseTimestamp + 5000,
          currentTime
        );

        // Note: APPEND-ONLY registry - first approval has both PENDING (original)
        // and CONFIRMED (decision) records. Query returns all PENDING records.
        // The second approval is still PENDING only.
        expect(view.pendingCount).toBe(2); // Both original PENDING records
        expect(view.pendingApprovals.length).toBe(2);
        expect(view.oldestAgeMs).toBeGreaterThan(0);
      });

      it('should get all pending approvals', () => {
        const currentTime = baseTimestamp + 10000;
        const view = getAllPendingApprovals(registry, currentTime);

        // Both original PENDING records exist (append-only)
        expect(view.pendingCount).toBe(2);
      });
    });

    describe('ApprovalHistoryByRecharge', () => {
      it('should get approval history for a reference', () => {
        const refId = createManualRechargeReferenceId('ref-v-001');
        const history = getApprovalHistoryByRecharge(registry, refId);

        expect(history).toBeDefined();
        expect(history!.currentStatus).toBe(ApprovalStatus.CONFIRMED);
        expect(history!.creatorActorId).toBe(actorCreator);
        expect(history!.decisionActorId).toBe(actorApprover);
        expect(history!.decisionTimeMs).toBe(5000);
      });

      it('should return undefined for non-existent reference', () => {
        const refId = createManualRechargeReferenceId('ref-nonexistent');
        const history = getApprovalHistoryByRecharge(registry, refId);

        expect(history).toBeUndefined();
      });
    });

    describe('ApprovalSummaryByActor', () => {
      it('should get summary for creator actor', () => {
        const summary = getApprovalSummaryByActor(registry, actorCreator);

        expect(summary.actorId).toBe(actorCreator);
        expect(summary.createdCount).toBe(2);
        expect(summary.decisionsCount).toBe(0);
      });

      it('should get summary for approver actor', () => {
        const summary = getApprovalSummaryByActor(registry, actorApprover);

        expect(summary.actorId).toBe(actorApprover);
        expect(summary.createdCount).toBe(0);
        expect(summary.decisionsCount).toBe(1);
        expect(summary.confirmationsCount).toBe(1);
      });
    });

    describe('OverallApprovalSummary', () => {
      it('should get overall summary', () => {
        const summary = getOverallApprovalSummary(registry);

        expect(summary.uniqueApprovals).toBe(2);
        expect(summary.confirmedCount).toBe(1);
        // Note: APPEND-ONLY registry - both original PENDING records still exist
        expect(summary.pendingCount).toBe(2);
        expect(summary.chainIntegrity).toBe(true);
        expect(Object.isFrozen(summary)).toBe(true);
      });
    });
  });

  describe('ApprovalBoundaryGuards', () => {
    describe('TWO-MAN RULE', () => {
      it('should pass for different actors', () => {
        const result = assertTwoManRule(actorCreator, actorApprover);
        expect(result.success).toBe(true);
      });

      it('should fail for same actor', () => {
        const result = assertTwoManRule(actorCreator, actorCreator);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(ApprovalErrorCode.SELF_APPROVAL_FORBIDDEN);
        }
      });
    });

    describe('Forbidden Concepts', () => {
      it('should have all required forbidden concepts', () => {
        expect(APPROVAL_FORBIDDEN_CONCEPTS).toContain('balance');
        expect(APPROVAL_FORBIDDEN_CONCEPTS).toContain('money');
        expect(APPROVAL_FORBIDDEN_CONCEPTS).toContain('payment');
        expect(APPROVAL_FORBIDDEN_CONCEPTS).toContain('wallet');
        expect(APPROVAL_FORBIDDEN_CONCEPTS).toContain('crypto');
        expect(APPROVAL_FORBIDDEN_CONCEPTS).toContain('settlement');
        expect(APPROVAL_FORBIDDEN_CONCEPTS).toContain('execute');
      });

      it('should detect forbidden concepts in text', () => {
        const result = assertNoApprovalForbiddenConcepts('Transfer balance to wallet');
        expect(result.success).toBe(false);
      });

      it('should pass clean text', () => {
        const result = assertNoApprovalForbiddenConcepts('Reference quantity update');
        expect(result.success).toBe(true);
      });
    });

    describe('Status Transitions', () => {
      it('should allow PENDING -> CONFIRMED', () => {
        const result = assertValidApprovalStatusTransition(
          ApprovalStatus.PENDING,
          ApprovalStatus.CONFIRMED
        );
        expect(result.success).toBe(true);
      });

      it('should allow PENDING -> REJECTED', () => {
        const result = assertValidApprovalStatusTransition(
          ApprovalStatus.PENDING,
          ApprovalStatus.REJECTED
        );
        expect(result.success).toBe(true);
      });

      it('should reject CONFIRMED -> PENDING', () => {
        const result = assertValidApprovalStatusTransition(
          ApprovalStatus.CONFIRMED,
          ApprovalStatus.PENDING
        );
        expect(result.success).toBe(false);
      });

      it('should reject REJECTED -> CONFIRMED', () => {
        const result = assertValidApprovalStatusTransition(
          ApprovalStatus.REJECTED,
          ApprovalStatus.CONFIRMED
        );
        expect(result.success).toBe(false);
      });
    });

    describe('guardApprovalRequest', () => {
      it('should pass valid input', () => {
        const input: ApprovalRequestInput = {
          rechargeReferenceId: rechargeRefId,
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        };
        const result = guardApprovalRequest(input);
        expect(result.success).toBe(true);
      });

      it('should fail for missing rechargeReferenceId', () => {
        const input = {
          rechargeReferenceId: '',
          creatorActorId: actorCreator,
          requestedAt: baseTimestamp,
        } as ApprovalRequestInput;
        const result = guardApprovalRequest(input);
        expect(result.success).toBe(false);
      });
    });

    describe('APPROVAL_BOUNDARY_DECLARATION', () => {
      it('should declare all constraints', () => {
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.referenceOnly).toBe(true);
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.appendOnly).toBe(true);
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.hashChained).toBe(true);
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.idempotent).toBe(true);
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.twoManRule).toBe(true);
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.deterministic).toBe(true);
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.noMutation).toBe(true);
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.noClock).toBe(true);
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.noAsync).toBe(true);
        expect(APPROVAL_BOUNDARY_DECLARATION.constraints.noEngineImports).toBe(true);
      });

      it('should be frozen', () => {
        expect(Object.isFrozen(APPROVAL_BOUNDARY_DECLARATION)).toBe(true);
        expect(Object.isFrozen(APPROVAL_BOUNDARY_DECLARATION.constraints)).toBe(true);
      });
    });
  });

  describe('Determinism', () => {
    it('should produce same output for same input', () => {
      const input: ApprovalRequestInput = {
        rechargeReferenceId: rechargeRefId,
        creatorActorId: actorCreator,
        requestedAt: baseTimestamp,
        notes: 'Test note',
      };

      const result1 = createApprovalRequestRecord(input, 1, APPROVAL_GENESIS_HASH);
      const result2 = createApprovalRequestRecord(input, 1, APPROVAL_GENESIS_HASH);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        expect(result1.value.recordHash).toBe(result2.value.recordHash);
        expect(result1.value.approvalId).toBe(result2.value.approvalId);
      }
    });

    it('should produce different output for different input', () => {
      const input1: ApprovalRequestInput = {
        rechargeReferenceId: rechargeRefId,
        creatorActorId: actorCreator,
        requestedAt: baseTimestamp,
      };

      const input2: ApprovalRequestInput = {
        rechargeReferenceId: rechargeRefId,
        creatorActorId: actorCreator,
        requestedAt: baseTimestamp + 1, // Different timestamp
      };

      const result1 = createApprovalRequestRecord(input1, 1, APPROVAL_GENESIS_HASH);
      const result2 = createApprovalRequestRecord(input2, 1, APPROVAL_GENESIS_HASH);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        expect(result1.value.recordHash).not.toBe(result2.value.recordHash);
      }
    });
  });
});
