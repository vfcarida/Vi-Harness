/**
 * Meta-Harness Trace Logger Unit Test Suite.
 *
 * Verifies structured causal trace recording, token accounting, summary calculation,
 * and JSONL export capabilities.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MetaHarnessTraceLogger, UuidV7IdFactory } from '../../../src/infra/index.js';
import { AgentPhase, MessageRole, ToolCategory, ToolRiskLevel } from '../../../src/core/index.js';

describe('MetaHarnessTraceLogger Unit Tests', () => {
  const idFactory = new UuidV7IdFactory();

  it('records iteration traces, computes execution summaries, and exports valid JSONL', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-traces-test-'));
    const logger = new MetaHarnessTraceLogger({ outputDir: tempDir, writeToDisk: true });

    const executionId = idFactory.create<'Execution'>();
    const taskId = idFactory.create<'Task'>();

    // 1. Record Iteration 1
    logger.recordIteration({
      traceId: 'tr_1',
      executionId,
      taskId,
      iterationId: idFactory.create<'Iteration'>(),
      sequenceNumber: 1,
      phaseBefore: AgentPhase.DISCOVER,
      phaseAfter: AgentPhase.DECIDE,
      selectedProviderId: 'openai-frontier',
      selectedModelId: 'gpt-4o',
      targetRole: 'ARCHITECT',
      promptTokens: 1200,
      completionTokens: 300,
      cachedTokens: 800,
      totalTokens: 1500,
      costDollars: 0.015,
      messages: [{ role: MessageRole.USER, content: 'Investigate login failure.' }],
      proposedToolCalls: [{ name: 'read_file', input: { path: 'src/login.ts' }, id: 'c_1' }],
      policyDecisions: [],
      executedToolResults: [
        {
          toolCallId: 'c_1',
          success: true,
          output: 'function login() {}',
          durationMs: 40,
        },
      ],
      evidenceCreated: [],
      durationMs: 350,
      timestamp: new Date(),
    });

    // 2. Record Iteration 2
    logger.recordIteration({
      traceId: 'tr_2',
      executionId,
      taskId,
      iterationId: idFactory.create<'Iteration'>(),
      sequenceNumber: 2,
      phaseBefore: AgentPhase.DECIDE,
      phaseAfter: AgentPhase.DONE,
      selectedProviderId: 'openai-mini',
      selectedModelId: 'gpt-4o-mini',
      targetRole: 'EDITOR',
      promptTokens: 800,
      completionTokens: 200,
      cachedTokens: 600,
      totalTokens: 1000,
      costDollars: 0.002,
      messages: [{ role: MessageRole.ASSISTANT, content: 'Applied fix.' }],
      proposedToolCalls: [{ name: 'run_command', input: { command: 'npm test' }, id: 'c_2' }],
      policyDecisions: [],
      executedToolResults: [
        {
          toolCallId: 'c_2',
          success: true,
          output: 'PASS',
          durationMs: 120,
        },
      ],
      evidenceCreated: [
        {
          id: idFactory.create<'Evidence'>(),
          taskId,
          iterationId: idFactory.create<'Iteration'>(),
          kind: 'TEST_PASS' as any,
          pass: true,
          source: 'unit_test',
          content: 'Tests passed',
          createdAt: new Date(),
        },
      ],
      durationMs: 250,
      timestamp: new Date(),
    });

    // 3. Finalize
    const startedAt = new Date(Date.now() - 1000);
    const finishedAt = new Date();

    const summary = logger.finalizeExecution({
      executionId,
      taskId,
      goalDescription: 'Fix authentication error',
      success: true,
      finalPhase: AgentPhase.DONE,
      startedAt,
      finishedAt,
    });

    expect(summary.totalIterations).toBe(2);
    expect(summary.totalTokens).toBe(2500);
    expect(summary.promptTokens).toBe(2000);
    expect(summary.completionTokens).toBe(500);
    expect(summary.cachedTokens).toBe(1400);
    expect(summary.totalCostDollars).toBeCloseTo(0.017, 4);
    expect(summary.totalToolCalls).toBe(2);
    expect(summary.passesEvidenceCount).toBe(1);
    expect(summary.failureEvidenceCount).toBe(0);

    // 4. JSONL Export
    const jsonl = logger.exportJsonl(executionId);
    const lines = jsonl.trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]!).promptTokens).toBe(1200);

    // 5. Verify Disk Files
    const traceFile = path.join(tempDir, `${executionId}-traces.jsonl`);
    const summaryFile = path.join(tempDir, `${executionId}-summary.json`);
    expect(fs.existsSync(traceFile)).toBe(true);
    expect(fs.existsSync(summaryFile)).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
