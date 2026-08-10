-- GEO minimal evidence-backed loop: preserve question scope, Qwen provider and publication proof.

ALTER TABLE rhautt_nexus.growth_copy_asset
  ADD COLUMN IF NOT EXISTS fact_refs jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE rhautt_nexus.growth_geo_experiment
  ADD COLUMN IF NOT EXISTS category varchar,
  ADD COLUMN IF NOT EXISTS probe_engine varchar NOT NULL DEFAULT 'hermes-center-ai',
  ADD COLUMN IF NOT EXISTS probe_provider varchar NOT NULL DEFAULT 'qwen-max',
  ADD COLUMN IF NOT EXISTS publication_url text;

UPDATE rhautt_nexus.growth_geo_experiment e
SET category = q.category
FROM rhautt_nexus.growth_geo_question q
WHERE e.question_id = q.id
  AND e.tenant_id = q.tenant_id
  AND e.category IS NULL;

UPDATE rhautt_nexus.growth_geo_experiment
SET category = 'home-comfort'
WHERE category IS NULL;

ALTER TABLE rhautt_nexus.growth_geo_experiment
  ALTER COLUMN category SET NOT NULL;
