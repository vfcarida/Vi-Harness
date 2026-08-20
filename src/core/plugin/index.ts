export type { Plugin, Disposer, PluginRecord } from './plugin.js';
export { PluginState } from './plugin.js';

export type {
  ServiceMap,
  ShellService,
  ShellOpts,
  ShellResult,
  FileSystemService,
  SandboxService,
  AgentRegistry,
  SystemPromptAssembly,
  PluginStorageService,
} from './service-map.js';

export type { EventMap, EventHandler } from './event-map.js';

export type {
  WaterfallMap,
  WaterfallArgs,
  WaterfallReturn,
  WaterfallNext,
  WaterfallHandler,
  ToolExecutionRecord,
  ToolPreExecuteDecision,
} from './waterfall.js';
export { WaterfallEngine } from './waterfall.js';

export type { PluginContext } from './context.js';
export { DefaultPluginContext, MissingServiceError } from './context.js';

export type { PluginEntry, PluginPatch, Bundle, Profile } from './composition.js';
export {
  composePluginTree,
  resolvePluginOrder,
  parseProfileYaml,
  CircularDependencyError,
} from './composition.js';

export type { PluginManifest, PluginLoader } from './loader.js';
export { DefaultPluginLoader } from './loader.js';
