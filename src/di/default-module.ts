/**
 * Default infrastructure module.
 *
 * Registers the bootstrap infrastructure implementations:
 *   - ConsoleLogger (Logger)
 *   - SystemClock (Clock)
 *   - EnvConfiguration (Configuration)
 *   - UuidV7IdFactory (IdFactory)
 *
 * This module is the "wiring" layer — it connects core interfaces
 * to their concrete infrastructure implementations.
 */
import type { ContainerModule } from './module.js';
import type { Container } from './container.js';
import { TOKENS } from './tokens.js';
import { ConsoleLogger } from '../infra/logging/console-logger.js';
import { SystemClock } from '../infra/time/system-clock.js';
import { EnvConfiguration } from '../infra/config/env-configuration.js';
import { UuidV7IdFactory } from '../infra/id/uuid-id-factory.js';

export class DefaultModule implements ContainerModule {
  register(container: Container): void {
    container.registerSingleton(TOKENS.Logger, () => new ConsoleLogger());
    container.registerSingleton(TOKENS.Clock, () => new SystemClock());
    container.registerSingleton(
      TOKENS.Configuration,
      () => new EnvConfiguration(),
    );
    container.registerSingleton(TOKENS.IdFactory, () => new UuidV7IdFactory());
  }
}
