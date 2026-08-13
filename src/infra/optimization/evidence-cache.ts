/**
 * Evidence Cache for Redundant Verification Minimization.
 *
 * Caches previous verification evidence by checkId and file content hash.
 * Reuses evidence if and only if target files remain unchanged, preventing
 * redundant test/linter runs while preserving verification integrity.
 */
import type { Evidence } from '../../core/model/evidence.js';

export interface CacheEntry {
  readonly evidence: Evidence;
  readonly fileHashes: Readonly<Record<string, string>>;
  readonly cachedAt: Date;
}

export class EvidenceCache {
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Retrieve cached evidence if checkId exists and all file hashes match.
   */
  get(checkId: string, currentHashes: Readonly<Record<string, string>>): Evidence | null {
    const entry = this.cache.get(checkId);
    if (!entry) return null;

    // Validate file hashes match exactly
    for (const [file, hash] of Object.entries(currentHashes)) {
      if (entry.fileHashes[file] !== hash) {
        return null; // File modified, invalid cache
      }
    }

    return entry.evidence;
  }

  /**
   * Cache evidence entry with current file hashes.
   */
  put(checkId: string, evidence: Evidence, fileHashes: Readonly<Record<string, string>>): void {
    this.cache.set(checkId, {
      evidence,
      fileHashes: { ...fileHashes },
      cachedAt: new Date(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
