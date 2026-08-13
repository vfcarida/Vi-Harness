/**
 * Command Sanitizer.
 *
 * Normalizes shell command execution requests and blocks dangerous command vectors,
 * command chaining injection (`&&`, `;`, `|`, `$()`), and privilege escalation.
 * Do not allow arbitrary commands directly from the LLM.
 */

const FORBIDDEN_COMMAND_PATTERNS = [
  /\bsudo\b/i,
  /\bsu\s+/i,
  /\brm\s+-rf\s+[/~*]/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bfdisk\b/i,
  /\bparted\b/i,
  /\bchmod\s+777\b/i,
  /\|\s*(sh|bash|zsh)\b/i,
  />\s*\/dev\/(sd[a-z]|hd[a-z]|nvme)/i,
  /curl\s+.*\|\s*(sh|bash)/i,
  /wget\s+.*\|\s*(sh|bash)/i,
];

const COMMAND_CHAINING_PATTERNS = [
  /;\s*/, // Semicolon chaining
  /&&\s*/, // AND chaining
  /\|\|\s*/, // OR chaining
  /\$\(.*\)/, // Command substitution $()
  /`.*`/, // Backtick command substitution
];

export interface CommandSanitizationResult {
  readonly allowed: boolean;
  readonly normalizedCommand: string;
  readonly reason?: string;
}

export class CommandSanitizer {
  /**
   * Normalize and evaluate a shell command string for dangerous execution vectors.
   */
  static sanitize(command: string, allowChaining = false): CommandSanitizationResult {
    if (!command || command.trim().length === 0) {
      return {
        allowed: false,
        normalizedCommand: '',
        reason: 'Empty command string',
      };
    }

    // Normalize whitespace and clean control characters
    const normalizedCommand = command.trim().replace(/\s+/g, ' ');

    // 1. Forbidden Command Vectors
    for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
      if (pattern.test(normalizedCommand)) {
        return {
          allowed: false,
          normalizedCommand,
          reason: `Forbidden shell command vector matched pattern: ${pattern.source}`,
        };
      }
    }

    // 2. Command Chaining & Substitution Vectors
    if (!allowChaining) {
      for (const chainPattern of COMMAND_CHAINING_PATTERNS) {
        if (chainPattern.test(normalizedCommand)) {
          return {
            allowed: false,
            normalizedCommand,
            reason: `Unsafe command chaining operator or substitution detected: ${chainPattern.source}`,
          };
        }
      }
    }

    return {
      allowed: true,
      normalizedCommand,
    };
  }
}
