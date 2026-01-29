/**
 * RechargeViews.test.ts
 *
 * Tests for OPS-1 Recharge Views functionality.
 */

import {
  RechargeSource,
  DeclarationStatus,
  ManualRechargeRegistry,
  createManualRechargeRegistry,
  GreyFlowLinker,
  createGreyFlowLinker,
  createGreyFlowId,
  getRechargesByPeriod,
  getRechargesByClub,
  getAllClubSummaries,
  getRechargesByAgent,
  getAllAgentSummaries,
  getRechargeTrace,
  getAllRechargeTraces,
  getOverallSummary,
} from '../index';

describe('RechargeViews', () => {
  let registry: ManualRechargeRegistry;
  let linker: GreyFlowLinker;
  const baseTimestamp = 1700000000000;

  beforeEach(() => {
    registry = createManualRechargeRegistry();
    linker = createGreyFlowLinker(registry);

    // Seed test data
    // Club A - 2 players, 3 entries
    registry.declare({
      externalReferenceId: 'ext-001',
      source: RechargeSource.MANUAL,
      declaredAmount: 100,
      timestamp: baseTimestamp,
      declaredBy: 'agent-001',
      clubId: 'club-A',
      playerId: 'player-A1',
    });

    registry.declare({
      externalReferenceId: 'ext-002',
      source: RechargeSource.MANUAL,
      declaredAmount: 200,
      timestamp: baseTimestamp + 1000,
      declaredBy: 'agent-001',
      clubId: 'club-A',
      playerId: 'player-A1',
    });

    registry.declare({
      externalReferenceId: 'ext-003',
      source: RechargeSource.EXTERNAL,
      declaredAmount: 300,
      timestamp: baseTimestamp + 2000,
      declaredBy: 'agent-002',
      clubId: 'club-A',
      playerId: 'player-A2',
    });

    // Club B - 1 player, 2 entries
    registry.declare({
      externalReferenceId: 'ext-004',
      source: RechargeSource.MANUAL,
      declaredAmount: 400,
      timestamp: baseTimestamp + 3000,
      declaredBy: 'agent-001',
      clubId: 'club-B',
      playerId: 'player-B1',
    });

    registry.declare({
      externalReferenceId: 'ext-005',
      source: RechargeSource.MANUAL,
      declaredAmount: 500,
      timestamp: baseTimestamp + 4000,
      declaredBy: 'agent-002',
      clubId: 'club-B',
      playerId: 'player-B1',
    });
  });

  describe('getRechargesByPeriod', () => {
    it('should get recharges in time period', () => {
      const summary = getRechargesByPeriod(
        registry,
        baseTimestamp,
        baseTimestamp + 2500
      );

      expect(summary.entries.length).toBe(3);
      expect(summary.declaredCount).toBe(3);
      expect(summary.totalReferenceAmount).toBe(600); // 100 + 200 + 300
    });

    it('should handle empty period', () => {
      const summary = getRechargesByPeriod(
        registry,
        baseTimestamp + 100000,
        baseTimestamp + 200000
      );

      expect(summary.entries.length).toBe(0);
      expect(summary.totalReferenceAmount).toBe(0);
    });

    it('should count by status', () => {
      // Link one entry
      const entries = registry.getAllEntries();
      linker.link({
        referenceId: entries[0].referenceId,
        greyFlowIds: [createGreyFlowId('grey-001')],
        timestamp: baseTimestamp + 5000,
        operatorId: 'operator-001',
      });

      const summary = getRechargesByPeriod(
        registry,
        baseTimestamp,
        baseTimestamp + 10000
      );

      // Note: The summary counts the latest entries which includes the LINKED entry
      expect(summary.linkedCount).toBeGreaterThanOrEqual(1);
    });

    it('should freeze result', () => {
      const summary = getRechargesByPeriod(
        registry,
        baseTimestamp,
        baseTimestamp + 5000
      );

      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe('getRechargesByClub', () => {
    it('should get recharges for a club', () => {
      const summary = getRechargesByClub(registry, 'club-A');

      expect(summary.clubId).toBe('club-A');
      expect(summary.entryCount).toBe(3);
      expect(summary.totalReferenceAmount).toBe(600); // 100 + 200 + 300
    });

    it('should break down by player', () => {
      const summary = getRechargesByClub(registry, 'club-A');

      expect(summary.playerBreakdown.length).toBe(2);

      const playerA1 = summary.playerBreakdown.find(p => p.playerId === 'player-A1');
      expect(playerA1?.entryCount).toBe(2);
      expect(playerA1?.totalReferenceAmount).toBe(300);

      const playerA2 = summary.playerBreakdown.find(p => p.playerId === 'player-A2');
      expect(playerA2?.entryCount).toBe(1);
      expect(playerA2?.totalReferenceAmount).toBe(300);
    });

    it('should handle non-existent club', () => {
      const summary = getRechargesByClub(registry, 'club-nonexistent');

      expect(summary.entryCount).toBe(0);
      expect(summary.totalReferenceAmount).toBe(0);
    });
  });

  describe('getAllClubSummaries', () => {
    it('should get summaries for all clubs', () => {
      const summaries = getAllClubSummaries(registry);

      expect(summaries.length).toBe(2);
      expect(Object.isFrozen(summaries)).toBe(true);
    });
  });

  describe('getRechargesByAgent', () => {
    it('should get recharges by agent', () => {
      const summary = getRechargesByAgent(registry, 'agent-001');

      expect(summary.agentId).toBe('agent-001');
      expect(summary.entryCount).toBe(3); // ext-001, ext-002, ext-004
      expect(summary.totalReferenceAmount).toBe(700); // 100 + 200 + 400
    });

    it('should break down by club', () => {
      const summary = getRechargesByAgent(registry, 'agent-001');

      expect(summary.clubBreakdown.length).toBe(2);

      const clubA = summary.clubBreakdown.find(c => c.clubId === 'club-A');
      expect(clubA?.entryCount).toBe(2);

      const clubB = summary.clubBreakdown.find(c => c.clubId === 'club-B');
      expect(clubB?.entryCount).toBe(1);
    });
  });

  describe('getAllAgentSummaries', () => {
    it('should get summaries for all agents', () => {
      const summaries = getAllAgentSummaries(registry);

      expect(summaries.length).toBe(2);
      expect(Object.isFrozen(summaries)).toBe(true);
    });
  });

  describe('getRechargeTrace', () => {
    it('should get trace for a reference', () => {
      const entries = registry.getAllEntries();
      const firstEntry = entries[0];

      // Link it
      linker.link({
        referenceId: firstEntry.referenceId,
        greyFlowIds: [createGreyFlowId('grey-001')],
        timestamp: baseTimestamp + 10000,
        operatorId: 'operator-001',
      });

      const trace = getRechargeTrace(registry, linker, firstEntry.referenceId);

      expect(trace).toBeDefined();
      expect(trace!.referenceId).toBe(firstEntry.referenceId);
      expect(trace!.entries.length).toBeGreaterThanOrEqual(1);
      expect(trace!.currentStatus).toBe(DeclarationStatus.LINKED);
      expect(trace!.allLinkedFlowIds.length).toBe(1);
    });

    it('should return undefined for non-existent reference', () => {
      const trace = getRechargeTrace(
        registry,
        linker,
        'non-existent-ref' as any
      );

      expect(trace).toBeUndefined();
    });

    it('should include chain hashes', () => {
      const entries = registry.getAllEntries();
      const trace = getRechargeTrace(registry, linker, entries[0].referenceId);

      expect(trace).toBeDefined();
      expect(trace!.chainHashes.length).toBeGreaterThan(0);
    });
  });

  describe('getAllRechargeTraces', () => {
    it('should get traces for all references', () => {
      const traces = getAllRechargeTraces(registry, linker);

      expect(traces.length).toBe(5); // 5 unique references
      expect(Object.isFrozen(traces)).toBe(true);
    });
  });

  describe('getOverallSummary', () => {
    it('should get overall summary', () => {
      const summary = getOverallSummary(registry);

      expect(summary.totalEntries).toBe(5);
      expect(summary.totalReferenceAmount).toBe(1500); // 100+200+300+400+500
      expect(summary.uniqueClubs).toBe(2);
      expect(summary.uniquePlayers).toBe(3);
      expect(summary.uniqueAgents).toBe(2);
      expect(summary.chainIntegrity).toBe(true);
    });

    it('should count by status', () => {
      // Link one entry
      const entries = registry.getAllEntries();
      linker.link({
        referenceId: entries[0].referenceId,
        greyFlowIds: [createGreyFlowId('grey-001')],
        timestamp: baseTimestamp + 10000,
        operatorId: 'operator-001',
      });

      const summary = getOverallSummary(registry);

      // The summary should reflect all entries including the new LINKED entry
      // Note: Registry is append-only, so linking creates a new entry
      // Original 5 DECLARED entries remain, plus 1 new LINKED entry = 6 total
      expect(summary.byStatus[DeclarationStatus.DECLARED]).toBe(5);
      expect(summary.byStatus[DeclarationStatus.LINKED]).toBe(1);
      expect(summary.totalEntries).toBe(6);
    });

    it('should verify chain integrity', () => {
      const summary = getOverallSummary(registry);
      expect(summary.chainIntegrity).toBe(true);
    });

    it('should freeze result', () => {
      const summary = getOverallSummary(registry);
      expect(Object.isFrozen(summary)).toBe(true);
      expect(Object.isFrozen(summary.byStatus)).toBe(true);
    });
  });
});
