/**
 * RechargeViews.ts
 *
 * Read-only views for manual recharge data.
 *
 * READ-ONLY: No modifications, only queries.
 * AGGREGATION: Views aggregate data for reporting.
 * DETERMINISTIC: Same inputs produce same outputs.
 */

import {
  type ManualRechargeReferenceId,
  type ManualRechargeRegistryEntry,
  type HashValue,
  DeclarationStatus,
} from '../recharge/ManualRechargeTypes';

import {
  type ManualRechargeRegistry,
  type RegistryQueryOptions,
} from '../recharge/ManualRechargeRegistry';

import {
  type GreyFlowLinker,
  type GreyFlowId,
} from '../linking/GreyFlowLinking';

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * Period Summary - summary of recharges in a time period
 */
export interface PeriodSummary {
  /** Period start timestamp */
  readonly periodStart: number;
  /** Period end timestamp */
  readonly periodEnd: number;
  /** Total declared count */
  readonly declaredCount: number;
  /** Total linked count */
  readonly linkedCount: number;
  /** Total confirmed count */
  readonly confirmedCount: number;
  /** Total rejected count */
  readonly rejectedCount: number;
  /** Total reference amount (sum of declaredAmount) */
  readonly totalReferenceAmount: number;
  /** Entries in this period */
  readonly entries: readonly ManualRechargeRegistryEntry[];
}

/**
 * Club Summary - summary of recharges for a club
 */
export interface ClubSummary {
  /** Club ID */
  readonly clubId: string;
  /** Total entries for this club */
  readonly entryCount: number;
  /** By status */
  readonly byStatus: Readonly<Record<DeclarationStatus, number>>;
  /** Total reference amount */
  readonly totalReferenceAmount: number;
  /** Player breakdown */
  readonly playerBreakdown: readonly PlayerBreakdown[];
  /** Entries for this club */
  readonly entries: readonly ManualRechargeRegistryEntry[];
}

/**
 * Player Breakdown within a club
 */
export interface PlayerBreakdown {
  /** Player ID */
  readonly playerId: string;
  /** Entry count */
  readonly entryCount: number;
  /** Total reference amount */
  readonly totalReferenceAmount: number;
}

/**
 * Agent Summary - summary of recharges by declaring agent/operator
 */
export interface AgentSummary {
  /** Agent/Operator ID */
  readonly agentId: string;
  /** Total entries declared by this agent */
  readonly entryCount: number;
  /** By status */
  readonly byStatus: Readonly<Record<DeclarationStatus, number>>;
  /** Total reference amount */
  readonly totalReferenceAmount: number;
  /** Club breakdown */
  readonly clubBreakdown: readonly ClubBreakdownForAgent[];
}

/**
 * Club breakdown for an agent
 */
export interface ClubBreakdownForAgent {
  /** Club ID */
  readonly clubId: string;
  /** Entry count */
  readonly entryCount: number;
  /** Total reference amount */
  readonly totalReferenceAmount: number;
}

/**
 * Trace Entry - entry in a recharge trace
 */
export interface TraceEntry {
  /** Entry from registry */
  readonly entry: ManualRechargeRegistryEntry;
  /** Linked Grey flow IDs */
  readonly linkedFlowIds: readonly GreyFlowId[];
  /** Previous entry in trace (if this is an update) */
  readonly previousEntry?: ManualRechargeRegistryEntry;
}

/**
 * Recharge Trace - full trace of a recharge reference
 */
export interface RechargeTrace {
  /** Reference ID being traced */
  readonly referenceId: ManualRechargeReferenceId;
  /** All entries for this reference in order */
  readonly entries: readonly TraceEntry[];
  /** Current status */
  readonly currentStatus: DeclarationStatus;
  /** All linked Grey flow IDs */
  readonly allLinkedFlowIds: readonly GreyFlowId[];
  /** Chain hashes */
  readonly chainHashes: readonly HashValue[];
}

// ============================================================================
// RECHARGE BY PERIOD VIEW
// ============================================================================

/**
 * Get recharges by time period.
 */
export function getRechargesByPeriod(
  registry: ManualRechargeRegistry,
  periodStart: number,
  periodEnd: number
): PeriodSummary {
  const options: RegistryQueryOptions = {
    fromTimestamp: periodStart,
    toTimestamp: periodEnd,
  };

  const entries = registry.query(options);

  let declaredCount = 0;
  let linkedCount = 0;
  let confirmedCount = 0;
  let rejectedCount = 0;
  let totalReferenceAmount = 0;

  for (const entry of entries) {
    totalReferenceAmount += entry.declaration.declaredAmount;

    switch (entry.status) {
      case DeclarationStatus.DECLARED:
        declaredCount++;
        break;
      case DeclarationStatus.LINKED:
        linkedCount++;
        break;
      case DeclarationStatus.CONFIRMED:
        confirmedCount++;
        break;
      case DeclarationStatus.REJECTED:
        rejectedCount++;
        break;
    }
  }

  return Object.freeze({
    periodStart,
    periodEnd,
    declaredCount,
    linkedCount,
    confirmedCount,
    rejectedCount,
    totalReferenceAmount,
    entries,
  });
}

