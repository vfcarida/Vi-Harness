/**
 * SubagentManager Interface.
 *
 * Orchestrates subagent execution (sequential, parallel, dependent DAG).
 * "Subagents return artifacts and evidence, not entire transcripts."
 */
import type { SubagentSpec, SubagentResult } from '../model/subagent-types.js';

export interface SubagentManager {
  /** Spawn and execute a single subagent. */
  spawn(spec: SubagentSpec, signal?: AbortSignal): Promise<SubagentResult>;

  /** Execute a list of subagent specs sequentially. */
  executeSequential(
    specs: ReadonlyArray<SubagentSpec>,
    signal?: AbortSignal,
  ): Promise<ReadonlyArray<SubagentResult>>;

  /** Execute a list of subagent specs concurrently in parallel. */
  executeParallel(
    specs: ReadonlyArray<SubagentSpec>,
    signal?: AbortSignal,
  ): Promise<ReadonlyArray<SubagentResult>>;

  /** Execute a DAG of subagent specs respecting declared dependencies. */
  executeDependentGraph(
    specs: ReadonlyArray<SubagentSpec>,
    signal?: AbortSignal,
  ): Promise<ReadonlyArray<SubagentResult>>;

  /** Cancel all running subagents. */
  cancelAll(reason?: string): Promise<void>;
}
