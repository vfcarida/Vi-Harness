import { describe, it, expect } from 'vitest';
import { DefaultRepeatToolGuard } from '../../../src/core/guards/repeat-tool-guard.js';

describe('Repeat-Tool Advisory Reminder Guard — P018', () => {
  it('1. Detects exact repetition after thresholdCount (default 3) calls', () => {
    const guard = new DefaultRepeatToolGuard({ thresholdCount: 3 });

    // Call 1
    guard.recordCall('c1', 'read_file', { path: 'src/main.ts' }, 'const x = 1;');
    expect(guard.isRepeat('read_file', { path: 'src/main.ts' })).toBeNull();

    // Call 2
    guard.recordCall('c2', 'read_file', { path: 'src/main.ts' }, 'const x = 1;');
    // Upcoming call 3: should trigger repeat
    const repeatInfo = guard.isRepeat('read_file', { path: 'src/main.ts' });
    expect(repeatInfo).not.toBeNull();
    expect(repeatInfo?.tool).toBe('read_file');
    expect(repeatInfo?.count).toBe(3);
    expect(repeatInfo?.similarity).toBe(1.0);
    expect(repeatInfo?.previousResults).toContain('const x = 1;');

    const reminder = guard.generateReminder(repeatInfo!);
    expect(reminder).toContain("Advisory Notice: You have invoked tool 'read_file' 3 times");
    expect(reminder).toContain('100% similarity');
    expect(reminder).toContain('const x = 1;');
  });

  it('2. Detects fuzzy argument similarity (> 90%) with key reordering or whitespace', () => {
    const guard = new DefaultRepeatToolGuard({ thresholdCount: 2, similarityThreshold: 0.85 });

    // Call 1
    guard.recordCall('c1', 'search_code', { query: 'authenticateUser', limit: 10 });

    // Call 2 with reordered keys and slight whitespace
    const repeatInfo = guard.isRepeat('search_code', { limit: 10, query: 'authenticateUser' });
    expect(repeatInfo).not.toBeNull();
    expect(repeatInfo?.count).toBe(2);
    expect(repeatInfo?.similarity).toBeGreaterThanOrEqual(0.85);
  });

  it('3. Dissimilar arguments do not trigger repeat warnings', () => {
    const guard = new DefaultRepeatToolGuard({ thresholdCount: 2 });

    guard.recordCall('c1', 'read_file', { path: 'src/a.ts' });
    const repeatInfo = guard.isRepeat('read_file', { path: 'tests/very/different/file.ts' });

    expect(repeatInfo).toBeNull();
  });

  it('4. Different tools with same arguments do not trigger repetition', () => {
    const guard = new DefaultRepeatToolGuard({ thresholdCount: 2 });

    guard.recordCall('c1', 'read_file', { path: 'main.ts' });
    const repeatInfo = guard.isRepeat('delete_file', { path: 'main.ts' });

    expect(repeatInfo).toBeNull();
  });

  it('5. Respects sliding window size: old calls drop off', () => {
    const guard = new DefaultRepeatToolGuard({ thresholdCount: 3, windowSize: 3 });

    // 1st target call
    guard.recordCall('c1', 'read_file', { path: 'main.ts' });

    // Intervening calls pushing c1 out of the window
    guard.recordCall('c2', 'grep', { q: '1' });
    guard.recordCall('c3', 'grep', { q: '2' });
    guard.recordCall('c4', 'grep', { q: '3' });

    // Now c1 has fallen out of windowSize 3
    guard.recordCall('c5', 'read_file', { path: 'main.ts' });
    const repeatInfo = guard.isRepeat('read_file', { path: 'main.ts' });

    // Only 1 prior call in window + 1 upcoming = 2 < thresholdCount 3
    expect(repeatInfo).toBeNull();
  });

  it('6. Disabled guard does not record or trigger reminders', () => {
    const guard = new DefaultRepeatToolGuard({ enabled: false, thresholdCount: 1 });

    guard.recordCall('c1', 'read_file', { path: 'main.ts' });
    const repeatInfo = guard.isRepeat('read_file', { path: 'main.ts' });

    expect(repeatInfo).toBeNull();
  });

  it('7. clear() resets history', () => {
    const guard = new DefaultRepeatToolGuard({ thresholdCount: 2 });

    guard.recordCall('c1', 'read_file', { path: 'main.ts' });
    guard.clear();

    const repeatInfo = guard.isRepeat('read_file', { path: 'main.ts' });
    expect(repeatInfo).toBeNull();
  });

  it('8. Handles empty, null, or string arguments safely', () => {
    const guard = new DefaultRepeatToolGuard({ thresholdCount: 2 });

    guard.recordCall('c1', 'no_arg_tool', null);
    const repeatInfo = guard.isRepeat('no_arg_tool', null);

    expect(repeatInfo).not.toBeNull();
    expect(repeatInfo?.count).toBe(2);
  });
});
