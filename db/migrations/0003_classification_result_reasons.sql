-- Up Migration
-- Stores the structured rationale produced by the OPA rule set so the
-- workbench UI can render the cited Annex III/I categories without re-running
-- the engine. See architecture §3.1 and `rules/v1/standard-deployer/`.

ALTER TABLE classification_results
    ADD COLUMN triggered_reasons  JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN suppressed_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Down Migration
-- ALTER TABLE classification_results
--     DROP COLUMN triggered_reasons,
--     DROP COLUMN suppressed_reasons;
