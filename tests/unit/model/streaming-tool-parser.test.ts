/**
 * Streaming Tool Parser Unit Tests.
 *
 * Verifies speculative tool parsing, partial state tracking, and completed tool extraction.
 */
import { describe, it, expect } from 'vitest';
import { StreamingToolParser } from '../../../src/infra/index.js';

describe('StreamingToolParser Unit Tests', () => {
  it('parses tool calls incrementally across streaming chunks', () => {
    const parser = new StreamingToolParser();

    // Chunk 1: Tool Name starts
    const states1 = parser.feed('Thinking... I need to edit file.\n{"name": "write_file", ');
    expect(states1.length).toBe(1);
    expect(states1[0]!.name).toBe('write_file');
    expect(states1[0]!.isComplete).toBe(false);

    // Chunk 2: Arguments start
    const states2 = parser.feed('"arguments": {"path": "src/app.ts", ');
    expect(states2.length).toBe(1);
    expect(states2[0]!.name).toBe('write_file');
    expect(states2[0]!.isComplete).toBe(false);

    // Chunk 3: Arguments complete
    const states3 = parser.feed('"content": "console.log(1);" } }');
    expect(states3.length).toBe(1);
    expect(states3[0]!.isComplete).toBe(true);
    expect(states3[0]!.parsedInput).toEqual({
      path: 'src/app.ts',
      content: 'console.log(1);',
    });

    const completed = parser.getCompletedToolCalls();
    expect(completed.length).toBe(1);
    expect(completed[0]!.name).toBe('write_file');
  });
});
