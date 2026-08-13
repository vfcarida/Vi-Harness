/**
 * Tests for the DefaultModule.
 *
 * Proves:
 *   - DefaultModule registers all cross-cutting infrastructure services
 *   - All registered services can be resolved through the container
 *   - Resolved services implement their respective interfaces
 *   - Singletons return consistent instances
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Container } from '../../../src/di/container.js';
import { DefaultModule } from '../../../src/di/default-module.js';
import { TOKENS } from '../../../src/di/tokens.js';
import type { Logger } from '../../../src/core/interfaces/logger.js';
import type { Clock } from '../../../src/core/interfaces/clock.js';
import type { Configuration } from '../../../src/core/interfaces/configuration.js';
import type { IdFactory } from '../../../src/core/types/identifiers.js';

describe('DefaultModule', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    new DefaultModule().register(container);
  });

  it('should register Logger', () => {
    expect(container.has(TOKENS.Logger)).toBe(true);

    const logger = container.resolve<Logger>(TOKENS.Logger);
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.child).toBe('function');
  });

  it('should register Clock', () => {
    expect(container.has(TOKENS.Clock)).toBe(true);

    const clock = container.resolve<Clock>(TOKENS.Clock);
    expect(clock).toBeDefined();
    expect(typeof clock.now).toBe('function');
    expect(typeof clock.timestamp).toBe('function');
    expect(clock.now()).toBeInstanceOf(Date);
  });

  it('should register Configuration', () => {
    expect(container.has(TOKENS.Configuration)).toBe(true);

    const config = container.resolve<Configuration>(TOKENS.Configuration);
    expect(config).toBeDefined();
    expect(typeof config.get).toBe('function');
    expect(typeof config.getRequired).toBe('function');
    expect(typeof config.has).toBe('function');
    expect(typeof config.set).toBe('function');
  });

  it('should register IdFactory', () => {
    expect(container.has(TOKENS.IdFactory)).toBe(true);

    const factory = container.resolve<IdFactory>(TOKENS.IdFactory);
    expect(factory).toBeDefined();
    expect(typeof factory.create).toBe('function');

    const id = factory.create();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should return singletons for all services', () => {
    const logger1 = container.resolve<Logger>(TOKENS.Logger);
    const logger2 = container.resolve<Logger>(TOKENS.Logger);
    expect(logger1).toBe(logger2);

    const clock1 = container.resolve<Clock>(TOKENS.Clock);
    const clock2 = container.resolve<Clock>(TOKENS.Clock);
    expect(clock1).toBe(clock2);

    const config1 = container.resolve<Configuration>(TOKENS.Configuration);
    const config2 = container.resolve<Configuration>(TOKENS.Configuration);
    expect(config1).toBe(config2);

    const idFactory1 = container.resolve<IdFactory>(TOKENS.IdFactory);
    const idFactory2 = container.resolve<IdFactory>(TOKENS.IdFactory);
    expect(idFactory1).toBe(idFactory2);
  });

  it('Logger should produce structured output', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = container.resolve<Logger>(TOKENS.Logger);

    logger.info('boot complete', { module: 'default-module' });

    expect(logSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(output.message).toBe('boot complete');
    expect(output.module).toBe('default-module');

    logSpy.mockRestore();
  });

  it('IdFactory should produce unique IDs', () => {
    const factory = container.resolve<IdFactory>(TOKENS.IdFactory);
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      ids.add(factory.create());
    }

    expect(ids.size).toBe(100);
  });
});
