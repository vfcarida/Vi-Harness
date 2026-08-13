import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefaultVerificationEngine,
  DefaultEvidenceStore,
  DefaultEvidenceAggregator,
  UuidV7IdFactory,
  TestClock,
} from '../../../src/infra/index.js';
import {
  VerificationProfile,
  VerificationStatus,
  EvidenceOutcome,
  EvidenceType,
} from '../../../src/core/index.js';
import type { TaskId, VerificationSuite } from '../../../src/core/index.js';

describe('Verification and Evidence Layers', () => {
  let engine: DefaultVerificationEngine;
  let store: DefaultEvidenceStore;
  let aggregator: DefaultEvidenceAggregator;
  let idFactory: UuidV7IdFactory;
  let clock: TestClock;
  let taskId: TaskId;

  beforeEach(() => {
    idFactory = new UuidV7IdFactory();
    clock = new TestClock(new Date('2024-01-01T00:00:00Z'));
    store = new DefaultEvidenceStore();
    aggregator = new DefaultEvidenceAggregator();

    engine = new DefaultVerificationEngine({
      evidenceStore: store,
      idFactory,
      clock,
    });

    taskId = idFactory.create<'Task'>();
  });

  it('should record PASS evidence when one verification test passes', async () => {
    const result = await engine.verify(
      {
        type: 'unit-test',
        path: 'tests/unit/login.test.ts',
        taskId,
      },
      VerificationProfile.FAST,
    );

    expect(result.status).toBe(VerificationStatus.PASSED);
    expect(result.evidenceIds).toHaveLength(1);

    const evidenceList = await store.listForTask(taskId);
    expect(evidenceList).toHaveLength(1);
    expect(evidenceList[0]!.outcome).toBe(EvidenceOutcome.PASS);
    expect(evidenceList[0]!.pass).toBe(true);
  });

  it('should record FAIL evidence when verification target fails', async () => {
    const result = await engine.verify(
      {
        type: 'unit-test',
        content: 'failing test output',
        taskId,
      },
      VerificationProfile.STANDARD,
    );

    expect(result.status).toBe(VerificationStatus.FAILED);

    const evidenceList = await store.listForTask(taskId);
    expect(evidenceList).toHaveLength(1);
    expect(evidenceList[0]!.outcome).toBe(EvidenceOutcome.FAIL);
    expect(evidenceList[0]!.pass).toBe(false);
  });

  it('should run mixed VerificationSuite and report overall suite status', async () => {
    const suite: VerificationSuite = {
      id: 'suite-core',
      name: 'Core Verification Suite',
      profile: VerificationProfile.STANDARD,
      checks: [
        {
          checkId: 'check-typecheck',
          name: 'TypeScript Typecheck',
          command: 'tsc --noEmit',
          category: 'typecheck',
          scope: 'repository',
        },
        {
          checkId: 'check-unit-tests',
          name: 'Unit Tests',
          command: 'npm test -- --fail', // Simulates failing check
          category: 'unit-test',
          scope: 'repository',
        },
      ],
    };

    const suiteResult = await engine.runSuite(suite, taskId);
    expect(suiteResult.status).toBe(VerificationStatus.FAILED);
    expect(suiteResult.evidenceIds).toHaveLength(2);

    const storedEvidence = await store.listForTask(taskId);
    expect(storedEvidence).toHaveLength(2);
  });

  it('should detect REGRESSION when target test passes but unrelated baseline test fails', async () => {
    const checkId1 = 'check-auth';
    const checkId2 = 'check-billing';

    // Baseline evidence: check-auth PASS, check-billing PASS
    const baselineEvidence = [
      {
        id: idFactory.create<'Evidence'>(),
        taskId,
        type: EvidenceType.TEST_RESULT,
        outcome: EvidenceOutcome.PASS,
        summary: 'Auth tests passing',
        data: {},
        createdAt: clock.now(),
        pass: true,
        checkId: checkId1,
        confidence: 0.95,
        affectedFiles: [],
      },
      {
        id: idFactory.create<'Evidence'>(),
        taskId,
        type: EvidenceType.TEST_RESULT,
        outcome: EvidenceOutcome.PASS,
        summary: 'Billing tests passing',
        data: {},
        createdAt: clock.now(),
        pass: true,
        checkId: checkId2,
        confidence: 0.95,
        affectedFiles: [],
      },
    ];

    // Current evidence: check-auth PASS, check-billing FAIL (Regression!)
    const currentEvidence = [
      {
        id: idFactory.create<'Evidence'>(),
        taskId,
        type: EvidenceType.TEST_RESULT,
        outcome: EvidenceOutcome.PASS,
        summary: 'Auth tests passing',
        data: {},
        createdAt: clock.now(),
        pass: true,
        checkId: checkId1,
        confidence: 0.95,
        affectedFiles: [],
      },
      {
        id: idFactory.create<'Evidence'>(),
        taskId,
        type: EvidenceType.TEST_RESULT,
        outcome: EvidenceOutcome.FAIL,
        summary: 'Billing tests failing',
        data: {},
        createdAt: clock.now(),
        pass: false,
        checkId: checkId2,
        confidence: 0.95,
        affectedFiles: [],
      },
    ];

    const regressions = aggregator.detectRegressions(taskId, currentEvidence, baselineEvidence);
    expect(regressions).toHaveLength(1);
    expect(regressions[0]!.outcome).toBe(EvidenceOutcome.REGRESSION);
    expect(regressions[0]!.checkId).toBe(checkId2);

    // Acceptance evaluation must NOT satisfy completion when regression exists
    const evaluation = aggregator.evaluateAcceptance(taskId, regressions, {
      zeroRegressionsRequired: true,
    });

    expect(evaluation.satisfied).toBe(false);
    expect(evaluation.regressionsDetected).toHaveLength(1);
  });

  it('should handle flaky / inconclusive verification targets', async () => {
    const result = await engine.verify(
      {
        type: 'unit-test',
        content: 'flaky test warning',
        taskId,
      },
      VerificationProfile.FAST,
    );

    expect(result.status).toBe(VerificationStatus.INCONCLUSIVE);
    expect(result.confidence).toBeLessThan(0.8);
  });

  it('should block completion for missing verifier / incomplete verification', () => {
    const emptyEvaluation = aggregator.evaluateAcceptance(taskId, []);
    expect(emptyEvaluation.satisfied).toBe(false);
    expect(emptyEvaluation.missingRequirements[0]).toContain('No verification evidence');
  });

  it('should evaluate successful completion when acceptance policy criteria are met', async () => {
    await engine.verify(
      {
        type: 'build',
        content: 'clean build',
        taskId,
      },
      VerificationProfile.FULL,
    );

    const evidenceList = await store.listForTask(taskId);
    const evaluation = aggregator.evaluateAcceptance(taskId, evidenceList, {
      zeroRegressionsRequired: true,
      minConfidence: 0.8,
      allowWarnings: true,
    });

    expect(evaluation.satisfied).toBe(true);
    expect(evaluation.missingRequirements).toHaveLength(0);
  });

  it('should block completion when required checks are missing from evidence', async () => {
    const evidenceList = [
      {
        id: idFactory.create<'Evidence'>(),
        taskId,
        type: EvidenceType.VERIFICATION,
        outcome: EvidenceOutcome.PASS,
        summary: 'Build check pass',
        data: {},
        createdAt: clock.now(),
        pass: true,
        checkId: 'check-build',
        confidence: 0.95,
        affectedFiles: [],
      },
    ];

    const evaluation = aggregator.evaluateAcceptance(taskId, evidenceList, {
      requiredChecks: ['check-build', 'check-security-scan'],
      zeroRegressionsRequired: true,
    });

    expect(evaluation.satisfied).toBe(false);
    expect(evaluation.missingRequirements[0]).toContain('check-security-scan');
  });
});
