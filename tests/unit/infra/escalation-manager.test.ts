import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefaultEscalationManager,
  DefaultEvidenceStore,
  UuidV7IdFactory,
  TestClock,
} from '../../../src/infra/index.js';
import {
  EscalationReason,
  EscalationStatus,
  HumanDecision,
  ActionType,
  ActionRiskCategory,
} from '../../../src/core/index.js';
import type { TaskId, ActionProposal, ApprovalPolicy } from '../../../src/core/index.js';

describe('Human Escalation Subsystem', () => {
  let manager: DefaultEscalationManager;
  let evidenceStore: DefaultEvidenceStore;
  let idFactory: UuidV7IdFactory;
  let clock: TestClock;
  let taskId: TaskId;

  beforeEach(() => {
    idFactory = new UuidV7IdFactory();
    clock = new TestClock(new Date('2024-01-01T00:00:00Z'));
    evidenceStore = new DefaultEvidenceStore();

    manager = new DefaultEscalationManager({
      idFactory,
      clock,
      evidenceStore,
    });

    taskId = idFactory.create<'Task'>();
  });

  it('should evaluate when approval is required per ApprovalPolicy', () => {
    const policy: ApprovalPolicy = {
      requiredReasons: [EscalationReason.HIGH_RISK, EscalationReason.IRREVERSIBLE_ACTION],
      autoEscalateOnRisk: [ActionRiskCategory.DESTRUCTIVE, ActionRiskCategory.PRODUCTION_IMPACTING],
    };

    expect(manager.requiresApproval(EscalationReason.HIGH_RISK, policy)).toBe(true);
    expect(manager.requiresApproval(ActionRiskCategory.DESTRUCTIVE, policy)).toBe(true);
    expect(manager.requiresApproval(EscalationReason.AMBIGUOUS_REQUIREMENTS, policy)).toBe(false);
  });

  it('should record APPROVE decision and persist durable evidence', async () => {
    const req = await manager.requestEscalation({
      taskId,
      reason: EscalationReason.HIGH_RISK,
      summary: 'Approval required for production db migration',
      risk: ActionRiskCategory.PRODUCTION_IMPACTING,
    });

    expect(req.status).toBe(EscalationStatus.PENDING);

    const resolution = await manager.resolveEscalation(req.id, {
      taskId,
      decision: HumanDecision.APPROVE,
      decidedBy: 'lead_dev',
      rationale: 'Approved after manual review',
    });

    expect(resolution.request.status).toBe(EscalationStatus.RESOLVED);
    expect(resolution.record.decision).toBe(HumanDecision.APPROVE);
    expect(resolution.record.decidedBy).toBe('lead_dev');

    // Durable Evidence check
    const storedEvidence = await evidenceStore.listForTask(taskId);
    expect(storedEvidence).toHaveLength(1);
    expect(storedEvidence[0]!.pass).toBe(true);
    expect(storedEvidence[0]!.summary).toContain('APPROVE');
  });

  it('should handle REJECT decision', async () => {
    const req = await manager.requestEscalation({
      taskId,
      reason: EscalationReason.IRREVERSIBLE_ACTION,
      summary: 'Delete production database',
    });

    const resolution = await manager.resolveEscalation(req.id, {
      taskId,
      decision: HumanDecision.REJECT,
      decidedBy: 'sec_admin',
      rationale: 'Destructive operation denied',
    });

    expect(resolution.request.status).toBe(EscalationStatus.RESOLVED);
    expect(resolution.record.decision).toBe(HumanDecision.REJECT);

    const storedEvidence = await evidenceStore.listForTask(taskId);
    expect(storedEvidence[0]!.pass).toBe(false);
  });

  it('should handle MODIFY decision with modified action proposal', async () => {
    const proposedAction: ActionProposal = {
      actionId: idFactory.create<'Action'>(),
      taskId,
      iteration: 1,
      type: ActionType.TOOL_CALL,
      toolCall: {
        toolName: 'run_command',
        arguments: { command: 'rm -rf /tmp/data' },
      },
    };

    const modifiedAction: ActionProposal = {
      ...proposedAction,
      toolCall: {
        toolName: 'run_command',
        arguments: { command: 'rm -rf /tmp/data/subfolder' },
      },
    };

    const req = await manager.requestEscalation({
      taskId,
      reason: EscalationReason.POLICY_REQUIREMENT,
      summary: 'Scoping adjustment needed',
      proposedAction,
    });

    const resolution = await manager.resolveEscalation(req.id, {
      taskId,
      decision: HumanDecision.MODIFY,
      decidedBy: 'tech_lead',
      modifiedAction,
      rationale: 'Restricted deletion scope',
    });

    expect(resolution.record.decision).toBe(HumanDecision.MODIFY);
    expect(resolution.record.modifiedAction?.toolCall?.arguments).toEqual({
      command: 'rm -rf /tmp/data/subfolder',
    });
  });

  it('should handle CANCEL decision', async () => {
    const req = await manager.requestEscalation({
      taskId,
      reason: EscalationReason.AMBIGUOUS_REQUIREMENTS,
      summary: 'Ambiguous spec',
    });

    const resolution = await manager.resolveEscalation(req.id, {
      taskId,
      decision: HumanDecision.CANCEL,
      decidedBy: 'product_owner',
      rationale: 'Cancelling task due to changed requirements',
    });

    expect(resolution.record.decision).toBe(HumanDecision.CANCEL);
  });

  it('should mark request EXPIRED after TTL and reject resolution attempts', async () => {
    const req = await manager.requestEscalation({
      taskId,
      reason: EscalationReason.HIGH_RISK,
      summary: 'Time-sensitive deployment approval',
      ttlMs: 100, // 100ms TTL
    });

    // Advance clock past TTL
    clock.advance(150);

    const isExpired = await manager.checkExpiration(req.id);
    expect(isExpired).toBe(true);

    await expect(
      manager.resolveEscalation(req.id, {
        taskId,
        decision: HumanDecision.APPROVE,
        decidedBy: 'operator',
      }),
    ).rejects.toThrow('Cannot resolve expired escalation request');
  });

  it('should maintain a complete durable audit trail per task', async () => {
    const req1 = await manager.requestEscalation({
      taskId,
      reason: EscalationReason.UNCERTAINTY,
      summary: 'Escalation 1',
    });
    const req2 = await manager.requestEscalation({
      taskId,
      reason: EscalationReason.HIGH_RISK,
      summary: 'Escalation 2',
    });

    await manager.resolveEscalation(req1.id, {
      taskId,
      decision: HumanDecision.REQUEST_MORE_EVIDENCE,
      decidedBy: 'reviewer_1',
    });
    await manager.resolveEscalation(req2.id, {
      taskId,
      decision: HumanDecision.APPROVE,
      decidedBy: 'reviewer_2',
    });

    const auditTrail = await manager.getAuditTrail(taskId);
    expect(auditTrail).toHaveLength(2);
    expect(auditTrail[0]!.decision).toBe(HumanDecision.REQUEST_MORE_EVIDENCE);
    expect(auditTrail[1]!.decision).toBe(HumanDecision.APPROVE);
  });
});
