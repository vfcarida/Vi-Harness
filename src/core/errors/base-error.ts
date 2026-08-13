/**
 * Base error class for all Vi-Harness domain errors.
 *
 * Every error carries:
 *  - code:      specific failure mode (ErrorCode enum)
 *  - category:  broad domain area (ErrorCategory enum)
 *  - context:   structured metadata for diagnostics
 *  - timestamp: when the error occurred
 *  - cause:     optional chained Error for root-cause analysis
 *
 * Supports JSON serialization for structured logging and observability.
 */
import { ErrorCode, ErrorCategory } from './error-codes.js';

export interface HarnessErrorContext {
  [key: string]: unknown;
}

export interface HarnessErrorParams {
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  context?: HarnessErrorContext;
  cause?: Error;
}

export class HarnessError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly context: HarnessErrorContext;
  public readonly timestamp: Date;
  public override readonly cause?: Error;

  constructor(params: HarnessErrorParams) {
    super(params.message, { cause: params.cause });
    this.name = 'HarnessError';
    this.code = params.code;
    this.category = params.category;
    this.context = params.context ?? {};
    this.timestamp = new Date();
    this.cause = params.cause;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Structured JSON representation for logging and transport.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      cause: this.cause?.message,
      stack: this.stack,
    };
  }
}
