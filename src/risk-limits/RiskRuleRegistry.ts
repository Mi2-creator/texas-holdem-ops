/**
 * RiskRuleRegistry.ts
 *
 * Append-only registry for risk rules.
 *
 * APPEND-ONLY: Rules are never modified or deleted.
 * HASH-CHAINED: Each record links to the previous for audit integrity.
 * ANALYSIS-ONLY: Rules are for analysis, not enforcement.
 * DETERMINISTIC: Same inputs produce same outputs.
 *
 * CRITICAL: This registry CANNOT enforce, block, or execute anything.
 */

import {
  type RiskRuleId,
  type RiskHash,
  type RiskRule,
  type RiskRuleInput,
  type RiskRuleRecord,
  type RiskResult,
  RiskErrorCode,
  createRiskRuleId,
  computeRiskRecordHash,
  riskSuccess,
  riskFailure,
  createRiskError,
  isValidRiskRuleInput,
  RISK_GENESIS_HASH,
} from './RiskLimitTypes';

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Registry State - read-only snapshot
 */
export interface RiskRuleRegistryState {
  /** All records in order */
  readonly records: readonly RiskRuleRecord[];
  /** Current chain head hash */
  readonly headHash: RiskHash;
  /** Current sequence number */
  readonly currentSequence: number;
  /** Record count */
  readonly recordCount: number;
  /** Active rule count */
  readonly activeRuleCount: number;
}

// ============================================================================
// RISK RULE REGISTRY
// ============================================================================

/**
 * Risk Rule Registry
 *
 * Manages risk rules with:
 * - APPEND-ONLY semantics
 * - HASH-CHAINED integrity
 * - ANALYSIS-ONLY rules (no enforcement)
 */
export class RiskRuleRegistry {
  private readonly records: RiskRuleRecord[] = [];
  private readonly rulesById: Map<string, RiskRuleRecord> = new Map();
  private readonly rulesByName: Map<string, RiskRuleRecord> = new Map();
  private headHash: RiskHash = RISK_GENESIS_HASH;
  private currentSequence: number = 0;

  /**
   * Register a new risk rule.
   *
   * APPEND-ONLY: Creates new record, never modifies existing.
   * ANALYSIS-ONLY: Rules are for flagging, not enforcement.
   */
  registerRule(input: RiskRuleInput): RiskResult<RiskRuleRecord> {
    // Validate input
    if (!isValidRiskRuleInput(input)) {
      return riskFailure(
        createRiskError(
          RiskErrorCode.INVALID_INPUT,
          'Invalid risk rule input',
          { input }
        )
      );
    }

    // Check for duplicate name
    if (this.rulesByName.has(input.name)) {
      return riskFailure(
        createRiskError(
          RiskErrorCode.DUPLICATE_RULE,
          `Rule with name "${input.name}" already exists`,
          { name: input.name }
        )
      );
    }

    // Generate rule ID
    const sequenceNumber = this.currentSequence + 1;
    const ruleId = createRiskRuleId(`rule-${sequenceNumber}-${input.timestamp}`);

    // Create rule
    const rule: RiskRule = Object.freeze({
      ruleId,
      name: input.name,
      description: input.description,
      category: input.category,
      severity: input.severity,
      threshold: Object.freeze({ ...input.threshold }),
      active: true,
      createdAt: input.timestamp,
    });

    // Build record without hash
    const recordWithoutHash: Omit<RiskRuleRecord, 'recordHash'> = {
      ruleId,
      rule,
      sequenceNumber,
      previousHash: this.headHash,
      createdAt: input.timestamp,
    };

    // Compute hash
    const recordHash = computeRiskRecordHash(recordWithoutHash);

    // Create final frozen record
    const record: RiskRuleRecord = Object.freeze({
      ...recordWithoutHash,
      recordHash,
    });

    // Append to registry
    this.records.push(record);
    this.rulesById.set(ruleId, record);
    this.rulesByName.set(input.name, record);

    // Update chain state
    this.headHash = recordHash;
    this.currentSequence = sequenceNumber;

    return riskSuccess(record);
  }

  /**
   * Get rule by ID.
   */
  getRule(ruleId: RiskRuleId): RiskRule | undefined {
    const record = this.rulesById.get(ruleId);
    return record?.rule;
  }

  /**
   * Get rule by name.
   */
  getRuleByName(name: string): RiskRule | undefined {
    const record = this.rulesByName.get(name);
    return record?.rule;
  }

  /**
   * Get all active rules.
   */
  getActiveRules(): readonly RiskRule[] {
    const activeRules: RiskRule[] = [];
    for (const record of this.records) {
      if (record.rule.active) {
        activeRules.push(record.rule);
      }
    }
    return Object.freeze(activeRules);
  }

  /**
   * Get all rules.
   */
  getAllRules(): readonly RiskRule[] {
    return Object.freeze(this.records.map(r => r.rule));
  }

  /**
   * Get all records.
   */
  getAllRecords(): readonly RiskRuleRecord[] {
    return Object.freeze([...this.records]);
  }

  /**
   * Get registry state snapshot.
   */
  getState(): RiskRuleRegistryState {
    const activeCount = this.records.filter(r => r.rule.active).length;

    return Object.freeze({
      records: Object.freeze([...this.records]),
      headHash: this.headHash,
      currentSequence: this.currentSequence,
      recordCount: this.records.length,
      activeRuleCount: activeCount,
    });
  }

  /**
   * Verify chain integrity.
   */
  verifyChainIntegrity(): RiskResult<boolean> {
    if (this.records.length === 0) {
      return riskSuccess(true);
    }

    // Verify first record links to genesis
    if (this.records[0].previousHash !== RISK_GENESIS_HASH) {
      return riskFailure(
        createRiskError(
          RiskErrorCode.CHAIN_BROKEN,
          'First record does not link to genesis hash',
          { ruleId: this.records[0].ruleId }
        )
      );
    }

    // Verify each record's hash and chain
    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];

      // Recompute hash
      const recordWithoutHash: Omit<RiskRuleRecord, 'recordHash'> = {
        ruleId: record.ruleId,
        rule: record.rule,
        sequenceNumber: record.sequenceNumber,
        previousHash: record.previousHash,
        createdAt: record.createdAt,
      };
      const computedHash = computeRiskRecordHash(recordWithoutHash);

      if (computedHash !== record.recordHash) {
        return riskFailure(
          createRiskError(
            RiskErrorCode.HASH_MISMATCH,
            `Hash mismatch at record ${i}`,
            { ruleId: record.ruleId, expected: record.recordHash, computed: computedHash }
          )
        );
      }

      // Verify chain link (except first)
      if (i > 0 && record.previousHash !== this.records[i - 1].recordHash) {
        return riskFailure(
          createRiskError(
            RiskErrorCode.CHAIN_BROKEN,
            `Chain broken at record ${i}`,
            { ruleId: record.ruleId }
          )
        );
      }
    }

    return riskSuccess(true);
  }

  /**
   * Get rule count.
   */
  getRuleCount(): number {
    return this.records.length;
  }

  /**
   * Get active rule count.
   */
  getActiveRuleCount(): number {
    return this.records.filter(r => r.rule.active).length;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new risk rule registry.
 */
export function createRiskRuleRegistry(): RiskRuleRegistry {
  return new RiskRuleRegistry();
}

/**
 * Create a test risk rule registry.
 * NOT for production use.
 */
export function createTestRiskRuleRegistry(): RiskRuleRegistry {
  return new RiskRuleRegistry();
}
