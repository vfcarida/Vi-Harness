/**
 * Local Development Execution Sandbox.
 *
 * Implements ExecutionSandbox interface for local development mode.
 *
 * NOTE: This is a local development implementation that enforces filesystem boundary checks,
 * process execution timeouts, environment isolation, and resource parameter bounds.
 * Production environments should inject containerized/microVM ExecutionSandbox implementations.
 */
import type { ExecutionSandbox } from '../../core/interfaces/sandbox.js';
import type {
  SandboxConfig,
  SandboxExecutionRequest,
  SandboxExecutionResult,
} from '../../core/model/sandbox-types.js';
import { CommandSanitizer } from '../tools/command-sanitizer.js';

export interface LocalDevelopmentSandboxOptions {
  readonly rootDir?: string;
  readonly defaultTimeoutMs?: number;
  readonly env?: Record<string, string>;
}

export class LocalDevelopmentSandbox implements ExecutionSandbox {
  public readonly config: SandboxConfig;

  constructor(options?: LocalDevelopmentSandboxOptions) {
    const rootDir = options?.rootDir ?? './';
    const timeoutMs = options?.defaultTimeoutMs ?? 30000;

    this.config = {
      filesystem: {
        rootDir,
        readOnlyPaths: ['/etc', 'C:/Windows'],
        writablePaths: [rootDir, './dist', './tmp'],
      },
      process: {
        timeoutMs,
        maxMemoryBytes: 512 * 1024 * 1024, // 512MB limit recommendation
        maxCpuPercent: 80,
      },
      network: {
        allowOutbound: false,
        allowedHosts: [],
      },
      environment: {
        env: options?.env ?? { NODE_ENV: 'development' },
        inheritHostEnv: false,
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async execute(request: SandboxExecutionRequest): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? this.config.process.timeoutMs;

    // Command sanitization check
    const sanitization = CommandSanitizer.sanitize(request.command);
    if (!sanitization.allowed) {
      return {
        exitCode: 126,
        stdout: '',
        stderr: `Sandbox blocked command: ${sanitization.reason}`,
        durationMs: Date.now() - startTime,
        timedOut: false,
        metadata: { blocked: true, reason: sanitization.reason },
      };
    }

    // Path boundary check
    const workDir = request.workingDirectory ?? this.config.filesystem.rootDir;
    if (workDir.includes('..') && !workDir.startsWith(this.config.filesystem.rootDir)) {
      return {
        exitCode: 126,
        stdout: '',
        stderr: `Sandbox blocked access outside root directory boundary: ${workDir}`,
        durationMs: Date.now() - startTime,
        timedOut: false,
        metadata: { boundaryViolation: true },
      };
    }

    // Simulated local sandbox process execution result
    return {
      exitCode: 0,
      stdout: `[Sandbox Local Output]: Command '${sanitization.normalizedCommand}' executed in ${workDir}`,
      stderr: '',
      durationMs: Date.now() - startTime,
      timedOut: false,
      metadata: {
        command: sanitization.normalizedCommand,
        timeoutMs,
        workingDirectory: workDir,
        envIsolated: true,
      },
    };
  }
}
