import { describe, it, expect, vi } from 'vitest';
import {
  DefaultPluginContext,
  MissingServiceError,
  type Plugin,
  type ShellService,
  type FileSystemService,
} from '../../../src/core/plugin/index.js';

describe('Service Registry & Capability Seams — P017', () => {
  it('1. Provides and retrieves services with type safety', () => {
    const ctx = new DefaultPluginContext();
    const mockShell: ShellService = {
      execute: async () => ({ stdout: 'ok', stderr: '', exitCode: 0 }),
    };

    ctx.provide('shell', mockShell);
    const retrieved = ctx.get('shell');
    expect(retrieved).toBe(mockShell);
    expect(ctx.optional('shell')).toBe(mockShell);
  });

  it('2. Throws loud MissingServiceError with descriptive details when requesting unprovided service', () => {
    const ctx = new DefaultPluginContext();
    expect(() => ctx.get('fs')).toThrow(MissingServiceError);
    expect(() => ctx.get('fs')).toThrow(/Service \[fs\] is not registered/);
  });

  it('3. Injected dependencies: throws loud error when plugin is missing required injected services', async () => {
    const ctx = new DefaultPluginContext();

    const dependentPlugin: Plugin = {
      name: 'tool-bash',
      inject: ['shell'],
      apply: (c) => {
        c.get('shell');
      },
    };

    await expect(ctx.loadPlugin(dependentPlugin)).rejects.toThrow(MissingServiceError);
    await expect(ctx.loadPlugin(dependentPlugin)).rejects.toThrow(
      /Plugin \[tool-bash\] requires missing service \[shell\]/,
    );
  });

  it('4. Injected dependencies: activates successfully when all required services are available', async () => {
    const ctx = new DefaultPluginContext();

    ctx.provide('shell', {
      execute: async () => ({ stdout: 'ok', stderr: '', exitCode: 0 }),
    });

    let activated = false;
    const dependentPlugin: Plugin = {
      name: 'tool-bash',
      inject: ['shell'],
      apply: (c) => {
        const shell = c.get('shell');
        expect(shell).toBeDefined();
        activated = true;
      },
    };

    await ctx.loadPlugin(dependentPlugin);
    expect(activated).toBe(true);
  });

  it('5. Dependency waiting: whenAvailable triggers callback once service is provided', () => {
    const ctx = new DefaultPluginContext();
    let capturedFs: FileSystemService | undefined;

    ctx.whenAvailable('fs', (fsService) => {
      capturedFs = fsService;
    });

    expect(capturedFs).toBeUndefined();

    const mockFs: FileSystemService = {
      readFile: async () => 'content',
      writeFile: async () => {},
      exists: async () => true,
      listDirectory: async () => [],
    };

    ctx.provide('fs', mockFs);
    expect(capturedFs).toBe(mockFs);
  });

  it('6. Dependency waiting: whenAvailable runs immediately if service is already present', () => {
    const ctx = new DefaultPluginContext();
    const mockFs: FileSystemService = {
      readFile: async () => 'content',
      writeFile: async () => {},
      exists: async () => true,
      listDirectory: async () => [],
    };

    ctx.provide('fs', mockFs);

    let executed = false;
    ctx.whenAvailable('fs', (fsService) => {
      expect(fsService).toBe(mockFs);
      executed = true;
    });

    expect(executed).toBe(true);
  });

  it('7. Service disposer removes service from registry and emits service/removed event', () => {
    const ctx = new DefaultPluginContext();
    const events: string[] = [];

    ctx.on('service/provided', (e) => events.push(`provided:${e.serviceKey}`));
    ctx.on('service/removed', (e) => events.push(`removed:${e.serviceKey}`));

    const disposer = ctx.provide('shell', {
      execute: async () => ({ stdout: 'ok', stderr: '', exitCode: 0 }),
    });

    expect(ctx.optional('shell')).toBeDefined();
    expect(events).toContain('provided:shell');

    disposer();
    expect(ctx.optional('shell')).toBeUndefined();
    expect(events).toContain('removed:shell');
  });

  it('8. 3-Role Capability Seam Pattern (Definition, Provider, Consumer)', async () => {
    const ctx = new DefaultPluginContext();

    // Role 2: Provider Plugin (Local Shell)
    const localShellProvider: Plugin = {
      name: 'shell-local',
      apply: (c) => {
        c.provide('shell', {
          execute: async (cmd) => ({ stdout: `local-exec: ${cmd}`, stderr: '', exitCode: 0 }),
        });
      },
    };

    // Role 3: Consumer Plugin (Bash Tool)
    const bashToolConsumer: Plugin = {
      name: 'tool-bash',
      inject: ['shell'],
      apply: (c) => {
        const shell = c.get('shell');
        c.provide('tools', {
          getTool: () => ({
            name: 'bash',
            run: async (cmd: string) => shell.execute(cmd),
          }),
        } as any);
      },
    };

    await ctx.loadPlugin(localShellProvider);
    await ctx.loadPlugin(bashToolConsumer);

    const tools = ctx.get('tools') as any;
    const bashTool = tools.getTool('bash');
    const result = await bashTool.run('git status');
    expect(result.stdout).toBe('local-exec: git status');
  });

  it('9. Custom service keys support declaration merging and registration', () => {
    const ctx = new DefaultPluginContext();
    const customEngine = { computeRiskScore: () => 0.05 };

    ctx.provide('customRiskEngine' as any, customEngine);
    expect(ctx.get('customRiskEngine' as any)).toBe(customEngine);
  });

  it('10. Multiple callbacks registered on whenAvailable all trigger when service arrives', () => {
    const ctx = new DefaultPluginContext();
    const results: string[] = [];

    ctx.whenAvailable('goals', () => {
      results.push('cb1');
    });
    ctx.whenAvailable('goals', () => {
      results.push('cb2');
    });

    expect(results).toEqual([]);
    ctx.provide('goals', { createGoal: async () => ({}) } as any);
    expect(results).toEqual(['cb1', 'cb2']);
  });

  it('11. Disposing whenAvailable waiter prevents callback execution', () => {
    const ctx = new DefaultPluginContext();
    let called = false;

    const cancel = ctx.whenAvailable('goals', () => {
      called = true;
    });

    cancel();
    ctx.provide('goals', { createGoal: async () => ({}) } as any);
    expect(called).toBe(false);
  });

  it('12. Re-providing a service replaces previous instance', () => {
    const ctx = new DefaultPluginContext();

    ctx.provide('shell', { execute: async () => ({ stdout: 'first', stderr: '', exitCode: 0 }) });
    ctx.provide('shell', { execute: async () => ({ stdout: 'second', stderr: '', exitCode: 0 }) });

    const shell = ctx.get('shell');
    return shell.execute('').then((res) => {
      expect(res.stdout).toBe('second');
    });
  });
});
