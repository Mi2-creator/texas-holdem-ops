/**
 * ManualRecharge.test.ts
 *
 * Tests for OPS-1 Manual Recharge functionality.
 */

import {
  // Types
  RechargeSource,
  DeclarationStatus,
  RechargeErrorCode,
  ManualRechargeDeclarationInput,

  // ID Factories
  createManualRechargeReferenceId,
  createRegistryEntryId,
  createHashValue,

  // Hash Utilities
  GENESIS_HASH,
  computeHash,
  isValidDeclarationInput,

  // Registry
  ManualRechargeRegistry,
  createManualRechargeRegistry,

  // Boundary Guards
  assertReferenceAmount,
  assertNoMoneyMetadata,
  assertValidStatusTransition,
  guardDeclarationInput,
} from '../index';

describe('ManualRechargeTypes', () => {
  describe('ID Factories', () => {
    it('should create valid ManualRechargeReferenceId', () => {
      const id = createManualRechargeReferenceId('test-ref-001');
      expect(id).toBe('test-ref-001');
    });

    it('should throw for empty ManualRechargeReferenceId', () => {
      expect(() => createManualRechargeReferenceId('')).toThrow();
      expect(() => createManualRechargeReferenceId('   ')).toThrow();
    });

    it('should create valid RegistryEntryId', () => {
      const id = createRegistryEntryId('entry-001');
      expect(id).toBe('entry-001');
    });

    it('should create valid HashValue', () => {
      const hash = createHashValue('abc123def456');
      expect(hash).toBe('abc123def456');
    });
  });

  describe('Hash Utilities', () => {
    it('should have valid GENESIS_HASH', () => {
      expect(GENESIS_HASH).toBeDefined();
      expect(typeof GENESIS_HASH).toBe('string');
      expect(GENESIS_HASH.length).toBe(64);
    });

    it('should compute deterministic hashes', () => {
      const hash1 = computeHash('test data');
      const hash2 = computeHash('test data');
      expect(hash1).toBe(hash2);
    });

    it('should compute different hashes for different data', () => {
      const hash1 = computeHash('data 1');
      const hash2 = computeHash('data 2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Enums', () => {
    it('should have RechargeSource values', () => {
      expect(RechargeSource.MANUAL).toBe('MANUAL');
      expect(RechargeSource.EXTERNAL).toBe('EXTERNAL');
      expect(RechargeSource.FUTURE).toBe('FUTURE');
    });

    it('should have DeclarationStatus values', () => {
      expect(DeclarationStatus.DECLARED).toBe('DECLARED');
      expect(DeclarationStatus.LINKED).toBe('LINKED');
      expect(DeclarationStatus.CONFIRMED).toBe('CONFIRMED');
      expect(DeclarationStatus.REJECTED).toBe('REJECTED');
    });

    it('should have RechargeErrorCode values', () => {
      expect(RechargeErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(RechargeErrorCode.DUPLICATE_REFERENCE).toBe('DUPLICATE_REFERENCE');
      expect(RechargeErrorCode.ENTRY_NOT_FOUND).toBe('ENTRY_NOT_FOUND');
      expect(RechargeErrorCode.HASH_MISMATCH).toBe('HASH_MISMATCH');
      expect(RechargeErrorCode.CHAIN_BROKEN).toBe('CHAIN_BROKEN');
    });
  });

  describe('Validation', () => {
    it('should validate correct declaration input', () => {
      const input: ManualRechargeDeclarationInput = {
        externalReferenceId: 'ext-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: Date.now(),
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      };
      expect(isValidDeclarationInput(input)).toBe(true);
    });

    it('should reject invalid declaration input', () => {
      // Missing externalReferenceId
      expect(isValidDeclarationInput({
        externalReferenceId: '',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: Date.now(),
        declaredBy: 'admin',
        clubId: 'club',
        playerId: 'player',
      })).toBe(false);

      // Invalid amount (not integer)
      expect(isValidDeclarationInput({
        externalReferenceId: 'ext-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100.5,
        timestamp: Date.now(),
        declaredBy: 'admin',
        clubId: 'club',
        playerId: 'player',
      })).toBe(false);

      // Invalid amount (zero)
      expect(isValidDeclarationInput({
        externalReferenceId: 'ext-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 0,
        timestamp: Date.now(),
        declaredBy: 'admin',
        clubId: 'club',
        playerId: 'player',
      })).toBe(false);
    });
  });
});

describe('ManualRechargeRegistry', () => {
  let registry: ManualRechargeRegistry;
  const baseTimestamp = 1700000000000;

  beforeEach(() => {
    registry = createManualRechargeRegistry();
  });

  describe('Declaration', () => {
    it('should declare a new recharge reference', () => {
      const input: ManualRechargeDeclarationInput = {
        externalReferenceId: 'ext-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
        notes: 'Test declaration',
      };

      const result = registry.declare(input);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.status).toBe(DeclarationStatus.DECLARED);
        expect(result.value.declaration.externalReferenceId).toBe('ext-001');
        expect(result.value.declaration.declaredAmount).toBe(100);
        expect(result.value.sequenceNumber).toBe(1);
        expect(result.value.previousHash).toBe(GENESIS_HASH);
      }
    });

    it('should reject duplicate external references (idempotent)', () => {
      const input: ManualRechargeDeclarationInput = {
        externalReferenceId: 'ext-duplicate',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      };

      const result1 = registry.declare(input);
      expect(result1.success).toBe(true);

      const result2 = registry.declare({
        ...input,
        timestamp: baseTimestamp + 1000,
      });
      expect(result2.success).toBe(false);

      if (!result2.success) {
        expect(result2.error.code).toBe(RechargeErrorCode.DUPLICATE_REFERENCE);
      }
    });

    it('should create hash-chained entries', () => {
      const input1: ManualRechargeDeclarationInput = {
        externalReferenceId: 'ext-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      };

      const input2: ManualRechargeDeclarationInput = {
        externalReferenceId: 'ext-002',
        source: RechargeSource.MANUAL,
        declaredAmount: 200,
        timestamp: baseTimestamp + 1000,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-002',
      };

      const result1 = registry.declare(input1);
      const result2 = registry.declare(input2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        // Second entry should link to first
        expect(result2.value.previousHash).toBe(result1.value.entryHash);
        expect(result2.value.sequenceNumber).toBe(2);
      }
    });

    it('should freeze entries (immutable)', () => {
      const input: ManualRechargeDeclarationInput = {
        externalReferenceId: 'ext-freeze-test',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      };

      const result = registry.declare(input);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(Object.isFrozen(result.value)).toBe(true);
        expect(Object.isFrozen(result.value.declaration)).toBe(true);
        expect(Object.isFrozen(result.value.linkedGreyFlowIds)).toBe(true);
      }
    });
  });

  describe('Querying', () => {
    beforeEach(() => {
      // Seed with test data
      registry.declare({
        externalReferenceId: 'ext-q-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-A',
        playerId: 'player-001',
      });

      registry.declare({
        externalReferenceId: 'ext-q-002',
        source: RechargeSource.MANUAL,
        declaredAmount: 200,
        timestamp: baseTimestamp + 1000,
        declaredBy: 'admin-002',
        clubId: 'club-A',
        playerId: 'player-002',
      });

      registry.declare({
        externalReferenceId: 'ext-q-003',
        source: RechargeSource.EXTERNAL,
        declaredAmount: 300,
        timestamp: baseTimestamp + 2000,
        declaredBy: 'admin-001',
        clubId: 'club-B',
        playerId: 'player-003',
      });
    });

    it('should get all entries', () => {
      const entries = registry.getAllEntries();
      expect(entries.length).toBe(3);
      expect(Object.isFrozen(entries)).toBe(true);
    });

    it('should query by club ID', () => {
      const entries = registry.query({ clubId: 'club-A' });
      expect(entries.length).toBe(2);
    });

    it('should query by player ID', () => {
      const entries = registry.query({ playerId: 'player-001' });
      expect(entries.length).toBe(1);
    });

    it('should query by time range', () => {
      const entries = registry.query({
        fromTimestamp: baseTimestamp + 500,
        toTimestamp: baseTimestamp + 1500,
      });
      expect(entries.length).toBe(1);
      expect(entries[0].declaration.externalReferenceId).toBe('ext-q-002');
    });

    it('should support pagination', () => {
      const page1 = registry.query({ limit: 2 });
      expect(page1.length).toBe(2);

      const page2 = registry.query({ limit: 2, offset: 2 });
      expect(page2.length).toBe(1);
    });

    it('should find by external reference', () => {
      const entry = registry.findByExternalReference('ext-q-002');
      expect(entry).toBeDefined();
      expect(entry?.declaration.declaredAmount).toBe(200);
    });
  });

  describe('Chain Integrity', () => {
    it('should verify empty chain', () => {
      const result = registry.verifyChainIntegrity();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(true);
      }
    });

    it('should verify chain after multiple entries', () => {
      for (let i = 0; i < 5; i++) {
        registry.declare({
          externalReferenceId: `ext-chain-${i}`,
          source: RechargeSource.MANUAL,
          declaredAmount: (i + 1) * 100,
          timestamp: baseTimestamp + i * 1000,
          declaredBy: 'admin-001',
          clubId: 'club-001',
          playerId: 'player-001',
        });
      }

      const result = registry.verifyChainIntegrity();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(true);
      }
    });

    it('should get registry state', () => {
      registry.declare({
        externalReferenceId: 'ext-state-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      });

      const state = registry.getState();
      expect(state.entryCount).toBe(1);
      expect(state.currentSequence).toBe(1);
      expect(state.headHash).not.toBe(GENESIS_HASH);
      expect(Object.isFrozen(state)).toBe(true);
    });
  });

  describe('Status Updates', () => {
    it('should update status from DECLARED to LINKED', () => {
      const declareResult = registry.declare({
        externalReferenceId: 'ext-status-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      });

      expect(declareResult.success).toBe(true);
      if (!declareResult.success) return;

      const updateResult = registry.updateStatus(
        declareResult.value.referenceId,
        DeclarationStatus.LINKED,
        baseTimestamp + 1000,
        ['grey-flow-001']
      );

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.value.status).toBe(DeclarationStatus.LINKED);
        expect(updateResult.value.linkedGreyFlowIds).toContain('grey-flow-001');
      }
    });

    it('should reject invalid status transition', () => {
      const declareResult = registry.declare({
        externalReferenceId: 'ext-status-002',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      });

      expect(declareResult.success).toBe(true);
      if (!declareResult.success) return;

      // Cannot go directly from DECLARED to CONFIRMED
      const updateResult = registry.updateStatus(
        declareResult.value.referenceId,
        DeclarationStatus.CONFIRMED,
        baseTimestamp + 1000
      );

      expect(updateResult.success).toBe(false);
      if (!updateResult.success) {
        expect(updateResult.error.code).toBe(RechargeErrorCode.INVALID_STATUS);
      }
    });
  });
});

describe('RechargeBoundaryGuards', () => {
  describe('assertReferenceAmount', () => {
    it('should accept valid positive integers', () => {
      expect(assertReferenceAmount(1).success).toBe(true);
      expect(assertReferenceAmount(100).success).toBe(true);
      expect(assertReferenceAmount(999999).success).toBe(true);
    });

    it('should reject non-integers', () => {
      expect(assertReferenceAmount(1.5).success).toBe(false);
      expect(assertReferenceAmount(100.01).success).toBe(false);
    });

    it('should reject zero and negative', () => {
      expect(assertReferenceAmount(0).success).toBe(false);
      expect(assertReferenceAmount(-1).success).toBe(false);
    });
  });

  describe('assertNoMoneyMetadata', () => {
    const baseInput: ManualRechargeDeclarationInput = {
      externalReferenceId: 'ext-001',
      source: RechargeSource.MANUAL,
      declaredAmount: 100,
      timestamp: Date.now(),
      declaredBy: 'admin',
      clubId: 'club',
      playerId: 'player',
    };

    it('should accept clean notes', () => {
      const input = { ...baseInput, notes: 'Reference for club credit' };
      expect(assertNoMoneyMetadata(input).success).toBe(true);
    });

    it('should reject money-related notes', () => {
      const moneyNotes = [
        'Payment for USDT deposit',
        'Bitcoin transfer',
        'Send 100 dollars',
        'ETH conversion',
      ];

      for (const notes of moneyNotes) {
        const input = { ...baseInput, notes };
        const result = assertNoMoneyMetadata(input);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('assertValidStatusTransition', () => {
    it('should allow DECLARED -> LINKED', () => {
      expect(assertValidStatusTransition(
        DeclarationStatus.DECLARED,
        DeclarationStatus.LINKED
      ).success).toBe(true);
    });

    it('should allow DECLARED -> REJECTED', () => {
      expect(assertValidStatusTransition(
        DeclarationStatus.DECLARED,
        DeclarationStatus.REJECTED
      ).success).toBe(true);
    });

    it('should allow LINKED -> CONFIRMED', () => {
      expect(assertValidStatusTransition(
        DeclarationStatus.LINKED,
        DeclarationStatus.CONFIRMED
      ).success).toBe(true);
    });

    it('should reject DECLARED -> CONFIRMED (must go through LINKED)', () => {
      expect(assertValidStatusTransition(
        DeclarationStatus.DECLARED,
        DeclarationStatus.CONFIRMED
      ).success).toBe(false);
    });

    it('should reject transitions from terminal states', () => {
      expect(assertValidStatusTransition(
        DeclarationStatus.CONFIRMED,
        DeclarationStatus.DECLARED
      ).success).toBe(false);

      expect(assertValidStatusTransition(
        DeclarationStatus.REJECTED,
        DeclarationStatus.LINKED
      ).success).toBe(false);
    });
  });

  describe('guardDeclarationInput', () => {
    it('should pass for valid input', () => {
      const input: ManualRechargeDeclarationInput = {
        externalReferenceId: 'ext-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: Date.now(),
        declaredBy: 'admin',
        clubId: 'club',
        playerId: 'player',
      };
      expect(guardDeclarationInput(input).success).toBe(true);
    });

    it('should fail for invalid amount', () => {
      const input: ManualRechargeDeclarationInput = {
        externalReferenceId: 'ext-001',
        source: RechargeSource.MANUAL,
        declaredAmount: -100,
        timestamp: Date.now(),
        declaredBy: 'admin',
        clubId: 'club',
        playerId: 'player',
      };
      expect(guardDeclarationInput(input).success).toBe(false);
    });
  });
});
