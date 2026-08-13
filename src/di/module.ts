/**
 * ContainerModule interface.
 *
 * Modules group related service registrations.
 * Each architectural layer provides a module that registers
 * its implementations against the core interfaces.
 */
import type { Container } from './container.js';

export interface ContainerModule {
  /** Register services into the container. */
  register(container: Container): void;
}
