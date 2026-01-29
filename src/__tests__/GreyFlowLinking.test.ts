/**
 * GreyFlowLinking.test.ts
 *
 * Tests for OPS-1 Grey Flow Linking functionality.
 */

import {
  RechargeSource,
  DeclarationStatus,
  ManualRechargeRegistry,
  createManualRechargeRegistry,
  GreyFlowLinker,
  createGreyFlowLinker,
  createGreyFlowId,
  RechargeErrorCode,
} from '../index';

describe('GreyFlowLinking', () => {
  let registry: ManualRechargeRegistry;
  let linker: GreyFlowLinker;
  const baseTimestamp = 1700000000000;

  beforeEach(() => {
    registry = createManualRechargeRegistry();
    linker = createGreyFlowLinker(registry);
  });

  describe('createGreyFlowId', () => {
    it('should create valid Grey flow ID', () => {
      const id = createGreyFlowId('grey-flow-001');
      expect(id).toBe('grey-flow-001');
    });

    it('should throw for empty ID', () => {
      expect(() => createGreyFlowId('')).toThrow();
      expect(() => createGreyFlowId('   ')).toThrow();
    });
  });

  describe('Linking', () => {
    it('should link a declared reference to Grey flows', () => {
      // First declare a reference
      const declareResult = registry.declare({
        externalReferenceId: 'ext-link-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      });

      expect(declareResult.success).toBe(true);
      if (!declareResult.success) return;

      // Link to Grey flows
      const linkResult = linker.link({
        referenceId: declareResult.value.referenceId,
        greyFlowIds: [createGreyFlowId('grey-001'), createGreyFlowId('grey-002')],
        timestamp: baseTimestamp + 1000,
        operatorId: 'operator-001',
        notes: 'Test linking',
      });

      expect(linkResult.success).toBe(true);
      if (linkResult.success) {
        expect(linkResult.value.greyFlowIds.length).toBe(2);
        expect(linkResult.value.linkedBy).toBe('operator-001');
      }

      // Verify registry entry was updated
      const updatedEntry = registry.findByReferenceId(declareResult.value.referenceId);
      expect(updatedEntry?.status).toBe(DeclarationStatus.LINKED);
    });

    it('should reject linking non-existent reference', () => {
      const linkResult = linker.link({
        referenceId: 'non-existent-ref' as any,
        greyFlowIds: [createGreyFlowId('grey-001')],
        timestamp: baseTimestamp,
        operatorId: 'operator-001',
      });

      expect(linkResult.success).toBe(false);
      if (!linkResult.success) {
        expect(linkResult.error.code).toBe(RechargeErrorCode.ENTRY_NOT_FOUND);
      }
    });

    it('should reject linking non-DECLARED reference', () => {
      // Declare
      const declareResult = registry.declare({
        externalReferenceId: 'ext-link-002',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      });

      expect(declareResult.success).toBe(true);
      if (!declareResult.success) return;

      // First link
      const link1 = linker.link({
        referenceId: declareResult.value.referenceId,
        greyFlowIds: [createGreyFlowId('grey-001')],
        timestamp: baseTimestamp + 1000,
        operatorId: 'operator-001',
      });
      expect(link1.success).toBe(true);

      // Try to link again (now LINKED, not DECLARED)
      const link2 = linker.link({
        referenceId: declareResult.value.referenceId,
        greyFlowIds: [createGreyFlowId('grey-002')],
        timestamp: baseTimestamp + 2000,
        operatorId: 'operator-001',
      });

      expect(link2.success).toBe(false);
      if (!link2.success) {
        expect(link2.error.code).toBe(RechargeErrorCode.INVALID_STATUS);
      }
    });

    it('should reject linking with empty greyFlowIds', () => {
      const declareResult = registry.declare({
        externalReferenceId: 'ext-link-003',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      });

      expect(declareResult.success).toBe(true);
      if (!declareResult.success) return;

      const linkResult = linker.link({
        referenceId: declareResult.value.referenceId,
        greyFlowIds: [],
        timestamp: baseTimestamp + 1000,
        operatorId: 'operator-001',
      });

      expect(linkResult.success).toBe(false);
      if (!linkResult.success) {
        expect(linkResult.error.code).toBe(RechargeErrorCode.INVALID_INPUT);
      }
    });
  });

  describe('Querying Links', () => {
    beforeEach(() => {
      // Setup linked references
      const dec1 = registry.declare({
        externalReferenceId: 'ext-q-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      });

      const dec2 = registry.declare({
        externalReferenceId: 'ext-q-002',
        source: RechargeSource.MANUAL,
        declaredAmount: 200,
        timestamp: baseTimestamp + 1000,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-002',
      });

      if (dec1.success) {
        linker.link({
          referenceId: dec1.value.referenceId,
          greyFlowIds: [createGreyFlowId('grey-shared'), createGreyFlowId('grey-001')],
          timestamp: baseTimestamp + 2000,
          operatorId: 'operator-001',
        });
      }

      if (dec2.success) {
        linker.link({
          referenceId: dec2.value.referenceId,
          greyFlowIds: [createGreyFlowId('grey-shared'), createGreyFlowId('grey-002')],
          timestamp: baseTimestamp + 3000,
          operatorId: 'operator-001',
        });
      }
    });

    it('should get references by flow ID', () => {
      const refs = linker.getReferencesByFlow(createGreyFlowId('grey-shared'));
      expect(refs.length).toBe(2);
    });

    it('should get flows by reference ID', () => {
      const entries = registry.getAllEntries();
      const firstLinkedEntry = entries.find(e => e.status === DeclarationStatus.LINKED);

      if (firstLinkedEntry) {
        const flows = linker.getFlowsByReference(firstLinkedEntry.referenceId);
        expect(flows.length).toBe(2);
      }
    });

    it('should check if reference is linked', () => {
      const entries = registry.getAllEntries();
      const linkedEntry = entries.find(e => e.status === DeclarationStatus.LINKED);

      if (linkedEntry) {
        expect(linker.isLinked(linkedEntry.referenceId)).toBe(true);
      }
    });

    it('should check if flow has linked references', () => {
      expect(linker.hasLinkedReferences(createGreyFlowId('grey-shared'))).toBe(true);
      expect(linker.hasLinkedReferences(createGreyFlowId('grey-nonexistent'))).toBe(false);
    });

    it('should get all link records', () => {
      const links = linker.getAllLinks();
      expect(links.length).toBe(2);
      expect(Object.isFrozen(links)).toBe(true);
    });

    it('should get link state', () => {
      const state = linker.getState();
      expect(state.links.length).toBe(2);
      expect(Object.isFrozen(state)).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate operatorId', () => {
      const declareResult = registry.declare({
        externalReferenceId: 'ext-val-001',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      });

      expect(declareResult.success).toBe(true);
      if (!declareResult.success) return;

      const linkResult = linker.link({
        referenceId: declareResult.value.referenceId,
        greyFlowIds: [createGreyFlowId('grey-001')],
        timestamp: baseTimestamp + 1000,
        operatorId: '', // Invalid
      });

      expect(linkResult.success).toBe(false);
    });

    it('should validate timestamp', () => {
      const declareResult = registry.declare({
        externalReferenceId: 'ext-val-002',
        source: RechargeSource.MANUAL,
        declaredAmount: 100,
        timestamp: baseTimestamp,
        declaredBy: 'admin-001',
        clubId: 'club-001',
        playerId: 'player-001',
      });

      expect(declareResult.success).toBe(true);
      if (!declareResult.success) return;

      const linkResult = linker.link({
        referenceId: declareResult.value.referenceId,
        greyFlowIds: [createGreyFlowId('grey-001')],
        timestamp: 0, // Invalid
        operatorId: 'operator-001',
      });

      expect(linkResult.success).toBe(false);
    });
  });
});
