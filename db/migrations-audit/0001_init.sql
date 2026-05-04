-- Up Migration
-- Append-only audit log database (architecture §3.7, §4.3).
-- This database is provisioned with a separate role that has only INSERT
-- and SELECT privileges — UPDATE and DELETE are revoked at the role level.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE audit_events (
    event_id     UUID PRIMARY KEY,
    tenant_id    UUID NOT NULL,
    user_id      UUID,
    event_type   TEXT NOT NULL,
    entity_type  TEXT NOT NULL,
    entity_id    TEXT NOT NULL,
    payload      JSONB NOT NULL,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    prev_hash    TEXT,
    hash         TEXT NOT NULL
) PARTITION BY RANGE (timestamp);

-- Default partition; production deployment creates monthly partitions.
CREATE TABLE audit_events_default
    PARTITION OF audit_events DEFAULT;

CREATE INDEX audit_events_tenant_ts_idx
    ON audit_events (tenant_id, timestamp DESC);
CREATE INDEX audit_events_entity_idx
    ON audit_events (entity_type, entity_id);

-- Enforce immutability at the database level.
CREATE OR REPLACE FUNCTION audit_block_modifications()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_block_update
    BEFORE UPDATE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_block_modifications();

CREATE TRIGGER audit_block_delete
    BEFORE DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_block_modifications();
