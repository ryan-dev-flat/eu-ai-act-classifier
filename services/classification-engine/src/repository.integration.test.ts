import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, type Pool } from '@eu-ai-act/db';
import type {
  ClassificationIntake,
  ClassificationResult,
} from '@eu-ai-act/shared-types';
import { findClassificationById, persistClassification } from './repository.js';

// Integration test against a real Postgres. Gated on INTEGRATION_DATABASE_URL
// so it does not run in pure unit-test environments. Bring up the local stack
// with `docker compose up -d postgres` and run with:
//   INTEGRATION_DATABASE_URL=postgres://classifier:classifier@localhost:5432/classifier \
//     pnpm --filter @eu-ai-act/classification-engine test
const dbUrl = process.env.INTEGRATION_DATABASE_URL;

const tenantA = '00000000-0000-0000-0000-0000000000a1';
const tenantB = '00000000-0000-0000-0000-0000000000b1';
const systemA = '00000000-0000-0000-0000-0000000000a2';
const userA = '00000000-0000-0000-0000-0000000000a3';

function migrationsDir(): string {
  // services/classification-engine/src -> ../../../db/migrations
  return join(__dirname, '..', '..', '..', 'db', 'migrations');
}

function readMigration(file: string): string {
  return readFileSync(join(migrationsDir(), file), 'utf8');
}

function makeIntake(tenantId: string): ClassificationIntake {
  return {
    tenantId,
    systemId: systemA,
    pathway: 'standard',
    domain: 'hr_tech',
    templateId: 'standard-deployer',
    submitterId: userA,
    answers: [
      { questionId: 'used_for_recruitment_or_selection', value: true, sequence: 0 },
    ],
  };
}

function makeResult(classificationId: string): ClassificationResult {
  return {
    classificationId,
    riskTier: 'high_risk',
    obligations: ['art9_risk_management', 'art13_transparency_to_deployers'],
    ruleSetVersion: 'v1',
    confidence: 1,
    openQuestions: [],
    rationale: 'Annex III(4) employment use case.',
    triggeredHighRiskReasons: [
      { id: 'annex_iii_4_a_recruitment', article: 'Annex III(4)(a)', summary: 'Recruitment.' },
    ],
    suppressedHighRiskReasons: [],
    evaluatedAt: '2025-01-15T10:00:00.000Z',
  };
}

describe.skipIf(!dbUrl)('repository (live Postgres)', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPool({ connectionString: dbUrl, max: 4 });

    // Reset known tables (cascade catches workflow_tasks etc.) so the suite is
    // hermetic. Then ensure the seed tenants and ai_system rows exist with RLS
    // policies satisfied by the explicit set_config below.
    await pool.query("SELECT set_config('app.tenant_id', '*', true)");
    await pool.query('TRUNCATE classifications, ai_systems, users, tenants CASCADE');

    // Apply migrations idempotently (CREATE EXTENSION + CREATE TABLE IF...).
    // 0001 uses CREATE TABLE without IF NOT EXISTS so we only run it on a
    // freshly-created database. The Compose Postgres init scripts are
    // expected to have applied the schema already; if not, the integration
    // runner can apply it manually.
    try {
      await pool.query(readMigration('0001_init.sql'));
      await pool.query(readMigration('0002_row_level_security.sql'));
      await pool.query(readMigration('0003_classification_result_reasons.sql'));
    } catch {
      // Migrations already applied — schema is in place. Continue.
    }

    // Seed two tenants and the ai_system referenced by both intakes. We bypass
    // RLS for the seed by using a session that sets app.tenant_id to each.
    await pool.query("INSERT INTO tenants (id, name) VALUES ($1,'A'),($2,'B') ON CONFLICT DO NOTHING", [tenantA, tenantB]);
    for (const t of [tenantA, tenantB]) {
      await pool.query("SELECT set_config('app.tenant_id', $1, false)", [t]);
      await pool.query(
        "INSERT INTO ai_systems (id, tenant_id, name, domain) VALUES ($1,$2,'sys','hr_tech') ON CONFLICT DO NOTHING",
        [systemA, t],
      );
      await pool.query(
        "INSERT INTO users (id, tenant_id, email, role) VALUES ($1,$2,$3,'submitter') ON CONFLICT DO NOTHING",
        [userA, t, `submitter+${t}@test.local`],
      );
    }
  }, 30_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('persists intake + result and round-trips via findClassificationById', async () => {
    const cid = '11111111-1111-1111-1111-111111111111';
    await persistClassification(makeIntake(tenantA), makeResult(cid), { pool });

    const loaded = await findClassificationById(tenantA, cid, { pool });
    expect(loaded).not.toBeNull();
    expect(loaded?.classificationId).toBe(cid);
    expect(loaded?.riskTier).toBe('high_risk');
    expect(loaded?.obligations).toContain('art9_risk_management');
    expect(loaded?.triggeredHighRiskReasons[0]?.id).toBe('annex_iii_4_a_recruitment');
  });

  it('RLS prevents tenant B from reading tenant A classifications', async () => {
    const cid = '22222222-2222-2222-2222-222222222222';
    await persistClassification(makeIntake(tenantA), makeResult(cid), { pool });

    const crossTenant = await findClassificationById(tenantB, cid, { pool });
    expect(crossTenant).toBeNull();
  });
});
