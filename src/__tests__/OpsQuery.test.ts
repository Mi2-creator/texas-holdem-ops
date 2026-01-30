/**
 * OpsQuery.test.ts
 *
 * Tests for OPS-FREEZE: Read-only Query & Snapshot Layer
 *
 * EXPLICIT GUARANTEES TO TEST:
 * - Query layer cannot write, trigger, execute, or acknowledge
 * - Same input snapshot => same output
 * - No forbidden concepts (money, execute, state, action, engine)
 * - OPS modules remain untouched
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import {
  // Query Types
  QueryErrorCode,
  querySuccess,
  queryError,
  isValidTimeScope,
  isValidPeriodScope,
  isValidEntityScope,
  isValidQueryScope,
  isValidOpsModule,
  createSnapshotId,

  // Query Registry
  OpsQueryRegistry,
  createOpsQueryRegistry,

  // Query Views
  getViewCatalog,
  getViewsForModule,
  viewExists,

  // Query Guards
  FORBIDDEN_MUTATION_KEYWORDS,
  FORBIDDEN_EXECUTION_KEYWORDS,
  FORBIDDEN_ENGINE_KEYWORDS,
  FORBIDDEN_FINANCIAL_KEYWORDS,
  FORBIDDEN_STATE_KEYWORDS,
  FORBIDDEN_ASYNC_KEYWORDS,
  containsMutationKeywords,
  containsExecutionKeywords,
  containsEngineKeywords,
  containsFinancialKeywords,
  containsAnyForbiddenKeywords,
  findForbiddenKeywords,
  validateNoMutation,
  validateNoExecution,
  validateNoEngine,
  validateQueryLayerCompliance,
  QUERY_LAYER_CONSTRAINTS,
  getQueryLayerConstraintsText,
} from '../ops-query';

import type {
  TimeScope,
  PeriodScope,
  EntityScope,
  QueryScope,
  OpsModule,
} from '../ops-query';

// ============================================================================
// TEST: QUERY TYPES
// ============================================================================

describe('OpsQueryTypes', () => {
  describe('Scope Validation', () => {
    it('should validate valid time scope', () => {
      const scope: TimeScope = { startMs: 1000, endMs: 2000 };
      expect(isValidTimeScope(scope)).toBe(true);
    });

    it('should reject invalid time scope (end before start)', () => {
      const scope: TimeScope = { startMs: 2000, endMs: 1000 };
      expect(isValidTimeScope(scope)).toBe(false);
    });

    it('should reject negative time scope', () => {
      const scope: TimeScope = { startMs: -1000, endMs: 2000 };
      expect(isValidTimeScope(scope)).toBe(false);
    });

    it('should validate valid period scope', () => {
      const scope: PeriodScope = { periodId: '2024-01' };
      expect(isValidPeriodScope(scope)).toBe(true);
    });

    it('should reject empty period scope', () => {
      const scope: PeriodScope = { periodId: '' };
      expect(isValidPeriodScope(scope)).toBe(false);
    });

    it('should validate valid entity scope', () => {
      const scope: EntityScope = { entityType: 'club', entityId: 'club_1' };
      expect(isValidEntityScope(scope)).toBe(true);
    });

    it('should reject invalid entity type', () => {
      const scope = { entityType: 'invalid', entityId: 'test' } as unknown as EntityScope;
      expect(isValidEntityScope(scope)).toBe(false);
    });

    it('should validate complete query scope', () => {
      const scope: QueryScope = {
        time: { startMs: 1000, endMs: 2000 },
        period: { periodId: '2024-01' },
        entity: { entityType: 'club', entityId: 'club_1' },
        limit: 100,
      };
      expect(isValidQueryScope(scope)).toBe(true);
    });

    it('should reject invalid query scope limit', () => {
      const scope: QueryScope = { limit: -1 };
      expect(isValidQueryScope(scope)).toBe(false);
    });
  });

  describe('Module Validation', () => {
    it('should validate all OPS modules', () => {
      const modules: OpsModule[] = [
        'recharge', 'approval', 'risk', 'ack',
        'intent', 'flow', 'attribution', 'behavior',
      ];

      for (const module of modules) {
        expect(isValidOpsModule(module)).toBe(true);
      }
    });

    it('should reject invalid module', () => {
      expect(isValidOpsModule('invalid')).toBe(false);
      expect(isValidOpsModule('')).toBe(false);
    });
  });

  describe('Result Helpers', () => {
    it('should create success result', () => {
      const result = querySuccess(
        { data: 'test' },
        { queriedAt: Date.now(), module: 'recharge', view: 'test', scope: null },
        1
      );

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ data: 'test' });
      expect(result.meta.resultCount).toBe(1);
    });

    it('should create frozen success result', () => {
      const result = querySuccess(
        { data: 'test' },
        { queriedAt: Date.now(), module: 'recharge', view: 'test', scope: null },
        1
      );

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.meta)).toBe(true);
    });

    it('should create error result', () => {
      const result = queryError(QueryErrorCode.INVALID_MODULE, 'Invalid module');

      expect(result.ok).toBe(false);
      expect(result.code).toBe(QueryErrorCode.INVALID_MODULE);
      expect(result.message).toBe('Invalid module');
    });

    it('should create frozen error result', () => {
      const result = queryError(QueryErrorCode.INVALID_MODULE, 'Invalid module');
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('Snapshot ID', () => {
    it('should create snapshot ID', () => {
      const id = createSnapshotId('snap_123');
      expect(id).toBe('snap_123');
    });
  });
});

// ============================================================================
// TEST: QUERY REGISTRY
// ============================================================================

describe('OpsQueryRegistry', () => {
  let registry: OpsQueryRegistry;

  beforeEach(() => {
    registry = createOpsQueryRegistry();
  });

  describe('Metadata Access', () => {
    it('should return frozen metadata', () => {
      const metadata = registry.getMetadata();

      expect(Object.isFrozen(metadata)).toBe(true);
      expect(metadata.isComplete).toBe(true);
      expect(metadata.modules.length).toBe(8);
    });

    it('should return frozen state', () => {
      const state = registry.getState();

      expect(Object.isFrozen(state)).toBe(true);
      expect(state.isFrozen).toBe(true);
    });

    it('should return snapshot ID', () => {
      const id = registry.getSnapshotId();
      expect(typeof id).toBe('string');
      expect(id.startsWith('snap_')).toBe(true);
    });

    it('should return available modules', () => {
      const modules = registry.getAvailableModules();

      expect(Object.isFrozen(modules)).toBe(true);
      expect(modules.length).toBe(8);
      expect(modules).toContain('recharge');
      expect(modules).toContain('behavior');
    });

    it('should check module availability', () => {
      expect(registry.hasModule('recharge')).toBe(true);
      expect(registry.hasModule('behavior')).toBe(true);
    });
  });

  describe('Scope Validation', () => {
    it('should validate valid scope', () => {
      const result = registry.validateScope({ limit: 10 });

      expect(result.ok).toBe(true);
    });

    it('should reject invalid scope', () => {
      const result = registry.validateScope({ limit: -1 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe(QueryErrorCode.INVALID_SCOPE);
      }
    });
  });

  describe('Scope Filtering', () => {
    it('should apply time scope filter', () => {
      const records = [
        { timestamp: 1000 },
        { timestamp: 1500 },
        { timestamp: 2000 },
        { timestamp: 3000 },
      ];

      const filtered = registry.applyTimeScope(records, {
        time: { startMs: 1000, endMs: 2000 },
      });

      expect(filtered.length).toBe(3);
      expect(Object.isFrozen(filtered)).toBe(true);
    });

    it('should apply limit scope', () => {
      const records = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

      const limited = registry.applyLimitScope(records, { limit: 3 });

      expect(limited.length).toBe(3);
      expect(Object.isFrozen(limited)).toBe(true);
    });

    it('should apply combined scope filters', () => {
      const records = [
        { timestamp: 500 },
        { timestamp: 1000 },
        { timestamp: 1500 },
        { timestamp: 2000 },
        { timestamp: 2500 },
      ];

      const filtered = registry.applyScopeFilters(records, {
        time: { startMs: 1000, endMs: 2000 },
        limit: 2,
      });

      expect(filtered.length).toBe(2);
      expect(Object.isFrozen(filtered)).toBe(true);
    });
  });

  describe('Determinism', () => {
    it('should produce same metadata on repeated calls', () => {
      const meta1 = registry.getMetadata();
      const meta2 = registry.getMetadata();

      expect(meta1.snapshotId).toBe(meta2.snapshotId);
      expect(meta1.createdAt).toBe(meta2.createdAt);
      expect(meta1.modules).toEqual(meta2.modules);
    });

    it('should produce same filter results for same input', () => {
      const records = [{ timestamp: 1000 }, { timestamp: 2000 }];
      const scope = { time: { startMs: 500, endMs: 1500 } };

      const result1 = registry.applyTimeScope(records, scope);
      const result2 = registry.applyTimeScope(records, scope);

      expect(result1).toEqual(result2);
    });
  });
});

// ============================================================================
// TEST: QUERY VIEWS
// ============================================================================

describe('OpsQueryViews', () => {
  describe('View Catalog', () => {
    it('should return frozen catalog', () => {
      const catalog = getViewCatalog();

      expect(Object.isFrozen(catalog)).toBe(true);
      expect(catalog.length).toBeGreaterThan(0);
    });

    it('should have all modules represented', () => {
      const catalog = getViewCatalog();
      const modules = new Set(catalog.map(entry => entry.module));

      expect(modules.has('recharge')).toBe(true);
      expect(modules.has('approval')).toBe(true);
      expect(modules.has('risk')).toBe(true);
      expect(modules.has('ack')).toBe(true);
      expect(modules.has('intent')).toBe(true);
      expect(modules.has('flow')).toBe(true);
      expect(modules.has('attribution')).toBe(true);
      expect(modules.has('behavior')).toBe(true);
    });

    it('should mark all views as read-only', () => {
      const catalog = getViewCatalog();

      for (const entry of catalog) {
        expect(entry.isReadOnly).toBe(true);
      }
    });
  });

  describe('Module Views', () => {
    it('should get views for specific module', () => {
      const views = getViewsForModule('recharge');

      expect(Object.isFrozen(views)).toBe(true);
      expect(views.length).toBeGreaterThan(0);
      for (const view of views) {
        expect(view.module).toBe('recharge');
      }
    });

    it('should return empty for unknown module', () => {
      const views = getViewsForModule('unknown');
      expect(views.length).toBe(0);
    });
  });

  describe('View Existence', () => {
    it('should find existing views', () => {
      expect(viewExists('recharge', 'getRechargesByPeriod')).toBe(true);
      expect(viewExists('risk', 'getRiskSummaryByPeriod')).toBe(true);
    });

    it('should not find non-existing views', () => {
      expect(viewExists('recharge', 'nonExistent')).toBe(false);
      expect(viewExists('unknown', 'test')).toBe(false);
    });
  });
});

// ============================================================================
// TEST: QUERY GUARDS
// ============================================================================

describe('OpsQueryGuards', () => {
  describe('Forbidden Keyword Lists', () => {
    it('should have mutation keywords', () => {
      expect(FORBIDDEN_MUTATION_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_MUTATION_KEYWORDS).toContain('write');
      expect(FORBIDDEN_MUTATION_KEYWORDS).toContain('update');
      expect(FORBIDDEN_MUTATION_KEYWORDS).toContain('delete');
    });

    it('should have execution keywords', () => {
      expect(FORBIDDEN_EXECUTION_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_EXECUTION_KEYWORDS).toContain('execute');
      expect(FORBIDDEN_EXECUTION_KEYWORDS).toContain('trigger');
    });

    it('should have engine keywords', () => {
      expect(FORBIDDEN_ENGINE_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_ENGINE_KEYWORDS).toContain('engine');
    });

    it('should have financial keywords', () => {
      expect(FORBIDDEN_FINANCIAL_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_FINANCIAL_KEYWORDS).toContain('money');
      expect(FORBIDDEN_FINANCIAL_KEYWORDS).toContain('balance');
    });

    it('should have state keywords', () => {
      expect(FORBIDDEN_STATE_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_STATE_KEYWORDS).toContain('state machine');
    });

    it('should have async keywords', () => {
      expect(FORBIDDEN_ASYNC_KEYWORDS.length).toBeGreaterThan(0);
      expect(FORBIDDEN_ASYNC_KEYWORDS).toContain('callback');
      expect(FORBIDDEN_ASYNC_KEYWORDS).toContain('event');
    });
  });

  describe('Keyword Detection', () => {
    it('should detect mutation keywords', () => {
      expect(containsMutationKeywords('write data')).toBe(true);
      expect(containsMutationKeywords('update record')).toBe(true);
      expect(containsMutationKeywords('read data')).toBe(false);
    });

    it('should detect execution keywords', () => {
      expect(containsExecutionKeywords('execute action')).toBe(true);
      expect(containsExecutionKeywords('trigger event')).toBe(true);
      expect(containsExecutionKeywords('query data')).toBe(false);
    });

    it('should detect engine keywords', () => {
      expect(containsEngineKeywords('import engine')).toBe(true);
      expect(containsEngineKeywords('import utils')).toBe(false);
    });

    it('should detect financial keywords', () => {
      expect(containsFinancialKeywords('process payment')).toBe(true);
      expect(containsFinancialKeywords('check balance')).toBe(true);
      expect(containsFinancialKeywords('read summary')).toBe(false);
    });

    it('should detect any forbidden keywords', () => {
      expect(containsAnyForbiddenKeywords('write payment')).toBe(true);
      expect(containsAnyForbiddenKeywords('read summary')).toBe(false);
    });

    it('should find all forbidden keywords', () => {
      const found = findForbiddenKeywords('write payment and trigger event');

      expect(found).toContain('write');
      expect(found).toContain('payment');
      expect(found).toContain('trigger');
      expect(found).toContain('event');
    });
  });

  describe('Validation Functions', () => {
    it('should validate no mutation', () => {
      const valid = validateNoMutation('read data');
      expect(valid.isValid).toBe(true);

      const invalid = validateNoMutation('write data');
      expect(invalid.isValid).toBe(false);
      expect(invalid.category).toBe('mutation');
    });

    it('should validate no execution', () => {
      const valid = validateNoExecution('query data');
      expect(valid.isValid).toBe(true);

      const invalid = validateNoExecution('execute action');
      expect(invalid.isValid).toBe(false);
      expect(invalid.category).toBe('execution');
    });

    it('should validate no engine', () => {
      const valid = validateNoEngine('import utils');
      expect(valid.isValid).toBe(true);

      const invalid = validateNoEngine('import engine');
      expect(invalid.isValid).toBe(false);
      expect(invalid.category).toBe('engine');
    });

    it('should validate query layer compliance', () => {
      const valid = validateQueryLayerCompliance('read frozen data');
      expect(valid.isValid).toBe(true);

      const invalid = validateQueryLayerCompliance('write payment trigger');
      expect(invalid.isValid).toBe(false);
    });
  });

  describe('Constraint Documentation', () => {
    it('should have MUST constraints', () => {
      expect(QUERY_LAYER_CONSTRAINTS.MUST.length).toBeGreaterThan(0);
      expect(QUERY_LAYER_CONSTRAINTS.MUST).toContain('Only read data from OPS modules');
    });

    it('should have CANNOT constraints', () => {
      expect(QUERY_LAYER_CONSTRAINTS.CANNOT.length).toBeGreaterThan(0);
      expect(QUERY_LAYER_CONSTRAINTS.CANNOT).toContain('Write, update, or delete any data');
    });

    it('should have semantic definitions', () => {
      expect(QUERY_LAYER_CONSTRAINTS.SEMANTICS.QUERY).toBeDefined();
      expect(QUERY_LAYER_CONSTRAINTS.SEMANTICS.SNAPSHOT).toBeDefined();
    });

    it('should generate readable constraints text', () => {
      const text = getQueryLayerConstraintsText();

      expect(text).toContain('OPS QUERY LAYER CONSTRAINTS');
      expect(text).toContain('QUERY LAYER MUST:');
      expect(text).toContain('QUERY LAYER CANNOT:');
    });
  });
});

// ============================================================================
// TEST: IMMUTABILITY GUARANTEES
// ============================================================================

describe('Immutability Guarantees', () => {
  it('should not allow mutation of query results', () => {
    const result = querySuccess(
      { items: [1, 2, 3] },
      { queriedAt: Date.now(), module: 'recharge', view: 'test', scope: null },
      3
    );

    expect(Object.isFrozen(result)).toBe(true);
    expect(() => {
      (result as any).ok = false;
    }).toThrow();
  });

  it('should not allow mutation of registry metadata', () => {
    const registry = createOpsQueryRegistry();
    const metadata = registry.getMetadata();

    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.modules)).toBe(true);
  });

  it('should not allow mutation of view catalog', () => {
    const catalog = getViewCatalog();

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(() => {
      (catalog as any).push({ module: 'test', view: 'test' });
    }).toThrow();
  });

  it('should return frozen filter results', () => {
    const registry = createOpsQueryRegistry();
    const records = [{ timestamp: 1000 }, { timestamp: 2000 }];
    const filtered = registry.applyScopeFilters(records, {});

    expect(Object.isFrozen(filtered)).toBe(true);
  });
});

// ============================================================================
// TEST: DETERMINISM GUARANTEES
// ============================================================================

describe('Determinism Guarantees', () => {
  it('should produce same output for same input (filter)', () => {
    const registry = createOpsQueryRegistry();
    const records = [
      { timestamp: 1000 },
      { timestamp: 1500 },
      { timestamp: 2000 },
    ];
    const scope = { time: { startMs: 1000, endMs: 1500 } };

    const result1 = registry.applyTimeScope(records, scope);
    const result2 = registry.applyTimeScope(records, scope);

    expect(result1).toEqual(result2);
    expect(result1.length).toBe(result2.length);
  });

  it('should produce same view catalog', () => {
    const catalog1 = getViewCatalog();
    const catalog2 = getViewCatalog();

    expect(catalog1).toEqual(catalog2);
  });

  it('should produce consistent module views', () => {
    const views1 = getViewsForModule('recharge');
    const views2 = getViewsForModule('recharge');

    expect(views1).toEqual(views2);
  });
});

// ============================================================================
// TEST: NO SIDE EFFECTS
// ============================================================================

describe('No Side Effects', () => {
  it('should not modify source records during filtering', () => {
    const registry = createOpsQueryRegistry();
    const originalRecords = [
      { timestamp: 1000, data: 'a' },
      { timestamp: 2000, data: 'b' },
    ];

    // Make a copy for comparison
    const recordsCopy = JSON.parse(JSON.stringify(originalRecords));

    // Apply filter
    registry.applyScopeFilters(originalRecords, { limit: 1 });

    // Original should be unchanged
    expect(originalRecords).toEqual(recordsCopy);
  });

  it('should not have write methods in OpsQueryRegistry', () => {
    const registry = createOpsQueryRegistry();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(registry));

    // No write/update/delete methods
    expect(methods.some(m => m.startsWith('write'))).toBe(false);
    expect(methods.some(m => m.startsWith('update'))).toBe(false);
    expect(methods.some(m => m.startsWith('delete'))).toBe(false);
    expect(methods.some(m => m.startsWith('remove'))).toBe(false);
    expect(methods.some(m => m.startsWith('set'))).toBe(false);
  });

  it('should not have trigger/execute methods in OpsQueryRegistry', () => {
    const registry = createOpsQueryRegistry();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(registry));

    // No trigger/execute methods
    expect(methods.some(m => m.startsWith('trigger'))).toBe(false);
    expect(methods.some(m => m.startsWith('execute'))).toBe(false);
    expect(methods.some(m => m.startsWith('dispatch'))).toBe(false);
    expect(methods.some(m => m.startsWith('emit'))).toBe(false);
  });
});

// ============================================================================
// TEST: NO FORBIDDEN CONCEPTS IN MODULE
// ============================================================================

describe('No Forbidden Concepts in Query Module', () => {
  it('should not have forbidden concepts in source files', () => {
    const opsQueryDir = path.join(__dirname, '..', 'ops-query');
    const files = fs.readdirSync(opsQueryDir).filter(f => f.endsWith('.ts'));

    const violations: string[] = [];

    for (const file of files) {
      // Skip the guards file which defines forbidden keywords
      if (file === 'OpsQueryGuards.ts') continue;

      const content = fs.readFileSync(path.join(opsQueryDir, file), 'utf-8');

      // Check for engine imports
      if (content.includes("from 'engine") || content.includes('from "engine')) {
        violations.push(`${file}: contains engine import`);
      }

      // Check for direct mutation patterns in function implementations
      // (not in forbidden keyword definitions or comments)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments and strings
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

        // Check for actual balance/wallet operations (not just the word in docs)
        if (line.includes('.balance =') || line.includes('.wallet =')) {
          violations.push(`${file}:${i + 1}: contains direct state mutation`);
        }
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('should not import from engine modules', () => {
    const opsQueryDir = path.join(__dirname, '..', 'ops-query');
    const indexContent = fs.readFileSync(path.join(opsQueryDir, 'index.ts'), 'utf-8');

    // Should not have engine imports
    expect(indexContent).not.toMatch(/from ['"]\.\.\/engine/);
    expect(indexContent).not.toMatch(/from ['"]engine/);
    expect(indexContent).not.toMatch(/from ['"]\.\.\/core/);
  });
});

// ============================================================================
// TEST: OPS MODULES REMAIN UNTOUCHED
// ============================================================================

describe('OPS Modules Remain Untouched', () => {
  it('query layer only re-exports, does not modify OPS views', () => {
    // The query layer should import from OPS modules but not modify them
    const viewsContent = fs.readFileSync(
      path.join(__dirname, '..', 'ops-query', 'OpsQueryViews.ts'),
      'utf-8'
    );

    // Should have re-exports (export { ... } from)
    expect(viewsContent).toMatch(/export \{[\s\S]*?\} from/);

    // Should not have class definitions that extend OPS classes
    expect(viewsContent).not.toMatch(/class \w+ extends/);

    // Should not have function implementations that compute new metrics
    // (Only re-exports and the catalog functions)
    const functionDefs = viewsContent.match(/function \w+\(/g) || [];
    const allowedFunctions = ['getViewCatalog', 'getViewsForModule', 'viewExists'];

    for (const def of functionDefs) {
      const funcName = def.replace('function ', '').replace('(', '');
      expect(allowedFunctions).toContain(funcName);
    }
  });

  it('query layer does not add new analytics', () => {
    const opsQueryDir = path.join(__dirname, '..', 'ops-query');
    const files = fs.readdirSync(opsQueryDir).filter(f => f.endsWith('.ts'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(opsQueryDir, file), 'utf-8');

      // Should not have calculation functions (beyond simple filtering)
      expect(content).not.toMatch(/function calculate(?!.*(Scope|Filter))/);
      expect(content).not.toMatch(/function compute(?!.*(Scope|Filter))/);
      expect(content).not.toMatch(/function aggregate(?!.*(Scope|Filter))/);
      expect(content).not.toMatch(/function correlate/);
      expect(content).not.toMatch(/function analyze/);
    }
  });
});

// ============================================================================
// TEST: INTEGRATION
// ============================================================================

describe('Query Layer Integration', () => {
  it('should create query registry and access all modules', () => {
    const registry = createOpsQueryRegistry();
    const modules = registry.getAvailableModules();

    expect(modules.length).toBe(8);
    expect(modules).toContain('recharge');
    expect(modules).toContain('approval');
    expect(modules).toContain('risk');
    expect(modules).toContain('ack');
    expect(modules).toContain('intent');
    expect(modules).toContain('flow');
    expect(modules).toContain('attribution');
    expect(modules).toContain('behavior');
  });

  it('should access view catalog for all modules', () => {
    const catalog = getViewCatalog();
    const moduleViews = new Map<string, number>();

    for (const entry of catalog) {
      const count = moduleViews.get(entry.module) || 0;
      moduleViews.set(entry.module, count + 1);
    }

    // Each module should have at least one view
    expect(moduleViews.get('recharge')).toBeGreaterThan(0);
    expect(moduleViews.get('approval')).toBeGreaterThan(0);
    expect(moduleViews.get('risk')).toBeGreaterThan(0);
    expect(moduleViews.get('ack')).toBeGreaterThan(0);
    expect(moduleViews.get('intent')).toBeGreaterThan(0);
    expect(moduleViews.get('flow')).toBeGreaterThan(0);
    expect(moduleViews.get('attribution')).toBeGreaterThan(0);
    expect(moduleViews.get('behavior')).toBeGreaterThan(0);
  });

  it('should validate all guards pass for query layer code', () => {
    // Sample of valid query layer text
    const validText = 'read frozen data from snapshot query';
    const result = validateQueryLayerCompliance(validText);

    expect(result.isValid).toBe(true);
  });
});
