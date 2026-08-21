/**
 * Cryptographic Audit Integrity Signer & Verifier.
 *
 * Provides HMAC SHA-256 signature generation and tamper-detection for enterprise audit logs,
 * execution journals, and checkpoint manifests.
 * Prevents log forging, post-facto tampering, and unauthorized execution history modifications.
 */
import * as crypto from 'node:crypto';

export interface SignedAuditPayload<T> {
  readonly payload: T;
  readonly signature: string;
  readonly keyId: string;
  readonly algorithm: 'HMAC-SHA256';
  readonly signedAt: string;
}

export class AuditIntegritySigner {
  private readonly secretKey: string;
  private readonly keyId: string;

  constructor(options?: { secretKey?: string; keyId?: string }) {
    this.secretKey =
      options?.secretKey ??
      process.env['VI_HARNESS_AUDIT_KEY'] ??
      crypto.randomBytes(32).toString('hex');
    this.keyId = options?.keyId ?? 'key-v1';
  }

  /**
   * Compute HMAC SHA-256 digest of a serializable payload.
   */
  sign<T>(payload: T): SignedAuditPayload<T> {
    const signedAt = new Date().toISOString();
    const canonicalString = this.canonicalize({ payload, signedAt, keyId: this.keyId });
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(canonicalString);
    const signature = hmac.digest('hex');

    return {
      payload,
      signature,
      keyId: this.keyId,
      algorithm: 'HMAC-SHA256',
      signedAt,
    };
  }

  /**
   * Verify the cryptographic signature of a signed audit payload.
   */
  verify<T>(signed: SignedAuditPayload<T>): boolean {
    if (signed.algorithm !== 'HMAC-SHA256' || !signed.signature || !signed.signedAt) {
      return false;
    }

    const canonicalString = this.canonicalize({
      payload: signed.payload,
      signedAt: signed.signedAt,
      keyId: signed.keyId,
    });
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(canonicalString);
    const expectedSignature = hmac.digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signed.signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  private canonicalize(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return `[${obj.map((item) => this.canonicalize(item)).join(',')}]`;
    }
    const record = obj as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const entries = sortedKeys.map((k) => `"${k}":${this.canonicalize(record[k])}`);
    return `{${entries.join(',')}}`;
  }
}
