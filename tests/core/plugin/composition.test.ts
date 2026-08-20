import { describe, it, expect } from 'vitest';
import {
  composePluginTree,
  resolvePluginOrder,
  parseProfileYaml,
  CircularDependencyError,
  type Profile,
  type Bundle,
  type PluginPatch,
  type Plugin,
} from '../../../src/core/plugin/index.js';

describe('Profile & Bundle Composition — P017', () => {
  const baseBundle: Bundle = {
    name: 'base',
    plugins: [
      { id: 'shell-provider', plugin: '@vi-harness/shell-local', config: { timeoutMs: 5000 } },
      { id: 'storage-provider', plugin: '@vi-harness/storage-sqlite' },
      { id: 'tool-registry', plugin: '@vi-harness/tool-registry' },
    ],
  };

  const webBundle: Bundle = {
    name: 'web',
    plugins: [
      { id: 'http-server', plugin: '@vi-harness/server-fastify', config: { port: 3000 } },
      { id: 'acp-server', plugin: '@vi-harness/acp-server' },
    ],
  };

  it('1. Composes plugin tree across ordered bundles', () => {
    const profile: Profile = {
      name: 'web-profile',
      bundles: ['base', 'web'],
    };

    const entries = composePluginTree(profile, { base: baseBundle, web: webBundle });
    expect(entries.length).toBe(5);
    expect(entries.map((e) => e.id)).toEqual([
      'shell-provider',
      'storage-provider',
      'tool-registry',
      'http-server',
      'acp-server',
    ]);
  });

  it('2. Profile patches override bundle configurations', () => {
    const profile: Profile = {
      name: 'custom-web',
      bundles: ['base', 'web'],
      patches: [
        {
          target: 'http-server',
          config: { port: 8080 },
        },
      ],
    };

    const entries = composePluginTree(profile, { base: baseBundle, web: webBundle });
    const serverEntry = entries.find((e) => e.id === 'http-server');
    expect(serverEntry?.config?.port).toBe(8080);
  });

  it('3. User patches override profile patches and swap plugin implementation', () => {
    const profile: Profile = {
      name: 'prod-profile',
      bundles: ['base'],
    };

    const userPatches: PluginPatch[] = [
      {
        target: 'shell-provider',
        plugin: '@my-org/shell-remote-sandbox',
        config: { host: 'sandbox.internal', timeoutMs: 15000 },
      },
    ];

    const entries = composePluginTree(profile, { base: baseBundle }, userPatches);
    const shellEntry = entries.find((e) => e.id === 'shell-provider');
    expect(shellEntry?.plugin).toBe('@my-org/shell-remote-sandbox');
    expect(shellEntry?.config?.host).toBe('sandbox.internal');
    expect(shellEntry?.config?.timeoutMs).toBe(15000);
  });

  it('4. Disabled patches filter out plugins from the final composed tree', () => {
    const profile: Profile = {
      name: 'lean-profile',
      bundles: ['base'],
      patches: [
        {
          target: 'storage-provider',
          disabled: true,
        },
      ],
    };

    const entries = composePluginTree(profile, { base: baseBundle });
    expect(entries.some((e) => e.id === 'storage-provider')).toBe(false);
    expect(entries.length).toBe(2);
  });

  it('5. Topological sort resolves plugin dependency ordering based on inject requirements', () => {
    const p1: Plugin = {
      name: 'tool-bash',
      inject: ['shell'],
      apply: () => {},
    };

    const p2: Plugin = {
      name: 'shell',
      apply: () => {},
    };

    const p3: Plugin = {
      name: 'logger',
      apply: () => {},
    };

    const ordered = resolvePluginOrder([p1, p2, p3]);
    const shellIndex = ordered.findIndex((p) => p.name === 'shell');
    const bashIndex = ordered.findIndex((p) => p.name === 'tool-bash');

    expect(shellIndex).toBeLessThan(bashIndex);
  });

  it('6. Detects circular dependencies and throws CircularDependencyError with diagnostic chain', () => {
    const pA: Plugin = {
      name: 'plugin-a',
      inject: ['plugin-b'],
      apply: () => {},
    };

    const pB: Plugin = {
      name: 'plugin-b',
      inject: ['plugin-c'],
      apply: () => {},
    };

    const pC: Plugin = {
      name: 'plugin-c',
      inject: ['plugin-a'],
      apply: () => {},
    };

    expect(() => resolvePluginOrder([pA, pB, pC])).toThrow(CircularDependencyError);
    expect(() => resolvePluginOrder([pA, pB, pC])).toThrow(/Circular plugin dependency detected/);
  });

  it('7. parseProfileYaml parses profile name, bundles, and patches', () => {
    const yaml = `
name: ci-eval
bundles:
  - base
  - ci
patches:
  - target: shell-provider
    plugin: '@vi-harness/shell-docker'
    disabled: false
`;

    const profile = parseProfileYaml(yaml);
    expect(profile.name).toBe('ci-eval');
    expect(profile.bundles).toEqual(['base', 'ci']);
    expect(profile.patches?.length).toBe(1);
    expect(profile.patches?.[0]?.target).toBe('shell-provider');
    expect(profile.patches?.[0]?.plugin).toBe('@vi-harness/shell-docker');
  });

  it('8. Diamond dependency graph orders dependencies before dependants', () => {
    // D depends on B and C; B and C both depend on A
    const pA: Plugin = { name: 'service-a', apply: () => {} };
    const pB: Plugin = { name: 'service-b', inject: ['service-a'], apply: () => {} };
    const pC: Plugin = { name: 'service-c', inject: ['service-a'], apply: () => {} };
    const pD: Plugin = { name: 'service-d', inject: ['service-b', 'service-c'], apply: () => {} };

    const ordered = resolvePluginOrder([pD, pB, pC, pA]);
    const idxA = ordered.findIndex((p) => p.name === 'service-a');
    const idxB = ordered.findIndex((p) => p.name === 'service-b');
    const idxC = ordered.findIndex((p) => p.name === 'service-c');
    const idxD = ordered.findIndex((p) => p.name === 'service-d');

    expect(idxA).toBeLessThan(idxB);
    expect(idxA).toBeLessThan(idxC);
    expect(idxB).toBeLessThan(idxD);
    expect(idxC).toBeLessThan(idxD);
  });

  it('9. Patching a target that is not in any bundle creates a new entry', () => {
    const profile: Profile = {
      name: 'ext-profile',
      bundles: ['base'],
    };

    const userPatches: PluginPatch[] = [
      {
        target: 'custom-metrics',
        plugin: '@my-org/datadog-sink',
        config: { apiKey: 'secret' },
      },
    ];

    const entries = composePluginTree(profile, { base: baseBundle }, userPatches);
    expect(entries.length).toBe(4);
    const customEntry = entries.find((e) => e.id === 'custom-metrics');
    expect(customEntry?.plugin).toBe('@my-org/datadog-sink');
  });
});
