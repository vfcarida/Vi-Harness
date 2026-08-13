/**
 * EvidenceAggregator Interface.
 *
 * Aggregates evidence records for a task, detects regressions against baselines,
 * and evaluates task completion against explicit acceptance policies.
 */
import type { TaskId } from '../types/identifiers.js';
import type { EvidenceStore } from './evidence-store.js';
import type { Evidence } from '../model/evidence.js';
import type { AcceptancePolicy, AcceptanceEvaluation } from '../model/acceptance-policy.js';

export interface EvidenceAggregator {
  /** Aggregate all evidence records stored for a given task. */
  aggregate(taskId: TaskId, store: EvidenceStore): Promise<ReadonlyArray<Evidence>>;

  /** Detect regressions between current verification evidence and baseline evidence. */
  detectRegressions(
    taskId: TaskId,
    currentEvidence: ReadonlyArray<Evidence>,
    baselineEvidence: ReadonlyArray<Evidence>,
  ): ReadonlyArray<Evidence>;

  /** Evaluate task evidence against an explicit AcceptancePolicy. */
  evaluateAcceptance(
    taskId: TaskId,
    evidenceList: ReadonlyArray<Evidence>,
    policy?: AcceptancePolicy,
  ): AcceptanceEvaluation;
}
