/**
 * Logger interface.
 *
 * Cross-cutting concern that the domain layer may depend on.
 * Infrastructure provides the implementation (console, file, structured, etc.).
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  fatal(message: string, context?: Record<string, unknown>): void;

  /** Create a child logger with additional default context. */
  child(context: Record<string, unknown>): Logger;
}
