/**
 * Sandbox Execution Layer Domain Types.
 *
 * Defines isolation boundaries (filesystem, process, network, environment)
 * and execution request/result structures.
 */

export interface FilesystemBoundary {
  readonly rootDir: string;
  readonly readOnlyPaths: ReadonlyArray<string>;
  readonly writablePaths: ReadonlyArray<string>;
}

export interface ProcessBoundary {
  readonly timeoutMs: number;
  readonly maxMemoryBytes?: number;
  readonly maxCpuPercent?: number;
}

export interface NetworkBoundary {
  readonly allowOutbound: boolean;
  readonly allowedHosts?: ReadonlyArray<string>;
}

export interface EnvironmentBoundary {
  readonly env: Readonly<Record<string, string>>;
  readonly inheritHostEnv: boolean;
}

export interface SandboxConfig {
  readonly filesystem: FilesystemBoundary;
  readonly process: ProcessBoundary;
  readonly network: NetworkBoundary;
  readonly environment: EnvironmentBoundary;
}

export interface SandboxExecutionRequest {
  readonly command: string;
  readonly args?: ReadonlyArray<string>;
  readonly input?: string;
  readonly timeoutMs?: number;
  readonly workingDirectory?: string;
}

export interface SandboxExecutionResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
