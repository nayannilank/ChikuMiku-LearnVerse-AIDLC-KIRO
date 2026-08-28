/**
 * Shared Neon PostgreSQL connection pool.
 *
 * Provides a lazily-initialized, module-scoped `pg.Pool` for Lambda services.
 * The connection string is read once from Secrets Manager
 * (`learnverse/database-url`, field `DATABASE_URL` — the Neon *pooled*
 * endpoint) and reused across warm invocations.
 *
 * Neon requires TLS; `ssl.rejectUnauthorized` is false because the Lambda
 * runtime does not ship Neon's CA chain and the endpoint is trusted via the
 * connection string.
 *
 * pgvector note: node-postgres serializes JS arrays as PostgreSQL array
 * literals (`{1,2,3}`), which the `vector` type rejects. Use `toVector()` to
 * format an embedding as the `[1,2,3]` string literal pgvector expects.
 */

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

let pool: Pool | null = null;
let initPromise: Promise<Pool> | null = null;

/** Options for configuring the shared pool (mainly for testing). */
export interface DbPoolOptions {
  /** Secrets Manager secret id holding the database URL JSON. */
  databaseSecretId?: string;
  /** JSON field to read from the secret. Defaults to DATABASE_URL (pooled). */
  field?: string;
  /** Max clients in the pool. Keep small for Lambda concurrency. */
  max?: number;
  /** Idle timeout (ms) before a client is released. */
  idleTimeoutMillis?: number;
  /** Injectable SDK client (testing). */
  secretsClient?: SecretsManagerClient;
}

/**
 * Reads a secret string by id, optionally extracting one JSON field.
 */
export async function getRawSecret(
  secretId: string,
  field?: string,
  client: SecretsManagerClient = new SecretsManagerClient({})
): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );

  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no SecretString`);
  }

  if (!field) {
    return response.SecretString;
  }

  const parsed = JSON.parse(response.SecretString) as Record<string, string>;
  const value = parsed[field];
  if (!value) {
    throw new Error(`Secret field "${field}" is missing or empty in ${secretId}`);
  }
  return value;
}

/**
 * Returns the shared pool, creating it on first use. Concurrent first callers
 * share a single initialization.
 */
export async function getPool(options?: DbPoolOptions): Promise<Pool> {
  if (pool) {
    return pool;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const secretId =
      options?.databaseSecretId ??
      process.env.DATABASE_SECRET_ARN ??
      'learnverse/database-url';
    const field = options?.field ?? 'DATABASE_URL';

    const connectionString = await getRawSecret(
      secretId,
      field,
      options?.secretsClient
    );

    const created = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: options?.max ?? 3,
      idleTimeoutMillis: options?.idleTimeoutMillis ?? 30_000,
    });

    // Set search_path on every new client so unqualified table references
    // (e.g. `parent`, `learner`) resolve to the application schema first,
    // then fall back to `public` for extensions like uuid-ossp and vector.
    created.on('connect', (client) => {
      client.query(`SET search_path TO chikumiku_learnverse, public`);
    });

    pool = created;
    return created;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

/**
 * Runs a parameterized query against the shared pool.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const p = await getPool();
  return p.query<T>(text, params as never[]);
}

/**
 * Runs statements inside a single transaction. Commits on success, rolls back
 * on any thrown error.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = await getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Formats a numeric embedding as the string literal pgvector expects
 * (e.g. `[0.1,0.2,0.3]`). Pass the result as a normal bound parameter.
 */
export function toVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/** Closes the shared pool (tests / graceful shutdown). */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    initPromise = null;
  }
}

/** Overrides the shared pool (test seam). */
export function __setPoolForTesting(testPool: Pool | null): void {
  pool = testPool;
  initPromise = null;
}
