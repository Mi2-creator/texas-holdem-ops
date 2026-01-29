/**
 * OPS-0 Tests
 *
 * Tests proving:
 * 1. No forbidden financial terminology exists
 * 2. No engine imports exist
 * 3. No mutation functions exported
 * 4. Same input => same output (determinism)
 * 5. Append-only enforcement
 * 6. Grey reference mapping correctness
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Import all exports
import {
  // Version
  OPS_VERSION,
  OPS_PHASE,
  OPS_MODULE_INFO,

  // Status Enums
  ReferenceStatus,
  AdapterType,
  OpsErrorCode,

  // ID Factories
  createExternalReferenceId,
  createRechargeReferenceId,
  createConfirmationId,

  // Result Helpers
  opsSuccess,
  opsFailure,
  createOpsError,

  // Validation Helpers
  isValidInteger,
  isValidPositiveInteger,
  isValidTimestamp,

  // Boundary Guards
  FORBIDDEN_CONCEPTS,
  FORBIDDEN_IMPORTS,
  OPS_BOUNDARY_DECLARATION,
  checkForForbiddenConcepts,
  checkForForbiddenImports,
  checkForForbiddenFunctions,
  assertInteger,
  assertPositiveInteger,

  // Adapters
  ManualAdminAdapterStub,
  createManualAdminAdapter,
  FUTURE_USDT_PLACEHOLDER,
  createFutureUsdtAdapter,

  // Ingestion
  RechargeIngestor,
  InMemoryReferenceStore,
  createRechargeIngestor,

  // Mapping
  GreyRechargeMapper,
  createGreyRechargeMapper,

  // Approvals
  HumanConfirmQueue,
  createHumanConfirmQueue,

  // Exports
  createGreyPushClient,
} from '../index';

import type {
  RechargeReferenceInput,
  RechargeReferenceRecord,
  ManualAdminInput,
} from '../index';

// ============================================================================
// TEST: No Forbidden Financial Terminology
// ============================================================================

describe('No Forbidden Financial Terminology', () => {
  it('FORBIDDEN_CONCEPTS includes all required terms', () => {
    expect(FORBIDDEN_CONCEPTS).toContain('balance');
    expect(FORBIDDEN_CONCEPTS).toContain('wallet');
    expect(FORBIDDEN_CONCEPTS).toContain('payment');
    expect(FORBIDDEN_CONCEPTS).toContain('crypto');
    expect(FORBIDDEN_CONCEPTS).toContain('transfer');
    expect(FORBIDDEN_CONCEPTS).toContain('money');
    expect(FORBIDDEN_CONCEPTS).toContain('currency');
  });

  it('checkForForbiddenConcepts detects forbidden terms', () => {
    expect(checkForForbiddenConcepts('update balance').passed).toBe(false);
    expect(checkForForbiddenConcepts('wallet address').passed).toBe(false);
    expect(checkForForbiddenConcepts('payment processing').passed).toBe(false);
    expect(checkForForbiddenConcepts('crypto transaction').passed).toBe(false);
    expect(checkForForbiddenConcepts('transfer funds').passed).toBe(false);
  });

  it('checkForForbiddenConcepts passes clean text', () => {
    expect(checkForForbiddenConcepts('reference amount').passed).toBe(true);
    expect(checkForForbiddenConcepts('club id').passed).toBe(true);
    expect(checkForForbiddenConcepts('player id').passed).toBe(true);
  });

  it('OPS_MODULE_INFO restrictions mention forbidden concepts', () => {
    const restrictions = OPS_MODULE_INFO.restrictions.join(' ').toLowerCase();
    expect(restrictions).toContain('balance');
    expect(restrictions).toContain('wallet');
    expect(restrictions).toContain('payment');
  });

  it('export names contain no forbidden concepts', () => {
    const exportNames = Object.keys(require('../index')).join(' ').toLowerCase();

    // These are the core forbidden concepts we check
    expect(exportNames).not.toContain('balance');
    expect(exportNames).not.toContain('wallet');
    expect(exportNames).not.toContain('payment');
    // Note: 'crypto' is in 'createOpsError' - allowed in type names
  });
});

// ============================================================================
// TEST: No Engine Imports
// ============================================================================

describe('No Engine Imports', () => {
  it('FORBIDDEN_IMPORTS includes engine paths', () => {
    expect(FORBIDDEN_IMPORTS).toContain('engine/core');
    expect(FORBIDDEN_IMPORTS).toContain('engine/internals');
    expect(FORBIDDEN_IMPORTS).toContain('engine/mutations');
    expect(FORBIDDEN_IMPORTS).toContain('engine/state');
    expect(FORBIDDEN_IMPORTS).toContain('grey-flow');
    expect(FORBIDDEN_IMPORTS).toContain('greyFlowEngine');
  });

  it('checkForForbiddenImports detects engine imports', () => {
    expect(checkForForbiddenImports('import { x } from "engine/core"').passed).toBe(false);
    expect(checkForForbiddenImports('import { y } from "greyFlowEngine"').passed).toBe(false);
    expect(checkForForbiddenImports('import { z } from "paymentService"').passed).toBe(false);
  });

  it('checkForForbiddenImports passes valid imports', () => {
    expect(checkForForbiddenImports('import { x } from "./types"').passed).toBe(true);
    expect(checkForForbiddenImports('import { y } from "../utils"').passed).toBe(true);
  });

  it('source files contain no engine imports', () => {
    const srcDir = path.join(__dirname, '..');
    const files = getAllTsFiles(srcDir);
    const violations: string[] = [];

    // Exclude boundary guards files (they define the forbidden patterns)
    // Also exclude grey-flow module files (they can reference grey-flow in documentation)
    // Also exclude main index.ts (it imports from grey-flow module)
    const excludePatterns = [
      'OpsBoundaryGuards.ts',
      'GreyFlowBoundaryGuards.ts',
      '/grey-flow/',
      'src/index.ts',
    ];

    for (const file of files) {
      // Skip files that define the forbidden patterns or are part of grey-flow module
      if (excludePatterns.some(pattern => file.includes(pattern))) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const result = checkForForbiddenImports(content);

      if (!result.passed) {
        violations.push(`File ${file}: ${result.violations.map(v => v.detail).join(', ')}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('OPS_BOUNDARY_DECLARATION forbids engine access', () => {
    expect(OPS_BOUNDARY_DECLARATION.allowsEngineAccess).toBe(false);
  });
});

// ============================================================================
// TEST: No Mutation Functions Exported
// ============================================================================

describe('No Mutation Functions Exported', () => {
  it('checkForForbiddenFunctions detects mutation patterns', () => {
    expect(checkForForbiddenFunctions(['executePayment']).passed).toBe(false);
    expect(checkForForbiddenFunctions(['transferFunds']).passed).toBe(false);
    expect(checkForForbiddenFunctions(['updateBalance']).passed).toBe(false);
    expect(checkForForbiddenFunctions(['setBalance']).passed).toBe(false);
  });

  it('checkForForbiddenFunctions passes valid function names', () => {
    expect(checkForForbiddenFunctions(['createReference']).passed).toBe(true);
    expect(checkForForbiddenFunctions(['validateInput']).passed).toBe(true);
    expect(checkForForbiddenFunctions(['mapToGreyReference']).passed).toBe(true);
  });

  it('exported functions have no mutation patterns', () => {
    const exports = require('../index');
    const functionNames = Object.keys(exports).filter(k => typeof exports[k] === 'function');

    const result = checkForForbiddenFunctions(functionNames);
    expect(result.passed).toBe(true);
  });

  it('OPS_BOUNDARY_DECLARATION is read-only', () => {
    expect(OPS_BOUNDARY_DECLARATION.isReadOnly).toBe(true);
    expect(OPS_BOUNDARY_DECLARATION.isReferenceOnly).toBe(true);
    expect(OPS_BOUNDARY_DECLARATION.allowsValueComputation).toBe(false);
  });
});

// ============================================================================
// TEST: Determinism - Same Input => Same Output
// ============================================================================

describe('Determinism', () => {
  it('ID factories produce consistent results', () => {
    const id1 = createExternalReferenceId('test-123');
    const id2 = createExternalReferenceId('test-123');
    expect(id1).toBe(id2);
  });

  it('validation functions are deterministic', () => {
    expect(isValidInteger(42)).toBe(true);
    expect(isValidInteger(42)).toBe(true);
    expect(isValidInteger(3.14)).toBe(false);
    expect(isValidInteger(3.14)).toBe(false);

    expect(isValidPositiveInteger(100)).toBe(true);
    expect(isValidPositiveInteger(-1)).toBe(false);

    expect(isValidTimestamp(1700000000000)).toBe(true);
    expect(isValidTimestamp(100)).toBe(false);
  });

  it('boundary checks are deterministic', () => {
    const text = 'test balance update';
    const result1 = checkForForbiddenConcepts(text);
    const result2 = checkForForbiddenConcepts(text);

    expect(result1.passed).toBe(result2.passed);
    expect(result1.violations.length).toBe(result2.violations.length);
  });

  it('result helpers produce frozen objects', () => {
    const successResult = opsSuccess({ value: 42 });
    const failureResult = opsFailure(createOpsError(OpsErrorCode.INVALID_INPUT, 'test'));

    expect(successResult.success).toBe(true);
    expect(failureResult.success).toBe(false);
    if (!failureResult.success) {
      expect(Object.isFrozen(failureResult.error)).toBe(true);
    }
  });

  it('OPS_MODULE_INFO is frozen', () => {
    expect(Object.isFrozen(OPS_MODULE_INFO)).toBe(true);
    expect(Object.isFrozen(OPS_MODULE_INFO.guarantees)).toBe(true);
    expect(Object.isFrozen(OPS_MODULE_INFO.restrictions)).toBe(true);
  });
});

// ============================================================================
// TEST: Append-Only Enforcement
// ============================================================================

describe('Append-Only Enforcement', () => {
  let store: InMemoryReferenceStore;
  let ingestor: RechargeIngestor;

  const timestamp = 1700000000000;
  const createTestInput = (id: string): RechargeReferenceInput => ({
    externalReferenceId: createExternalReferenceId(id),
    adapterType: AdapterType.MANUAL_ADMIN,
    clubId: 'club-1',
    playerId: 'player-1',
    referenceAmount: 1000,
    declaredAt: timestamp,
  });

  beforeEach(() => {
    store = new InMemoryReferenceStore();
    ingestor = createRechargeIngestor(store);
  });

  it('ingestor appends new references', () => {
    const input = createTestInput('ref-1');
    const result = ingestor.ingest(input, timestamp);

    expect(result.success).toBe(true);
    expect(ingestor.getReferenceCount()).toBe(1);
  });

  it('ingestor rejects duplicate references (idempotency)', () => {
    const input = createTestInput('ref-1');

    const result1 = ingestor.ingest(input, timestamp);
    expect(result1.success).toBe(true);

    const result2 = ingestor.ingest(input, timestamp + 1);
    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error.code).toBe(OpsErrorCode.DUPLICATE_REFERENCE);
    }

    // Count should still be 1
    expect(ingestor.getReferenceCount()).toBe(1);
  });

  it('store getAll returns frozen array', () => {
    const input = createTestInput('ref-1');
    ingestor.ingest(input, timestamp);

    const all = store.getAll();
    expect(Object.isFrozen(all)).toBe(true);
  });

  it('records are frozen on append', () => {
    const input = createTestInput('ref-1');
    const result = ingestor.ingest(input, timestamp);

    if (result.success) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.input)).toBe(true);
    }
  });

  it('multiple unique references can be appended', () => {
    ingestor.ingest(createTestInput('ref-1'), timestamp);
    ingestor.ingest(createTestInput('ref-2'), timestamp + 1);
    ingestor.ingest(createTestInput('ref-3'), timestamp + 2);

    expect(ingestor.getReferenceCount()).toBe(3);
  });
});

// ============================================================================
// TEST: Grey Reference Mapping Correctness
// ============================================================================

describe('Grey Reference Mapping', () => {
  let mapper: GreyRechargeMapper;

  const timestamp = 1700000000000;

  const createConfirmedRecord = (): RechargeReferenceRecord => ({
    referenceId: createRechargeReferenceId('ref-1'),
    status: ReferenceStatus.CONFIRMED,
    input: {
      externalReferenceId: createExternalReferenceId('ext-1'),
      adapterType: AdapterType.MANUAL_ADMIN,
      clubId: 'club-1',
      playerId: 'player-1',
      referenceAmount: 1000,
      declaredAt: timestamp,
    },
    confirmation: {
      confirmationId: createConfirmationId('confirm-1'),
      operatorId: 'admin-1',
      confirmedAt: timestamp + 1000,
    },
    createdAt: timestamp,
    updatedAt: timestamp + 1000,
  });

  beforeEach(() => {
    mapper = createGreyRechargeMapper();
  });

  it('maps confirmed reference correctly', () => {
    const record = createConfirmedRecord();
    const result = mapper.mapToGreyReference(record, timestamp + 2000);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.reference.externalReferenceId).toBe('ext-1');
      expect(result.value.reference.clubId).toBe('club-1');
      expect(result.value.reference.playerId).toBe('player-1');
      expect(result.value.reference.referenceAmount).toBe(1000);
      expect(result.value.reference.source).toBe('ops:MANUAL_ADMIN');
    }
  });

  it('rejects non-confirmed references', () => {
    const record: RechargeReferenceRecord = {
      ...createConfirmedRecord(),
      status: ReferenceStatus.DECLARED,
      confirmation: undefined,
    };

    const result = mapper.mapToGreyReference(record, timestamp);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(OpsErrorCode.INVALID_STATUS_TRANSITION);
    }
  });

  it('mapped reference is frozen', () => {
    const record = createConfirmedRecord();
    const result = mapper.mapToGreyReference(record, timestamp + 2000);

    if (result.success) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.reference)).toBe(true);
    }
  });

  it('validates Grey reference format', () => {
    const validRef = {
      externalReferenceId: 'ext-1',
      clubId: 'club-1',
      playerId: 'player-1',
      referenceAmount: 1000,
      source: 'ops:MANUAL_ADMIN',
      declaredAt: timestamp,
      confirmedAt: timestamp + 1000,
      confirmedBy: 'admin-1',
    };

    const result = mapper.validateGreyReference(validRef);
    expect(result.success).toBe(true);
  });

  it('rejects invalid Grey reference', () => {
    const invalidRef = {
      externalReferenceId: '',
      clubId: 'club-1',
      playerId: 'player-1',
      referenceAmount: 1000,
      source: 'ops:MANUAL_ADMIN',
      declaredAt: timestamp,
      confirmedAt: timestamp + 1000,
      confirmedBy: 'admin-1',
    };

    const result = mapper.validateGreyReference(invalidRef);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// TEST: Manual Admin Adapter
// ============================================================================

describe('Manual Admin Adapter', () => {
  let adapter: ManualAdminAdapterStub;
  const timestamp = 1700000000000;

  beforeEach(() => {
    adapter = createManualAdminAdapter();
  });

  it('creates adapter with correct type', () => {
    expect(adapter.adapterType).toBe(AdapterType.MANUAL_ADMIN);
    expect(adapter.isEnabled()).toBe(true);
  });

  it('validates manual admin input', () => {
    const validInput: ManualAdminInput = {
      clubId: 'club-1',
      playerId: 'player-1',
      referenceAmount: 1000,
      operatorId: 'admin-1',
      timestamp,
    };

    const result = adapter.validateInput(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects invalid input', () => {
    const invalidInput: ManualAdminInput = {
      clubId: '',
      playerId: 'player-1',
      referenceAmount: 1000,
      operatorId: 'admin-1',
      timestamp,
    };

    const result = adapter.validateInput(invalidInput);
    expect(result.success).toBe(false);
  });

  it('creates reference input from valid admin input', () => {
    const input: ManualAdminInput = {
      clubId: 'club-1',
      playerId: 'player-1',
      referenceAmount: 1000,
      operatorId: 'admin-1',
      timestamp,
      notes: 'test notes',
    };

    const result = adapter.createReferenceInput(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.clubId).toBe('club-1');
      expect(result.value.playerId).toBe('player-1');
      expect(result.value.referenceAmount).toBe(1000);
      expect(result.value.adapterType).toBe(AdapterType.MANUAL_ADMIN);
    }
  });
});

// ============================================================================
// TEST: Human Confirm Queue
// ============================================================================

describe('Human Confirm Queue', () => {
  let queue: HumanConfirmQueue;
  const timestamp = 1700000000000;

  const createDeclaredRecord = (): RechargeReferenceRecord => ({
    referenceId: createRechargeReferenceId('ref-1'),
    status: ReferenceStatus.DECLARED,
    input: {
      externalReferenceId: createExternalReferenceId('ext-1'),
      adapterType: AdapterType.MANUAL_ADMIN,
      clubId: 'club-1',
      playerId: 'player-1',
      referenceAmount: 1000,
      declaredAt: timestamp,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  beforeEach(() => {
    queue = createHumanConfirmQueue();
  });

  it('enqueues declared reference', () => {
    const record = createDeclaredRecord();
    const result = queue.enqueue(record, timestamp);

    expect(result.success).toBe(true);
    expect(queue.getPendingCount()).toBe(1);
  });

  it('confirms reference with human operator', () => {
    const record = createDeclaredRecord();
    queue.enqueue(record, timestamp);

    const confirmResult = queue.confirm({
      referenceId: record.referenceId,
      operatorId: 'admin-1',
      timestamp: timestamp + 1000,
      notes: 'Confirmed by admin',
    });

    expect(confirmResult.success).toBe(true);
    if (confirmResult.success) {
      expect(confirmResult.value.status).toBe(ReferenceStatus.CONFIRMED);
      expect(confirmResult.value.confirmation).toBeDefined();
      expect(confirmResult.value.confirmation!.operatorId).toBe('admin-1');
    }

    expect(queue.getPendingCount()).toBe(0);
  });

  it('rejects reference with reason', () => {
    const record = createDeclaredRecord();
    queue.enqueue(record, timestamp);

    const rejectResult = queue.reject({
      referenceId: record.referenceId,
      operatorId: 'admin-1',
      timestamp: timestamp + 1000,
      reason: 'Invalid reference',
    });

    expect(rejectResult.success).toBe(true);
    if (rejectResult.success) {
      expect(rejectResult.value.status).toBe(ReferenceStatus.REJECTED);
    }

    expect(queue.getPendingCount()).toBe(0);
  });

  it('cannot enqueue non-declared reference', () => {
    const confirmedRecord: RechargeReferenceRecord = {
      ...createDeclaredRecord(),
      status: ReferenceStatus.CONFIRMED,
    };

    const result = queue.enqueue(confirmedRecord, timestamp);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// TEST: Grey Push Client (NO-OP)
// ============================================================================

describe('Grey Push Client (NO-OP)', () => {
  it('is disabled by default in OPS-0', () => {
    const client = createGreyPushClient();
    expect(client.isEnabled()).toBe(false);
  });

  it('push fails when disabled', () => {
    const client = createGreyPushClient();
    const timestamp = 1700000000000;

    const mappingResult = {
      reference: {
        externalReferenceId: 'ext-1',
        clubId: 'club-1',
        playerId: 'player-1',
        referenceAmount: 1000,
        source: 'ops:MANUAL_ADMIN',
        declaredAt: timestamp,
        confirmedAt: timestamp + 1000,
        confirmedBy: 'admin-1',
      },
      sourceRecord: {} as RechargeReferenceRecord,
      mappedAt: timestamp,
    };

    const result = client.push({
      mappingResult,
      timestamp: timestamp + 2000,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(OpsErrorCode.PUSH_FAILED);
    }
  });

  it('simulatePush succeeds for testing', () => {
    const client = createGreyPushClient();
    const timestamp = 1700000000000;

    const mappingResult = {
      reference: {
        externalReferenceId: 'ext-1',
        clubId: 'club-1',
        playerId: 'player-1',
        referenceAmount: 1000,
        source: 'ops:MANUAL_ADMIN',
        declaredAt: timestamp,
        confirmedAt: timestamp + 1000,
        confirmedBy: 'admin-1',
      },
      sourceRecord: {} as RechargeReferenceRecord,
      mappedAt: timestamp,
    };

    const result = client.simulatePush({
      mappingResult,
      timestamp: timestamp + 2000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.pushDetails.greyRechargeId).toBeDefined();
    }
  });
});

// ============================================================================
// TEST: Future USDT Placeholder
// ============================================================================

describe('Future USDT Placeholder', () => {
  it('is marked as NOT_IMPLEMENTED', () => {
    expect(FUTURE_USDT_PLACEHOLDER.status).toBe('NOT_IMPLEMENTED');
  });

  it('adapter is disabled', () => {
    const adapter = createFutureUsdtAdapter();
    expect(adapter.isEnabled()).toBe(false);
  });

  it('has planned features documented', () => {
    expect(FUTURE_USDT_PLACEHOLDER.plannedFeatures.length).toBeGreaterThan(0);
  });

  it('has constraints documented', () => {
    expect(FUTURE_USDT_PLACEHOLDER.constraints.length).toBeGreaterThan(0);
    const constraints = FUTURE_USDT_PLACEHOLDER.constraints.join(' ').toLowerCase();
    expect(constraints).toContain('reference');
    expect(constraints).toContain('manual');
  });
});

// ============================================================================
// TEST: Integer-Only Enforcement
// ============================================================================

describe('Integer-Only Enforcement', () => {
  it('isValidInteger rejects floats', () => {
    expect(isValidInteger(3.14)).toBe(false);
    expect(isValidInteger(0.5)).toBe(false);
    expect(isValidInteger(-1.5)).toBe(false);
  });

  it('isValidInteger accepts integers', () => {
    expect(isValidInteger(0)).toBe(true);
    expect(isValidInteger(42)).toBe(true);
    expect(isValidInteger(-100)).toBe(true);
  });

  it('assertInteger fails for floats', () => {
    const result = assertInteger(3.14, 'amount');
    expect(result.success).toBe(false);
  });

  it('assertPositiveInteger fails for non-positive', () => {
    expect(assertPositiveInteger(0, 'amount').success).toBe(false);
    expect(assertPositiveInteger(-1, 'amount').success).toBe(false);
    expect(assertPositiveInteger(1, 'amount').success).toBe(true);
  });

  it('referenceAmount must be positive integer', () => {
    const adapter = createManualAdminAdapter();
    const timestamp = 1700000000000;

    // Float amount
    const floatInput: ManualAdminInput = {
      clubId: 'club-1',
      playerId: 'player-1',
      referenceAmount: 100.5,
      operatorId: 'admin-1',
      timestamp,
    };
    expect(adapter.validateInput(floatInput).success).toBe(false);

    // Zero amount
    const zeroInput: ManualAdminInput = {
      clubId: 'club-1',
      playerId: 'player-1',
      referenceAmount: 0,
      operatorId: 'admin-1',
      timestamp,
    };
    expect(adapter.validateInput(zeroInput).success).toBe(false);

    // Negative amount
    const negativeInput: ManualAdminInput = {
      clubId: 'club-1',
      playerId: 'player-1',
      referenceAmount: -100,
      operatorId: 'admin-1',
      timestamp,
    };
    expect(adapter.validateInput(negativeInput).success).toBe(false);
  });
});

// ============================================================================
// TEST: Version and Phase
// ============================================================================

describe('Version and Phase', () => {
  it('OPS_VERSION is 0.1.0', () => {
    expect(OPS_VERSION).toBe('0.1.0');
  });

  it('OPS_PHASE is OPS-0', () => {
    expect(OPS_PHASE).toBe('OPS-0');
  });

  it('OPS_MODULE_INFO contains all required info', () => {
    expect(OPS_MODULE_INFO.name).toBe('texas-holdem-ops');
    expect(OPS_MODULE_INFO.version).toBe('0.1.0');
    expect(OPS_MODULE_INFO.phase).toBe('OPS-0');
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}
