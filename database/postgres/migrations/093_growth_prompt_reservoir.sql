-- Reusable prompt assets with experiment-backed effectiveness feedback.
SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_prompt_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  name varchar NOT NULL,
  prompt_body text NOT NULL,
  brand_slug varchar,
  category varchar,
  channel varchar,
  status varchar NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  source_copy_asset_id uuid,
  usage_count int NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  verified_count int NOT NULL DEFAULT 0 CHECK (verified_count >= 0),
  positive_count int NOT NULL DEFAULT 0 CHECK (positive_count >= 0),
  negative_count int NOT NULL DEFAULT 0 CHECK (negative_count >= 0),
  total_lift int NOT NULL DEFAULT 0,
  average_lift numeric(8,2) NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS growth_prompt_template_scope_idx
  ON rhautt_nexus.growth_prompt_template
  (tenant_id, status, brand_slug, channel, verified_count DESC, average_lift DESC);

CREATE UNIQUE INDEX IF NOT EXISTS growth_prompt_template_source_copy_uidx
  ON rhautt_nexus.growth_prompt_template (tenant_id, source_copy_asset_id)
  WHERE source_copy_asset_id IS NOT NULL;

ALTER TABLE rhautt_nexus.growth_copy_asset
  ADD COLUMN IF NOT EXISTS prompt_template_id uuid;

ALTER TABLE rhautt_nexus.growth_geo_experiment
  ADD COLUMN IF NOT EXISTS prompt_feedback_applied_at timestamptz;

ALTER TABLE rhautt_nexus.growth_prompt_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_prompt_template FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS growth_prompt_template_tenant_isolation ON rhautt_nexus.growth_prompt_template;
CREATE POLICY growth_prompt_template_tenant_isolation ON rhautt_nexus.growth_prompt_template
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON rhautt_nexus.growth_prompt_template TO rhautt_app;
