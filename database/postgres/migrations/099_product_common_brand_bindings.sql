-- Rhautt Nexus - Migration 099
-- Common product base brand bindings.
--
-- Product library architecture:
-- - products is the common product fact record.
-- - brand is not a data partition and must not create product copies.
-- - product_brand_bindings records which equipment brands can use/show the
--   common product, with brand-scoped model uniqueness.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_brand_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES rhautt_nexus.products(id) ON DELETE CASCADE,
  brand_code text NOT NULL,
  brand_model text NOT NULL,
  normalized_model text NOT NULL,
  brand_display_name text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS product_brand_bindings_brand_model_uidx
  ON rhautt_nexus.product_brand_bindings (tenant_id, brand_code, normalized_model)
  WHERE deleted_at IS NULL AND status <> 'archived';

CREATE INDEX IF NOT EXISTS product_brand_bindings_product_idx
  ON rhautt_nexus.product_brand_bindings (tenant_id, product_id, status)
  WHERE deleted_at IS NULL;

INSERT INTO rhautt_nexus.product_brand_bindings (
  tenant_id,
  product_id,
  brand_code,
  brand_model,
  normalized_model,
  brand_display_name,
  status,
  created_at,
  updated_at
)
SELECT
  p.tenant_id,
  p.id,
  lower(p.brand_code),
  p.model,
  p.normalized_model,
  p.name,
  'active',
  now(),
  now()
FROM rhautt_nexus.products p
WHERE p.deleted_at IS NULL
  AND COALESCE(p.brand_code, '') <> ''
  AND COALESCE(p.model, '') <> ''
  AND COALESCE(p.normalized_model, '') <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE rhautt_nexus.product_website_pricing
  ADD COLUMN IF NOT EXISTS brand_code text NOT NULL DEFAULT 'official';

UPDATE rhautt_nexus.product_website_pricing wp
SET brand_code = lower(COALESCE(NULLIF(p.brand_code, ''), NULLIF(wp.site_code, ''), 'official'))
FROM rhautt_nexus.products p
WHERE wp.product_id = p.id
  AND wp.brand_code = 'official';

DROP INDEX IF EXISTS rhautt_nexus.product_website_pricing_scope_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS product_website_pricing_scope_uidx
  ON rhautt_nexus.product_website_pricing (tenant_id, product_id, brand_code, site_code, locale)
  WHERE deleted_at IS NULL;

ALTER TABLE rhautt_nexus.product_brand_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.product_brand_bindings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_brand_bindings_tenant_isolation ON rhautt_nexus.product_brand_bindings;
CREATE POLICY product_brand_bindings_tenant_isolation ON rhautt_nexus.product_brand_bindings
  USING (tenant_id = rhautt_nexus.current_tenant_id()::text)
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id()::text);
