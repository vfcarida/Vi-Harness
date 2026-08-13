/**
 * State machine module barrel export.
 */

// Transition table
export {
  TRANSITION_TABLE,
  TRANSITION_INDEX,
  lookupTransition,
} from './transition-table.js';
export type { TransitionRule } from './transition-table.js';

// Transition validator
export {
  validateTransition,
  validateTransitionOrThrow,
} from './transition-validator.js';
export type { TransitionValidationResult } from './transition-validator.js';

// State machine
export { StateMachine } from './state-machine.js';
export type { StateMachineSnapshot } from './state-machine.js';

// Loop control
export {
  evaluateLoopControl,
  checkMaxIterations,
  checkMaxCost,
  checkMaxDuration,
  checkMaxRepairs,
  checkRepeatedHypotheses,
  checkOscillation,
  checkNoProgress,
  fingerprintsMatch,
  DEFAULT_LOOP_CONTROL_CONFIG,
} from './loop-control.js';
export type { LoopControlConfig } from './loop-control.js';
