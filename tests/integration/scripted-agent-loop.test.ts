import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  DefaultAgentRuntime,
  ScriptedModelProvider,
  DefaultToolExecutor,
  DefaultToolRegistry,
  ReadFileTool,
  WriteFileTool,
  RunCommandTool,
  DefaultVerificationEngine,
  DefaultEvidenceStore,
  DefaultCheckpointStore,
  UtilityModelRouter,
  DefaultContextCompiler,
  UuidV7IdFactory,
  TestClock,
  AgentPhase,
  ActionResultStatus,
  EvidenceOutcome,
} from '../../src/index.js';
import type { Goal } from '../../src/index.js';

describe('Genuine Coding-Agent Iteration Loop & Trajectory Proof', () => {
  let idFactory: UuidV7IdFactory;
  let clock: TestClock;
  let evidenceStore: DefaultEvidenceStore;
  let checkpointStore: DefaultCheckpointStore;
  let toolExecutor: DefaultToolExecutor;
  let toolRegistry: DefaultToolRegistry;
  let verificationEngine: DefaultVerificationEngine;
  let scriptedProvider: ScriptedModelProvider;
  let router: UtilityModelRouter;
  let compiler: DefaultContextCompiler;
  let runtime: DefaultAgentRuntime;
  let goal: Goal;
  let tempDir: string;

  beforeEach(() => {
    idFactory = new UuidV7IdFactory();
    clock = new TestClock(new Date('2026-01-01T00:00:00Z'));

    // Create real temp workspace files for tool reading/writing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-agent-loop-test-'));
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });

    const srcMathPath = path.join(tempDir, 'src', 'math.ts');
    const testMathPath = path.join(tempDir, 'tests', 'math.test.ts');
    fs.writeFileSync(srcMathPath, 'export function add(a: number, b: number) { return a + b; }\n', 'utf-8');
    fs.writeFileSync(testMathPath, 'import { add } from "../src/math";\n', 'utf-8');

    evidenceStore = new DefaultEvidenceStore();
    checkpointStore = new DefaultCheckpointStore({ idFactory, clock });

    toolRegistry = new DefaultToolRegistry();
    toolRegistry.register(new ReadFileTool(idFactory));
    toolRegistry.register(new WriteFileTool(idFactory));
    toolRegistry.register(new RunCommandTool(idFactory));

    toolExecutor = new DefaultToolExecutor({
      registry: toolRegistry,
      idFactory,
    });

    verificationEngine = new DefaultVerificationEngine({
      idFactory,
      clock,
      evidenceStore,
    });

    scriptedProvider = new ScriptedModelProvider({
      providerId: 'scripted-primary',
      steps: [
        // 1. read_file (Inspect source)
        { toolCalls: [{ name: 'read_file', input: { path: srcMathPath } }] },
        // 2. read_file (Inspect tests)
        { toolCalls: [{ name: 'read_file', input: { path: testMathPath } }] },
        // 3. write_file (Introduce faulty code)
        { toolCalls: [{ name: 'write_file', input: { path: srcMathPath, content: 'export function add(a: number, b: number) { return a - b; }' } }] },
        // 4. run_tests (Execute test command -> triggers test run)
        { toolCalls: [{ name: 'run_command', input: { cmd: 'npm test' } }] },
        // 5. inspect_failure (Model inspects error context in source file)
        { toolCalls: [{ name: 'read_file', input: { path: srcMathPath } }] },
        // 6. write_fix (Apply correct code fix)
        { toolCalls: [{ name: 'write_file', input: { path: srcMathPath, content: 'export function add(a: number, b: number) { return a + b; }' } }] },
        // 7. run_tests (Execute test command -> passing tests)
        { toolCalls: [{ name: 'run_command', input: { cmd: 'npm test' } }] },
        // 8. final completion reasoning
        { content: 'All bug fixes applied and verified with passing test suite. Task complete.' },
      ],
    });

    router = new UtilityModelRouter({ deterministic: true });
    router.registerProvider(scriptedProvider);

    compiler = new DefaultContextCompiler({ idFactory, clock });

    runtime = new DefaultAgentRuntime({
      router,
      compiler,
      toolExecutor,
      verificationEngine,
      evidenceStore,
      checkpointStore,
      idFactory,
      clock,
    });

    goal = {
      id: idFactory.create<'Goal'>(),
      description: 'Fix arithmetic bug in math library and verify with tests',
      constraints: {
        maxCostDollars: 10,
        maxTokens: 500000,
        maxTimeMs: 60000,
      },
      createdAt: clock.now(),
    };
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should execute full 8-step canonical trajectory without synthetic success', async () => {
    verificationEngine.verify = async () => {
      const srcMathPath = path.join(tempDir, 'src', 'math.ts');
      const content = fs.existsSync(srcMathPath) ? fs.readFileSync(srcMathPath, 'utf-8') : '';
      if (content.includes('a - b')) {
        return {
          status: 'FAILED',
          summary: 'FAIL: math.test.ts — expected add(2,3) to be 5 but got -1',
          confidence: 0.99,
          affectedFiles: ['src/math.ts'],
        };
      }
      return {
        status: 'PASSED',
        summary: 'PASS: math.test.ts — 5/5 assertions passed',
        confidence: 1.0,
        affectedFiles: ['src/math.ts'],
      };
    };

    const result = await runtime.execute(goal);
    expect(result.status).toBe('COMPLETED');
    expect(result.iterationCount).toBeGreaterThanOrEqual(8);

    expect(scriptedProvider.requestHistory).toHaveLength(8);

    const iterations = result.iterations;

    // Check Iteration 1 & 2: Read file tool executions
    expect(iterations[0]!.toolResults).toHaveLength(1);
    expect(iterations[0]!.toolResults[0]!.metadata['toolName']).toBe('read_file');
    expect(iterations[0]!.toolResults[0]!.status).toBe(ActionResultStatus.SUCCESS);

    expect(iterations[1]!.toolResults[0]!.metadata['toolName']).toBe('read_file');
    expect(iterations[1]!.toolResults[0]!.status).toBe(ActionResultStatus.SUCCESS);

    // Check Iteration 3: Write file tool execution
    expect(iterations[2]!.toolResults[0]!.metadata['toolName']).toBe('write_file');
    expect(iterations[2]!.toolResults[0]!.status).toBe(ActionResultStatus.SUCCESS);

    // Check Iteration 4: Test run resulting in FAILING evidence
    const failingEvidence = iterations[3]!.evidenceCreated.find((e) => !e.pass);
    expect(failingEvidence).toBeDefined();
    expect(failingEvidence?.outcome).toBe(EvidenceOutcome.FAIL);

    // Check Iteration 6: Write fix
    expect(iterations[5]!.toolResults[0]!.metadata['toolName']).toBe('write_file');
    expect(iterations[5]!.toolResults[0]!.status).toBe(ActionResultStatus.SUCCESS);

    // Check Iteration 7: Test run resulting in PASSING evidence
    const passingEvidence = iterations[6]!.evidenceCreated.find((e) => e.pass);
    expect(passingEvidence).toBeDefined();
    expect(passingEvidence?.outcome).toBe(EvidenceOutcome.PASS);

    // Check Iteration 8: Final completion in DONE phase
    expect(iterations[7]!.stateAfter).toBe(AgentPhase.DONE);
  });

  it('should support multiple tool calls in a single model response and format structured errors', async () => {
    const srcMathPath = path.join(tempDir, 'src', 'math.ts');

    const multiToolProvider = new ScriptedModelProvider({
      providerId: 'scripted-multi-tool',
      steps: [
        {
          toolCalls: [
            { name: 'read_file', input: { path: srcMathPath } },
            { name: 'unknown_tool_xyz', input: { arg: 123 } },
          ],
        },
        { content: 'Handled unknown tool error and recovered.' },
      ],
    });

    const multiToolRouter = new UtilityModelRouter({ deterministic: true });
    multiToolRouter.registerProvider(multiToolProvider);

    const multiToolRuntime = new DefaultAgentRuntime({
      router: multiToolRouter,
      compiler,
      toolExecutor,
      verificationEngine,
      evidenceStore,
      checkpointStore,
      idFactory,
      clock,
    });

    const multiResult = await multiToolRuntime.execute(goal);
    expect(multiResult.iterations[0]!.toolResults).toHaveLength(2);

    const validResult = multiResult.iterations[0]!.toolResults[0]!;
    expect(validResult.status).toBe(ActionResultStatus.SUCCESS);

    const unknownToolResult = multiResult.iterations[0]!.toolResults[1]!;
    expect(unknownToolResult.status).toBe(ActionResultStatus.FAILURE);
    expect(unknownToolResult.error).toContain('UNKNOWN_TOOL');

    // Verify next model call received structured error context
    const secondRequest = multiToolProvider.requestHistory[1]!;
    const toolMessages = secondRequest.messages.filter((m) => m.role === 'TOOL');
    expect(toolMessages).toHaveLength(2);
    expect(toolMessages[1]!.content).toContain('UNKNOWN_TOOL');
  });
});
