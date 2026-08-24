/**
 * @chikumiku/db — shared Neon PostgreSQL connection layer.
 *
 * Exposes a lazily-initialized connection pool (sourced from Secrets Manager),
 * query/transaction helpers, pgvector formatting, and row mappers used by the
 * service repositories.
 */

export {
  getPool,
  query,
  withTransaction,
  toVector,
  closePool,
  getRawSecret,
  __setPoolForTesting,
} from './pool';
export type { DbPoolOptions } from './pool';

export {
  snakeToCamel,
  camelToSnake,
  rowToCamel,
  toIso,
  toIsoOrNull,
  toNumber,
} from './mappers';

// Re-export common pg types for repository implementations.
export type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
