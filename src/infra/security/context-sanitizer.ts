/**
 * Context Sanitizer — Prompt Injection & Delimiter Neutralization Engine.
 *
 * Sanitizes untrusted repository file content, tool outputs, and memory records
 * before compilation into LLM system prompts to prevent indirect prompt injection attacks.
 */

const PROMPT_INJECTION_PATTERNS = [
  /\[SYSTEM\s+PROMPT\s+OVERRIDE\]/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<\|endoftext\|>/gi,
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /disregard\s+(all\s+)?prior\s+directives/gi,
  /you\s+are\s+now\s+in\s+dan\s+mode/gi,
];

export class ContextSanitizer {
  /**
   * Neutralize prompt injection attempts and system prompt override delimiters.
   */
  static sanitize(rawContent: string): string {
    if (!rawContent) return '';

    let sanitized = rawContent;

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[SANITIZED_PROMPT_INJECTION]');
    }

    return sanitized;
  }
}
