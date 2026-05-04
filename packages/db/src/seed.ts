import { getPrimaryPool, closePools } from './index.js';

async function seed(): Promise<void> {
  const pool = getPrimaryPool();
  // TODO: insert demo tenant, users, and a sample HR-tech AI system.
  // Wired up in the implementation phase; this stub keeps the script callable.
  await pool.query('SELECT 1');
  // eslint-disable-next-line no-console
  console.log('Seed complete (stub).');
}

seed()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePools());
