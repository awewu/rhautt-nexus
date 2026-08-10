-- Content-factory digital asset library for copywriting / WeChat publishing.
-- Separate from growth_marketing_material, which represents marketing materials.
SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.growth_content_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  title varchar NOT NULL,
  asset_type varchar NOT NULL,
  brand_slug varchar,
  channel varchar,
  summary text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_artifact_id uuid,
  file_url text,
  thumbnail_url text,
  file_format varchar,
  usage_scene varchar,
  status varchar NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  usage_count int NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS growth_content_asset_tenant_type_idx
  ON rhautt_nexus.growth_content_asset (tenant_id, asset_type);

CREATE INDEX IF NOT EXISTS growth_content_asset_tenant_brand_idx
  ON rhautt_nexus.growth_content_asset (tenant_id, brand_slug);

CREATE INDEX IF NOT EXISTS growth_content_asset_tenant_status_idx
  ON rhautt_nexus.growth_content_asset (tenant_id, status);

ALTER TABLE rhautt_nexus.growth_content_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.growth_content_asset FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS growth_content_asset_tenant_isolation ON rhautt_nexus.growth_content_asset;
CREATE POLICY growth_content_asset_tenant_isolation ON rhautt_nexus.growth_content_asset
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON rhautt_nexus.growth_content_asset TO rhautt_app;
