import { describe, it, expect } from 'vitest';
import { runBasicAgent } from '../../examples/basic-agent/index.js';

describe('Quickstart Example Integration', () => {
  it('executes the basic agent quickstart workflow without throwing', async () => {
    await expect(runBasicAgent()).resolves.not.toThrow();
  });
});
