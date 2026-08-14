/**
 * Loop Fingerprinter & Oscillation Detection Unit Tests.
 *
 * Verifies cycle detection (A -> B -> A -> B), stagnation detection (A -> A -> A),
 * and repeat failure detection within sliding windows.
 */
import { describe, it, expect } from 'vitest';
import { LoopFingerprinter } from '../../../src/runtime/index.js';

describe('LoopFingerprinter Unit Tests', () => {
  it('detects immediate stagnation when an identical state repeats 3 consecutive turns', () => {
    const detector = new LoopFingerprinter({ maxWindowSize: 8 });

    const snapshot = {
      phase: 'REPAIR',
      activeError: 'TypeError: Cannot read property of undefined',
      modifiedFiles: ['src/auth/login.ts'],
      proposedToolNames: ['write_file'],
      hypothesis: 'Fix null check on user object',
    };

    expect(detector.recordAndInspect(snapshot, 1)).toBeNull();
    expect(detector.recordAndInspect(snapshot, 2)).toBeNull();

    const anomaly = detector.recordAndInspect(snapshot, 3);
    expect(anomaly).not.toBeNull();
    expect(anomaly!.anomalyType).toBe('STAGNATION');
    expect(anomaly!.detectedAtIteration).toBe(3);
  });

  it('detects 2-cycle alternating oscillation (A -> B -> A -> B)', () => {
    const detector = new LoopFingerprinter({ maxWindowSize: 8 });

    const stateA = {
      phase: 'REPAIR',
      activeError: 'SyntaxError: Unexpected token',
      modifiedFiles: ['src/parser.ts'],
      proposedToolNames: ['write_file'],
      hypothesis: 'Convert to ESM export',
    };

    const stateB = {
      phase: 'REPAIR',
      activeError: 'ReferenceError: module is not defined',
      modifiedFiles: ['src/parser.ts'],
      proposedToolNames: ['write_file'],
      hypothesis: 'Revert to CommonJS export',
    };

    expect(detector.recordAndInspect(stateA, 1)).toBeNull();
    expect(detector.recordAndInspect(stateB, 2)).toBeNull();
    expect(detector.recordAndInspect(stateA, 3)).toBeNull();

    const anomaly = detector.recordAndInspect(stateB, 4);
    expect(anomaly).not.toBeNull();
    expect(anomaly!.anomalyType).toBe('OSCILLATION');
    expect(anomaly!.iterationsInvolved).toEqual([1, 2, 3, 4]);
  });
});
