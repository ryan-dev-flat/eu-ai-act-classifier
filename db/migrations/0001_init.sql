-- Up Migration
-- Initial schema for the EU AI Act Risk Classifier primary database.
-- Mirrors entities defined in architecture §4.1.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE tenants (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,
    region                TEXT NOT NULL DEFAULT 'eu-west-1',
    config                JSONB NOT NULL DEFAULT '{}'::jsonb,
    policy_overlay_id     UUID,
    sso_provider          TEXT NOT NULL DEFAULT 'none',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email                 CITEXT NOT NULL,
    role                  TEXT NOT NULL,
    privilege_flags       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    external_subject      TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE ai_systems (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    domain                TEXT NOT NULL,
    deployment_date       DATE,
    legacy_flag           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ai_systems_tenant_idx ON ai_systems (tenant_id);

CREATE TABLE classifications (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    system_id             UUID NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
    pathway               TEXT NOT NULL CHECK (pathway IN ('standard','gpai')),
    status                TEXT NOT NULL DEFAULT 'draft',
    rule_set_version_id   TEXT NOT NULL,
    confidence            NUMERIC(4,3),
    legal_privilege       BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_by          UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX classifications_tenant_idx ON classifications (tenant_id);
CREATE INDEX classifications_system_idx ON classifications (system_id);

CREATE TABLE classification_answers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classification_id     UUID NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
    question_id           TEXT NOT NULL,
    answer                JSONB NOT NULL,
    sequence              INTEGER NOT NULL
);
CREATE INDEX classification_answers_idx ON classification_answers (classification_id);

CREATE TABLE classification_results (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classification_id     UUID NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
    risk_tier             TEXT NOT NULL,
    obligations_json      JSONB NOT NULL,
    enforcement_status    JSONB,
    rationale             TEXT,
    open_questions        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    evaluated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX classification_results_idx ON classification_results (classification_id);

CREATE TABLE workflow_instances (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classification_id     UUID NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
    state                 TEXT NOT NULL DEFAULT 'pending',
    current_step          INTEGER NOT NULL DEFAULT 0,
    chain_definition_id   TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_tasks (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id           UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    assignee_id           UUID REFERENCES users(id),
    role                  TEXT NOT NULL,
    action                TEXT,
    comment               TEXT,
    completed_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX workflow_tasks_assignee_idx ON workflow_tasks (assignee_id) WHERE completed_at IS NULL;

CREATE TABLE obligation_completions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classification_id     UUID NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
    obligation_id         TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'pending',
    completed_at          TIMESTAMPTZ,
    evidence_link         TEXT,
    UNIQUE (classification_id, obligation_id)
);

CREATE TABLE exports (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classification_id     UUID NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
    type                  TEXT NOT NULL,
    format                TEXT NOT NULL,
    file_ref              TEXT NOT NULL,
    generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by          UUID REFERENCES users(id)
);

-- Down Migration
-- DROP TABLE IF EXISTS exports, obligation_completions, workflow_tasks,
--   workflow_instances, classification_results, classification_answers,
--   classifications, ai_systems, users, tenants CASCADE;
