/**
 * Content hashing utility for cache key generation.
 * Produces a deterministic hash from request payload data.
 */

import { createHash } from 'crypto';

/**
 * Computes a SHA-256 hash of the payload content.
 * Sorts object keys to ensure deterministic serialization.
 */
export function computeContentHash(payload: Record<string, unknown>): string {
  const normalized = stableStringify(payload);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Produces a stable JSON string by sorting keys at all levels.
 * This ensures the same payload always produces the same hash
 * regardless of property insertion order.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(item => stableStringify(item)).join(',') + ']';
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(
      key => JSON.stringify(key) + ':' + stableStringify(obj[key])
    );
    return '{' + pairs.join(',') + '}';
  }

  return JSON.stringify(value);
}
