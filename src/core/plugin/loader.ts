// Pattern: Plugin Discovery & Package Loading (ref: DeepSeek Harness, Cordis)
/**
 * Plugin Loader & Manifest Discovery Engine.
 *
 * Discovers and dynamically loads plugins from local files or npm packages
 * adhering to the `viHarness` manifest specification in package.json:
 * ```json
 * {
 *   "name": "@my-org/vi-harness-plugin-docker-shell",
 *   "viHarness": {
 *     "plugin": true,
 *     "provides": ["shell"],
 *     "consumes": ["tools"]
 *   }
 * }
 * ```
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Plugin } from './plugin.js';
import { HarnessError } from '../errors/base-error.js';
import { ErrorCode, ErrorCategory } from '../errors/error-codes.js';

export interface PluginManifest {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly provides?: ReadonlyArray<string>;
  readonly consumes?: ReadonlyArray<string>;
  readonly entryPoint?: string;
  readonly packagePath?: string;
}

export interface PluginLoader {
  loadFromPackage(name: string): Promise<Plugin>;
  loadFromFile(filePath: string): Promise<Plugin>;
  discover(searchDir?: string): Promise<PluginManifest[]>;
}

export class DefaultPluginLoader implements PluginLoader {
  /**
   * Load a plugin from an npm package or module name.
   */
  async loadFromPackage(name: string): Promise<Plugin> {
    try {
      const imported = await import(name);
      return this.instantiatePlugin(imported, name);
    } catch (err: any) {
      throw new HarnessError({
        code: ErrorCode.CONFIG_INVALID,
        category: ErrorCategory.CONFIGURATION,
        message: `Failed to load plugin package [${name}]: ${err.message}`,
        cause: err,
      });
    }
  }

  /**
   * Load a plugin from a local TypeScript/JavaScript file.
   */
  async loadFromFile(filePath: string): Promise<Plugin> {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new HarnessError({
        code: ErrorCode.CONFIG_INVALID,
        category: ErrorCategory.CONFIGURATION,
        message: `Plugin file not found at path: ${resolvedPath}`,
      });
    }

    try {
      const fileUrl = path.isAbsolute(resolvedPath)
        ? `file://${resolvedPath.replace(/\\/g, '/')}`
        : resolvedPath;
      const imported = await import(fileUrl);
      return this.instantiatePlugin(imported, path.basename(filePath, path.extname(filePath)));
    } catch (err: any) {
      throw new HarnessError({
        code: ErrorCode.CONFIG_INVALID,
        category: ErrorCategory.CONFIGURATION,
        message: `Failed to load plugin file [${filePath}]: ${err.message}`,
        cause: err,
      });
    }
  }

  /**
   * Discover available plugins by inspecting package.json files for "viHarness" metadata.
   */
  async discover(searchDir: string = process.cwd()): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];
    const nodeModulesDir = path.join(searchDir, 'node_modules');

    if (!fs.existsSync(nodeModulesDir)) {
      return manifests;
    }

    try {
      const entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name.startsWith('@')) {
            // Scoped packages directory (e.g. @vi-harness/...)
            const scopeDir = path.join(nodeModulesDir, entry.name);
            const scopedEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
            for (const scopedEntry of scopedEntries) {
              if (scopedEntry.isDirectory()) {
                const pkgPath = path.join(scopeDir, scopedEntry.name, 'package.json');
                this.inspectPackageJson(pkgPath, manifests);
              }
            }
          } else {
            const pkgPath = path.join(nodeModulesDir, entry.name, 'package.json');
            this.inspectPackageJson(pkgPath, manifests);
          }
        }
      }
    } catch {
      // Ignore directory read errors during discovery
    }

    return manifests;
  }

  private inspectPackageJson(pkgPath: string, manifests: PluginManifest[]): void {
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf-8');
        const json = JSON.parse(raw);
        if (json.viHarness && (json.viHarness.plugin === true || json.viHarness.provides)) {
          manifests.push({
            name: json.name,
            version: json.version,
            description: json.description,
            provides: json.viHarness.provides || [],
            consumes: json.viHarness.consumes || [],
            entryPoint: json.main || json.module || 'index.js',
            packagePath: path.dirname(pkgPath),
          });
        }
      } catch {
        // Skip malformed packages
      }
    }
  }

  private instantiatePlugin(imported: any, fallbackName: string): Plugin {
    const Target = imported.default || imported.Plugin || Object.values(imported)[0];

    if (typeof Target === 'function') {
      try {
        const instance = new Target();
        if (typeof instance.apply === 'function') {
          return instance;
        }
      } catch {
        // If constructor fails without args, try using function directly
        if (typeof Target.apply === 'function') {
          return Target;
        }
      }
    }

    if (Target && typeof Target.apply === 'function') {
      return Target;
    }

    if (imported && typeof imported.apply === 'function') {
      return imported;
    }

    // Wrap plain object or function
    return {
      name: Target?.name || fallbackName,
      apply: (ctx) => {
        if (typeof Target === 'function') {
          Target(ctx);
        }
      },
    };
  }
}
