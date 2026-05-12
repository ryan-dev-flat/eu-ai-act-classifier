-- Up Migration
-- Portfolio-level exports (e.g. August 2026 readiness reports) are not tied to
-- a single classification, so exports need first-class tenant scoping.

ALTER TABLE exports ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE exports e
   SET tenant_id = c.tenant_id
  FROM classifications c
 WHERE e.classification_id = c.id
   AND e.tenant_id IS NULL;

ALTER TABLE exports ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE exports ALTER COLUMN classification_id DROP NOT NULL;

DROP POLICY IF EXISTS tenant_isolation_exports ON exports;
CREATE POLICY tenant_isolation_exports ON exports
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS exports_tenant_idx ON exports (tenant_id, generated_at DESC);

-- Down Migration
-- DROP INDEX IF EXISTS exports_tenant_idx;
-- DROP POLICY IF EXISTS tenant_isolation_exports ON exports;
-- ALTER TABLE exports ALTER COLUMN classification_id SET NOT NULL;
-- ALTER TABLE exports DROP COLUMN IF EXISTS tenant_id;
