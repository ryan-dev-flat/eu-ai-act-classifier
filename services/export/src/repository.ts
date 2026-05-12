import { getPrimaryPool, withTransaction, type Pool, type PoolClient } from '@eu-ai-act/db';
import type { ClassificationResult, ExportFormat, ExportRecord, ExportType } from '@eu-ai-act/shared-types';

export interface RepositoryDeps {
  pool?: Pool;
}

export interface ClassificationMemoData {
  classificationId: string;
  systemId: string;
  systemName: string;
  domain: string;
  pathway: string;
  result: ClassificationResult;
}

interface ClassificationRow {
  classification_id: string;
  system_id: string;
  system_name: string;
  domain: string;
  pathway: string;
  rule_set_version_id: string;
  confidence: string | number;
  risk_tier: ClassificationResult['riskTier'];
  obligations_json: string[];
  rationale: string;
  open_questions: string[];
  triggered_reasons: ClassificationResult['triggeredHighRiskReasons'];
  suppressed_reasons: ClassificationResult['suppressedHighRiskReasons'];
  evaluated_at: Date;
}

interface ExportRow {
  id: string;
  classification_id: string | null;
  type: ExportType;
  format: ExportFormat;
  file_ref: string;
  generated_at: Date;
}

export async function loadClassificationMemoData(
  tenantId: string,
  classificationId: string,
  deps: RepositoryDeps = {},
): Promise<ClassificationMemoData | null> {
  const pool = deps.pool ?? getPrimaryPool();
  return withTransaction(pool, async (client) => {
    await scopeToTenant(client, tenantId);
    const res = await client.query<ClassificationRow>(
      `SELECT c.id AS classification_id,
              c.system_id,
              s.name AS system_name,
              s.domain,
              c.pathway,
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
         JOIN ai_systems s ON s.id = c.system_id
         JOIN classification_results r ON r.classification_id = c.id
        WHERE c.id = $1`,
      [classificationId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      classificationId: row.classification_id,
      systemId: row.system_id,
      systemName: row.system_name,
      domain: row.domain,
      pathway: row.pathway,
      result: {
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
      },
    };
  });
}

export async function createExportRecord(
  tenantId: string,
  input: {
    classificationId: string | null;
    type: ExportType;
    format: ExportFormat;
    fileRef: string;
    generatedBy: string;
  },
  deps: RepositoryDeps = {},
): Promise<ExportRecord> {
  const pool = deps.pool ?? getPrimaryPool();
  return withTransaction(pool, async (client) => {
    await scopeToTenant(client, tenantId);
    const res = await client.query<ExportRow>(
      `INSERT INTO exports (tenant_id, classification_id, type, format, file_ref, generated_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, classification_id, type, format, file_ref, generated_at`,
      [tenantId, input.classificationId, input.type, input.format, input.fileRef, input.generatedBy],
    );
    return toExportRecord(res.rows[0]!);
  });
}

export async function findExportRecord(
  tenantId: string,
  exportId: string,
  deps: RepositoryDeps = {},
): Promise<ExportRecord | null> {
  const pool = deps.pool ?? getPrimaryPool();
  return withTransaction(pool, async (client) => {
    await scopeToTenant(client, tenantId);
    const res = await client.query<ExportRow>(
      `SELECT id, classification_id, type, format, file_ref, generated_at
         FROM exports
        WHERE id = $1`,
      [exportId],
    );
    const row = res.rows[0];
    return row ? toExportRecord(row) : null;
  });
}

function toExportRecord(row: ExportRow): ExportRecord {
  return {
    exportId: row.id,
    classificationId: row.classification_id,
    type: row.type,
    format: row.format,
    fileRef: row.file_ref,
    downloadUrl: `/v1/exports/${row.id}`,
    generatedAt: row.generated_at.toISOString(),
  };
}

async function scopeToTenant(client: PoolClient, tenantId: string): Promise<void> {
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
}
