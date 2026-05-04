import { Pool, PoolConfig } from 'pg';

export type { Pool, PoolClient, PoolConfig } from 'pg';

let primaryPool: Pool | null = null;
let auditPool: Pool | null = null;

export function getPrimaryPool(config?: PoolConfig): Pool {
  if (!primaryPool) {
    primaryPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      ...config,
    });
  }
  return primaryPool;
}

export function getAuditPool(config?: PoolConfig): Pool {
  if (!auditPool) {
    auditPool = new Pool({
      connectionString: process.env.AUDIT_DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      ...config,
    });
  }
  return auditPool;
}

export async function withTransaction<T>(
  pool: Pool,
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
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

export async function closePools(): Promise<void> {
  await Promise.all([primaryPool?.end(), auditPool?.end()]);
  primaryPool = null;
  auditPool = null;
}

/**
 * Creates a one-off pool. Use this in tests so callers don't take a direct
 * dependency on `pg`. The returned pool must be `.end()`-ed by the caller.
 */
export function createPool(config: PoolConfig): Pool {
  return new Pool(config);
}
