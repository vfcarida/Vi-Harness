/**
 * Tests for ConsoleLogger.
 *
 * Proves:
 *   - Logger can be instantiated
 *   - All log levels produce output
 *   - Output is structured JSON
 *   - Child loggers inherit context
 *   - Level filtering works
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsoleLogger } from '../../../src/infra/logging/console-logger.js';
import { LogLevel } from '../../../src/core/interfaces/logger.js';
import type { Logger } from '../../../src/core/interfaces/logger.js';

describe('ConsoleLogger', () => {
  let logger: Logger;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new ConsoleLogger();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should be instantiable', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.fatal).toBe('function');
    expect(typeof logger.child).toBe('function');
  });

  it('should log structured JSON to stdout for info level', () => {
    logger.info('test message', { key: 'value' });

    expect(logSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(output.level).toBe('INFO');
    expect(output.message).toBe('test message');
    expect(output.key).toBe('value');
    expect(output.timestamp).toBeDefined();
  });

  it('should log to stderr for error and fatal levels', () => {
    logger.error('error message');
    logger.fatal('fatal message');

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should create a child logger with inherited context', () => {
    const child = logger.child({ requestId: 'abc-123' });
    child.info('child log');

    const output = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(output.requestId).toBe('abc-123');
    expect(output.message).toBe('child log');
  });

  it('should merge child context with per-call context', () => {
    const child = logger.child({ service: 'router' });
    child.info('routed', { model: 'gpt-4' });

    const output = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(output.service).toBe('router');
    expect(output.model).toBe('gpt-4');
  });

  it('should filter logs below minimum level', () => {
    const warnLogger = new ConsoleLogger({}, LogLevel.WARN);
    warnLogger.debug('should not appear');
    warnLogger.info('should not appear');
    warnLogger.warn('should appear');

    expect(logSpy).toHaveBeenCalledOnce();
  });
});
