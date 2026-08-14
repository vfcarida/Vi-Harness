/**
 * Harness Diagnostic Engine (Meta-Harness Outer-Loop Adaptation).
 *
 * Implements causal diagnosis and automated remediation recommendations inspired by Meta-Harness
 * (Stanford IRIS Lab, arXiv:2603.28052).
 * Formulates outer-loop configuration updates to systematically improve token efficiency,
 * eliminate tool failure traps, and maximize verification pass rates.
 */
import { TraceDistiller, type CausalTraceAnalysis } from './trace-distiller.js';
import type { IterationTraceRecord, ExecutionTraceSummary } from '../../core/model/trace-types.js';

export interface HarnessRecommendation {
  readonly code: 'INCREASE_PREFIX_CACHING' | 'REFINE_TOOL_SCHEMA' | 'ADJUST_POLICY_PERMISSIONS' | 'ACTIVATE_4STAGE_COMPACTION' | 'SWITCH_MODEL_ROUTING' | 'OPTIMIZE_VERIFICATION_SELECTION';
  readonly priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly description: string;
  readonly actionablePatchSuggestion: string;
}

export interface HarnessDiagnosticReport {
  readonly executionId: string;
  readonly overallHealth: 'OPTIMAL' | 'DEGRADED' | 'BOTTLENECKED' | 'FAILED';
  readonly analysis: CausalTraceAnalysis;
  readonly recommendations: ReadonlyArray<HarnessRecommendation>;
  readonly suggestedConfigOverrides: Record<string, unknown>;
}

export class HarnessDiagnosticEngine {
  /**
   * Run full causal diagnostics on execution traces and yield outer-loop adaptation recommendations.
   */
  static diagnose(
    records: ReadonlyArray<IterationTraceRecord>,
    summary?: ExecutionTraceSummary,
  ): HarnessDiagnosticReport {
    const analysis = TraceDistiller.distill(records, summary);
    const recommendations: HarnessRecommendation[] = [];
    const suggestedConfigOverrides: Record<string, unknown> = {};

    // 1. Check Cache Hit Ratio
    if (analysis.cacheHitRatio < 0.3 && analysis.promptTokens > 5000) {
      recommendations.push({
        code: 'INCREASE_PREFIX_CACHING',
        priority: 'HIGH',
        description: `Cache hit ratio is low (${(analysis.cacheHitRatio * 100).toFixed(1)}%). Invariant static system prompts and repo-maps should be segregated with ephemeral cache headers.`,
        actionablePatchSuggestion: 'Enable PrefixCachingCompiler in context compilation pipeline.',
      });
      suggestedConfigOverrides['enablePrefixCaching'] = true;
      suggestedConfigOverrides['staticSegmentThresholdTokens'] = 1024;
    }

    // 2. Check Tool Failures
    if (analysis.highestFailureToolName) {
      const toolMetric = analysis.toolMetrics.find((m) => m.toolName === analysis.highestFailureToolName);
      if (toolMetric && toolMetric.failureRate >= 0.4 && toolMetric.totalExecutions >= 2) {
        recommendations.push({
          code: 'REFINE_TOOL_SCHEMA',
          priority: 'CRITICAL',
          description: `Tool [${toolMetric.toolName}] has a ${(toolMetric.failureRate * 100).toFixed(1)}% failure rate across ${toolMetric.totalExecutions} executions.`,
          actionablePatchSuggestion: `Add input schema examples and validation error feedback for tool [${toolMetric.toolName}].`,
        });
        suggestedConfigOverrides[`toolFeedbackEnhancement_${toolMetric.toolName}`] = true;
      }
    }

    // 3. Check Policy Denials
    if (analysis.policyDenialCount >= 2) {
      recommendations.push({
        code: 'ADJUST_POLICY_PERMISSIONS',
        priority: 'HIGH',
        description: `Encountered ${analysis.policyDenialCount} security policy denials. Agent repeatedly requested restricted resources.`,
        actionablePatchSuggestion: 'Inject explicit workspace boundary guidelines into L3 system prompt.',
      });
      suggestedConfigOverrides['injectSecurityBoundariesInPrompt'] = true;
    }

    // 4. Check Context Token Bloat
    if (analysis.totalTokens > 80000 || analysis.totalIterations >= 15) {
      recommendations.push({
        code: 'ACTIVATE_4STAGE_COMPACTION',
        priority: 'HIGH',
        description: `High token accumulation detected (${analysis.totalTokens} tokens across ${analysis.totalIterations} iterations).`,
        actionablePatchSuggestion: 'Engage progressive 4-Stage Context Compaction (Snip, Micro-compact, Collapse, Auto-compact).',
      });
      suggestedConfigOverrides['contextCompactionStrategy'] = 'FOUR_STAGE_PROGRESSIVE';
      suggestedConfigOverrides['aggressiveCompactionThreshold'] = 0.75;
    }

    // Determine overall health
    let overallHealth: 'OPTIMAL' | 'DEGRADED' | 'BOTTLENECKED' | 'FAILED' = 'OPTIMAL';
    if (summary && !summary.success) {
      overallHealth = 'FAILED';
    } else if (recommendations.some((r) => r.priority === 'CRITICAL')) {
      overallHealth = 'DEGRADED';
    } else if (recommendations.length > 0) {
      overallHealth = 'BOTTLENECKED';
    }

    return {
      executionId: analysis.executionId,
      overallHealth,
      analysis,
      recommendations,
      suggestedConfigOverrides,
    };
  }
}
