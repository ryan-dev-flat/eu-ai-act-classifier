-- Initialize separate logical databases on the shared dev Postgres instance.
-- The audit DB is kept isolated to mirror production where it lives in a
-- separate, append-only store with restricted credentials (architecture §4.3).

CREATE USER audit WITH PASSWORD 'audit';
CREATE DATABASE audit OWNER audit;
GRANT ALL PRIVILEGES ON DATABASE audit TO audit;
