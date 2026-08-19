/**
 * Vi-Harness Core — Domain layer.
 *
 * This layer has ZERO dependencies on infrastructure, DI, or runtime.
 * All imports point inward. Infrastructure implements the interfaces defined here.
 */

// Types
export * from './types/index.js';

// Errors
export * from './errors/index.js';

// Model (domain value objects)
export * from './model/index.js';

// Interfaces (ports)
export * from './interfaces/index.js';

// State machine
export * from './state-machine/index.js';

// Goal lifecycle and token attribution
export * from './goal/index.js';