// ============================================================================
// RECHARGE BY CLUB VIEW
// ============================================================================

/**
 * Get recharges by club.
 */
export function getRechargesByClub(
  registry: ManualRechargeRegistry,
  clubId: string
): ClubSummary {
  const options: RegistryQueryOptions = {
    clubId,
  };

  const entries = registry.query(options);

  const byStatus: Record<DeclarationStatus, number> = {
    [DeclarationStatus.DECLARED]: 0,
    [DeclarationStatus.LINKED]: 0,
    [DeclarationStatus.CONFIRMED]: 0,
    [DeclarationStatus.REJECTED]: 0,
  };

  let totalReferenceAmount = 0;
  const playerAmounts: Map<string, { count: number; amount: number }> = new Map();

  for (const entry of entries) {
    totalReferenceAmount += entry.declaration.declaredAmount;
    byStatus[entry.status]++;

    const playerId = entry.declaration.playerId;
    if (!playerAmounts.has(playerId)) {
      playerAmounts.set(playerId, { count: 0, amount: 0 });
    }
    const playerData = playerAmounts.get(playerId)!;
    playerData.count++;
    playerData.amount += entry.declaration.declaredAmount;
  }

  const playerBreakdown: PlayerBreakdown[] = [];
  for (const [playerId, data] of playerAmounts) {
    playerBreakdown.push(Object.freeze({
      playerId,
      entryCount: data.count,
      totalReferenceAmount: data.amount,
    }));
  }

  return Object.freeze({
    clubId,
    entryCount: entries.length,
    byStatus: Object.freeze(byStatus),
    totalReferenceAmount,
    playerBreakdown: Object.freeze(playerBreakdown),
    entries,
  });
}

/**
 * Get summary for all clubs.
 */
export function getAllClubSummaries(
  registry: ManualRechargeRegistry
): readonly ClubSummary[] {
  const allEntries = registry.getAllEntries();
  const clubIds = new Set<string>();

  for (const entry of allEntries) {
    clubIds.add(entry.declaration.clubId);
  }

  const summaries: ClubSummary[] = [];
  for (const clubId of clubIds) {
    summaries.push(getRechargesByClub(registry, clubId));
  }

  return Object.freeze(summaries);
}

// ============================================================================
// RECHARGE BY AGENT VIEW
// ============================================================================

/**
 * Get recharges by agent/operator.
 */
export function getRechargesByAgent(
  registry: ManualRechargeRegistry,
  agentId: string
): AgentSummary {
  const allEntries = registry.getAllEntries();
  const agentEntries = allEntries.filter(e => e.declaration.declaredBy === agentId);

  const byStatus: Record<DeclarationStatus, number> = {
    [DeclarationStatus.DECLARED]: 0,
    [DeclarationStatus.LINKED]: 0,
    [DeclarationStatus.CONFIRMED]: 0,
    [DeclarationStatus.REJECTED]: 0,
  };

  let totalReferenceAmount = 0;
  const clubAmounts: Map<string, { count: number; amount: number }> = new Map();

  for (const entry of agentEntries) {
    totalReferenceAmount += entry.declaration.declaredAmount;
    byStatus[entry.status]++;

    const clubId = entry.declaration.clubId;
    if (!clubAmounts.has(clubId)) {
      clubAmounts.set(clubId, { count: 0, amount: 0 });
    }
    const clubData = clubAmounts.get(clubId)!;
    clubData.count++;
    clubData.amount += entry.declaration.declaredAmount;
  }

  const clubBreakdown: ClubBreakdownForAgent[] = [];
  for (const [clubId, data] of clubAmounts) {
    clubBreakdown.push(Object.freeze({
      clubId,
      entryCount: data.count,
      totalReferenceAmount: data.amount,
    }));
  }

  return Object.freeze({
    agentId,
    entryCount: agentEntries.length,
    byStatus: Object.freeze(byStatus),
    totalReferenceAmount,
    clubBreakdown: Object.freeze(clubBreakdown),
  });
}

/**
 * Get summary for all agents.
 */
