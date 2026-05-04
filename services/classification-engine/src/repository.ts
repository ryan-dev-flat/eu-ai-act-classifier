import {
  getPrimaryPool,
  withTransaction,
  type Pool,
  type PoolClient,
} from '@eu-ai-act/db';
import type {
  ClassificationIntake,
  ClassificationResult,
  TriggeredCategory,
} from '@eu-ai-act/shared-types';

export interface RepositoryDeps {
  /** Override the pg Pool. Defaults to @eu-ai-act/db getPrimaryPool(). */
  pool?: Pool;
}

/**
 * Persists a classification together with its answers and result inside a
 * single transaction. Sets `app.tenant_id` per architecture §5.2 so the row
 * level security policies on classifications/classification_answers/
 * classification_results allow the inserts.
 */
export async function persistClassification(
  intake: ClassificationIntake,
  result: ClassificationResult,
  deps: RepositoryDeps = {},
): Promise<void> {
  const pool = deps.pool ?? getPrimaryPool();
  await withTransaction(pool, async (client) => {
    await scopeToTenant(client, intake.tenantId);

    await client.query(
      `INSERT INTO classifications
         (id, tenant_id, system_id, pathway, status, rule_set_version_id,
          confidence, submitted_by)
       VALUES ($1,$2,$3,$4,'submitted',$5,$6,$7)`,
      [
        result.classificationId,
        intake.tenantId,
        intake.systemId,
        intake.pathway,
        result.ruleSetVersion,
        result.confidence,
        intake.submitterId,
      ],
    );

    for (const a of intake.answers) {
      await client.query(
        `INSERT INTO classification_answers
           (classification_id, question_id, answer, sequence)
         VALUES ($1,$2,$3::jsonb,$4)`,
        [result.classificationId, a.questionId, JSON.stringify(a.value), a.sequence],
      );
    }

    await client.query(
      `INSERT INTO classification_results
         (classification_id, risk_tier, obligations_json, rationale,
          open_questions, triggered_reasons, suppressed_reasons, evaluated_at)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6::jsonb,$7::jsonb,$8)`,
      [
        result.classificationId,
        result.riskTier,
        JSON.stringify(result.obligations),
        result.rationale,
        result.openQuestions,
        JSON.stringify(result.triggeredHighRiskReasons),
        JSON.stringify(result.suppressedHighRiskReasons),
        result.evaluatedAt,
      ],
    );
  });
}

interface ClassificationRow {
  classification_id: string;
  rule_set_version_id: string;
  confidence: string | number;
  risk_tier: ClassificationResult['riskTier'];
  obligations_json: string[];
  rationale: string;
  open_questions: string[];
  triggered_reasons: TriggeredCategory[];
  suppressed_reasons: TriggeredCategory[];
  evaluated_at: Date;
}

/**
 * Loads a classification + its result for the given tenant. Returns null when
 * the row does not exist or belongs to a different tenant. RLS is enforced via
 * `app.tenant_id` regardless of the WHERE clause.
 */
export async function findClassificationById(
  tenantId: string,
  classificationId: string,
  deps: RepositoryDeps = {},
): Promise<ClassificationResult | null> {
  const pool = deps.pool ?? getPrimaryPool();
  return withTransaction(pool, async (client) => {
    await scopeToTenant(client, tenantId);
    const res = await client.query<ClassificationRow>(
      `SELECT c.id              AS classification_id,
              c.rule_set_version_id,
              c.confidence,
              r.risk_tier,
              r.obligations_json,
              r.rationale,
              r.open_questions,
              r.triggered_reasons,
              r.suppressed_reasons,
              r.evaluated_at
         FROM classifications c
         JOIN classification_results r ON r.classification_id = c.id
        WHERE c.id = $1`,
      [classificationId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      classificationId: row.classification_id,
      riskTier: row.risk_tier,
      obligations: row.obligations_json,
      ruleSetVersion: row.rule_set_version_id,
      confidence: typeof row.confidence === 'string' ? Number(row.confidence) : row.confidence,
      openQuestions: row.open_questions,
      rationale: row.rationale,
      triggeredHighRiskReasons: row.triggered_reasons,
      suppressedHighRiskReasons: row.suppressed_reasons,
      evaluatedAt: row.evaluated_at.toISOString(),
    };
  });
}

// `set_config(name, value, is_local=true)` is the parameterised equivalent of
// `SET LOCAL` and survives the transaction boundary cleanly.
async function scopeToTenant(client: PoolClient, tenantId: string): Promise<void> {
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
}
