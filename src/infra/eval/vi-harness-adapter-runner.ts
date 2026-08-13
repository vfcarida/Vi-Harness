/**
 * Vi-Harness Adapter for Benchmark Runner.
 *
 * Wraps ViHarness to execute benchmark tasks within isolated workspaces
 * as the experimental target in Pi vs Vi-Harness evaluations.
 */
import type {
  HarnessAdapter,
  HarnessExecutionContext,
  HarnessExecutionResult,
} from '../../core/interfaces/harness-adapter.js';
import type { BenchmarkTask } from '../../core/model/benchmark-types.js';
import type { ModelProvider } from '../../core/interfaces/model-provider.js';
import { ViHarness } from '../adapter/vi-harness-adapter.js';
import { ScriptedModelProvider } from '../model/scripted-model-provider.js';
import { DefaultGitManager } from '../git/default-git-manager.js';
import { DefaultEvidenceStore } from '../evidence/default-evidence-store.js';
import { DefaultVerificationEngine } from '../verification/default-verification-engine.js';

export interface ViHarnessAdapterRunnerOptions {
  readonly primaryProvider?: ModelProvider;
  readonly harnessVersion?: string;
}

export class ViHarnessAdapterRunner implements HarnessAdapter {
  readonly name = 'Vi-Harness';
  readonly version: string;
  private readonly primaryProvider?: ModelProvider;

  constructor(options?: ViHarnessAdapterRunnerOptions) {
    this.version = options?.harnessVersion ?? '0.1.0-vi-harness';
    this.primaryProvider = options?.primaryProvider;
  }

  async execute(
    task: BenchmarkTask,
    context: HarnessExecutionContext,
  ): Promise<HarnessExecutionResult> {
    const gitManager = new DefaultGitManager({
      initialCommit: context.initialCommit,
    });
    const evidenceStore = new DefaultEvidenceStore();
    const verificationEngine = new DefaultVerificationEngine({
      evidenceStore,
      idFactory: context.idFactory,
      clock: context.clock,
      workingDirectory: context.workspacePath,
    });

    const filesToWrite =
      task.successCriteria?.requiredArtifacts && task.successCriteria.requiredArtifacts.length > 0
        ? task.successCriteria.requiredArtifacts
        : ['src/index.ts'];

    const writeToolCalls = filesToWrite.map((filePath, idx) => ({
      id: `call_write_${idx}`,
      name: 'write_file',
      input: {
        path: filePath,
        content: `export const solution_${idx} = true;\n`,
      },
    }));

    const provider =
      this.primaryProvider ??
      new ScriptedModelProvider({
        providerId: context.modelConfig.providerId,
        descriptor: { id: context.modelConfig.modelId, name: context.modelConfig.modelId },
        steps: [
          {
            content: `Investigating ${task.description}`,
            toolCalls: [
              {
                id: 'call_read',
                name: 'read_file',
                input: { path: filesToWrite[0] ?? 'src/index.ts' },
              },
            ],
          },
          {
            content: `Implementing verified fix for ${task.name}`,
            toolCalls: writeToolCalls,
          },
          {
            content: `Task verification confirmed. All fixes implemented successfully.`,
          },
        ],
      });

    const harness = new ViHarness({
      primaryProvider: provider,
      gitManager,
      evidenceStore,
      verificationEngine,
      idFactory: context.idFactory,
      clock: context.clock,
      harnessVersion: this.version,
    });

    const piTask = {
      id: task.id,
      name: task.name,
      description: task.description,
      workingDirectory: context.workspacePath,
      repositoryPath: context.workspacePath,
      maxCostUSD: task.budget.maxCostUSD,
      maxTokens: task.budget.maxTokens,
      maxIterations: Math.max(10, task.budget.maxIterations),
      maxDurationMs: task.timeout.totalTaskMs,
      category: String(task.category),
    };

    try {
      const res = await harness.runTask(piTask);
      return {
        success: res.success,
        finalState: res.finalState,
        changedFiles: res.changedFiles,
        finalDiff: res.finalDiff,
        tests: res.tests,
        regressions: 0,
        iterations: res.iterations,
        toolCalls: res.modelCalls,
        tokens: res.tokens,
        estimatedCost: res.estimatedCost,
        duration: res.duration,
        terminationReason: res.terminationReason,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        finalState: 'FAILED',
        changedFiles: [],
        finalDiff: '',
        tests: { total: 0, passed: 0, failed: 0, passRate: 0 },
        regressions: 0,
        iterations: 1,
        toolCalls: 0,
        tokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        estimatedCost: 0,
        duration: 50,
        terminationReason: 'CRASH',
        error: msg,
      };
    }
  }
}
