import { getPrimaryPool, withTransaction, type Pool, type PoolClient } from '@eu-ai-act/db';

export interface RepositoryDeps {
  pool?: Pool;
}

interface SystemRow {
  classification_id: string;
  system_id: string;
  system_name: string;
  risk_tier: string;
  obligations_json: string[];
  open_questions: string[];
  evaluated_at: Date;
}

interface CompletionRow {
  obligation_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'not_applicable';
  completed_at: Date | null;
  evidence_link: string | null;
}

export async function findSystemReadiness(
  tenantId: string,
  classificationId: string,
  deps: RepositoryDeps = {},
): Promise<SystemRow & { completions: CompletionRow[] } | null> {
  const pool = deps.pool ?? getPrimaryPool();
  return withTransaction(pool, async (client) => {
    await scopeToTenant(client, tenantId);
    const sysRes = await client.query<SystemRow>(
      `SELECT c.id AS classification_id,
              c.system_id,
              s.name AS system_name,
              r.risk_tier,
              r.obligations_json,
              r.open_questions,
              r.evaluated_at
         FROM classifications c
         JOIN classification_results r ON r.classification_id = c.id
         JOIN ai_systems s ON s.id = c.system_id
        WHERE c.id = $1`,
      [classificationId],
    );
    const row = sysRes.rows[0];
    if (!row) return null;
    const compRes = await client.query<CompletionRow>(
      `SELECT obligation_id, status, completed_at, evidence_link
         FROM obligation_completions
        WHERE classification_id = $1`,
      [classificationId],
    );
    return { ...row, completions: compRes.rows };
  });
}

export async function findPortfolioReadiness(
  tenantId: string,
  deps: RepositoryDeps = {},
): Promise<Array<SystemRow & { completions: CompletionRow[] }>> {
  const pool = deps.pool ?? getPrimaryPool();
  return withTransaction(pool, async (client) => {
    await scopeToTenant(client, tenantId);
    const sysRes = await client.query<SystemRow>(
      `SELECT c.id AS classification_id,
              c.system_id,
              s.name AS system_name,
              r.risk_tier,
              r.obligations_json,
              r.open_questions,
              r.evaluated_at
         FROM classifications c
         JOIN classification_results r ON r.classification_id = c.id
         JOIN ai_systems s ON s.id = c.system_id
        ORDER BY r.evaluated_at DESC`,
    );
    const results: Array<SystemRow & { completions: CompletionRow[] }> = [];
    for (const row of sysRes.rows) {
      const compRes = await client.query<CompletionRow>(
        `SELECT obligation_id, status, completed_at, evidence_link
           FROM obligation_completions
          WHERE classification_id = $1`,
        [row.classification_id],
      );
      results.push({ ...row, completions: compRes.rows });
    }
    return results;
  });
}

async function scopeToTenant(client: PoolClient, tenantId: string): Promise<void> {
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
}
