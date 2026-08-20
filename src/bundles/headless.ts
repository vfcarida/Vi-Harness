// Pattern: Built-in Headless Bundle (ref: DeepSeek Harness)
/**
 * Headless Bundle.
 *
 * Optimized for automated scripts, CI, and batch tasks without UI/TUI rendering overhead.
 */
import type { Bundle } from '../core/plugin/composition.js';

export const HEADLESS_BUNDLE: Bundle = {
  name: 'headless',
  description: 'Headless one-shot batch execution with quiet logging and zero UI overhead',
  plugins: [
    {
      id: 'logging-provider',
      plugin: '@vi-harness/logging-quiet',
      config: { level: 'error' },
    },
    {
      id: 'telemetry-sink',
      plugin: '@vi-harness/telemetry-file-sink',
      config: { autoFlush: true },
    },
  ],
};
