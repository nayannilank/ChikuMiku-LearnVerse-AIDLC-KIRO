/**
 * Small helpers for mapping between PostgreSQL rows (snake_case) and
 * application objects (camelCase), plus common value coercions.
 */

/** Converts a snake_case string to camelCase. */
export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Converts a camelCase string to snake_case. */
export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Shallowly maps a DB row's snake_case keys to camelCase. Values are passed
 * through unchanged. For precise typing, prefer explicit per-repository
 * mapping; this is a convenience for wide, uniform rows.
 */
export function rowToCamel<T = Record<string, unknown>>(
  row: Record<string, unknown>
): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = value;
  }
  return out as T;
}

/**
 * Coerces a pg TIMESTAMP/`Date` value to an ISO string. pg returns `Date`
 * objects for timestamp columns by default; some code paths receive strings.
 */
export function toIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/** Same as `toIso` but preserves null/undefined. */
export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return toIso(value);
}

/** Coerces a pg numeric/int value (which may arrive as a string) to a number. */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
}
