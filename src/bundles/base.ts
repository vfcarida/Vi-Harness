/**
 * Base Plugin Bundle for Vi-Harness.
 *
 * Defines the standard composed plugin tree and capability seams.
 * DeepSeek Harness reference: "Everything is a Plugin via capability seams".
 */
import { KNOWN_BUNDLES } from '../infra/profile/profile-manager.js';
import type { ProfileBundle } from '../core/profile/types.js';

export interface CapabilitySeam {
  readonly seam: string;
  readonly defaultProvider: string;
  readonly description: string;
}

export const CAPABILITY_SEAMS: Record<string, CapabilitySeam> = {
  modelProvider: {
    seam: 'model-provider',
    defaultProvider: 'openai-compatible',
    description: 'LLM inference provider and streaming adapter seam',
  },
  contextCompiler: {
    seam: 'context-compiler',
    defaultProvider: 'default-context-compiler',
    description: '5-stage progressive context compilation and compaction pipeline seam',
  },
  gitManager: {
    seam: 'git-manager',
    defaultProvider: 'two-phase-git',
    description: 'Two-phase checkpointing, branch management, and rollback seam',
  },
  storage: {
    seam: 'storage-provider',
    defaultProvider: 'sqlite-store',
    description: 'SQLite persistence for sessions, experiences, and metrics seam',
  },
  securityPolicy: {
    seam: 'policy-engine',
    defaultProvider: 'default-policy-engine',
    description: '7-layer deny-first security perimeter seam',
  },
  mcpTransport: {
    seam: 'mcp-transport',
    defaultProvider: 'transport-registry',
    description: 'MCP stdio & HTTP/SSE transport layer seam',
  },
  experienceStore: {
    seam: 'experience-store',
    defaultProvider: 'sqlite-experience-store',
    description: 'Meta-Harness outer-loop experience and cross-run trace store seam',
  },
};

export const BASE_BUNDLE: ProfileBundle = {
  name: 'base',
  description: KNOWN_BUNDLES.base?.description || 'Core Vi-Harness engine with all capability seams active',
  defaultSettings: KNOWN_BUNDLES.base?.defaultSettings || { maxIterations: 50, safetyBounds: true },
};

export function resolvePluginTree(): { seams: Record<string, CapabilitySeam>; bundles: Record<string, unknown> } {
  return {
    seams: CAPABILITY_SEAMS,
    bundles: KNOWN_BUNDLES,
  };
}
