// Pattern: Tool Output Spill Store (ref: DeepSeek Harness)
/**
 * Session-Scoped Tool Output Spill Store.
 *
 * Saves oversized tool results to disk files and allows retrieval by locator ID.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface SpillLocator {
  readonly id: string;
  readonly path: string;
  readonly totalChars: number;
  readonly totalLines: number;
  readonly createdAt: number;
}

export interface SpillStore {
  /** Save oversized tool output content and return a retrieval locator. */
  save(sessionId: string, callId: string, content: string): SpillLocator;

  /** Retrieve full output content using locator or locator ID. */
  retrieve(locator: SpillLocator | string): string;

  /** Remove all spill files created for a session. */
  cleanup(sessionId: string): void;
}

export class FileSpillStore implements SpillStore {
  private readonly baseDir: string;
  private readonly locators = new Map<string, SpillLocator>();
  private readonly sessionLocators = new Map<string, Set<string>>();

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(os.tmpdir(), 'vi-harness-spill');
  }

  save(sessionId: string, callId: string, content: string): SpillLocator {
    const sessionDir = path.join(this.baseDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const locatorId = `spill-${sessionId}-${callId}`;
    const filePath = path.join(sessionDir, `${callId}.txt`);

    fs.writeFileSync(filePath, content, 'utf-8');

    const totalChars = content.length;
    const totalLines = content.split('\n').length;

    const locator: SpillLocator = {
      id: locatorId,
      path: filePath,
      totalChars,
      totalLines,
      createdAt: Date.now(),
    };

    this.locators.set(locatorId, locator);

    const set = this.sessionLocators.get(sessionId) ?? new Set();
    set.add(locatorId);
    this.sessionLocators.set(sessionId, set);

    return locator;
  }

  retrieve(locatorOrId: SpillLocator | string): string {
    const id = typeof locatorOrId === 'string' ? locatorOrId : locatorOrId.id;
    const locator = this.locators.get(id);

    const filePath = locator?.path || (typeof locatorOrId === 'object' ? locatorOrId.path : null);

    if (filePath && fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }

    throw new Error(`Spill content not found for locator: ${id}`);
  }

  cleanup(sessionId: string): void {
    const sessionDir = path.join(this.baseDir, sessionId);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch {
        // Ignore deletion errors during cleanup
      }
    }

    const ids = this.sessionLocators.get(sessionId);
    if (ids) {
      for (const id of ids) {
        this.locators.delete(id);
      }
      this.sessionLocators.delete(sessionId);
    }
  }
}

export const defaultSpillStore = new FileSpillStore();
