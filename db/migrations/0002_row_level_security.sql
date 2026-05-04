-- Up Migration
-- Tenant isolation via row-level security (architecture §5.2).
-- Application connections set `app.tenant_id` per request; the policy
-- enforces every read/write against that tenant.

ALTER TABLE classifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligation_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports                ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_systems             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_classifications ON classifications
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_ai_systems ON ai_systems
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- For child tables, isolation is enforced via the parent classification.
CREATE POLICY tenant_isolation_classification_answers ON classification_answers
  USING (
    classification_id IN (
      SELECT id FROM classifications
      WHERE tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

CREATE POLICY tenant_isolation_classification_results ON classification_results
  USING (
    classification_id IN (
      SELECT id FROM classifications
      WHERE tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

CREATE POLICY tenant_isolation_workflow_instances ON workflow_instances
  USING (
    classification_id IN (
      SELECT id FROM classifications
      WHERE tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

CREATE POLICY tenant_isolation_workflow_tasks ON workflow_tasks
  USING (
    workflow_id IN (
      SELECT id FROM workflow_instances
      WHERE classification_id IN (
        SELECT id FROM classifications
        WHERE tenant_id::text = current_setting('app.tenant_id', true)
      )
    )
  );

CREATE POLICY tenant_isolation_obligation_completions ON obligation_completions
  USING (
    classification_id IN (
      SELECT id FROM classifications
      WHERE tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

CREATE POLICY tenant_isolation_exports ON exports
  USING (
    classification_id IN (
      SELECT id FROM classifications
      WHERE tenant_id::text = current_setting('app.tenant_id', true)
    )
  );