export function getAllAgentSummaries(
  registry: ManualRechargeRegistry
): readonly AgentSummary[] {
  const allEntries = registry.getAllEntries();
  const agentIds = new Set<string>();

  for (const entry of allEntries) {
    agentIds.add(entry.declaration.declaredBy);
  }

  const summaries: AgentSummary[] = [];
  for (const agentId of agentIds) {
    summaries.push(getRechargesByAgent(registry, agentId));
  }

  return Object.freeze(summaries);
}

// ============================================================================
// RECHARGE TRACE VIEW
// ============================================================================

/**
 * Get full trace for a recharge reference.
 */
export function getRechargeTrace(
  registry: ManualRechargeRegistry,
  linker: GreyFlowLinker,
  referenceId: ManualRechargeReferenceId
): RechargeTrace | undefined {
  const allEntries = registry.getAllEntries();
  const referenceEntries = allEntries.filter(e => e.referenceId === referenceId);

  if (referenceEntries.length === 0) {
    return undefined;
  }

  // Sort by sequence number
  const sortedEntries = [...referenceEntries].sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber
  );

  const traceEntries: TraceEntry[] = [];
  const allLinkedFlowIds: GreyFlowId[] = [];
  const chainHashes: HashValue[] = [];

  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i];
    const linkedFlowIds = linker.getFlowsByReference(referenceId);

    traceEntries.push(Object.freeze({
      entry,
      linkedFlowIds,
      previousEntry: i > 0 ? sortedEntries[i - 1] : undefined,
    }));

    chainHashes.push(entry.entryHash);

    for (const flowId of linkedFlowIds) {
      if (!allLinkedFlowIds.includes(flowId)) {
        allLinkedFlowIds.push(flowId);
      }
    }
  }

  const latestEntry = sortedEntries[sortedEntries.length - 1];

  return Object.freeze({
    referenceId,
    entries: Object.freeze(traceEntries),
    currentStatus: latestEntry.status,
    allLinkedFlowIds: Object.freeze(allLinkedFlowIds),
    chainHashes: Object.freeze(chainHashes),
  });
}

/**
 * Get traces for all references.
 */
export function getAllRechargeTraces(
  registry: ManualRechargeRegistry,
  linker: GreyFlowLinker
): readonly RechargeTrace[] {
  const allEntries = registry.getAllEntries();
  const referenceIds = new Set<ManualRechargeReferenceId>();

  for (const entry of allEntries) {
    referenceIds.add(entry.referenceId);
  }

  const traces: RechargeTrace[] = [];
  for (const referenceId of referenceIds) {
    const trace = getRechargeTrace(registry, linker, referenceId);
    if (trace) {
      traces.push(trace);
    }
  }

  return Object.freeze(traces);
}

// ============================================================================
// AGGREGATE VIEWS
// ============================================================================

/**
 * Overall Summary
 */
export interface OverallSummary {
  /** Total entries */
  readonly totalEntries: number;
  /** By status */
  readonly byStatus: Readonly<Record<DeclarationStatus, number>>;
  /** Total reference amount */
  readonly totalReferenceAmount: number;
  /** Unique clubs */
  readonly uniqueClubs: number;
  /** Unique players */
  readonly uniquePlayers: number;
  /** Unique agents */
  readonly uniqueAgents: number;
  /** Chain integrity verified */
  readonly chainIntegrity: boolean;
}

/**
 * Get overall summary.
 */
export function getOverallSummary(
  registry: ManualRechargeRegistry
): OverallSummary {
  const allEntries = registry.getAllEntries();
  const integrityResult = registry.verifyChainIntegrity();

  const byStatus: Record<DeclarationStatus, number> = {
    [DeclarationStatus.DECLARED]: 0,
    [DeclarationStatus.LINKED]: 0,
    [DeclarationStatus.CONFIRMED]: 0,
    [DeclarationStatus.REJECTED]: 0,
  };

  let totalReferenceAmount = 0;
  const clubs = new Set<string>();
  const players = new Set<string>();
  const agents = new Set<string>();

  for (const entry of allEntries) {
    totalReferenceAmount += entry.declaration.declaredAmount;
    byStatus[entry.status]++;
    clubs.add(entry.declaration.clubId);
    players.add(entry.declaration.playerId);
    agents.add(entry.declaration.declaredBy);
  }

  return Object.freeze({
    totalEntries: allEntries.length,
    byStatus: Object.freeze(byStatus),
    totalReferenceAmount,
    uniqueClubs: clubs.size,
    uniquePlayers: players.size,
    uniqueAgents: agents.size,
    chainIntegrity: integrityResult.success && integrityResult.value === true,
  });
}
